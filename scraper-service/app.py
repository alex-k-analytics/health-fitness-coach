from __future__ import annotations

import json
import os
import re
import traceback
from collections.abc import Iterable
from urllib.parse import quote_plus, urljoin, urlparse, urlunparse

from flask import Flask, jsonify, request
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


app = Flask(__name__)


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.error("Unhandled scraper error: %s\n%s", error, traceback.format_exc())
    return jsonify({"error": f"Unhandled scraper error: {error}"}), 500


def normalize_whitespace(value: str) -> str:
    return " ".join(str(value or "").split()).strip()


def unique_strings(values: Iterable[str], limit: int | None = None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = normalize_whitespace(value)
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(normalized)
        if limit is not None and len(out) >= limit:
            break
    return out


def parse_int(value) -> int | None:
    if value is None:
        return None
    match = re.search(r"\d+", str(value).replace(",", ""))
    return int(match.group(0)) if match else None


def parse_float(value) -> float | None:
    if value is None:
        return None
    match = re.search(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    return float(match.group(0)) if match else None


def parse_duration_minutes(value) -> int | None:
    if value is None:
        return None
    text = normalize_whitespace(str(value)).lower()
    if not text:
        return None
    iso = re.fullmatch(r"p(?:t)?(?:(\d+)h)?(?:(\d+)m)?", text, flags=re.IGNORECASE)
    if iso:
        hours = int(iso.group(1) or 0)
        minutes = int(iso.group(2) or 0)
        return hours * 60 + minutes if hours or minutes else None
    hours_match = re.search(r"(\d+)\s*(?:hours?|hrs?|hr)\b", text)
    minutes_match = re.search(r"(\d+)\s*(?:minutes?|mins?|min)\b", text)
    total = 0
    if hours_match:
        total += int(hours_match.group(1)) * 60
    if minutes_match:
        total += int(minutes_match.group(1))
    if total:
        return total
    return parse_int(text)


def canonical_url(raw_url: str, base_url: str = "https://cooking.nytimes.com") -> str:
    absolute = urljoin(base_url, raw_url)
    parsed = urlparse(absolute)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", ""))


def build_mock_recipes(pantry_ingredients: list[str], max_recipes: int) -> list[dict]:
    ingredients = pantry_ingredients[:6]
    lead = ingredients[0] if len(ingredients) > 0 else "chicken"
    support = ingredients[1] if len(ingredients) > 1 else "rice"
    third = ingredients[2] if len(ingredients) > 2 else "garlic"

    recipes = [
        {
            "title": f"{lead} skillet with {support}",
            "url": "https://example.invalid/recipes/skillet",
            "ingredients": [lead, support, third, "olive oil", "salt", "pepper", "lemon"],
            "totalTimeMinutes": 35,
            "ratingValue": 4.6,
            "ratingCount": 123,
            "categories": ["skillet", "dinner", "weeknight"],
        },
        {
            "title": f"{lead} pasta with {third}",
            "url": "https://example.invalid/recipes/pasta",
            "ingredients": [lead, third, "pasta", "parmesan", "butter", "spinach"],
            "totalTimeMinutes": 40,
            "ratingValue": 4.4,
            "ratingCount": 88,
            "categories": ["pasta", "dinner"],
        },
        {
            "title": f"Sheet-pan {lead} and vegetables",
            "url": "https://example.invalid/recipes/sheet-pan",
            "ingredients": [lead, "broccoli", "carrots", "olive oil", "garlic", "potatoes"],
            "totalTimeMinutes": 45,
            "ratingValue": 4.7,
            "ratingCount": 201,
            "categories": ["sheet-pan", "dinner"],
        },
        {
            "title": f"{support} bowl with {lead}",
            "url": "https://example.invalid/recipes/bowl",
            "ingredients": [support, lead, "cucumber", "yogurt", "dill", "lemon"],
            "totalTimeMinutes": 30,
            "ratingValue": 4.2,
            "ratingCount": 64,
            "categories": ["bowl", "lunch", "dinner"],
        },
        {
            "title": f"Soup with {lead} and {third}",
            "url": "https://example.invalid/recipes/soup",
            "ingredients": [lead, third, "broth", "onion", "celery", "carrots"],
            "totalTimeMinutes": 55,
            "ratingValue": 4.0,
            "ratingCount": 49,
            "categories": ["soup", "dinner"],
        },
        {
            "title": f"Salad with {lead} and greens",
            "url": "https://example.invalid/recipes/salad",
            "ingredients": [lead, "mixed greens", "tomatoes", "olive oil", "vinegar", "croutons"],
            "totalTimeMinutes": 20,
            "ratingValue": 4.1,
            "ratingCount": 37,
            "categories": ["salad", "lunch"],
        },
    ]
    return recipes[: max(1, min(max_recipes, len(recipes)))]


def build_nyt_queries(pantry_ingredients: list[str], max_recipes: int) -> list[str]:
    clean = unique_strings(pantry_ingredients, limit=6)
    queries: list[str] = []
    if len(clean) >= 2:
        queries.append(" ".join(clean[:2]))
    if len(clean) >= 3:
        queries.append(" ".join(clean[:3]))
    queries.extend(clean[:4])
    if not queries:
        queries.append("dinner")
    return unique_strings(queries, limit=max(2, min(5, max_recipes)))


def click_first(page, selectors: list[str], timeout: int = 2500) -> bool:
    for selector in selectors:
        try:
            target = page.locator(selector).first
            if target.count() > 0 and target.is_visible(timeout=timeout):
                target.click(timeout=timeout)
                return True
        except PlaywrightTimeoutError:
            continue
    return False


def fill_first(page, selectors: list[str], value: str, timeout: int = 5000) -> bool:
    for selector in selectors:
        try:
            target = page.locator(selector).first
            if target.count() > 0 and target.is_visible(timeout=timeout):
                target.fill(value, timeout=timeout)
                return True
        except PlaywrightTimeoutError:
            continue
    return False


def login_to_nyt(page, login: dict, warnings: list[str]) -> None:
    username = normalize_whitespace(str(login.get("username", "")))
    password = normalize_whitespace(str(login.get("password", "")))
    login_url = normalize_whitespace(str(login.get("loginUrl", ""))) or "https://cooking.nytimes.com/login"
    if not username or not password:
        raise RuntimeError("NYT Cooking requires a username and saved password.")

    page.goto(login_url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(1000)

    filled_email = fill_first(
        page,
        [
            "input[name='email']",
            "input[type='email']",
            "input#email",
            "input[name='username']",
            "input[autocomplete='username']",
        ],
        username,
    )
    if filled_email:
        click_first(
            page,
            [
                "button:has-text('Continue')",
                "button:has-text('Next')",
                "button:has-text('Log in')",
                "button:has-text('Sign in')",
                "input[type='submit']",
            ],
        )
        page.wait_for_timeout(1500)

    filled_password = fill_first(
        page,
        [
            "input[name='password']",
            "input[type='password']",
            "input#password",
            "input[autocomplete='current-password']",
        ],
        password,
    )
    if not filled_password:
        warnings.append("NYT login page did not expose a password field; continuing in case an existing session is available.")
        return

    click_first(
        page,
        [
            "button:has-text('Log in')",
            "button:has-text('Log In')",
            "button:has-text('Sign in')",
            "button:has-text('Sign In')",
            "button[type='submit']",
            "input[type='submit']",
        ],
        timeout=5000,
    )

    try:
        page.wait_for_load_state("networkidle", timeout=12000)
    except PlaywrightTimeoutError:
        warnings.append("NYT login did not reach network idle; continuing after form submission.")

    current_url = page.url.lower()
    if "login" in current_url:
        raise RuntimeError("NYT login did not complete. Verify the saved username, password, and subscription access.")


def collect_nyt_recipe_urls(page, pantry_ingredients: list[str], max_recipes: int, warnings: list[str]) -> list[str]:
    urls: list[str] = []
    for query in build_nyt_queries(pantry_ingredients, max_recipes):
        search_url = f"https://cooking.nytimes.com/search?q={quote_plus(query)}"
        page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except PlaywrightTimeoutError:
            warnings.append(f"NYT search for '{query}' did not reach network idle before parsing.")

        found = page.evaluate(
            """
            () => {
              const out = [];
              for (const article of document.querySelectorAll('article.card.recipe-card[data-url], article[data-url]')) {
                const url = article.getAttribute('data-url');
                if (url && url.includes('/recipes/')) out.push(url);
              }
              for (const anchor of document.querySelectorAll('a[href*="/recipes/"]')) {
                const href = anchor.getAttribute('href');
                if (href) out.push(href);
              }
              return out;
            }
            """
        )
        urls.extend(canonical_url(str(url)) for url in found)
        urls = unique_strings(urls, limit=max_recipes * 3)
        if len(urls) >= max_recipes:
            break

    return urls[: max(max_recipes * 2, max_recipes)]


def iter_json_nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_json_nodes(child)
    elif isinstance(value, list):
        for item in value:
            yield from iter_json_nodes(item)


def type_names(node: dict) -> set[str]:
    raw = node.get("@type") or node.get("type")
    if isinstance(raw, list):
        return {normalize_whitespace(str(item)).lower() for item in raw}
    return {normalize_whitespace(str(raw)).lower()} if raw else set()


def find_recipe_schema(page) -> dict | None:
    scripts = page.locator("script[type='application/ld+json']").all_text_contents()
    for script in scripts:
        try:
            payload = json.loads(script)
        except json.JSONDecodeError:
            continue
        for node in iter_json_nodes(payload):
            if "recipe" in type_names(node):
                return node
    return None


def coerce_string_list(value) -> list[str]:
    if isinstance(value, list):
        return unique_strings(str(item) for item in value)
    if isinstance(value, str):
        return unique_strings(re.split(r"[,;\n]+", value))
    return []


def extract_nyt_dom_recipe(page) -> dict:
    return page.evaluate(
        """
        () => {
          const text = (selector) => {
            const node = document.querySelector(selector);
            return node ? node.textContent.trim().replace(/\\s+/g, ' ') : '';
          };
          const texts = (selectors) => {
            const out = [];
            for (const selector of selectors) {
              for (const node of document.querySelectorAll(selector)) {
                const value = node.textContent.trim().replace(/\\s+/g, ' ');
                if (value) out.push(value);
              }
              if (out.length) break;
            }
            return out;
          };
          return {
            title: text('h1') || text('[data-testid="recipe-title"]'),
            ingredients: texts([
              '[data-testid="recipe-ingredients"] li',
              '[class*="ingredient"] li',
              '.ingredient_ingredient__li',
              'li[itemprop="recipeIngredient"]'
            ]),
            timeText: text('[data-testid="recipe-time"]') || text('[class*="time"]'),
            categories: texts([
              'a[href*="/tag/"]',
              'a[href*="/search?q="]',
              '[data-testid="recipe-tags"] a'
            ]),
            ratingText: text('[aria-label*="rating" i]') || text('[class*="rating"]'),
          };
        }
        """
    )


def normalize_nyt_recipe(page, url: str) -> dict | None:
    schema = find_recipe_schema(page)
    dom = extract_nyt_dom_recipe(page)
    title = normalize_whitespace(str((schema or {}).get("name") or dom.get("title") or ""))
    if not title:
        return None

    ingredients = coerce_string_list((schema or {}).get("recipeIngredient")) or unique_strings(dom.get("ingredients") or [])
    categories = coerce_string_list((schema or {}).get("recipeCategory"))
    categories.extend(coerce_string_list((schema or {}).get("keywords")))
    categories.extend(unique_strings(dom.get("categories") or [], limit=8))
    categories = unique_strings(categories, limit=12)

    total_time = (
        parse_duration_minutes((schema or {}).get("totalTime"))
        or parse_duration_minutes((schema or {}).get("cookTime"))
        or parse_duration_minutes(dom.get("timeText"))
    )
    rating = (schema or {}).get("aggregateRating") if isinstance((schema or {}).get("aggregateRating"), dict) else {}
    rating_value = parse_float(rating.get("ratingValue") or dom.get("ratingText"))
    rating_count = parse_int(rating.get("ratingCount") or rating.get("reviewCount"))

    return {
        "title": title,
        "url": canonical_url((schema or {}).get("url") or url),
        "ingredients": ingredients,
        "totalTimeMinutes": total_time,
        "ratingValue": rating_value,
        "ratingCount": rating_count,
        "categories": categories,
    }


def acquire_nyt_recipes(payload: dict, pantry_ingredients: list[str], max_recipes: int) -> dict:
    warnings: list[str] = []
    login = payload.get("login") if isinstance(payload.get("login"), dict) else {}
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    recipes: list[dict] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=bool(options.get("headless", True)),
            chromium_sandbox=False,
            args=[
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-default-apps",
                "--no-first-run",
                "--no-sandbox",
            ],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
        )
        context.route(
            "**/*",
            lambda route: route.abort()
            if route.request.resource_type in {"font", "image", "media"}
            else route.continue_(),
        )
        page = context.new_page()
        try:
            login_to_nyt(page, login, warnings)
            recipe_urls = collect_nyt_recipe_urls(page, pantry_ingredients, max_recipes, warnings)
            if not recipe_urls:
                warnings.append("NYT search returned no recipe URLs for the provided pantry ingredients.")

            for recipe_url in recipe_urls:
                if len(recipes) >= max_recipes:
                    break
                try:
                    page.goto(recipe_url, wait_until="domcontentloaded", timeout=45000)
                    try:
                        page.wait_for_load_state("networkidle", timeout=8000)
                    except PlaywrightTimeoutError:
                        pass
                    recipe = normalize_nyt_recipe(page, recipe_url)
                    if recipe:
                        recipes.append(recipe)
                    else:
                        warnings.append(f"NYT recipe page could not be parsed: {recipe_url}")
                except Exception as error:
                    warnings.append(f"NYT recipe page failed to load: {recipe_url} ({error})")
        finally:
            context.close()
            browser.close()

    return {
        "recipes": recipes,
        "scrapedCount": len(recipes),
        "warnings": warnings,
    }


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "meal-plan-scraper"})


@app.post("/internal/recipes/acquire")
def acquire():
    payload = request.get_json(silent=True) or {}
    source = normalize_whitespace(str(payload.get("source", ""))).lower()
    pantry_ingredients = [
        normalize_whitespace(str(item))
        for item in payload.get("pantryIngredients", [])
        if normalize_whitespace(str(item))
    ]
    max_recipes = int(payload.get("maxRecipes", 20) or 20)

    if source == "nytimes":
        try:
            return jsonify(acquire_nyt_recipes(payload, pantry_ingredients, max_recipes))
        except Exception as error:
            app.logger.error("NYT Cooking acquisition failed: %s\n%s", error, traceback.format_exc())
            return jsonify({"error": f"NYT Cooking acquisition failed: {error}"}), 400

    if source != "atk":
        return jsonify({"error": "Only ATK and NYT Cooking are supported in this scraper."}), 400

    recipes = build_mock_recipes(pantry_ingredients, max_recipes)
    return jsonify(
        {
            "recipes": recipes,
            "scrapedCount": len(recipes),
            "warnings": [
                "Scraper service is currently returning mock normalized candidates. Replace with live Playwright ATK acquisition next."
            ],
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5050")), debug=False)
