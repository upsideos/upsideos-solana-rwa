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
  mintReleaseSchedule,
  initializeTokenlock,
  getTokenlockAccount,
  getTimelockAccountData,
  timelockCountOf,
  lockedBalanceOf,
  unlockedBalanceOf,
  getScheduleCount,
  balanceOf,
  MAX_RELEASE_DELAY,
} from "../helpers/tokenlock_helper";
import { getNowTs } from "../helpers/clock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";

describe("TokenLockup mint release schedules", () => {
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

  let mintPubkey: anchor.web3.PublicKey;
  let walletA: anchor.web3.Keypair;
  let escrowAccount: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;
  let tokenlockWallet: anchor.web3.Keypair;
  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let reserveAdmin: anchor.web3.Keypair;
  let reserveAdminWalletRolePubkey: anchor.web3.PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    walletA = Keypair.generate();
    await topUpWallet(
      testEnvironment.connection,
      walletA.publicKey,
      solToLamports(1)
    );

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

    const [contractAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      contractAdminWalletRole,
      testEnvironment.contractAdmin
    );
    await testEnvironment.accessControlHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      testEnvironment.contractAdmin
    );
  });

  let currentScheduleId = 0;
  let walletATimelockCount = 0;
  it("mintReleaseSchedule emits a ScheduleFunded event", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4);
    const commence = -3600 * 24;

    let nowTs = await getNowTs(testEnvironment.connection);
    const account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );

    const scheduleCount = getScheduleCount(account);
    assert(scheduleCount === 0);

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
    assert(scheduleId === currentScheduleId);
    currentScheduleId++;

    nowTs = await getNowTs(testEnvironment.connection);
    let { timelockId } = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(490),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletA.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number };
    assert(timelockId === walletATimelockCount);
    walletATimelockCount++;

    const { timelockId: timelockId2 } = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(510),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletA.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number };
    assert(timelockId2 === walletATimelockCount);
    walletATimelockCount++;

    const timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      walletA.publicKey
    );
    const unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 0);
  });

  it("timelock creation with immediately unlocked tokens", async () => {
    const totalRecipientAmount = 100;
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4);
    const commence = 0;
    const mintRecipient = Keypair.generate();

    let nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );

    const scheduleCount = getScheduleCount(account);
    assert(scheduleCount === currentScheduleId);

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
    currentScheduleId++;

    nowTs = await getNowTs(testEnvironment.connection);
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    nowTs += 3600 * 24;
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    const timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      mintRecipient.publicKey
    );
    let unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 8);

    const locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 92);

    const balance = balanceOf(account, timelockAccount, nowTs);
    assert(balance.toNumber() === totalRecipientAmount);

    nowTs += 3 * 3600 * 24; // +3 days = -1 days(commenced) + 3 days = 4 days.
    // // firstBatch + ((totalRecipientAmount - firstBatch) / 2)
    // // 8 + ((100 - 8) / 2) = 8 + (92 / 2) = 8 + 46 = 54
    unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(Math.trunc(unlocked.toNumber()) === 54);

    unlocked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(
      Math.trunc(unlocked.toNumber()) === 45 ||
        Math.trunc(unlocked.toNumber()) === 46
    );

    unlocked = balanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === totalRecipientAmount);

    // // await advanceTime('5')
    nowTs += 4 * 3600 * 24; // +4 days
    assert(
      unlockedBalanceOf(account, timelockAccount, nowTs).toNumber() ===
        totalRecipientAmount
    );
    assert(lockedBalanceOf(account, timelockAccount, nowTs).toNumber() === 0);
    assert(
      balanceOf(account, timelockAccount, nowTs).toNumber() ===
        totalRecipientAmount
    );
  });

  it("must have more tokens than there are release periods", async () => {
    const totalRecipientAmount = 100;
    const totalBatches = 101;
    const firstDelay = 0;
    const firstBatchBips = 0; // 8%
    const batchDelay = 1;
    const commence = 0;
    const mintRecipient = Keypair.generate();

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
    currentScheduleId++;

    const nowTs = await getNowTs(testEnvironment.connection);
    const result = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );
    assert(result.error?.toString() === "Per release token less than 1");
  });

  it("must have more tokens than minReleaseScheduleAmount", async () => {
    const minReleaseScheduleAmount = 100;
    const totalRecipientAmount = minReleaseScheduleAmount - 1; // this is below the required amount
    const totalBatches = 1;
    const firstDelay = 0;
    const firstBatchBips = 100 * 100;
    const batchDelay = 1;
    const commence = 0;
    const mintRecipient = Keypair.generate();

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
    currentScheduleId++;

    const nowTs = await getNowTs(testEnvironment.connection);
    const result = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );
    assert(result.error?.toString() === "Amount < min minting amount");
  });

  it("cannot specify non existent schedule id", async () => {
    const minReleaseScheduleAmount = 100;
    const totalRecipientAmount = minReleaseScheduleAmount;
    const totalBatches = 1;
    const firstDelay = 0;
    const firstBatchBips = 100 * 100;
    const batchDelay = 1;
    const commence = 0;
    const mintRecipient = Keypair.generate();
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
    currentScheduleId++;

    const nowTs = await getNowTs(testEnvironment.connection);
    const result = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + commence),
      Number(scheduleId) + 1,
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );
    assert(result.error?.toString() === "Invalid scheduleId");
  });

  it("returns true after mintReleaseSchdule is called", async () => {
    const commence = -3600 * 24;
    const mintRecipient = Keypair.generate();
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      1,
      new anchor.BN(0),
      100 * 100,
      new anchor.BN(0),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    currentScheduleId++;

    const nowTs = await getNowTs(testEnvironment.connection);
    const { timelockId } = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number };
    assert(timelockId === 0);
  });

  it("cannot specify a commencement time after the allowed range", async () => {
    const minReleaseScheduleAmount = 100;
    const totalRecipientAmount = minReleaseScheduleAmount;
    const totalBatches = 1;
    const firstDelay = 0;
    const firstBatchBips = 100 * 100;
    const batchDelay = 1;
    const mintRecipient = Keypair.generate();

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
    currentScheduleId++;

    const nowTs = await getNowTs(testEnvironment.connection);
    const result = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + MAX_RELEASE_DELAY + 1000),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );
    assert(result.error === "Commencement time out of range");

    const timelockCount = timelockCountOf(
      await getTimelockAccountData(
        tokenlockProgram,
        tokenlockDataPubkey,
        mintRecipient.publicKey
      )
    );
    assert(timelockCount === 0);
  });

  it("cannot specify a schedule with a delay until first release that is greater than the max release delay", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      1,
      new anchor.BN(MAX_RELEASE_DELAY + 1),
      1e4,
      new anchor.BN(0),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    assert(scheduleId === "First release > max delay");
  });

  it("can specify a schedule with a delay up to the max release delay", async () => {
    // ok to make a release schedule within the max range
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      1,
      new anchor.BN(MAX_RELEASE_DELAY),
      1e4,
      new anchor.BN(0),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    assert(scheduleId === currentScheduleId);
    currentScheduleId++;
  });

  it("cannot mint release schedule after the allowed range", async () => {
    const minReleaseScheduleAmount = 100;
    const totalRecipientAmount = minReleaseScheduleAmount;
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      1,
      new anchor.BN(MAX_RELEASE_DELAY),
      100 * 100,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    currentScheduleId++;

    const nowTs = await getNowTs(testEnvironment.connection);
    const result = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + 5000),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletA.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );
    assert(result.error?.toString() === "Initial release out of range");
  });

  it("mintReleaseRelease can be scheduled in the past", async () => {
    let nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );
    const mintRecipient = Keypair.generate();

    const scheduleCount = getScheduleCount(account);
    assert(scheduleCount === currentScheduleId);

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      3,
      new anchor.BN(0),
      800,
      new anchor.BN(3600 * 24 * 4),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    currentScheduleId++;

    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(490),
      new anchor.BN(nowTs),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      mintRecipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    nowTs += 3600 * 24 * 30;
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    const timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      mintRecipient.publicKey
    );

    const unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 490);

    const locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 0);

    const balance = balanceOf(account, timelockAccount, nowTs);
    assert(balance.toNumber() === 490);
  });
});
