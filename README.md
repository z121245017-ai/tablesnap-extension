# TableSnap — Export Web Tables & Reviews to Excel CSV & Markdown

> **100% Local-First · Unlimited Rows · UTF-8 BOM Excel-Safe · Zero Paywalls**

TableSnap 是一个轻量、纯粹、100% 本地运行的 Chrome 扩展（Manifest V3），专为解决网页表格与电商评价导出时的四大痛点而设计：
- **彻底告别 250 行截断**：当前页面有多少行就导出多少行，无行数限制。
- **彻底告别 CSV 付费墙**：一键导出 Excel 兼容 CSV、Markdown、TSV（飞书 / Google Sheets）和 JSON。
- **中文打开不乱码**：`.csv` 自动注入 `\uFEFF` UTF-8 BOM 并严格遵循 RFC 4180 转义。
- **长数字 SKU / 订单号不变科学计数法**：可选开启 `保护长数字 SKU 防乱码`，自动对 `>=11` 位纯数字及 `0` 开头编码做安全保护（`="0012345678901"`），同时保持 Markdown 与 TSV 纯净原值。

## 功能特性

- **语义 `<table>` 与评价/卡片列表双引擎识别**：自动按 `rows × cols` 排序页面内所有可见表格与重复评价卡片列表，支持一键切换并在页面高亮定位。
- **合并单元格完整展开**：精确解析 `rowspan` 与 `colspan` 跨行跨列结构为规整二维矩阵，过滤 `.sr-only` / `aria-hidden` / `display: none` 隐藏噪声。
- **极简安全权限**：仅申请 `activeTab`、`scripting`、`storage`，严格配置 `connect-src 'none'`，零外部网络请求、零账号登录。

## 下载与安装

1. 前往 [GitHub Releases v1.0.0](https://github.com/z121245017-ai/tablesnap-extension/releases/download/v1.0.0/tablesnap-extension-v1.0.0.zip) 下载并解压 `tablesnap-extension-v1.0.0.zip`。
2. 打开 Chrome 地址栏输入 `chrome://extensions/`，开启右上角 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择解压后的目录即可使用。

## 本地开发与验证

```bash
# 运行 Node 单元测试
/Users/zhufan/.local/share/today-node/bin/node --test tests/unit.test.js

# 运行 Playwright Chromium 扩展端到端测试
NODE_PATH=/Users/zhufan/Code/today-qa/web-e2e/node_modules /Users/zhufan/.local/share/today-node/bin/node tests/e2e.js
```

## 在线演示与隐私政策

- 在线演示页：[https://z121245017-ai.github.io/tablesnap-extension/](https://z121245017-ai.github.io/tablesnap-extension/)
- 隐私政策：[https://z121245017-ai.github.io/tablesnap-extension/privacy.html](https://z121245017-ai.github.io/tablesnap-extension/privacy.html)
