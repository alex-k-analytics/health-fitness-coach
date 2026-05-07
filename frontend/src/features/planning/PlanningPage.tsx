import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  GroceryListItem,
  MealPlanRunSummary,
  MealPlanSelectedMeal,
  RecipeSourceCredential
} from "@/types";
import {
  useCreateMealPlanRunMutation,
  useDeleteMealPlanRunMutation,
  useDeleteRecipeSourceMutation,
  useMealPlanPreferencesQuery,
  useMealPlanRunQuery,
  useMealPlanRunsQuery,
  useMealPlanStatusQuery,
  useRecipeSourcesQuery,
  useReshuffleMealPlanMutation,
  useSaveRecipeSourceMutation,
  useUpdateMealPlanPreferencesMutation
} from "./hooks";
import { formatDateTime, valueToInput } from "@/lib/mealUtils";

type SourceDraft = {
  username: string;
  loginUrl: string;
  enabled: boolean;
  password: string;
  clearPassword: boolean;
};

function sourceDraftFromSource(source: RecipeSourceCredential): SourceDraft {
  return {
    username: source.username,
    loginUrl: source.loginUrl || source.defaultLoginUrl,
    enabled: source.enabled,
    password: "",
    clearPassword: false
  };
}

function localStorageKey(runId: string) {
  return `meal-plan-checked-items:${runId}`;
}

