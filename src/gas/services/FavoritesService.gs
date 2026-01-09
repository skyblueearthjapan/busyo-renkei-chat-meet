/**
 * FavoritesService.gs - お気に入り・最近使った管理
 *
 * UserPropertiesでお気に入りを保存
 * Interaction_Logから最近使った部署を抽出
 */

var FavoritesService = (function() {
  var FAVORITES_KEY = 'favorites';
  var MAX_FAVORITES = 8;
  var MAX_RECENTS = 10;

  // ============================================
  // お気に入り機能
  // ============================================

  /**
   * お気に入り一覧を取得
   * @returns {string[]} 部署IDの配列
   */
  function getFavorites() {
    try {
      var props = PropertiesService.getUserProperties();
      var raw = props.getProperty(FAVORITES_KEY) || '[]';
      return JSON.parse(raw);
    } catch (e) {
      console.error('getFavorites エラー:', e);
      return [];
    }
  }

  /**
   * お気に入りを設定/解除
   * @param {string} deptId - 部署ID
   * @param {boolean} enabled - true: 追加, false: 削除
   * @returns {Object} { ok, favorites }
   */
  function setFavorite(deptId, enabled) {
    try {
      var favList = getFavorites();
      var favSet = {};
      favList.forEach(function(id) { favSet[id] = true; });

      if (enabled) {
        if (!favSet[deptId]) {
          favList.push(deptId);
          // 上限チェック
          if (favList.length > MAX_FAVORITES) {
            favList = favList.slice(-MAX_FAVORITES);
          }
        }
      } else {
        favList = favList.filter(function(id) { return id !== deptId; });
      }

      var props = PropertiesService.getUserProperties();
      props.setProperty(FAVORITES_KEY, JSON.stringify(favList));

      // ログ記録
      try {
        LogService.logEvent({
          type: enabled ? 'FavoriteAdd' : 'FavoriteRemove',
          channel: 'System',
          toDeptId: deptId,
          status: 'Done',
          note: ''
        });
      } catch (logErr) {
        console.warn('お気に入りログ記録失敗:', logErr);
      }

      return { ok: true, favorites: favList };
    } catch (e) {
      console.error('setFavorite エラー:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * お気に入りかどうかを判定
   * @param {string} deptId - 部署ID
   * @returns {boolean}
   */
  function isFavorite(deptId) {
    var favList = getFavorites();
    return favList.indexOf(deptId) >= 0;
  }

  // ============================================
  // 最近使った機能
  // ============================================

  /**
   * 最近使った部署一覧を取得
   * @returns {string[]} 部署IDの配列（最新順）
   */
  function listRecents() {
    try {
      var email = '';
      try {
        email = Session.getActiveUser().getEmail() || '';
      } catch (e) {
        // 取得できない場合
      }

      if (!email) {
        return [];
      }

      // Interaction_LogからOpenChat/CreateMeetを抽出
      var logSheet = SheetService.getSheet(Config.SHEET_LOG);
      var data = logSheet.getDataRange().getValues();
      var headers = data[0];

      // ヘッダーからカラムインデックスを取得
      var colMap = {};
      for (var i = 0; i < headers.length; i++) {
        var name = String(headers[i]).trim();
        if (name) colMap[name] = i;
      }

      // 関連するアクション
      var targetTypes = ['OpenChat', 'CreateMeet', 'MeetReady'];

      var seen = {};
      var recents = [];

      // 新しい順に処理（最後の行から）
      for (var r = data.length - 1; r >= 1; r--) {
        var row = data[r];
        var actorEmail = row[colMap['アクター']] || '';
        var actionType = row[colMap['アクション']] || '';
        var toDeptId = row[colMap['宛先部署']] || '';

        // ユーザーが一致し、対象アクションで、宛先部署がある場合
        if (actorEmail === email && targetTypes.indexOf(actionType) >= 0 && toDeptId) {
          if (!seen[toDeptId]) {
            seen[toDeptId] = true;
            recents.push(toDeptId);
            if (recents.length >= MAX_RECENTS) break;
          }
        }
      }

      return recents;
    } catch (e) {
      console.error('listRecents エラー:', e);
      return [];
    }
  }

  // ============================================
  // 推奨（Connection_Rules）
  // ============================================

  /**
   * 推奨部署一覧を取得
   * @param {string} fromDeptId - 発信部署ID（空の場合は全社共通推奨）
   * @returns {string[]} 部署IDの配列
   */
  function getRecommended(fromDeptId) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Connection_Rules');
      if (!sheet) {
        return [];
      }

      var data = sheet.getDataRange().getValues();
      if (data.length < 2) return [];

      var headers = data[0];
      var colMap = {};
      for (var i = 0; i < headers.length; i++) {
        var name = String(headers[i]).trim();
        if (name) colMap[name] = i;
      }

      var recommended = [];

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        var ruleFromDeptId = row[colMap['from_dept_id']] || '';
        var ruleToDeptId = row[colMap['to_dept_id']] || '';
        var isRecommended = row[colMap['推奨']] || row[colMap['recommended']] || '';

        // 推奨=Y で、fromが一致（または空＝全社共通）
        if (isRecommended === 'Y' || isRecommended === 'y') {
          if (!fromDeptId || ruleFromDeptId === '' || ruleFromDeptId === fromDeptId) {
            if (ruleToDeptId && recommended.indexOf(ruleToDeptId) < 0) {
              recommended.push(ruleToDeptId);
            }
          }
        }
      }

      return recommended;
    } catch (e) {
      console.error('getRecommended エラー:', e);
      return [];
    }
  }

  // 公開API
  return {
    getFavorites: getFavorites,
    setFavorite: setFavorite,
    isFavorite: isFavorite,
    listRecents: listRecents,
    getRecommended: getRecommended
  };
})();
