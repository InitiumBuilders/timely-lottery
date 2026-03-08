global.self = globalThis;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { grpc }   = require('@improbable-eng/grpc-web');
const platformPb = require('@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb');
const pbService  = require('@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb_service');
const cbor       = require('cbor');
const _bs58raw   = require('bs58'); const bs58 = _bs58raw.default || _bs58raw;
const NodeFetch  = grpc.FetchReadableStreamTransport({ credentials: 'omit' });
const HOST       = 'https://seed-1.pshenmic.dev:1443';
const DPNS_ID    = Buffer.from(bs58.decode('GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'));

// Get 10 docs and try to extract username via multiple decoding strategies
const req = new platformPb.GetDocumentsRequest();
const v0  = new platformPb.GetDocumentsRequest.GetDocumentsRequestV0();
v0.setDataContractId(DPNS_ID);
v0.setDocumentType('domain');
v0.setLimit(10);
v0.setProve(false);
req.setV0(v0);

grpc.unary(pbService.Platform.getDocuments, {
  request: req, host: HOST, transport: NodeFetch,
  onEnd: ({ status, message }) => {
    if (status !== 0) { console.log('Failed'); process.exit(1); }
    const list = message.getV0()?.getDocuments()?.getDocumentsList() || [];
    console.log(`Got ${list.length} docs\n`);
    
    list.slice(0, 5).forEach((docBytes, i) => {
      const buf = Buffer.from(docBytes);
      console.log(`\nDoc[${i}] ${buf.length} bytes`);
      console.log('Hex:', buf.toString('hex').slice(0, 120));
      
      // Try CBOR decode at various offsets
      for (let skip = 0; skip <= 6; skip++) {
        try {
          const decoded = cbor.decodeFirstSync(buf.slice(skip));
          if (decoded && typeof decoded === 'object') {
            const keys = Object.keys(decoded);
            if (keys.length > 0) {
              console.log(`  CBOR at offset ${skip}: keys=${keys.slice(0,8).join(',')}`);
              // Look for label in any key
              for (const k of keys) {
                const v = decoded[k];
                if (typeof v === 'string' && v.length < 64 && v.match(/^[a-zA-Z0-9_-]+$/)) {
                  console.log(`  -> ${k}: "${v}"`);
                }
              }
              break;
            }
          }
        } catch {}
      }
    });
  }
});
setTimeout(() => process.exit(0), 15000);
