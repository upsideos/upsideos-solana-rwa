import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { solToLamports, topUpWallet } from "../utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Access Control mint securities", () => {
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
  let testEnvironment: TestEnvironment;
  let reserveAdminWalletRole: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    [reserveAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      );
  });

  const mintRecipient = new Keypair();
  let mintRecipientTokenAccount: PublicKey;
  it("fails to mint more than maxTotalSupply", async () => {
    mintRecipientTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        mintRecipient.publicKey,
        testEnvironment.contractAdmin
      );

    const { maxTotalSupply: maxTotalSupply } =
      await testEnvironment.accessControlHelper.accessControlData();

    const amount = maxTotalSupply
      .sub(new anchor.BN(testEnvironmentParams.initialSupply))
      .addn(1);
    const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      mintRecipientTokenAccount
    );
    try {
      await testEnvironment.accessControlHelper.mintSecurities(
        amount,
        mintRecipient.publicKey,
        mintRecipientTokenAccount,
        testEnvironment.reserveAdmin,
        mintRecipientSaaPubkey
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MintExceedsMaxTotalSupply");
      assert.equal(
        error.errorMessage,
        "Cannot mint more than max total supply"
      );
    }
  });

  it("does not allow minting by non-reserve admin", async () => {
    const amount = new anchor.BN(1_000_000);
    const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      mintRecipientTokenAccount
    );
    try {
      await testEnvironment.accessControlHelper.mintSecurities(
        amount,
        mintRecipient.publicKey,
        mintRecipientTokenAccount,
        testEnvironment.walletsAdmin,
        mintRecipientSaaPubkey
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails when signer is not the authority", async () => {
    const amount = new anchor.BN(1_000_000);
    const reserveAdminPretender = new Keypair();
    await topUpWallet(
      testEnvironment.connection,
      reserveAdminPretender.publicKey,
      solToLamports(1)
    );
    const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      mintRecipientTokenAccount
    );

    try {
      await testEnvironment.accessControlHelper.program.methods
        .mintSecurities(amount)
        .accountsStrict({
          authority: testEnvironment.reserveAdmin.publicKey,
          authorityWalletRole: reserveAdminWalletRole,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          destinationAccount: mintRecipientTokenAccount,
          destinationAuthority: mintRecipient.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          securityAssociatedAccount: mintRecipientSaaPubkey,
        })
        .signers([reserveAdminPretender])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch (error) {
      assert.equal(
        error.toString(),
        `Error: unknown signer: ${reserveAdminPretender.publicKey.toBase58()}`
      );
    }
  });

  const attackerTestEnvironmentParams: TestEnvironmentParams = {
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
  let attackerEnvironment: TestEnvironment;
  it("fails when attacker subtitute authority, wallet role and signer", async () => {
    attackerEnvironment = new TestEnvironment(attackerTestEnvironmentParams);
    await attackerEnvironment.setupAccessControl();
    const amount = new anchor.BN(1_000_000);
    const [attackerReserveAdminWalletRole] =
      attackerEnvironment.accessControlHelper.walletRolePDA(
        attackerEnvironment.reserveAdmin.publicKey
      );
    const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      mintRecipientTokenAccount
    );
    try {
      await testEnvironment.accessControlHelper.program.methods
        .mintSecurities(amount)
        .accountsStrict({
          authority: attackerEnvironment.reserveAdmin.publicKey,
          authorityWalletRole: attackerReserveAdminWalletRole,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          destinationAccount: mintRecipientTokenAccount,
          destinationAuthority: mintRecipient.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          securityAssociatedAccount: mintRecipientSaaPubkey,
        })
        .signers([attackerEnvironment.reserveAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("mints securities", async () => {
    const amount = new anchor.BN(1_000_000);
    const { supply: supplyBeforeMint } =
      await testEnvironment.mintHelper.getMint();
    const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      mintRecipientTokenAccount
    );

    const [walletsAdminWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      testEnvironment.walletsAdmin.publicKey
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      mintRecipient.publicKey,
      mintRecipientTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );

    await testEnvironment.accessControlHelper.mintSecurities(
      amount,
      mintRecipient.publicKey,
      mintRecipientTokenAccount,
      testEnvironment.reserveAdmin,
      mintRecipientSaaPubkey
    );

    const { supply: supplyAfterMint } =
      await testEnvironment.mintHelper.getMint();
    const mintRecipientTokenAccountInfo =
      await testEnvironment.mintHelper.getAccount(mintRecipientTokenAccount);
    assert.equal(
      mintRecipientTokenAccountInfo.amount.toString(),
      amount.toString()
    );
    assert.equal(
      (supplyAfterMint - supplyBeforeMint).toString(),
      amount.toString()
    );
  });
});
