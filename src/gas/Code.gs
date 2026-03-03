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
 * Webアプリのエントリポイント（SPA統合版）
 * @param {Object} e - イベントオブジェクト
 * @returns {HtmlOutput} HTMLページ
 */
function doGet(e) {
  var params = e.parameter || {};
  var page = params.page || 'home';

  // SPA: 常にindex.htmlを返す（ページ切替はクライアント側showPage()で行う）
  var template = HtmlService.createTemplateFromFile('ui/index');

  // bootstrapデータを埋め込み（初回ロードを速く）
  var bootstrap = getBootstrapData();
  template.bootstrapJson = JSON.stringify(bootstrap);
  template.initialParams = JSON.stringify(params);
  template.currentPage = page;
  template.PORTAL_URL = 'https://script.google.com/a/macros/lineworks-local.info/s/AKfycbx2eyJMOYP9o--GPBuhY-pj071IIR6Kqb_0xALwwNzdLQZux0dIAlL3P9EoCucnzXA/exec';

  return template.evaluate()
    .setTitle('部署連携ビデオ電話')
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

    // Sprint 4: 管理者フラグを追加
    user.isAdmin = AuthService.isAdmin();

    return {
      user: user,
      depts: depts,
      lookup: lookup
    };
  } catch (e) {
    console.error('getBootstrapData エラー:', e);
    return {
      user: { email: '', name: 'Unknown', isAdmin: false },
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
// Sprint 2: Chat & Meet API統合
// ============================================

/**
 * Chat を開く（ログ記録 + URL返却）
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
 * Meet を作成（後方互換用ラッパー）
 * @param {string} deptId - 部署ID
 * @param {string} fromDeptId - 発信部署ID（任意）
 * @returns {Object} { success, eventId, meetUrl, memoUrl, error }
 */
function createMeet(deptId, fromDeptId) {
  return createMeetAndNotify({
    toDeptId: deptId,
    fromDeptId: fromDeptId || '',
    channel: 'Meet'
  });
}

/**
 * Meet を作成し、宛先部署にChat通知を送信（Sprint 2 本実装）
 * @param {Object} payload - { toDeptId, fromDeptId?, channel?, priority?, note? }
 * @returns {Object} { success, eventId, meetingUri, meetingCode, memoUrl, notifyResult, deptName, error }
 */
function createMeetAndNotify(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, error: 'サーバーが混み合っています。しばらく待ってからお試しください。' };
  }

  try {
    // ユーザー情報を取得
    var user = AuthService.getCurrentUser();

    // 宛先部署を取得
    var toDept = SheetService.getDeptById(payload.toDeptId);
    if (!toDept) {
      return { success: false, error: '宛先部署が見つかりません。' };
    }
    if (toDept.enabled === 'N') {
      return { success: false, error: 'この部署は現在利用できません。' };
    }

    var fromDeptId = payload.fromDeptId || '';
    var fromDeptName = '';
    if (fromDeptId) {
      var fromDept = SheetService.getDeptById(fromDeptId);
      fromDeptName = fromDept ? fromDept.name : '';
    }

    // 1) CreateMeet イベントログ
    var eventId = IdService.nextEventId();
    LogService.logEvent({
      type: Config.EVENT_TYPES.CREATE_MEET,
      channel: 'Meet',
      fromDeptId: fromDeptId,
      toDeptId: payload.toDeptId,
      priority: payload.priority || '',
      status: 'Open',
      note: payload.note || ''
    });

    // 2) meetingUri決定（常設URL or 都度生成）
    var meetingUri = '';
    var meetingCode = '';

    if (toDept.meet_mode === '常設URL' && toDept.meet_url) {
      // 常設URLを使用
      meetingUri = toDept.meet_url;
      meetingCode = extractMeetingCodeFromUrl(meetingUri);
    } else {
      // Meet APIで都度生成
      var meetResult = GoogleMeetService.createMeetingSpace();
      if (!meetResult.success) {
        // フォールバック: 常設URLがあればそれを使用
        if (toDept.meet_url) {
          meetingUri = toDept.meet_url;
          meetingCode = extractMeetingCodeFromUrl(meetingUri);
        } else {
          throw new Error(meetResult.error || 'Meet会議の作成に失敗しました');
        }
      } else {
        meetingUri = meetResult.meetingUri;
        meetingCode = meetResult.meetingCode || '';
      }
    }

    // 3) MeetReady ログ
    LogService.logEvent({
      type: Config.EVENT_TYPES.MEET_READY,
      channel: 'Meet',
      fromDeptId: fromDeptId,
      toDeptId: payload.toDeptId,
      meetCode: meetingCode,
      meetUrl: meetingUri,
      note: 'related_event: ' + eventId,
      status: 'Open'
    });

    // 4) memoUrl生成
    var memoUrl = UrlService.buildMemoUrl({
      eventId: eventId,
      fromDeptId: fromDeptId,
      toDeptId: payload.toDeptId
    });

    // 5) Chat通知（notify_space_id がある場合のみ）
    var notifyResult = { ok: false };

    if (toDept.notify_space_id) {
      try {
        var cardPayload = GoogleChatService.buildIncomingCallCard({
          title: '📣 連絡があります',
          fromDeptName: fromDeptName || '（未設定）',
          toDeptName: toDept.name,
          callerName: user.name,
          callerEmail: user.email,
          meetingUri: meetingUri,
          memoUrl: memoUrl,
          eventId: eventId
        });

        var chatResult = Retry.withRetry(function() {
          return GoogleChatService.postToSpace(toDept.notify_space_id, cardPayload);
        }, { retries: 1, sleepMs: 300 });

        if (chatResult.ok) {
          notifyResult = { ok: true, messageId: chatResult.messageId || '' };

          // NotifyChat ログ
          LogService.logEvent({
            type: Config.EVENT_TYPES.NOTIFY_CHAT,
            channel: 'Meet',
            fromDeptId: fromDeptId,
            toDeptId: payload.toDeptId,
            chatSpaceId: toDept.notify_space_id,
            meetUrl: meetingUri,
            note: 'related_event: ' + eventId,
            status: 'Open'
          });
        } else {
          // NotifyChatFailed ログ
          LogService.logEvent({
            type: Config.EVENT_TYPES.NOTIFY_CHAT_FAILED,
            channel: 'Meet',
            fromDeptId: fromDeptId,
            toDeptId: payload.toDeptId,
            chatSpaceId: toDept.notify_space_id,
            note: 'related_event: ' + eventId + ' | error: ' + (chatResult.error || 'unknown'),
            status: 'Open'
          });
        }
      } catch (chatErr) {
        console.error('Chat通知エラー:', chatErr);
        // NotifyChatFailed ログ
        LogService.logEvent({
          type: Config.EVENT_TYPES.NOTIFY_CHAT_FAILED,
          channel: 'Meet',
          fromDeptId: fromDeptId,
          toDeptId: payload.toDeptId,
          chatSpaceId: toDept.notify_space_id,
          note: 'related_event: ' + eventId + ' | error: ' + chatErr.message,
          status: 'Open'
        });
      }
    } else {
      // notify先なし: NotifyChatSkipped ログ
      LogService.logEvent({
        type: Config.EVENT_TYPES.NOTIFY_CHAT_SKIPPED,
        channel: 'Meet',
        fromDeptId: fromDeptId,
        toDeptId: payload.toDeptId,
        note: 'related_event: ' + eventId + ' | notify_space_id 未設定',
        status: 'Open'
      });
    }

    return {
      success: true,
      eventId: eventId,
      meetingUri: meetingUri,
      meetUrl: meetingUri, // 後方互換
      meetingCode: meetingCode,
      memoUrl: memoUrl,
      notifyResult: notifyResult,
      deptName: toDept.name,
      deptId: payload.toDeptId
    };

  } catch (err) {
    console.error('createMeetAndNotify エラー:', err);

    // エラーログ
    LogService.logEvent({
      type: Config.EVENT_TYPES.ERROR,
      channel: payload && payload.channel ? payload.channel : 'Meet',
      fromDeptId: payload && payload.fromDeptId ? payload.fromDeptId : '',
      toDeptId: payload && payload.toDeptId ? payload.toDeptId : '',
      status: 'Canceled',
      note: 'createMeetAndNotify: ' + (err.stack || err.message || String(err))
    });

    return {
      success: false,
      error: 'Meetの作成に失敗しました。もう一度お試しください。'
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Meet URLから会議コードを抽出
 * @param {string} url - Meet URL
 * @returns {string} 会議コード
 */
function extractMeetingCodeFromUrl(url) {
  if (!url) return '';
  var match = url.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1] : '';
}

// ============================================
// Sprint 2.5: 通知再送 + 診断機能
// ============================================

/**
 * 通知を再送（失敗した通知のリトライ）
 * @param {string} eventId - 対象のイベントID
 * @returns {Object} { success, notifyResult, error }
 */
function retryNotify(eventId) {
  try {
    // Interaction_LogからeventIdを検索して元情報を取得
    var logSheet = SheetService.getSheet(Config.SHEET_LOG);
    var logData = SheetService.getSheetDataWithMap(Config.SHEET_LOG);
    var data = logSheet.getDataRange().getValues();
    var colMap = logData.colMap;

    var originalEvent = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colMap['event_id']] === eventId) {
        originalEvent = {
          rowIndex: i,
          eventId: data[i][colMap['event_id']],
          type: data[i][colMap['アクション']],
          fromDeptId: data[i][colMap['発信部署']] || '',
          toDeptId: data[i][colMap['宛先部署']] || '',
          meetUrl: data[i][colMap['Meet参加URL']] || '',
          meetCode: data[i][colMap['Meet会議ID/コード']] || ''
        };
        break;
      }
    }

    if (!originalEvent) {
      return { success: false, error: 'イベントが見つかりません: ' + eventId };
    }

    // 宛先部署を取得
    var toDept = SheetService.getDeptById(originalEvent.toDeptId);
    if (!toDept) {
      return { success: false, error: '宛先部署が見つかりません。' };
    }
    if (!toDept.notify_space_id) {
      return { success: false, error: 'この部署には通知先Chatスペースが設定されていません。' };
    }

    // ユーザー情報
    var user = AuthService.getCurrentUser();

    // 発信部署名
    var fromDeptName = '';
    if (originalEvent.fromDeptId) {
      var fromDept = SheetService.getDeptById(originalEvent.fromDeptId);
      fromDeptName = fromDept ? fromDept.name : '';
    }

    // memoUrl再生成
    var memoUrl = UrlService.buildMemoUrl({
      eventId: eventId,
      fromDeptId: originalEvent.fromDeptId,
      toDeptId: originalEvent.toDeptId
    });

    // meetingUri
    var meetingUri = originalEvent.meetUrl || toDept.meet_url || '';

    // Chat通知を再送
    var cardPayload = GoogleChatService.buildIncomingCallCard({
      title: '📣 連絡があります（再送）',
      fromDeptName: fromDeptName || '（未設定）',
      toDeptName: toDept.name,
      callerName: user.name,
      callerEmail: user.email,
      meetingUri: meetingUri,
      memoUrl: memoUrl,
      eventId: eventId
    });

    var chatResult = Retry.withRetry(function() {
      return GoogleChatService.postToSpace(toDept.notify_space_id, cardPayload);
    }, { retries: 2, sleepMs: 500 });

    if (chatResult.ok) {
      // 成功ログ
      LogService.logEvent({
        type: Config.EVENT_TYPES.NOTIFY_CHAT,
        channel: 'Meet',
        fromDeptId: originalEvent.fromDeptId,
        toDeptId: originalEvent.toDeptId,
        chatSpaceId: toDept.notify_space_id,
        meetUrl: meetingUri,
        note: 'retry of: ' + eventId,
        status: 'Open'
      });

      return {
        success: true,
        notifyResult: { ok: true, messageId: chatResult.messageId || '' }
      };
    } else {
      return {
        success: false,
        error: '通知の再送に失敗しました: ' + (chatResult.error || '不明なエラー')
      };
    }

  } catch (e) {
    console.error('retryNotify エラー:', e);
    return {
      success: false,
      error: '通知の再送に失敗しました。'
    };
  }
}

