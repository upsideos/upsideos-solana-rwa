import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { solToLamports, topUpWallet } from "../utils";
import { Roles } from "../helpers/access-control_helper";

describe("Access Control set max total supply", () => {
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

  it("fails to set max total supply non Reserve Admin", async () => {
    const wallet = new Keypair();
    await topUpWallet(
      testEnvironment.connection,
      wallet.publicKey,
      solToLamports(1)
    );
    await testEnvironment.accessControlHelper.grantRole(
      wallet.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );
    await testEnvironment.accessControlHelper.grantRole(
      wallet.publicKey,
      Roles.ContractAdmin,
      testEnvironment.contractAdmin
    );
    await testEnvironment.accessControlHelper.grantRole(
      wallet.publicKey,
      Roles.TransferAdmin,
      testEnvironment.contractAdmin
    );
    const newMaxTotalSupply = new anchor.BN(
      testEnvironmentParams.maxTotalSupply + 1
    );
    try {
      await testEnvironment.accessControlHelper.program.methods
        .setMaxTotalSupply(newMaxTotalSupply)
        .accountsStrict({
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              wallet.publicKey
            )[0],
          payer: wallet.publicKey,
        })
        .signers([wallet])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("sets max total supply by reserve admin", async () => {
    const newMaxTotalSupply = new anchor.BN(
      testEnvironmentParams.maxTotalSupply + 1
    );
    await testEnvironment.accessControlHelper.program.methods
      .setMaxTotalSupply(newMaxTotalSupply)
      .accountsStrict({
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        mint: testEnvironment.mintKeypair.publicKey,
        authorityWalletRole: reserveAdminWalletRole,
        payer: testEnvironment.reserveAdmin.publicKey,
      })
      .signers([testEnvironment.reserveAdmin])
      .rpc({ commitment: testEnvironment.commitment });

    const accessControl =
      await testEnvironment.accessControlHelper.accessControlData();
    assert.ok(accessControl.maxTotalSupply.eq(newMaxTotalSupply));
  });

  it("fails to set max total supply not greater than current total supply", async () => {
    const newMaxTotalSupply = new anchor.BN(
      testEnvironmentParams.maxTotalSupply
    );
    try {
      await testEnvironment.accessControlHelper.program.methods
        .setMaxTotalSupply(newMaxTotalSupply)
        .accountsStrict({
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: reserveAdminWalletRole,
          payer: testEnvironment.reserveAdmin.publicKey,
        })
        .signers([testEnvironment.reserveAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(
        error.errorCode.code,
        "NewMaxTotalSupplyMustExceedCurrentTotalSupply"
      );
      assert.equal(
        error.errorMessage,
        "New max total supply must exceed current total supply"
      );
    }
  });
});
