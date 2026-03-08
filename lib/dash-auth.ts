/**
 * Shared Dash auth helpers (importable from both challenge + verify routes)
 */
export function buildSigningMessage(nonce: string, dpnsName: string): string {
  return `Sign in to Timely.Works\nUsername: ${dpnsName}.dash\nNonce: ${nonce}`;
}
