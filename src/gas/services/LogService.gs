/**
 * LogService.gs - ログ記録サービス
 *
 * Interaction_Logシートへのイベント記録を提供
 * 「誰が、いつ、どこへ、何を」+ 関連IDが追えること
 */

var LogService = (function() {

  /**
   * イベントをログに記録
   * @param {Object} payload - ログデータ
   * @returns {Object} { eventId }
   */
  function logEvent(payload) {
    try {
      var sheet = SheetService.getSheet(Config.SHEET_LOG);
      var eventId = IdService.nextEventId();

      // 現在のユーザー情報を取得
      var user = getCurrentUserInfo();

      var row = [
        eventId,                                              // event_id
        SheetService.formatDate(new Date()),                  // 日時
        user.email,                                           // 発信者(Email)
        user.name,                                            // 発信者表示名
        payload.fromDeptId || '',                             // 発信部署
        payload.toDeptId || '',                               // 宛先部署
        payload.channel || '',                                // チャネル
        payload.type || payload.action || '',                 // アクション
        payload.chatSpaceId || '',                            // ChatスペースID
        payload.meetCode || '',                               // Meet会議ID/コード
        payload.meetUrl || '',                                // Meet参加URL
        payload.priority || Config.DEFAULT_PRIORITY,          // 優先度
        payload.status || Config.DEFAULT_STATUS,              // ステータス
        payload.memoId || '',                                 // 関連memo_id
        payload.note || ''                                    // 備考
      ];

      sheet.appendRow(row);

      return { eventId: eventId };

    } catch (e) {
      console.error('ログ記録エラー:', e);
      // ログ記録の失敗は例外を投げない（UIに影響させない）
      // ただしエラーログは残す試み
      try {
        logErrorInternal(e.message, payload);
      } catch (e2) {
        console.error('エラーログ記録にも失敗:', e2);
      }
      return { eventId: null, error: e.message };
    }
  }

  /**
   * エラーイベントを記録
   * @param {string} errorMessage - エラーメッセージ
   * @param {Object} context - コンテキスト情報
   * @returns {Object} { eventId }
   */
  function logError(errorMessage, context) {
    context = context || {};
    return logEvent({
      type: Config.EVENT_TYPES.ERROR,
      fromDeptId: context.fromDeptId || '',
      toDeptId: context.toDeptId || '',
      note: errorMessage + (context.detail ? ' | ' + context.detail : '')
    });
  }

  /**
   * 内部エラー記録（logEvent失敗時用）
   */
  function logErrorInternal(errorMessage, context) {
    var sheet = SheetService.getSheet(Config.SHEET_LOG);
    var row = [
      'ERR_' + Date.now(),                // event_id（仮）
      SheetService.formatDate(new Date()),// 日時
      '',                                  // 発信者(Email)
      '',                                  // 発信者表示名
      '',                                  // 発信部署
      '',                                  // 宛先部署
      '',                                  // チャネル
      Config.EVENT_TYPES.ERROR,           // アクション
      '',                                  // ChatスペースID
      '',                                  // Meet会議ID/コード
      '',                                  // Meet参加URL
      '',                                  // 優先度
      '',                                  // ステータス
      '',                                  // 関連memo_id
      'LOG_ERROR: ' + errorMessage + ' | context: ' + JSON.stringify(context || {})
    ];
    sheet.appendRow(row);
  }

  /**
   * 現在のユーザー情報を取得
   * @returns {Object} { email, name }
   */
  function getCurrentUserInfo() {
    try {
      var email = Session.getActiveUser().getEmail() || '';
      var name = email ? email.split('@')[0] : 'Unknown';

      // 名前を整形（tanaka.taro → Tanaka Taro）
      if (name && name.indexOf('.') > 0) {
        name = name.split('.').map(function(part) {
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join(' ');
      } else if (name) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }

      return { email: email, name: name };
    } catch (e) {
      return { email: '', name: 'Unknown' };
    }
  }

  /**
   * イベントにメモIDを紐付け
   * @param {string} eventId - イベントID
   * @param {string} memoId - メモID
   */
  function linkMemoToEvent(eventId, memoId) {
    try {
      var sheet = SheetService.getSheet(Config.SHEET_LOG);
      var sheetData = SheetService.getSheetDataWithMap(Config.SHEET_LOG);
      var colMap = sheetData.colMap;
      var data = sheet.getDataRange().getValues();

      var eventIdCol = colMap['event_id'];
      var memoIdCol = colMap['関連memo_id'];

      if (eventIdCol === undefined || memoIdCol === undefined) {
        console.warn('列が見つかりません');
        return;
      }

      for (var i = 1; i < data.length; i++) {
        if (data[i][eventIdCol] === eventId) {
          sheet.getRange(i + 1, memoIdCol + 1).setValue(memoId);
          return;
        }
      }
    } catch (e) {
      console.error('メモリンク失敗:', e);
    }
  }

  /**
   * 便利メソッド: OpenHome ログ
   */
  function logOpenHome() {
    return logEvent({ type: Config.EVENT_TYPES.OPEN_HOME });
  }

  /**
   * 便利メソッド: OpenChat ログ
   */
  function logOpenChat(toDeptId, chatUrl) {
    return logEvent({
      type: Config.EVENT_TYPES.OPEN_CHAT,
      toDeptId: toDeptId,
      channel: 'Chat',
      note: chatUrl ? 'URL: ' + chatUrl : ''
    });
  }

  /**
   * 便利メソッド: CreateMeet ログ
   */
  function logCreateMeet(toDeptId, meetUrl, meetCode) {
    return logEvent({
      type: Config.EVENT_TYPES.CREATE_MEET,
      toDeptId: toDeptId,
      channel: 'Meet',
      meetUrl: meetUrl || '',
      meetCode: meetCode || ''
    });
  }

  /**
   * 便利メソッド: OpenMemo ログ
   */
  function logOpenMemo(eventId, fromDeptId, toDeptId) {
    return logEvent({
      type: Config.EVENT_TYPES.OPEN_MEMO,
      fromDeptId: fromDeptId || '',
      toDeptId: toDeptId || '',
      note: eventId ? 'related_event: ' + eventId : ''
    });
  }

  /**
   * 便利メソッド: SaveMemo ログ
   */
  function logSaveMemo(memoId, fromDeptId, toDeptId) {
    return logEvent({
      type: Config.EVENT_TYPES.SAVE_MEMO,
      fromDeptId: fromDeptId || '',
      toDeptId: toDeptId || '',
      memoId: memoId
    });
  }

  /**
   * 便利メソッド: OpenHistory ログ
   */
  function logOpenHistory() {
    return logEvent({ type: Config.EVENT_TYPES.OPEN_HISTORY });
  }

  /**
   * 便利メソッド: OpenDetail ログ
   */
  function logOpenDetail(memoId) {
    return logEvent({
      type: Config.EVENT_TYPES.OPEN_DETAIL,
      memoId: memoId
    });
  }

  return {
    logEvent: logEvent,
    logError: logError,
    linkMemoToEvent: linkMemoToEvent,
    getCurrentUserInfo: getCurrentUserInfo,
    logOpenHome: logOpenHome,
    logOpenChat: logOpenChat,
    logCreateMeet: logCreateMeet,
    logOpenMemo: logOpenMemo,
    logSaveMemo: logSaveMemo,
    logOpenHistory: logOpenHistory,
    logOpenDetail: logOpenDetail
  };
})();
