use anchor_lang::prelude::*;
use anchor_spl::token_interface::{mint_to, MintTo};
use anchor_spl::{
    token_2022::spl_token_2022::extension::transfer_hook::TransferHook,
    token_interface::get_mint_extension_data,
};

use crate::{errors::AccessControlError, MintSecurities, ACCESS_CONTROL_SEED};

// Security Associated Account prefix from transfer-restrictions program
const SECURITY_ASSOCIATED_ACCOUNT_PREFIX: &str = "saa";

pub fn mint_securities(ctx: Context<MintSecurities>, amount: u64) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(crate::Roles::ReserveAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    let new_supply = ctx
        .accounts
        .security_mint
        .supply
        .checked_add(amount)
        .unwrap();
    if new_supply > ctx.accounts.access_control.max_total_supply {
        return Err(AccessControlError::MintExceedsMaxTotalSupply.into());
    }

    // Validate SecurityAssociatedAccount is initialized and matches expected PDA
    // Transfer hook program ID is read from the mint's transfer hook extension
    validate_security_associated_account(&ctx)?;

    let mint = ctx.accounts.security_mint.to_account_info();
    let accounts = MintTo {
        mint: mint.clone(),
        to: ctx.accounts.destination_account.to_account_info(),
        authority: ctx.accounts.access_control.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);

    let (_pda, bump_seed) =
        Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.key.as_ref()], ctx.program_id);

    let seeds = &[ACCESS_CONTROL_SEED, mint.key.as_ref(), &[bump_seed]];

    mint_to(cpi_ctx.with_signer(&[&seeds[..]]), amount)?;

    Ok(())
}

/// Validates that the SecurityAssociatedAccount is initialized for the destination
fn validate_security_associated_account(ctx: &Context<MintSecurities>) -> Result<()> {
    // Check if destination is the lockup escrow account
    if let Some(lockup_escrow) = ctx.accounts.access_control.lockup_escrow_account {
        if ctx.accounts.destination_account.key() == lockup_escrow {
            return Ok(());
        }
    }

    // For non-lockup-escrow destinations, security_associated_account is mandatory
    let saa_account = ctx.accounts.security_associated_account.as_ref()
        .ok_or(AccessControlError::SecurityAssociatedAccountRequired)?;

    let mint_account_info = &ctx.accounts.security_mint.to_account_info();
    let transfer_hook_extension = get_mint_extension_data::<TransferHook>(mint_account_info)?;
    let transfer_hook_program_id: Option<Pubkey> = transfer_hook_extension.program_id.into();
    if transfer_hook_program_id.is_none() {
        return Err(AccessControlError::TransferHookNotConfigured.into());
    }
    // Derive the expected SAA PDA using the transfer hook program ID
    let (expected_saa_pubkey, _bump) = Pubkey::find_program_address(
        &[
            SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
            ctx.accounts.destination_account.key().as_ref(),
        ],
        &transfer_hook_program_id.unwrap(),
    );

    // Validate the provided SAA matches the expected PDA
    require!(
        saa_account.key() == expected_saa_pubkey,
        AccessControlError::InvalidSecurityAssociatedAccount
    );

    // Validate the SAA account is initialized (has data)
    require!(
        !saa_account.data_is_empty(),
        AccessControlError::SecurityAssociatedAccountNotInitialized
    );

    Ok(())
}
