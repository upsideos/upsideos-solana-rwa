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
  getTimelockAccount,
  initializeTokenlock,
  unlockedBalanceOf,
  withdraw,
  MAX_RELEASE_DELAY,
} from "./../helpers/tokenlock_helper";
import { getNowTs } from "./../helpers/clock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";

describe("TokenLockup stress test", () => {
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

  let mintPubkey;
  let reserveAdmin;
  let walletB;
  let escrowAccount;
  let escrowOwnerPubkey;
  let walletC;
  let tokenlockDataPubkey;
  let reserveAdminWalletRolePubkey;

  beforeEach(async () => {
    try {
      testEnvironment = new TestEnvironment(testEnvironmentParams);
      await testEnvironment.setupAccessControl();
      await testEnvironment.setupTransferRestrictions();
      await testEnvironment.mintToReserveAdmin();

      walletB = Keypair.generate();
      walletC = Keypair.generate();

      mintPubkey = testEnvironment.mintKeypair.publicKey;
      reserveAdmin = testEnvironment.reserveAdmin;
      [reserveAdminWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(
          reserveAdmin.publicKey
        );

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
        testEnvironment.transferRestrictionsHelper
          .transferRestrictionDataPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.contractAdmin
      );
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0],
        testEnvironment.contractAdmin
      );
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        testEnvironment.contractAdmin
      );
    } catch (error) {
      console.log("error=", error);
      throw error;
    }
  });

  it("200 create Schedule", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days

    for (let i = 0; i < 200; i++) {
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

      console.log("create schedule=", i);
      assert(scheduleId === i);
    }
  });

  it("100 mint release Schedule", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days
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
    console.log("scheduleId=", scheduleId);
    assert(scheduleId === 0);

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );

    let nowTs = await getNowTs(testEnvironment.connection);
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const timelockId = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletB.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("created timelock=", i);
      assert(timelockId === i);
    }

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < iterations; i++) {
      const timelockId = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletC.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("2nd created timelock=", i);
      assert(timelockId === i);
    }

    await topUpWallet(
      testEnvironment.connection,
      walletC.publicKey,
      solToLamports(1)
    );

    const tsNow = await getNowTs(testEnvironment.connection);
    let tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      walletC.publicKey
    );
    let timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    const walletCTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        walletC.publicKey,
        reserveAdmin
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
      walletC.publicKey,
      walletCTokenAccount,
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

    const transferAmount = new anchor.BN(unlockedBalance);
    const withdrawTxSignature = await withdraw(
      testEnvironment.connection,
      transferAmount,
      tokenlockProgram,
      testEnvironment.transferRestrictionsHelper.program.programId,
      testEnvironment.mintKeypair.publicKey,
      tokenlockDataPubkey,
      timelockAccount,
      escrowOwnerPubkey,
      walletCTokenAccount,
      testEnvironment.transferRestrictionsHelper,
      walletC
    );
    console.log("Transfer Transaction Signature", withdrawTxSignature);
    tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    assert.equal(
      0,
      unlockedBalanceOf(tokenlockData, timelockData, tsNow).toNumber()
    );

    const walletCTokenAccountData = await testEnvironment.mintHelper.getAccount(
      walletCTokenAccount
    );
    assert.equal(
      transferAmount.toString(),
      walletCTokenAccountData.amount.toString()
    );
  });

  it("100 mints release Schedule for different recipients", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days
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
    console.log("scheduleId=", scheduleId);
    assert(scheduleId === 0);

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    let nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < 100; i++) {
      const timelockId = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletB.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("created timelock=", i);
      assert(timelockId === i);
    }

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < 100; i++) {
      const timelockId = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        walletC.publicKey,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("2nd created timelock=", i);
      assert(timelockId === i);
    }
  });
});
