use crate::{
    contexts::common::DISCRIMINATOR_LEN, TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX,
};
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;

pub const TRANSFER_RESTRICTION_HOLDER_PREFIX: &str = "trh"; // transfer_restriction_holder

#[account]
#[derive(Default, InitSpace)]
pub struct TransferRestrictionHolder {
    pub transfer_restriction_data: Pubkey,
    pub current_wallets_count: u64,
    pub current_holder_group_count: u64,
    pub id: u64,
    pub active: bool,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeTransferRestrictionHolder<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionHolder::INIT_SPACE,
      seeds = [
        TRANSFER_RESTRICTION_HOLDER_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &id.to_le_bytes(),
      ],
      bump,
    )]
    pub transfer_restriction_holder: Account<'info, TransferRestrictionHolder>,

    #[account(mut,
      seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &access_control_account.mint.key().to_bytes(),
      ],
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
