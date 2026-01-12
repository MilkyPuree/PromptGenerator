/**
 * storage-keys.js - Chrome Storage APIのキー定数
 *
 * Chrome Storage Sync/Localで使用される全てのキーを一元管理
 * キー名の変更は既存データの移行が必要になるため慎重に行うこと
 */

// Chrome Storage キー
const STORAGE_KEYS = {
  // プロンプト関連
  PROMPT: {
    GENERATE: "generatePrompt", // 生成用プロンプト
    LIST: "promptList", // プロンプトリスト
    LOCAL_LIST: "localPromptList", // ローカルプロンプトリスト
    SEARCH_CATEGORY: "searchCategory", // 検索カテゴリー
    SLOTS: "promptSlots", // プロンプトスロット
  },

  // 辞書関連
  DICTIONARY: {
    PROMPT_DICTIONARIES: "promptDictionaries", // プロンプト辞書
    CURRENT_PROMPT_DICTIONARY: "currentPromptDictionary", // 現在のプロンプト辞書
  },

  // カテゴリ関連
  CATEGORY: {
    DATA: "categoryData", // カテゴリデータ
  },

  // 設定関連
  SETTINGS: {
    OPTIONS: "optionData", // オプション設定
    TOOL_INFO: "toolInfo", // ツール情報
    CUSTOM_SITES: "customSites", // カスタムサイト設定
    AUTO_GENERATE: "autoGenerateSettings", // 自動生成設定
    DUPLICATE_CHECK_DISMISSED: "duplicateCheckDismissed", // 重複チェック非表示フラグ
  },

  // セレクター関連
  SELECTORS: {
    POSITIVE: "positiveSelector", // ポジティブセレクター
    GENERATE: "generateSelector", // 生成セレクター
    POSITIVE_TEXT: "positivePromptText", // ポジティブプロンプトテキスト
    GENERATE_BUTTON: "generateButton", // 生成ボタン
  },

  // 履歴・ログ関連
  HISTORY: {
    GENERATE: "generateHistory", // 生成履歴
    ERROR_LOGS: "errorLogs", // エラーログ
  },

  // UI状態関連
  UI_STATE: {
    ACTIVE_TAB: "activeTab", // アクティブなタブ
    SEARCH_FILTERS: "searchFilters", // 検索フィルター
    SORT_ORDER: "sortOrder", // ソート順
    VIEW_MODE: "viewMode", // 表示モード
  },

  // 一時データ
  TEMP: {
    LAST_SYNC: "lastSync", // 最終同期時刻
    CACHE_VERSION: "cacheVersion", // キャッシュバージョン
  },
};

// Storage API タイプ
const STORAGE_TYPES = {
  SYNC: "sync", // 同期ストレージ（8KB制限）
  LOCAL: "local", // ローカルストレージ（5MB制限）
};

// Storage サイズ制限
const STORAGE_LIMITS = {
  SYNC: {
    QUOTA_BYTES: 102400, // 同期ストレージ全体の容量（100KB）
    QUOTA_BYTES_PER_ITEM: 8192, // アイテムあたりの最大サイズ（8KB）
    MAX_ITEMS: 512, // 最大アイテム数
    MAX_WRITE_OPERATIONS_PER_HOUR: 1800, // 1時間あたりの最大書き込み回数
    MAX_WRITE_OPERATIONS_PER_MINUTE: 120, // 1分あたりの最大書き込み回数
  },
  LOCAL: {
    QUOTA_BYTES: 5242880, // ローカルストレージ全体の容量（5MB）
  },
};

// 辞書タイプ定数
const DICTIONARY_TYPES_STORAGE = {
  PROMPT: "prompt",
  ELEMENT: "element",
  MASTER: "master",
};

// デフォルト辞書ID
const DEFAULT_DICTIONARY_ID = "main";

// グローバルにエクスポート
window.STORAGE_KEYS = STORAGE_KEYS;
window.STORAGE_TYPES = STORAGE_TYPES;
window.STORAGE_LIMITS = STORAGE_LIMITS;
window.DICTIONARY_TYPES_STORAGE = DICTIONARY_TYPES_STORAGE;
window.DEFAULT_DICTIONARY_ID = DEFAULT_DICTIONARY_ID;
