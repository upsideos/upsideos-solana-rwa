use access_control::Roles;
use anchor_lang::prelude::*;

use crate::errors::TransferRestrictionsError;
use crate::helpers::*;
use crate::InitializeDefaultSecurityAccounts;

pub fn initialize_default_security_accounts(
    ctx: Context<InitializeDefaultSecurityAccounts>,
    holder_id: u64,
) -> Result<()> {
    // Check authorization: Reserve, Transfer, or Wallets admin
    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::ReserveAdmin as u8 | Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8,
    )?;

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    // Initialize holder
    let transfer_restriction_holder = &mut ctx.accounts.transfer_restriction_holder;
    if transfer_restriction_holder.active == false {
        initialize_new_holder(transfer_restriction_holder, transfer_restriction_data, holder_id)?;
    }
    // Initialize holder_group for group 0
    let holder_group = &mut ctx.accounts.holder_group;
    // If holder_group is not initialized, initialize it
    if holder_group.holder != transfer_restriction_holder.key() {
        if holder_group.holder != Pubkey::default() {
            return Err(TransferRestrictionsError::HolderGroupAlreadyInitialized.into());
        }
        initialize_holder_group_fields(
            holder_group,
            &ctx.accounts.group,
            transfer_restriction_holder,
        );
        // Update holder's group count
        increment_holder_group_count(transfer_restriction_holder);
    }
    // Initialize security associated account and update all related counts
    initialize_security_associated_account_fields(
        &mut ctx.accounts.security_associated_account,
        &mut ctx.accounts.group,
        holder_group,
        transfer_restriction_holder,
        0, // group 0
    )?;

    Ok(())
}


