use anchor_lang::prelude::*;


/// Emitted when tokens are claimed.
#[event]
pub struct ClaimedEvent {
    /// Index of the claim.
    pub index: u64,
    /// User that claimed.
    pub claimant: Pubkey,
    /// Amount of tokens to distribute.
    pub amount: u64,
}

#[event]
pub struct FundedEvent {
    /// Distribution which funded.
    pub distributor: Pubkey,
    /// User that funded.
    pub funder: Pubkey,
    /// Amount of tokens funded.
    pub amount: u64,
}

/// Emitted when dividends are reclaimed.
#[event]
pub struct ReclaimedEvent {
    /// Index of the claim.
    pub index: u64,
    /// User that claimed.
    pub claimant: Pubkey,
    /// Dividends owner
    pub target: Pubkey,
    /// Amount of tokens to distribute.
    pub amount: u64,
}
