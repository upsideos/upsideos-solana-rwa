import * as dotenv from "dotenv";
dotenv.config();
import { options } from "./commands";
import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { getConfig } from "./config";
import * as fs from "fs";
import {
  generateOrGetKeypair,
  getAccessControlProgram,
  getTokenlockProgram,
  getTransferRestrictionsProgram,
  loadKeypairFromFile,
  readPubkeyFromFile,
  savePubkeyToFile,
  setupAccessControlData,
  revokeContractAdminRole,
} from "./helpers";
import { AccessControlHelper } from "../tests/helpers/access-control_helper";
import { TransferRestrictionsHelper } from "../tests/helpers/transfer-restrictions_helper";
import { createAccount } from "../tests/utils";
import { MintHelper } from "../tests/helpers/mint_helper";
import { initializeTokenlock } from "../tests/helpers/tokenlock_helper";

const config = getConfig(options.cluster, process.env.RPC_URL);

const mintKeypairPath = `deploy/${config.cluster}/keys/mint.json`;
const tokenlockDataPubkeyPath = `deploy/${config.cluster}/keys/tokenlock-data-pubkey.json`;
const deployerKeypairPath = `deploy/${config.cluster}/keys/deployer.json`;
console.log("Mint Keypair Path:", mintKeypairPath);
console.log("Tokenlock Data Pubkey Path:", tokenlockDataPubkeyPath);
console.log("Deployer Keypair Path:", deployerKeypairPath);

const deployerKeypair = loadKeypairFromFile(deployerKeypairPath);
const wallet = new Wallet(deployerKeypair);
const commitment = config.commitment as Commitment;
const connection = new Connection(config.rpcUrl, commitment);
const provider = new AnchorProvider(connection, wallet, { commitment });

const tokenlockProgram = getTokenlockProgram(provider);
const accessControlProgram = getAccessControlProgram(provider);
const transferRestrictionsProgram = getTransferRestrictionsProgram(provider);

const consoleLine = (symbol: string = "*") => console.log(symbol.repeat(50));

