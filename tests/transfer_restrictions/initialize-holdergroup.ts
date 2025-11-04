import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { topUpWallet } from "../utils";

describe("Initialize transfer restriction HolderGroup", () => {
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
  const zeroIdx = new anchor.BN(0);
  const firstGroupIdx = new anchor.BN(1);
  const maxHoldersInGroup1 = new anchor.BN(1);

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
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(1),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(2),
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

    const [firstGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    await testEnvironment.transferRestrictionsHelper.setHolderGroupMax(
      maxHoldersInGroup1,
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("fails to initialize holdergroup by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        zeroIdx
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeHolderGroup()
        .accountsStrict({
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          holder: holderPubkey,
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

  it("fails to initialize holdergroup by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        zeroIdx
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeHolderGroup()
        .accountsStrict({
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          holder: holderPubkey,
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

  it("initialize holdergroup by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        zeroIdx
      );
    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const holderGroup =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    assert.equal(holderGroup.holder.toString(), holderPubkey.toString());
    assert.equal(holderGroup.group.toString(), zeroIdx.toString());
    assert.equal(holderGroup.currentWalletsCount.toNumber(), 0);

    const holder = await testEnvironment.transferRestrictionsHelper.holderData(
      holderPubkey
    );
    assert.equal(holder.currentHolderGroupCount.toNumber(), 1);

    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.toNumber()
    );
  });

  it("initialize holdergroup by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const holderIdx = firstGroupIdx;
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const holderGroup =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    assert.equal(holderGroup.holder.toString(), holderPubkey.toString());
    assert.equal(holderGroup.group.toString(), firstGroupIdx.toString());
    assert.equal(holderGroup.currentWalletsCount.toNumber(), 0);
    const holder = await testEnvironment.transferRestrictionsHelper.holderData(
      holderPubkey
    );
    assert.equal(holder.currentHolderGroupCount.toNumber(), 1);

    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.toNumber()
    );
  });

  it("fails to initialize holdergroup when max holders reached inside the group", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const holderIdx = new anchor.BN(2);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );

    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeHolderGroup()
        .accountsStrict({
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MaxHoldersReachedInsideTheGroup");
      assert.equal(error.errorMessage, "Max holders reached inside the group");
    }
    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.toNumber()
    );
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    const authority = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);
    const holderIdx = new anchor.BN(3);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey)[0],
      authority
    );

    const payerBalanceBefore =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await testEnvironment.connection.getBalance(authority.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
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
});
