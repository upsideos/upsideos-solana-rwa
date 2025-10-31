use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use access_control::{program::AccessControl as AccessControlProgram, AccessControl, WalletRole};

use crate::states::Reclaimer;
use crate::{
    errors::DividendsErrorCode,
    events::ReclaimedEvent,
    ClaimStatus,
    MerkleDistributor,
};

use crate::instructions::helpers::{
    mark_claim_status,
    transfer_dividends_tokens,
    update_distributor_after_claim,
    verify_merkle_proof,
};

/// [merkle_distributor::reclaim_dividends] accounts.
#[derive(Accounts)]
#[instruction(_bump: u8, index: u64)]
pub struct ReclaimDividends<'info> {
    /// The [MerkleDistributor].
    #[account(
        mut,
        address = from.owner,
    )]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Reclaimer account storing the wallet address.
    #[account(
        seeds = [
            b"reclaimer".as_ref(),
            access_control.key().as_ref()
        ],
        bump,
    )]
    pub reclaimer: Account<'info, Reclaimer>,

    /// Status of the claim.
    #[account(
        init,
        seeds = [
            b"ClaimStatus".as_ref(),
            index.to_le_bytes().as_ref(),
            distributor.key().to_bytes().as_ref()
        ],
        bump,
        space = 8 + ClaimStatus::INIT_SPACE,
        payer = payer
    )]
    pub claim_status: Account<'info, ClaimStatus>,

    /// Distributor ATA containing the tokens to distribute.
    #[account(mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub from: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Account to send the claimed tokens to.
    #[account(mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = to.owner == reclaimer.wallet_address @ DividendsErrorCode::OwnerMismatch,
    )]
    pub to: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: On behalf of the which the reclaimer is claiming.
    #[account()]
    pub target: AccountInfo<'info>,

    /// Payer of the claim.
    #[account(mut)]
    pub payer: Signer<'info>,

    // Distributor's token mint.
    #[account(address = distributor.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Authority wallet role to pause the distributor.
    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.has_any_role(access_control::Roles::TransferAdmin as u8) @ DividendsErrorCode::Unauthorized,
        constraint = authority_wallet_role.access_control == access_control.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    /// Access Control for Security Token.
    #[account(
        owner = AccessControlProgram::id(),
        constraint = distributor.access_control == access_control.key(),
    )]
    pub access_control: Account<'info, AccessControl>,

    /// Authority of the reclaim.
    #[account()]
    pub authority: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,

    /// SPL [Token] program.
    pub token_program: Interface<'info, TokenInterface>,
}

/// Reclaims all remaining unclaimed dividends and sends them to the reclaimer address.
pub fn reclaim_dividends<'info>(
    ctx: Context<'_, '_, '_, 'info, ReclaimDividends<'info>>,
    _bump: u8,
    index: u64,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    require!(
        ctx.accounts.from.key() != ctx.accounts.to.key(),
        DividendsErrorCode::KeysMustNotMatch
    );

    let claim_status = &mut ctx.accounts.claim_status;
    require!(
        // This check is redundant, we should not be able to initialize a claim status account at the same key.
        !claim_status.is_claimed && claim_status.claimed_at == 0,
        DividendsErrorCode::DropAlreadyClaimed
    );

    let target_account = &ctx.accounts.target;
    let distributor = &ctx.accounts.distributor;
    require!(
        distributor.ready_to_claim,
        DividendsErrorCode::DistributorNotReadyToClaim
    );

    // Verify the merkle proof.
    verify_merkle_proof(
        index,
        &target_account.key(),
        amount,
        proof,
        distributor.root,
    )?;

    // Mark it claimed (with authority as claimant since TransferAdmin is doing the reclaim).
    mark_claim_status(claim_status, amount, ctx.accounts.authority.key())?;

    // Transfer tokens.
    transfer_dividends_tokens(
        &ctx.accounts.distributor,
        &ctx.accounts.from,
        &ctx.accounts.to,
        &ctx.accounts.mint,
        ctx.accounts.token_program.key,
        amount,
        ctx.remaining_accounts,
    )?;

    // Update distributor totals.
    let distributor = &mut ctx.accounts.distributor;
    update_distributor_after_claim(distributor, amount)?;

    emit!(ReclaimedEvent {
        index,
        claimant: ctx.accounts.authority.key(),
        target: ctx.accounts.target.key(),
        amount
    });
    Ok(())
}
