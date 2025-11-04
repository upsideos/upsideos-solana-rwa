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
  cancelTimelock,
  timelockCountOf,
  timelockOf,
  lockedBalanceOf,
  unlockedBalanceOf,
  balanceOfTimelock,
  MAX_RELEASE_DELAY,
} from "../helpers/tokenlock_helper";
import { getNowTs } from "../helpers/clock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";

describe("TokenLockup check cancelables", () => {
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
  let reserveAdminTokenAccountPubkey: anchor.web3.PublicKey;
  let transferAdminWalletRole: anchor.web3.PublicKey;
  const holderId = new anchor.BN(1);

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
    await topUpWallet(
      testEnvironment.connection,
      walletA.publicKey,
      solToLamports(1)
    );
    await topUpWallet(
      testEnvironment.connection,
      walletB.publicKey,
      solToLamports(1)
    );

    mintPubkey = testEnvironment.mintKeypair.publicKey;
    reserveAdmin = testEnvironment.reserveAdmin;
    [reserveAdminWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(reserveAdmin.publicKey);
    reserveAdminTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        reserveAdmin.publicKey
      );

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

    const groupId = new anchor.BN(0);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupId);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderId);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    [transferAdminWalletRole] =
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
      groupId,
      holderId,
      holderGroupPubkey,
      walletA.publicKey,
      walletATokenAcc,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupId,
      holderId,
      holderGroupPubkey,
      walletB.publicKey,
      walletBTokenAcc,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const tokenlockWalletTokenAcc =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        tokenlockWallet.publicKey,
        testEnvironment.contractAdmin
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupId,
      holderId,
      holderGroupPubkey,
      tokenlockWallet.publicKey,
      tokenlockWalletTokenAcc,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const nowTs = await getNowTs(testEnvironment.connection);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      new anchor.BN(nowTs),
      groupId,
      groupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
  });

  it("should emit an event with the correct scheduleId when the release schedule is minted and canceled", async () => {
    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockDataPubkey,
      2,
      new anchor.BN(fromDaysToSeconds(30)),
      5000,
      new anchor.BN(fromDaysToSeconds(30)),
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );

    const amount = 50;
    const commenced = 0;

    let cancelBy = [];
    for (let i = 0; i < 11; i++) {
      cancelBy.push(anchor.web3.Keypair.generate().publicKey);
    }

    const nowTs = await getNowTs(testEnvironment.connection);
    const result1 = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(amount),
      new anchor.BN(nowTs + commenced),
      Number(scheduleId),
      cancelBy,
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
    assert(result1.error?.toString() === "Max 10 cancelableBy addressees");

    cancelBy = [];
    cancelBy.push(walletA.publicKey);
    for (let i = 0; i < 9; i++) {
      cancelBy.push(anchor.web3.Keypair.generate().publicKey);
    }

    const { timelockId: timelockId2 } = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(amount),
      new anchor.BN(nowTs + commenced),
      Number(scheduleId),
      cancelBy,
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletA.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number | string };
    assert(timelockId2 === 0);

    const { timelockId: timelockId3 } = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(amount),
      new anchor.BN(nowTs + commenced),
      Number(scheduleId),
      [walletA.publicKey],
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      walletA.publicKey,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    ) as { timelockId: number | string };
    assert(timelockId3 === 1);

    const timelockCount = timelockCountOf(
      await getTimelockAccountData(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey
      )
    );
    assert(timelockCount === 2);

    let timelockId = await cancelTimelock(
      tokenlockProgram,
      0,
      tokenlockDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      walletA.publicKey,
      escrowOwnerPubkey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.transferRestrictionsHelper,
      reserveAdmin
    );
    assert(
      timelockId ===
        "Permission denied, address must be present in cancelableBy"
    );

    timelockId = await cancelTimelock(
      tokenlockProgram,
      0,
      tokenlockDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      walletA.publicKey,
      escrowOwnerPubkey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.transferRestrictionsHelper,
      walletA
    );
    assert(Number(timelockId) === 0);

    timelockId = await cancelTimelock(
      tokenlockProgram,
      0,
      tokenlockDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      walletA.publicKey,
      escrowOwnerPubkey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.transferRestrictionsHelper,
      walletA
    );
    assert(timelockId === "Timelock has no value left");

    timelockId = await cancelTimelock(
      tokenlockProgram,
      1,
      tokenlockDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      walletA.publicKey,
      escrowOwnerPubkey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.transferRestrictionsHelper,
      walletA
    );
    assert(Number(timelockId) === 1);
  });

  describe("Check cancel timelock after minting with multi cancelable addresses", () => {
    let cancelerList = [];
    let timelockId: number | string;

    beforeEach(async () => {
      cancelerList = [];
      cancelerList.push(walletA.publicKey);
      cancelerList.push(walletB.publicKey);
      cancelerList.push(tokenlockWallet.publicKey);
      const scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        2,
        new anchor.BN(fromDaysToSeconds(30)),
        5000,
        new anchor.BN(fromDaysToSeconds(30)),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
      assert(scheduleId === 0);

      const nowTs = await getNowTs(testEnvironment.connection);
      const result = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(50),
        new anchor.BN(nowTs),
        Number(scheduleId),
        cancelerList,
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number; signature: string };
      assert(result.timelockId === 0);
      timelockId = result.timelockId;
    });

    it("cancel with first canceler", async () => {
      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletA
      );
      assert(Number(tid) === timelockId);
    });

    it("cancel with second canceler", async () => {
      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletB
      );
      assert(tid === timelockId);
    });

    it("cancel with third canceler", async () => {
      await topUpWallet(
        testEnvironment.connection,
        tokenlockWallet.publicKey,
        solToLamports(1)
      );
      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        tokenlockWallet
      );
      assert(tid === timelockId);
    });

    it("cancel with non canceler reverts", async () => {
      const canceler = anchor.web3.Keypair.generate();
      await topUpWallet(
        testEnvironment.connection,
        canceler.publicKey,
        solToLamports(1)
      );
      const cancelerTokenAcc =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          canceler.publicKey,
          testEnvironment.contractAdmin
        );
      const groupId = new anchor.BN(0);
      const [groupPubkey] =
        testEnvironment.transferRestrictionsHelper.groupPDA(groupId);
      const [holderPubkey] =
        testEnvironment.transferRestrictionsHelper.holderPDA(holderId);
      const [holderGroupPubkey] =
        testEnvironment.transferRestrictionsHelper.holderGroupPDA(
          holderPubkey,
          groupId
        );
      await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
        groupId,
        holderId,
        holderGroupPubkey,
        canceler.publicKey,
        cancelerTokenAcc,
        transferAdminWalletRole,
        testEnvironment.transferAdmin
      );

      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        canceler
      );
      assert(
        tid === "Permission denied, address must be present in cancelableBy"
      );
    });

    it("timelock index not change after canceling", async () => {
      const timelock = timelockOf(
        await getTimelockAccountData(
          tokenlockProgram,
          tokenlockDataPubkey,
          walletA.publicKey
        ),
        Number(timelockId)
      );
      const timelockCount = timelockCountOf(
        await getTimelockAccountData(
          tokenlockProgram,
          tokenlockDataPubkey,
          walletA.publicKey
        )
      );
      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletA
      );
      assert(tid === timelockId);

      const timelock1 = timelockOf(
        await getTimelockAccountData(
          tokenlockProgram,
          tokenlockDataPubkey,
          walletA.publicKey
        ),
        Number(timelockId)
      );
      const timelockCount1 = timelockCountOf(
        await getTimelockAccountData(
          tokenlockProgram,
          tokenlockDataPubkey,
          walletA.publicKey
        )
      );
      assert(timelockCount === timelockCount1);

      assert(timelock.schedule_id === timelock1.schedule_id);
      assert(
        timelock.commencement_timestamp === timelock1.commencement_timestamp
      );
      assert(timelock.total_amount === timelock1.total_amount);
    });
  });

  describe("simple 1 month delay then 50% for 2 monthly releases", () => {
    let scheduleId;

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        2,
        new anchor.BN(fromDaysToSeconds(30)),
        5000,
        new anchor.BN(fromDaysToSeconds(30)),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
      assert(scheduleId === 0);
    });

    it("should be able to check if the lockup is cancelable", async () => {
      const nowTs = await getNowTs(testEnvironment.connection);
      const { timelockId: timelockId1 } = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(100),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [walletA.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number | string };
      assert(timelockId1 === 0);

      const timelockData = await getTimelockAccountData(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey
      );
      const timelock = timelockOf(timelockData, timelockId1);
      assert(timelock.cancelableByCount === 1);
      assert(
        timelockData.cancelables[timelock.cancelableBy[0]].toBase58() ===
          walletA.publicKey.toBase58()
      );
    });

    it("0% unlocked at start and 100% cancelable", async () => {
      let nowTs = await getNowTs(testEnvironment.connection);
      const { timelockId } = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(100),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [walletA.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number | string };
      assert(timelockId === 0);

      nowTs = await getNowTs(testEnvironment.connection);
      let account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      let timelockAccount = await getTimelockAccountData(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey
      );
      let locked = lockedBalanceOf(account, timelockAccount, nowTs);
      assert(locked.toNumber() === 100);

      let unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
      assert(unlocked.toNumber() === 0);

      let balance = balanceOfTimelock(
        account,
        timelockAccount,
        timelockId,
        nowTs
      );
      assert(balance.toNumber() === 100);

      const balanceEscrow = (
        await testEnvironment.mintHelper.getAccount(escrowAccount)
      ).amount;
      const balanceCancelar = (
        await testEnvironment.mintHelper.getAccount(
          reserveAdminTokenAccountPubkey
        )
      ).amount;
      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletA
      );
      assert(Number(tid) === timelockId);

      const balanceEscrowAfterCancelation = (
        await testEnvironment.mintHelper.getAccount(escrowAccount)
      ).amount;
      const balanceCancelarAfterCancelation = (
        await testEnvironment.mintHelper.getAccount(
          reserveAdminTokenAccountPubkey
        )
      ).amount;

      assert(balanceCancelar + BigInt(100) === balanceCancelarAfterCancelation);
      assert(balanceEscrow - BigInt(100) === balanceEscrowAfterCancelation);

      nowTs = await getNowTs(testEnvironment.connection);
      account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      timelockAccount = await getTimelockAccountData(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey
      );

      locked = lockedBalanceOf(account, timelockAccount, nowTs);
      assert(locked.toNumber() === 0);

      unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
      assert(unlocked.toNumber() === 0);

      balance = balanceOfTimelock(account, timelockAccount, timelockId, nowTs);
      assert(balance.toNumber() === 0);
    });

    it("only canceler can cancel", async () => {
      const nowTs = await getNowTs(testEnvironment.connection);
      const { timelockId } = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(100),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [walletA.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number | string };
      assert(timelockId === 0);

      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletB
      );
      assert(
        tid === "Permission denied, address must be present in cancelableBy"
      );
    });

    it("cannot cancel a non existent timelock", async () => {
      let nowTs = await getNowTs(testEnvironment.connection);
      const { timelockId } = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(100),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [walletA.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number | string };
      assert(timelockId === 0);

      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId + 1),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletA
      );
      assert(tid === "Invalid timelock id");

      nowTs = await getNowTs(testEnvironment.connection);
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const timelockAccount = await getTimelockAccountData(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey
      );

      const locked = lockedBalanceOf(account, timelockAccount, nowTs);
      assert(locked.toNumber() === 100);
      const unlocked = unlockedBalanceOf(account, timelockAccount, nowTs);
      assert(unlocked.toNumber() === 0);
      const balance = balanceOfTimelock(
        account,
        timelockAccount,
        timelockId,
        nowTs
      );
      assert(balance.toNumber() === 100);
    });

    it("only canceler of timelock can cancel", async () => {
      const nowTs = await getNowTs(testEnvironment.connection);
      const cancelarWallet = anchor.web3.Keypair.generate();
      let { timelockId } = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(100),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [walletB.publicKey], // cancelar of 0-timelock
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number | string };
      assert(timelockId === 0);

      let { timelockId: timelockId2 } = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(100),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [cancelarWallet.publicKey], // cancelar of 1-timelock
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletA.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      ) as { timelockId: number | string };
      assert(timelockId2 === 1);

      const tid = await cancelTimelock(
        tokenlockProgram,
        Number(timelockId2),
        tokenlockDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        walletA.publicKey,
        escrowOwnerPubkey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.transferRestrictionsHelper,
        walletB
      );
      assert(
        tid === "Permission denied, address must be present in cancelableBy"
      );
    });
  });
});
