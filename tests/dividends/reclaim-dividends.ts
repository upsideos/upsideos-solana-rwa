import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN, utils } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import {
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { MintHelper } from "../helpers/mint_helper";
import { solToLamports, topUpWallet } from "../utils";
import {
  BalanceTree,
  toBytes32Array,
} from "../../app/src/merkle-distributor/utils";
import { findClaimStatusKey } from "../../app/src/merkle-distributor";
import { createDistributor } from "./utils";
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

type TestCase = {
  tokenProgramId: PublicKey;
  programName: string;
};

const testCases: TestCase[] = [
  { tokenProgramId: TOKEN_PROGRAM_ID, programName: "SPL Token" },
  { tokenProgramId: TOKEN_2022_PROGRAM_ID, programName: "SPL Token 2022" },
];

// Helper function to find reclaimer PDA
export const findReclaimerKey = (
  accessControl: PublicKey,
  programId: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("reclaimer"), accessControl.toBytes()],
    programId
  );
};

testCases.forEach(({ tokenProgramId, programName }) => {
  describe(`reclaim-dividends for ${programName}`, () => {
    const provider = AnchorProvider.env();
    const connection = provider.connection;
    anchor.setProvider(provider);
    const commitment = "confirmed";

    const dividendsProgram = anchor.workspace.Dividends as Program<Dividends>;
    const decimals = 6;
    let mintKeypair: Keypair;

    const NUM_NODES = new BN(3);
    const TOTAL_CLAIM_AMOUNT = new BN(1_000_000_000_000);
    let distributor: PublicKey;
    let bump: number;
    let baseKey: Keypair;
    let mintHelper: MintHelper;
    let distributorATA: PublicKey;
    let signer: Keypair;
    const ipfsHash =
      "QmQ9Q5Q6Q7Q8Q9QaQbQcQdQeQfQgQhQiQjQkQlQmQnQoQpQqQrQsQtQuQvQwQxQy";

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

    const totalClaimAmount = TOTAL_CLAIM_AMOUNT;
    const numNodes = NUM_NODES;
    let signerATA: PublicKey;
    let reclaimerWallet: Keypair;
    let transferAdmin: Keypair;

    beforeEach(async () => {
      testEnvironment = new TestEnvironment(testEnvironmentParams);
      await testEnvironment.setupAccessControl();
      signer = testEnvironment.contractAdmin;
      transferAdmin = testEnvironment.transferAdmin;
      reclaimerWallet = Keypair.generate();

      await topUpWallet(connection, signer.publicKey, solToLamports(1));
      await topUpWallet(connection, transferAdmin.publicKey, solToLamports(1));
      await topUpWallet(connection, reclaimerWallet.publicKey, solToLamports(1));

      ({ mintKeypair, mintHelper, baseKey, distributor, bump, distributorATA } =
        await createDistributor(
          connection,
          decimals,
          signer,
          dividendsProgram.programId,
          tokenProgramId,
          commitment
        ));

      signerATA = await mintHelper.createAssociatedTokenAccount(
        signer.publicKey,
        signer
      );
      await mintTo(
        connection,
        signer,
        mintKeypair.publicKey,
        signerATA,
        signer,
        BigInt(totalClaimAmount.toString()),
        [],
        { commitment },
        tokenProgramId
      );
    });

    context("reclaim", () => {
      it("fails when reclaimer is not set", async () => {
        const userKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        const reclaimerATA = getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          reclaimerWallet.publicKey,
          false,
          tokenProgramId
        );
        await mintHelper.createAssociatedTokenAccount(
          reclaimerWallet.publicKey,
          transferAdmin
        );

        try {
          await dividendsProgram.methods
            .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
            .accountsStrict({
              distributor,
              reclaimer: reclaimerPubkey,
              claimStatus: claimPubkey,
              from: distributorATA,
              to: reclaimerATA,
              target: userKP.publicKey,
              payer: transferAdmin.publicKey,
              mint: mintKeypair.publicKey,
              authorityWalletRole:
                testEnvironment.accessControlHelper.walletRolePDA(
                  transferAdmin.publicKey
                )[0],
              accessControl:
                testEnvironment.accessControlHelper.accessControlPubkey,
              authority: transferAdmin.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: tokenProgramId,
            })
            .signers([transferAdmin])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch (error: any) {
          // Should fail because reclaimer account doesn't exist (wallet_address will be default/empty)
          // The constraint on to.owner == reclaimer.wallet_address will fail
          assert.isTrue(
            error.errorCode?.code === "OwnerMismatch" ||
              error.message?.includes("AccountNotInitialized") ||
              error.message?.includes("Constraint") ||
              error.logs?.some((log: string) => 
                log.includes("reclaimer") || log.includes("OwnerMismatch")
              )
          );
        }
      });

      it("fails when attacker uses to account that doesn't belong to reclaimer wallet", async () => {
        const userKP = Keypair.generate();
        const attackerKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));
        await topUpWallet(connection, attackerKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        // Set reclaimer using 2-step process
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        // Step 1: Propose reclaimer
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: signer.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Step 2: Accept ownership
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );

        // Attacker tries to use their own ATA instead of reclaimer's ATA
        const attackerATA = await mintHelper.createAssociatedTokenAccount(
          attackerKP.publicKey,
          transferAdmin
        );

        try {
          await dividendsProgram.methods
            .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
            .accountsStrict({
              distributor,
              reclaimer: reclaimerPubkey,
              claimStatus: claimPubkey,
              from: distributorATA,
              to: attackerATA, // Attacker's ATA, not reclaimer's
              target: userKP.publicKey,
              payer: transferAdmin.publicKey,
              mint: mintKeypair.publicKey,
              authorityWalletRole:
                testEnvironment.accessControlHelper.walletRolePDA(
                  transferAdmin.publicKey
                )[0],
              accessControl:
                testEnvironment.accessControlHelper.accessControlPubkey,
              authority: transferAdmin.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: tokenProgramId,
            })
            .signers([transferAdmin])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch ({ error }: any) {
          assert.equal(error.errorCode.code, "OwnerMismatch");
          assert.equal(
            error.errorMessage,
            "Token account owner did not match intended owner"
          );
        }
      });

      it("cannot reclaim twice for the same index", async () => {
        const userKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        // Set reclaimer using 2-step process
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        // Step 1: Propose reclaimer
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: signer.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Step 2: Accept ownership
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );

        const reclaimerATA = getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          reclaimerWallet.publicKey,
          false,
          tokenProgramId
        );
        await mintHelper.createAssociatedTokenAccount(
          reclaimerWallet.publicKey,
          transferAdmin
        );

        // First reclaim should succeed
        await dividendsProgram.methods
          .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
          .accountsStrict({
            distributor,
            reclaimer: reclaimerPubkey,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: reclaimerATA,
            target: userKP.publicKey,
            payer: transferAdmin.publicKey,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                transferAdmin.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authority: transferAdmin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgramId,
          })
          .signers([transferAdmin])
          .rpc({ commitment });

        // Try to reclaim again - should fail
        try {
          await dividendsProgram.methods
            .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
            .accountsStrict({
              distributor,
              reclaimer: reclaimerPubkey,
              claimStatus: claimPubkey,
              from: distributorATA,
              to: reclaimerATA,
              target: userKP.publicKey,
              payer: transferAdmin.publicKey,
              mint: mintKeypair.publicKey,
              authorityWalletRole:
                testEnvironment.accessControlHelper.walletRolePDA(
                  transferAdmin.publicKey
                )[0],
              accessControl:
                testEnvironment.accessControlHelper.accessControlPubkey,
              authority: transferAdmin.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: tokenProgramId,
            })
            .signers([transferAdmin])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch (error: any) {
          const isExpectedError = error.logs?.some((log: string) => {
            return (
              log ===
              `Allocate: account Address { address: ${claimPubkey.toString()}, base: None } already in use`
            );
          });
          assert.isTrue(isExpectedError || error.message?.includes("already claimed"));
        }
      });

      it("cannot reclaim after claim for the same index", async () => {
        const userKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        // Set reclaimer using 2-step process
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        // Step 1: Propose reclaimer
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: signer.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Step 2: Accept ownership
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );

        // User claims first
        const claimantATA = await mintHelper.createAssociatedTokenAccount(
          userKP.publicKey,
          signer
        );

        await dividendsProgram.methods
          .claim(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
          .accountsStrict({
            distributor,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: claimantATA,
            claimant: userKP.publicKey,
            payer: signer.publicKey,
            mint: mintKeypair.publicKey,
            tokenProgram: tokenProgramId,
            systemProgram: SystemProgram.programId,
          })
          .signers([userKP, signer])
          .rpc({ commitment });

        // Try to reclaim after claim - should fail
        const reclaimerATA = getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          reclaimerWallet.publicKey,
          false,
          tokenProgramId
        );
        await mintHelper.createAssociatedTokenAccount(
          reclaimerWallet.publicKey,
          transferAdmin
        );

        try {
          await dividendsProgram.methods
            .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
            .accountsStrict({
              distributor,
              reclaimer: reclaimerPubkey,
              claimStatus: claimPubkey,
              from: distributorATA,
              to: reclaimerATA,
              target: userKP.publicKey,
              payer: transferAdmin.publicKey,
              mint: mintKeypair.publicKey,
              authorityWalletRole:
                testEnvironment.accessControlHelper.walletRolePDA(
                  transferAdmin.publicKey
                )[0],
              accessControl:
                testEnvironment.accessControlHelper.accessControlPubkey,
              authority: transferAdmin.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: tokenProgramId,
            })
            .signers([transferAdmin])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch (error: any) {
          const isExpectedError = error.logs?.some((log: string) => {
            return (
              log ===
              `Allocate: account Address { address: ${claimPubkey.toString()}, base: None } already in use`
            );
          });
          assert.isTrue(isExpectedError || error.message?.includes("already claimed"));
        }
      });

      it("cannot claim after reclaim for the same index", async () => {
        const userKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        // Set reclaimer using 2-step process
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        // Step 1: Propose reclaimer
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: signer.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Step 2: Accept ownership
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );

        // TransferAdmin reclaims first
        const reclaimerATA = getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          reclaimerWallet.publicKey,
          false,
          tokenProgramId
        );
        await mintHelper.createAssociatedTokenAccount(
          reclaimerWallet.publicKey,
          transferAdmin
        );

        await dividendsProgram.methods
          .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
          .accountsStrict({
            distributor,
            reclaimer: reclaimerPubkey,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: reclaimerATA,
            target: userKP.publicKey,
            payer: transferAdmin.publicKey,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                transferAdmin.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authority: transferAdmin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgramId,
          })
          .signers([transferAdmin])
          .rpc({ commitment });

        // Try to claim after reclaim - should fail
        const claimantATA = await mintHelper.createAssociatedTokenAccount(
          userKP.publicKey,
          signer
        );

        try {
          await dividendsProgram.methods
            .claim(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
            .accountsStrict({
              distributor,
              claimStatus: claimPubkey,
              from: distributorATA,
              to: claimantATA,
              claimant: userKP.publicKey,
              payer: signer.publicKey,
              mint: mintKeypair.publicKey,
              tokenProgram: tokenProgramId,
              systemProgram: SystemProgram.programId,
            })
            .signers([userKP, signer])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch (error: any) {
          const isExpectedError = error.logs?.some((log: string) => {
            return (
              log ===
              `Allocate: account Address { address: ${claimPubkey.toString()}, base: None } already in use`
            );
          });
          assert.isTrue(isExpectedError || error.message?.includes("already claimed"));
        }
      });

      it("successfully reclaims when reclaimer is set", async () => {
        const userKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        // Set reclaimer using 2-step process
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        // Step 1: Propose reclaimer
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: signer.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Step 2: Accept ownership
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );

        const reclaimerATA = getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          reclaimerWallet.publicKey,
          false,
          tokenProgramId
        );
        await mintHelper.createAssociatedTokenAccount(
          reclaimerWallet.publicKey,
          transferAdmin
        );

        // Reclaim should succeed
        await dividendsProgram.methods
          .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
          .accountsStrict({
            distributor,
            reclaimer: reclaimerPubkey,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: reclaimerATA,
            target: userKP.publicKey,
            payer: transferAdmin.publicKey,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                transferAdmin.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authority: transferAdmin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgramId,
          })
          .signers([transferAdmin])
          .rpc({ commitment });

        // Verify tokens were sent to reclaimer
        const reclaimerATAInfo = await mintHelper.getAccount(reclaimerATA);
        assert.equal(reclaimerATAInfo.amount.toString(), claimAmount.toString());

        // Verify claim status
        const claimStatusData =
          await dividendsProgram.account.claimStatus.fetch(claimPubkey);
        assert.equal(claimStatusData.isClaimed, true);
        assert.deepEqual(claimStatusData.claimant, transferAdmin.publicKey);
        assert.equal(claimStatusData.amount.toString(), claimAmount.toString());
      });

      it("successfully reclaims when dividends are paused", async () => {
        const userKP = Keypair.generate();
        await topUpWallet(connection, userKP.publicKey, solToLamports(1));

        const claimAmount = new BN(1_000_000);
        const tree = new BalanceTree([
          { account: userKP.publicKey, amount: claimAmount },
        ]);

        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(tree.getRoot()),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, baseKey])
          .rpc({ commitment });

        // Set reclaimer using 2-step process
        const [reclaimerPubkey] = findReclaimerKey(
          testEnvironment.accessControlHelper.accessControlPubkey,
          dividendsProgram.programId
        );

        // Step 1: Propose reclaimer
        await dividendsProgram.methods
          .proposeReclaimer(reclaimerWallet.publicKey)
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            securityMint: testEnvironment.mintKeypair.publicKey,
            authority: signer.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Step 2: Accept ownership
        await dividendsProgram.methods
          .acceptReclaimerOwnership()
          .accountsStrict({
            reclaimer: reclaimerPubkey,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            newOwner: reclaimerWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reclaimerWallet])
          .rpc({ commitment });

        await dividendsProgram.methods
          .fundDividends(totalClaimAmount)
          .accounts({
            distributor,
            mint: mintKeypair.publicKey,
            from: signerATA,
            to: distributorATA,
            funder: signer.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([signer])
          .rpc({ commitment });

        // Pause the distribution
        await dividendsProgram.methods
          .pause(true)
          .accountsStrict({
            distributor,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            authority: signer.publicKey,
          })
          .signers([signer])
          .rpc({ commitment });

        // Verify that distribution is paused
        const distributorDataPaused =
          await dividendsProgram.account.merkleDistributor.fetch(distributor);
        assert.equal(distributorDataPaused.paused, true);

        const index = new BN(0);
        const proof = tree.getProof(
          index.toNumber(),
          userKP.publicKey,
          claimAmount
        );
        const [claimPubkey, claimBump] = findClaimStatusKey(
          index,
          distributor,
          dividendsProgram.programId
        );

        const reclaimerATA = getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          reclaimerWallet.publicKey,
          false,
          tokenProgramId
        );
        await mintHelper.createAssociatedTokenAccount(
          reclaimerWallet.publicKey,
          transferAdmin
        );

        // Reclaim should succeed even though distribution is paused
        await dividendsProgram.methods
          .reclaimDividends(claimBump, index, claimAmount, proof.map((p) => toBytes32Array(p)))
          .accountsStrict({
            distributor,
            reclaimer: reclaimerPubkey,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: reclaimerATA,
            target: userKP.publicKey,
            payer: transferAdmin.publicKey,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                transferAdmin.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authority: transferAdmin.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgramId,
          })
          .signers([transferAdmin])
          .rpc({ commitment });

        // Verify tokens were sent to reclaimer
        const reclaimerATAInfo = await mintHelper.getAccount(reclaimerATA);
        assert.equal(reclaimerATAInfo.amount.toString(), claimAmount.toString());

        // Verify claim status
        const claimStatusData =
          await dividendsProgram.account.claimStatus.fetch(claimPubkey);
        assert.equal(claimStatusData.isClaimed, true);
        assert.deepEqual(claimStatusData.claimant, transferAdmin.publicKey);
        assert.equal(claimStatusData.amount.toString(), claimAmount.toString());
      });
    });
  });
});
