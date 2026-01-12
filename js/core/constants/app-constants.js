/**
 * constants.js - アプリケーション全体の定数定義
 * Phase 8.5: マジックナンバー共通化
 *
 * 用途: コードベース全体で使用されるマジックナンバーを定数として定義し、
 *       保守性と可読性を向上させる
 */

// ============================================
// プロンプトスロット関連
// ============================================
const PROMPT_SLOTS = {
  MAX_SLOTS: 100, // スロットの最大数
  MIN_SLOTS: 1, // スロットの最小数
  DEFAULT_INITIAL_SLOTS: 3, // 初期スロット数
  SWITCH_DELAY: 50, // スロット切り替え時の遅延 (ms)
};

// ============================================
// 自動生成機能関連
// ============================================
const AUTO_GENERATE = {
  DEFAULT_COUNT: 10, // デフォルト生成回数
  DEFAULT_INTERVAL: 5000, // デフォルト生成間隔 (ms)
  MIN_INTERVAL: 3000, // 最小生成間隔 (ms)
  CHECK_INTERVAL: 1000, // 状態チェック間隔 (ms)
  TIMEOUT: 30000, // 生成タイムアウト時間 (ms)
  COMPLETION_TIMEOUT: 5000, // 生成完了判定時間 (ms)
  INPUT_SETTLE_DELAY: {
    // プロンプト入力後の待機時間
    NOVEL_AI: 1500, // NovelAI
    CLAUDE: 1500, // Claude
    CHAT_GPT: 1000, // ChatGPT
    DEFAULT: 0, // その他
  },
};

// ============================================
// UI更新・遅延時間関連
// ============================================
const UI_DELAYS = {
  REFRESH_DELAY: 50, // リフレッシュ遅延 (ms)
  FOCUS_RESTORE_DELAY: 100, // フォーカス復元遅延 (ms)
  QUICK_UPDATE: 50, // 高速UI更新 (ms)
  STANDARD_UPDATE: 100, // 標準UI更新 (ms)
  SLOW_UPDATE: 150, // 低速UI更新 (ms)
  DEBOUNCE_DELAY: 250, // デバウンス遅延 (ms)
  ANIMATION_FRAME: 16, // アニメーションフレーム間隔 (ms)
  // 編集タブ専用
  EDIT_REFRESH: 10, // 編集タブリフレッシュ遅延 (ms)
  TRANSLATION_CALLBACK: 50, // 翻訳コールバック遅延 (ms)
};

// ============================================
// 通知・トースト表示時間
// ============================================
const NOTIFICATION_DURATION = {
  SHORT: 1500, // 短時間通知 (ms)
  STANDARD: 2000, // 標準通知 (ms)
  MEDIUM: 3000, // 中時間通知 (ms)
  LONG: 5000, // 長時間通知 (ms)
  WARNING: 8000, // 警告通知 (ms)
  ERROR: 10000, // エラー通知 (ms)
};

// ============================================
// 仮想スクロール・リスト関連
// ============================================
const VIRTUAL_SCROLL = {
  THRESHOLD: 500, // 仮想スクロール使用判定の閾値（アイテム数）
  ITEM_HEIGHT: 40, // デフォルトアイテム高さ (px)
  BUFFER_SIZE: 3, // バッファサイズ（画面外の表示倍数）
  CONTAINER_HEIGHT: 600, // デフォルトコンテナ高さ (px)
  MAX_CONTAINER_HEIGHT: 800, // 最大コンテナ高さ (px)
  MIN_CONTAINER_HEIGHT: 200, // 最小コンテナ高さ (px)
  MAX_VISIBLE_ITEMS: 50, // 最大表示アイテム数
  MIN_VISIBLE_ITEMS: 1, // 最小表示アイテム数
};

// ============================================
// データ制限・閾値
// ============================================
const DATA_LIMITS = {
  MAX_PROMPT_LENGTH: 2000, // プロンプト最大長
  MAX_CATEGORY_LENGTH: 100, // カテゴリー名最大長
  MAX_TITLE_LENGTH: 200, // タイトル最大長
  SEARCH_DEBOUNCE: 300, // 検索デバウンス時間 (ms)
  FILE_SIZE_LIMIT: 10485760, // ファイルサイズ上限 (10MB)
  MAX_IMPORT_ITEMS: 10000, // インポート最大アイテム数
};

