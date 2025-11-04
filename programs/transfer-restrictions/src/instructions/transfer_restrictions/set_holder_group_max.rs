use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetHolderGroupMax};

pub fn set_holder_group_max(
    ctx: Context<SetHolderGroupMax>,
    _group_id: u64,
    holder_group_max: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::TransferAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let group = &mut ctx.accounts.group;
    require!(
        group.max_holders != holder_group_max,
        TransferRestrictionsError::ValueUnchanged
    );
    require!(
        group.id != 0,
        TransferRestrictionsError::ZeroGroupHolderGroupMaxCannotBeNonZero
    );
    require!(
        holder_group_max >= group.current_holders_count,
        TransferRestrictionsError::NewHolderGroupMaxMustExceedCurrentHolderGroupCount
    );
    group.max_holders = holder_group_max;

    Ok(())
}