/**
 * 部署設定を診断
 * @returns {Object[]} 診断結果の配列
 */
function validateDeptSettings() {
  try {
    var depts = SheetService.getDeptList();
    var results = [];

    depts.forEach(function(dept) {
      var issues = [];
      var warnings = [];

      // 有効チェック
      if (dept.enabled === 'N') {
        issues.push('無効化されています');
      }

      // Chat設定チェック
      if (!dept.chat_url && !dept.chat_space_id) {
        warnings.push('ChatスペースURL未設定（Chatボタン無効）');
      }

      // Meet設定チェック
      if (!dept.meet_url && dept.meet_mode !== 'API生成') {
        warnings.push('Meet URLが未設定');
      }

      // 通知設定チェック
      if (!dept.notify_space_id) {
        warnings.push('通知先ChatスペースID未設定（自動通知なし）');
      }

      results.push({
        deptId: dept.dept_id,
        name: dept.name,
        site: dept.site || '',
        enabled: dept.enabled !== 'N',
        hasChat: !!(dept.chat_url || dept.chat_space_id),
        hasMeet: !!(dept.meet_url) || dept.meet_mode === 'API生成',
        hasNotify: !!dept.notify_space_id,
        issues: issues,
        warnings: warnings,
        status: issues.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'ok')
      });
    });

    return {
      success: true,
      data: results,
      summary: {
        total: results.length,
        ok: results.filter(function(r) { return r.status === 'ok'; }).length,
        warning: results.filter(function(r) { return r.status === 'warning'; }).length,
        error: results.filter(function(r) { return r.status === 'error'; }).length
      }
    };

  } catch (e) {
    console.error('validateDeptSettings エラー:', e);
    return {
      success: false,
      error: '診断に失敗しました: ' + e.message
    };
  }
}

