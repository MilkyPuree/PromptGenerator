const APIConfig = {
  toolInfoAPI:
    "https://script.google.com/macros/s/AKfycbz620nLVd7jBJBdpZNy-ge13tBZQR_tCq2VIqIJfH3dZFJ6fZlwvXnRmJh5jSXZkXTR/exec",

  timeout: {
    default: NETWORK.TIMEOUT * 3, // 30秒
    translate: 60000, // 翻訳API用：60秒
    toolInfo: 300000, // ツール情報用：5分
  },

  retry: {
    count: NETWORK.RETRY_COUNT,
    delay: NETWORK.RETRY_DELAY,
    backoff: 2, // 指数バックオフ係数
  },
};

async function fetchWithTimeout(url, options = {}, timeout = APIConfig.timeout.default) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function fetchWithRetry(url, options = {}, retries = APIConfig.retry.count) {
  let lastError;

  for (let i = 0; i <= retries; i++) {
    try {
      const timeout = options.timeout || APIConfig.timeout.default;
      const response = await fetchWithTimeout(url, options, timeout);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (i < retries) {
        const delay = APIConfig.retry.delay * Math.pow(APIConfig.retry.backoff, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

async function loadMessage() {
  try {
    const response = await fetchWithTimeout(
      APIConfig.toolInfoAPI,
      { method: "GET", mode: "cors" },
      APIConfig.timeout.toolInfo // 5分タイムアウト
    );

    const json = await response.json();

    const noticeElement = document.getElementById(DOM_IDS.OTHER.NOTICE);
    if (noticeElement) {
      noticeElement.textContent = "";
    }

    jsonLoop(json, (item, index) => {
      processToolInfoItem(item);
    });

    await saveToolInfo();
  } catch (error) {
    ErrorHandler.log("Failed to load tool info", error);
    const noticeElement = document.getElementById(DOM_IDS.OTHER.NOTICE);
    if (noticeElement) {
      noticeElement.textContent = "ツール情報の読み込みに失敗しました";
    }
  }
}

function processToolInfoItem(item) {
  // グローバル変数への参照を維持（互換性のため）
  const optionData = AppState.userSettings.optionData || window.optionData;
  const toolInfo = AppState.data.toolInfo || window.toolInfo;

  switch (item.title) {
    case "latestToolVer":
      if (AppState.config.toolVersion < item.value) {
        const noticeTab = document.getElementById(DOM_IDS.OTHER.NOTICE_TAB);
        if (noticeTab) {
          noticeTab.classList.add("is-alert");
        }
        const noticeElement = document.getElementById(DOM_IDS.OTHER.NOTICE);
        if (noticeElement) {
          noticeElement.innerHTML =
            "最新のバージョンがあります</br><a href ='https://milkypuree.github.io/PromptGeneratorPage/index.html' target='_blank'>サイトにて最新のものが取得できます。</r>アップデートの項目にてやり方をご確認ください。</a>";
        }
      }
      break;

    case "isAlert":
      if (item.value) {
        const noticeTab = document.getElementById(DOM_IDS.OTHER.NOTICE_TAB);
        if (noticeTab) {
          noticeTab.classList.add("is-alert");
        }
      }
      break;

    case "notice":
      const noticeElement = document.getElementById(DOM_IDS.OTHER.NOTICE);
      if (noticeElement) {
        noticeElement.textContent = item.value;
      }
      break;

    case "latestDicUrl":
      masterDicDownload(item.value);
      break;

    case "novelAIpositivePromptText":
      // ユーザー設定を優先するため、外部APIによるセレクター上書きを無効化
      break;

    case "novelAIgenerateButton":
      // ユーザー設定を優先するため、外部APIによるセレクター上書きを無効化
      break;
  }

  toolInfo[item.title] = item.value;
  if (AppState.data.toolInfo) {
    AppState.data.toolInfo[item.title] = item.value;
  }
}

function SearchLogAPI(search) {
  if (!search) return;

  const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
  if (!toolInfo.searchAPI) {
    return;
  }

  const url = `${toolInfo.searchAPI}?search=${encodeURI(search)}`;

  fetch(url, { method: "GET", mode: "cors" }).catch(() => {});
}

function RegistAPI(big, middle, small, prompt) {
  const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
  if (!toolInfo.registAPI) {
    return;
  }

  const params = new URLSearchParams({
    big: big || "",
    middle: middle || "",
    small: small || "",
    prompt: prompt || "",
  });

  const url = `${toolInfo.registAPI}?${params.toString()}`;

  fetch(url, { method: "GET", mode: "cors" }).catch(() => {});
}

async function translateGoogle(keyword, translateEvent) {
  if (!keyword) {
    translateEvent && translateEvent("");
    return;
  }

  try {
    const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
    if (!toolInfo.translateAPI) {
      throw new Error("Translation API URL not available");
    }

    const url = `${toolInfo.translateAPI}?search=${encodeURIComponent(keyword)}`;
    const response = await fetchWithRetry(
      url,
      { method: "GET", mode: "cors", timeout: APIConfig.timeout.translate },
      2 // 翻訳は2回までリトライ
    );

    const json = await response.json();
    translateEvent && translateEvent(json);
  } catch (error) {
    ErrorHandler.log("Google translation failed", error);
    translateEvent && translateEvent(keyword);
  }
}

async function translateDeepl(keyword, translateEvent) {
  if (!keyword) {
    translateEvent && translateEvent("");
    return;
  }

  try {
    const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
    const optionData = AppState.userSettings.optionData || window.optionData || {};

    if (!toolInfo.translateDeeplAPI) {
      throw new Error("DeepL API URL not available");
    }

    const apiKey = optionData.deeplAuth || optionData.deeplAuthKey;
    if (!apiKey) {
      throw new Error("DeepL API key not configured");
    }

    const params = new URLSearchParams({
      search: keyword,
      authKey: apiKey,
    });

    const url = `${toolInfo.translateDeeplAPI}?${params.toString()}`;
    const response = await fetchWithRetry(
      url,
      { method: "GET", mode: "cors", timeout: APIConfig.timeout.translate },
      2 // 翻訳は2回までリトライ
    );

    const json = await response.json();
    translateEvent && translateEvent(json);
  } catch (error) {
    ErrorHandler.log("DeepL translation failed", error);
    translateGoogle(keyword, translateEvent);
  }
}

function masterDicDownload(jsonURL) {
  try {
    // マスターデータは常に最新のdefaultMasterから直接読み込まれるため、
    const masterPrompts = getMasterPrompts();

    if (masterPrompts.length === 0) {
      return;
    }

    if (typeof categoryData !== "undefined" && categoryData.update) {
      categoryData.update();
    }

    if (AppState.userSettings.optionData) {
      AppState.userSettings.optionData.masterUrl = jsonURL;
      if (typeof saveOptionData === "function") {
        saveOptionData();
      }
    }
  } catch (error) {}
}

async function batchTranslate(keywords, service = "google") {
  const results = {};
  const batchSize = 5; // 一度に処理する数

  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);

    const promises = batch.map(async (keyword) => {
      return new Promise((resolve) => {
        const translateFunc = service === "deepl" ? translateDeepl : translateGoogle;
        translateFunc(keyword, (translation) => {
          results[keyword] = translation;
          resolve();
        });
      });
    });

    await Promise.all(promises);

    // レート制限対策
    if (i + batchSize < keywords.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

if (typeof window !== "undefined") {
  window.loadMessage = loadMessage;
  window.SearchLogAPI = SearchLogAPI;
  window.RegistAPI = RegistAPI;
  window.translateGoogle = translateGoogle;
  window.translateDeepl = translateDeepl;
  window.masterDicDownload = masterDicDownload;
  window.batchTranslate = batchTranslate;
}
