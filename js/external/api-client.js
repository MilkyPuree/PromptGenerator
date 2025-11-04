// ============================================
// API設定
// ============================================
const APIConfig = {
  // ツール情報API
  toolInfoAPI:
    "https://script.google.com/macros/s/AKfycbz620nLVd7jBJBdpZNy-ge13tBZQR_tCq2VIqIJfH3dZFJ6fZlwvXnRmJh5jSXZkXTR/exec",

  // タイムアウト設定
  timeout: {
    default: NETWORK.TIMEOUT * 3, // 30秒
    translate: 60000, // 翻訳API用：60秒
    toolInfo: 300000, // ツール情報用：5分
  },

  // リトライ設定
  retry: {
    count: NETWORK.RETRY_COUNT,
    delay: NETWORK.RETRY_DELAY,
    backoff: 2, // 指数バックオフ係数
  },
};

// ============================================
// ユーティリティ関数
// ============================================

/**
 * タイムアウト付きfetch
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @param {number} timeout - タイムアウト時間（ミリ秒）
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(
  url,
  options = {},
  timeout = APIConfig.timeout.default
) {
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

/**
 * リトライ付きfetch
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @param {number} retries - リトライ回数
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(
  url,
  options = {},
  retries = APIConfig.retry.count
) {
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
        const delay =
          APIConfig.retry.delay * Math.pow(APIConfig.retry.backoff, i);
        console.log(`Retry ${i + 1}/${retries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================
// メイン関数（互換性を維持しながら改善）
// ============================================

/**
 * ツール情報を読み込み（jQuery削除版）
 */
async function loadMessage() {
  try {
    const response = await fetchWithTimeout(
      APIConfig.toolInfoAPI,
      { method: "GET", mode: "cors" },
      APIConfig.timeout.toolInfo // 5分タイムアウト
    );

    const json = await response.json();

    // UIをリセット（Vanilla JS）
    const noticeElement = document.getElementById(DOM_IDS.OTHER.NOTICE);
    if (noticeElement) {
      noticeElement.textContent = "";
    }

    // 元のコードと同じ処理を維持（jsonLoopも使用）
    jsonLoop(json, (item, index) => {
      processToolInfoItem(item);
    });

    // 保存
    await saveToolInfo();
  } catch (error) {
    ErrorHandler.log("Failed to load tool info", error);
    const noticeElement = document.getElementById(DOM_IDS.OTHER.NOTICE);
    if (noticeElement) {
      noticeElement.textContent = "ツール情報の読み込みに失敗しました";
    }
  }
}

/**
 * ツール情報の各項目を処理（jQuery削除版）
 */
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
      console.log(
        "[AUTO-GENERATE-DEBUG] Ignored external selector override for positiveSelector:",
        item.value
      );
      break;

    case "novelAIgenerateButton":
      // ユーザー設定を優先するため、外部APIによるセレクター上書きを無効化
      console.log(
        "[AUTO-GENERATE-DEBUG] Ignored external selector override for generateSelector:",
        item.value
      );
      break;
  }

  // ツール情報を更新（グローバル変数とAppState両方を更新）
  toolInfo[item.title] = item.value;
  if (AppState.data.toolInfo) {
    AppState.data.toolInfo[item.title] = item.value;
  }
}

/**
 * 検索ログをAPIに送信（Fire-and-forget版）
 * @param {string} search - 検索キーワード
 */
function SearchLogAPI(search) {
  if (!search) return;

  const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
  if (!toolInfo.searchAPI) {
    console.warn("Search API URL not available");
    return;
  }

  // 元のコードと同じencodeURIを使用
  const url = `${toolInfo.searchAPI}?search=${encodeURI(search)}`;

  // Fire-and-forgetで送信（元のコードと同じ動作）
  fetch(url, { method: "GET", mode: "cors" })
    .then(() => console.log("Search logged:", search))
    .catch((error) => console.log("Search log failed:", error.message));
}

/**
 * 要素登録をAPIに送信（Fire-and-forget版）
 * @param {string} big - 大カテゴリー
 * @param {string} middle - 中カテゴリー
 * @param {string} small - 小カテゴリー
 * @param {string} prompt - プロンプト
 */
function RegistAPI(big, middle, small, prompt) {
  const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
  if (!toolInfo.registAPI) {
    console.warn("Registration API URL not available");
    return;
  }

  const params = new URLSearchParams({
    big: big || "",
    middle: middle || "",
    small: small || "",
    prompt: prompt || "",
  });

  const url = `${toolInfo.registAPI}?${params.toString()}`;

  // Fire-and-forgetで送信（元のコードと同じ動作）
  fetch(url, { method: "GET", mode: "cors" })
    .then(() => console.log("Element registered:", prompt))
    .catch((error) => console.log("Registration failed:", error.message));
}

