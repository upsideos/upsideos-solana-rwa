use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetAllowTransferRule};

pub fn set_allow_transfer_rule(
    ctx: Context<SetAllowTransferRule>,
    _group_id_from: u64,
    _group_id_to: u64,
    locked_until: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::TransferAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }
    if ctx.accounts.transfer_rule.locked_until == locked_until {
        return Err(TransferRestrictionsError::ValueUnchanged.into());
    }

    let transfer_rule = &mut ctx.accounts.transfer_rule;
    transfer_rule.locked_until = locked_until;

    Ok(())
}
