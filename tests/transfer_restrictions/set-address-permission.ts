import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { solToLamports, topUpWallet } from "../utils";

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
      const authority = testEnvironment.transferAdmin;
      const payer =  Keypair.generate();
      await topUpWallet(
        testEnvironment.connection,
        payer.publicKey,
        solToLamports(1)
      );

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
        testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);

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
        authority
      );

      // Get BEFORE state for all accounts
      const holderDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
      const holderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const groupDataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupNewPubkey
        );
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );

      // Verify initial state
      assert.equal(
        holderDataBefore.transferRestrictionData.toBase58(),
        testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
      );
      assert.isTrue(holderDataBefore.active);
      assert.equal(holderGroupDataBefore.group.toNumber(), 0);
      assert.equal(
        holderGroupDataBefore.holder.toBase58(),
        holderPubkey.toBase58()
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
          payer: payer.publicKey,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          transferRestrictionGroupCurrent: null,
          holderGroupCurrent: null,
        })
        .signers([payer, authority])
        .rpc({ commitment: testEnvironment.commitment });

      // Get AFTER state for all accounts
      const holderDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const groupDataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupNewPubkey
        );
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          securityAssociatedAccountPubkey
        );
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );

      // Verify holder account updates
      assert.equal(holderDataAfter.id.toString(), expectedHolderId.toString());
      assert.equal(
        holderDataAfter.transferRestrictionData.toBase58(),
        testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
      );
      assert.isTrue(holderDataAfter.active);
      assert.equal(
        holderDataAfter.currentWalletsCount.toNumber(),
        holderDataBefore.currentWalletsCount.toNumber() + 1
      );

      // Verify holder_group account updates
      assert.equal(holderGroupDataAfter.group.toNumber(), 0);
      assert.equal(
        holderGroupDataAfter.holder.toBase58(),
        holderPubkey.toBase58()
      );
      assert.equal(
        holderGroupDataAfter.currentWalletsCount.toNumber(),
        holderGroupDataBefore.currentWalletsCount.toNumber() + 1
      );

      // Verify group account updates (if first wallet in holder_group)
      if (holderGroupDataAfter.currentWalletsCount.toNumber() === 1) {
        assert.equal(
          groupDataAfter.currentHoldersCount.toNumber(),
          groupDataBefore.currentHoldersCount.toNumber() + 1
        );
      } else {
        assert.equal(
          groupDataAfter.currentHoldersCount.toNumber(),
          groupDataBefore.currentHoldersCount.toNumber()
        );
      }

      // Verify security associated account was created and initialized correctly
      assert.equal(securityAssociatedAccountData.group.toNumber(), 0);
      assert.equal(
        securityAssociatedAccountData.holder.toBase58(),
        holderPubkey.toBase58()
      );

      // Verify wallet freeze status
      assert.isTrue(tokenAccountAfter.isFrozen);

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

      // Get BEFORE state for all accounts
      const holderDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
      const holderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const groupDataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupNewPubkey
        );
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );

      // Verify initial state
      assert.isTrue(holderDataBefore.active);
      assert.equal(holderGroupDataBefore.group.toNumber(), 0);
      assert.equal(
        holderGroupDataBefore.holder.toBase58(),
        holderPubkey.toBase58()
      );
      assert.isFalse(tokenAccountBefore.isFrozen);

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
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
          transferRestrictionGroupCurrent: null,
          holderGroupCurrent: null,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Get AFTER state for all accounts
      const holderDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const groupDataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupNewPubkey
        );
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          securityAssociatedAccountPubkey
        );
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        userTokenAccount
      );

      // Verify holder account updates
      assert.equal(
        holderDataAfter.currentWalletsCount.toNumber(),
        holderDataBefore.currentWalletsCount.toNumber() + 1
      );
      assert.isTrue(holderDataAfter.active);

      // Verify holder_group account updates
      assert.equal(
        holderGroupDataAfter.currentWalletsCount.toNumber(),
        holderGroupDataBefore.currentWalletsCount.toNumber() + 1
      );
      assert.equal(holderGroupDataAfter.group.toNumber(), 0);
      assert.equal(
        holderGroupDataAfter.holder.toBase58(),
        holderPubkey.toBase58()
      );

      // Verify group account updates (if first wallet in holder_group)
      if (holderGroupDataAfter.currentWalletsCount.toNumber() === 1) {
        assert.equal(
          groupDataAfter.currentHoldersCount.toNumber(),
          groupDataBefore.currentHoldersCount.toNumber() + 1
        );
      } else {
        assert.equal(
          groupDataAfter.currentHoldersCount.toNumber(),
          groupDataBefore.currentHoldersCount.toNumber()
        );
      }

      // Verify security associated account was created and initialized correctly
      assert.equal(securityAssociatedAccountData.group.toNumber(), 0);
      assert.equal(
        securityAssociatedAccountData.holder.toBase58(),
        holderPubkey.toBase58()
      );

      // Verify wallet freeze status
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
        group0Idx,
        holderId,
        existingHolderGroupPubkey,
        existingUserWallet.publicKey,
        existingUserTokenAccount,
        transferAdminRole,
        testEnvironment.transferAdmin
      );
    });

    it("Transfer admin can set address permission (freeze) for existing wallet in same group", async () => {
      const signer = testEnvironment.transferAdmin;

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Derive current accounts based on security_associated_account state
      const securityAssociatedAccountDataBefore =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const currentGroupId = securityAssociatedAccountDataBefore.group;
      const [transferRestrictionGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(currentGroupId);
      const [holderGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          securityAssociatedAccountDataBefore.holder as PublicKey,
          currentGroupId
        );

      // Get BEFORE state for all accounts
      const holderDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupCurrentPubkey
        );
      const groupDataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupCurrentPubkey
        );
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );

      // Verify initial state
      assert.equal(
        securityAssociatedAccountDataBefore.group.toNumber(),
        0
      );
      assert.equal(
        securityAssociatedAccountDataBefore.holder.toBase58(),
        existingHolderPubkey.toBase58()
      );
      assert.isFalse(tokenAccountBefore.isFrozen);

      // Set address permission (freeze) for existing wallet in same group
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, true)
        .accountsStrict({
          securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
          transferRestrictionGroupNew: group0Pubkey,
          transferRestrictionGroupCurrent: transferRestrictionGroupCurrentPubkey,
          transferRestrictionHolder: existingHolderPubkey,
          holderGroupNew: existingHolderGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
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
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Get AFTER state for all accounts
      const holderDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupCurrentPubkey
        );
      const groupDataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupCurrentPubkey
        );
      const securityAssociatedAccountDataAfter =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );

      // Verify holder account - should be unchanged (no group change)
      assert.equal(
        holderDataAfter.currentWalletsCount.toNumber(),
        holderDataBefore.currentWalletsCount.toNumber()
      );
      assert.equal(holderDataAfter.id.toString(), holderDataBefore.id.toString());
      assert.equal(holderDataAfter.active, holderDataBefore.active);

      // Verify holder_group account - should be unchanged (no group change)
      assert.equal(
        holderGroupDataAfter.currentWalletsCount.toNumber(),
        holderGroupDataBefore.currentWalletsCount.toNumber()
      );
      assert.equal(
        holderGroupDataAfter.group.toNumber(),
        holderGroupDataBefore.group.toNumber()
      );
      assert.equal(
        holderGroupDataAfter.holder.toBase58(),
        holderGroupDataBefore.holder.toBase58()
      );

      // Verify group account - should be unchanged (no group change)
      assert.equal(
        groupDataAfter.currentHoldersCount.toNumber(),
        groupDataBefore.currentHoldersCount.toNumber()
      );

      // Verify security associated account - should be unchanged (no group change)
      assert.equal(
        securityAssociatedAccountDataAfter.group.toNumber(),
        securityAssociatedAccountDataBefore.group.toNumber()
      );
      assert.equal(
        securityAssociatedAccountDataAfter.holder.toBase58(),
        securityAssociatedAccountDataBefore.holder.toBase58()
      );

      // Verify wallet freeze status changed
      assert.isTrue(tokenAccountAfter.isFrozen);
    });

    it("Wallets admin can set address permission (thaw) for existing wallet in same group", async () => {
      const signer = testEnvironment.walletsAdmin;

      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Derive current accounts based on security_associated_account state
      const securityAssociatedAccountDataBefore =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const currentGroupId = securityAssociatedAccountDataBefore.group;
      const [transferRestrictionGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(currentGroupId);
      const [holderGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          securityAssociatedAccountDataBefore.holder as PublicKey,
          currentGroupId
        );

      // Get BEFORE state for all accounts
      const holderDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupCurrentPubkey
        );
      const groupDataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupCurrentPubkey
        );
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.equal(tokenAccountBefore.isFrozen, true);

      // Set address permission (thaw) for existing wallet in same group
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, false)
        .accountsStrict({
          securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
          transferRestrictionGroupNew: group0Pubkey,
          transferRestrictionGroupCurrent: transferRestrictionGroupCurrentPubkey,
          transferRestrictionHolder: existingHolderPubkey,
          holderGroupNew: existingHolderGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
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
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Get AFTER state for all accounts
      const holderDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupCurrentPubkey
        );
      const groupDataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(
          transferRestrictionGroupCurrentPubkey
        );
      const securityAssociatedAccountDataAfter =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );

      // Verify holder account - should be unchanged (no group change)
      assert.equal(
        holderDataAfter.currentWalletsCount.toNumber(),
        holderDataBefore.currentWalletsCount.toNumber()
      );

      // Verify holder_group account - should be unchanged (no group change)
      assert.equal(
        holderGroupDataAfter.currentWalletsCount.toNumber(),
        holderGroupDataBefore.currentWalletsCount.toNumber()
      );

      // Verify group account - should be unchanged (no group change)
      assert.equal(
        groupDataAfter.currentHoldersCount.toNumber(),
        groupDataBefore.currentHoldersCount.toNumber()
      );

      // Verify security associated account - should be unchanged (no group change)
      assert.equal(
        securityAssociatedAccountDataAfter.group.toNumber(),
        securityAssociatedAccountDataBefore.group.toNumber()
      );
      assert.equal(
        securityAssociatedAccountDataAfter.holder.toBase58(),
        securityAssociatedAccountDataBefore.holder.toBase58()
      );

      // Verify wallet freeze status changed
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

      // Get BEFORE state for all accounts
      const securityAssociatedAccountDataBefore =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const holderDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
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
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.isFalse(tokenAccountBefore.isFrozen);

      // Verify initial state
      assert.equal(securityAssociatedAccountDataBefore.group.toNumber(), 0);
      assert.equal(
        securityAssociatedAccountDataBefore.holder.toBase58(),
        existingHolderPubkey.toBase58()
      );

      // Derive transfer_restriction_holder PDA using the existing holder's ID
      // This ensures the PDA constraint matches
      const [transferRestrictionHolderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(holderDataBefore.id);

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
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Get AFTER state for all accounts
      const holderDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          existingHolderGroupPubkey
        );
      const holderGroupNewDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupNewPubkey
        );
      const group0DataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);
      const group1DataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(group1Pubkey);
      const securityAssociatedAccountDataAfter =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );

      // Verify holder account - should be unchanged (holder doesn't change when wallet moves groups)
      assert.equal(
        holderDataAfter.currentWalletsCount.toNumber(),
        holderDataBefore.currentWalletsCount.toNumber()
      );
      assert.equal(holderDataAfter.id.toString(), holderDataBefore.id.toString());
      assert.equal(holderDataAfter.active, holderDataBefore.active);
      assert.equal(
        holderDataAfter.transferRestrictionData.toBase58(),
        holderDataBefore.transferRestrictionData.toBase58()
      );

      // Verify holder_group_current account updates
      assert.equal(
        holderGroupDataAfter.currentWalletsCount.toNumber(),
        holderGroupDataBefore.currentWalletsCount.toNumber() - 1
      );
      assert.equal(
        holderGroupDataAfter.group.toNumber(),
        holderGroupDataBefore.group.toNumber()
      );
      assert.equal(
        holderGroupDataAfter.holder.toBase58(),
        holderGroupDataBefore.holder.toBase58()
      );

      // Verify holder_group_new account updates
      assert.equal(
        holderGroupNewDataAfter.currentWalletsCount.toNumber(),
        newHolderGroupDataBefore.currentWalletsCount.toNumber() + 1
      );
      assert.equal(holderGroupNewDataAfter.group.toNumber(), 1);
      assert.equal(
        holderGroupNewDataAfter.holder.toBase58(),
        existingHolderPubkey.toBase58()
      );

      // Verify group_current account updates (if last wallet left)
      if (holderGroupDataAfter.currentWalletsCount.toNumber() === 0) {
        assert.equal(
          group0DataAfter.currentHoldersCount.toNumber(),
          group0DataBefore.currentHoldersCount.toNumber() - 1
        );
      } else {
        assert.equal(
          group0DataAfter.currentHoldersCount.toNumber(),
          group0DataBefore.currentHoldersCount.toNumber()
        );
      }

      // Verify group_new account updates (if first wallet joined)
      if (holderGroupNewDataAfter.currentWalletsCount.toNumber() === 1) {
        assert.equal(
          group1DataAfter.currentHoldersCount.toNumber(),
          group1DataBefore.currentHoldersCount.toNumber() + 1
        );
      } else {
        assert.equal(
          group1DataAfter.currentHoldersCount.toNumber(),
          group1DataBefore.currentHoldersCount.toNumber()
        );
      }

      // Verify security associated account updates
      assert.equal(securityAssociatedAccountDataAfter.group.toNumber(), 1);
      assert.equal(
        securityAssociatedAccountDataAfter.holder.toBase58(),
        securityAssociatedAccountDataBefore.holder.toBase58()
      );

      // Verify wallet freeze status changed
      assert.isTrue(tokenAccountAfter.isFrozen);
    });

    it("fails to update existing wallet without current accounts", async () => {
      const signer = testEnvironment.transferAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Create holder group for group 1 if needed
      const [group1HolderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          existingHolderPubkey,
          group1Idx
        );

      const holderGroup1Data = await testEnvironment.transferRestrictionsHelper
        .holderGroupData(group1HolderGroupPubkey)
        .catch(() => null);

      if (!holderGroup1Data) {
        await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
          group1HolderGroupPubkey,
          existingHolderPubkey,
          group1Pubkey,
          transferAdminRole,
          testEnvironment.transferAdmin
        );
      }

      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setAddressPermission(group1Idx, true)
          .accountsStrict({
            securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
            transferRestrictionGroupNew: group1Pubkey,
            transferRestrictionHolder: existingHolderPubkey,
            holderGroupNew: group1HolderGroupPubkey,
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
            authority: signer.publicKey,
            systemProgram: SystemProgram.programId,
            transferRestrictionGroupCurrent: null,
            holderGroupCurrent: null,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "CurrentGroupRequiredForExistingWallet");
        assert.equal(
          error.errorMessage,
          "Current group and holder group must be provided for existing wallet"
        );
      }
    });

    it("fails to set same group for existing wallet when not changing freeze status", async () => {
      const signer = testEnvironment.transferAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Derive current accounts based on security_associated_account state
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const currentGroupId = securityAssociatedAccountData.group;
      const [transferRestrictionGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(currentGroupId);
      const [holderGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          securityAssociatedAccountData.holder as PublicKey,
          currentGroupId
        );
      const existingTokenAccountData = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      const existingFreezeStatus = existingTokenAccountData.isFrozen;
      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setAddressPermission(currentGroupId, existingFreezeStatus)
          .accountsStrict({
            securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
            transferRestrictionGroupNew: transferRestrictionGroupCurrentPubkey,
            transferRestrictionGroupCurrent: transferRestrictionGroupCurrentPubkey,
            transferRestrictionHolder: existingHolderPubkey,
            holderGroupNew: holderGroupCurrentPubkey,
            holderGroupCurrent: holderGroupCurrentPubkey,
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
            authority: signer.publicKey,
            systemProgram: SystemProgram.programId,
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

    it("Transfer admin can update wallet group from group 1 to group 0 with current accounts", async () => {
      const signer = testEnvironment.transferAdmin;

      // Ensure wallet is in group 1 first (from previous test)
      // If not, move it to group 1
      const securityAssociatedAccountDataSetup =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      
      // If wallet is not in group 1, move it there first
      if (securityAssociatedAccountDataSetup.group.toNumber() !== 1) {
        // Create holder group for group 1 if needed
        const [group1HolderGroupPubkey] =
          testEnvironment.transferRestrictionsHelper.holderGroupPDA(
            existingHolderPubkey,
            group1Idx
          );

        const holderGroup1Data = await testEnvironment.transferRestrictionsHelper
          .holderGroupData(group1HolderGroupPubkey)
          .catch(() => null);

        if (!holderGroup1Data) {
          await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
            group1HolderGroupPubkey,
            existingHolderPubkey,
            group1Pubkey,
            transferAdminRole,
            testEnvironment.transferAdmin
          );
        }

        // Move wallet to group 1
        const currentGroupId = securityAssociatedAccountDataSetup.group;
        const [currentTransferGroupPubkey] =
          testEnvironment.transferRestrictionsHelper.groupPDA(currentGroupId);
        const [currentHolderGroupPubkey] =
          testEnvironment.transferRestrictionsHelper.holderGroupPDA(
            securityAssociatedAccountDataSetup.holder as PublicKey,
            currentGroupId
          );

        const [authorityWalletRolePubkeyTemp] =
          testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

        await testEnvironment.transferRestrictionsHelper.program.methods
          .setAddressPermission(group1Idx, false)
          .accountsStrict({
            securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
            transferRestrictionGroupNew: group1Pubkey,
            transferRestrictionGroupCurrent: currentTransferGroupPubkey,
            transferRestrictionHolder: existingHolderPubkey,
            holderGroupNew: group1HolderGroupPubkey,
            holderGroupCurrent: currentHolderGroupPubkey,
            securityToken: testEnvironment.mintKeypair.publicKey,
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            userWallet: existingUserWallet.publicKey,
            userAssociatedTokenAccount: existingUserTokenAccount,
            authorityWalletRole: authorityWalletRolePubkeyTemp,
            accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            accessControlProgram: testEnvironment.accessControlProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            payer: signer.publicKey,
            authority: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
      }

      // Now test moving from group 1 to group 0
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Derive current accounts (should be group 1 now)
      const securityAssociatedAccountDataBefore =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const currentGroupId = securityAssociatedAccountDataBefore.group;
      const [transferRestrictionGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(currentGroupId);
      const [holderGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          securityAssociatedAccountDataBefore.holder as PublicKey,
          currentGroupId
        );

      // Get BEFORE state for all accounts
      const holderDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupCurrentPubkey
        );
      const holderGroup0DataBefore =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          existingHolderGroupPubkey
        );
      const group1DataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(group1Pubkey);
      const group0DataBefore =
        await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);
      const tokenAccountBefore = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );
      assert.isTrue(tokenAccountBefore.isFrozen);

      // Verify initial state
      assert.equal(securityAssociatedAccountDataBefore.group.toNumber(), 1);
      assert.equal(
        securityAssociatedAccountDataBefore.holder.toBase58(),
        existingHolderPubkey.toBase58()
      );

      // Update wallet group from group 1 to group 0 (thaw)
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setAddressPermission(group0Idx, false)
        .accountsStrict({
          securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
          transferRestrictionGroupNew: group0Pubkey,
          transferRestrictionGroupCurrent: transferRestrictionGroupCurrentPubkey,
          transferRestrictionHolder: existingHolderPubkey,
          holderGroupNew: existingHolderGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
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
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      // Get AFTER state for all accounts
      const holderDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderData(
          existingHolderPubkey
        );
      const holderGroupDataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupCurrentPubkey
        );
      const holderGroup0DataAfter =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          existingHolderGroupPubkey
        );
      const group1DataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(group1Pubkey);
      const group0DataAfter =
        await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);
      const securityAssociatedAccountDataAfter =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const tokenAccountAfter = await testEnvironment.mintHelper.getAccount(
        existingUserTokenAccount
      );

      // Verify holder account - should be unchanged (holder doesn't change when wallet moves groups)
      assert.equal(
        holderDataAfter.currentWalletsCount.toNumber(),
        holderDataBefore.currentWalletsCount.toNumber()
      );
      assert.equal(holderDataAfter.id.toString(), holderDataBefore.id.toString());
      assert.equal(holderDataAfter.active, holderDataBefore.active);
      assert.equal(
        holderDataAfter.transferRestrictionData.toBase58(),
        holderDataBefore.transferRestrictionData.toBase58()
      );

      // Verify holder_group_current (group 1) account updates
      assert.equal(
        holderGroupDataAfter.currentWalletsCount.toNumber(),
        holderGroupDataBefore.currentWalletsCount.toNumber() - 1
      );
      assert.equal(
        holderGroupDataAfter.group.toNumber(),
        holderGroupDataBefore.group.toNumber()
      );
      assert.equal(
        holderGroupDataAfter.holder.toBase58(),
        holderGroupDataBefore.holder.toBase58()
      );

      // Verify holder_group_new (group 0) account updates
      assert.equal(
        holderGroup0DataAfter.currentWalletsCount.toNumber(),
        holderGroup0DataBefore.currentWalletsCount.toNumber() + 1
      );
      assert.equal(holderGroup0DataAfter.group.toNumber(), 0);
      assert.equal(
        holderGroup0DataAfter.holder.toBase58(),
        existingHolderPubkey.toBase58()
      );

      // Verify group_current (group 1) account updates (if last wallet left)
      if (holderGroupDataAfter.currentWalletsCount.toNumber() === 0) {
        assert.equal(
          group1DataAfter.currentHoldersCount.toNumber(),
          group1DataBefore.currentHoldersCount.toNumber() - 1
        );
      } else {
        assert.equal(
          group1DataAfter.currentHoldersCount.toNumber(),
          group1DataBefore.currentHoldersCount.toNumber()
        );
      }

      // Verify group_new (group 0) account updates (if first wallet joined)
      if (holderGroup0DataAfter.currentWalletsCount.toNumber() === 1) {
        assert.equal(
          group0DataAfter.currentHoldersCount.toNumber(),
          group0DataBefore.currentHoldersCount.toNumber() + 1
        );
      } else {
        assert.equal(
          group0DataAfter.currentHoldersCount.toNumber(),
          group0DataBefore.currentHoldersCount.toNumber()
        );
      }

      // Verify security associated account updates
      assert.equal(securityAssociatedAccountDataAfter.group.toNumber(), 0);
      assert.equal(
        securityAssociatedAccountDataAfter.holder.toBase58(),
        securityAssociatedAccountDataBefore.holder.toBase58()
      );

      // Verify wallet freeze status changed
      assert.isFalse(tokenAccountAfter.isFrozen);
    });

    it("fails to set address permission by contract admin", async () => {
      const signer = testEnvironment.contractAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

      // Derive current accounts - wallet should be in group 0 after previous test
      const securityAssociatedAccountData =
        await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
          existingSecurityAssociatedAccountPubkey
        );
      const currentGroupId = securityAssociatedAccountData.group;
      const [transferRestrictionGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(currentGroupId);
      const [holderGroupCurrentPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          securityAssociatedAccountData.holder as PublicKey,
          currentGroupId
        );

      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setAddressPermission(group0Idx, true)
          .accountsStrict({
            securityAssociatedAccount: existingSecurityAssociatedAccountPubkey,
            transferRestrictionGroupNew: group0Pubkey,
            transferRestrictionGroupCurrent: transferRestrictionGroupCurrentPubkey,
            transferRestrictionHolder: existingHolderPubkey,
            holderGroupNew: existingHolderGroupPubkey,
            holderGroupCurrent: holderGroupCurrentPubkey,
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
  });
});

