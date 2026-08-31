const { chromium } = require('playwright');

(async () => {
  const webAppUrl = process.env.GOOGLE_WEB_APP_URL;
  if (!webAppUrl) {
    console.error('Ошибка: не задан GOOGLE_WEB_APP_URL');
    process.exit(1);
  }

  const RUN_DURATION_MS = 50 * 60 * 1000;
  const CHECK_INTERVAL_MS = 60 * 1000;
  const startTime = Date.now();

  console.log('Запуск Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Прохождение первичной JS-защиты...');
  await page.goto('https://logs.evolve-rp.ru/saint-louis', { waitUntil: 'networkidle' });

  while (Date.now() - startTime < RUN_DURATION_MS) {
    const loopStart = Date.now();
    try {
      const logsData = await page.evaluate(async () => {
        const payload = new URLSearchParams({
          draw: '1', 'order[0][column]': '7', 'order[0][dir]': 'desc',
          start: '0', length: '100', 'search[value]': '', 'search[regex]': 'false',
          fraction: '20', action: ''
        });

        for (let i = 0; i <= 7; i++) {
          payload.append(`columns[${i}][data]`, String(i));
          payload.append(`columns[${i}][name]`, '');
          payload.append(`columns[${i}][searchable]`, 'true');
          payload.append(`columns[${i}][orderable]`, 'true');
          payload.append(`columns[${i}][search][value]`, '');
          payload.append(`columns[${i}][search][regex]`, 'false');
        }

        const res = await fetch('https://logs.evolve-rp.ru/saint-louis/journal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: payload
        });

        const json = await res.json();
        return json.data || [];
      });

      if (logsData && logsData.length > 0) {
        try {
          await fetch(webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logsData)
          });
          console.log(`[${new Date().toLocaleTimeString()}] Логи успешно переданы (${logsData.length} шт.)`);
        } catch (sendErr) {
          console.error(`[${new Date().toLocaleTimeString()}] Ошибка отправки в Google Apps Script:`, sendErr.message);
        }
      }
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Ошибка получения логов, перезагрузка страницы...`, err.message);
      try {
        await page.goto('https://logs.evolve-rp.ru/saint-louis', { waitUntil: 'networkidle' });
      } catch (e) {}
    }

    const elapsed = Date.now() - loopStart;
    const waitTime = Math.max(0, CHECK_INTERVAL_MS - elapsed);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  console.log('50 минут истекли. Закрываем браузер и передаем эстафету следующему запуск...');
  await browser.close();
})();
