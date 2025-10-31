import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair } from "@solana/web3.js";

import { Tokenlock } from "../../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "../utils";
import {
  createReleaseSchedule,
  initializeTokenlock,
  batchMintReleaseSchedule,
  MAX_RELEASE_DELAY,
} from "../helpers/tokenlock_helper";
import { getNowTs } from "../helpers/clock_helper";

describe("TokenLockup batch mint testing", () => {
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

  const tokenlockProgram = anchor.workspace.Tokenlock as Program<Tokenlock>;

  let startTs: number;
  let mintPubkey: anchor.web3.PublicKey;
  let walletA: anchor.web3.Keypair;
  let escrowAccount: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;
  let tokenlockWallet: anchor.web3.Keypair;
  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let reserveAdmin: anchor.web3.Keypair;
  let reserveAdminWalletRolePubkey: anchor.web3.PublicKey;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();
    startTs = await getNowTs(testEnvironment.connection);

    // create wallet A
    walletA = Keypair.generate();
    mintPubkey = testEnvironment.mintKeypair.publicKey;
    reserveAdmin = testEnvironment.reserveAdmin;
    [reserveAdminWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(reserveAdmin.publicKey);

    tokenlockWallet = anchor.web3.Keypair.generate();
    tokenlockDataPubkey = tokenlockWallet.publicKey;

    await topUpWallet(
      testEnvironment.connection,
      testEnvironment.contractAdmin.publicKey,
      solToLamports(100)
    );
    const space = 1 * 1024 * 1024; // 1MB

    tokenlockDataPubkey = await createAccount(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      space,
      tokenlockProgram.programId
    );
    [escrowOwnerPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tokenlock"),
        testEnvironment.mintKeypair.publicKey.toBuffer(),
        tokenlockDataPubkey.toBuffer(),
      ],
      tokenlockProgram.programId
    );
    escrowAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        escrowOwnerPubkey,
        testEnvironment.contractAdmin,
        true
      );
    const maxReleaseDelay = new anchor.BN(MAX_RELEASE_DELAY);
    const minTimelockAmount = new anchor.BN(100);
    await initializeTokenlock(
      tokenlockProgram,
      maxReleaseDelay,
      minTimelockAmount,
      tokenlockDataPubkey,
      escrowAccount,
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      )[0],
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.contractAdmin
    );

    await testEnvironment.accessControlHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      testEnvironment.contractAdmin
    );
  });

  it("batchMintReleaseSchedule success", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = 3600 * 24 * 4; // 4 days
    const commence = -3600 * 24;

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      totalBatches,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(batchDelay),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    assert(scheduleId === 0);

    const nowTs = await getNowTs(testEnvironment.connection);
    const res = await batchMintReleaseSchedule(
      tokenlockProgram,
      [new anchor.BN(510), new anchor.BN(520)],
      [new anchor.BN(nowTs + commence), new anchor.BN(nowTs + commence + 1)],
      [scheduleId, scheduleId],
      [],
      tokenlockDataPubkey,
      escrowOwnerPubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      [walletA.publicKey, walletA.publicKey],
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.program,
      reserveAdmin
    );
    assert(res === "ok");
  });

  it("batchMintReleaseSchedule array length mismatch", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = 3600 * 24 * 4; // 4 days
    const commence = -3600 * 24;

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      totalBatches,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(batchDelay),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    assert(scheduleId === 0);

    const nowTs = await getNowTs(testEnvironment.connection);
    let res = await batchMintReleaseSchedule(
      tokenlockProgram,
      [new anchor.BN(510), new anchor.BN(520)],
      [new anchor.BN(nowTs + commence), new anchor.BN(nowTs + commence + 1)],
      [scheduleId],
      [],
      tokenlockDataPubkey,
      escrowOwnerPubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      [walletA.publicKey, walletA.publicKey],
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.program,
      reserveAdmin
    );
    assert(res === "mismatched array length");

    res = await batchMintReleaseSchedule(
      tokenlockProgram,
      [new anchor.BN(510)],
      [new anchor.BN(nowTs + commence), new anchor.BN(nowTs + commence + 1)],
      [scheduleId, scheduleId],
      [],
      tokenlockDataPubkey,
      escrowOwnerPubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      [walletA.publicKey, walletA.publicKey],
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.program,
      reserveAdmin
    );
    assert(res === "mismatched array length");

    res = await batchMintReleaseSchedule(
      tokenlockProgram,
      [new anchor.BN(510), new anchor.BN(510)],
      [new anchor.BN(nowTs + commence)],
      [scheduleId, scheduleId],
      [],
      tokenlockDataPubkey,
      escrowOwnerPubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      [walletA.publicKey, walletA.publicKey],
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.program,
      reserveAdmin
    );
    assert(res === "mismatched array length");
  });

  it("allow mint less than max total supply balance", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = 3600 * 24 * 4; // 4 days
    const commence = -3600 * 24;

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      totalBatches,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(batchDelay),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    assert(scheduleId === 0);

    const nowTs = await getNowTs(testEnvironment.connection);
    const res = await batchMintReleaseSchedule(
      tokenlockProgram,
      [new anchor.BN(10000), new anchor.BN(90000)],
      [new anchor.BN(nowTs + commence), new anchor.BN(nowTs + commence + 1)],
      [scheduleId, scheduleId],
      [],
      tokenlockDataPubkey,
      escrowOwnerPubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      [walletA.publicKey, walletA.publicKey],
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.program,
      reserveAdmin
    );
    assert(res === "ok");
  });

  it("reverts all transfers if it exceeds the approved number of tokens", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = 3600 * 24 * 4; // 4 days
    const commence = -3600 * 24;
    const accessControlData =
      await testEnvironment.accessControlHelper.accessControlData();
    const maxTotalSupply = accessControlData.maxTotalSupply;

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      totalBatches,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(batchDelay),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    assert(scheduleId === 0);

    const nowTs = await getNowTs(testEnvironment.connection);
    const res = await batchMintReleaseSchedule(
      tokenlockProgram,
      [new anchor.BN(maxTotalSupply), new anchor.BN(1)],
      [new anchor.BN(nowTs + commence), new anchor.BN(nowTs + commence + 1)],
      [scheduleId, scheduleId],
      [],
      tokenlockDataPubkey,
      escrowOwnerPubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      [walletA.publicKey, walletA.publicKey],
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.program,
      reserveAdmin
    );
    assert(res === "more than max mint total supply!");
  });
});
