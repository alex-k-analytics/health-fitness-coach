import OpenAI from "openai";
import { config } from "../config.js";
import type {
  GroceryListItem,
  MealPlanPreferences,
  PlanningRecipeCandidate,
  RecipeReview,
  RecipeSourceId,
  SelectedMeal,
  WeeklyMealPlan
} from "./mealPlanningTypes.js";

const openai = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

const KID_UNFRIENDLY_TERMS = [
  "jalapeno",
  "habanero",
  "chipotle",
  "buffalo",
  "sriracha",
  "chili",
  "curry",
  "vodka",
  "wine",
  "beer"
];

const NON_MEAL_TERMS = [
  "dessert",
  "cookie",
  "cake",
  "brownie",
  "muffin",
  "snack",
  "appetizer",
  "dip",
  "drink"
];

const SHOPPING_CATEGORY_ORDER = [
  "Produce & Herbs",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bread & Bakery",
  "Pasta, Rice & Grains",
  "Canned & Packaged",
  "Frozen",
  "Spices & Seasonings",
  "Oils, Sauces & Condiments",
  "Pantry"
];

const PRODUCE_TOKENS = new Set(["onion", "garlic", "tomato", "lettuce", "spinach", "broccoli", "carrot", "cucumber", "herb", "lemon", "lime", "potato", "greens", "celery"]);
const PROTEIN_TOKENS = new Set(["chicken", "beef", "pork", "fish", "salmon", "shrimp", "turkey", "sausage", "egg"]);
const DAIRY_TOKENS = new Set(["milk", "cheese", "yogurt", "cream", "butter", "egg", "eggs", "parmesan"]);
const GRAIN_TOKENS = new Set(["pasta", "rice", "grain", "quinoa", "bread", "bun", "tortilla", "noodle"]);
const FROZEN_TOKENS = new Set(["frozen"]);
const SPICE_TOKENS = new Set(["salt", "pepper", "paprika", "cumin", "oregano", "basil", "spice", "seasoning"]);
const CONDIMENT_TOKENS = new Set(["oil", "vinegar", "mayo", "mustard", "soy", "sauce", "dressing"]);
const PACKAGED_TOKENS = new Set(["broth", "stock", "beans", "can", "canned", "package"]);

const selectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    selectedTitles: {
      type: "array",
      items: { type: "string" }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["selectedTitles", "notes"]
} as const;

const substitutionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    replacementTitle: { type: "string" },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["replacementTitle", "notes"]
} as const;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parsePantryIngredients(rawText: string) {
  const chunks = rawText.split(/[,;\n]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const item = normalizeWhitespace(chunk);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function composeInstructions(preferences: MealPlanPreferences, instructions: string) {
  const parts: string[] = [];
  if (preferences.dietaryRestrictions.trim()) {
    parts.push(`Dietary restrictions that apply to every plan:\n${preferences.dietaryRestrictions.trim()}`);
  }
  if (preferences.plannerContext.trim()) {
    parts.push(`Persistent planner context:\n${preferences.plannerContext.trim()}`);
  }
  if (instructions.trim()) {
    parts.push(`Run instructions:\n${instructions.trim()}`);
  }
  return parts.join("\n\n").trim();
}

function parseCriteriaProfile(instructions: string) {
  const lower = normalizeWhitespace(instructions).toLowerCase();
  const minuteMatch = lower.match(/(\d{1,3})\s*(?:minutes|minute|min)\b/);
  const maxMinutes = minuteMatch ? Number(minuteMatch[1]) : (/(quick|fast|weeknight)/.test(lower) ? 45 : null);
  const requireKidFriendly = /(kid friendly|kid-friendly|family friendly|family-friendly|kids|children)/.test(lower);
  const requireMainMeal = /(actual meal|main meal|main course|entree|not a side|not side|dinner|lunch)/.test(lower);
  const ratingMatch = lower.match(/(?:at\s*least|min(?:imum)?|above|>=?)\s*(\d(?:\.\d)?)\s*(?:stars?|rating)/);
  const minimumRating = ratingMatch ? Number(ratingMatch[1]) : null;

  return {
    raw: lower,
    maxMinutes,
    requireKidFriendly,
    requireMainMeal,
    minimumRating
  };
}

function reviewRecipe(recipe: PlanningRecipeCandidate, instructions: string): RecipeReview {
  const profile = parseCriteriaProfile(instructions);
  const notes: string[] = [];
  let score = 100;
  let hardFail = false;

  const combinedText = `${recipe.title} ${recipe.categories.join(" ")} ${recipe.ingredients.join(" ")}`.toLowerCase();

  if (profile.maxMinutes !== null) {
    if (recipe.totalTimeMinutes == null) {
      score -= 10;
      notes.push(`Time unavailable; could not verify <= ${profile.maxMinutes} minutes.`);
    } else if (recipe.totalTimeMinutes <= profile.maxMinutes) {
      notes.push(`Estimated ${recipe.totalTimeMinutes} min fits <= ${profile.maxMinutes} min target.`);
    } else {
      hardFail = true;
      score -= 45;
      notes.push(`Estimated ${recipe.totalTimeMinutes} min exceeds ${profile.maxMinutes} min limit.`);
    }
  }

  if (profile.requireKidFriendly) {
    const matched = KID_UNFRIENDLY_TERMS.filter((term) => combinedText.includes(term));
    if (matched.length > 0) {
      hardFail = true;
      score -= 30;
      notes.push(`Potentially not kid-friendly due to: ${matched.slice(0, 4).join(", ")}.`);
    } else {
      notes.push("No obvious spicy or alcohol-forward cues; likely kid-friendly.");
    }
  }

  if (profile.requireMainMeal) {
    const matched = NON_MEAL_TERMS.filter((term) => combinedText.includes(term));
    if (matched.length > 0) {
      hardFail = true;
      score -= 35;
      notes.push(`Looks like a non-main dish: ${matched.slice(0, 3).join(", ")}.`);
    } else {
      notes.push("Appears to be a main-meal recipe.");
    }
  }

  if (profile.minimumRating !== null) {
    if (recipe.ratingValue == null) {
      score -= 10;
      notes.push(`Rating unavailable; could not verify >= ${profile.minimumRating.toFixed(1)}.`);
    } else if (recipe.ratingValue < profile.minimumRating) {
      hardFail = true;
      score -= 25;
      notes.push(`Rating ${recipe.ratingValue.toFixed(1)} below minimum ${profile.minimumRating.toFixed(1)}.`);
    } else {
      notes.push(`Rating ${recipe.ratingValue.toFixed(1)} meets minimum ${profile.minimumRating.toFixed(1)}.`);
    }
  }

  if (notes.length === 0) {
    notes.push("No additional instruction criteria provided.");
  }

  return {
    title: recipe.title,
    url: recipe.url,
    fitsCriteria: !hardFail && score >= 50,
    criteriaScore: Math.max(0, Math.min(100, score)),
    reasons: notes,
    estimatedTotalTimeMinutes: recipe.totalTimeMinutes ?? null,
    ratingValue: recipe.ratingValue ?? null,
    categories: recipe.categories
  };
}

function buildReviews(recipes: PlanningRecipeCandidate[], instructions: string) {
  return recipes.map((recipe) => reviewRecipe(recipe, instructions));
}

function buildMealFromRecipe(recipe: PlanningRecipeCandidate, pantryIngredients: string[], review: RecipeReview | undefined): SelectedMeal {
  const pantryTokens = new Set(pantryIngredients.flatMap((item) => tokenize(item)));
  const matchingIngredients: string[] = [];
  const missingIngredients: string[] = [];

  for (const ingredient of recipe.ingredients) {
    const tokens = tokenize(ingredient);
    const matches = tokens.some((token) => pantryTokens.has(token));
    if (matches) {
      matchingIngredients.push(ingredient);
    } else {
      missingIngredients.push(ingredient);
    }
  }

  const overlapScore = recipe.ingredients.length > 0 ? matchingIngredients.length / recipe.ingredients.length : 0;
  const criteriaComponent = (review?.criteriaScore ?? 100) / 100;
  const score = Math.max(0, Math.min(100, Math.round((overlapScore * 70 + criteriaComponent * 30) * 100)));

  return {
    title: recipe.title,
    url: recipe.url,
    score,
    matchingIngredients: matchingIngredients.slice(0, 8),
    missingIngredients,
    reasoning: `Strongest pantry overlap is ${matchingIngredients.slice(0, 3).join(", ") || "limited"} with ${missingIngredients.length} grocery additions needed.`,
    criteriaFit: review?.fitsCriteria ?? true,
    criteriaNotes: review?.reasons.slice(0, 4) ?? [],
    estimatedTotalTimeMinutes: recipe.totalTimeMinutes ?? null,
    ratingValue: recipe.ratingValue ?? null,
    categories: recipe.categories
  };
}

function pickHeuristicMeals(
  pantryIngredients: string[],
  recipes: PlanningRecipeCandidate[],
  reviews: RecipeReview[],
  maxMeals: number
) {
  const reviewMap = new Map(reviews.map((review) => [review.url || review.title.toLowerCase(), review]));
  const ranked = recipes
    .map((recipe) => buildMealFromRecipe(recipe, pantryIngredients, reviewMap.get(recipe.url || recipe.title.toLowerCase())))
    .sort((a, b) => b.score - a.score || Number(b.criteriaFit) - Number(a.criteriaFit) || a.title.localeCompare(b.title));

  const selected: SelectedMeal[] = [];
  const usedStyles = new Set<string>();
  for (const meal of ranked) {
    const style = meal.categories[0]?.toLowerCase() ?? "";
    if (selected.length < maxMeals && (!style || !usedStyles.has(style) || selected.length + 2 >= maxMeals)) {
      selected.push(meal);
      if (style) usedStyles.add(style);
    }
    if (selected.length >= maxMeals) break;
  }

  return selected;
}

function ingredientKey(text: string) {
  return tokenize(text).slice(0, 8).join(" ");
}

function classifyCategory(text: string) {
  const tokens = new Set(tokenize(text));
  if (Array.from(tokens).some((token) => FROZEN_TOKENS.has(token))) return "Frozen";
  if (Array.from(tokens).some((token) => PROTEIN_TOKENS.has(token))) return "Meat & Seafood";
  if (Array.from(tokens).some((token) => PRODUCE_TOKENS.has(token))) return "Produce & Herbs";
  if (Array.from(tokens).some((token) => DAIRY_TOKENS.has(token))) return "Dairy & Eggs";
  if (Array.from(tokens).some((token) => GRAIN_TOKENS.has(token))) return "Pasta, Rice & Grains";
  if (Array.from(tokens).some((token) => SPICE_TOKENS.has(token))) return "Spices & Seasonings";
  if (Array.from(tokens).some((token) => CONDIMENT_TOKENS.has(token))) return "Oils, Sauces & Condiments";
  if (Array.from(tokens).some((token) => PACKAGED_TOKENS.has(token))) return "Canned & Packaged";
  return "Pantry";
}

function buildGroceryList(selectedMeals: SelectedMeal[]): GroceryListItem[] {
  const aggregate = new Map<string, GroceryListItem>();
  for (const meal of selectedMeals) {
    for (const ingredient of meal.missingIngredients) {
      const key = ingredientKey(ingredient);
      if (!key) continue;
      const existing = aggregate.get(key);
      if (existing) {
        existing.recipes = Array.from(new Set([...existing.recipes, meal.title]));
        existing.note = existing.recipes.length > 1 ? "Used in multiple selected meals." : "";
        continue;
      }
      aggregate.set(key, {
        item: normalizeWhitespace(ingredient),
        category: classifyCategory(ingredient),
        recipes: [meal.title],
        note: ""
      });
    }
  }

  const items = Array.from(aggregate.values()).map((item) => ({
    ...item,
    note: item.recipes.length > 1 ? "Used in multiple selected meals." : ""
  }));
  items.sort((a, b) => {
    const categoryDelta = SHOPPING_CATEGORY_ORDER.indexOf(a.category) - SHOPPING_CATEGORY_ORDER.indexOf(b.category);
    return (Number.isNaN(categoryDelta) ? 999 : categoryDelta) || a.item.localeCompare(b.item);
  });
  return items;
}

async function runOpenAiSelection(
  pantryIngredients: string[],
  instructions: string,
  recipes: PlanningRecipeCandidate[],
  reviews: RecipeReview[],
  maxMeals: number
) {
  if (!openai) return null;

  const response = await openai.responses.create({
    model: config.openAiModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "You are selecting a weekly meal plan.",
              "Use the recipe reviews and pantry overlap to pick a practical weekly set.",
              "Prefer diverse meal styles when possible.",
              `Pantry ingredients: ${JSON.stringify(pantryIngredients)}`,
              `Instructions: ${instructions || "none"}`,
              `Max meals: ${maxMeals}`,
              `Recipes: ${JSON.stringify(recipes)}`,
              `Reviews: ${JSON.stringify(reviews)}`
            ].join("\n")
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "meal_plan_selection",
        strict: true,
        schema: selectionSchema
      }
    }
  } as never);

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText) {
    return null;
  }
  return JSON.parse(outputText) as { selectedTitles: string[]; notes: string[] };
}

