import { chromium, expect, test } from "@playwright/test";
import type { Browser, Locator, Page, Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type Finding = {
  severity: "Critical" | "High" | "Medium" | "Low";
  page: string;
  title: string;
  actual: string;
  expected: string;
  evidence: string;
};

type AuditEvent = {
  viewport: string;
  type: string;
  text: string;
  url: string;
};

type AuditRecipeSource = {
  source: "atk" | "allrecipes" | "nytimes";
  label: string;
  defaultLoginUrl: string;
  supportedForPlanning: boolean;
  planningReady: boolean;
  planningReadinessIssues: string[];
  configured: boolean;
  enabled: boolean;
  username: string;
  loginUrl: string;
  hasPassword: boolean;
  updatedAt: string | null;
};

const viewports = [
  { name: "mobile", viewport: { width: 375, height: 812 } },
  { name: "tablet", viewport: { width: 768, height: 1024 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } }
];

const outDir = path.resolve(process.cwd(), "..", "docs", "ux-audit-screenshots");
const authTokenKey = "health_fitness_auth_token";
const auditMealTitle = "UX audit chicken rice bowl";
const auditBaselineProfile = {
  displayName: "Test User",
  goalSummary: null,
  calorieGoal: null,
  proteinGoalGrams: null,
  carbGoalGrams: null,
  fatGoalGrams: null,
  heightCm: null,
  activityLevel: null,
  notes: null
};
const recipeSourcesRoutePattern = "**/api/meal-plans/sources";

function auditRecipeSource(patch: Partial<AuditRecipeSource> & Pick<AuditRecipeSource, "source" | "label">): AuditRecipeSource {
  const defaultLoginUrlBySource = {
    allrecipes: "https://www.allrecipes.com/account/sign-in",
    atk: "https://www.americastestkitchen.com/sign_in",
    nytimes: "https://cooking.nytimes.com/login"
  };

  return {
    source: patch.source,
    label: patch.label,
    defaultLoginUrl: patch.defaultLoginUrl ?? defaultLoginUrlBySource[patch.source],
    supportedForPlanning: patch.supportedForPlanning ?? false,
    planningReady: patch.planningReady ?? false,
    planningReadinessIssues: patch.planningReadinessIssues ?? ["Planning is not supported for this source yet."],
    configured: patch.configured ?? false,
    enabled: patch.enabled ?? false,
    username: patch.username ?? "",
    loginUrl: patch.loginUrl ?? patch.defaultLoginUrl ?? defaultLoginUrlBySource[patch.source],
    hasPassword: patch.hasPassword ?? false,
    updatedAt: patch.updatedAt ?? null
  };
}

function findExistingChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;

  const msPlaywrightDir = path.join(localAppData, "ms-playwright");
  if (!fs.existsSync(msPlaywrightDir)) return undefined;

  const candidates = fs
    .readdirSync(msPlaywrightDir)
    .filter((entry) => entry.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((entry) => path.join(msPlaywrightDir, entry, "chrome-win", "chrome.exe"))
    .filter((candidate) => fs.existsSync(candidate));

  return candidates[0];
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function applyAuditScreenshotLabel(page: Page, name: string) {
  const label = name.replace(/\s+/g, " ").trim();

  await page.evaluate((text) => {
    let labelElement = document.getElementById("ux-audit-screenshot-label");
    if (!labelElement) {
      labelElement = document.createElement("div");
      labelElement.id = "ux-audit-screenshot-label";
      labelElement.setAttribute("aria-hidden", "true");
      Object.assign(labelElement.style, {
        position: "fixed",
        right: "8px",
        bottom: "8px",
        zIndex: "2147483647",
        maxWidth: "calc(100vw - 16px)",
        border: "1px solid rgba(15, 23, 42, 0.22)",
        borderRadius: "6px",
        background: "rgba(255, 255, 255, 0.92)",
        color: "rgb(15, 23, 42)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "11px",
        lineHeight: "1.3",
        padding: "4px 6px",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.12)"
      });
      document.body.appendChild(labelElement);
    }

    labelElement.textContent = `UX audit: ${text}`;
  }, label);
}

async function screenshot(page: Page, name: string) {
  const file = `${safeName(name)}.png`;
  await applyAuditScreenshotLabel(page, name);
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  return `docs/ux-audit-screenshots/${file}`;
}

async function verifyHeaderActionTooltips(page: Page, viewportName: string, findings: Finding[]) {
  if (viewportName !== "desktop") return;

  const checks = [
    { buttonName: /theme:/i, tooltipName: /theme:/i },
    { buttonName: /log food/i, tooltipName: /log food/i },
    { buttonName: /log workout/i, tooltipName: /log workout/i },
    { buttonName: /log weight/i, tooltipName: /log weight/i },
    { buttonName: /open profile/i, tooltipName: /open profile/i }
  ];
  const header = page.getByRole("banner");

  for (const { buttonName, tooltipName } of checks) {
    await header.getByRole("button", { name: buttonName }).first().hover();
    await page.waitForTimeout(450);

    const tooltipVisible = await page
      .getByRole("tooltip", { name: tooltipName })
      .isVisible()
      .catch(() => false);

    if (!tooltipVisible) {
      const evidence = await screenshot(page, `${viewportName} missing header action tooltip`);
      findings.push({
        severity: "Medium",
        page: "app shell",
        title: "Header icon action is missing a visible tooltip",
        actual: `Hovering the ${buttonName} header action did not expose a matching tooltip.`,
        expected: "Icon-only header actions should show hover/focus tooltips for sighted users.",
        evidence
      });
    }
  }
}

async function verifyNoDevtoolsOverlay(page: Page, viewportName: string, findings: Finding[]) {
  const devtoolsVisible = await page
    .getByText("TanStack Router", { exact: false })
    .isVisible()
    .catch(() => false);

  if (!devtoolsVisible) return;

  const evidence = await screenshot(page, `${viewportName} devtools overlay visible`);
  findings.push({
    severity: "Low",
    page: "local development",
    title: "Devtools overlay is visible during UX audit",
    actual: "The TanStack Router devtools badge is visible in the review viewport.",
    expected: "UX audit screenshots should run without development overlays unless explicitly enabled.",
    evidence
  });
}

async function verifyReducedMotionPreference(page: Page, viewportName: string, findings: Finding[]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const result = await page.evaluate(() => {
    const sample = document.querySelector("button") ?? document.body;
    const style = window.getComputedStyle(sample);
    const parseDuration = (value: string) => {
      const firstValue = value.split(",")[0]?.trim() ?? "0s";
      return firstValue.endsWith("ms")
        ? Number.parseFloat(firstValue)
        : Number.parseFloat(firstValue) * 1000;
    };

    return {
      mediaMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      transitionMs: parseDuration(style.transitionDuration),
      animationMs: parseDuration(style.animationDuration)
    };
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });

  if (result.mediaMatches && result.transitionMs <= 0.01 && result.animationMs <= 0.01) {
    return;
  }

  const evidence = await screenshot(page, `${viewportName} reduced motion failed`);
  findings.push({
    severity: "Medium",
    page: "app shell",
    title: "Reduced-motion preference is not respected",
    actual: `prefers-reduced-motion matched: ${result.mediaMatches}; transition ${result.transitionMs}ms; animation ${result.animationMs}ms.`,
    expected: "When reduced motion is requested, UI transitions and animations should be effectively disabled.",
    evidence
  });
}

async function verifyAlertFeedback(
  page: Page,
  viewportName: string,
  pageLabel: string,
  expectedText: RegExp,
  findings: Finding[]
) {
  const alertVisible = await page
    .getByRole("alert")
    .filter({ hasText: expectedText })
    .first()
    .isVisible()
    .catch(() => false);

  if (alertVisible) return;

  const evidence = await screenshot(page, `${viewportName} ${pageLabel} missing alert feedback`);
  findings.push({
    severity: "Medium",
    page: pageLabel,
    title: "Validation feedback is not exposed as an alert",
    actual: `The expected feedback matching ${expectedText} was not exposed through role="alert".`,
    expected: "Form validation and submit errors should be announced to assistive technology users.",
    evidence
  });
}

async function verifyDialogScreenReaderSemantics(
  dialog: Locator,
  page: Page,
  viewportName: string,
  pageLabel: string,
  findings: Finding[]
) {
  const semantics = await dialog.evaluate((element) => {
    const textForIds = (ids: string | null) =>
      ids
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ") ?? "";

    return {
      name: element.getAttribute("aria-label") || textForIds(element.getAttribute("aria-labelledby")),
      description: textForIds(element.getAttribute("aria-describedby"))
    };
  });

  if (semantics.name && semantics.description) return;

  const evidence = await screenshot(page, `${viewportName} ${pageLabel} dialog semantics failed`);
  findings.push({
    severity: "Medium",
    page: pageLabel,
    title: "Dialog is missing screen-reader name or description",
    actual: `Dialog accessible name present: ${Boolean(semantics.name)}. Description present: ${Boolean(semantics.description)}.`,
    expected: "Dialogs and drawers should expose a title and description through aria-labelledby/aria-describedby.",
    evidence
  });
}

async function verifyPrimaryNavDoesNotCoverContent(
  page: Page,
  viewportName: string,
  pageLabel: string,
  findings: Finding[]
) {
  if (viewportName === "desktop") return;

  const overlaps = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    const main = document.querySelector("main");
    if (!nav || !main) return [];

    const navRect = nav.getBoundingClientRect();
    const selectors = [
      "button",
      "a[href]",
      "input",
      "textarea",
      "select",
      '[role="button"]',
      '[role="tab"]',
      '[data-slot="card"]',
      '[data-slot="tabs-list"]'
    ].join(",");

    return Array.from(main.querySelectorAll<HTMLElement>(selectors))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const visible = width > 1 && height > 1 && style.visibility !== "hidden" && style.display !== "none";
        const overlapsNav =
          rect.bottom > navRect.top + 1 &&
          rect.top < navRect.bottom - 1 &&
          rect.right > navRect.left + 1 &&
          rect.left < navRect.right - 1;

        return {
          text: (element.getAttribute("aria-label") || element.textContent || element.tagName).trim().slice(0, 80),
          tag: element.tagName.toLowerCase(),
          rect: {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right)
          },
          visible,
          overlapsNav
        };
      })
      .filter((entry) => entry.visible && entry.overlapsNav)
      .slice(0, 6);
  });

  if (overlaps.length === 0) return;

  const evidence = await screenshot(page, `${viewportName} ${pageLabel} primary nav overlap`);
  findings.push({
    severity: "High",
    page: pageLabel,
    title: "Primary navigation covers page content",
    actual: `Visible content overlaps the bottom primary navigation: ${overlaps
      .map((entry) => `${entry.tag} "${entry.text || "unlabeled"}"`)
      .join(", ")}.`,
    expected: "Mobile and tablet content should remain readable and tappable above the primary navigation.",
    evidence
  });
}

