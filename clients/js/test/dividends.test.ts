/**
 * Unit tests for dividends module
 */

import test from 'ava';
import { address } from '@solana/kit';
import { dividends } from '../src';

// ============================================================================
// Program Address Tests
// ============================================================================

test('it exports the correct program address', (t) => {
  t.is(
    dividends.DIVIDENDS_PROGRAM_ADDRESS as string,
    'FUjkkUVKa9Pofs5mBdiYQe2cBVwzrhX8SunAZhGXRkog'
  );
});

// ============================================================================
// Account Discriminator Tests
// ============================================================================

test('it has the correct MerkleDistributor discriminator', (t) => {
  t.deepEqual(
    dividends.MERKLE_DISTRIBUTOR_DISCRIMINATOR,
    new Uint8Array([77, 119, 139, 70, 84, 247, 12, 26])
  );
});

test('it has the correct ClaimStatus discriminator', (t) => {
  t.deepEqual(
    dividends.CLAIM_STATUS_DISCRIMINATOR,
    new Uint8Array([22, 183, 249, 157, 247, 95, 150, 96])
  );
});

test('it has the correct Reclaimer discriminator', (t) => {
  t.deepEqual(
    dividends.RECLAIMER_DISCRIMINATOR,
    new Uint8Array([191, 103, 233, 218, 91, 3, 158, 191])
  );
});

// ============================================================================
// Account Codec Tests
// ============================================================================

test('it provides MerkleDistributor codec functions', (t) => {
  const encoder = dividends.getMerkleDistributorEncoder();
  const decoder = dividends.getMerkleDistributorDecoder();
  const codec = dividends.getMerkleDistributorCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides ClaimStatus codec functions', (t) => {
  const encoder = dividends.getClaimStatusEncoder();
  const decoder = dividends.getClaimStatusDecoder();
  const codec = dividends.getClaimStatusCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it provides Reclaimer codec functions', (t) => {
  const encoder = dividends.getReclaimerEncoder();
  const decoder = dividends.getReclaimerDecoder();
  const codec = dividends.getReclaimerCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

// ============================================================================
// Instruction Discriminator Tests
// ============================================================================

test('it has the correct NewDistributor discriminator', (t) => {
  t.deepEqual(
    dividends.NEW_DISTRIBUTOR_DISCRIMINATOR,
    new Uint8Array([32, 139, 112, 171, 0, 2, 225, 155])
  );
});

test('it has the correct FundDividends discriminator', (t) => {
  t.deepEqual(
    dividends.FUND_DIVIDENDS_DISCRIMINATOR,
    new Uint8Array([80, 231, 140, 123, 85, 15, 70, 166])
  );
});

test('it has the correct Claim discriminator', (t) => {
  t.deepEqual(
    dividends.CLAIM_DISCRIMINATOR,
    new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210])
  );
});

test('it has the correct Pause discriminator', (t) => {
  t.deepEqual(
    dividends.PAUSE_DISCRIMINATOR,
    new Uint8Array([211, 22, 221, 251, 74, 121, 193, 47])
  );
});

test('it has the correct ReclaimDividends discriminator', (t) => {
  t.deepEqual(
    dividends.RECLAIM_DIVIDENDS_DISCRIMINATOR,
    new Uint8Array([32, 208, 208, 161, 89, 49, 92, 72])
  );
});

test('it has the correct ProposeReclaimer discriminator', (t) => {
  t.deepEqual(
    dividends.PROPOSE_RECLAIMER_DISCRIMINATOR,
    new Uint8Array([191, 148, 66, 41, 132, 154, 25, 208])
  );
});

test('it has the correct AcceptReclaimerOwnership discriminator', (t) => {
  t.deepEqual(
    dividends.ACCEPT_RECLAIMER_OWNERSHIP_DISCRIMINATOR,
    new Uint8Array([211, 214, 76, 233, 74, 143, 206, 28])
  );
});

// ============================================================================
// Instruction Data Codec Tests
// ============================================================================

