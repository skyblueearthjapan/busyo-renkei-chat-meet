/**
 * IdService.gs - ID採番サービス
 * event_id, memo_id の一意ID生成
 * PropertiesService + LockService で排他制御
 */

var IdService = (function() {

  /**
   * 次のevent_idを生成
   * @returns {string} E000001形式のID
   */
  function nextEventId() {
    return generateNextId(
      Config.PROP_NEXT_EVENT_ID,
      Config.EVENT_ID_PREFIX,
      Config.EVENT_ID_DIGITS
    );
  }

  /**
   * 次のmemo_idを生成
   * @returns {string} M000001形式のID
   */
  function nextMemoId() {
    return generateNextId(
      Config.PROP_NEXT_MEMO_ID,
      Config.MEMO_ID_PREFIX,
      Config.MEMO_ID_DIGITS
    );
  }

  /**
   * 汎用ID生成（排他制御付き）
   * @param {string} propKey - プロパティキー
   * @param {string} prefix - IDプレフィックス
   * @param {number} digits - 桁数
   * @returns {string} 生成されたID
   */
  function generateNextId(propKey, prefix, digits) {
    var lock = LockService.getScriptLock();

    try {
      // 最大10秒待機
      var acquired = lock.tryLock(10000);
      if (!acquired) {
        throw new Error('ID採番のロック取得に失敗しました。しばらく待ってから再度お試しください。');
      }

      var props = PropertiesService.getScriptProperties();
      var currentValue = props.getProperty(propKey);
      var currentNum = currentValue ? parseInt(currentValue, 10) : 1;

      if (isNaN(currentNum) || currentNum < 1) {
        currentNum = 1;
      }

      // IDを生成
      var newId = prefix + padZero(currentNum, digits);

      // 次の番号を保存
      props.setProperty(propKey, String(currentNum + 1));

      return newId;

    } catch (e) {
      console.error('ID採番エラー:', e);
      throw new Error('IDの生成に失敗しました。' + e.message);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * 数値をゼロパディング
   * @param {number} num - 数値
   * @param {number} digits - 桁数
   * @returns {string} ゼロパディングされた文字列
   */
  function padZero(num, digits) {
    var str = String(num);
    while (str.length < digits) {
      str = '0' + str;
    }
    return str;
  }

  /**
   * 現在のID番号を取得（デバッグ用）
   * @returns {Object} 現在のID番号
   */
  function getCurrentIds() {
    var props = PropertiesService.getScriptProperties();
    return {
      nextEventId: props.getProperty(Config.PROP_NEXT_EVENT_ID) || '1',
      nextMemoId: props.getProperty(Config.PROP_NEXT_MEMO_ID) || '1'
    };
  }

  /**
   * ID番号をリセット（管理者用）
   * @param {string} type - 'event' または 'memo'
   * @param {number} value - 設定する値
   */
  function resetIdCounter(type, value) {
    var props = PropertiesService.getScriptProperties();
    var key = type === 'event' ? Config.PROP_NEXT_EVENT_ID : Config.PROP_NEXT_MEMO_ID;
    props.setProperty(key, String(value || 1));
  }

  return {
    nextEventId: nextEventId,
    nextMemoId: nextMemoId,
    getCurrentIds: getCurrentIds,
    resetIdCounter: resetIdCounter
  };
})();
