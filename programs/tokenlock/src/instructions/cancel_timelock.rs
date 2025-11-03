use anchor_lang::{prelude::*, solana_program::program_memory::sol_memcmp, Discriminator};
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};
use transfer_restrictions::program::TransferRestrictions;

use crate::{
    enforce_transfer_restrictions_cpi, error::TokenlockErrors, transfer_spl_from_escrow, utils,
};

use tokenlock_accounts::{
    states::{TimelockData, TokenLockData},
    wrappers::TokenLockDataWrapper,
};

#[derive(Accounts)]
pub struct CancelTimelock<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut,
        constraint = timelock_account.tokenlock_account == *tokenlock_account.key,
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(mut)]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Escrow account authority
    pub pda_account: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut,
        constraint = *target.key == timelock_account.target_account,
    )]
    /// CHECK: System Account which identify target user wallet
    /// with which will be linked timelocks
    pub target: AccountInfo<'info>,

    #[account(mut,
        constraint = *reclaimer.to_account_info().owner == *token_program.key,
    )]
    pub reclaimer: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        constraint = *target_assoc.to_account_info().owner == *token_program.key,
        constraint = reclaimer.mint == target_assoc.mint,
        constraint = target_assoc.owner == *target.key,
        constraint = escrow_account.mint == reclaimer.mint
    )]
    pub target_assoc: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program,
    )]
    pub mint_address: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Program<'info, Token2022>,

    pub transfer_restrictions_program: Program<'info, TransferRestrictions>,

    /// CHECK: extra account for the authority
    pub security_associated_account_from: UncheckedAccount<'info>,
    /// CHECK: extra account for the recipient
    pub security_associated_account_to: UncheckedAccount<'info>,
    /// CHECK: extra account for the transfer rule
    pub transfer_rule: UncheckedAccount<'info>,
}

pub fn cancel_timelock<'info>(
    ctx: Context<'_, '_, '_, 'info, CancelTimelock<'info>>,
    timelock_id: u32,
) -> Result<()> {
    let timelock_account = &mut ctx.accounts.timelock_account;
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    let discriminator = TokenLockData::DISCRIMINATOR;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    //constraint
    let mint_address = TokenLockDataWrapper::mint_address(&tokenlock_account_data);
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);

    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TokenlockErrors::MisMatchedEscrow.into());
    }
    if mint_address != ctx.accounts.reclaimer.mint
        || mint_address != ctx.accounts.mint_address.key()
    {
        return Err(TokenlockErrors::MisMatchedToken.into());
    }

    //check param
    if timelock_id >= timelock_account.timelocks.len() as u32 {
        return Err(TokenlockErrors::InvalidTimelockId.into());
    }

    let cancelable_by_index = timelock_account.get_cancelable_index(ctx.accounts.authority.key);
    if cancelable_by_index.is_none() {
        return Err(TokenlockErrors::HasntCancelTimelockPermission.into());
    }
    let timelock = timelock_account.get_timelock(timelock_id).unwrap();
    if timelock.has_cancelable_by(cancelable_by_index.unwrap()) == false {
        return Err(TokenlockErrors::HasntCancelTimelockPermission.into());
    }

    let now_ts = utils::get_unix_timestamp();
    let paid_amount =
        timelock_account.unlocked_balance_of_timelock(timelock_id, &tokenlock_account_data, now_ts);
    let canceled_amount =
        timelock_account.locked_balance_of_timelock(timelock_id, &tokenlock_account_data, now_ts);
    if canceled_amount as u64 == 0 {
        return Err(TokenlockErrors::TimelockHasntValue.into());
    }

    if ctx.remaining_accounts.len() == 0
        || ctx.remaining_accounts[0].key()
            != TokenLockDataWrapper::transfer_restriction_data(&tokenlock_account_data)
    {
        return Err(TokenlockErrors::InvalidTransferRestrictionData.into());
    }
    enforce_transfer_restrictions_cpi(
        ctx.accounts.target_assoc.to_account_info().clone(),
        ctx.accounts.mint_address.to_account_info(),
        ctx.accounts.reclaimer.to_account_info(),
        ctx.remaining_accounts[0].clone(),
        ctx.accounts
            .security_associated_account_from
            .to_account_info(),
        ctx.accounts
            .security_associated_account_to
            .to_account_info(),
        ctx.accounts.transfer_rule.to_account_info(),
        ctx.accounts.transfer_restrictions_program.to_account_info(),
    )?;

    let split_at_pos = ctx.remaining_accounts.len() / 2;
    transfer_spl_from_escrow(
        &ctx.accounts.token_program,
        &ctx.accounts.escrow_account.to_account_info(),
        &ctx.accounts.reclaimer.to_account_info(),
        &ctx.accounts.pda_account,
        canceled_amount,
        &ctx.accounts.mint_address.to_account_info(),
        tokenlock_account.key,
        &ctx.remaining_accounts[..split_at_pos],
        ctx.accounts.mint_address.decimals,
        TokenLockDataWrapper::bump_seed(&tokenlock_account_data),
    )?;
    // NOTE: no need to enforceTransferRestriction because it is a target wallet
    transfer_spl_from_escrow(
        &ctx.accounts.token_program,
        &ctx.accounts.escrow_account.to_account_info(),
        &ctx.accounts.target_assoc.to_account_info(),
        &ctx.accounts.pda_account,
        paid_amount,
        &ctx.accounts.mint_address.to_account_info(),
        tokenlock_account.key,
        &ctx.remaining_accounts[split_at_pos..],
        ctx.accounts.mint_address.decimals,
        TokenLockDataWrapper::bump_seed(&tokenlock_account_data),
    )?;

    let timelock1 = timelock_account.get_timelock_mut(timelock_id).unwrap();
    timelock1.tokens_transferred = timelock1.total_amount;

    Ok(())
}