async function captureProfileDrawer(page: Page, viewportName: string) {
  await page.getByRole("button", { name: /open profile/i }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500);
  await screenshot(page, `${viewportName} profile drawer`);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeHidden();
}

async function captureProfileDrawerSaveFlow(page: Page, baseURL: string, viewportName: string) {
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /open profile/i }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();

  const displayName = page.getByLabel(/display name/i);
  await displayName.fill(`Test User drawer ${viewportName}`);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  await screenshot(page, `${viewportName} profile drawer dirty`);

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: /saving/i })).toBeHidden({ timeout: 15_000 });
  await screenshot(page, `${viewportName} profile drawer saved`);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeHidden();
  await resetAuditProfile(page, baseURL);
}

async function captureWeightModalFlow(page: Page, baseURL: string, viewportName: string) {
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /log weight/i }).first().click();
  await expect(page.getByRole("dialog", { name: /log weight/i })).toBeVisible();
  await screenshot(page, `${viewportName} weight modal initial`);
  await page.getByLabel(/weight \(lb\)/i).fill("171.5");
  await page.getByRole("button", { name: /^log$/i }).click();
  await expect(page.getByRole("dialog", { name: /log weight/i })).toBeHidden();
  await screenshot(page, `${viewportName} weight logged`);
}

async function captureMealEstimateSaveFlow(page: Page, baseURL: string, viewportName: string) {
  await page.goto(`${baseURL}/meals`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /log (food|meal)/i }).first().click();
  await expect(page.getByRole("dialog", { name: /log meal/i })).toBeVisible();
  await page.getByLabel(/what did you eat/i).fill(auditMealTitle);
  await page.getByLabel(/serving details/i).fill("1 bowl with grilled chicken, rice, beans, and salsa");
  await page.getByRole("button", { name: /estimate nutrition/i }).click();
  await expect(page.getByRole("dialog", { name: /review & save/i })).toBeVisible({ timeout: 30_000 });
  await screenshot(page, `${viewportName} meal composer review`);
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 });
  await screenshot(page, `${viewportName} meal saved`);
}

