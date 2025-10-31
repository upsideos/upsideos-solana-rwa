use access_control::WalletRole;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    contexts::common::DISCRIMINATOR_LEN, HolderGroup, SecurityAssociatedAccount,
    TransferRestrictionData, TransferRestrictionGroup, TransferRestrictionHolder,
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
    TRANSFER_RESTRICTION_GROUP_PREFIX, TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX,
    TRANSFER_RESTRICTION_HOLDER_PREFIX,
    errors::TransferRestrictionsError,
};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeDefaultSecurityAccounts<'info> {
    // Initialize holder
    #[account(init_if_needed, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionHolder::INIT_SPACE,
      seeds = [
        TRANSFER_RESTRICTION_HOLDER_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &id.to_le_bytes(),
      ],
      bump,
    )]
    pub transfer_restriction_holder: Account<'info, TransferRestrictionHolder>,

    // Initialize holder_group for group 0
    #[account(init_if_needed, payer = payer, space = DISCRIMINATOR_LEN + HolderGroup::INIT_SPACE,
      seeds = [
        TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX.as_bytes(),
        &transfer_restriction_holder.key().to_bytes(),
        &0u64.to_le_bytes(),
      ],
      bump,
    )]
    pub holder_group: Account<'info, HolderGroup>,

    // Initialize security associated account
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + SecurityAssociatedAccount::INIT_SPACE,
      seeds = [
        SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
        &associated_token_account.key().to_bytes(),
      ],
      bump,
      constraint = group.id == 0 @ TransferRestrictionsError::MustBeGroupZero,
    )]
    pub security_associated_account: Account<'info, SecurityAssociatedAccount>,

    // Group 0 must exist
    #[account(mut,
      seeds = [
        TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &0u64.to_le_bytes()
      ],
      bump,
      constraint = group.transfer_restriction_data == transfer_restriction_data.key(),
      constraint = group.id == 0 @ TransferRestrictionsError::MustBeGroupZero,
    )]
    pub group: Account<'info, TransferRestrictionGroup>,

    #[account(
      constraint = security_token.key() == transfer_restriction_data.security_token_mint,
      token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub security_token: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
      seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &security_token.key().to_bytes(),
      ],
      bump
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,

    /// CHECK: Wallet address
    pub user_wallet: AccountInfo<'info>,

    #[account(
      associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
      associated_token::mint = security_token,
      associated_token::authority = user_wallet,
    )]
    pub associated_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      constraint = authority_wallet_role.owner == payer.key(),
      constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}


