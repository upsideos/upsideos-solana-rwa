import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { topUpWallet } from "../utils";

describe("Initialize security associated account", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 4,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;
  const firstGroupIdx = new anchor.BN(1);
  let firstGroupPubkey: PublicKey;
  const investorWallet1 = Keypair.generate();
  let investorWallet1AssociatedAccount: PublicKey;
  const investorWallet2 = Keypair.generate();
  let investorWallet2AssociatedAccount: PublicKey;

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
    [firstGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    let currentHolderIdx = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    const [transferAdminRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
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
    investorWallet2AssociatedAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investorWallet2.publicKey,
        testEnvironment.reserveAdmin
      );
  });

  it("fails to initialize security associated account by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const holderIdx = new anchor.BN(0);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorWallet1AssociatedAccount
      );
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeSecurityAssociatedAccount(firstGroupIdx, holderIdx)
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: investorWallet1.publicKey,
          associatedTokenAccount: investorWallet1AssociatedAccount,
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

  it("fails to initialize security associated account by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const holderIdx = new anchor.BN(0);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorWallet1AssociatedAccount
      );
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeSecurityAssociatedAccount(firstGroupIdx, holderIdx)
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          userWallet: investorWallet1.publicKey,
          associatedTokenAccount: investorWallet1AssociatedAccount,
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

  it("initializes security associated account by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const holderIdx = new anchor.BN(0);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorWallet1AssociatedAccount
      );
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const { currentWalletsCount: currWalletsCountBeforePerGroup } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    const { currentWalletsCount: currWalletsCountBeforePerHolder } =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeSecurityAssociatedAccount(firstGroupIdx, holderIdx)
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: investorWallet1.publicKey,
        associatedTokenAccount: investorWallet1AssociatedAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const securityAssociatedAccountData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountPubkey
      );
    assert.equal(
      securityAssociatedAccountData.group.toNumber(),
      firstGroupIdx.toNumber()
    );
    assert.equal(
      securityAssociatedAccountData.holder.toBase58(),
      holderPubkey.toBase58()
    );
    const { currentWalletsCount: currWalletsCountAfterPerGroup } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    const { currentWalletsCount: currWalletsCountAfterPerHolder } =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(
      currWalletsCountAfterPerGroup.toNumber(),
      currWalletsCountBeforePerGroup.toNumber() + 1
    );
    assert.equal(
      currWalletsCountAfterPerHolder.toNumber(),
      currWalletsCountBeforePerHolder.toNumber() + 1
    );
    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.addn(1).toNumber()
    );
  });

  it("initializes security associated account by wallets admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const holderIdx = new anchor.BN(1);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorWallet2AssociatedAccount
      );
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const { currentWalletsCount: currWalletsCountBeforePerGroup } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    const { currentWalletsCount: currWalletsCountBeforePerHolder } =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeSecurityAssociatedAccount(firstGroupIdx, holderIdx)
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: investorWallet2.publicKey,
        associatedTokenAccount: investorWallet2AssociatedAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const securityAssociatedAccountData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountPubkey
      );
    assert.equal(
      securityAssociatedAccountData.group.toNumber(),
      firstGroupIdx.toNumber()
    );
    assert.equal(
      securityAssociatedAccountData.holder.toBase58(),
      holderPubkey.toBase58()
    );
    const { currentWalletsCount: currWalletsCountAfterPerGroup } =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    const { currentWalletsCount: currWalletsCountAfterPerHolder } =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(
      currWalletsCountAfterPerGroup.toNumber(),
      currWalletsCountBeforePerGroup.toNumber() + 1
    );
    assert.equal(
      currWalletsCountAfterPerHolder.toNumber(),
      currWalletsCountBeforePerHolder.toNumber() + 1
    );
    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.addn(1).toNumber()
    );
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    const authority = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);
    
    // Create a new investor wallet and token account for this test
    const newInvestorWallet = Keypair.generate();
    const newInvestorTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        newInvestorWallet.publicKey,
        testEnvironment.transferAdmin
      );
    
    const holderIdx = new anchor.BN(2);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        newInvestorTokenAccount
      );
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );

    const payerBalanceBefore =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await testEnvironment.connection.getBalance(authority.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeSecurityAssociatedAccount(firstGroupIdx, holderIdx)
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: newInvestorWallet.publicKey,
        associatedTokenAccount: newInvestorTokenAccount,
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

  const investorWallet3 = Keypair.generate();
  let investorWallet3AssociatedAccount: PublicKey;
  describe("when max holders reached inside the group", () => {
    before(async () => {
      await testEnvironment.transferRestrictionsHelper.setHolderGroupMax(
        new anchor.BN(3),
        firstGroupIdx,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.transferAdmin.publicKey
        )[0],
        testEnvironment.transferAdmin
      );
      investorWallet3AssociatedAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          investorWallet3.publicKey,
          testEnvironment.reserveAdmin
        );
    });

    it("fails to initialize security associated account", async () => {
      const signer = testEnvironment.transferAdmin;
      const holderIdx = new anchor.BN(3);
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
      const [groupPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
      const [securityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          investorWallet3AssociatedAccount
        );
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
      await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
        holderIdx,
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey)[0],
        signer
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
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey)[0],
        signer
      );
      
      const {
        currentHoldersCount: holderGroupCountBefore,
        maxHolders: maxHolders,
      } = await testEnvironment.transferRestrictionsHelper.groupData(
        groupPubkey
      );

      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .initializeSecurityAssociatedAccount(firstGroupIdx, holderIdx)
          .accountsStrict({
            securityAssociatedAccount: securityAssociatedAccountPubkey,
            group: groupPubkey,
            holder: holderPubkey,
            holderGroup: holderGroupPubkey,
            securityToken: testEnvironment.mintKeypair.publicKey,
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            userWallet: investorWallet3.publicKey,
            associatedTokenAccount: investorWallet3AssociatedAccount,
            authorityWalletRole: authorityWalletRolePubkey,
            payer: signer.publicKey,
            authority: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "MaxHoldersReachedInsideTheGroup");
        assert.equal(
          error.errorMessage,
          "Max holders reached inside the group"
        );
      }

      const { currentHoldersCount: holderGroupCountAfter } =
        await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
      assert.equal(
        holderGroupCountBefore.toNumber(),
        holderGroupCountAfter.toNumber()
      );
    });
  });
});
