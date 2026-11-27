'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const extractor = require('../src/extractor/table_extractor.js');
const exporter = require('../src/exporter/table_exporter.js');

const ROOT = path.resolve(__dirname, '..');

/**
 * Lightweight deterministic DOM mock for unit-testing table_extractor.js
 * without external dependencies.
 */
function makeMockEl(tagName, attrs = {}, children = [], text = '') {
  const el = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    attributes: { ...attrs },
    children: [],
    childNodes: [],
    parentElement: null,
    style: {},
    className: attrs.class || '',
    id: attrs.id || '',
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name)
        ? String(this.attributes[name])
        : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    get textContent() {
      if (text) return text;
      return this.childNodes.map((n) => (n.nodeType === 3 ? n.nodeValue : n.textContent)).join('');
    },
    querySelectorAll(selector) {
      const wantTags = selector
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const out = [];
      function walk(node) {
        for (const ch of node.children) {
          if (wantTags.includes(ch.tagName) || (selector.includes('[data-label]') && ch.hasAttribute('data-label'))) {
            out.push(ch);
          }
          walk(ch);
        }
      }
      walk(this);
      return out;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    contains(target) {
      let cur = target;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    }
  };

  if (text) {
    el.childNodes.push({ nodeType: 3, nodeValue: text });
  }
  for (const child of children) {
    child.parentElement = el;
    el.children.push(child);
    el.childNodes.push(child);
  }
  return el;
}

test('rowspan & colspan matrix expansion strips sr-only and ignores nested tables', () => {
  const srOnly = makeMockEl('span', { class: 'sr-only' }, [], '隐藏辅助文本');
  const visibleSpan = makeMockEl('span', {}, [], '订单编号');
  const th1 = makeMockEl('th', { rowspan: '2' }, [visibleSpan, srOnly]);
  const th2 = makeMockEl('th', { colspan: '2' }, [], '商品信息');

  const thSub1 = makeMockEl('th', {}, [], '名称');
  const thSub2 = makeMockEl('th', {}, [], 'SKU');

  const trHead1 = makeMockEl('tr', {}, [th1, th2]);
  const trHead2 = makeMockEl('tr', {}, [thSub1, thSub2]);
  const thead = makeMockEl('thead', {}, [trHead1, trHead2]);

  const nestedTable = makeMockEl('table', {}, [
    makeMockEl('tr', {}, [makeMockEl('td', {}, [], '嵌套噪声')])
  ]);
  const tdRow1A = makeMockEl('td', { rowspan: '2' }, [], '000987654321');
  const tdRow1B = makeMockEl('td', {}, [makeMockEl('span', {}, [], '机械键盘'), nestedTable]);
  const tdRow1C = makeMockEl('td', {}, [], '69012345678901');
  const trBody1 = makeMockEl('tr', {}, [tdRow1A, tdRow1B, tdRow1C]);

  const tdRow2B = makeMockEl('td', {}, [], '鼠标垫');
  const tdRow2C = makeMockEl('td', {}, [], '69012345678902');
  const trBody2 = makeMockEl('tr', {}, [tdRow2B, tdRow2C]);

  const tbody = makeMockEl('tbody', {}, [trBody1, trBody2]);
  const table = makeMockEl('table', {}, [thead, tbody]);

  const matrix = extractor.extractTableMatrix(table, { __TABLESNAP_MOCK__: true });
  assert.equal(matrix.rowCount, 4);
  assert.equal(matrix.colCount, 3);
  assert.deepEqual(matrix.rows, [
    ['订单编号', '商品信息', '商品信息'],
    ['订单编号', '名称', 'SKU'],
    ['000987654321', '机械键盘 嵌套噪声', '69012345678901'],
    ['000987654321', '鼠标垫', '69012345678902']
  ]);
});

test('unlimited rows (>300 rows) extraction and CSV export with zero 250-row cap', () => {
  const trs = [
    makeMockEl('tr', {}, [
      makeMockEl('th', {}, [], '序号'),
      makeMockEl('th', {}, [], 'SKU编号'),
      makeMockEl('th', {}, [], '商品描述')
    ])
  ];

  for (let i = 1; i <= 320; i++) {
    trs.push(
      makeMockEl('tr', {}, [
        makeMockEl('td', {}, [], String(i)),
        makeMockEl('td', {}, [], `6901234567${String(i).padStart(4, '0')}`),
        makeMockEl('td', {}, [], `中文商品_${i}`)
      ])
    );
  }

  const table = makeMockEl('table', {}, [makeMockEl('tbody', {}, trs)]);
  const doc = {
    querySelectorAll(sel) {
      return sel === 'table' ? [table] : [];
    }
  };

  const detected = extractor.detectTablesAndLists(doc, { __TABLESNAP_MOCK__: true });
  assert.equal(detected.totalTables, 1);
  assert.equal(detected.tables[0].rowCount, 321); // 1 header + 320 data rows

  const csv = exporter.toCsv(detected.tables[0].rows, { includeBom: true, protectLongIds: true });
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 321);
  assert.ok(lines[320].includes('"=""69012345670320"""'));
});

