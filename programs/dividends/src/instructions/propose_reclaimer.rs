use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, WalletRole, ACCESS_CONTROL_SEED,
};
use anchor_lang::prelude::*;

use crate::{constants, errors::DividendsErrorCode, Reclaimer};

/// Accounts for [dividends::propose_reclaimer].
#[derive(Accounts)]
#[instruction(new_reclaimer_wallet: Pubkey)]
pub struct ProposeReclaimer<'info> {
    /// Reclaimer account storing the wallet address.
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Reclaimer::INIT_SPACE,
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

    /// Authority wallet role to propose the reclaimer.
    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.has_any_role(access_control::Roles::ContractAdmin as u8) @ DividendsErrorCode::Unauthorized,
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
        constraint = security_mint.key() == access_control.mint,
    )]
    pub security_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,

    /// Authority signing the transaction.
    #[account()]
    pub authority: Signer<'info>,

    /// Payer for the reclaimer account initialization.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,
}

/// Proposes a new reclaimer wallet address for dividends.
pub fn propose_reclaimer(ctx: Context<ProposeReclaimer>, new_reclaimer_wallet: Pubkey) -> Result<()> {
    let reclaimer = &mut ctx.accounts.reclaimer;
    
    // Check if reclaimer is already set to the same value
    require!(
        reclaimer.wallet_address != new_reclaimer_wallet,
        DividendsErrorCode::ValueUnchanged
    );

    reclaimer.proposed_wallet_address = Some(new_reclaimer_wallet);

    Ok(())
}

