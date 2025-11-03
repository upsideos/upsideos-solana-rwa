#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;
pub mod helpers;
pub mod instructions;
pub mod utils;

pub use contexts::*;
pub use helpers::*;
pub use utils::*;

declare_id!("6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ");

#[program]
pub mod transfer_restrictions {
    use super::*;

    /// execute transfer hook
    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute_transaction(ctx: Context<ExecuteTransferHook>, amount: u64) -> Result<()> {
        instructions::transfer_hook::handler(ctx, amount)
    }

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        instructions::transfer_hook::initialize_extra_account_meta_list(ctx)
    }

    pub fn initialize_transfer_restrictions_data(
        ctx: Context<InitializeTransferRestrictionData>,
        max_holders: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_data(ctx, max_holders)
    }

    pub fn initialize_transfer_restriction_group(
        ctx: Context<InitializeTransferRestrictionGroup>,
        id: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_group(ctx, id)
    }

    pub fn initialize_transfer_restriction_holder(
        ctx: Context<InitializeTransferRestrictionHolder>,
        id: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_holder(ctx, id)
    }

    pub fn initialize_transfer_rule(
        ctx: Context<InitializeTransferRule>,
        lock_until: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_transfer_rule(ctx, lock_until)
    }

    pub fn initialize_security_associated_account(
        ctx: Context<InitializeSecurityAssociatedAccount>,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_security_associated_account(ctx)
    }

    pub fn update_wallet_group(ctx: Context<UpdateWalletGroup>) -> Result<()> {
        instructions::transfer_restrictions::update_wallet_group(ctx)
    }

    pub fn pause(ctx: Context<Pause>, paused: bool) -> Result<()> {
        instructions::transfer_restrictions::pause(ctx, paused)
    }

    pub fn initialize_holder_group(ctx: Context<InitializeHolderGroup>) -> Result<()> {
        instructions::transfer_restrictions::initialize_holder_group(ctx)
    }

    pub fn set_holder_max(ctx: Context<SetHolderMax>, holder_max: u64) -> Result<()> {
        instructions::transfer_restrictions::set_holder_max(ctx, holder_max)
    }

    pub fn set_holder_group_max(
        ctx: Context<SetHolderGroupMax>,
        holder_group_max: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::set_holder_group_max(ctx, holder_group_max)
    }

    pub fn set_allow_transfer_rule(
        ctx: Context<SetAllowTransferRule>,
        locked_until: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::set_allow_transfer_rule(ctx, locked_until)
    }

    pub fn revoke_security_associated_account(
        ctx: Context<RevokeSecurityAssociatedAccount>,
    ) -> Result<()> {
        instructions::transfer_restrictions::revoke_security_associated_account(ctx)
    }

    pub fn revoke_holder(ctx: Context<RevokeHolder>) -> Result<()> {
        instructions::transfer_restrictions::revoke_holder(ctx)
    }

    pub fn revoke_holder_group(ctx: Context<RevokeHolderGroup>) -> Result<()> {
        instructions::transfer_restrictions::revoke_holder_group(ctx)
    }

    pub fn set_lockup_escrow_account(ctx: Context<SetLockupEscrowAccount>) -> Result<()> {
        instructions::transfer_restrictions::set_lockup_escrow_account(ctx)
    }

    pub fn enforce_transfer_restrictions(ctx: Context<EnforceTransferRestrictions>) -> Result<()> {
        instructions::transfer_restrictions::enforce_transfer_restrictions(ctx)
    }

    pub fn initialize_default_security_accounts(
        ctx: Context<InitializeDefaultSecurityAccounts>,
        holder_id: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_default_security_accounts(ctx, holder_id)
    }

    pub fn set_address_permission(
        ctx: Context<SetAddressPermission>,
        group_id: u64,
        frozen: bool,
    ) -> Result<()> {
        instructions::transfer_restrictions::set_address_permission(ctx, group_id, frozen)
    }
}
