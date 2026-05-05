# Scraper Service

This Flask service is the dedicated recipe-acquisition boundary for grocery planning.

Current contract:

- `POST /internal/recipes/acquire`

Current implementation:

- mock normalized ATK-style recipe candidates for local integration

Intended future implementation:

- Playwright-based ATK login and recipe acquisition
- normalized recipe parsing for HFC meal planning

The frontend should never talk to this service directly. `health-fitness-coach` remains the only user-facing application.
