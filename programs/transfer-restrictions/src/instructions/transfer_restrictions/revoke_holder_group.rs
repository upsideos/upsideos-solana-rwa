use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, RevokeHolderGroup};

pub fn revoke_holder_group<'info>(
    ctx: Context<'_, '_, '_, 'info, RevokeHolderGroup<'info>>,
) -> Result<()> {
    access_control::verify_token2022_authority(
        &ctx.accounts.authority.to_account_info(),
        ctx.remaining_accounts,
    )?;

    if !ctx
        .accounts
        .authority_wallet_role
        .has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    require!(
        ctx.accounts.holder_group.current_wallets_count == 0,
        TransferRestrictionsError::CurrentWalletsCountMustBeZero
    );

    let holder = &mut ctx.accounts.holder;
    holder.current_holder_group_count = holder
        .current_holder_group_count
        .checked_sub(1)
        .ok_or(TransferRestrictionsError::NonPositiveHolderGroupCount)?;

    Ok(())
}
