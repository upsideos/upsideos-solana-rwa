use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("Cannot mint more than max total supply")]
    MintExceedsMaxTotalSupply,
    #[msg("Wrong tokenlock account")]
    IncorrectTokenlockAccount,
    #[msg("Mismatched escrow account")]
    MismatchedEscrowAccount,
    #[msg("Cannot burn securities within lockup; cancel the lockup first")]
    CantBurnSecuritiesWithinLockup,
    #[msg("Cannot force transfer between lockup accounts")]
    CantForceTransferBetweenLockup,
    #[msg("New max total supply must exceed current total supply")]
    NewMaxTotalSupplyMustExceedCurrentTotalSupply,
    #[msg("Cannot freeze lockup escrow account")]
    CannotFreezeLockupEscrowAccount,
    #[msg("The provided value is already set. No changes were made")]
    ValueUnchanged,
    #[msg("Invalid security associated account")]
    InvalidSecurityAssociatedAccount,
    #[msg("Security associated account not initialized")]
    SecurityAssociatedAccountNotInitialized,
    #[msg("Transfer hook not configured on mint")]
    TransferHookNotConfigured,
    #[msg("Security associated account is required")]
    SecurityAssociatedAccountRequired,
    #[msg("Wallet already has this role")]
    AlreadyHasRole,
    #[msg("Cannot revoke role that wallet does not have")]
    CannotRevokeRole,
}
