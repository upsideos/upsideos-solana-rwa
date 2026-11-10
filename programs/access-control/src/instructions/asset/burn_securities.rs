use anchor_lang::prelude::*;
use anchor_spl::token_interface::{burn, Burn};

use crate::{errors::AccessControlError, BurnSecurities, ACCESS_CONTROL_SEED};

pub fn burn_securities<'info>(
    ctx: Context<'_, '_, '_, 'info, BurnSecurities<'info>>,
    amount: u64,
) -> Result<()> {
    crate::verify_token2022_authority(
        &ctx.accounts.authority.to_account_info(),
        ctx.remaining_accounts,
    )?;

    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(crate::Roles::ReserveAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    if ctx.accounts.access_control.lockup_escrow_account == Some(ctx.accounts.target_account.key())
    {
        return Err(AccessControlError::CantBurnSecuritiesWithinLockup.into());
    }

    let mint = ctx.accounts.security_mint.to_account_info();
    let accounts = Burn {
        mint: mint.clone(),
        from: ctx.accounts.target_account.to_account_info(),
        authority: ctx.accounts.access_control.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);

    let (_pda, bump_seed) =
        Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.key.as_ref()], ctx.program_id);

    let seeds = &[ACCESS_CONTROL_SEED, mint.key.as_ref(), &[bump_seed]];

    burn(cpi_ctx.with_signer(&[&seeds[..]]), amount)?;

    Ok(())
}
