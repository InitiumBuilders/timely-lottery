/**
 * DPNS Username Resolver using gRPC-web + native Node.js fetch
 * Uses @improbable-eng/grpc-web with FetchReadableStreamTransport
 * Port 443 (HTTPS) confirmed working on Dash mainnet seed nodes
 */
const { grpc } = require('../node_modules/@improbable-eng/grpc-web');
const { PlatformPromiseClient } = require('../node_modules/@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb_service');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// The web PlatformPromiseClient needs grpc.unary to work
// Let's use low-level grpc.unary from @improbable-eng/grpc-web

// First check what methods platform_pb has
const platformPb = require('../node_modules/@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb');
const pbService  = require('../node_modules/@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb_service');

// Build GetDocumentsRequest for DPNS lookup
// DPNS contract ID on mainnet (base58 decode)
const dc = require('../node_modules/@dashevo/dashcore-lib');
const DPNS_CONTRACT_ID = dc.Base58.decode('GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec');

const username = process.argv[2] || 'august';
console.log(`Resolving @${username}.dash via gRPC-web on port 443...`);

const req = new platformPb.GetDocumentsRequest();
const v0  = new platformPb.GetDocumentsRequest.GetDocumentsRequestV0();
v0.setDataContractId(DPNS_CONTRACT_ID);
v0.setDocumentType('domain');
v0.setLimit(1);

// CBOR encode the where clause: [[normalizedLabel, ==, username]]
// Simple encoding for this specific case
// CBOR: array of 3 items: string, string "==", string
// Using cbor library if available, otherwise manual bytes
try {
  const cbor = require('cbor');
  const whereClause = [[['normalizedLabel', '==', username.toLowerCase()], ['normalizedParentDomainName', '==', 'dash']]];
  const whereBytes = cbor.encodeCanonical(whereClause);
  v0.setWhere(whereBytes);
} catch(e) {
  // Manual CBOR for simple where clause
  // [[normalizedLabel, ==, username]]
  // This is complex - skip for now, let DPNS handle no filter
  console.log('Note: cbor not available, sending without where filter');
}

req.setV0(v0);

// Make the gRPC-web call
const HOST = 'https://seed-1.mainnet.networks.dash.org:443';

grpc.unary(pbService.Platform.getDocuments, {
  request: req,
  host: HOST,
  transport: grpc.CrossBrowserHttpTransport({ withCredentials: false }),
  onEnd: (res) => {
    console.log('Status:', res.status, res.statusMessage);
    if (res.message) {
      console.log('Response received!');
      const respV0 = res.message.getV0?.();
      if (respV0) {
        const docs = respV0.getDocumentsList?.() || respV0.getDocuments?.()?.getDocumentsList?.() || [];
        console.log('Documents count:', docs.length);
        docs.forEach((doc, i) => {
          console.log(`Doc ${i}:`, Buffer.from(doc).toString('hex').slice(0, 80));
        });
      }
    } else {
      console.log('No message in response');
    }
  },
});
