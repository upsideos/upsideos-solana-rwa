use anchor_lang::{prelude::*, solana_program::program_option::COption};
use anchor_spl::{
    token_2022::Token2022,
    token_interface::{Mint, TokenAccount},
};

use crate::{
    contexts::common::{WalletRole, WALLET_ROLE_PREFIX},
    AccessControl, ACCESS_CONTROL_SEED,
};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct ForceTransferBetween<'info> {
    #[account(mut,
      associated_token::token_program = token_program,
      associated_token::mint = security_mint,
      associated_token::authority = source_authority,
    )]
    pub source_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
      constraint = security_mint.mint_authority == COption::Some(access_control_account.key()),
    )]
    pub security_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
      associated_token::token_program = token_program,
      associated_token::mint = security_mint,
      associated_token::authority = destination_authority,
    )]
    pub destination_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account()]
    pub authority: Signer<'info>,
    #[account(
      seeds = [
        WALLET_ROLE_PREFIX,
        &security_mint.key().to_bytes(),
        &authority.key().to_bytes(),
      ],
      bump,
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    #[account(
      constraint = security_mint.key() == access_control_account.mint,
      seeds = [
        ACCESS_CONTROL_SEED,
        security_mint.key().as_ref(),
      ],
      bump,
    )]
    pub access_control_account: Box<Account<'info, AccessControl>>,

    /// CHECK: The sender_authority account is the account that owner of the sender_account
    pub source_authority: UncheckedAccount<'info>,

    /// CHECK: The destination_authority account is the account that owner of the destination_account
    pub destination_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token2022>,
}
