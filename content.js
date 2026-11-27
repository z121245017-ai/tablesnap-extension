(function () {
  'use strict';

  var HIGHLIGHT_ID = '__tablesnap_highlight_overlay__';
  var highlightTimer = null;
  var lastElements = [];

  function removeHighlight() {
    var existing = document.getElementById(HIGHLIGHT_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  }

  function flashHighlight(el, labelText) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    removeHighlight();

    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } catch (_err) {
      // Ignore scroll errors
    }

    var rect = el.getBoundingClientRect();
    var overlay = document.createElement('div');
    overlay.id = HIGHLIGHT_ID;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.position = 'fixed';
    overlay.style.left = Math.max(0, rect.left - 3) + 'px';
    overlay.style.top = Math.max(0, rect.top - 3) + 'px';
    overlay.style.width = Math.max(24, rect.width + 6) + 'px';
    overlay.style.height = Math.max(24, rect.height + 6) + 'px';
    overlay.style.border = '2px solid #2563EB';
    overlay.style.background = 'rgba(37, 99, 235, 0.08)';
    overlay.style.borderRadius = '8px';
    overlay.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.14)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483646';
    overlay.style.transition = 'opacity 220ms ease';

    var badge = document.createElement('div');
    badge.textContent = labelText || 'TableSnap 已选中';
    badge.style.position = 'absolute';
    badge.style.top = '-24px';
    badge.style.left = '0';
    badge.style.background = '#2563EB';
    badge.style.color = '#FFFFFF';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '600';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '999px';
    badge.style.whiteSpace = 'nowrap';
    badge.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    overlay.appendChild(badge);

    (document.body || document.documentElement).appendChild(overlay);

    highlightTimer = setTimeout(function () {
      overlay.style.opacity = '0';
      setTimeout(removeHighlight, 240);
    }, 1600);
  }

  function scanPage() {
    var extractor = globalThis.TableSnapExtractor;
    if (!extractor || typeof extractor.detectTablesAndLists !== 'function') {
      return { tables: [], totalTables: 0, totalRowsAcrossAll: 0 };
    }

    var result = extractor.detectTablesAndLists(document, window);
    lastElements = result.tables.map(function (item) {
      return item.element;
    });

    var serialized = result.tables.map(function (item) {
      return {
        index: item.index,
        sourceType: item.sourceType,
        title: item.title,
        rows: item.rows,
        rowCount: item.rowCount,
        colCount: item.colCount,
        hasHeader: item.hasHeader
      };
    });

    if (lastElements[0]) {
      flashHighlight(
        lastElements[0],
        'TableSnap · ' + serialized[0].rowCount + ' 行 × ' + serialized[0].colCount + ' 列'
      );
    }

    return {
      pageTitle: document.title || '',
      pageUrl: location.href || '',
      tables: serialized,
      totalTables: result.totalTables,
      totalRowsAcrossAll: result.totalRowsAcrossAll
    };
  }

  if (!window.__tableSnapListenerRegistered) {
    window.__tableSnapListenerRegistered = true;
    chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (!msg || !msg.type) return false;
      if (msg.type === 'TABLESNAP_SCAN') {
        try {
          sendResponse({ ok: true, data: scanPage() });
        } catch (err) {
          sendResponse({ ok: false, error: String((err && err.message) || err) });
        }
        return false;
      }
      if (msg.type === 'TABLESNAP_HIGHLIGHT') {
        var idx = typeof msg.index === 'number' ? msg.index : 0;
        var el = lastElements[idx];
        if (el) {
          flashHighlight(el, msg.label || 'TableSnap 已切换');
        }
        sendResponse({ ok: Boolean(el) });
        return false;
      }
      return false;
    });
  }
})();