// ============================================
// 統一ID管理システム
// ============================================
const ID_OFFSETS = {
  EDIT_TAB: 10000, // 編集タブ: 10000番台
  SEARCH_RESULTS: 20000, // 検索結果: 20000番台
  FAVORITES: 30000, // お気に入り: 30000番台
  USER_DICTIONARY: 40000, // ユーザー辞書: 40000番台
  MASTER_DICTIONARY: 50000, // マスター辞書: 50000番台
};

// ============================================
// 重み値設定
// ============================================
const WEIGHT_CONFIG = {
  DEFAULT: 1.0, // デフォルト重み値
  MIN: -10.0, // 最小重み値
  MAX: 10.0, // 最大重み値
  DELTA: 0.1, // 重み値増減幅
  PRECISION: 3, // 小数点精度（桁数）
};

// ============================================
// キャッシュ・パフォーマンス
// ============================================
const CACHE_CONFIG = {
  WEB_FETCH_CACHE_DURATION: 900000, // WebFetch キャッシュ時間 (15分)
  CATEGORY_CACHE_SIZE: 1000, // カテゴリーキャッシュサイズ
  RENDER_BATCH_SIZE: 100, // レンダリングバッチサイズ
  THROTTLE_DELAY: 16, // スロットル遅延 (ms)
};

// ============================================
// ネットワーク・API関連
// ============================================
const NETWORK = {
  TIMEOUT: 10000, // ネットワークタイムアウト (ms)
  RETRY_COUNT: 3, // リトライ回数
  RETRY_DELAY: 1000, // リトライ間隔 (ms)
  CONNECTION_CHECK_INTERVAL: 30000, // 接続チェック間隔 (ms)
};

// ============================================
// ファイル操作関連
// ============================================
const FILE_OPERATIONS = {
  READ_TIMEOUT: 5000, // ファイル読み込みタイムアウト (ms)
  WRITE_DELAY: 100, // ファイル書き込み遅延 (ms)
  BACKUP_RETENTION: 5, // バックアップ保持数
  AUTO_SAVE_INTERVAL: 30000, // 自動保存間隔 (ms)
};

// ============================================
// セッション・ストレージ
// ============================================
const STORAGE = {
  SYNC_LIMIT: 8192, // Chrome Storage Sync 制限 (bytes)
  LOCAL_LIMIT: 5242880, // Chrome Storage Local 制限 (5MB)
  SESSION_TIMEOUT: 3600000, // セッションタイムアウト (1時間)
  AUTO_CLEANUP_INTERVAL: 86400000, // 自動クリーンアップ間隔 (24時間)
};

// ============================================
// バージョン・アプリケーション情報
// ============================================
const APP_INFO = {
  VERSION: "8.5", // アプリケーションバージョン
  MANIFEST_VERSION: 3, // Chrome Extension Manifest バージョン
  MIN_CHROME_VERSION: 88, // サポート最小Chromeバージョン
};

// ============================================
// MIMEタイプ・ファイル関連
// ============================================
const MIME_TYPES = {
  JSON: "application/json",
  PLAIN_TEXT: "text/plain",
  CSV: "text/csv",
  TSV: "text/tab-separated-values",
  EXCEL: "application/vnd.ms-excel",
  PNG: "image/png",
};

const FILE_EXTENSIONS = {
  JSON: ".json",
  CSV: ".csv",
  TSV: ".tsv",
  PNG: ".png",
};

// ============================================
// エクスポートファイル名定数（日本語）
// ============================================
const EXPORT_FILE_NAMES = {
  // 基本データ（全形式統一）
  PROMPT_DICTIONARY: "お気に入り", // csv-handler.js, dictionary-tab.js - お気に入りのエクスポート
  MASTER_DICTIONARY: "マスター辞書", // csv-handler.js, dictionary-tab.js - マスター辞書のエクスポート
  USER_DICTIONARY: "ユーザー辞書", // csv-handler.js, dictionary-tab.js - ユーザー辞書のエクスポート

  // 機能系（JSONのみ）
  GENERATE_HISTORY: "生成履歴", // generate-history-manager.js - 生成履歴のエクスポート
  SETTINGS: "全データバックアップ", // settings-manager.js - 全データ（設定・辞書・お気に入り・マスター等）のエクスポート
  SLOT_GROUP_PREFIX: "スロットグループ", // slot-tab.js - 個別スロットグループのエクスポート（グループ名が後続）
  ALL_SLOT_GROUPS: "全スロットグループ", // slot-tab.js - 全スロットグループのエクスポート
};

