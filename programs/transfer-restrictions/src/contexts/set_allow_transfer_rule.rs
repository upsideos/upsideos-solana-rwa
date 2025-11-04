use crate::{
    TransferRestrictionData, TransferRestrictionGroup, TransferRule,
    TRANSFER_RESTRICTION_DATA_PREFIX, TRANSFER_RULE_PREFIX,
};
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(transfer_group_id_from: u64, transfer_group_id_to: u64, locked_until: u64)]
pub struct SetAllowTransferRule<'info> {
    #[account(mut,
        seeds = [
            TRANSFER_RULE_PREFIX.as_bytes(),
            &transfer_restriction_data.key().to_bytes(),
            &transfer_restriction_group_from.id.to_le_bytes(),
            &transfer_restriction_group_to.id.to_le_bytes(),
        ],
        bump,
        constraint = transfer_rule.transfer_restriction_data == transfer_restriction_data.key(),
        constraint = transfer_rule.transfer_group_id_from == transfer_group_id_from,
        constraint = transfer_rule.transfer_group_id_to == transfer_group_id_to,
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

    #[account(
        constraint = access_control_account.mint == transfer_restriction_data.security_token_mint,
        constraint = access_control_account.key() == transfer_restriction_data.access_control_account,
    )]
    pub access_control_account: Account<'info, AccessControl>,

    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(mut)]
    pub payer: Signer<'info>,
}
