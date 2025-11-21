#![allow(unexpected_cfgs)]
// Access Control program for RWA module from Upside OS
use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod utils;

pub use contexts::*;
pub use utils::*;

declare_id!("4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3");

#[program]
pub mod access_control {
    use super::*;

    pub fn initialize_access_control(
        ctx: Context<InitializeAccessControl>,
        args: InitializeAccessControlArgs,
    ) -> Result<()> {
        instructions::access_control::initialize(ctx, args)
    }

    pub fn grant_role(ctx: Context<GrantRole>, role: u8) -> Result<()> {
        instructions::access_control::grant_role(ctx, role)
    }

    pub fn revoke_role(ctx: Context<RevokeRole>, role: u8) -> Result<()> {
        instructions::access_control::revoke_role(ctx, role)
    }

    pub fn mint_securities(ctx: Context<MintSecurities>, amount: u64) -> Result<()> {
        instructions::asset::mint_securities(ctx, amount)
    }

    pub fn burn_securities(ctx: Context<BurnSecurities>, amount: u64) -> Result<()> {
        instructions::asset::burn_securities(ctx, amount)
    }

    pub fn force_transfer_between<'info>(
        ctx: Context<'_, '_, '_, 'info, ForceTransferBetween<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::asset::force_transfer_beetween(ctx, amount)
    }

    pub fn freeze_wallet(ctx: Context<FreezeWallet>) -> Result<()> {
        instructions::asset::freeze_wallet(ctx)
    }

    pub fn thaw_wallet(ctx: Context<ThawWallet>) -> Result<()> {
        instructions::asset::thaw_wallet(ctx)
    }

    pub fn set_lockup_escrow_account(ctx: Context<SetLockupEscrowAccount>) -> Result<()> {
        instructions::access_control::set_lockup_escrow_account(ctx)
    }

    pub fn set_max_total_supply(ctx: Context<SetMaxTotalSupply>, max_total_supply: u64) -> Result<()> {
        instructions::access_control::set_max_total_supply(ctx, max_total_supply)
    }
}
