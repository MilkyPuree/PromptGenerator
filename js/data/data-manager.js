/**
 * data-manager.js - データ管理モジュール
 * Chrome Storageを使用したデータの永続化と管理
 */

// ============================================
// ローカルプロンプトリスト用ID管理
// ============================================

// ローカルプロンプトリスト用の永続的IDカウンター
let localPromptIdCounter = 1;

/**
 * ローカルプロンプトリストのIDを管理し、重複を防ぐ
 */
function ensureLocalPromptIds() {
  const debugId = `ENSURE_IDS_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  console.log(`[${debugId}] ===== ENSURE LOCAL PROMPT IDS START =====`);

  if (
    !AppState.data.localPromptList ||
    !Array.isArray(AppState.data.localPromptList)
  ) {
    console.log(
      `[${debugId}] No localPromptList found, skipping ID assignment`
    );
    return;
  }

  let reassignmentCount = 0;
  let maxId = 0;

  // 既存のIDを確認し、最大値を取得
  AppState.data.localPromptList.forEach((item) => {
    if (item && typeof item.id === "number") {
      maxId = Math.max(maxId, item.id);
    }
  });

  // カウンターを適切な値に設定
  localPromptIdCounter = Math.max(localPromptIdCounter, maxId + 1);

  // ID不足の要素に新しいIDを付与
  AppState.data.localPromptList.forEach((item, index) => {
    if (!item) {
      console.warn(`[${debugId}] Null item at index ${index}, skipping`);
      return;
    }

    if (typeof item.id !== "number" || item.id <= 0) {
      const oldId = item.id;
      item.id = localPromptIdCounter++;
      reassignmentCount++;
      console.log(
        `[${debugId}] Assigned new ID ${item.id} to item at index ${index} (old ID: ${oldId})`
      );
    }
  });

  console.log(
    `[${debugId}] ID reassignment completed. Items processed: ${AppState.data.localPromptList.length}, Reassigned: ${reassignmentCount}, Next ID: ${localPromptIdCounter}`
  );
  console.log(`[${debugId}] ===== ENSURE LOCAL PROMPT IDS END =====`);
}

// ============================================
// マスターデータ変換関数
// ============================================

/**
 * defaultMaster.dataを既存のフォーマットに変換
 * @returns {Array} 変換されたマスタープロンプト配列
 */
function getMasterPrompts() {
  // window.defaultMasterDataが自動的に設定される
  if (typeof window.defaultMasterData === "undefined") {
    // defaultMasterが存在する場合は、そこからデータを取得
    if (
      typeof window.defaultMaster !== "undefined" &&
      window.defaultMaster &&
      window.defaultMaster.data
    ) {
      window.defaultMasterData = window.defaultMaster.data;
      return window.defaultMasterData;
    }

    // 完全にデータが利用できない場合（背景スクリプトなど）
    console.warn("defaultMasterData not available, returning empty array");
    return [];
  }

  return window.defaultMasterData;
}

// ============================================
// content script注入関数
// ============================================

/**
 * content scriptを注入する関数
 */
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [JS_FILES.CONTENT],
    });
    console.log("Content script injected successfully");
    return true;
  } catch (error) {
    console.log("Content script injection failed:", error.message);
    return false;
  }
}

// ============================================
// プロンプト管理
// ============================================

/**
 * 現在のプロンプトを保存
 */
async function savePrompt() {
  try {
    const prompt = editPrompt.prompt;
    await Storage.set({ [STORAGE_KEYS.PROMPT.GENERATE]: prompt });
    await promptSlotManager.saveCurrentSlot();
  } catch (error) {
    console.error("Failed to save prompt:", error);
    throw error;
  }
}

/**
 * プロンプトを読み込み
 */
async function loadPrompt() {
  try {
    const result = await Storage.get(STORAGE_KEYS.PROMPT.GENERATE);
    if (result[STORAGE_KEYS.PROMPT.GENERATE] != null) {
      editPrompt.init(result[STORAGE_KEYS.PROMPT.GENERATE]);
      UpdateGenaretePrompt();
    }
  } catch (error) {
    console.error("Failed to load prompt:", error);
  }
}

// ============================================
// カテゴリー管理
// ============================================

/**
 * カテゴリーデータを保存
 */
async function saveCategory() {
  try {
    await Storage.set({
      [STORAGE_KEYS.CATEGORY.DATA]: AppState.data.searchCategory,
    });
  } catch (error) {
    console.error("Failed to save category:", error);
    throw error;
  }
}

/**
 * カテゴリーデータを読み込み
 */
async function loadCategory() {
  try {
    const result = await Storage.get("searchCategory");
    if (result.searchCategory != null) {
      AppState.data.searchCategory = result.searchCategory;
      setSearchCategory();
    }
  } catch (error) {
    console.error("Failed to load category:", error);
  }
}

// ============================================
// セレクター管理
// ============================================

/**
 * セレクター情報を保存
 */
async function saveSelectors() {
  try {
    // グローバルなセレクターと、各サービスの設定を保存
    await Storage.set({
      positiveSelector: AppState.selector.positiveSelector,
      generateSelector: AppState.selector.generateSelector,
      // 組み込みサービスの設定も保存
      serviceSets: AppState.selector.serviceSets,
    });
  } catch (error) {
    console.error("Failed to save selectors:", error);
    throw error;
  }
}

/**
 * セレクター情報を読み込み
 */
async function loadSelectors() {
  try {
    const result = await Storage.get([
      "positiveSelector",
      "generateSelector",
      "serviceSets",
    ]);

    if (result.positiveSelector) {
      AppState.selector.positiveSelector = result.positiveSelector;
    }
    if (result.generateSelector) {
      AppState.selector.generateSelector = result.generateSelector;
    }

    // 組み込みサービスの保存された設定を復元
    if (result.serviceSets) {
      // 保存された値で既存の設定を更新（初期値を上書き）
      Object.keys(result.serviceSets).forEach((key) => {
        if (AppState.selector.serviceSets[key]) {
          AppState.selector.serviceSets[key] = {
            ...AppState.selector.serviceSets[key],
            ...result.serviceSets[key],
          };
        }
      });
    } else {
      // 初回の場合、現在のAppStateのserviceSetsを保存
      try {
        await Storage.set({
          serviceSets: AppState.selector.serviceSets,
        });
      } catch (error) {
        console.error("Failed to save initial serviceSets:", error);
      }
    }

    // 読み込み後の検証（全モードで実行）
    validateAndActivateGenerateButton();
  } catch (error) {
    console.error("Failed to load selectors:", error);
  }
}

/**
 * プロンプトセレクターを読み込み（content script注入機能付き）
 */
async function loadPromptSelector() {
  try {
    const result = await Storage.get("positivePromptText");
    if (result.positivePromptText) {
      const selector = result.positivePromptText;

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) return;

      // content scriptを注入してから通信
      await injectContentScript(tab.id);

      setTimeout(async () => {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "checkSelector",
            selector,
          });
          console.log("応答：", response);
        } catch (error) {
          console.log("Selector check failed:", error.message);
          // エラーでも値は保持
          AppState.selector.positiveSelector = result.positiveSelector;
        }
      }, 100);
    }
  } catch (error) {
    console.error("Failed to load prompt selector:", error);
  }
}

/**
 * Generateボタンセレクターを読み込み（content script注入機能付き）
 */
async function loadGenerateButtonSelector() {
  try {
    const result = await Storage.get("generateButton");
    if (result.generateButton) {
      const selector = result.generateButton;

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) return;

      // content scriptを注入してから通信
      await injectContentScript(tab.id);

      setTimeout(async () => {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "checkSelector",
            selector,
          });
          console.log("応答：", response);
        } catch (error) {
          console.log("Selector check failed:", error.message);
          AppState.selector.generateSelector = result.generateSelector;
        }
      }, 100);
    }
  } catch (error) {
    console.error("Failed to load generate button selector:", error);
  }
}

/**
 * セレクターを検証してGenerateボタンを有効化
 */
function validateAndActivateGenerateButton() {
  const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);

  if (generateButton) {
    const hasSelectors =
      AppState.selector.positiveSelector && AppState.selector.generateSelector;

    // セレクターが両方設定されているか、または SD モードの場合は表示
    const currentURL = window.location.href;
    const optionData = AppState.userSettings.optionData;
    const isSDMode =
      (optionData && optionData.shaping === "SD") ||
      currentURL === "http://127.0.0.1:7860/";

    // 常にボタンを表示（バリデーション失敗時はトーストで警告）
    if (hasSelectors || isSDMode) {
      generateButton.style.display = "block";
      generateButton.style.opacity = "1";
      generateButton.title = "";
    } else {
      generateButton.style.display = "block";
      generateButton.style.opacity = "1";
      generateButton.title =
        "セレクター設定を確認してください。その他タブでプロンプト入力欄とGenerateボタンのセレクターを設定する必要があります。";
    }
  }
}

// ============================================
// ツール情報管理
// ============================================

/**
 * ツール情報を保存
 */
async function saveToolInfo() {
  try {
    await Storage.set({ toolInfo: AppState.data.toolInfo });
  } catch (error) {
    console.error("Failed to save tool info:", error);
    throw error;
  }
}

/**
 * ツール情報を読み込みし、メッセージをロード
 */
async function loadToolInfo() {
  try {
    const result = await Storage.get("toolInfo");
    if (result.toolInfo) {
      AppState.data.toolInfo = result.toolInfo;
    }
    loadMessage(); // API通信を開始
  } catch (error) {
    console.error("Failed to load tool info:", error);
  }
}

// ============================================
// ローカルリスト管理
// ============================================

/**
 * ローカルプロンプトリストを保存し、カテゴリーを更新
 */
async function saveLocalList(updateCategories = true) {
  const saveOperationId = `SAVE_LOCAL_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  console.log(`[💾 ${saveOperationId}] ===== SAVE LOCAL LIST START =====`);
  console.log(`[💾 ${saveOperationId}] updateCategories: ${updateCategories}`);
  console.log(
    `[💾 ${saveOperationId}] localPromptList length: ${AppState.data.localPromptList.length}`
  );
  console.log(
    `[💾 ${saveOperationId}] localPromptList contents:`,
    AppState.data.localPromptList.map((item, idx) => ({
      index: idx,
      id: item?.id,
      sort: item?.sort,
      data: item?.data,
      prompt: item?.prompt?.substring(0, 20) + "...",
    }))
  );

  try {
    const saveStart = Date.now();
    await Storage.set({ localPromptList: AppState.data.localPromptList });
    console.log(
      `[💾 ${saveOperationId}] ✅ Storage.set completed (${
        Date.now() - saveStart
      }ms)`
    );

    if (updateCategories) {
      console.log(
        `[💾 ${saveOperationId}] Executing immediateCategoryUpdate...`
      );
      const categoryStart = Date.now();
      immediateCategoryUpdate();
      console.log(
        `[💾 ${saveOperationId}] ✅ immediateCategoryUpdate completed (${
          Date.now() - categoryStart
        }ms)`
      );
    } else {
      console.log(`[💾 ${saveOperationId}] Skipping category update`);
    }

    console.log(`[💾 ${saveOperationId}] ===== SAVE LOCAL LIST END =====`);
  } catch (error) {
    console.error(
      `[💾 ${saveOperationId}] ❌ Failed to save local list:`,
      error
    );
    throw error;
  }
}

