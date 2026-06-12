import jwt from "jsonwebtoken";
export type TokenPayload = { sub: string; role: "aluno" | "gestor" | "admin" };
export function signToken(payload: TokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}
export function verifyToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  return { sub: String(decoded.sub), role: decoded.role };
}
