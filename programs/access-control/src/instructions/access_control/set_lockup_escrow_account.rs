use anchor_lang::{prelude::*, solana_program::program_memory::sol_memcmp, Discriminator};
use tokenlock_accounts::{states::TokenLockData, wrappers::TokenLockDataWrapper};

use crate::{errors::AccessControlError, Roles, SetLockupEscrowAccount};

pub fn set_lockup_escrow_account(ctx: Context<SetLockupEscrowAccount>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ContractAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }
    if ctx.accounts.access_control_account.lockup_escrow_account
        == Some(ctx.accounts.escrow_account.key())
    {
        return Err(AccessControlError::ValueUnchanged.into());
    }

    let discriminator = TokenLockData::DISCRIMINATOR;
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(AccessControlError::IncorrectTokenlockAccount.into());
    }
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);
    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(AccessControlError::MismatchedEscrowAccount.into());
    }

    let access_control_account = &mut ctx.accounts.access_control_account;
    access_control_account.lockup_escrow_account = Some(escrow_account);

    Ok(())
}
