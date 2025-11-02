import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { createMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { topUpWallet } from "../utils";

describe("Initialize transfer restriction data", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
  });

  it("fails to initialize data with non-zero group", async () => {
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    const groupIdx = new anchor.BN(1);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: testEnvironment.contractAdmin.publicKey,
          authority: testEnvironment.contractAdmin.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("fails to initialize data with another mint then in accessControlData", async () => {
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    const newMint = Keypair.generate();
    await createMint(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      testEnvironment.contractAdmin.publicKey,
      null,
      testEnvironmentParams.mint.decimals,
      newMint,
      { commitment: testEnvironment.commitment },
      TOKEN_2022_PROGRAM_ID
    );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: newMint.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: testEnvironment.contractAdmin.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          authority: testEnvironment.contractAdmin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("fails to initialize data with reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize data with wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize data with transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          authority: signer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("initializes transfer restrictions", async () => {
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    const [groupPDA] = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(0)
    );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionsData(
        new anchor.BN(testEnvironmentParams.maxHolders)
      )
      .accountsStrict({
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        mint: testEnvironment.mintKeypair.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: testEnvironment.contractAdmin.publicKey,
        zeroTransferRestrictionGroup: groupPDA,
        authority: testEnvironment.contractAdmin.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([testEnvironment.contractAdmin])
      .rpc({ commitment: testEnvironment.commitment });
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      trData.securityTokenMint.toString(),
      testEnvironment.mintKeypair.publicKey.toString()
    );
    assert.equal(
      trData.accessControlAccount.toString(),
      testEnvironment.accessControlHelper.accessControlPubkey.toString()
    );
    assert.equal(trData.currentHoldersCount.toNumber(), 0);
    assert.equal(trData.holderIds.toNumber(), 0);
    assert.equal(
      trData.maxHolders.toNumber(),
      testEnvironmentParams.maxHolders
    );
    assert.equal(trData.paused, false);
    assert.equal(trData.lockupEscrowAccount, undefined);

    const groupData =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPDA);
    assert.equal(groupData.currentHoldersCount.toNumber(), 0);
    assert.equal(groupData.id.toNumber(), 0);
    assert.equal(groupData.maxHolders.toNumber(), 0);
    assert.equal(
      groupData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
  });

  it("payer can be different from authority and pays all fees", async () => {
    const payer = Keypair.generate();
    await topUpWallet(testEnvironment.connection, payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    // Create a new test environment to avoid interfering with other tests
    const newTestEnvironment = new TestEnvironment(testEnvironmentParams);
    await newTestEnvironment.setupAccessControl();
    const authority = newTestEnvironment.contractAdmin;

    const [groupPDA] = newTestEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(0)
    );
    const [authorityWalletRolePubkey] =
      newTestEnvironment.accessControlHelper.walletRolePDA(authority.publicKey);

    const payerBalanceBefore =
      await newTestEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceBefore =
      await newTestEnvironment.connection.getBalance(authority.publicKey);

    await newTestEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionsData(
        new anchor.BN(testEnvironmentParams.maxHolders)
      )
      .accountsStrict({
        transferRestrictionData:
          newTestEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          newTestEnvironment.accessControlHelper.accessControlPubkey,
        mint: newTestEnvironment.mintKeypair.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
        zeroTransferRestrictionGroup: groupPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority, payer])
      .rpc({ commitment: newTestEnvironment.commitment });

    const payerBalanceAfter =
      await newTestEnvironment.connection.getBalance(payer.publicKey);
    const authorityBalanceAfter =
      await newTestEnvironment.connection.getBalance(authority.publicKey);

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
