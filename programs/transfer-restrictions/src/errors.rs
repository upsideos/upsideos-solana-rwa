use anchor_lang::prelude::*;

#[error_code]
pub enum TransferRestrictionsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max holders reached")]
    MaxHoldersReached,
    #[msg("Transfer rule not allowed until later")]
    TransferRuleNotAllowedUntilLater,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("All transfers are paused")]
    AllTransfersPaused,
    #[msg("Invalid PDA")]
    InvalidPDA,
    #[msg("Balance is too low")]
    BalanceIsTooLow,
    #[msg("Current wallets count must be zero")]
    CurrentWalletsCountMustBeZero,
    #[msg("Mismatched escrow account")]
    MismatchedEscrowAccount,
    #[msg("Invalid transfer restriction holder index")]
    InvalidHolderIndex,
    #[msg("Max holders reached inside the group")]
    MaxHoldersReachedInsideTheGroup,
    #[msg("Transfer group not approved")]
    TransferGroupNotApproved,
    #[msg("Wrong tokenlock account")]
    IncorrectTokenlockAccount,
    #[msg("Transfer rule account data is empty")]
    TransferRuleAccountDataIsEmtpy,
    #[msg("Security associated account data is empty")]
    SecurityAssociatedAccountDataIsEmtpy,
    #[msg("Transfer restrictions account data is empty")]
    TransferRestrictionsAccountDataIsEmtpy,
    #[msg("No wallets in group")]
    NoWalletsInGroup,
    #[msg("New group is the same as the current group")]
    NewGroupIsTheSameAsTheCurrentGroup,
    #[msg("New holder max must exceed current holder count")]
    NewHolderMaxMustExceedCurrentHolderCount,
    #[msg("New holder group max must exceed current holder group count")]
    NewHolderGroupMaxMustExceedCurrentHolderGroupCount,
    #[msg("Zero group holder group max cannot be non-zero")]
    ZeroGroupHolderGroupMaxCannotBeNonZero,
    #[msg("Non-positive holder group count")]
    NonPositiveHolderGroupCount,
    #[msg("Current holder group count must be zero")]
    CurrentHolderGroupCountMustBeZero,
    #[msg("The provided value is already set. No changes were made")]
    ValueUnchanged,
    #[msg("Current group and holder group must be provided for existing wallet")]
    CurrentGroupRequiredForExistingWallet,
}
