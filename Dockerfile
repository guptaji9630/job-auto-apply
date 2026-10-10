# Multi-stage build for Render deployment
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
FROM mcr.microsoft.com/playwright:v1.40.0-jammy AS runner

WORKDIR /app

# Copy production package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Verify Playwright works (already installed in base image)
RUN npx playwright --version

# Create non-root user
RUN groupadd -r pwuser && useradd -r -g pwuser pwuser
RUN chown -R pwuser:pwuser /app
USER pwuser

# Expose nothing (worker service)
CMD ["echo", "Worker entry point (cli.ts) not yet implemented - see Task 14 in plan"]