/**
 * UserPreferencesService - ユーザー個人設定サービス
 *
 * UserPropertiesを使用して個人設定を保存/取得
 * - デフォルト表示タブ
 * - デフォルト拠点フィルタ
 * - 履歴表示モード
 */
var UserPreferencesService = (function() {

  var KEYS = {
    DEFAULT_TAB: 'ui.defaultTopTab',
    DEFAULT_SITE: 'ui.defaultSite',
    HISTORY_MODE: 'ui.historyMode'
  };

  var DEFAULTS = {
    defaultTopTab: 'all',
    defaultSite: '',
    historyMode: 'simple'
  };

  /**
   * ユーザー設定を取得
   * @returns {Object} 設定オブジェクト
   */
  function getPreferences() {
    try {
      var props = PropertiesService.getUserProperties();
      return {
        defaultTopTab: props.getProperty(KEYS.DEFAULT_TAB) || DEFAULTS.defaultTopTab,
        defaultSite: props.getProperty(KEYS.DEFAULT_SITE) || DEFAULTS.defaultSite,
        historyMode: props.getProperty(KEYS.HISTORY_MODE) || DEFAULTS.historyMode
      };
    } catch (e) {
      console.error('getPreferences エラー:', e);
      return DEFAULTS;
    }
  }

  /**
   * ユーザー設定を保存
   * @param {Object} patch - 更新する設定
   * @returns {Object} { ok, prefs }
   */
  function savePreferences(patch) {
    try {
      var props = PropertiesService.getUserProperties();
      var allowedKeys = ['defaultTopTab', 'defaultSite', 'historyMode'];
      var keyMap = {
        'defaultTopTab': KEYS.DEFAULT_TAB,
        'defaultSite': KEYS.DEFAULT_SITE,
        'historyMode': KEYS.HISTORY_MODE
      };

      for (var key in patch) {
        if (allowedKeys.indexOf(key) >= 0) {
          props.setProperty(keyMap[key], String(patch[key] || ''));
        }
      }

      // ログ記録
      LogService.logEvent({
        type: 'UserPrefsUpdate',
        action: 'savePreferences',
        status: 'Done',
        note: JSON.stringify(patch)
      });

      return { ok: true, prefs: getPreferences() };
    } catch (e) {
      console.error('savePreferences エラー:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * お気に入りをリセット
   * @returns {Object} { ok }
   */
  function resetFavorites() {
    try {
      var props = PropertiesService.getUserProperties();
      props.deleteProperty('favorites');

      LogService.logEvent({
        type: 'FavoriteReset',
        action: 'resetFavorites',
        status: 'Done'
      });

      return { ok: true };
    } catch (e) {
      console.error('resetFavorites エラー:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 全設定をリセット（デフォルトに戻す）
   * @returns {Object} { ok }
   */
  function resetAllPreferences() {
    try {
      var props = PropertiesService.getUserProperties();
      props.deleteProperty(KEYS.DEFAULT_TAB);
      props.deleteProperty(KEYS.DEFAULT_SITE);
      props.deleteProperty(KEYS.HISTORY_MODE);

      return { ok: true, prefs: DEFAULTS };
    } catch (e) {
      console.error('resetAllPreferences エラー:', e);
      return { ok: false, error: e.message };
    }
  }

  return {
    getPreferences: getPreferences,
    savePreferences: savePreferences,
    resetFavorites: resetFavorites,
    resetAllPreferences: resetAllPreferences,
    DEFAULTS: DEFAULTS
  };
})();
