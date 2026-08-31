const { chromium } = require('playwright');

(async () => {
  const webAppUrl = process.env.GOOGLE_WEB_APP_URL;
  if (!webAppUrl) {
    console.error('Ошибка: не задан GOOGLE_WEB_APP_URL');
    process.exit(1);
  }

  console.log('Запуск Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Переход на сайт для прохождения JS-защиты...');
  await page.goto('https://logs.evolve-rp.ru/saint-louis', { waitUntil: 'networkidle' });

  console.log('Получение логов...');
  const logsData = await page.evaluate(async () => {
    const payload = new URLSearchParams({
      draw: '1',
      'order[0][column]': '7',
      'order[0][dir]': 'desc',
      start: '0',
      length: '100',
      'search[value]': '',
      'search[regex]': 'false',
      fraction: '20',
      action: ''
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

  await browser.close();

  console.log(`Получено записей: ${logsData.length}. Отправка в Google Таблицу...`);

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logsData)
  });

  const result = await response.text();
  console.log('Ответ Google Apps Script:', result);
})();
