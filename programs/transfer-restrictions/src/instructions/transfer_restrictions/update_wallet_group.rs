use crate::{
    contexts::UpdateWalletGroup, errors::TransferRestrictionsError,
    helpers::{check_authorization, check_if_group_will_change, transfer_wallet_between_groups},
};
use access_control::Roles;
use anchor_lang::prelude::*;

pub fn update_wallet_group(
    ctx: Context<UpdateWalletGroup>,
    new_group_id: u64,
) -> Result<()> {
    // Check authorization
    check_authorization(
        &ctx.accounts.authority_wallet_role,
        Roles::WalletsAdmin as u8 | Roles::TransferAdmin as u8,
    )?;

    // Validate that groups are different
    let groups_will_change = check_if_group_will_change(
        &ctx.accounts.transfer_restriction_group_current.key(),
        &ctx.accounts.transfer_restriction_group_new.key(),
        &ctx.accounts.holder_group_current.key(),
        &ctx.accounts.holder_group_new.key(),
        ctx.accounts.holder_group_current.group,
        ctx.accounts.holder_group_new.group,
    );

    if !groups_will_change {
        return Err(TransferRestrictionsError::NewGroupIsTheSameAsTheCurrentGroup.into());
    }

    // Transfer wallet between groups, updating all related counts
    transfer_wallet_between_groups(
        &mut ctx.accounts.transfer_restriction_group_new,
        &mut ctx.accounts.transfer_restriction_group_current,
        &mut ctx.accounts.holder_group_current,
        &mut ctx.accounts.holder_group_new,
        &mut ctx.accounts.security_associated_account,
        new_group_id,
    )?;

    Ok(())
}