/**
 * ローカルプロンプトリストを読み込み
 */
async function loadLocalList() {
  const loadOperationId = `LOAD_LOCAL_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  console.log(`[📥 ${loadOperationId}] ===== LOAD LOCAL LIST START =====`);

  try {
    const loadStart = Date.now();
    const result = await Storage.get("localPromptList");
    console.log(
      `[📥 ${loadOperationId}] Storage.get completed (${
        Date.now() - loadStart
      }ms)`
    );
    console.log(
      `[📥 ${loadOperationId}] Raw data from storage:`,
      result.localPromptList?.length || 0,
      "items"
    );

    if (result.localPromptList) {
      console.log(
        `[📥 ${loadOperationId}] Processing ${result.localPromptList.length} items...`
      );
      let cleanedCount = 0;

      // アイテムにIDを付与し、同時にデータクリーニングを実行
      AppState.data.localPromptList = result.localPromptList.map(
        (item, index) => {
          const cleanedItem = { ...item };

          // 全フィールドの型チェック
          const fieldTypes = {
            prompt: typeof item.prompt,
            data: typeof item.data,
            id: typeof item.id,
            sort: typeof item.sort,
          };

          // dataが配列の場合、各要素の型もチェック
          if (Array.isArray(item.data)) {
            fieldTypes.data = "array";
            fieldTypes.dataBig = typeof item.data[0];
            fieldTypes.dataMiddle = typeof item.data[1];
            fieldTypes.dataSmall = typeof item.data[2];
          }

          // 非文字列フィールドを検出
          const nonStringFields = [];
          if (item.prompt && typeof item.prompt !== "string")
            nonStringFields.push("prompt");
          if (item.data && Array.isArray(item.data)) {
            if (item.data[0] != null && typeof item.data[0] !== "string")
              nonStringFields.push("data[0](大項目)");
            if (item.data[1] != null && typeof item.data[1] !== "string")
              nonStringFields.push("data[1](中項目)");
            if (item.data[2] != null && typeof item.data[2] !== "string")
              nonStringFields.push("data[2](小項目)");
          }

          if (nonStringFields.length > 0) {
            console.warn(
              `[LOCAL_LOAD] Index ${index} - Non-string fields detected: ${nonStringFields.join(
                ", "
              )}`,
              {
                fieldTypes: fieldTypes,
                nonStringFields: nonStringFields,
                promptValue: item.prompt,
                dataValues: item.data,
                fullItem: item,
              }
            );
          }

          // promptフィールドのデータクリーニング
          if (item.prompt && typeof item.prompt !== "string") {
            // オブジェクト型のpromptを文字列に変換
            if (typeof item.prompt === "object" && item.prompt !== null) {
              if (item.prompt.text) {
                cleanedItem.prompt = String(item.prompt.text);
              } else if (item.prompt.value) {
                cleanedItem.prompt = String(item.prompt.value);
              } else if (
                item.prompt.toString &&
                typeof item.prompt.toString === "function"
              ) {
                cleanedItem.prompt = item.prompt.toString();
              } else {
                cleanedItem.prompt = String(item.prompt);
              }
            } else {
              cleanedItem.prompt = String(item.prompt || "");
            }

            console.log(
              `[LOCAL_LOAD] Cleaned prompt at index ${index}: "${cleanedItem.prompt}"`
            );
            cleanedCount++;
          }

          // data配列（大中小項目）のクリーニング
          if (item.data && Array.isArray(item.data)) {
            let dataCleanedCount = 0;
            cleanedItem.data = item.data.map((dataItem, dataIndex) => {
              if (dataItem != null && typeof dataItem !== "string") {
                dataCleanedCount++;
                const categoryName = ["大項目", "中項目", "小項目"][dataIndex];

                let cleanedDataItem = "";
                if (Array.isArray(dataItem)) {
                  // 配列の場合、最初の要素を文字列として取得
                  cleanedDataItem = String(dataItem[0] || "");
                  console.log(
                    `[LOCAL_LOAD] Cleaned ${categoryName} array at index ${index}: [${dataItem.join(
                      ", "
                    )}] -> "${cleanedDataItem}"`
                  );
                } else if (typeof dataItem === "object" && dataItem !== null) {
                  if (dataItem.text) {
                    cleanedDataItem = String(dataItem.text);
                  } else if (dataItem.value) {
                    cleanedDataItem = String(dataItem.value);
                  } else if (
                    dataItem.toString &&
                    typeof dataItem.toString === "function"
                  ) {
                    cleanedDataItem = dataItem.toString();
                  } else {
                    cleanedDataItem = String(dataItem);
                  }
                  console.log(
                    `[LOCAL_LOAD] Cleaned ${categoryName} object at index ${index}: "${cleanedDataItem}"`
                  );
                } else {
                  cleanedDataItem = String(dataItem || "");
                  console.log(
                    `[LOCAL_LOAD] Cleaned ${categoryName} primitive at index ${index}: "${cleanedDataItem}"`
                  );
                }

                return cleanedDataItem;
              }
              return dataItem;
            });

            if (dataCleanedCount > 0) {
              cleanedCount++;
            }
          }

          // 永続的な数値IDを付与（編集タブと同様）
          if (typeof item.id === "number" && item.id > 0) {
            cleanedItem.id = item.id;
            localPromptIdCounter = Math.max(localPromptIdCounter, item.id + 1);
          } else {
            // ID未設定の要素には新しいIDを付与
            cleanedItem.id = localPromptIdCounter++;
            console.log(
              `[📥 ${loadOperationId}] Assigned new ID ${cleanedItem.id} to item at index ${index}`
            );
          }

          return cleanedItem;
        }
      );

      // クリーニングが実行された場合は自動保存
      if (cleanedCount > 0) {
        console.log(
          `[LOCAL_LOAD] Cleaned ${cleanedCount} corrupted prompt entries, auto-saving...`
        );
        await saveLocalList(false); // カテゴリー更新なしで保存
      }

      console.log(
        `[📥 ${loadOperationId}] Processed ${AppState.data.localPromptList.length} items (cleaned: ${cleanedCount})`
      );

      // 辞書タブ用：ロード完了後に必ずID整合性を確保（ソート問題解決）
      if (window.ensureLocalPromptIntegrity) {
        console.log(
          `[📥 ${loadOperationId}] Ensuring local prompt ID integrity after load...`
        );
        await window.ensureLocalPromptIntegrity(false); // 保存はしない（ロード直後なので）
      } else {
        // フォールバック：従来のID整合性確保
        ensureLocalPromptIds();
      }

      console.log(
        `[📥 ${loadOperationId}] Final localPromptList contents:`,
        AppState.data.localPromptList.map((item, idx) => ({
          index: idx,
          id: item?.id,
          sort: item?.sort,
          data: item?.data,
          prompt: item?.prompt?.substring(0, 20) + "...",
        }))
      );
      console.log(`[📥 ${loadOperationId}] ===== LOAD LOCAL LIST END =====`);
    } else {
      console.log(
        `[📥 ${loadOperationId}] No data found in storage - initializing empty list`
      );
      AppState.data.localPromptList = [];
      console.log(`[📥 ${loadOperationId}] ===== LOAD LOCAL LIST END =====`);
    }
  } catch (error) {
    console.error(
      `[📥 ${loadOperationId}] ❌ Failed to load local list:`,
      error
    );
  }
}

// ============================================
// アーカイブリスト管理
// ============================================

/**
 * プロンプト辞書を読み込み（promptDictionariesのみ使用）
 */
async function loadFavoritsList() {
  try {
    // promptDictionariesのみを読み込み
    const result = await Storage.get([
      "promptDictionaries",
      "currentPromptDictionary",
    ]);

    // 複数辞書システムの初期化
    if (result.promptDictionaries) {
      AppState.data.promptDictionaries = result.promptDictionaries;
      AppState.data.currentPromptDictionary =
        result.currentPromptDictionary || "main";
      console.log(
        `[DICT_LOAD] Loaded existing dictionary system with ${
          Object.keys(AppState.data.promptDictionaries).length
        } dictionaries`
      );

      // データ構造の修復チェック（itemsをpromptsに統一）
      Object.keys(AppState.data.promptDictionaries).forEach((dictId) => {
        const dict = AppState.data.promptDictionaries[dictId];
        if (Array.isArray(dict)) {
          console.log(
            `[DICT_REPAIR] Fixing corrupted dictionary structure for ${dictId}`
          );
          AppState.data.promptDictionaries[dictId] = {
            name: dictId === "main" ? "メインリスト" : dictId,
            prompts: dict,
          };
        } else if (dict && dict.items && !dict.prompts) {
          console.log(
            `[DICT_REPAIR] Converting items to prompts for ${dictId}`
          );
          dict.prompts = dict.items;
          delete dict.items;
        }
      });
    } else {
      // 初回起動時にサンプルデータを作成
      console.log("[DICT_INIT] Creating initial sample data");

      AppState.data.promptDictionaries = {
        main: {
          name: "メインリスト",
          prompts: [
            {
              title: "サンプルプロンプト",
              prompt: "beautiful girl, anime style, high quality, detailed",
              sort: 0,
            },
            {
              title: "風景プロンプト",
              prompt: "landscape, mountains, sunset, peaceful, nature",
              sort: 1,
            },
          ],
        },
      };

      AppState.data.currentPromptDictionary = "main";
      await savePromptDictionaries();
    }
  } catch (error) {
    console.error("Failed to load favorits list:", error);
  }
}

/**
 * プロンプト辞書を保存（promptDictionariesのみ使用）
 */
async function saveFavoritsList() {
  try {
    console.log("[DICT_SAVE] Saving prompt dictionaries");
    await savePromptDictionaries();
  } catch (error) {
    console.error("Failed to save prompt dictionaries:", error);
    throw error;
  }
}

/**
 * 複数辞書システムのデータを保存
 */
async function savePromptDictionaries() {
  try {
    await Storage.set({
      promptDictionaries: AppState.data.promptDictionaries,
      currentPromptDictionary: AppState.data.currentPromptDictionary,
    });
    console.log(
      `[DICT_SAVE] Saved ${
        Object.keys(AppState.data.promptDictionaries).length
      } dictionaries`
    );
  } catch (error) {
    console.error("Failed to save prompt dictionaries:", error);
    throw error;
  }
}

// ============================================
// Generate履歴管理
// ============================================

/**
 * Generate履歴を保存
 */
async function saveGenerateHistory() {
  try {
    await Storage.set({ generateHistory: AppState.data.generateHistory });
  } catch (error) {
    console.error("Failed to save generate history:", error);
    throw error;
  }
}

/**
 * Generate履歴を読み込み
 */
async function loadGenerateHistory() {
  try {
    const result = await Storage.get("generateHistory");
    if (result.generateHistory) {
      AppState.data.generateHistory = result.generateHistory;
    } else {
      AppState.data.generateHistory = [];
    }
  } catch (error) {
    console.error("Failed to load generate history:", error);
    AppState.data.generateHistory = [];
  }
}

// ============================================
// オプション管理
// ============================================

/**
 * オプションデータを保存
 */
async function saveOptionData() {
  try {
    await Storage.set({ optionData: AppState.userSettings.optionData });
  } catch (error) {
    console.error("Failed to save option data:", error);
    throw error;
  }
}

/**
 * オプションデータを読み込みし、UIを更新
 */
async function loadOptionData() {
  try {
    const result = await Storage.get("optionData");

    if (result.optionData) {
      AppState.userSettings.optionData = result.optionData;

      const deleteCheck = document.getElementById(DOM_IDS.OTHER.DELETE_CHECK);
      if (deleteCheck) {
        deleteCheck.checked = AppState.userSettings.optionData.isDeleteCheck;
      }

      const deeplAuth = document.getElementById(DOM_IDS.OTHER.DEEPL_AUTH);
      if (deeplAuth) {
        deeplAuth.value = AppState.userSettings.optionData.deeplAuthKey || "";
      }
    } else {
      // デフォルト値を設定
      AppState.userSettings.optionData = {
        shaping: "SD",
        editType: "SELECT",
        isDeleteCheck: true,
        deeplAuthKey: "",
        // 通知設定（デフォルトは全て表示）
        showSuccessToast: true,
        showInfoToast: true,
        showWarningToast: true,
        showErrorToast: true,
        // ボタン表示設定（デフォルトは非表示）
        showCopyButton: false,
        showGenerateButton: false,
      };
    }

    console.log("Option data loaded:", AppState.userSettings.optionData);

    // UI更新ロジック
    await updateUIBasedOnCurrentTab();
  } catch (error) {
    console.error("Failed to load option data:", error);
  }
}

/**
 * 現在のタブに基づいてUIを更新
 */
async function updateUIBasedOnCurrentTab() {
  return new Promise((resolve) => {
    const uiTypeButtons = document.querySelectorAll('[name="UIType"]');
    const editTypeSelect = document.querySelector("#EditType");

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentUrl = tabs[0].url;

      // URLに基づいて整形タイプを設定
      if (currentUrl === "http://127.0.0.1:7860/") {
        AppState.userSettings.optionData.shaping = "SD";
      } else if (currentUrl === "https://novelai.net/image") {
        AppState.userSettings.optionData.shaping = "NAI";
      }

      editPrompt.generate();
      UpdateGenaretePrompt();
      console.log("Current URL:", currentUrl);

      switch (AppState.userSettings.optionData.shaping) {
        case "SD":
          if (uiTypeButtons[0]) uiTypeButtons[0].checked = true;
          break;
        case "NAI":
          if (uiTypeButtons[1]) uiTypeButtons[1].checked = true;
          break;
        case "None":
          if (uiTypeButtons[2]) uiTypeButtons[2].checked = true;
          break;
      }

      if (editTypeSelect) {
        editTypeSelect.value =
          AppState.userSettings.optionData.editType || "SELECT";
      }

      resolve();
    });
  });
}

// ============================================
// 要素登録
// ============================================

/**
 * 要素を登録
 * @param {string} big - 大カテゴリー
 * @param {string} middle - 中カテゴリー
 * @param {string} small - 小カテゴリー
 * @param {string} prompt - プロンプト
 * @returns {boolean} 成功/失敗
 */
function register(big, middle, small, prompt) {
  const item = {
    prompt: prompt,
    data: [big, middle, small],
  };

  // GAS APIでスプレッドシートに登録（非同期、UI操作をブロックしない）
  setTimeout(() => {
    RegistAPI(big, middle, small, prompt);
  }, 0);

  return registerItem(item);
}

/**
 * アイテムを登録
 * @param {Object} item - 登録するアイテム
 * @param {boolean} skipSave - 保存をスキップするか
 * @returns {boolean} 成功/失敗
 */
function registerItem(item, skipSave = false) {
  const inputData = item.prompt + item.data[0] + item.data[1] + item.data[2];
  const isDuplicate = AppState.data.localPromptList.some((listItem) => {
    const listItemData =
      listItem.prompt + listItem.data[0] + listItem.data[1] + listItem.data[2];
    return inputData === listItemData;
  });

  if (!isDuplicate) {
    const newItem = {
      prompt: item.prompt,
      data: item.data,
      sort: AppState.data.localPromptList.length,
      id: localPromptIdCounter++, // 永続的な数値IDを使用
    };

    AppState.data.localPromptList.push(newItem);

    if (!skipSave) {
      saveLocalList();
    }

    // 辞書タブがアクティブな場合はリアルタイム更新
    if (
      typeof window !== "undefined" &&
      window.app &&
      window.app.tabs &&
      window.app.tabs.dictionary
    ) {
      console.log("Checking for local dictionary update...", {
        currentTab: AppState.ui.currentTab,
        isDictionaryActive:
          AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY,
        elementDictionaryOpen:
          window.app.tabs.dictionary.dictionaryStates?.element,
      });

      if (AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
        console.log("Dictionary tab is active, updating local elements...");

        // 統計情報を即座に更新
        window.app.tabs.dictionary.updateStats();

        // 要素辞書（ローカル）が開いている場合はリストを更新
        if (window.app.tabs.dictionary.dictionaryStates.element) {
          console.log("Element dictionary is open, refreshing list...");
          setTimeout(async () => {
            await window.app.tabs.dictionary.refreshAddList();
            console.log(
              "Local dictionary list updated after element registration"
            );
          }, 100);
        } else {
          console.log("Element dictionary is closed, but stats updated");
        }

        // 少し遅延を入れて再度統計を更新
        setTimeout(() => {
          console.log("Delayed local stats update...");
          window.app.tabs.dictionary.updateStats();
        }, 200);
      }
    }

    return true;
  }

  return false;
}

/**
 * 辞書アイテムを登録（互換性関数）
 * @param {Object} item - 登録するアイテム
 * @param {boolean} skipSave - 保存をスキップするか
 * @returns {boolean} 成功/失敗
 */
function registerDictionary(item, skipSave = false) {
  return registerItem(item, skipSave);
}

// ============================================
// 検索機能
// ============================================

/**
 * プロンプトを検索
 * @param {string} search - 検索キーワード
 * @param {Array} data - カテゴリーフィルター
 * @returns {Array} 検索結果
 */
function Search(search, data) {
  // ローカルとマスターのプロンプトを結合（ソース情報とユニークID付き）
  const localPrompts = AppState.data.localPromptList.map((item, index) => ({
    ...item,
    _source: "local",
    _itemId: `local-${index}-${item.prompt.slice(0, 10)}`,
    _originalIndex: index,
    id: `search-local-${index}`, // DOM更新用のIDを追加
  }));
  const masterPrompts = getMasterPrompts().map((item, index) => ({
    ...item,
    _source: "master",
    _itemId: `master-${index}-${item.prompt.slice(0, 10)}`,
    _originalIndex: index,
    id: `search-master-${index}`, // DOM更新用のIDを追加
  }));

  const prompts = [...localPrompts, ...masterPrompts];
  let filtered = prompts;

  // カテゴリーでフィルタリング
  if (data[0] !== "") {
    data
      .filter((value) => value !== null && value !== "") // 空文字も除外
      .forEach((value, index) => {
        filtered = filtered.filter((item) => item.data[index] === value);
      });
  }

  // キーワード検索
  const searchResults = filtered.filter((item) => {
    const searchTarget = (
      item.data[0] +
      item.data[1] +
      item.data[2] +
      item.prompt
    ).toLowerCase();
    return searchTarget.includes(search.toLowerCase());
  });

  // 検索結果のログ出力
  const localCount = searchResults.filter(
    (item) => item._source === "local"
  ).length;
  const masterCount = searchResults.filter(
    (item) => item._source === "master"
  ).length;
  console.log(
    `[Search] Results: ${searchResults.length} total (${localCount} local, ${masterCount} master)`
  );

  // ローカル辞書項目の詳細ログ
  const localItems = searchResults.filter((item) => item._source === "local");
  if (localItems.length > 0) {
    console.log(
      `[Search] Local items:`,
      localItems.map((item, index) => ({
        index,
        id: item._itemId,
        prompt:
          typeof item.prompt === "string"
            ? item.prompt.substring(0, 20) + "..."
            : String(item.prompt || "").substring(0, 20) + "...",
        category: `${item.data[0]}/${item.data[1]}/${item.data[2]}`,
      }))
    );
  }

  return searchResults;
}

/**
 * ローカル要素のインデックスを取得
 * @param {Object} searchItem - 検索する要素
 * @returns {number} インデックス（見つからない場合は-1）
 */
function getLocalElementIndex(searchItem) {
  const searchData =
    searchItem.prompt +
    searchItem.data[0] +
    searchItem.data[1] +
    searchItem.data[2];

  return AppState.data.localPromptList.findIndex((item) => {
    const itemData = item.prompt + item.data[0] + item.data[1] + item.data[2];
    return searchData === itemData;
  });
}

/**
 * プロンプトが辞書（ローカル・マスター）に存在するかチェック
 * @param {string} prompt - チェックするプロンプト
 * @returns {boolean} 存在する場合true
 */
function isPromptInDictionary(prompt) {
  if (!prompt || typeof prompt !== "string") return false;

  const normalizedPrompt = prompt.toLowerCase().trim();

  // ローカル辞書をチェック
  const inLocal = AppState.data.localPromptList.some(
    (item) =>
      item.prompt && item.prompt.toLowerCase().trim() === normalizedPrompt
  );

  if (inLocal) return true;

  // マスター辞書をチェック
  const masterPrompts = getMasterPrompts();
  return masterPrompts.some(
    (item) =>
      item.prompt && item.prompt.toLowerCase().trim() === normalizedPrompt
  );
}

/**
 * マスター辞書にプロンプトが存在するかチェック
 * @param {string} prompt - チェックするプロンプト
 * @returns {boolean} 存在する場合true
 */
function isPromptInMasterDictionary(prompt) {
  if (!prompt || typeof prompt !== "string") return false;

  const normalizedPrompt = prompt.toLowerCase().trim();
  const masterPrompts = getMasterPrompts();

  return masterPrompts.some(
    (item) =>
      item.prompt && item.prompt.toLowerCase().trim() === normalizedPrompt
  );
}

// ============================================
// 初期化
// ============================================

/**
 * データマネージャーを初期化（すべてのデータを非同期で読み込み）
 * @returns {Promise<void>}
 */
async function initializeDataManager() {
  console.log("Initializing data manager...");

  try {
    // 並列で読み込みを実行
    const loadPromises = [
      loadPrompt(),
      loadSelectors(),
      loadLocalList(),
      loadFavoritsList(),
      loadGenerateHistory(),
      loadOptionData(),
      loadToolInfo(),
      loadCategory(),
      loadPromptSelector(),
      loadGenerateButtonSelector(),
      loadCustomSites(),
      loadDebugSettings(),
    ];

    await Promise.all(loadPromises);

    console.log("Data manager initialized successfully");
    console.log("AppState:", AppState);
  } catch (error) {
    console.error("Failed to initialize data manager:", error);

    // 部分的な初期化失敗でも続行できるようにする
    if (!AppState.userSettings.optionData) {
      AppState.userSettings.optionData = {
        shaping: "SD",
        editType: "SELECT",
        isDeleteCheck: true,
        deeplAuthKey: "",
        // 通知設定（デフォルトは全て表示）
        showSuccessToast: true,
        showInfoToast: true,
        showWarningToast: true,
        showErrorToast: true,
        // ボタン表示設定（デフォルトは非表示）
        showCopyButton: false,
        showGenerateButton: false,
      };
    }
  }
}

// ============================================
// グローバル変数の互換性維持（段階的な移行のため）
// ============================================

// Getter/Setterでグローバル変数へのアクセスをAppStateにリダイレクト
Object.defineProperty(window, "localPromptList", {
  get() {
    return AppState.data.localPromptList;
  },
  set(value) {
    AppState.data.localPromptList = value;
  },
});

Object.defineProperty(window, "masterPrompts", {
  get() {
    return getMasterPrompts();
  },
  set(value) {
    // 新しい設計では直接設定は無効（default-masterから取得するため）
    console.warn(
      "masterPrompts is read-only. Data comes from default-master.js"
    );
  },
});

Object.defineProperty(window, "optionData", {
  get() {
    return AppState.userSettings.optionData;
  },
  set(value) {
    AppState.userSettings.optionData = value;
  },
});

Object.defineProperty(window, "toolInfo", {
  get() {
    return AppState.data.toolInfo;
  },
  set(value) {
    AppState.data.toolInfo = value;
  },
});

Object.defineProperty(window, "searchCategory", {
  get() {
    return AppState.data.searchCategory;
  },
  set(value) {
    AppState.data.searchCategory = value;
  },
});

Object.defineProperty(window, "masterVersion", {
  get() {
    return AppState.config.masterVersion;
  },
  set(value) {
    AppState.config.masterVersion = value;
  },
});

Object.defineProperty(window, "toolVersion", {
  get() {
    return AppState.config.toolVersion;
  },
  set(value) {
    AppState.config.toolVersion = value;
  },
});

Object.defineProperty(window, "positiveSelector", {
  get() {
    return AppState.selector.positiveSelector;
  },
  set(value) {
    AppState.selector.positiveSelector = value;
  },
});

Object.defineProperty(window, "generateSelector", {
  get() {
    return AppState.selector.generateSelector;
  },
  set(value) {
    AppState.selector.generateSelector = value;
  },
});

// ============================================
// カスタムサイト管理
// ============================================

/**
 * カスタムサイトを保存
 */
async function saveCustomSites() {
  try {
    await Storage.set({ customSites: AppState.selector.customSites });
    console.log("Custom sites saved successfully");
  } catch (error) {
    console.error("Failed to save custom sites:", error);
    throw error;
  }
}

/**
 * カスタムサイトを読み込み
 */
async function loadCustomSites() {
  try {
    const result = await Storage.get("customSites");
    if (result.customSites) {
      AppState.selector.customSites = result.customSites;
      console.log(
        "Custom sites loaded:",
        Object.keys(result.customSites).length
      );
    }
  } catch (error) {
    console.error("Failed to load custom sites:", error);
  }
}

/**
 * カスタムサイトを追加
 */
async function addCustomSite(siteData) {
  try {
    // ID生成（名前をベースにしたキー）
    const siteId = `custom_${siteData.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

    // サイト情報を保存
    AppState.selector.customSites[siteId] = {
      id: siteId,
      name: siteData.name,
      url: siteData.url,
      positiveSelector: siteData.positiveSelector,
      generateSelector: siteData.generateSelector,
      inputDelay: siteData.inputDelay || 0,
      isBuiltIn: false,
      dateAdded: new Date().toISOString(),
    };

    // ストレージに保存
    await saveCustomSites();

    console.log("Custom site added:", siteData.name);
    return siteId;
  } catch (error) {
    console.error("Failed to add custom site:", error);
    throw error;
  }
}

