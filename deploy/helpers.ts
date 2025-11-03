import {
  AccessControlHelper,
  SetupAccessControlArgs,
} from "../tests/helpers/access-control_helper";
import {
  PublicKey,
  Keypair,
  Transaction,
  Connection,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { TransferRestrictionsHelper } from "../tests/helpers/transfer-restrictions_helper";
import * as fs from "fs";
import * as path from "path";
import { Program, Idl, Provider } from "@coral-xyz/anchor";
import {
  AccessControlIdl,
  AccessControlIdlTypes,
  TransferRestrictionsIdl,
  TransferRestrictionsIdlTypes,
  TokenlockIdl,
  TokenlockIdlTypes,
  DividendsIdl,
  DividendsIdlTypes,
} from "../app/src";

export const getAccessControlProgram = (provider: Provider) =>
  new Program(
    AccessControlIdl as Idl,
    provider
  ) as unknown as Program<AccessControlIdlTypes>;
export const getTransferRestrictionsProgram = (provider: Provider) =>
  new Program(
    TransferRestrictionsIdl as Idl,
    provider
  ) as unknown as Program<TransferRestrictionsIdlTypes>;
export const getTokenlockProgram = (provider: Provider) =>
  new Program(
    TokenlockIdl as Idl,
    provider
  ) as unknown as Program<TokenlockIdlTypes>;
export const getDividendsProgram = (provider: Provider) =>
  new Program(
    DividendsIdl as Idl,
    provider
  ) as unknown as Program<DividendsIdlTypes>;

export function loadKeypairFromFile(filePath: string): Keypair {
  const fullPath = path.resolve(filePath);
  console.log("Loading keypair from:", fullPath);
  const secretKeyString = fs.readFileSync(fullPath, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

export function generateOrGetKeypair(path: string): Keypair {
  if (fs.existsSync(path)) {
    return loadKeypairFromFile(path);
  } else {
    const mintKeypair = Keypair.generate();
    fs.writeFileSync(path, JSON.stringify(Array.from(mintKeypair.secretKey)));
    return mintKeypair;
  }
}

export function savePubkeyToFile(pubkey: PublicKey, path: string) {
  fs.writeFileSync(path, JSON.stringify(pubkey.toBase58()));
}

export function readPubkeyFromFile(path: string): PublicKey {
  const data = fs.readFileSync(path, "utf8");

  const publicKeyString = JSON.parse(data);
  return new PublicKey(publicKeyString);
}

export async function setupAccessControlData(
  setupAccessControlArgs: SetupAccessControlArgs,
  accessControlHelper: AccessControlHelper,
  transferRestrictionsHelper: TransferRestrictionsHelper,
  connection: Connection,
  mintKeypair: Keypair,
  signer: Keypair
) {
  const [contractAdminRolePubkey] = accessControlHelper.walletRolePDA(
    signer.publicKey
  );
  const initializeAccessControlInstr =
    accessControlHelper.initializeAccessControlInstruction(
      setupAccessControlArgs
    );

  const initializeExtraAccountMetaListInstr =
    transferRestrictionsHelper.initializeExtraMetasAccount(
      signer.publicKey,
      contractAdminRolePubkey
    );

  let instructions = [];
  const accessControlDataInfo = await connection.getAccountInfo(
    accessControlHelper.accessControlPubkey
  );
  if (accessControlDataInfo === null) {
    console.log(
      "Deploying Access Control data...",
      accessControlHelper.accessControlPubkey.toBase58()
    );
    instructions.push(initializeAccessControlInstr);
  }
  let extraMetasAccountInfo = await connection.getAccountInfo(
    transferRestrictionsHelper.extraMetasAccountPDA()[0]
  );
  if (extraMetasAccountInfo === null) {
    console.log(
      "Deploying Extra Metas Account data...",
      transferRestrictionsHelper.extraMetasAccountPDA()[0].toBase58()
    );
    instructions.push(initializeExtraAccountMetaListInstr);
  }
  if (instructions.length === 0) {
    console.log(
      "Access Control data and Extra Metas Account already deployed:",
      accessControlHelper.accessControlPubkey.toBase58(),
      transferRestrictionsHelper.extraMetasAccountPDA()[0].toBase58()
    );
    return;
  }

  // Add instructions to new transaction
  const transaction = new Transaction().add(...instructions);

  // Send transaction
  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [signer, mintKeypair], // Signers
    { commitment: accessControlHelper.commitment }
  );
  console.log(
    "Setup Mint, AccessControl and TransferRestriction data Transaction Signature",
    transactionSignature
  );
}

export async function revokeContractAdminRole(
  accessControlHelper: AccessControlHelper,
  deployerKeypair: Keypair
): Promise<void> {
  const contractAdminRole = 1; // Roles.ContractAdmin
  const deployerWalletRolePubkey =
    accessControlHelper.walletRolePDA(deployerKeypair.publicKey)[0];
  const deployerWalletRoleBefore = await accessControlHelper.walletRoleData(
    deployerWalletRolePubkey
  );
  console.log(
    "Deployer wallet role before revocation:",
    deployerWalletRoleBefore.role.toString()
  );

  // Check if deployer has ContractAdmin role (role = 1)
  const hasContractAdmin =
    (deployerWalletRoleBefore.role & contractAdminRole) === contractAdminRole;

  if (hasContractAdmin) {
    console.log("Revoking ContractAdmin role from deployer...");
    await accessControlHelper.revokeRole(
      deployerKeypair.publicKey,
      contractAdminRole, // ContractAdmin role
      deployerKeypair
    );
    console.log("ContractAdmin role revoked successfully");

    // Validate that role is now 0 (ContractAdmin bit removed)
    const deployerWalletRoleAfter = await accessControlHelper.walletRoleData(
      deployerWalletRolePubkey
    );
    console.log(
      "Deployer wallet role after revocation:",
      deployerWalletRoleAfter.role.toString()
    );

    // Validate that role is now 0
    if (deployerWalletRoleAfter.role === 0) {
      console.log("✓ Validation successful: Deployer role is now 0");
    } else {
      console.log(
        "✗ Validation failed: Deployer role is",
        deployerWalletRoleAfter.role.toString(),
        "expected 0"
      );
      throw new Error(
        "Role validation failed: expected 0, got " +
          deployerWalletRoleAfter.role.toString()
      );
    }
  } else {
    console.log(
      "Deployer does not have ContractAdmin role (role:",
      deployerWalletRoleBefore.role.toString(),
      "), skipping revocation"
    );

    // Validate that role is already 0
    if (deployerWalletRoleBefore.role === 0) {
      console.log("✓ Validation: Deployer role is already 0");
    } else {
      console.log(
        "⚠ Warning: Deployer role is not 0 but ContractAdmin is not set (role:",
        deployerWalletRoleBefore.role.toString(),
        ")"
      );
    }
  }
}
