'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

function buildFixtureHtml() {
  const rows = [];
  for (let i = 1; i <= 285; i++) {
    const sku = `6901234567${String(i).padStart(4, '0')}`;
    const orderId = `00098765${String(i).padStart(4, '0')}`;
    if (i === 1) {
      rows.push(`
        <tr>
          <td rowspan="2">${orderId}</td>
          <td>中文机械键盘_${i}</td>
          <td>${sku}</td>
          <td>手感很好，"推荐购买", 性价比高</td>
          <td>¥329.00</td>
        </tr>
      `);
    } else if (i === 2) {
      rows.push(`
        <tr>
          <td>配套键帽_${i}</td>
          <td>${sku}</td>
          <td>配色干净</td>
          <td>¥59.00</td>
        </tr>
      `);
    } else {
      rows.push(`
        <tr>
          <td>${orderId}</td>
          <td>测试商品_${i}<span class="sr-only">隐藏文本</span></td>
          <td>${sku}</td>
          <td>第 ${i} 条买家评价</td>
          <td>¥${(99 + (i % 50)).toFixed(2)}</td>
        </tr>
      `);
    }
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>TableSnap E2E Fixture</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px; }
    .reviews-list { display: grid; gap: 10px; margin-top: 24px; }
    .review-card { border: 1px solid #ddd; padding: 10px; }
  </style>
</head>
<body>
  <h1>电商订单导出测试页</h1>
  <table id="ordersTable">
    <thead>
      <tr>
        <th rowspan="2">订单编号</th>
        <th colspan="2">商品与条码</th>
        <th rowspan="2">买家评价</th>
        <th rowspan="2">实付金额</th>
      </tr>
      <tr>
        <th>商品名称</th>
        <th>14位SKU</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('\n')}
    </tbody>
  </table>

  <h2>商品评价卡片列表</h2>
  <div class="reviews-list">
    <div class="review-card"><span class="reviewer-name">张三</span><span class="star-rating">5星</span><p class="review-body">物流很快</p></div>
    <div class="review-card"><span class="reviewer-name">李四</span><span class="star-rating">4星</span><p class="review-body">质量不错</p></div>
    <div class="review-card"><span class="reviewer-name">王五</span><span class="star-rating">5星</span><p class="review-body">还会回购</p></div>
  </div>
</body>
</html>`;
}

function startLocalServer(fixtureHtml) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      if (reqPath === '/fixture.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fixtureHtml);
        return;
      }

      const safePath = reqPath === '/' ? '/index.html' : reqPath;
      const fullPath = path.join(ROOT, 'docs', safePath);
      if (!fullPath.startsWith(path.join(ROOT, 'docs')) || !fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png'
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function getExtensionId(context) {
  const page = await context.newPage();
  await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  const extId = await page.evaluate(() => {
    const mgr = document.querySelector('extensions-manager');
    if (!mgr || !mgr.shadowRoot) return null;
    const list = mgr.shadowRoot.querySelector('extensions-item-list');
    if (!list || !list.shadowRoot) return null;
    const items = list.shadowRoot.querySelectorAll('extensions-item');
    for (const item of items) {
      const nameEl = item.shadowRoot && item.shadowRoot.querySelector('#name');
      if (nameEl && nameEl.textContent && nameEl.textContent.includes('TableSnap')) {
        return item.getAttribute('id');
      }
    }
    return null;
  });
  await page.close();
  assert.ok(extId, 'Failed to locate TableSnap extension ID in chrome://extensions');
  return extId;
}

function createPopupDriver(bcdp) {
  let nextCmdId = 1;
  const pending = new Map();
  const downloads = [];
  const popupErrors = [];
  const externalRequests = [];
  let activeSessionId = null;

  bcdp.on('Target.receivedMessageFromTarget', (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.message);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      popupErrors.push(JSON.stringify(msg.params.exceptionDetails));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      popupErrors.push(JSON.stringify(msg.params.args));
    } else if (msg.method === 'Network.requestWillBeSent') {
      const u = msg.params.request && msg.params.request.url;
      if (u && !u.startsWith('chrome-extension://') && !u.startsWith('data:') && !u.startsWith('blob:')) {
        externalRequests.push(u);
      }
    }
  });

  bcdp.on('Browser.downloadWillBegin', (evt) => {
    downloads.push({ guid: evt.guid, suggestedFilename: evt.suggestedFilename, done: false });
  });

  bcdp.on('Browser.downloadProgress', (evt) => {
    const entry = downloads.find((d) => d.guid === evt.guid);
    if (entry && evt.state === 'completed') {
      entry.done = true;
    }
  });

  async function sendToSession(method, params = {}) {
    const id = nextCmdId++;
    const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    await bcdp.send('Target.sendMessageToTarget', {
      sessionId: activeSessionId,
      message: JSON.stringify({ id, method, params })
    });
    return p;
  }

  return {
    async attachToPopup(extId, tabTargetId) {
      await bcdp.send('Extensions.triggerAction', { id: extId, targetId: tabTargetId });

      let popTarget = null;
      for (let i = 0; i < 40; i++) {
        const { targetInfos } = await bcdp.send('Target.getTargets');
        popTarget = targetInfos.find(
          (t) => t.url && t.url.startsWith(`chrome-extension://${extId}/popup.html`)
        );
        if (popTarget) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(popTarget, 'Real extension popup target did not open');

      const { sessionId } = await bcdp.send('Target.attachToTarget', {
        targetId: popTarget.targetId,
        flatten: false
      });
      activeSessionId = sessionId;
      await sendToSession('Runtime.enable');
      await sendToSession('Network.enable');
      return popTarget;
    },

    async eval(expr) {
      const res = await sendToSession('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error('Popup eval exception: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result ? res.result.value : undefined;
    },

    async waitForCondition(expr, timeoutMs = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ok = await this.eval(`Boolean(${expr})`);
        if (ok) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timeout waiting for popup condition: ${expr}`);
    },

    async waitForDownload(prevCount, downloadDir) {
      const start = Date.now();
      while (Date.now() - start < 10000) {
        if (downloads.length > prevCount && downloads[prevCount].done) {
          const item = downloads[prevCount];
          const filePath = path.join(downloadDir, item.guid);
          if (fs.existsSync(filePath)) {
            return { ...item, filePath };
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('Timeout waiting for popup download completion');
    },

    getErrors: () => popupErrors,
    getExternalRequests: () => externalRequests,
    getDownloadCount: () => downloads.length
  };
}

async function run() {
  const fixtureHtml = buildFixtureHtml();
  const { server, baseUrl } = await startLocalServer(fixtureHtml);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablesnap-e2e-'));
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablesnap-dl-'));

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      acceptDownloads: true,
      args: [
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${ROOT}`,
        `--load-extension=${ROOT}`
      ]
    });

    const extId = await getExtensionId(context);

    // 1. Open realistic >260-row fixture page
    const fixturePage = await context.newPage();
    const fixtureErrors = [];
    fixturePage.on('pageerror', (e) => fixtureErrors.push(e.message));
    await fixturePage.goto(`${baseUrl}/fixture.html`, { waitUntil: 'domcontentloaded' });
    await fixturePage.bringToFront();

    const bcdp = await context.browser().newBrowserCDPSession();
    await bcdp.send('Browser.setDownloadBehavior', {
      behavior: 'allowAndName',
      downloadPath: downloadDir,
      eventsEnabled: true
    });

    const { targetInfos: tabTargets } = await bcdp.send('Target.getTargets', {
      filter: [{ type: 'tab' }]
    });
    const fixtureTab = tabTargets.find((t) => (t.url || '').startsWith(baseUrl));
    assert.ok(fixtureTab, 'Could not find fixture tab target');

    const popup = createPopupDriver(bcdp);
    await popup.attachToPopup(extId, fixtureTab.targetId);

    // Wait for scan completion: 2 header rows + 285 data rows = 287 rows × 5 cols
    await popup.waitForCondition(
      `document.getElementById('statusSummary')?.textContent?.includes('287 行')`
    );

    const summaryText = await popup.eval(`document.getElementById('statusSummary').textContent`);
    assert.ok(summaryText.includes('287 行 × 5 列'), `Unexpected summary: ${summaryText}`);

    const optionCount = await popup.eval(`document.querySelectorAll('#tableSelect option').length`);
    assert.equal(optionCount, 2, 'Expected both semantic table and review card list detected');

    // Verify highlight overlay appeared on fixture page
    const highlightExists = await fixturePage.evaluate(() =>
      Boolean(document.getElementById('__tablesnap_highlight_overlay__'))
    );
    assert.equal(highlightExists, true, 'Highlight overlay should flash on fixture page');

    // 2. Download Excel CSV with SKU protection ON
    let dlCount = popup.getDownloadCount();
    await popup.eval(`document.getElementById('downloadCsvBtn').click()`);
    const csvDl = await popup.waitForDownload(dlCount, downloadDir);
    assert.ok(csvDl.suggestedFilename.endsWith('.csv'), `Expected .csv filename, got ${csvDl.suggestedFilename}`);

    const csvBuf = fs.readFileSync(csvDl.filePath);
    assert.equal(csvBuf[0], 0xef);
    assert.equal(csvBuf[1], 0xbb);
    assert.equal(csvBuf[2], 0xbf);

    const csvText = csvBuf.toString('utf8').slice(1);
    const csvLines = csvText.split('\r\n');
    assert.equal(csvLines.length, 287, `Expected 287 lines in CSV (no 250 cap), got ${csvLines.length}`);
    assert.ok(csvText.includes('"=""000987650001"""'), 'Leading-zero order ID should be Excel-protected');
    assert.ok(csvText.includes('"=""69012345670285"""'), '14-digit SKU at row 285 should be Excel-protected');
    assert.equal(csvText.includes('隐藏文本'), false, 'sr-only hidden text must be stripped');

    // 3. Toggle SKU protection OFF and re-export CSV
    await popup.eval(`(() => {
      const cb = document.getElementById('protectLongIdsToggle');
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    dlCount = popup.getDownloadCount();
    await popup.eval(`document.getElementById('downloadCsvBtn').click()`);
    const rawCsvDl = await popup.waitForDownload(dlCount, downloadDir);
    const rawCsvText = fs.readFileSync(rawCsvDl.filePath, 'utf8');
    assert.ok(!rawCsvText.includes('="'), 'Unprotected CSV must not wrap SKUs');
    assert.ok(rawCsvText.includes('69012345670285'), 'Raw 14-digit SKU should be present');

    // 4. Test Markdown & TSV copy + JSON download
    await popup.eval(`(() => {
      window.__e2eClipboard = [];
      const origExec = document.execCommand.bind(document);
      document.execCommand = (cmd) => {
        if (cmd === 'copy') {
          const ta = document.querySelector('textarea');
          if (ta) window.__e2eClipboard.push(ta.value);
          return true;
        }
        return origExec(cmd);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
        navigator.clipboard.writeText = async (txt) => {
          window.__e2eClipboard.push(txt);
          try { await origWrite(txt); } catch {}
        };
      }
    })()`);

    await popup.eval(`document.getElementById('copyMarkdownBtn').click()`);
    await popup.waitForCondition(
      `document.getElementById('toastBar')?.textContent?.includes('Markdown')`
    );
    const copiedMd = await popup.eval(`window.__e2eClipboard[window.__e2eClipboard.length - 1]`);
    assert.ok(copiedMd.includes('| 000987650001 |'), 'Markdown should preserve clean raw ID');
    assert.ok(!copiedMd.includes('="'), 'Markdown must not contain Excel formula wrap');

    await popup.eval(`document.getElementById('copyTsvBtn').click()`);
    await popup.waitForCondition(
      `document.getElementById('toastBar')?.textContent?.includes('TSV')`
    );
    const copiedTsv = await popup.eval(`window.__e2eClipboard[window.__e2eClipboard.length - 1]`);
    assert.ok(copiedTsv.includes('69012345670285\t'), 'TSV should preserve all 285 data rows');

    dlCount = popup.getDownloadCount();
    await popup.eval(`document.getElementById('downloadJsonBtn').click()`);
    const jsonDl = await popup.waitForDownload(dlCount, downloadDir);
    assert.ok(jsonDl.suggestedFilename.endsWith('.json'));
    const parsedJson = JSON.parse(fs.readFileSync(jsonDl.filePath, 'utf8'));
    assert.equal(parsedJson.length, 286, 'JSON should contain 1 subheader + 285 data rows');

    // 5. Test Coffee QR modal + chrome.storage.local persistence across popup reopen
    await popup.eval(`document.getElementById('openCoffeeBtn').click()`);
    await popup.waitForCondition(`!document.getElementById('coffeeModal').classList.contains('hidden')`);
    const qrLoaded = await popup.eval(`(() => {
      const img = document.querySelector('#coffeeModal .qr-image');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    })()`);
    assert.equal(qrLoaded, true, 'WeChat coffee QR image must render cleanly inside modal');

    await popup.eval(`document.getElementById('coffeeDonatedBtn').click()`);
    await popup.waitForCondition(`document.getElementById('coffeeModal').classList.contains('hidden')`);
    assert.equal(await popup.eval(`document.getElementById('openCoffeeBtn').textContent`), '☕ 已支持作者');

    // Close & re-open real popup via Extensions.triggerAction to verify chrome.storage.local persistence
    await popup.eval(`window.close()`);
    await new Promise((r) => setTimeout(r, 200));
    await popup.attachToPopup(extId, fixtureTab.targetId);
    await popup.waitForCondition(
      `document.getElementById('openCoffeeBtn')?.textContent?.includes('已支持作者')`
    );
    const persistedToggle = await popup.eval(`document.getElementById('protectLongIdsToggle').checked`);
    assert.equal(persistedToggle, false, 'protectLongIdsToggle=false should persist in chrome.storage.local');

    assert.deepEqual(fixtureErrors, [], `Fixture page errors: ${fixtureErrors.join('; ')}`);
    assert.deepEqual(popup.getErrors(), [], `Popup console/page errors: ${popup.getErrors().join('; ')}`);
    assert.deepEqual(popup.getExternalRequests(), [], `Popup made external requests: ${popup.getExternalRequests().join('; ')}`);

    // 6. Verify docs/index.html & docs/privacy.html (0 console errors, 0 page errors, 0 external requests)
    for (const docPath of ['/index.html', '/privacy.html']) {
      const docPage = await context.newPage();
      const docErrors = [];
      const docExtReqs = [];
      docPage.on('console', (msg) => {
        if (msg.type() === 'error') docErrors.push(msg.text());
      });
      docPage.on('pageerror', (e) => docErrors.push(e.message));
      docPage.on('request', (req) => {
        const u = req.url();
        if (!u.startsWith(baseUrl) && !u.startsWith('data:') && !u.startsWith('blob:')) {
          docExtReqs.push(u);
        }
      });

      await docPage.goto(`${baseUrl}${docPath}`, { waitUntil: 'networkidle' });
      if (docPath === '/index.html') {
        const outText = await docPage.locator('#demoOutput').textContent();
        assert.ok(outText.includes('"=""69012345678901"""'), 'Docs demo should show protected SKU CSV');
        const qrOk = await docPage.evaluate(() => {
          const img = document.querySelector('.coffee-qr');
          return Boolean(img && img.complete && img.naturalWidth > 0);
        });
        assert.equal(qrOk, true, 'Docs coffee QR image should render cleanly');
        await docPage.locator('#demoPreviewMdBtn').click();
        const mdText = await docPage.locator('#demoOutput').textContent();
        assert.ok(mdText.includes('| 000987654321 |'), 'Docs demo should switch to Markdown');
      }

      assert.deepEqual(docErrors, [], `${docPath} had console/page errors: ${docErrors.join('; ')}`);
      assert.deepEqual(docExtReqs, [], `${docPath} made external requests: ${docExtReqs.join('; ')}`);
      await docPage.close();
    }

    console.log('E2E_ALL_PASSED: 287-row fixture, BOM CSV, SKU protection, Markdown/TSV/JSON, Coffee QR state, and docs/ verified.');
  } finally {
    if (context) await context.close();
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
