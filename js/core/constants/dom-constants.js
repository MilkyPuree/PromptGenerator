/**
 * dom-constants.js - DOM要素のID、クラス名、セレクターの定数
 *
 * 全てのDOM要素識別子を一元管理
 * HTMLと密接に連携するため、変更時は必ずHTML側も確認すること
 */

// DOM要素ID
const DOM_IDS = {
  // 検索タブ関連
  SEARCH: {
    INPUT: "search",
    BUTTON: "searchButton",
    CATEGORY_BIG: "search-cat0",
    CATEGORY_MIDDLE: "search-cat1",
    CATEGORY_RESET: "search-cat-reset",
    TAB_BODY: "searchTabBody",
    RESULT_AREA: "isSearch",
  },

  // プロンプト入力関連
  PROMPT: {
    INPUT: "promptInput",
    GENERATE: "generatePrompt",
    LIST: "promptList",
  },

  // カテゴリー入力関連
  CATEGORY: {
    BIG: "big",
    MIDDLE: "middle",
    SMALL: "small",
    PROMPT: "prompt",
    CATEGORY: "category",
  },

  // 編集タブ関連
  EDIT: {
    TAB_BODY: "editTabBody",
    LIST: "editList",
    SLOT_MODE: "edit-slot-mode",
    SLOT_WEIGHT: "edit-slot-weight",
    DATA_SOURCE: "edit-data-source",
    CATEGORY_BIG: "edit-category-big",
    CATEGORY_MIDDLE: "edit-category-middle",
    FAVORITES_SELECT: "edit-favorites-select",
    SLOT_MUTE_BTN: "edit-slot-mute-btn",
    SLOT_MUTE_ICON: "edit-slot-mute-icon",
  },

  // 辞書タブ関連
  DICTIONARY: {
    TAB_BODY: "addTabBody",
    ADD_PROMPT_LIST: "addPromptList",
    MASTER_LIST: "masterDicList",
    FAVORITE_LIST: "archiveList",
    PROMPT_CONTAINER: "promptDicContainer",
    ELEMENT_CONTAINER: "elementDicContainer",
    MASTER_CONTAINER: "masterDicContainer",
    // 統計カウント
    FAVORITE_COUNT: "archive-count",
    LOCAL_COUNT: "local-count",
    MASTER_COUNT: "master-count",
    // インポート・エクスポート
    PROMPT_DOWNLOAD: "PromptDownload",
    LOCAL_DIC_DOWNLOAD: "localDicDownload",
    MASTER_DOWNLOAD: "MasterDownload",
    PROMPT_DICT_IMPORT_BTN: "promptDictImportBtn",
    PROMPT_DICT_IMPORT: "promptDictImport",
    LOCAL_DICT_IMPORT_BTN: "localDictImportBtn",
    LOCAL_DICT_IMPORT: "localDictImport",
    // 複数辞書管理
    PROMPT_DICTIONARY_SELECTOR: "promptDictionarySelector",
    ADD_DICTIONARY: "addDictionary",
    MANAGE_DICTIONARIES: "manageDictionaries",
    MANAGEMENT_MODAL: "dictionary-management-modal",
    NEW_DICTIONARY_NAME: "new-dictionary-name",
    // 辞書テキスト
    MASTER_DIC_TEXT: "masterDicText",
    ELEMENT_DIC_TEXT: "elementDicText",
  },

  // スロットタブ関連
  SLOT: {
    TAB_BODY: "slotTabBody",
    TAB: "slotTab",
    CONTAINER: "slot-container",
    ADD_BTN: "add-slot-btn",
    COMBINE_PREVIEW_BTN: "combine-preview-btn",
    CLEAR_ALL_SLOTS_TAB: "clear-all-slots-tab",
    EXPORT_SLOTS: "export-slots",
    IMPORT_SLOTS: "import-slots",
    USED_SLOTS_COUNT: "used-slots-count",
    COMBINE_PREVIEW_MODAL: "combine-preview-modal",
    SELECTOR: "prompt-slot-selector",
    COMBINE_PREVIEW_RESULT: "combine-preview-result",
    COMBINED_CHAR_COUNT: "combined-char-count",
    USED_SLOTS_COUNT_PREVIEW: "used-slots-count-preview",
    INFO_TABLE: "slot-info-table",
    // グループ管理
    GROUP_SELECTOR: "slot-group-selector",
    GROUP_DESCRIPTION: "slot-group-description",
    GROUP_CREATE_BTN: "slot-group-create-btn",
    GROUP_COPY_BTN: "slot-group-copy-btn",
    GROUP_EDIT_BTN: "slot-group-edit-btn",
    GROUP_DELETE_BTN: "slot-group-delete-btn",
    EXPORT_GROUP: "export-group",
    IMPORT_GROUP: "import-group",
    // 抽出データソース関連
    DATA_SOURCE_SELECT: "data-source-select",
    FAVORITES_SELECT: "favorites-select",
  },

  // その他タブ関連
  OTHER: {
    TAB_BODY: "othersTabBody",
    INCLUDED_TEXT: "incluedText",
    PREVIEW: "preview",
    PNG_INFO: "pngInfo",
    DEEPL_AUTH: "DeeplAuth",
    DELETE_CHECK: "isDeleteCheck",
    HISTORY_MAX_SIZE: "historyMaxSize",
    EXPORT_SETTINGS: "exportSettings",
    IMPORT_SETTINGS: "importSettings",
    IMPORT_MERGE_MODE: "importMergeMode",
    // 通知設定
    SHOW_SUCCESS_TOAST: "showSuccessToast",
    SHOW_INFO_TOAST: "showInfoToast",
    SHOW_WARNING_TOAST: "showWarningToast",
    SHOW_ERROR_TOAST: "showErrorToast",
    // 自動生成関連
    AUTO_GENERATE: "autoGenerate",
    AUTO_GENERATE_PROGRESS: "autoGenerateProgress",
    GENERATE_COUNT: "generateCount",
    // API関連
    NOTICE: "notice",
    // サイト設定関連
    ADD_SITE_URL: "add-site-url",
    ADD_SITE_POSITIVE: "add-site-positive",
    ADD_SITE_NAME: "add-site-name",
    ADD_SITE_GENERATE: "add-site-generate",
    ADD_SITE_DELAY: "add-site-delay",
    // セレクター関連
    SELECTOR_SERVICE: "selector-service",
    SELECTOR_CANDIDATES: "selector-candidates",
    // プレビュー関連
    PREVIEW_PROMPT: "preview-prompt",
    PREVIEW_ELEMENT: "preview-element",
    // タブ関連
    ADD_TAB: "addTab",
    EDIT_TAB: "editTab",
    NOTICE_TAB: "noticeTab",
    // 検索関連
    IS_SEARCH: "isSearch",
    // その他
    INCLUDED: "inclued",
    NEGATIVE_PROMPT: "negative-prompt",
    AUTO_GENERATE_OPTION: "autoGenerateOption",
    GENERATE_INTERVAL: "generateInterval",
  },

  // メインボタン関連
  BUTTONS: {
    GENERATE: "GeneratoButton",
    COPY: "copyButton",
    CLEAR: "clearButton",
    SAVE: "saveButton",
    HELP: "helpButton",
    RESET: "resetButton",
    RESIST: "resist",
    SHOW_SETTINGS: "show-settings",
    PREVIEW_POSITIVE_COPY: "preview-positive-copy",
    PREVIEW_NEGATIVE_COPY: "preview-negative-copy",
    CANCEL_EDIT: "cancelEdit",
    ADD_SITE: "addSite",
    CHECK_PROMPT_CONFLICT: "checkPromptConflict",
    CLEAR_SELECTORS: "clearSelectors",
    SAVE_SELECTORS: "saveSelectors",
    COPY_COMBINED: "copy-combined",
    CREATE_DICTIONARY: "create-dictionary",
    CSV_EXPORT: "csvExport",
    TSV_EXPORT: "tsvExport",
    PROMPT_DICT_DOWNLOAD: "promptDictDownload",
    MASTER_DICT_DOWNLOAD: "masterDictDownload",
  },

  // パネル・モーダル関連
  PANELS: {
    SHOW_PANEL: "show-panel",
    OPTION_PANEL: "optionPanel",
    POPUP_IMAGE: "popup-image",
    POPUP: "popup",
    CLOSE_DICTIONARY_MANAGEMENT: "close-dictionary-management",
    CLOSE_HELP: "close-help",
    CLOSE_PREVIEW: "close-preview",
  },

  // モーダル関連（統一管理）
  MODALS: {
    DICTIONARY_MANAGEMENT: "dictionary-management-modal",
    SLOT_GROUP_MANAGEMENT: "slot-group-management-modal",
    GENERATE_HISTORY: "generate-history-modal",
    COMBINE_PREVIEW: "combine-preview-modal",
    // 閉じるボタン
    CLOSE_DICTIONARY_MANAGEMENT: "close-dictionary-management",
    CLOSE_SLOT_GROUP_MANAGEMENT: "close-slot-group-management",
    CLOSE_GENERATE_HISTORY: "close-generate-history",
  },

  // リスト関連
  LISTS: {
    ADD_LIST: "addList",
    DICTIONARY_LIST: "dictionary-list",
    SITE_LIST: "siteList",
  },

  // 共通要素
  COMMON: {
    ERROR_TOAST_CONTAINER: "error-toast-container",
    LOADING_OVERLAY: "loading-overlay",
  },
};

