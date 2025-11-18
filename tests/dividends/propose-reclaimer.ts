import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, utils } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { solToLamports, topUpWallet } from "../utils";
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { Roles } from "../helpers/access-control_helper";

// Helper function to find reclaimer PDA
const findReclaimerKey = (
  accessControl: PublicKey,
  programId: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("reclaimer"), accessControl.toBytes()],
    programId
  );
};

describe("propose-reclaimer", () => {
  const provider = AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);
  const commitment = "confirmed";

  const dividendsProgram = anchor.workspace.Dividends as Program<Dividends>;

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
  let contractAdmin: Keypair;
  let unauthorizedUser: Keypair;
  let reclaimerWallet1: Keypair;
  let reclaimerWallet2: Keypair;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    contractAdmin = testEnvironment.contractAdmin;
    unauthorizedUser = Keypair.generate();
    reclaimerWallet1 = Keypair.generate();
    reclaimerWallet2 = Keypair.generate();

    await topUpWallet(connection, contractAdmin.publicKey, solToLamports(1));
    await topUpWallet(
      connection,
      unauthorizedUser.publicKey,
      solToLamports(1)
    );
  });

  context("success cases", () => {
    it("proposes reclaimer for the first time (init)", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      await dividendsProgram.methods
        .proposeReclaimer(reclaimerWallet1.publicKey)
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              contractAdmin.publicKey
            )[0],
          securityMint: testEnvironment.mintKeypair.publicKey,
          authority: contractAdmin.publicKey,
          payer: contractAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([contractAdmin])
        .rpc({ commitment });

      // Verify reclaimer account was created and proposal was set correctly
      const reclaimerData =
        await dividendsProgram.account.reclaimer.fetch(reclaimerPubkey);
      assert.deepEqual(
        reclaimerData.proposedWalletAddress,
        reclaimerWallet1.publicKey
      );
    });

    it("proposes new reclaimer when one already exists", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // First propose reclaimer to wallet1
      await dividendsProgram.methods
        .proposeReclaimer(reclaimerWallet1.publicKey)
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              contractAdmin.publicKey
            )[0],
          securityMint: testEnvironment.mintKeypair.publicKey,
          authority: contractAdmin.publicKey,
          payer: contractAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([contractAdmin])
        .rpc({ commitment });

      // Accept ownership
      await dividendsProgram.methods
        .acceptReclaimerOwnership()
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          newOwner: reclaimerWallet1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reclaimerWallet1])
        .rpc({ commitment });

      // Now propose a new reclaimer (wallet2)
      await dividendsProgram.methods
        .proposeReclaimer(reclaimerWallet2.publicKey)
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              contractAdmin.publicKey
            )[0],
          securityMint: testEnvironment.mintKeypair.publicKey,
          authority: contractAdmin.publicKey,
          payer: contractAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([contractAdmin])
        .rpc({ commitment });

      // Verify proposal was updated
      const reclaimerData =
        await dividendsProgram.account.reclaimer.fetch(reclaimerPubkey);
      assert.deepEqual(
        reclaimerData.walletAddress,
        reclaimerWallet1.publicKey
      );
      assert.deepEqual(
        reclaimerData.proposedWalletAddress,
        reclaimerWallet2.publicKey
      );
    });
  });

  context("failure cases", () => {
    it("fails when trying to propose the same wallet address (ValueUnchanged)", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // First propose and accept reclaimer
      await dividendsProgram.methods
        .proposeReclaimer(reclaimerWallet1.publicKey)
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              contractAdmin.publicKey
            )[0],
          securityMint: testEnvironment.mintKeypair.publicKey,
          authority: contractAdmin.publicKey,
          payer: contractAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([contractAdmin])
        .rpc({ commitment });

      await dividendsProgram.methods
        .acceptReclaimerOwnership()
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          newOwner: reclaimerWallet1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reclaimerWallet1])
        .rpc({ commitment });

      // Try to propose the same wallet again - should fail
      try {
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet1.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                contractAdmin.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: contractAdmin.publicKey,
            payer: contractAdmin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([contractAdmin])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch ({ error }: any) {
        assert.equal(error.errorCode.code, "ValueUnchanged");
        assert.equal(
          error.errorMessage,
          "The provided value is already set. No changes were made"
        );
      }
    });

    it("fails when called by unauthorized user (not ContractAdmin)", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Initialize wallet role for unauthorized user without ContractAdmin role
      await testEnvironment.accessControlHelper.grantRole(
        unauthorizedUser.publicKey,
        Roles.TransferAdmin, // Only TransferAdmin, not ContractAdmin
        contractAdmin
      );

      const [unauthorizedWalletRole] =
        testEnvironment.accessControlHelper.walletRolePDA(
          unauthorizedUser.publicKey
        );

      try {
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet1.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole: unauthorizedWalletRole,
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: unauthorizedUser.publicKey,
            payer: unauthorizedUser.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorizedUser])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch ({ error }: any) {
        assert.equal(error.errorCode.code, "Unauthorized");
        assert.equal(
          error.errorMessage,
          "Account is not authorized to execute this instruction"
        );
      }
    });

    it("fails when called by user without wallet role", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Try to use a wallet role that doesn't exist
      const fakeWalletRole = Keypair.generate().publicKey;

      try {
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet1.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole: fakeWalletRole,
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: unauthorizedUser.publicKey,
            payer: unauthorizedUser.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorizedUser])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch (error: any) {
        // Should fail because the wallet role account doesn't exist or doesn't match
        assert.isTrue(
          error.errorCode?.code === "Unauthorized" ||
            error.message?.includes("AccountNotInitialized") ||
            error.message?.includes("Constraint") ||
            error.logs?.some((log: string) =>
              log.includes("Unauthorized") || log.includes("Constraint")
            )
        );
      }
    });

    it("fails when access control doesn't match", async () => {
      // Create a different test environment to get a different access control
      const otherTestEnvironment = new TestEnvironment(testEnvironmentParams);
      await otherTestEnvironment.setupAccessControl();
      await topUpWallet(
        connection,
        otherTestEnvironment.contractAdmin.publicKey,
        solToLamports(1)
      );

      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Try to use wrong access control (from other environment)
      try {
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet1.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              otherTestEnvironment.accessControlHelper.accessControlPubkey, // Wrong access control
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                contractAdmin.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: contractAdmin.publicKey,
            payer: contractAdmin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([contractAdmin])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch (error: any) {
        // Should fail because access control doesn't match wallet role or reclaimer seeds
        assert.isTrue(
          error.errorCode?.code === "Unauthorized" ||
            error.message?.includes("Constraint") ||
            error.logs?.some((log: string) =>
              log.includes("Constraint") || log.includes("access_control")
            )
        );
      }
    });

    it("fails when security mint doesn't match access control", async () => {
      // Create a different test environment to get a different (valid) mint
      const otherTestEnvironment = new TestEnvironment(testEnvironmentParams);
      await otherTestEnvironment.setupAccessControl();
      await topUpWallet(
        connection,
        otherTestEnvironment.contractAdmin.publicKey,
        solToLamports(1)
      );

      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Try to use wrong mint (from other environment) with current access control
      try {
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet1.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                contractAdmin.publicKey
              )[0],
            securityMint: otherTestEnvironment.mintKeypair.publicKey, // Wrong mint (different environment)
            authority: contractAdmin.publicKey,
            payer: contractAdmin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([contractAdmin])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch (error: any) {
        // Should fail because security mint doesn't match access control mint
        assert.isTrue(
          error.errorCode?.code === "ConstraintViolated" ||
            error.message?.includes("Constraint") ||
            error.message?.includes("A seeds constraint was violated") ||
            error.logs?.some((log: string) =>
              log.includes("Constraint") ||
              log.includes("security_mint") ||
              log.includes("security_mint.key() == access_control.mint")
            )
        );
      }
    });
  });
});

