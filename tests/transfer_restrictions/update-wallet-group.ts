import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Update wallet group", () => {
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
  });

  it("fails to update wallet group by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const userWalletPubkey = investorWallet1.publicKey;
    const userTokenAccountPubkey = investorWallet1AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const [holderGroupNewPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        new anchor.BN(2)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupNewPubkey,
      holderPubkey,
      secondGroupPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .updateWalletGroup()
        .accountsStrict({
          securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupCurrent: firstGroupPubkey,
          transferRestrictionGroupNew: secondGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
          holderGroupNew: holderGroupNewPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          userWallet: userWalletPubkey,
          userAssociatedTokenAccount: userTokenAccountPubkey,
          payer: signer.publicKey,
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

  it("fails to update wallet group by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const userWalletPubkey = investorWallet1.publicKey;
    const userTokenAccountPubkey = investorWallet1AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const [holderGroupNewPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        new anchor.BN(2)
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .updateWalletGroup()
        .accountsStrict({
          securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupCurrent: firstGroupPubkey,
          transferRestrictionGroupNew: secondGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
          holderGroupNew: holderGroupNewPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          userWallet: userWalletPubkey,
          userAssociatedTokenAccount: userTokenAccountPubkey,
          payer: signer.publicKey,
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

  it("fails to update wallet to the same group", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const userWalletPubkey = investorWallet1.publicKey;
    const userTokenAccountPubkey = investorWallet1AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .updateWalletGroup()
        .accountsStrict({
          securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupCurrent: firstGroupPubkey,
          transferRestrictionGroupNew: firstGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
          holderGroupNew: holderGroupCurrentPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          userWallet: userWalletPubkey,
          userAssociatedTokenAccount: userTokenAccountPubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "NewGroupIsTheSameAsTheCurrentGroup");
      assert.equal(
        error.errorMessage,
        "New group is the same as the current group"
      );
    }
  });

  it("updates wallet group by wallets admin when last wallet in current group", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const userWalletPubkey = investorWallet1.publicKey;
    const userTokenAccountPubkey = investorWallet1AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const [holderGroupNewPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        new anchor.BN(2)
      );

    const { currentWalletsCount: holderGroupCurrentWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .updateWalletGroup()
      .accountsStrict({
        securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        transferRestrictionGroupCurrent: firstGroupPubkey,
        transferRestrictionGroupNew: secondGroupPubkey,
        holderGroupCurrent: holderGroupCurrentPubkey,
        holderGroupNew: holderGroupNewPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        userWallet: userWalletPubkey,
        userAssociatedTokenAccount: userTokenAccountPubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const { currentWalletsCount: holderGroupCurrentWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    const { group: newGroupIdx } =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSecAssociatedAccountPubkey
      );
    assert.equal(newGroupIdx.toNumber(), 2);
    assert.equal(
      holderGroupCurrentWalletsCount.toNumber(),
      holderGroupCurrentWalletsCountAfter.toNumber() + 1
    );
    assert.equal(
      holderGroupNewWalletsCount.toNumber(),
      holderGroupNewWalletsCountAfter.toNumber() - 1
    );
    assert.equal(
      firstGroupHoldersCount.toNumber() - 1,
      firstGroupHoldersCountAfter.toNumber()
    );
    assert.equal(
      secondGroupHoldersCount.toNumber() + 1,
      secondGroupHoldersCountAfter.toNumber()
    );
  });

  const investorWallet3 = Keypair.generate();
  let investorWallet3AssociatedAccount: PublicKey;
  /// This test case is to update wallet group when there are more than 1 wallets in the current group
  /// and no wallet in the new group so wallet is moved to new group: decrement in current holder group and increase in new holder group
  /// and increment holders in new group but does not change holders count in current group
  it("updates wallet group by transfer admin when more than 1 wallet in current group", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    const userWalletPubkey = investorWallet2.publicKey;
    const userTokenAccountPubkey = investorWallet2AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(2)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const [holderGroupNewPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        new anchor.BN(2)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupNewPubkey,
      holderPubkey,
      secondGroupPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    investorWallet3AssociatedAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investorWallet3.publicKey,
        testEnvironment.transferAdmin
      );
    // Add investorWallet3 to the current group so that there are more than 1 wallets in the group
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      firstGroupPubkey,
      holderPubkey,
      holderGroupCurrentPubkey,
      investorWallet3.publicKey,
      investorWallet3AssociatedAccount,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    const { currentWalletsCount: holderGroupCurrentWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .updateWalletGroup()
      .accountsStrict({
        securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        transferRestrictionGroupCurrent: firstGroupPubkey,
        transferRestrictionGroupNew: secondGroupPubkey,
        holderGroupCurrent: holderGroupCurrentPubkey,
        holderGroupNew: holderGroupNewPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        userWallet: userWalletPubkey,
        userAssociatedTokenAccount: userTokenAccountPubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const { currentWalletsCount: holderGroupCurrentWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    const { group: newGroupIdx } =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSecAssociatedAccountPubkey
      );
    assert.equal(newGroupIdx.toNumber(), 2);
    assert.equal(
      holderGroupCurrentWalletsCount.toNumber(),
      holderGroupCurrentWalletsCountAfter.toNumber() + 1
    );
    assert.equal(
      holderGroupNewWalletsCount.toNumber(),
      holderGroupNewWalletsCountAfter.toNumber() - 1
    );
    assert.equal(
      firstGroupHoldersCount.toNumber(),
      firstGroupHoldersCountAfter.toNumber()
    );
    assert.equal(
      secondGroupHoldersCount.toNumber() + 1,
      secondGroupHoldersCountAfter.toNumber()
    );
  });

  /// This test case is to update wallet group when there are 1 wallet in the current group
  /// and another wallet is present in new group so wallet is moved to new group:
  /// decrement in current holder group and increase in new holder group
  /// and does not change holders in new group but decreases holders count in current group
  it("updates wallet group when more than 1 wallet in current group and it is already in new group", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    const userWalletPubkey = investorWallet3.publicKey;
    const userTokenAccountPubkey = investorWallet3AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(2)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const [holderGroupNewPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        new anchor.BN(2)
      );

    const { currentWalletsCount: holderGroupCurrentWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .updateWalletGroup()
      .accountsStrict({
        securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        transferRestrictionGroupCurrent: firstGroupPubkey,
        transferRestrictionGroupNew: secondGroupPubkey,
        holderGroupCurrent: holderGroupCurrentPubkey,
        holderGroupNew: holderGroupNewPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        userWallet: userWalletPubkey,
        userAssociatedTokenAccount: userTokenAccountPubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const { currentWalletsCount: holderGroupCurrentWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    const { group: newGroupIdx } =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSecAssociatedAccountPubkey
      );
    assert.equal(newGroupIdx.toNumber(), 2);
    assert.equal(
      holderGroupCurrentWalletsCount.toNumber(),
      holderGroupCurrentWalletsCountAfter.toNumber() + 1
    );
    assert.equal(
      holderGroupNewWalletsCount.toNumber(),
      holderGroupNewWalletsCountAfter.toNumber() - 1
    );
    assert.equal(
      firstGroupHoldersCount.toNumber() - 1,
      firstGroupHoldersCountAfter.toNumber()
    );
    assert.equal(
      secondGroupHoldersCount.toNumber(),
      secondGroupHoldersCountAfter.toNumber()
    );
  });

  it("reverts when max holders reached inside the group", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const userWalletPubkey = investorWallet0.publicKey;
    const userTokenAccountPubkey = investorWallet0AssociatedAccount;
    const [userWalletSecAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        userTokenAccountPubkey
      );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );
    const [holderGroupCurrentPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const [holderGroupNewPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        new anchor.BN(2)
      );
    await testEnvironment.transferRestrictionsHelper.setHolderGroupMax(
      new anchor.BN(2),
      secondGroupPubkey,
      authorityWalletRolePubkey,
      testEnvironment.transferAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupNewPubkey,
      holderPubkey,
      secondGroupPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );

    const { currentWalletsCount: holderGroupCurrentWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCount } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCount } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .updateWalletGroup()
        .accountsStrict({
          securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          transferRestrictionGroupCurrent: firstGroupPubkey,
          transferRestrictionGroupNew: secondGroupPubkey,
          holderGroupCurrent: holderGroupCurrentPubkey,
          holderGroupNew: holderGroupNewPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          userWallet: userWalletPubkey,
          userAssociatedTokenAccount: userTokenAccountPubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MaxHoldersReachedInsideTheGroup");
      assert.equal(error.errorMessage, "Max holders reached inside the group");
    }

    const { currentWalletsCount: holderGroupCurrentWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupCurrentPubkey
      );
    const { currentWalletsCount: holderGroupNewWalletsCountAfter } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupNewPubkey
      );
    const { currentHoldersCount: firstGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        firstGroupPubkey
      );
    const { currentHoldersCount: secondGroupHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(
        secondGroupPubkey
      );
    const { group: newGroupIdx } =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSecAssociatedAccountPubkey
      );
    assert.equal(newGroupIdx.toNumber(), 1);
    assert.equal(
      holderGroupCurrentWalletsCount.toNumber(),
      holderGroupCurrentWalletsCountAfter.toNumber()
    );
    assert.equal(
      holderGroupNewWalletsCount.toNumber(),
      holderGroupNewWalletsCountAfter.toNumber()
    );
    assert.equal(
      firstGroupHoldersCount.toNumber(),
      firstGroupHoldersCountAfter.toNumber()
    );
    assert.equal(
      secondGroupHoldersCount.toNumber(),
      secondGroupHoldersCountAfter.toNumber()
    );
  });
});
