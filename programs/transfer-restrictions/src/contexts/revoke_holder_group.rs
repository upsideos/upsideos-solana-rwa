use crate::{
    HolderGroup, TransferRestrictionData, TransferRestrictionGroup, TransferRestrictionHolder, TRANSFER_RESTRICTION_DATA_PREFIX, TRANSFER_RESTRICTION_GROUP_PREFIX, TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX, TRANSFER_RESTRICTION_HOLDER_PREFIX
};
use access_control::{self, WalletRole};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RevokeHolderGroup<'info> {
    #[account(mut,
        seeds = [
            TRANSFER_RESTRICTION_HOLDER_PREFIX.as_bytes(),
            &transfer_restriction_data.key().to_bytes(),
            &holder.id.to_le_bytes(),
        ],
        bump,
        constraint = holder.transfer_restriction_data == transfer_restriction_data.key(),
    )]
    pub holder: Account<'info, TransferRestrictionHolder>,

    #[account(mut,
        close = payer,
        seeds = [
            TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX.as_bytes(),
            &holder.key().to_bytes(),
            &group.id.to_le_bytes(),
        ],
        bump,
        constraint = holder_group.holder == holder.key(),
        constraint = holder_group.group == group.id,
    )]
    pub holder_group: Account<'info, HolderGroup>,

    #[account(mut,
      seeds = [TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(), &transfer_restriction_data.security_token_mint.key().to_bytes()],
      bump,
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,

    #[account(
      seeds = [
        TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &group.id.to_le_bytes()
      ],
      bump,
      constraint = group.transfer_restriction_data == transfer_restriction_data.key(),
    )]
    pub group: Account<'info, TransferRestrictionGroup>,

    #[account(mut,
      constraint = authority_wallet_role.owner == authority.key(),
      constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
