import { PrismaClient } from '@prisma/client';

// Lazy init — avoids crashing during Vercel build (all auth routes proxied via middleware anyway)
const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient };

function getPrisma(): PrismaClient {
  if (!globalForPrisma._prisma) {
    globalForPrisma._prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    });
  }
  return globalForPrisma._prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

export default prisma;
