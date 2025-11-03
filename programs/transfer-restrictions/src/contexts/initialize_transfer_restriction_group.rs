use anchor_lang::prelude::*;
use access_control::{self, AccessControl, WalletRole};
use crate::{contexts::common::DISCRIMINATOR_LEN, TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

// Short name is required for transfer hook meta account list specification (32 bytes limit)
pub const TRANSFER_RESTRICTION_GROUP_PREFIX: &str = "trg";


#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct TransferRestrictionGroup {
  pub id: u64,
  pub current_holders_count: u64,
  pub max_holders: u64,
  pub transfer_restriction_data: Pubkey,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeTransferRestrictionGroup<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionGroup::INIT_SPACE,
    seeds = [
      TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
      &transfer_restriction_data.key().to_bytes(),
      &id.to_le_bytes()
    ],
    bump,
  )]
  pub transfer_restriction_group: Account<'info, TransferRestrictionGroup>,

  #[account(mut,
    seeds = [TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(), &access_control_account.mint.key().to_bytes()],
    bump,
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  pub access_control_account: Account<'info, AccessControl>,
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
