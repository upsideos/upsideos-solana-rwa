import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { Commitment, Connection } from "@solana/web3.js";
import {
  createMultisig,
  getMultisig,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

export class Token2022Multisig {
  keypair: Keypair;
  publicKey: PublicKey;
  members: Keypair[];
  m: number;

  constructor(keypair: Keypair, members: Keypair[], m: number) {
    this.keypair = keypair;
    this.publicKey = keypair.publicKey;
    this.members = members;
    this.m = m;
  }
}

export async function createToken2022Multisig(
  connection: Connection,
  payer: Keypair,
  memberCount: number,
  m: number,
  commitment: Commitment = "confirmed"
): Promise<Token2022Multisig> {
  const keypair = Keypair.generate();
  const members = Array.from({ length: memberCount }, () => Keypair.generate());
  await createMultisig(
    connection,
    payer,
    members.map((member) => member.publicKey),
    m,
    keypair,
    { commitment },
    TOKEN_2022_PROGRAM_ID
  );
  const account = await getMultisig(
    connection,
    keypair.publicKey,
    commitment,
    TOKEN_2022_PROGRAM_ID
  );
  if (!account.isInitialized || account.m !== m || account.n !== memberCount) {
    throw new Error(
      `Token-2022 multisig was not created as ${m}-of-${memberCount}`
    );
  }
  return new Token2022Multisig(keypair, members, m);
}

/**
 * Send an instruction the way SPL Token expects a multisig authority:
 * the multisig account is not a signer, and the provided member accounts are.
 */
export async function sendAsSplMultisig(
  connection: Connection,
  instruction: TransactionInstruction,
  multisig: PublicKey,
  members: Keypair[],
  feePayer: Keypair,
  commitment: Commitment = "confirmed",
  prepend: TransactionInstruction[] = []
): Promise<string> {
  const authorityMeta = instruction.keys.find((meta) =>
    meta.pubkey.equals(multisig)
  );
  if (!authorityMeta) {
    throw new Error("instruction is missing the multisig authority");
  }
  authorityMeta.isSigner = false;
  for (const member of members) {
    instruction.keys.push({
      pubkey: member.publicKey,
      isSigner: true,
      isWritable: false,
    });
  }

  const transaction = new Transaction().add(...prepend, instruction);
  transaction.feePayer = feePayer.publicKey;
  return sendAndConfirmTransaction(
    connection,
    transaction,
    [feePayer, ...members],
    {
      commitment,
    }
  );
}

export function errorText(error: any): string {
  const logs = Array.isArray(error?.logs) ? error.logs.join("\n") : "";
  return `${error?.toString?.() ?? ""}\n${logs}`;
}

export function authoritySignerRejected(error: any): boolean {
  const text = errorText(error);
  return (
    text.includes("AccountNotSigner") ||
    text.includes("The given account did not sign") ||
    text.includes("ConstraintSigner") ||
    text.includes("A signer constraint was violated") ||
    text.includes("missing required signature") ||
    text.includes("Signature verification failed")
  );
}
