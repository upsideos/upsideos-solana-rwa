use access_control::Roles;
use anchor_lang::{prelude::*, solana_program::program_memory::sol_memcmp, Discriminator};
use tokenlock_accounts::{states::TokenLockData, wrappers::TokenLockDataWrapper};

use crate::{errors::TransferRestrictionsError, SetLockupEscrowAccount};

pub fn set_lockup_escrow_account(ctx: Context<SetLockupEscrowAccount>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ContractAdmin)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let discriminator = TokenLockData::DISCRIMINATOR;
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TransferRestrictionsError::IncorrectTokenlockAccount.into());
    }
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);
    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TransferRestrictionsError::MismatchedEscrowAccount.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.lockup_escrow_account = Some(escrow_account);

    let escrow_security_associated_token_account =
        &mut ctx.accounts.escrow_security_associated_account;
    escrow_security_associated_token_account.group = 0;
    escrow_security_associated_token_account.holder = None;

    Ok(())
}
