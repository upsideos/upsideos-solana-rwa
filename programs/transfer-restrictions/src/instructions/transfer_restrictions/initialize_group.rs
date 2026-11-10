use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeTransferRestrictionGroup};

pub fn initialize_group<'info>(
    ctx: Context<'_, '_, '_, 'info, InitializeTransferRestrictionGroup<'info>>,
    id: u64,
) -> Result<()> {
    access_control::verify_token2022_authority(
        &ctx.accounts.authority.to_account_info(),
        ctx.remaining_accounts,
    )?;

    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::TransferAdmin)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_restriction_group = &mut ctx.accounts.transfer_restriction_group;
    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;

    transfer_restriction_group.transfer_restriction_data = transfer_restriction_data.key();
    transfer_restriction_group.id = id;
    transfer_restriction_group.current_holders_count = 0;
    transfer_restriction_group.max_holders = 0;

    Ok(())
}
