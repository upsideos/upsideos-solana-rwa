import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair } from "@solana/web3.js";

import { Tokenlock } from "../../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "./../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "./../utils";
import {
  createReleaseSchedule,
  mintReleaseSchedule,
  initializeTokenlock,
  getTokenlockAccount,
  getTimelockAccountData,
  getScheduleCount,
  cancelTimelock,
  MAX_RELEASE_DELAY,
} from "./../helpers/tokenlock_helper";
import { getNowTs } from "../helpers/clock_helper";

describe("TokenLockup create release schedule", () => {
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
  let walletATokenAcc: anchor.web3.PublicKey;
  let walletB: anchor.web3.Keypair;
  let walletBTokenAcc: anchor.web3.PublicKey;
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

    walletA = Keypair.generate();
    walletB = Keypair.generate();
    walletATokenAcc =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        walletA.publicKey,
        testEnvironment.contractAdmin
      );
    walletBTokenAcc =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        walletB.publicKey,
        testEnvironment.contractAdmin
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

  it("increments the schedulerCount", async () => {
    await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(0),
      1,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    let account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );

    let scheduleCnt = getScheduleCount(account);
    assert(scheduleCnt === 1);

    await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(0),
      1,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    account = await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey);
    scheduleCnt = getScheduleCount(account);
    assert(scheduleCnt === 2);
  });

  it("should be able to check if the lockup is cancelable", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(0),
      1,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const scheduleCnt = getScheduleCount(
      await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey)
    );
    assert(scheduleCnt === 1);

    const nowTs = await getNowTs(testEnvironment.connection);
    const result = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(10000),
      new anchor.BN(nowTs + 100),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletB.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number; signature: string };
    assert(result.timelockId !== undefined);

    const timelockAccountData = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      walletB.publicKey
    );
    let timelock = null;
    if (result.timelockId < timelockAccountData.timelocks.length) {
      timelock = timelockAccountData.timelocks[result.timelockId];
    }
    assert(timelock != null && timelock.cancelableByCount === 0);
  });

  it("mint authority cannot cancel a non existent timelock", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(0),
      1,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const scheduleCount = getScheduleCount(
      await getTokenlockAccount(tokenlockProgram, tokenlockDataPubkey)
    );
    assert(scheduleCount === 1);

    const nowTs = await getNowTs(testEnvironment.connection);
    const { timelockId } = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(10000),
      new anchor.BN(nowTs + 100),
      Number(scheduleId),
      [],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletB.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number };

    const reserveAdminTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        reserveAdmin.publicKey
      );
    const groupId = new anchor.BN(0);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupId);
    const holderId = new anchor.BN(1);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderId);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );

    const [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      walletB.publicKey,
      walletBTokenAcc,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      new anchor.BN(nowTs),
      groupId,
      groupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    const res = await cancelTimelock(
      tokenlockProgram,
      Number(timelockId),
      tokenlockDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      walletB.publicKey,
      escrowOwnerPubkey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.transferRestrictionsHelper,
      reserveAdmin
    );
    assert(
      res === "Permission denied, address must be present in cancelableBy"
    );
  });

  it("must have at least 1 release", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      0,
      new anchor.BN(1),
      1,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    assert(scheduleId === "Release count less than 1");
  });

  it("if there is one release it must release all tokens", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      1,
      new anchor.BN(0),
      1,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    assert(scheduleId === "Init release portion must be 100%");
  });

  it("initial release amount cannot exceed 100% (100 00 bips)", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      1,
      new anchor.BN(0),
      10001,
      new anchor.BN(1),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    assert(scheduleId === "Init release portion bigger than 100%");
  });

  it("must have a period duration of at least 1 second", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(2),
      5000,
      new anchor.BN(0),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    assert(scheduleId === "Release period is zero");
  });

  it("cannot vest all for multiple releases", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(2),
      10000,
      new anchor.BN(10),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    assert(scheduleId === "Cannot vest all for multiple releases");
  });
});