async function runOpenAiSubstitution(
  pantryIngredients: string[],
  instructions: string,
  currentMeals: SelectedMeal[],
  candidateMeals: SelectedMeal[]
) {
  if (!openai) return null;

  const response = await openai.responses.create({
    model: config.openAiModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Choose the best single replacement meal.",
              `Pantry ingredients: ${JSON.stringify(pantryIngredients)}`,
              `Instructions: ${instructions || "none"}`,
              `Current meals: ${JSON.stringify(currentMeals)}`,
              `Candidate meals: ${JSON.stringify(candidateMeals)}`
            ].join("\n")
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "meal_plan_substitution",
        strict: true,
        schema: substitutionSchema
      }
    }
  } as never);

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText) {
    return null;
  }
  return JSON.parse(outputText) as { replacementTitle: string; notes: string[] };
}

function serializeTitleKey(title: string, url: string) {
  return normalizeWhitespace(url || title).toLowerCase();
}

function mapSelectedTitlesToMeals(
  titles: string[],
  recipes: PlanningRecipeCandidate[],
  pantryIngredients: string[],
  reviews: RecipeReview[]
) {
  const reviewMap = new Map(reviews.map((review) => [review.url || review.title.toLowerCase(), review]));
  const byTitle = new Map(recipes.map((recipe) => [recipe.title.toLowerCase(), recipe]));
  const selected: SelectedMeal[] = [];
  for (const title of titles) {
    const recipe = byTitle.get(title.toLowerCase());
    if (!recipe) continue;
    const review = reviewMap.get(recipe.url || recipe.title.toLowerCase());
    selected.push(buildMealFromRecipe(recipe, pantryIngredients, review));
  }
  return selected;
}

