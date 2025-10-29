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
  getOrCreateTimelockAccount,
  getTimelockAccount,
  uuidBytes,
  MAX_RELEASE_DELAY,
} from "./../helpers/tokenlock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getNowTs } from "../helpers/clock_helper";

describe("TokenLockup tokenlock discriminator tests", () => {
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

  it("initialize timelock with wrong tokenlock account", async () => {
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();
    const timelockPK1 = await getOrCreateTimelockAccount(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient1.publicKey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const timelockAccountPubkey = getTimelockAccount(
      tokenlockProgram.programId,
      timelockPK1,
      recipient2.publicKey
    );

    try {
      await tokenlockProgram.rpc.initializeTimelock({
        accounts: {
          tokenlockAccount: timelockPK1,
          timelockAccount: timelockAccountPubkey,
          authorityWalletRole: reserveAdminWalletRolePubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authority: reserveAdmin.publicKey,
          targetAccount: recipient2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [reserveAdmin],
      });
      assert.ok(false);
    } catch (error) {
      assert.equal(error.error.errorMessage, "Wrong tokenlock account.");
    }
  });

  it("create release schedule with wrong tokenlock account", async () => {
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();
    const timelockPK1 = await getOrCreateTimelockAccount(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient1.publicKey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      timelockPK1,
      recipient2.publicKey
    );

    const uuid = uuidBytes();
    const releaseCount = 2;
    const delayUntilFirstReleaseInSeconds = 60;
    const initialReleasePortionInBips = 1000;
    const periodBetweenReleasesInSeconds = 60;

    try {
      await tokenlockProgram.rpc.createReleaseSchedule(
        uuid,
        releaseCount,
        new anchor.BN(delayUntilFirstReleaseInSeconds),
        initialReleasePortionInBips,
        new anchor.BN(periodBetweenReleasesInSeconds),
        {
          accounts: {
            tokenlockAccount: timelockAccount,
            authority: reserveAdmin.publicKey,
            authorityWalletRole: reserveAdminWalletRolePubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
          },
          signers: [reserveAdmin],
        }
      );
    } catch (error) {
      assert.equal(error.error.errorMessage, "Wrong tokenlock account.");
    }
  });

  it("mint release schedule with wrong tokenlock account", async () => {
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();
    const timelockPK1 = await getOrCreateTimelockAccount(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient1.publicKey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      timelockPK1,
      recipient2.publicKey
    );

    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4);
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

    const timelockAccount1 = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      walletA.publicKey
    );
    let accInfo = await tokenlockProgram.provider.connection.getAccountInfo(
      timelockAccount1
    );

    if (accInfo === null) {
      await getOrCreateTimelockAccount(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    }

    const uuid = uuidBytes();
    const amount = 123456;
    const commencementTimestamp = await getNowTs(testEnvironment.connection);
    try {
      await tokenlockProgram.rpc.mintReleaseSchedule(
        uuid,
        new anchor.BN(amount),
        new anchor.BN(commencementTimestamp),
        scheduleId,
        [],
        {
          accounts: {
            tokenlockAccount: timelockAccount,
            timelockAccount: timelockAccount1,
            escrowAccountOwner: escrowOwnerPubkey,
            escrowAccount: escrowAccount,
            authorityWalletRole: reserveAdminWalletRolePubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            to: walletA.publicKey,
            authority: reserveAdmin.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            accessControlProgram:
              testEnvironment.accessControlHelper.program.programId,
          },
          signers: [reserveAdmin],
        }
      );
    } catch (error) {
      assert.equal(error.error.errorMessage, "A raw constraint was violated");
      assert.equal(error.error.errorCode.code, "ConstraintRaw");
      assert.equal(error.error.errorCode.number, 2003);
    }
  });

  it("transfer with wrong tokenlock account", async () => {
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();
    const timelockPK1 = await getOrCreateTimelockAccount(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient1.publicKey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      timelockPK1,
      recipient2.publicKey
    );

    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4);
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

    const timelockAccount1 = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      walletA.publicKey
    );
    let accInfo = await tokenlockProgram.provider.connection.getAccountInfo(
      timelockAccount1
    );

    if (accInfo === null) {
      await getOrCreateTimelockAccount(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    }

    const commencementTimestamp = -3600 * 24;
    const nowTs = await getNowTs(testEnvironment.connection);
    const timelockId = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100510),
      new anchor.BN(nowTs + commencementTimestamp),
      scheduleId,
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
    assert(timelockId === 0);

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
      walletA.publicKey,
      walletATokenAcc,
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
    const [securityAssociatedAccountFrom] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        walletATokenAcc
      );
    const [securityAssociatedAccountTo] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        walletBTokenAcc
      );
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        groupId,
        groupId
      );

    try {
      await tokenlockProgram.rpc.transfer(new anchor.BN(1000), {
        accounts: {
          tokenlockAccount: timelockAccount,
          timelockAccount: timelockAccount1,
          escrowAccount,
          pdaAccount: escrowOwnerPubkey,
          authority: walletA.publicKey,
          to: walletBTokenAcc,
          mintAddress: mintPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          transferRestrictionsProgram:
            testEnvironment.transferRestrictionsHelper.program.programId,
          authorityAccount: walletATokenAcc,
          securityAssociatedAccountFrom,
          securityAssociatedAccountTo,
          transferRule: transferRulePubkey,
        },
        signers: [walletA],
      });
    } catch (error) {
      assert.equal(error.error.errorMessage, "A raw constraint was violated");
      assert.equal(error.error.errorCode.code, "ConstraintRaw");
      assert.equal(error.error.errorCode.number, 2003);
    }
  });

  it("transfer timelock with wrong tokenlock account", async () => {
    const recipient1 = anchor.web3.Keypair.generate();
    const recipient2 = anchor.web3.Keypair.generate();
    const timelockPK1 = await getOrCreateTimelockAccount(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient1.publicKey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      reserveAdminWalletRolePubkey,
      reserveAdmin
    );
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      timelockPK1,
      recipient2.publicKey
    );

    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4);
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

    const timelockAccount1 = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      walletA.publicKey
    );
    let accInfo = await tokenlockProgram.provider.connection.getAccountInfo(
      timelockAccount1
    );

    if (accInfo === null) {
      await getOrCreateTimelockAccount(
        tokenlockProgram,
        tokenlockDataPubkey,
        walletA.publicKey,
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    }

    const commencementTimestamp = -3600 * 24;
    const nowTs = await getNowTs(testEnvironment.connection);
    const timelockId = await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100510),
      new anchor.BN(nowTs + commencementTimestamp),
      scheduleId,
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
    assert(timelockId === 0);
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
      walletA.publicKey,
      walletATokenAcc,
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
    const [securityAssociatedAccountFrom] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        walletATokenAcc
      );
    const [securityAssociatedAccountTo] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        walletBTokenAcc
      );
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        groupId,
        groupId
      );

    try {
      await tokenlockProgram.rpc.transferTimelock(
        new anchor.BN(1000),
        timelockId,
        {
          accounts: {
            tokenlockAccount: timelockAccount,
            timelockAccount: timelockAccount1,
            escrowAccount,
            pdaAccount: escrowOwnerPubkey,
            authority: walletA.publicKey,
            to: walletBTokenAcc,
            mintAddress: mintPubkey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            transferRestrictionsProgram:
              testEnvironment.transferRestrictionsHelper.program.programId,
            authorityAccount: walletATokenAcc,
            securityAssociatedAccountFrom,
            securityAssociatedAccountTo,
            transferRule: transferRulePubkey,
          },
          signers: [walletA],
        }
      );
    } catch (error) {
      assert.equal(error.error.errorMessage, "A raw constraint was violated");
      assert.equal(error.error.errorCode.code, "ConstraintRaw");
      assert.equal(error.error.errorCode.number, 2003);
    }
  });
});
