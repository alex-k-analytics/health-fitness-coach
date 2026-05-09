# Add Real NYT Cooking Planning Support

## Summary

Add NYT Cooking as a real live planning source alongside America's Test Kitchen. A planning run should scan all ready planning sources, acquire recipe candidates from each source, dedupe them, cap the combined candidate list to the requested `maxRecipes`, then build the plan from the merged pool.

## Key Changes

- Mark `nytimes` as `supportedForPlanning: true` in shared source definitions and keep existing credential readiness rules: enabled source, username/email, and saved password are required.
- Keep the existing `/api/meal-plans/*` public API shape. No Prisma schema change is needed because `recipeSources` is already JSON and `RecipeSourceId` already includes `nytimes`.
- Update backend run orchestration to resolve every requested ready source, validate credentials server-side, call recipe acquisition once per source, merge results, dedupe by normalized URL/title, and store all used source IDs on the run.
- Apply `maxRecipes` as a total run budget: split approximately evenly across ready sources, then cap the deduped combined list to `maxRecipes`.

## Scraper Implementation

- Add Playwright to `scraper-service`, install Chromium in the scraper Docker image, and keep `/internal/recipes/acquire` as the only scraper endpoint.
- For `source: "nytimes"`, use the supplied NYT credentials in an isolated headless browser context, log in through the configured login URL, search NYT Cooking using pantry-driven queries, collect unique recipe links, open recipe pages, and normalize:
  - `title`
  - canonical `url`
  - `ingredients`
  - `totalTimeMinutes`
  - `ratingValue`
  - `ratingCount`
  - `categories`
- Prefer structured page data such as JSON-LD or embedded app data when available, with DOM fallback selectors for recipe title, ingredients, time, rating, and tags.
- Return source-specific warnings for partial acquisition, parse misses, login failures, or fewer-than-requested results.
- Leave the current ATK scraper behavior unchanged in this task. This change makes NYT real end-to-end but does not convert ATK from its current implementation.

## Frontend Behavior

- NYT moves from "Stored Recipe Sources" into "Planning Source."
- The New Plan form continues to submit all ready planning sources automatically, matching the chosen "scan all ready" behavior.
- Update readiness and dashboard copy so it no longer says live planning only supports ATK.
- History and detail views continue to show the source IDs already stored on each run.

## Test Plan

- Backend typecheck/build: verify source definitions, run creation, serialization, and merged acquisition compile cleanly.
- Scraper tests or focused helper tests:
  - NYT search URL/query generation from pantry ingredients.
  - recipe URL dedupe and normalization.
  - duration/rating/ingredient parsing from representative saved NYT-like HTML fixtures.
  - unsupported source still returns a clear 400.
- Integration scenarios:
  - Only NYT ready: run completes with NYT recipe URLs and ingredients.
  - ATK and NYT ready: backend calls both, merges candidates, and stores `["atk", "nytimes"]`.
  - NYT configured but missing password or disabled: not planning-ready and cannot start a run with NYT.
  - NYT login/search failure: run fails with a readable source-specific error or completes with warnings only if another source returned candidates.

## Assumptions

- NYT credentials are user-provided and valid for NYT Cooking access.
- Playwright/Chromium is acceptable in the scraper service image.
- `maxRecipes` is a total budget across sources, not per source.
- The existing internal scraper API remains the backend-scraper boundary.
