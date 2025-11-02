use crate::{contexts::common::DISCRIMINATOR_LEN, TransferRestrictionGroup, TRANSFER_RESTRICTION_GROUP_PREFIX};
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, Token2022};

pub const TRANSFER_RESTRICTION_DATA_PREFIX: &str = "trd"; // transfer_restriction_data

#[account]
#[derive(Default, InitSpace)]
pub struct TransferRestrictionData {
    pub security_token_mint: Pubkey,
    pub access_control_account: Pubkey,
    pub current_holders_count: u64,
    pub holder_ids: u64,
    pub max_holders: u64,
    pub paused: bool,
    pub lockup_escrow_account: Option<Pubkey>,
}

#[derive(Accounts)]
#[instruction(max_holders: u64)]
pub struct InitializeTransferRestrictionData<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionData::INIT_SPACE,
      seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &mint.key().to_bytes(),
      ],
      bump,
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionGroup::INIT_SPACE,
    seeds = [
        TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &0u64.to_le_bytes()
    ],
    bump,
    )]
    pub zero_transfer_restriction_group: Account<'info, TransferRestrictionGroup>,
    #[account(
        mint::token_program = token_program,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        constraint = access_control_account.mint == mint.key(),
    )]
    pub access_control_account: Account<'info, AccessControl>,
    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account()]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}
