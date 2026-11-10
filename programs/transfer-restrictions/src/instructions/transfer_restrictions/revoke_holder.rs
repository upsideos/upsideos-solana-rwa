use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, RevokeHolder};

pub fn revoke_holder<'info>(ctx: Context<'_, '_, '_, 'info, RevokeHolder<'info>>) -> Result<()> {
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

    let holder = &mut ctx.accounts.holder;
    require!(
        holder.current_wallets_count == 0,
        TransferRestrictionsError::CurrentWalletsCountMustBeZero
    );
    require!(
        holder.current_holder_group_count == 0,
        TransferRestrictionsError::CurrentHolderGroupCountMustBeZero
    );

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.current_holders_count = transfer_restriction_data
        .current_holders_count
        .checked_sub(1)
        .unwrap();

    Ok(())
}
