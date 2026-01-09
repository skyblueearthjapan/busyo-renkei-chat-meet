/**
 * SheetService.gs - シート操作基盤サービス
 *
 * Dept_Master, Session_Memosシートとの読み書き操作を提供
 * ヘッダー行からindexマップを作成し、列番号固定を避ける
 * CacheServiceで部署データをキャッシュ
 */

var SheetService = (function() {
  var DEPT_CACHE_KEY = 'dept_list_data';

  /**
   * スプレッドシートを取得
   * @returns {Spreadsheet}
   */
  function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * シートを取得
   * @param {string} sheetName - シート名
   * @returns {Sheet}
   */
  function getSheet(sheetName) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('シートが見つかりません: ' + sheetName);
    }
    return sheet;
  }

  /**
   * ヘッダー行からカラムインデックスマップを作成
   * @param {Array} headers - ヘッダー行の配列
   * @returns {Object} カラム名→インデックスのマップ
   */
  function buildColumnMap(headers) {
    var map = {};
    for (var i = 0; i < headers.length; i++) {
      var name = String(headers[i]).trim();
      if (name) {
        map[name] = i;
      }
    }
    return map;
  }

  /**
   * シートデータをオブジェクト配列として取得
   * @param {string} sheetName - シート名
   * @returns {Object} { headers, colMap, rows }
   */
  function getSheetDataWithMap(sheetName) {
    var sheet = getSheet(sheetName);
    var data = sheet.getDataRange().getValues();

    if (data.length < 1) {
      return { headers: [], colMap: {}, rows: [] };
    }

    var headers = data[0];
    var colMap = buildColumnMap(headers);
    var rows = [];

    for (var i = 1; i < data.length; i++) {
      var rowData = {};
      for (var j = 0; j < headers.length; j++) {
        var key = String(headers[j]).trim();
        if (key) {
          rowData[key] = data[i][j];
        }
      }
      rows.push(rowData);
    }

    return { headers: headers, colMap: colMap, rows: rows };
  }

  /**
   * 日付をフォーマット
   * @param {Date|string} date - 日付
   * @returns {string} フォーマットされた日付文字列
   */
  function formatDate(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;
    try {
      return Utilities.formatDate(date, Config.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return String(date);
    }
  }

  /**
   * 日付を短くフォーマット（日付のみ）
   * @param {Date|string} date - 日付
   * @returns {string} yyyy-MM-dd形式
   */
  function formatDateShort(date) {
    if (!date) return '';
    if (typeof date === 'string') {
      // 既にyyyy-MM-dd形式なら変換不要
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      date = new Date(date);
    }
    try {
      return Utilities.formatDate(date, Config.TIMEZONE, 'yyyy-MM-dd');
    } catch (e) {
      return '';
    }
  }

  // ============================================
  // 部署マスタ関連
  // ============================================

  /**
   * 部署一覧を取得（有効=Y、表示順ソート、キャッシュ付き）
   * @param {Object} filters - フィルタ条件 {q?, site?}
   * @returns {Array} 部署リスト
   */
  function getDeptList(filters) {
    filters = filters || {};

    // キャッシュから取得を試みる
    var cache = CacheService.getScriptCache();
    var cachedData = cache.get(DEPT_CACHE_KEY);
    var depts;

    if (cachedData) {
      try {
        depts = JSON.parse(cachedData);
      } catch (e) {
        depts = null;
      }
    }

    if (!depts) {
      depts = fetchDeptListFromSheet();
      // キャッシュに保存
      try {
        cache.put(DEPT_CACHE_KEY, JSON.stringify(depts), Config.CACHE_TTL);
      } catch (e) {
        console.warn('部署リストのキャッシュ保存に失敗:', e);
      }
    }

    // フィルタ適用
    var result = depts;

    if (filters.q) {
      var q = filters.q.toLowerCase();
      result = result.filter(function(d) {
        return d.name.toLowerCase().indexOf(q) >= 0 ||
               (d.note && d.note.toLowerCase().indexOf(q) >= 0);
      });
    }

    if (filters.site) {
      result = result.filter(function(d) {
        return d.site === filters.site;
      });
    }

    return result;
  }

  /**
   * シートから部署データを取得
   * @returns {Array} 部署リスト
   */
  function fetchDeptListFromSheet() {
    var sheetData = getSheetDataWithMap(Config.SHEET_DEPT);
    var rows = sheetData.rows;
    var depts = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];

      // 有効=Y のみ
      if (row['有効(Y/N)'] !== 'Y') continue;

      depts.push({
        dept_id: row['dept_id'] || '',
        name: row['部署表示名'] || '',
        site: row['拠点'] || '',
        order: parseInt(row['表示順'], 10) || 999,
        enabled: true,
        chat_url: row['Chat URL (任意)'] || '',
        chat_space_id: row['ChatスペースID (spaces/...)'] || '',
        notify_space_id: row['通知先ChatスペースID'] || '',
        meet_mode: row['Meet利用'] || '',
        meet_url: row['常設Meet URL (任意)'] || '',
        note: row['説明/メモ'] || ''
      });
    }

    // 表示順でソート
    depts.sort(function(a, b) {
      return a.order - b.order;
    });

    return depts;
  }

  /**
   * 部署IDで部署情報を取得
   * @param {string} deptId - 部署ID
   * @returns {Object|null} 部署情報
   */
  function getDeptById(deptId) {
    var depts = getDeptList();
    for (var i = 0; i < depts.length; i++) {
      if (depts[i].dept_id === deptId) {
        return depts[i];
      }
    }
    return null;
  }

  /**
   * 部署IDから部署名を取得するマップを生成
   * @returns {Object} dept_id → name のマップ
   */
  function getDeptNameMap() {
    var depts = getDeptList();
    var map = {};
    for (var i = 0; i < depts.length; i++) {
      map[depts[i].dept_id] = depts[i].name;
    }
    return map;
  }

  /**
   * 部署キャッシュをクリア
   */
  function clearDeptCache() {
    var cache = CacheService.getScriptCache();
    cache.remove(DEPT_CACHE_KEY);
  }

  // ============================================
  // メモ関連
  // ============================================

  /**
   * メモを作成
   * @param {Object} memoData - メモデータ
   * @returns {string} 生成されたmemo_id
   */
  function createMemo(memoData) {
    var sheet = getSheet(Config.SHEET_MEMO);
    var memoId = IdService.nextMemoId();

    var row = [
      memoId,                                              // memo_id
      formatDate(new Date()),                              // 作成日時
      memoData.creator_email || '',                        // 作成者(Email)
      memoData.creator_name || '',                         // 作成者表示名
      memoData.from_dept_id || '',                         // 発信部署 (dept_id)
      memoData.to_dept_id || '',                           // 宛先部署 (dept_id)
      memoData.related_event_id || '',                     // 関連 event_id
      memoData.issue_type || '',                           // 問い合わせ種別
      memoData.summary || '',                              // 要点（短文）
      memoData.decisions || '',                            // 決定事項/対応内容
      memoData.owner || '',                                // 担当者(Email/氏名)
      formatDateShort(memoData.due_date) || '',            // 期限
      memoData.outcome || '',                              // 結果
      memoData.priority || Config.DEFAULT_PRIORITY,        // 優先度
      memoData.status || Config.DEFAULT_STATUS,            // ステータス
      memoData.attachments || '',                          // 添付リンク(写真/図面/Drive)
      memoData.tags || '',                                 // タグ(任意)
      memoData.note || ''                                  // 備考
    ];

    sheet.appendRow(row);
    return memoId;
  }

  /**
   * メモ一覧を取得
   * @param {Object} filters - フィルタ条件
   * @returns {Array} メモ一覧
   */
  function listMemos(filters) {
    filters = filters || {};
    var sheetData = getSheetDataWithMap(Config.SHEET_MEMO);
    var rows = sheetData.rows;
    var deptMap = getDeptNameMap();
    var memos = [];

    // プリセット: 現在のユーザー情報取得（createdByMe用）
    var currentUserEmail = '';
    if (filters.createdByMe) {
      try {
        currentUserEmail = Session.getActiveUser().getEmail() || '';
      } catch (e) {
        // 取得できない場合は空
      }
    }

    // プリセット: 日付範囲の計算
    var dateRangeStart = null;
    var dateRangeEnd = null;
    if (filters.dateRange) {
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (filters.dateRange === 'today') {
        dateRangeStart = today;
        dateRangeEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      } else if (filters.dateRange === 'week') {
        // 今週（日曜始まり）
        var dayOfWeek = today.getDay();
        dateRangeStart = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        dateRangeEnd = new Date(dateRangeStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      } else if (filters.dateRange === 'month') {
        dateRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateRangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }
    }

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var memoId = row['memo_id'];
      if (!memoId) continue;

      // フィルタ適用
      if (filters.status && row['ステータス'] !== filters.status) continue;
      if (filters.issueType && row['問い合わせ種別'] !== filters.issueType) continue;

      if (filters.fromDeptId && row['発信部署 (dept_id)'] !== filters.fromDeptId) continue;
      if (filters.toDeptId && row['宛先部署 (dept_id)'] !== filters.toDeptId) continue;

      // プリセット: 未完了のみ
      if (filters.incomplete) {
        var status = row['ステータス'] || '';
        if (status === 'Done' || status === 'Canceled') continue;
      }

      // プリセット: 自分が作成
      if (filters.createdByMe && currentUserEmail) {
        var creatorEmail = row['作成者(Email)'] || '';
        if (creatorEmail !== currentUserEmail) continue;
      }

      // 日付フィルタ（従来）
      if (filters.dateFrom || filters.dateTo) {
        var createdAt = row['作成日時'];
        if (createdAt) {
          var createdDate = new Date(createdAt);
          if (filters.dateFrom && createdDate < new Date(filters.dateFrom)) continue;
          if (filters.dateTo && createdDate > new Date(filters.dateTo + ' 23:59:59')) continue;
        }
      }

      // プリセット: 日付範囲フィルタ
      if (dateRangeStart && dateRangeEnd) {
        var createdAt2 = row['作成日時'];
        if (createdAt2) {
          var createdDate2 = new Date(createdAt2);
          if (createdDate2 < dateRangeStart || createdDate2 > dateRangeEnd) continue;
        }
      }

      // 簡易検索（summary, decisions, tags）
      if (filters.q) {
        var q = filters.q.toLowerCase();
        var searchFields = [
          row['要点（短文）'] || '',
          row['決定事項/対応内容'] || '',
          row['タグ(任意)'] || ''
        ].join(' ').toLowerCase();
        if (searchFields.indexOf(q) < 0) continue;
      }

      var fromDeptId = row['発信部署 (dept_id)'] || '';
      var toDeptId = row['宛先部署 (dept_id)'] || '';

      memos.push({
        memo_id: memoId,
        created_at: formatDate(row['作成日時']),
        from_dept: fromDeptId,
        from_dept_name: deptMap[fromDeptId] || fromDeptId,
        to_dept: toDeptId,
        to_dept_name: deptMap[toDeptId] || toDeptId,
        issue_type: row['問い合わせ種別'] || '',
        summary: row['要点（短文）'] || '',
        status: row['ステータス'] || '',
        priority: row['優先度'] || '',
        outcome: row['結果'] || ''
      });
    }

    // 日時降順でソート
    memos.sort(function(a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // 最大件数制限（デフォルト50件）
    var limit = filters.limit || 50;
    return memos.slice(0, limit);
  }

  /**
   * メモ詳細を取得
   * @param {string} memoId - メモID
   * @returns {Object|null} メモ詳細
   */
  function getMemoDetail(memoId) {
    var sheetData = getSheetDataWithMap(Config.SHEET_MEMO);
    var rows = sheetData.rows;
    var deptMap = getDeptNameMap();

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row['memo_id'] === memoId) {
        var fromDeptId = row['発信部署 (dept_id)'] || '';
        var toDeptId = row['宛先部署 (dept_id)'] || '';

        return {
          memo_id: row['memo_id'],
          created_at: formatDate(row['作成日時']),
          creator_email: row['作成者(Email)'] || '',
          creator_name: row['作成者表示名'] || '',
          from_dept_id: fromDeptId,
          from_dept_name: deptMap[fromDeptId] || fromDeptId,
          to_dept_id: toDeptId,
          to_dept_name: deptMap[toDeptId] || toDeptId,
          related_event_id: row['関連 event_id'] || '',
          issue_type: row['問い合わせ種別'] || '',
          summary: row['要点（短文）'] || '',
          decisions: row['決定事項/対応内容'] || '',
          owner: row['担当者(Email/氏名)'] || '',
          due_date: formatDateShort(row['期限']) || '',
          outcome: row['結果'] || '',
          priority: row['優先度'] || '',
          status: row['ステータス'] || '',
          attachments: row['添付リンク(写真/図面/Drive)'] || '',
          tags: row['タグ(任意)'] || '',
          note: row['備考'] || ''
        };
      }
    }
    return null;
  }

  /**
   * メモを更新
   * @param {string} memoId - メモID
   * @param {Object} updateData - 更新データ
   */
  function updateMemo(memoId, updateData) {
    var sheet = getSheet(Config.SHEET_MEMO);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var colMap = buildColumnMap(headers);

    // フィールド名→ヘッダー名のマッピング
    var fieldToHeader = {
      'issue_type': '問い合わせ種別',
      'summary': '要点（短文）',
      'decisions': '決定事項/対応内容',
      'owner': '担当者(Email/氏名)',
      'due_date': '期限',
      'outcome': '結果',
      'priority': '優先度',
      'status': 'ステータス',
      'attachments': '添付リンク(写真/図面/Drive)',
      'tags': 'タグ(任意)',
      'note': '備考'
    };

    for (var i = 1; i < data.length; i++) {
      if (data[i][colMap['memo_id']] === memoId) {
        for (var field in updateData) {
          var headerName = fieldToHeader[field];
          if (headerName && colMap[headerName] !== undefined) {
            var colIndex = colMap[headerName];
            var value = updateData[field];
            if (field === 'due_date' && value) {
              value = formatDateShort(value);
            }
            sheet.getRange(i + 1, colIndex + 1).setValue(value);
          }
        }
        return;
      }
    }
    throw new Error('メモが見つかりません: ' + memoId);
  }

  // 公開API
  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    getSheetDataWithMap: getSheetDataWithMap,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    getDeptList: getDeptList,
    getDeptById: getDeptById,
    getDeptNameMap: getDeptNameMap,
    clearDeptCache: clearDeptCache,
    createMemo: createMemo,
    listMemos: listMemos,
    getMemoDetail: getMemoDetail,
    updateMemo: updateMemo
  };
})();
