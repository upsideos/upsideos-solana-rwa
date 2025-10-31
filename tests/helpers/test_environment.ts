import {
  Program,
  AnchorProvider,
  workspace,
  setProvider,
  BN,
} from "@coral-xyz/anchor";
import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
  Commitment,
} from "@solana/web3.js";

import { TransferRestrictions } from "../../target/types/transfer_restrictions";
import { AccessControl } from "../../target/types/access_control";
import { MintHelper } from "./mint_helper";
import {
  AccessControlHelper,
  Roles,
  SetupAccessControlArgs,
} from "./access-control_helper";
import { TransferRestrictionsHelper } from "./transfer-restrictions_helper";
import { solToLamports, topUpWallet } from "../utils";

export class TestEnvironmentParams {
  mint: {
    decimals: number;
    name: string;
    symbol: string;
    uri: string;
  };
  initialSupply: number;
  maxHolders: number;
  maxTotalSupply: number;
}

export class TestEnvironment {
  params: TestEnvironmentParams;
  accessControlProgram = workspace.AccessControl as Program<AccessControl>;
  transferRestrictionsProgram =
    workspace.TransferRestrictions as Program<TransferRestrictions>;
  provider = AnchorProvider.env();
  connection = this.provider.connection;
  commitment: Commitment = "confirmed";
  mintKeypair = Keypair.generate();
  mintHelper = new MintHelper(this.connection, this.mintKeypair.publicKey);
  accessControlHelper = new AccessControlHelper(
    this.accessControlProgram,
    this.mintKeypair.publicKey
  );
  transferRestrictionsHelper = new TransferRestrictionsHelper(
    this.transferRestrictionsProgram,
    this.mintKeypair.publicKey,
    this.accessControlHelper.accessControlPubkey
  );
  superAdmin = Keypair.generate();
  contractAdmin = Keypair.generate();
  reserveAdmin = Keypair.generate();
  walletsAdmin = Keypair.generate();
  transferAdmin = Keypair.generate();

  adminsWallets = {
    superAdmin: this.superAdmin,
    contractAdmin: this.contractAdmin,
    reserveAdmin: this.reserveAdmin,
    walletsAdmin: this.walletsAdmin,
    transferAdmin: this.transferAdmin,
  };

  constructor(params: TestEnvironmentParams) {
    setProvider(this.provider);
    this.params = params;
  }

  async topupAdminsWallets() {
    for (const admin in this.adminsWallets) {
      await topUpWallet(
        this.connection,
        this.adminsWallets[admin].publicKey,
        solToLamports(10)
      );
    }
  }

  async setupAdminRoles() {
    await this.accessControlHelper.initializeWalletRole(
      this.reserveAdmin.publicKey,
      Roles.ReserveAdmin,
      this.contractAdmin
    );

    await this.accessControlHelper.initializeWalletRole(
      this.walletsAdmin.publicKey,
      Roles.WalletsAdmin,
      this.contractAdmin
    );

    await this.accessControlHelper.initializeWalletRole(
      this.transferAdmin.publicKey,
      Roles.TransferAdmin,
      this.contractAdmin
    );
  }

  private async setupProgramsData(
    setupAccessControlArgs: SetupAccessControlArgs
  ) {
    const [contractAdminRolePubkey] = this.accessControlHelper.walletRolePDA(
      this.contractAdmin.publicKey
    );
    const initializeAccessControlInstr =
      this.accessControlHelper.initializeAccessControlInstruction(
        setupAccessControlArgs
      );

    const initializeExtraAccountMetaListInstr =
      this.transferRestrictionsHelper.initializeExtraMetasAccount(
        this.contractAdmin.publicKey,
        contractAdminRolePubkey
      );

    // Add instructions to new transaction
    const transaction = new Transaction().add(
      initializeAccessControlInstr,
      initializeExtraAccountMetaListInstr
    );

    await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.contractAdmin, this.mintKeypair], // Signers
      { commitment: this.commitment }
    );
  }

  async setupAccessControl() {
    await this.topupAdminsWallets();
    const setupAccessControlArgs = {
      decimals: this.params.mint.decimals,
      payer: this.contractAdmin.publicKey,
      authority: this.contractAdmin.publicKey,
      name: this.params.mint.name,
      uri: this.params.mint.uri,
      symbol: this.params.mint.symbol,
      delegate: this.contractAdmin.publicKey,
      hookProgramId: this.transferRestrictionsProgram.programId,
      maxTotalSupply: new BN(this.params.maxTotalSupply),
    };
    await this.setupProgramsData(setupAccessControlArgs);
    await this.mintHelper.createAssociatedTokenAccount(
      this.reserveAdmin.publicKey,
      this.superAdmin
    );
    await this.setupAdminRoles();
  }

  async setupTransferRestrictions() {
    await this.transferRestrictionsHelper.initializeTransferRestrictionData(
      new BN(this.params.maxHolders),
      this.accessControlHelper.walletRolePDA(this.contractAdmin.publicKey)[0],
      this.contractAdmin
    );
  }

  async mintToReserveAdmin() {
    const reserveAdminAssociatedTokenAccount =
      this.mintHelper.getAssocciatedTokenAddress(this.reserveAdmin.publicKey);
    
    const [reserveAdminSaaPubkey] = this.transferRestrictionsHelper.securityAssociatedAccountPDA(
      reserveAdminAssociatedTokenAccount
    );

    const [walletsAdminWalletRole] = this.accessControlHelper.walletRolePDA(
      this.walletsAdmin.publicKey
    );

    await this.transferRestrictionsHelper.initializeSecurityAssociatedAccountIfNotExists(
      this.reserveAdmin.publicKey,
      reserveAdminAssociatedTokenAccount,
      walletsAdminWalletRole,
      this.walletsAdmin
    );

    await this.accessControlHelper.mintSecurities(
      new BN(this.params.initialSupply),
      this.reserveAdmin.publicKey,
      reserveAdminAssociatedTokenAccount,
      this.reserveAdmin,
      reserveAdminSaaPubkey
    );
  }
}
