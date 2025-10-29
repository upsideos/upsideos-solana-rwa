use access_control::Roles;
use anchor_lang::prelude::*;

use crate::helpers::*;
use crate::InitializeSecurityAssociatedAccount;

pub fn initialize_security_associated_account(
    ctx: Context<InitializeSecurityAssociatedAccount>,
) -> Result<()> {
    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8,
    )?;

    let group_id = ctx.accounts.group.id;
    initialize_security_associated_account_fields(
        &mut ctx.accounts.security_associated_account,
        &mut ctx.accounts.group,
        &mut ctx.accounts.holder_group,
        &mut ctx.accounts.holder,
        group_id,
    )?;
    
    Ok(())
}