/**
 * API接続テスト
 * @returns {Object} テスト結果
 */
function testApiConnectivity() {
  var results = {
    spreadsheet: { ok: false, message: '' },
    meet: { ok: false, message: '' },
    chat: { ok: false, message: '' }
  };

  // スプレッドシート接続テスト
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_DEPT);
    if (sheet) {
      results.spreadsheet = { ok: true, message: 'シートにアクセス可能' };
    } else {
      results.spreadsheet = { ok: false, message: 'Dept_Masterシートが見つかりません' };
    }
  } catch (e) {
    results.spreadsheet = { ok: false, message: 'スプレッドシートエラー: ' + e.message };
  }

  // Meet API テスト（最低限のトークン確認）
  try {
    var token = ScriptApp.getOAuthToken();
    if (token) {
      results.meet = { ok: true, message: 'OAuthトークン取得可能' };
    } else {
      results.meet = { ok: false, message: 'OAuthトークンが取得できません' };
    }
  } catch (e) {
    results.meet = { ok: false, message: 'OAuth エラー: ' + e.message };
  }

  // Chat API テスト（トークン確認のみ）
  try {
    var token = ScriptApp.getOAuthToken();
    if (token) {
      results.chat = { ok: true, message: 'OAuthトークン取得可能' };
    } else {
      results.chat = { ok: false, message: 'OAuthトークンが取得できません' };
    }
  } catch (e) {
    results.chat = { ok: false, message: 'OAuth エラー: ' + e.message };
  }

  return {
    success: true,
    data: results
  };
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

// ============================================
// Sprint 3: お気に入り・最近・推奨
// ============================================

/**
 * お気に入り一覧を取得
 * @returns {Object} { success, data }
 */
function getFavorites() {
  try {
    var favorites = FavoritesService.getFavorites();
    return { success: true, data: favorites };
  } catch (e) {
    console.error('getFavorites エラー:', e);
    return { success: false, error: 'お気に入りの取得に失敗しました。' };
  }
}

