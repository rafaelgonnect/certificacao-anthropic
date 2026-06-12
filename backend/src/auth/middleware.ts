import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt.js";
import { loadEnv } from "../env.js";
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: TokenPayload } }
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "missing token" });
  try {
    req.user = verifyToken(header.slice(7), loadEnv().JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: "invalid token" }); }
}
export function requireRole(...roles: TokenPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
