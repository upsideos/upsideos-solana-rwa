use anchor_lang::prelude::*;

#[error_code]
pub enum DividendsErrorCode {
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Drop already claimed")]
    DropAlreadyClaimed,
    #[msg("Exceeded maximum claim amount")]
    ExceededMaxClaim,
    #[msg("Exceeded maximum number of claimed nodes")]
    ExceededNumNodes,
    #[msg("Account is not authorized to execute this instruction")]
    Unauthorized,
    #[msg("Token account owner did not match intended owner")]
    OwnerMismatch,
    #[msg("Keys must not match")]
    KeysMustNotMatch,
    #[msg("Invalid funding amount")]
    InvalidFundingAmount,
    #[msg("Distribution is paused")]
    DistributionPaused,
    #[msg("Distributor is not ready to claim")]
    DistributorNotReadyToClaim,
    #[msg("Invalid IPFS hash size")]
    InvalidIPFSHashSize,
    #[msg("The provided value is already set. No changes were made")]
    ValueUnchanged,
    #[msg("Transfer fee is not allowed for payment mint")]
    TransferFeeIsNotAllowedForPaymentMint,
    #[msg("Reclaimer address is not set")]
    ReclaimerNotSet,
}