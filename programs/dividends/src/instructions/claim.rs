use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::onchain::invoke_transfer_checked;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    errors::DividendsErrorCode, events::ClaimedEvent, merkle_proof, ClaimStatus, MerkleDistributor,
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
    let node = solana_keccak_hasher::hashv(&[
        &index.to_le_bytes(),
        &claimant_account.key().to_bytes(),
        &amount.to_le_bytes(),
    ]);
    require!(
        merkle_proof::verify(proof, distributor.root, node.to_bytes()),
        DividendsErrorCode::InvalidProof
    );

    // Mark it claimed and send the tokens.
    claim_status.amount = amount;
    claim_status.is_claimed = true;
    let clock = Clock::get()?;
    claim_status.claimed_at = clock.unix_timestamp;
    claim_status.claimant = claimant_account.key();

    let seeds = &[
        b"MerkleDistributor".as_ref(),
        &distributor.base.to_bytes(),
        &[ctx.accounts.distributor.bump],
    ];

    let token_program_id = ctx.accounts.token_program.key;
    let source_info = ctx.accounts.from.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let destination_info = ctx.accounts.to.to_account_info();
    let authority_info = ctx.accounts.distributor.to_account_info();
    let decimals = ctx.accounts.mint.decimals;
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

    let distributor = &mut ctx.accounts.distributor;
    distributor.total_amount_claimed = distributor
        .total_amount_claimed
        .checked_add(amount)
        .unwrap();
    require!(
        distributor.total_amount_claimed <= distributor.total_claim_amount,
        DividendsErrorCode::ExceededMaxClaim
    );
    distributor.num_nodes_claimed = distributor.num_nodes_claimed.checked_add(1).unwrap();
    require!(
        distributor.num_nodes_claimed <= distributor.num_nodes,
        DividendsErrorCode::ExceededNumNodes
    );

    emit!(ClaimedEvent {
        index,
        claimant: claimant_account.key(),
        amount
    });
    Ok(())
}