/**
 * お気に入りを設定/解除
 * @param {string} deptId - 部署ID
 * @param {boolean} enabled - true: 追加, false: 削除
 * @returns {Object} { success, favorites }
 */
function setFavorite(deptId, enabled) {
  try {
    var result = FavoritesService.setFavorite(deptId, enabled);
    if (result.ok) {
      return { success: true, favorites: result.favorites };
    } else {
      return { success: false, error: result.error || '設定に失敗しました。' };
    }
  } catch (e) {
    console.error('setFavorite エラー:', e);
    return { success: false, error: 'お気に入りの設定に失敗しました。' };
  }
}

/**
 * 最近使った部署一覧を取得
 * @returns {Object} { success, data }
 */
function listRecents() {
  try {
    var recents = FavoritesService.listRecents();
    return { success: true, data: recents };
  } catch (e) {
    console.error('listRecents エラー:', e);
    return { success: false, error: '最近の取得に失敗しました。' };
  }
}

/**
 * 推奨部署一覧を取得
 * @param {string} fromDeptId - 発信部署ID（任意）
 * @returns {Object} { success, data }
 */
function getRecommended(fromDeptId) {
  try {
    var recommended = FavoritesService.getRecommended(fromDeptId || '');
    return { success: true, data: recommended };
  } catch (e) {
    console.error('getRecommended エラー:', e);
    return { success: false, error: '推奨の取得に失敗しました。' };
  }
}

/**
 * Home用の統合データを取得
 * @returns {Object} { success, data: { favorites, recents, recommended } }
 */
function getHomeData() {
  try {
    var favorites = FavoritesService.getFavorites();
    var recents = FavoritesService.listRecents();
    var recommended = FavoritesService.getRecommended('');

    return {
      success: true,
      data: {
        favorites: favorites,
        recents: recents,
        recommended: recommended
      }
    };
  } catch (e) {
    console.error('getHomeData エラー:', e);
    return { success: false, error: 'データの取得に失敗しました。' };
  }
}

// ============================================
// Sprint 3: 回覧表生成
// ============================================

/**
 * 回覧表を生成
 * @param {Object} params - { dateFrom, dateTo, includeStatus, outputMode }
 * @returns {Object} { success, rows, sheetUrl }
 */
