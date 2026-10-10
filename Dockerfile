# Multi-stage build for Render deployment
# Use Playwright version matching package.json (1.40.0)
FROM mcr.microsoft.com/playwright:v1.40.0-jammy AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# ===========================================
# Runtime stage
# Use same Playwright version base image
FROM mcr.microsoft.com/playwright:v1.40.0-jammy AS runner

WORKDIR /app

# Copy production package files
COPY package*.json ./

# Install only production dependencies, skip prepare script (husky)
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Verify Playwright works (already installed in base image)
RUN npx playwright --version

# Create non-root user (idempotent - check if exists first)
RUN if ! getent group pwuser >/dev/null 2>&1; then groupadd -r pwuser; fi && \
    if ! id -u pwuser >/dev/null 2>&1; then useradd -r -g pwuser pwuser; fi
RUN chown -R pwuser:pwuser /app
USER pwuser

# Expose nothing (worker service)
CMD ["node", "dist/cli.js"]