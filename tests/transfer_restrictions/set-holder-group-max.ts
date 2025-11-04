import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Set holder group max", () => {
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
  const zeroIdx = new anchor.BN(0);
  const firstGroupIdx = new anchor.BN(1);
  let groupPubkey: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      zeroIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
  });

  it("fails to set holder group max by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderGroupMax(firstGroupIdx, maxHolders)
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          group: groupPubkey,
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

  it("fails to set holder group max by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderGroupMax(firstGroupIdx, maxHolders)
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          group: groupPubkey,
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

  it("fails to set holder group max by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderGroupMax(firstGroupIdx, maxHolders)
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          group: groupPubkey,
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

  describe("for non-zero group", () => {
    describe("when current holders count is less than new holder group max", () => {
      it("sets holder group max by transfer admin", async () => {
        const signer = testEnvironment.transferAdmin;
        const [authorityWalletRolePubkey] =
          testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
        const maxHolders = new anchor.BN(10);
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setHolderGroupMax(firstGroupIdx, maxHolders)
          .accountsStrict({
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            accessControlAccount:
              testEnvironment.accessControlHelper.accessControlPubkey,
            mint: testEnvironment.mintKeypair.publicKey,
            authorityWalletRole: authorityWalletRolePubkey,
            group: groupPubkey,
            payer: signer.publicKey,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
        const groupData =
          await testEnvironment.transferRestrictionsHelper.groupData(
            groupPubkey
          );
        assert.equal(groupData.maxHolders.toNumber(), maxHolders.toNumber());
      });
    });

    describe("when current holders count is equal to new holder group max", () => {
      it("fails to set holder group max", async () => {
        const signer = testEnvironment.transferAdmin;
        const [authorityWalletRolePubkey] =
          testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
        try {
          const { maxHolders } =
            await testEnvironment.transferRestrictionsHelper.groupData(
              groupPubkey
            );

          await testEnvironment.transferRestrictionsHelper.program.methods
            .setHolderGroupMax(firstGroupIdx, maxHolders)
            .accountsStrict({
              transferRestrictionData:
                testEnvironment.transferRestrictionsHelper
                  .transferRestrictionDataPubkey,
              accessControlAccount:
                testEnvironment.accessControlHelper.accessControlPubkey,
              mint: testEnvironment.mintKeypair.publicKey,
              authorityWalletRole: authorityWalletRolePubkey,
              group: groupPubkey,
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

    describe("when current holders count is greater than new holder group max", () => {
      before(async () => {
        const investors = [Keypair.generate(), Keypair.generate()];
        let { holderIds: currentHolderId } =
          await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
        const [transferAdminWalletRole] =
          testEnvironment.accessControlHelper.walletRolePDA(
            testEnvironment.transferAdmin.publicKey
          );

        for (const investor of investors) {
          const investorAssociatedTokenAccountPubkey =
            await testEnvironment.mintHelper.createAssociatedTokenAccount(
              investor.publicKey,
              testEnvironment.reserveAdmin
            );
          await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
            currentHolderId,
            transferAdminWalletRole,
            testEnvironment.transferAdmin
          );
          const [holderPubkey] =
            testEnvironment.transferRestrictionsHelper.holderPDA(
              currentHolderId
            );
          const [holderGroupPubkey] =
            testEnvironment.transferRestrictionsHelper.holderGroupPDA(
              holderPubkey,
              firstGroupIdx
            );
          await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
            holderGroupPubkey,
            holderPubkey,
            groupPubkey,
            transferAdminWalletRole,
            testEnvironment.transferAdmin
          );
          await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
            firstGroupIdx,
            currentHolderId,
            holderGroupPubkey,
            investor.publicKey,
            investorAssociatedTokenAccountPubkey,
            transferAdminWalletRole,
            testEnvironment.transferAdmin
          );
          currentHolderId = currentHolderId.addn(1);
        }
      });

      it("fails to set holder group max", async () => {
        const signer = testEnvironment.transferAdmin;
        const [authorityWalletRolePubkey] =
          testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
        const {
          currentHoldersCount: currentHoldersCount,
          maxHolders: currentMaxHolders,
        } = await testEnvironment.transferRestrictionsHelper.groupData(
          groupPubkey
        );
        const maxHolders = currentHoldersCount.subn(1);
        try {
          await testEnvironment.transferRestrictionsHelper.program.methods
            .setHolderGroupMax(firstGroupIdx, maxHolders)
            .accountsStrict({
              transferRestrictionData:
                testEnvironment.transferRestrictionsHelper
                  .transferRestrictionDataPubkey,
              accessControlAccount:
                testEnvironment.accessControlHelper.accessControlPubkey,
              mint: testEnvironment.mintKeypair.publicKey,
              authorityWalletRole: authorityWalletRolePubkey,
              group: groupPubkey,
              payer: signer.publicKey,
            })
            .signers([signer])
            .rpc({ commitment: testEnvironment.commitment });
          assert.fail("Expect an error");
        } catch ({ error }) {
          assert.equal(
            error.errorCode.code,
            "NewHolderGroupMaxMustExceedCurrentHolderGroupCount"
          );
          assert.equal(
            error.errorMessage,
            "New holder group max must exceed current holder group count"
          );
        }
      });
    });
  });

  describe("for zero group", () => {
    it("fails to set holder group max", async () => {
      const signer = testEnvironment.transferAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
      const maxHolders = new anchor.BN(10);
      const [zeroGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setHolderGroupMax(zeroIdx, maxHolders)
          .accountsStrict({
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            accessControlAccount:
              testEnvironment.accessControlHelper.accessControlPubkey,
            mint: testEnvironment.mintKeypair.publicKey,
            authorityWalletRole: authorityWalletRolePubkey,
            group: zeroGroupPubkey,
            payer: signer.publicKey,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(
          error.errorCode.code,
          "ZeroGroupHolderGroupMaxCannotBeNonZero"
        );
        assert.equal(
          error.errorMessage,
          "Zero group holder group max cannot be non-zero"
        );
      }
    });
  });
});
