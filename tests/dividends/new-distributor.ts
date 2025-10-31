import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert, expect } from "chai";
import { solToLamports, topUpWallet } from "../utils";
import { toBytes32Array } from "../../app/src/merkle-distributor/utils";
import { createDistributor, createMockTokenWithTransferFee } from "./utils";
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { Roles } from "../helpers/access-control_helper";
import { findDistributorKey } from "../../app/src/merkle-distributor";

type TestCase = {
  tokenProgramId: PublicKey;
  programName: string;
};

const testCases: TestCase[] = [
  { tokenProgramId: TOKEN_PROGRAM_ID, programName: "SPL Token" },
  { tokenProgramId: TOKEN_2022_PROGRAM_ID, programName: "SPL Token 2022" },
];

testCases.forEach(({ tokenProgramId, programName }) => {
  describe(`new distributor for ${programName}`, () => {
    const provider = AnchorProvider.env();
    const connection = provider.connection;
    anchor.setProvider(provider);
    const commitment = "confirmed";

    const dividendsProgram = anchor.workspace.Dividends as Program<Dividends>;
    const decimals = 6;
    let mintKeypair: Keypair;

    const NUM_NODES = new BN(3);
    const TOTAL_CLAIM_AMOUNT = new BN(1_000_000_000_000);
    const ZERO_BYTES32 = Buffer.alloc(32);
    let distributor: PublicKey;
    let bump: number;
    let baseKey: Keypair;
    let signer;
    const root = ZERO_BYTES32;
    const totalClaimAmount = TOTAL_CLAIM_AMOUNT;
    const numNodes = NUM_NODES;
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

    beforeEach(async () => {
      testEnvironment = new TestEnvironment(testEnvironmentParams);
      await testEnvironment.setupAccessControl();
      signer = testEnvironment.contractAdmin;

      await topUpWallet(connection, signer.publicKey, solToLamports(1));
      ({ mintKeypair, baseKey, distributor, bump } = await createDistributor(
        connection,
        decimals,
        signer,
        dividendsProgram.programId,
        tokenProgramId,
        commitment
      ));
    });

    it("initializes new distributor with contract admin role", async () => {
      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(root),
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

      const distributorData =
        await dividendsProgram.account.merkleDistributor.fetch(distributor);
      assert.equal(distributorData.bump, bump);
      assert.equal(distributorData.numNodes.toString(), NUM_NODES.toString());
      assert.equal(
        distributorData.totalClaimAmount.toString(),
        TOTAL_CLAIM_AMOUNT.toString()
      );
      assert.deepEqual(distributorData.base, baseKey.publicKey);
      assert.deepEqual(distributorData.mint, mintKeypair.publicKey);
      assert.deepEqual(
        distributorData.accessControl,
        testEnvironment.accessControlHelper.accessControlPubkey
      );
      assert.isFalse(distributorData.paused);
      assert.equal(distributorData.numNodesClaimed.toNumber(), 0);
      assert.deepEqual(
        distributorData.root,
        Array.from(new Uint8Array(ZERO_BYTES32))
      );
      assert.equal(distributorData.totalAmountClaimed.toNumber(), 0);
      assert.isFalse(distributorData.readyToClaim);
    });

    it("initializes new distributor with transferAdmin wallet role", async () => {
      const wallet = Keypair.generate();
      const [walletRole] = testEnvironment.accessControlHelper.walletRolePDA(
        wallet.publicKey
      );
      await testEnvironment.accessControlHelper.grantRole(
        wallet.publicKey,
        Roles.TransferAdmin,
        testEnvironment.contractAdmin
      );
      await topUpWallet(connection, wallet.publicKey, solToLamports(1));

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(root),
          totalClaimAmount,
          numNodes,
          ipfsHash
        )
        .accountsStrict({
          base: baseKey.publicKey,
          distributor,
          mint: mintKeypair.publicKey,
          authorityWalletRole: walletRole,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet, baseKey])
        .rpc({ commitment });

      const distributorData =
        await dividendsProgram.account.merkleDistributor.fetch(distributor);
      assert.equal(distributorData.bump, bump);
      assert.equal(distributorData.numNodes.toString(), NUM_NODES.toString());
      assert.equal(
        distributorData.totalClaimAmount.toString(),
        TOTAL_CLAIM_AMOUNT.toString()
      );
      assert.deepEqual(distributorData.base, baseKey.publicKey);
      assert.deepEqual(distributorData.mint, mintKeypair.publicKey);
      assert.deepEqual(
        distributorData.accessControl,
        testEnvironment.accessControlHelper.accessControlPubkey
      );
      assert.isFalse(distributorData.paused);
      assert.equal(distributorData.numNodesClaimed.toNumber(), 0);
      assert.deepEqual(
        distributorData.root,
        Array.from(new Uint8Array(ZERO_BYTES32))
      );
      assert.equal(distributorData.totalAmountClaimed.toNumber(), 0);
      assert.isFalse(distributorData.readyToClaim);
    });

    it("fails to initialize new distributor when ipfs hash is too long", async () => {
      const oversizeIpfsHash = String.fromCharCode(0).repeat(65);
      try {
        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(root),
            totalClaimAmount,
            numNodes,
            oversizeIpfsHash
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
        assert.fail("Expected to throw an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "InvalidIPFSHashSize");
        assert.equal(error.errorMessage, "Invalid IPFS hash size");
      }
    });

    it("fails to initialize new distributor without contract or transfer admin role", async () => {
      const wallet = Keypair.generate();
      const [walletRole] = testEnvironment.accessControlHelper.walletRolePDA(
        wallet.publicKey
      );
      await testEnvironment.accessControlHelper.grantRole(
        wallet.publicKey,
        Roles.ReserveAdmin,
        testEnvironment.contractAdmin
      );
      await testEnvironment.accessControlHelper.grantRole(
        wallet.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.contractAdmin
      );
      await topUpWallet(connection, wallet.publicKey, solToLamports(1));

      try {
        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(root),
            totalClaimAmount,
            numNodes,
            ipfsHash
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole: walletRole,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            securityMint: testEnvironment.mintKeypair.publicKey,
            payer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([wallet, baseKey])
          .rpc({ commitment });
        assert.fail("Expected to throw an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "Unauthorized");
        assert.equal(
          error.errorMessage,
          "Account is not authorized to execute this instruction"
        );
      }
    });
  });
});

describe("new-distributor with transferFeeConfig", () => {
  const provider = AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);
  const commitment = "confirmed";

  const dividendsProgram = anchor.workspace.Dividends as Program<Dividends>;
  const decimals = 6;

  const NUM_NODES = new BN(3);
  const TOTAL_CLAIM_AMOUNT = new BN(1_000_000_000_000);
  const ZERO_BYTES32 = Buffer.alloc(32);
  let distributor: PublicKey;
  let bump: number;
  let baseKey: Keypair;
  let signer;
  const root = ZERO_BYTES32;
  const totalClaimAmount = TOTAL_CLAIM_AMOUNT;
  const numNodes = NUM_NODES;
  const ipfsHash =
    "QmQ9Q5Q6Q7Q8Q9QaQbQcQdQeQfQgQhQiQjQkQlQmQnQoQpQqQrQsQtQuQvQwQxQy";

  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: decimals,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    signer = testEnvironment.contractAdmin;

    await topUpWallet(connection, signer.publicKey, solToLamports(1));
  });

  it("fails to initialize new distributor with non-zero transferFee", async () => {
    const feeBasicPoints = 1000;
    const { mint: paymentMintPubkey } = await createMockTokenWithTransferFee(
      connection,
      decimals,
      feeBasicPoints
    );
    baseKey = Keypair.generate();
    [distributor, bump] = findDistributorKey(
      baseKey.publicKey,
      dividendsProgram.programId
    );

    try {
      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(root),
          totalClaimAmount,
          numNodes,
          ipfsHash
        )
        .accountsStrict({
          base: baseKey.publicKey,
          distributor,
          mint: paymentMintPubkey,
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
      assert.fail("Expected to throw an error");
    } catch ({ error }) {
      assert.equal(
        error.errorCode.code,
        "TransferFeeIsNotAllowedForPaymentMint"
      );
      assert.equal(
        error.errorMessage,
        "Transfer fee is not allowed for payment mint"
      );
    }
  });

  it("failse to initializes new distributor with zero transferFee", async () => {
    const feeBasicPoints = 0;
    const { mint: paymentMintPubkey } = await createMockTokenWithTransferFee(
      connection,
      decimals,
      feeBasicPoints
    );
    baseKey = Keypair.generate();
    [distributor, bump] = findDistributorKey(
      baseKey.publicKey,
      dividendsProgram.programId
    );

    try {
      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(root),
          totalClaimAmount,
          numNodes,
          ipfsHash
        )
        .accountsStrict({
          base: baseKey.publicKey,
          distributor,
          mint: paymentMintPubkey,
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
      assert.fail("Expected to throw an error");
    } catch ({ error }) {
      assert.equal(
        error.errorCode.code,
        "TransferFeeIsNotAllowedForPaymentMint"
      );
      assert.equal(
        error.errorMessage,
        "Transfer fee is not allowed for payment mint"
      );
    }
  });
});