async function cleanupAuditMeals(page: Page, baseURL: string) {
  const authToken = await page
    .evaluate((key) => window.localStorage.getItem(key), authTokenKey)
    .catch(() => null);
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const response = await page.request.get(`${baseURL}/api/nutrition/meals?limit=50`, { headers });
    if (!response.ok()) return;

    const payload = await response.json().catch(() => null);
    const meals = Array.isArray(payload?.meals) ? payload.meals : [];
    const auditMeals = meals.filter(
      (meal: { id?: unknown; title?: unknown }) =>
        typeof meal.id === "string" &&
        typeof meal.title === "string" &&
        meal.title.startsWith(auditMealTitle)
    );

    if (auditMeals.length === 0) return;

    for (const meal of auditMeals) {
      await page.request.delete(`${baseURL}/api/nutrition/meals/${meal.id}`, { headers });
    }
  }
}

async function cleanupAuditHealthMetrics(page: Page, baseURL: string) {
  const authToken = await page
    .evaluate((key) => window.localStorage.getItem(key), authTokenKey)
    .catch(() => null);
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  const response = await page.request.get(`${baseURL}/api/profile/me/health-metrics?limit=52`, { headers });
  if (!response.ok()) return;

  const payload = await response.json().catch(() => null);
  const metrics = Array.isArray(payload?.metrics) ? payload.metrics : [];

  for (const metric of metrics) {
    if (typeof metric.id === "string") {
      await page.request.delete(`${baseURL}/api/profile/me/health-metrics/${metric.id}`, { headers });
    }
  }
}

