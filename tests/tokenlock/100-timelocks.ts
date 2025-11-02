import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import { Tokenlock } from "../../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "./../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet, getTransactionComputeUnits } from "./../utils";
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

    // Track compute units for each mint
    const computeUnitsUsed: number[] = [];

    // Mint first timelock with 4 initial cancelables
    const firstCancelables = [
      cancelableWallets[0].publicKey,
      cancelableWallets[1].publicKey,
      cancelableWallets[2].publicKey,
      cancelableWallets[3].publicKey,
    ];
    const firstResult = await mintReleaseSchedule(
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
      testEnvironment.accessControlHelper.program.programId,
      true // return signature
    ) as { timelockId: number | string; signature: string };
    
    assert.equal(firstResult.timelockId, 0);
    timelockCancelables.push([...firstCancelables]);

    // Get compute units for first mint
    try {
      const computeUnits = await getTransactionComputeUnits(
        testEnvironment.connection,
        firstResult.signature
      );
      computeUnitsUsed.push(computeUnits);
    } catch (error) {
      console.warn(`Failed to get compute units for mint 1:`, error);
    }

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

      const result = await mintReleaseSchedule(
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
        testEnvironment.accessControlHelper.program.programId,
        true // return signature
      ) as { timelockId: number | string; signature: string };
      
      assert.equal(result.timelockId, i);
      timelockCancelables.push([...cancelableBy]);

      // Get compute units for this mint
      try {
        const computeUnits = await getTransactionComputeUnits(
          testEnvironment.connection,
          result.signature
        );
        computeUnitsUsed.push(computeUnits);
      } catch (error) {
        console.warn(`Failed to get compute units for mint ${i + 1}:`, error);
      }
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
      `✅ Validation complete: ${iterations} timelocks with ${timelockData.cancelables.length} unique cancelables`
    );

    // Compute units statistics
    if (computeUnitsUsed.length > 0) {
      const minComputeUnits = Math.min(...computeUnitsUsed);
      const maxComputeUnits = Math.max(...computeUnitsUsed);
      const avgComputeUnits = Math.round(
        computeUnitsUsed.reduce((a, b) => a + b, 0) / computeUnitsUsed.length
      );
      const firstMintComputeUnits = computeUnitsUsed[0];
      const subsequentAvgComputeUnits = computeUnitsUsed.length > 1
        ? Math.round(
            computeUnitsUsed.slice(1).reduce((a, b) => a + b, 0) / (computeUnitsUsed.length - 1)
          )
        : 0;
      
      console.log(`\n📊 Compute Units Statistics:`);
      console.log(`   First mint: ${firstMintComputeUnits.toLocaleString()} CU`);
      console.log(`   Subsequent mints avg: ${subsequentAvgComputeUnits.toLocaleString()} CU`);
      console.log(`   Overall min: ${minComputeUnits.toLocaleString()} CU`);
      console.log(`   Overall max: ${maxComputeUnits.toLocaleString()} CU`);
      console.log(`   Overall avg: ${avgComputeUnits.toLocaleString()} CU`);
      if (subsequentAvgComputeUnits > 0) {
        console.log(`   First mint overhead: ${(firstMintComputeUnits - subsequentAvgComputeUnits).toLocaleString()} CU`);
      }
    }
  });

  it("Mint 100 release schedules with same 10 cancelables - verify space reuse", async () => {
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

    // Generate 10 cancelable wallets that will be reused for all mints
    const cancelableWallets: Keypair[] = [];
    for (let i = 0; i < 10; i++) {
      cancelableWallets.push(Keypair.generate());
    }
    const sameCancelables = cancelableWallets.map((w) => w.publicKey);

    const targetWallet = walletB.publicKey;
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      targetWallet
    );

    // Constants from the Rust code
    const PUBKEY_BYTES = 32;
    const TIMELOCK_DEFAULT_SIZE = 57; // 2 + 8 + 8 + 8 + 1 + 10 + 20
    const VEC_LEN_SIZE = 4;
    const HEADERS_LEN = 8 + PUBKEY_BYTES + PUBKEY_BYTES; // discriminator + tokenlock_account + target_account

    // Track account sizes after each mint
    const accountSizes: number[] = [];

    // Get initial account size (should be null or 0 if not initialized)
    let accInfo = await testEnvironment.connection.getAccountInfo(
      timelockAccount
    );
    let initialSize = accInfo ? accInfo.data.length : 0;
    const emptyAccountSize = HEADERS_LEN + VEC_LEN_SIZE * 2; // Size of initialized empty account
    console.log(`Initial account size: ${initialSize} bytes (empty account would be ${emptyAccountSize} bytes)`);

    // Calculate expected size after first mint (10 cancelables + 1 timelock)
    const expectedFirstMintSize =
      HEADERS_LEN +
      VEC_LEN_SIZE * 2 +
      10 * PUBKEY_BYTES +
      1 * TIMELOCK_DEFAULT_SIZE;

    // Track compute units for each mint
    const computeUnitsUsed: number[] = [];

    // Mint 100 timelocks with the same 10 cancelables
    for (let i = 0; i < 100; i++) {
      const result = await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        sameCancelables,
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        targetWallet,
        reserveAdmin,
        reserveAdminWalletRolePubkey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId,
        true // return signature
      ) as { timelockId: number | string; signature: string };
      
      assert.equal(result.timelockId, i, `Expected timelock ID ${i}, got ${result.timelockId}`);

      // Get compute units used for this transaction
      try {
        const computeUnits = await getTransactionComputeUnits(
          testEnvironment.connection,
          result.signature
        );
        computeUnitsUsed.push(computeUnits);
      } catch (error) {
        console.warn(`Failed to get compute units for mint ${i + 1}:`, error);
      }

      // Get account size after mint
      accInfo = await testEnvironment.connection.getAccountInfo(timelockAccount);
      if (!accInfo) {
        throw new Error(`Account should exist after mint ${i + 1}`);
      }
      const currentSize = accInfo.data.length;
      accountSizes.push(currentSize);

      if (i === 0) {
        // First mint: should have 10 cancelables + 1 timelock
        assert.equal(
          currentSize,
          expectedFirstMintSize,
          `First mint: Expected size ${expectedFirstMintSize}, got ${currentSize}`
        );
        console.log(`After 1st mint: ${currentSize} bytes (expected: ${expectedFirstMintSize})`);
      } else {
        // Subsequent mints: should only increase by TIMELOCK_DEFAULT_SIZE (57 bytes)
        // since cancelables are reused
        const expectedSize =
          expectedFirstMintSize + i * TIMELOCK_DEFAULT_SIZE;
        assert.equal(
          currentSize,
          expectedSize,
          `After mint ${i + 1}: Expected size ${expectedSize}, got ${currentSize}`
        );

        // Verify the increase is exactly TIMELOCK_DEFAULT_SIZE
        const sizeIncrease = currentSize - accountSizes[i - 1];
        assert.equal(
          sizeIncrease,
          TIMELOCK_DEFAULT_SIZE,
          `After mint ${i + 1}: Size increased by ${sizeIncrease} bytes, expected ${TIMELOCK_DEFAULT_SIZE}`
        );
      }
    }

    // Final validation: verify timelock data
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );

    // Should have exactly 100 timelocks
    assert.equal(
      timelockData.timelocks.length,
      100,
      `Expected 100 timelocks, got ${timelockData.timelocks.length}`
    );

    // Should have exactly 10 cancelables (all reused)
    assert.equal(
      timelockData.cancelables.length,
      10,
      `Expected 10 unique cancelables, got ${timelockData.cancelables.length}`
    );

    // Verify all cancelables are the same as input
    for (let i = 0; i < 10; i++) {
      assert.equal(
        timelockData.cancelables[i].toBase58(),
        sameCancelables[i].toBase58(),
        `Cancelable ${i} mismatch`
      );
    }

    // Verify final account size
    const finalExpectedSize =
      expectedFirstMintSize + 99 * TIMELOCK_DEFAULT_SIZE;
    assert.equal(
      accountSizes[99],
      finalExpectedSize,
      `Final size: Expected ${finalExpectedSize}, got ${accountSizes[99]}`
    );

    console.log(
      `✅ Validation complete: 100 timelocks with ${timelockData.cancelables.length} unique cancelables`
    );
    console.log(
      `✅ Account size: ${accountSizes[99]} bytes (started at ${initialSize}, increased by ${accountSizes[99] - initialSize})`
    );
    console.log(
      `✅ Each mint after the first increased size by exactly ${TIMELOCK_DEFAULT_SIZE} bytes (timelock size only)`
    );
    
    // Compute units statistics
    if (computeUnitsUsed.length > 0) {
      const minComputeUnits = Math.min(...computeUnitsUsed);
      const maxComputeUnits = Math.max(...computeUnitsUsed);
      const avgComputeUnits = Math.round(
        computeUnitsUsed.reduce((a, b) => a + b, 0) / computeUnitsUsed.length
      );
      const firstMintComputeUnits = computeUnitsUsed[0];
      const subsequentAvgComputeUnits = computeUnitsUsed.length > 1
        ? Math.round(
            computeUnitsUsed.slice(1).reduce((a, b) => a + b, 0) / (computeUnitsUsed.length - 1)
          )
        : 0;
      
      console.log(`\n📊 Compute Units Statistics:`);
      console.log(`   First mint: ${firstMintComputeUnits.toLocaleString()} CU`);
      console.log(`   Subsequent mints avg: ${subsequentAvgComputeUnits.toLocaleString()} CU`);
      console.log(`   Overall min: ${minComputeUnits.toLocaleString()} CU`);
      console.log(`   Overall max: ${maxComputeUnits.toLocaleString()} CU`);
      console.log(`   Overall avg: ${avgComputeUnits.toLocaleString()} CU`);
      console.log(`   First mint overhead: ${(firstMintComputeUnits - subsequentAvgComputeUnits).toLocaleString()} CU`);
    }
  });
});
