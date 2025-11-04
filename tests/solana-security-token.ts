import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getMetadataPointerState,
  getTokenMetadata,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  createUpdateFieldInstruction,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

import { TransferRestrictions } from "../target/types/transfer_restrictions";
import { AccessControl } from "../target/types/access_control";
import { assert, expect } from "chai";
import { solToLamports, topUpWallet } from "./utils";
import { AccessControlHelper, Roles } from "./helpers/access-control_helper";

import { TransferRestrictionsHelper } from "./helpers/transfer-restrictions_helper";
import { MintHelper } from "./helpers/mint_helper";
import { getNowTs } from "./helpers/clock_helper";

describe("solana-security-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const commitment = "confirmed";

  const accessControlProgram = anchor.workspace
    .AccessControl as Program<AccessControl>;
  const transferRestrictionsProgram = anchor.workspace
    .TransferRestrictions as Program<TransferRestrictions>;
  const connection = provider.connection;

  const wallet = provider.wallet as anchor.Wallet;

  const superAdmin = Keypair.generate();

  const decimals = 6;
  const setupAccessControlArgs = {
    decimals,
    payer: superAdmin.publicKey,
    authority: superAdmin.publicKey,
    name: "XYZ Token",
    uri: "https://example.com",
    symbol: "XYZ",
    delegate: superAdmin.publicKey,
    maxTotalSupply: new anchor.BN(1_000_000_000),
    hookProgramId: transferRestrictionsProgram.programId,
  };
  const mintKeypair = Keypair.generate();
  const mintHelper = new MintHelper(connection, mintKeypair.publicKey);
  const accessControlHelper = new AccessControlHelper(
    accessControlProgram,
    mintKeypair.publicKey
  );
  const transferRestrictionsHelper = new TransferRestrictionsHelper(
    transferRestrictionsProgram,
    mintKeypair.publicKey,
    accessControlHelper.accessControlPubkey
  );

  const [authorityWalletRolePubkey] = accessControlHelper.walletRolePDA(
    setupAccessControlArgs.authority
  );
  const [accessControlPubkey, accessControlBump] =
    accessControlHelper.accessControlPDA();
  const userWallet = Keypair.generate();
  const userWalletPubkey = userWallet.publicKey;
  const userWalletAssociatedAccountPubkey =
    mintHelper.getAssocciatedTokenAddress(userWalletPubkey);
  const [userWalletSaaPubkey] = transferRestrictionsHelper.securityAssociatedAccountPDA(
    userWalletAssociatedAccountPubkey
  );
  const mintAmount = new anchor.BN(1000000);
  const [transferRestrictionDataPubkey] =
    transferRestrictionsHelper.transferRestrictionDataPDA();
  const maxHolders = new anchor.BN(10000);
  const transferGroup1 = new anchor.BN(1);
  const [transferRestrictionGroup1Pubkey] =
    transferRestrictionsHelper.groupPDA(transferGroup1);
  const senderHolderId = new anchor.BN(0);
  const [holderSenderPubkey] =
    transferRestrictionsHelper.holderPDA(senderHolderId);
  const userWalletRecipient = Keypair.generate();
  const userWalletRecipientPubkey = userWalletRecipient.publicKey;
  const userWalletRecipientAssociatedTokenAccountPubkey =
    mintHelper.getAssocciatedTokenAddress(userWalletRecipientPubkey);
  const recipientHolderId = new anchor.BN(1);
  const [holderRecipientPubkey] =
    transferRestrictionsHelper.holderPDA(recipientHolderId);

  before("tops up wallets", async () => {
    await topUpWallet(
      provider.connection,
      superAdmin.publicKey,
      solToLamports(10)
    );
    await topUpWallet(
      provider.connection,
      userWallet.publicKey,
      solToLamports(10)
    );
  });

  it("creates mint with transfer hook, access control and super admin role", async () => {
    const initializeAccessControlInstr =
      accessControlHelper.initializeAccessControlInstruction(
        setupAccessControlArgs
      );

    const initializeExtraAccountMetaListInstr =
      transferRestrictionsHelper.initializeExtraMetasAccount(
        superAdmin.publicKey,
        authorityWalletRolePubkey
      );

    // Add instructions to new transaction
    const transaction = new Transaction().add(
      initializeAccessControlInstr,
      initializeExtraAccountMetaListInstr
    );

    try {
      console.log("Mint Keypair", mintKeypair.publicKey.toBase58());
      console.log("Access Control Pubkey", accessControlPubkey.toBase58());
      console.log(
        "Authority Wallet Role Pubkey",
        authorityWalletRolePubkey.toBase58()
      );

      // Send transaction
      const transactionSignature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [superAdmin, mintKeypair], // Signers
        { commitment: commitment }
      );
      console.log("Transaction Signature", transactionSignature);
    } catch (error) {
      console.error(error);
    }

    const accessControlData = await accessControlHelper.accessControlData();
    assert.deepEqual(accessControlData.mint, mintKeypair.publicKey);

    const walletRoleData = await accessControlHelper.walletRoleData(
      authorityWalletRolePubkey
    );
    assert.deepEqual(walletRoleData.role, Roles.ContractAdmin);
    assert.deepEqual(
      accessControlData.authority,
      setupAccessControlArgs.authority
    );

    let mintData = await mintHelper.getMint();
    assert.deepEqual(mintData.mintAuthority, accessControlPubkey);
    assert.deepEqual(mintData.supply, BigInt(0));
    assert.deepEqual(mintData.decimals, decimals);
    assert.deepEqual(mintData.isInitialized, true);
    assert.deepEqual(mintData.freezeAuthority, accessControlPubkey);

    // Retrieve and verify the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintData);
    assert.deepEqual(metadataPointer.authority, accessControlPubkey);
    assert.deepEqual(metadataPointer.metadataAddress, mintKeypair.publicKey);

    // Retrieve and verify the metadata state
    const metadata = await getTokenMetadata(
      connection,
      mintKeypair.publicKey // Mint Account address
    );
    assert.deepEqual(metadata.mint, mintKeypair.publicKey);
    assert.deepEqual(
      metadata.updateAuthority,
      setupAccessControlArgs.authority
    );
    assert.equal(metadata.name, setupAccessControlArgs.name);
    assert.equal(metadata.symbol, setupAccessControlArgs.symbol);
    assert.equal(metadata.uri, setupAccessControlArgs.uri);
  });

  it("updates token metadata", async () => {
    // NOTE: Sol balance must be increase on mint address in order to store more metadata
    // Calculate the amount of lamports needed to store the metadata as mint account len + updateFieldInstructions.len
    await topUpWallet(connection, mintKeypair.publicKey, solToLamports(1));

    // Instruction to update metadata, adding custom fields
    const updateFieldInstructions = [
      {
        field: "version",
        value: "1",
      },
      {
        field: "email",
        value: "tokensupport@example.com",
      },
      {
        field: "discord",
        value: "https://discord.com/xyz_token",
      },
    ];

    const updateFieldInstructionsArray = updateFieldInstructions.map((field) =>
      createUpdateFieldInstruction({
        programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
        metadata: mintKeypair.publicKey, // Account address that holds the metadata
        updateAuthority: superAdmin.publicKey, // Authority that can update the metadata
        field: field.field, // key
        value: field.value, // value
      })
    );

    const transaction = new Transaction().add(...updateFieldInstructionsArray);
    const transactionSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [superAdmin],
      { commitment: commitment }
    );
    console.log("Transaction Signature", transactionSignature);

    // Retrieve the metadata state
    const metadata = await getTokenMetadata(
      connection,
      mintKeypair.publicKey // Mint Account address
    );
    const additionalMetadataMap = new Map(metadata.additionalMetadata);
    updateFieldInstructions.forEach((instruction) => {
      const { field, value } = instruction;
      expect(additionalMetadataMap.has(field)).to.be.true;
      expect(additionalMetadataMap.get(field)).to.equal(value);
    });
  });

  it("creates associated token account for user wallet", async () => {
    await mintHelper.createAssociatedTokenAccount(userWalletPubkey, superAdmin);
  });

  it("failed to mint without ReserveAdmin role", async () => {
    try {
      await accessControlHelper.mintSecurities(
        mintAmount,
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        superAdmin,
        userWalletSaaPubkey
      );
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6000);
      assert.equal(error.errorMessage, "Unauthorized");
      assert.equal(error.errorCode.code, "Unauthorized");
    }
  });

  it("assigns ReserveAdmin role to super admin", async () => {
    // Grant ReserveAdmin role (ContractAdmin is already granted during initialization)
    const assignRoleTx = await accessControlHelper.grantRole(
      superAdmin.publicKey,
      Roles.ReserveAdmin,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", assignRoleTx);

    const walletRoleData = await accessControlHelper.walletRoleData(
      authorityWalletRolePubkey
    );
    const expectedRoles = Roles.ReserveAdmin | Roles.ContractAdmin;
    assert.deepEqual(walletRoleData.role, expectedRoles);
  });

  it("fails to mint more than max total supply", async () => {
    const mintAmount = setupAccessControlArgs.maxTotalSupply.addn(1);
    try {
      await accessControlProgram.rpc.mintSecurities(mintAmount, {
        accounts: {
          authority: superAdmin.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControl: accessControlPubkey,
          securityMint: mintKeypair.publicKey,
          destinationAccount: userWalletAssociatedAccountPubkey,
          destinationAuthority: userWalletPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          securityAssociatedAccount: userWalletSaaPubkey,
        },
        signers: [superAdmin],
        instructions: [],
      });

      assert.fail("Minting more than max total supply should fail");
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6002);
      assert.equal(
        error.errorMessage,
        "Cannot mint more than max total supply"
      );
      assert.equal(error.errorCode.code, "MintExceedsMaxTotalSupply");
    }
  });

  // === TRANSFER RESTRICTIONS SETUP ===
  it("creates transfer restriction data", async () => {
    const initTransferRestrictionDataTx =
      await transferRestrictionsHelper.initializeTransferRestrictionData(
        maxHolders,
        authorityWalletRolePubkey,
        superAdmin
      );
    console.log(
      "Initialize Transfer Restrictions Data Transaction Signature",
      initTransferRestrictionDataTx
    );

    const transferRestrictionData =
      await transferRestrictionsHelper.transferRestrictionData();
    assert.deepEqual(
      transferRestrictionData.securityTokenMint,
      mintKeypair.publicKey
    );
    assert.deepEqual(
      transferRestrictionData.accessControlAccount,
      accessControlPubkey
    );
    assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
    assert.equal(
      transferRestrictionData.maxHolders.toString(),
      maxHolders.toString()
    );
    assert.equal(transferRestrictionData.lockupEscrowAccount, null);
  });

  it("assigns Transfer Admin role to user wallet", async () => {
    const newRoles = Roles.TransferAdmin;
    const txSignature = await accessControlHelper.grantRole(
      transferAdmin.publicKey,
      newRoles,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", txSignature);

    const walletRoleData = await accessControlHelper.walletRoleData(
      transferAdminRolePubkey
    );
    assert.deepEqual(walletRoleData.role, newRoles);

    await topUpWallet(
      provider.connection,
      transferAdmin.publicKey,
      solToLamports(1)
    );
  });

  it("creates transfer restriction group 1", async () => {
    const initTransferGroupTx =
      await transferRestrictionsHelper.initializeTransferRestrictionGroup(
        transferGroup1,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Initialize Transfer Restriction Group Transaction Signature",
      initTransferGroupTx
    );
    const trGroupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    assert.equal(trGroupData.id.toString(), transferGroup1.toString());
    assert.equal(trGroupData.maxHolders.toNumber(), 0);
    assert.equal(
      trGroupData.currentHoldersCount.toString(),
      Number(0).toString()
    );
    assert.deepEqual(
      trGroupData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
  });

  it("creates holder for sender", async () => {
    const initSenderHolderTx =
      await transferRestrictionsHelper.initializeTransferRestrictionHolder(
        senderHolderId,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Initialize Sender Holder Transaction Signature",
      initSenderHolderTx
    );
    const holderSenderData = await transferRestrictionsHelper.holderData(
      holderSenderPubkey
    );
    assert.equal(holderSenderData.id.toString(), senderHolderId.toString());
    assert.deepEqual(
      holderSenderData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
    assert.equal(
      holderSenderData.currentWalletsCount.toString(),
      Number(0).toString()
    );
  });

  it("creates holder group account for sender", async () => {
    const [holderGroupPubkey] = transferRestrictionsHelper.holderGroupPDA(
      holderSenderPubkey,
      transferGroup1
    );
    const [transferAdminWalletRole] = accessControlHelper.walletRolePDA(
      transferAdmin.publicKey
    );
    console.log("Holder Group Pubkey", holderGroupPubkey.toBase58());

    const initHolderGroupTx =
      await transferRestrictionsHelper.initializeHolderGroup(
        holderGroupPubkey,
        holderSenderPubkey,
        transferRestrictionGroup1Pubkey,
        transferAdminWalletRole,
        transferAdmin
      );
    console.log(
      "Initialize Holder Group Transaction Signature",
      initHolderGroupTx
    );

    const holderGroupData = await transferRestrictionsHelper.holderGroupData(
      holderGroupPubkey
    );
    assert.equal(holderGroupData.group.toString(), transferGroup1.toString());
    assert.deepEqual(holderGroupData.holder, holderSenderPubkey);
    assert.deepEqual(holderGroupData.currentWalletsCount.toNumber(), 0);

    const groupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    assert.equal(groupData.currentHoldersCount.toNumber(), 0);
  });

  const transferAdmin = Keypair.generate();
  const [transferAdminRolePubkey] = accessControlHelper.walletRolePDA(
    transferAdmin.publicKey
  );

  it("creates security associated token for sender", async () => {
    const [userWalletSenderSecurityAssociatedTokenAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletAssociatedAccountPubkey
      );
    console.log(
      "Sender Security Associated Account Pubkey",
      userWalletSenderSecurityAssociatedTokenAccountPubkey.toBase58()
    );
    const [holderGroupPubkey] = transferRestrictionsHelper.holderGroupPDA(
      holderSenderPubkey,
      transferGroup1
    );
    const initSecAssocAccountSenderTx =
      await transferRestrictionsHelper.initializeSecurityAssociatedAccount(
        transferGroup1,
        senderHolderId,
        holderGroupPubkey,
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountSenderTx
    );
    const senderSecurityAssociatedAccountData =
      await transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSenderSecurityAssociatedTokenAccountPubkey
      );
    assert.equal(
      senderSecurityAssociatedAccountData.group.toString(),
      transferGroup1.toString()
    );
    const holderSenderData = await transferRestrictionsHelper.holderData(
      holderSenderPubkey
    );
    assert.equal(holderSenderData.currentWalletsCount.toNumber(), 1);
    const holderGroupData = await transferRestrictionsHelper.holderGroupData(
      holderGroupPubkey
    );
    assert.equal(holderGroupData.currentWalletsCount.toNumber(), 1);
    const groupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    assert.equal(groupData.currentHoldersCount.toNumber(), 1);
  });

  it("mints tokens to new account", async () => {
    const mintTx = await accessControlHelper.mintSecurities(
      mintAmount,
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      superAdmin,
      userWalletSaaPubkey
    );
    console.log("Mint Securities Transaction Signature", mintTx);

    let mintData = await mintHelper.getMint();
    assert.equal(mintData.supply.toString(), mintAmount.toString());

    const assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.amount.toString(), mintAmount.toString());
  });

  it("burns token by reserve admin", async () => {
    const burnAmount = new anchor.BN(700000);
    const burnTx = await accessControlHelper.burnSecurities(
      burnAmount,
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      superAdmin
    );
    console.log("Burn Securities Transaction Signature", burnTx);

    const mintData = await mintHelper.getMint();
    assert.equal(
      mintData.supply.toString(),
      mintAmount.sub(burnAmount).toString()
    );
  });

  it("creates transfer rule 1 -> 1", async () => {
    const [transferRulePubkey] = transferRestrictionsHelper.transferRulePDA(
      transferGroup1,
      transferGroup1
    );
    console.log("Transfer Rule Pubkey", transferRulePubkey.toBase58());

    const tsNow = await getNowTs(connection);
    const lockedUntil = new anchor.BN(tsNow);
    // const lockedUntil = new anchor.BN(tsNow + 1000); // locked transfer rule
    const initTransferRuleTx =
      await transferRestrictionsHelper.initializeTransferRule(
        lockedUntil,
        transferGroup1,
        transferGroup1,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Initialize Transfer Rule Transaction Signature",
      initTransferRuleTx
    );

    const transferRuleData = await transferRestrictionsHelper.transferRuleData(
      transferRulePubkey
    );
    assert.equal(
      transferRuleData.lockedUntil.toString(),
      lockedUntil.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdFrom.toString(),
      transferGroup1.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdTo.toString(),
      transferGroup1.toString()
    );
    assert.deepEqual(
      transferRuleData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
  });

  it("creates holder for recipient", async () => {
    const initRecipientHolderTx =
      await transferRestrictionsHelper.initializeTransferRestrictionHolder(
        recipientHolderId,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Initialize Recipient Holder Transaction Signature",
      initRecipientHolderTx
    );
    const holderRecipientData = await transferRestrictionsHelper.holderData(
      holderRecipientPubkey
    );
    assert.equal(
      holderRecipientData.id.toString(),
      recipientHolderId.toString()
    );
    assert.deepEqual(
      holderRecipientData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
    assert.equal(
      holderRecipientData.currentWalletsCount.toString(),
      Number(0).toString()
    );
  });

  it("creates holder group account for recipient", async () => {
    const [holderGroupPubkey] = transferRestrictionsHelper.holderGroupPDA(
      holderRecipientPubkey,
      transferGroup1
    );
    const [transferAdminWalletRole] = accessControlHelper.walletRolePDA(
      transferAdmin.publicKey
    );

    const initHolderGroupTx =
      await transferRestrictionsHelper.initializeHolderGroup(
        holderGroupPubkey,
        holderRecipientPubkey,
        transferRestrictionGroup1Pubkey,
        transferAdminWalletRole,
        transferAdmin
      );
    console.log(
      "Initialize Holder Group Transaction Signature",
      initHolderGroupTx
    );

    const holderGroupData = await transferRestrictionsHelper.holderGroupData(
      holderGroupPubkey
    );
    assert.equal(holderGroupData.group.toString(), transferGroup1.toString());
    assert.deepEqual(holderGroupData.holder, holderRecipientPubkey);
    assert.deepEqual(holderGroupData.currentWalletsCount.toNumber(), 0);
    const groupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    assert.equal(groupData.currentHoldersCount.toNumber(), 1);
  });

  it("creates security associated token for recipient", async () => {
    await mintHelper.createAssociatedTokenAccount(
      userWalletRecipientPubkey,
      superAdmin
    );

    const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletRecipientAssociatedTokenAccountPubkey
      );
    const [holderGroupPubkey] = transferRestrictionsHelper.holderGroupPDA(
      holderRecipientPubkey,
      transferGroup1
    );

    const initSecAssocAccountRecipientTx =
      await transferRestrictionsHelper.initializeSecurityAssociatedAccount(
        transferGroup1,
        recipientHolderId,
        holderGroupPubkey,
        userWalletRecipientPubkey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountRecipientTx
    );

    const recipientSecurityAssociatedAccountData =
      await transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletRecipientSecurityAssociatedTokenAccountPubkey
      );
    assert.equal(
      recipientSecurityAssociatedAccountData.group.toString(),
      transferGroup1.toString()
    );
    const holderRecipientData = await transferRestrictionsHelper.holderData(
      holderRecipientPubkey
    );
    assert.equal(holderRecipientData.currentWalletsCount.toNumber(), 1);
    const holderGroupData = await transferRestrictionsHelper.holderGroupData(
      holderGroupPubkey
    );
    assert.equal(holderGroupData.currentWalletsCount.toNumber(), 1);

    const groupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    assert.equal(groupData.currentHoldersCount.toNumber(), 2);
  });

  it("transfers securities between wallets", async () => {
    const transferAmount = BigInt(1000);
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        userWalletAssociatedAccountPubkey,
        mintKeypair.publicKey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        userWallet.publicKey,
        transferAmount,
        decimals,
        undefined,
        commitment,
        TOKEN_2022_PROGRAM_ID
      );

    const transferWithHookTx = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(transferWithHookInstruction),
      [userWallet],
      { commitment: commitment }
    );
    console.log(
      "Transfer Securities Transaction Signature",
      transferWithHookTx
    );

    const senderAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    const recipientAccountInfo = await mintHelper.getAccount(
      userWalletRecipientAssociatedTokenAccountPubkey
    );
    assert.deepEqual(senderAccountInfo.amount, BigInt(299000));
    assert.equal(
      recipientAccountInfo.amount.toString(),
      transferAmount.toString()
    );
  });

  const reserveAdmin = Keypair.generate();
  it("assigns Reserve Admin role to new wallet", async () => {
    const newRoles = Roles.ReserveAdmin;

    const txSignature = await accessControlHelper.grantRole(
      reserveAdmin.publicKey,
      newRoles,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", txSignature);

    const [walletRolePDA] = accessControlHelper.walletRolePDA(
      reserveAdmin.publicKey
    );
    const walletRoleData = await accessControlHelper.walletRoleData(
      walletRolePDA
    );
    assert.deepEqual(walletRoleData.role, newRoles);
    await topUpWallet(
      provider.connection,
      reserveAdmin.publicKey,
      solToLamports(1)
    );
  });

  const forceTransferAmount = 1000;
  it("forces transfer between", async () => {
    let senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      commitment,
      TOKEN_2022_PROGRAM_ID
    );
    const initialSenderAmount = senderAccountInfo.amount;
    let recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      commitment,
      TOKEN_2022_PROGRAM_ID
    );
    const initialRecipientAmount = recipientAccountInfo.amount;

    const txSignature = await accessControlHelper.forceTransferBetween(
      forceTransferAmount,
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      userWalletRecipientPubkey,
      userWalletRecipientAssociatedTokenAccountPubkey,
      reserveAdmin,
      connection
    );

    console.log("Force Transfer Transaction Signature", txSignature);

    senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      commitment,
      TOKEN_2022_PROGRAM_ID
    );
    recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      commitment,
      TOKEN_2022_PROGRAM_ID
    );

    assert.deepEqual(
      senderAccountInfo.amount.toString(),
      (initialSenderAmount - BigInt(forceTransferAmount)).toString()
    );
    assert.equal(
      recipientAccountInfo.amount.toString(),
      (initialRecipientAmount + BigInt(forceTransferAmount)).toString()
    );
  });

  it("fails to freeze user wallet without Transfer role", async () => {
    let assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.isFrozen, false);
    try {
      await accessControlHelper.freezeWallet(
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        superAdmin
      );
      assert.fail("Expected error not thrown");
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6000);
      assert.equal(error.errorMessage, "Unauthorized");
      assert.equal(error.errorCode.code, "Unauthorized");
    }
  });

  it("assigns Transfer role to super admin", async () => {
    // Grant TransferAdmin role (ContractAdmin and ReserveAdmin are already granted)
    const assignRoleTx = await accessControlHelper.grantRole(
      superAdmin.publicKey,
      Roles.TransferAdmin,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", assignRoleTx);

    const walletRoleData = await accessControlHelper.walletRoleData(
      authorityWalletRolePubkey
    );
    const expectedRoles =
      Roles.ReserveAdmin | Roles.ContractAdmin | Roles.TransferAdmin;
    assert.deepEqual(walletRoleData.role, expectedRoles);
  });

  it("freezes user wallet", async () => {
    let assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.isFrozen, false);

    const freezeTx = await accessControlHelper.freezeWallet(
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      superAdmin
    );
    console.log("Freeze Wallet Transaction Signature", freezeTx);

    assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.isFrozen, true);
    assert.deepEqual(assAccountInfo.amount, BigInt(298000));
  });

  it("thaw user wallet", async () => {
    let assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      commitment,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.isFrozen, true);

    const freezeTx = await accessControlProgram.methods
      .thawWallet()
      .accountsStrict({
        authority: superAdmin.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: accessControlPubkey,
        securityMint: mintKeypair.publicKey,
        targetAccount: userWalletAssociatedAccountPubkey,
        targetAuthority: userWalletPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([superAdmin])
      .rpc({ commitment: commitment });
    console.log("Thaw Wallet Transaction Signature", freezeTx);

    assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      commitment,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.isFrozen, false);
    assert.deepEqual(assAccountInfo.amount, BigInt(298000));
  });

  it("pauses transfers", async () => {
    const pauseTransfersTx = await transferRestrictionsProgram.methods
      .pause(true)
      .accountsStrict({
        accessControlAccount: accessControlPubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        securityMint: mintKeypair.publicKey,
        authorityWalletRole: transferAdminRolePubkey,
        payer: transferAdmin.publicKey,
      })
      .signers([transferAdmin])
      .rpc({ commitment: commitment });
    console.log("Pause Transfers Transaction Signature", pauseTransfersTx);

    const transferRestrictionsData =
      await transferRestrictionsProgram.account.transferRestrictionData.fetch(
        transferRestrictionDataPubkey,
        commitment
      );
    assert.isTrue(transferRestrictionsData.paused);
  });

  it("enforces transfer restrictions", async () => {
    const [userWalletSecurityAssociatedAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletAssociatedAccountPubkey
      );
    const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletRecipientAssociatedTokenAccountPubkey
      );
    const [transferRulePubkey] = transferRestrictionsHelper.transferRulePDA(
      transferGroup1,
      transferGroup1
    );
    try {
      await transferRestrictionsProgram.methods
        .enforceTransferRestrictions()
        .accountsStrict({
          sourceAccount: userWalletAssociatedAccountPubkey,
          destinationAccount: userWalletRecipientAssociatedTokenAccountPubkey,
          mint: mintKeypair.publicKey,
          transferRestrictionData: transferRestrictionDataPubkey,
          securityAssociatedAccountFrom:
            userWalletSecurityAssociatedAccountPubkey,
          securityAssociatedAccountTo:
            userWalletRecipientSecurityAssociatedTokenAccountPubkey,
          transferRule: transferRulePubkey,
        })
        .signers([])
        .rpc({ commitment: commitment });
      expect.fail("Expected an error, but none was thrown.");
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6004);
      assert.equal(error.errorMessage, "All transfers are paused");
      assert.equal(error.errorCode.code, "AllTransfersPaused");
    }
  });

  it("failed to transfer securities when paused", async () => {
    const transferAmount = BigInt(1000);
    try {
      const transferWithHookInstruction =
        await createTransferCheckedWithTransferHookInstruction(
          provider.connection,
          userWalletAssociatedAccountPubkey,
          mintKeypair.publicKey,
          userWalletRecipientAssociatedTokenAccountPubkey,
          userWallet.publicKey,
          transferAmount,
          decimals,
          undefined,
          commitment,
          TOKEN_2022_PROGRAM_ID
        );

      await sendAndConfirmTransaction(
        connection,
        new Transaction().add(transferWithHookInstruction),
        [userWallet],
        { commitment: commitment }
      );
      expect.fail("Expected an error, but none was thrown.");
    } catch (error) {
      const errorMessage =
        "AnchorError occurred. Error Code: AllTransfersPaused. Error Number: 6004. Error Message: All transfers are paused.";
      const containsError = error.logs.some((log: string | string[]) =>
        log.includes(errorMessage)
      );
      assert.isTrue(containsError);
    }
  });

  it("unpauses transfers", async () => {
    const pauseTransfersTx = await transferRestrictionsProgram.methods
      .pause(false)
      .accountsStrict({
        accessControlAccount: accessControlPubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        securityMint: mintKeypair.publicKey,
        authorityWalletRole: transferAdminRolePubkey,
        payer: transferAdmin.publicKey,
      })
      .signers([transferAdmin])
      .rpc({ commitment: commitment });
    console.log("Pause Transfers Transaction Signature", pauseTransfersTx);

    const transferRestrictionsData =
      await transferRestrictionsProgram.account.transferRestrictionData.fetch(
        transferRestrictionDataPubkey,
        commitment
      );
    assert.isFalse(transferRestrictionsData.paused);
  });

  const transferGroup2Id = new anchor.BN(2);
  const [transferRestrictionGroup2Pubkey, transferRestrictionGroup2Bump] =
    transferRestrictionsHelper.groupPDA(transferGroup2Id);
  it("creates transfer restriction group 2", async () => {
    const initTransferGroupTx =
      await transferRestrictionsHelper.initializeTransferRestrictionGroup(
        transferGroup2Id,
        authorityWalletRolePubkey,
        superAdmin
      );
    console.log(
      "Initialize Transfer Restriction Group Transaction Signature",
      initTransferGroupTx
    );
    const trGroupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup2Pubkey
    );
    assert.equal(trGroupData.id.toString(), transferGroup2Id.toString());
    assert.equal(trGroupData.maxHolders.toNumber(), 0);
    assert.equal(
      trGroupData.currentHoldersCount.toString(),
      Number(0).toString()
    );
    assert.deepEqual(
      trGroupData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
  });

  it("initialize holder group 2", async () => {
    const [userWalletNewHolderGroupPubkey] =
      transferRestrictionsHelper.holderGroupPDA(
        holderSenderPubkey,
        transferGroup2Id
      );
    const [group2Pubkey] =
      transferRestrictionsHelper.groupPDA(transferGroup2Id);
    const [transferAdminWalletRole] = accessControlHelper.walletRolePDA(
      transferAdmin.publicKey
    );

    const initializeHolderGroupTxSignature =
      await transferRestrictionsHelper.initializeHolderGroup(
        userWalletNewHolderGroupPubkey,
        holderSenderPubkey,
        group2Pubkey,
        transferAdminWalletRole,
        transferAdmin
      );
    console.log(
      "Initialize Holder Group Transaction Signature",
      initializeHolderGroupTxSignature
    );
  });

  it("updates wallet group", async () => {
    const [groupNewPubkey] =
      transferRestrictionsHelper.groupPDA(transferGroup2Id);

    const [userWalletNewHolderGroupPubkey] =
      transferRestrictionsHelper.holderGroupPDA(
        holderSenderPubkey,
        transferGroup2Id
      );
    const [userWalletCurrentHolderGroupPubkey] =
      transferRestrictionsHelper.holderGroupPDA(
        holderSenderPubkey,
        transferGroup1
      );
    const [userWalletSecurityAssociatedAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletAssociatedAccountPubkey
      );
    const [transferAdminWalletRole] = accessControlHelper.walletRolePDA(
      transferAdmin.publicKey
    );

    let holderGroupCurrentData =
      await transferRestrictionsHelper.holderGroupData(
        userWalletCurrentHolderGroupPubkey
      );
    let holderGroupNewData = await transferRestrictionsHelper.holderGroupData(
      userWalletNewHolderGroupPubkey
    );
    assert.equal(holderGroupCurrentData.currentWalletsCount.toNumber(), 1);
    assert.equal(holderGroupNewData.currentWalletsCount.toNumber(), 0);

    let groupOldData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    const oldGroupCurrentHoldersCount =
      groupOldData.currentHoldersCount.toNumber();

    const updateWalletGroupTx =
      await transferRestrictionsHelper.updateWalletGroup(
        userWalletSecurityAssociatedAccountPubkey,
        transferRestrictionGroup1Pubkey,
        transferGroup2Id,
        userWalletCurrentHolderGroupPubkey,
        userWalletNewHolderGroupPubkey,
        transferAdminWalletRole,
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        transferAdmin
      );
    console.log(
      "Update Wallet Group Transaction Signature",
      updateWalletGroupTx
    );

    const userWalletSecurityAssociatedAccountData =
      await transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSecurityAssociatedAccountPubkey
      );
    assert.deepEqual(
      userWalletSecurityAssociatedAccountData.holder,
      holderSenderPubkey
    );
    assert.deepEqual(
      userWalletSecurityAssociatedAccountData.group.toString(),
      transferGroup2Id.toString()
    );

    holderGroupCurrentData = await transferRestrictionsHelper.holderGroupData(
      userWalletCurrentHolderGroupPubkey
    );
    holderGroupNewData = await transferRestrictionsHelper.holderGroupData(
      userWalletNewHolderGroupPubkey
    );
    assert.equal(holderGroupCurrentData.currentWalletsCount.toNumber(), 0);
    assert.equal(holderGroupNewData.currentWalletsCount.toNumber(), 1);

    groupOldData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
    );
    assert.equal(
      groupOldData.currentHoldersCount.toNumber(),
      oldGroupCurrentHoldersCount - 1
    );
  });

  it("creates transfer rule 2 -> 1", async () => {
    const [transferRulePubkey] = transferRestrictionsHelper.transferRulePDA(
      transferGroup2Id,
      transferGroup1
    );
    console.log("Transfer Rule Pubkey", transferRulePubkey.toBase58());

    const tsNow = await getNowTs(connection);
    const lockedUntil = new anchor.BN(tsNow);

    const initTransferRuleTx =
      await transferRestrictionsHelper.initializeTransferRule(
        lockedUntil,
        transferGroup2Id,
        transferGroup1,
        authorityWalletRolePubkey,
        superAdmin
      );
    console.log(
      "Initialize Transfer Rule Transaction Signature",
      initTransferRuleTx
    );

    const transferRuleData = await transferRestrictionsHelper.transferRuleData(
      transferRulePubkey
    );
    assert.equal(
      transferRuleData.lockedUntil.toString(),
      lockedUntil.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdFrom.toString(),
      transferGroup2Id.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdTo.toString(),
      transferGroup1.toString()
    );
    assert.deepEqual(
      transferRuleData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
  });

  it("transfers securities between wallets", async () => {
    const transferAmount = BigInt(1000);
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        userWalletAssociatedAccountPubkey,
        mintKeypair.publicKey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        userWallet.publicKey,
        transferAmount,
        decimals,
        undefined,
        commitment,
        TOKEN_2022_PROGRAM_ID
      );

    try {
      const transferWithHookTx = await sendAndConfirmTransaction(
        connection,
        new Transaction().add(transferWithHookInstruction),
        [userWallet],
        { commitment: commitment }
      );
      console.log(
        "Transfer Securities Transaction Signature",
        transferWithHookTx
      );
    } catch (error) {
      console.error(error);
    }

    const senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    assert.deepEqual(senderAccountInfo.amount, BigInt(297000));
    assert.equal(recipientAccountInfo.amount.toString(), "3000");
  });

  it("sets holder max count by transfer admin", async () => {
    const newMaxHolders = new anchor.BN(9999);
    const setMaxHoldersTx = await transferRestrictionsHelper.setHolderMax(
      newMaxHolders,
      accessControlHelper.walletRolePDA(transferAdmin.publicKey)[0],
      transferAdmin
    );
    console.log("Set Max Holders Transaction Signature", setMaxHoldersTx);

    const transferRestrictionData =
      await transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      transferRestrictionData.maxHolders.toString(),
      newMaxHolders.toString()
    );
  });

  it("sets holder group max count by transfer admin", async () => {
    const newMaxHolders = new anchor.BN(9999);
    const [groupPubkey] = transferRestrictionsHelper.groupPDA(transferGroup1);

    const setMaxHoldersTx = await transferRestrictionsHelper.setHolderGroupMax(
      newMaxHolders,
      transferGroup1,
      accessControlHelper.walletRolePDA(transferAdmin.publicKey)[0],
      transferAdmin
    );
    console.log("Set Group Max Holders Transaction Signature", setMaxHoldersTx);

    const groupData = await transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(groupData.maxHolders.toString(), newMaxHolders.toString());
  });

  it("sets transfer rule locked until by transfer admin", async () => {
    const [transferRulePubkey] = transferRestrictionsHelper.transferRulePDA(
      transferGroup2Id,
      transferGroup1
    );
    const tsNow = await getNowTs(connection);
    const lockedUntil = new anchor.BN(tsNow + 1000);

    const setLockedUntilTx =
      await transferRestrictionsHelper.setAllowTransferRule(
        lockedUntil,
        transferRulePubkey,
        transferGroup2Id,
        transferGroup1,
        accessControlHelper.walletRolePDA(transferAdmin.publicKey)[0],
        transferAdmin
      );
    console.log("Set Locked Until Transaction Signature", setLockedUntilTx);

    const transferRuleData = await transferRestrictionsHelper.transferRuleData(
      transferRulePubkey
    );
    assert.equal(
      transferRuleData.lockedUntil.toString(),
      lockedUntil.toString()
    );
  });

  it("revokes security associated account", async () => {
    const [groupPubkey] = transferRestrictionsHelper.groupPDA(transferGroup1);
    let groupData = await transferRestrictionsHelper.groupData(groupPubkey);
    const groupCurrentHoldersCount = groupData.currentHoldersCount.toNumber();
    const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletRecipientAssociatedTokenAccountPubkey
      );

    const revokeSecAssocAccountRecipientTx =
      await transferRestrictionsHelper.revokeSecurityAssociatedAccount(
        userWalletRecipientSecurityAssociatedTokenAccountPubkey,
        userWalletRecipientPubkey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Revoke Security Associated Account Transaction Signature",
      revokeSecAssocAccountRecipientTx
    );

    try {
      await transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletRecipientSecurityAssociatedTokenAccountPubkey
      );
      assert.fail("Expected error not thrown");
    } catch (error) {
      const errorMessage = `Error: Account does not exist or has no data ${userWalletRecipientSecurityAssociatedTokenAccountPubkey.toBase58()}`;
      assert.equal(error, errorMessage);
    }
    groupData = await transferRestrictionsHelper.groupData(groupPubkey);

    // revoking last wallet automatically leaves holder from the group
    assert.equal(
      groupData.currentHoldersCount.toNumber(),
      groupCurrentHoldersCount - 1
    );
  });

  it("revokes holder and holder group", async () => {
    let transferRestrictionData =
      await transferRestrictionsHelper.transferRestrictionData();
    const transferRestrictionHoldersCount =
      transferRestrictionData.currentHoldersCount.toNumber();

    const revokeHolderGroupTx =
      await transferRestrictionsHelper.revokeHolderGroup(
        holderRecipientPubkey,
        transferGroup1,
        transferAdminRolePubkey,
        transferAdmin
      );
    console.log(
      "Revoke Holder Group Transaction Signature",
      revokeHolderGroupTx
    );
    const [holderGroupPubkey] = transferRestrictionsHelper.holderGroupPDA(
      holderRecipientPubkey,
      transferGroup1
    );
    const holderGroupAccountInfo = await connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNull(holderGroupAccountInfo);

    const revokeHolderTx = await transferRestrictionsHelper.revokeHolder(
      holderRecipientPubkey,
      transferAdminRolePubkey,
      transferAdmin
    );
    console.log("Revoke Holder Transaction Signature", revokeHolderTx);
    const holderAccountInfo = await connection.getAccountInfo(
      holderRecipientPubkey
    );
    assert.isNull(holderAccountInfo);

    try {
      await transferRestrictionsHelper.holderGroupData(holderGroupPubkey);
      assert.fail("Expected error not thrown");
    } catch (error) {
      const errorMessage = `Error: Account does not exist or has no data ${holderGroupPubkey.toBase58()}`;
      assert.equal(error, errorMessage);
    }

    transferRestrictionData =
      await transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      transferRestrictionData.currentHoldersCount.toNumber(),
      transferRestrictionHoldersCount - 1
    );
  });
});
