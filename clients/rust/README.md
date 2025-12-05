# Rust Client

A Codama-generated Rust library for Upside OS Solana RWA programs.

## Getting Started

To build and test the Rust client from the root of the repository, you may use the following command:

```sh
pnpm clients:rust:test
```

This will start a new local validator, if one is not already running, and run the tests for the Rust client.

## Programs

This crate includes clients for the following programs:

- **Access Control** - Manage wallet roles, permissions, and security token operations
- **Transfer Restrictions** - Enforce transfer rules between holder groups
- **Tokenlock** - Create and manage time-locked token releases
- **Dividends** - Distribute and claim dividends via merkle proofs

## License

MIT

