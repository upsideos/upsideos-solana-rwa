import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { getNowTs } from "../helpers/clock_helper";

describe("Enforce transfer restrictions", () => {
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
  let firstGroupPubkey: PublicKey;
  let secondGroupPubkey: PublicKey;
  const investorWallet0 = Keypair.generate();
  let investorWallet0AssociatedAccount: PublicKey;
  const investorWallet1 = Keypair.generate();
  let investorWallet1AssociatedAccount: PublicKey;
  const investorWallet2 = Keypair.generate();
  let investorWallet2AssociatedAccount: PublicKey;
  let transferAdminRole: PublicKey;
  let securityAssociatedAccountFromPubkey: PublicKey;
  let securityAssociatedAccountToPubkey: PublicKey;
  let transferRulePubkey: PublicKey;
  let transferGroupPubkey: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    [transferAdminRole] = testEnvironment.accessControlHelper.walletRolePDA(
      testEnvironment.transferAdmin.publicKey
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      firstGroupIdx,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [firstGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(2),
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [secondGroupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(2)
    );
    let currentHolderIdx = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    let [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx);
    let [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      firstGroupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    investorWallet0AssociatedAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investorWallet0.publicKey,
        testEnvironment.reserveAdmin
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      firstGroupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investorWallet0.publicKey,
      investorWallet0AssociatedAccount,
      transferAdminRole,
      testEnvironment.transferAdmin
    );

    currentHolderIdx = currentHolderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      firstGroupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    investorWallet1AssociatedAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investorWallet1.publicKey,
        testEnvironment.reserveAdmin
      );
    testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      firstGroupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investorWallet1.publicKey,
      investorWallet1AssociatedAccount,
      transferAdminRole,
      testEnvironment.transferAdmin
    );

    currentHolderIdx = currentHolderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      firstGroupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );

    investorWallet2AssociatedAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investorWallet2.publicKey,
        testEnvironment.reserveAdmin
      );
    testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      firstGroupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investorWallet2.publicKey,
      investorWallet2AssociatedAccount,
      transferAdminRole,
      testEnvironment.transferAdmin
    );

    const lockedUntil = await getNowTs(testEnvironment.connection);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      new anchor.BN(lockedUntil),
      firstGroupIdx,
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    [securityAssociatedAccountFromPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorWallet0AssociatedAccount
      );
    [securityAssociatedAccountToPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorWallet1AssociatedAccount
      );
    [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        firstGroupIdx,
        firstGroupIdx
      );
    [transferGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
  });

  describe("when transfer rule is unlocked and transfers unpaused", () => {
    it("execute transaction successfully without error", async () => {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .enforceTransferRestrictions()
        .accountsStrict({
          sourceAccount: investorWallet0AssociatedAccount,
          mint: testEnvironment.mintKeypair.publicKey,
          destinationAccount: investorWallet1AssociatedAccount,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          securityAssociatedAccountFrom: securityAssociatedAccountFromPubkey,
          securityAssociatedAccountTo: securityAssociatedAccountToPubkey,
          transferRule: transferRulePubkey,
        })
        .signers([])
        .rpc({ commitment: testEnvironment.commitment });
      assert.ok(true);
    });
  });

  describe("when transfer rule is not approved", () => {
    before(async () => {
      await testEnvironment.transferRestrictionsHelper.setAllowTransferRule(
        new anchor.BN(0),
        transferRulePubkey,
        transferGroupPubkey,
        transferGroupPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.transferAdmin.publicKey
        )[0],
        testEnvironment.transferAdmin
      );
    });

    it("fails transaction with error", async () => {
      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .enforceTransferRestrictions()
          .accountsStrict({
            sourceAccount: investorWallet0AssociatedAccount,
            mint: testEnvironment.mintKeypair.publicKey,
            destinationAccount: investorWallet1AssociatedAccount,
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            securityAssociatedAccountFrom: securityAssociatedAccountFromPubkey,
            securityAssociatedAccountTo: securityAssociatedAccountToPubkey,
            transferRule: transferRulePubkey,
          })
          .signers([])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "TransferGroupNotApproved");
        assert.equal(error.errorMessage, "Transfer group not approved");
      }
    });
  });

  describe("when transfer rule not allowed until later", () => {
    before(async () => {
      const lockedUntil = await getNowTs(testEnvironment.connection);

      await testEnvironment.transferRestrictionsHelper.setAllowTransferRule(
        new anchor.BN(lockedUntil + 2000),
        transferRulePubkey,
        transferGroupPubkey,
        transferGroupPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.transferAdmin.publicKey
        )[0],
        testEnvironment.transferAdmin
      );
    });

    it("fails transaction with error", async () => {
      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .enforceTransferRestrictions()
          .accountsStrict({
            sourceAccount: investorWallet0AssociatedAccount,
            mint: testEnvironment.mintKeypair.publicKey,
            destinationAccount: investorWallet1AssociatedAccount,
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            securityAssociatedAccountFrom: securityAssociatedAccountFromPubkey,
            securityAssociatedAccountTo: securityAssociatedAccountToPubkey,
            transferRule: transferRulePubkey,
          })
          .signers([])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "TransferRuleNotAllowedUntilLater");
        assert.equal(
          error.errorMessage,
          "Transfer rule not allowed until later"
        );
      }
    });
  });

  describe("when transfer restrictions is paused", () => {
    before(async () => {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .pause(true)
        .accountsStrict({
          securityMint: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              testEnvironment.transferAdmin.publicKey
            )[0],
          payer: testEnvironment.transferAdmin.publicKey,
        })
        .signers([testEnvironment.transferAdmin])
        .rpc({ commitment: testEnvironment.commitment });
    });

    it("fails transaction with error", async () => {
      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .enforceTransferRestrictions()
          .accountsStrict({
            sourceAccount: investorWallet0AssociatedAccount,
            mint: testEnvironment.mintKeypair.publicKey,
            destinationAccount: investorWallet1AssociatedAccount,
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            securityAssociatedAccountFrom: securityAssociatedAccountFromPubkey,
            securityAssociatedAccountTo: securityAssociatedAccountToPubkey,
            transferRule: transferRulePubkey,
          })
          .signers([])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "AllTransfersPaused");
        assert.equal(error.errorMessage, "All transfers are paused");
      }
    });
  });
});
