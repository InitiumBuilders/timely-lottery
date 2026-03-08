/**
 * lib/username.ts
 * Canonical display-name resolution for Timely.Works.
 *
 * Priority (highest → lowest):
 *   1. Dash username  (@August)
 *   2. Display name   (August James)
 *   3. Sanitized auto-name derived from email local-part — NEVER the full email
 *
 * The email address itself is NEVER returned as a display name.
 */

/** Words pool for auto-generated usernames when nothing else is available */
const ADJECTIVES = ['Bright','Bold','Swift','Keen','Calm','Sharp','Clear','Brave','Wise','Open'];
const NOUNS      = ['Builder','Maker','Thinker','Dreamer','Coder','Founder','Seeker','Mover'];

/**
 * Deterministically generate a friendly username from an email.
 * Uses the local-part (before @) and cleans it up — never exposes the domain.
 */
export function sanitizeEmailLocal(email: string): string {
  const local = email.split('@')[0] || '';
  // Remove digits at the end, replace dots/underscores/hyphens with spaces, title-case
  const cleaned = local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+$/, '')
    .trim();
  if (cleaned.length < 2) {
    // Fallback: pick from word pool using simple hash of the email
    const hash = Array.from(email).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return `${ADJECTIVES[hash % ADJECTIVES.length]}${NOUNS[(hash >> 3) % NOUNS.length]}`;
  }
  // Title-case each word
  return cleaned.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve the best public-facing display name for a user.
 * This is what should be shown anywhere on the site.
 */
export function resolveDisplayName(user: {
  dashUsername?: string | null;
  displayName?:  string | null;
  email?:        string | null;
}): string {
  if (user.dashUsername?.trim()) {
    // Dash usernames are shown with @ prefix
    const u = user.dashUsername.trim().replace(/^@/, '');
    return `@${u}`;
  }
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }
  if (user.email?.trim()) {
    return sanitizeEmailLocal(user.email.trim());
  }
  return 'Builder';
}

/**
 * Same as resolveDisplayName but never prepends @.
 * Use for contexts where the @ would look odd (e.g. "Posted by ...").
 */
export function resolveDisplayNamePlain(user: {
  dashUsername?: string | null;
  displayName?:  string | null;
  email?:        string | null;
}): string {
  if (user.dashUsername?.trim()) {
    return user.dashUsername.trim().replace(/^@/, '');
  }
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }
  if (user.email?.trim()) {
    return sanitizeEmailLocal(user.email.trim());
  }
  return 'Builder';
}
