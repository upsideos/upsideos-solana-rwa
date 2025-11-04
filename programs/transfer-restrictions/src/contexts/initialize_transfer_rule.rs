use anchor_lang::prelude::*;
use crate::{
  contexts::common::DISCRIMINATOR_LEN,
  TransferRestrictionData,
  TransferRestrictionGroup,
  TRANSFER_RESTRICTION_DATA_PREFIX,
};
use access_control::{self, AccessControl, WalletRole};

pub const TRANSFER_RULE_PREFIX: &str = "tr"; // transfer_rule


#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct TransferRule {
  pub transfer_restriction_data: Pubkey,
  pub transfer_group_id_from: u64,
  pub transfer_group_id_to: u64,
  pub locked_until: u64,
}

#[derive(Accounts)]
#[instruction(transfer_group_id_from: u64, transfer_group_id_to: u64, locked_until: u64)]
pub struct InitializeTransferRule<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRule::INIT_SPACE,
    seeds = [
      TRANSFER_RULE_PREFIX.as_bytes(),
      &transfer_restriction_data.key().to_bytes(),
      &transfer_restriction_group_from.id.to_le_bytes(),
      &transfer_restriction_group_to.id.to_le_bytes(),
    ],
    bump,
  )]
  pub transfer_rule: Account<'info, TransferRule>,

  #[account(
    seeds = [TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(), &access_control_account.mint.key().to_bytes()],
    bump,
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  #[account(
    constraint = transfer_restriction_group_from.transfer_restriction_data == transfer_restriction_data.key(),
    constraint = transfer_restriction_group_from.id == transfer_group_id_from,
  )]  
  pub transfer_restriction_group_from: Account<'info, TransferRestrictionGroup>,
  #[account(
    constraint = transfer_restriction_group_to.transfer_restriction_data == transfer_restriction_data.key(),
    constraint = transfer_restriction_group_to.id == transfer_group_id_to,
  )]
  pub transfer_restriction_group_to: Account<'info, TransferRestrictionGroup>,
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
