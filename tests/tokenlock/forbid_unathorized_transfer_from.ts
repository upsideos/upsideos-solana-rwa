import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getMetadataPointerState,
  getTokenMetadata,
  addExtraAccountMetasForExecute,
} from "@solana/spl-token";
import { assert } from "chai";
import {
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  ComputeBudgetProgram,
  PublicKey,
} from "@solana/web3.js";

import { Roles } from "./../helpers/access-control_helper";
import { Tokenlock } from "../../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "./../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "./../utils";
import {
  BIPS_PRECISION,
  calcSignerHash,
  getTimelockAccount,
  initializeTokenlock,
  lockedBalanceOf,
  MAX_RELEASE_DELAY,
  unlockedBalanceOf,
  uuidBytes,
} from "./../helpers/tokenlock_helper";
import { getNowTs } from "./../helpers/clock_helper";

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
  let group1Pubkey: PublicKey, group2Pubkey: PublicKey, group3Pubkey: PublicKey;
  let holder0Pubkey: PublicKey,
    holder1Pubkey: PublicKey,
    holder2Pubkey: PublicKey;

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
  let timelockAccount: anchor.web3.PublicKey;
  it("mints release schedule", async () => {
    timelockAccount = getTimelockAccount(
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

  it("top up investor account", async () => {
    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );
  });

  it("creates group 1, 2 and 3", async () => {
    const [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(1),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(2),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(3),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    group1Pubkey = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(1)
    )[0];
    group2Pubkey = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(2)
    )[0];
    group3Pubkey = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(3)
    )[0];
  });

  it("creates holder 0, 1 and 2", async () => {
    const [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    holder0Pubkey = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    )[0];
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(0),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    holder1Pubkey = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    )[0];
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(1),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    holder2Pubkey = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(2)
    )[0];
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(2),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
  });

  let holderGroup0Pubkey: PublicKey,
    holderGroup1Pubkey: PublicKey,
    holderGroup2Pubkey: PublicKey;
  it("creates holder group 0, 1 and 2", async () => {
    const [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );

    holderGroup0Pubkey =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holder0Pubkey,
        new anchor.BN(1)
      )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroup0Pubkey,
      holder0Pubkey,
      group1Pubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    holderGroup1Pubkey =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holder1Pubkey,
        new anchor.BN(2)
      )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroup1Pubkey,
      holder1Pubkey,
      group2Pubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    holderGroup2Pubkey =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holder2Pubkey,
        new anchor.BN(3)
      )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroup2Pubkey,
      holder2Pubkey,
      group3Pubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
  });

  it("creates investor associated token account", async () => {
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      investor.publicKey,
      investor
    );
  });

  it("initializes security associated account group3 holder2", async () => {
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      group3Pubkey,
      holder2Pubkey,
      holderGroup2Pubkey,
      investor.publicKey,
      investorTokenAccountPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
  });

  const investorRecipient = anchor.web3.Keypair.generate();
  const investorRecipientTokenAccountPubkey =
    testEnvironment.mintHelper.getAssocciatedTokenAddress(
      investorRecipient.publicKey
    );

  it("creates investor recipient associated token account", async () => {
    await testEnvironment.mintHelper.createAssociatedTokenAccount(
      investorRecipient.publicKey,
      investor
    );
  });

  it("initializes investor recipient security associated account group1 holder0", async () => {
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      group1Pubkey,
      holder0Pubkey,
      holderGroup0Pubkey,
      investorRecipient.publicKey,
      investorRecipientTokenAccountPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
  });

  it("initializes transfer rule Group1 -> Group2, approved now", async () => {
    const tsNow = await getNowTs(testEnvironment.connection);
    const lockedUntil = new anchor.BN(tsNow);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      new anchor.BN(1),
      new anchor.BN(2),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("initializes transfer rule Group1 -> Group1, approved now", async () => {
    const tsNow = await getNowTs(testEnvironment.connection);
    const lockedUntil = new anchor.BN(tsNow);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      new anchor.BN(1),
      new anchor.BN(1),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("initializes transfer rule Group3 -> Group1, not approved", async () => {
    const lockedUntil = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      new anchor.BN(3),
      new anchor.BN(1),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("initializes transfer rule Group3 -> Group3, not approved", async () => {
    const lockedUntil = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      new anchor.BN(3),
      new anchor.BN(3),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("fails transfer when substitute security associated accounts", async () => {
    const escrowAccount = testEnvironment.mintHelper.getAssocciatedTokenAddress(
      escrowOwnerPubkey,
      true
    );
    const investorAccount =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        investor.publicKey,
        false
      );
    const securityAssociatedAccountFromFake =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorRecipientTokenAccountPubkey
      )[0];
    const securityAssociatedAccountTo =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorRecipientTokenAccountPubkey
      )[0];
    const secAssocAccountFromData =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccountFromFake
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
    const amount = new anchor.BN(1000);
    const transferInstruction = tokenlockProgram.instruction.transfer(amount, {
      accounts: {
        tokenlockAccount: tokenlockDataPubkey,
        timelockAccount,
        escrowAccount,
        pdaAccount: escrowOwnerPubkey,
        authority: investor.publicKey,
        to: investorRecipientTokenAccountPubkey,
        mintAddress: testEnvironment.mintKeypair.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        transferRestrictionsProgram:
          testEnvironment.transferRestrictionsHelper.program.programId,
        authorityAccount: investorAccount,
        securityAssociatedAccountFrom: securityAssociatedAccountFromFake,
        securityAssociatedAccountTo,
        transferRule: transferRulePubkey,
      },
      signers: [investor],
    });

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      transferInstruction,
      testEnvironment.transferRestrictionsHelper.program.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      investorRecipientTokenAccountPubkey,
      escrowOwnerPubkey,
      BigInt(amount.toString()),
      "confirmed"
    );

    const modifyComputeUnitsInstruction =
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000,
      });

    try {
      await sendAndConfirmTransaction(
        testEnvironment.connection,
        new Transaction().add(
          modifyComputeUnitsInstruction,
          transferInstruction
        ),
        [investor],
        { commitment: "confirmed" }
      );
      assert.fail("The transaction should have failed");
    } catch (error) {
      assert.equal(
        error.transactionMessage,
        "Transaction simulation failed: Error processing Instruction 1: custom program error: 0x7d6"
      );
      const res = error.transactionLogs.some(
        (log: string) =>
          log ===
          "Program log: AnchorError caused by account: security_associated_account_from. Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated."
      );
      assert.isTrue(res);
    }
  });
});
