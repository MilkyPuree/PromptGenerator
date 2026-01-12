/**
 * messages.js - アプリケーション全体のメッセージ定数
 *
 * エラーメッセージ、成功メッセージ、通知メッセージなど、
 * ユーザーに表示される全ての文字列メッセージを管理
 */

// エラーメッセージ
const ERROR_MESSAGES = {
  // 通信・ネットワーク関連
  EXTENSION_COMMUNICATION:
    "拡張機能との通信でエラーが発生しました。ページを再読み込みしてください。",
  NETWORK_ERROR:
    "ネットワークエラーが発生しました。インターネット接続を確認してください。",
  TIMEOUT: "処理がタイムアウトしました。",
  PERMISSION_DENIED: "必要な権限がありません。",

  // データ操作関連
  SAVE_ERROR: "データの保存中にエラーが発生しました。",
  LOAD_ERROR: "データの読み込み中にエラーが発生しました。",
  PROCESS_ERROR: "処理中にエラーが発生しました: {context}",

  // ファイル操作関連
  UNSUPPORTED_FILE_TYPE: "対応していないファイル形式です",
  FILE_READ_ERROR: "ファイルの読み込みに失敗しました: {error.message}",
  INVALID_FILE_FORMAT: "不正なファイル形式です",
  UNKNOWN_DICTIONARY_TYPE: "不明な辞書タイプです: {data.dicType}",
  CSV_IMPORT_ERROR: "CSVインポートに失敗しました: {error.message}",

  // 検証エラー
  PROMPT_REQUIRED: "プロンプトを入力してください",
  CATEGORY_INVALID: "カテゴリを正しく入力してください",

  // スロット抽出エラー
  SLOT_FAVORITES_NOT_FOUND: "指定されたお気に入りリストが見つかりません",
  SLOT_FAVORITES_EMPTY: "選択されたお気に入りリストが空です",
  SLOT_EXTRACTION_FAILED: "プロンプトの抽出に失敗しました",

  // ストレージ関連
  SAVE_PROMPT_FAILED: "Failed to save prompt:",
  LOAD_PROMPT_FAILED: "Failed to load prompt:",
  SAVE_CATEGORY_FAILED: "Failed to save category:",
  LOAD_CATEGORY_FAILED: "Failed to load category:",
  SAVE_SELECTORS_FAILED: "Failed to save selectors:",
  LOAD_SELECTORS_FAILED: "Failed to load selectors:",
};

// 成功メッセージ
const SUCCESS_MESSAGES = {
  // 辞書操作
  DICTIONARY_REGISTERED: "ローカル辞書に登録しました",
  DICTIONARY_UPDATED: "ローカル辞書を更新しました",

  // ファイルインポート
  ELEMENT_DICTIONARY_LOADED: "{addCount}件の要素辞書を読み込みました",
  NO_NEW_ELEMENTS: "追加できる新しい要素がありませんでした",
  PROMPT_DICTIONARY_LOADED: "{addCount}件のお気に入りリストを読み込みました",
  NO_NEW_PROMPTS: "追加できる新しいプロンプトがありませんでした",
  CSV_IMPORTED_WITH_SKIP:
    "CSVをインポートしました（追加: {mergeResult.added}件, スキップ: {mergeResult.skipped}件）",
  CSV_IMPORTED: "CSVをインポートしました（{mergeResult.total}件）",

  // モード変更
  FORMAT_MODE_CHANGED: "整形モードを「{modeName}」に変更しました",
  EDIT_MODE_CHANGED: "編集モードを「{modeName}」に変更しました",

  // デバッグ
  DEBUG_MODE_ENABLED: "デバッグモードが有効になりました",
  ERROR_LOG_CLEARED: "エラーログをクリアしました",
};

// 通知メッセージ
const NOTIFICATION_MESSAGES = {
  LOADING: "読み込み中...",
  PROCESSING: "処理中...",
  SAVING: "保存中...",
  CSV_LOADING: "CSV読み込み中...",
};

// ファイル・エクスポート関連
const FILE_MESSAGES = {
  EXPORT_NO_DATA: "エクスポートするデータがありません",
  JSON_EXPORT_SUCCESS: "JSONファイルをダウンロードしました",
  CSV_EXPORT_SUCCESS: "CSVファイルをダウンロードしました",
  TSV_EXPORT_SUCCESS: "TSVファイルをダウンロードしました",
};

// CSV/TSVヘッダー名
const CSV_HEADERS = {
  TITLE: "タイトル",
  PROMPT: "プロンプト",
  BIG_CATEGORY: "大項目",
  MIDDLE_CATEGORY: "中項目",
  SMALL_CATEGORY: "小項目",
  WEIGHT: "重み",
};