async function resetAuditProfile(page: Page, baseURL: string) {
  const authToken = await page
    .evaluate((key) => window.localStorage.getItem(key), authTokenKey)
    .catch(() => null);
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

  await page.request.patch(`${baseURL}/api/profile/me`, {
    headers,
    data: auditBaselineProfile
  });
}

async function resetAuditFixture(page: Page, baseURL: string) {
  await cleanupAuditMeals(page, baseURL);
  await cleanupAuditHealthMetrics(page, baseURL);
  await resetAuditProfile(page, baseURL);
}

async function captureDashboardPopulatedState(page: Page, baseURL: string, viewportName: string) {
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await expect(page.getByText(auditMealTitle).first()).toBeVisible({ timeout: 15_000 });
  await screenshot(page, `${viewportName} dashboard populated`);
}

async function pressTabUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  maxPresses = 12
) {
  for (let index = 0; index < maxPresses; index += 1) {
    if (await predicate()) return true;
    await page.keyboard.press("Tab");
  }

  return predicate();
}

async function activeControlMatches(page: Page, name: RegExp) {
  return page.evaluate(
    ({ source, flags }) => {
      const activeElement = document.activeElement;
      const control = activeElement?.closest("button,[role='button']");
      const accessibleName =
        control?.getAttribute("aria-label") ||
        control?.textContent ||
        "";

      return new RegExp(source, flags).test(accessibleName);
    },
    { source: name.source, flags: name.flags }
  );
}

