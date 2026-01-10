/**
 * AutomationConfigService - 自動化設定サービス
 *
 * Automation_Configシートを使用して自動化設定を管理
 * - 回覧（週次/月次）
 * - リマインダー
 */
var AutomationConfigService = (function() {

  var SHEET_NAME = 'Automation_Config';

  var DEFAULTS = {
    circulation_enabled: 'N',
    circulation_freq: 'WEEKLY',
    circulation_day: '1',
    circulation_hour: '9',
    circulation_include_status: 'ALL',
    circulation_notify_space_id: '',
    reminder_enabled: 'N',
    reminder_freq: 'DAILY',
    reminder_hour: '9',
    reminder_notify_space_id: ''
  };

  /**
   * 自動化設定を取得
   * @returns {Object} 設定オブジェクト
   */
  function getConfig() {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME);

      if (!sheet) {
        // シートがなければデフォルトを返す
        return DEFAULTS;
      }

      var data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        return DEFAULTS;
      }

      var headers = data[0];
      var row = data[1];
      var cfg = {};

      for (var i = 0; i < headers.length; i++) {
        var key = String(headers[i]).trim();
        if (key) {
          cfg[key] = row[i] !== undefined ? String(row[i]) : '';
        }
      }

      // デフォルト値をマージ
      for (var k in DEFAULTS) {
        if (cfg[k] === undefined || cfg[k] === '') {
          cfg[k] = DEFAULTS[k];
        }
      }

      return cfg;
    } catch (e) {
      console.error('AutomationConfigService.getConfig エラー:', e);
      return DEFAULTS;
    }
  }

  /**
   * 自動化設定を更新
   * @param {Object} patch - 更新する設定
   * @returns {Object} { ok, config }
   */
  function updateConfig(patch) {
    try {
      AuthService.assertAdmin();

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME);

      if (!sheet) {
        // シートを作成
        sheet = ss.insertSheet(SHEET_NAME);
        var headers = Object.keys(DEFAULTS);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.getRange(1, 1, 1, headers.length).setBackground('#D9F0FF');

        // デフォルト値を設定
        var defaultRow = headers.map(function(h) { return DEFAULTS[h]; });
        sheet.getRange(2, 1, 1, headers.length).setValues([defaultRow]);
      }

      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var colMap = {};
      for (var i = 0; i < headers.length; i++) {
        colMap[String(headers[i]).trim()] = i;
      }

      // 許可されたキーのみ更新
      var allowedKeys = Object.keys(DEFAULTS);
      for (var key in patch) {
        if (allowedKeys.indexOf(key) >= 0 && colMap[key] !== undefined) {
          sheet.getRange(2, colMap[key] + 1).setValue(patch[key]);
        }
      }

      // ログ記録
      LogService.logEvent({
        type: 'AdminUpdateAutomation',
        action: 'updateConfig',
        status: 'Done',
        note: JSON.stringify(patch)
      });

      return { ok: true, config: getConfig() };
    } catch (e) {
      console.error('AutomationConfigService.updateConfig エラー:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * トリガーを同期（設定に基づいてトリガーを作成/削除）
   * @returns {Object} { ok, triggers }
   */
  function syncTriggers() {
    try {
      AuthService.assertAdmin();
      var cfg = getConfig();

      // 既存のトリガーを削除（対象のハンドラーのみ）
      var triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(function(t) {
        var handler = t.getHandlerFunction();
        if (handler === 'runScheduledCirculation' || handler === 'runReminder') {
          ScriptApp.deleteTrigger(t);
        }
      });

      var createdTriggers = [];

      // 回覧トリガー
      if (cfg.circulation_enabled === 'Y') {
        var circHour = parseInt(cfg.circulation_hour, 10) || 9;

        if (cfg.circulation_freq === 'WEEKLY') {
          // 週次: 毎週指定曜日
          var dayOfWeek = parseInt(cfg.circulation_day, 10) || 1;
          var weekDay = getScriptAppWeekDay(dayOfWeek);

          ScriptApp.newTrigger('runScheduledCirculation')
            .timeBased()
            .onWeekDay(weekDay)
            .atHour(circHour)
            .create();

          createdTriggers.push({
            handler: 'runScheduledCirculation',
            freq: 'WEEKLY',
            day: dayOfWeek,
            hour: circHour
          });
        } else if (cfg.circulation_freq === 'MONTHLY') {
          // 月次: 毎日起動して日付判定する方式（GAS制約回避）
          ScriptApp.newTrigger('runScheduledCirculation')
            .timeBased()
            .atHour(circHour)
            .everyDays(1)
            .create();

          createdTriggers.push({
            handler: 'runScheduledCirculation',
            freq: 'MONTHLY',
            day: cfg.circulation_day,
            hour: circHour,
            note: '毎日起動→日付判定'
          });
        }
      }

      // リマインダートリガー
      if (cfg.reminder_enabled === 'Y') {
        var remHour = parseInt(cfg.reminder_hour, 10) || 9;

        if (cfg.reminder_freq === 'DAILY') {
          ScriptApp.newTrigger('runReminder')
            .timeBased()
            .atHour(remHour)
            .everyDays(1)
            .create();

          createdTriggers.push({
            handler: 'runReminder',
            freq: 'DAILY',
            hour: remHour
          });
        } else if (cfg.reminder_freq === 'WEEKLY') {
          // 週次
          ScriptApp.newTrigger('runReminder')
            .timeBased()
            .atHour(remHour)
            .everyWeeks(1)
            .create();

          createdTriggers.push({
            handler: 'runReminder',
            freq: 'WEEKLY',
            hour: remHour
          });
        }
      }

      LogService.logEvent({
        type: 'TriggerSync',
        action: 'syncTriggers',
        status: 'Done',
        note: JSON.stringify(createdTriggers)
      });

      return { ok: true, triggers: createdTriggers };
    } catch (e) {
      console.error('syncTriggers エラー:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 曜日番号をScriptApp.WeekDayに変換
   * @param {number} day - 1=月, 2=火, ... 7=日
   * @returns {ScriptApp.WeekDay}
   */
  function getScriptAppWeekDay(day) {
    var map = {
      1: ScriptApp.WeekDay.MONDAY,
      2: ScriptApp.WeekDay.TUESDAY,
      3: ScriptApp.WeekDay.WEDNESDAY,
      4: ScriptApp.WeekDay.THURSDAY,
      5: ScriptApp.WeekDay.FRIDAY,
      6: ScriptApp.WeekDay.SATURDAY,
      7: ScriptApp.WeekDay.SUNDAY
    };
    return map[day] || ScriptApp.WeekDay.MONDAY;
  }

  /**
   * 現在のトリガー一覧を取得
   * @returns {Array} トリガー情報
   */
  function listTriggers() {
    try {
      var triggers = ScriptApp.getProjectTriggers();
      return triggers.map(function(t) {
        return {
          id: t.getUniqueId(),
          handler: t.getHandlerFunction(),
          type: t.getEventType().toString()
        };
      });
    } catch (e) {
      console.error('listTriggers エラー:', e);
      return [];
    }
  }

  return {
    getConfig: getConfig,
    updateConfig: updateConfig,
    syncTriggers: syncTriggers,
    listTriggers: listTriggers,
    DEFAULTS: DEFAULTS
  };
})();
