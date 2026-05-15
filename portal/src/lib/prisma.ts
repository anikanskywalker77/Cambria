/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules, which would normally create dozens of
 * Prisma clients (each holding its own DB connection pool). The global cache
 * trick prevents that.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
