use access_control::Roles;
use anchor_lang::prelude::*;
use spl_token_2022::state::AccountState;

use crate::{errors::TransferRestrictionsError, SetAddressPermission};

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
    let holder_group_new = &mut ctx.accounts.holder_group_new;
    
    // Determine if this is a new wallet (security_associated_account not initialized or has no holder)
    let is_new_wallet = security_associated_account.holder.is_none();
    
    if is_new_wallet {
        // Scenario 1: New wallet - link to existing holder and holder_group, initialize security_associated_account
        
        // Validate holder is active
        if !holder.active {
            return Err(TransferRestrictionsError::InvalidHolderIndex.into());
        }
        
        // Initialize security associated account
        security_associated_account.group = group_id;
        security_associated_account.holder = Some(holder.key());
        
        // Update holder_group wallet count
        holder_group_new.current_wallets_count = holder_group_new.current_wallets_count.checked_add(1).unwrap();
        
        // Update group's holder count if this is the first wallet in holder_group
        let group_new = &mut ctx.accounts.transfer_restriction_group_new;
        if holder_group_new.current_wallets_count == 1 {
            group_new.current_holders_count = group_new.current_holders_count.checked_add(1).unwrap();
        }
        
        // Check group max holders constraint
        if group_new.current_holders_count > group_new.max_holders && group_new.max_holders != 0 {
            return Err(TransferRestrictionsError::MaxHoldersReachedInsideTheGroup.into());
        }
        
        // Update holder's wallet count
        holder.current_wallets_count = holder.current_wallets_count.checked_add(1).unwrap();
    } else {
        // Scenario 2: Existing wallet - update wallet group
        let existing_holder_key = security_associated_account.holder.unwrap();
        
        // Validate that transfer_restriction_holder matches existing holder
        if holder.key() != existing_holder_key {
            return Err(TransferRestrictionsError::InvalidPDA.into());
        }
        
        // Validate that holder_group_new uses the correct holder
        if holder_group_new.holder != existing_holder_key {
            return Err(TransferRestrictionsError::InvalidPDA.into());
        }
        
        // Get current and new groups
        let group_new = &mut ctx.accounts.transfer_restriction_group_new;
        
        // Check if we're actually changing groups
        if let Some(ref group_current) = ctx.accounts.transfer_restriction_group_current {
            if group_current.key() == group_new.key() {
                return Err(TransferRestrictionsError::NewGroupIsTheSameAsTheCurrentGroup.into());
            }
        }
        
        if let Some(ref holder_group_current) = ctx.accounts.holder_group_current {
            if holder_group_current.key() == holder_group_new.key() {
                return Err(TransferRestrictionsError::NewGroupIsTheSameAsTheCurrentGroup.into());
            }
            
            if holder_group_current.group == holder_group_new.group {
                return Err(TransferRestrictionsError::NewGroupIsTheSameAsTheCurrentGroup.into());
            }
            
            // Holder joins new group if it is the first wallet
            if holder_group_new.current_wallets_count == 0 {
                group_new.current_holders_count = group_new.current_holders_count.checked_add(1).unwrap();
            }
            
            // Check group max count
            if group_new.current_holders_count > group_new.max_holders && group_new.max_holders != 0 {
                return Err(TransferRestrictionsError::MaxHoldersReached.into());
            }
            
            // Update wallet counts
            let holder_group_current_mut = &mut ctx.accounts.holder_group_current.as_mut().unwrap();
            holder_group_current_mut.current_wallets_count = holder_group_current_mut
                .current_wallets_count
                .checked_sub(1)
                .unwrap();
            holder_group_new.current_wallets_count = holder_group_new
                .current_wallets_count
                .checked_add(1)
                .unwrap();
            
            // Holder leaves current group if it is the last wallet
            if holder_group_current_mut.current_wallets_count == 0 {
                if let Some(ref mut group_current_mut) = ctx.accounts.transfer_restriction_group_current.as_mut() {
                    group_current_mut.current_holders_count = group_current_mut
                        .current_holders_count
                        .checked_sub(1)
                        .unwrap();
                }
            }
        }
        
        // Update security_associated_account group
        security_associated_account.group = group_id;
    }
    
    // Check current frozen state and only call CPI if state needs to change
    let is_currently_frozen = ctx.accounts.user_associated_token_account.state == AccountState::Frozen;
    
    // Only call freeze/thaw CPI if the state needs to change
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

