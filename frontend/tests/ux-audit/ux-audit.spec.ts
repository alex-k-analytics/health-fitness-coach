import { chromium, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
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

const viewports = [
  { name: "mobile", viewport: { width: 375, height: 812 } },
  { name: "tablet", viewport: { width: 768, height: 1024 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } }
];

const outDir = path.resolve(process.cwd(), "..", "docs", "ux-audit-screenshots");
const authTokenKey = "health_fitness_auth_token";

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

async function screenshot(page: Page, name: string) {
  const file = `${safeName(name)}.png`;
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
  await page.getByLabel(/what did you eat/i).fill("UX audit chicken rice bowl");
  await page.getByLabel(/serving details/i).fill("1 bowl with grilled chicken, rice, beans, and salsa");
  await page.getByRole("button", { name: /estimate nutrition/i }).click();
  await expect(page.getByRole("dialog", { name: /review & save/i })).toBeVisible({ timeout: 30_000 });
  await screenshot(page, `${viewportName} meal composer review`);
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 });
  await screenshot(page, `${viewportName} meal saved`);
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

async function captureLogoutFlow(page: Page, viewportName: string) {
  await page.getByRole("button", { name: /open profile/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login$/);
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

  await email.fill("test@example.com");
  await password.fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(700);
  await screenshot(page, `${viewportName} login wrong password`);

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
  await screenshot(page, `${viewportName} dashboard empty`);
  await verifyNoDevtoolsOverlay(page, viewportName, findings);
  await verifyHeaderActionTooltips(page, viewportName, findings);
  await captureProfileDrawer(page, viewportName);

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
