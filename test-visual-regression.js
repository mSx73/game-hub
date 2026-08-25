import { test, expect } from '@playwright/test';

/* Визуальная регрессия: базовые скриншоты каталога и лобби трёх флагманских
   игр. Защищает от незаметной поломки дизайна будущими правками (см.
   /root/.claude/plans/peaceful-knitting-platypus.md, пункт B).
   Запуск: BASE_URL=http://localhost:5173 npx playwright test test-visual-regression.js
   Первый прогон создаёт baseline-снимки (test-visual-regression.js-snapshots/). */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function enterName(page, name = 'Тест') {
  await page.locator('input[placeholder="Ваше имя"]').fill(name);
}

test('главная: каталог (hero + bento + жанровые ленты)', async ({ page }) => {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  await enterName(page);
  await page.locator('#catalog').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot('home-catalog.png', { fullPage: false, maxDiffPixelRatio: 0.02 });
});

for (const game of ['Мафия', 'Бункер', 'Угадай мелодию']) {
  test(`лобби: ${game}`, async ({ page }) => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await enterName(page);
    await page.locator('.gp-poster', { hasText: game }).first().click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`lobby-${game.replace(/\s+/g, '-')}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
