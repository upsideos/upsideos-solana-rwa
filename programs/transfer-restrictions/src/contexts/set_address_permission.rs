use access_control::{AccessControl, WalletRole, ACCESS_CONTROL_SEED};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};

use crate::{
    contexts::common::DISCRIMINATOR_LEN, HolderGroup, SecurityAssociatedAccount,
    TransferRestrictionData, TransferRestrictionGroup, TransferRestrictionHolder,
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
    TRANSFER_RESTRICTION_GROUP_PREFIX, TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX,
    TRANSFER_RESTRICTION_HOLDER_PREFIX,
};

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct SetAddressPermission<'info> {
    // Security associated account - init_if_needed
    #[account(
        init_if_needed,
        payer = payer,
        space = DISCRIMINATOR_LEN + SecurityAssociatedAccount::INIT_SPACE,
        seeds = [
            SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
            &user_associated_token_account.key().to_bytes(),
        ],
        bump,
    )]
    pub security_associated_account: Account<'info, SecurityAssociatedAccount>,

    // Transfer restriction group for the target group_id - must already exist (not initialized here)
    #[account(
        mut,
        constraint = transfer_restriction_group_new.transfer_restriction_data == transfer_restriction_data.key(),
        constraint = transfer_restriction_group_new.id == group_id,
        seeds = [
            TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
            &transfer_restriction_data.key().to_bytes(),
            &group_id.to_le_bytes(),
        ],
        bump,
    )]
    pub transfer_restriction_group_new: Account<'info, TransferRestrictionGroup>,

    // Current transfer restriction group - only present if security_associated_account exists with a different group
    #[account(
        mut,
        constraint = transfer_restriction_group_current.transfer_restriction_data == transfer_restriction_data.key(),
        constraint = transfer_restriction_group_current.id == security_associated_account.group,
        seeds = [
            TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
            &transfer_restriction_data.key().to_bytes(),
            &security_associated_account.group.to_le_bytes(),
        ],
        bump,
    )]
    pub transfer_restriction_group_current: Option<Account<'info, TransferRestrictionGroup>>,

    // Holder - must already exist (not initialized here)
    #[account(
        mut,
        constraint = transfer_restriction_holder.transfer_restriction_data == transfer_restriction_data.key(),
        seeds = [
            TRANSFER_RESTRICTION_HOLDER_PREFIX.as_bytes(),
            &transfer_restriction_data.key().to_bytes(),
            &transfer_restriction_holder.id.to_le_bytes(),
        ],
        bump,
    )]
    pub transfer_restriction_holder: Account<'info, TransferRestrictionHolder>,

    // Holder group for new group - must already exist (not initialized here)
    #[account(
        mut,
        constraint = holder_group_new.holder == transfer_restriction_holder.key(),
        constraint = holder_group_new.group == group_id,
        seeds = [
            TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX.as_bytes(),
            &transfer_restriction_holder.key().to_bytes(),
            &group_id.to_le_bytes(),
        ],
        bump,
    )]
    pub holder_group_new: Account<'info, HolderGroup>,

    // Current holder group - only present if security_associated_account exists with a holder and different group
    #[account(
        mut,
        seeds = [
            TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX.as_bytes(),
            &security_associated_account.holder.unwrap_or_default().to_bytes(),
            &security_associated_account.group.to_le_bytes(),
        ],
        bump,
    )]
    pub holder_group_current: Option<Account<'info, HolderGroup>>,

    #[account(
        constraint = security_token.key() == transfer_restriction_data.security_token_mint,
        constraint = security_token.key() == security_mint.key(),
        token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub security_token: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
            &security_token.key().to_bytes(),
        ],
        bump,
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,

    /// CHECK: Wallet address
    pub user_wallet: AccountInfo<'info>,

    #[account(mut,
        associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
        associated_token::mint = security_token,
        associated_token::authority = user_wallet,
    )]
    pub user_associated_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      constraint = authority_wallet_role.owner == payer.key(),
      constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
      mut,
      constraint = security_mint.key() == transfer_restriction_data.security_token_mint,
      constraint = security_mint.mint_authority == COption::Some(access_control_account.key()),
    )]
    pub security_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      constraint = access_control_account.key() == transfer_restriction_data.access_control_account,
      constraint = access_control_account.mint == security_mint.key(),
      seeds = [
        ACCESS_CONTROL_SEED,
        security_mint.key().as_ref(),
      ],
      seeds::program = access_control_program,
      bump,
    )]
    pub access_control_account: Box<Account<'info, AccessControl>>,

    pub access_control_program: Program<'info, access_control::program::AccessControl>,

    pub token_program: Program<'info, Token2022>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

