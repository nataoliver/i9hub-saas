# i9Hub SaaS - Multi-stage Dockerfile
# Node 20 Alpine + non-root user + produção otimizada

# ─── Stage 1: Build ───
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# ─── Stage 2: Production ───
FROM node:20-alpine AS production
WORKDIR /app

# Segurança: usuário non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    mkdir -p /app && chown -R appuser:appgroup /app

# Copiar dependências do build stage
COPY --from=builder /app/node_modules ./node_modules

# Copiar código fonte
COPY --chown=appuser:appgroup backend/ ./backend/
COPY --chown=appuser:appgroup frontend/ ./frontend/
COPY --chown=appuser:appgroup package.json ./

# Healthcheck endpoint
RUN echo '#!/bin/sh' > /app/healthcheck.sh && \
    echo 'wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1' >> /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD ["/app/healthcheck.sh"]

CMD ["node", "backend/src/server.js"]