use crate::{
    contexts::GrantRole,
    errors::AccessControlError,
    contexts::common::Roles,
};
use anchor_lang::prelude::*;

pub fn grant_role(ctx: Context<GrantRole>, role: u8) -> Result<()> {
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
    
    // If account was just initialized by init_if_needed, set owner and access_control
    // We can detect this by checking if owner is Pubkey::default() (uninitialized)
    let is_new_account = wallet_role.access_control == Pubkey::default();
    if is_new_account {
        wallet_role.owner = ctx.accounts.user_wallet.key();
        wallet_role.access_control = ctx.accounts.access_control.key();
        wallet_role.role = 0; // Ensure role starts at 0 for new account
    } else {
        require!(wallet_role.access_control == ctx.accounts.access_control.key(), AccessControlError::InvalidAccessControl);
        require!(wallet_role.owner == ctx.accounts.user_wallet.key(), AccessControlError::InvalidWalletRoleAccountOwner);
    }
    
    // Check if wallet already has the role (using bitwise AND)
    if wallet_role.role & role == role {
        return Err(AccessControlError::AlreadyHasRole.into());
    }

    // Grant role using bitwise OR
    wallet_role.role |= role;

    Ok(())
}

