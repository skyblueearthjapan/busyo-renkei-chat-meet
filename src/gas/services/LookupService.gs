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
      channels: []
    };

    var categoryMap = {
      'IssueType': 'issueTypes',
      'Outcome': 'outcomes',
      'Priority': 'priorities',
      'Status': 'statuses',
      'Channel': 'channels'
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
      channels: ['Chat', 'Meet', 'Chat→Meet', 'Meet→Chat']
    };
  }

  /**
   * キャッシュをクリア（管理者用）
   */
  function clearCache() {
    var cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY);
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
      'Channel': 'channels'
    };
    var key = categoryMap[category] || category;
    return lookup[key] || [];
  }

  return {
    getLookup: getLookup,
    getByCategory: getByCategory,
    clearCache: clearCache
  };
})();
