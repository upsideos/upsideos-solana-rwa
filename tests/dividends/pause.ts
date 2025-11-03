import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { solToLamports, topUpWallet } from "../utils";
import {
  BalanceTree,
  toBytes32Array,
} from "../../app/src/merkle-distributor/utils";
import { createDistributor } from "./utils";
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { Roles } from "../helpers/access-control_helper";

describe(`pause distribution`, () => {
  const tokenProgramId = TOKEN_PROGRAM_ID;
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
  let allKps: Keypair[] = [];
  let tree: BalanceTree;

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

    const kpOne = Keypair.generate();
    const kpTwo = Keypair.generate();
    const kpThree = Keypair.generate();
    allKps.push(...[kpOne, kpTwo, kpThree]);
    await Promise.all(
      allKps.map(async (kp) => {
        await topUpWallet(connection, kp.publicKey, solToLamports(1));
      })
    );

    const claimAmountOne = new BN(100);
    const claimAmountTwo = new BN(101);
    const claimAmountThree = new BN(102);
    tree = new BalanceTree([
      { account: kpOne.publicKey, amount: claimAmountOne },
      { account: kpTwo.publicKey, amount: claimAmountTwo },
      { account: kpThree.publicKey, amount: claimAmountThree },
    ]);
    const totalClaimAmount = TOTAL_CLAIM_AMOUNT;
    const numNodes = NUM_NODES;

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
        authorityWalletRole: testEnvironment.accessControlHelper.walletRolePDA(
          signer.publicKey
        )[0],
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        securityMint: testEnvironment.mintKeypair.publicKey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer, baseKey])
      .rpc({ commitment });
    const distributorData =
      await dividendsProgram.account.merkleDistributor.fetch(distributor);
    assert.equal(distributorData.bump, bump);
    assert.deepEqual(
      distributorData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(distributorData.paused, false);
  });

  it("fails to pause by non-admin", async () => {
    const wallet = Keypair.generate();
    await topUpWallet(connection, wallet.publicKey, solToLamports(1));

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
    const [walletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      wallet.publicKey
    );
    try {
      await dividendsProgram.methods
        .pause(true)
        .accountsStrict({
          distributor,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: walletRole,
          authority: wallet.publicKey,
        })
        .signers([wallet])
        .rpc({ commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(
        error.errorMessage,
        "Account is not authorized to execute this instruction"
      );
    }
  });

  it("pauses dividends distribution by contract admin", async () => {
    await dividendsProgram.methods
      .pause(true)
      .accountsStrict({
        distributor,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: testEnvironment.accessControlHelper.walletRolePDA(
          signer.publicKey
        )[0],
        authority: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment });

    const distributorData =
      await dividendsProgram.account.merkleDistributor.fetch(distributor);
    assert.equal(distributorData.bump, bump);
    assert.deepEqual(
      distributorData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(distributorData.paused, true);
  });

  it("pause and unpause distribution by transfer admin", async () => {
    const wallet = Keypair.generate();
    await topUpWallet(connection, wallet.publicKey, solToLamports(1));
    await testEnvironment.accessControlHelper.grantRole(
      wallet.publicKey,
      Roles.TransferAdmin,
      testEnvironment.contractAdmin
    );
    const [walletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      wallet.publicKey
    );

    await dividendsProgram.methods
      .pause(true)
      .accountsStrict({
        distributor,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: walletRole,
        authority: wallet.publicKey,
      })
      .signers([wallet])
      .rpc({ commitment });

    let distributorData =
      await dividendsProgram.account.merkleDistributor.fetch(distributor);
    assert.equal(distributorData.bump, bump);
    assert.deepEqual(
      distributorData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(distributorData.paused, true);

    await dividendsProgram.methods
      .pause(false)
      .accountsStrict({
        distributor,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: walletRole,
        authority: wallet.publicKey,
      })
      .signers([wallet])
      .rpc({ commitment });

    distributorData = await dividendsProgram.account.merkleDistributor.fetch(
      distributor
    );
    assert.equal(distributorData.bump, bump);
    assert.deepEqual(
      distributorData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(distributorData.paused, false);
  });

  it("unpauses dividends distribution by contract admin", async () => {
    await dividendsProgram.methods
      .pause(true)
      .accountsStrict({
        distributor,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: testEnvironment.accessControlHelper.walletRolePDA(
          signer.publicKey
        )[0],
        authority: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment });

    let distributorData =
      await dividendsProgram.account.merkleDistributor.fetch(distributor);
    assert.equal(distributorData.bump, bump);
    assert.deepEqual(
      distributorData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(distributorData.paused, true);

    await dividendsProgram.methods
      .pause(false)
      .accountsStrict({
        distributor,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: testEnvironment.accessControlHelper.walletRolePDA(
          signer.publicKey
        )[0],
        authority: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment });

    distributorData = await dividendsProgram.account.merkleDistributor.fetch(
      distributor
    );
    assert.equal(distributorData.bump, bump);
    assert.deepEqual(
      distributorData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(distributorData.paused, false);
  });

  it("fails to pause when already paused", async () => {
    await dividendsProgram.methods
      .pause(true)
      .accountsStrict({
        distributor,
        accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: testEnvironment.accessControlHelper.walletRolePDA(
          signer.publicKey
        )[0],
        authority: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment });

    try {
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
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ValueUnchanged");
      assert.equal(
        error.errorMessage,
        "The provided value is already set. No changes were made"
      );
    }
  });
});
