(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TableSnapExporter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var UTF8_BOM = '\uFEFF';

  function normalizeCellValue(val) {
    if (val === null || val === undefined) return '';
    return String(val);
  }

  /**
   * Determines whether a string is a long numeric ID/SKU (>=11 digits)
   * or a leading-zero numeric code (e.g. "001234") that Excel would corrupt
   * into scientific notation or strip leading zeros from.
   */
  function shouldProtectLongNumeric(rawValue) {
    var trimmed = normalizeCellValue(rawValue).trim();
    if (!trimmed) return false;
    if (/^\d{11,}$/.test(trimmed)) return true;
    if (/^0\d+$/.test(trimmed)) return true;
    return false;
  }

  function escapeCsvRfc4180(str) {
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function formatCsvCell(rawValue, options) {
    var opts = options || {};
    var protectLongIds = opts.protectLongIds !== false;
    var val = normalizeCellValue(rawValue);

    if (protectLongIds && shouldProtectLongNumeric(val)) {
      var trimmed = val.trim();
      return escapeCsvRfc4180('="' + trimmed + '"');
    }

    return escapeCsvRfc4180(val);
  }

  function normalizeMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) return [];
    var maxCols = 0;
    for (var i = 0; i < matrix.length; i++) {
      if (Array.isArray(matrix[i]) && matrix[i].length > maxCols) {
        maxCols = matrix[i].length;
      }
    }
    if (maxCols === 0) return [];
    var out = [];
    for (var r = 0; r < matrix.length; r++) {
      var src = Array.isArray(matrix[r]) ? matrix[r] : [];
      var row = [];
      for (var c = 0; c < maxCols; c++) {
        row.push(normalizeCellValue(src[c]));
      }
      out.push(row);
    }
    return out;
  }

  function toCsv(matrix, options) {
    var opts = options || {};
    var includeBom = opts.includeBom !== false;
    var protectLongIds = opts.protectLongIds !== false;
    var rows = normalizeMatrix(matrix);
    if (rows.length === 0) return includeBom ? UTF8_BOM : '';

    var lines = new Array(rows.length);
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cells = new Array(row.length);
      for (var c = 0; c < row.length; c++) {
        cells[c] = formatCsvCell(row[c], { protectLongIds: protectLongIds });
      }
      lines[r] = cells.join(',');
    }

    return (includeBom ? UTF8_BOM : '') + lines.join('\r\n');
  }

  function escapeMarkdownCell(val) {
    return normalizeCellValue(val)
      .replace(/\r?\n/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();
  }

  function toMarkdown(matrix) {
    var rows = normalizeMatrix(matrix);
    if (rows.length === 0) return '';

    var header = rows[0].map(escapeMarkdownCell);
    var separator = header.map(function () {
      return '---';
    });

    var lines = [
      '| ' + header.join(' | ') + ' |',
      '| ' + separator.join(' | ') + ' |'
    ];

    for (var r = 1; r < rows.length; r++) {
      var bodyCells = rows[r].map(escapeMarkdownCell);
      lines.push('| ' + bodyCells.join(' | ') + ' |');
    }

    return lines.join('\n');
  }

  function escapeTsvCell(val) {
    return normalizeCellValue(val)
      .replace(/\r?\n/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }

  function toTsv(matrix) {
    var rows = normalizeMatrix(matrix);
    if (rows.length === 0) return '';

    var lines = new Array(rows.length);
    for (var r = 0; r < rows.length; r++) {
      lines[r] = rows[r].map(escapeTsvCell).join('\t');
    }
    return lines.join('\n');
  }

  function toJson(matrix, options) {
    var opts = options || {};
    var useFirstRowAsHeaders = opts.useFirstRowAsHeaders !== false;
    var rows = normalizeMatrix(matrix);
    if (rows.length === 0) return '[]';

    if (!useFirstRowAsHeaders || rows.length === 1) {
      return JSON.stringify(rows, null, 2);
    }

    var rawHeaders = rows[0];
    var seen = Object.create(null);
    var headers = rawHeaders.map(function (h, idx) {
      var base = normalizeCellValue(h).trim() || ('column_' + (idx + 1));
      if (!seen[base]) {
        seen[base] = 1;
        return base;
      }
      seen[base] += 1;
      return base + '_' + seen[base];
    });

    var records = [];
    for (var r = 1; r < rows.length; r++) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = rows[r][c];
      }
      records.push(obj);
    }
    return JSON.stringify(records, null, 2);
  }

  function buildFilename(title, ext) {
    var safeTitle = normalizeCellValue(title)
      .replace(/[\\/:*?"<>|#\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'table';
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var stamp =
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      '-' +
      pad(now.getHours()) +
      pad(now.getMinutes());
    var cleanExt = String(ext || 'csv').replace(/^\./, '');
    return 'tablesnap-' + safeTitle + '-' + stamp + '.' + cleanExt;
  }

  return {
    UTF8_BOM: UTF8_BOM,
    shouldProtectLongNumeric: shouldProtectLongNumeric,
    formatCsvCell: formatCsvCell,
    toCsv: toCsv,
    toMarkdown: toMarkdown,
    toTsv: toTsv,
    toJson: toJson,
    buildFilename: buildFilename
  };
});
