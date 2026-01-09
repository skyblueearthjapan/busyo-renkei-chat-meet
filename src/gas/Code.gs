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