// UI表示用ラベル
const UI_LABELS = {
  BIG_CATEGORY: "大項目",
  MIDDLE_CATEGORY: "中項目",
  SMALL_CATEGORY: "小項目",
  PROMPT: "Prompt",
  NAME: "名前",
  MAIN_DICTIONARY: "メインリスト",
  // スロット抽出関連
  DATA_SOURCE: "抽出元",
  EXTRACTION_SOURCE_DICTIONARY: "辞書",
  EXTRACTION_SOURCE_FAVORITES: "お気に入り",
  SELECT_FAVORITES_LIST: "リスト",
};

// 辞書表示テキスト
const DICTIONARY_TEXTS = {
  PROMPT: {
    OPEN: "▼お気に入りリスト　※ここをクリックで開閉",
    CLOSE: "▶お気に入りリスト　※ここをクリックで開閉",
  },
  ELEMENT: {
    OPEN: "▼要素辞書(ユーザー)　※ここをクリックで開閉",
    CLOSE: "▶要素辞書(ユーザー)　※ここをクリックで開閉",
  },
  MASTER: {
    OPEN: "▼辞書(マスタ)　※ここをクリックで開閉",
    CLOSE: "▶辞書(マスタ)　※ここをクリックで開閉",
  },
};

// FlexibleList ヘッダー情報
const FLEXIBLE_LIST_HEADERS = {
  // 辞書タブ用
  DICTIONARY: {
    PROMPT: { title: "お気に入りリスト", icon: "⭐️" },
    ELEMENT: { title: "ユーザー辞書", icon: "💾" },
    MASTER: { title: "マスター辞書", icon: "🏛️" },
  },
  // 編集タブ用
  EDIT: {
    PROMPT_EDITOR: { title: "編集中のPrompt", icon: "✏️" },
  },
  // 検索タブ用
  SEARCH: {
    RESULT: { title: "検索結果", icon: "🔍" },
    TRANSLATION_RESULT: { title: "翻訳結果", icon: "🌐" },
  },
};

// ボタン種類の定義と表示情報
const BUTTON_TYPES = {
  add: {
    label: "追加",
    icon: "➕",
    description: "プロンプトをフィールドに追加",
  },
  copy: {
    label: "コピー",
    icon: "📋",
    description: "プロンプトをクリップボードにコピー",
  },
  favorite: {
    label: "お気に入り",
    icon: "⭐",
    description: "お気に入りに登録",
  },
  load: {
    label: "読込",
    icon: "⬆️",
    description: "プロンプトをフィールドに読み込み",
  },
  delete: { label: "削除", icon: "🗑️", description: "項目を削除" },
  register: { label: "登録", icon: "💾", description: "辞書に登録" },
  generate: { label: "生成", icon: "⚡", description: "このプロンプトでテスト生成" },
};

// 列種類の定義と表示情報
const COLUMN_TYPES = {
  "category.0": {
    label: "大項目",
    icon: "📁",
    description: "大カテゴリ列",
    cssClass: "flex-col-category",
    nthChild: 1,
  },
  "category.1": {
    label: "中項目",
    icon: "📂",
    description: "中カテゴリ列",
    cssClass: "flex-col-category",
    nthChild: 2,
  },
  "category.2": {
    label: "小項目",
    icon: "📄",
    description: "小カテゴリ列",
    cssClass: "flex-col-category",
    nthChild: 3,
  },
  prompt: {
    label: "プロンプト",
    icon: "✏️",
    description: "プロンプト列",
    cssClass: "flex-col-prompt",
    nthChild: null,
  },
};

// FlexibleList 設定オプション
const FLEXIBLE_LIST_CONFIGS = {
  // 基本設定
  BASIC: {
    sortable: true,
    readonly: false,
    showHeaders: true,
    virtualScroll: 1000,
    containerHeight: 500,
  },
  // 読み取り専用設定
  READONLY: {
    sortable: false,
    readonly: true,
    showHeaders: true,
    virtualScroll: 1000,
    containerHeight: 500,
  },
  // 辞書設定
  DICTIONARY: {
    sortable: true,
    readonly: false,
    showHeaders: true,
    virtualScroll: false,
    containerHeight: 400,
  },
};

// FlexibleList タイプ定数
const FLEXIBLE_LIST_TYPES = {
  EDIT: "edit",
  FAVORITE: "favorite",
  ADD: "add",
  SEARCH: "search",
};

// カテゴリーチェーン共通設定
const CATEGORY_CHAIN_CONFIG = {
  TWO_CHAIN: {
    dropdownCount: 2, // 作成するカスタムドロップダウンの数（大項目・中項目のみ）
    chainLevel: 3, // フォーカス移動は3段階（大→中→小→プロンプト）
    resetLevel: 2, // リセット処理は2段階（大→中のみ、小項目はそのまま）
    categoryChainBehavior: {
      focusNext: true, // 次のフィールドにフォーカス移動
      openDropdownOnFocus: true, // フォーカス時にドロップダウンを開く
      focusPromptAfterSmall: true, // 小項目後にプロンプトフィールドにフォーカス
    },
  },
  THREE_CHAIN: {
    dropdownCount: 3, // 作成するカスタムドロップダウンの数（大項目・中項目・小項目）
    chainLevel: 3, // フォーカス移動は3段階（大→中→小→プロンプト）
    resetLevel: 3, // リセット処理は3段階（大→中→小すべて）
    categoryChainBehavior: {
      focusNext: true, // 次のフィールドにフォーカス移動
      openDropdownOnFocus: true, // フォーカス時にドロップダウンを開く
      focusPromptAfterSmall: true, // 小項目後にプロンプトフィールドにフォーカス
    },
  },
};

