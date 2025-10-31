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
  lockedBalanceOf,
  unlockedBalanceOf,
  getScheduleCount,
  balanceOf,
  MAX_RELEASE_DELAY,
  balanceOfTimelock,
  unlockedBalanceOfTimelock,
  lockedBalanceOfTimelock,
  withdraw,
  getTimelockAccount,
} from "../helpers/tokenlock_helper";
import { getNowTs } from "../helpers/clock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";

describe("TokenLockup timelock balances", () => {
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

    mintPubkey = testEnvironment.mintKeypair.publicKey;
    reserveAdmin = testEnvironment.reserveAdmin;
    [reserveAdminWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(reserveAdmin.publicKey);

    tokenlockWallet = anchor.web3.Keypair.generate();
    tokenlockDataPubkey = tokenlockWallet.publicKey;

    await topUpWallet(
      testEnvironment.connection,
      testEnvironment.contractAdmin.publicKey,
      solToLamports(10)
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
    const minTimelockAmount = new anchor.BN(50);
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

  it("timelock creation with immediately unlocked tokens", async () => {
    const recipient = Keypair.generate();
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      recipient.publicKey,
      testEnvironment.contractAdmin
    );
    await topUpWallet(
      testEnvironment.connection,
      recipient.publicKey,
      solToLamports(1)
    );
    const totalRecipientAmount = 100;
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = 3600 * 24 * 4; // 4 days
    const commence = 0;

    let nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
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

    nowTs = await getNowTs(testEnvironment.connection);
    const timelockId = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(totalRecipientAmount),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    const timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    nowTs += fromDaysToSeconds(1) + 1;
    let unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 8);
    let locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 92);
    const balance = balanceOfTimelock(
      account,
      timelockAccount,
      Number(timelockId),
      nowTs
    );
    assert(balance.toNumber() === 100);

    nowTs = await getNowTs(testEnvironment.connection);
    nowTs = nowTs + fromDaysToSeconds(4) + 1;
    // // firstBatch + ((totalRecipientAmount - firstBatch) / 2)
    // // 8 + ((100 - 8) / 2) = 8 + (92 / 2) = 8 + 46 = 54
    unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(Math.trunc(unlocked.toNumber()) === 54);

    locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(Math.round(locked.toNumber()) === 46);
    assert(balanceOf(account, timelockAccount, nowTs).toNumber() === 100);

    nowTs = nowTs + fromDaysToSeconds(6) + 1;
    assert(
      unlockedBalanceOf(account, timelockAccount, nowTs).toNumber() ===
        totalRecipientAmount
    );
    assert(lockedBalanceOf(account, timelockAccount, nowTs).toNumber() === 0);
    assert(balanceOf(account, timelockAccount, nowTs).toNumber() === 100);
  });

  it("can return all balance types of locked and unlocked tokens in multiple release schedules", async () => {
    const recipient = Keypair.generate();
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      recipient.publicKey,
      testEnvironment.contractAdmin
    );
    await topUpWallet(
      testEnvironment.connection,
      recipient.publicKey,
      solToLamports(1)
    );
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days
    const commence = 0;

    let nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );

    await createReleaseSchedule(
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
    const firstSchedule = getScheduleCount(account);
    await createReleaseSchedule(
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
    const secondSchedule = getScheduleCount(account);

    nowTs = await getNowTs(testEnvironment.connection);
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(nowTs + commence),
      firstSchedule,
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(200),
      new anchor.BN(nowTs + commence),
      secondSchedule,
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    const timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );
    nowTs = nowTs + fromDaysToSeconds(2) + 1;

    assert(
      unlockedBalanceOf(account, timelockAccount, nowTs).toNumber() === 24
    );
    assert(
      unlockedBalanceOfTimelock(
        account,
        timelockAccount,
        0,
        nowTs
      ).toNumber() === 8
    );
    assert(
      unlockedBalanceOfTimelock(
        account,
        timelockAccount,
        1,
        nowTs
      ).toNumber() === 16
    );

    assert(lockedBalanceOf(account, timelockAccount, nowTs).toNumber() === 276);
    assert(
      lockedBalanceOfTimelock(account, timelockAccount, 0, nowTs).toNumber() ===
        92
    );
    assert(
      lockedBalanceOfTimelock(account, timelockAccount, 1, nowTs).toNumber() ===
        184
    );

    assert(lockedBalanceOf(account, timelockAccount, nowTs).toNumber() === 276);
    assert(
      lockedBalanceOfTimelock(account, timelockAccount, 0, nowTs).toNumber() ===
        92
    );
    assert(
      lockedBalanceOfTimelock(account, timelockAccount, 1, nowTs).toNumber() ===
        184
    );

    assert(balanceOf(account, timelockAccount, nowTs).toNumber() === 300);
    assert(
      balanceOfTimelock(account, timelockAccount, 0, nowTs).toNumber() ===
        8 + 92
    );
    assert(
      balanceOfTimelock(account, timelockAccount, 1, nowTs).toNumber() ===
        16 + 184
    );
  });

  it("it can set a schedule to a balance in the past", async () => {
    const recipient = Keypair.generate();
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      recipient.publicKey,
      testEnvironment.contractAdmin
    );
    await topUpWallet(
      testEnvironment.connection,
      recipient.publicKey,
      solToLamports(1)
    );
    const totalRecipientAmount = 100;
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(365) * 200; // 200 years
    const commence = 0;

    let nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );

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
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    nowTs += fromDaysToSeconds(365) * 10;
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    let timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    let unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 8);
    let locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 92);
    let balance = balanceOf(account, timelockAccount, nowTs);
    assert(balance.toNumber() === 100);

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
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    nowTs += fromDaysToSeconds(365) * 10;
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 16);
    locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 184);
    balance = balanceOf(account, timelockAccount, nowTs);
    assert(balance.toNumber() === 200);

    locked = lockedBalanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(locked.toNumber() === 92);
    unlocked = unlockedBalanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(unlocked.toNumber() === 8);
    balance = balanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(balance.toNumber() === 100);

    locked = lockedBalanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(locked.toNumber() === 92);
    unlocked = unlockedBalanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(unlocked.toNumber() === 8);
    balance = balanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(balance.toNumber() === 100);
  });

  it("creating a timelock increases the totalSupply and transferring decreases it", async () => {
    const recipient = Keypair.generate();
    const recipientTokenAcc =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        recipient.publicKey,
        testEnvironment.contractAdmin
      );
    await topUpWallet(
      testEnvironment.connection,
      recipient.publicKey,
      solToLamports(1)
    );
    const releaseCount = 2;
    const firstDelay = 0;
    const firstBatchBips = 5000;
    const commence = 0;
    const periodBetweenReleases = fromDaysToSeconds(4);

    let scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      releaseCount,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(periodBetweenReleases),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    let nowTs = await getNowTs(testEnvironment.connection);
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      releaseCount,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(periodBetweenReleases),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    nowTs = await getNowTs(testEnvironment.connection);
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    const group0 = new anchor.BN(0);
    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const holderId = transferRestrictionData.holderIds;
    const [authorityWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderId,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(group0);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderId);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        group0
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      authorityWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      recipient.publicKey,
      recipientTokenAcc,
      authorityWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      new anchor.BN(1),
      group0,
      group0,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );

    const balanceEscrow = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;
    let amountSent = 51;
    const walletAtimelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    await withdraw(
      testEnvironment.connection,
      new anchor.BN(amountSent),
      tokenlockProgram,
      testEnvironment.transferRestrictionsHelper.program.programId,
      testEnvironment.mintKeypair.publicKey,
      tokenlockDataPubkey,
      walletAtimelockAccount,
      escrowOwnerPubkey,
      recipientTokenAcc,
      testEnvironment.transferRestrictionsHelper,
      recipient
    );

    let balanceEscrowAfterTransfer = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;
    assert(balanceEscrow - BigInt(51) === balanceEscrowAfterTransfer);

    nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );
    let timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    let balance = balanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(balance.toNumber() === 50);

    balance = balanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(balance.toNumber() === 99);

    amountSent = 49;

    await withdraw(
      testEnvironment.connection,
      new anchor.BN(amountSent),
      tokenlockProgram,
      testEnvironment.transferRestrictionsHelper.program.programId,
      testEnvironment.mintKeypair.publicKey,
      tokenlockDataPubkey,
      walletAtimelockAccount,
      escrowOwnerPubkey,
      recipientTokenAcc,
      testEnvironment.transferRestrictionsHelper,
      recipient
    );

    nowTs = await getNowTs(testEnvironment.connection);
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    balance = balanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(balance.toNumber() === 50);

    balance = balanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(balance.toNumber() === 50);

    balanceEscrowAfterTransfer = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;
    assert(balanceEscrow - BigInt(100) === balanceEscrowAfterTransfer);
  });

  it("it can set a schedule to a balance in the future within the maxCommencementTimeInSeconds", async () => {
    const recipient = Keypair.generate();
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      recipient.publicKey,
      testEnvironment.contractAdmin
    );
    await topUpWallet(
      testEnvironment.connection,
      recipient.publicKey,
      solToLamports(1)
    );
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800;
    const batchDelay = fromDaysToSeconds(365) * 200;
    const commence = fromDaysToSeconds(365) * 10;

    let nowTs = await getNowTs(testEnvironment.connection);
    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );

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

    nowTs = await getNowTs(testEnvironment.connection);
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    let timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    let unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 0);
    let locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 100);
    let balance = balanceOf(account, timelockAccount, nowTs);
    assert(balance.toNumber() === 100);

    nowTs = await getNowTs(testEnvironment.connection);
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(nowTs + commence),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      recipient.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );

    nowTs = await getNowTs(testEnvironment.connection);
    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey
    );

    unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
    assert(unlocked.toNumber() === 0);
    locked = lockedBalanceOf(account, timelockAccount, nowTs);
    assert(locked.toNumber() === 200);
    balance = balanceOf(account, timelockAccount, nowTs);
    assert(balance.toNumber() === 200);

    unlocked = unlockedBalanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(unlocked.toNumber() === 0);
    locked = lockedBalanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(locked.toNumber() === 100);
    balance = balanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(balance.toNumber() === 100);

    unlocked = unlockedBalanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(unlocked.toNumber() === 0);
    locked = lockedBalanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(locked.toNumber() === 100);
    balance = balanceOfTimelock(account, timelockAccount, 1, nowTs);
    assert(balance.toNumber() === 100);
  });
});