async function verifyProfileDrawerKeyboardFlow(page: Page, baseURL: string, viewportName: string, findings: Finding[]) {
  if (viewportName !== "desktop") return;

  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  const profileButton = page.getByRole("button", { name: /open profile/i });
  await profileButton.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: /test user/i }).first();
  await expect(drawer).toBeVisible();
  await verifyDialogScreenReaderSemantics(drawer, page, viewportName, "profile drawer", findings);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();

  const reachedDisplayName = await pressTabUntil(page, async () =>
    page.evaluate(() => document.activeElement?.id === "displayName")
  );

  if (!reachedDisplayName) {
    const evidence = await screenshot(page, `${viewportName} profile drawer keyboard focus failed`);
    findings.push({
      severity: "Medium",
      page: "profile drawer",
      title: "Keyboard navigation cannot reach profile fields",
      actual: "Tabbing through the open profile drawer did not reach the Display name field.",
      expected: "Keyboard users should be able to reach and edit profile fields in drawer tab order.",
      evidence
    });
    await page.keyboard.press("Escape");
    return;
  }

  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("Test User keyboard");
  await page.keyboard.press("Shift+Tab");

  const saveFocused = await page.evaluate(() => document.activeElement?.textContent?.includes("Save changes") ?? false);
  if (!saveFocused) {
    const evidence = await screenshot(page, `${viewportName} profile drawer save focus failed`);
    findings.push({
      severity: "Medium",
      page: "profile drawer",
      title: "Keyboard navigation cannot return to the drawer save action",
      actual: "After editing Display name, Shift+Tab did not return focus to Save changes.",
      expected: "The visible drawer save action should be reachable immediately from the first editable field.",
      evidence
    });
    await page.keyboard.press("Escape");
    await resetAuditProfile(page, baseURL);
    return;
  }

  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible({ timeout: 15_000 });
  await screenshot(page, `${viewportName} profile drawer keyboard saved`);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(100);

  const focusReturned = await activeControlMatches(page, /open profile/i);

  if (!focusReturned) {
    const evidence = await screenshot(page, `${viewportName} profile drawer focus return failed`);
    findings.push({
      severity: "Medium",
      page: "profile drawer",
      title: "Profile drawer does not return focus to its trigger",
      actual: "After closing the profile drawer with Escape, focus did not return to the profile trigger.",
      expected: "Drawer focus should return to the control that opened it.",
      evidence
    });
  }

  await resetAuditProfile(page, baseURL);
}

async function verifyDialogKeyboardFlow({
  page,
  viewportName,
  findings,
  trigger,
  dialogName,
  pageLabel,
  title,
  focusReturnName
}: {
  page: Page;
  viewportName: string;
  findings: Finding[];
  trigger: Locator;
  dialogName: RegExp;
  pageLabel: string;
  title: string;
  focusReturnName: RegExp;
}) {
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: dialogName }).first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await verifyDialogScreenReaderSemantics(dialog, page, viewportName, pageLabel, findings);

  const initialFocusInside = await dialog.evaluate((element) => {
    const activeElement = document.activeElement;
    return activeElement !== null && element.contains(activeElement);
  });

  if (!initialFocusInside) {
    const evidence = await screenshot(page, `${viewportName} ${pageLabel} initial focus failed`);
    findings.push({
      severity: "Medium",
      page: pageLabel,
      title: `${title} does not move keyboard focus inside the dialog`,
      actual: "Opening the dialog from the keyboard did not place focus inside the dialog content.",
      expected: "Keyboard-opened dialogs should move focus to a focusable element inside the dialog.",
      evidence
    });
  }

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
  }

  const loopFocusInside = await dialog.evaluate((element) => {
    const activeElement = document.activeElement;
    return activeElement !== null && element.contains(activeElement);
  });

  if (!loopFocusInside) {
    const evidence = await screenshot(page, `${viewportName} ${pageLabel} tab loop failed`);
    findings.push({
      severity: "High",
      page: pageLabel,
      title: `${title} does not keep keyboard focus inside the dialog`,
      actual: "After tabbing through dialog controls, focus moved outside the open dialog.",
      expected: "Modal dialogs should keep keyboard focus inside the dialog until closed.",
      evidence
    });
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(100);

  const focusReturned = await activeControlMatches(page, focusReturnName);
  if (!focusReturned) {
    const evidence = await screenshot(page, `${viewportName} ${pageLabel} focus return failed`);
    findings.push({
      severity: "Medium",
      page: pageLabel,
      title: `${title} does not return focus to its trigger`,
      actual: "After closing the dialog with Escape, focus did not return to the button that opened it.",
      expected: "Dialogs should restore focus to the trigger that opened them.",
      evidence
    });
  }
}

