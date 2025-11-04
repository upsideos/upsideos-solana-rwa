import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { topUpWallet } from "../utils";

describe("Initialize transfer restriction rule", () => {
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
  const firstGroupIdx = new anchor.BN(1);

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("fails to initialize transfer rule by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupFromPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const groupToPubkey = groupFromPubkey;
    const lockedUntil = new anchor.BN(0);
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        firstGroupIdx,
        firstGroupIdx
      );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
        .accountsStrict({
          transferRule: transferRulePubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupFrom: groupFromPubkey,
          transferRestrictionGroupTo: groupToPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize transfer rule by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupFromPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const groupToPubkey = groupFromPubkey;
    const lockedUntil = new anchor.BN(0);
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        firstGroupIdx,
        firstGroupIdx
      );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
        .accountsStrict({
          transferRule: transferRulePubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupFrom: groupFromPubkey,
          transferRestrictionGroupTo: groupToPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize transfer rule by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupFromPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const groupToPubkey = groupFromPubkey;
    const lockedUntil = new anchor.BN(0);
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        firstGroupIdx,
        firstGroupIdx
      );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
        .accountsStrict({
          transferRule: transferRulePubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupFrom: groupFromPubkey,
          transferRestrictionGroupTo: groupToPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("initializes transfer rule by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupFromPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const groupToPubkey = groupFromPubkey;
    const lockedUntil = new anchor.BN(0);
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        firstGroupIdx,
        firstGroupIdx
      );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
      .accountsStrict({
        transferRule: transferRulePubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        transferRestrictionGroupFrom: groupFromPubkey,
        transferRestrictionGroupTo: groupToPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const transferRuleData =
      await testEnvironment.transferRestrictionsHelper.transferRuleData(
        transferRulePubkey
      );
    assert.equal(
      transferRuleData.lockedUntil.toNumber(),
      lockedUntil.toNumber()
    );
    assert.equal(
      transferRuleData.transferGroupIdFrom.toNumber(),
      firstGroupIdx.toNumber()
    );
    assert.equal(
      transferRuleData.transferGroupIdTo.toNumber(),
      firstGroupIdx.toNumber()
    );
    assert.equal(
      transferRuleData.transferRestrictionData.toBase58(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
    );
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    const authority = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);
    const secondGroupIdx = new anchor.BN(2);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      secondGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    const [groupFromPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(secondGroupIdx);
    const groupToPubkey = groupFromPubkey;
    const lockedUntil = new anchor.BN(0);
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        secondGroupIdx,
        secondGroupIdx
      );

    const payerBalanceBefore =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await testEnvironment.connection.getBalance(authority.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRule(secondGroupIdx, secondGroupIdx, lockedUntil)
      .accountsStrict({
        transferRule: transferRulePubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        transferRestrictionGroupFrom: groupFromPubkey,
        transferRestrictionGroupTo: groupToPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority, payer])
      .rpc({ commitment: testEnvironment.commitment });

    const payerBalanceAfter =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceAfter =
      await testEnvironment.connection.getBalance(authority.publicKey);

    // Payer's balance should have decreased (paid fees)
    assert.isTrue(
      payerBalanceAfter < payerBalanceBefore,
      "Payer balance should decrease after paying fees"
    );
    // Authority's balance should not decrease (only payer pays)
    assert.equal(
      authorityBalanceAfter,
      authorityBalanceBefore,
      "Authority balance should not change when not the payer"
    );
  });
});