/**
 * カスタムサイトを削除
 */
async function deleteCustomSite(siteId) {
  try {
    if (AppState.selector.customSites[siteId]) {
      const siteName = AppState.selector.customSites[siteId].name;
      delete AppState.selector.customSites[siteId];
      await saveCustomSites();
      console.log("Custom site deleted:", siteName);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to delete custom site:", error);
    throw error;
  }
}

/**
 * カスタムサイトを更新
 */
async function updateCustomSite(siteId, siteData) {
  try {
    if (AppState.selector.customSites[siteId]) {
      AppState.selector.customSites[siteId] = {
        ...AppState.selector.customSites[siteId],
        name: siteData.name,
        url: siteData.url,
        positiveSelector: siteData.positiveSelector,
        generateSelector: siteData.generateSelector,
        inputDelay: siteData.inputDelay || 0,
        dateUpdated: new Date().toISOString(),
      };

      await saveCustomSites();
      console.log("Custom site updated:", siteData.name);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to update custom site:", error);
    throw error;
  }
}

/**
 * 全サイト（組み込み + カスタム）を取得
 */
function getAllSites() {
  const allSites = {};

  // 組み込みサイトを追加
  Object.keys(AppState.selector.serviceSets).forEach((key) => {
    allSites[key] = AppState.selector.serviceSets[key];
  });

  // カスタムサイトを追加
  Object.keys(AppState.selector.customSites).forEach((key) => {
    allSites[key] = AppState.selector.customSites[key];
  });

  return allSites;
}

// ============================================
// 公開関数
// ============================================

// 互換性のため、グローバル関数として公開
window.initializeDataManager = initializeDataManager;
window.getMasterPrompts = getMasterPrompts;
window.register = register;
window.registerItem = registerItem;
window.registerDictionary = registerDictionary;
window.saveLocalList = saveLocalList;
window.loadLocalList = loadLocalList;
window.saveFavoritsList = saveFavoritsList;
window.loadFavoritsList = loadFavoritsList;
window.saveGenerateHistory = saveGenerateHistory;
window.loadGenerateHistory = loadGenerateHistory;

// カスタムサイト管理関数
window.saveCustomSites = saveCustomSites;
window.loadCustomSites = loadCustomSites;
window.addCustomSite = addCustomSite;
window.deleteCustomSite = deleteCustomSite;
window.updateCustomSite = updateCustomSite;
window.getAllSites = getAllSites;

// ============================================
// 複数辞書システム - 基盤実装（Phase 1）
// ============================================

/**
 * 全お気に入りリストを取得（基盤実装）
 * @returns {Object} 全辞書データ
 */
function getAllPromptDictionaries() {
  if (AppState.data.promptDictionaries) {
    return AppState.data.promptDictionaries;
  }
  // フォールバック: 空のメインリストを構築
  return {
    main: {
      name: "メインリスト",
      prompts: [],
    },
  };
}

/**
 * 現在のお気に入りリストを取得（基盤実装）
 * @returns {Object} 現在の辞書データ
 */
function getCurrentPromptDictionary() {
  const currentId = AppState.data.currentPromptDictionary || "main";
  const dictionaries = getAllPromptDictionaries();
  return dictionaries[currentId] || dictionaries.main;
}

/**
 * 新しいお気に入りリストを作成（ダミー実装）
 * @param {string} name - 辞書名
 * @returns {string} 作成された辞書のID
 */
function createPromptDictionary(name) {
  console.log("createPromptDictionary (Phase 1 - ダミー実装):", name);
  return "main"; // Phase 1では常にmainを返す
}

/**
 * お気に入りリストを切り替え（ダミー実装）
 * @param {string} dictId - 切り替え先の辞書ID
 */
function switchPromptDictionary(dictId) {
  console.log("switchPromptDictionary (Phase 1 - ダミー実装):", dictId);
  // Phase 1では何もしない
}

/**
 * お気に入りリストを保存（promptDictionariesのみ使用）
 */
async function savePromptDictionaries() {
  try {
    console.log("[DICT_SAVE] Saving prompt dictionaries to storage");
    await Storage.set({
      promptDictionaries: AppState.data.promptDictionaries,
      currentPromptDictionary: AppState.data.currentPromptDictionary,
    });
    console.log("[DICT_SAVE] Successfully saved prompt dictionaries");
  } catch (error) {
    console.error("Failed to save prompt dictionaries:", error);
    throw error;
  }
}

// ============================================
// デバッグ設定管理
// ============================================

/**
 * デバッグ設定を保存
 */
async function saveDebugSettings() {
  try {
    const debugSettings = {
      debugMode: AppState.config.debugMode,
    };
    await Storage.set({ debugSettings });
    console.log(
      `[DebugSettings] Saved debug mode: ${AppState.config.debugMode}`
    );
  } catch (error) {
    console.error("Failed to save debug settings:", error);
    throw error;
  }
}

/**
 * デバッグ設定を読み込み
 */
async function loadDebugSettings() {
  try {
    const result = await Storage.get("debugSettings");
    if (result.debugSettings) {
      AppState.config.debugMode = result.debugSettings.debugMode || false;
      console.log(
        `[DebugSettings] Loaded debug mode: ${AppState.config.debugMode}`
      );
    } else {
      // デフォルト値を設定
      AppState.config.debugMode = false;
      console.log(
        `[DebugSettings] No saved settings, using default: ${AppState.config.debugMode}`
      );
    }
  } catch (error) {
    console.error("Failed to load debug settings:", error);
    // エラーが発生した場合はデフォルト値を使用
    AppState.config.debugMode = false;
  }
}

// グローバル関数として公開
window.getAllPromptDictionaries = getAllPromptDictionaries;
window.getCurrentPromptDictionary = getCurrentPromptDictionary;
window.createPromptDictionary = createPromptDictionary;
window.switchPromptDictionary = switchPromptDictionary;
window.savePromptDictionaries = savePromptDictionaries;

/**
 * 辞書データの永続ID整合性を確保（編集タブと同じシステム）
 * @param {Array} dataArray - 辞書データ配列
 * @returns {Array} ID整合性が確保されたデータ配列
 */
function ensureDictionaryElementIds(dataArray) {
  if (!Array.isArray(dataArray)) {
    console.warn(
      "[DATA_MANAGER] ensureDictionaryElementIds: Invalid data array"
    );
    return dataArray;
  }

  let maxId = 0;

  // 既存のIDの最大値を取得
  dataArray.forEach((element) => {
    if (element && element.id !== undefined && element.id > maxId) {
      maxId = element.id;
    }
  });

  // IDが欠けている要素に新しいIDを付与
  let needsReassignment = false;
  dataArray.forEach((element) => {
    if (element && (element.id === undefined || element.id === null)) {
      element.id = ++maxId;
      needsReassignment = true;

      if (AppState.config.debugMode) {
        console.log(
          `[DATA_MANAGER] Assigned new ID ${element.id} to dictionary element:`,
          element.prompt?.substring(0, 30) || "No prompt"
        );
      }
    }
  });

  if (needsReassignment && AppState.config.debugMode) {
    console.log(
      `[DATA_MANAGER] Dictionary ID integrity ensured. Max ID: ${maxId}`
    );
  }

  return dataArray;
}

/**
 * ローカルプロンプトリストのID整合性確保とソート整合性も同時に確保
 * @param {boolean} saveAfterUpdate - 更新後に保存するかどうか
 */
async function ensureLocalPromptIntegrity(saveAfterUpdate = true) {
  try {
    if (AppState.config.debugMode) {
      console.log("[DATA_MANAGER] Starting local prompt integrity check...");
    }

    // ID整合性確保
    AppState.data.localPromptList = ensureDictionaryElementIds(
      AppState.data.localPromptList
    );

    // sort値の整合性確保（欠けているsort値を補完）
    AppState.data.localPromptList.forEach((element, index) => {
      if (element && (element.sort === undefined || element.sort === null)) {
        element.sort = index;
        if (AppState.config.debugMode) {
          console.log(
            `[DATA_MANAGER] Assigned sort value ${index} to element ID ${element.id}`
          );
        }
      }
    });

    // 保存処理
    if (saveAfterUpdate) {
      await saveLocalList(AppState.data.localPromptList);
      if (AppState.config.debugMode) {
        console.log("[DATA_MANAGER] Local prompt integrity ensured and saved");
      }
    }
  } catch (error) {
    console.error(
      "[DATA_MANAGER] Failed to ensure local prompt integrity:",
      error
    );
    throw error;
  }
}

// デバッグ設定関数をグローバルに公開
window.saveDebugSettings = saveDebugSettings;
window.loadDebugSettings = loadDebugSettings;

// 辞書ID整合性確保関数をグローバルに公開
window.ensureDictionaryElementIds = ensureDictionaryElementIds;
window.ensureLocalPromptIntegrity = ensureLocalPromptIntegrity;