async function verifyDialogKeyboardFlows(page: Page, baseURL: string, viewportName: string, findings: Finding[]) {
  if (viewportName !== "desktop") return;

  const checks = [
    {
      triggerName: /^log food$/i,
      dialogName: /log meal/i,
      pageLabel: "meal composer",
      title: "Meal composer",
      focusReturnName: /^log food$/i
    },
    {
      triggerName: /^log workout$/i,
      dialogName: /log completed workout/i,
      pageLabel: "workout modal",
      title: "Workout modal",
      focusReturnName: /^log workout$/i
    },
    {
      triggerName: /^log weight$/i,
      dialogName: /log weight/i,
      pageLabel: "weight modal",
      title: "Weight modal",
      focusReturnName: /^log weight$/i
    }
  ];

  for (const check of checks) {
    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    const header = page.getByRole("banner");
    await verifyDialogKeyboardFlow({
      page,
      viewportName,
      findings,
      trigger: header.getByRole("button", { name: check.triggerName }).first(),
      dialogName: check.dialogName,
      pageLabel: check.pageLabel,
      title: check.title,
      focusReturnName: check.focusReturnName
    });
  }
}

async function captureProfileSaveFlow(page: Page, baseURL: string, viewportName: string) {
  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  const displayName = page.getByLabel(/display name/i);
  const originalDisplayName = await displayName.inputValue();

  await displayName.fill("A very long display name intended to check wrapping and save behavior in the health coach profile settings screen");
  await page.waitForTimeout(300);
  await screenshot(page, `${viewportName} settings long name`);

  await displayName.fill(originalDisplayName);
  await page.getByLabel(/notes/i).fill(`UX audit profile save check ${viewportName} ${Date.now()}`);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByRole("button", { name: /saving/i })).toBeHidden({ timeout: 15_000 });
  await screenshot(page, `${viewportName} settings profile saved`);
}

async function withMockedRecipeSources(
  page: Page,
  sources: AuditRecipeSource[],
  callback: () => Promise<void>
) {
  const handler = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sources })
    });
  };

  await page.route(recipeSourcesRoutePattern, handler);
  try {
    await callback();
  } finally {
    await page.unroute(recipeSourcesRoutePattern, handler);
  }
}

