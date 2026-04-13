# Official Microsoft Playwright image — Python 3.11 + Chromium pre-installed.
# Build context is the repo ROOT (Railway scans from there).
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

# Copy deps first for layer caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source
COPY backend/ .

EXPOSE 8000
# $PORT is injected by Railway; fall back to 8000 locally.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
