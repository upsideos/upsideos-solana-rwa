use access_control::Roles;
use anchor_lang::prelude::*;

use crate::helpers::*;
use crate::InitializeDefaultSecurityAccounts;

pub fn initialize_default_security_accounts(
    ctx: Context<InitializeDefaultSecurityAccounts>,
) -> Result<()> {
    // Check authorization: Reserve, Transfer, or Wallets admin
    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::ReserveAdmin as u8 | Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8,
    )?;

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;

    // Get the holder ID (current count)
    let holder_id = transfer_restriction_data.current_holders_count;

    // Initialize holder
    let transfer_restriction_holder = &mut ctx.accounts.transfer_restriction_holder;
    initialize_holder_fields(transfer_restriction_holder, transfer_restriction_data, holder_id);
    
    // Update holder counts (this also checks max holders)
    // Always increment holder_ids since we're using sequential IDs (current_holders_count)
    update_transfer_restriction_data_after_holder_creation(transfer_restriction_data, holder_id, true)?;

    // Initialize holder_group for group 0
    let holder_group = &mut ctx.accounts.holder_group;
    initialize_holder_group_fields(
        holder_group,
        &ctx.accounts.group,
        transfer_restriction_holder,
    );

    // Update holder's group count
    increment_holder_group_count(transfer_restriction_holder);

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


