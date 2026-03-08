/**
 * DPNS Username Resolver (CommonJS for Next.js server)
 * Uses gRPC-web transport on seed-1.pshenmic.dev:1443
 */
'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
if (typeof global.self === 'undefined') global.self = globalThis;

let _initialized = false;
let _grpc, _platformPb, _pbService, _cbor, _bs58, _DPNS_ID, _TRANSPORT, _HOST;

function init() {
  if (_initialized) return;
  try {
    const mod = require('@improbable-eng/grpc-web');
    _grpc = mod.grpc || mod;
    _platformPb = require('@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb');
    _pbService  = require('@dashevo/dapi-grpc/clients/platform/v0/web/platform_pb_service');
    _cbor       = require('cbor');
    const bs58raw = require('bs58');
    _bs58 = bs58raw.default || bs58raw;
    _HOST = 'https://seed-1.pshenmic.dev:1443';
    _TRANSPORT = _grpc.FetchReadableStreamTransport({ credentials: 'omit' });
    _DPNS_ID = Buffer.from(_bs58.decode('GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'));
    _initialized = true;
  } catch (e) {
    console.error('[DPNS] Init failed:', e.message);
  }
}

async function resolveUsername(username) {
  const clean = username.toLowerCase().replace(/^@/, '').trim();
  if (!clean) return { found: false, username: '' };

  try {
    init();
    if (!_initialized) return { found: false, username: clean, error: 'gRPC not available' };

    return await new Promise((resolve) => {
      const req = new _platformPb.GetDocumentsRequest();
      const v0  = new _platformPb.GetDocumentsRequest.GetDocumentsRequestV0();
      v0.setDataContractId(_DPNS_ID);
      v0.setDocumentType('domain');
      v0.setWhere(_cbor.encode([
        ['normalizedLabel', '==', clean],
        ['normalizedParentDomainName', '==', 'dash'],
      ]));
      v0.setLimit(1);
      v0.setProve(false);
      req.setV0(v0);

      _grpc.unary(_pbService.Platform.getDocuments, {
        request: req, host: _HOST, transport: _TRANSPORT,
        onEnd: ({ status, message }) => {
          if (status === 0 && message) {
            const list = message.getV0?.()?.getDocuments?.()?.getDocumentsList?.() || [];
            if (list.length > 0) {
              resolve({ found: true, username: clean });
            } else {
              resolve({ found: false, username: clean });
            }
          } else {
            resolve({ found: false, username: clean, error: 'Query failed' });
          }
        },
      });
      setTimeout(() => resolve({ found: false, username: clean, error: 'Timeout' }), 12000);
    });
  } catch (e) {
    return { found: false, username: clean, error: e.message };
  }
}

module.exports = { resolveUsername };
