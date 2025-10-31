import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import {
  createTransferCheckedWithTransferHookInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { solToLamports, topUpWallet } from "../utils";
import { getNowTs } from "../helpers/clock_helper";

describe("Pause transfers", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 3,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
  });

  it("pause/unpause transfers by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .pause(true)
      .accountsStrict({
        securityMint: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const { paused } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.isTrue(paused);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .pause(false)
      .accountsStrict({
        securityMint: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const { paused: pausedAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.isFalse(pausedAfter);
  });

  it("fails to pause by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .pause(true)
        .accountsStrict({
          securityMint: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to pause by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .pause(true)
        .accountsStrict({
          securityMint: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("pauses transfers by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    const { paused: pausedBefore } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.isFalse(pausedBefore);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .pause(true)
      .accountsStrict({
        securityMint: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const { paused: pausedAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.isTrue(pausedAfter);
  });

  const investor = Keypair.generate();
  let investorTokenAccountPubkey: anchor.web3.PublicKey;
  let reserveAdminTokenAccountPubkey: anchor.web3.PublicKey;
  let walletsAdminWalletRole: anchor.web3.PublicKey;
  let transferAdminWalletRole: anchor.web3.PublicKey;
  const holderReserveAdminId = 0;
  const holderInvestorId = 1;
  const groupId = 1;
  let groupPubkey: anchor.web3.PublicKey;
  let reserveAdminHolderPubkey: anchor.web3.PublicKey;
  let reserveAdminHolderGroupPubkey: anchor.web3.PublicKey;
  let investorHolderPubkey: anchor.web3.PublicKey;
  let investorHolderGroupPubkey: anchor.web3.PublicKey;
  it("reserve admin can still transfer and mint when paused", async () => {
    const amount = 1_000_000 * 10 ** testEnvironmentParams.mint.decimals;
    reserveAdminTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
    investorTokenAccountPubkey =
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      investor.publicKey,
      testEnvironment.reserveAdmin
    );
    [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(groupId),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    [walletsAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      testEnvironment.reserveAdmin.publicKey,
      reserveAdminTokenAccountPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
      new anchor.BN(groupId)
    );

    const [reserveAdminSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      reserveAdminTokenAccountPubkey
    );

    await testEnvironment.accessControlHelper.mintSecurities(
      new anchor.BN(amount),
      testEnvironment.reserveAdmin.publicKey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.reserveAdmin,
      reserveAdminSaaPubkey
    );
    const { amount: amountAfterMint } =
      await testEnvironment.mintHelper.getAccount(
        reserveAdminTokenAccountPubkey
      );
    assert.equal(amountAfterMint.toString(), amount.toString());
    const forceTransferAmount =
      100_000 * 10 ** testEnvironmentParams.mint.decimals;

    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(holderInvestorId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    [investorHolderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        new anchor.BN(holderInvestorId)
      );
    [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(groupId)
    );
    [investorHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        investorHolderPubkey,
        new anchor.BN(groupId)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      investorHolderGroupPubkey,
      investorHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      investorHolderPubkey,
      investorHolderGroupPubkey,
      investor.publicKey,
      investorTokenAccountPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );

    await testEnvironment.accessControlHelper.forceTransferBetween(
      forceTransferAmount,
      testEnvironment.reserveAdmin.publicKey,
      reserveAdminTokenAccountPubkey,
      investor.publicKey,
      investorTokenAccountPubkey,
      testEnvironment.reserveAdmin,
      testEnvironment.connection
    );

    const { amount: amountAfterForceTransfer } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(
      amountAfterForceTransfer.toString(),
      forceTransferAmount.toString()
    );

    // transfer is forbidden
    const transferAmount = BigInt(forceTransferAmount);
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        testEnvironment.connection,
        investorTokenAccountPubkey,
        testEnvironment.mintKeypair.publicKey,
        reserveAdminTokenAccountPubkey,
        investor.publicKey,
        transferAmount,
        testEnvironmentParams.mint.decimals,
        undefined,
        testEnvironment.commitment,
        TOKEN_2022_PROGRAM_ID
      );

    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );
    try {
      await sendAndConfirmTransaction(
        testEnvironment.connection,
        new Transaction().add(transferWithHookInstruction),
        [investor],
        { commitment: testEnvironment.commitment }
      );
      assert.fail("Expect an error");
    } catch (error) {
      const msg =
        "Program log: AnchorError occurred. Error Code: AllTransfersPaused. Error Number: 6004. Error Message: All transfers are paused.";
      const isAllTransfersPaused = error.logs.some(
        (log: string) => log === msg
      );
      assert.isTrue(isAllTransfersPaused);
    }
  });

  it("unpauses transfers by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    const { paused: pausedBefore } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.isTrue(pausedBefore);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .pause(false)
      .accountsStrict({
        securityMint: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const { paused: pausedAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.isFalse(pausedAfter);
  });

  it("allows transfer after unpausing", async () => {
    const tsNow = await getNowTs(testEnvironment.connection);
    const lockedUntil = new anchor.BN(tsNow);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      new anchor.BN(groupId),
      new anchor.BN(groupId),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const { amount: amountBeforeTransfer } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    const { amount: reserveAmountBeforeTransfer } =
      await testEnvironment.mintHelper.getAccount(
        reserveAdminTokenAccountPubkey
      );
    const transferAmount = amountBeforeTransfer;
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        testEnvironment.connection,
        investorTokenAccountPubkey,
        testEnvironment.mintKeypair.publicKey,
        reserveAdminTokenAccountPubkey,
        investor.publicKey,
        amountBeforeTransfer,
        testEnvironmentParams.mint.decimals,
        undefined,
        testEnvironment.commitment,
        TOKEN_2022_PROGRAM_ID
      );
    await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferWithHookInstruction),
      [investor],
      { commitment: testEnvironment.commitment }
    );

    const { amount: amountAfterTransfer } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(amountAfterTransfer.toString(), "0");
    const { amount: reserveAmountAfterTransfer } =
      await testEnvironment.mintHelper.getAccount(
        reserveAdminTokenAccountPubkey
      );
    assert.equal(
      reserveAmountAfterTransfer.toString(),
      (reserveAmountBeforeTransfer + BigInt(transferAmount)).toString()
    );
  });

  it("fails to pause with the same value as it is on-chain", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .pause(false)
        .accountsStrict({
          securityMint: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ValueUnchanged");
      assert.equal(
        error.errorMessage,
        "The provided value is already set. No changes were made"
      );
    }
  });
});
