/**
 * ─── lib/auth.ts ─ Authentication Helpers ────────────────────────────────────
 *
 * Handles password hashing, session management, and cookie configuration.
 *
 * Session flow:
 *   1. User logs in → createSession() creates token in DB + sets httpOnly cookie
 *   2. Every authenticated request → getSessionUser(token) validates token
 *   3. Logout → deleteSession(token) removes from DB + clears cookie
 *
 * Cookie config:
 *   - Name: timely_session
 *   - httpOnly: true (not accessible via JS — prevents XSS theft)
 *   - Secure: true in production (HTTPS only)
 *   - SameSite: lax (allows normal navigation, blocks cross-site POST)
 *   - MaxAge: 30 days
 *
 * ⚠️  VERCEL NOTE: The Vercel edge middleware (middleware.ts) MUST forward
 * the Cookie header to VPS and Set-Cookie back to browser. Without this,
 * auth silently breaks — see docs/SECURITY.md and middleware.ts.
 */
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import prisma from './db';
import { cookies } from 'next/headers';

export const COOKIE_NAME = 'timely_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return nanoid(48);
}

export function generateVerifyToken(): string {
  return nanoid(32);
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);
  await prisma.userSession.create({ data: { userId, token, expiresAt } });
  return token;
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;
  try {
    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    return getSessionUser(token);
  } catch {
    return null;
  }
}

export async function deleteSession(token: string) {
  try {
    await prisma.userSession.delete({ where: { token } });
  } catch { /* already deleted */ }
}

export function setSessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
}
