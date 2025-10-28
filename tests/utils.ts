import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import type { Commitment, Finality, Signer } from "@solana/web3.js";

export async function topUpWallet(
  connection: Connection,
  address: PublicKey,
  lamports: number
) {
  await connection.confirmTransaction(
    await connection.requestAirdrop(address, lamports),
    "confirmed"
  );
}

export function solToLamports(sol: number): number {
  return sol * LAMPORTS_PER_SOL;
}

export async function createAccount(
  connection: Connection,
  signer: Signer,
  space: number,
  programId = undefined,
  commitment: Commitment = "confirmed"
): Promise<PublicKey | null> {
  const newAccount = Keypair.generate();
  const balanceNeeded = await connection.getMinimumBalanceForRentExemption(
    space
  );
  const instruction = SystemProgram.createAccount({
    fromPubkey: signer.publicKey,
    newAccountPubkey: newAccount.publicKey,
    lamports: balanceNeeded,
    space,
    programId,
  });

  const res = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [signer, newAccount],
    { commitment }
  );
  if (res) {
    return newAccount.publicKey;
  }
  return null;
}

export async function createAccountWithSeed(
  connection: Connection,
  programId: PublicKey,
  payer: Keypair,
  seed: string,
  space: number,
  extLamports: number,
  commitment: Commitment = "confirmed"
): Promise<PublicKey> {
  const pubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    programId
  );
  const accInfo = await connection.getAccountInfo(pubkey);
  if (accInfo != null) return pubkey;

  const fee = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: pubkey,
      basePubkey: payer.publicKey,
      seed,
      space,
      lamports: fee + extLamports,
      programId,
    })
  );
  // Execute the transaction against the cluster.
  await sendAndConfirmTransaction(connection, tx, [payer], { commitment });
  return pubkey;
}

export async function getTransactionComputeUnits(
  connection: Connection,
  txSignature: string,
  commitment: Finality = "confirmed"
) {
  const result = await connection.getTransaction(txSignature, {
    commitment,
  });
  const txLogs = result.meta.logMessages;
  if (!txLogs) throw new Error("No logs found in transaction");
  const computeUnitsLogs = txLogs[txLogs.length - 2];
  if (!computeUnitsLogs) throw new Error("No compute units found in logs");
  const amtStr = computeUnitsLogs.split(" ")[3];
  if (!amtStr) throw new Error("No amount found in compute units logs");

  return parseInt(amtStr);
}