function generateCirculation(params) {
  try {
    params = params || {};

    // 日付パース
    var dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
    var dateTo = params.dateTo ? new Date(params.dateTo) : null;

    // デフォルト: 今週
    if (!dateFrom) {
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var dayOfWeek = today.getDay();
      dateFrom = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
    }
    if (!dateTo) {
      dateTo = new Date();
    }

    // メモを取得
    var filters = {
      dateFrom: Utilities.formatDate(dateFrom, Config.TIMEZONE, 'yyyy-MM-dd'),
      dateTo: Utilities.formatDate(dateTo, Config.TIMEZONE, 'yyyy-MM-dd'),
      limit: 500
    };

    // ステータスフィルタ
    if (params.includeStatus === 'incomplete') {
      filters.incomplete = true;
    }

    var memos = SheetService.listMemos(filters);

    // 並び替え: 未完→完了、期限切れ→通常、日時降順
    memos.sort(function(a, b) {
      var scoreA = scoreMemo(a);
      var scoreB = scoreMemo(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Circulation_Viewシートに出力
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var viewSheet = ss.getSheetByName('Circulation_View');

    if (!viewSheet) {
      viewSheet = ss.insertSheet('Circulation_View');
    }

    // ヘッダー
    var header = ['日時', '部署', '種別', '要点', '決定事項/対応', '担当', '期限', '結果', 'ステータス', '添付'];

    // データ行を準備
    var rows = memos.map(function(m) {
      return [
        m.created_at || '',
        (m.from_dept_name || '?') + ' → ' + (m.to_dept_name || '?'),
        m.issue_type || '',
        m.summary || '',
        '', // 決定事項は詳細取得が必要（簡易版では空）
        '', // 担当
        '', // 期限
        m.outcome || '',
        m.status || '',
        '' // 添付
      ];
    });

    // 詳細データを取得して埋める
    rows = memos.map(function(m) {
      var detail = SheetService.getMemoDetail(m.memo_id);
      if (!detail) detail = m;

      return [
        m.created_at || '',
        (m.from_dept_name || '?') + ' → ' + (m.to_dept_name || '?'),
        m.issue_type || '',
        m.summary || '',
        detail.decisions || '',
        detail.owner || '',
        detail.due_date || '',
        m.outcome || '',
        m.status || '',
        detail.attachments || ''
      ];
    });

    // シートをクリアして書き込み
    viewSheet.clear();
    viewSheet.getRange(1, 1, 1, header.length).setValues([header]);
    viewSheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
    viewSheet.getRange(1, 1, 1, header.length).setBackground('#D9F0FF');

    if (rows.length > 0) {
      viewSheet.getRange(2, 1, rows.length, header.length).setValues(rows);
    }

    // 列幅調整
    viewSheet.setColumnWidth(1, 140); // 日時
    viewSheet.setColumnWidth(2, 180); // 部署
    viewSheet.setColumnWidth(3, 100); // 種別
    viewSheet.setColumnWidth(4, 250); // 要点
    viewSheet.setColumnWidth(5, 300); // 決定事項
    viewSheet.setColumnWidth(6, 100); // 担当
    viewSheet.setColumnWidth(7, 100); // 期限
    viewSheet.setColumnWidth(8, 80);  // 結果
    viewSheet.setColumnWidth(9, 100); // ステータス
    viewSheet.setColumnWidth(10, 200); // 添付

    // ログ記録
    LogService.logEvent({
      type: 'GenerateCirculation',
      channel: 'System',
      status: 'Done',
      note: Utilities.formatDate(dateFrom, Config.TIMEZONE, 'yyyy-MM-dd') + '..' +
            Utilities.formatDate(dateTo, Config.TIMEZONE, 'yyyy-MM-dd') +
            ' (' + rows.length + '件)'
    });

    return {
      success: true,
      rows: rows.length,
      sheetUrl: ss.getUrl() + '#gid=' + viewSheet.getSheetId(),
      period: {
        from: Utilities.formatDate(dateFrom, Config.TIMEZONE, 'yyyy-MM-dd'),
        to: Utilities.formatDate(dateTo, Config.TIMEZONE, 'yyyy-MM-dd')
      }
    };

  } catch (e) {
    console.error('generateCirculation エラー:', e);
    return { success: false, error: '回覧表の生成に失敗しました: ' + e.message };
  }
}

/**
 * メモのスコア計算（並び替え用）
 * 未完を上、期限切れをさらに上
 */
function scoreMemo(m) {
  var isDone = (m.status === 'Done' || m.status === 'Canceled');
  var overdue = false;

  if (m.due_date) {
    var dueDate = new Date(m.due_date);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    overdue = dueDate < today && !isDone;
  }

  return (isDone ? 2 : 0) + (overdue ? -1 : 0);
}

// ============================================
// Sprint 4: 管理者設定機能
// ============================================

/**
 * 部署設定を更新（管理者のみ）
 * @param {string} deptId - 部署ID
 * @param {Object} patch - 更新データ
 * @returns {Object} { success, error }
 */
function updateDeptSettings(deptId, patch) {
  try {
    // 管理者権限チェック
    AuthService.assertAdmin();

    // バリデーション
    var allowedKeys = ['name', 'site', 'order', 'enabled', 'chat_url', 'notify_space_id', 'meet_mode', 'meet_url'];
    for (var key in patch) {
      if (allowedKeys.indexOf(key) < 0) {
        return { success: false, error: '不正なフィールド: ' + key };
      }
    }

    // chat_url のバリデーション
    if (patch.chat_url && patch.chat_url.trim() && !patch.chat_url.startsWith('https://')) {
      return { success: false, error: 'Chat URLはhttps://で始めてください。' };
    }

    // meet_url のバリデーション
    if (patch.meet_mode === '常設URL' && patch.meet_url && !patch.meet_url.includes('meet.google.com')) {
      return { success: false, error: 'Meet URLにmeet.google.comを含めてください。' };
    }

    // シート更新
    SheetService.updateDeptRow(deptId, patch);

    // キャッシュクリア
    SheetService.clearDeptCache();

    // ログ記録
    LogService.logEvent({
      type: 'AdminUpdateDept',
      action: 'updateDeptSettings',
      toDeptId: deptId,
      status: 'Done',
      note: JSON.stringify(patch)
    });

    return { success: true };

  } catch (e) {
    console.error('updateDeptSettings エラー:', e);
    return {
      success: false,
      error: e.message || '部署設定の更新に失敗しました。'
    };
  }
}

/**
 * 部署を新規追加（管理者用）
 * @param {Object} deptData - 部署データ
 * @returns {Object} { success, deptId?, error? }
 */
function addDept(deptData) {
  try {
    // 管理者権限チェック
    AuthService.assertAdmin();

    // バリデーション
    if (!deptData.name || !deptData.name.trim()) {
      return { success: false, error: '部署表示名を入力してください。' };
    }

    // chat_url のバリデーション
    if (deptData.chat_url && deptData.chat_url.trim() && !deptData.chat_url.startsWith('https://')) {
      return { success: false, error: 'Chat URLはhttps://で始めてください。' };
    }

    // meet_url のバリデーション
    if (deptData.meet_mode === '常設URL' && deptData.meet_url && !deptData.meet_url.includes('meet.google.com')) {
      return { success: false, error: 'Meet URLにmeet.google.comを含めてください。' };
    }

    // シートに追加
    var deptId = SheetService.addDeptRow(deptData);

    // ログ記録
    LogService.logEvent({
      type: 'AdminAddDept',
      action: 'addDept',
      toDeptId: deptId,
      status: 'Done',
      note: JSON.stringify(deptData)
    });

    return { success: true, deptId: deptId };

  } catch (e) {
    console.error('addDept エラー:', e);
    return {
      success: false,
      error: e.message || '部署の追加に失敗しました。'
    };
  }
}

/**
 * 部署を削除（管理者用）
 * @param {string} deptId - 部署ID
 * @returns {Object} { success, error? }
 */
function deleteDept(deptId) {
  try {
    // 管理者権限チェック
    AuthService.assertAdmin();

    if (!deptId) {
      return { success: false, error: '部署IDが指定されていません。' };
    }

    // シートから削除
    SheetService.deleteDeptRow(deptId);

    // ログ記録
    LogService.logEvent({
      type: 'AdminDeleteDept',
      action: 'deleteDept',
      toDeptId: deptId,
      status: 'Done',
      note: ''
    });

    return { success: true };

  } catch (e) {
    console.error('deleteDept エラー:', e);
    return {
      success: false,
      error: e.message || '部署の削除に失敗しました。'
    };
  }
}

// ============================================
// 拠点（Site）管理 API
// ============================================

/**
 * Lookupデータを再取得（キャッシュクリア後に最新を返す）
 * @returns {Object} { success, data: lookup }
 */
function reloadLookup() {
  try {
    LookupService.clearCache();
    var lookup = LookupService.getLookup();
    return { success: true, data: lookup };
  } catch (e) {
    console.error('reloadLookup エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 拠点一覧を取得（管理者用）
 * @returns {Object} { success, data: [{value, order}, ...] }
 */
function listSites() {
  try {
    AuthService.assertAdmin();
    var sites = LookupService.listSites();
    return { success: true, data: sites };
  } catch (e) {
    console.error('listSites エラー:', e);
    return { success: false, error: e.message || '拠点一覧の取得に失敗しました。' };
  }
}

/**
 * 拠点を追加（管理者用）
 * @param {Object} params - { name, order }
 * @returns {Object} { success, error? }
 */
function addSite(params) {
  try {
    AuthService.assertAdmin();

    if (!params.name || !params.name.trim()) {
      return { success: false, error: '拠点名を入力してください。' };
    }

    LookupService.addSiteRow(params.name.trim(), params.order || 999);

    LogService.logEvent({
      type: 'AdminAddSite',
      action: 'addSite',
      status: 'Done',
      note: params.name
    });

    return { success: true };
  } catch (e) {
    console.error('addSite エラー:', e);
    return { success: false, error: e.message || '拠点の追加に失敗しました。' };
  }
}

/**
 * 拠点を更新（管理者用）
 * @param {Object} params - { oldName, newName, order }
 * @returns {Object} { success, error? }
 */
function updateSite(params) {
  try {
    AuthService.assertAdmin();

    if (!params.newName || !params.newName.trim()) {
      return { success: false, error: '拠点名を入力してください。' };
    }

    LookupService.updateSiteRow(params.oldName, params.newName.trim(), params.order || 999);

    LogService.logEvent({
      type: 'AdminUpdateSite',
      action: 'updateSite',
      status: 'Done',
      note: params.oldName + ' → ' + params.newName
    });

    return { success: true };
  } catch (e) {
    console.error('updateSite エラー:', e);
    return { success: false, error: e.message || '拠点の更新に失敗しました。' };
  }
}

/**
 * 拠点を削除（管理者用）
 * @param {string} name - 拠点名
 * @returns {Object} { success, error? }
 */
function deleteSite(name) {
  try {
    AuthService.assertAdmin();

    if (!name) {
      return { success: false, error: '拠点名が指定されていません。' };
    }

    LookupService.deleteSiteRow(name);

    LogService.logEvent({
      type: 'AdminDeleteSite',
      action: 'deleteSite',
      status: 'Done',
      note: name
    });

    return { success: true };
  } catch (e) {
    console.error('deleteSite エラー:', e);
    return { success: false, error: e.message || '拠点の削除に失敗しました。' };
  }
}

// ============================================
// Sprint 4: 自動化トリガー関数
// ============================================

/**
 * 週次/月次回覧の自動生成（トリガー用）
 */
function runScheduledCirculation() {
  try {
    var cfg = getCirculationConfig();
    if (!cfg || cfg.enabled !== 'Y') {
      console.log('回覧自動生成: 無効化されています');
      return;
    }

    // 日付範囲を計算
    var range = DateRangeService.getRange(cfg.freq || 'WEEKLY');

    // 回覧表を生成
    var result = generateCirculation({
      dateFrom: range.from,
      dateTo: range.to,
      includeStatus: cfg.includeStatus || 'all',
      outputMode: 'Sheet'
    });

    if (!result.success) {
      console.error('回覧生成失敗:', result.error);
      return;
    }

    // Chat通知（設定されている場合）
    if (cfg.notify_space_id) {
      var card = GoogleChatService.buildCirculationCard({
        title: '📎 問い合わせ回覧表を更新しました',
        dateFrom: range.fromLabel,
        dateTo: range.toLabel,
        total: result.rows,
        sheetUrl: result.sheetUrl
      });

      GoogleChatService.postToSpace(cfg.notify_space_id, card);
    }

    // ログ記録
    LogService.logEvent({
      type: 'ScheduledCirculation',
      action: 'runScheduledCirculation',
      status: 'Done',
      note: range.fromLabel + '〜' + range.toLabel + ' (' + result.rows + '件)'
    });

  } catch (e) {
    console.error('runScheduledCirculation エラー:', e);
    LogService.logEvent({
      type: 'Error',
      action: 'runScheduledCirculation',
      status: 'Canceled',
      note: e.message
    });
  }
}

/**
 * 未完リマインド（トリガー用）
 */
function runReminder() {
  try {
    var cfg = getReminderConfig();
    if (!cfg || cfg.enabled !== 'Y') {
      console.log('未完リマインド: 無効化されています');
      return;
    }

    // 期限切れメモを取得
    var overdue = SheetService.listMemos({ overdue: true, limit: 100 });

    if (!overdue || overdue.length === 0) {
      console.log('未完リマインド: 期限切れなし');
      return;
    }

    // Chat通知（設定されている場合）
    if (cfg.notify_space_id) {
      var card = GoogleChatService.buildOverdueCard({
        count: overdue.length,
        items: overdue.slice(0, 10)
      });

      GoogleChatService.postToSpace(cfg.notify_space_id, card);
    }

    // ログ記録
    LogService.logEvent({
      type: 'Reminder',
      action: 'runReminder',
      status: 'Done',
      note: '期限切れ=' + overdue.length + '件'
    });

  } catch (e) {
    console.error('runReminder エラー:', e);
    LogService.logEvent({
      type: 'Error',
      action: 'runReminder',
      status: 'Canceled',
      note: e.message
    });
  }
}

/**
 * 回覧設定を取得
 */
function getCirculationConfig() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(Config.SHEET_CIRCULATION_CONFIG);
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return null;

    var headers = data[0];
    var row = data[1];
    var cfg = {};

    for (var i = 0; i < headers.length; i++) {
      cfg[headers[i]] = row[i];
    }

    return cfg;
  } catch (e) {
    console.error('getCirculationConfig エラー:', e);
    return null;
  }
}

/**
 * リマインド設定を取得
 */
function getReminderConfig() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Reminder_Config');
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return null;

    var headers = data[0];
    var row = data[1];
    var cfg = {};

    for (var i = 0; i < headers.length; i++) {
      cfg[headers[i]] = row[i];
    }

    return cfg;
  } catch (e) {
    console.error('getReminderConfig エラー:', e);
    return null;
  }
}

/**
 * 日付範囲計算ヘルパー
 */
var DateRangeService = {
  getRange: function(freq) {
    var now = new Date();
    var from, to, fromLabel, toLabel;

    if (freq === 'WEEKLY') {
      var dayOfWeek = now.getDay();
      from = new Date(now.getTime() - (dayOfWeek + 7) * 86400000);
      to = new Date(now.getTime() - (dayOfWeek + 1) * 86400000);
    } else if (freq === 'MONTHLY') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      to = now;
    }

    fromLabel = Utilities.formatDate(from, Config.TIMEZONE, 'yyyy/MM/dd');
    toLabel = Utilities.formatDate(to, Config.TIMEZONE, 'yyyy/MM/dd');

    return {
      from: Utilities.formatDate(from, Config.TIMEZONE, 'yyyy-MM-dd'),
      to: Utilities.formatDate(to, Config.TIMEZONE, 'yyyy-MM-dd'),
      fromLabel: fromLabel,
      toLabel: toLabel
    };
  }
};

// ============================================
// Sprint 4: Settings API
// ============================================

/**
 * 設定ページ用のブートストラップデータを取得
 * @returns {Object} { success, data }
 */
function getSettingsBootstrap() {
  console.log('[getSettingsBootstrap] 開始');
  try {
    // Step 1: ユーザー情報取得
    console.log('[getSettingsBootstrap] Step 1: getCurrentUserInfo');
    var user = LogService.getCurrentUserInfo();
    console.log('[getSettingsBootstrap] user:', JSON.stringify(user));

    // Step 2: 管理者チェック
    console.log('[getSettingsBootstrap] Step 2: isAdmin');
    user.isAdmin = AuthService.isAdmin();
    console.log('[getSettingsBootstrap] isAdmin:', user.isAdmin);

    // Step 3: ユーザー設定取得
    console.log('[getSettingsBootstrap] Step 3: getPreferences');
    var userPrefs = {};
    try {
      userPrefs = UserPreferencesService.getPreferences();
    } catch (prefErr) {
      console.warn('[getSettingsBootstrap] userPrefs取得エラー:', prefErr);
    }
    console.log('[getSettingsBootstrap] userPrefs:', JSON.stringify(userPrefs));

    // Step 4: 自動化設定取得
    console.log('[getSettingsBootstrap] Step 4: getConfig');
    var automationConfig = {};
    try {
      automationConfig = AutomationConfigService.getConfig();
    } catch (autoErr) {
      console.warn('[getSettingsBootstrap] automationConfig取得エラー:', autoErr);
    }
    console.log('[getSettingsBootstrap] automationConfig: OK');

    // Step 5: Lookup取得
    console.log('[getSettingsBootstrap] Step 5: getLookup');
    var lookup = {};
    try {
      lookup = LookupService.getLookup();
    } catch (lookupErr) {
      console.warn('[getSettingsBootstrap] lookup取得エラー:', lookupErr);
    }
    console.log('[getSettingsBootstrap] lookup: OK');

    // Step 6: トリガー一覧取得（管理者のみ）
    console.log('[getSettingsBootstrap] Step 6: listTriggers');
    var triggers = [];
    if (user.isAdmin) {
      try {
        triggers = AutomationConfigService.listTriggers();
      } catch (trigErr) {
        console.warn('[getSettingsBootstrap] triggers取得エラー:', trigErr);
      }
    }
    console.log('[getSettingsBootstrap] triggers count:', triggers.length);

    var result = {
      success: true,
      data: {
        user: user,
        userPrefs: userPrefs,
        automationConfig: automationConfig,
        lookup: lookup,
        triggers: triggers
      }
    };
    console.log('[getSettingsBootstrap] 完了 - success=true');
    return result;
  } catch (e) {
    console.error('[getSettingsBootstrap] エラー:', e.message, e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * ユーザー設定を保存
 * @param {Object} patch - { defaultTopTab?, defaultSite?, historyMode? }
 * @returns {Object} { success, prefs }
 */
function saveUserPrefs(patch) {
  try {
    var result = UserPreferencesService.savePreferences(patch);
    if (result.ok) {
      return { success: true, prefs: result.prefs };
    } else {
      return { success: false, error: result.error };
    }
  } catch (e) {
    console.error('saveUserPrefs エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * お気に入りをリセット
 * @returns {Object} { success }
 */
function resetUserFavorites() {
  try {
    var result = UserPreferencesService.resetFavorites();
    if (result.ok) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (e) {
    console.error('resetUserFavorites エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 自動化設定を更新（管理者のみ）
 * @param {Object} patch - 更新設定
 * @returns {Object} { success, config }
 */
function updateAutomationConfig(patch) {
  try {
    var result = AutomationConfigService.updateConfig(patch);
    if (result.ok) {
      return { success: true, config: result.config };
    } else {
      return { success: false, error: result.error };
    }
  } catch (e) {
    console.error('updateAutomationConfig エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * トリガーを同期（管理者のみ）
 * @returns {Object} { success, triggers }
 */
function syncAutomationTriggers() {
  try {
    var result = AutomationConfigService.syncTriggers();
    if (result.ok) {
      return { success: true, triggers: result.triggers };
    } else {
      return { success: false, error: result.error };
    }
  } catch (e) {
    console.error('syncAutomationTriggers エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 回覧テスト実行（管理者のみ）
 * @returns {Object} { success, rows, sheetUrl, postedOk }
 */
function runTestCirculation() {
  try {
    AuthService.assertAdmin();

    var cfg = AutomationConfigService.getConfig();

    // 今週の範囲で回覧を生成
    var range = DateRangeService.getRange('WEEKLY');
    var result = generateCirculation({
      dateFrom: range.from,
      dateTo: range.to,
      includeStatus: cfg.circulation_include_status === 'OPEN_ONLY' ? 'incomplete' : 'all',
      outputMode: 'Sheet'
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    var postedOk = false;

    // Chat投稿テスト
    if (cfg.circulation_notify_space_id) {
      var memos = SheetService.listMemos({
        dateFrom: range.from,
        dateTo: range.to,
        limit: 10
      });

      var card = GoogleChatService.buildCirculationCard({
        title: '📋 [テスト] 問い合わせ回覧表',
        period: range.fromLabel + '〜' + range.toLabel,
        memos: memos,
        portalUrl: result.sheetUrl
      });

      var chatResult = GoogleChatService.postToSpace(cfg.circulation_notify_space_id, card);
      postedOk = chatResult.ok;
    }

    LogService.logEvent({
      type: 'TestCirculation',
      action: 'runTestCirculation',
      status: 'Done',
      note: 'rows=' + result.rows + ', posted=' + postedOk
    });

    return {
      success: true,
      rows: result.rows,
      sheetUrl: result.sheetUrl,
      postedOk: postedOk
    };
  } catch (e) {
    console.error('runTestCirculation エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * リマインドテスト実行（管理者のみ）
 * @returns {Object} { success, count, postedOk }
 */
function runTestReminder() {
  try {
    AuthService.assertAdmin();

    var cfg = AutomationConfigService.getConfig();

    // 期限切れメモを取得
    var overdue = SheetService.listMemos({ overdue: true, limit: 100 });

    var postedOk = false;

    // Chat投稿テスト
    if (cfg.reminder_notify_space_id && overdue.length > 0) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var portalUrl = ss.getUrl();

      var card = GoogleChatService.buildOverdueCard({
        title: '⏰ [テスト] 未完了タスクリマインド',
        overdueCount: overdue.length,
        memos: overdue.slice(0, 5),
        portalUrl: portalUrl
      });

      var chatResult = GoogleChatService.postToSpace(cfg.reminder_notify_space_id, card);
      postedOk = chatResult.ok;
    }

    LogService.logEvent({
      type: 'TestReminder',
      action: 'runTestReminder',
      status: 'Done',
      note: 'count=' + overdue.length + ', posted=' + postedOk
    });

    return {
      success: true,
      count: overdue.length,
      postedOk: postedOk
    };
  } catch (e) {
    console.error('runTestReminder エラー:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 簡易診断を実行（一般ユーザー向け）
 * @returns {Object} { success, data }
 */
function runSimpleDiagnostics() {
  try {
    var results = {
      bootstrap: { ok: false, message: '' },
      sheet: { ok: false, message: '' }
    };

    // Bootstrap取得テスト
    try {
      var bs = getBootstrapData();
      if (bs && bs.depts && bs.depts.length > 0) {
        results.bootstrap = { ok: true, message: 'データ取得成功（' + bs.depts.length + '部署）' };
      } else {
        results.bootstrap = { ok: false, message: 'データが空です' };
      }
    } catch (e) {
      results.bootstrap = { ok: false, message: 'エラー: ' + e.message };
    }

    // シート書込テスト（読み取りのみ）
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(Config.SHEET_DEPT);
      if (sheet) {
        results.sheet = { ok: true, message: 'シートアクセス成功' };
      } else {
        results.sheet = { ok: false, message: 'Dept_Masterシートが見つかりません' };
      }
    } catch (e) {
      results.sheet = { ok: false, message: 'エラー: ' + e.message };
    }

    return { success: true, data: results };
  } catch (e) {
    console.error('runSimpleDiagnostics エラー:', e);
    return { success: false, error: e.message };
  }
}