function loadCheckedItems(runId: string) {
  try {
    const raw = window.localStorage.getItem(localStorageKey(runId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set<string>();
  }
}

function saveCheckedItems(runId: string, checkedItems: Set<string>) {
  window.localStorage.setItem(localStorageKey(runId), JSON.stringify(Array.from(checkedItems)));
}

function clearCheckedItems(runId: string) {
  window.localStorage.removeItem(localStorageKey(runId));
}

function groceryItemKey(item: GroceryListItem) {
  return `${item.item.toLowerCase()}|${item.category.toLowerCase()}`;
}

export function PlanningPage() {
  const { data: preferences } = useMealPlanPreferencesQuery();
  const { data: sources } = useRecipeSourcesQuery();
  const { data: runs } = useMealPlanRunsQuery();
  const savePreferences = useUpdateMealPlanPreferencesMutation();
  const saveSource = useSaveRecipeSourceMutation();
  const deleteSource = useDeleteRecipeSourceMutation();
  const createRun = useCreateMealPlanRunMutation();
  const deleteRun = useDeleteMealPlanRunMutation();
  const reshuffleRun = useReshuffleMealPlanMutation();

  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxRecipes, setMaxRecipes] = useState("20");
  const [maxMeals, setMaxMeals] = useState("5");
  const [useOpenAi, setUseOpenAi] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [sourceDrafts, setSourceDrafts] = useState<Record<string, SourceDraft>>({});
  const [preferencesDraft, setPreferencesDraft] = useState({
    dietaryRestrictions: "",
    plannerContext: "",
    defaultMaxRecipes: "",
    defaultMaxMeals: "",
    defaultUseOpenAi: true
  });
  const [hideChecked, setHideChecked] = useState(false);
  const [checkedVersion, setCheckedVersion] = useState(0);

  const statusQuery = useMealPlanStatusQuery(selectedRunId, Boolean(selectedRunId));
  const runDetailQuery = useMealPlanRunQuery(selectedRunId);

  useEffect(() => {
    if (!preferences) return;
    setPreferencesDraft({
      dietaryRestrictions: preferences.dietaryRestrictions,
      plannerContext: preferences.plannerContext,
      defaultMaxRecipes: valueToInput(preferences.defaultMaxRecipes),
      defaultMaxMeals: valueToInput(preferences.defaultMaxMeals),
      defaultUseOpenAi: preferences.defaultUseOpenAi ?? true
    });
    setMaxRecipes(valueToInput(preferences.defaultMaxRecipes ?? 20));
    setMaxMeals(valueToInput(preferences.defaultMaxMeals ?? 5));
    setUseOpenAi(preferences.defaultUseOpenAi ?? true);
  }, [preferences]);

  useEffect(() => {
    const sourceList = sources?.sources ?? [];
    if (sourceList.length === 0) return;
    setSourceDrafts((current) => {
      const next = { ...current };
      for (const source of sourceList) {
        if (!next[source.source]) {
          next[source.source] = sourceDraftFromSource(source);
        }
      }
      return next;
    });
  }, [sources]);

  useEffect(() => {
    const nextRuns = runs?.runs ?? [];
    if (nextRuns.length === 0) {
      if (selectedRunId !== null) {
        setSelectedRunId(null);
      }
      return;
    }
    if (!selectedRunId || !nextRuns.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(nextRuns[0]?.id ?? null);
    }
  }, [runs, selectedRunId]);

  const runDetail = runDetailQuery.data;
  const currentStatus = statusQuery.data;
  const activeRun = runDetail && runDetail.id === selectedRunId ? runDetail : null;
  const activePlan = activeRun?.plan ?? null;
  const availableSources = sources?.sources ?? [];
  const selectedPlanningSources = availableSources
    .filter((source) => source.supportedForPlanning && source.enabled && source.username && source.hasPassword)
    .map((source) => source.source);

  const checkedItems = useMemo(
    () => (activeRun ? loadCheckedItems(activeRun.id) : new Set<string>()),
    [activeRun?.id, checkedVersion]
  );

  const visibleGroceryItems = useMemo(() => {
    const items = activePlan?.groceryList ?? [];
    if (!activeRun) return items;
    if (!hideChecked) return items;
    return items.filter((item) => !checkedItems.has(groceryItemKey(item)));
  }, [activePlan?.groceryList, checkedItems, hideChecked, activeRun]);

  useEffect(() => {
    if (!currentStatus) return;
    if (currentStatus.status === "COMPLETED" || currentStatus.status === "FAILED") {
      void runDetailQuery.refetch();
    }
  }, [currentStatus, runDetailQuery]);

  function updateSourceDraft(sourceId: string, patch: Partial<SourceDraft>) {
    setSourceDrafts((current) => ({
      ...current,
      [sourceId]: {
        ...current[sourceId],
        ...patch
      }
    }));
  }

  function submitPlan() {
    createRun.mutate(
      {
        ingredients,
        instructions,
        recipeSources: selectedPlanningSources.length > 0 ? selectedPlanningSources : ["atk"],
        maxRecipes: Number(maxRecipes || 20),
        maxMeals: Number(maxMeals || 5),
        useOpenAi
      },
      {
        onSuccess: (result) => {
          setSelectedRunId(result.runId);
        }
      }
    );
  }

  function savePreferencesForm() {
    savePreferences.mutate({
      dietaryRestrictions: preferencesDraft.dietaryRestrictions,
      plannerContext: preferencesDraft.plannerContext,
      defaultMaxRecipes: preferencesDraft.defaultMaxRecipes ? Number(preferencesDraft.defaultMaxRecipes) : null,
      defaultMaxMeals: preferencesDraft.defaultMaxMeals ? Number(preferencesDraft.defaultMaxMeals) : null,
      defaultUseOpenAi: preferencesDraft.defaultUseOpenAi
    });
  }

  function saveSourceForm(source: RecipeSourceCredential) {
    const draft = sourceDrafts[source.source];
    if (!draft) return;
    saveSource.mutate({
      source: source.source,
      body: {
        username: draft.username,
        loginUrl: draft.loginUrl,
        enabled: draft.enabled,
        password: draft.password || undefined,
        clearPassword: draft.clearPassword
      }
    });
  }

  function openRun(run: MealPlanRunSummary) {
    setSelectedRunId(run.id);
    setIngredients(run.ingredientsPreview.join("\n"));
  }

  function deleteHistoricalRun(run: MealPlanRunSummary) {
    if (run.status === "PENDING" || run.status === "RUNNING") {
      return;
    }
    const confirmed = window.confirm(
      `Delete the planning run from ${formatDateTime(run.createdAt)}? This cannot be undone.`
    );
    if (!confirmed) return;

    deleteRun.mutate(run.id, {
      onSuccess: () => {
        clearCheckedItems(run.id);
        if (selectedRunId === run.id) {
          const nextRun = (runs?.runs ?? []).find((candidate) => candidate.id !== run.id) ?? null;
          setSelectedRunId(nextRun?.id ?? null);
        }
      }
    });
  }

  function reshuffleMeal(meal: MealPlanSelectedMeal) {
    if (!activeRun) return;
    reshuffleRun.mutate(
      { runId: activeRun.id, title: meal.title, url: meal.url },
      {
        onSuccess: (result) => {
          setSelectedRunId(result.id);
        }
      }
    );
  }

  function toggleChecked(item: GroceryListItem, nextChecked: boolean) {
    if (!activeRun) return;
    const next = loadCheckedItems(activeRun.id);
    const key = groceryItemKey(item);
    if (nextChecked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    saveCheckedItems(activeRun.id, next);
    setCheckedVersion((current) => current + 1);
  }

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
        <p className="text-sm text-muted-foreground">
          Build a weekly meal plan from pantry ingredients, reviewed recipes, and a grocery list.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Build Weekly Plan</CardTitle>
              <CardDescription>ATK is the only live planning source supported in this MVP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="planning-ingredients">Pantry ingredients</Label>
                <Textarea
                  id="planning-ingredients"
                  value={ingredients}
                  onChange={(event) => setIngredients(event.target.value)}
                  placeholder={"chicken breast\nlemons\ngarlic\nolive oil\nrice"}
                  rows={6}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planning-instructions">Weekly instructions</Label>
                <Textarea
                  id="planning-instructions"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Kid friendly, under 45 minutes, and actual meals not sides."
                  rows={4}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="planning-max-recipes">Recipe results to scan</Label>
                  <Input
                    id="planning-max-recipes"
                    value={maxRecipes}
                    onChange={(event) => setMaxRecipes(event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="planning-max-meals">Meals for week</Label>
                  <Input
                    id="planning-max-meals"
                    value={maxMeals}
                    onChange={(event) => setMaxMeals(event.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useOpenAi}
                  onChange={(event) => setUseOpenAi(event.target.checked)}
                />
                Use OpenAI planning
              </label>
              <Button
                onClick={submitPlan}
                disabled={!ingredients.trim() || createRun.isPending}
              >
                {createRun.isPending ? "Starting..." : "Start Planning Run"}
              </Button>
              {selectedPlanningSources.length === 0 ? (
                <p className="text-sm text-amber-700">
                  Configure and enable an ATK source with a saved password below to run live planning.
                </p>
              ) : null}
              {currentStatus ? (
                <div className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{currentStatus.progressStage || currentStatus.status}</strong>
                    <span>{currentStatus.progressPercent}%</span>
                  </div>
                  {currentStatus.errorMessage ? (
                    <p className="mt-2 text-red-600">{currentStatus.errorMessage}</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Results</CardTitle>
              <CardDescription>
                {activeRun
                  ? `${activeRun.status} · ${activeRun.scrapedCount} recipes scanned`
                  : "Select a run to inspect results."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!activeRun || !activePlan ? (
                <p className="text-sm text-muted-foreground">No completed meal plan selected yet.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Selected Meals</h3>
                      <Badge variant="outline">{activePlan.selectedMeals.length} meals</Badge>
                    </div>
                    <div className="space-y-3">
                      {activePlan.selectedMeals.map((meal) => (
                        <div key={`${meal.title}-${meal.url}`} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{meal.title}</div>
                              <div className="text-sm text-muted-foreground">
                                Score {meal.score}
                                {meal.estimatedTotalTimeMinutes ? ` · ${meal.estimatedTotalTimeMinutes} min` : ""}
                                {meal.ratingValue ? ` · rating ${meal.ratingValue.toFixed(1)}` : ""}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => reshuffleMeal(meal)}>
                              Reshuffle
                            </Button>
                          </div>
                          {meal.reasoning ? <p className="mt-2 text-sm">{meal.reasoning}</p> : null}
                          {meal.criteriaNotes.length > 0 ? (
                            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                              {meal.criteriaNotes.slice(0, 3).map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Grocery List</h3>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={hideChecked}
                          onChange={(event) => setHideChecked(event.target.checked)}
                        />
                        Hide checked
                      </label>
                    </div>
                    {visibleGroceryItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No visible grocery items.</p>
                    ) : (
                      <div className="space-y-3">
                        {visibleGroceryItems.map((item) => {
                          const key = groceryItemKey(item);
                          const checked = activeRun ? checkedItems.has(key) : false;
                          return (
                            <label key={key} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => toggleChecked(item, event.target.checked)}
                              />
                              <div>
                                <div className="font-medium">{item.item}</div>
                                <div className="text-muted-foreground">
                                  {item.category}
                                  {item.recipes.length > 0 ? ` · for ${item.recipes.join(", ")}` : ""}
                                  {item.note ? ` · ${item.note}` : ""}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold">Reviewed Recipes</h3>
                    <div className="space-y-2">
                      {activePlan.reviewedRecipes.slice(0, 18).map((review) => (
                        <div key={`${review.title}-${review.url}`} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{review.title}</span>
                            <Badge variant={review.fitsCriteria ? "success" : "secondary"}>
                              {review.fitsCriteria ? "fit" : "not fit"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            Score {review.criteriaScore}
                            {review.estimatedTotalTimeMinutes ? ` · ${review.estimatedTotalTimeMinutes} min` : ""}
                            {review.ratingValue ? ` · rating ${review.ratingValue.toFixed(1)}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Planning Preferences</CardTitle>
              <CardDescription>Persistent restrictions and planner context applied to every run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="planning-dietary">Dietary restrictions</Label>
                <Textarea
                  id="planning-dietary"
                  value={preferencesDraft.dietaryRestrictions}
                  onChange={(event) => setPreferencesDraft((current) => ({ ...current, dietaryRestrictions: event.target.value }))}
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planning-context">Planner context</Label>
                <Textarea
                  id="planning-context"
                  value={preferencesDraft.plannerContext}
                  onChange={(event) => setPreferencesDraft((current) => ({ ...current, plannerContext: event.target.value }))}
                  rows={4}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="planning-default-max-recipes">Default max recipes</Label>
                  <Input
                    id="planning-default-max-recipes"
                    value={preferencesDraft.defaultMaxRecipes}
                    onChange={(event) => setPreferencesDraft((current) => ({ ...current, defaultMaxRecipes: event.target.value }))}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="planning-default-max-meals">Default max meals</Label>
                  <Input
                    id="planning-default-max-meals"
                    value={preferencesDraft.defaultMaxMeals}
                    onChange={(event) => setPreferencesDraft((current) => ({ ...current, defaultMaxMeals: event.target.value }))}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={preferencesDraft.defaultUseOpenAi}
                  onChange={(event) => setPreferencesDraft((current) => ({ ...current, defaultUseOpenAi: event.target.checked }))}
                />
                Default to OpenAI planning
              </label>
              <Button onClick={savePreferencesForm} disabled={savePreferences.isPending}>
                {savePreferences.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recipe Sources</CardTitle>
              <CardDescription>Save source credentials per account. Planning supports ATK only for now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableSources.map((source) => {
                const draft = sourceDrafts[source.source] ?? sourceDraftFromSource(source);
                return (
                  <div key={source.source} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{source.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {source.supportedForPlanning ? "Supported for planning" : "Stored only"}
                        </div>
                      </div>
                      <Badge variant={source.configured ? "outline" : "secondary"}>
                        {source.configured ? "configured" : "not configured"}
                      </Badge>
                    </div>
                    <div className="grid gap-2">
                      <Label>Username or email</Label>
                      <Input
                        value={draft.username}
                        onChange={(event) => updateSourceDraft(source.source, { username: event.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Login URL</Label>
                      <Input
                        value={draft.loginUrl}
                        onChange={(event) => updateSourceDraft(source.source, { loginUrl: event.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={draft.password}
                        onChange={(event) => updateSourceDraft(source.source, { password: event.target.value })}
                        placeholder={source.hasPassword ? "Saved password unchanged" : "Password"}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => updateSourceDraft(source.source, { enabled: event.target.checked })}
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.clearPassword}
                        onChange={(event) => updateSourceDraft(source.source, { clearPassword: event.target.checked })}
                      />
                      Clear saved password
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveSourceForm(source)}
                        disabled={saveSource.isPending}
                      >
                        Save Source
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteSource.mutate(source.source)}
                        disabled={deleteSource.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run History</CardTitle>
              <CardDescription>Saved planning runs for this account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(runs?.runs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No planning runs yet.</p>
              ) : (
                (runs?.runs ?? []).map((run) => (
                  <div
                    key={run.id}
                    className={`rounded-md border p-3 ${run.id === selectedRunId ? "border-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => openRun(run)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong>{formatDateTime(run.createdAt)}</strong>
                          <Badge
                            variant={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "destructive" : "outline"}
                          >
                            {run.status.toLowerCase()}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Sources: {run.recipeSources.join(", ") || "atk"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Ingredients: {run.ingredientsPreview.join(", ") || "none"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Meals: {run.selectedMeals.join(", ") || "none yet"}
                        </div>
                      </button>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        onClick={() => deleteHistoricalRun(run)}
                        disabled={
                          deleteRun.isPending ||
                          run.status === "PENDING" ||
                          run.status === "RUNNING"
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
