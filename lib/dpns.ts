/**
 * Dash Platform DPNS Username Resolver
 * Uses gRPC-web transport via seed-1.pshenmic.dev:1443
 * This is the server-side resolver — runs in Node.js context only
 */

// Lazy-load resolver to avoid edge runtime issues
let resolver: ((username: string) => Promise<DPNSResult>) | null = null;

export interface DPNSResult {
  found:       boolean;
  username:    string;
  identityId?: string;
  dashAddress?: string;
  error?:      string;
}

/**
 * Resolve a Dash Evolution username to a DASH payment address.
 * Returns null if username not found or resolution fails.
 */
export async function resolveDashUsername(username: string): Promise<DPNSResult> {
  const clean = username.replace(/^@/, '').toLowerCase().trim();
  if (!clean) return { found: false, username: '', error: 'Empty username' };

  try {
    // Dynamic require — grpc-web can only run in Node.js, not Edge
    if (!resolver) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./dpns-resolver.cjs');
      resolver = mod.resolveUsername;
    }
    return await resolver!(clean);
  } catch (e: unknown) {
    console.error('[DPNS] Resolution failed:', e instanceof Error ? e.message : String(e));
    return { found: false, username: clean, error: String(e) };
  }
}

/**
 * Check if a string looks like a Dash username (not an address)
 */
export function isDashUsername(value: string): boolean {
  const clean = value.replace(/^@/, '');
  // Dash usernames: 3-63 chars, alphanumeric + hyphen/underscore
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,62}$/.test(clean) && !value.startsWith('X');
}
