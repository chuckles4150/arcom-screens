# Build the dashboard, then bundle it into the server image.
# Single container serves both the API and the static frontend.

# ── Stage 1: build the React dashboard ───────────────────────────
FROM node:20-alpine AS dashboard-build
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ── Stage 2: server runtime ──────────────────────────────────────
FROM node:20-alpine
WORKDIR /app/server

# Install server deps
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/src ./src

# Copy the built dashboard from stage 1
COPY --from=dashboard-build /app/dist /app/dashboard/dist

# Persistent data dir
RUN mkdir -p data/screenshots
VOLUME ["/app/server/data"]

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
