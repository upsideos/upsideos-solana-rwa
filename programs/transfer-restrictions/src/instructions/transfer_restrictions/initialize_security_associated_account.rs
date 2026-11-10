use access_control::Roles;
use anchor_lang::prelude::*;

use crate::helpers::*;
use crate::InitializeSecurityAssociatedAccount;

pub fn initialize_security_associated_account<'info>(
    ctx: Context<'_, '_, '_, 'info, InitializeSecurityAssociatedAccount<'info>>,
    group_id: u64,
    _holder_id: u64,
) -> Result<()> {
    access_control::verify_token2022_authority(
        &ctx.accounts.authority.to_account_info(),
        ctx.remaining_accounts,
    )?;

    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8,
    )?;

    initialize_security_associated_account_fields(
        &mut ctx.accounts.security_associated_account,
        &mut ctx.accounts.group,
        &mut ctx.accounts.holder_group,
        &mut ctx.accounts.holder,
        group_id,
    )?;

    Ok(())
}
