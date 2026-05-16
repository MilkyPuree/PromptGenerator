const AppState = {
  config: {
    toolVersion: 14,
    debugMode: false, // デバッグモード：trueの場合のみデバッグログを出力
  },

  data: {
    localPromptList: [],
    searchCategory: {},
    toolInfo: {},
    generateHistory: [], // Generate履歴

    promptDictionaries: {
      main: {
        name: UI_LABELS.MAIN_DICTIONARY,
        prompts: [],
      },
    },
    currentPromptDictionary: "main",
  },

  userSettings: {
    optionData: null,
  },

  ui: {
    currentTab: 0,
    isSearching: false,
    mouseCursorValue: "",
  },

  temp: {
    translateQueue: [],
    searchResults: [],
  },

  selector: {
    positiveSelector: null,
    generateSelector: null,

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
        positiveSelector: "[contenteditable='true'][data-testid='composer-input']",
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

    customSites: {},

    currentService: null,
  },

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
};

window.AppState = AppState;

window.toggleDebugMode = function (enable) {
  if (typeof enable === "boolean") {
    AppState.config.debugMode = enable;
  } else {
    AppState.config.debugMode = !AppState.config.debugMode;
  }
  return AppState.config.debugMode;
};
