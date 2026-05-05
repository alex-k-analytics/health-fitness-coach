from __future__ import annotations

import os

from flask import Flask, jsonify, request


app = Flask(__name__)


def normalize_whitespace(value: str) -> str:
    return " ".join(str(value or "").split()).strip()


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

    if source != "atk":
        return jsonify({"error": "Only ATK is supported in this scraper MVP."}), 400

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
