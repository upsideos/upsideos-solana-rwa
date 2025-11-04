use access_control::WalletRole;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    contexts::common::DISCRIMINATOR_LEN, HolderGroup, TransferRestrictionData,
    TransferRestrictionGroup, TransferRestrictionHolder, TRANSFER_RESTRICTION_DATA_PREFIX,
};

pub const SECURITY_ASSOCIATED_ACCOUNT_PREFIX: &str = "saa"; // security associated account

#[account]
#[derive(Default, InitSpace)]
pub struct SecurityAssociatedAccount {
    pub group: u64,
    pub holder: Option<Pubkey>,
}

#[derive(Accounts)]
#[instruction(group_id: u64, holder_id: u64)]
pub struct InitializeSecurityAssociatedAccount<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + SecurityAssociatedAccount::INIT_SPACE,
      seeds = [
        SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
        &associated_token_account.key().to_bytes(),
      ],
      bump,
    )]
    pub security_associated_account: Account<'info, SecurityAssociatedAccount>,
    #[account(mut,
      constraint = group.transfer_restriction_data == transfer_restriction_data.key(),
      constraint = group.id == group_id,
    )]
    pub group: Account<'info, TransferRestrictionGroup>,
    #[account(mut,
      constraint = holder.transfer_restriction_data == transfer_restriction_data.key(),
      constraint = holder.id == holder_id,
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