// データタイプ定数
const DATA_TYPES = {
  PROMPTS: "Prompts", // dictionary-tab.js - プロンプト辞書の種別判定・処理分岐
  ELEMENTS: "Elements", // dictionary-tab.js - 要素辞書の種別判定・処理分岐
};

// ============================================
// エクスポートファイル名生成ユーティリティ
// ============================================
class ExportFilenameGenerator {
  /**
   * エクスポート用のファイル名を生成
   * @param {string} dataType - データタイプ（"prompts", "elements", "master"）
   * @param {string} dictName - 辞書名（プロンプト辞書の場合のみ使用）
   * @returns {string} ベースファイル名
   */
  static generateBaseName(dataType, dictName = null) {
    let baseName;

    if (dataType === "prompts") {
      baseName = EXPORT_FILE_NAMES.PROMPT_DICTIONARY;
      // お気に入りの場合は辞書名も含める
      if (dictName) {
        const sanitizedDictName = FileUtilities.sanitizeFilename(dictName);
        baseName = `${baseName}_${sanitizedDictName}`;
      }
    } else if (dataType === "elements") {
      baseName = EXPORT_FILE_NAMES.USER_DICTIONARY;
    } else if (dataType === "master") {
      baseName = EXPORT_FILE_NAMES.MASTER_DICTIONARY;
    } else {
      baseName = EXPORT_FILE_NAMES.USER_DICTIONARY; // デフォルト
    }

    return baseName;
  }
}

// ============================================
// 翻訳状態定数（編集タブ用）
// ============================================
const TRANSLATION_STATES = {
  IN_PROGRESS: ["翻訳中", "翻訳中", "翻訳中"],
  COMPLETED: "翻訳完了",
  FAILED: "翻訳失敗",
  ERROR: "翻訳エラー",
  SOURCES: {
    GOOGLE: "Google翻訳",
    SYSTEM: "システムエラー",
  },
};

// ============================================
// HTML要素・属性定数
// ============================================
const HTML_ELEMENTS = {
  INPUT: "input",
  BUTTON: "button",
  DIV: "div",
  SPAN: "span",
  SELECT: "select",
  OPTION: "option",
  TEXTAREA: "textarea",
  FORM: "form",
  LABEL: "label",
};

const INPUT_TYPES = {
  TEXT: "text",
  FILE: "file",
  PASSWORD: "password",
  EMAIL: "email",
  NUMBER: "number",
  CHECKBOX: "checkbox",
  RADIO: "radio",
  HIDDEN: "hidden",
  SUBMIT: "submit",
  BUTTON: "button",
};

const HTML_ATTRIBUTES = {
  TYPE: "type",
  ACCEPT: "accept",
  MULTIPLE: "multiple",
  VALUE: "value",
  ID: "id",
  CLASS: "class",
  PLACEHOLDER: "placeholder",
  DISABLED: "disabled",
  CHECKED: "checked",
  SELECTED: "selected",
};

const JQUERY_UI_CONFIG = {
  // jQuery UI sortable用の設定値
  SORTABLE_CANCEL_SELECTOR: "input,textarea,button,select,option",
  SORTABLE_TOLERANCE: "pointer",
  SORTABLE_CURSOR: "grabbing",
  SORTABLE_HELPER: "clone",
  SORTABLE_REVERT: 100,
  SORTABLE_DISTANCE: 10,
  SORTABLE_OPACITY: 0.8,
  SORTABLE_SCROLL_SENSITIVITY: 20,
  SORTABLE_SCROLL_SPEED: 20,
};

// ============================================
// ファイルパス定数
// ============================================
const JS_FILES = {
  CONTENT: "js/content.js",
  BACKGROUND: "js/background.js",
  MAIN: "js/main.js",
};

