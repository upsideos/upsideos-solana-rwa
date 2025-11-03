use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, ID as TOKEN_2022_PROGRAM_ID},
    token_interface::{Mint, TokenAccount},
};

use crate::{
    contexts::common::WalletRole,
    AccessControl, ACCESS_CONTROL_SEED,
};


#[derive(Accounts)]
pub struct SetLockupEscrowAccount<'info> {
    #[account(mut,
        seeds = [
        ACCESS_CONTROL_SEED,
        mint.key().as_ref(),
      ],
      bump,
    )]
    pub access_control_account: Account<'info, AccessControl>,

    #[account(
        mint::token_program = TOKEN_2022_PROGRAM_ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
        token::mint = mint,
        token::token_program = token_2022::ID,
        constraint = escrow_account.mint == mint.key(),
    )]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: implemented own serialization in order to save compute units
    #[account(
        constraint = *tokenlock_account.owner == tokenlock_accounts::ID,
    )]
    pub tokenlock_account: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}
