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

Bootstrap the platform once with Terraform using a placeholder image, for example:

```bash
cd infra/terraform
terraform init
terraform apply \
  -var="project_id=akalish-software" \
  -var="app_image=us-docker.pkg.dev/cloudrun/container/hello"
```

That initial apply creates Artifact Registry, Cloud Run, Cloud SQL, Secret Manager entries, the runtime service account, and the IAM bindings for the existing GitHub deployer service account.

After the first apply, get the generated Cloud Run URL:

```bash
terraform output -raw service_url
```

Then rerun `terraform apply` with `-var="app_base_url=https://..."` once you decide whether to use the default Cloud Run URL or a custom domain.

## GitHub Actions

Three workflows are included:

- [CI](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/.github/workflows/ci.yml): installs dependencies, builds frontend/backend, and validates Terraform
- [Bootstrap Infra](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/.github/workflows/bootstrap-infra.yml): manual first-run Terraform bootstrap that creates Artifact Registry, Cloud Run, Cloud SQL, Secret Manager, and IAM using a placeholder image, applies Prisma migrations, then reruns Terraform with the generated Cloud Run URL as `APP_BASE_URL`
- [Deploy](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/.github/workflows/deploy.yml): authenticates to your existing `akalish-software` GCP project via Workload Identity Federation, applies Prisma migrations, builds and pushes the container image, then rolls a new Cloud Run revision

This repo is wired to two GitHub Actions identities:

- workload identity provider: `projects/698032141114/locations/global/workloadIdentityPools/github-actions-pool/providers/github`
- deployer service account: `github-actions-service-account@akalish-software.iam.gserviceaccount.com`
- bootstrap service account: `github-actions-bootstrap@akalish-software.iam.gserviceaccount.com`

The intended order is:

1. Run `Bootstrap Infra` once.
2. Run `CI` when you want validation.
3. Run `Deploy` for normal image rollouts.

All three workflows are manual-only via `workflow_dispatch`.

The deploy workflow checks for the Artifact Registry repository and Cloud Run service up front and tells you to run `Bootstrap Infra` if the platform has not been provisioned yet.

`APP_BASE_URL` is still important for production invite links and strict CORS. Set it during the Terraform bootstrap once you know the public service URL or custom domain you want to use.

## Notes

- The repo includes a generated Prisma migration at [backend/prisma/migrations/20260418223000_household_nutrition/migration.sql](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/backend/prisma/migrations/20260418223000_household_nutrition/migration.sql).
- Health data is sensitive. The production stack assumes HTTPS, Secret Manager, private object storage, and authenticated access at the application layer.
