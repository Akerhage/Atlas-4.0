const { chromium } = require('@playwright/test');

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    slowMo: 250
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 }
  });

  page.on('pageerror', err => {
    console.error('[pageerror]', err.message);
  });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-modal').waitFor({ state: 'visible', timeout: 10000 });
  await page.fill('#login-user', 'atlas-admin');
  await page.fill('#login-pass', 'playwright');
  await page.locator('#login-form').evaluate(form => form.requestSubmit());
  await page.locator('#user-profile-container').waitFor({ state: 'visible', timeout: 10000 });

  console.log('Atlas web login klart. Browsern lämnas öppen för manuell testning.');
  console.log('Stäng PowerShell-fönstret eller tryck Ctrl+C när du är klar.');

  const shutdown = async () => {
    try {
      await browser.close();
    } catch (_) {}
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await new Promise(() => {});
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
