# ---- 의존성 설치 ----
FROM node:22-slim AS deps
WORKDIR /app
# better-sqlite3 네이티브 빌드 대비 (보통은 프리빌트 바이너리를 받아서 불필요)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- 빌드 ----
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 실행 (standalone: 필요한 파일만) ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# 빈 DB 첫 기동 시 스키마 자동 생성에 필요
COPY --from=builder /app/drizzle ./drizzle
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
