import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { getNowTs } from "../helpers/clock_helper";

describe("Set allow transfer rule", () => {
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
  let lockedUntil: number;
  let groupFromPubkey: PublicKey,
    groupToPubkey: PublicKey,
    transferRulePubkey: PublicKey;

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
    lockedUntil = await getNowTs(testEnvironment.connection);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      new anchor.BN(lockedUntil),
      firstGroupIdx,
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    [groupFromPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    groupToPubkey = groupFromPubkey;
    [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        firstGroupIdx,
        firstGroupIdx
      );
  });

  it("fails to set allow transfer rule by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const lockedUntil = new anchor.BN(0);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAllowTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
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
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set allow transfer rule by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const lockedUntil = new anchor.BN(0);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAllowTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
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
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set allow transfer rule by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const lockedUntil = new anchor.BN(0);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAllowTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
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
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("sets allow transfer rule by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const lockedUntil = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .setAllowTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
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
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const transferRuleData =
      await testEnvironment.transferRestrictionsHelper.transferRuleData(
        transferRulePubkey
      );
    assert.equal(transferRuleData.lockedUntil.toNumber(), 0);
  });

  it("fails to set allow transfer rule with the same locked until", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const lockedUntil = new anchor.BN(0);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAllowTransferRule(firstGroupIdx, firstGroupIdx, lockedUntil)
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
