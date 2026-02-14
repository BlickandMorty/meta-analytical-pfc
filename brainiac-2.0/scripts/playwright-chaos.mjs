import { chromium } from 'playwright';

const baseURL = process.env.CHAOS_BASE_URL || 'http://127.0.0.1:4020';
const iterations = Number(process.env.CHAOS_ITERATIONS || 220);
const stepDelayMs = Number(process.env.CHAOS_STEP_DELAY_MS || 18);

const stats = {
  baseURL,
  iterations,
  actions: 0,
  pageErrors: 0,
  consoleErrors: 0,
  server5xx: 0,
  navigationErrors: 0,
  consoleErrorSamples: [],
  pageErrorSamples: [],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(items) {
  return items[randomInt(0, items.length - 1)];
}

async function clickRandomPoint(page) {
  const viewport = page.viewportSize() || { width: 1366, height: 900 };
  const x = randomInt(16, Math.max(17, viewport.width - 16));
  const y = randomInt(16, Math.max(17, viewport.height - 16));
  await page.mouse.click(x, y, { delay: randomInt(8, 30) });
}

async function dragSwipe(page) {
  const viewport = page.viewportSize() || { width: 1366, height: 900 };
  const sx = randomInt(40, viewport.width - 40);
  const sy = randomInt(80, viewport.height - 80);
  const ex = Math.min(viewport.width - 20, Math.max(20, sx + randomInt(-360, 360)));
  const ey = Math.min(viewport.height - 20, Math.max(20, sy + randomInt(-320, 320)));
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: randomInt(8, 20) });
  await page.mouse.up();
}

async function keyMash(page) {
  const keys = ['Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'];
  for (let i = 0; i < randomInt(1, 4); i++) {
    await page.keyboard.press(randomItem(keys));
  }
}

async function scrollBurst(page) {
  await page.mouse.wheel(randomInt(-1200, 1200), randomInt(-1600, 1600));
}

async function randomClickOnClickable(page) {
  const targets = page.locator('button, [role=\"button\"], a, [data-search-bar], input, [contenteditable=\"true\"]');
  const count = await targets.count();
  if (count === 0) {
    await clickRandomPoint(page);
    return;
  }
  const idx = randomInt(0, Math.max(0, count - 1));
  const target = targets.nth(idx);
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: 400, force: true }).catch(async () => {
    await clickRandomPoint(page);
  });
}

async function blastNotesAI(page) {
  const aiBtn = page.getByTitle('AI Assistant');
  if (await aiBtn.count()) {
    await aiBtn.first().click({ timeout: 400 }).catch(() => {});
  }

  const input = page.getByPlaceholder('Ask about this note...');
  if (await input.count()) {
    await input.first().fill(`Chaos prompt ${Date.now() % 100000}`);
    await input.first().press('Control+Enter').catch(async () => {
      await input.first().press('Meta+Enter').catch(() => {});
    });
  }
}

async function runPhase(page, path, phaseSteps) {
  try {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {
    stats.navigationErrors += 1;
    return;
  }

  if (path === '/notes') {
    const newPageBtn = page.getByRole('button', { name: /new page/i });
    if (await newPageBtn.count()) {
      await newPageBtn.first().click({ timeout: 800 }).catch(() => {});
    }
  }

  const actions = [
    () => randomClickOnClickable(page),
    () => clickRandomPoint(page),
    () => dragSwipe(page),
    () => scrollBurst(page),
    () => keyMash(page),
    () => blastNotesAI(page),
  ];

  for (let i = 0; i < phaseSteps; i++) {
    const action = randomItem(actions);
    await action().catch(() => {});
    stats.actions += 1;
    await page.waitForTimeout(stepDelayMs);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  page.on('pageerror', () => {
    stats.pageErrors += 1;
    if (stats.pageErrorSamples.length < 5) {
      stats.pageErrorSamples.push('Unhandled pageerror event');
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      stats.consoleErrors += 1;
      if (stats.consoleErrorSamples.length < 5) {
        stats.consoleErrorSamples.push(msg.text());
      }
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 500 && res.url().startsWith(baseURL)) {
      stats.server5xx += 1;
    }
  });

  const phaseA = Math.floor(iterations * 0.35);
  const phaseB = Math.floor(iterations * 0.55);
  const phaseC = Math.max(1, iterations - phaseA - phaseB);

  await runPhase(page, '/', phaseA);
  await runPhase(page, '/notes', phaseB);
  await runPhase(page, '/', phaseC);

  await context.close();
  await browser.close();

  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Chaos harness failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
