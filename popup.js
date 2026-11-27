(function () {
  'use strict';

  var STORAGE_KEYS = {
    PROTECT_LONG_IDS: 'tablesnap_protect_long_ids',
    COFFEE_DISMISSED: 'tablesnap_coffee_dismissed',
    COFFEE_DONATED: 'tablesnap_coffee_donated'
  };

  var state = {
    tabId: null,
    tables: [],
    activeIndex: 0,
    protectLongIds: true,
    coffeeDonated: false
  };

  var els = {
    statusSummary: document.getElementById('statusSummary'),
    rescanBtn: document.getElementById('rescanBtn'),
    switcherRow: document.getElementById('switcherRow'),
    tableSelect: document.getElementById('tableSelect'),
    highlightBtn: document.getElementById('highlightBtn'),
    previewWrapper: document.getElementById('previewWrapper'),
    previewBadge: document.getElementById('previewBadge'),
    previewTable: document.getElementById('previewTable'),
    emptyState: document.getElementById('emptyState'),
    protectLongIdsToggle: document.getElementById('protectLongIdsToggle'),
    downloadCsvBtn: document.getElementById('downloadCsvBtn'),
    copyMarkdownBtn: document.getElementById('copyMarkdownBtn'),
    copyTsvBtn: document.getElementById('copyTsvBtn'),
    downloadJsonBtn: document.getElementById('downloadJsonBtn'),
    toastBar: document.getElementById('toastBar'),
    openCoffeeBtn: document.getElementById('openCoffeeBtn'),
    footerCoffeeLink: document.getElementById('footerCoffeeLink'),
    coffeeModal: document.getElementById('coffeeModal'),
    closeCoffeeModalBtn: document.getElementById('closeCoffeeModalBtn'),
    coffeeDonatedBtn: document.getElementById('coffeeDonatedBtn'),
    coffeeLaterBtn: document.getElementById('coffeeLaterBtn')
  };

  var toastTimer = null;

  function showToast(msg, isError) {
    if (!els.toastBar) return;
    els.toastBar.textContent = msg;
    els.toastBar.classList.toggle('error', Boolean(isError));
    els.toastBar.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toastBar.classList.add('hidden');
    }, 3200);
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }
      chrome.storage.local.get(keys, function (res) {
        resolve(res || {});
      });
    });
  }

  function storageSet(obj) {
    return new Promise(function (resolve) {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.set(obj, function () {
        resolve();
      });
    });
  }

  function updateCoffeeButtonState() {
    if (!els.openCoffeeBtn) return;
    if (state.coffeeDonated) {
      els.openCoffeeBtn.textContent = '☕ 已支持作者';
      els.openCoffeeBtn.classList.add('supported');
    } else {
      els.openCoffeeBtn.textContent = '☕ 请作者喝咖啡';
      els.openCoffeeBtn.classList.remove('supported');
    }
  }

  function setActionsEnabled(enabled) {
    els.downloadCsvBtn.disabled = !enabled;
    els.copyMarkdownBtn.disabled = !enabled;
    els.copyTsvBtn.disabled = !enabled;
    els.downloadJsonBtn.disabled = !enabled;
  }

  function getActiveTable() {
    return state.tables[state.activeIndex] || null;
  }

  function renderPreview(table) {
    els.previewTable.textContent = '';
    if (!table || !Array.isArray(table.rows) || table.rows.length === 0) {
      els.previewWrapper.classList.add('hidden');
      return;
    }

    var previewRows = table.rows.slice(0, 4);
    var previewCols = Math.min(4, table.colCount || (previewRows[0] ? previewRows[0].length : 0));

    var thead = document.createElement('thead');
    var headTr = document.createElement('tr');
    for (var c = 0; c < previewCols; c++) {
      var th = document.createElement('th');
      th.textContent = previewRows[0][c] || ('列 ' + (c + 1));
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    els.previewTable.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var r = 1; r < previewRows.length; r++) {
      var tr = document.createElement('tr');
      for (var c2 = 0; c2 < previewCols; c2++) {
        var td = document.createElement('td');
        td.textContent = previewRows[r][c2] || '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    els.previewTable.appendChild(tbody);

    els.previewBadge.textContent =
      '预览前 ' + previewRows.length + ' 行' + (table.colCount > 4 ? '（前 4 列）' : '');
    els.previewWrapper.classList.remove('hidden');
  }

  function renderActiveTable() {
    var table = getActiveTable();
    if (!table) {
      els.statusSummary.textContent = '未检测到可导出表格';
      els.switcherRow.classList.add('hidden');
      els.previewWrapper.classList.add('hidden');
      els.emptyState.classList.remove('hidden');
      setActionsEnabled(false);
      return;
    }

    var typePrefix = table.sourceType === 'reviews' ? '评价/卡片列表' : table.title;
    els.statusSummary.textContent =
      '已识别：' + typePrefix + ' · ' + table.rowCount + ' 行 × ' + table.colCount + ' 列';

    if (state.tables.length > 1) {
      els.switcherRow.classList.remove('hidden');
    } else {
      els.switcherRow.classList.add('hidden');
    }

    els.emptyState.classList.add('hidden');
    setActionsEnabled(true);
    renderPreview(table);
  }

  function populateTableSelector() {
    els.tableSelect.textContent = '';
    state.tables.forEach(function (tbl, idx) {
      var opt = document.createElement('option');
      opt.value = String(idx);
      var tag = tbl.sourceType === 'reviews' ? '[列表]' : '[表格]';
      opt.textContent = tag + ' ' + tbl.title + ' (' + tbl.rowCount + '×' + tbl.colCount + ')';
      els.tableSelect.appendChild(opt);
    });
    els.tableSelect.value = String(state.activeIndex);
  }

  async function resolveTargetTabId() {
    var params = new URLSearchParams(window.location.search);
    var explicitTabId = params.get('tabId');
    if (explicitTabId && /^\d+$/.test(explicitTabId)) {
      return Number(explicitTabId);
    }

    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0 && typeof tabs[0].id === 'number') {
      var activeUrl = String(tabs[0].url || '');
      if (activeUrl.indexOf('chrome-extension://') !== 0) {
        return tabs[0].id;
      }
    }

    // Fallback when popup.html is opened directly inside a tab (e.g. automated E2E)
    var allTabs = await chrome.tabs.query({ currentWindow: true });
    for (var i = 0; i < allTabs.length; i++) {
      var u = String(allTabs[i].url || '');
      if (u.indexOf('http://') === 0 || u.indexOf('https://') === 0 || u.indexOf('file://') === 0) {
        return allTabs[i].id;
      }
    }
    return null;
  }

  async function scanCurrentTab() {
    els.statusSummary.textContent = '正在扫描当前页面表格…';
    setActionsEnabled(false);

    try {
      var tabId = await resolveTargetTabId();
      if (tabId === null) {
        els.statusSummary.textContent = '未找到可读取的网页标签页';
        els.emptyState.classList.remove('hidden');
        return;
      }
      state.tabId = tabId;

      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/extractor/table_extractor.js', 'content.js']
      });

      var resp = await chrome.tabs.sendMessage(tabId, { type: 'TABLESNAP_SCAN' });
      if (!resp || !resp.ok || !resp.data) {
        throw new Error((resp && resp.error) || '扫描失败');
      }

      state.tables = resp.data.tables || [];
      state.activeIndex = 0;
      populateTableSelector();
      renderActiveTable();
    } catch (err) {
      state.tables = [];
      renderActiveTable();
      els.statusSummary.textContent = '无法读取该系统页面';
      showToast('当前页面受浏览器保护或未就绪：' + String((err && err.message) || err), true);
    }
  }

  async function highlightSelectedTable() {
    var table = getActiveTable();
    if (!table || state.tabId === null) return;
    try {
      await chrome.tabs.sendMessage(state.tabId, {
        type: 'TABLESNAP_HIGHLIGHT',
        index: state.activeIndex,
        label: 'TableSnap · ' + table.rowCount + ' 行 × ' + table.colCount + ' 列'
      });
    } catch (_err) {
      // Ignore highlight error
    }
  }

  function triggerDownload(content, mimeType, filename) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    }, 1000);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_err) {
        // Fallback below
      }
    }
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_err2) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  function bindEvents() {
    els.rescanBtn.addEventListener('click', scanCurrentTab);

    els.tableSelect.addEventListener('change', function () {
      state.activeIndex = Number(els.tableSelect.value) || 0;
      renderActiveTable();
      highlightSelectedTable();
    });

    els.highlightBtn.addEventListener('click', highlightSelectedTable);

    els.protectLongIdsToggle.addEventListener('change', function () {
      state.protectLongIds = Boolean(els.protectLongIdsToggle.checked);
      var payload = {};
      payload[STORAGE_KEYS.PROTECT_LONG_IDS] = state.protectLongIds;
      storageSet(payload);
    });

    els.downloadCsvBtn.addEventListener('click', function () {
      var table = getActiveTable();
      if (!table) return;
      var csv = TableSnapExporter.toCsv(table.rows, {
        includeBom: true,
        protectLongIds: state.protectLongIds
      });
      var filename = TableSnapExporter.buildFilename(table.title, 'csv');
      triggerDownload(csv, 'text/csv;charset=utf-8', filename);
      showToast('已导出全部 ' + table.rowCount + ' 行 Excel 兼容 CSV（含 UTF-8 BOM）');
    });

    els.copyMarkdownBtn.addEventListener('click', async function () {
      var table = getActiveTable();
      if (!table) return;
      var md = TableSnapExporter.toMarkdown(table.rows);
      var ok = await copyToClipboard(md);
      if (ok) {
        showToast('已复制 ' + table.rowCount + ' 行 Markdown 表格到剪贴板');
      } else {
        showToast('复制失败，请检查剪贴板权限', true);
      }
    });

    els.copyTsvBtn.addEventListener('click', async function () {
      var table = getActiveTable();
      if (!table) return;
      var tsv = TableSnapExporter.toTsv(table.rows);
      var ok = await copyToClipboard(tsv);
      if (ok) {
        showToast('已复制 ' + table.rowCount + ' 行 TSV（可直接粘贴到飞书/Sheets）');
      } else {
        showToast('复制失败，请检查剪贴板权限', true);
      }
    });

    els.downloadJsonBtn.addEventListener('click', function () {
      var table = getActiveTable();
      if (!table) return;
      var json = TableSnapExporter.toJson(table.rows, { useFirstRowAsHeaders: true });
      var filename = TableSnapExporter.buildFilename(table.title, 'json');
      triggerDownload(json, 'application/json;charset=utf-8', filename);
      showToast('已导出 ' + table.rowCount + ' 行 JSON 数据');
    });

    function openCoffeeModal() {
      els.coffeeModal.classList.remove('hidden');
    }

    function closeCoffeeModal() {
      els.coffeeModal.classList.add('hidden');
    }

    els.openCoffeeBtn.addEventListener('click', openCoffeeModal);
    els.footerCoffeeLink.addEventListener('click', openCoffeeModal);
    els.closeCoffeeModalBtn.addEventListener('click', closeCoffeeModal);

    els.coffeeModal.addEventListener('click', function (evt) {
      if (evt.target === els.coffeeModal) {
        closeCoffeeModal();
      }
    });

    els.coffeeDonatedBtn.addEventListener('click', async function () {
      state.coffeeDonated = true;
      updateCoffeeButtonState();
      var payload = {};
      payload[STORAGE_KEYS.COFFEE_DISMISSED] = true;
      payload[STORAGE_KEYS.COFFEE_DONATED] = true;
      await storageSet(payload);
      closeCoffeeModal();
      showToast('感谢你的咖啡支持，祝工作顺心！');
    });

    els.coffeeLaterBtn.addEventListener('click', async function () {
      var payload = {};
      payload[STORAGE_KEYS.COFFEE_DISMISSED] = true;
      await storageSet(payload);
      closeCoffeeModal();
    });
  }

  async function init() {
    var saved = await storageGet([
      STORAGE_KEYS.PROTECT_LONG_IDS,
      STORAGE_KEYS.COFFEE_DONATED
    ]);
    if (typeof saved[STORAGE_KEYS.PROTECT_LONG_IDS] === 'boolean') {
      state.protectLongIds = saved[STORAGE_KEYS.PROTECT_LONG_IDS];
    }
    state.coffeeDonated = Boolean(saved[STORAGE_KEYS.COFFEE_DONATED]);
    els.protectLongIdsToggle.checked = state.protectLongIds;
    updateCoffeeButtonState();
    bindEvents();
    await scanCurrentTab();
  }

  init();
})();
