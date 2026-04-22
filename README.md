# Health & Fitness Coach

Household nutrition tracking app with:

- authenticated owner/member access
- per-member goals and health metrics
- meal logging with multiple food and label photos
- OpenAI-powered nutrition analysis with fallback heuristics
- reusable saved foods
- PostgreSQL persistence and GCS-backed image storage in production
- Terraform-managed GCP infrastructure and GitHub Actions deployment

## Stack

- `frontend/`: React + Vite + TypeScript
- `backend/`: Express + TypeScript + Prisma
- `infra/terraform/`: Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, and GCS
- `Dockerfile`: production image that serves both the API and built frontend from one Cloud Run service

## Product model

- One `Household` contains multiple authorized profiles.
- Each signed-in person has a private `HouseholdMember` page.
- Owners can invite additional users with invite links/tokens.
- Members can set goals, log health metrics, upload meal photos, and reuse saved food entries.
- Meal analysis stores calories, macros, assumptions, micronutrients, vitamins, and image references.

## Local development

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Install backend dependencies, generate Prisma client, and run the API:

```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

4. In another terminal, install frontend dependencies and run Vite:

```bash
cd frontend
npm install
npm run dev
```

5. Optional: apply the schema to a local Postgres instance:

```bash
cd backend
npx prisma db push
```

The frontend expects the API at `http://localhost:4000/api` by default.

## Auth and data flow

- `POST /api/auth/register-owner`: create the first household owner.
- `POST /api/auth/login`: sign in.
- `POST /api/auth/accept-invite`: join a household with an invite token.
- `GET /api/household`: view members and pending invites.
- `PATCH /api/profile/me`: update goals/profile.
- `POST /api/profile/me/health-metrics`: append a health snapshot.
- `POST /api/nutrition/meals`: multipart meal submission with `plateImages`, `labelImages`, and `otherImages`.
- `POST /api/nutrition/saved-foods`: create reusable food entries.

If `OPENAI_API_KEY` is configured, the backend sends meal photos and serving context to the OpenAI Responses API. If it is not configured, the app still stores the meal and produces a conservative fallback estimate.

## Production deployment

The production deployment uses one Cloud Run service that serves:

- the Express API
- the built React frontend

Terraform provisions:

- Artifact Registry repository
- Cloud Run service
- Cloud SQL PostgreSQL instance
- GCS bucket for meal images
- Secret Manager secrets for `DATABASE_URL`, `JWT_SECRET`, and optionally `OPENAI_API_KEY`
- runtime service account and IAM bindings

The main Terraform entrypoint is:

- [infra/terraform/main.tf](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/infra/terraform/main.tf)

Example variables live in:

- [infra/terraform/terraform.tfvars.example](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/infra/terraform/terraform.tfvars.example)

## GitHub Actions

Two workflows are included:

- [CI](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/.github/workflows/ci.yml): installs dependencies, builds frontend/backend, and validates Terraform
- [Deploy](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/.github/workflows/deploy.yml): creates Artifact Registry if needed, builds and pushes the container image, then applies Terraform

Required GitHub secrets for deployment:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_SERVICE_NAME`
- `GCP_ARTIFACT_REPOSITORY_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOYER_SERVICE_ACCOUNT`
- `APP_BASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`

`APP_BASE_URL` should be the public URL you want the app to use for invite links and browser-origin checks.

## Notes

- The repo includes a generated Prisma migration at [backend/prisma/migrations/20260418223000_household_nutrition/migration.sql](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/backend/prisma/migrations/20260418223000_household_nutrition/migration.sql).
- Health data is sensitive. The production stack assumes HTTPS, Secret Manager, private object storage, and authenticated access at the application layer.
