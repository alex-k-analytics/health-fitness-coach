# Health & Fitness Coach

Private nutrition tracking app with:

- authenticated personal access
- per-user goals and health metrics
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

- The app is designed for a single private account.
- The first account setup is allowed once, then public registration closes and the app becomes login-only.
- The database schema is account-centric: goals, health metrics, meals, and reusable foods all belong directly to one account.
- Users can set goals, log health metrics, upload meal photos, and reuse saved food entries.
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

## iPhone app development

The iOS app is a Capacitor wrapper around the React/Vite frontend. The native project lives in:

- [frontend/ios](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/frontend/ios)

Build the web app and sync it into Xcode:

```bash
cd frontend
npm run ios:sync
```

Open the native project:

```bash
cd frontend
npm run ios:open
```

For simulator development against the local backend, keep `frontend/.env` pointed at:

```bash
VITE_API_BASE_URL=http://localhost:4000/api
```

For a physical iPhone or App Store/TestFlight build, use an HTTPS API URL instead:

```bash
cd frontend
VITE_API_BASE_URL=https://your-service.example.com/api npm run ios:sync
```

The backend allows Capacitor origins by default through `NATIVE_APP_ORIGINS=capacitor://localhost,ionic://localhost`. Login also returns a Bearer token so the iOS WebView can authenticate cross-origin API calls.

## Auth and data flow

- `POST /api/auth/login`: sign in.
- `PATCH /api/profile/me`: update goals/profile.
- `POST /api/profile/me/health-metrics`: append a health snapshot.
- `POST /api/nutrition/estimate`: analyze food photos and label screenshots before saving a meal.
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

`APP_BASE_URL` is still important for production redirects, cookie/CORS consistency, and any future custom domain setup. Set it during the Terraform bootstrap once you know the public service URL or custom domain you want to use.

## Notes

- The repo includes a generated Prisma migration at [backend/prisma/migrations/20260418223000_household_nutrition/migration.sql](/Users/alexkalish/Documents/MyApplications/health-fitness-coach/backend/prisma/migrations/20260418223000_household_nutrition/migration.sql).
- Health data is sensitive. The production stack assumes HTTPS, Secret Manager, private object storage, and authenticated access at the application layer.
