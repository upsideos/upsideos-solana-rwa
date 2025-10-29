import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { Roles } from "../helpers/access-control_helper";

describe("Access Control wallet role", () => {
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

  const investor = new Keypair();
  it("fails to grant wallet role by reserve admin", async () => {
    try {
      await testEnvironment.accessControlHelper.grantRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to grant wallet role by wallets admin", async () => {
    try {
      await testEnvironment.accessControlHelper.grantRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.walletsAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to grant wallet role by transfer admin", async () => {
    try {
      await testEnvironment.accessControlHelper.grantRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.transferAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to grant invalid wallet role", async () => {
    try {
      await testEnvironment.accessControlHelper.grantRole(
        investor.publicKey,
        Roles.All + 1,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "InvalidRole");
      assert.equal(error.errorMessage, "Invalid role");
    }
  });

  it("grants wallet role by contract admin", async () => {
    await testEnvironment.accessControlHelper.grantRole(
      investor.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );

    const [walletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(investor.publicKey);
    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        walletRolePubkey
      );
    assert.equal(walletRoleData.role, Roles.WalletsAdmin);
    assert.strictEqual(
      walletRoleData.owner.toString(),
      investor.publicKey.toString()
    );
    assert.strictEqual(
      walletRoleData.accessControl.toString(),
      testEnvironment.accessControlHelper.accessControlPubkey.toString()
    );
  });

  it("fails to grant already granted role", async () => {
    try {
      await testEnvironment.accessControlHelper.grantRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "AlreadyHasRole");
      assert.equal(error.errorMessage, "Wallet already has this role");
    }
  });

  it("fails to revoke wallet role by reserve admin", async () => {
    try {
      await testEnvironment.accessControlHelper.revokeRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to revoke wallet role by wallets admin", async () => {
    try {
      await testEnvironment.accessControlHelper.revokeRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.walletsAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to revoke wallet role by transfer admin", async () => {
    try {
      await testEnvironment.accessControlHelper.revokeRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.transferAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("revokes wallet role by contract admin", async () => {
    await testEnvironment.accessControlHelper.revokeRole(
      investor.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );

    const [walletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(investor.publicKey);
    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        walletRolePubkey
      );
    assert.equal(walletRoleData.role, Roles.None);
    assert.strictEqual(
      walletRoleData.owner.toString(),
      investor.publicKey.toString()
    );
    assert.strictEqual(
      walletRoleData.accessControl.toString(),
      testEnvironment.accessControlHelper.accessControlPubkey.toString()
    );
  });

  it("grants multiple roles by contract admin", async () => {
    // Grant WalletsAdmin
    await testEnvironment.accessControlHelper.grantRole(
      investor.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );
    
    // Grant TransferAdmin (should combine with existing roles)
    await testEnvironment.accessControlHelper.grantRole(
      investor.publicKey,
      Roles.TransferAdmin,
      testEnvironment.contractAdmin
    );

    const [walletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(investor.publicKey);
    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        walletRolePubkey
      );
    assert.equal(walletRoleData.role, Roles.WalletsAdmin | Roles.TransferAdmin);
  });

  it("fails to revoke role that wallet does not have", async () => {
    // Revoke all roles first
    await testEnvironment.accessControlHelper.revokeRole(
      investor.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );
    await testEnvironment.accessControlHelper.revokeRole(
      investor.publicKey,
      Roles.TransferAdmin,
      testEnvironment.contractAdmin
    );

    // Try to revoke a role that doesn't exist
    try {
      await testEnvironment.accessControlHelper.revokeRole(
        investor.publicKey,
        Roles.ReserveAdmin,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "CannotRevokeRole");
      assert.equal(
        error.errorMessage,
        "Cannot revoke role that wallet does not have"
      );
    }
  });

  it("fails to grant invalid wallet role", async () => {
    try {
      await testEnvironment.accessControlHelper.grantRole(
        investor.publicKey,
        Roles.All + 1,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "InvalidRole");
      assert.equal(error.errorMessage, "Invalid role");
    }
  });
});
