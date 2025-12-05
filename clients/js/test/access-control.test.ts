/**
 * Unit tests for access_control module
 */

import test from 'ava';
import { generateKeyPairSigner, address } from '@solana/kit';
import { accessControl } from '../src';

// ============================================================================
// Program Address Tests
// ============================================================================

test('it exports the correct program address', (t) => {
  t.is(
    accessControl.ACCESS_CONTROL_PROGRAM_ADDRESS as string,
    '4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3'
  );
});

// ============================================================================
// Account Discriminator Tests
// ============================================================================

test('it has the correct AccessControl account discriminator', (t) => {
  t.deepEqual(
    accessControl.ACCESS_CONTROL_DISCRIMINATOR,
    new Uint8Array([147, 81, 178, 92, 223, 66, 181, 132])
  );
});

test('it has the correct WalletRole account discriminator', (t) => {
  t.deepEqual(
    accessControl.WALLET_ROLE_DISCRIMINATOR,
    new Uint8Array([219, 71, 35, 217, 102, 248, 173, 9])
  );
});

// ============================================================================
// Account Codec Tests
// ============================================================================

test('it encodes and decodes AccessControl account data', (t) => {
  const encoder = accessControl.getAccessControlEncoder();
  const decoder = accessControl.getAccessControlDecoder();
  const codec = accessControl.getAccessControlCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);

  const testData = {
    mint: address('11111111111111111111111111111111'),
    authority: address('11111111111111111111111111111112'),
    maxTotalSupply: 1_000_000n,
    lockupEscrowAccount: null,
  };

  const encoded = encoder.encode(testData);
  t.true(encoded instanceof Uint8Array);
  t.true(encoded.length > 0);

  const decoded = decoder.decode(encoded);
  t.is(decoded.mint, testData.mint);
  t.is(decoded.authority, testData.authority);
  t.is(decoded.maxTotalSupply, testData.maxTotalSupply);
});

test('it encodes and decodes WalletRole account data', (t) => {
  const encoder = accessControl.getWalletRoleEncoder();
  const decoder = accessControl.getWalletRoleDecoder();
  const codec = accessControl.getWalletRoleCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);

  const testData = {
    owner: address('11111111111111111111111111111111'),
    accessControl: address('11111111111111111111111111111112'),
    role: 1,
  };

  const encoded = encoder.encode(testData);
  t.true(encoded instanceof Uint8Array);
  t.true(encoded.length > 0);

  const decoded = decoder.decode(encoded);
  t.is(decoded.owner, testData.owner);
  t.is(decoded.accessControl, testData.accessControl);
  t.is(decoded.role, testData.role);
});

// ============================================================================
// Instruction Discriminator Tests
// ============================================================================

test('it has the correct InitializeAccessControl discriminator', (t) => {
  t.deepEqual(
    accessControl.INITIALIZE_ACCESS_CONTROL_DISCRIMINATOR,
    new Uint8Array([244, 90, 245, 242, 199, 224, 247, 140])
  );
});

test('it has the correct MintSecurities discriminator', (t) => {
  t.deepEqual(
    accessControl.MINT_SECURITIES_DISCRIMINATOR,
    new Uint8Array([90, 195, 58, 36, 142, 195, 14, 225])
  );
});

test('it has the correct BurnSecurities discriminator', (t) => {
  t.deepEqual(
    accessControl.BURN_SECURITIES_DISCRIMINATOR,
    new Uint8Array([79, 165, 145, 57, 203, 228, 175, 0])
  );
});

test('it has the correct GrantRole discriminator', (t) => {
  t.deepEqual(
    accessControl.GRANT_ROLE_DISCRIMINATOR,
    new Uint8Array([218, 234, 128, 15, 82, 33, 236, 253])
  );
});

test('it has the correct RevokeRole discriminator', (t) => {
  t.deepEqual(
    accessControl.REVOKE_ROLE_DISCRIMINATOR,
    new Uint8Array([179, 232, 2, 180, 48, 227, 82, 7])
  );
});

test('it has the correct FreezeWallet discriminator', (t) => {
  t.deepEqual(
    accessControl.FREEZE_WALLET_DISCRIMINATOR,
    new Uint8Array([93, 202, 159, 167, 22, 246, 255, 211])
  );
});

