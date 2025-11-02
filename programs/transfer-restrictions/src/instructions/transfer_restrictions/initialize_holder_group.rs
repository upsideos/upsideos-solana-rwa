use access_control::Roles;
use anchor_lang::prelude::*;

use crate::helpers::*;
use crate::InitializeHolderGroup;

pub fn initialize_holder_group(ctx: Context<InitializeHolderGroup>) -> Result<()> {
    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8,
    )?;

    let holder_group = &mut ctx.accounts.holder_group;
    initialize_holder_group_fields(
        holder_group,
        &ctx.accounts.group,
        &ctx.accounts.holder,
    );

    let holder = &mut ctx.accounts.holder;
    increment_holder_group_count(holder);

    Ok(())
}