/**
 * Google翻訳API（改善版）
 * @param {string} keyword - 翻訳するキーワード
 * @param {Function} translateEvent - コールバック関数
 */
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

    const url = `${toolInfo.translateAPI}?search=${encodeURIComponent(
      keyword
    )}`;
    const response = await fetchWithRetry(
      url,
      { method: "GET", mode: "cors", timeout: APIConfig.timeout.translate },
      2 // 翻訳は2回までリトライ
    );

    const json = await response.json();
    translateEvent && translateEvent(json);
  } catch (error) {
    ErrorHandler.log("Google translation failed", error);
    // エラー時は元のキーワードを返す
    translateEvent && translateEvent(keyword);
  }
}

/**
 * DeepL翻訳API（改善版）
 * @param {string} keyword - 翻訳するキーワード
 * @param {Function} translateEvent - コールバック関数
 */
async function translateDeepl(keyword, translateEvent) {
  if (!keyword) {
    translateEvent && translateEvent("");
    return;
  }

  try {
    const toolInfo = AppState.data.toolInfo || window.toolInfo || {};
    const optionData =
      AppState.userSettings.optionData || window.optionData || {};

    if (!toolInfo.translateDeeplAPI) {
      throw new Error("DeepL API URL not available");
    }

    // deeplAuth と deeplAuthKey の両方をサポート（互換性のため）
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
    // エラー時はGoogle翻訳にフォールバック
    console.log("Falling back to Google Translate...");
    translateGoogle(keyword, translateEvent);
  }
}

/**
 * マスター辞書ダウンロード（互換性維持版）
 * @param {string} jsonURL - ダウンロードURL
 */
function masterDicDownload(jsonURL) {
  try {
    // マスターデータは常に最新のdefaultMasterから直接読み込まれるため、
    // バージョンチェックは不要
    const masterPrompts = getMasterPrompts();
    console.log(`Master data available: ${masterPrompts.length} items`);

    // マスターデータが利用できない場合は処理をスキップ
    if (masterPrompts.length === 0) {
      console.warn("Master data not available, skipping masterDicDownload");
      return;
    }

    // カテゴリデータのみ更新
    if (typeof categoryData !== "undefined" && categoryData.update) {
      categoryData.update();
    }

    // オプションデータの更新
    if (AppState.userSettings.optionData) {
      AppState.userSettings.optionData.masterUrl = jsonURL;
      if (typeof saveOptionData === "function") {
        saveOptionData();
      }
    }
  } catch (error) {
    console.warn("Error in masterDicDownload:", error);
  }
}

// ============================================
// バッチ翻訳処理（新機能）
// ============================================

/**
 * 複数のキーワードをバッチで翻訳
 * @param {string[]} keywords - キーワードの配列
 * @param {string} service - 翻訳サービス（"google" or "deepl"）
 * @returns {Promise<Object>} キーワードと翻訳結果のマップ
 */
async function batchTranslate(keywords, service = "google") {
  const results = {};
  const batchSize = 5; // 一度に処理する数

  // バッチに分割
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);

    // 並列処理
    const promises = batch.map(async (keyword) => {
      return new Promise((resolve) => {
        const translateFunc =
          service === "deepl" ? translateDeepl : translateGoogle;
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

// ============================================
// デバッグユーティリティ
// ============================================

const APIDebug = {
  /**
   * API設定を表示
   */
  showConfig() {
    console.group("API Configuration");
    console.log("Tool Info:", AppState.data.toolInfo || window.toolInfo);
    console.log("API Config:", APIConfig);
    console.groupEnd();
  },

  /**
   * APIテスト
   */
  async testAPIs() {
    console.group("API Tests");

    try {
      console.log("Testing Tool Info API...");
      await loadMessage();
      console.log("✅ Tool Info API: OK");
    } catch (error) {
      console.log("❌ Tool Info API:", error.message);
    }

    try {
      console.log("Testing Google Translate...");
      await new Promise((resolve) => {
        translateGoogle("test", (result) => {
          console.log("✅ Google Translate:", result);
          resolve();
        });
      });
    } catch (error) {
      console.log("❌ Google Translate:", error.message);
    }

    console.groupEnd();
  },
};

// ============================================
// グローバル公開（互換性のため必須）
// ============================================
if (typeof window !== "undefined") {
  // 関数をグローバルに公開
  window.loadMessage = loadMessage;
  window.SearchLogAPI = SearchLogAPI;
  window.RegistAPI = RegistAPI;
  window.translateGoogle = translateGoogle;
  window.translateDeepl = translateDeepl;
  window.masterDicDownload = masterDicDownload;
  window.batchTranslate = batchTranslate;
  window.APIDebug = APIDebug;
}
