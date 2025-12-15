# JavaScript Client

A Codama-generated JavaScript library for Upside OS Solana RWA programs.

## Installation

```sh
npm install @upsideos/solana-rwa
```

## Programs

This package includes clients for the following programs:

- **Access Control** - Manage wallet roles, permissions, and security token operations
- **Transfer Restrictions** - Enforce transfer rules between holder groups
- **Tokenlock** - Create and manage time-locked token releases
- **Dividends** - Distribute and claim dividends via merkle proofs

## Getting Started

To build and test the JavaScript client from the root of the repository, you may use the following command:

```sh
pnpm clients:js:test
```

This will start a new local validator, if one is not already running, and run the tests for the JavaScript client.

## Available Client Scripts

Alternatively, you can go into the client directory and run the scripts directly:

```sh
# Build your programs and start the validator
pnpm build
pnpm validator:restart

# Go into the client directory and run the tests
cd clients/js
pnpm install
pnpm build
pnpm test
```

You may also use the following scripts to lint and/or format your JavaScript client:

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:fix
```

## Usage Example

### Recommended: Using Fetch Functions

```typescript
import { createSolanaRpc } from '@solana/kit';
import {
  fetchAccessControl,
  fetchMaybeWalletRole
} from '@upsideos/solana-rwa';

// Create RPC connection
const rpc = createSolanaRpc(v);

// Compute PDA for access control account
const accessControlPda = '59mfBZPtvb64bVzXQHi8kLQoA2BmcuCD8GGa6rTKwbiM'; // Example PDA

// Fetch and decode access control account
const accessControl = await fetchAccessControl(rpc, accessControlPda);

// Access account data
console.log('Mint:', accessControl.data.mint);
console.log('Authority:', accessControl.data.authority);
console.log('Max Total Supply:', accessControl.data.maxTotalSupply);

// Fetch wallet role (returns MaybeAccount - check exists property)
const walletRolePda = '6ZNDXHtDQpG7Nz8po5otoXrPmCiMAMxsVLAr8Nc6XL95'; // Example PDA
const walletRole = await fetchMaybeWalletRole(rpc, walletRolePda);

if (walletRole.exists) {
  console.log('Wallet Role:', walletRole.data.role);
}
```

## Building Instructions

The library provides generated functions for building Solana instructions. Here's an example of building a transfer restriction instruction:

```typescript
import { address } from '@solana/kit';
import {
  getSetAddressPermissionInstructionAsync
} from '@upsideos/solana-rwa';

// Build a set address permission instruction
const instruction = await getSetAddressPermissionInstructionAsync(
  {
    securityAssociatedAccount: securityAssociatedAccountAddress,
    transferRestrictionGroupNew: groupNewAddress,
    transferRestrictionGroupCurrent: groupCurrentAddress,
    transferRestrictionHolder: transferRestrictionHolderAddress,
    holderGroupNew: holderGroupNewAddress,
    holderGroupCurrent: holderGroupCurrentAddress,
    securityToken: mint,
    userWallet: walletAddress,
    userAssociatedTokenAccount: walletAssociatedAccountAddress,
    authorityWalletRole: authorityWalletRoleAddress,
    securityMint: mint,
    accessControlAccount: accessControlHelper.accessControlPubkey!,
    accessControlProgram: ACCESS_CONTROL_PROGRAM_ID,
    payer: payerSigner,
    authority: authoritySigner,
    groupId: BigInt(groupId),
    frozen,
  },
  { programAddress: TRANSFER_RESTRICTIONS_PROGRAM_ID },
);
```

## License

MIT

