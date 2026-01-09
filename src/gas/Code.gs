/**
 * 部署クイック連絡ポータル - メインエントリポイント
 *
 * GAS Webアプリのエントリポイントとサーバー関数を定義
 */

/**
 * Webアプリのエントリポイント
 * @param {Object} e - イベントオブジェクト
 * @returns {HtmlOutput} HTMLページ
 */
function doGet(e) {
  const page = e.parameter.page || 'home';
  const params = e.parameter;

  // ページアクセスログを記録
  try {
    const user = AuthService.getCurrentUser();
    const actionMap = {
      'home': 'OpenHome',
      'memo': 'OpenMemo',
      'history': 'OpenHistory',
      'detail': 'OpenDetail'
    };
    if (actionMap[page]) {
      SheetService.appendEventLog({
        action: actionMap[page],
        userEmail: user.email,
        userName: user.name,
        memo: `page=${page}`
      });
    }
  } catch (err) {
    console.error('ログ記録エラー:', err);
  }

  // HTMLテンプレートを生成
  const template = HtmlService.createTemplateFromFile('ui/index');
  template.initialPage = page;
  template.initialParams = JSON.stringify(params);

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
// クライアントから呼ばれるサーバー関数
// ============================================

/**
 * 初期データを取得（部署一覧、Lookup、ユーザー情報）
 * @returns {Object} 初期データ
 */
function getBootstrap() {
  try {
    const user = AuthService.getCurrentUser();
    const deptList = SheetService.getDeptList();
    const lookup = SheetService.getLookup();

    return {
      success: true,
      data: {
        user: user,
        deptList: deptList,
        lookup: lookup
      }
    };
  } catch (err) {
    console.error('getBootstrap エラー:', err);
    return {
      success: false,
      error: 'データの取得に失敗しました。'
    };
  }
}

/**
 * Chatを開く（ログ記録 + URL返却）
 * @param {string} deptId - 宛先部署ID
 * @param {string} fromDeptId - 発信部署ID（任意）
 * @returns {Object} 結果
 */
function openChat(deptId, fromDeptId) {
  try {
    const user = AuthService.getCurrentUser();
    const dept = SheetService.getDeptById(deptId);

    if (!dept) {
      return { success: false, error: '部署が見つかりません。' };
    }

    if (!dept.chatUrl && !dept.chatSpaceId) {
      return { success: false, error: 'この部署のChatはまだ設定されていません。' };
    }

    // イベントログ記録
    const eventId = SheetService.appendEventLog({
      action: 'OpenChat',
      userEmail: user.email,
      userName: user.name,
      fromDeptId: fromDeptId || '',
      toDeptId: deptId,
      channel: 'Chat',
      chatSpaceId: dept.chatSpaceId || ''
    });

    // Chat URLを決定
    const chatUrl = dept.chatUrl ||
      (dept.chatSpaceId ? `https://chat.google.com/room/${dept.chatSpaceId.replace('spaces/', '')}` : '');

    return {
      success: true,
      data: {
        eventId: eventId,
        chatUrl: chatUrl,
        deptName: dept.name
      }
    };
  } catch (err) {
    console.error('openChat エラー:', err);
    SheetService.appendEventLog({
      action: 'Error',
      userEmail: Session.getActiveUser().getEmail(),
      memo: `openChat: ${err.message}`
    });
    return { success: false, error: 'Chatを開けませんでした。' };
  }
}

/**
 * Meet会議を作成し、Chatに通知を送る
 * @param {string} deptId - 宛先部署ID
 * @param {string} fromDeptId - 発信部署ID（任意）
 * @returns {Object} 結果
 */
function createMeet(deptId, fromDeptId) {
  try {
    const user = AuthService.getCurrentUser();
    const dept = SheetService.getDeptById(deptId);

    if (!dept) {
      return { success: false, error: '部署が見つかりません。' };
    }

    // 常設Meet URLがあればそれを使用
    let meetingUri = dept.permanentMeetUrl;
    let meetingCode = '';

    if (!meetingUri) {
      // Meet APIで新規作成
      const meetResult = GoogleMeetService.createMeetingSpace();
      if (!meetResult.success) {
        return { success: false, error: meetResult.error };
      }
      meetingUri = meetResult.meetingUri;
      meetingCode = meetResult.meetingCode;
    }

    // イベントログ記録（CreateMeet）
    const eventId = SheetService.appendEventLog({
      action: 'CreateMeet',
      userEmail: user.email,
      userName: user.name,
      fromDeptId: fromDeptId || '',
      toDeptId: deptId,
      channel: 'Meet',
      meetingCode: meetingCode,
      meetingUri: meetingUri
    });

    // Chat通知送信
    const notifySpaceId = dept.notifySpaceId || dept.chatSpaceId;
    if (notifySpaceId) {
      const fromDept = fromDeptId ? SheetService.getDeptById(fromDeptId) : null;
      const fromDeptName = fromDept ? fromDept.name : '';

      GoogleChatService.postMeetNotification(notifySpaceId, {
        senderName: user.name,
        senderEmail: user.email,
        fromDeptName: fromDeptName,
        toDeptName: dept.name,
        meetingUri: meetingUri,
        eventId: eventId
      });

      // NotifyChat ログ
      SheetService.appendEventLog({
        action: 'NotifyChat',
        userEmail: user.email,
        userName: user.name,
        fromDeptId: fromDeptId || '',
        toDeptId: deptId,
        channel: 'Chat',
        chatSpaceId: notifySpaceId,
        memo: `Meet通知送信: ${meetingUri}`
      });
    }

    // メモ画面URL生成
    const webAppUrl = ScriptApp.getService().getUrl();
    const memoUrl = `${webAppUrl}?page=memo&event_id=${eventId}&to_dept=${deptId}&from_dept=${fromDeptId || ''}`;

    return {
      success: true,
      data: {
        eventId: eventId,
        meetingUri: meetingUri,
        memoUrl: memoUrl,
        deptName: dept.name
      }
    };
  } catch (err) {
    console.error('createMeet エラー:', err);
    SheetService.appendEventLog({
      action: 'Error',
      userEmail: Session.getActiveUser().getEmail(),
      memo: `createMeet: ${err.message}`
    });
    return { success: false, error: 'Meetを作成できませんでした。' };
  }
}

/**
 * メモを保存
 * @param {Object} memoData - メモデータ
 * @returns {Object} 結果
 */
function saveMemo(memoData) {
  try {
    const user = AuthService.getCurrentUser();

    // メモデータにユーザー情報を追加
    memoData.creatorEmail = user.email;
    memoData.creatorName = user.name;
    memoData.createdAt = new Date();

    const memoId = SheetService.createMemo(memoData);

    // イベントログ記録
    SheetService.appendEventLog({
      action: 'SaveMemo',
      userEmail: user.email,
      userName: user.name,
      fromDeptId: memoData.fromDeptId || '',
      toDeptId: memoData.toDeptId || '',
      relatedMemoId: memoId,
      memo: `メモ保存: ${memoData.summary || ''}`
    });

    // 関連イベントのステータス更新（任意）
    if (memoData.relatedEventId) {
      SheetService.updateEventMemoLink(memoData.relatedEventId, memoId);
    }

    return {
      success: true,
      data: {
        memoId: memoId
      }
    };
  } catch (err) {
    console.error('saveMemo エラー:', err);
    return { success: false, error: 'メモの保存に失敗しました。' };
  }
}

/**
 * メモ一覧を取得
 * @param {Object} filters - フィルタ条件
 * @returns {Object} 結果
 */
function listMemos(filters) {
  try {
    const memos = SheetService.listMemos(filters || {});
    return {
      success: true,
      data: memos
    };
  } catch (err) {
    console.error('listMemos エラー:', err);
    return { success: false, error: '履歴の取得に失敗しました。' };
  }
}

/**
 * メモ詳細を取得
 * @param {string} memoId - メモID
 * @returns {Object} 結果
 */
function getMemoDetail(memoId) {
  try {
    const memo = SheetService.getMemoDetail(memoId);
    if (!memo) {
      return { success: false, error: 'メモが見つかりません。' };
    }
    return {
      success: true,
      data: memo
    };
  } catch (err) {
    console.error('getMemoDetail エラー:', err);
    return { success: false, error: 'メモの取得に失敗しました。' };
  }
}

/**
 * メモを更新
 * @param {string} memoId - メモID
 * @param {Object} updateData - 更新データ
 * @returns {Object} 結果
 */
function updateMemo(memoId, updateData) {
  try {
    SheetService.updateMemo(memoId, updateData);
    return { success: true };
  } catch (err) {
    console.error('updateMemo エラー:', err);
    return { success: false, error: 'メモの更新に失敗しました。' };
  }
}
