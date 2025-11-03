use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, WalletRole, ADMIN_ROLES,
};
use anchor_lang::{prelude::*, solana_program::program_memory::sol_memcmp, Discriminator};

use crate::{error::TokenlockErrors, utils};

use tokenlock_accounts::{
    states::{ReleaseSchedule, TimelockData, TokenLockData},
    wrappers::TokenLockDataWrapper,
};

#[derive(Accounts, Clone)]
pub struct ManagementTokenlock<'info> {
    #[account(mut)]
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(owner = AccessControlProgram::id())]
    pub access_control: Account<'info, AccessControl>,
}

pub fn create_release_schedule(
    ctx: Context<ManagementTokenlock>,
    uuid: [u8; 16],
    release_count: u32,
    delay_until_first_release_in_seconds: u64,
    initial_release_portion_in_bips: u32,
    period_between_releases_in_seconds: u64,
) -> Result<()> {
    let tokenlock_account = &mut ctx.accounts.tokenlock_account;
    let mut tokenlock_account_data = tokenlock_account.try_borrow_mut_data()?;
    let discriminator = TokenLockData::DISCRIMINATOR;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    if !ctx.accounts.authority_wallet_role.has_any_role(ADMIN_ROLES) {
        return Err(TokenlockErrors::Unauthorized.into());
    }

    if ctx.accounts.access_control.key()
        != TokenLockDataWrapper::access_control(&tokenlock_account_data)
    {
        return Err(TokenlockErrors::InvalidAccessControlAccount.into());
    }

    if delay_until_first_release_in_seconds
        > TokenLockDataWrapper::max_release_delay(&tokenlock_account_data)
    {
        return Err(TokenlockErrors::FirstReleaseDelayBiggerThanMaxDelay.into());
    }

    if release_count < 1 {
        return Err(TokenlockErrors::ReleaseCountLessThanOne.into());
    }

    if initial_release_portion_in_bips > TimelockData::BIPS_PRECISION {
        return Err(TokenlockErrors::InitReleasePortionBiggerThan100Percent.into());
    }

    if release_count > 1 {
        if period_between_releases_in_seconds == 0 {
            return Err(TokenlockErrors::ReleasePeriodZero.into());
        }
        if initial_release_portion_in_bips == TimelockData::BIPS_PRECISION {
            return Err(TokenlockErrors::CantVestAllForMultipleReleases.into());
        }
    }

    if release_count == 1 && initial_release_portion_in_bips != TimelockData::BIPS_PRECISION {
        return Err(TokenlockErrors::InitReleasePortionMustBe100Percent.into());
    }

    if TokenLockDataWrapper::schedule_count(&tokenlock_account_data) as usize
        >= TokenLockData::MAX_SCHEDULE_COUNT
    {
        return Err(TokenlockErrors::SchedulesCountReachedMax.into());
    }

    let hash = utils::calc_signer_hash(ctx.accounts.authority.key, uuid);
    let schedule = ReleaseSchedule {
        signer_hash: hash,
        release_count: release_count,
        delay_until_first_release_in_seconds: delay_until_first_release_in_seconds,
        initial_release_portion_in_bips: initial_release_portion_in_bips,
        period_between_releases_in_seconds: period_between_releases_in_seconds,
    };

    // we check only last schedule because it is not problem to have duplicates
    // but problem to iterate through container with a lot of items in Solana
    // which can drain compute budget and failed
    if let Some(last_schedule) = TokenLockDataWrapper::get_last_schedule(&tokenlock_account_data) {
        if last_schedule.is_equal(&schedule) {
            return Err(TokenlockErrors::HashAlreadyExists.into());
        }
    }

    TokenLockDataWrapper::add_schedule(&mut tokenlock_account_data, &schedule);

    Ok(())
}
