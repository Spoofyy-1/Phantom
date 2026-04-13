# Official Microsoft Playwright image — Python 3.11 + Chromium pre-installed.
# No manual apt-get dependency hunting needed.
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# $PORT is injected by Railway at runtime; fall back to 8000 locally.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
