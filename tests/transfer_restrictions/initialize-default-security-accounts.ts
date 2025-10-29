import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Initialize Default Security Accounts", () => {
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
  const group1Idx = new anchor.BN(1);
  let group1Pubkey: PublicKey;
  const group0Idx = new anchor.BN(0);
  let group0Pubkey: PublicKey;

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
      testEnvironment.transferRestrictionsHelper.groupPDA(new anchor.BN(0));
    [group1Pubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(group1Idx);
  });

  it("Reserve admin can initialize default security accounts", async () => {
    const userWallet = Keypair.generate();
    const signer = testEnvironment.reserveAdmin;

    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.reserveAdmin
      );

    // Get transfer restriction data to know the holder ID
    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const expectedHolderId = transferRestrictionData.currentHoldersCount;

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
      testEnvironment.accessControlHelper.walletRolePDA(
        signer.publicKey
      );

    // Initialize default security accounts
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeDefaultSecurityAccounts()
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: group0Pubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: userWallet.publicKey,
        associatedTokenAccount: userTokenAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    // Verify holder was created
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(holderData.id.toString(), expectedHolderId.toString());
    assert.equal(
      holderData.transferRestrictionData.toBase58(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
    );
    assert.isTrue(holderData.active);
    assert.equal(holderData.currentWalletsCount.toNumber(), 1);
    assert.equal(holderData.currentHolderGroupCount.toNumber(), 1);

    // Verify holder_group was created
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

    // Verify counts were updated
    const updatedTransferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      updatedTransferRestrictionData.currentHoldersCount.toString(),
      expectedHolderId.addn(1).toString()
    );
  });

  it("Transfer admin can initialize default security accounts", async () => {
    const userWallet = Keypair.generate();
    const signer = testEnvironment.transferAdmin;

    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.transferAdmin
      );

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const expectedHolderId = transferRestrictionData.currentHoldersCount;

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
      testEnvironment.accessControlHelper.walletRolePDA(
        signer.publicKey
      );

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeDefaultSecurityAccounts()
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: group0Pubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: userWallet.publicKey,
        associatedTokenAccount: userTokenAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(holderData.id.toString(), expectedHolderId.toString());
  });

  it("Wallets admin can initialize default security accounts", async () => {
    const userWallet = Keypair.generate();
    const signer = testEnvironment.walletsAdmin;

    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.walletsAdmin
      );

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const expectedHolderId = transferRestrictionData.currentHoldersCount;

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
      testEnvironment.accessControlHelper.walletRolePDA(
        signer.publicKey
      );

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeDefaultSecurityAccounts()
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: group0Pubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: userWallet.publicKey,
        associatedTokenAccount: userTokenAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(holderData.id.toString(), expectedHolderId.toString());
  });

  it("All values are updated properly after successful initialization", async () => {
    const userWallet = Keypair.generate();
    const signer = testEnvironment.reserveAdmin;

    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.reserveAdmin
      );

    // Get initial state
    const transferRestrictionDataBefore =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const expectedHolderId = transferRestrictionDataBefore.currentHoldersCount;
    const holderIdsBefore = transferRestrictionDataBefore.holderIds;
    const groupDataBefore =
      await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);

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
      testEnvironment.accessControlHelper.walletRolePDA(
        signer.publicKey
      );

    // Initialize default security accounts
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeDefaultSecurityAccounts()
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: group0Pubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: userWallet.publicKey,
        associatedTokenAccount: userTokenAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    // Verify holder was created correctly
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(holderData.id.toString(), expectedHolderId.toString());
    assert.equal(
      holderData.transferRestrictionData.toBase58(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
    );
    assert.isTrue(holderData.active);
    assert.equal(holderData.currentWalletsCount.toNumber(), 1);
    assert.equal(holderData.currentHolderGroupCount.toNumber(), 1);

    // Verify holder_group was created correctly
    const holderGroupData =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    assert.equal(holderGroupData.group.toNumber(), 0);
    assert.equal(holderGroupData.holder.toBase58(), holderPubkey.toBase58());
    assert.equal(holderGroupData.currentWalletsCount.toNumber(), 1);

    // Verify security associated account was created correctly
    const securityAssociatedAccountData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountPubkey
      );
    assert.equal(securityAssociatedAccountData.group.toNumber(), 0);
    assert.equal(
      securityAssociatedAccountData.holder.toBase58(),
      holderPubkey.toBase58()
    );

    // Verify transfer restriction data was updated correctly
    const transferRestrictionDataAfter =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      transferRestrictionDataAfter.currentHoldersCount.toString(),
      expectedHolderId.addn(1).toString(),
      "currentHoldersCount should be incremented by 1"
    );
    assert.equal(
      transferRestrictionDataAfter.holderIds.toString(),
      holderIdsBefore.addn(1).toString(),
      "holderIds should be incremented by 1"
    );

    // Verify group data was updated correctly
    const groupDataAfter =
      await testEnvironment.transferRestrictionsHelper.groupData(group0Pubkey);
    assert.equal(
      groupDataAfter.currentHoldersCount.toString(),
      groupDataBefore.currentHoldersCount.addn(1).toString(),
      "group currentHoldersCount should be incremented by 1 (first wallet in holder_group)"
    );
  });

  it("Cannot initialize default security accounts with group 1", async () => {
    const userWallet = Keypair.generate();
    const signer = testEnvironment.reserveAdmin;

    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.reserveAdmin
      );

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const expectedHolderId = transferRestrictionData.currentHoldersCount;

    // Derive PDAs - but try to use group 1 instead of group 0
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(expectedHolderId);

    // Try to derive holderGroupPubkey with group 1
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        group1Idx
      );

    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccount
      );

    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        signer.publicKey
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeDefaultSecurityAccounts()
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: group1Pubkey, // Using group 1 instead of group 0
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: userWallet.publicKey,
          associatedTokenAccount: userTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
      assert.equal(error.origin, "holder_group");
    }
  });

  it("Cannot initialize default security accounts with previous holder_ids", async () => {
    // Verify holder_ids has advanced
    const transferRestrictionDataAfterManual =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();

    // Test that initialize_default_security_accounts works correctly
    // even when holder_ids > currentHoldersCount (due to manual holder creation)
    // Note: initialize_default_security_accounts uses holder_ids for PDA derivation,
    // but sets holder.id = currentHoldersCount
    const userWallet = Keypair.generate();
    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.reserveAdmin
      );

    const holderIdsForPDA = transferRestrictionDataAfterManual.holderIds.subn(1);

    // The PDA is derived using holder_ids (not holderId), so we need to use holder_ids
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdsForPDA);

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
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      );

    try {
      // This should work - it uses holder_ids for PDA but sets holder.id = currentHoldersCount
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeDefaultSecurityAccounts()
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: group0Pubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: userWallet.publicKey,
          associatedTokenAccount: userTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: testEnvironment.reserveAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([testEnvironment.reserveAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({error}) {
      // Validate errorCode and origin from Anchor error object
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
      assert.equal(error.origin, "transfer_restriction_holder");
    }
  });

  it("Unauthorized user cannot initialize default security accounts", async () => {
    const unauthorizedWallet = Keypair.generate();
    const userWallet = Keypair.generate();

    // Fund the unauthorized wallet
    const airdropTx = await testEnvironment.connection.requestAirdrop(
      unauthorizedWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await testEnvironment.connection.confirmTransaction(airdropTx);

    const userTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        userWallet.publicKey,
        testEnvironment.reserveAdmin
      );

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const expectedHolderId = transferRestrictionData.currentHoldersCount;

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

    // Try to create wallet role for unauthorized user (should fail or have no roles)
    try {
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        );

      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeDefaultSecurityAccounts()
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: group0Pubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: userWallet.publicKey,
          associatedTokenAccount: userTokenAccount,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: testEnvironment.contractAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });

      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });
});


