import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { topUpWallet } from "../utils";

describe("Revoke holder", () => {
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
  });

  it("fails to revoke holder by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolder()
        .accountsStrict({
          holder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
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

  it("fails to revoke holder by reserve admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolder()
        .accountsStrict({
          holder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
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

  it("fails to revoke holder when holder group is not revoked in advance", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderPubkey
    );
    assert.isNotNull(accountInfo);
    const { currentHoldersCount: currentHoldersCountBefore } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolder()
        .accountsStrict({
          holder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "CurrentHolderGroupCountMustBeZero");
      assert.equal(
        error.errorMessage,
        "Current holder group count must be zero"
      );
    }

    accountInfo = await testEnvironment.connection.getAccountInfo(holderPubkey);
    assert.isNotNull(accountInfo);
    const { currentHoldersCount: currentHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      currentHoldersCountAfter.toNumber(),
      currentHoldersCountBefore.toNumber()
    );
  });

  it("revokes holder by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderPubkey
    );
    assert.isNotNull(accountInfo);
    const { currentHoldersCount: currentHoldersCountBefore } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();

    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolderGroup()
      .accountsStrict({
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolder()
      .accountsStrict({
        holder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    accountInfo = await testEnvironment.connection.getAccountInfo(holderPubkey);
    assert.isNull(accountInfo);
    const { currentHoldersCount: currentHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      currentHoldersCountAfter.toNumber(),
      currentHoldersCountBefore.toNumber() - 1
    );
  });

  it("revokes holder by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderPubkey
    );
    assert.isNotNull(accountInfo);
    const { currentHoldersCount: currentHoldersCountBefore } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();

    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolderGroup()
      .accountsStrict({
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolder()
      .accountsStrict({
        holder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    accountInfo = await testEnvironment.connection.getAccountInfo(holderPubkey);
    assert.isNull(accountInfo);
    const { currentHoldersCount: currentHoldersCountAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      currentHoldersCountAfter.toNumber(),
      currentHoldersCountBefore.toNumber() - 1
    );
  });

  const investor = Keypair.generate();
  it("fails to revoke holder if some wallets are linked with it", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(2)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNotNull(accountInfo);

    const investorTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investor.publicKey,
        testEnvironment.transferAdmin
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investor.publicKey,
      investorTokenAccount,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolder()
        .accountsStrict({
          holder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "CurrentWalletsCountMustBeZero");
      assert.equal(error.errorMessage, "Current wallets count must be zero");
    }
    accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNotNull(accountInfo);
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    const authority = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);
    const holderIdx = new anchor.BN(1);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      holderIdx
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      authorityWalletRolePubkey,
      authority
    );

    const payerBalanceBefore =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await testEnvironment.connection.getBalance(authority.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolder()
      .accountsStrict({
        holder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
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

    // Payer's balance should have increased (paid fees refunded)
    assert.isTrue(
      payerBalanceAfter > payerBalanceBefore,
      "Payer balance should increase after paying fees (refunded)"
    );
    // Authority's balance should not change (only payer pays)
    assert.equal(
      authorityBalanceAfter,
      authorityBalanceBefore,
      "Authority balance should not change when not the payer"
    );
  });
});
