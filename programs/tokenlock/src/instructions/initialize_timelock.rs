use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, WalletRole, ADMIN_ROLES,
};
use anchor_lang::{prelude::*, solana_program::program_memory::sol_memcmp, Discriminator};

use tokenlock_accounts::{
    states::{TimelockData, TokenLockData, VEC_LEN_SIZE},
    wrappers::TokenLockDataWrapper,
};

use crate::error::TokenlockErrors;

#[derive(Accounts)]
pub struct InitializeTimeLock<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(init, payer = authority, space = TimelockData::HEADERS_LEN + VEC_LEN_SIZE * 2,
        seeds = [tokenlock_account.key.as_ref(), target_account.key.as_ref()],
        bump,
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(owner = AccessControlProgram::id())]
    pub access_control: Account<'info, AccessControl>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: System Account which identify target user wallet
    /// with which will be linked timelocks  
    pub target_account: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_timelock(ctx: Context<InitializeTimeLock>) -> Result<()> {
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_mut_data()?;
    let discriminator = TokenLockData::DISCRIMINATOR;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    if ctx.accounts.access_control.key()
        != TokenLockDataWrapper::access_control(&tokenlock_account_data)
    {
        return Err(TokenlockErrors::InvalidAccessControlAccount.into());
    }

    if !ctx.accounts.authority_wallet_role.has_any_role(ADMIN_ROLES) {
        return Err(TokenlockErrors::Unauthorized.into());
    }

    let timelock_account = &mut ctx.accounts.timelock_account;
    timelock_account.tokenlock_account = *ctx.accounts.tokenlock_account.to_account_info().key;
    timelock_account.target_account = *ctx.accounts.target_account.key;
    timelock_account.cancelables = Vec::new();
    timelock_account.timelocks = Vec::new();

    Ok(())
}
