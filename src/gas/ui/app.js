<script>
/**
 * 部署クイック連絡ポータル - フロントエンドアプリケーション
 */
var App = (function() {
  // アプリ状態
  var state = {
    user: null,
    deptList: [],
    lookup: {},
    currentPage: 'home',
    currentMeetData: null,
    filters: {
      location: 'all',
      search: ''
    }
  };

  // DOM要素のキャッシュ
  var elements = {};

  // ============================================
  // 初期化
  // ============================================

  /**
   * アプリケーション初期化
   */
  function init() {
    cacheElements();
    bindEvents();
    loadBootstrapData();
  }

  /**
   * DOM要素をキャッシュ
   */
  function cacheElements() {
    elements.mainContent = document.getElementById('main-content');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.toastContainer = document.getElementById('toast-container');
    elements.userInfo = document.getElementById('user-info');
    elements.meetModal = document.getElementById('meet-modal');
    elements.tabBtns = document.querySelectorAll('.tab-btn');
  }

  /**
   * イベントバインド
   */
  function bindEvents() {
    // タブナビゲーション
    elements.tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var page = this.getAttribute('data-page');
        navigateTo(page);
      });
    });
  }

  /**
   * 初期データを読み込み
   */
  function loadBootstrapData() {
    showLoading('データを読み込んでいます...');

    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          state.user = result.data.user;
          state.deptList = result.data.deptList;
          state.lookup = result.data.lookup;

          // ユーザー情報表示
          if (state.user && state.user.name) {
            elements.userInfo.textContent = state.user.name + ' さん';
          }

          // 初期ページ表示
          navigateTo(INITIAL_PAGE, INITIAL_PARAMS);
        } else {
          showToast(result.error || 'データの読み込みに失敗しました', 'error');
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showToast('接続エラーが発生しました', 'error');
        console.error(error);
      })
      .getBootstrap();
  }

  // ============================================
  // ページナビゲーション
  // ============================================

  /**
   * ページ遷移
   */
  function navigateTo(page, params) {
    params = params || {};
    state.currentPage = page;

    // タブのアクティブ状態を更新
    elements.tabBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });

    // ページを描画
    switch (page) {
      case 'home':
        renderHomePage();
        break;
      case 'memo':
        renderMemoPage(params);
        break;
      case 'history':
        renderHistoryPage();
        break;
      case 'detail':
        renderDetailPage(params.memo_id);
        break;
      default:
        renderHomePage();
    }
  }

  // ============================================
  // ホームページ（部署一覧）
  // ============================================

  /**
   * ホームページを描画
   */
  function renderHomePage() {
    var template = document.getElementById('page-home');
    elements.mainContent.innerHTML = template.innerHTML;

    // イベントバインド
    var searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(function() {
      state.filters.search = this.value.toLowerCase();
      renderDeptList();
    }, 300));

    var chips = document.querySelectorAll('.filter-chips .chip');
    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        chips.forEach(function(c) { c.classList.remove('active'); });
        this.classList.add('active');
        state.filters.location = this.getAttribute('data-location');
        renderDeptList();
      });
    });

    renderDeptList();
  }

  /**
   * 部署リストを描画
   */
  function renderDeptList() {
    var container = document.getElementById('dept-list');
    var filteredDepts = state.deptList.filter(function(dept) {
      // 拠点フィルタ
      if (state.filters.location !== 'all' && dept.location !== state.filters.location) {
        return false;
      }
      // 検索フィルタ
      if (state.filters.search && dept.name.toLowerCase().indexOf(state.filters.search) === -1) {
        return false;
      }
      return true;
    });

    if (filteredDepts.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">🔍</div>' +
        '<p class="empty-text">該当する部署がありません</p>' +
        '</div>';
      return;
    }

    container.innerHTML = filteredDepts.map(function(dept) {
      var chatDisabled = !dept.chatUrl && !dept.chatSpaceId;
      var meetDisabled = !dept.chatSpaceId && !dept.notifySpaceId && !dept.permanentMeetUrl;

      return '<div class="dept-card" data-dept-id="' + dept.id + '">' +
        '<div class="dept-info">' +
          '<div class="dept-name">' + escapeHtml(dept.name) + '</div>' +
          (dept.description ? '<div class="dept-description">' + escapeHtml(dept.description) + '</div>' : '') +
          '<span class="dept-location">' + escapeHtml(dept.location) + '</span>' +
        '</div>' +
        '<div class="dept-actions">' +
          '<button class="btn btn-chat" ' + (chatDisabled ? 'disabled title="準備中です"' : '') +
            ' onclick="App.handleChat(\'' + dept.id + '\')">' +
            '💬 Chat' +
          '</button>' +
          '<button class="btn btn-meet" ' + (meetDisabled ? 'disabled title="準備中です"' : '') +
            ' onclick="App.handleMeet(\'' + dept.id + '\')">' +
            '📹 Meet' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /**
   * Chatボタン処理
   */
  function handleChat(deptId) {
    showLoading('Chatを開いています...');

    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          showToast(result.data.deptName + ' のChatを開きます', 'success');
          window.open(result.data.chatUrl, '_blank');
        } else {
          showToast(result.error || 'Chatを開けませんでした', 'error');
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showToast('エラーが発生しました', 'error');
        console.error(error);
      })
      .openChat(deptId, '');
  }

  /**
   * Meetボタン処理
   */
  function handleMeet(deptId) {
    showLoading('Meetを作成しています...');

    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          state.currentMeetData = result.data;

          // モーダルに情報を設定
          elements.meetModal.querySelector('.meet-dept-name').textContent = result.data.deptName;
          elements.meetModal.classList.remove('hidden');

          // 新しいタブでMeetを開く
          window.open(result.data.meetingUri, '_blank');
        } else {
          showToast(result.error || 'Meetを作成できませんでした', 'error');
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showToast('エラーが発生しました', 'error');
        console.error(error);
      })
      .createMeet(deptId, '');
  }

  /**
   * Meetモーダルを閉じる
   */
  function closeMeetModal() {
    elements.meetModal.classList.add('hidden');
    state.currentMeetData = null;
  }

  /**
   * MeetからメモページへGO
   */
  function openMemoFromMeet() {
    if (state.currentMeetData) {
      navigateTo('memo', {
        event_id: state.currentMeetData.eventId,
        to_dept: state.currentMeetData.deptId
      });
    }
    closeMeetModal();
  }

  // ============================================
  // メモページ
  // ============================================

  /**
   * メモページを描画
   */
  function renderMemoPage(params) {
    var template = document.getElementById('page-memo');
    elements.mainContent.innerHTML = template.innerHTML;

    // プルダウンを設定
    populateDeptSelect('memo-from-dept');
    populateDeptSelect('memo-to-dept');
    populateLookupSelect('memo-issue-type', state.lookup.IssueType);
    populateLookupSelect('memo-outcome', state.lookup.Outcome, true);
    populateLookupSelect('memo-priority', state.lookup.Priority);
    populateLookupSelect('memo-status', state.lookup.Status);

    // パラメータから初期値を設定
    if (params.event_id) {
      document.getElementById('memo-event-id').value = params.event_id;
    }
    if (params.to_dept) {
      document.getElementById('memo-to-dept').value = params.to_dept;
    }
    if (params.from_dept) {
      document.getElementById('memo-from-dept').value = params.from_dept;
    }

    // フォーム送信
    var form = document.getElementById('memo-form');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      saveMemo();
    });
  }

  /**
   * 部署セレクトを設定
   */
  function populateDeptSelect(selectId) {
    var select = document.getElementById(selectId);
    state.deptList.forEach(function(dept) {
      var option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      select.appendChild(option);
    });
  }

  /**
   * Lookupセレクトを設定
   */
  function populateLookupSelect(selectId, values, addEmpty) {
    var select = document.getElementById(selectId);
    if (addEmpty) {
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '未選択';
      select.appendChild(emptyOpt);
    }
    values.forEach(function(value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  /**
   * メモを保存
   */
  function saveMemo() {
    var form = document.getElementById('memo-form');
    var formData = new FormData(form);
    var memoData = {};

    formData.forEach(function(value, key) {
      memoData[key] = value;
    });

    // バリデーション
    if (!memoData.issueType) {
      showToast('問い合わせ種別を選択してください', 'error');
      return;
    }
    if (!memoData.summary) {
      showToast('要点を入力してください', 'error');
      return;
    }

    showLoading('保存しています...');

    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          showToast('保存しました', 'success');
          navigateTo('detail', { memo_id: result.data.memoId });
        } else {
          showToast(result.error || '保存に失敗しました', 'error');
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showToast('エラーが発生しました。入力内容をコピーして保管してください。', 'error');
        console.error(error);
      })
      .saveMemo(memoData);
  }

  // ============================================
  // 履歴ページ
  // ============================================

  /**
   * 履歴ページを描画
   */
  function renderHistoryPage() {
    var template = document.getElementById('page-history');
    elements.mainContent.innerHTML = template.innerHTML;

    // 種別フィルタを設定
    var typeFilter = document.getElementById('history-type-filter');
    state.lookup.IssueType.forEach(function(type) {
      var option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeFilter.appendChild(option);
    });

    // フィルタイベント
    document.getElementById('history-status-filter').addEventListener('change', loadMemos);
    document.getElementById('history-type-filter').addEventListener('change', loadMemos);

    loadMemos();
  }

  /**
   * メモ一覧を読み込み
   */
  function loadMemos() {
    var statusFilter = document.getElementById('history-status-filter').value;
    var typeFilter = document.getElementById('history-type-filter').value;

    showLoading('履歴を読み込んでいます...');

    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          renderMemoList(result.data);
        } else {
          showToast(result.error || '履歴の読み込みに失敗しました', 'error');
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showToast('エラーが発生しました', 'error');
        console.error(error);
      })
      .listMemos({
        status: statusFilter,
        issueType: typeFilter,
        limit: 50
      });
  }

  /**
   * メモリストを描画
   */
  function renderMemoList(memos) {
    var container = document.getElementById('memo-list');

    if (memos.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">📋</div>' +
        '<p class="empty-text">履歴がありません</p>' +
        '</div>';
      return;
    }

    container.innerHTML = memos.map(function(memo) {
      var statusClass = getStatusClass(memo.status);
      return '<div class="memo-card" onclick="App.navigateTo(\'detail\', {memo_id: \'' + memo.id + '\'})">' +
        '<div class="memo-header">' +
          '<span class="memo-date">' + formatDate(memo.createdAt) + '</span>' +
          '<span class="status-badge ' + statusClass + '">' + escapeHtml(memo.status) + '</span>' +
        '</div>' +
        '<div class="memo-route">' + escapeHtml(memo.fromDeptName || '?') + ' → ' + escapeHtml(memo.toDeptName || '?') + '</div>' +
        '<div class="memo-summary">' + escapeHtml(memo.summary || '') + '</div>' +
        '<div class="memo-footer">' +
          '<span class="memo-type">' + escapeHtml(memo.issueType || '') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ============================================
  // 詳細ページ
  // ============================================

  /**
   * 詳細ページを描画
   */
  function renderDetailPage(memoId) {
    var template = document.getElementById('page-detail');
    elements.mainContent.innerHTML = template.innerHTML;

    if (!memoId) {
      showToast('メモIDが指定されていません', 'error');
      return;
    }

    showLoading('詳細を読み込んでいます...');

    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          renderMemoDetail(result.data);
        } else {
          showToast(result.error || 'メモの読み込みに失敗しました', 'error');
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showToast('エラーが発生しました', 'error');
        console.error(error);
      })
      .getMemoDetail(memoId);
  }

  /**
   * メモ詳細を描画
   */
  function renderMemoDetail(memo) {
    var container = document.getElementById('memo-detail');
    var statusClass = getStatusClass(memo.status);

    container.innerHTML =
      '<div class="detail-section">' +
        '<div class="memo-header">' +
          '<span class="memo-date">' + formatDate(memo.createdAt) + '</span>' +
          '<span class="status-badge ' + statusClass + '">' + escapeHtml(memo.status) + '</span>' +
        '</div>' +
        '<div class="memo-route" style="margin-top:8px; font-size:1.1rem;">' +
          escapeHtml(memo.fromDeptName || '?') + ' → ' + escapeHtml(memo.toDeptName || '?') +
        '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="detail-label">問い合わせ種別</div>' +
        '<div class="detail-value">' + escapeHtml(memo.issueType || '-') + '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="detail-label">要点</div>' +
        '<div class="detail-value large">' + escapeHtml(memo.summary || '-') + '</div>' +
      '</div>' +

      (memo.decision ?
        '<div class="detail-section">' +
          '<div class="detail-label">決定事項/対応内容</div>' +
          '<div class="detail-value" style="white-space:pre-wrap;">' + escapeHtml(memo.decision) + '</div>' +
        '</div>' : '') +

      '<div class="detail-section">' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
          '<div>' +
            '<div class="detail-label">担当者</div>' +
            '<div class="detail-value">' + escapeHtml(memo.assignee || '-') + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="detail-label">期限</div>' +
            '<div class="detail-value">' + (memo.deadline ? formatDate(memo.deadline) : '-') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">' +
          '<div>' +
            '<div class="detail-label">結果</div>' +
            '<div class="detail-value">' + escapeHtml(memo.outcome || '-') + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="detail-label">優先度</div>' +
            '<div class="detail-value">' + escapeHtml(memo.priority || '-') + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="detail-label">作成者</div>' +
            '<div class="detail-value">' + escapeHtml(memo.creatorName || '-') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      (memo.attachmentUrl ?
        '<div class="detail-section">' +
          '<div class="detail-label">添付リンク</div>' +
          '<div class="detail-value">' +
            '<a href="' + escapeHtml(memo.attachmentUrl) + '" target="_blank" style="color:#3B82F6;">' +
              '📎 添付ファイルを開く' +
            '</a>' +
          '</div>' +
        '</div>' : '') +

      (memo.tags ?
        '<div class="detail-section">' +
          '<div class="detail-label">タグ</div>' +
          '<div class="detail-value">' + escapeHtml(memo.tags) + '</div>' +
        '</div>' : '');
  }

  // ============================================
  // ユーティリティ
  // ============================================

  /**
   * ローディング表示
   */
  function showLoading(text) {
    elements.loadingOverlay.querySelector('.loading-text').textContent = text || '読み込み中...';
    elements.loadingOverlay.classList.remove('hidden');
  }

  /**
   * ローディング非表示
   */
  function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
  }

  /**
   * トースト表示
   */
  function showToast(message, type) {
    type = type || 'info';
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(function() {
      toast.remove();
    }, 3000);
  }

  /**
   * HTMLエスケープ
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 日付フォーマット
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
   * ステータスのCSSクラスを取得
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

  // ============================================
  // 公開API
  // ============================================
  return {
    init: init,
    navigateTo: navigateTo,
    handleChat: handleChat,
    handleMeet: handleMeet,
    closeMeetModal: closeMeetModal,
    openMemoFromMeet: openMemoFromMeet
  };
})();

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', App.init);
</script>
