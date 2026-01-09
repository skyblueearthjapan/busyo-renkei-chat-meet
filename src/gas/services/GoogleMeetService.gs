/**
 * GoogleMeetService - Google Meet API連携サービス
 *
 * Google Meet会議スペースの作成機能を提供
 *
 * 必要なOAuthスコープ:
 * - https://www.googleapis.com/auth/meetings.space.created
 *
 * 注意: Meet REST APIはWorkspaceアカウントで利用可能
 * 個人アカウントの場合はCalendar API経由で会議を作成する代替手段を使用
 */
var GoogleMeetService = (function() {

  /**
   * 会議スペースを作成（Meet REST API）
   * @returns {Object} 結果 {success, meetingUri, meetingCode, error}
   */
  function createMeetingSpace() {
    try {
      // Meet REST API v2を使用
      var url = 'https://meet.googleapis.com/v2/spaces';

      var payload = {
        // 会議設定（必要に応じてカスタマイズ）
        config: {
          accessType: 'OPEN',  // 組織内の誰でも参加可能
          entryPointAccess: 'ALL'  // すべてのエントリポイントを許可
        }
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
        var data = JSON.parse(response.getContentText());
        return {
          success: true,
          meetingUri: data.meetingUri,
          meetingCode: data.meetingCode || extractMeetingCode(data.meetingUri),
          spaceName: data.name
        };
      } else {
        console.error('Meet API エラー:', response.getContentText());

        // Meet APIが使えない場合はCalendar API経由で作成を試みる
        return createMeetingViaCalendar();
      }
    } catch (err) {
      console.error('createMeetingSpace エラー:', err);

      // フォールバック: Calendar API経由
      return createMeetingViaCalendar();
    }
  }

  /**
   * Calendar API経由で会議を作成（フォールバック）
   * @returns {Object} 結果
   */
  function createMeetingViaCalendar() {
    try {
      // 一時的なカレンダーイベントを作成してMeetリンクを取得
      var now = new Date();
      var end = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後

      var event = {
        summary: '部署クイック連絡',
        description: '部署クイック連絡ポータルから作成された会議',
        start: {
          dateTime: now.toISOString(),
          timeZone: Session.getScriptTimeZone()
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: Session.getScriptTimeZone()
        },
        conferenceData: {
          createRequest: {
            requestId: 'quick-contact-' + Date.now(),
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      };

      var calendarId = 'primary';
      var url = 'https://www.googleapis.com/calendar/v3/calendars/' +
                encodeURIComponent(calendarId) +
                '/events?conferenceDataVersion=1';

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(event),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();

      if (responseCode === 200) {
        var data = JSON.parse(response.getContentText());

        // 会議データを取得
        var conferenceData = data.conferenceData;
        if (conferenceData && conferenceData.entryPoints) {
          var videoEntry = conferenceData.entryPoints.find(function(ep) {
            return ep.entryPointType === 'video';
          });

          if (videoEntry) {
            // 作成したカレンダーイベントは即座に削除（会議リンクは残る）
            deleteCalendarEvent(data.id);

            return {
              success: true,
              meetingUri: videoEntry.uri,
              meetingCode: conferenceData.conferenceId || extractMeetingCode(videoEntry.uri),
              calendarEventId: data.id
            };
          }
        }

        return { success: false, error: '会議リンクの取得に失敗しました。' };
      } else {
        console.error('Calendar API エラー:', response.getContentText());
        return { success: false, error: 'カレンダー経由での会議作成に失敗しました。' };
      }
    } catch (err) {
      console.error('createMeetingViaCalendar エラー:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * カレンダーイベントを削除（クリーンアップ用）
   * @param {string} eventId - イベントID
   */
  function deleteCalendarEvent(eventId) {
    try {
      var calendarId = 'primary';
      var url = 'https://www.googleapis.com/calendar/v3/calendars/' +
                encodeURIComponent(calendarId) +
                '/events/' + encodeURIComponent(eventId);

      var options = {
        method: 'delete',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      };

      UrlFetchApp.fetch(url, options);
    } catch (err) {
      // 削除失敗は無視（会議自体は動作する）
      console.warn('カレンダーイベント削除エラー:', err);
    }
  }

  /**
   * Meet URLから会議コードを抽出
   * @param {string} meetingUri - Meet URL
   * @returns {string} 会議コード
   */
  function extractMeetingCode(meetingUri) {
    if (!meetingUri) return '';

    // https://meet.google.com/xxx-yyyy-zzz 形式から抽出
    var match = meetingUri.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    return match ? match[1] : '';
  }

  /**
   * 会議情報を取得（Meet REST API）
   * @param {string} spaceName - スペース名（spaces/XXX形式）
   * @returns {Object} 会議情報
   */
  function getMeetingSpace(spaceName) {
    try {
      var url = 'https://meet.googleapis.com/v2/' + spaceName;

      var options = {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();

      if (responseCode === 200) {
        return {
          success: true,
          data: JSON.parse(response.getContentText())
        };
      } else {
        return { success: false, error: '会議情報の取得に失敗しました。' };
      }
    } catch (err) {
      console.error('getMeetingSpace エラー:', err);
      return { success: false, error: err.message };
    }
  }

  // 公開API
  return {
    createMeetingSpace: createMeetingSpace,
    createMeetingViaCalendar: createMeetingViaCalendar,
    getMeetingSpace: getMeetingSpace
  };
})();
