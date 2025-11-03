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
  MAX_RELEASE_DELAY,
  getTokenlockAccount,
  getTimelockAccountData,
  balanceOfTimelock,
} from "./../helpers/tokenlock_helper";
import { getNowTs } from "./../helpers/clock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Transfer Negative cases", async () => {
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

  let walletPretender: anchor.web3.Keypair;
  let walletPretenderAcc: anchor.web3.PublicKey;

  const releaseCount = 2;
  const firstDelay = 0;
  const firstBatchBips = 5000;
  const commence = 0;
  const initialBalance = 100;
  const periodBetweenReleases = fromDaysToSeconds(4);
  const group0 = new anchor.BN(0);
  let holderId: anchor.BN;
  let walletsAdminWalletRole: anchor.web3.PublicKey;
  let groupPubkey: anchor.web3.PublicKey;
  let holderPubkey: anchor.web3.PublicKey;
  let holderGroupPubkey: anchor.web3.PublicKey;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    walletA = Keypair.generate();
    walletB = Keypair.generate();
    walletPretender = Keypair.generate();
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
    walletPretenderAcc =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        walletPretender.publicKey,
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
    await topUpWallet(
      testEnvironment.connection,
      walletPretender.publicKey,
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

    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(commence),
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
    await mintReleaseSchedule(
      testEnvironment.connection,
      tokenlockProgram,
      new anchor.BN(100),
      new anchor.BN(commence),
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

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    holderId = transferRestrictionData.holderIds;
    [walletsAdminWalletRole] =
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
    [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(group0);
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderId);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        group0
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      walletA.publicKey,
      walletATokenAcc,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      walletB.publicKey,
      walletBTokenAcc,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
  });

  it("Injection of original Wallet with Linked Account and pretend to be a signer", async () => {
    const balanceEscrow = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;

    let timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      walletA.publicKey
    );
    const accInfo = await tokenlockProgram.provider.connection.getAccountInfo(
      timelockAccount
    );
    assert(accInfo !== null);

    const amount = 51;
    const walletPretenderBalanceBeforeTransfer = (
      await testEnvironment.mintHelper.getAccount(walletPretenderAcc)
    ).amount;
    const authorityAccount =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(walletA.publicKey);
    const securityAssociatedAccountFrom =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        authorityAccount
      )[0];
    const securityAssociatedAccountTo =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        walletATokenAcc
      )[0];
    const secAssocAccountFromData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountFrom
      );
    const secAssocAccountToData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountTo
      );
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        secAssocAccountFromData.group,
        secAssocAccountToData.group
      );
    try {
      await tokenlockProgram.rpc.transfer(new anchor.BN(amount), {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount,
          escrowAccount: escrowAccount,
          pdaAccount: escrowOwnerPubkey,
          authority: walletA.publicKey,
          to: walletATokenAcc,
          mintAddress: testEnvironment.mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          transferRestrictionsProgram:
            testEnvironment.transferRestrictionsHelper.program.programId,
          authorityAccount,
          securityAssociatedAccountFrom,
          securityAssociatedAccountTo,
          transferRule: transferRulePubkey,
        },
        signers: [walletPretender],
      });
    } catch (e) {
      assert(
        e.toString() ===
          `Error: unknown signer: ${walletPretender.publicKey.toBase58()}`
      );
    }
    const walletPretenderBalanceAfterTransfer = (
      await testEnvironment.mintHelper.getAccount(walletPretenderAcc)
    ).amount;
    assert(
      walletPretenderBalanceBeforeTransfer ===
        walletPretenderBalanceAfterTransfer
    );

    const balanceEscrowAfterTransfer = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;
    assert(balanceEscrow === balanceEscrowAfterTransfer);

    const nowTs = await getNowTs(testEnvironment.connection);
    const account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );
    timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      walletA.publicKey
    );

    const balance = balanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(balance.toNumber() === initialBalance);
  });

  it("Injection of Any Wallet with Linked Account and pretend to be a signer", async () => {
    const balanceEscrow = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;

    let timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      walletA.publicKey
    );
    const accInfo = await tokenlockProgram.provider.connection.getAccountInfo(
      timelockAccount
    );
    assert(accInfo !== null);

    const amount = 51;
    const walletPretenderBalanceBeforeTransfer = (
      await testEnvironment.mintHelper.getAccount(walletPretenderAcc)
    ).amount;
    const authorityAccount =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(walletA.publicKey);
    const securityAssociatedAccountFrom =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        authorityAccount
      )[0];
    const securityAssociatedAccountTo =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        walletATokenAcc
      )[0];
    const secAssocAccountFromData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountFrom
      );
    const secAssocAccountToData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountTo
      );
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        secAssocAccountFromData.group,
        secAssocAccountToData.group
      );
    try {
      await tokenlockProgram.rpc.transfer(new anchor.BN(amount), {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount,
          escrowAccount: escrowAccount,
          pdaAccount: escrowOwnerPubkey,
          authority: walletA.publicKey,
          to: walletPretenderAcc, // is not original wallet passed here
          mintAddress: testEnvironment.mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          transferRestrictionsProgram:
            testEnvironment.transferRestrictionsHelper.program.programId,
          authorityAccount,
          securityAssociatedAccountFrom,
          securityAssociatedAccountTo,
          transferRule: transferRulePubkey,
        },
        signers: [walletPretender],
      });
    } catch (e) {
      assert(
        e.toString() ===
          `Error: unknown signer: ${walletPretender.publicKey.toBase58()}`
      );
    }
    const walletPretenderBalanceAfterTransfer = (
      await testEnvironment.mintHelper.getAccount(walletPretenderAcc)
    ).amount;
    assert(
      walletPretenderBalanceBeforeTransfer ===
        walletPretenderBalanceAfterTransfer
    );

    const balanceEscrowAfterTransfer = (
      await testEnvironment.mintHelper.getAccount(escrowAccount)
    ).amount;
    assert(balanceEscrow === balanceEscrowAfterTransfer);

    const nowTs = await getNowTs(testEnvironment.connection);
    const account = await getTokenlockAccount(
      tokenlockProgram,
      tokenlockDataPubkey
    );
    timelockAccount = await getTimelockAccountData(
      tokenlockProgram,
      tokenlockDataPubkey,
      walletA.publicKey
    );

    const balance = balanceOfTimelock(account, timelockAccount, 0, nowTs);
    assert(balance.toNumber() === initialBalance);
  });
});