async function captureNytPlanningSourceStates(page: Page, baseURL: string, viewportName: string) {
  const unsupportedSource = auditRecipeSource({
    source: "allrecipes",
    label: "Allrecipes"
  });
  const atkNotConfigured = auditRecipeSource({
    source: "atk",
    label: "America's Test Kitchen",
    supportedForPlanning: true,
    planningReadinessIssues: [
      "Source is disabled.",
      "Username or email is missing.",
      "Saved password is missing."
    ]
  });
  const nytNeedsPassword = auditRecipeSource({
    source: "nytimes",
    label: "NYT Cooking",
    supportedForPlanning: true,
    configured: true,
    enabled: true,
    username: "nyt-audit@example.com",
    hasPassword: false,
    planningReadinessIssues: ["Saved password is missing."]
  });
  const atkReady = auditRecipeSource({
    source: "atk",
    label: "America's Test Kitchen",
    supportedForPlanning: true,
    planningReady: true,
    configured: true,
    enabled: true,
    username: "atk-audit@example.com",
    hasPassword: true,
    planningReadinessIssues: []
  });
  const nytReady = auditRecipeSource({
    source: "nytimes",
    label: "NYT Cooking",
    supportedForPlanning: true,
    planningReady: true,
    configured: true,
    enabled: true,
    username: "nyt-audit@example.com",
    hasPassword: true,
    planningReadinessIssues: []
  });

  await withMockedRecipeSources(page, [unsupportedSource, atkNotConfigured, nytNeedsPassword], async () => {
    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    await expect(page.getByText(/NYT Cooking is configured but not ready/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/live planning currently supports America's Test Kitchen/i)).toHaveCount(0);
    await screenshot(page, `${viewportName} dashboard nyt source needed`);

    await page.goto(`${baseURL}/planning`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /settings/i }).click();
    await expect(page.getByText("NYT Cooking").first()).toBeVisible();
    await expect(page.getByText("America's Test Kitchen").first()).toBeVisible();
    await expect(page.getByText(/saved password is missing/i).first()).toBeVisible();
    await screenshot(page, `${viewportName} planning settings nyt not ready`);
  });

  await withMockedRecipeSources(page, [unsupportedSource, atkReady, nytReady], async () => {
    await page.goto(`${baseURL}/planning`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /new plan/i }).click();
    await page.getByLabel(/pantry ingredients/i).fill("chicken\nrice\ngarlic");
    await expect(page.getByText(/America's Test Kitchen, NYT Cooking connected/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /start planning run/i })).toBeEnabled();
    await screenshot(page, `${viewportName} planning new plan atk nyt ready`);

    await page.getByRole("tab", { name: /settings/i }).click();
    await expect(page.getByText("NYT Cooking").first()).toBeVisible();
    await expect(page.getByText("America's Test Kitchen").first()).toBeVisible();
    await expect(page.getByText("Ready for planning")).toHaveCount(2);
    await screenshot(page, `${viewportName} planning settings atk nyt ready`);
  });
}

async function captureLogoutFlow(page: Page, viewportName: string) {
  await page.getByRole("button", { name: /open profile/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
  await screenshot(page, `${viewportName} signed out`);
}

function truncateEventText(text: string) {
  return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}

async function attachEventCapture(page: Page, viewportName: string, events: AuditEvent[]) {
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      if (msg.text().includes("Failed to load resource: the server responded with a status of 401")) {
        return;
      }

      events.push({
        viewport: viewportName,
        type: `console:${msg.type()}`,
        text: truncateEventText(msg.text()),
        url: page.url()
      });
    }
  });

  page.on("pageerror", (error) => {
    events.push({
      viewport: viewportName,
      type: "pageerror",
      text: truncateEventText(error.message),
      url: page.url()
    });
  });

  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") {
      return;
    }

    events.push({
      viewport: viewportName,
      type: "requestfailed",
      text: truncateEventText(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`),
      url: page.url()
    });
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    const pagePath = new URL(page.url()).pathname;
    const isExpectedLoginFailure = url.includes("/api/auth/login");
    const isExpectedLoggedOutTeardown = pagePath === "/login" && !isExpectedLoginFailure;

    if (status >= 400 && !url.includes("/api/auth/session") && !isExpectedLoggedOutTeardown) {
      events.push({
        viewport: viewportName,
        type: "http",
        text: `${status} ${url}`,
        url: page.url()
      });
    }
  });
}

async function runViewportAudit({
  browser,
  baseURL,
  viewportName,
  viewport,
  findings,
  events
}: {
  browser: Browser;
  baseURL: string;
  viewportName: string;
  viewport: { width: number; height: number };
  findings: Finding[];
  events: AuditEvent[];
}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await attachEventCapture(page, viewportName, events);

  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await screenshot(page, `${viewportName} login`);

  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");

  await email.fill("bad-email");
  await password.fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(400);
  await screenshot(page, `${viewportName} login invalid email`);
  await verifyAlertFeedback(page, viewportName, "login", /valid email/i, findings);

  await email.fill("test@example.com");
  await password.fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(700);
  await screenshot(page, `${viewportName} login wrong password`);
  await verifyAlertFeedback(page, viewportName, "login", /invalid email or password|invalid credentials|sign in failed/i, findings);

  await password.fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2000);

  if (new URL(page.url()).pathname !== "/") {
    const hasToken = await page.evaluate((key) => Boolean(window.localStorage.getItem(key)), authTokenKey);
    const evidence = await screenshot(page, `${viewportName} login success stayed on login`);
    findings.push({
      severity: "Critical",
      page: "login",
      title: "Successful sign-in does not navigate to the dashboard",
      actual: `After submitting the documented seeded credentials, the browser stayed on ${page.url()}. Local auth token present: ${hasToken}.`,
      expected: "A successful sign-in should take the user to the authenticated dashboard.",
      evidence
    });

    const loginResponse = await context.request.post(`${baseURL}/api/auth/login`, {
      data: { email: "test@example.com", password: "password123" }
    });
    const session = await loginResponse.json().catch(() => null);
    if (session?.token) {
      await page.evaluate(
        ({ key, token }) => window.localStorage.setItem(key, token),
        { key: authTokenKey, token: session.token }
      );
      await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    }
  }

  await page.waitForLoadState("networkidle");
  await resetAuditFixture(page, baseURL);
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await screenshot(page, `${viewportName} dashboard empty`);
  await verifyNoDevtoolsOverlay(page, viewportName, findings);
  await verifyReducedMotionPreference(page, viewportName, findings);
  await verifyHeaderActionTooltips(page, viewportName, findings);
  await captureProfileDrawer(page, viewportName);
  await captureProfileDrawerSaveFlow(page, baseURL, viewportName);
  await verifyProfileDrawerKeyboardFlow(page, baseURL, viewportName, findings);
  await verifyDialogKeyboardFlows(page, baseURL, viewportName, findings);

  const pageChecks = [
    ["/meals", "meals"],
    ["/planning", "planning"],
    ["/workouts", "workouts"],
    ["/settings", "settings"],
    ["/", "dashboard-return"]
  ] as const;

  for (const [route, label] of pageChecks) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const evidence = await screenshot(page, `${viewportName} ${label}`);
    await verifyPrimaryNavDoesNotCoverContent(page, viewportName, label, findings);
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (hasHorizontalOverflow) {
      findings.push({
        severity: "High",
        page: label,
        title: "Page has horizontal overflow",
        actual: "The document is wider than the viewport.",
        expected: "Responsive pages should not require horizontal scrolling.",
        evidence
      });
    }
  }

  await page.goto(`${baseURL}/meals`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /log (food|meal)/i }).first().click();
  await page.waitForTimeout(500);
  await screenshot(page, `${viewportName} meal composer initial`);
  if (await page.getByRole("dialog").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  await captureMealEstimateSaveFlow(page, baseURL, viewportName);
  await captureDashboardPopulatedState(page, baseURL, viewportName);
  await cleanupAuditMeals(page, baseURL);

  await captureWeightModalFlow(page, baseURL, viewportName);

  await page.goto(`${baseURL}/workouts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /start workout|log (a completed )?workout/i }).first().click();
  await page.waitForTimeout(500);
  await screenshot(page, `${viewportName} workout modal initial`);
  if (await page.getByRole("dialog").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  await page.goto(`${baseURL}/planning`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /new plan/i }).click();
  await page.waitForTimeout(400);
  await screenshot(page, `${viewportName} planning new plan`);
  await page.getByRole("tab", { name: /settings/i }).click();
  await page.waitForTimeout(400);
  await screenshot(page, `${viewportName} planning settings`);
  await captureNytPlanningSourceStates(page, baseURL, viewportName);

  await captureProfileSaveFlow(page, baseURL, viewportName);
  await captureLogoutFlow(page, viewportName);

  await context.close();
}

test("captures UX audit evidence for the local seeded app", async ({ baseURL }) => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const findings: Finding[] = [];
  const events: AuditEvent[] = [];
  const browser = await chromium.launch({ executablePath: findExistingChromium() });

  try {
    for (const { name, viewport } of viewports) {
      await runViewportAudit({
        browser,
        baseURL: baseURL ?? "http://127.0.0.1:5173",
        viewportName: name,
        viewport,
        findings,
        events
      });
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(outDir, "audit-events.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), findings, events }, null, 2)
  );

  expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
});
