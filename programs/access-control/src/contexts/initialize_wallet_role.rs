use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
  contexts::common::DISCRIMINATOR_LEN, AccessControl, Roles, ACCESS_CONTROL_SEED
};


pub const WALLET_ROLE_PREFIX: &[u8] = b"wallet_role";

#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct WalletRole {
  pub owner: Pubkey,
  pub access_control: Pubkey,
  pub role: u8,
}

impl WalletRole {
  pub fn has_role(&self, role: Roles) -> bool {
    let role = role as u8;
    self.role & role == role
  }

  pub fn has_any_role(&self, roles: u8) -> bool {
    self.role & roles != 0
  }
}

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct InitializeWalletRole<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + WalletRole::INIT_SPACE,
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
    constraint = authority_wallet_role.owner == authority.key(),
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
  pub authority: Signer<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
