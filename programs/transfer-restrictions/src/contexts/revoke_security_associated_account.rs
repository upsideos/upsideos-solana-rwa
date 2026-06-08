use access_control::WalletRole;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    errors::TransferRestrictionsError, HolderGroup, SecurityAssociatedAccount,
    TransferRestrictionData, TransferRestrictionGroup, TransferRestrictionHolder,
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
};

#[derive(Accounts)]
#[instruction()]
pub struct RevokeSecurityAssociatedAccount<'info> {
    #[account(mut,
      close = payer,
      seeds = [
        SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
        &associated_token_account.key().to_bytes(),
      ],
      bump,
    )]
    pub security_associated_account: Account<'info, SecurityAssociatedAccount>,
    #[account(mut,
      constraint = group.transfer_restriction_data == transfer_restriction_data.key(),
      // Bind the group to the security associated account being revoked so that the
      // counters decremented below belong to the wallet that is actually being removed.
      constraint = group.id == security_associated_account.group @ TransferRestrictionsError::InvalidPDA,
    )]
    pub group: Account<'info, TransferRestrictionGroup>,
    #[account(mut,
      constraint = holder.transfer_restriction_data == transfer_restriction_data.key(),
      // Bind the holder to the security associated account being revoked.
      constraint = security_associated_account.holder == Some(holder.key()) @ TransferRestrictionsError::InvalidPDA,
    )]
    pub holder: Account<'info, TransferRestrictionHolder>,
    #[account(mut,
      constraint = holder_group.group == group.id,
      constraint = holder_group.holder == holder.key(),
    )]
    pub holder_group: Account<'info, HolderGroup>,
    #[account(
      constraint = security_token.key() == transfer_restriction_data.security_token_mint,
      token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
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
    /// CHECK: Wallet address
    pub user_wallet: AccountInfo<'info>,
    #[account(
      associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
      associated_token::mint = security_token,
      associated_token::authority = user_wallet,
    )]
    pub associated_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
      constraint = authority_wallet_role.owner == authority.key(),
      constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
