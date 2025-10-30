use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::onchain::invoke_transfer_checked;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    errors::DividendsErrorCode,
    merkle_proof,
    ClaimStatus,
    MerkleDistributor,
};

/// Helper function to verify merkle proof.
pub fn verify_merkle_proof(
    index: u64,
    claimant: &Pubkey,
    amount: u64,
    proof: Vec<[u8; 32]>,
    root: [u8; 32],
) -> Result<()> {
    let node = solana_keccak_hasher::hashv(&[
        &index.to_le_bytes(),
        &claimant.to_bytes(),
        &amount.to_le_bytes(),
    ]);
    require!(
        merkle_proof::verify(proof, root, node.to_bytes()),
        DividendsErrorCode::InvalidProof
    );
    Ok(())
}

/// Helper function to mark claim status as claimed.
pub fn mark_claim_status(claim_status: &mut Account<'_, ClaimStatus>, amount: u64, claimant: Pubkey) -> Result<()> {
    claim_status.amount = amount;
    claim_status.is_claimed = true;
    let clock = Clock::get()?;
    claim_status.claimed_at = clock.unix_timestamp;
    claim_status.claimant = claimant;
    Ok(())
}

/// Helper function to transfer dividends tokens.
pub fn transfer_dividends_tokens<'info>(
    distributor: &Account<'info, MerkleDistributor>,
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program_id: &Pubkey,
    amount: u64,
    remaining_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    require!(
        from.key() != to.key(),
        DividendsErrorCode::KeysMustNotMatch
    );

    let seeds = &[
        b"MerkleDistributor".as_ref(),
        &distributor.base.to_bytes(),
        &[distributor.bump],
    ];

    let source_info = from.to_account_info();
    let mint_info = mint.to_account_info();
    let destination_info = to.to_account_info();
    let authority_info = distributor.to_account_info();
    let decimals = mint.decimals;

    invoke_transfer_checked(
        token_program_id,
        source_info.clone(),
        mint_info.clone(),
        destination_info.clone(),
        authority_info.clone(),
        remaining_accounts,
        amount,
        decimals,
        &[&seeds[..]],
    )?;

    Ok(())
}

/// Helper function to update distributor totals after a claim/reclaim.
pub fn update_distributor_after_claim(
    distributor: &mut Account<'_, MerkleDistributor>,
    amount: u64,
) -> Result<()> {
    distributor.total_amount_claimed = distributor
        .total_amount_claimed
        .checked_add(amount)
        .unwrap();
    require!(
        distributor.total_amount_claimed <= distributor.total_claim_amount,
        DividendsErrorCode::ExceededMaxClaim
    );

    distributor.num_nodes_claimed = distributor.num_nodes_claimed
        .checked_add(1)
        .unwrap();
    require!(
        distributor.num_nodes_claimed <= distributor.num_nodes,
        DividendsErrorCode::ExceededNumNodes
    );

    Ok(())
}

