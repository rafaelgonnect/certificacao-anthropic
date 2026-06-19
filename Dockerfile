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
# git é usado pelo marketplace de skills (git smart-HTTP via git-http-backend).
RUN apk add --no-cache openssl git
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/package.json ./package.json
COPY --from=backend /app/backend/prisma ./prisma
# frontend buildado vira os estáticos servidos pelo backend
COPY --from=frontend /app/frontend/dist ./public
# Carimbo de versão: o timestamp muda a cada build (os COPY acima invalidam o
# cache quando há código novo), então /health expõe quando a imagem subiu.
# GIT_SHA é opcional (passe via --build-arg se o builder fornecer).
ARG GIT_SHA=unknown
RUN date -u +%Y-%m-%dT%H:%M:%SZ > ./BUILD_TIME && echo "$GIT_SHA" > ./GIT_SHA
EXPOSE 3001
# 1) sincroniza o schema (greenfield, sem migrações), 2) seed por versão (semeia
# packs novos e atualiza os que mudaram de versão, preservando progresso dos demais),
# 3) sobe a API
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npx tsx prisma/seedOnBoot.ts && node dist/index.js"]
