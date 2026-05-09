import { config } from "../config.js";
import type {
  PlanningRecipeCandidate,
  RecipeSourceId,
  ScraperAcquireRequest,
  ScraperAcquireResponse
} from "./mealPlanningTypes.js";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function buildScraperHeaders(baseUrl: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (!process.env.K_SERVICE) {
    return headers;
  }

  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
    `?audience=${encodeURIComponent(baseUrl)}`;

  const response = await fetch(metadataUrl, {
    headers: {
      "Metadata-Flavor": "Google"
    }
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Unable to obtain Cloud Run identity token for the scraper service (status ${response.status}${details ? `: ${normalizeWhitespace(details)}` : ""}).`
    );
  }

  const token = normalizeWhitespace(await response.text());
  if (!token) {
    throw new Error("Unable to obtain Cloud Run identity token for the scraper service.");
  }

  headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function summarizeScraperHealth(baseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      headers: await buildScraperHeaders(baseUrl)
    });
    const payload = await response.json().catch(() => null);
    const service =
      payload && typeof payload === "object" && typeof (payload as { service?: unknown }).service === "string"
        ? (payload as { service: string }).service
        : null;

    if (response.ok && service) {
      return `Health check responded with service "${service}".`;
    }

    if (response.ok) {
      return "Health check succeeded, but the service identity was not included in the response.";
    }

    return `Health check returned status ${response.status}.`;
  } catch (error) {
    return `Health check failed: ${error instanceof Error ? error.message : "unknown error"}.`;
  }
}

function buildMockRecipes(pantryIngredients: string[], maxRecipes: number): PlanningRecipeCandidate[] {
  const ingredients = pantryIngredients.slice(0, 6);
  const lead = ingredients[0] ?? "chicken";
  const support = ingredients[1] ?? "rice";
  const third = ingredients[2] ?? "garlic";

  const recipes: PlanningRecipeCandidate[] = [
    {
      title: `${lead} skillet with ${support}`,
      url: "https://example.invalid/recipes/skillet",
      ingredients: [lead, support, third, "olive oil", "salt", "pepper", "lemon"],
      totalTimeMinutes: 35,
      ratingValue: 4.6,
      ratingCount: 123,
      categories: ["skillet", "dinner", "weeknight"]
    },
    {
      title: `${lead} pasta with ${third}`,
      url: "https://example.invalid/recipes/pasta",
      ingredients: [lead, third, "pasta", "parmesan", "butter", "spinach"],
      totalTimeMinutes: 40,
      ratingValue: 4.4,
      ratingCount: 88,
      categories: ["pasta", "dinner"]
    },
    {
      title: `Sheet-pan ${lead} and vegetables`,
      url: "https://example.invalid/recipes/sheet-pan",
      ingredients: [lead, "broccoli", "carrots", "olive oil", "garlic", "potatoes"],
      totalTimeMinutes: 45,
      ratingValue: 4.7,
      ratingCount: 201,
      categories: ["sheet-pan", "dinner"]
    },
    {
      title: `${support} bowl with ${lead}`,
      url: "https://example.invalid/recipes/bowl",
      ingredients: [support, lead, "cucumber", "yogurt", "dill", "lemon"],
      totalTimeMinutes: 30,
      ratingValue: 4.2,
      ratingCount: 64,
      categories: ["bowl", "lunch", "dinner"]
    },
    {
      title: `Soup with ${lead} and ${third}`,
      url: "https://example.invalid/recipes/soup",
      ingredients: [lead, third, "broth", "onion", "celery", "carrots"],
      totalTimeMinutes: 55,
      ratingValue: 4.0,
      ratingCount: 49,
      categories: ["soup", "dinner"]
    },
    {
      title: `Salad with ${lead} and greens`,
      url: "https://example.invalid/recipes/salad",
      ingredients: [lead, "mixed greens", "tomatoes", "olive oil", "vinegar", "croutons"],
      totalTimeMinutes: 20,
      ratingValue: 4.1,
      ratingCount: 37,
      categories: ["salad", "lunch"]
    }
  ];

  return recipes.slice(0, Math.max(1, Math.min(maxRecipes, recipes.length)));
}

function normalizeRecipe(raw: any): PlanningRecipeCandidate | null {
  const title = normalizeWhitespace(String(raw?.title ?? ""));
  const url = normalizeWhitespace(String(raw?.url ?? ""));
  if (!title) {
    return null;
  }
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients
        .map((item: unknown) => normalizeWhitespace(String(item ?? "")))
        .filter(Boolean)
    : [];
  const categories = Array.isArray(raw?.categories)
    ? raw.categories
        .map((item: unknown) => normalizeWhitespace(String(item ?? "")))
        .filter(Boolean)
    : [];

  return {
    title,
    url,
    ingredients,
    totalTimeMinutes: typeof raw?.totalTimeMinutes === "number" ? raw.totalTimeMinutes : null,
    ratingValue: typeof raw?.ratingValue === "number" ? raw.ratingValue : null,
    ratingCount: typeof raw?.ratingCount === "number" ? raw.ratingCount : null,
    categories
  };
}

export class RecipeAcquisitionService {
  async acquireRecipes(input: ScraperAcquireRequest): Promise<ScraperAcquireResponse> {
    if (!config.mealPlanScraperUrl.trim()) {
      if (input.source !== "atk") {
        throw new Error(`${input.source} recipe acquisition requires MEAL_PLAN_SCRAPER_URL to point to the scraper service.`);
      }
      const recipes = buildMockRecipes(input.pantryIngredients, input.maxRecipes);
      return {
        recipes,
        scrapedCount: recipes.length,
        warnings: ["Using built-in mock recipe acquisition because MEAL_PLAN_SCRAPER_URL is not configured."]
      };
    }

    const scraperBaseUrl = config.mealPlanScraperUrl.replace(/\/$/, "");
    const acquireUrl = `${scraperBaseUrl}/internal/recipes/acquire`;
    let response: Response;

    try {
      const headers = await buildScraperHeaders(scraperBaseUrl);
      response = await fetch(acquireUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(input)
      });
    } catch (error) {
      console.error("Meal-plan scraper request failed before receiving a response.", {
        acquireUrl,
        configuredScraperBaseUrl: scraperBaseUrl,
        source: input.source,
        message: error instanceof Error ? error.message : "Unknown fetch error",
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error("Unable to reach the scraper service. Verify MEAL_PLAN_SCRAPER_URL and Cloud Run connectivity.");
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const healthSummary = response.status === 404 ? await summarizeScraperHealth(scraperBaseUrl) : null;
      console.error("Meal-plan scraper request returned a non-OK response.", {
        acquireUrl,
        configuredScraperBaseUrl: scraperBaseUrl,
        source: input.source,
        status: response.status,
        statusText: response.statusText,
        responsePayload: payload,
        healthSummary
      });
      const errorMessage =
        payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : response.status === 404
            ? "Scraper request failed with status 404. Verify MEAL_PLAN_SCRAPER_URL points to the scraper service and that /internal/recipes/acquire is deployed."
            : `Scraper request failed with status ${response.status}.`;
      throw new Error(healthSummary ? `${errorMessage} ${healthSummary}` : errorMessage);
    }

    const rawRecipes = Array.isArray((payload as { recipes?: unknown[] })?.recipes)
      ? (payload as { recipes: unknown[] }).recipes
      : [];
    const recipes = rawRecipes
      .map((item) => normalizeRecipe(item))
      .filter((item): item is PlanningRecipeCandidate => item !== null);

    return {
      recipes,
      scrapedCount:
        typeof (payload as { scrapedCount?: unknown })?.scrapedCount === "number"
          ? (payload as { scrapedCount: number }).scrapedCount
          : recipes.length,
      warnings: Array.isArray((payload as { warnings?: unknown[] })?.warnings)
        ? (payload as { warnings: unknown[] }).warnings.map((item) => normalizeWhitespace(String(item ?? ""))).filter(Boolean)
        : []
    };
  }
}

export const recipeAcquisitionService = new RecipeAcquisitionService();
