/**
 * Unit tests for transfer_restrictions module
 */

import test from 'ava';
import { address } from '@solana/kit';
import { transferRestrictions } from '../src';

// ============================================================================
// Program Address Tests
// ============================================================================

test('it exports the correct program address', (t) => {
  t.is(
    transferRestrictions.TRANSFER_RESTRICTIONS_PROGRAM_ADDRESS as string,
    '6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ'
  );
});

// ============================================================================
// Account Discriminator Tests
// ============================================================================

test('it has the correct TransferRestrictionData discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.TRANSFER_RESTRICTION_DATA_DISCRIMINATOR,
    new Uint8Array([166, 184, 205, 98, 165, 224, 174, 148])
  );
});

test('it has the correct TransferRestrictionGroup discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.TRANSFER_RESTRICTION_GROUP_DISCRIMINATOR,
    new Uint8Array([61, 120, 96, 96, 113, 210, 205, 223])
  );
});

test('it has the correct TransferRestrictionHolder discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.TRANSFER_RESTRICTION_HOLDER_DISCRIMINATOR,
    new Uint8Array([196, 226, 112, 46, 157, 122, 48, 157])
  );
});

test('it has the correct HolderGroup discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.HOLDER_GROUP_DISCRIMINATOR,
    new Uint8Array([136, 231, 252, 48, 92, 187, 25, 164])
  );
});

test('it has the correct SecurityAssociatedAccount discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.SECURITY_ASSOCIATED_ACCOUNT_DISCRIMINATOR,
    new Uint8Array([68, 169, 137, 56, 226, 21, 69, 124])
  );
});

test('it has the correct TransferRule discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.TRANSFER_RULE_DISCRIMINATOR,
    new Uint8Array([200, 231, 114, 91, 84, 241, 109, 172])
  );
});

// ============================================================================
// Account Codec Tests
// ============================================================================

test('it provides TransferRestrictionData codec functions', (t) => {
  const encoder = transferRestrictions.getTransferRestrictionDataEncoder();
  const decoder = transferRestrictions.getTransferRestrictionDataDecoder();
  const codec = transferRestrictions.getTransferRestrictionDataCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides TransferRestrictionGroup codec functions', (t) => {
  const encoder = transferRestrictions.getTransferRestrictionGroupEncoder();
  const decoder = transferRestrictions.getTransferRestrictionGroupDecoder();
  const codec = transferRestrictions.getTransferRestrictionGroupCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides TransferRestrictionHolder codec functions', (t) => {
  const encoder = transferRestrictions.getTransferRestrictionHolderEncoder();
  const decoder = transferRestrictions.getTransferRestrictionHolderDecoder();
  const codec = transferRestrictions.getTransferRestrictionHolderCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides HolderGroup codec functions', (t) => {
  const encoder = transferRestrictions.getHolderGroupEncoder();
  const decoder = transferRestrictions.getHolderGroupDecoder();
  const codec = transferRestrictions.getHolderGroupCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides SecurityAssociatedAccount codec functions', (t) => {
  const encoder = transferRestrictions.getSecurityAssociatedAccountEncoder();
  const decoder = transferRestrictions.getSecurityAssociatedAccountDecoder();
  const codec = transferRestrictions.getSecurityAssociatedAccountCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides TransferRule codec functions', (t) => {
  const encoder = transferRestrictions.getTransferRuleEncoder();
  const decoder = transferRestrictions.getTransferRuleDecoder();
  const codec = transferRestrictions.getTransferRuleCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

// ============================================================================
// Instruction Discriminator Tests
// ============================================================================

test('it has the correct InitializeTransferRestrictionsData discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.INITIALIZE_TRANSFER_RESTRICTIONS_DATA_DISCRIMINATOR,
    new Uint8Array([214, 241, 131, 83, 138, 120, 171, 133])
  );
});

test('it has the correct InitializeTransferRestrictionGroup discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.INITIALIZE_TRANSFER_RESTRICTION_GROUP_DISCRIMINATOR,
    new Uint8Array([62, 223, 111, 8, 59, 225, 31, 108])
  );
});

test('it has the correct InitializeTransferRestrictionHolder discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.INITIALIZE_TRANSFER_RESTRICTION_HOLDER_DISCRIMINATOR,
    new Uint8Array([184, 97, 123, 132, 240, 132, 91, 118])
  );
});

test('it has the correct InitializeTransferRule discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.INITIALIZE_TRANSFER_RULE_DISCRIMINATOR,
    new Uint8Array([24, 28, 16, 18, 72, 26, 87, 49])
  );
});

test('it has the correct SetAllowTransferRule discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.SET_ALLOW_TRANSFER_RULE_DISCRIMINATOR,
    new Uint8Array([4, 83, 246, 172, 106, 193, 31, 116])
  );
});

test('it has the correct SetHolderMax discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.SET_HOLDER_MAX_DISCRIMINATOR,
    new Uint8Array([254, 104, 250, 53, 13, 151, 2, 161])
  );
});

test('it has the correct SetHolderGroupMax discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.SET_HOLDER_GROUP_MAX_DISCRIMINATOR,
    new Uint8Array([83, 33, 238, 145, 212, 216, 16, 197])
  );
});