// DOM ID配列（よく使用されるグループ）
const DOM_ID_ARRAYS = {
  // フォーム入力の順番（ナビゲーション用）- getElementById用
  FORM_INPUT_ORDER: [
    DOM_IDS.CATEGORY.BIG,
    DOM_IDS.CATEGORY.MIDDLE,
    DOM_IDS.CATEGORY.SMALL,
    DOM_IDS.CATEGORY.PROMPT,
  ],

  // カテゴリフィールド（大中小項目のみ）- getElementById用
  CATEGORY_FIELDS: [
    DOM_IDS.CATEGORY.BIG,
    DOM_IDS.CATEGORY.MIDDLE,
    DOM_IDS.CATEGORY.SMALL,
  ],

  // 統計カウント要素 - getElementById用
  STATS_COUNTERS: [
    DOM_IDS.DICTIONARY.FAVORITE_COUNT,
    DOM_IDS.DICTIONARY.LOCAL_COUNT,
    DOM_IDS.DICTIONARY.MASTER_COUNT,
  ],

  // セレクター配列（jQueryやquerySelectorAll用）
  SELECTORS: {
    // フォーム入力（セレクター記号付き）
    FORM_INPUTS: ["#big", "#middle", "#small", "#prompt"],
  },
};

// CSSクラス名
const CSS_CLASSES = {
  // ボタン関連
  BUTTON: {
    DISABLED: "button-disabled",
    PRIMARY: "button-primary",
    SECONDARY: "button-secondary",
    DANGER: "button-danger",
  },

  // リスト関連
  LIST: {
    SORTABLE_HANDLE: "ui-sortable-handle",
    HEADER: "prompt-list-header",
    INPUT: "prompt-list-input",
    HEADER_INPUT: "header-input",
    ITEM: "list-item",
    SELECTED: "selected",
    ACTIVE: "active",
    PROMPT_DATA: "promptData",
  },

  // フレキシブルリストカラム
  FLEX_COL: {
    CATEGORY: "flex-col-category",
    PROMPT: "flex-col-prompt",
    WEIGHT: "flex-col-weight",
    BUTTON: "flex-col-button",
  },

  // ドラッグハンドル
  DRAG: {
    HANDLE: "drag-handle",
    HANDLE_SPACER: "drag-handle-spacer",
    DRAGGING: "dragging",
  },

  // 仮想スクロール
  VIRTUAL_SCROLL: {
    VIEWPORT: "virtual-list-viewport",
    CONTAINER: "virtual-list-container",
    ITEM: "virtual-item",
  },

  // エラー・通知関連
  ERROR: {
    MESSAGE: "error-message",
    HIGHLIGHT: "error-highlight",
    TOAST: "error-toast",
  },

  // トースト通知
  TOAST: {
    SUCCESS: "toast-success",
    ERROR: "toast-error",
    INFO: "toast-info",
    WARNING: "toast-warning",
    CONTAINER: "toast-container",
  },

  // 辞書関連
  DICTIONARY: {
    CLICKABLE_HEADER: "dictionary-clickable-header",
    TOGGLE_ICON: "dictionary-toggle-icon",
    SEARCH_RESULTS: "search-results-section",
    STAT_ITEM: "stat-item",
    ITEM: "dictionary-item",
    EXPANDED: "expanded",
  },

  // タブ関連
  TAB: {
    ACTIVE: "active-tab",
    INACTIVE: "inactive-tab",
    CONTENT: "tab-content",
    IS_ACTIVE: "is-active",
    IS_SHOW: "is-show",
  },

  // フォーム関連
  FORM: {
    GROUP: "form-group",
    CONTROL: "form-control",
    LABEL: "form-label",
    INVALID: "invalid",
  },

  // ユーティリティ
  UTIL: {
    HIDDEN: "hidden",
    VISIBLE: "visible",
    DISABLED: "disabled",
    LOADING: "loading",
    HIGHLIGHT: "highlight",
  },

  // スロット抽出関連
  EXTRACTION: {
    DATA_SOURCE_ITEM: "data-source-item", 
    CATEGORY_FILTER_ITEM: "category-filter-item",
    EXTRACTION_CONTROLS: "extraction-controls",
    EXTRACTION_ROW: "extraction-row",
  },
};

