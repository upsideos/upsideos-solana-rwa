import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import {
  Token2022Multisig,
  createToken2022Multisig,
  errorText,
} from "../helpers/multisig";
import { Roles } from "../helpers/access-control_helper";

describe("Token-2022 multisig signatures collected one signer at a time", () => {
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
  const amount = new anchor.BN(250_000);
  let testEnvironment: TestEnvironment;
  let multisig: Token2022Multisig;
  let multisigWalletRole: PublicKey;
  const recipient = Keypair.generate();
  let recipientTokenAccount: PublicKey;
  let recipientSaa: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    multisig = await createToken2022Multisig(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      3,
      2,
      testEnvironment.commitment
    );
    await testEnvironment.accessControlHelper.grantRole(
      multisig.publicKey,
      Roles.ReserveAdmin,
      testEnvironment.contractAdmin
    );
    [multisigWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      multisig.publicKey
    );

    const walletsAdminRole = testEnvironment.accessControlHelper.walletRolePDA(
      testEnvironment.walletsAdmin.publicKey
    )[0];
    recipientTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        recipient.publicKey,
        testEnvironment.contractAdmin
      );
    [recipientSaa] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        recipientTokenAccount
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      recipient.publicKey,
      recipientTokenAccount,
      walletsAdminRole,
      testEnvironment.walletsAdmin
    );
  });

  function signedPubkeys(transaction: Transaction): string[] {
    return transaction.signatures
      .filter((pair) => pair.signature !== null)
      .map((pair) => pair.publicKey.toBase58())
      .sort();
  }

  function handOff(transaction: Transaction): Transaction {
    return Transaction.from(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
    );
  }

  async function preparedMintTransaction(memberPubkeys: PublicKey[]): Promise<{
    transaction: Transaction;
    blockhash: string;
    lastValidBlockHeight: number;
  }> {
    const instruction =
      await testEnvironment.accessControlHelper.program.methods
        .mintSecurities(amount)
        .accountsStrict({
          authority: multisig.publicKey,
          authorityWalletRole: multisigWalletRole,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          destinationAccount: recipientTokenAccount,
          destinationAuthority: recipient.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          securityAssociatedAccount: recipientSaa,
        })
        .instruction();

    const authorityMeta = instruction.keys.find((meta) =>
      meta.pubkey.equals(multisig.publicKey)
    );
    if (!authorityMeta) {
      throw new Error("instruction is missing the multisig authority");
    }
    authorityMeta.isSigner = false;
    for (const member of memberPubkeys) {
      instruction.keys.push({
        pubkey: member,
        isSigner: true,
        isWritable: false,
      });
    }

    const { blockhash, lastValidBlockHeight } =
      await testEnvironment.connection.getLatestBlockhash(
        testEnvironment.commitment
      );
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = testEnvironment.contractAdmin.publicKey;
    transaction.recentBlockhash = blockhash;
    return { transaction, blockhash, lastValidBlockHeight };
  }

  async function recipientBalance(): Promise<bigint> {
    const account = await testEnvironment.mintHelper.getAccount(
      recipientTokenAccount
    );
    return account.amount;
  }

  it("does not mint when the handed-off transaction has only one member signature", async () => {
    const firstMember = multisig.members[0];
    const secondMember = multisig.members[2];
    const { transaction } = await preparedMintTransaction([
      firstMember.publicKey,
      secondMember.publicKey,
    ]);

    transaction.partialSign(firstMember);
    const receivedByFeePayer = handOff(transaction);
    assert.deepEqual(signedPubkeys(receivedByFeePayer), [
      firstMember.publicKey.toBase58(),
    ]);

    receivedByFeePayer.partialSign(testEnvironment.contractAdmin);
    try {
      await testEnvironment.connection.sendRawTransaction(
        receivedByFeePayer.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
      );
      assert.fail("a single member signature was enough to mint");
    } catch (error) {
      if (error.message === "a single member signature was enough to mint") {
        throw error;
      }
      assert.include(
        errorText(error).toLowerCase(),
        "signature verification",
        `expected the cluster to reject the partial transaction, got: ${errorText(
          error
        )}`
      );
    }

    assert.equal(await recipientBalance(), BigInt(0));
  });

  it("mints after each of two members signs the same transaction separately", async () => {
    const firstMember = multisig.members[0];
    const secondMember = multisig.members[2];
    const { transaction, blockhash, lastValidBlockHeight } =
      await preparedMintTransaction([
        firstMember.publicKey,
        secondMember.publicKey,
      ]);

    transaction.partialSign(firstMember);
    const receivedBySecondMember = handOff(transaction);
    assert.deepEqual(signedPubkeys(receivedBySecondMember), [
      firstMember.publicKey.toBase58(),
    ]);

    receivedBySecondMember.partialSign(secondMember);
    const receivedByFeePayer = handOff(receivedBySecondMember);
    assert.deepEqual(
      signedPubkeys(receivedByFeePayer),
      [
        firstMember.publicKey.toBase58(),
        secondMember.publicKey.toBase58(),
      ].sort()
    );

    receivedByFeePayer.partialSign(testEnvironment.contractAdmin);
    const supplyBefore = (await testEnvironment.mintHelper.getMint()).supply;
    const signature = await testEnvironment.connection.sendRawTransaction(
      receivedByFeePayer.serialize()
    );
    const confirmation = await testEnvironment.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      testEnvironment.commitment
    );
    assert.isNull(confirmation.value.err);

    assert.equal(await recipientBalance(), BigInt(amount.toString()));
    const supplyAfter = (await testEnvironment.mintHelper.getMint()).supply;
    assert.equal(supplyAfter - supplyBefore, BigInt(amount.toString()));
  });
});