export class MealPlanningService {
  parsePantryIngredients(rawText: string) {
    return parsePantryIngredients(rawText);
  }

  composeInstructions(preferences: MealPlanPreferences, instructions: string) {
    return composeInstructions(preferences, instructions);
  }

  async buildPlan(input: {
    pantryIngredients: string[];
    recipeSources: RecipeSourceId[];
    recipes: PlanningRecipeCandidate[];
    instructions: string;
    maxMeals: number;
    useOpenAi: boolean;
  }): Promise<WeeklyMealPlan> {
    const pantryIngredients = input.pantryIngredients.map((item) => normalizeWhitespace(item)).filter(Boolean);
    const reviews = buildReviews(input.recipes, input.instructions);
    const fitRecipes = input.recipes.filter((recipe) => {
      const review = reviews.find((item) => serializeTitleKey(item.title, item.url) === serializeTitleKey(recipe.title, recipe.url));
      return review?.fitsCriteria ?? true;
    });
    const candidateRecipes = fitRecipes.length >= input.maxMeals ? fitRecipes : input.recipes;

    let selectedMeals = pickHeuristicMeals(pantryIngredients, candidateRecipes, reviews, input.maxMeals);
    const notes: string[] = [];

    if (input.useOpenAi && openai) {
      try {
        const selected = await runOpenAiSelection(pantryIngredients, input.instructions, candidateRecipes.slice(0, 16), reviews, input.maxMeals);
        if (selected) {
          const mapped = mapSelectedTitlesToMeals(selected.selectedTitles, candidateRecipes, pantryIngredients, reviews);
          if (mapped.length > 0) {
            selectedMeals = mapped.slice(0, input.maxMeals);
          }
          notes.push(...selected.notes.slice(0, 3));
        }
      } catch (error) {
        notes.push(`OpenAI planner fallback used: ${error instanceof Error ? error.message : "Unknown planner error"}`);
      }
    } else {
      notes.push("OpenAI planning disabled or unavailable; heuristic ranking used.");
    }

    const groceryList = buildGroceryList(selectedMeals);
    notes.push("Grocery list was rebuilt from missing ingredients across selected meals.");

    return {
      pantryIngredients,
      recipeSources: input.recipeSources,
      agentInstructions: input.instructions,
      reviewedRecipes: reviews,
      selectedMeals,
      groceryList,
      notes
    };
  }

