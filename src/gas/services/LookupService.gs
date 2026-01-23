/**
 * LookupService.gs - Lookup値取得サービス
 * プルダウン選択肢をLookupシートから取得
 * CacheServiceで5分間キャッシュ
 */

var LookupService = (function() {
  var CACHE_KEY = 'lookup_data';

  /**
   * Lookup全体を取得（キャッシュ付き）
   * @returns {Object} カテゴリ別の選択肢
   */
  function getLookup() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // キャッシュが壊れていたら再取得
      }
    }

    var data = fetchLookupFromSheet();
    cache.put(CACHE_KEY, JSON.stringify(data), Config.CACHE_TTL);
    return data;
  }

  /**
   * シートからLookupデータを取得
   * @returns {Object} カテゴリ別の選択肢
   */
  function fetchLookupFromSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_LOOKUP);

    if (!sheet) {
      console.warn('Lookupシートが見つかりません');
      return getDefaultLookup();
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return getDefaultLookup();
    }

    // ヘッダーからインデックスマップを作成
    var headers = data[0];
    var colIndex = {};
    for (var i = 0; i < headers.length; i++) {
      colIndex[headers[i]] = i;
    }

    var catCol = colIndex['カテゴリ'];
    var valCol = colIndex['値'];
    var orderCol = colIndex['表示順'];
    var enabledCol = colIndex['有効'];

    if (catCol === undefined || valCol === undefined) {
      console.warn('Lookupシートのヘッダーが不正です');
      return getDefaultLookup();
    }

    // カテゴリ別に集約
    var lookup = {
      issueTypes: [],
      outcomes: [],
      priorities: [],
      statuses: [],
      channels: [],
      Site: []  // 拠点一覧
    };

    var categoryMap = {
      'IssueType': 'issueTypes',
      'Outcome': 'outcomes',
      'Priority': 'priorities',
      'Status': 'statuses',
      'Channel': 'channels',
      'Site': 'Site'  // 拠点カテゴリを追加
    };

    var tempData = {};
    for (var key in categoryMap) {
      tempData[categoryMap[key]] = [];
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var category = row[catCol];
      var value = row[valCol];
      var order = orderCol !== undefined ? (parseInt(row[orderCol], 10) || 999) : 999;
      var enabled = enabledCol !== undefined ? row[enabledCol] : 'Y';

      if (enabled !== 'Y' || !value) continue;

      var targetKey = categoryMap[category];
      if (targetKey) {
        tempData[targetKey].push({ value: value, order: order });
      }
    }

    // 表示順でソートして値のみの配列に変換
    for (var key in tempData) {
      tempData[key].sort(function(a, b) { return a.order - b.order; });
      lookup[key] = tempData[key].map(function(item) { return item.value; });
    }

    return lookup;
  }

  /**
   * デフォルトのLookup値（シートが無い場合のフォールバック）
   * @returns {Object} デフォルト選択肢
   */
  function getDefaultLookup() {
    return {
      issueTypes: ['図面確認', '部品不良/不具合', '加工方法/条件', '組立手順/向き', '納期/段取り', '品質/検査', 'その他'],
      outcomes: ['その場で解決', 'Meetで解決', '後日対応', '設計修正が必要', '加工条件変更が必要', 'エスカレーション', '未完/保留'],
      priorities: ['高', '中', '低'],
      statuses: ['Open', 'In Progress', 'Done', 'Canceled'],
      channels: ['Chat', 'Meet', 'Chat→Meet', 'Meet→Chat'],
      Site: []  // デフォルトは空（部署データからフォールバック）
    };
  }

  /**
   * キャッシュをクリア（管理者用）
   */
  function clearCache() {
    var cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY);
  }

  // ============================================
  // 拠点（Site）管理機能
  // ============================================

  /**
   * 拠点一覧を取得（管理者用：表示順とvalueを含むオブジェクト配列）
   * @returns {Array} [{value, order}, ...]
   */
  function listSites() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_LOOKUP);

    if (!sheet) {
      return [];
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }

    var headers = data[0];
    var colIndex = {};
    for (var i = 0; i < headers.length; i++) {
      colIndex[headers[i]] = i;
    }

    var catCol = colIndex['カテゴリ'];
    var valCol = colIndex['値'];
    var orderCol = colIndex['表示順'];
    var enabledCol = colIndex['有効'];

    if (catCol === undefined || valCol === undefined) {
      return [];
    }

    var sites = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[catCol] === 'Site') {
        var enabled = enabledCol !== undefined ? row[enabledCol] : 'Y';
        if (enabled === 'Y') {
          sites.push({
            value: row[valCol],
            order: orderCol !== undefined ? (parseInt(row[orderCol], 10) || 999) : 999,
            rowIndex: i + 1  // シート行番号（1始まり）
          });
        }
      }
    }

    // 表示順でソート
    sites.sort(function(a, b) { return a.order - b.order; });
    return sites;
  }

  /**
   * 拠点を追加
   * @param {string} name - 拠点名
   * @param {number} order - 表示順
   */
  function addSiteRow(name, order) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_LOOKUP);

    if (!sheet) {
      throw new Error('Lookupシートが見つかりません');
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colIndex = {};
    for (var i = 0; i < headers.length; i++) {
      colIndex[headers[i]] = i;
    }

    // 新しい行データを作成
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      var header = String(headers[i]).trim();
      var value = '';

      switch (header) {
        case 'カテゴリ':
          value = 'Site';
          break;
        case '値':
          value = name;
          break;
        case '表示順':
          value = order || 999;
          break;
        case '有効':
          value = 'Y';
          break;
        default:
          value = '';
      }
      newRow.push(value);
    }

    sheet.appendRow(newRow);
    clearCache();
  }

  /**
   * 拠点を更新
   * @param {string} oldName - 現在の拠点名
   * @param {string} newName - 新しい拠点名
   * @param {number} order - 表示順
   */
  function updateSiteRow(oldName, newName, order) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_LOOKUP);

    if (!sheet) {
      throw new Error('Lookupシートが見つかりません');
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var colIndex = {};
    for (var i = 0; i < headers.length; i++) {
      colIndex[headers[i]] = i;
    }

    var catCol = colIndex['カテゴリ'];
    var valCol = colIndex['値'];
    var orderCol = colIndex['表示順'];

    // 対象行を検索
    var targetRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][catCol] === 'Site' && data[i][valCol] === oldName) {
        targetRow = i + 1;  // シート行番号（1始まり）
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('拠点が見つかりません: ' + oldName);
    }

    // 更新
    sheet.getRange(targetRow, valCol + 1).setValue(newName);
    if (orderCol !== undefined) {
      sheet.getRange(targetRow, orderCol + 1).setValue(order || 999);
    }

    clearCache();
  }

  /**
   * 拠点を削除
   * @param {string} name - 拠点名
   */
  function deleteSiteRow(name) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_LOOKUP);

    if (!sheet) {
      throw new Error('Lookupシートが見つかりません');
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var colIndex = {};
    for (var i = 0; i < headers.length; i++) {
      colIndex[headers[i]] = i;
    }

    var catCol = colIndex['カテゴリ'];
    var valCol = colIndex['値'];

    // 対象行を検索
    var targetRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][catCol] === 'Site' && data[i][valCol] === name) {
        targetRow = i + 1;  // シート行番号（1始まり）
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('拠点が見つかりません: ' + name);
    }

    sheet.deleteRow(targetRow);
    clearCache();
  }

  /**
   * 特定カテゴリの値を取得
   * @param {string} category - カテゴリ名
   * @returns {Array} 値の配列
   */
  function getByCategory(category) {
    var lookup = getLookup();
    var categoryMap = {
      'IssueType': 'issueTypes',
      'Outcome': 'outcomes',
      'Priority': 'priorities',
      'Status': 'statuses',
      'Channel': 'channels',
      'Site': 'Site'
    };
    var key = categoryMap[category] || category;
    return lookup[key] || [];
  }

  return {
    getLookup: getLookup,
    getByCategory: getByCategory,
    clearCache: clearCache,
    // 拠点管理
    listSites: listSites,
    addSiteRow: addSiteRow,
    updateSiteRow: updateSiteRow,
    deleteSiteRow: deleteSiteRow
  };
})();
