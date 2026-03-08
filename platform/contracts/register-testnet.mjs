#!/usr/bin/env node
// ─── Timely.Works — Testnet Contract Registration ─────────────────────────────
//
// Registers the timelyLottery data contract on Dash TESTNET.
// Use this to validate the schema before mainnet deployment.
//
// Usage:
//   node platform/contracts/register-testnet.mjs
//
// Environment (optional — will generate fresh wallet if not set):
//   DASH_TESTNET_MNEMONIC   — HD wallet mnemonic for testnet
//   DASH_TESTNET_IDENTITY   — Existing testnet identity ID (skips creation)
//
// Steps if running fresh:
//   1. Run this script — it will print a testnet address
//   2. Fund it at https://faucet.testnet.networks.dash.org/
//   3. Run again — it will register the contract and print the contract ID
//   4. Copy the contract ID to TIMELY_CONTRACT_ID in your .env.local (testnet)
//
// ⚠️  TESTNET ONLY — no real funds, no real identity

import { createRequire } from 'module';
import { readFileSync }   from 'fs';
import { fileURLToPath }  from 'url';
import { dirname, join }  from 'path';

const require  = createRequire(import.meta.url);
const __dir    = dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(readFileSync(join(__dir, 'lottery-contract.json'), 'utf8'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function banner(msg) {
  console.log('\n' + '─'.repeat(60));
  console.log(msg);
  console.log('─'.repeat(60) + '\n');
}

function generateMnemonic() {
  // Use Dash SDK's built-in mnemonic generation
  try {
    const Dash = require('dash');
    // Dash SDK bundles dashcore-lib which includes Mnemonic
    const { Mnemonic } = require('@dashevo/dashcore-lib');
    return new Mnemonic().toString();
  } catch {
    // Fallback: use standard BIP39 wordlist (12 random words)
    // This is safe for testnet only — never use for mainnet without proper entropy
    const words = [
      'abandon','ability','able','about','above','absent','absorb','abstract',
      'absurd','abuse','access','accident','account','accuse','achieve','acid',
      'acoustic','acquire','across','act','action','actor','actress','actual',
      'adapt','add','addict','address','adjust','admit','adult','advance',
      'advice','aerobic','afford','afraid','again','age','agent','agree',
      'ahead','aim','air','airport','aisle','alarm','album','alcohol',
    ];
    const entropy = [];
    for (let i = 0; i < 12; i++) {
      entropy.push(words[Math.floor(Math.random() * words.length)]);
    }
    return entropy.join(' ');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner('🔵 Timely.Works — Testnet Contract Registration');

  // Load Dash SDK
  let Dash;
  try {
    Dash = require('dash');
  } catch {
    console.error('❌ Could not load `dash` npm package. Run: npm install dash');
    process.exit(1);
  }

  // Determine mnemonic
  const envMnemonic = process.env.DASH_TESTNET_MNEMONIC;
  const mnemonic    = envMnemonic || generateMnemonic();
  const isNew       = !envMnemonic;

  if (isNew) {
    console.log('🆕 No DASH_TESTNET_MNEMONIC found — generated a fresh wallet.\n');
    console.log('⚠️  SAVE THIS MNEMONIC (testnet only — no real funds):');
    console.log(`   ${mnemonic}\n`);
    console.log('Set it in your environment to reuse this wallet:');
    console.log(`   export DASH_TESTNET_MNEMONIC="${mnemonic}"\n`);
  } else {
    console.log('✅ Using DASH_TESTNET_MNEMONIC from environment.\n');
  }

  // Init client on testnet
  console.log('⏳ Connecting to Dash TESTNET...');
  const client = new Dash.Client({
    network: 'testnet',
    wallet: {
      mnemonic,
      unsafeOptions: { skipSynchronizationBeforeHeight: 800000 },
    },
  });

  try {
    // Get wallet account + address
    const account = await client.getWalletAccount();
    const address = account.getUnusedAddress().address;

    console.log('✅ Connected to testnet.');
    console.log(`📬 Testnet wallet address: ${address}\n`);

    // Check balance
    const balanceSat = account.getConfirmedBalance();
    const balanceDash = balanceSat / 1e8;
    console.log(`💰 Balance: ${balanceDash.toFixed(8)} tDASH (${balanceSat} satoshis)`);

    if (balanceSat < 10000) {
      banner('🚰 FUND YOUR TESTNET WALLET');
      console.log('Your testnet wallet needs tDASH to register the contract.');
      console.log('');
      console.log('1. Visit the faucet:');
      console.log('   https://faucet.testnet.networks.dash.org/');
      console.log('');
      console.log('2. Enter your address:');
      console.log(`   ${address}`);
      console.log('');
      console.log('3. Request tDASH (usually takes 1-2 minutes to confirm)');
      console.log('');
      console.log('4. Then run this script again:');
      console.log(`   DASH_TESTNET_MNEMONIC="${mnemonic}" node platform/contracts/register-testnet.mjs`);
      console.log('');
      console.log('─'.repeat(60));
      await client.disconnect();
      process.exit(0);
    }

    // ── Check for existing identity ──────────────────────────────────────────
    let identity;
    const envIdentityId = process.env.DASH_TESTNET_IDENTITY;

    if (envIdentityId) {
      console.log(`\n⏳ Fetching existing identity: ${envIdentityId}`);
      identity = await client.platform.identities.get(envIdentityId);
      console.log('✅ Identity loaded.');
    } else {
      console.log('\n⏳ Creating a new Dash Platform identity on testnet...');
      identity = await client.platform.identities.register();
      console.log(`✅ Identity created: ${identity.getId()}`);
      console.log('');
      console.log('Save this identity ID to skip creation next time:');
      console.log(`   export DASH_TESTNET_IDENTITY="${identity.getId()}"`);
    }

    // ── Register the data contract ───────────────────────────────────────────
    console.log('\n⏳ Registering timelyLottery data contract on testnet...');

    // Build contract from the schema file (remove non-SDK fields)
    const schema = {};
    for (const [docType, def] of Object.entries(CONTRACT.documents)) {
      schema[docType] = def;
    }

    const dataContract = await client.platform.contracts.create(schema, identity);
    await client.platform.contracts.publish(dataContract, identity);

    const contractId = dataContract.getId().toString();

    banner('✅ CONTRACT REGISTERED ON TESTNET');
    console.log('Contract ID:');
    console.log(`   ${contractId}`);
    console.log('');
    console.log('Explore it:');
    console.log(`   https://platform-explorer.pshenmic.dev/dataContract/${contractId}`);
    console.log('');
    console.log('Set in your .env.local (for testnet):');
    console.log(`   TIMELY_CONTRACT_ID="${contractId}"`);
    console.log(`   NEXT_PUBLIC_TIMELY_CONTRACT_ID="${contractId}"`);
    console.log(`   DASH_NETWORK="testnet"`);
    console.log(`   DASH_MNEMONIC="${mnemonic}"`);
    console.log(`   DASH_IDENTITY_ID="${identity.getId()}"`);
    console.log('');
    console.log('─'.repeat(60));
    console.log('🎉 Testnet registration complete! When ready for mainnet,');
    console.log('   run: node platform/contracts/register.mjs');
    console.log('─'.repeat(60));

  } catch (err) {
    console.error('\n❌ Registration failed:', err?.message || err);
    console.error('');
    console.error('Common causes:');
    console.error('  - Insufficient tDASH balance (fund at the faucet above)');
    console.error('  - Testnet network temporarily unavailable');
    console.error('  - Schema validation error (check lottery-contract.json)');
    console.error('');
    console.error('Full error:', err);
    process.exit(1);
  } finally {
    await client.disconnect().catch(() => {});
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
