import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

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

      const txSignature =
        await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
          escrowAccount,
          tokenlockDataPubkey,
          testEnvironment.accessControlHelper.walletRolePDA(
            testEnvironment.contractAdmin.publicKey
          )[0],
          testEnvironment.contractAdmin
        );
      console.log(
        "Set escrow account into transfer restriction data tx:",
        txSignature
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

  it("200 mint release Schedule", async () => {
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
    const iterations = 2;
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

  it("Mint release Schedule with cancelables validation", async () => {
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
      10_000_000_000 // Enough for 100 mints
    );
    let nowTs = await getNowTs(testEnvironment.connection);

    // Generate cancelable wallets: 100 timelocks * 3 new each + initial 4 = ~304 wallets
    const cancelableWallets: Keypair[] = [];
    for (let i = 0; i < 310; i++) {
      cancelableWallets.push(Keypair.generate());
    }

    const targetWallet = walletB.publicKey;
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      targetWallet
    );

    // Track cancelables used in each timelock for validation
    const timelockCancelables: PublicKey[][] = [];

    // Mint first timelock with 4 initial cancelables
    const firstCancelables = [
      cancelableWallets[0].publicKey,
      cancelableWallets[1].publicKey,
      cancelableWallets[2].publicKey,
      cancelableWallets[3].publicKey,
    ];
    let timelockId = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(490),
      new anchor.BN(nowTs + commence),
      scheduleId,
      firstCancelables,
      tokenlockDataPubkey,
      escrowAccount,
      escrowOwnerPubkey,
      targetWallet,
      reserveAdmin,
      reserveAdminWalletRolePubkey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.program.programId
    );
    assert(timelockId === 0);
    timelockCancelables.push([...firstCancelables]);

    // Mint remaining 99 timelocks
    // Each timelock uses: 2 new cancelables, 1 reused from previous (at index 1), 1 new
    // So the pattern is: [new1, new2, reused_prev[1], new3]
    let cancelableIndex = 4; // Start from index 4 for new cancelables
    const iterations = Math.floor(256 / (cancelableIndex-1)) - 1;
    for (let i = 1; i < iterations; i++) {
      // Get the cancelable at index 1 from previous timelock
      const reusedCancelable = timelockCancelables[i - 1][1];

      // Create cancelable_by array: [new1, new2, reused, new3]
      const cancelableBy = [
        cancelableWallets[cancelableIndex].publicKey,
        cancelableWallets[cancelableIndex + 1].publicKey,
        reusedCancelable, // Reused from previous timelock's position 1, now at position 2
        cancelableWallets[cancelableIndex + 2].publicKey,
      ];
      cancelableIndex += 3;

      timelockId = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        cancelableBy,
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        targetWallet,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      assert(timelockId === i);
      timelockCancelables.push([...cancelableBy]);
    }

    // Validate timelock data
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );

    // Validate total timelocks
    assert.equal(timelockData.timelocks.length, iterations);

    // Validate cancelables array contains all unique cancelables
    const expectedUniqueCancelables = new Set<string>();
    for (const cancelables of timelockCancelables) {
      for (const cancelable of cancelables) {
        expectedUniqueCancelables.add(cancelable.toBase58());
      }
    }
    const actualCancelables = new Set<string>();
    for (const cancelable of timelockData.cancelables) {
      actualCancelables.add(cancelable.toBase58());
    }

    // Validate each timelock's cancelableBy references are correct
    for (let i = 0; i < timelockData.timelocks.length; i++) {
      const timelock = timelockData.timelocks[i];
      const expectedCancelables = timelockCancelables[i];

      // Validate cancelableByCount
      assert.equal(
        timelock.cancelableByCount,
        expectedCancelables.length,
        `Timelock ${i}: cancelableByCount mismatch`
      );

      // Validate each cancelable reference
      for (let j = 0; j < timelock.cancelableByCount; j++) {
        const cancelableIndex = timelock.cancelableBy[j];
        const actualCancelable =
          timelockData.cancelables[cancelableIndex].toBase58();
        const expectedCancelable = expectedCancelables[j].toBase58();

        assert.equal(
          actualCancelable,
          expectedCancelable,
          `Timelock ${i}, cancelable position ${j}: mismatch. Expected ${expectedCancelable}, got ${actualCancelable}`
        );
      }

      // Special validation: for timelocks after the first, check that the reused cancelable
      // is at position 2 (index 2) in the new array
      if (i > 0) {
        const reusedCancelable = timelockCancelables[i - 1][1];
        const reusedIndex = timelockCancelables[i].indexOf(reusedCancelable);
        assert.equal(
          reusedIndex,
          2,
          `Timelock ${i}: reused cancelable should be at position 2 (index 2), but found at ${reusedIndex}`
        );
      }
    }

    // Validate that cancelables array contains all expected cancelables
    assert.equal(
      actualCancelables.size,
      expectedUniqueCancelables.size,
      "Cancelables array size mismatch"
    );

    for (const expectedCancelable of expectedUniqueCancelables) {
      assert(
        actualCancelables.has(expectedCancelable),
        `Cancelable ${expectedCancelable} missing from timelock data`
      );
    }

    console.log(
      `Validation complete: 100 timelocks with ${timelockData.cancelables.length} unique cancelables`
    );
  });
});
