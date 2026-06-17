# Multi-stage: builda o frontend (Vite) e o backend (TS), e no runtime o backend
# serve a API + os arquivos estáticos do frontend (pasta backend/public).

# 1) Build do frontend -> frontend/dist
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Build do backend -> backend/dist (+ prisma client)
FROM node:22-alpine AS backend
# Prisma precisa do OpenSSL para o schema/query engine em Alpine (musl).
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

# 3) Runtime
FROM node:22-alpine
# Prisma precisa do OpenSSL em runtime (db push / db seed).
RUN apk add --no-cache openssl
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/package.json ./package.json
COPY --from=backend /app/backend/prisma ./prisma
# frontend buildado vira os estáticos servidos pelo backend
COPY --from=frontend /app/frontend/dist ./public
EXPOSE 3001
# sincroniza o schema no banco (greenfield, sem arquivos de migração) e sobe a API
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/index.js"]
