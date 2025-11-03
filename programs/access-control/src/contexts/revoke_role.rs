use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    contexts::common::{WalletRole, WALLET_ROLE_PREFIX},
    AccessControl, ACCESS_CONTROL_SEED,
};

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct RevokeRole<'info> {
    #[account(
        mut,
        constraint = wallet_role.owner == user_wallet.key(),
        constraint = wallet_role.access_control == access_control.key(),
        seeds = [
            WALLET_ROLE_PREFIX,
            &security_token.key().to_bytes(),
            &user_wallet.key().to_bytes(),
        ],
        bump,
    )]
    pub wallet_role: Account<'info, WalletRole>,
    #[account(
        seeds = [
            WALLET_ROLE_PREFIX,
            &security_token.key().to_bytes(),
            &payer.key().to_bytes(),
        ],
        bump,
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    #[account(
        constraint = security_token.key() == access_control.mint,
        seeds = [
            ACCESS_CONTROL_SEED,
            &security_token.key().to_bytes(),
        ],
        bump,
    )]
    pub access_control: Account<'info, AccessControl>,
    pub security_token: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: Wallet address which role to be revoked
    pub user_wallet: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

