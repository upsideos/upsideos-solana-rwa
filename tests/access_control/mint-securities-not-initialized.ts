import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Access Control mint securities", () => {
  const zeroGroupIdx = new anchor.BN(0);
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
  let walletsAdminWalletRole: PublicKey;
  let pretenderWallet: Keypair;
  let pretenderTokenAccount: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    [reserveAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      );
    [walletsAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      );
    pretenderWallet = Keypair.generate();
    pretenderTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        pretenderWallet.publicKey,
        testEnvironment.contractAdmin
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      pretenderWallet.publicKey,
      pretenderTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
  });

  const mintRecipient = new Keypair();
  let mintRecipientTokenAccount: PublicKey;

  it("fails to mint securities for non-initialized security associated account", async () => {
    mintRecipientTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        mintRecipient.publicKey,
        testEnvironment.reserveAdmin
      );
    const amount = new anchor.BN(1_000_000);
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
      assert.equal(error.errorCode.code, "SecurityAssociatedAccountNotInitialized");
      assert.equal(
        error.errorMessage,
        "Security associated account not initialized"
      );
    }
  });

  it("initializes security associated account", async () => {
  const transferRestrictionData = await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
  const mintRecipientHolderId = transferRestrictionData.holderIds;
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      mintRecipientHolderId,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    const [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(
      zeroGroupIdx
    );
    const [mintRecipientHolderPubkey] =  
      testEnvironment.transferRestrictionsHelper.holderPDA(
        mintRecipientHolderId
      );
    const [mintRecipientHolderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        mintRecipientHolderPubkey,
        zeroGroupIdx
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      mintRecipientHolderGroupPubkey,
      mintRecipientHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      mintRecipientHolderPubkey,
      mintRecipientHolderGroupPubkey,
      mintRecipient.publicKey,
      mintRecipientTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin
    );
  });

  it("mints securities", async () => {
    const amount = new anchor.BN(1_000_000);
    const { supply: supplyBeforeMint } =
      await testEnvironment.mintHelper.getMint();
    const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      mintRecipientTokenAccount
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

  describe("when wrong security associated account is provided", () => {
    it("fails to mint securities", async () => {
      const amount = new anchor.BN(1_000_000);
      const [mintRecipientSaaPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        mintRecipientTokenAccount
      );
      try {
        await testEnvironment.accessControlHelper.mintSecurities(
          amount,
          mintRecipient.publicKey,
          mintRecipientTokenAccount,
          testEnvironment.reserveAdmin,
          pretenderTokenAccount
        );
        assert.fail("Expected an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "InvalidSecurityAssociatedAccount");
        assert.equal(
          error.errorMessage,
          "Invalid security associated account"
        );
      }
    });
  });

  describe("when security associated account is not provided", () => {
    it("fails with SecurityAssociatedAccountRequired error", async () => {
      const testRecipient = new Keypair();
      const testRecipientTokenAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          testRecipient.publicKey,
          testEnvironment.contractAdmin
        );
      const amount = new anchor.BN(1_000_000);
      
      try {
        // Call mintSecurities directly without providing securityAssociatedAccount
        // The account is optional in Rust, so we can set it to null
        await testEnvironment.accessControlHelper.program.methods
          .mintSecurities(amount)
          .accountsPartial({
            authority: testEnvironment.reserveAdmin.publicKey,
            authorityWalletRole: reserveAdminWalletRole,
            accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            destinationAccount: testRecipientTokenAccount,
            destinationAuthority: testRecipient.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            securityAssociatedAccount: null,
            // Omitting securityAssociatedAccount to test SecurityAssociatedAccountRequired error
          })
          .signers([testEnvironment.reserveAdmin])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expected an error");
      } catch ({ error }) {
        console.error(error);
        assert.equal(error.errorCode?.code, "SecurityAssociatedAccountRequired");
        assert.equal(
          error.errorMessage,
          "Security associated account is required"
        );
      }
    });
  });
});
