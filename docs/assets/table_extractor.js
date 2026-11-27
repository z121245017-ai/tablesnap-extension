(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TableSnapExtractor = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var IGNORED_TAGS = {
    SCRIPT: true,
    STYLE: true,
    NOSCRIPT: true,
    TEMPLATE: true,
    SVG: true
  };

  var SR_ONLY_CLASSES = ['sr-only', 'visually-hidden', 'screen-reader-text', 'a11y-hidden'];

  function hasClass(el, className) {
    if (!el) return false;
    if (el.classList && typeof el.classList.contains === 'function') {
      return el.classList.contains(className);
    }
    var cls = typeof el.className === 'string' ? el.className : '';
    return cls.split(/\s+/).indexOf(className) !== -1;
  }

  function isHiddenByAttributeOrClass(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute && el.hasAttribute('hidden')) return true;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return true;
    for (var i = 0; i < SR_ONLY_CLASSES.length; i++) {
      if (hasClass(el, SR_ONLY_CLASSES[i])) return true;
    }
    if (el.style) {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return true;
    }
    return false;
  }

  function isElementVisible(el, win) {
    if (!el || el.nodeType !== 1) return false;
    if (IGNORED_TAGS[String(el.tagName || '').toUpperCase()]) return false;
    if (isHiddenByAttributeOrClass(el)) return false;

    if (win && typeof win.getComputedStyle === 'function') {
      try {
        var style = win.getComputedStyle(el);
        if (style) {
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          // Detect common clip-rect visually-hidden patterns
          if (
            style.position === 'absolute' &&
            (style.width === '1px' && style.height === '1px') &&
            style.overflow === 'hidden'
          ) {
            return false;
          }
        }
      } catch (_err) {
        // Ignore cross-realm or mock errors
      }
    }

    if (typeof el.getBoundingClientRect === 'function') {
      try {
        var rect = el.getBoundingClientRect();
        if (rect && rect.width === 0 && rect.height === 0) {
          // Allow table/row elements whose children might still give size if not laid out in test mocks
          var tag = String(el.tagName || '').toUpperCase();
          if (tag !== 'TABLE' && tag !== 'TR' && tag !== 'TD' && tag !== 'TH') {
            return false;
          }
          if (el.offsetParent === null && (!win || !win.__TABLESNAP_MOCK__)) {
            return false;
          }
        }
      } catch (_err2) {
        // Ignore
      }
    }

    return true;
  }

  function normalizeWhitespace(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function collectVisibleText(node, win, parts) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (node.nodeValue) parts.push(node.nodeValue);
      return;
    }
    if (node.nodeType !== 1) return;

    var tag = String(node.tagName || '').toUpperCase();
    if (IGNORED_TAGS[tag]) return;
    if (isHiddenByAttributeOrClass(node)) return;

    if (win && typeof win.getComputedStyle === 'function') {
      try {
        var style = win.getComputedStyle(node);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return;
        if (
          style &&
          style.position === 'absolute' &&
          style.width === '1px' &&
          style.height === '1px' &&
          style.overflow === 'hidden'
        ) {
          return;
        }
      } catch (_err) {
        // Ignore
      }
    }

    if (tag === 'BR') {
      parts.push(' ');
      return;
    }

    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      var inputType = node.getAttribute ? String(node.getAttribute('type') || '').toLowerCase() : '';
      if (inputType === 'hidden') return;
      if (inputType === 'checkbox' || inputType === 'radio') {
        parts.push(node.checked ? '✓' : '');
        return;
      }
      if (node.value) {
        parts.push(String(node.value));
      }
      return;
    }

    if (tag === 'SELECT') {
      if (node.options && node.selectedIndex >= 0 && node.options[node.selectedIndex]) {
        parts.push(String(node.options[node.selectedIndex].text || node.value || ''));
      } else if (node.value) {
        parts.push(String(node.value));
      }
      return;
    }

    if (tag === 'IMG') {
      var alt = node.getAttribute ? node.getAttribute('alt') : '';
      if (alt) parts.push(alt);
      return;
    }

    if (tag === 'TABLE') {
      parts.push(' ');
    }

    var children = node.childNodes || [];
    for (var i = 0; i < children.length; i++) {
      collectVisibleText(children[i], win, parts);
    }

    // Add spacing between block-like or table-cell siblings
    if (
      tag === 'DIV' ||
      tag === 'P' ||
      tag === 'LI' ||
      tag === 'TR' ||
      tag === 'TD' ||
      tag === 'TH' ||
      tag === 'TABLE' ||
      tag === 'BLOCKQUOTE'
    ) {
      parts.push(' ');
    }
  }

  function cleanCellText(cellEl, win) {
    if (!cellEl) return '';
    var parts = [];
    collectVisibleText(cellEl, win, parts);
    var joined = normalizeWhitespace(parts.join(''));
    if (!joined && cellEl.getAttribute) {
      var aria = cellEl.getAttribute('aria-label') || cellEl.getAttribute('title') || '';
      joined = normalizeWhitespace(aria);
    }
    return joined;
  }

  function isDirectTableRow(trEl, tableEl) {
    var cur = trEl.parentElement;
    while (cur && cur !== tableEl) {
      if (String(cur.tagName || '').toUpperCase() === 'TABLE') {
        return false;
      }
      cur = cur.parentElement;
    }
    return cur === tableEl;
  }

  function getDirectRowsOfTable(tableEl) {
    var rows = [];
    if (!tableEl) return rows;

    // Group in logical visual order: thead -> tbody/direct -> tfoot
    var theadRows = [];
    var bodyRows = [];
    var tfootRows = [];

    var allTrs = typeof tableEl.querySelectorAll === 'function'
      ? tableEl.querySelectorAll('tr')
      : collectTagDescendants(tableEl, 'TR');

    for (var i = 0; i < allTrs.length; i++) {
      var tr = allTrs[i];
      if (!isDirectTableRow(tr, tableEl)) continue;
      var parentTag = tr.parentElement ? String(tr.parentElement.tagName || '').toUpperCase() : '';
      if (parentTag === 'THEAD') {
        theadRows.push(tr);
      } else if (parentTag === 'TFOOT') {
        tfootRows.push(tr);
      } else {
        bodyRows.push(tr);
      }
    }

    return theadRows.concat(bodyRows, tfootRows);
  }

  function collectTagDescendants(rootEl, targetTag) {
    var out = [];
    var children = rootEl.children || [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var tag = String(child.tagName || '').toUpperCase();
      if (tag === targetTag) out.push(child);
      if (tag !== 'TABLE') {
        var nested = collectTagDescendants(child, targetTag);
        for (var j = 0; j < nested.length; j++) out.push(nested[j]);
      }
    }
    return out;
  }

  function getRowCells(trEl) {
    var cells = [];
    var children = trEl.children || [];
    for (var i = 0; i < children.length; i++) {
      var tag = String(children[i].tagName || '').toUpperCase();
      if (tag === 'TD' || tag === 'TH') {
        cells.push(children[i]);
      }
    }
    return cells;
  }

  function parseSpanAttr(el, attrName) {
    if (!el || !el.getAttribute) return 1;
    var raw = el.getAttribute(attrName);
    if (!raw) return 1;
    var parsed = parseInt(raw, 10);
    if (!isFinite(parsed) || parsed < 1) return 1;
    return Math.min(parsed, 100);
  }

  function extractTableMatrix(tableEl, win) {
    var trList = getDirectRowsOfTable(tableEl);
    var visibleRows = [];
    for (var i = 0; i < trList.length; i++) {
      if (!isHiddenByAttributeOrClass(trList[i])) {
        visibleRows.push(trList[i]);
      }
    }

    if (visibleRows.length === 0) {
      return { rows: [], rowCount: 0, colCount: 0, hasHeader: false };
    }

    var grid = [];
    var maxCols = 0;
    var totalRows = visibleRows.length;

    for (var r = 0; r < totalRows; r++) {
      if (!grid[r]) grid[r] = [];
      var cells = getRowCells(visibleRows[r]);
      var cIdx = 0;

      for (var k = 0; k < cells.length; k++) {
        var cell = cells[k];
        if (isHiddenByAttributeOrClass(cell)) continue;

        while (grid[r][cIdx] !== undefined) {
          cIdx++;
        }

        var text = cleanCellText(cell, win);
        var colspan = parseSpanAttr(cell, 'colspan');
        var rowspan = parseSpanAttr(cell, 'rowspan');

        // Clamp rowspan so it doesn't extend past existing table rows
        var endRow = Math.min(totalRows, r + rowspan);

        for (var rr = r; rr < endRow; rr++) {
          if (!grid[rr]) grid[rr] = [];
          for (var cc = cIdx; cc < cIdx + colspan; cc++) {
            if (grid[rr][cc] === undefined) {
              grid[rr][cc] = text;
            }
          }
        }

        cIdx += colspan;
        if (cIdx > maxCols) maxCols = cIdx;
      }

      if (grid[r].length > maxCols) {
        maxCols = grid[r].length;
      }
    }

    // Pad all rows to uniform rectangular width
    var rectangular = [];
    for (var r2 = 0; r2 < grid.length; r2++) {
      var rowOut = [];
      var hasNonEmpty = false;
      for (var c2 = 0; c2 < maxCols; c2++) {
        var val = grid[r2][c2] !== undefined ? grid[r2][c2] : '';
        if (val !== '') hasNonEmpty = true;
        rowOut.push(val);
      }
      if (hasNonEmpty) {
        rectangular.push(rowOut);
      }
    }

    var firstRowParentTag = visibleRows[0].parentElement
      ? String(visibleRows[0].parentElement.tagName || '').toUpperCase()
      : '';
    var firstRowCells = getRowCells(visibleRows[0]);
    var firstRowHasTh = firstRowCells.some(function (cell) {
      return String(cell.tagName || '').toUpperCase() === 'TH';
    });

    return {
      rows: rectangular,
      rowCount: rectangular.length,
      colCount: maxCols,
      hasHeader: firstRowParentTag === 'THEAD' || firstRowHasTh
    };
  }

  function inferElementTitle(el, fallback) {
    if (!el) return fallback;

    if (typeof el.querySelector === 'function') {
      var caption = el.querySelector('caption');
      if (caption) {
        var capText = normalizeWhitespace(caption.textContent || '');
        if (capText) return capText.slice(0, 48);
      }
    }

    if (el.getAttribute) {
      var aria = normalizeWhitespace(el.getAttribute('aria-label') || '');
      if (aria) return aria.slice(0, 48);
    }

    // Look at preceding sibling headings
    var prev = el.previousElementSibling;
    var steps = 0;
    while (prev && steps < 3) {
      var tag = String(prev.tagName || '').toUpperCase();
      if (/^H[1-6]$/.test(tag)) {
        var hText = normalizeWhitespace(prev.textContent || '');
        if (hText) return hText.slice(0, 48);
      }
      prev = prev.previousElementSibling;
      steps++;
    }

    // Walk up briefly for section heading
    var parent = el.parentElement;
    if (parent && typeof parent.querySelector === 'function') {
      var heading = parent.querySelector('h1, h2, h3, h4');
      if (heading) {
        var pText = normalizeWhitespace(heading.textContent || '');
        if (pText) return pText.slice(0, 48);
      }
    }

    if (el.id) return String(el.id).slice(0, 40);
    return fallback;
  }

  function getItemSignature(el) {
    var tag = String(el.tagName || '').toUpperCase();
    var role = el.getAttribute ? (el.getAttribute('role') || '') : '';
    var cls = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
      : '';
    return tag + (role ? '[role=' + role + ']' : '') + (cls ? '.' + cls : '');
  }

  function extractFieldsFromCard(cardEl, win) {
    // Attempt structured extraction of meaningful child blocks
    var fields = [];
    var seen = Object.create(null);

    function pushField(label, value) {
      var clean = normalizeWhitespace(value);
      if (!clean) return;
      // Avoid exact duplicate substrings from nested wrapper divs
      if (seen[clean]) return;
      seen[clean] = true;
      fields.push({ label: label, value: clean });
    }

    if (typeof cardEl.querySelectorAll === 'function') {
      var labeled = cardEl.querySelectorAll('[data-label], [data-field]');
      if (labeled && labeled.length >= 2) {
        for (var i = 0; i < labeled.length; i++) {
          var lbl = labeled[i].getAttribute('data-label') || labeled[i].getAttribute('data-field') || ('字段' + (i + 1));
          pushField(lbl, cleanCellText(labeled[i], win));
        }
        if (fields.length >= 2) return fields;
      }
    }

    // Fallback: collect direct visible child blocks or leaf semantic elements
    var children = cardEl.children || [];
    for (var c = 0; c < children.length; c++) {
      var child = children[c];
      if (!isElementVisible(child, win)) continue;
      var txt = cleanCellText(child, win);
      if (!txt) continue;

      // If a direct child has multiple distinct inline/block sub-children and is a header/meta row, split them
      var subChildren = child.children || [];
      if (subChildren.length >= 2 && subChildren.length <= 6 && txt.length < 180) {
        var addedSub = 0;
        for (var s = 0; s < subChildren.length; s++) {
          if (!isElementVisible(subChildren[s], win)) continue;
          var subTxt = cleanCellText(subChildren[s], win);
          if (subTxt) {
            var subLabel = guessCardFieldLabel(subChildren[s], fields.length + 1);
            pushField(subLabel, subTxt);
            addedSub++;
          }
        }
        if (addedSub > 0) continue;
      }

      var label = guessCardFieldLabel(child, fields.length + 1);
      pushField(label, txt);
    }

    return fields;
  }

  function guessCardFieldLabel(el, index) {
    var cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    var tag = String(el.tagName || '').toUpperCase();
    var testId = el.getAttribute ? String(el.getAttribute('data-testid') || '').toLowerCase() : '';
    var hint = cls + ' ' + testId;

    if (el.getAttribute && el.getAttribute('data-label')) return el.getAttribute('data-label');
    if (/author|user|buyer|reviewer|name|nick/.test(hint)) return '用户/作者';
    if (/rating|star|score/.test(hint)) return '评分';
    if (/date|time|created/.test(hint) || tag === 'TIME') return '日期';
    if (/price|amount|cost|fee/.test(hint)) return '价格/金额';
    if (/sku|variant|spec|size|color/.test(hint)) return '规格/SKU';
    if (/title|subject|heading/.test(hint) || /^H[1-6]$/.test(tag)) return '标题';
    if (/body|content|comment|review|text|desc/.test(hint) || tag === 'P' || tag === 'BLOCKQUOTE') return '评价/内容';
    return '字段' + index;
  }

  function looksLikeNavOrChrome(containerEl) {
    var tag = String(containerEl.tagName || '').toUpperCase();
    if (tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'ASIDE') return true;
    var role = containerEl.getAttribute ? String(containerEl.getAttribute('role') || '').toLowerCase() : '';
    if (role === 'navigation' || role === 'menubar' || role === 'tablist') return true;
    var cls = typeof containerEl.className === 'string' ? containerEl.className.toLowerCase() : '';
    if (/\b(nav|navbar|menu|breadcrumb|pagination|footer|header|sidebar)\b/.test(cls)) return true;
    return false;
  }

  function extractRepeatedCardLists(doc, win, existingTableEls) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];
    var candidates = doc.querySelectorAll('ul, ol, div, section, [role="list"], [role="grid"]');
    var results = [];
    var usedContainers = [];

    for (var i = 0; i < candidates.length; i++) {
      var container = candidates[i];
      if (!isElementVisible(container, win)) continue;
      if (looksLikeNavOrChrome(container)) continue;

      // Skip if inside an extracted <table> or contains a large <table>
      var skipForTable = false;
      for (var t = 0; t < existingTableEls.length; t++) {
        if (
          existingTableEls[t] === container ||
          (typeof existingTableEls[t].contains === 'function' && existingTableEls[t].contains(container))
        ) {
          skipForTable = true;
          break;
        }
      }
      if (skipForTable) continue;

      var children = container.children || [];
      if (children.length < 3) continue;

      // Group visible children by signature
      var sigBuckets = Object.create(null);
      for (var c = 0; c < children.length; c++) {
        var child = children[c];
        if (!isElementVisible(child, win)) continue;
        if (String(child.tagName || '').toUpperCase() === 'TABLE') continue;
        var sig = getItemSignature(child);
        if (!sigBuckets[sig]) sigBuckets[sig] = [];
        sigBuckets[sig].push(child);
      }

      var bestBucket = null;
      var keys = Object.keys(sigBuckets);
      for (var k = 0; k < keys.length; k++) {
        var bucket = sigBuckets[keys[k]];
        if (bucket.length >= 3 && (!bestBucket || bucket.length > bestBucket.length)) {
          bestBucket = bucket;
        }
      }

      if (!bestBucket) continue;

      // Extract structured fields per item
      var itemRecords = [];
      var maxCols = 0;
      var headerLabels = [];
      for (var b = 0; b < bestBucket.length; b++) {
        var fields = extractFieldsFromCard(bestBucket[b], win);
        if (fields.length >= 2) {
          itemRecords.push(fields);
          if (fields.length > maxCols) maxCols = fields.length;
        }
      }

      if (itemRecords.length < 3 || maxCols < 2) continue;

      // Avoid capturing nested sub-containers if ancestor/descendant already captured
      var overlaps = false;
      for (var u = 0; u < usedContainers.length; u++) {
        if (
          usedContainers[u] === container ||
          (typeof container.contains === 'function' && container.contains(usedContainers[u])) ||
          (typeof usedContainers[u].contains === 'function' && usedContainers[u].contains(container))
        ) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (var col = 0; col < maxCols; col++) {
        var lbl = null;
        for (var r = 0; r < itemRecords.length; r++) {
          if (itemRecords[r][col] && itemRecords[r][col].label) {
            lbl = itemRecords[r][col].label;
            break;
          }
        }
        headerLabels.push(lbl || ('字段' + (col + 1)));
      }

      var matrix = [headerLabels];
      for (var r2 = 0; r2 < itemRecords.length; r2++) {
        var row = [];
        for (var c2 = 0; c2 < maxCols; c2++) {
          row.push(itemRecords[r2][c2] ? itemRecords[r2][c2].value : '');
        }
        matrix.push(row);
      }

      usedContainers.push(container);
      results.push({
        element: container,
        sourceType: 'reviews',
        title: inferElementTitle(container, '评价/卡片列表 #' + (results.length + 1)),
        rows: matrix,
        rowCount: matrix.length,
        colCount: maxCols,
        hasHeader: true,
        area: matrix.length * maxCols
      });
    }

    return results;
  }

  function detectTablesAndLists(doc, win) {
    if (!doc) return { tables: [], totalTables: 0, totalRowsAcrossAll: 0 };

    var tableNodes = typeof doc.querySelectorAll === 'function' ? doc.querySelectorAll('table') : [];
    var tableCandidates = [];
    var tableElements = [];

    for (var i = 0; i < tableNodes.length; i++) {
      var tbl = tableNodes[i];
      if (!isElementVisible(tbl, win)) continue;
      var extracted = extractTableMatrix(tbl, win);
      if (extracted.rowCount < 2 || extracted.colCount < 2) {
        if (extracted.rowCount * extracted.colCount < 4) continue;
      }
      tableElements.push(tbl);
      tableCandidates.push({
        element: tbl,
        sourceType: 'table',
        title: inferElementTitle(tbl, '数据表格 #' + (tableCandidates.length + 1)),
        rows: extracted.rows,
        rowCount: extracted.rowCount,
        colCount: extracted.colCount,
        hasHeader: extracted.hasHeader,
        area: extracted.rowCount * extracted.colCount
      });
    }

    var cardCandidates = extractRepeatedCardLists(doc, win, tableElements);
    var combined = tableCandidates.concat(cardCandidates);

    // Rank by area (rows * cols), favoring semantic tables gently on ties
    combined.sort(function (a, b) {
      var scoreA = a.area * (a.sourceType === 'table' ? 1.1 : 1.0);
      var scoreB = b.area * (b.sourceType === 'table' ? 1.1 : 1.0);
      return scoreB - scoreA;
    });

    var totalRowsAcrossAll = 0;
    var output = combined.map(function (item, idx) {
      totalRowsAcrossAll += item.rowCount;
      return {
        index: idx,
        sourceType: item.sourceType,
        title: item.title,
        rows: item.rows,
        rowCount: item.rowCount,
        colCount: item.colCount,
        hasHeader: item.hasHeader,
        area: item.area,
        element: item.element
      };
    });

    return {
      tables: output,
      totalTables: output.length,
      totalRowsAcrossAll: totalRowsAcrossAll
    };
  }

  return {
    isElementVisible: isElementVisible,
    cleanCellText: cleanCellText,
    extractTableMatrix: extractTableMatrix,
    extractRepeatedCardLists: extractRepeatedCardLists,
    detectTablesAndLists: detectTablesAndLists
  };
});
