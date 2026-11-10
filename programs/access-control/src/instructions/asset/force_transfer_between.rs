use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::onchain::invoke_transfer_checked;

use crate::{errors::AccessControlError, ForceTransferBetween, Roles, ACCESS_CONTROL_SEED};

pub fn force_transfer_beetween<'info>(
    ctx: Context<'_, '_, '_, 'info, ForceTransferBetween<'info>>,
    amount: u64,
) -> Result<()> {
    crate::verify_token2022_authority(
        &ctx.accounts.authority.to_account_info(),
        ctx.remaining_accounts,
    )?;

    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ReserveAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    if ctx.accounts.access_control_account.lockup_escrow_account
        == Some(ctx.accounts.source_account.key())
        || ctx.accounts.access_control_account.lockup_escrow_account
            == Some(ctx.accounts.destination_account.key())
    {
        return Err(AccessControlError::CantForceTransferBetweenLockup.into());
    }

    let mint = ctx.accounts.security_mint.to_account_info();
    let (_pda, bump_seed) =
        Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.key.as_ref()], ctx.program_id);

    let seeds = &[ACCESS_CONTROL_SEED, mint.key.as_ref(), &[bump_seed]];

    let token_program_id = ctx.accounts.token_program.key;
    let source_info = ctx.accounts.source_account.to_account_info();
    let mint_info = ctx.accounts.security_mint.to_account_info();
    let destination_info = ctx.accounts.destination_account.to_account_info();
    // https://solana.com/developers/guides/token-extensions/permanent-delegate#transfer-with-permanent-delegate
    // To transfer tokens using the Permanent Delegate, use the transferChecked instruction
    // and specify the Permanent Delegate as the owner of the sourceTokenAccount.
    let authority_info = ctx.accounts.access_control_account.to_account_info();
    let decimals = ctx.accounts.security_mint.decimals;

    invoke_transfer_checked(
        token_program_id,
        source_info.clone(),
        mint_info.clone(),
        destination_info.clone(),
        authority_info.clone(),
        ctx.remaining_accounts,
        amount,
        decimals,
        &[&seeds[..]],
    )?;

    Ok(())
}