test('it has the correct ThawWallet discriminator', (t) => {
  t.deepEqual(
    accessControl.THAW_WALLET_DISCRIMINATOR,
    new Uint8Array([79, 251, 128, 221, 55, 172, 181, 221])
  );
});

test('it has the correct SetMaxTotalSupply discriminator', (t) => {
  t.deepEqual(
    accessControl.SET_MAX_TOTAL_SUPPLY_DISCRIMINATOR,
    new Uint8Array([249, 164, 34, 254, 160, 89, 214, 12])
  );
});

test('it has the correct ForceTransferBetween discriminator', (t) => {
  t.deepEqual(
    accessControl.FORCE_TRANSFER_BETWEEN_DISCRIMINATOR,
    new Uint8Array([186, 115, 85, 7, 217, 111, 254, 108])
  );
});

test('it has the correct SetLockupEscrowAccount discriminator', (t) => {
  t.deepEqual(
    accessControl.SET_LOCKUP_ESCROW_ACCOUNT_DISCRIMINATOR,
    new Uint8Array([134, 172, 249, 223, 25, 118, 55, 93])
  );
});

// ============================================================================
// Instruction Data Codec Tests
// ============================================================================

test('it encodes and decodes InitializeAccessControl instruction data', (t) => {
  const encoder = accessControl.getInitializeAccessControlInstructionDataEncoder();
  const decoder = accessControl.getInitializeAccessControlInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);

  const testData = {
    decimals: 6,
    name: 'Test Security Token',
    symbol: 'TST',
    uri: 'https://example.com/metadata.json',
    hookProgramId: address('11111111111111111111111111111111'),
    maxTotalSupply: 1_000_000_000n,
  };

  const encoded = encoder.encode(testData);
  t.true(encoded instanceof Uint8Array);
  t.true(encoded.length > 0);

  const decoded = decoder.decode(encoded);
  t.is(decoded.decimals, testData.decimals);
  t.is(decoded.name, testData.name);
  t.is(decoded.symbol, testData.symbol);
  t.is(decoded.uri, testData.uri);
  t.is(decoded.hookProgramId, testData.hookProgramId);
  t.is(decoded.maxTotalSupply, testData.maxTotalSupply);
});

test('it encodes and decodes MintSecurities instruction data', (t) => {
  const encoder = accessControl.getMintSecuritiesInstructionDataEncoder();
  const decoder = accessControl.getMintSecuritiesInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);

  const testData = {
    amount: 1_000_000n,
  };

  const encoded = encoder.encode(testData);
  const decoded = decoder.decode(encoded);
  t.is(decoded.amount, testData.amount);
});

test('it encodes and decodes BurnSecurities instruction data', (t) => {
  const encoder = accessControl.getBurnSecuritiesInstructionDataEncoder();
  const decoder = accessControl.getBurnSecuritiesInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);

  const testData = {
    amount: 500_000n,
  };

  const encoded = encoder.encode(testData);
  const decoded = decoder.decode(encoded);
  t.is(decoded.amount, testData.amount);
});

test('it encodes and decodes GrantRole instruction data', (t) => {
  const encoder = accessControl.getGrantRoleInstructionDataEncoder();
  const decoder = accessControl.getGrantRoleInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);

  const testData = {
    role: 1, // Example role value
  };

  const encoded = encoder.encode(testData);
  const decoded = decoder.decode(encoded);
  t.is(decoded.role, testData.role);
});

