import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { TokenTransferHookAccountDataNotFound } from "@solana/spl-token";
import { fromDaysToSeconds } from "../helpers/datetime";
import {
  createReleaseSchedule,
  initializeTokenlock,
  MAX_RELEASE_DELAY,
  mintReleaseSchedule,
} from "../helpers/tokenlock_helper";
import { createAccount, solToLamports, topUpWallet } from "../utils";
import { Tokenlock } from "../../target/types/tokenlock";
import { getNowTs } from "../helpers/clock_helper";

describe("Access Control force transfer between", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;
  let reserveAdminWalletRole: PublicKey;
  let walletsAdminWalletRole: PublicKey;
  let transferAdminWalletRole: PublicKey;
  const recipient = new Keypair();
  let recipientTokenAccount: PublicKey;
  const target = new Keypair();
  let targetTokenAccount: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    [reserveAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      );
    [walletsAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      );
    [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    recipientTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        recipient.publicKey,
        testEnvironment.contractAdmin
      );
    targetTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        target.publicKey,
        testEnvironment.contractAdmin
      );
  });

  it("fails when transfer hook data is not initialized", async () => {
    const amount = 1_000_000;
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.contractAdmin,
        testEnvironment.connection
      );
      assert.fail("Expected an error");
    } catch (error) {
      assert.instanceOf(error, TokenTransferHookAccountDataNotFound);
    }
  });

  const targetHolderId = 1;
  const recipientHolderId = 2;
  const groupId = 1;
  let groupPubkey: PublicKey;
  let targetHolderPubkey: PublicKey;
  let recipientHolderPubkey: PublicKey;
  let targetHolderGroupPubkey: PublicKey;
  let recipientHolderGroupPubkey: PublicKey;
  it("initialize transfer hook data", async () => {
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(targetHolderId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(recipientHolderId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(groupId),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    [targetHolderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(targetHolderId)
    );
    [recipientHolderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        new anchor.BN(recipientHolderId)
      );
    [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(groupId)
    );
    [targetHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        targetHolderPubkey,
        new anchor.BN(groupId)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      targetHolderGroupPubkey,
      targetHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    [recipientHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        recipientHolderPubkey,
        new anchor.BN(groupId)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      recipientHolderGroupPubkey,
      recipientHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      new anchor.BN(groupId),
      new anchor.BN(targetHolderId),
      targetHolderGroupPubkey,
      target.publicKey,
      targetTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      new anchor.BN(groupId),
      new anchor.BN(recipientHolderId),
      recipientHolderGroupPubkey,
      recipient.publicKey,
      recipientTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
      testEnvironment.walletsAdmin
    );
  });

  it("fails to mint more than maxTotalSupply", async () => {
    const { maxTotalSupply: maxTotalSupply } =
      await testEnvironment.accessControlHelper.accessControlData();

    const amount = maxTotalSupply
      .sub(new anchor.BN(testEnvironmentParams.initialSupply))
      .addn(1);
    const [recipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      recipientTokenAccount
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      recipient.publicKey,
      recipientTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    try {
      await testEnvironment.accessControlHelper.mintSecurities(
        amount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.reserveAdmin,
        recipientSaaPubkey
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MintExceedsMaxTotalSupply");
      assert.equal(
        error.errorMessage,
        "Cannot mint more than max total supply"
      );
    }
  });

  const unauthorizedErrorMsg =
    "Program log: AnchorError occurred. Error Code: Unauthorized. Error Number: 6000. Error Message: Unauthorized.";
  const amount = 1_000_000;
  it("does not allow forceTransferBetween for contract admin", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.contractAdmin,
        testEnvironment.connection
      );
      assert.fail("Expected an error");
    } catch (error) {
      error.logs.some((log: string) => log === unauthorizedErrorMsg);
    }
  });

  it("does not allow forceTransferBetween for wallets admin", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.walletsAdmin,
        testEnvironment.connection
      );
      assert.fail("Expected an error");
    } catch (error) {
      error.logs.some((log: string) => log === unauthorizedErrorMsg);
    }
  });

  it("does not allow forceTransferBetween for transfer admin", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.transferAdmin,
        testEnvironment.connection
      );
      assert.fail("Expected an error");
    } catch (error) {
      error.logs.some((log: string) => log === unauthorizedErrorMsg);
    }
  });

  it("fails when target account does not have enough balance", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        1_000_000,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.reserveAdmin,
        testEnvironment.connection
      );
      assert.fail("Expected an error");
    } catch (error) {
      assert.equal(
        error.transactionMessage,
        "Transaction simulation failed: Error processing Instruction 1: custom program error: 0x1"
      );
    }
  });

  it("force transfer between 2 wallets by reserve admin", async () => {
    const [targetSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      targetTokenAccount
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      target.publicKey,
      targetTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.accessControlHelper.mintSecurities(
      new anchor.BN(amount),
      target.publicKey,
      targetTokenAccount,
      testEnvironment.reserveAdmin,
      targetSaaPubkey
    );
    let { amount: targetAmountBefore } =
      await testEnvironment.mintHelper.getAccount(targetTokenAccount);
    let { amount: recipientAmountBefore } =
      await testEnvironment.mintHelper.getAccount(recipientTokenAccount);
    await testEnvironment.accessControlHelper.forceTransferBetween(
      1_000_000,
      target.publicKey,
      targetTokenAccount,
      recipient.publicKey,
      recipientTokenAccount,
      testEnvironment.reserveAdmin,
      testEnvironment.connection
    );
    let { amount: targetAmountAfter } =
      await testEnvironment.mintHelper.getAccount(targetTokenAccount);
    let { amount: recipientAmountAfter } =
      await testEnvironment.mintHelper.getAccount(recipientTokenAccount);
    assert.equal(targetAmountBefore - targetAmountAfter, BigInt(amount));
    assert.equal(recipientAmountAfter - recipientAmountBefore, BigInt(amount));
  });

  describe("when tokenlock escrow is set", () => {
    const tokenlockProgram = anchor.workspace
      .Tokenlock as anchor.Program<Tokenlock>;
    let tokenlockDataPubkey: PublicKey;
    let tokenlockWallet: Keypair;
    let escrowAccount: PublicKey;
    let escrowOwnerPubkey: PublicKey;
    const investorWallet = Keypair.generate();
    const cantForceTransferBetweenLockupError =
      "Program log: AnchorError occurred. Error Code: CantForceTransferBetweenLockup. Error Number: 6006. Error Message: Cannot force transfer between lockup accounts.";

    before(async () => {
      tokenlockWallet = Keypair.generate();
      tokenlockDataPubkey = tokenlockWallet.publicKey;

      await topUpWallet(
        testEnvironment.connection,
        testEnvironment.contractAdmin.publicKey,
        solToLamports(10)
      );
      const space = 1 * 1024 * 1024; // 1MB

      tokenlockDataPubkey = await createAccount(
        testEnvironment.connection,
        testEnvironment.contractAdmin,
        space,
        tokenlockProgram.programId
      );
      [escrowOwnerPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tokenlock"),
          testEnvironment.mintKeypair.publicKey.toBuffer(),
          tokenlockDataPubkey.toBuffer(),
        ],
        tokenlockProgram.programId
      );
      escrowAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          escrowOwnerPubkey,
          testEnvironment.contractAdmin,
          true
        );
      const maxReleaseDelay = new anchor.BN(MAX_RELEASE_DELAY);
      const minTimelockAmount = new anchor.BN(100);
      await initializeTokenlock(
        tokenlockProgram,
        maxReleaseDelay,
        minTimelockAmount,
        tokenlockDataPubkey,
        escrowAccount,
        testEnvironment.transferRestrictionsHelper
          .transferRestrictionDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.contractAdmin
      );

      const totalBatches = 4;
      const firstDelay = 0;
      const firstBatchBips = 800; // 8%
      const batchDelay = fromDaysToSeconds(4); // 4 days
      const scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        totalBatches,
        new anchor.BN(firstDelay),
        firstBatchBips,
        new anchor.BN(batchDelay),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRole,
        testEnvironment.reserveAdmin
      );

      let nowTs = await getNowTs(testEnvironment.connection);
      await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(1_000_000),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [testEnvironment.reserveAdmin.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        investorWallet.publicKey,
        testEnvironment.reserveAdmin,
        reserveAdminWalletRole,
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.mintKeypair.publicKey,
        testEnvironment.accessControlProgram.programId
      );

      await testEnvironment.accessControlProgram.methods
        .setLockupEscrowAccount()
        .accountsStrict({
          mint: testEnvironment.mintKeypair.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              testEnvironment.contractAdmin.publicKey
            )[0],
          escrowAccount,
          tokenlockAccount: tokenlockDataPubkey,
          payer: testEnvironment.contractAdmin.publicKey,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });

      const { holderIds: currentHolderIdx } =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
        currentHolderIdx,
        transferAdminWalletRole,
        testEnvironment.transferAdmin
      );
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx);
      const [holderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          holderPubkey,
          new anchor.BN(groupId)
        );
      await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
        holderGroupPubkey,
        holderPubkey,
        groupPubkey,
        transferAdminWalletRole,
        testEnvironment.transferAdmin
      );
      await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
        new anchor.BN(groupId),
        currentHolderIdx,
        holderGroupPubkey,
        escrowOwnerPubkey,
        escrowAccount,
        transferAdminWalletRole,
        testEnvironment.transferAdmin
      );
    });

    describe("when tokenlock escrow is a source account", () => {
      it("fails to force transfer between", async () => {
        try {
          await testEnvironment.accessControlHelper.forceTransferBetween(
            1_000_000,
            escrowOwnerPubkey,
            escrowAccount,
            recipient.publicKey,
            recipientTokenAccount,
            testEnvironment.reserveAdmin,
            testEnvironment.connection
          );
          assert.fail("Expected an error");
        } catch (error) {
          error.logs.some(
            (log: string) => log === cantForceTransferBetweenLockupError
          );
        }
      });
    });

    describe("when tokenlock escrow is a destination account", () => {
      it("fails to force transfer between", async () => {
        try {
          await testEnvironment.accessControlHelper.forceTransferBetween(
            1_000_000,
            target.publicKey,
            targetTokenAccount,
            escrowOwnerPubkey,
            escrowAccount,
            testEnvironment.reserveAdmin,
            testEnvironment.connection
          );
          assert.fail("Expected an error");
        } catch (error) {
          error.logs.some(
            (log: string) => log === cantForceTransferBetweenLockupError
          );
        }
      });
    });
  });
});
