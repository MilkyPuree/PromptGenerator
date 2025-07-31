/**
 * アプリケーション全体の状態を管理する名前空間
 * グローバル変数を一元管理し、モジュール間で共有
 */
const AppState = {
  // アプリケーション設定
  config: {
    toolVersion: 11,
    debugMode: false, // デバッグモード：trueの場合のみデバッグログを出力
  },

  // データ
  data: {
    localPromptList: [],
    searchCategory: {},
    toolInfo: {},
    generateHistory: [], // Generate履歴

    // 複数お気に入りリストシステム
    promptDictionaries: {
      main: {
        name: UI_LABELS.MAIN_DICTIONARY,
        prompts: [],
      },
    },
    currentPromptDictionary: "main",
  },

  // ユーザー設定
  userSettings: {
    optionData: null,
  },

  // UI状態
  ui: {
    currentTab: 0,
    isSearching: false,
    mouseCursorValue: "",
  },

  // 一時的なデータ
  temp: {
    translateQueue: [],
    searchResults: [],
  },

  selector: {
    positiveSelector: null,
    generateSelector: null,

    // サービスごとのセレクターセット（組み込み）
    serviceSets: {
      novelai: {
        name: "NovelAI",
        url: "https://novelai.net/image",
        positiveSelector:
          "#__next > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(3) > div > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > div > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div > p",
        generateSelector:
          "#__next > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(3) > div > div:nth-of-type(1) > div:nth-of-type(5) > button",
        inputDelay: 0,
        isBuiltIn: true,
      },
      stable_diffusion: {
        name: "Stable Diffusion WebUI",
        url: "http://127.0.0.1:7860/",
        positiveSelector: "#txt2img_prompt textarea",
        generateSelector: "#txt2img_generate",
        inputDelay: 0,
        isBuiltIn: true,
      },
      comfyui: {
        name: "ComfyUI",
        url: "http://127.0.0.1:8188/",
        positiveSelector: "textarea.comfy-multiline-input",
        generateSelector: "#button.execute-button",
        inputDelay: 0,
        isBuiltIn: true,
      },
      chatgpt: {
        name: "ChatGPT",
        url: "https://chatgpt.com",
        positiveSelector: "#prompt-textarea",
        generateSelector: "[data-testid='send-button']",
        inputDelay: 1000,
        isBuiltIn: true,
      },
      claude: {
        name: "Claude (Anthropic)",
        url: "https://claude.ai",
        positiveSelector:
          "[contenteditable='true'][data-testid='composer-input']",
        generateSelector: "[aria-label='Send Message']",
        inputDelay: 1500,
        isBuiltIn: true,
      },
      custom: {
        name: "custom",
        url: "",
        positiveSelector: null,
        generateSelector: null,
        inputDelay: 0,
        isBuiltIn: true,
      },
    },

    // カスタムサイト（ユーザーが追加したサイト）
    customSites: {},

    // 現在のサービス
    currentService: null,
  },

  /**
   * 状態を初期化
   */
  reset() {
    this.data.localPromptList = [];
    this.data.searchCategory = {};
    this.data.toolInfo = {};
    this.data.promptDictionaries = {
      main: {
        name: UI_LABELS.MAIN_DICTIONARY,
        prompts: [],
      },
    };
    this.data.currentPromptDictionary = "main";
    this.userSettings.optionData = null;
    this.ui.currentTab = 0;
    this.ui.isSearching = false;
    this.selector.positiveSelector = "";
    this.selector.generateSelector = "";
    this.selector.customSites = {};
  },

  /**
   * デバッグ用：現在の状態をコンソールに出力
   */
  debug() {
    console.log("AppState:", {
      config: this.config,
      data: this.data,
      userSettings: this.userSettings,
      ui: this.ui,
    });
  },
};

// グローバルスコープでアクセス可能にする（移行期間中）
window.AppState = AppState;

// 開発者向けデバッグモード切り替え関数
window.toggleDebugMode = function (enable) {
  if (typeof enable === "boolean") {
    AppState.config.debugMode = enable;
  } else {
    AppState.config.debugMode = !AppState.config.debugMode;
  }
  console.log(
    `🐛 Debug mode: ${AppState.config.debugMode ? "ENABLED" : "DISABLED"}`
  );
  return AppState.config.debugMode;
};
