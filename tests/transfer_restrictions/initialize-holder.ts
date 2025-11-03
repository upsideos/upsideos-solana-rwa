import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { topUpWallet } from "../utils";

describe("Initialize transfer restriction Holder", () => {
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

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
  });

  const zeroHolderIdx = new anchor.BN(0);
  it("fails to initialize holder by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(zeroHolderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
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

  it("fails to initialize holder by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(zeroHolderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
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

  it("fails to initialize holder with index greater than allowed", async () => {
    const signer = testEnvironment.transferAdmin;
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const holderIdx = trData.holderIds.addn(1);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(holderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "InvalidHolderIndex");
      assert.equal(
        error.errorMessage,
        "Invalid transfer restriction holder index"
      );
    }
  });

  it("initializes holder by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionHolder(zeroHolderIdx)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        payer: signer.publicKey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.isTrue(holderData.active);
    assert.equal(holderData.id.toString(), zeroHolderIdx.toString());
    assert.equal(holderData.currentWalletsCount.toNumber(), 0);
    assert.equal(holderData.currentHolderGroupCount.toNumber(), 0);
    assert.equal(
      holderData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(trData.currentHoldersCount.toNumber(), 1);
    assert.equal(trData.holderIds.toNumber(), 1);
  });

  const firstHolderIdx = new anchor.BN(1);
  it("initializes holder by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(firstHolderIdx);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionHolder(firstHolderIdx)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        payer: signer.publicKey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.isTrue(holderData.active);
    assert.equal(holderData.id.toString(), firstHolderIdx.toString());
    assert.equal(holderData.currentWalletsCount.toNumber(), 0);
    assert.equal(holderData.currentHolderGroupCount.toNumber(), 0);
    assert.equal(
      holderData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(trData.currentHoldersCount.toNumber(), 2);
    assert.equal(trData.holderIds.toNumber(), 2);
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    const authority = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const holderIdx = trData.holderIds;
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);

    const payerBalanceBefore =
      await testEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await testEnvironment.connection.getBalance(authority.publicKey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionHolder(holderIdx)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        payer: payer.publicKey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
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

  it("fails to initialize holder when max holders reached", async () => {
    const signer = testEnvironment.transferAdmin;
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const holderIdx = trData.holderIds;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(holderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MaxHoldersReached");
      assert.equal(error.errorMessage, "Max holders reached");
    }
  });

  describe("when initializes holder with already revoked holder index", () => {
    it("does not increment holder ids but increments holders count", async () => {
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.transferAdmin.publicKey
        );
      const signer = testEnvironment.transferAdmin;
      let {
        holderIds: holderIdsBeforeRevoke,
        currentHoldersCount: currentHoldersCountBeforeRevoke,
      } =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
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
      let accountInfo =
        await testEnvironment.provider.connection.getAccountInfo(holderPubkey);
      assert.isNull(accountInfo);

      let {
        holderIds: holderIdsBeforeInitialize,
        currentHoldersCount: currentHoldersCountBeforeInitialize,
      } =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      assert.equal(
        holderIdsBeforeRevoke.toNumber(),
        holderIdsBeforeInitialize.toNumber()
      );
      assert.equal(
        currentHoldersCountBeforeRevoke.toNumber() - 1,
        currentHoldersCountBeforeInitialize.toNumber()
      );
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(zeroHolderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });

      accountInfo = await testEnvironment.provider.connection.getAccountInfo(
        holderPubkey
      );
      assert.isNotNull(accountInfo);
      const holderData =
        await testEnvironment.transferRestrictionsHelper.holderData(
          holderPubkey
        );
      assert.isTrue(holderData.active);
      assert.equal(holderData.id.toString(), zeroHolderIdx.toString());
      assert.equal(holderData.currentWalletsCount.toNumber(), 0);
      assert.equal(
        holderData.transferRestrictionData.toString(),
        testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
      );
      let {
        holderIds: holderIdsAfterInitialize,
        currentHoldersCount: currentHoldersCountAfterInitialize,
      } =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      assert.equal(
        holderIdsBeforeInitialize.toNumber(),
        holderIdsAfterInitialize.toNumber()
      );
      assert.equal(
        currentHoldersCountBeforeInitialize.toNumber() + 1,
        currentHoldersCountAfterInitialize.toNumber()
      );
    });
  });
});
