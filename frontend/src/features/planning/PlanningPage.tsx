import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, CircleAlert, Link as LinkIcon, NotebookText, Sparkles } from "lucide-react";
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

type PlanningStatus = MealPlanRunSummary["status"];

function planningStatusVariant(status: PlanningStatus) {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "RUNNING") return "brand";
  return "outline";
}

function planningStatusLabel(status: PlanningStatus) {
  if (status === "COMPLETED") return "Plan ready";
  if (status === "FAILED") return "Needs attention";
  if (status === "RUNNING") return "Planning in progress";
  return "Queued";
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
  const visibleStatus = currentStatus ?? activeRun;
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
    <div className="page-shell space-y-6">
      <Card className="bg-gradient-hero shadow-sm">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Badge variant="info" className="px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                Weekly Planner
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Pantry-first weekly planning</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Build a focused weekly plan from what you already have, review the strongest recipe matches,
                  and leave with a grocery list that stays tied to the week.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/20 bg-background/80 px-3 py-1 text-xs text-foreground">
                  Pantry overlap scoring
                </Badge>
                <Badge variant="outline" className="border-primary/20 bg-background/80 px-3 py-1 text-xs text-foreground">
                  Reviewed recipe shortlist
                </Badge>
                <Badge variant="outline" className="border-primary/20 bg-background/80 px-3 py-1 text-xs text-foreground">
                  Scratch-off grocery list
                </Badge>
              </div>
            </div>

            <div className="surface-panel p-4 backdrop-blur sm:min-w-[280px]">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Planning status
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {visibleStatus ? planningStatusLabel(visibleStatus.status) : "Ready for a new run"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeRun ? `${activeRun.scrapedCount} recipes scanned in this run` : "Configure a source and start a weekly plan."}
                  </p>
                </div>
                <Badge variant={visibleStatus ? planningStatusVariant(visibleStatus.status) : "outline"}>
                  {visibleStatus ? visibleStatus.status.toLowerCase() : "idle"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card className="bg-gradient-card card-accent-brand shadow-sm">
            <CardHeader>
              <CardTitle>Build Weekly Plan</CardTitle>
              <CardDescription>
                Start with pantry ingredients, add any weekly constraints, and review progress as the planner works.
              </CardDescription>
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
                <Checkbox
                  checked={useOpenAi}
                  onCheckedChange={(checked) => setUseOpenAi(checked === true)}
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
              {visibleStatus ? (
                <div className="surface-panel p-4 text-sm" aria-live="polite">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {visibleStatus.status === "COMPLETED" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden="true" />
                      ) : visibleStatus.status === "FAILED" ? (
                        <CircleAlert className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
                      ) : (
                        <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{visibleStatus.progressStage || visibleStatus.status}</p>
                        <p className="text-xs text-muted-foreground">{planningStatusLabel(visibleStatus.status)}</p>
                      </div>
                    </div>
                    <Badge variant={planningStatusVariant(visibleStatus.status)}>
                      {visibleStatus.progressPercent}%
                    </Badge>
                  </div>
                  <Progress
                    value={visibleStatus.progressPercent}
                    max={100}
                    className="mt-3 h-2 bg-primary/10"
                    aria-label={`Planning progress ${visibleStatus.progressPercent}%`}
                  />
                  {visibleStatus.progressDetail ? (
                    <p className="mt-3 leading-6 text-muted-foreground">{visibleStatus.progressDetail}</p>
                  ) : null}
                  {"updatedAt" in visibleStatus ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last updated {formatDateTime(visibleStatus.updatedAt)}
                    </p>
                  ) : null}
                  {visibleStatus.errorMessage ? (
                    <p className="mt-2 text-red-600" role="alert">{visibleStatus.errorMessage}</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card card-accent-top shadow-sm">
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
                        <div key={`${meal.title}-${meal.url}`} className="surface-panel p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-foreground">{meal.title}</div>
                              {meal.url ? (
                                <a
                                  href={meal.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                                >
                                  <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                  Open recipe
                                </a>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="outline">Score {meal.score}</Badge>
                                {meal.estimatedTotalTimeMinutes ? (
                                  <Badge variant="outline">{meal.estimatedTotalTimeMinutes} min</Badge>
                                ) : null}
                                {meal.ratingValue ? (
                                  <Badge variant="outline">Rating {meal.ratingValue.toFixed(1)}</Badge>
                                ) : null}
                                <Badge variant={meal.criteriaFit ? "success" : "secondary"}>
                                  {meal.criteriaFit ? "Fits instructions" : "Partial fit"}
                                </Badge>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => reshuffleMeal(meal)}>
                              Reshuffle
                            </Button>
                          </div>
                          {meal.reasoning ? <p className="mt-2 text-sm">{meal.reasoning}</p> : null}
                          {meal.matchingIngredients.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {meal.matchingIngredients.slice(0, 8).map((ingredient, index) => (
                                <Badge key={`${ingredient}-${index}`} variant="success">
                                  {ingredient}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {meal.criteriaNotes.length > 0 ? (
                            <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
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
                        <Checkbox
                          checked={hideChecked}
                          onCheckedChange={(checked) => setHideChecked(checked === true)}
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
                            <label key={key} className="surface-muted flex items-start gap-3 p-3 text-sm">
                              <Checkbox
                                className="mt-0.5"
                                checked={checked}
                                onCheckedChange={(nextChecked) => toggleChecked(item, nextChecked === true)}
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

                  {activePlan.notes.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <NotebookText className="h-4 w-4 text-info" aria-hidden="true" />
                        <h3 className="font-semibold">Planning Notes</h3>
                      </div>
                      <div className="space-y-2">
                        {activePlan.notes.map((note, index) => (
                          <div
                            key={`${index}-${note}`}
                            className="surface-muted border-info/20 bg-info/5 p-3 text-sm leading-6 text-muted-foreground"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <h3 className="font-semibold">Reviewed Recipes</h3>
                    <div className="space-y-2">
                      {activePlan.reviewedRecipes.slice(0, 18).map((review) => (
                        <div key={`${review.title}-${review.url}`} className="surface-panel p-4 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="font-medium text-foreground">{review.title}</span>
                              {review.url ? (
                                <a
                                  href={review.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                                >
                                  <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                  Open recipe
                                </a>
                              ) : null}
                            </div>
                            <Badge variant={review.fitsCriteria ? "success" : "secondary"}>
                              {review.fitsCriteria ? "fit" : "not fit"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-muted-foreground">
                            <Badge variant="outline">Score {review.criteriaScore}</Badge>
                            {review.estimatedTotalTimeMinutes ? (
                              <Badge variant="outline">{review.estimatedTotalTimeMinutes} min</Badge>
                            ) : null}
                            {review.ratingValue ? (
                              <Badge variant="outline">Rating {review.ratingValue.toFixed(1)}</Badge>
                            ) : null}
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
          <Card className="bg-gradient-card card-accent-accent shadow-sm">
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
                <Checkbox
                  checked={preferencesDraft.defaultUseOpenAi}
                  onCheckedChange={(checked) => setPreferencesDraft((current) => ({ ...current, defaultUseOpenAi: checked === true }))}
                />
                Default to OpenAI planning
              </label>
              <Button onClick={savePreferencesForm} disabled={savePreferences.isPending}>
                {savePreferences.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card card-accent-info shadow-sm">
            <CardHeader>
              <CardTitle>Recipe Sources</CardTitle>
              <CardDescription>Save source credentials per account. Planning supports ATK only for now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableSources.map((source) => {
                const draft = sourceDrafts[source.source] ?? sourceDraftFromSource(source);
                return (
                  <div key={source.source} className="surface-muted space-y-3 p-3">
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
                      <Checkbox
                        checked={draft.enabled}
                        onCheckedChange={(checked) => updateSourceDraft(source.source, { enabled: checked === true })}
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.clearPassword}
                        onCheckedChange={(checked) => updateSourceDraft(source.source, { clearPassword: checked === true })}
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

          <Card className="bg-gradient-card card-accent-success shadow-sm">
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
                    className={`surface-panel interactive-surface p-3 ${run.id === selectedRunId ? "border-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="flex-1 cursor-pointer text-left"
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
                        {run.progressDetail ? (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {run.progressDetail}
                          </div>
                        ) : null}
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