// メッセージレベル
const MESSAGE_LEVELS = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
  SUCCESS: "success",
};

// 辞書タイプ
const DICTIONARY_TYPES = {
  ELEMENTS: "Elements",
  PROMPTS: "Prompts",
};

// 編集モード
const EDIT_MODES = {
  SELECT: "SELECT",
  TEXT: "TEXT",
  DROPDOWN: "dropdown",
  TEXT_LOWER: "text",
};

// 整形モード（UIType）
const FORMAT_MODES = {
  SD: "SD", // StableDiffusion
  NAI: "NAI", // NovelAI
  NONE: "None", // 自動整形無し
};

// ソースタイプ
const SOURCE_TYPES = {
  LOCAL: "local",
  MASTER: "master",
};

// アクションタイプ
const ACTION_TYPES = {
  CHECK_SELECTOR: "checkSelector",
  UPDATE_PROMPT_LIST: "UpdatePromptList",
};

// 確認メッセージ
const CONFIRM_MESSAGES = {
  RESET_ALL_DATA:
    "すべてのデータをリセットしますか？この操作は取り消せません。",
  DELETE_ITEM: "このアイテムを削除しますか？",
  CLEAR_CACHE: "キャッシュをクリアしますか？",
};

// バリデーションメッセージ
const VALIDATION_MESSAGES = {
  REQUIRED: "{fieldName}は必須です",
  MIN_LENGTH:
    "{fieldName}は{minLength}文字以上で入力してください（現在{length}文字）",
  MAX_LENGTH:
    "{fieldName}は{maxLength}文字以下で入力してください（現在{length}文字）",
  FILE_SIZE_TOO_LARGE:
    "ファイルサイズが大きすぎます。{maxSize}MB以下のファイルを選択してください。",
  INVALID_EMAIL: "有効なメールアドレスを入力してください",
  INVALID_URL: "有効なURLを入力してください",
  DEFAULT_FIELD: "フィールド",
};

// Chrome拡張機能メッセージタイプ
const CHROME_MESSAGES = {
  INSERT_PROMPT: "insertPrompt",
  UPDATE_PROMPT_LIST: "UpdatePromptList",
  DOM_GENERATE: "DOM",
  CHECK_SELECTOR: "checkSelector",
};

// サービス検出用URL
const SERVICE_URLS = {
  NOVELAI: "novelai.net",
  SD_LOCAL: "127.0.0.1:7860",
  SD_LOCALHOST: "localhost:7860",
  COMFYUI: "comfyui",
};

// サービス名
const SERVICE_NAMES = {
  NOVELAI: "novelai",
  STABLE_DIFFUSION: "stable_diffusion",
  COMFYUI: "comfyui",
  CUSTOM: "custom",
};

// グローバルにエクスポート
window.ERROR_MESSAGES = ERROR_MESSAGES;
window.SUCCESS_MESSAGES = SUCCESS_MESSAGES;
window.NOTIFICATION_MESSAGES = NOTIFICATION_MESSAGES;
window.FILE_MESSAGES = FILE_MESSAGES;
window.CSV_HEADERS = CSV_HEADERS;
window.UI_LABELS = UI_LABELS;
window.DICTIONARY_TEXTS = DICTIONARY_TEXTS;
window.FLEXIBLE_LIST_HEADERS = FLEXIBLE_LIST_HEADERS;
window.FLEXIBLE_LIST_CONFIGS = FLEXIBLE_LIST_CONFIGS;
window.FLEXIBLE_LIST_TYPES = FLEXIBLE_LIST_TYPES;
window.CATEGORY_CHAIN_CONFIG = CATEGORY_CHAIN_CONFIG;
window.BUTTON_TYPES = BUTTON_TYPES;
window.COLUMN_TYPES = COLUMN_TYPES;
window.MESSAGE_LEVELS = MESSAGE_LEVELS;
window.DICTIONARY_TYPES = DICTIONARY_TYPES;
window.EDIT_MODES = EDIT_MODES;
window.FORMAT_MODES = FORMAT_MODES;
window.SOURCE_TYPES = SOURCE_TYPES;
window.ACTION_TYPES = ACTION_TYPES;
window.CONFIRM_MESSAGES = CONFIRM_MESSAGES;
window.VALIDATION_MESSAGES = VALIDATION_MESSAGES;
window.CHROME_MESSAGES = CHROME_MESSAGES;
window.SERVICE_URLS = SERVICE_URLS;
window.SERVICE_NAMES = SERVICE_NAMES;