// 属性名
const ATTRIBUTES = {
  DATA: {
    ID: "data-id",
    INDEX: "data-index",
    VALUE: "data-value",
    TYPE: "data-type",
    SOURCE: "data-source",
    CATEGORY: "data-category",
  },
  ARIA: {
    LABEL: "aria-label",
    DESCRIBEDBY: "aria-describedby",
    HIDDEN: "aria-hidden",
    EXPANDED: "aria-expanded",
  },
};

// イベント名
const DOM_EVENTS = {
  // マウスイベント
  CLICK: "click",
  DOUBLE_CLICK: "dblclick",
  MOUSE_ENTER: "mouseenter",
  MOUSE_LEAVE: "mouseleave",
  MOUSE_DOWN: "mousedown",
  MOUSE_UP: "mouseup",

  // フォームイベント
  CHANGE: "change",
  INPUT: "input",
  BLUR: "blur",
  FOCUS: "focus",
  SUBMIT: "submit",

  // キーボードイベント
  KEY_PRESS: "keypress",
  KEY_DOWN: "keydown",
  KEY_UP: "keyup",

  // ドラッグイベント
  DRAG_START: "dragstart",
  DRAG_END: "dragend",
  DRAG_OVER: "dragover",
  DRAG_LEAVE: "dragleave",
  DROP: "drop",

  // ウィンドウイベント
  LOAD: "load",
  UNLOAD: "unload",
  RESIZE: "resize",
  SCROLL: "scroll",

  // グローバルイベント
  ERROR: "error",
  UNHANDLED_REJECTION: "unhandledrejection",
  DOM_CONTENT_LOADED: "DOMContentLoaded",
};

