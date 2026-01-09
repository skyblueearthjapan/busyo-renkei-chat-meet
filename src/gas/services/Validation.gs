/**
 * Validation.gs - バリデーションサービス
 *
 * メモ入力等のバリデーションを提供
 * やさしい日本語でエラーメッセージを返す
 */

var Validation = (function() {

  /**
   * メモデータをバリデーション
   * @param {Object} memoData - メモデータ
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  function validateMemo(memoData) {
    var errors = [];

    // 必須チェック: issue_type
    if (!memoData.issue_type || memoData.issue_type.trim() === '') {
      errors.push('問い合わせ種別を選択してください');
    }

    // 必須チェック: summary
    if (!memoData.summary || memoData.summary.trim() === '') {
      errors.push('要点を入力してください');
    }

    // 長さチェック: summary
    if (memoData.summary && memoData.summary.length > Config.SUMMARY_MAX_LENGTH) {
      errors.push('要点は' + Config.SUMMARY_MAX_LENGTH + '文字以内で入力してください');
    }

    // 日付形式チェック: due_date
    if (memoData.due_date && memoData.due_date.trim() !== '') {
      if (!isValidDateFormat(memoData.due_date)) {
        errors.push('期限は yyyy-mm-dd 形式で入力してください');
      }
    }

    // URL形式チェック: attachments
    if (memoData.attachments && memoData.attachments.trim() !== '') {
      if (!isValidUrl(memoData.attachments)) {
        errors.push('添付リンクは正しいURL形式で入力してください');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 日付形式をチェック（yyyy-mm-dd）
   * @param {string} dateStr - 日付文字列
   * @returns {boolean} 有効かどうか
   */
  function isValidDateFormat(dateStr) {
    if (!dateStr) return true; // 空はOK

    // yyyy-mm-dd形式チェック
    var pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(dateStr)) return false;

    // 実在する日付かチェック
    var parts = dateStr.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    var date = new Date(year, month, day);
    return date.getFullYear() === year &&
           date.getMonth() === month &&
           date.getDate() === day;
  }

  /**
   * URL形式をチェック
   * @param {string} url - URL文字列
   * @returns {boolean} 有効かどうか
   */
  function isValidUrl(url) {
    if (!url) return true; // 空はOK

    // 基本的なURL形式チェック
    var pattern = /^https?:\/\/.+/i;
    return pattern.test(url.trim());
  }

  /**
   * 必須フィールドをチェック
   * @param {Object} data - データオブジェクト
   * @param {Array} requiredFields - 必須フィールド名の配列
   * @returns {Array} 不足しているフィールド名の配列
   */
  function checkRequired(data, requiredFields) {
    var missing = [];
    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i];
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        missing.push(field);
      }
    }
    return missing;
  }

  /**
   * 文字列長をチェック
   * @param {string} str - 文字列
   * @param {number} maxLength - 最大長
   * @returns {boolean} 範囲内かどうか
   */
  function checkLength(str, maxLength) {
    if (!str) return true;
    return str.length <= maxLength;
  }

  /**
   * エラーメッセージを整形（やさしい日本語）
   * @param {Array} errors - エラーメッセージの配列
   * @returns {string} 整形されたエラーメッセージ
   */
  function formatErrorMessage(errors) {
    if (!errors || errors.length === 0) {
      return '';
    }

    if (errors.length === 1) {
      return errors[0];
    }

    return '入力が足りません。以下を確認してください：\n' + errors.map(function(e) {
      return '・' + e;
    }).join('\n');
  }

  /**
   * 保存失敗時のメッセージ
   * @returns {string}
   */
  function getSaveFailureMessage() {
    return '保存に失敗しました。内容をコピーしてから再度お試しください。';
  }

  /**
   * dept_idの形式チェック（英数字とアンダースコアのみ）
   * @param {string} deptId - 部署ID
   * @returns {boolean}
   */
  function isValidDeptId(deptId) {
    if (!deptId) return false;
    return /^[a-zA-Z0-9_]+$/.test(deptId);
  }

  return {
    validateMemo: validateMemo,
    isValidDateFormat: isValidDateFormat,
    isValidUrl: isValidUrl,
    checkRequired: checkRequired,
    checkLength: checkLength,
    formatErrorMessage: formatErrorMessage,
    getSaveFailureMessage: getSaveFailureMessage,
    isValidDeptId: isValidDeptId
  };
})();