// ============================================
// 追加の遅延時間定数
// ============================================
const ADDITIONAL_DELAYS = {
  VERY_SHORT: 10, // 10ms - 初期化待機
  SHORT_DELAY: 50, // 50ms - 短い遅延
  ELEMENT_UPDATE: 100, // 100ms - 要素更新遅延
  SHORT: 300, // 300ms - UI遷移
  MEDIUM: 500, // 500ms - バッチ処理間隔
  REFRESH_DELAY: 600, // 600ms - リフレッシュ遅延
  STANDARD_REFRESH: 700, // 700ms - 標準リフレッシュ遅延
  STANDARD: 1000, // 1000ms - 標準遅延
  SUCCESS_NOTIFICATION: 1500, // 1500ms - 成功通知
  LONG: 3000, // 3000ms - トースト表示
};

// ============================================
// UI寸法定数
// ============================================
const UI_DIMENSIONS = {
  MARGIN: {
    STANDARD: 20, // 20px - 標準マージン
    SMALL: 10, // 10px - 小マージン
    EXTRA_SMALL: 4, // 4px - 極小マージン
  },
  PANEL: {
    WIDTH_LARGE: 400, // 400px - 大パネル幅
    WIDTH_MEDIUM: 350, // 350px - 中パネル幅
    WIDTH_SMALL: 300, // 300px - 小パネル幅
    MAX_HEIGHT: 1000, // 1000px - 最大高さ
  },
  COLUMN: {
    WEIGHT_WIDTH: 80, // 80px - 重みカラム幅
  },
  IMAGE: {
    PREVIEW_SIZE: 256, // 256px - プレビュー画像サイズ
    MAX_PREVIEW_SIZE: 540, // 540px - 最大プレビューサイズ
  },
  VIRTUAL_ITEM_HEIGHT: 35, // 35px - 仮想スクロール項目高
};

// ============================================
// 履歴管理設定
// ============================================
const HISTORY_CONFIG = {
  DEFAULT_MAX_SIZE: 30, // デフォルト履歴保持数
  ABSOLUTE_MAX_SIZE: 100, // 絶対最大履歴サイズ
  MAX_PROMPT_LENGTH: 2000, // 最大プロンプト長
  PREVIEW_LENGTH: 100, // プレビュー文字数
};

// ============================================
// 重み変換設定
// ============================================
const WEIGHT_CONVERSION = {
  MIN_THRESHOLD: 0.01, // 重み値の許容誤差
  NAI_BASE: 1.05, // NAI変換計算の基数
  SD_DELTA: 0.1, // SD形式のdelta値
  NAI_DELTA: 1, // NAI形式のdelta値
  MAX_NAI_WEIGHT: 10, // NAI形式の最大値
  MAX_SD_WEIGHT: 10, // SD形式の最大値
  DECIMAL_PRECISION: 100, // 小数点処理の係数
};

// ============================================
// 開発・デバッグ関連
// ============================================
const DEBUG = {
  LOG_LEVEL: "info", // ログレベル
  MAX_LOG_ENTRIES: 1000, // 最大ログエントリ数
  VERBOSE_LOGGING: false, // 詳細ログ出力
  PERFORMANCE_MONITORING: true, // パフォーマンス監視
};

// ============================================
// UI レスポンシブ関連
// ============================================
const RESPONSIVE = {
  MOBILE_BREAKPOINT: 768, // モバイル判定ブレークポイント (px)
  TABLET_BREAKPOINT: 1024, // タブレット判定ブレークポイント (px)
  MIN_POPUP_WIDTH: 400, // 最小ポップアップ幅 (px)
  MAX_POPUP_WIDTH: 800, // 最大ポップアップ幅 (px)
  MIN_POPUP_HEIGHT: 500, // 最小ポップアップ高さ (px)
  MAX_POPUP_HEIGHT: 700, // 最大ポップアップ高さ (px)
};

// ============================================
// 数値変換・フォーマット
// ============================================
const FORMAT = {
  LARGE_NUMBER_THRESHOLD: 999, // 省略表示閾値
  DECIMAL_PLACES: 2, // 小数点以下桁数
  PERCENTAGE_SCALE: 100, // パーセンテージ倍率
  PROGRESS_STEPS: 100, // プログレス分割数
};

