# Health & Fitness Coach (Agentic Web App)

This repository contains a starter full-stack implementation for a **mobile-first health and fitness coaching app** with an agent workflow.

## What is included

- **Frontend (React + Vite + TypeScript)** optimized for mobile workflows.
- **Backend (Node.js + Express + TypeScript)** with API routes for:
  - profile + equipment
  - workout planning and workout logs
  - nutrition photo submissions + portion guidance
  - conversation history and reminders
- **Integrations scaffold** for:
  - OpenAI API for agent responses
  - Google Calendar OAuth + scheduling hooks
  - SMS reminders (Twilio-style adapter)
- **Data layer plan**
  - PostgreSQL (relational app data)
  - Blob storage (MinIO/S3-compatible) for food pictures and generated artifacts
  - Prisma schema to support future conversation recall and analytics
- **Local infra** via `docker-compose` (Postgres + MinIO)

## Monorepo structure

- `frontend/` mobile-first React app
- `backend/` API + service integrations + data schema
- `docker-compose.yml` local data services
- `.env.example` shared config template

## Quick start

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Start local infrastructure:
   ```bash
   docker compose up -d
   ```
3. Install dependencies and run apps:
   ```bash
   cd backend && npm install && npm run dev
   cd frontend && npm install && npm run dev
   ```

## Product roadmap alignment

### Phase 1 (implemented in scaffold)
- Core API contracts and domain models
- Mobile-first UI for profile, workouts, food photo flow, and reminders
- Integration service interfaces + stubs

### Phase 2 (next)
- Real Google OAuth flow + calendar event writebacks
- Production OpenAI tool-calling loop for autonomous scheduling and guidance
- Blob upload from mobile camera + vision nutrition extraction
- Conversation memory retrieval and proactive coaching

### Phase 3 (later)
- Adaptive plans based on compliance and fatigue
- Macro/micro nutrient deficiency trend detection
- Rich notifications (SMS + push) and wearable data sync

## Security and privacy notes

- Health data is sensitive; use encryption in transit and at rest.
- Store OAuth tokens securely and rotate refresh tokens.
- Gate reminders and AI recommendations behind explicit user consent.
- Add explainability in nutrition and workout suggestions.
