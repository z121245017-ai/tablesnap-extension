'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

async function generateIcons(browser) {
  fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'docs', 'assets'), { recursive: true });

  const sizes = [16, 48, 128];
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:transparent;overflow:hidden;">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#2563EB"/>
                <stop offset="100%" stop-color="#1D4ED8"/>
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bg)"/>
            <rect x="24" y="28" width="80" height="72" rx="12" fill="#FFFFFF"/>
            <rect x="24" y="28" width="80" height="22" rx="10" fill="#DBEAFE"/>
            <rect x="24" y="42" width="80" height="8" fill="#DBEAFE"/>
            <line x1="24" y1="50" x2="104" y2="50" stroke="#93C5FD" stroke-width="4"/>
            <line x1="24" y1="74" x2="104" y2="74" stroke="#E2E8F0" stroke-width="4"/>
            <line x1="56" y1="50" x2="56" y2="100" stroke="#E2E8F0" stroke-width="4"/>
            <circle cx="92" cy="88" r="22" fill="#0F766E" stroke="#FFFFFF" stroke-width="5"/>
            <path d="M84 88 L90 94 L101 82" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </body>
      </html>
    `);
    const outPath = path.join(ROOT, 'icons', `icon${size}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
  }
  await page.close();

  // Copy shared runtime & assets for GitHub Pages docs/
  fs.copyFileSync(path.join(ROOT, 'icons', 'icon128.png'), path.join(ROOT, 'docs', 'assets', 'icon128.png'));
  fs.copyFileSync(path.join(ROOT, 'assets', 'wechat-coffee-light.png'), path.join(ROOT, 'docs', 'assets', 'wechat-coffee-light.png'));
  fs.copyFileSync(path.join(ROOT, 'src', 'extractor', 'table_extractor.js'), path.join(ROOT, 'docs', 'assets', 'table_extractor.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'exporter', 'table_exporter.js'), path.join(ROOT, 'docs', 'assets', 'table_exporter.js'));
}

async function generateStoreScreenshots(browser) {
  fs.mkdirSync(path.join(ROOT, 'store-assets'), { recursive: true });
  const iconDataUrl =
    'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icons', 'icon128.png')).toString('base64');

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  // Screenshot 1: Unlimited rows & FeHelper-inspired popup showcase
  await page.setContent(`
    <!doctype html>
    <html lang="zh-CN">
      <body style="margin:0;width:1280px;height:800px;background:linear-gradient(135deg,#EFF6FF 0%,#F8FAFC 55%,#F0FDFA 100%);font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;gap:48px;padding:48px;box-sizing:border-box;">
        <div style="width:560px;">
          <div style="display:inline-flex;align-items:center;gap:10px;background:#DBEAFE;color:#1D4ED8;padding:6px 14px;border-radius:999px;font-weight:700;font-size:14px;margin-bottom:18px;">
            100% 纯本地运行 · 彻底告别 250 行限制
          </div>
          <h1 style="font-size:42px;line-height:1.2;margin:0 0 18px;color:#0F172A;">
            网页表格与电商评价<br/>一键导出 Excel CSV
          </h1>
          <p style="font-size:18px;line-height:1.6;color:#475569;margin:0 0 26px;">
            自动展开 <code style="background:#E2E8F0;padding:2px 6px;border-radius:5px;">rowspan</code> / <code style="background:#E2E8F0;padding:2px 6px;border-radius:5px;">colspan</code> 合并单元格，注入 UTF-8 BOM 中文零乱码，支持 14 位 SKU / 0 开头编码防科学计数法。
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
              <div style="font-weight:700;color:#0F172A;margin-bottom:4px;">✓ 不限行数提取</div>
              <div style="font-size:13px;color:#64748B;">320+ 行、1000+ 行一键完整导出，无收费墙</div>
            </div>
            <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
              <div style="font-weight:700;color:#0F172A;margin-bottom:4px;">✓ 四格式秒级直出</div>
              <div style="font-size:13px;color:#64748B;">Excel CSV / Markdown / 飞书 TSV / JSON</div>
            </div>
          </div>
        </div>

        <div style="width:410px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:18px;padding:16px;box-shadow:0 24px 60px rgba(15,23,42,0.16);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${iconDataUrl}" style="width:34px;height:34px;border-radius:8px;"/>
              <div>
                <div style="font-weight:700;font-size:16px;color:#0F172A;">TableSnap <span style="font-size:11px;background:#EFF6FF;color:#2563EB;padding:2px 7px;border-radius:999px;border:1px solid #BFDBFE;">不限行数</span></div>
                <div style="font-size:11px;color:#64748B;">Excel 兼容 CSV · 评价/表格提取</div>
              </div>
            </div>
            <span style="background:#FFF7ED;border:1px solid #FED7AA;color:#C2410C;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:600;">☕ 请作者喝咖啡</span>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:12px;margin-bottom:10px;">
            <div style="font-weight:700;font-size:13px;color:#0F172A;margin-bottom:8px;">已识别：订单明细表 · 320 行 × 5 列</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#0F766E;font-weight:600;margin-bottom:6px;">
              <span>预览前 4 行</span><span>导出包含全部行 · 无 250 行限制</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #E2E8F0;">
              <tr style="background:#F8FAFC;"><th style="padding:5px;border:1px solid #E2E8F0;text-align:left;">订单编号</th><th style="padding:5px;border:1px solid #E2E8F0;text-align:left;">14位SKU</th><th style="padding:5px;border:1px solid #E2E8F0;text-align:left;">金额</th></tr>
              <tr><td style="padding:5px;border:1px solid #E2E8F0;">000987654321</td><td style="padding:5px;border:1px solid #E2E8F0;">69012345678901</td><td style="padding:5px;border:1px solid #E2E8F0;">¥329</td></tr>
              <tr><td style="padding:5px;border:1px solid #E2E8F0;">000987654322</td><td style="padding:5px;border:1px solid #E2E8F0;">69012345678902</td><td style="padding:5px;border:1px solid #E2E8F0;">¥149</td></tr>
              <tr><td style="padding:5px;border:1px solid #E2E8F0;">000987654323</td><td style="padding:5px;border:1px solid #E2E8F0;">00456789012345</td><td style="padding:5px;border:1px solid #E2E8F0;">¥499</td></tr>
            </table>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:12px;font-weight:600;color:#0F172A;">保护长数字 SKU / 订单号防乱码</div>
              <div style="font-size:11px;color:#64748B;">CSV 中自动为 ≥11 位数字与 0 开头编码防科学计数法</div>
            </div>
            <div style="width:18px;height:18px;background:#2563EB;border-radius:4px;color:#fff;text-align:center;line-height:18px;font-size:12px;">✓</div>
          </div>
          <div style="background:#2563EB;color:#fff;text-align:center;padding:11px;border-radius:10px;font-weight:700;font-size:14px;margin-bottom:8px;">
            下载 Excel 兼容 CSV (不限行数)
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;font-size:12px;font-weight:500;">
            <div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px;">复制 Markdown</div>
            <div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px;">复制 TSV</div>
            <div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px;">导出 JSON</div>
          </div>
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ROOT, 'store-assets', 'screenshot-1-popup-1280x800.png') });

  // Screenshot 2: Excel SKU protection & Chinese BOM comparison
  await page.setContent(`
    <!doctype html>
    <html lang="zh-CN">
      <body style="margin:0;width:1280px;height:800px;background:#0F172A;color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif;display:flex;flex-direction:column;justify-content:center;padding:60px;box-sizing:border-box;">
        <div style="color:#60A5FA;font-weight:700;font-size:15px;margin-bottom:10px;">TABLESNAP EXCEL-SAFE ENGINE</div>
        <h1 style="font-size:40px;margin:0 0 32px;">为什么 Excel 打开普通网页 CSV 总是乱码和丢位？</h1>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;">
          <div style="background:#1E293B;border:1px solid #334155;border-radius:16px;padding:28px;">
            <div style="color:#F87171;font-weight:700;font-size:18px;margin-bottom:14px;">✗ 传统导出插件常见问题</div>
            <ul style="margin:0;padding-left:20px;line-height:2;color:#CBD5E1;font-size:16px;">
              <li>超过 250 行直接截断，要求付费解锁 CSV</li>
              <li>缺少 UTF-8 BOM，Excel 打开中文表头全是乱码</li>
              <li>14 位 SKU <code style="color:#FCA5A5;">69012345678901</code> 变成 <code style="color:#FCA5A5;">6.90E+13</code></li>
              <li>0 开头订单号 <code style="color:#FCA5A5;">000987654</code> 被吞掉前导零</li>
            </ul>
          </div>
          <div style="background:#0F2928;border:1px solid #115E59;border-radius:16px;padding:28px;">
            <div style="color:#2DD4BF;font-weight:700;font-size:18px;margin-bottom:14px;">✓ TableSnap 一键解决</div>
            <ul style="margin:0;padding-left:20px;line-height:2;color:#E2E8F0;font-size:16px;">
              <li><strong>无限行数</strong>：当前页面所有行一次完整导出</li>
              <li><strong>强制注入 UTF-8 BOM (\\uFEFF)</strong>：Excel 双击直接正常显示中文</li>
              <li><strong>长数字 SKU 保护</strong>：自动输出 <code style="color:#5EEAD4;">="69012345678901"</code> 保留完整位数</li>
              <li><strong>Markdown / TSV 保持原样</strong>：粘贴飞书、Notion、文档纯净无公式符号</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ROOT, 'store-assets', 'screenshot-2-excel-safe-1280x800.png') });

  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await generateIcons(browser);
    await generateStoreScreenshots(browser);
    console.log('Generated icons, docs/assets, and store-assets successfully.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
