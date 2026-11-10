import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  addExtraAccountMetasForExecute,
  getMint,
  getTransferHook,
} from "@solana/spl-token";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import {
  Token2022Multisig,
  authoritySignerRejected,
  createToken2022Multisig,
  errorText,
  sendAsSplMultisig,
} from "../helpers/multisig";
import { Roles } from "../helpers/access-control_helper";

describe("Token-2022 multisig as reserve admin", () => {
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
  const amount = new anchor.BN(1_000_000);
  let testEnvironment: TestEnvironment;
  let multisig: Token2022Multisig;
  let multisigWalletRole: PublicKey;
  const recipient = Keypair.generate();
  const target = Keypair.generate();
  let recipientTokenAccount: PublicKey;
  let targetTokenAccount: PublicKey;
  let recipientSaa: PublicKey;
  let targetSaa: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    multisig = await createToken2022Multisig(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      2,
      2,
      testEnvironment.commitment
    );
    const multisigInfo = await testEnvironment.connection.getAccountInfo(
      multisig.publicKey
    );
    assert.equal(
      multisigInfo.owner.toBase58(),
      TOKEN_2022_PROGRAM_ID.toBase58()
    );

    await testEnvironment.accessControlHelper.grantRole(
      multisig.publicKey,
      Roles.ReserveAdmin,
      testEnvironment.contractAdmin
    );
    [multisigWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      multisig.publicKey
    );
    const role = await testEnvironment.accessControlHelper.walletRoleData(
      multisigWalletRole
    );
    assert.equal(role.owner.toBase58(), multisig.publicKey.toBase58());
    assert.equal(role.role, Roles.ReserveAdmin);

    const walletsAdminRole = testEnvironment.accessControlHelper.walletRolePDA(
      testEnvironment.walletsAdmin.publicKey
    )[0];
    recipientTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        recipient.publicKey,
        testEnvironment.contractAdmin
      );
    targetTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        target.publicKey,
        testEnvironment.contractAdmin
      );
    [recipientSaa] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        recipientTokenAccount
      );
    [targetSaa] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        targetTokenAccount
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      recipient.publicKey,
      recipientTokenAccount,
      walletsAdminRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      target.publicKey,
      targetTokenAccount,
      walletsAdminRole,
      testEnvironment.walletsAdmin
    );
  });

  async function mintInstruction() {
    return testEnvironment.accessControlHelper.program.methods
      .mintSecurities(amount)
      .accountsStrict({
        authority: multisig.publicKey,
        authorityWalletRole: multisigWalletRole,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        securityMint: testEnvironment.mintKeypair.publicKey,
        destinationAccount: recipientTokenAccount,
        destinationAuthority: recipient.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        securityAssociatedAccount: recipientSaa,
      })
      .instruction();
  }

  async function burnInstruction(burnAmount: anchor.BN = amount) {
    return testEnvironment.accessControlHelper.program.methods
      .burnSecurities(burnAmount)
      .accountsStrict({
        authority: multisig.publicKey,
        authorityWalletRole: multisigWalletRole,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        securityMint: testEnvironment.mintKeypair.publicKey,
        targetAccount: recipientTokenAccount,
        targetAuthority: recipient.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  }

  async function forceTransferInstruction(transferAmount: anchor.BN) {
    const instruction =
      await testEnvironment.accessControlHelper.program.methods
        .forceTransferBetween(transferAmount)
        .accountsStrict({
          authority: multisig.publicKey,
          authorityWalletRole: multisigWalletRole,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          sourceAccount: recipientTokenAccount,
          sourceAuthority: recipient.publicKey,
          destinationAccount: targetTokenAccount,
          destinationAuthority: target.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

    const mintInfo = await getMint(
      testEnvironment.connection,
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.commitment,
      TOKEN_2022_PROGRAM_ID
    );
    const transferHook = getTransferHook(mintInfo);
    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      instruction,
      transferHook.programId,
      recipientTokenAccount,
      testEnvironment.mintKeypair.publicKey,
      targetTokenAccount,
      recipient.publicKey,
      BigInt(transferAmount.toString()),
      testEnvironment.commitment
    );
    return instruction;
  }

  async function expectMultisigRejected(
    instruction: TransactionInstruction,
    members: Keypair[]
  ) {
    try {
      await sendAsSplMultisig(
        testEnvironment.connection,
        instruction,
        multisig.publicKey,
        members,
        testEnvironment.contractAdmin,
        testEnvironment.commitment
      );
      assert.fail("Token-2022 multisig authorization was accepted");
    } catch (error) {
      if (error.message === "Token-2022 multisig authorization was accepted") {
        throw error;
      }
      assert.isTrue(
        authoritySignerRejected(error),
        `expected the multisig check to reject the authority, got: ${errorText(
          error
        )}`
      );
    }
  }

  it("rejects mint_securities signed by one multisig member", async () => {
    await expectMultisigRejected(await mintInstruction(), [
      multisig.members[0],
    ]);
  });

  it("rejects burn_securities signed by one multisig member", async () => {
    await expectMultisigRejected(await burnInstruction(), [
      multisig.members[0],
    ]);
  });

  it("rejects force_transfer signed by one multisig member", async () => {
    await expectMultisigRejected(await forceTransferInstruction(amount), [
      multisig.members[0],
    ]);
  });

  it("rejects mint_securities signed only by the multisig account key", async () => {
    try {
      await testEnvironment.accessControlHelper.mintSecurities(
        amount,
        recipient.publicKey,
        recipientTokenAccount,
        multisig.keypair,
        recipientSaa
      );
      assert.fail("multisig account key alone was accepted");
    } catch (error) {
      if (error.message === "multisig account key alone was accepted") {
        throw error;
      }
      assert.isTrue(
        authoritySignerRejected(error),
        `expected the multisig account key to be rejected, got: ${errorText(
          error
        )}`
      );
    }
  });

  it("mints, burns, and force-transfers with both multisig members", async () => {
    const supplyBefore = (await testEnvironment.mintHelper.getMint()).supply;
    await sendAsSplMultisig(
      testEnvironment.connection,
      await mintInstruction(),
      multisig.publicKey,
      multisig.members,
      testEnvironment.contractAdmin,
      testEnvironment.commitment
    );
    const recipientAfterMint = await testEnvironment.mintHelper.getAccount(
      recipientTokenAccount
    );
    const supplyAfterMint = (await testEnvironment.mintHelper.getMint()).supply;
    assert.equal(recipientAfterMint.amount, BigInt(amount.toString()));
    assert.equal(supplyAfterMint - supplyBefore, BigInt(amount.toString()));

    const burnAmount = new anchor.BN(100_000);
    await sendAsSplMultisig(
      testEnvironment.connection,
      await burnInstruction(burnAmount),
      multisig.publicKey,
      multisig.members,
      testEnvironment.contractAdmin,
      testEnvironment.commitment
    );
    const recipientAfterBurn = await testEnvironment.mintHelper.getAccount(
      recipientTokenAccount
    );
    assert.equal(
      recipientAfterBurn.amount,
      BigInt(amount.sub(burnAmount).toString())
    );

    const transferAmount = new anchor.BN(100_000);
    await sendAsSplMultisig(
      testEnvironment.connection,
      await forceTransferInstruction(transferAmount),
      multisig.publicKey,
      multisig.members,
      testEnvironment.contractAdmin,
      testEnvironment.commitment,
      [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000,
        }),
      ]
    );

    const recipientAfterTransfer = await testEnvironment.mintHelper.getAccount(
      recipientTokenAccount
    );
    const targetAfterTransfer = await testEnvironment.mintHelper.getAccount(
      targetTokenAccount
    );
    assert.equal(
      recipientAfterTransfer.amount,
      BigInt(amount.sub(burnAmount).sub(transferAmount).toString())
    );
    assert.equal(targetAfterTransfer.amount, BigInt(transferAmount.toString()));
  });
});
