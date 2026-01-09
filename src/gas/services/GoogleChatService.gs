/**
 * GoogleChatService - Google Chat API連携サービス
 *
 * Google Chatスペースへのメッセージ送信機能を提供
 *
 * 必要なOAuthスコープ:
 * - https://www.googleapis.com/auth/chat.messages.create
 * - https://www.googleapis.com/auth/chat.messages
 */
var GoogleChatService = (function() {

  /**
   * Chatスペースにテキストメッセージを送信
   * @param {string} spaceId - スペースID（spaces/XXX形式）
   * @param {string} text - 送信するテキスト
   * @returns {Object} 結果
   */
  function postTextMessage(spaceId, text) {
    try {
      var formattedSpaceId = formatSpaceId(spaceId);
      var url = 'https://chat.googleapis.com/v1/' + formattedSpaceId + '/messages';

      var payload = {
        text: text
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();

      if (responseCode === 200) {
        return { success: true, data: JSON.parse(response.getContentText()) };
      } else {
        console.error('Chat API エラー:', response.getContentText());
        return { success: false, error: 'メッセージの送信に失敗しました。' };
      }
    } catch (err) {
      console.error('postTextMessage エラー:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Meet通知カードを送信
   * @param {string} spaceId - スペースID
   * @param {Object} data - 通知データ
   * @returns {Object} 結果
   */
  function postMeetNotification(spaceId, data) {
    try {
      var formattedSpaceId = formatSpaceId(spaceId);
      var url = 'https://chat.googleapis.com/v1/' + formattedSpaceId + '/messages';

      // カード形式のメッセージを作成
      var card = buildMeetNotificationCard(data);

      var payload = {
        cardsV2: [card]
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();

      if (responseCode === 200) {
        return { success: true, data: JSON.parse(response.getContentText()) };
      } else {
        console.error('Chat API エラー:', response.getContentText());
        // エラーでも処理を継続（通知失敗でもMeet自体は動作させる）
        return { success: false, error: 'Chat通知の送信に失敗しました。' };
      }
    } catch (err) {
      console.error('postMeetNotification エラー:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Meet通知カードを構築（Sprint 2: 電話っぽいデザイン）
   * @param {Object} data - 通知データ
   * @returns {Object} Card V2形式のカードオブジェクト
   */
  function buildMeetNotificationCard(data) {
    var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    var fromText = data.fromDeptName || '（未設定）';
    var toText = data.toDeptName || '（未設定）';

    return {
      cardId: 'incoming_call_' + Date.now(),
      card: {
        header: {
          title: data.title || '📣 連絡があります',
          subtitle: fromText + ' → ' + toText + ' / ' + now,
          imageUrl: 'https://fonts.gstatic.com/s/i/googlematerialicons/videocam/v6/24px.svg',
          imageType: 'CIRCLE'
        },
        sections: [
          {
            widgets: [
              {
                decoratedText: {
                  text: '発信者: <b>' + escapeHtml(data.callerName || data.senderName || '') + '</b>',
                  bottomLabel: escapeHtml(data.callerEmail || ''),
                  startIcon: {
                    knownIcon: 'PERSON'
                  }
                }
              },
              {
                decoratedText: {
                  text: '関連ID: <b>' + escapeHtml(data.eventId || '') + '</b>',
                  startIcon: {
                    knownIcon: 'BOOKMARK'
                  }
                }
              }
            ]
          },
          {
            widgets: [
              {
                buttonList: {
                  buttons: [
                    {
                      text: 'Meetに参加',
                      onClick: {
                        openLink: {
                          url: data.meetingUri
                        }
                      },
                      color: {
                        red: 0.686,
                        green: 0.914,
                        blue: 0.651,
                        alpha: 1
                      }
                    },
                    {
                      text: 'メモを見る/書く',
                      onClick: {
                        openLink: {
                          url: data.memoUrl
                        }
                      },
                      color: {
                        red: 0.851,
                        green: 0.941,
                        blue: 1,
                        alpha: 1
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    };
  }

  /**
   * HTMLエスケープ
   * @param {string} s - 文字列
   * @returns {string} エスケープ済み
   */
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * スペースにメッセージを投稿（cardsV2）
   * @param {string} spaceId - スペースID
   * @param {Object} messagePayload - メッセージペイロード
   * @returns {Object} { ok, messageId, error }
   */
  function postToSpace(spaceId, messagePayload) {
    try {
      var formattedSpaceId = formatSpaceId(spaceId);
      var url = 'https://chat.googleapis.com/v1/' + formattedSpaceId + '/messages';

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(messagePayload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();
      var body = response.getContentText();

      if (responseCode >= 200 && responseCode < 300) {
        var data = JSON.parse(body);
        return { ok: true, messageId: data.name || '' };
      } else {
        console.error('Chat API エラー:', responseCode, body);
        return { ok: false, error: 'Chat API error: ' + responseCode };
      }
    } catch (err) {
      console.error('postToSpace エラー:', err);
      return { ok: false, error: err.message };
    }
  }

  /**
   * 着信通知カードを構築（buildIncomingCallCard）
   * @param {Object} ctx - コンテキスト
   * @returns {Object} メッセージペイロード
   */
  function buildIncomingCallCard(ctx) {
    var card = buildMeetNotificationCard({
      title: ctx.title || '📣 連絡があります',
      fromDeptName: ctx.fromDeptName,
      toDeptName: ctx.toDeptName,
      callerName: ctx.callerName,
      callerEmail: ctx.callerEmail,
      senderName: ctx.callerName,
      meetingUri: ctx.meetingUri,
      memoUrl: ctx.memoUrl,
      eventId: ctx.eventId
    });

    return {
      text: '',
      cardsV2: [card]
    };
  }

  /**
   * スペースIDをAPI用形式に整形
   * @param {string} spaceId - スペースID
   * @returns {string} 整形されたスペースID
   */
  function formatSpaceId(spaceId) {
    if (!spaceId) {
      throw new Error('スペースIDが指定されていません。');
    }
    // 既にspaces/で始まっている場合はそのまま
    if (spaceId.startsWith('spaces/')) {
      return spaceId;
    }
    return 'spaces/' + spaceId;
  }

  /**
   * 連絡開始通知を送信（シンプルなテキスト）
   * @param {string} spaceId - スペースID
   * @param {Object} data - 通知データ
   * @returns {Object} 結果
   */
  function postContactStartNotification(spaceId, data) {
    var text = (data.fromDeptName ? data.fromDeptName + ' の ' : '') +
               data.senderName + ' さんが連絡を開始しました。';
    return postTextMessage(spaceId, text);
  }

  // 公開API
  return {
    postTextMessage: postTextMessage,
    postMeetNotification: postMeetNotification,
    postContactStartNotification: postContactStartNotification,
    postToSpace: postToSpace,
    buildIncomingCallCard: buildIncomingCallCard
  };
})();
