use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    contexts::common::{DISCRIMINATOR_LEN, WalletRole, WALLET_ROLE_PREFIX},
    AccessControl, ACCESS_CONTROL_SEED,
};

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct GrantRole<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = DISCRIMINATOR_LEN + WalletRole::INIT_SPACE,
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
            &authority.key().to_bytes(),
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

    /// CHECK: Wallet address to be controlled by the access control
    pub user_wallet: AccountInfo<'info>,
    #[account()]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