// DOM セレクター（jQuery/querySelector用）
const DOM_SELECTORS = {
  // IDセレクター
  BY_ID: {
    BIG: "#big",
    MIDDLE: "#middle",
    SMALL: "#small",
    PROMPT: "#prompt",
    GENERATE_PROMPT: "#generatePrompt",
    PROMPT_LIST: "#promptList",
    EDIT_LIST: "#editList",
    SEARCH: "#search",
    SEARCH_BUTTON: "#searchButton",
    // 検索カテゴリ
    SEARCH_CAT0: "#search-cat0",
    SEARCH_CAT1: "#search-cat1",
    // 辞書関連
    ADD_PROMPT_LIST: "#addPromptList",
    PROMPT_DIC_CONTAINER: "#promptDicContainer",
    PROMPT_DIC_TEXT: "#promptDicText",
    ELEMENT_DIC_CONTAINER: "#elementDicContainer",
    MASTER_DIC_CONTAINER: "#masterDicContainer",
    MASTER_DIC_LIST: "#masterDicList",
    FAVORITE_LIST: "#archiveList",
    MASTER_DIC_TEXT: "#masterDicText",
    ELEMENT_DIC_TEXT: "#elementDicText",
    // スロット関連
    SLOT_CONTAINER: "#slot-container",
    // その他
    INCLUDED_TEXT: "#incluedText",
    POPUP: "#popup",
    POPUP_IMAGE: "#popup-image",
    PREVIEW_PROMPT: "#preview-prompt",
    PREVIEW_ELEMENT: "#preview-element",
    SELECTOR_CANDIDATES: "#selector-candidates",
    // セレクター関連
    SELECTOR_SERVICE: "#selector-service",
    SELECTOR_POSITIVE: "#selector-positive",
    SELECTOR_GENERATE: "#selector-generate",
    // その他設定（main.js、data-manager.jsで使用中）
    DELETE_CHECK: "#isDeleteCheck",
    DEEPL_AUTH: "#DeeplAuth",
    // スロット関連
    SLOT_TAB: "#slotTab",
    SLOT_CONTAINER: "#slot-container",
    SLOT_ADD_BTN: "#add-slot-btn",
    SLOT_PREVIEW_BTN: "#combine-preview-btn",
    SLOT_CLEAR_ALL_BTN: "#clear-all-slots-tab",
    SLOT_USED_COUNT: "#used-slots-count",
    SLOT_PREVIEW_MODAL: "#combine-preview-modal",
    SLOT_PREVIEW_COUNT: "#used-slots-count-preview",
    SLOT_INFO_TABLE: "#slot-info-table",
    SLOT_PREVIEW_RESULT: "#combine-preview-result",
    SLOT_CHAR_COUNT: "#combined-char-count",
    // グループ管理
    SLOT_GROUP_SELECTOR: "#slot-group-selector",
    SLOT_GROUP_DESCRIPTION: "#slot-group-description",
    SLOT_GROUP_CREATE_BTN: "#slot-group-create-btn",
    SLOT_GROUP_COPY_BTN: "#slot-group-copy-btn",
    SLOT_GROUP_EDIT_BTN: "#slot-group-edit-btn",
    SLOT_GROUP_DELETE_BTN: "#slot-group-delete-btn",
    SLOT_EXPORT_GROUP: "#export-group",
    SLOT_IMPORT_GROUP: "#import-group",
    // 辞書関連
    DICTIONARY_FAVORITE_COUNT: "#archive-count",
    DICTIONARY_LOCAL_COUNT: "#local-count",
    DICTIONARY_MASTER_COUNT: "#master-count",
    DICTIONARY_PROMPT_DOWNLOAD: "#PromptDownload",
    DICTIONARY_LOCAL_DOWNLOAD: "#localDicDownload",
    DICTIONARY_MASTER_DOWNLOAD: "#MasterDownload",
    DICTIONARY_PROMPT_DICT_DOWNLOAD: "#promptDictDownload",
    DICTIONARY_LOCAL_JSON_DOWNLOAD: "#localDictJsonDownload",
    DICTIONARY_LOCAL_CSV_DOWNLOAD: "#localDictCsvDownload",
    DICTIONARY_LOCAL_TSV_DOWNLOAD: "#localDictTsvDownload",
    DICTIONARY_PROMPT_CSV_DOWNLOAD: "#promptDictCsvDownload",
    DICTIONARY_PROMPT_TSV_DOWNLOAD: "#promptDictTsvDownload",
    DICTIONARY_MASTER_CSV_DOWNLOAD: "#masterDictCsvDownload",
    DICTIONARY_MASTER_TSV_DOWNLOAD: "#masterDictTsvDownload",
    DICTIONARY_MASTER_DICT_DOWNLOAD: "#masterDictDownload",
    DICTIONARY_PROMPT_IMPORT_BTN: "#promptDictImportBtn",
    DICTIONARY_PROMPT_IMPORT: "#promptDictImport",
    DICTIONARY_LOCAL_IMPORT_BTN: "#localDictImportBtn",
    DICTIONARY_LOCAL_IMPORT: "#localDictImport",
    DICTIONARY_RESIST_BTN: "#resist",
    DICTIONARY_SELECTOR: "#promptDictionarySelector",
    DICTIONARY_ADD_BTN: "#addDictionary",
    DICTIONARY_MANAGE_BTN: "#manageDictionaries",
    DICTIONARY_CLOSE_MANAGEMENT: "#close-dictionary-management",
    DICTIONARY_CREATE_BTN: "#create-dictionary",
    DICTIONARY_LIST: "#dictionary-list",
    DICTIONARY_MANAGEMENT_MODAL: "#dictionary-management-modal",
    DICTIONARY_NEW_NAME: "#new-dictionary-name",
    // モーダル関連（統一セレクター）
    SLOT_GROUP_MANAGEMENT_MODAL: "#slot-group-management-modal",
    GENERATE_HISTORY_MODAL: "#generate-history-modal",
    COMBINE_PREVIEW_MODAL: "#combine-preview-modal",
  },
  // 属性セレクター
  BY_ATTRIBUTE: {
    UI_TYPE_RADIOS: '[name="UIType"]',
    EDIT_TYPE_SELECT: '#EditType',
    INPUT_PASSWORD: 'input[type="password"]',
    INPUT_EMAIL: 'input[type="email"]',
    INPUT_TEL: 'input[type="tel"]',
  },
  // クラスセレクター
  BY_CLASS: {
    VIRTUAL_VIEWPORT: ".virtual-list-viewport",
    PROMPT_LIST_HEADER: ".prompt-list-header",
    DICTIONARY_HEADER: ".dictionary-clickable-header",
    FLEX_COL_WEIGHT: ".flex-col-weight",
    VISUAL_SELECTOR_OVERLAY: ".prompt-generator-visual-selector-overlay",
    // モーダル関連クラス
    MODAL_BASE: ".modal-base",
    MODAL_CONTAINER: ".modal-container",
    MODAL_HEADER: ".modal-header",
    MODAL_CONTENT: ".modal-content",
    MODAL_FOOTER: ".modal-footer",
    MODAL_CLOSE_BTN: ".modal-close-btn",
    // 既存モーダル互換クラス
    DICTIONARY_MANAGEMENT_CONTENT: ".dictionary-management-content",
    SHORTCUT_INFO_SECTION: ".shortcut-info-section",
    GENERATE_HISTORY_CONTENT: ".generate-history-content",
  },
};