test('it encodes and decodes RevokeRole instruction data', (t) => {
  const encoder = accessControl.getRevokeRoleInstructionDataEncoder();
  const decoder = accessControl.getRevokeRoleInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

// ============================================================================
// Instruction Builder Tests
// ============================================================================

test('it builds InitializeAccessControl instruction with async helper', async (t) => {
  const payer = await generateKeyPairSigner();
  const mint = await generateKeyPairSigner();
  const hookProgramId = address('11111111111111111111111111111111');

  const instruction = await accessControl.getInitializeAccessControlInstructionAsync({
    payer,
    authority: payer.address,
    mint,
    decimals: 6,
    name: 'Test Token',
    symbol: 'TST',
    uri: 'https://example.com/metadata.json',
    hookProgramId,
    maxTotalSupply: 1_000_000_000n,
  });

  t.truthy(instruction);
  t.is(instruction.programAddress, accessControl.ACCESS_CONTROL_PROGRAM_ADDRESS);
  t.is(instruction.accounts.length, 7);
  t.true(instruction.data instanceof Uint8Array);
  t.true(instruction.data.length > 0);
});

// ============================================================================
// Instruction Identification Tests
// ============================================================================

test('it identifies InitializeAccessControl instruction', (t) => {
  const data = new Uint8Array([244, 90, 245, 242, 199, 224, 247, 140, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlInstruction(data);
  t.is(identified, accessControl.AccessControlInstruction.InitializeAccessControl);
});

test('it identifies MintSecurities instruction', (t) => {
  const data = new Uint8Array([90, 195, 58, 36, 142, 195, 14, 225, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlInstruction(data);
  t.is(identified, accessControl.AccessControlInstruction.MintSecurities);
});

test('it identifies BurnSecurities instruction', (t) => {
  const data = new Uint8Array([79, 165, 145, 57, 203, 228, 175, 0, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlInstruction(data);
  t.is(identified, accessControl.AccessControlInstruction.BurnSecurities);
});

test('it identifies GrantRole instruction', (t) => {
  const data = new Uint8Array([218, 234, 128, 15, 82, 33, 236, 253, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlInstruction(data);
  t.is(identified, accessControl.AccessControlInstruction.GrantRole);
});

test('it identifies FreezeWallet instruction', (t) => {
  const data = new Uint8Array([93, 202, 159, 167, 22, 246, 255, 211, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlInstruction(data);
  t.is(identified, accessControl.AccessControlInstruction.FreezeWallet);
});

test('it identifies ThawWallet instruction', (t) => {
  const data = new Uint8Array([79, 251, 128, 221, 55, 172, 181, 221, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlInstruction(data);
  t.is(identified, accessControl.AccessControlInstruction.ThawWallet);
});

// ============================================================================
// Account Identification Tests
// ============================================================================

test('it identifies AccessControl account', (t) => {
  const data = new Uint8Array([147, 81, 178, 92, 223, 66, 181, 132, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlAccount(data);
  t.is(identified, accessControl.AccessControlAccount.AccessControl);
});

test('it identifies WalletRole account', (t) => {
  const data = new Uint8Array([219, 71, 35, 217, 102, 248, 173, 9, 0, 0, 0, 0]);
  const identified = accessControl.identifyAccessControlAccount(data);
  t.is(identified, accessControl.AccessControlAccount.WalletRole);
});

// ============================================================================
// Error Code Tests
// ============================================================================

test('it exports error codes', (t) => {
  t.is(typeof accessControl.ACCESS_CONTROL_ERROR__UNAUTHORIZED, 'number');
  t.is(typeof accessControl.ACCESS_CONTROL_ERROR__INVALID_ROLE, 'number');
  t.is(typeof accessControl.ACCESS_CONTROL_ERROR__MINT_EXCEEDS_MAX_TOTAL_SUPPLY, 'number');
});

test('it provides error messages for error codes', (t) => {
  const message = accessControl.getAccessControlErrorMessage(
    accessControl.ACCESS_CONTROL_ERROR__UNAUTHORIZED
  );
  t.is(typeof message, 'string');
  t.true(message.length > 0);
});

// ============================================================================
// Enum Tests
// ============================================================================

test('it exports AccessControlInstruction enum values', (t) => {
  t.is(typeof accessControl.AccessControlInstruction.InitializeAccessControl, 'number');
  t.is(typeof accessControl.AccessControlInstruction.MintSecurities, 'number');
  t.is(typeof accessControl.AccessControlInstruction.BurnSecurities, 'number');
  t.is(typeof accessControl.AccessControlInstruction.GrantRole, 'number');
  t.is(typeof accessControl.AccessControlInstruction.RevokeRole, 'number');
  t.is(typeof accessControl.AccessControlInstruction.FreezeWallet, 'number');
  t.is(typeof accessControl.AccessControlInstruction.ThawWallet, 'number');
  t.is(typeof accessControl.AccessControlInstruction.SetMaxTotalSupply, 'number');
  t.is(typeof accessControl.AccessControlInstruction.ForceTransferBetween, 'number');
  t.is(typeof accessControl.AccessControlInstruction.SetLockupEscrowAccount, 'number');
});

test('it exports AccessControlAccount enum values', (t) => {
  t.is(typeof accessControl.AccessControlAccount.AccessControl, 'number');
  t.is(typeof accessControl.AccessControlAccount.WalletRole, 'number');
});
