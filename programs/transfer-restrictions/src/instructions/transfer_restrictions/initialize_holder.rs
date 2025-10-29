use access_control::Roles;
use anchor_lang::prelude::*;

use crate::errors::*;
use crate::helpers::*;
use crate::InitializeTransferRestrictionHolder;

pub fn initialize_holder(ctx: Context<InitializeTransferRestrictionHolder>, id: u64) -> Result<()> {
    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8,
    )?;

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    if transfer_restriction_data.holder_ids < id {
        return Err(TransferRestrictionsError::InvalidHolderIndex.into());
    }

    let transfer_restriction_holder = &mut ctx.accounts.transfer_restriction_holder;
    initialize_holder_fields(transfer_restriction_holder, transfer_restriction_data, id);
    update_transfer_restriction_data_after_holder_creation(transfer_restriction_data, id, false)?;

    Ok(())
}