// カスタムイベント（将来の実装用）
const CUSTOM_EVENTS = {
  TAB: {
    SHOW: "tab:show",
    HIDE: "tab:hide",
    REFRESH: "tab:refresh",
  },
  LIST: {
    UPDATE: "list:update",
    SORT: "list:sort",
    SELECT: "list:select",
  },
  PROMPT: {
    ADD: "prompt:add",
    UPDATE: "prompt:update",
    DELETE: "prompt:delete",
  },
};

// ============================================
// 辞書関連定数（DOM専用）
// ============================================

// 辞書セレクター定数
const DICTIONARY_SELECTORS = {
  CLICKABLE_HEADER: ".dictionary-clickable-header",
  TOGGLE_ICON: ".dictionary-toggle-icon",
  RESULTS_SECTION: ".search-results-section",
  STAT_ITEM: ".stat-item",
};

// グローバルにエクスポート
window.DOM_IDS = DOM_IDS;
window.DOM_ID_ARRAYS = DOM_ID_ARRAYS;
window.CSS_CLASSES = CSS_CLASSES;
window.ATTRIBUTES = ATTRIBUTES;
window.DOM_EVENTS = DOM_EVENTS;
window.DOM_SELECTORS = DOM_SELECTORS;
window.CUSTOM_EVENTS = CUSTOM_EVENTS;
window.DICTIONARY_SELECTORS = DICTIONARY_SELECTORS;
