import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Commitment, Connection } from "@solana/web3.js";
import { TransferRestrictions } from "../../target/types/transfer_restrictions";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export const EXTRA_METAS_ACCOUNT_PREFIX = "extra-account-metas";
export const TRANSFER_RESTRICTION_GROUP_PREFIX = "trg";
export const TRANSFER_RESTRICTION_DATA_PREFIX = "trd";
export const TRANSFER_RULE_PREFIX = "tr";
export const SECURITY_ASSOCIATED_ACCOUNT_PREFIX = "saa"; // security associated account
export const TRANSFER_RESTRICTION_HOLDER_PREFIX = "trh"; // transfer_restriction_holder
export const TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX = "trhg"; // transfer_restriction_holder_group

export class TransferRestrictionsHelper {
  program: Program<TransferRestrictions>;
  mintPubkey: PublicKey;
  transferRestrictionDataPubkey: PublicKey;
  accessControlPubkey: PublicKey;
  commitment: Commitment = "confirmed";

  constructor(
    transferRestrictionsProgram: Program<TransferRestrictions>,
    mintPubkey: PublicKey,
    accessControlPubkey: PublicKey,
    confirmOptions: Commitment = "confirmed"
  ) {
    this.program = transferRestrictionsProgram;
    this.mintPubkey = mintPubkey;
    this.transferRestrictionDataPubkey = this.transferRestrictionDataPDA()[0];
    this.accessControlPubkey = accessControlPubkey;
    this.commitment = confirmOptions;
  }

  transferRestrictionDataPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_DATA_PREFIX),
        this.mintPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  async transferRestrictionData(): Promise<any> {
    return this.program.account.transferRestrictionData.fetch(
      this.transferRestrictionDataPubkey,
      this.commitment
    );
  }

  groupPDA(groupId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_GROUP_PREFIX),
        this.transferRestrictionDataPubkey.toBuffer(),
        groupId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async groupData(groupPubkey: PublicKey): Promise<any> {
    return this.program.account.transferRestrictionGroup.fetch(
      groupPubkey,
      this.commitment
    );
  }

  holderPDA(holderId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
        this.transferRestrictionDataPubkey.toBuffer(),
        holderId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async holderData(holderPubkey: PublicKey): Promise<any> {
    return this.program.account.transferRestrictionHolder.fetch(
      holderPubkey,
      this.commitment
    );
  }

  holderGroupPDA(holderPubkey: PublicKey, groupId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX),
        holderPubkey.toBuffer(),
        groupId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async holderGroupData(holderGroupPubkey: PublicKey): Promise<any> {
    return this.program.account.holderGroup.fetch(
      holderGroupPubkey,
      this.commitment
    );
  }

  transferRulePDA(groupFromId: BN, groupToId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RULE_PREFIX),
        this.transferRestrictionDataPubkey.toBuffer(),
        groupFromId.toArrayLike(Buffer, "le", 8),
        groupToId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async transferRuleData(transferRulePubkey: PublicKey): Promise<any> {
    return this.program.account.transferRule.fetch(
      transferRulePubkey,
      this.commitment
    );
  }

  securityAssociatedAccountPDA(
    userWalletAssociatedAccountPubkey: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
        userWalletAssociatedAccountPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  async securityAssociatedAccountData(
    securityAssociatedAccountPubkey: PublicKey
  ): Promise<any> {
    return this.program.account.securityAssociatedAccount.fetch(
      securityAssociatedAccountPubkey,
      this.commitment
    );
  }

  extraMetasAccountPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(EXTRA_METAS_ACCOUNT_PREFIX), this.mintPubkey.toBuffer()],
      this.program.programId
    );
  }

  initializeExtraMetasAccount(
    payer: PublicKey,
    authorityWalletRolePubkey: PublicKey
  ): any {
    return this.program.instruction.initializeExtraAccountMetaList({
      accounts: {
        extraMetasAccount: this.extraMetasAccountPDA()[0],
        securityMint: this.mintPubkey,
        payer,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        systemProgram: SystemProgram.programId,
      },
    });
  }

  initializeTransferRestrictionData(
    maxHolders: BN,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): any {
    const [groupPDA] = this.groupPDA(new BN(0));
    return this.program.methods
      .initializeTransferRestrictionsData(maxHolders)
      .accountsStrict({
        transferRestrictionData: this.transferRestrictionDataPubkey,
        accessControlAccount: this.accessControlPubkey,
        mint: this.mintPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer ? payer.publicKey : authority.publicKey,
        authority: authority.publicKey,
        zeroTransferRestrictionGroup: groupPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers(payer ? [authority, payer] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async initializeTransferRestrictionGroup(
    groupId: BN,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const [groupPubkey] = this.groupPDA(groupId);
    const payerKeypair = payer || authority;

    return this.program.methods
      .initializeTransferRestrictionGroup(groupId)
      .accountsStrict({
        transferRestrictionGroup: groupPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        accessControlAccount: this.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async initializeTransferRule(
    lockedUntil: BN,
    transferGroupFromId: BN,
    transferGroupToId: BN,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const [transferRulePubkey] = this.transferRulePDA(
      transferGroupFromId,
      transferGroupToId
    );
    const [transferGroupFromPubkey] = this.groupPDA(transferGroupFromId);
    const [transferGroupToPubkey] = this.groupPDA(transferGroupToId);
    const payerKeypair = payer || authority;

    return this.program.methods
      .initializeTransferRule(lockedUntil)
      .accountsStrict({
        transferRule: transferRulePubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        transferRestrictionGroupFrom: transferGroupFromPubkey,
        transferRestrictionGroupTo: transferGroupToPubkey,
        accessControlAccount: this.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async initializeTransferRestrictionHolder(
    holderId: BN,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const [holderPubkey] = this.holderPDA(holderId);
    const payerKeypair = payer || authority;

    return this.program.methods
      .initializeTransferRestrictionHolder(holderId)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        accessControlAccount: this.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async initializeSecurityAssociatedAccount(
    groupPubkey: PublicKey,
    holderPubkey: PublicKey,
    holderGroupPubkey: PublicKey,
    userWalletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const [securityAssociatedAccountPubkey] = this.securityAssociatedAccountPDA(
      userWalletAssociatedAccountPubkey
    );
    const payerKeypair = payer || authority;

    return this.program.methods
      .initializeSecurityAssociatedAccount()
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: this.mintPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        userWallet: userWalletPubkey,
        associatedTokenAccount: userWalletAssociatedAccountPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async initializeHolderGroup(
    holderGroupPubkey: PublicKey,
    holderPubkey: PublicKey,
    groupPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const payerKeypair = payer || authority;

    return this.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async updateWalletGroup(
    userWalletSecAssociatedAccountPubkey: PublicKey,
    groupCurrentPubkey: PublicKey,
    groupNewPubkey: PublicKey,
    holderGroupCurrentPubkey: PublicKey,
    holderGroupNewPubkey: PublicKey,
    authorityWalletRole: PublicKey,
    userWalletPubkey: PublicKey,
    userTokenAccountPubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    return this.program.methods
      .updateWalletGroup()
      .accountsStrict({
        securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
        securityToken: this.mintPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        transferRestrictionGroupCurrent: groupCurrentPubkey,
        transferRestrictionGroupNew: groupNewPubkey,
        holderGroupCurrent: holderGroupCurrentPubkey,
        holderGroupNew: holderGroupNewPubkey,
        authorityWalletRole,
        userWallet: userWalletPubkey,
        userAssociatedTokenAccount: userTokenAccountPubkey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.commitment });
  }

  async setHolderMax(
    maxHolders: BN,
    authorityWalletRolePubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    return this.program.methods
      .setHolderMax(maxHolders)
      .accountsStrict({
        transferRestrictionData: this.transferRestrictionDataPubkey,
        accessControlAccount: this.accessControlPubkey,
        mint: this.mintPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
      })
      .signers([payer])
      .rpc({ commitment: this.commitment });
  }

  async setHolderGroupMax(
    maxHolders: BN,
    groupPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    return this.program.methods
      .setHolderGroupMax(maxHolders)
      .accountsStrict({
        transferRestrictionData: this.transferRestrictionDataPubkey,
        accessControlAccount: this.accessControlPubkey,
        mint: this.mintPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        group: groupPubkey,
        payer: payer.publicKey,
      })
      .signers([payer])
      .rpc({ commitment: this.commitment });
  }

  async setAllowTransferRule(
    lockedUntil: BN,
    transferRulePubkey: PublicKey,
    transferRestrictionGroupFromPubkey: PublicKey,
    transferRestrictionGroupToPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    return this.program.methods
      .setAllowTransferRule(lockedUntil)
      .accountsStrict({
        transferRestrictionData: this.transferRestrictionDataPubkey,
        transferRule: transferRulePubkey,
        transferRestrictionGroupFrom: transferRestrictionGroupFromPubkey,
        transferRestrictionGroupTo: transferRestrictionGroupToPubkey,
        accessControlAccount: this.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
      })
      .signers([payer])
      .rpc({ commitment: this.commitment });
  }

  async revokeSecurityAssociatedAccount(
    userWalletSecAssociatedAccountPubkey: PublicKey,
    userWalletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const userWalletSecAssocAccountData =
      await this.securityAssociatedAccountData(
        userWalletSecAssociatedAccountPubkey
      );
    const groupId = userWalletSecAssocAccountData.group;
    const holderPubkey = userWalletSecAssocAccountData.holder;
    const [groupPubkey] = this.groupPDA(groupId);
    const [holderGroupPubkey] = this.holderGroupPDA(holderPubkey, groupId);
    const payerKeypair = payer || authority;

    return this.program.methods
      .revokeSecurityAssociatedAccount()
      .accountsStrict({
        securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: this.mintPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        userWallet: userWalletPubkey,
        associatedTokenAccount: userWalletAssociatedAccountPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async revokeHolder(
    holderPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const payerKeypair = payer || authority;

    return this.program.methods
      .revokeHolder()
      .accountsStrict({
        holder: holderPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async revokeHolderGroup(
    holderPubkey: PublicKey,
    groupId: BN,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const [holderGroupPubkey] = this.holderGroupPDA(holderPubkey, groupId);
    const [groupPubkey] = this.groupPDA(groupId);
    const payerKeypair = payer || authority;

    return this.program.methods
      .revokeHolderGroup()
      .accountsStrict({
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        group: groupPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        authority: authority.publicKey,
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payerKeypair] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async setLockupEscrowAccount(
    lockupEscrowAccountPubkey: PublicKey,
    tokenlockAccountPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    payer?: Keypair
  ): Promise<string> {
    const [escrowSecurityAssociatedAccountPubkey] =
      this.securityAssociatedAccountPDA(lockupEscrowAccountPubkey);
    return this.program.methods
      .setLockupEscrowAccount()
      .accountsStrict({
        transferRestrictionData: this.transferRestrictionDataPubkey,
        escrowSecurityAssociatedAccount: escrowSecurityAssociatedAccountPubkey,
        mint: this.mintPubkey,
        accessControlAccount: this.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        escrowAccount: lockupEscrowAccountPubkey,
        tokenlockAccount: tokenlockAccountPubkey,
        payer: payer ? payer.publicKey : authority.publicKey,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers(payer ? [authority, payer] : [authority])
      .rpc({ commitment: this.commitment });
  }

  async initializeSecurityAssociatedAccountIfNotExists(
    userWalletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    authority: Keypair,
    groupIdx: BN = new BN(0),
    payer?: Keypair
  ) {
    const [securityAssociatedAccountPubkey] = this.securityAssociatedAccountPDA(
      userWalletAssociatedAccountPubkey
    );

    // Check if security_associated_account exists
    const saaAccountInfo = await this.program.provider.connection.getAccountInfo(securityAssociatedAccountPubkey);
    const saaExists = saaAccountInfo !== null && saaAccountInfo.data.length > 0;

    if (!saaExists) {
      // Initialize holder, holder_group, and SAA with group 0
      const transferRestrictionData = await this.transferRestrictionData();
      const holderId = transferRestrictionData.holderIds;

      // Initialize holder
      await this.initializeTransferRestrictionHolder(
        holderId,
        authorityWalletRolePubkey,
        authority,
        payer
      );

      // Get PDAs
      const [holderPubkey] = this.holderPDA(holderId);
      const [groupPubkey] = this.groupPDA(groupIdx);
      const [holderGroupPubkey] = this.holderGroupPDA(
        holderPubkey,
        groupIdx
      );

      // Initialize holder group
      await this.initializeHolderGroup(
        holderGroupPubkey,
        holderPubkey,
        groupPubkey,
        authorityWalletRolePubkey,
        authority,
        payer
      );

      // Initialize security associated account
      await this.initializeSecurityAssociatedAccount(
        groupPubkey,
        holderPubkey,
        holderGroupPubkey,
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        authorityWalletRolePubkey,
        authority,
        payer
      );
    }
  }
}
