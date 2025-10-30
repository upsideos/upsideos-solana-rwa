use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, WalletRole, ACCESS_CONTROL_SEED,
};
use anchor_lang::prelude::*;

use crate::{errors::DividendsErrorCode, Reclaimer};

/// Accounts for [dividends::set_reclaimer].
#[derive(Accounts)]
#[instruction(reclaimer_wallet: Pubkey)]
pub struct SetReclaimer<'info> {
    /// Reclaimer account storing the wallet address.
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Reclaimer::INIT_SPACE,
        seeds = [
            b"reclaimer".as_ref(),
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

    /// Authority wallet role to set the reclaimer.
    #[account(
        constraint = authority_wallet_role.owner == authority.key() @ DividendsErrorCode::Unauthorized,
        constraint = authority_wallet_role.has_any_role(access_control::Roles::ContractAdmin as u8) @ DividendsErrorCode::Unauthorized,
        constraint = authority_wallet_role.access_control == access_control.key() @ DividendsErrorCode::Unauthorized,
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
        constraint = security_mint.key() == access_control.mint,
    )]
    pub security_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,

    /// Authority signing the transaction.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Payer for the reclaimer account initialization.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,
}

/// Sets the reclaimer wallet address for dividends.
pub fn set_reclaimer(ctx: Context<SetReclaimer>, reclaimer_wallet: Pubkey) -> Result<()> {
    let reclaimer = &mut ctx.accounts.reclaimer;
    
    // Check if reclaimer is already set to the same value
    require!(
        reclaimer.wallet_address != reclaimer_wallet,
        DividendsErrorCode::ValueUnchanged
    );

    reclaimer.wallet_address = reclaimer_wallet;

    Ok(())
}