test('it provides NewDistributor instruction data codecs', (t) => {
  const encoder = dividends.getNewDistributorInstructionDataEncoder();
  const decoder = dividends.getNewDistributorInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides FundDividends instruction data codecs', (t) => {
  const encoder = dividends.getFundDividendsInstructionDataEncoder();
  const decoder = dividends.getFundDividendsInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides Claim instruction data codecs', (t) => {
  const encoder = dividends.getClaimInstructionDataEncoder();
  const decoder = dividends.getClaimInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

test('it provides ReclaimDividends instruction data codecs', (t) => {
  const encoder = dividends.getReclaimDividendsInstructionDataEncoder();
  const decoder = dividends.getReclaimDividendsInstructionDataDecoder();

  t.truthy(encoder);
  t.truthy(decoder);
});

// ============================================================================
// Instruction Identification Tests
// ============================================================================

test('it identifies NewDistributor instruction', (t) => {
  const data = new Uint8Array([32, 139, 112, 171, 0, 2, 225, 155, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.NewDistributor);
});

test('it identifies FundDividends instruction', (t) => {
  const data = new Uint8Array([80, 231, 140, 123, 85, 15, 70, 166, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.FundDividends);
});

test('it identifies Claim instruction', (t) => {
  const data = new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.Claim);
});

test('it identifies Pause instruction', (t) => {
  const data = new Uint8Array([211, 22, 221, 251, 74, 121, 193, 47, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.Pause);
});

test('it identifies ReclaimDividends instruction', (t) => {
  const data = new Uint8Array([32, 208, 208, 161, 89, 49, 92, 72, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.ReclaimDividends);
});

test('it identifies ProposeReclaimer instruction', (t) => {
  const data = new Uint8Array([191, 148, 66, 41, 132, 154, 25, 208, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.ProposeReclaimer);
});

test('it identifies AcceptReclaimerOwnership instruction', (t) => {
  const data = new Uint8Array([211, 214, 76, 233, 74, 143, 206, 28, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsInstruction(data);
  t.is(identified, dividends.DividendsInstruction.AcceptReclaimerOwnership);
});

// ============================================================================
// Account Identification Tests
// ============================================================================

test('it identifies MerkleDistributor account', (t) => {
  const data = new Uint8Array([77, 119, 139, 70, 84, 247, 12, 26, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsAccount(data);
  t.is(identified, dividends.DividendsAccount.MerkleDistributor);
});

test('it identifies ClaimStatus account', (t) => {
  const data = new Uint8Array([22, 183, 249, 157, 247, 95, 150, 96, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsAccount(data);
  t.is(identified, dividends.DividendsAccount.ClaimStatus);
});

test('it identifies Reclaimer account', (t) => {
  const data = new Uint8Array([191, 103, 233, 218, 91, 3, 158, 191, 0, 0, 0, 0]);
  const identified = dividends.identifyDividendsAccount(data);
  t.is(identified, dividends.DividendsAccount.Reclaimer);
});

// ============================================================================
// Enum Tests
// ============================================================================

test('it exports DividendsInstruction enum values', (t) => {
  t.is(typeof dividends.DividendsInstruction.AcceptReclaimerOwnership, 'number');
  t.is(typeof dividends.DividendsInstruction.Claim, 'number');
  t.is(typeof dividends.DividendsInstruction.FundDividends, 'number');
  t.is(typeof dividends.DividendsInstruction.NewDistributor, 'number');
  t.is(typeof dividends.DividendsInstruction.Pause, 'number');
  t.is(typeof dividends.DividendsInstruction.ProposeReclaimer, 'number');
  t.is(typeof dividends.DividendsInstruction.ReclaimDividends, 'number');
});

test('it exports DividendsAccount enum values', (t) => {
  t.is(typeof dividends.DividendsAccount.AccessControl, 'number');
  t.is(typeof dividends.DividendsAccount.ClaimStatus, 'number');
  t.is(typeof dividends.DividendsAccount.MerkleDistributor, 'number');
  t.is(typeof dividends.DividendsAccount.Reclaimer, 'number');
  t.is(typeof dividends.DividendsAccount.WalletRole, 'number');
});

// ============================================================================
// Error Code Tests
// ============================================================================

test('it exports error codes', (t) => {
  t.is(typeof dividends.DIVIDENDS_ERROR__UNAUTHORIZED, 'number');
});

test('it provides error messages for error codes', (t) => {
  const message = dividends.getDividendsErrorMessage(
    dividends.DIVIDENDS_ERROR__UNAUTHORIZED
  );
  t.is(typeof message, 'string');
  t.true(message.length > 0);
});

// ============================================================================
// Event Type Tests
// ============================================================================

test('it exports ClaimedEvent type codec functions', (t) => {
  const encoder = dividends.getClaimedEventEncoder();
  const decoder = dividends.getClaimedEventDecoder();
  const codec = dividends.getClaimedEventCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it exports FundedEvent type codec functions', (t) => {
  const encoder = dividends.getFundedEventEncoder();
  const decoder = dividends.getFundedEventDecoder();
  const codec = dividends.getFundedEventCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

test('it exports ReclaimedEvent type codec functions', (t) => {
  const encoder = dividends.getReclaimedEventEncoder();
  const decoder = dividends.getReclaimedEventDecoder();
  const codec = dividends.getReclaimedEventCodec();

  t.truthy(encoder);
  t.truthy(decoder);
  t.truthy(codec);
});