test('it has the correct Pause discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.PAUSE_DISCRIMINATOR,
    new Uint8Array([211, 22, 221, 251, 74, 121, 193, 47])
  );
});

test('it has the correct EnforceTransferRestrictions discriminator', (t) => {
  t.deepEqual(
    transferRestrictions.ENFORCE_TRANSFER_RESTRICTIONS_DISCRIMINATOR,
    new Uint8Array([77, 50, 36, 109, 250, 175, 122, 22])
  );
});

// ============================================================================
// Instruction Identification Tests
// ============================================================================

test('it identifies InitializeTransferRestrictionsData instruction', (t) => {
  const data = new Uint8Array([214, 241, 131, 83, 138, 120, 171, 133, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsInstruction(data);
  t.is(identified, transferRestrictions.TransferRestrictionsInstruction.InitializeTransferRestrictionsData);
});

test('it identifies InitializeTransferRestrictionGroup instruction', (t) => {
  const data = new Uint8Array([62, 223, 111, 8, 59, 225, 31, 108, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsInstruction(data);
  t.is(identified, transferRestrictions.TransferRestrictionsInstruction.InitializeTransferRestrictionGroup);
});

test('it identifies EnforceTransferRestrictions instruction', (t) => {
  const data = new Uint8Array([77, 50, 36, 109, 250, 175, 122, 22, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsInstruction(data);
  t.is(identified, transferRestrictions.TransferRestrictionsInstruction.EnforceTransferRestrictions);
});

test('it identifies Pause instruction', (t) => {
  const data = new Uint8Array([211, 22, 221, 251, 74, 121, 193, 47, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsInstruction(data);
  t.is(identified, transferRestrictions.TransferRestrictionsInstruction.Pause);
});

// ============================================================================
// Account Identification Tests
// ============================================================================

test('it identifies TransferRestrictionData account', (t) => {
  const data = new Uint8Array([166, 184, 205, 98, 165, 224, 174, 148, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsAccount(data);
  t.is(identified, transferRestrictions.TransferRestrictionsAccount.TransferRestrictionData);
});

test('it identifies TransferRestrictionGroup account', (t) => {
  const data = new Uint8Array([61, 120, 96, 96, 113, 210, 205, 223, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsAccount(data);
  t.is(identified, transferRestrictions.TransferRestrictionsAccount.TransferRestrictionGroup);
});

test('it identifies TransferRestrictionHolder account', (t) => {
  const data = new Uint8Array([196, 226, 112, 46, 157, 122, 48, 157, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsAccount(data);
  t.is(identified, transferRestrictions.TransferRestrictionsAccount.TransferRestrictionHolder);
});

test('it identifies HolderGroup account', (t) => {
  const data = new Uint8Array([136, 231, 252, 48, 92, 187, 25, 164, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsAccount(data);
  t.is(identified, transferRestrictions.TransferRestrictionsAccount.HolderGroup);
});

test('it identifies SecurityAssociatedAccount account', (t) => {
  const data = new Uint8Array([68, 169, 137, 56, 226, 21, 69, 124, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsAccount(data);
  t.is(identified, transferRestrictions.TransferRestrictionsAccount.SecurityAssociatedAccount);
});

test('it identifies TransferRule account', (t) => {
  const data = new Uint8Array([200, 231, 114, 91, 84, 241, 109, 172, 0, 0, 0, 0]);
  const identified = transferRestrictions.identifyTransferRestrictionsAccount(data);
  t.is(identified, transferRestrictions.TransferRestrictionsAccount.TransferRule);
});

// ============================================================================
// Enum Tests
// ============================================================================

test('it exports TransferRestrictionsInstruction enum values', (t) => {
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.EnforceTransferRestrictions, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.ExecuteTransaction, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeDefaultSecurityAccounts, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeExtraAccountMetaList, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeHolderGroup, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeSecurityAssociatedAccount, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeTransferRestrictionGroup, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeTransferRestrictionHolder, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeTransferRestrictionsData, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.InitializeTransferRule, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.Pause, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.RevokeHolder, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.RevokeHolderGroup, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.RevokeSecurityAssociatedAccount, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.SetAddressPermission, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.SetAllowTransferRule, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.SetHolderGroupMax, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.SetHolderMax, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.SetLockupEscrowAccount, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsInstruction.UpdateWalletGroup, 'number');
});

test('it exports TransferRestrictionsAccount enum values', (t) => {
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.AccessControl, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.HolderGroup, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.SecurityAssociatedAccount, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.TransferRestrictionData, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.TransferRestrictionGroup, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.TransferRestrictionHolder, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.TransferRule, 'number');
  t.is(typeof transferRestrictions.TransferRestrictionsAccount.WalletRole, 'number');
});

// ============================================================================
// Error Code Tests
// ============================================================================

test('it exports error codes', (t) => {
  t.is(typeof transferRestrictions.TRANSFER_RESTRICTIONS_ERROR__UNAUTHORIZED, 'number');
});

test('it provides error messages for error codes', (t) => {
  const message = transferRestrictions.getTransferRestrictionsErrorMessage(
    transferRestrictions.TRANSFER_RESTRICTIONS_ERROR__UNAUTHORIZED
  );
  t.is(typeof message, 'string');
  t.true(message.length > 0);
});

