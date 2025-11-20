#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod states;
use states::*;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod merkle_proof;
pub mod utils;
use instructions::*;

declare_id!("FUjkkUVKa9Pofs5mBdiYQe2cBVwzrhX8SunAZhGXRkog");

#[program]
pub mod dividends {
    use super::*;

    /// Creates a new [MerkleDistributor].
    /// After creating this [MerkleDistributor], the account should be seeded with tokens via its ATA.
    pub fn new_distributor(
        ctx: Context<NewDistributor>,
        _bump: u8,
        root: [u8; 32],
        total_claim_amount: u64,
        num_nodes: u64,
        ipfs_hash: String,
    ) -> Result<()> {
        instructions::new_distributor(ctx, _bump, root, total_claim_amount, num_nodes, ipfs_hash)
    }

    /// Claims tokens from the [MerkleDistributor].
    pub fn claim<'info>(
        ctx: Context<'_, '_, '_, 'info, Claim<'info>>,
        _bump: u8,
        index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim(ctx, _bump, index, amount, proof)
    }

    /// Fund dividend tokens to the [MerkleDistributor].
    pub fn fund_dividends<'info>(
        ctx: Context<'_, '_, '_, 'info, FundDividends<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::fund_dividends(ctx, amount)
    }

    /// Pause the [MerkleDistributor].
    pub fn pause<'info>(ctx: Context<Pause>, paused: bool) -> Result<()> {
        instructions::pause(ctx, paused)
    }

    /// Proposes a new reclaimer wallet address for dividends.
    pub fn propose_reclaimer<'info>(
        ctx: Context<ProposeReclaimer>,
        new_reclaimer_wallet: Pubkey,
    ) -> Result<()> {
        instructions::propose_reclaimer(ctx, new_reclaimer_wallet)
    }

    /// Accepts the proposed reclaimer ownership transfer.
    pub fn accept_reclaimer_ownership<'info>(
        ctx: Context<AcceptReclaimerOwnership>,
    ) -> Result<()> {
        instructions::accept_reclaimer_ownership(ctx)
    }

    /// Reclaims all remaining unclaimed dividends and sends them to the reclaimer address.
    pub fn reclaim_dividends<'info>(
        ctx: Context<'_, '_, '_, 'info, ReclaimDividends<'info>>,
        _bump: u8,
        index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::reclaim_dividends(ctx, _bump, index, amount, proof)
    }
}
