use anchor_lang::prelude::*;

/// Holds the reclaimer wallet address for a given access control account.
#[account]
#[derive(Default, InitSpace)]
pub struct Reclaimer {
    /// Wallet address that will receive reclaimed dividends.
    pub wallet_address: Pubkey,
}

