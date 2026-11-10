import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

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

describe("Token-2022 multisig as wallets admin", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10,
    maxTotalSupply: 100_000_000_000_000,
  };
  const groupId = new anchor.BN(0);
  const holderId = new anchor.BN(0);
  let testEnvironment: TestEnvironment;
  let multisig: Token2022Multisig;
  let multisigWalletRole: PublicKey;
  let holderPubkey: PublicKey;
  let groupPubkey: PublicKey;
  let holderGroupPubkey: PublicKey;
  const investor = Keypair.generate();
  let investorTokenAccount: PublicKey;
  let securityAssociatedAccount: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    multisig = await createToken2022Multisig(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      3,
      2,
      testEnvironment.commitment
    );
    await testEnvironment.accessControlHelper.grantRole(
      multisig.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );
    [multisigWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      multisig.publicKey
    );
    const role = await testEnvironment.accessControlHelper.walletRoleData(
      multisigWalletRole
    );
    assert.equal(role.role, Roles.WalletsAdmin);

    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderId);
    [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupId);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    investorTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investor.publicKey,
        testEnvironment.contractAdmin
      );
    [securityAssociatedAccount] =
      testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
        investorTokenAccount
      );
  });

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

  function holderInstruction() {
    return testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionHolder(holderId)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        payer: testEnvironment.contractAdmin.publicKey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: multisigWalletRole,
        authority: multisig.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  function holderGroupInstruction() {
    return testEnvironment.transferRestrictionsHelper.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: multisigWalletRole,
        payer: testEnvironment.contractAdmin.publicKey,
        authority: multisig.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  function securityAssociatedAccountInstruction() {
    return testEnvironment.transferRestrictionsHelper.program.methods
      .initializeSecurityAssociatedAccount(groupId, holderId)
      .accountsStrict({
        securityAssociatedAccount,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        userWallet: investor.publicKey,
        associatedTokenAccount: investorTokenAccount,
        authorityWalletRole: multisigWalletRole,
        authority: multisig.publicKey,
        payer: testEnvironment.contractAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  it("rejects initialize holder signed by one multisig member", async () => {
    await expectMultisigRejected(await holderInstruction(), [
      multisig.members[0],
    ]);
  });

  it("rejects initialize holder signed only by the multisig account key", async () => {
    try {
      await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
        holderId,
        multisigWalletRole,
        multisig.keypair,
        testEnvironment.contractAdmin
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

  it("initializes a holder with two of three multisig members", async () => {
    await sendAsSplMultisig(
      testEnvironment.connection,
      await holderInstruction(),
      multisig.publicKey,
      [multisig.members[0], multisig.members[1]],
      testEnvironment.contractAdmin,
      testEnvironment.commitment
    );
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.isTrue(holderData.active);
    assert.equal(holderData.id.toString(), holderId.toString());
    assert.equal(
      holderData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
  });

  it("rejects initialize holder group signed by one multisig member", async () => {
    await expectMultisigRejected(await holderGroupInstruction(), [
      multisig.members[1],
    ]);
  });

  it("initializes a holder group with two of three multisig members", async () => {
    await sendAsSplMultisig(
      testEnvironment.connection,
      await holderGroupInstruction(),
      multisig.publicKey,
      [multisig.members[0], multisig.members[2]],
      testEnvironment.contractAdmin,
      testEnvironment.commitment
    );
    const holderGroupData =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    assert.equal(holderGroupData.group.toString(), groupId.toString());
    assert.equal(holderGroupData.holder.toBase58(), holderPubkey.toBase58());
    assert.equal(holderGroupData.currentWalletsCount.toNumber(), 0);
  });

  it("rejects initialize security associated account signed by one multisig member", async () => {
    await expectMultisigRejected(
      await securityAssociatedAccountInstruction(),
      [multisig.members[2]]
    );
  });

  it("initializes a security associated account with two of three multisig members", async () => {
    await sendAsSplMultisig(
      testEnvironment.connection,
      await securityAssociatedAccountInstruction(),
      multisig.publicKey,
      [multisig.members[1], multisig.members[2]],
      testEnvironment.contractAdmin,
      testEnvironment.commitment
    );
    const saa =
      await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(
        securityAssociatedAccount
      );
    assert.equal(saa.group.toString(), groupId.toString());
    assert.equal(saa.holder.toBase58(), holderPubkey.toBase58());
  });
});
