# Bubbleseerr: build with Node 22, run the standalone Next.js server
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 ships prebuilt binaries (also for Alpine), so no compiling
RUN npm ci --no-audit --no-fund --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5056 \
    HOSTNAME=0.0.0.0 \
    CONFIG_DIR=/app/config
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# The native SQLite module picks its binary at runtime, so copy all of it
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
RUN mkdir -p /app/config && chown -R node:node /app/config
USER node
VOLUME /app/config
EXPOSE 5056
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:5056/api/v1/public >/dev/null || exit 1
CMD ["node", "server.js"]
