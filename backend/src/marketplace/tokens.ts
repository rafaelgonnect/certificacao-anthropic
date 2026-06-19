import crypto from "node:crypto";
import { prisma } from "../db.js";

/** Token opaco usado no path da URL git (ex: /git/m/<token>/skills.git). */
export function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Retorna o token de instalação do usuário, criando um se ainda não existir. */
export async function ensureToken(userId: string) {
  const existing = await prisma.installToken.findUnique({ where: { userId } });
  if (existing && !existing.revokedAt) return existing;
  if (existing && existing.revokedAt) {
    return prisma.installToken.update({
      where: { userId },
      data: { token: generateToken(), revokedAt: null, lastUsedAt: null },
    });
  }
  return prisma.installToken.create({ data: { userId, token: generateToken() } });
}

/** Gera um token novo para o usuário (rotação), invalidando o anterior. */
export async function rotateToken(userId: string) {
  return prisma.installToken.upsert({
    where: { userId },
    update: { token: generateToken(), revokedAt: null, lastUsedAt: null },
    create: { userId, token: generateToken() },
  });
}

/**
 * Valida um token vindo do path da URL git. Retorna o registro se válido e não
 * revogado, registrando o uso; caso contrário, null (o chamador responde 404).
 */
export async function validateToken(token: string) {
  if (!token) return null;
  const record = await prisma.installToken.findUnique({ where: { token } });
  if (!record || record.revokedAt) return null;
  await prisma.installToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return record;
}
