import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Set Address Permission", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;
  const group0Idx = new anchor.BN(0);
  let group0Pubkey: PublicKey;
  const group1Idx = new anchor.BN(1);
  let group1Pubkey: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      group1Idx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    [group0Pubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(group0Idx);
    [group1Pubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(group1Idx);
  });

  describe("New wallet scenario", () => {
    it("Transfer admin can set address permission (freeze) for new wallet", async () => {
      const userWallet = Keypair.generate();
      const signer = testEnvironment.transferAdmin;

      const userTokenAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          userWallet.publicKey,
          testEnvironment.reserveAdmin
        );

      // Get transfer restriction data to know the holder ID
      const transferRestrictionDataBefore =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      const expectedHolderId = transferRestrictionDataBefore.holderIds;

      // Derive PDAs
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(expectedHolderId);

      const [holderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          holderPubkey,
          group0Idx
        );

      const [securityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          userTokenAccount
        );

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      const [transferRestrictionGroupNewPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(group0Idx);

      await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
        expectedHolderId,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.walletsAdmin.publicKey
        )[0],
        testEnvironment.walletsAdmin
      );

      await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
        holderGroupPubkey,
        holderPubkey,
        group0Pubkey,
        authorityWalletRolePubkey,
        signer
      );

      // Verify wallet is not frozen initially
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );
      assert.isFalse(tokenAccountBefore.isFrozen);

      // Set address permission (freeze) for new wallet
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, true)
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          transferRestrictionGroupNew: transferRestrictionGroupNewPubkey,
          transferRestrictionHolder: holderPubkey,
          holderGroupNew: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: userWallet.publicKey,
          userAssociatedTokenAccount: userTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          accessControlProgram: testEnvironment.accessControlProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
          transferRestrictionGroupCurrent: null,
          holderGroupCurrent: null,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Verify wallet is frozen
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );
      assert.isTrue(tokenAccountAfter.isFrozen);

      // Verify holder wallet count was updated
      const holderData =
        await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
      assert.equal(holderData.id.toString(), expectedHolderId.toString());
      assert.equal(
        holderData.transferRestrictionData.toBase58(),
        testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
      );
      assert.isTrue(holderData.active);
      assert.equal(holderData.currentWalletsCount.toNumber(), 1);

      // Verify holder_group wallet count was updated
      const holderGroupData =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      assert.equal(holderGroupData.group.toNumber(), 0);
      assert.equal(holderGroupData.holder.toBase58(), holderPubkey.toBase58());
      assert.equal(holderGroupData.currentWalletsCount.toNumber(), 1);

      // Verify security associated account was created
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          securityAssociatedAccountPubkey
        );
      assert.equal(securityAssociatedAccountData.group.toNumber(), 0);
      assert.equal(
        securityAssociatedAccountData.holder.toBase58(),
        holderPubkey.toBase58()
      );

    });

    it("Wallets admin can set address permission (thaw) for new wallet", async () => {
      const userWallet = Keypair.generate();
      const signer = testEnvironment.walletsAdmin;

      const userTokenAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          userWallet.publicKey,
          testEnvironment.transferAdmin
        );

      // Get transfer restriction data to know the holder ID
      const transferRestrictionDataBefore =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      const expectedHolderId = transferRestrictionDataBefore.currentHoldersCount;

      // Derive PDAs
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(expectedHolderId);

      const [holderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          holderPubkey,
          group0Idx
        );

      const [securityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          userTokenAccount
        );

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      const [transferRestrictionGroupNewPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(group0Idx);

      await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
        expectedHolderId,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.walletsAdmin.publicKey
        )[0],
        testEnvironment.walletsAdmin
      );

      await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
        holderGroupPubkey,
        holderPubkey,
        group0Pubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.transferAdmin.publicKey
        )[0],
        testEnvironment.transferAdmin
      );

      // Set address permission (thaw) for new wallet - wallet starts unfrozen
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, false)
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          transferRestrictionGroupNew: transferRestrictionGroupNewPubkey,
          transferRestrictionHolder: holderPubkey,
          holderGroupNew: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: userWallet.publicKey,
          userAssociatedTokenAccount: userTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          accessControlProgram: testEnvironment.accessControlProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
          transferRestrictionGroupCurrent: null,
          holderGroupCurrent: null,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Verify wallet is not frozen
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );
      assert.isFalse(tokenAccountAfter.isFrozen);
    });
  });

  describe("Existing wallet scenario", () => {
    const existingUserWallet = Keypair.generate();
    let existingUserTokenAccount: PublicKey;
    let existingHolderPubkey: PublicKey;
    let existingHolderGroupPubkey: PublicKey;
    let existingSecurityAssociatedAccountPubkey: PublicKey;
    let transferAdminRole: PublicKey;

    before(async () => {
      // Setup an existing wallet in group 0
      transferAdminRole = testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0];

      const transferRestrictionData =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      const holderId = transferRestrictionData.holderIds;

      [existingHolderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(holderId);

      [existingHolderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          existingHolderPubkey,
          group0Idx
        );

      await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
        holderId,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.walletsAdmin.publicKey
        )[0],
        testEnvironment.walletsAdmin
      );

      await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
        existingHolderGroupPubkey,
        existingHolderPubkey,
        group0Pubkey,
        transferAdminRole,
        testEnvironment.transferAdmin
      );

      existingUserTokenAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          existingUserWallet.publicKey,
          testEnvironment.transferAdmin
        );

      [existingSecurityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          existingUserTokenAccount
        );

      await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
        group0Pubkey,
        existingHolderPubkey,
        existingHolderGroupPubkey,
        existingUserWallet.publicKey,
        existingUserTokenAccount,
        transferAdminRole,
        testEnvironment.transferAdmin
      );
    });

    it("Transfer admin can set address permission (freeze) for existing wallet", async () => {
      const signer = testEnvironment.transferAdmin;

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Verify wallet is not frozen initially
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.isFalse(tokenAccountBefore.isFrozen);

      // Set address permission (freeze) for existing wallet
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, true)
        .accountsStrict({
          securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
          transferRestrictionGroupNew: group0Pubkey,
          transferRestrictionHolder: existingHolderPubkey,
          holderGroupNew: existingHolderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: existingUserWallet.publicKey,
          userAssociatedTokenAccount: existingUserTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          accessControlProgram: testEnvironment.accessControlProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
          transferRestrictionGroupCurrent: null,
          holderGroupCurrent: null,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Verify wallet is frozen
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.isTrue(tokenAccountAfter.isFrozen);

      // Verify security associated account group is unchanged
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      assert.equal(securityAssociatedAccountData.group.toNumber(), 0);
    });

    it("Wallets admin can set address permission (thaw) for existing wallet", async () => {
      const signer = testEnvironment.walletsAdmin;

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Set address permission (thaw) for existing wallet
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, false)
        .accountsStrict({
          securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
          transferRestrictionGroupNew: group0Pubkey,
          transferRestrictionHolder: existingHolderPubkey,
          holderGroupNew: existingHolderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: existingUserWallet.publicKey,
          userAssociatedTokenAccount: existingUserTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          accessControlProgram: testEnvironment.accessControlProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
          transferRestrictionGroupCurrent: null,
          holderGroupCurrent: null,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Verify wallet is not frozen
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.isFalse(tokenAccountAfter.isFrozen);
    });

    it("Transfer admin can update wallet group and freeze for existing wallet", async () => {
      const signer = testEnvironment.transferAdmin;

      // Create a new holder group for group 1
      const [newHolderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          existingHolderPubkey,
          group1Idx
        );

      await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
        newHolderGroupPubkey,
        existingHolderPubkey,
        group1Pubkey,
        transferAdminRole,
        testEnvironment.transferAdmin
      );

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Get counts before
      const holderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          existingHolderGroupPubkey
        );
      const newHolderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          newHolderGroupPubkey
        );
      const group0DataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);
      const group1DataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(group1Pubkey);

      // Get the existing holder's ID from the holder data
      const existingHolderData =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const existingHolderId = existingHolderData.id;

      // Derive transfer_restriction_holder PDA using the existing holder's ID
      // This ensures the PDA constraint matches
      const [transferRestrictionHolderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(existingHolderId);

      // Use the already-initialized holder_group_new (it was initialized with existingHolderPubkey)
      // The holder_group_new seeds use transfer_restriction_holder, so they must match
      const holderGroupNewPubkey = newHolderGroupPubkey;

      // Update wallet group to group 1 and freeze
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group1Idx, true)
        .accountsStrict({
          securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
          transferRestrictionGroupNew: group1Pubkey,
          transferRestrictionGroupCurrent: group0Pubkey,
          transferRestrictionHolder: transferRestrictionHolderPubkey,
          holderGroupNew: holderGroupNewPubkey,
          holderGroupCurrent: existingHolderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: existingUserWallet.publicKey,
          userAssociatedTokenAccount: existingUserTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          accessControlProgram: testEnvironment.accessControlProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Verify wallet is frozen
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.isTrue(tokenAccountAfter.isFrozen);

      // Verify security associated account group was updated
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      assert.equal(securityAssociatedAccountData.group.toNumber(), 1);

      // Verify holder group counts were updated
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          existingHolderGroupPubkey
        );
      const holderGroupNewDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupNewPubkey
        );
      assert.equal(
        holderGroupDataBefore.currentWalletsCount.toNumber() - 1,
        holderGroupDataAfter.currentWalletsCount.toNumber()
      );
      assert.equal(
        newHolderGroupDataBefore.currentWalletsCount.toNumber() + 1,
        holderGroupNewDataAfter.currentWalletsCount.toNumber()
      );

      // Verify group counts were updated
      const group0DataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);
      const group1DataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(group1Pubkey);

      // If holder left group 0 and it was the last wallet, count should decrease
      if (holderGroupDataAfter.currentWalletsCount.toNumber() === 0) {
        assert.equal(
          group0DataBefore.currentHoldersCount.toNumber() - 1,
          group0DataAfter.currentHoldersCount.toNumber()
        );
      }

      // If holder joined group 1 and it was the first wallet, count should increase
      if (holderGroupNewDataAfter.currentWalletsCount.toNumber() === 1) {
        assert.equal(
          group1DataBefore.currentHoldersCount.toNumber() + 1,
          group1DataAfter.currentHoldersCount.toNumber()
        );
      }
    });

    it("fails to set address permission by contract admin", async () => {
      const signer = testEnvironment.contractAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setAddressPermission(group0Idx, true)
          .accountsStrict({
            securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
            transferRestrictionGroupNew: group0Pubkey,
            transferRestrictionHolder: existingHolderPubkey,
            holderGroupNew: existingHolderGroupPubkey,
            securityToken: testEnvironment.mintKeypair.publicKey,
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            userWallet: existingUserWallet.publicKey,
            userAssociatedTokenAccount: existingUserTokenAccount,
            authorityWalletRole: authorityWalletRolePubkey,
            accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            accessControlProgram: testEnvironment.accessControlProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
            transferRestrictionGroupCurrent: null,
            holderGroupCurrent: null,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch (err: any) {
        const error = err.error || err;
        assert.equal(error.errorCode.code, "Unauthorized");
        assert.equal(error.errorMessage, "Unauthorized");
      }
    });
  });
});

