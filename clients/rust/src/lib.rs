//! Upside OS Solana RWA Client
//!
//! This crate provides Rust client bindings for the Upside OS Solana RWA programs:
//! - Access Control
//! - Dividends  
//! - Tokenlock
//! - Transfer Restrictions
//!
//! Generated using Codama from the program IDL files.

mod generated;
pub use generated::*;

// Re-export program IDs at crate root for generated code compatibility
pub use generated::access_control::programs::ACCESS_CONTROL_ID;
pub use generated::dividends::programs::DIVIDENDS_ID;
pub use generated::tokenlock::programs::TOKENLOCK_ID;
pub use generated::transfer_restrictions::programs::TRANSFER_RESTRICTIONS_ID;
