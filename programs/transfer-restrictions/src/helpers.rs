use access_control::WalletRole;
use anchor_lang::prelude::*;

use crate::errors::TransferRestrictionsError;
use crate::{HolderGroup, SecurityAssociatedAccount, TransferRestrictionData, TransferRestrictionGroup, TransferRestrictionHolder};

/// Check if the wallet role has any of the specified roles
pub fn check_authorization(wallet_role: &WalletRole, allowed_roles: u8) -> Result<()> {
    if !wallet_role.has_any_role(allowed_roles) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }
    Ok(())
}

pub fn initialize_new_holder(
    holder: &mut Account<TransferRestrictionHolder>,
    transfer_restriction_data: &mut Account<TransferRestrictionData>,
    holder_id: u64,
) -> Result<()> {
    initialize_holder_fields(holder, transfer_restriction_data, holder_id)?;
    update_transfer_restriction_data_after_holder_creation(transfer_restriction_data, holder_id)?;
    Ok(())
}

/// Initialize holder account fields
pub fn initialize_holder_fields(
    holder: &mut Account<TransferRestrictionHolder>,
    transfer_restriction_data: &Account<TransferRestrictionData>,
    holder_id: u64,
) -> Result<()> {
    if transfer_restriction_data.holder_ids < holder_id {
        return Err(TransferRestrictionsError::InvalidHolderIndex.into());
    }
    holder.transfer_restriction_data = transfer_restriction_data.key();
    holder.id = holder_id;
    holder.current_wallets_count = 0;
    holder.current_holder_group_count = 0;
    holder.active = true;

    Ok(())
}

/// Update transfer restriction data after creating a new holder
/// holder_ids is only incremented if it equals holder_id (for sequential IDs).
pub fn update_transfer_restriction_data_after_holder_creation(
    transfer_restriction_data: &mut Account<TransferRestrictionData>,
    holder_id: u64,
) -> Result<()> {
    // Check max holders limit
    if transfer_restriction_data.current_holders_count >= transfer_restriction_data.max_holders {
        return Err(TransferRestrictionsError::MaxHoldersReached.into());
    }

    // Update counts
    transfer_restriction_data.current_holders_count = transfer_restriction_data
        .current_holders_count
        .checked_add(1)
        .unwrap();

    if transfer_restriction_data.holder_ids == holder_id {
        transfer_restriction_data.holder_ids =
            transfer_restriction_data.holder_ids.checked_add(1).unwrap();
    }

    Ok(())
}

/// Initialize holder group account fields
pub fn initialize_holder_group_fields(
    holder_group: &mut Account<HolderGroup>,
    group: &Account<TransferRestrictionGroup>,
    holder: &Account<TransferRestrictionHolder>,
) {
    holder_group.group = group.id;
    holder_group.holder = holder.key();
    holder_group.current_wallets_count = 0;
}

/// Increment holder's holder group count
pub fn increment_holder_group_count(holder: &mut Account<TransferRestrictionHolder>) {
    holder.current_holder_group_count = holder.current_holder_group_count.checked_add(1).unwrap();
}

/// Initialize security associated account and update related counts
pub fn initialize_security_associated_account_fields(
    security_associated_account: &mut Account<SecurityAssociatedAccount>,
    group: &mut Account<TransferRestrictionGroup>,
    holder_group: &mut Account<HolderGroup>,
    holder: &mut Account<TransferRestrictionHolder>,
    group_id: u64,
) -> Result<()> {
    // Initialize security associated account
    security_associated_account.group = group_id;
    security_associated_account.holder = Some(holder.key());

    // Update holder_group wallet count
    holder_group.current_wallets_count = holder_group.current_wallets_count.checked_add(1).unwrap();

    // Update group's holder count if this is the first wallet in holder_group
    if holder_group.current_wallets_count == 1 {
        group.current_holders_count = group.current_holders_count.checked_add(1).unwrap();
    }

    // Check group max holders constraint
    if group.current_holders_count > group.max_holders && group.max_holders != 0 {
        return Err(TransferRestrictionsError::MaxHoldersReachedInsideTheGroup.into());
    }

    // Update holder's wallet count
    holder.current_wallets_count = holder.current_wallets_count.checked_add(1).unwrap();

    Ok(())
}

