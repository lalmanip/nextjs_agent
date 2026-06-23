# ----------------------------
# 1) Builder
# ----------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

# Runtime config comes from K8s ConfigMap/Secret — no .env files in the image.
COPY . ./

# Optional: Disable Next.js telemetry (not necessary but cleaner)
ENV NEXT_TELEMETRY_DISABLED=1


# Ensure production env during build
ENV NODE_ENV=production

RUN npm run build


# ----------------------------
# 2) Runner
# ----------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3005

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN npm ci --omit=dev && npm cache clean --force

EXPOSE 3005

CMD ["npm", "start"]
