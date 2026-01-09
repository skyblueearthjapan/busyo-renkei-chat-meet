/**
 * 部署クイック連絡ポータル - メインエントリポイント
 *
 * doGet: ルーティング + bootstrap埋め込み
 * 公開サーバー関数: getBootstrap, listDepts, logEvent, createMemo, listMemos, getMemoDetail
 */

// ============================================
// doGet - エントリポイント
// ============================================

/**
 * Webアプリのエントリポイント
 * @param {Object} e - イベントオブジェクト
 * @returns {HtmlOutput} HTMLページ
 */
function doGet(e) {
  var page = e.parameter.page || 'home';
  var params = e.parameter;

  // ページに応じたHTMLを返す
  var htmlFile;
  switch (page) {
    case 'memo':
      htmlFile = 'ui/memo';
      break;
    case 'history':
      htmlFile = 'ui/history';
      break;
    case 'detail':
      htmlFile = 'ui/detail';
      break;
    case 'home':
    default:
      htmlFile = 'ui/index';
      page = 'home';
      break;
  }

  // HTMLテンプレートを生成
  var template = HtmlService.createTemplateFromFile(htmlFile);

  // bootstrapデータを埋め込み（初回ロードを速く）
  var bootstrap = getBootstrapData();
  template.bootstrapJson = JSON.stringify(bootstrap);
  template.initialParams = JSON.stringify(params);
  template.currentPage = page;

  return template.evaluate()
    .setTitle('部署クイック連絡')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * HTMLファイルをインクルードするヘルパー
 * @param {string} filename - ファイル名
 * @returns {string} HTMLコンテンツ
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// Bootstrap データ取得
// ============================================

/**
 * 初期表示に必要なデータを取得（内部用）
 * @returns {Object} bootstrap データ
 */
function getBootstrapData() {
  try {
    var user = LogService.getCurrentUserInfo();
    var depts = SheetService.getDeptList();
    var lookup = LookupService.getLookup();

    return {
      user: user,
      depts: depts,
      lookup: lookup
    };
  } catch (e) {
    console.error('getBootstrapData エラー:', e);
    return {
      user: { email: '', name: 'Unknown' },
      depts: [],
      lookup: LookupService.getLookup() // デフォルト値が返る
    };
  }
}

// ============================================
// 公開サーバー関数（google.script.run で呼ぶ）
// ============================================

/**
 * 初期データを取得
 * @returns {Object} { user, depts, lookup }
 */
function getBootstrap() {
  try {
    return {
      success: true,
      data: getBootstrapData()
    };
  } catch (e) {
    console.error('getBootstrap エラー:', e);
    LogService.logError(e.message, { action: 'getBootstrap' });
    return {
      success: false,
      error: 'データの取得に失敗しました。'
    };
  }
}

/**
 * 部署一覧を取得
 * @param {Object} filters - フィルタ条件 {q?, site?}
 * @returns {Object} { success, data, error }
 */
function listDepts(filters) {
  try {
    var depts = SheetService.getDeptList(filters || {});
    return {
      success: true,
      data: depts
    };
  } catch (e) {
    console.error('listDepts エラー:', e);
    LogService.logError(e.message, { action: 'listDepts' });
    return {
      success: false,
      error: '部署一覧の取得に失敗しました。'
    };
  }
}

/**
 * イベントをログに記録
 * @param {Object} payload - ログデータ
 * @returns {Object} { success, eventId, error }
 */
function logEvent(payload) {
  try {
    var result = LogService.logEvent(payload);
    return {
      success: true,
      eventId: result.eventId
    };
  } catch (e) {
    console.error('logEvent エラー:', e);
    return {
      success: false,
      error: 'ログの記録に失敗しました。'
    };
  }
}

/**
 * メモを作成
 * @param {Object} memoPayload - メモデータ
 * @returns {Object} { success, memoId, error }
 */
function createMemo(memoPayload) {
  try {
    // バリデーション
    var validation = Validation.validateMemo(memoPayload);
    if (!validation.valid) {
      return {
        success: false,
        error: Validation.formatErrorMessage(validation.errors),
        validationErrors: validation.errors
      };
    }

    // ユーザー情報を追加
    var user = LogService.getCurrentUserInfo();
    memoPayload.creator_email = user.email;
    memoPayload.creator_name = user.name;

    // メモを保存
    var memoId = SheetService.createMemo(memoPayload);

    // SaveMemoログを記録
    LogService.logSaveMemo(memoId, memoPayload.from_dept_id, memoPayload.to_dept_id);

    // 関連イベントがあればリンク
    if (memoPayload.related_event_id) {
      LogService.linkMemoToEvent(memoPayload.related_event_id, memoId);
    }

    return {
      success: true,
      memoId: memoId
    };
  } catch (e) {
    console.error('createMemo エラー:', e);
    LogService.logError(e.message, { action: 'createMemo', data: memoPayload });
    return {
      success: false,
      error: Validation.getSaveFailureMessage()
    };
  }
}

/**
 * メモ一覧を取得
 * @param {Object} filters - フィルタ条件
 * @returns {Object} { success, data, error }
 */
function listMemos(filters) {
  try {
    var memos = SheetService.listMemos(filters || {});
    return {
      success: true,
      data: memos
    };
  } catch (e) {
    console.error('listMemos エラー:', e);
    LogService.logError(e.message, { action: 'listMemos' });
    return {
      success: false,
      error: '履歴の取得に失敗しました。'
    };
  }
}

/**
 * メモ詳細を取得
 * @param {string} memoId - メモID
 * @returns {Object} { success, data, error }
 */
function getMemoDetail(memoId) {
  try {
    var memo = SheetService.getMemoDetail(memoId);
    if (!memo) {
      return {
        success: false,
        error: 'メモが見つかりません。'
      };
    }
    return {
      success: true,
      data: memo
    };
  } catch (e) {
    console.error('getMemoDetail エラー:', e);
    LogService.logError(e.message, { action: 'getMemoDetail', memoId: memoId });
    return {
      success: false,
      error: 'メモの取得に失敗しました。'
    };
  }
}

/**
 * メモを更新
 * @param {string} memoId - メモID
 * @param {Object} updateData - 更新データ
 * @returns {Object} { success, error }
 */
function updateMemo(memoId, updateData) {
  try {
    SheetService.updateMemo(memoId, updateData);
    return { success: true };
  } catch (e) {
    console.error('updateMemo エラー:', e);
    LogService.logError(e.message, { action: 'updateMemo', memoId: memoId });
    return {
      success: false,
      error: 'メモの更新に失敗しました。'
    };
  }
}

// ============================================
// Sprint 2 用（スタブ）
// ============================================

/**
 * Chat を開く（Sprint 1: ログ記録 + URL返却のみ）
 * @param {string} deptId - 部署ID
 * @returns {Object} { success, chatUrl, eventId, error }
 */
function openChat(deptId) {
  try {
    var dept = SheetService.getDeptById(deptId);
    if (!dept) {
      return { success: false, error: '部署が見つかりません。' };
    }

    var chatUrl = dept.chat_url || '';
    if (!chatUrl && dept.chat_space_id) {
      chatUrl = 'https://chat.google.com/room/' + dept.chat_space_id.replace('spaces/', '');
    }

    if (!chatUrl) {
      return { success: false, error: 'この部署のChatはまだ設定されていません。' };
    }

    // ログ記録
    var result = LogService.logOpenChat(deptId, chatUrl);

    return {
      success: true,
      chatUrl: chatUrl,
      eventId: result.eventId,
      deptName: dept.name
    };
  } catch (e) {
    console.error('openChat エラー:', e);
    LogService.logError(e.message, { action: 'openChat', deptId: deptId });
    return { success: false, error: 'Chatを開けませんでした。' };
  }
}

/**
 * Meet を作成（Sprint 1: ダミー実装、ログ記録のみ）
 * Sprint 2 で Meet API 実装
 * @param {string} deptId - 部署ID
 * @param {string} fromDeptId - 発信部署ID（任意）
 * @returns {Object} { success, eventId, meetUrl, memoUrl, error }
 */
function createMeet(deptId, fromDeptId) {
  try {
    var dept = SheetService.getDeptById(deptId);
    if (!dept) {
      return { success: false, error: '部署が見つかりません。' };
    }

    // Sprint 1: ダミーのMeet URL（またはDept_Masterの常設Meet URL）
    var meetUrl = dept.meet_url || 'https://meet.google.com/xxx-xxxx-xxx';
    var meetCode = 'dummy-' + Date.now();

    // ログ記録
    var result = LogService.logCreateMeet(deptId, meetUrl, meetCode);

    // メモ画面URL生成
    var webAppUrl = ScriptApp.getService().getUrl();
    var memoUrl = webAppUrl + '?page=memo&event_id=' + result.eventId +
                  '&to=' + deptId + (fromDeptId ? '&from=' + fromDeptId : '');

    return {
      success: true,
      eventId: result.eventId,
      meetUrl: meetUrl,
      memoUrl: memoUrl,
      deptName: dept.name
    };
  } catch (e) {
    console.error('createMeet エラー:', e);
    LogService.logError(e.message, { action: 'createMeet', deptId: deptId });
    return { success: false, error: 'Meetを作成できませんでした。' };
  }
}

// ============================================
// 管理者用（任意）
// ============================================

/**
 * キャッシュをクリア
 */
function clearAllCache() {
  SheetService.clearDeptCache();
  LookupService.clearCache();
}

/**
 * 現在のID番号を確認
 */
function getCurrentIdCounters() {
  return IdService.getCurrentIds();
}
