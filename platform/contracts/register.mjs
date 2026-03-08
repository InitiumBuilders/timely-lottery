/**
 * ─── Register Timely.Works Lottery Contract on Dash Platform Mainnet ──────────
 *
 * This is a ONE-TIME setup script. Run it once to register the timelyLottery
 * data contract on Dash Platform. After that, use the returned contract ID
 * in your app config forever.
 *
 * ─── PREREQUISITES ───────────────────────────────────────────────────────────
 *
 *  1. A Dash Platform identity registered on mainnet
 *     → Create one with the Dash mobile wallet or the dash SDK
 *
 *  2. Your identity must be funded with Credits
 *     → Top up by locking DASH via: client.platform.identities.topUp(id, amount)
 *     → Need at least ~0.25 DASH worth of Credits for contract registration
 *
 *  3. Set environment variables before running:
 *
 *       DASH_MNEMONIC="your twelve word mnemonic here"
 *       IDENTITY_ID="base58EncodedIdentityId"
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   cd /path/to/timely-lottery
 *   DASH_MNEMONIC="your words" IDENTITY_ID="4mZm..." node platform/contracts/register.mjs
 *
 * ─── AFTER SUCCESS ───────────────────────────────────────────────────────────
 *
 *   The script outputs a Contract ID. Add it to:
 *     .env.local:    TIMELY_CONTRACT_ID="the_id"
 *     .env.example:  TIMELY_CONTRACT_ID="YOUR_PLATFORM_CONTRACT_ID"
 *
 *   Then update lib/platform.ts (or wherever you query Platform) with this ID.
 *
 * ─── COST ────────────────────────────────────────────────────────────────────
 *
 *   Approximately 0.1–0.5 DASH in Credits. This is a one-time cost.
 *   State transitions (creating documents) cost ~0.00001–0.001 DASH each.
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 *
 *   This file is listed in .gitignore — it loads secrets from env vars.
 *   NEVER hardcode your mnemonic here. NEVER commit with secrets.
 *
 */

'use strict';

// Load .env.local if running locally without env vars set
try {
  const fs = await import('fs');
  const env = fs.readFileSync('.env.local', 'utf-8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* .env.local not found — assume env vars are set externally */ }

const MNEMONIC    = process.env.DASH_MNEMONIC;
const IDENTITY_ID = process.env.IDENTITY_ID;

if (!MNEMONIC || MNEMONIC.split(' ').length < 12) {
  console.error('❌ DASH_MNEMONIC is not set or invalid (needs 12+ words)');
  process.exit(1);
}

if (!IDENTITY_ID) {
  console.error('❌ IDENTITY_ID is not set');
  console.error('   Find your identity ID in the Dash mobile wallet or Platform Explorer');
  process.exit(1);
}

// Dynamic import — dash SDK uses CommonJS internally
const { default: Dash } = await import('dash').catch(() => {
  // Fallback for CommonJS environments
  return { default: require('dash') };
});

// ─── Contract Documents Schema ────────────────────────────────────────────────
import contractDef from './lottery-contract.json' assert { type: 'json' };

// ─── Connect & Register ───────────────────────────────────────────────────────
console.log('\n⚡ Timely.Works — Dash Platform Contract Registration');
console.log('═'.repeat(57));
console.log('  Network:     mainnet');
console.log('  Identity:   ', IDENTITY_ID);
console.log('  Documents:   lottery, result, entry');
console.log('');

const client = new Dash.Client({
  network: 'mainnet',
  wallet: {
    mnemonic: MNEMONIC,
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 1600000,
    },
  },
});

try {
  console.log('🔗 Connecting to Dash Platform DAPI...');

  const identity = await client.platform.identities.get(IDENTITY_ID);
  if (!identity) throw new Error(`Identity not found: ${IDENTITY_ID}`);

  const balance = Number(identity.getBalance());
  console.log('✅ Identity connected');
  console.log('💰 Credits balance:', balance.toLocaleString(), 'credits');
  console.log('   (~' + (balance / 1e11).toFixed(4), 'DASH equivalent)');

  if (balance < 5_000_000) {
    console.warn('\n⚠️  Low credits! Registration requires ~50M+ credits.');
    console.warn('   Top up with: client.platform.identities.topUp(id, duffs)');
    console.warn('   Continuing anyway — will fail if insufficient...\n');
  }

  console.log('\n📝 Creating contract from schema...');
  const contract = await client.platform.contracts.create(
    contractDef.documents,
    identity
  );

  console.log('📡 Broadcasting dataContractCreate state transition...');
  console.log('   ⏳ Waiting for Platform consensus (3–15 seconds)...');

  await client.platform.contracts.publish(contract, identity);

  const contractId = contract.toJSON().id;

  console.log('\n🎉 CONTRACT REGISTERED SUCCESSFULLY!');
  console.log('═'.repeat(57));
  console.log('');
  console.log('  CONTRACT ID:', contractId);
  console.log('');
  console.log('📋 Save this ID — you will need it in your application:');
  console.log('');
  console.log(`  # Add to .env.local`);
  console.log(`  TIMELY_CONTRACT_ID="${contractId}"`);
  console.log('');
  console.log('🔍 Verify on Dash Platform Explorer:');
  console.log(`  https://platform-explorer.pshenmic.dev/dataContract/${contractId}`);
  console.log('');
  console.log('📖 Next: Update lib/platform.ts with this contract ID');
  console.log('   and enable Platform document syncing in the worker.');
  console.log('');

} catch (err) {
  console.error('\n❌ Registration failed:', err.message);
  if (err.code) console.error('   Error code:', err.code);
  if (err.message.includes('balance') || err.message.includes('credits')) {
    console.error('\n💡 Fix: Top up your identity with more Credits:');
    console.error('   const id = await client.platform.identities.get(IDENTITY_ID);');
    console.error('   await client.platform.identities.topUp(id.getId(), 200000000); // 0.2 DASH');
  }
  process.exit(1);
} finally {
  await client.disconnect().catch(() => {});
}
