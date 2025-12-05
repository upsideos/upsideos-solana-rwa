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

```typescript
import { createSolanaRpc, createSolanaRpcSubscriptions, address } from '@solana/kit';
import { 
  getInitializeAccessControlInstruction,
  getAccessControlDecoder,
  findAccessControlPda 
} from '@upsideos/solana-rwa';

// Create RPC connection
const rpc = createSolanaRpc('http://127.0.0.1:8899');

// Find PDA for access control account
const [accessControlPda] = await findAccessControlPda({ mint: mintAddress });

// Fetch and decode access control account
const accountInfo = await rpc.getAccountInfo(accessControlPda).send();
const accessControl = getAccessControlDecoder().decode(accountInfo.value.data);
```

## License

MIT

