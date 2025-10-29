import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import {
  createApproveInstruction,
  createTransferCheckedWithTransferHookInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { solToLamports, topUpWallet } from "../utils";
import { getNowTs } from "../helpers/clock_helper";

describe("Approve and transfer by third party service", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 5,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;

  // Test accounts
  const investor = Keypair.generate();
  const thirdPartyService = Keypair.generate();
  const recipient = Keypair.generate();

  let investorTokenAccountPubkey: anchor.web3.PublicKey;
  let recipientTokenAccountPubkey: anchor.web3.PublicKey;
  let reserveAdminTokenAccountPubkey: anchor.web3.PublicKey;

  let walletsAdminWalletRole: anchor.web3.PublicKey;
  let transferAdminWalletRole: anchor.web3.PublicKey;

  // Holder IDs
  const holderInvestorId = 0;
  const holderRecipientId = 1;
  const holderReserveAdminId = 2;
  const groupId = 1;

  let groupPubkey: anchor.web3.PublicKey;
  let investorHolderPubkey: anchor.web3.PublicKey;
  let investorHolderGroupPubkey: anchor.web3.PublicKey;
  let recipientHolderPubkey: anchor.web3.PublicKey;
  let recipientHolderGroupPubkey: anchor.web3.PublicKey;
  let reserveAdminHolderPubkey: anchor.web3.PublicKey;
  let reserveAdminHolderGroupPubkey: anchor.web3.PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
  });

  it("sets up accounts and mints tokens to investor", async () => {
    const amount = 1_000_000 * 10 ** testEnvironmentParams.mint.decimals;
    console.log("=".repeat(30));
    // Create token accounts
    reserveAdminTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
    investorTokenAccountPubkey =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investor.publicKey,
        testEnvironment.reserveAdmin
      );
    recipientTokenAccountPubkey =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        recipient.publicKey,
        testEnvironment.reserveAdmin
      );
    console.log('associated account created!');
    // Setup wallet roles
    [walletsAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      );
    [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );

    // Initialize holders
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(holderInvestorId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    [investorHolderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        new anchor.BN(holderInvestorId)
      );

    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(holderRecipientId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    [recipientHolderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        new anchor.BN(holderRecipientId)
      );
    console.log('holders initialized')
    // Initialize group
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(groupId),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(groupId)
    );

    // Initialize holder groups
    [investorHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        investorHolderPubkey,
        new anchor.BN(groupId)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      investorHolderGroupPubkey,
      investorHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );

    [recipientHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        recipientHolderPubkey,
        new anchor.BN(groupId)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      recipientHolderGroupPubkey,
      recipientHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    console.log('holder groups initialized')
    // Initialize security associated accounts
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      investorHolderPubkey,
      investorHolderGroupPubkey,
      investor.publicKey,
      investorTokenAccountPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      recipientHolderPubkey,
      recipientHolderGroupPubkey,
      recipient.publicKey,
      recipientTokenAccountPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    console.log('security associated accounts initialized')
    // Initialize reserve admin holder, holder group and security associated account
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(holderReserveAdminId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    [reserveAdminHolderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(
        new anchor.BN(holderReserveAdminId)
      );

    [reserveAdminHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        reserveAdminHolderPubkey,
        new anchor.BN(groupId)
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      reserveAdminHolderGroupPubkey,
      reserveAdminHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      reserveAdminHolderPubkey,
      reserveAdminHolderGroupPubkey,
      testEnvironment.reserveAdmin.publicKey,
      reserveAdminTokenAccountPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    console.log('reserve admin holder and security associated account initialized');
    const [reserveAdminSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      reserveAdminTokenAccountPubkey
    );
        // Mint tokens to reserve admin first
    await testEnvironment.accessControlHelper.mintSecurities(
      new anchor.BN(amount),
      testEnvironment.reserveAdmin.publicKey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.reserveAdmin,
      reserveAdminSaaPubkey
    );
    console.log('securities minted');
    // Setup transfer rule
    const tsNow = await getNowTs(testEnvironment.connection);
    const lockedUntil = new anchor.BN(tsNow);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      new anchor.BN(groupId),
      new anchor.BN(groupId),
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    console.log('transfer rule initialized')
    // Transfer tokens to investor using transfer hook (instead of forceTransfer)
    const transferAmount = 500_000 * 10 ** testEnvironmentParams.mint.decimals;
    const transferWithHookInstruction = await createTransferCheckedWithTransferHookInstruction(
      testEnvironment.connection,
      reserveAdminTokenAccountPubkey,
      testEnvironment.mintKeypair.publicKey,
      investorTokenAccountPubkey,
      testEnvironment.reserveAdmin.publicKey,
      BigInt(transferAmount),
      testEnvironmentParams.mint.decimals,
      undefined,
      testEnvironment.commitment,
      TOKEN_2022_PROGRAM_ID
    );
    console.log('transfer instruction created');

    await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferWithHookInstruction),
      [testEnvironment.reserveAdmin],
      { commitment: testEnvironment.commitment }
    );
    console.log('tokens transferred to investor');
    const { amount: investorBalance } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    console.log('investor balance', investorBalance.toString());
    
    assert.equal(investorBalance.toString(), transferAmount.toString());
  });

  it("investor approves third party service to spend tokens", async () => {
    const approveAmount = 100_000 * 10 ** testEnvironmentParams.mint.decimals;

    // Top up investor wallet for transaction fees
    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );

    const accountInfoBeforeApproval = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    console.log('account delegate before approval', accountInfoBeforeApproval.delegate?.toBase58());
    console.log('account delegatedAmount before approval', accountInfoBeforeApproval.delegatedAmount.toString());

    // Create approve instruction
    const approveInstruction = createApproveInstruction(
      investorTokenAccountPubkey,
      thirdPartyService.publicKey,
      investor.publicKey,
      BigInt(approveAmount),
      [],
      TOKEN_2022_PROGRAM_ID
    );

    await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(approveInstruction),
      [investor],
      { commitment: testEnvironment.commitment }
    );

    // Verify the approval
    const accountInfo = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    console.log('account delegate', accountInfo.delegate?.toBase58());
    console.log('account delegatedAmount', accountInfo.delegatedAmount.toString());
    assert.equal(accountInfo.delegate?.toBase58(), thirdPartyService.publicKey.toBase58());
    assert.equal(accountInfo.delegatedAmount.toString(), approveAmount.toString());
  });

  it("third party service transfers tokens on behalf of investor", async () => {
    const transferAmount = 50_000 * 10 ** testEnvironmentParams.mint.decimals;

    // Top up third party service wallet for transaction fees
    await topUpWallet(
      testEnvironment.connection,
      thirdPartyService.publicKey,
      solToLamports(1)
    );

    // Get balances before transfer
    const { amount: investorBalanceBefore } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    const { amount: recipientBalanceBefore } =
      await testEnvironment.mintHelper.getAccount(recipientTokenAccountPubkey);

    // Create transfer instruction with third party service as delegate
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        testEnvironment.connection,
        investorTokenAccountPubkey,
        testEnvironment.mintKeypair.publicKey,
        recipientTokenAccountPubkey,
        thirdPartyService.publicKey, // delegate is the signer
        BigInt(transferAmount),
        testEnvironmentParams.mint.decimals,
        undefined,
        testEnvironment.commitment,
        TOKEN_2022_PROGRAM_ID
      );

    await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferWithHookInstruction),
      [thirdPartyService], // third party signs the transaction
      { commitment: testEnvironment.commitment }
    );

    // Verify balances after transfer
    const { amount: investorBalanceAfter, delegatedAmount: investorDelegatedAmountAfter } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    const { amount: recipientBalanceAfter } =
      await testEnvironment.mintHelper.getAccount(recipientTokenAccountPubkey);

    console.log('='.repeat(30));
    console.log('transfer amount:                ', transferAmount.toString());
    console.log('investor balance after:         ', investorBalanceAfter.toString());
    console.log('investor delegatedAmount after: ', investorDelegatedAmountAfter.toString());
    console.log('recipient balance after:        ', recipientBalanceAfter.toString());
    console.log('='.repeat(30));

    assert.equal(
      investorBalanceAfter.toString(),
      (investorBalanceBefore - BigInt(transferAmount)).toString()
    );
    assert.equal(
      recipientBalanceAfter.toString(),
      (recipientBalanceBefore + BigInt(transferAmount)).toString()
    );

    // Verify remaining delegated amount
    const accountInfo = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    const expectedDelegatedAmount = 100_000 * 10 ** testEnvironmentParams.mint.decimals - transferAmount;
    assert.equal(accountInfo.delegatedAmount.toString(), expectedDelegatedAmount.toString());
  });

  it("third party service transfers remaining approved tokens", async () => {
    const { delegatedAmount } = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    const transferAmount = Number(delegatedAmount);

    // Get balances before transfer
    const { amount: investorBalanceBefore } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    const { amount: recipientBalanceBefore } =
      await testEnvironment.mintHelper.getAccount(recipientTokenAccountPubkey);

    // Transfer remaining approved amount
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        testEnvironment.connection,
        investorTokenAccountPubkey,
        testEnvironment.mintKeypair.publicKey,
        recipientTokenAccountPubkey,
        thirdPartyService.publicKey,
        BigInt(transferAmount),
        testEnvironmentParams.mint.decimals,
        undefined,
        testEnvironment.commitment,
        TOKEN_2022_PROGRAM_ID
      );

    await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferWithHookInstruction),
      [thirdPartyService],
      { commitment: testEnvironment.commitment }
    );

    // Verify balances after transfer
    const { amount: investorBalanceAfter, delegatedAmount: investorDelegatedAmountAfter } =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    const { amount: recipientBalanceAfter } =
      await testEnvironment.mintHelper.getAccount(recipientTokenAccountPubkey);

    console.log('='.repeat(30));
    console.log('transfer amount:                ', transferAmount.toString());
    console.log('investor balance after:         ', investorBalanceAfter.toString());
    console.log('investor delegatedAmount after: ', investorDelegatedAmountAfter.toString());
    console.log('recipient balance after:        ', recipientBalanceAfter.toString());
    console.log('='.repeat(30));

    assert.equal(
      investorBalanceAfter.toString(),
      (investorBalanceBefore - BigInt(transferAmount)).toString()
    );
    assert.equal(
      recipientBalanceAfter.toString(),
      (recipientBalanceBefore + BigInt(transferAmount)).toString()
    );

    // Verify delegated amount is now zero
    const accountInfo = await testEnvironment.mintHelper.getAccount(
      investorTokenAccountPubkey
    );
    assert.equal(accountInfo.delegatedAmount.toString(), "0");
  });

  it("fails when third party service tries to transfer more than approved", async () => {
    const approveAmount = 10_000 * 10 ** testEnvironmentParams.mint.decimals;

    // Investor approves a small amount
    const approveInstruction = createApproveInstruction(
      investorTokenAccountPubkey,
      thirdPartyService.publicKey,
      investor.publicKey,
      BigInt(approveAmount),
      [],
      TOKEN_2022_PROGRAM_ID
    );

    await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(approveInstruction),
      [investor],
      { commitment: testEnvironment.commitment }
    );

    // Try to transfer more than approved
    const excessiveTransferAmount = approveAmount * 2;
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        testEnvironment.connection,
        investorTokenAccountPubkey,
        testEnvironment.mintKeypair.publicKey,
        recipientTokenAccountPubkey,
        thirdPartyService.publicKey,
        BigInt(excessiveTransferAmount),
        testEnvironmentParams.mint.decimals,
        undefined,
        testEnvironment.commitment,
        TOKEN_2022_PROGRAM_ID
      );

    try {
      await sendAndConfirmTransaction(
        testEnvironment.connection,
        new Transaction().add(transferWithHookInstruction),
        [thirdPartyService],
        { commitment: testEnvironment.commitment }
      );
      assert.fail("Expected transaction to fail");
    } catch (error) {
      // Transaction should fail due to insufficient approved amount
      assert.isTrue(error.message.includes("insufficient"));
    }
  });

  it("fails when unauthorized third party tries to transfer", async () => {
    const unauthorizedService = Keypair.generate();
    const transferAmount = 1_000 * 10 ** testEnvironmentParams.mint.decimals;

    // Top up unauthorized service wallet
    await topUpWallet(
      testEnvironment.connection,
      unauthorizedService.publicKey,
      solToLamports(1)
    );

    // Try to transfer without approval
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        testEnvironment.connection,
        investorTokenAccountPubkey,
        testEnvironment.mintKeypair.publicKey,
        recipientTokenAccountPubkey,
        unauthorizedService.publicKey,
        BigInt(transferAmount),
        testEnvironmentParams.mint.decimals,
        undefined,
        testEnvironment.commitment,
        TOKEN_2022_PROGRAM_ID
      );

    try {
      await sendAndConfirmTransaction(
        testEnvironment.connection,
        new Transaction().add(transferWithHookInstruction),
        [unauthorizedService],
        { commitment: testEnvironment.commitment }
      );
      assert.fail("Expected transaction to fail");
    } catch (error) {
      // Transaction should fail due to lack of approval
      assert.isTrue(
        error.message.includes("owner does not match") ||
        error.message.includes("insufficient") ||
        error.logs?.some((log: string) => 
          log.includes("owner does not match") || 
          log.includes("insufficient")
        )
      );
    }
  });
});