// ============================================
// エクスポート（グローバル）
// ============================================
if (typeof window !== "undefined") {
  // 個別定数をグローバルに公開
  window.PROMPT_SLOTS = PROMPT_SLOTS;
  window.AUTO_GENERATE = AUTO_GENERATE;
  window.UI_DELAYS = UI_DELAYS;
  window.NOTIFICATION_DURATION = NOTIFICATION_DURATION;
  window.VIRTUAL_SCROLL = VIRTUAL_SCROLL;
  window.DATA_LIMITS = DATA_LIMITS;
  window.ID_OFFSETS = ID_OFFSETS;
  window.WEIGHT_CONFIG = WEIGHT_CONFIG;
  window.CACHE_CONFIG = CACHE_CONFIG;
  window.NETWORK = NETWORK;
  window.FILE_OPERATIONS = FILE_OPERATIONS;
  window.STORAGE = STORAGE;
  window.APP_INFO = APP_INFO;
  window.DEBUG = DEBUG;
  window.RESPONSIVE = RESPONSIVE;
  window.FORMAT = FORMAT;
  window.MIME_TYPES = MIME_TYPES;
  window.FILE_EXTENSIONS = FILE_EXTENSIONS;
  window.HTML_ELEMENTS = HTML_ELEMENTS;
  window.INPUT_TYPES = INPUT_TYPES;
  window.HTML_ATTRIBUTES = HTML_ATTRIBUTES;
  window.JQUERY_UI_CONFIG = JQUERY_UI_CONFIG;
  window.JS_FILES = JS_FILES;
  window.ADDITIONAL_DELAYS = ADDITIONAL_DELAYS;
  window.UI_DIMENSIONS = UI_DIMENSIONS;
  window.HISTORY_CONFIG = HISTORY_CONFIG;
  window.WEIGHT_CONVERSION = WEIGHT_CONVERSION;

  // 統合オブジェクトとしても公開（名前空間）
  window.CONSTANTS = {
    PROMPT_SLOTS,
    AUTO_GENERATE,
    UI_DELAYS,
    NOTIFICATION_DURATION,
    VIRTUAL_SCROLL,
    DATA_LIMITS,
    WEIGHT_CONFIG,
    CACHE_CONFIG,
    NETWORK,
    FILE_OPERATIONS,
    STORAGE,
    APP_INFO,
    DEBUG,
    RESPONSIVE,
    FORMAT,
    MIME_TYPES,
    FILE_EXTENSIONS,
    HTML_ELEMENTS,
    INPUT_TYPES,
    HTML_ATTRIBUTES,
    JQUERY_UI_CONFIG,
    JS_FILES,
    ADDITIONAL_DELAYS,
    UI_DIMENSIONS,
    HISTORY_CONFIG,
    WEIGHT_CONVERSION,
  };

  // レガシー互換性のため既存の定数名も維持
  window.MAX_SLOTS = PROMPT_SLOTS.MAX_SLOTS;
  window.MIN_SLOTS = PROMPT_SLOTS.MIN_SLOTS;

  console.log("[CONSTANTS] Application constants loaded successfully");
}

// ============================================
// Node.js 環境でのエクスポート（開発ツール用）
// ============================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROMPT_SLOTS,
    AUTO_GENERATE,
    UI_DELAYS,
    NOTIFICATION_DURATION,
    VIRTUAL_SCROLL,
    DATA_LIMITS,
    WEIGHT_CONFIG,
    CACHE_CONFIG,
    NETWORK,
    FILE_OPERATIONS,
    STORAGE,
    APP_INFO,
    DEBUG,
    RESPONSIVE,
    FORMAT,
    MIME_TYPES,
    FILE_EXTENSIONS,
    HTML_ELEMENTS,
    INPUT_TYPES,
    HTML_ATTRIBUTES,
    JQUERY_UI_CONFIG,
    JS_FILES,
    ADDITIONAL_DELAYS,
    UI_DIMENSIONS,
    HISTORY_CONFIG,
    WEIGHT_CONVERSION,
    TRANSLATION_STATES,
  };
}
