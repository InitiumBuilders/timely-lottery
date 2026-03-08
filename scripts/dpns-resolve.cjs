/**
 * Dash Platform DPNS Username Resolver
 * Uses gRPC-web transport on seed-1.pshenmic.dev:1443 (confirmed working)
 * Returns { found, label, identityId, dashAddress } for a given username
 */
global.self = globalThis;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { grpc }   = require('@improbable-eng/grpc-web');
const platformPb = require('@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb');
const pbService  = require('@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb_service');
const cbor       = require('cbor');
const _bs58raw   = require('bs58');
const bs58       = _bs58raw.default || _bs58raw;
const dc         = require('@dashevo/dashcore-lib');
const fs         = require('fs');
const path       = require('path');

const TRANSPORT = grpc.FetchReadableStreamTransport({ credentials: 'omit' });
const HOSTS = [
  'https://seed-1.pshenmic.dev:1443',
  'https://seed-1.pshenmic.dev:443',
  'https://seed-1.mainnet.networks.dash.org:443',
  'https://seed-2.mainnet.networks.dash.org:443',
];
const DPNS_ID = Buffer.from(bs58.decode('GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'));

/**
 * Query DPNS documents for a given username
 * Returns raw document bytes or null
 */
async function queryDpns(username, hostIdx = 0) {
  if (hostIdx >= HOSTS.length) return null;
  const HOST = HOSTS[hostIdx];
  
  const req = new platformPb.GetDocumentsRequest();
  const v0  = new platformPb.GetDocumentsRequest.GetDocumentsRequestV0();
  v0.setDataContractId(DPNS_ID);
  v0.setDocumentType('domain');
  v0.setWhere(cbor.encode([
    ['normalizedLabel', '==', username.toLowerCase().replace(/^@/, '')],
    ['normalizedParentDomainName', '==', 'dash'],
  ]));
  v0.setLimit(1);
  v0.setProve(false);
  req.setV0(v0);

  return new Promise(res => {
    grpc.unary(pbService.Platform.getDocuments, {
      request: req, host: HOST, transport: TRANSPORT,
      onEnd: async ({ status, statusMessage, message }) => {
        if (status === 0 && message) {
          const list = message.getV0()?.getDocuments()?.getDocumentsList() || [];
          if (list.length > 0) {
            res({ host: HOST, docBytes: Buffer.from(list[0]) });
          } else {
            res(null); // username not found
          }
        } else {
          // Try next host
          res(await queryDpns(username, hostIdx + 1));
        }
      }
    });
    setTimeout(async () => res(await queryDpns(username, hostIdx + 1)), 10000);
  });
}

/**
 * Get an identity and extract payment address
 */
async function getIdentityAddress(identityIdBytes) {
  const HOST = HOSTS[0];
  const req  = new platformPb.GetIdentityRequest();
  const v0   = new platformPb.GetIdentityRequest.GetIdentityRequestV0();
  v0.setId(identityIdBytes);
  v0.setProve(false);
  req.setV0(v0);

  return new Promise(res => {
    grpc.unary(pbService.Platform.getIdentity, {
      request: req, host: HOST, transport: TRANSPORT,
      onEnd: ({ status, message }) => {
        if (status === 0 && message) {
          const identityBytes = message.getV0()?.getIdentity();
          if (identityBytes) {
            // Extract payment address from identity bytes
            // Identity is CBOR-encoded with publicKeys
            try {
              const identity = cbor.decodeFirstSync(Buffer.from(identityBytes));
              const keys = identity.publicKeys || identity[3] || [];
              // Key 0 is usually AUTHENTICATION, Key 3 is TRANSFER (payment)
              for (const key of keys) {
                const keyData  = key.data   || key[3];
                const keyPurpose = key.purpose || key[1];
                if (keyData && Buffer.from(keyData).length === 33) {
                  const pubkey  = new dc.PublicKey(Buffer.from(keyData));
                  const address = pubkey.toAddress('mainnet').toString();
                  res({ address, purpose: keyPurpose });
                  return;
                }
              }
            } catch(e) { console.error('Identity decode error:', e.message); }
          }
        }
        res(null);
      }
    });
    setTimeout(() => res(null), 10000);
  });
}

/**
 * Main: resolve username → DASH address
 */
async function resolveUsername(username) {
  const clean = username.replace(/^@/, '').toLowerCase();
  console.log(`[DPNS] Resolving @${clean}.dash...`);
  
  const result = await queryDpns(clean);
  if (!result) {
    console.log(`[DPNS] @${clean}.dash not found on mainnet`);
    return { found: false, username: clean };
  }
  
  console.log(`[DPNS] Found document (${result.docBytes.length} bytes) via ${result.host}`);
  
  // Try to extract identityId from document bytes
  // The document is CBOR with $ownerId containing the identity ID
  let identityId = null;
  for (let skip = 0; skip <= 8; skip++) {
    try {
      const doc = cbor.decodeFirstSync(result.docBytes.slice(skip));
      if (doc && typeof doc === 'object') {
        const ownerId = doc['$ownerId'] || doc.ownerId || doc[0];
        if (ownerId && Buffer.isBuffer(ownerId) && ownerId.length === 32) {
          identityId = ownerId;
          console.log(`[DPNS] Identity ID: ${bs58.encode(identityId)} (skip=${skip})`);
          break;
        }
      }
    } catch {}
  }

  if (!identityId) {
    // Return just found=true, username found but can't extract address yet
    return { found: true, username: clean, docBytes: result.docBytes.toString('hex') };
  }

  // Get identity → payment address
  const addrResult = await getIdentityAddress(identityId);
  if (addrResult) {
    console.log(`[DPNS] Payment address: ${addrResult.address} (key purpose: ${addrResult.purpose})`);
    return {
      found:       true,
      username:    clean,
      identityId:  bs58.encode(identityId),
      dashAddress: addrResult.address,
    };
  }

  return { found: true, username: clean, identityId: identityId ? bs58.encode(identityId) : null };
}

// CLI usage
const username = process.argv[2] || 'august';
resolveUsername(username).then(r => {
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(r, null, 2));
}).catch(e => console.error('Error:', e.message));

setTimeout(() => process.exit(0), 30000);
module.exports = { resolveUsername };