(async () => {
  consoleLine();
  console.log("Loading deployer keypair...");
  console.log("Deployer Keypair:", deployerKeypair.publicKey.toBase58());
  console.log("rpcUrl:", config.rpcUrl);
  console.log(
    "Access Control Program ID:",
    accessControlProgram.programId.toBase58()
  );
  console.log(
    "Transfer Restrictions Program ID:",
    transferRestrictionsProgram.programId.toBase58()
  );
  console.log("Tokenlock Program ID:", tokenlockProgram.programId.toBase58());
  consoleLine();
  console.log(
    "1. Deploying Token, Access Control program data and extra metas account..."
  );
  const setupAccessControlArgs = {
    decimals: config.mint.decimals,
    payer: deployerKeypair.publicKey,
    authority: deployerKeypair.publicKey,
    name: config.mint.name,
    uri: config.mint.uri,
    symbol: config.mint.symbol,
    hookProgramId: transferRestrictionsProgram.programId,
    maxTotalSupply: new anchor.BN(config.maxTotalSupply),
  };

  const mintKeypair = generateOrGetKeypair(mintKeypairPath);
  console.log("Mint PublicKey:", mintKeypair.publicKey.toBase58());
  const accessControlHelper = new AccessControlHelper(
    accessControlProgram,
    mintKeypair.publicKey,
    commitment
  );
  console.log(
    "Access Control Pubkey:",
    accessControlHelper.accessControlPubkey.toBase58()
  );

  const transferRestrictionsHelper = new TransferRestrictionsHelper(
    transferRestrictionsProgram,
    mintKeypair.publicKey,
    accessControlHelper.accessControlPubkey,
    commitment
  );
  console.log(
    "Transfer Restrictions Data Pubkey:",
    transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
  );
  await setupAccessControlData(
    setupAccessControlArgs,
    accessControlHelper,
    transferRestrictionsHelper,
    connection,
    mintKeypair,
    deployerKeypair
  );
  consoleLine();
  console.log("2. Deploying Transfer Restrictions program data...");
  const transferRestrictionsAccountInfo = await connection.getAccountInfo(
    transferRestrictionsHelper.transferRestrictionDataPubkey
  );
  if (transferRestrictionsAccountInfo === null) {
    console.log(
      "Deploying Transfer Restrictions data...",
      transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
    );
    transferRestrictionsHelper.initializeTransferRestrictionData(
      new anchor.BN(config.maxHolders),
      accessControlHelper.walletRolePDA(deployerKeypair.publicKey)[0],
      deployerKeypair
    );
  } else {
    console.log(
      "Transfer Restrictions data already deployed:",
      transferRestrictionsHelper.transferRestrictionDataPubkey.toBase58()
    );
  }

  consoleLine();
  console.log("3. Assigning wallet roles if it is required...");
  for (const admin of config.admins) {
    const adminPubkey = new PublicKey(admin.key);
    const accountInfo = await connection.getAccountInfo(
      accessControlHelper.walletRolePDA(adminPubkey)[0]
    );
    if (accountInfo === null) {
      console.log("Assigning wallet role to", adminPubkey.toBase58());
      await accessControlHelper.grantRole(
        adminPubkey,
        admin.role,
        deployerKeypair
      );
    } else {
      console.log("Wallet role already assigned to", adminPubkey.toBase58());
    }
  }
  consoleLine();
  console.log("4. Setting up tokenlock data if it is required...");
  // check if file exists
  let tokenlockDataPubkey: PublicKey;
  if (fs.existsSync(tokenlockDataPubkeyPath) == false) {
    console.log("Creating tokenlock data account...");
    tokenlockDataPubkey = await createAccount(
      connection,
      deployerKeypair,
      config.tokenlock.space,
      tokenlockProgram.programId
    );
    savePubkeyToFile(tokenlockDataPubkey, tokenlockDataPubkeyPath);
  } else {
    console.log("Tokenlock data account already created... Loading from file");
    tokenlockDataPubkey = readPubkeyFromFile(tokenlockDataPubkeyPath);
  }

  console.log("tokenlockData pubkey:", tokenlockDataPubkey.toBase58());
  const [escrowOwnerPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("tokenlock"),
      mintKeypair.publicKey.toBuffer(),
      tokenlockDataPubkey.toBuffer(),
    ],
    tokenlockProgram.programId
  );
  const mintHelper = new MintHelper(
    connection,
    mintKeypair.publicKey,
    commitment
  );
  const escrowAccount = mintHelper.getAssocciatedTokenAddress(
    escrowOwnerPubkey,
    true
  );
  const escrowAccountInfo = await connection.getAccountInfo(escrowAccount);
  if (escrowAccountInfo === null) {
    console.log("Creating escrow account...", escrowAccount.toBase58());
    await mintHelper.createAssociatedTokenAccount(
      escrowOwnerPubkey,
      deployerKeypair,
      true
    );
  } else {
    console.log("Escrow account already created:", escrowAccount.toBase58());
  }

  console.log("Checking tokenlock data...");
  let tokenlockData = null;
  try {
    tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
  } catch (error) {
    console.log("Tokenlock data not found:", tokenlockDataPubkey.toBase58());
  }

  if (
    tokenlockData === null ||
    tokenlockData.mintAddress?.toString() != mintKeypair.publicKey.toString() ||
    tokenlockData.accessControl?.toString() !=
    accessControlHelper.accessControlPubkey.toString() ||
    tokenlockData.transferRestrictionsData?.toString() !=
    transferRestrictionsHelper.transferRestrictionDataPubkey.toString() ||
    tokenlockData.escrowAccount.toString() != escrowAccount.toString()
  ) {
    console.log("Initializing tokenlock data...");
    try {
      await initializeTokenlock(
        tokenlockProgram,
        new anchor.BN(config.tokenlock.maxReleaseDelay),
        new anchor.BN(config.tokenlock.minTimelockAmount),
        tokenlockDataPubkey,
        escrowAccount,
        transferRestrictionsHelper.transferRestrictionDataPubkey,
        mintKeypair.publicKey,
        accessControlHelper.walletRolePDA(deployerKeypair.publicKey)[0],
        accessControlHelper.accessControlPubkey,
        deployerKeypair
      );
    } catch (error) {
      console.log(error);
    }
  } else {
    console.log(
      "Tokenlock data already initialized and data is the same:",
      tokenlockDataPubkey.toBase58()
    );
  }

  consoleLine();
  console.log(
    "5. Setting up tokenlock escrow account into TransferRestrictions data..."
  );
  const transferRestrictionsData =
    await transferRestrictionsHelper.transferRestrictionData();
  if (
    transferRestrictionsData.lockupEscrowAccount == null ||
    transferRestrictionsData.lockupEscrowAccount.toString() !=
    escrowAccount.toString()
  ) {
    console.log(
      "Lockup escrow account is not set in TransferRestrictions data",
      transferRestrictionsData.lockupEscrowAccount?.toString(),
      " ==> ",
      escrowAccount.toString()
    );
    await transferRestrictionsHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      accessControlHelper.walletRolePDA(deployerKeypair.publicKey)[0],
      deployerKeypair
    );
  } else {
    console.log(
      "Lockup escrow account already set in TransferRestrictions data:",
      escrowAccount.toString()
    );
  }
  consoleLine();
  console.log(
    "6. Setting up tokenlock escrow account into AccessControl data..."
  );
  const accessControlData = await accessControlHelper.accessControlData();
  if (
    accessControlData.lockupEscrowAccount == null ||
    transferRestrictionsData.lockupEscrowAccount.toString() !=
    escrowAccount.toString()
  ) {
    console.log(
      "Lockup escrow account is not set in AccessControl data",
      accessControlData.lockupEscrowAccount?.toString(),
      " ==> ",
      escrowAccount.toString()
    );
    await accessControlHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      deployerKeypair
    );
  } else {
    console.log(
      "Lockup escrow account already set in AccessControl data:",
      escrowAccount.toString()
    );
  }
  consoleLine();
  console.log(
    "7. Revoking ContractAdmin role from deployer and validating..."
  );
  await revokeContractAdminRole(accessControlHelper, deployerKeypair);
  consoleLine();
  console.log("=== FINISH ===");
  const accessControlDataFinal = await accessControlHelper.accessControlData();
  const transferRestrictionDataFinal =
    await transferRestrictionsHelper.transferRestrictionData();
  consoleLine("-");
  console.log("Access Control Data:", JSON.stringify(accessControlDataFinal));
  consoleLine("-");
  console.log(
    "Transfer Restrictions Data:",
    JSON.stringify(transferRestrictionDataFinal)
  );
  consoleLine("-");
  const tokenlockDataFinal = await tokenlockProgram.account.tokenLockData.fetch(
    tokenlockDataPubkey
  );
  console.log("Tokenlock Data:", JSON.stringify(tokenlockDataFinal));
  consoleLine("-");
})();
