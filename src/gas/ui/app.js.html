<script>
/**
 * 部署クイック連絡ポータル - 共通ユーティリティ
 */
var App = (function() {
  // 共通状態
  var state = {
    bootstrap: null,
    depts: [],
    lookup: {},
    user: null
  };

  // DOM要素キャッシュ
  var elements = {};

  // ============================================
  // 初期化
  // ============================================

  /**
   * 共通初期化（各ページから呼ばれる）
   * @param {Object} options - { onReady: function(bootstrap) }
   */
  function init(options) {
    options = options || {};

    cacheElements();

    // bootstrapデータを取得（HTMLに埋め込み済み）
    if (typeof BOOTSTRAP_DATA !== 'undefined' && BOOTSTRAP_DATA) {
      state.bootstrap = BOOTSTRAP_DATA;
      state.depts = BOOTSTRAP_DATA.depts || [];
      state.lookup = BOOTSTRAP_DATA.lookup || {};
      state.user = BOOTSTRAP_DATA.user || {};

      // ユーザー名表示
      updateUserInfo();

      // ページ固有の初期化コールバック
      if (options.onReady) {
        options.onReady(state.bootstrap);
      }

      hideLoading();
    } else {
      showToast('データの読み込みに失敗しました', 'error');
      hideLoading();
    }
  }

  /**
   * DOM要素をキャッシュ
   */
  function cacheElements() {
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.toastContainer = document.getElementById('toast-container');
    elements.userInfo = document.getElementById('user-info');
  }

  /**
   * ユーザー情報を表示
   */
  function updateUserInfo() {
    if (elements.userInfo && state.user && state.user.name) {
      elements.userInfo.textContent = state.user.name + ' さん';
    }
  }

  // ============================================
  // ページ遷移
  // ============================================

  /**
   * ページ遷移（別ページへ移動）
   * @param {string} page - ページ名
   * @param {Object} params - パラメータ
   */
  function navigateTo(page, params) {
    params = params || {};
    var url = '?page=' + encodeURIComponent(page);

    for (var key in params) {
      if (params.hasOwnProperty(key) && params[key]) {
        url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    }

    window.location.href = url;
  }

  /**
   * 初期パラメータを取得
   * @returns {Object} パラメータオブジェクト
   */
  function getInitialParams() {
    return typeof INITIAL_PARAMS !== 'undefined' ? INITIAL_PARAMS : {};
  }

  // ============================================
  // ローディング・トースト
  // ============================================

  /**
   * ローディング表示
   * @param {string} text - 表示テキスト
   */
  function showLoading(text) {
    if (!elements.loadingOverlay) return;
    var textEl = elements.loadingOverlay.querySelector('.loading-text');
    if (textEl) {
      textEl.textContent = text || '読み込み中...';
    }
    elements.loadingOverlay.classList.remove('hidden');
  }

  /**
   * ローディング非表示
   */
  function hideLoading() {
    if (!elements.loadingOverlay) return;
    elements.loadingOverlay.classList.add('hidden');
  }

  /**
   * トースト表示
   * @param {string} message - メッセージ
   * @param {string} type - 'success' | 'error' | 'info'
   */
  function showToast(message, type) {
    if (!elements.toastContainer) {
      console.log('[Toast]', type, message);
      return;
    }

    type = type || 'info';
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(function() {
      toast.remove();
    }, 3000);
  }

  // ============================================
  // ユーティリティ
  // ============================================

  /**
   * HTMLエスケープ
   * @param {string} text - テキスト
   * @returns {string} エスケープ済み
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 日付フォーマット（短形式）
   * @param {string} dateStr - 日付文字列
   * @returns {string} フォーマット済み
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');

    return month + '/' + day + ' ' + hours + ':' + minutes;
  }

  /**
   * 日付フォーマット（日付のみ）
   * @param {string} dateStr - 日付文字列
   * @returns {string} yyyy-MM-dd形式
   */
  function formatDateOnly(dateStr) {
    if (!dateStr) return '';
    // 既にyyyy-MM-dd形式なら変換不要
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');

    return year + '-' + month + '-' + day;
  }

  /**
   * ステータスのCSSクラスを取得
   * @param {string} status - ステータス
   * @returns {string} CSSクラス名
   */
  function getStatusClass(status) {
    switch (status) {
      case 'Open': return 'status-open';
      case 'In Progress': return 'status-in-progress';
      case 'Done': return 'status-done';
      case 'Canceled': return 'status-canceled';
      default: return '';
    }
  }

  /**
   * デバウンス
   * @param {Function} func - 関数
   * @param {number} wait - 待機時間（ms）
   * @returns {Function}
   */
  function debounce(func, wait) {
    var timeout;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        func.apply(context, args);
      }, wait);
    };
  }

  /**
   * 部署リストを取得
   * @returns {Array} 部署リスト
   */
  function getDepts() {
    return state.depts;
  }

  /**
   * Lookup値を取得
   * @returns {Object} lookup
   */
  function getLookup() {
    return state.lookup;
  }

  /**
   * ユーザー情報を取得
   * @returns {Object} user
   */
  function getUser() {
    return state.user;
  }

  /**
   * 部署IDから部署名を取得
   * @param {string} deptId - 部署ID
   * @returns {string} 部署名
   */
  function getDeptName(deptId) {
    if (!deptId) return '';
    var dept = state.depts.find(function(d) {
      return d.dept_id === deptId;
    });
    return dept ? dept.name : deptId;
  }

  /**
   * 部署セレクトボックスを設定
   * @param {string} selectId - select要素のID
   * @param {string} selectedValue - 選択値（任意）
   */
  function populateDeptSelect(selectId, selectedValue) {
    var select = document.getElementById(selectId);
    if (!select) return;

    state.depts.forEach(function(dept) {
      var option = document.createElement('option');
      option.value = dept.dept_id;
      option.textContent = dept.name;
      if (selectedValue && dept.dept_id === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * Lookupセレクトボックスを設定
   * @param {string} selectId - select要素のID
   * @param {string} category - カテゴリ名
   * @param {string} selectedValue - 選択値（任意）
   */
  function populateLookupSelect(selectId, category, selectedValue) {
    var select = document.getElementById(selectId);
    if (!select) return;

    var values = state.lookup[category] || [];
    values.forEach(function(value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (selectedValue && value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  // ============================================
  // 公開API
  // ============================================
  return {
    init: init,
    navigateTo: navigateTo,
    getInitialParams: getInitialParams,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showToast: showToast,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatDateOnly: formatDateOnly,
    getStatusClass: getStatusClass,
    debounce: debounce,
    getDepts: getDepts,
    getLookup: getLookup,
    getUser: getUser,
    getDeptName: getDeptName,
    populateDeptSelect: populateDeptSelect,
    populateLookupSelect: populateLookupSelect
  };
})();
</script>
