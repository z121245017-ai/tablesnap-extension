# Chrome Web Store Listing (ASO Ready)

## Extension Name (<= 75 chars)
`TableSnap - Export Web Tables & Reviews to Excel CSV & Markdown` (63 chars)

## Short Description (EN, <= 132 chars)
`Extract unlimited rows from web tables & review cards. Export UTF-8 BOM Excel CSV (SKU-safe), Markdown, TSV, and JSON 100% locally.` (131 chars)

## Short Description (ZH-CN, <= 132 chars)
`免费不限行数提取网页表格与电商评价！一键导出中文不乱码的 Excel CSV（保护长数字 SKU 防科学计数法）、Markdown、TSV 与 JSON。`

## Detailed Description (EN)
Tired of hitting a 250-row limit, CSV export paywalls, garbled Chinese characters in Excel, or 14-digit SKU/order IDs turning into `1.23E+11`?

**TableSnap** is a fast, 100% local-first Chrome extension designed for analysts, e-commerce operators, and developers:

- **Unlimited Rows**: Export every row visible in any HTML `<table>` on the page — no 250-row cap, no subscription required.
- **Excel-Safe UTF-8 BOM CSV**: Automatically prepends `\uFEFF` BOM and uses RFC 4180 quoting so Chinese/CJK headers and multiline cells open cleanly in Microsoft Excel.
- **Long SKU & Leading-Zero Protection**: Optional guard protects `>=11`-digit numeric IDs and leading-zero codes (e.g., `0012345678901`) from scientific notation or stripped zeros in Excel CSV, while keeping Markdown and TSV clean.
- **Merged Cell & Review List Support**: Accurately expands `rowspan` and `colspan` cells and detects repeated e-commerce review/card lists when no semantic `<table>` is used.
- **4 Formats in One Click**: Download Excel CSV, Copy Markdown Table, Copy TSV (Feishu / Google Sheets), or Download JSON.
- **Zero Network Requests**: Strict `connect-src 'none'` CSP. Your data never leaves your browser.

## Detailed Description (ZH-CN)
还在忍受传统网页表格插件的 **250 行导出上限**、**CSV 付费墙**、**Excel 打开中文乱码**、以及 **14 位 SKU/订单号变成 `6.90E+12`** 吗？

**TableSnap** 是一款纯粹本地运行、永久免费的网页表格与评价提取工具：
- **不限行数导出**：当前页面表格有多少行就导出多少行，不截断、不收费、无需登录。
- **Excel 中文零乱码**：CSV 自动写入 UTF-8 BOM（`\uFEFF`）与标准 RFC 4180 转义，双击即开。
- **长数字 SKU / 0 开头编码保护**：开启开关后，自动将 ≥11 位数字与 0 开头编码在 CSV 中保留完整原貌，复制 Markdown / TSV 则保持纯净原始值。
- **合并单元格 + 电商评价卡片识别**：完美展开 `rowspan` / `colspan` 表格，也能自动提取无 `<table>` 标签的评论与商品卡片列表。
- **四种格式一键直出**：下载 Excel CSV、复制 Markdown、复制 TSV（飞书/Google Sheets 直接粘贴）、导出 JSON。

## Permission Justifications
- `activeTab`: Reads the currently active tab only when the user clicks the TableSnap toolbar icon.
- `scripting`: Injects the local table extraction script (`src/extractor/table_extractor.js`, `content.js`) into the active tab on user action.
- `storage`: Stores user preferences locally in `chrome.storage.local` (SKU protection toggle and coffee card acknowledgement state).

## Privacy Disclosures
- Single purpose: Extract tables and repeated card lists from the active web page and export them locally.
- Zero data collection, zero analytics, zero remote servers (`connect-src 'none'`).
