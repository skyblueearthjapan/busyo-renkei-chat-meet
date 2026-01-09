/**
 * SheetService - スプレッドシート操作サービス
 *
 * Dept_Master、Interaction_Log、Session_Memos、Lookupシートとの
 * 読み書き操作を提供
 */
var SheetService = (function() {
  // シート名定数
  var SHEET_NAMES = {
    DEPT_MASTER: 'Dept_Master',
    CONNECTION_RULES: 'Connection_Rules',
    INTERACTION_LOG: 'Interaction_Log',
    SESSION_MEMOS: 'Session_Memos',
    LOOKUP: 'Lookup'
  };

  // ID採番のプロパティキー
  var PROP_KEYS = {
    NEXT_EVENT_ID: 'nextEventId',
    NEXT_MEMO_ID: 'nextMemoId'
  };

  /**
   * スプレッドシートを取得
   */
  function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * シートを取得
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
   * シートデータをオブジェクト配列として取得
   */
  function getSheetData(sheetName) {
    var sheet = getSheet(sheetName);
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var headers = data[0];
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      rows.push(row);
    }
    return rows;
  }

  /**
   * 次のIDを生成（排他制御付き）
   */
  function generateNextId(propKey, prefix, digits) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var props = PropertiesService.getScriptProperties();
      var currentId = parseInt(props.getProperty(propKey) || '1', 10);
      var newId = prefix + String(currentId).padStart(digits, '0');
      props.setProperty(propKey, String(currentId + 1));
      return newId;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * 日付をフォーマット
   */
  function formatDate(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  // ============================================
  // 部署マスタ関連
  // ============================================

  /**
   * 部署一覧を取得（有効なもののみ、表示順でソート）
   */
  function getDeptList() {
    var data = getSheetData(SHEET_NAMES.DEPT_MASTER);
    var depts = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      // 有効=Y のみ
      if (row['有効(Y/N)'] !== 'Y') continue;

      depts.push({
        id: row['dept_id'],
        name: row['部署表示名'],
        location: row['拠点'],
        order: parseInt(row['表示順'] || '999', 10),
        chatSpaceId: row['ChatスペースID (spaces/...)'] || '',
        chatUrl: row['Chat URL (任意)'] || '',
        notifySpaceId: row['通知先ChatスペースID'] || '',
        meetEnabled: row['Meet利用'] === '部署主催',
        permanentMeetUrl: row['常設Meet URL (任意)'] || '',
        description: row['説明/メモ'] || ''
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
   */
  function getDeptById(deptId) {
    var depts = getDeptList();
    for (var i = 0; i < depts.length; i++) {
      if (depts[i].id === deptId) {
        return depts[i];
      }
    }
    return null;
  }

  // ============================================
  // Lookup関連
  // ============================================

  /**
   * Lookupデータを取得（カテゴリ別に整理）
   */
  function getLookup() {
    var data = getSheetData(SHEET_NAMES.LOOKUP);
    var lookup = {
      IssueType: [],
      Outcome: [],
      Priority: [],
      Status: [],
      Channel: []
    };

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row['有効'] !== 'Y') continue;

      var category = row['カテゴリ'];
      if (lookup[category]) {
        lookup[category].push({
          value: row['値'],
          order: parseInt(row['表示順'] || '999', 10)
        });
      }
    }

    // 各カテゴリを表示順でソート
    for (var cat in lookup) {
      lookup[cat].sort(function(a, b) {
        return a.order - b.order;
      });
      // valueのみの配列に変換
      lookup[cat] = lookup[cat].map(function(item) {
        return item.value;
      });
    }

    return lookup;
  }

  // ============================================
  // イベントログ関連
  // ============================================

  /**
   * イベントログを追記
   * @param {Object} eventData - イベントデータ
   * @returns {string} 生成されたevent_id
   */
  function appendEventLog(eventData) {
    var sheet = getSheet(SHEET_NAMES.INTERACTION_LOG);
    var eventId = generateNextId(PROP_KEYS.NEXT_EVENT_ID, 'E', 4);

    var row = [
      eventId,                                      // event_id
      formatDate(new Date()),                       // 日時
      eventData.userEmail || '',                    // 発信者(Email)
      eventData.userName || '',                     // 発信者表示名
      eventData.fromDeptId || '',                   // 発信部署
      eventData.toDeptId || '',                     // 宛先部署
      eventData.channel || '',                      // チャネル
      eventData.action || '',                       // アクション
      eventData.chatSpaceId || '',                  // ChatスペースID
      eventData.meetingCode || '',                  // Meet会議ID/コード
      eventData.meetingUri || '',                   // Meet参加URL
      eventData.priority || '中',                   // 優先度
      eventData.status || 'Open',                   // ステータス
      eventData.relatedMemoId || '',                // 関連memo_id
      eventData.memo || ''                          // 備考
    ];

    sheet.appendRow(row);
    return eventId;
  }

  /**
   * イベントにメモIDを紐付け
   */
  function updateEventMemoLink(eventId, memoId) {
    var sheet = getSheet(SHEET_NAMES.INTERACTION_LOG);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        // N列（14列目、0始まり=13）に関連memo_idを設定
        sheet.getRange(i + 1, 14).setValue(memoId);
        return;
      }
    }
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
    var sheet = getSheet(SHEET_NAMES.SESSION_MEMOS);
    var memoId = generateNextId(PROP_KEYS.NEXT_MEMO_ID, 'M', 4);

    var row = [
      memoId,                                       // memo_id
      formatDate(memoData.createdAt || new Date()), // 作成日時
      memoData.creatorEmail || '',                  // 作成者(Email)
      memoData.creatorName || '',                   // 作成者表示名
      memoData.fromDeptId || '',                    // 発信部署
      memoData.toDeptId || '',                      // 宛先部署
      memoData.relatedEventId || '',                // 関連event_id
      memoData.issueType || '',                     // 問い合わせ種別
      memoData.summary || '',                       // 要点（短文）
      memoData.decision || '',                      // 決定事項/対応内容
      memoData.assignee || '',                      // 担当者
      memoData.deadline ? formatDate(memoData.deadline) : '',  // 期限
      memoData.outcome || '',                       // 結果
      memoData.priority || '中',                    // 優先度
      memoData.status || 'Open',                    // ステータス
      memoData.attachmentUrl || '',                 // 添付リンク
      memoData.tags || '',                          // タグ
      memoData.note || ''                           // 備考
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
    var data = getSheetData(SHEET_NAMES.SESSION_MEMOS);
    var memos = [];

    // 部署マスタを取得（名前解決用）
    var deptMap = {};
    var depts = getDeptList();
    for (var i = 0; i < depts.length; i++) {
      deptMap[depts[i].id] = depts[i].name;
    }

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (!row['memo_id']) continue;

      // フィルタ適用
      if (filters.status && row['ステータス'] !== filters.status) continue;
      if (filters.issueType && row['問い合わせ種別'] !== filters.issueType) continue;
      if (filters.deptId) {
        if (row['発信部署 (dept_id)'] !== filters.deptId &&
            row['宛先部署 (dept_id)'] !== filters.deptId) continue;
      }

      memos.push({
        id: row['memo_id'],
        createdAt: formatDate(row['作成日時']),
        creatorName: row['作成者表示名'] || row['作成者(Email)'],
        fromDeptId: row['発信部署 (dept_id)'],
        fromDeptName: deptMap[row['発信部署 (dept_id)']] || row['発信部署 (dept_id)'],
        toDeptId: row['宛先部署 (dept_id)'],
        toDeptName: deptMap[row['宛先部署 (dept_id)']] || row['宛先部署 (dept_id)'],
        issueType: row['問い合わせ種別'],
        summary: row['要点（短文）'],
        status: row['ステータス'],
        priority: row['優先度'],
        outcome: row['結果']
      });
    }

    // 日時降順でソート
    memos.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
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
    var data = getSheetData(SHEET_NAMES.SESSION_MEMOS);

    // 部署マスタを取得
    var deptMap = {};
    var depts = getDeptList();
    for (var i = 0; i < depts.length; i++) {
      deptMap[depts[i].id] = depts[i].name;
    }

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row['memo_id'] === memoId) {
        return {
          id: row['memo_id'],
          createdAt: formatDate(row['作成日時']),
          creatorEmail: row['作成者(Email)'],
          creatorName: row['作成者表示名'],
          fromDeptId: row['発信部署 (dept_id)'],
          fromDeptName: deptMap[row['発信部署 (dept_id)']] || row['発信部署 (dept_id)'],
          toDeptId: row['宛先部署 (dept_id)'],
          toDeptName: deptMap[row['宛先部署 (dept_id)']] || row['宛先部署 (dept_id)'],
          relatedEventId: row['関連 event_id'],
          issueType: row['問い合わせ種別'],
          summary: row['要点（短文）'],
          decision: row['決定事項/対応内容'],
          assignee: row['担当者(Email/氏名)'],
          deadline: row['期限'] ? formatDate(row['期限']) : '',
          outcome: row['結果'],
          priority: row['優先度'],
          status: row['ステータス'],
          attachmentUrl: row['添付リンク(写真/図面/Drive)'],
          tags: row['タグ(任意)'],
          note: row['備考']
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
    var sheet = getSheet(SHEET_NAMES.SESSION_MEMOS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    // ヘッダーとカラムのマッピング
    var colMap = {
      'issueType': '問い合わせ種別',
      'summary': '要点（短文）',
      'decision': '決定事項/対応内容',
      'assignee': '担当者(Email/氏名)',
      'deadline': '期限',
      'outcome': '結果',
      'priority': '優先度',
      'status': 'ステータス',
      'attachmentUrl': '添付リンク(写真/図面/Drive)',
      'tags': 'タグ(任意)',
      'note': '備考'
    };

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === memoId) {
        for (var key in updateData) {
          if (colMap[key]) {
            var colIndex = headers.indexOf(colMap[key]);
            if (colIndex >= 0) {
              var value = updateData[key];
              if (key === 'deadline' && value) {
                value = formatDate(value);
              }
              sheet.getRange(i + 1, colIndex + 1).setValue(value);
            }
          }
        }
        return;
      }
    }
    throw new Error('メモが見つかりません: ' + memoId);
  }

  // ============================================
  // Connection_Rules関連（将来用）
  // ============================================

  /**
   * 推奨連絡先を取得
   * @param {string} fromDeptId - 発信部署ID
   * @returns {Array} 推奨部署リスト
   */
  function getRecommendedDepts(fromDeptId) {
    var data = getSheetData(SHEET_NAMES.CONNECTION_RULES);
    var recommended = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row['発信部署 (dept_id)'] === fromDeptId &&
          row['許可(Y/N)'] === 'Y' &&
          row['推奨(Y/N)'] === 'Y') {
        recommended.push({
          toDeptId: row['宛先部署 (dept_id)'],
          defaultChannel: row['既定チャネル'],
          note: row['備考']
        });
      }
    }

    return recommended;
  }

  // 公開API
  return {
    getDeptList: getDeptList,
    getDeptById: getDeptById,
    getLookup: getLookup,
    appendEventLog: appendEventLog,
    updateEventMemoLink: updateEventMemoLink,
    createMemo: createMemo,
    listMemos: listMemos,
    getMemoDetail: getMemoDetail,
    updateMemo: updateMemo,
    getRecommendedDepts: getRecommendedDepts
  };
})();
