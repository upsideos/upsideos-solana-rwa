/**
 * Unit tests for tokenlock module
 */

import test from 'ava';
import { address } from '@solana/kit';
import { tokenlock } from '../src';

// ============================================================================
// Program Address Tests
// ============================================================================

test('it exports the correct program address', (t) => {
  t.is(
    tokenlock.TOKENLOCK_PROGRAM_ADDRESS as string,
    'AoodM6rkg968933giHnigMEwp9kiGi68ZEx9bPqk71Gt'
  );
});

// ============================================================================
// Account Discriminator Tests
// ============================================================================

test('it has the correct TokenLockData discriminator', (t) => {
  t.deepEqual(
    tokenlock.TOKEN_LOCK_DATA_DISCRIMINATOR,
    new Uint8Array([21, 223, 206, 135, 104, 58, 210, 120])
  );
});

test('it has the correct TimelockData discriminator', (t) => {
  t.deepEqual(
    tokenlock.TIMELOCK_DATA_DISCRIMINATOR,
    new Uint8Array([166, 255, 48, 254, 36, 155, 55, 132])
  );
});

// ============================================================================
// Account Codec Tests
// ============================================================================

test('it provides TokenLockData codec functions', (t) => {
  const encoder = tokenlock.getTokenLockDataEncoder();
  const decoder = tokenlock.getTokenLockDataDecoder();
  const codec = tokenlock.getTokenLockDataCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides TimelockData codec functions', (t) => {
  const encoder = tokenlock.getTimelockDataEncoder();
  const decoder = tokenlock.getTimelockDataDecoder();
  const codec = tokenlock.getTimelockDataCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

// ============================================================================
// Instruction Discriminator Tests
// ============================================================================

test('it has the correct InitializeTokenlock discriminator', (t) => {
  t.deepEqual(
    tokenlock.INITIALIZE_TOKENLOCK_DISCRIMINATOR,
    new Uint8Array([7, 16, 90, 167, 17, 36, 129, 147])
  );
});

test('it has the correct InitializeTimelock discriminator', (t) => {
  t.deepEqual(
    tokenlock.INITIALIZE_TIMELOCK_DISCRIMINATOR,
    new Uint8Array([47, 125, 243, 32, 170, 86, 24, 243])
  );
});

test('it has the correct CreateReleaseSchedule discriminator', (t) => {
  t.deepEqual(
    tokenlock.CREATE_RELEASE_SCHEDULE_DISCRIMINATOR,
    new Uint8Array([244, 168, 39, 240, 234, 71, 104, 108])
  );
});

test('it has the correct MintReleaseSchedule discriminator', (t) => {
  t.deepEqual(
    tokenlock.MINT_RELEASE_SCHEDULE_DISCRIMINATOR,
    new Uint8Array([124, 157, 84, 33, 123, 128, 222, 184])
  );
});

test('it has the correct Transfer discriminator', (t) => {
  t.deepEqual(
    tokenlock.TRANSFER_DISCRIMINATOR,
    new Uint8Array([163, 52, 200, 231, 140, 3, 69, 186])
  );
});

test('it has the correct TransferTimelock discriminator', (t) => {
  t.deepEqual(
    tokenlock.TRANSFER_TIMELOCK_DISCRIMINATOR,
    new Uint8Array([197, 69, 160, 26, 96, 251, 228, 192])
  );
});

test('it has the correct CancelTimelock discriminator', (t) => {
  t.deepEqual(
    tokenlock.CANCEL_TIMELOCK_DISCRIMINATOR,
    new Uint8Array([158, 180, 47, 81, 133, 231, 168, 238])
  );
});

// ============================================================================
// Instruction Data Codec Tests
// ============================================================================

test('it provides InitializeTokenlock instruction data codecs', (t) => {
  const encoder = tokenlock.getInitializeTokenlockInstructionDataEncoder();
  const decoder = tokenlock.getInitializeTokenlockInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides CreateReleaseSchedule instruction data codecs', (t) => {
  const encoder = tokenlock.getCreateReleaseScheduleInstructionDataEncoder();
  const decoder = tokenlock.getCreateReleaseScheduleInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides MintReleaseSchedule instruction data codecs', (t) => {
  const encoder = tokenlock.getMintReleaseScheduleInstructionDataEncoder();
  const decoder = tokenlock.getMintReleaseScheduleInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides Transfer instruction data codecs', (t) => {
  const encoder = tokenlock.getTransferInstructionDataEncoder();
  const decoder = tokenlock.getTransferInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides CancelTimelock instruction data codecs', (t) => {
  const encoder = tokenlock.getCancelTimelockInstructionDataEncoder();
  const decoder = tokenlock.getCancelTimelockInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

// ============================================================================
// Instruction Identification Tests
// ============================================================================

test('it identifies InitializeTokenlock instruction', (t) => {
  const data = new Uint8Array([7, 16, 90, 167, 17, 36, 129, 147, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.InitializeTokenlock);
});

test('it identifies InitializeTimelock instruction', (t) => {
  const data = new Uint8Array([47, 125, 243, 32, 170, 86, 24, 243, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.InitializeTimelock);
});

test('it identifies CreateReleaseSchedule instruction', (t) => {
  const data = new Uint8Array([244, 168, 39, 240, 234, 71, 104, 108, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.CreateReleaseSchedule);
});

test('it identifies MintReleaseSchedule instruction', (t) => {
  const data = new Uint8Array([124, 157, 84, 33, 123, 128, 222, 184, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.MintReleaseSchedule);
});

test('it identifies Transfer instruction', (t) => {
  const data = new Uint8Array([163, 52, 200, 231, 140, 3, 69, 186, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.Transfer);
});

test('it identifies TransferTimelock instruction', (t) => {
  const data = new Uint8Array([197, 69, 160, 26, 96, 251, 228, 192, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.TransferTimelock);
});

test('it identifies CancelTimelock instruction', (t) => {
  const data = new Uint8Array([158, 180, 47, 81, 133, 231, 168, 238, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockInstruction(data);
  t.is(identified, tokenlock.TokenlockInstruction.CancelTimelock);
});

// ============================================================================
// Account Identification Tests
// ============================================================================

test('it identifies TokenLockData account', (t) => {
  const data = new Uint8Array([21, 223, 206, 135, 104, 58, 210, 120, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockAccount(data);
  t.is(identified, tokenlock.TokenlockAccount.TokenLockData);
});

test('it identifies TimelockData account', (t) => {
  const data = new Uint8Array([166, 255, 48, 254, 36, 155, 55, 132, 0, 0, 0, 0]);
  const identified = tokenlock.identifyTokenlockAccount(data);
  t.is(identified, tokenlock.TokenlockAccount.TimelockData);
});

// ============================================================================
// Enum Tests
// ============================================================================

test('it exports TokenlockInstruction enum values', (t) => {
  t.is(typeof tokenlock.TokenlockInstruction.CancelTimelock, 'number');
  t.is(typeof tokenlock.TokenlockInstruction.CreateReleaseSchedule, 'number');
  t.is(typeof tokenlock.TokenlockInstruction.InitializeTimelock, 'number');
  t.is(typeof tokenlock.TokenlockInstruction.InitializeTokenlock, 'number');
  t.is(typeof tokenlock.TokenlockInstruction.MintReleaseSchedule, 'number');
  t.is(typeof tokenlock.TokenlockInstruction.Transfer, 'number');
  t.is(typeof tokenlock.TokenlockInstruction.TransferTimelock, 'number');
});

test('it exports TokenlockAccount enum values', (t) => {
  t.is(typeof tokenlock.TokenlockAccount.AccessControl, 'number');
  t.is(typeof tokenlock.TokenlockAccount.TimelockData, 'number');
  t.is(typeof tokenlock.TokenlockAccount.TokenLockData, 'number');
  t.is(typeof tokenlock.TokenlockAccount.TransferRestrictionData, 'number');
  t.is(typeof tokenlock.TokenlockAccount.WalletRole, 'number');
});

// ============================================================================
// Error Code Tests
// ============================================================================

test('it exports error codes', (t) => {
  t.is(typeof tokenlock.TOKENLOCK_ERROR__UNAUTHORIZED, 'number');
});

test('it provides error messages for error codes', (t) => {
  const message = tokenlock.getTokenlockErrorMessage(
    tokenlock.TOKENLOCK_ERROR__UNAUTHORIZED
  );
  t.is(typeof message, 'string');
  t.true(message.length > 0);
});

