# Multi-stage Docker build for Render deployment
FROM mcr.microsoft.com/playwright:v1.40.0-jammy AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Verify Playwright
RUN npx playwright install chromium

# Create non-root user
RUN groupadd -r pwuser && useradd -r -g pwuser pwuser
RUN chown -R pwuser:pwuser /app
USER pwuser

# Expose nothing (worker service)
CMD ["npm", "run", "daemon"]