use access_control::WalletRole;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    HolderGroup, SecurityAssociatedAccount, TransferRestrictionData, TransferRestrictionGroup,
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
    TRANSFER_RESTRICTION_GROUP_PREFIX, TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX,
};

#[derive(Accounts)]
#[instruction(new_group_id: u64)]
pub struct UpdateWalletGroup<'info> {
    #[account(mut,
      seeds = [
        SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
        &user_associated_token_account.key().to_bytes(),
      ],
      bump,
    )]
    pub security_associated_account: Account<'info, SecurityAssociatedAccount>,
    #[account(
      constraint = security_token.key() == transfer_restriction_data.security_token_mint,
    )]
    pub security_token: Box<InterfaceAccount<'info, Mint>>,
    #[account(
      seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &security_token.key().to_bytes(),
      ],
      bump
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
    #[account(mut,
      constraint = transfer_restriction_group_current.transfer_restriction_data == transfer_restriction_data.key(),
      seeds = [
        TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &transfer_restriction_group_current.id.to_le_bytes()
      ],
      bump,
    )]
    pub transfer_restriction_group_current: Account<'info, TransferRestrictionGroup>,
    #[account(mut,
      constraint = transfer_restriction_group_new.transfer_restriction_data == transfer_restriction_data.key(),
      constraint = transfer_restriction_group_new.id == new_group_id,
      seeds = [
        TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &transfer_restriction_group_new.id.to_le_bytes()
      ],
      bump,
    )]
    pub transfer_restriction_group_new: Account<'info, TransferRestrictionGroup>,

    #[account(mut,
      seeds = [
        TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX.as_bytes(),
        &security_associated_account.holder.unwrap().to_bytes(),
        &security_associated_account.group.to_le_bytes(),
      ],
      bump,
      constraint = holder_group_current.group == security_associated_account.group,
      constraint = holder_group_current.group == transfer_restriction_group_current.id,
      constraint = holder_group_current.holder == security_associated_account.holder.unwrap(),
    )]
    pub holder_group_current: Account<'info, HolderGroup>,
    #[account(mut,
      seeds = [
        TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX.as_bytes(),
        &security_associated_account.holder.unwrap().to_bytes(),
        &transfer_restriction_group_new.id.to_le_bytes(),
      ],
      bump,
      constraint = holder_group_new.group == transfer_restriction_group_new.id,
      constraint = holder_group_new.holder == security_associated_account.holder.unwrap(),
    )]
    pub holder_group_new: Account<'info, HolderGroup>,

    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    /// CHECK: Wallet address
    pub user_wallet: AccountInfo<'info>,
    #[account(
      associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
      associated_token::mint = security_token,
      associated_token::authority = user_wallet,
    )]
    pub user_associated_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
