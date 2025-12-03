/**
 * Test setup utilities for @upsideos/solana-rwa
 *
 * This file provides test helpers following the pattern used in
 * https://github.com/solana-program/token-2022/blob/main/clients/js/test/_setup.ts
 */

import { getCreateAccountInstruction } from '@solana-program/system';
import {
  Address,
  BaseTransactionMessage,
  Commitment,
  Instruction,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionMessageWithBlockhashLifetime,
  TransactionMessageWithFeePayer,
  TransactionSigner,
  airdropFactory,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

export type Client = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

/**
 * Create a Solana client connected to a local test validator.
 * Expects a validator running on http://127.0.0.1:8899
 */
export const createDefaultSolanaClient = (): Client => {
  const rpc = createSolanaRpc('http://127.0.0.1:8899');
  const rpcSubscriptions = createSolanaRpcSubscriptions('ws://127.0.0.1:8900');
  return { rpc, rpcSubscriptions };
};

/**
 * Generate a new keypair signer and fund it with SOL via airdrop.
 *
 * @param client - The Solana client
 * @param putativeLamports - Amount of lamports to airdrop (default: 1 SOL)
 * @returns A funded keypair signer
 */
export const generateKeyPairSignerWithSol = async (
  client: Client,
  putativeLamports: bigint = 1_000_000_000n
) => {
  const signer = await generateKeyPairSigner();
  await airdropFactory(client)({
    recipientAddress: signer.address,
    lamports: lamports(putativeLamports),
    commitment: 'confirmed',
  });
  return signer;
};

/**
 * Create a default transaction message with a fee payer and blockhash lifetime.
 *
 * @param client - The Solana client
 * @param feePayer - The transaction fee payer
 * @returns A transaction message ready for instructions
 */
export const createDefaultTransaction = async (
  client: Client,
  feePayer: TransactionSigner
) => {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
  );
};

/**
 * Sign and send a transaction, waiting for confirmation.
 *
 * @param client - The Solana client
 * @param transactionMessage - The transaction message to send
 * @param commitment - Confirmation commitment level (default: 'confirmed')
 * @returns The transaction signature
 */
export const signAndSendTransaction = async (
  client: Client,
  transactionMessage: BaseTransactionMessage &
    TransactionMessageWithFeePayer &
    TransactionMessageWithBlockhashLifetime,
  commitment: Commitment = 'confirmed'
) => {
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirmTransactionFactory(client)(signedTransaction, {
    commitment,
  });
  return signature;
};

/**
 * Send and confirm a set of instructions as a transaction.
 *
 * @param client - The Solana client
 * @param payer - The transaction fee payer
 * @param instructions - The instructions to include in the transaction
 * @returns The transaction signature
 */
export const sendAndConfirmInstructions = async (
  client: Client,
  payer: TransactionSigner,
  instructions: Instruction[]
) => {
  const signature = await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  return signature;
};

/**
 * Get the minimum balance for rent exemption for a given data size.
 *
 * @param client - The Solana client
 * @param dataSize - The size of the account data in bytes
 * @returns The minimum lamports required for rent exemption
 */
export const getMinimumBalanceForRentExemption = async (
  client: Client,
  dataSize: bigint
): Promise<bigint> => {
  return await client.rpc.getMinimumBalanceForRentExemption(dataSize).send();
};

/**
 * Create an account with the given parameters.
 *
 * @param client - The Solana client
 * @param payer - The transaction fee payer
 * @param newAccount - The signer for the new account
 * @param space - The space to allocate for the account
 * @param programAddress - The program that will own the account
 * @returns The transaction signature
 */
export const createAccount = async (
  client: Client,
  payer: TransactionSigner,
  newAccount: TransactionSigner,
  space: number,
  programAddress: Address
) => {
  const rent = await getMinimumBalanceForRentExemption(client, BigInt(space));
  const instruction = getCreateAccountInstruction({
    payer,
    newAccount,
    lamports: rent,
    space,
    programAddress,
  });
  return sendAndConfirmInstructions(client, payer, [instruction]);
};

/**
 * Wait for a specified number of milliseconds.
 * Useful for waiting between test operations.
 *
 * @param ms - The number of milliseconds to wait
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check if a given address exists on-chain and has data.
 *
 * @param client - The Solana client
 * @param address - The address to check
 * @returns True if the account exists and has data
 */
export const accountExists = async (
  client: Client,
  address: Address
): Promise<boolean> => {
  const account = await client.rpc
    .getAccountInfo(address, { encoding: 'base64' })
    .send();
  return account.value !== null && account.value.data.length > 0;
};

