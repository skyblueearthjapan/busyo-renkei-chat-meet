/**
 * Config.gs - 定数定義
 * シート名、タイムゾーン等のグローバル設定
 */

var Config = {
  // シート名
  SHEET_DEPT: 'Dept_Master',
  SHEET_LOOKUP: 'Lookup',
  SHEET_LOG: 'Interaction_Log',
  SHEET_MEMO: 'Session_Memos',
  SHEET_RULES: 'Connection_Rules',

  // タイムゾーン
  TIMEZONE: 'Asia/Tokyo',

  // キャッシュ有効期間（秒）
  CACHE_TTL: 300, // 5分

  // ID採番プロパティキー
  PROP_NEXT_EVENT_ID: 'nextEventId',
  PROP_NEXT_MEMO_ID: 'nextMemoId',

  // IDプレフィックス
  EVENT_ID_PREFIX: 'E',
  MEMO_ID_PREFIX: 'M',
  EVENT_ID_DIGITS: 6,
  MEMO_ID_DIGITS: 6,

  // バリデーション
  SUMMARY_MAX_LENGTH: 300,

  // イベントタイプ
  EVENT_TYPES: {
    OPEN_HOME: 'OpenHome',
    OPEN_CHAT: 'OpenChat',
    CREATE_MEET: 'CreateMeet',
    MEET_READY: 'MeetReady',
    NOTIFY_CHAT: 'NotifyChat',
    NOTIFY_CHAT_SKIPPED: 'NotifyChatSkipped',
    NOTIFY_CHAT_FAILED: 'NotifyChatFailed',
    OPEN_MEET: 'OpenMeet',
    OPEN_MEMO: 'OpenMemo',
    SAVE_MEMO: 'SaveMemo',
    OPEN_HISTORY: 'OpenHistory',
    OPEN_DETAIL: 'OpenDetail',
    ERROR: 'Error'
  },

  // デフォルト値
  DEFAULT_PRIORITY: '中',
  DEFAULT_STATUS: 'Open',

  // Lookupカテゴリ名
  LOOKUP_CATEGORIES: {
    ISSUE_TYPE: 'IssueType',
    OUTCOME: 'Outcome',
    PRIORITY: 'Priority',
    STATUS: 'Status',
    CHANNEL: 'Channel'
  }
};
