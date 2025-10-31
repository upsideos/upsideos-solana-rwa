use crate::{contexts::RevokeRole, errors::AccessControlError, contexts::common::Roles};
use anchor_lang::prelude::*;

pub fn revoke_role(ctx: Context<RevokeRole>, role: u8) -> Result<()> {
    // Check authority has ContractAdmin role
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ContractAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    // Validate role parameter
    if role > Roles::All as u8 {
        return Err(AccessControlError::InvalidRole.into());
    }

    let wallet_role = &mut ctx.accounts.wallet_role;

    // Check if wallet has the role
    if wallet_role.role & role != role {
        return Err(AccessControlError::CannotRevokeRole.into());
    }

    // Revoke role using bitwise XOR
    wallet_role.role ^= role;

    Ok(())
}

