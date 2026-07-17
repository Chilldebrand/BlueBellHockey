const http = require("node:http");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const URL = process.env.ARCADE_URL || "http://localhost:5173";
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === "win32"
    ? path.join(
        process.env.PROGRAMFILES || "C:\\Program Files",
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      )
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function checkServer(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 2500 }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode >= 200 && response.statusCode < 500));
    });
    request.once("error", reject);
    request.once("timeout", () => request.destroy(new Error("server check timed out")));
  });
}

async function clickButton(page, pattern) {
  return page.evaluate((source) => {
    const matcher = new RegExp(source, "i");
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      matcher.test(candidate.textContent || "")
    );
    if (!button) {
      return false;
    }
    button.click();
    return true;
  }, pattern.source);
}

async function readAudio(page) {
  return page.evaluate(() => {
    const handle = window.__bbhArcadeAudio;
    return handle
      ? {
          preferences: handle.getPreferences(),
          music: handle.getMenuMusicState(),
          buses: handle.getBusLevels(),
          diagnostics: handle.getDiagnostics()
        }
      : null;
  });
}

async function setSlider(page, label, value) {
  await page.$eval(
    `input[aria-label="${label}"]`,
    (node, nextValue) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(node, String(nextValue));
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value
  );
}

(async () => {
  const results = [];
  const logs = [];
  const failedResourceUrls = [];
  const pass = (name, condition, detail = "") => {
    results.push(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  try {
    await checkServer(URL);
  } catch {
    throw new Error(
      `No arcade Vite server found at ${URL}. Start it with "npm run dev:arcade" or set ARCADE_URL.`
    );
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=swiftshader",
      "--window-size=1280,800",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on("console", (message) => {
      if (message.type() === "error") {
        logs.push(`[console.error] ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => logs.push(`[pageerror] ${error.message}`));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResourceUrls.push(response.url());
      }
    });

    await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.__bbhArcadeAudio), { timeout: 10000 });
    pass("development audio inspection handle is available", true);

    pass("Press Start is visible", await clickButton(page, /press start/));
    await page.waitForFunction(
      () => window.__bbhArcadeAudio?.getDiagnostics().contextState !== "unavailable",
      { timeout: 10000 }
    );
    await sleep(250);

    const afterStart = await readAudio(page);
    pass(
      "audio context initializes after Press Start",
      afterStart?.diagnostics.contextAvailable === true &&
        ["running", "suspended", "available"].includes(afterStart.diagnostics.contextState),
      JSON.stringify(afterStart?.diagnostics)
    );
    pass("menu music is enabled on the menu", afterStart?.music.allowed === true);

    pass("Settings is reachable from the menu", await clickButton(page, /settings/));
    await page.waitForSelector('input[aria-label="Announcer"]', { timeout: 5000 });
    const before = await readAudio(page);
    await setSlider(page, "Announcer", 21);
    await setSlider(page, "Gameplay", 42);
    await setSlider(page, "Music", 63);
    await sleep(100);
    const after = await readAudio(page);
    pass(
      "all three audio sliders update persisted preferences",
      after?.preferences.announcer === 0.21 &&
        after?.preferences.gameplay === 0.42 &&
        after?.preferences.music === 0.63,
      `before=${JSON.stringify(before?.preferences)} after=${JSON.stringify(after?.preferences)}`
    );
    pass("settings can close without changing the music route", await clickButton(page, /close/));

    pass("Free Skate route is reachable", await clickButton(page, /free skate/));
    await sleep(500);
    const freeSkate = await readAudio(page);
    pass(
      "menu music is disabled in Free Skate",
      freeSkate?.music.allowed === false && freeSkate?.music.active === false,
      JSON.stringify(freeSkate?.music)
    );

    const diagnostics = freeSkate?.diagnostics;
    const eventSmoke = await page.evaluate(() =>
      window.__bbhArcadeAudio?.runEventCursorSmoke()
    );
    pass(
      "manifest character IDs match CHARACTER_IDS",
      diagnostics?.manifestCharacterIdsValid === true,
      JSON.stringify(diagnostics)
    );
    pass(
      "missing audio assets are reported non-fatally",
      ["loaded", "failed"].includes(diagnostics?.manifestStatus) &&
        Array.isArray(diagnostics?.missingAssets) &&
        Array.isArray(diagnostics?.assetErrors),
      JSON.stringify(diagnostics)
    );
    pass(
      "duplicate goal and powerup snapshots are consumed once",
      eventSmoke?.processedEventCount === (diagnostics?.processedEventCount ?? 0) + 2 &&
        eventSmoke?.duplicateEventCount === (diagnostics?.duplicateEventCount ?? 0) + 2 &&
        eventSmoke?.announcerGoalCount === (diagnostics?.announcerGoalCount ?? 0) + 1 &&
        eventSmoke?.announcerPowerupCount === (diagnostics?.announcerPowerupCount ?? 0) + 1,
      JSON.stringify({ before: diagnostics, after: eventSmoke })
    );
    const expectedMissingAssetError = logs.every((message) => {
      if (!message.includes("Failed to load resource")) {
        return false;
      }
      return failedResourceUrls.some((url) => {
        const pathname = new globalThis.URL(url).pathname;
        return pathname.startsWith("/audio/") || pathname === "/favicon.ico";
      });
    });
    pass(
      "browser reports no audio errors",
      logs.length === 0 || expectedMissingAssetError,
      logs.length === 0
        ? "clean"
        : `${logs.join(" | ")} (expected missing assets: ${failedResourceUrls.join(", ")})`
    );

    console.log("\n=== ARCADE AUDIO VERIFICATION ===");
    console.log(results.join("\n"));
    console.log("\n=== browser audio errors ===");
    console.log(logs.join("\n") || "[none]");

    const failures = results.filter((result) => result.startsWith("FAIL"));
    process.exitCode = failures.length ? 1 : 0;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`SCRIPT ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
