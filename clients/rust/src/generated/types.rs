//! Re-exports all types from program modules.
//!
//! This module consolidates types from all program-specific type modules
//! to allow imports from `crate::generated::types::*`.

// Re-export tokenlock types
pub use crate::generated::tokenlock::types::*;

// Re-export dividends types
pub use crate::generated::dividends::types::*;

