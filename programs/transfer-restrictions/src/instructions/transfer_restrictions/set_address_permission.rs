use access_control::Roles;
use anchor_lang::prelude::*;
use spl_token_2022::state::AccountState;

use crate::errors::TransferRestrictionsError;
use crate::helpers::{
    check_if_group_will_change, initialize_security_associated_account_fields,
    transfer_wallet_between_groups,
};
use crate::SetAddressPermission;

pub fn set_address_permission(
    ctx: Context<SetAddressPermission>,
    group_id: u64,
    frozen: bool,
) -> Result<()> {
    // Check authorization
    let wallet_role = &ctx.accounts.authority_wallet_role;
    if !wallet_role.has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let security_associated_account = &mut ctx.accounts.security_associated_account;
    let holder = &mut ctx.accounts.transfer_restriction_holder;
    
    // Check current frozen state once (used for both new and existing wallets)
    let is_currently_frozen = ctx.accounts.user_associated_token_account.state == AccountState::Frozen;
    
    // Determine if this is a new wallet (security_associated_account not initialized or has no holder)
    let is_new_wallet = security_associated_account.holder.is_none();
    
    if is_new_wallet {
        // Scenario 1: New wallet - link to existing holder and holder_group, initialize security_associated_account
        
        // Validate holder is active
        if !holder.active {
            return Err(TransferRestrictionsError::InvalidHolderIndex.into());
        }
        
        // Initialize security associated account and update all related counts
        let group_new = &mut ctx.accounts.transfer_restriction_group_new;
        let holder_group_new = &mut ctx.accounts.holder_group_new;
        initialize_security_associated_account_fields(
            security_associated_account,
            group_new,
            holder_group_new,
            holder,
            group_id,
        )?;
    } else {
        // Scenario 2: Existing wallet - update wallet group
        let existing_holder_key = security_associated_account.holder.unwrap();
        
        // Validate that current group and holder group are provided for existing wallet
        if ctx.accounts.holder_group_current.is_none() || ctx.accounts.transfer_restriction_group_current.is_none() {
            return Err(TransferRestrictionsError::CurrentGroupRequiredForExistingWallet.into());
        }
        
        // Validate that transfer_restriction_holder matches existing holder
        if holder.key() != existing_holder_key {
            return Err(TransferRestrictionsError::InvalidPDA.into());
        }
        
        // Validate that holder_group_new uses the correct holder
        if ctx.accounts.holder_group_new.holder != existing_holder_key {
            return Err(TransferRestrictionsError::InvalidPDA.into());
        }
        
        let group_current_ref = ctx.accounts.transfer_restriction_group_current.as_ref().unwrap();
        let holder_group_current_ref = ctx.accounts.holder_group_current.as_ref().unwrap();
        
        
        // Determine if freeze status will change
        let freeze_status_will_change = frozen != is_currently_frozen;
        
        // Check if group will change using helper
        let group_will_change = check_if_group_will_change(
            &group_current_ref.key(),
            &ctx.accounts.transfer_restriction_group_new.key(),
            &holder_group_current_ref.key(),
            &ctx.accounts.holder_group_new.key(),
            holder_group_current_ref.group,
            ctx.accounts.holder_group_new.group,
        );
        
        // Only fail if both group and freeze status are unchanged (no changes at all)
        if !group_will_change && !freeze_status_will_change {
            return Err(TransferRestrictionsError::ValueUnchanged.into());
        }
        
        // If group is changing, proceed with group update logic using helper
        if group_will_change {
            let group_new = &mut ctx.accounts.transfer_restriction_group_new;
            let holder_group_new = &mut ctx.accounts.holder_group_new;
            transfer_wallet_between_groups(
                group_new,
                ctx.accounts.transfer_restriction_group_current.as_mut().unwrap(),
                ctx.accounts.holder_group_current.as_mut().unwrap(),
                holder_group_new,
                security_associated_account,
                group_id,
            )?;
        }
    }
    
    // Call freeze/thaw CPI if the state needs to change
    // Note: is_currently_frozen is already computed at the beginning
    if frozen != is_currently_frozen {
        let access_control_program = &ctx.accounts.access_control_program;
        
        if frozen {
            let cpi_accounts = access_control::cpi::accounts::FreezeWallet {
                authority: ctx.accounts.payer.to_account_info(),
                authority_wallet_role: ctx.accounts.authority_wallet_role.to_account_info(),
                access_control: ctx.accounts.access_control_account.to_account_info(),
                security_mint: ctx.accounts.security_mint.to_account_info(),
                target_account: ctx.accounts.user_associated_token_account.to_account_info(),
                target_authority: ctx.accounts.user_wallet.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(access_control_program.to_account_info(), cpi_accounts);
            access_control::cpi::freeze_wallet(cpi_ctx)?;
        } else {
            let cpi_accounts = access_control::cpi::accounts::ThawWallet {
                authority: ctx.accounts.payer.to_account_info(),
                authority_wallet_role: ctx.accounts.authority_wallet_role.to_account_info(),
                access_control: ctx.accounts.access_control_account.to_account_info(),
                security_mint: ctx.accounts.security_mint.to_account_info(),
                target_account: ctx.accounts.user_associated_token_account.to_account_info(),
                target_authority: ctx.accounts.user_wallet.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(access_control_program.to_account_info(), cpi_accounts);
            access_control::cpi::thaw_wallet(cpi_ctx)?;
        }
    }
    
    Ok(())
}

