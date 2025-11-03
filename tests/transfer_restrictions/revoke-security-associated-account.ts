import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { topUpWallet } from "../utils";

describe("Revoke security associated account", () => {
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
  const groupId = new anchor.BN(1);
  let groupPubkey: anchor.web3.PublicKey;
  const investors = [
    Keypair.generate(),
    Keypair.generate(),
    Keypair.generate(),
  ];
  const investorsTokenAccounts: anchor.web3.PublicKey[] = [];

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    const [transferAdminRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      groupId,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupId);
    let holderIdx = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    let [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    let [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    investorsTokenAccounts.push(
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investors[0].publicKey,
        testEnvironment.transferAdmin
      )
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investors[0].publicKey,
      investorsTokenAccounts[0],
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );

    holderIdx = holderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    investorsTokenAccounts.push(
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investors[1].publicKey,
        testEnvironment.transferAdmin
      )
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investors[1].publicKey,
      investorsTokenAccounts[1],
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );

    // same holder in the same group with new wallet
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    investorsTokenAccounts.push(
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investors[2].publicKey,
        testEnvironment.transferAdmin
      )
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investors[2].publicKey,
      investorsTokenAccounts[2],
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
  });

  it("fails to revoke security associated account by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const holderIdx = 0;
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(holderIdx)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorsTokenAccounts[holderIdx]
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: investors[holderIdx].publicKey,
          associatedTokenAccount: investorsTokenAccounts[holderIdx],
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

  it("fails to revoke security associated account by reserve admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const holderIdx = 0;
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(holderIdx)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorsTokenAccounts[holderIdx]
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: investors[holderIdx].publicKey,
          associatedTokenAccount: investorsTokenAccounts[holderIdx],
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

  describe("when only one holder wallet is linked with group", () => {
    it("revokes security associated account by transfer admin and leaves the group", async () => {
      const signer = testEnvironment.transferAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
      const holderIdx = 0;
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(
          new anchor.BN(holderIdx)
        );
      const [holderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          holderPubkey,
          groupId
        );
      const [securityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          investorsTokenAccounts[0]
        );
      const { currentWalletsCount: holderCurrentWalletsCountBefore } =
        await testEnvironment.transferRestrictionsHelper.holderData(
          holderPubkey
        );
      const { currentWalletsCount: holderGroupCurrentWalletsCountBefore } =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const { currentHoldersCount: groupCurrentHoldersCountBefore } =
        await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
      let accountInfo = await testEnvironment.connection.getAccountInfo(
        securityAssociatedAccountPubkey
      );
      assert.isNotNull(accountInfo);

      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: investors[0].publicKey,
          associatedTokenAccount: investorsTokenAccounts[0],
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      accountInfo = await testEnvironment.connection.getAccountInfo(
        securityAssociatedAccountPubkey
      );
      assert.isNull(accountInfo);
      const { currentWalletsCount: holderCurrentWalletsCountAfter } =
        await testEnvironment.transferRestrictionsHelper.holderData(
          holderPubkey
        );
      const { currentWalletsCount: holderGroupCurrentWalletsCountAfter } =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const { currentHoldersCount: groupCurrentHoldersCountAfter } =
        await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
      assert.equal(
        holderCurrentWalletsCountAfter.toNumber(),
        holderCurrentWalletsCountBefore.toNumber() - 1
      );
      assert.equal(
        holderGroupCurrentWalletsCountAfter.toNumber(),
        holderGroupCurrentWalletsCountBefore.toNumber() - 1
      );
      assert.equal(
        groupCurrentHoldersCountAfter.toNumber(),
        groupCurrentHoldersCountBefore.toNumber() - 1
      );
    });
  });

  describe("when more than one holder wallets are linked with group", () => {
    it("revokes security associated account by wallets admin and keeps holder inside the group", async () => {
      const signer = testEnvironment.walletsAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
      const holderIdx = 1;
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(
          new anchor.BN(holderIdx)
        );
      const [holderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          holderPubkey,
          groupId
        );
      const [securityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          investorsTokenAccounts[1]
        );
      const { currentWalletsCount: holderCurrentWalletsCountBefore } =
        await testEnvironment.transferRestrictionsHelper.holderData(
          holderPubkey
        );
      const { currentWalletsCount: holderGroupCurrentWalletsCountBefore } =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const { currentHoldersCount: groupCurrentHoldersCountBefore } =
        await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
      let accountInfo = await testEnvironment.connection.getAccountInfo(
        securityAssociatedAccountPubkey
      );
      assert.isNotNull(accountInfo);

      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: investors[1].publicKey,
          associatedTokenAccount: investorsTokenAccounts[1],
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      accountInfo = await testEnvironment.connection.getAccountInfo(
        securityAssociatedAccountPubkey
      );
      assert.isNull(accountInfo);
      const { currentWalletsCount: holderCurrentWalletsCountAfter } =
        await testEnvironment.transferRestrictionsHelper.holderData(
          holderPubkey
        );
      const { currentWalletsCount: holderGroupCurrentWalletsCountAfter } =
        await testEnvironment.transferRestrictionsHelper.holderGroupData(
          holderGroupPubkey
        );
      const { currentHoldersCount: groupCurrentHoldersCountAfter } =
        await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
      assert.equal(
        holderCurrentWalletsCountAfter.toNumber(),
        holderCurrentWalletsCountBefore.toNumber() - 1
      );
      assert.equal(
        holderGroupCurrentWalletsCountAfter.toNumber(),
        holderGroupCurrentWalletsCountBefore.toNumber() - 1
      );
      assert.equal(
        groupCurrentHoldersCountAfter.toNumber(),
        groupCurrentHoldersCountBefore.toNumber()
      );
    });
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    const investorWallet = Keypair.generate();
    const investorTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investorWallet.publicKey,
        testEnvironment.transferAdmin
      );

    const authority = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      investorWallet.publicKey,
      investorTokenAccount,
      authorityWalletRolePubkey,
      authority,
      groupId
    );
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorTokenAccount
      );
    const securityAssociatedAccountData = await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
      securityAssociatedAccountPubkey
    );

    const holderPubkey = securityAssociatedAccountData.holder;
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );


    const payerBalanceBefore =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await testEnvironment.connection.getBalance(authority.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeSecurityAssociatedAccount()
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: investorWallet.publicKey,
        associatedTokenAccount: investorTokenAccount,
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

    // Payer's balance should have increased (received refund for revoking security associated account)
    assert.isTrue(
      payerBalanceAfter > payerBalanceBefore,
      "Payer balance should increase after revoking security associated account (received refund)"
    );
    // Authority's balance should not decrease (only payer pays)
    assert.equal(
      authorityBalanceAfter,
      authorityBalanceBefore,
      "Authority balance should not change when not the payer"
    );
  });
});
