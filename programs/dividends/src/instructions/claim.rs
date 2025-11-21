use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants,
    errors::DividendsErrorCode,
    events::ClaimedEvent,
    ClaimStatus,
    MerkleDistributor,
};

use crate::instructions::helpers::{
    mark_claim_status,
    transfer_dividends_tokens,
    update_distributor_after_claim,
    verify_merkle_proof,
};

/// [merkle_distributor::claim] accounts.
#[derive(Accounts)]
#[instruction(_bump: u8, index: u64)]
pub struct Claim<'info> {
    /// The [MerkleDistributor].
    #[account(
        mut,
        address = from.owner,
        constraint = distributor.paused == false @ DividendsErrorCode::DistributionPaused,
    )]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Status of the claim.
    #[account(
        init,
        seeds = [
            constants::CLAIM_STATUS_SEED,
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
    )]
    pub to: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Who is claiming the tokens.
    #[account(address = to.owner @ DividendsErrorCode::OwnerMismatch)]
    pub claimant: Signer<'info>,

    /// Payer of the claim.
    #[account(mut)]
    pub payer: Signer<'info>,

    // Distributor's token mint.
    #[account(address = distributor.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The [System] program.
    pub system_program: Program<'info, System>,

    /// SPL [Token] program.
    pub token_program: Interface<'info, TokenInterface>,
}

/// Claims tokens from the [MerkleDistributor].
pub fn claim<'info>(
    ctx: Context<'_, '_, '_, 'info, Claim<'info>>,
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

    let claimant_account = &ctx.accounts.claimant;
    let distributor = &ctx.accounts.distributor;
    require!(claimant_account.is_signer, DividendsErrorCode::Unauthorized);
    require!(
        distributor.ready_to_claim,
        DividendsErrorCode::DistributorNotReadyToClaim
    );

    // Verify the merkle proof.
    verify_merkle_proof(
        index,
        &claimant_account.key(),
        amount,
        proof,
        distributor.root,
    )?;

    // Mark it claimed.
    mark_claim_status(claim_status, amount, claimant_account.key())?;

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

    emit!(ClaimedEvent {
        index,
        claimant: claimant_account.key(),
        amount
    });
    Ok(())
}
