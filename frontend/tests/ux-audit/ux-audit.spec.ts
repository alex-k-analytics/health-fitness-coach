import { chromium, test } from "@playwright/test";
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

function truncateEventText(text: string) {
  return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}

async function attachEventCapture(page: Page, viewportName: string, events: AuditEvent[]) {
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
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
    if (status >= 400 && !url.includes("/api/auth/session")) {
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
  await page.getByRole("button", { name: /log food/i }).first().click();
  await page.waitForTimeout(500);
  await screenshot(page, `${viewportName} meal composer initial`);
  if (await page.getByRole("dialog").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  await page.goto(`${baseURL}/workouts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /log workout/i }).first().click();
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

  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  await page
    .getByLabel(/display name/i)
    .fill("A very long display name intended to check wrapping and save behavior in the health coach profile settings screen");
  await page.waitForTimeout(300);
  await screenshot(page, `${viewportName} settings long name`);

  await context.close();
}

test("captures UX audit evidence for the local seeded app", async ({ baseURL }) => {
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
});
