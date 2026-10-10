# Render Deployment Guide for Playwright

## System Dependencies (Ubuntu/Debian)
Run this once on your local machine or CI:
```bash
sudo npx playwright install-deps chromium
```

Or manually:
```bash
sudo apt-get update && sudo apt-get install -y \
  libnspr4 \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0 \
  libgtk-3-0 \
  libx11-xcb1 \
  libxshmfence1
```

## Render.com Deployment

### Option 1: Native Node.js Service (Recommended)
Create `render.yaml` in repo root:

```yaml
services:
  - type: worker
    name: job-auto-apply
    runtime: node
    plan: starter
    buildCommand: |
      npm ci
      npx playwright install chromium
      npx playwright install-deps chromium
      npm run build
    startCommand: npm run daemon
    envVars:
      - key: NODE_ENV
        value: production
      - key: MASTER_PASSWORD
        sync: false  # Set in Render dashboard
      - key: OPENAI_API_KEY
        sync: false  # Set in Render dashboard
      - key: LINKEDIN_EMAIL
        sync: false
      - key: LINKEDIN_PASSWORD
        sync: false
      - key: NAUKRI_EMAIL
        sync: false
      - key: NAUKRI_PASSWORD
        sync: false
      - key: INDEED_EMAIL
        sync: false
      - key: INDEED_PASSWORD
        sync: false
```

### Option 2: Docker (More Control)
Create `Dockerfile`:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Verify Playwright works
RUN npx playwright install chromium

# Run as non-root (optional)
USER pwuser

CMD ["npm", "run", "daemon"]
```

Create `docker-compose.yml` for local testing:
```yaml
version: '3.8'
services:
  job-auto-apply:
    build: .
    environment:
      - NODE_ENV=production
      - MASTER_PASSWORD=${MASTER_PASSWORD}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - LINKEDIN_EMAIL=${LINKEDIN_EMAIL}
      - LINKEDIN_PASSWORD=${LINKEDIN_PASSWORD}
      - NAUKRI_EMAIL=${NAUKRI_EMAIL}
      - NAUKRI_PASSWORD=${NAUKRI_PASSWORD}
    volumes:
      - ./data:/app/data  # Persist browser profiles
```

### Render-Specific Notes

1. **Use Worker service** - Not Web service (no HTTP port needed)
2. **Set headless: true** in config for production:
   ```yaml
   # config/production.yaml
   browser:
     headless: true
   ```
3. **Persistent storage** - Browser profiles saved to `/app/.browser-profiles/`
   - On Render, this is ephemeral (lost on deploy)
   - Consider using Render Disk for persistence
4. **Memory** - Starter plan (512MB) may be tight for Chromium
   - Use Standard (1GB+) for production
5. **Cron alternative** - Render doesn't have native cron
   - Use `node-cron` in app (already implemented)
   - Or external cron service (cron-job.org)

## Quick Local Fix
```bash
# Install system deps locally
sudo npx playwright install-deps chromium

# Then tests will pass
npm test
```