test('UTF-8 BOM, RFC 4180 quoting, and Excel long SKU/leading-zero protection', () => {
  const matrix = [
    ['订单号', 'SKU', '普通价格', '备注'],
    ['0012345678901', '12345678901', '99.50', '包含,逗号和"双引号"\n换行'],
    ['00789', '1234567890', '18', '10位纯数字不包裹']
  ];

  const protectedCsv = exporter.toCsv(matrix, { includeBom: true, protectLongIds: true });
  assert.equal(protectedCsv[0], '\uFEFF');
  assert.ok(protectedCsv.includes('"=""0012345678901"""'));
  assert.ok(protectedCsv.includes('"=""12345678901"""'));
  assert.ok(protectedCsv.includes('"=""00789"""'));
  // 10-digit non-leading-zero number should stay raw
  assert.ok(protectedCsv.includes(',1234567890,'));
  assert.ok(protectedCsv.includes('"包含,逗号和""双引号""\n换行"'));

  const unprotectedCsv = exporter.toCsv(matrix, { includeBom: true, protectLongIds: false });
  assert.equal(unprotectedCsv[0], '\uFEFF');
  assert.ok(!unprotectedCsv.includes('="'));
  assert.ok(unprotectedCsv.includes('0012345678901,12345678901,99.50'));
});

test('Markdown and TSV keep clean raw SKU values and escape delimiters properly', () => {
  const matrix = [
    ['SKU', '评价内容', '数量'],
    ['0012345678901', '很好 | 推荐\n下次还买', '2'],
    ['69012345678901', 'Tab\t测试', '1']
  ];

  const md = exporter.toMarkdown(matrix);
  assert.ok(!md.includes('="'), 'Markdown must not wrap SKU in Excel formula');
  assert.ok(md.includes('| 0012345678901 | 很好 \\| 推荐 下次还买 | 2 |'));

  const tsv = exporter.toTsv(matrix);
  assert.ok(!tsv.includes('="'), 'TSV must not wrap SKU in Excel formula');
  const lines = tsv.split('\n');
  assert.equal(lines[1], '0012345678901\t很好 | 推荐 下次还买\t2');
  assert.equal(lines[2], '69012345678901\tTab 测试\t1');
});

test('repeated review card list extraction works when no semantic table fits', () => {
  const makeCard = (author, rating, comment) =>
    makeMockEl('div', { class: 'review-card' }, [
      makeMockEl('span', { class: 'reviewer-name' }, [], author),
      makeMockEl('span', { class: 'star-rating' }, [], rating),
      makeMockEl('p', { class: 'review-body' }, [], comment)
    ]);

  const listContainer = makeMockEl('div', { class: 'reviews-list' }, [
    makeCard('张三', '5.0', '物流很快，商品做工扎实'),
    makeCard('李四', '4.5', '尺寸合适，价格实惠'),
    makeCard('王五', '5.0', '二次回购了，很满意')
  ]);

  const doc = {
    querySelectorAll(sel) {
      if (sel === 'table') return [];
      return [listContainer];
    }
  };

  const detected = extractor.detectTablesAndLists(doc, { __TABLESNAP_MOCK__: true });
  assert.equal(detected.totalTables, 1);
  assert.equal(detected.tables[0].sourceType, 'reviews');
  assert.equal(detected.tables[0].rowCount, 4);
  assert.equal(detected.tables[0].colCount, 3);
  assert.deepEqual(detected.tables[0].rows[0], ['用户/作者', '评分', '评价/内容']);
  assert.deepEqual(detected.tables[0].rows[1], ['张三', '5.0', '物流很快，商品做工扎实']);
});

test('zero-network static security audit across manifest, extension, and docs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name.length <= 75, `Extension name too long: ${manifest.name.length}`);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  assert.equal(
    manifest.content_security_policy.extension_pages,
    "script-src 'self'; object-src 'self'; connect-src 'none';"
  );

  const codeFiles = [
    'popup.html',
    'popup.js',
    'popup.css',
    'content.js',
    'src/extractor/table_extractor.js',
    'src/exporter/table_exporter.js'
  ];

  const forbiddenPatterns = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /navigator\.sendBeacon/,
    /https?:\/\/[a-z0-9.-]+/i
  ];

  for (const rel of codeFiles) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const pat of forbiddenPatterns) {
      assert.ok(!pat.test(content), `Forbidden network pattern ${pat} found in ${rel}`);
    }
  }

  for (const docRel of ['docs/index.html', 'docs/privacy.html']) {
    const html = fs.readFileSync(path.join(ROOT, docRel), 'utf8');
    assert.ok(!/<(script|link|img)[^>]+(?:src|href)=["']https?:\/\//i.test(html), `External asset reference in ${docRel}`);
  }
});
