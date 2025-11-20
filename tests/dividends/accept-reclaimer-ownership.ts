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

describe("accept-reclaimer-ownership", () => {
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
  let reclaimerWallet1: Keypair;
  let reclaimerWallet2: Keypair;
  let wrongWallet: Keypair;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    contractAdmin = testEnvironment.contractAdmin;
    reclaimerWallet1 = Keypair.generate();
    reclaimerWallet2 = Keypair.generate();
    wrongWallet = Keypair.generate();

    await topUpWallet(connection, contractAdmin.publicKey, solToLamports(1));
    await topUpWallet(connection, reclaimerWallet1.publicKey, solToLamports(1));
    await topUpWallet(connection, reclaimerWallet2.publicKey, solToLamports(1));
    await topUpWallet(connection, wrongWallet.publicKey, solToLamports(1));
  });

  context("success cases", () => {
    it("successfully accepts ownership when proposal exists", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Step 1: Propose reclaimer
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

      // Step 2: Accept ownership
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

      // Verify ownership was transferred and proposal was cleared
      const reclaimerData =
        await dividendsProgram.account.reclaimer.fetch(reclaimerPubkey);
      assert.deepEqual(
        reclaimerData.walletAddress,
        reclaimerWallet1.publicKey
      );
      assert.isNull(reclaimerData.proposedWalletAddress);
    });

    it("successfully accepts ownership and updates from previous owner", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // First set reclaimer to wallet1
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

      // Verify wallet1 is the owner
      let reclaimerData =
        await dividendsProgram.account.reclaimer.fetch(reclaimerPubkey);
      assert.deepEqual(
        reclaimerData.walletAddress,
        reclaimerWallet1.publicKey
      );

      // Now propose wallet2 as new owner
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

      // Accept ownership with wallet2
      await dividendsProgram.methods
        .acceptReclaimerOwnership()
        .accountsStrict({
          reclaimer: reclaimerPubkey,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          newOwner: reclaimerWallet2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reclaimerWallet2])
        .rpc({ commitment });

      // Verify wallet2 is now the owner and proposal is cleared
      reclaimerData =
        await dividendsProgram.account.reclaimer.fetch(reclaimerPubkey);
      assert.deepEqual(
        reclaimerData.walletAddress,
        reclaimerWallet2.publicKey
      );
      assert.isNull(reclaimerData.proposedWalletAddress);
    });
  });

  context("failure cases", () => {
    it("fails when no proposal exists (NoPendingOwnershipTransfer)", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // First initialize the reclaimer account by proposing and accepting once
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

      // Verify the account exists and proposal is cleared
      const reclaimerData =
        await dividendsProgram.account.reclaimer.fetch(reclaimerPubkey);
      assert.deepEqual(
        reclaimerData.walletAddress,
        reclaimerWallet1.publicKey
      );
      assert.isNull(reclaimerData.proposedWalletAddress);

      // Now try to accept again without a proposal - should fail with NoPendingOwnershipTransfer
      try {
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet2])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch ({ error }: any) {
        assert.equal(error.errorCode.code, "NoPendingOwnershipTransfer");
        assert.equal(error.errorMessage, "No pending ownership transfer");
      }
    });

    it("fails when wrong wallet tries to accept (UnauthorizedOwnershipTransfer)", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Propose reclaimerWallet1
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

      // Try to accept with wrong wallet
      try {
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: wrongWallet.publicKey, // Wrong wallet
            systemProgram: SystemProgram.programId,
          })
          .signers([wrongWallet])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch ({ error }: any) {
        assert.equal(error.errorCode.code, "UnauthorizedOwnershipTransfer");
        assert.equal(error.errorMessage, "Unauthorized ownership transfer");
      }
    });

    it("fails when proposal exists but signer doesn't match proposed wallet", async () => {
      const [reclaimerPubkey] = findReclaimerKey(
        testEnvironment.accessControlHelper.accessControlPubkey,
        dividendsProgram.programId
      );

      // Propose reclaimerWallet1
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

      // Try to accept with reclaimerWallet2 (not the proposed one)
      try {
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet2.publicKey, // Different from proposed
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet2])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch ({ error }: any) {
        assert.equal(error.errorCode.code, "UnauthorizedOwnershipTransfer");
        assert.equal(error.errorMessage, "Unauthorized ownership transfer");
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

      // Propose reclaimer in first environment
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

      // Try to accept with wrong access control
      try {
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              otherTestEnvironment.accessControlHelper.accessControlPubkey, // Wrong access control
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet1])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch (error: any) {
        // Should fail because access control doesn't match reclaimer seeds
        assert.isTrue(
          error.message?.includes("Constraint") ||
            error.logs?.some((log: string) =>
              log.includes("Constraint") || log.includes("reclaimer")
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

      // Propose reclaimer
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

      // Try to accept with wrong mint
      try {
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: otherTestEnvironment.mintKeypair.publicKey, // Wrong mint
            newOwner: reclaimerWallet1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet1])
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