  async reshuffle(input: {
    pantryIngredients: string[];
    recipeSources: RecipeSourceId[];
    recipes: PlanningRecipeCandidate[];
    currentPlan: WeeklyMealPlan;
    replacedTitle: string;
    replacedUrl: string;
    useOpenAi: boolean;
  }): Promise<WeeklyMealPlan> {
    const currentKey = serializeTitleKey(input.replacedTitle, input.replacedUrl);
    const remainingMeals = input.currentPlan.selectedMeals.filter((meal) => serializeTitleKey(meal.title, meal.url) !== currentKey);
    const excludedKeys = new Set(input.currentPlan.selectedMeals.map((meal) => serializeTitleKey(meal.title, meal.url)));
    const reviews = buildReviews(input.recipes, input.currentPlan.agentInstructions);
    const reviewMap = new Map(reviews.map((review) => [review.url || review.title.toLowerCase(), review]));

    const candidates = input.recipes
      .filter((recipe) => !excludedKeys.has(serializeTitleKey(recipe.title, recipe.url)))
      .map((recipe) => buildMealFromRecipe(recipe, input.pantryIngredients, reviewMap.get(recipe.url || recipe.title.toLowerCase())))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 5);

    if (candidates.length === 0) {
      throw new Error("No substitute recipes were available for reshuffle.");
    }

    let chosen = candidates[0];
    const notes = [...input.currentPlan.notes];
    if (input.useOpenAi && openai) {
      try {
        const selected = await runOpenAiSubstitution(input.pantryIngredients, input.currentPlan.agentInstructions, remainingMeals, candidates);
        if (selected) {
          const match = candidates.find((meal) => meal.title.toLowerCase() === selected.replacementTitle.toLowerCase());
          if (match) {
            chosen = match;
          }
          notes.push(...selected.notes.slice(0, 3));
        }
      } catch (error) {
        notes.push(`OpenAI reshuffle fallback used: ${error instanceof Error ? error.message : "Unknown planner error"}`);
      }
    }

    const selectedMeals = input.currentPlan.selectedMeals.map((meal) =>
      serializeTitleKey(meal.title, meal.url) === currentKey ? chosen : meal
    );
    notes.push(`Reshuffle replaced ${input.replacedTitle} with ${chosen.title}.`);

    return {
      pantryIngredients: input.currentPlan.pantryIngredients,
      recipeSources: input.currentPlan.recipeSources,
      agentInstructions: input.currentPlan.agentInstructions,
      reviewedRecipes: reviews,
      selectedMeals,
      groceryList: buildGroceryList(selectedMeals),
      notes
    };
  }
}

export const mealPlanningService = new MealPlanningService();
