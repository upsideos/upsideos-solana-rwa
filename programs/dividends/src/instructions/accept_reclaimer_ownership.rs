use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, ACCESS_CONTROL_SEED,
};
use anchor_lang::prelude::*;

use crate::{constants, errors::DividendsErrorCode, Reclaimer};

/// Accounts for [dividends::accept_reclaimer_ownership].
#[derive(Accounts)]
pub struct AcceptReclaimerOwnership<'info> {
    /// Reclaimer account storing the wallet address.
    #[account(
        mut,
        seeds = [
            constants::RECLAIMER_SEED,
            access_control.key().as_ref()
        ],
        bump,
    )]
    pub reclaimer: Account<'info, Reclaimer>,

    /// Access Control for Security Token.
    #[account(
        seeds = [
          ACCESS_CONTROL_SEED,
          security_mint.key().as_ref(),
        ],
        bump,
        seeds::program = AccessControlProgram::id(),
    )]
    pub access_control: Account<'info, AccessControl>,

    #[account(
        constraint = security_mint.key() == access_control.mint,
    )]
    pub security_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,

    /// New owner signing the transaction (must match proposed_wallet_address).
    #[account()]
    pub new_owner: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,
}

/// Accepts the proposed reclaimer ownership transfer.
pub fn accept_reclaimer_ownership(ctx: Context<AcceptReclaimerOwnership>) -> Result<()> {
    let reclaimer = &mut ctx.accounts.reclaimer;
    
    // Check if a proposal exists
    require!(
        reclaimer.proposed_wallet_address.is_some(),
        DividendsErrorCode::NoPendingOwnershipTransfer
    );

    let proposed_wallet_address = reclaimer.proposed_wallet_address.unwrap();
    // Check if the signer matches the proposed wallet
    require!(
        ctx.accounts.new_owner.key() == proposed_wallet_address,
        DividendsErrorCode::UnauthorizedOwnershipTransfer
    );

    // Transfer ownership
    reclaimer.wallet_address = proposed_wallet_address;
    reclaimer.proposed_wallet_address = None;

    Ok(())
}

