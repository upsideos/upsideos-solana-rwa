import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getMetadataPointerState,
  getTokenMetadata,
  getTransferHook,
  addExtraAccountMetasForExecute,
} from "@solana/spl-token";
import { assert } from "chai";
import {
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

import { Roles } from "./helpers/access-control_helper";
import { Tokenlock } from "../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "./helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "./utils";
import {
  BIPS_PRECISION,
  calcSignerHash,
  cancelTimelock,
  getTimelockAccount,
  initializeTokenlock,
  lockedBalanceOf,
  MAX_RELEASE_DELAY,
  unlockedBalanceOf,
  uuidBytes,
} from "./helpers/tokenlock_helper";
import { getNowTs } from "./helpers/clock_helper";

describe("token lockup", () => {
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
  const testEnvironment = new TestEnvironment(testEnvironmentParams);
  const tokenlockProgram = anchor.workspace.Tokenlock as Program<Tokenlock>;

  before("setups environment", async () => {
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();
  });

  it("setups test environment", async () => {
    const accessControlData =
      await testEnvironment.accessControlHelper.accessControlData();
    assert.deepEqual(
      accessControlData.mint,
      testEnvironment.mintKeypair.publicKey
    );

    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0]
      );

    assert.deepEqual(walletRoleData.role, Roles.ContractAdmin);
    assert.deepEqual(
      accessControlData.authority,
      testEnvironment.contractAdmin.publicKey
    );

    const mintData = await testEnvironment.mintHelper.getMint();
    assert.deepEqual(
      mintData.mintAuthority,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.deepEqual(
      mintData.supply,
      BigInt(testEnvironmentParams.initialSupply)
    );
    assert.deepEqual(mintData.decimals, testEnvironmentParams.mint.decimals);
    assert.deepEqual(mintData.isInitialized, true);
    assert.deepEqual(
      mintData.freezeAuthority,
      testEnvironment.accessControlHelper.accessControlPubkey
    );

    // Retrieve and verify the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintData);
    assert.deepEqual(
      metadataPointer.authority,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.deepEqual(
      metadataPointer.metadataAddress,
      testEnvironment.mintKeypair.publicKey
    );

    // Retrieve and verify the metadata state
    const metadata = await getTokenMetadata(
      testEnvironment.connection,
      testEnvironment.mintKeypair.publicKey // Mint Account address
    );
    assert.deepEqual(metadata.mint, testEnvironment.mintKeypair.publicKey);
    assert.deepEqual(
      metadata.updateAuthority,
      testEnvironment.contractAdmin.publicKey
    );
    assert.equal(metadata.name, testEnvironmentParams.mint.name);
    assert.equal(metadata.symbol, testEnvironmentParams.mint.symbol);
    assert.equal(metadata.uri, testEnvironmentParams.mint.uri);

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.deepEqual(
      transferRestrictionData.securityTokenMint,
      testEnvironment.mintKeypair.publicKey
    );
    assert.deepEqual(
      transferRestrictionData.accessControlAccount,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
    assert.equal(
      transferRestrictionData.maxHolders.toNumber(),
      testEnvironmentParams.maxHolders
    );
  });

  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;
  let escrowAccount: anchor.web3.PublicKey;

  it("intializes token lockup", async () => {
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
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tokenlock"),
        testEnvironment.mintKeypair.publicKey.toBuffer(),
        tokenlockDataPubkey.toBuffer(),
      ],
      tokenlockProgram.programId
    );
    escrowOwnerPubkey = pda;
    escrowAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        pda,
        testEnvironment.contractAdmin,
        true
      );

    const maxReleaseDelay = new anchor.BN(MAX_RELEASE_DELAY);
    const minTimelockAmount = new anchor.BN(100);
    const initializeTokenlockSignature = await initializeTokenlock(
      tokenlockProgram,
      maxReleaseDelay,
      minTimelockAmount,
      tokenlockDataPubkey,
      escrowAccount,
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      )[0],
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.contractAdmin
    );
    console.log(
      "Initialize Tokenlock Transaction Signature",
      initializeTokenlockSignature
    );

    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    assert.deepEqual(tokenlockData.escrowAccount, escrowAccount);
    assert.deepEqual(
      tokenlockData.mintAddress,
      testEnvironment.mintKeypair.publicKey
    );
    assert.deepEqual(
      tokenlockData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(tokenlockData.releaseSchedules.length, 0);
    assert.equal(
      tokenlockData.maxReleaseDelay.toString(),
      maxReleaseDelay.toString()
    );
    assert.equal(
      tokenlockData.minTimelockAmount.toString(),
      minTimelockAmount.toString()
    );
  });

  it("sets escrow account into transfer restriction data", async () => {
    let transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(transferRestrictionData.lockupEscrowAccount, null);

    const [contractAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );

    const txSignature =
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        contractAdminWalletRole,
        testEnvironment.contractAdmin
      );
    console.log(
      "Set escrow account into transfer restriction data tx:",
      txSignature
    );

    transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.deepEqual(
      transferRestrictionData.lockupEscrowAccount,
      escrowAccount
    );
  });

  const uuid = uuidBytes();
  let signerHash: number[];
  const releaseCount = 10;
  const delayUntilFirstReleaseInSeconds = 0;
  const initialReleasePortionInBips = 1000;
  const periodBetweenReleasesInSeconds = 86400;
  it("adds release schedule", async () => {
    const authourityPubkey = testEnvironment.contractAdmin.publicKey;
    signerHash = calcSignerHash(authourityPubkey, uuid);

    const createReleaseScheduleTxSignature =
      await tokenlockProgram.rpc.createReleaseSchedule(
        uuid,
        releaseCount,
        new anchor.BN(delayUntilFirstReleaseInSeconds),
        initialReleasePortionInBips,
        new anchor.BN(periodBetweenReleasesInSeconds),
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            authority: authourityPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                authourityPubkey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
          },
          signers: [testEnvironment.contractAdmin],
        }
      );
    const tokenLockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    assert.equal(tokenLockData.releaseSchedules.length, 1);
    assert.deepEqual(tokenLockData.releaseSchedules[0].signerHash, signerHash);
    assert.equal(tokenLockData.releaseSchedules[0].releaseCount, releaseCount);
    assert.equal(
      tokenLockData.releaseSchedules[0].delayUntilFirstReleaseInSeconds.toNumber(),
      delayUntilFirstReleaseInSeconds
    );
    assert.equal(
      tokenLockData.releaseSchedules[0].initialReleasePortionInBips,
      initialReleasePortionInBips
    );
    assert.equal(
      tokenLockData.releaseSchedules[0].periodBetweenReleasesInSeconds.toNumber(),
      periodBetweenReleasesInSeconds
    );
    console.log(
      "Create Release Schedule Transaction Signature",
      createReleaseScheduleTxSignature
    );
  });

  const investor = anchor.web3.Keypair.generate();
  const investorTokenAccountPubkey =
    testEnvironment.mintHelper.getAssocciatedTokenAddress(investor.publicKey);
  const mintedAmount = 1_000_000;
  it("mints release schedule", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    let accInfo = await testEnvironment.connection.getAccountInfo(
      timelockAccount
    );
    if (accInfo === null) {
      const tx = await tokenlockProgram.methods
        .initializeTimelock()
        .accountsStrict({
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount: timelockAccount,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              testEnvironment.reserveAdmin.publicKey
            )[0],
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authority: testEnvironment.reserveAdmin.publicKey,
          targetAccount: investor.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([testEnvironment.reserveAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      console.log("Initialize Timelock Transaction Signature", tx);
    }

    const cancelableBy = [testEnvironment.reserveAdmin.publicKey];

    const scheduleId = 0;
    const commencementTimestamp = await getNowTs(testEnvironment.connection);
    const authorityWalletRole =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      )[0];

    const mintReleaseScheduleInstruction =
      tokenlockProgram.instruction.mintReleaseSchedule(
        uuid,
        new anchor.BN(mintedAmount),
        new anchor.BN(commencementTimestamp),
        scheduleId,
        cancelableBy,
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            timelockAccount: timelockAccount,
            escrowAccount: escrowAccount,
            escrowAccountOwner: escrowOwnerPubkey,
            authorityWalletRole: authorityWalletRole,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            to: investor.publicKey,
            authority: testEnvironment.reserveAdmin.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            accessControlProgram:
              testEnvironment.accessControlHelper.program.programId,
            systemProgram: SystemProgram.programId,
          },
          signers: [testEnvironment.reserveAdmin],
        }
      );

    const mintReleaseScheduleWithHookTx = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(mintReleaseScheduleInstruction),
      [testEnvironment.reserveAdmin],
      { commitment: testEnvironment.commitment }
    );
    console.log(
      "mintReleaseSchedule Transaction Signature",
      mintReleaseScheduleWithHookTx
    );

    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    assert.deepEqual(timelockData.tokenlockAccount, tokenlockDataPubkey);
    assert.deepEqual(timelockData.targetAccount, investor.publicKey);
    assert.deepEqual(timelockData.cancelables, cancelableBy);
    assert.equal(timelockData.timelocks.length, 1);
    assert.equal(
      timelockData.timelocks[0].totalAmount.toNumber(),
      mintedAmount
    );
    assert.equal(
      timelockData.timelocks[0].commencementTimestamp.toNumber(),
      commencementTimestamp
    );
    assert.equal(timelockData.timelocks[0].tokensTransferred.toNumber(), 0);
    assert.equal(timelockData.timelocks[0].scheduleId, 0);
    assert.equal(timelockData.timelocks[0].cancelableByCount, 1);

    assert.deepEqual(
      timelockData.timelocks[0].signerHash,
      calcSignerHash(testEnvironment.reserveAdmin.publicKey, uuid)
    );
    const escrowAccountData = await testEnvironment.mintHelper.getAccount(
      escrowAccount
    );
    assert.equal(escrowAccountData.amount.toString(), mintedAmount.toString());
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    const lockedBalance = lockedBalanceOf(tokenlockData, timelockData, tsNow);
    const unlockedBalanceCalculated = new anchor.BN(mintedAmount)
      .muln(initialReleasePortionInBips)
      .divn(BIPS_PRECISION);
    assert.equal(
      unlockedBalance.toString(),
      unlockedBalanceCalculated.toString()
    );
    assert.equal(
      lockedBalance.toString(),
      new anchor.BN(mintedAmount).sub(unlockedBalanceCalculated).toString()
    );
  });

  it("creates transfer restriction accounts and rule", async () => {
    const [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    // Initialize holders
    const reserveAdminHolderId = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      reserveAdminHolderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const recipientHolderId = new anchor.BN(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      recipientHolderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    // Initialize transfer groups
    const reserveAdminGroupId = new anchor.BN(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      reserveAdminGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const recipientGroupId = new anchor.BN(2);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      recipientGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    const reserveAdminHolderPubkey =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        reserveAdminHolderId
      )[0];
    const reserveAdminGroupPubkey =
      testEnvironment.transferRestrictionsHelper.groupPDA(
        reserveAdminGroupId
      )[0];
    const reserveAdminHolderGroupPubkey =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        reserveAdminHolderPubkey,
        reserveAdminGroupId
      )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      reserveAdminHolderGroupPubkey,
      reserveAdminHolderPubkey,
      reserveAdminGroupPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    const recipientHolderPubkey =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        recipientHolderId
      )[0];
    const recipientGroupIdPubkey =
      testEnvironment.transferRestrictionsHelper.groupPDA(recipientGroupId)[0];
    const recipientHolderGroupPubkey =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        recipientHolderPubkey,
        recipientGroupId
      )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      recipientHolderGroupPubkey,
      recipientHolderPubkey,
      recipientGroupIdPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    // Initialize Security Associated Accounts
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      testEnvironment.transferRestrictionsHelper.groupPDA(
        reserveAdminGroupId
      )[0],
      testEnvironment.transferRestrictionsHelper.holderPDA(
        reserveAdminHolderId
      )[0],
      reserveAdminHolderGroupPubkey,
      testEnvironment.reserveAdmin.publicKey,
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      ),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    // Initialize Transfer Restrictions Rule
    const tsNow = await getNowTs(testEnvironment.connection);
    const lockedUntil = new anchor.BN(tsNow);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      reserveAdminGroupId,
      recipientGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
  });

  let transferAmount: anchor.BN;
  const investorGroupId = new anchor.BN(3);
  const investorHolderId = new anchor.BN(2);
  const investorHolderPubkey =
    testEnvironment.transferRestrictionsHelper.holderPDA(investorHolderId)[0];
  const investorGroupPubkey =
    testEnvironment.transferRestrictionsHelper.groupPDA(investorGroupId)[0];
  const investorHolderGroupPubkey =
    testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      investorHolderPubkey,
      investorGroupId
    )[0];
  const [transferAdminWalletRole] =
    testEnvironment.accessControlHelper.walletRolePDA(
      testEnvironment.transferAdmin.publicKey
    );
  const [transferRulePubkey] =
    testEnvironment.transferRestrictionsHelper.transferRulePDA(
      investorGroupId,
      investorGroupId
    );
  it("creates transfer rule for new wallet", async () => {
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      investorGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const lockedUntil = new anchor.BN(
      await getNowTs(testEnvironment.connection)
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      investorGroupId,
      investorGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
  });

  it("transfers for recipient", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    transferAmount = unlockedBalance.muln(0.35);

    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );
    const investorTokenAccountPubkey =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investor.publicKey,
        investor
      );
    // to can be any token account from the group which allows to receive tokens from escrowAccount group
    const transferInstruction = tokenlockProgram.instruction.transfer(
      transferAmount,
      {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount,
          escrowAccount: escrowAccount,
          pdaAccount: escrowOwnerPubkey,
          authority: investor.publicKey,
          to: investorTokenAccountPubkey,
          mintAddress: testEnvironment.mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          transferRestrictionsProgram:
            testEnvironment.transferRestrictionsHelper.program.programId,
          authorityAccount:
            testEnvironment.mintHelper.getAssocciatedTokenAddress(
              investor.publicKey
            ),
          securityAssociatedAccountFrom:
            testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
              investorTokenAccountPubkey
            )[0],
          securityAssociatedAccountTo:
            testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
              investorTokenAccountPubkey
            )[0],
          transferRule: transferRulePubkey,
        },
        signers: [investor],
      }
    );
    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    // create transfer rule escrow -> investorTokenAccountPubkey
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      investorHolderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      investorHolderGroupPubkey,
      investorHolderPubkey,
      investorGroupPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      testEnvironment.transferRestrictionsHelper.groupPDA(investorGroupId)[0],
      testEnvironment.transferRestrictionsHelper.holderPDA(investorHolderId)[0],
      investorHolderGroupPubkey,
      investor.publicKey,
      investorTokenAccountPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      transferInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      investorTokenAccountPubkey,
      escrowOwnerPubkey,
      transferAmount.toNumber(),
      testEnvironment.commitment
    );

    const transferTxSignature = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferInstruction),
      [investor], // userWallet
      { commitment: testEnvironment.commitment }
    );
    console.log("Transfer Transaction Signature", transferTxSignature);

    const timelockDataAfterTransfer =
      await tokenlockProgram.account.timelockData.fetch(timelockAccount);
    assert.equal(
      timelockDataAfterTransfer.timelocks[0].tokensTransferred.toNumber(),
      transferAmount.toNumber()
    );
    const investorTokenAccountData =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(
      investorTokenAccountData.amount.toString(),
      transferAmount.toString()
    );
  });

  it("transfers from timelock", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    const transferTimelockAmount = unlockedBalance.muln(0.35);

    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );
    const timelockId = 0;
    // to can be any token account from the group which allows to receive tokens from escrowAccount group
    const transferTimelockInstruction =
      tokenlockProgram.instruction.transferTimelock(
        transferTimelockAmount,
        timelockId,
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            timelockAccount,
            escrowAccount: escrowAccount,
            pdaAccount: escrowOwnerPubkey,
            authority: investor.publicKey,
            to: investorTokenAccountPubkey,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            transferRestrictionsProgram:
              testEnvironment.transferRestrictionsHelper.program.programId,
            authorityAccount:
              testEnvironment.mintHelper.getAssocciatedTokenAddress(
                investor.publicKey
              ),
            securityAssociatedAccountFrom:
              testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
                investorTokenAccountPubkey
              )[0],
            securityAssociatedAccountTo:
              testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
                investorTokenAccountPubkey
              )[0],
            transferRule: transferRulePubkey,
          },
          signers: [investor],
        }
      );
    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      transferTimelockInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      investorTokenAccountPubkey,
      escrowOwnerPubkey,
      transferTimelockAmount.toNumber(),
      testEnvironment.commitment
    );

    const transferTxSignature = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferTimelockInstruction),
      [investor],
      { commitment: testEnvironment.commitment }
    );
    console.log("Transfer Timelock Transaction Signature", transferTxSignature);

    const timelockDataAfterTransfer =
      await tokenlockProgram.account.timelockData.fetch(timelockAccount);
    assert.equal(
      timelockDataAfterTransfer.timelocks[0].tokensTransferred.toNumber(),
      transferAmount.add(transferTimelockAmount).toNumber()
    );
    const investorTokenAccountData =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(
      investorTokenAccountData.amount.toString(),
      transferAmount.add(transferTimelockAmount).toString()
    );
  });

  const newInvestorWallet = anchor.web3.Keypair.generate();
  const newinvestorTokenAccountPubkey =
    testEnvironment.mintHelper.getAssocciatedTokenAddress(
      newInvestorWallet.publicKey
    );
  it("creates new wallet for investor", async () => {
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      newInvestorWallet.publicKey,
      investor
    );

    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      investorGroupPubkey,
      investorHolderPubkey,
      investorHolderGroupPubkey,
      newInvestorWallet.publicKey,
      newinvestorTokenAccountPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
  });

  it("transfers from timelock to new wallet", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    const transferTimelockAmount = unlockedBalance.muln(0.35);

    const timelockId = 0;
    // to can be any token account from the group which allows to receive tokens from escrowAccount group
    const transferTimelockInstruction =
      tokenlockProgram.instruction.transferTimelock(
        transferTimelockAmount,
        timelockId,
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            timelockAccount,
            escrowAccount: escrowAccount,
            pdaAccount: escrowOwnerPubkey,
            authority: investor.publicKey,
            to: newinvestorTokenAccountPubkey,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            transferRestrictionsProgram:
              testEnvironment.transferRestrictionsHelper.program.programId,
            authorityAccount:
              testEnvironment.mintHelper.getAssocciatedTokenAddress(
                investor.publicKey
              ),
            securityAssociatedAccountFrom:
              testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
                investorTokenAccountPubkey
              )[0],
            securityAssociatedAccountTo:
              testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
                newinvestorTokenAccountPubkey
              )[0],
            transferRule: transferRulePubkey,
          },
          signers: [investor],
        }
      );
    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      transferTimelockInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      newinvestorTokenAccountPubkey,
      escrowOwnerPubkey,
      transferTimelockAmount.toNumber(),
      testEnvironment.commitment
    );

    const transferTxSignature = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferTimelockInstruction),
      [investor],
      { commitment: testEnvironment.commitment }
    );

    console.log("Transfer Timelock Transaction Signature", transferTxSignature);
  });

  it("cancel timelock from timelock", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );

    const investorTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(investor.publicKey);
    let investorTokenAccountData = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    const investorBalanceBefore = investorTokenAccountData.amount;
    const timelockIdx = 0;
    const reclaimerTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
    const [investorSecAssocAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorTokenAccountPubkey
      );
    const investorSecAssocAccountData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        investorSecAssocAccountPubkey
      );
    const [reclaimerSecAssocAccountPubkey] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        reclaimerTokenAccountPubkey
      );
    const reclaimerSecAssocAccountData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        reclaimerSecAssocAccountPubkey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      new anchor.BN(tsNow),
      investorSecAssocAccountData.group,
      reclaimerSecAssocAccountData.group,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const [transferRulePubkey] =
      testEnvironment.transferRestrictionsHelper.transferRulePDA(
        investorSecAssocAccountData.group,
        reclaimerSecAssocAccountData.group
      );

    const lockedUntil = new anchor.BN(tsNow);
    const escrowGroupdId = new anchor.BN(2);
    const reclaimerGroupId = new anchor.BN(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      escrowGroupdId,
      reclaimerGroupId,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );

    await cancelTimelock(
      tokenlockProgram,
      timelockIdx,
      tokenlockDataPubkey,
      testEnvironment.mintKeypair.publicKey,
      investor.publicKey,
      escrowOwnerPubkey,
      reclaimerTokenAccountPubkey,
      testEnvironment.transferRestrictionsHelper,
      testEnvironment.reserveAdmin
    );

    const timelockDataAfterTransfer =
      await tokenlockProgram.account.timelockData.fetch(timelockAccount);
    assert.equal(
      timelockDataAfterTransfer.timelocks[0].tokensTransferred.toNumber(),
      timelockDataAfterTransfer.timelocks[0].totalAmount.toNumber()
    );
    investorTokenAccountData = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    assert.equal(
      investorTokenAccountData.amount.toString(),
      (investorBalanceBefore + BigInt(unlockedBalance.toNumber())).toString()
    );
    const escrowAccountData = await testEnvironment.mintHelper.getAccount(
      escrowAccount
    );
    assert.equal(escrowAccountData.amount.toString(), "0");
  });
});
