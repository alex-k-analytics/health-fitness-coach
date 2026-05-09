import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  History,
  Link as LinkIcon,
  NotebookText,
  Plus,
  RotateCw,
  Settings2,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed
} from "lucide-react";
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
import { formatReadinessIssues, getPlanningSourceReadiness } from "@/lib/recipeSources";

type SourceDraft = {
  username: string;
  loginUrl: string;
  enabled: boolean;
  password: string;
  clearPassword: boolean;
};

type PlannerView = "this-week" | "new-plan" | "history" | "settings";

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

  const [activeView, setActiveView] = useState<PlannerView>("this-week");
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
  const planningSources = availableSources.filter((source) => source.supportedForPlanning);
  const storedOnlySources = availableSources.filter((source) => !source.supportedForPlanning);
  const sourceReadiness = getPlanningSourceReadiness(availableSources);
  const selectedPlanningSources = sourceReadiness.readySources.map((source) => source.source);
  const sourceReady = sourceReadiness.ready;
  const runIsActive = visibleStatus?.status === "PENDING" || visibleStatus?.status === "RUNNING";
  const planningNeedsSetup = !sourceReady && !visibleStatus;
  const planningStatusValue = planningNeedsSetup
    ? "Setup required"
    : visibleStatus
      ? planningStatusLabel(visibleStatus.status)
      : "Ready";
  const planningStatusSub = planningNeedsSetup
    ? "Connect ATK source"
    : visibleStatus?.progressDetail ?? sourceReadiness.message;

  const checkedItems = useMemo(
    () => (activeRun ? loadCheckedItems(activeRun.id) : new Set<string>()),
    [activeRun?.id, checkedVersion]
  );

  const groceryTotal = activePlan?.groceryList.length ?? 0;
  const groceryChecked = activePlan?.groceryList.filter((item) => checkedItems.has(groceryItemKey(item))).length ?? 0;
  const groceryRemaining = Math.max(0, groceryTotal - groceryChecked);

  const visibleGroceryItems = useMemo(() => {
    const items = activePlan?.groceryList ?? [];
    if (!activeRun) return items;
    if (!hideChecked) return items;
    return items.filter((item) => !checkedItems.has(groceryItemKey(item)));
  }, [activePlan?.groceryList, checkedItems, hideChecked, activeRun]);

  const groceryGroups = useMemo(() => {
    const groups = new Map<string, GroceryListItem[]>();
    for (const item of visibleGroceryItems) {
      const category = item.category || "Other";
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  }, [visibleGroceryItems]);

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
        recipeSources: selectedPlanningSources,
        maxRecipes: Number(maxRecipes || 20),
        maxMeals: Number(maxMeals || 5),
        useOpenAi
      },
      {
        onSuccess: (result) => {
          setSelectedRunId(result.runId);
          setActiveView("this-week");
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
    setActiveView("this-week");
  }

  function useSelectedRunAsDraft() {
    if (!activeRun) return;
    setIngredients(activeRun.request.ingredients);
    setInstructions(activeRun.request.instructions);
    setMaxRecipes(valueToInput(activeRun.request.maxRecipes));
    setMaxMeals(valueToInput(activeRun.request.maxMeals));
    setUseOpenAi(activeRun.request.useOpenAi);
    setActiveView("new-plan");
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
          setActiveView("this-week");
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

  function clearCurrentChecklist() {
    if (!activeRun) return;
    clearCheckedItems(activeRun.id);
    setCheckedVersion((current) => current + 1);
  }

  function renderSourceEditor(source: RecipeSourceCredential) {
    const draft = sourceDrafts[source.source] ?? sourceDraftFromSource(source);
    const usernameId = `source-${source.source}-username`;
    const loginUrlId = `source-${source.source}-login-url`;
    const passwordId = `source-${source.source}-password`;

    return (
      <div key={source.source} className="surface-muted space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">{source.label}</div>
            <div className="text-sm text-muted-foreground">
              {source.planningReady
                ? "Ready for planning"
                : source.supportedForPlanning
                  ? formatReadinessIssues(source.planningReadinessIssues)
                  : "Stored only"}
            </div>
          </div>
          <Badge variant={source.planningReady ? "success" : source.configured ? "outline" : "secondary"}>
            {source.planningReady ? "ready" : source.configured ? "configured" : "not configured"}
          </Badge>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={usernameId}>Username or email</Label>
          <Input
            id={usernameId}
            value={draft.username}
            onChange={(event) => updateSourceDraft(source.source, { username: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={loginUrlId}>Login URL</Label>
          <Input
            id={loginUrlId}
            value={draft.loginUrl}
            onChange={(event) => updateSourceDraft(source.source, { loginUrl: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={passwordId}>Password</Label>
          <Input
            id={passwordId}
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
            Save source
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
  }

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <Badge variant="info" className="mb-3 px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
            Weekly Planner
          </Badge>
          <h1 className="page-title">Pantry-first weekly planning</h1>
          <p className="page-description">
            Build a plan from what you have, keep the winning meals, and shop the remaining ingredients from one weekly list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveView("history")}>
            <History className="h-4 w-4" />
            History
          </Button>
          <Button size="sm" onClick={() => setActiveView("new-plan")}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatusMetric
          icon={ShoppingBasket}
          label="Groceries left"
          value={activePlan ? String(groceryRemaining) : "-"}
          sub={activePlan ? `${groceryChecked} of ${groceryTotal} checked` : "No completed plan selected"}
        />
        <StatusMetric
          icon={UtensilsCrossed}
          label="Meals"
          value={activePlan ? String(activePlan.selectedMeals.length) : "-"}
          sub={activeRun ? `${activeRun.scrapedCount} recipes scanned` : "Start or open a plan"}
        />
        <StatusMetric
          icon={Sparkles}
          label="Status"
          value={planningStatusValue}
          sub={planningStatusSub}
          status={visibleStatus?.status}
          tone={planningNeedsSetup ? "warning" : "brand"}
        />
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as PlannerView)} className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto p-1 sm:grid sm:grid-cols-4">
          <TabsTrigger value="this-week" className="min-w-32 sm:min-w-0">
            <ShoppingBasket className="h-4 w-4" />
            This week
          </TabsTrigger>
          <TabsTrigger value="new-plan" className="min-w-32 sm:min-w-0">
            <ClipboardList className="h-4 w-4" />
            New plan
          </TabsTrigger>
          <TabsTrigger value="history" className="min-w-32 sm:min-w-0">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-w-32 sm:min-w-0">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="this-week" className="space-y-4">
          {visibleStatus ? (
            <PlanningProgressPanel status={visibleStatus} activeRun={activeRun} />
          ) : null}

          {!activeRun || (!activePlan && !runIsActive) ? (
            <div className="empty-panel">
              <div className="max-w-md space-y-3">
                <ShoppingBasket className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-semibold">No weekly plan selected</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start a new plan or open a saved run to see meals and grocery items here.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => setActiveView("new-plan")}>Start new plan</Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveView("history")}>Open history</Button>
                </div>
              </div>
            </div>
          ) : null}

          {activePlan ? (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="bg-gradient-card card-accent-success shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Grocery List</CardTitle>
                      <CardDescription>
                        {groceryRemaining} left from {groceryTotal} items for this week.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={hideChecked}
                          onCheckedChange={(checked) => setHideChecked(checked === true)}
                        />
                        Hide checked
                      </label>
                      <Button size="sm" variant="outline" onClick={clearCurrentChecklist} disabled={groceryChecked === 0}>
                        Clear checks
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress
                    value={groceryTotal ? Math.round((groceryChecked / groceryTotal) * 100) : 0}
                    max={100}
                    className="h-2 bg-success/10"
                    aria-label={`Grocery checklist ${groceryChecked} of ${groceryTotal} checked`}
                  />
                  {groceryGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No visible grocery items.</p>
                  ) : (
                    <div className="space-y-4">
                      {groceryGroups.map((group) => (
                        <section key={group.category} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-foreground">{group.category}</h3>
                            <Badge variant="outline">{group.items.length}</Badge>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((item) => {
                              const key = groceryItemKey(item);
                              const checked = activeRun ? checkedItems.has(key) : false;
                              return (
                                <label key={key} className="surface-muted flex cursor-pointer items-start gap-3 p-3 text-sm">
                                  <Checkbox
                                    className="mt-0.5"
                                    checked={checked}
                                    onCheckedChange={(nextChecked) => toggleChecked(item, nextChecked === true)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className={checked ? "font-medium text-muted-foreground line-through" : "font-medium text-foreground"}>
                                      {item.item}
                                    </div>
                                    <div className="mt-1 text-muted-foreground">
                                      {item.recipes.length > 0 ? `For ${item.recipes.join(", ")}` : "For this week's meals"}
                                      {item.note ? ` - ${item.note}` : ""}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="bg-gradient-card card-accent-brand shadow-sm">
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>Selected Meals</CardTitle>
                        <CardDescription>
                          {activePlan.selectedMeals.length} meals selected from {activeRun?.scrapedCount ?? 0} scanned recipes.
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={useSelectedRunAsDraft}>
                        Use as draft
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activePlan.selectedMeals.map((meal) => (
                      <MealPlanCard key={`${meal.title}-${meal.url}`} meal={meal} onReshuffle={reshuffleMeal} />
                    ))}
                  </CardContent>
                </Card>

                {activePlan.notes.length > 0 ? (
                  <Card className="bg-gradient-card card-accent-info shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <NotebookText className="h-4 w-4 text-info" aria-hidden="true" />
                        <CardTitle>Planning Notes</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {activePlan.notes.map((note, index) => (
                        <div
                          key={`${index}-${note}`}
                          className="surface-muted border-info/20 bg-info/5 p-3 text-sm leading-6 text-muted-foreground"
                        >
                          {note}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="bg-gradient-card shadow-sm">
                  <CardHeader>
                    <CardTitle>Reviewed Recipes</CardTitle>
                    <CardDescription>Recipe review details are available when you need to audit the plan.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
                        Show reviewed recipes
                      </summary>
                      <div className="mt-3 space-y-2">
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
                    </details>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="new-plan">
          <Card className="bg-gradient-card card-accent-brand shadow-sm">
            <CardHeader>
              <CardTitle>Build Weekly Plan</CardTitle>
              <CardDescription>
                Enter what you have, add this week's constraints, and generate meals plus a grocery list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!sourceReady ? (
                <div className="surface-muted border-warning/30 bg-warning/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Connect ATK before live planning</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {sourceReadiness.message}
                      </p>
                    </div>
                    <Button size="sm" variant="warning" onClick={() => setActiveView("settings")}>
                      Open settings
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="planning-ingredients">Pantry ingredients</Label>
                <Textarea
                  id="planning-ingredients"
                  value={ingredients}
                  onChange={(event) => setIngredients(event.target.value)}
                  placeholder={"chicken breast\nlemons\ngarlic\nolive oil\nrice"}
                  rows={7}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={submitPlan}
                  disabled={!ingredients.trim() || !sourceReady || createRun.isPending}
                >
                  {createRun.isPending ? "Starting..." : "Start planning run"}
                </Button>
                {activeRun ? (
                  <Button variant="outline" onClick={() => setActiveView("this-week")}>
                    Back to this week
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-gradient-card card-accent-success shadow-sm">
            <CardHeader>
              <CardTitle>Run History</CardTitle>
              <CardDescription>Open a previous run without changing the new-plan form.</CardDescription>
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
                          <Badge variant={planningStatusVariant(run.status)}>
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
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
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
                {savePreferences.isPending ? "Saving..." : "Save preferences"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card card-accent-info shadow-sm">
            <CardHeader>
              <CardTitle>Planning Source</CardTitle>
              <CardDescription>
                Connect America's Test Kitchen to unlock live weekly planning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {planningSources.length > 0 ? (
                planningSources.map(renderSourceEditor)
              ) : (
                <p className="text-sm text-muted-foreground">
                  No planning-supported recipe source is available.
                </p>
              )}
            </CardContent>
          </Card>

          {storedOnlySources.length > 0 ? (
            <Card className="bg-gradient-card shadow-sm">
              <CardHeader>
                <CardTitle>Stored Recipe Sources</CardTitle>
                <CardDescription>
                  Optional saved credentials. These do not currently unlock weekly planning.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {storedOnlySources.map(renderSourceEditor)}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  value,
  sub,
  status,
  tone = "brand"
}: {
  icon: typeof ShoppingBasket;
  label: string;
  value: string;
  sub: string;
  status?: PlanningStatus;
  tone?: "brand" | "warning";
}) {
  const iconClass = tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary";

  return (
    <div className="surface-panel flex min-h-24 items-start gap-3 p-4">
      <div className={`rounded-md p-2 ${iconClass}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {status ? <Badge variant={planningStatusVariant(status)}>{status.toLowerCase()}</Badge> : null}
        </div>
        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function PlanningProgressPanel({
  status,
  activeRun
}: {
  status: {
    status: PlanningStatus;
    progressStage: string | null;
    progressDetail: string | null;
    progressPercent: number;
    errorMessage: string | null;
    updatedAt?: string;
  };
  activeRun: { scrapedCount: number } | null;
}) {
  return (
    <div className="surface-panel p-4 text-sm" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {status.status === "COMPLETED" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden="true" />
          ) : status.status === "FAILED" ? (
            <CircleAlert className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          ) : (
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold text-foreground">{status.progressStage || status.status}</p>
            <p className="text-xs text-muted-foreground">
              {planningStatusLabel(status.status)}
              {activeRun ? ` - ${activeRun.scrapedCount} recipes scanned` : ""}
            </p>
          </div>
        </div>
        <Badge variant={planningStatusVariant(status.status)}>
          {status.progressPercent}%
        </Badge>
      </div>
      <Progress
        value={status.progressPercent}
        max={100}
        className="mt-3 h-2 bg-primary/10"
        aria-label={`Planning progress ${status.progressPercent}%`}
      />
      {status.progressDetail ? (
        <p className="mt-3 leading-6 text-muted-foreground">{status.progressDetail}</p>
      ) : null}
      {status.updatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Last updated {formatDateTime(status.updatedAt)}
        </p>
      ) : null}
      {status.errorMessage ? (
        <p className="mt-2 text-red-600" role="alert">{status.errorMessage}</p>
      ) : null}
    </div>
  );
}

function MealPlanCard({
  meal,
  onReshuffle
}: {
  meal: MealPlanSelectedMeal;
  onReshuffle: (meal: MealPlanSelectedMeal) => void;
}) {
  return (
    <div className="surface-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
        <Button variant="outline" size="sm" onClick={() => onReshuffle(meal)}>
          <RotateCw className="h-4 w-4" />
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
  );
}
