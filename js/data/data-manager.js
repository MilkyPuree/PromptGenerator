let localPromptIdCounter = 1;

function ensureLocalPromptIds() {
  if (!AppState.data.localPromptList || !Array.isArray(AppState.data.localPromptList)) {
    return;
  }

  let maxId = 0;

  AppState.data.localPromptList.forEach((item) => {
    if (item && typeof item.id === "number") {
      maxId = Math.max(maxId, item.id);
    }
  });

  localPromptIdCounter = Math.max(localPromptIdCounter, maxId + 1);

  AppState.data.localPromptList.forEach((item, index) => {
    if (!item) {
      return;
    }

    if (typeof item.id !== "number" || item.id <= 0) {
      item.id = localPromptIdCounter++;
    }
  });
}

function getMasterPrompts() {
  if (typeof window.defaultMasterData === "undefined") {
    if (typeof window.defaultMaster !== "undefined" && window.defaultMaster && window.defaultMaster.data) {
      window.defaultMasterData = window.defaultMaster.data;
      return window.defaultMasterData;
    }

    return [];
  }

  return window.defaultMasterData;
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [JS_FILES.CONTENT],
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function savePrompt() {
  try {
    // スロットから直接プロンプトを取得
    const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
    const prompt = currentSlot?.prompt || "";
    await Storage.set({ [STORAGE_KEYS.PROMPT.GENERATE]: prompt });
    await promptSlotManager.saveCurrentSlot();
  } catch (error) {
    throw error;
  }
}

async function loadPrompt() {
  try {
    const result = await Storage.get(STORAGE_KEYS.PROMPT.GENERATE);
    if (result[STORAGE_KEYS.PROMPT.GENERATE] != null) {
      UpdateGenaretePrompt();
    }
  } catch (error) {}
}

async function saveCategory() {
  try {
    await Storage.set({
      [STORAGE_KEYS.CATEGORY.DATA]: AppState.data.searchCategory,
    });
  } catch (error) {
    throw error;
  }
}

async function loadCategory() {
  try {
    const result = await Storage.get("searchCategory");
    if (result.searchCategory != null) {
      AppState.data.searchCategory = result.searchCategory;
      setSearchCategory();
    }
  } catch (error) {}
}

async function saveSelectors() {
  try {
    await Storage.set({
      positiveSelector: AppState.selector.positiveSelector,
      generateSelector: AppState.selector.generateSelector,
      serviceSets: AppState.selector.serviceSets,
    });
  } catch (error) {
    throw error;
  }
}

async function loadSelectors() {
  try {
    const result = await Storage.get(["positiveSelector", "generateSelector", "serviceSets"]);

    if (result.positiveSelector) {
      AppState.selector.positiveSelector = result.positiveSelector;
    }
    if (result.generateSelector) {
      AppState.selector.generateSelector = result.generateSelector;
    }

    if (result.serviceSets) {
      Object.keys(result.serviceSets).forEach((key) => {
        if (AppState.selector.serviceSets[key]) {
          AppState.selector.serviceSets[key] = {
            ...AppState.selector.serviceSets[key],
            ...result.serviceSets[key],
          };
        }
      });
    } else {
      try {
        await Storage.set({
          serviceSets: AppState.selector.serviceSets,
        });
      } catch (error) {}
    }

    validateAndActivateGenerateButton();
  } catch (error) {}
}

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

      await injectContentScript(tab.id);

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "checkSelector",
            selector,
          });
        } catch (error) {
          AppState.selector.positiveSelector = result.positiveSelector;
        }
      }, 100);
    }
  } catch (error) {}
}

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

      await injectContentScript(tab.id);

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "checkSelector",
            selector,
          });
        } catch (error) {
          AppState.selector.generateSelector = result.generateSelector;
        }
      }, 100);
    }
  } catch (error) {}
}

function validateAndActivateGenerateButton() {
  const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);

  if (generateButton) {
    const hasSelectors = AppState.selector.positiveSelector && AppState.selector.generateSelector;

    const currentURL = window.location.href;
    const optionData = AppState.userSettings.optionData;
    const isSDMode = (optionData && optionData.shaping === "SD") || currentURL === "http://127.0.0.1:7860/";

    if (hasSelectors || isSDMode) {
      generateButton.classList.remove("hidden");
      generateButton.classList.add("show-block");
      generateButton.style.opacity = "1";
      generateButton.title = "";
    } else {
      generateButton.classList.remove("hidden");
      generateButton.classList.add("show-block");
      generateButton.style.opacity = "1";
      generateButton.title =
        "セレクター設定を確認してください。その他タブでプロンプト入力欄とGenerateボタンのセレクターを設定する必要があります。";
    }
  }
}

async function saveToolInfo() {
  try {
    await Storage.set({ toolInfo: AppState.data.toolInfo });
  } catch (error) {
    throw error;
  }
}

async function loadToolInfo() {
  try {
    const result = await Storage.get("toolInfo");
    if (result.toolInfo) {
      AppState.data.toolInfo = result.toolInfo;
    }
    loadMessage(); // API通信を開始
  } catch (error) {}
}

async function saveLocalList(updateCategories = true) {
  try {
    await Storage.set({ localPromptList: AppState.data.localPromptList });

    if (updateCategories) {
      immediateCategoryUpdate();
    }
  } catch (error) {
    throw error;
  }
}

async function loadLocalList() {
  try {
    const result = await Storage.get("localPromptList");

    if (result.localPromptList) {
      let cleanedCount = 0;

      AppState.data.localPromptList = result.localPromptList.map((item, index) => {
        const cleanedItem = { ...item };

        if (item.prompt && typeof item.prompt !== "string") {
          if (typeof item.prompt === "object" && item.prompt !== null) {
            if (item.prompt.text) {
              cleanedItem.prompt = String(item.prompt.text);
            } else if (item.prompt.value) {
              cleanedItem.prompt = String(item.prompt.value);
            } else if (item.prompt.toString && typeof item.prompt.toString === "function") {
              cleanedItem.prompt = item.prompt.toString();
            } else {
              cleanedItem.prompt = String(item.prompt);
            }
          } else {
            cleanedItem.prompt = String(item.prompt || "");
          }
          cleanedCount++;
        }

        if (item.data && Array.isArray(item.data)) {
          let dataCleanedCount = 0;
          cleanedItem.data = item.data.map((dataItem, dataIndex) => {
            if (dataItem != null && typeof dataItem !== "string") {
              dataCleanedCount++;

              let cleanedDataItem = "";
              if (Array.isArray(dataItem)) {
                cleanedDataItem = String(dataItem[0] || "");
              } else if (typeof dataItem === "object" && dataItem !== null) {
                if (dataItem.text) {
                  cleanedDataItem = String(dataItem.text);
                } else if (dataItem.value) {
                  cleanedDataItem = String(dataItem.value);
                } else if (dataItem.toString && typeof dataItem.toString === "function") {
                  cleanedDataItem = dataItem.toString();
                } else {
                  cleanedDataItem = String(dataItem);
                }
              } else {
                cleanedDataItem = String(dataItem || "");
              }

              return cleanedDataItem;
            }
            return dataItem;
          });

          if (dataCleanedCount > 0) {
            cleanedCount++;
          }
        }

        if (typeof item.id === "number" && item.id > 0) {
          cleanedItem.id = item.id;
          localPromptIdCounter = Math.max(localPromptIdCounter, item.id + 1);
        } else {
          cleanedItem.id = localPromptIdCounter++;
        }

        return cleanedItem;
      });

      if (cleanedCount > 0) {
        await saveLocalList(false);
      }

      if (window.ensureLocalPromptIntegrity) {
        await window.ensureLocalPromptIntegrity(false);
      } else {
        ensureLocalPromptIds();
      }
    } else {
      AppState.data.localPromptList = [];
    }
  } catch (error) {}
}

async function loadFavoritsList() {
  try {
    const result = await Storage.get(["promptDictionaries", "currentPromptDictionary"]);

    if (result.promptDictionaries) {
      AppState.data.promptDictionaries = result.promptDictionaries;
      AppState.data.currentPromptDictionary = result.currentPromptDictionary || "main";

      Object.keys(AppState.data.promptDictionaries).forEach((dictId) => {
        const dict = AppState.data.promptDictionaries[dictId];
        if (Array.isArray(dict)) {
          AppState.data.promptDictionaries[dictId] = {
            name: dictId === "main" ? "メインリスト" : dictId,
            prompts: dict,
          };
        } else if (dict && dict.items && !dict.prompts) {
          dict.prompts = dict.items;
          delete dict.items;
        }
      });
    } else {
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
  } catch (error) {}
}

async function saveFavoritsList() {
  try {
    await savePromptDictionaries();
  } catch (error) {
    throw error;
  }
}

async function savePromptDictionaries() {
  try {
    await Storage.set({
      promptDictionaries: AppState.data.promptDictionaries,
      currentPromptDictionary: AppState.data.currentPromptDictionary,
    });
  } catch (error) {
    throw error;
  }
}

async function saveGenerateHistory() {
  try {
    await Storage.set({ generateHistory: AppState.data.generateHistory });
  } catch (error) {
    throw error;
  }
}

async function loadGenerateHistory() {
  try {
    const result = await Storage.get("generateHistory");
    if (result.generateHistory) {
      AppState.data.generateHistory = result.generateHistory;
    } else {
      AppState.data.generateHistory = [];
    }
  } catch (error) {
    AppState.data.generateHistory = [];
  }
}

async function saveOptionData() {
  try {
    await Storage.set({ optionData: AppState.userSettings.optionData });
  } catch (error) {
    throw error;
  }
}

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
      AppState.userSettings.optionData = {
        shaping: "SD",
        editType: "SELECT",
        isDeleteCheck: true,
        deeplAuthKey: "",
        showSuccessToast: true,
        showInfoToast: true,
        showWarningToast: true,
        showErrorToast: true,
        showCopyButton: false,
        showGenerateButton: false,
        showNSFWCategories: false,
        showLoraButton: false,
      };
    }

    await updateUIBasedOnCurrentTab();
  } catch (error) {}
}

async function updateUIBasedOnCurrentTab() {
  return new Promise((resolve) => {
    const editTypeSelect = document.querySelector(DOM_SELECTORS.BY_ATTRIBUTE.EDIT_TYPE_SELECT);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentUrl = tabs[0].url;

      if (currentUrl === "http://127.0.0.1:7860/") {
        AppState.userSettings.optionData.shaping = "SD";
      } else if (currentUrl === "https://novelai.net/image") {
        AppState.userSettings.optionData.shaping = "NAIv45";
      }

      UpdateGenaretePrompt();

      const targetButton = document.querySelector(
        `[name="UIType"][value="${AppState.userSettings.optionData.shaping}"]`
      );
      if (targetButton) {
        targetButton.checked = true;
      }

      if (editTypeSelect) {
        editTypeSelect.value = AppState.userSettings.optionData.editType || "SELECT";
      }

      resolve();
    });
  });
}

function register(big, middle, small, prompt) {
  const item = {
    prompt: prompt,
    data: [big, middle, small],
  };

  setTimeout(() => {
    RegistAPI(big, middle, small, prompt);
  }, 0);

  return registerItem(item);
}

function registerItem(item, skipSave = false) {
  const inputData = item.prompt + item.data[0] + item.data[1] + item.data[2];
  const isDuplicate = AppState.data.localPromptList.some((listItem) => {
    const listItemData = listItem.prompt + listItem.data[0] + listItem.data[1] + listItem.data[2];
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

    if (typeof window !== "undefined" && window.app && window.app.tabs && window.app.tabs.dictionary) {
      if (AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
        window.app.tabs.dictionary.updateStats();

        if (window.app.tabs.dictionary.dictionaryStates.element) {
          setTimeout(async () => {
            await window.app.tabs.dictionary.refreshAddList();
          }, 100);
        }

        setTimeout(() => {
          window.app.tabs.dictionary.updateStats();
        }, 200);
      }
    }

    return true;
  }

  return false;
}

function registerDictionary(item, skipSave = false) {
  return registerItem(item, skipSave);
}

function Search(search, data) {
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

  if (data[0] !== "") {
    data
      .filter((value) => value !== null && value !== "") // 空文字も除外
      .forEach((value, index) => {
        filtered = filtered.filter((item) => item.data[index] === value);
      });
  }

  const searchResults = filtered.filter((item) => {
    const searchTarget = (item.data[0] + item.data[1] + item.data[2] + item.prompt).toLowerCase();
    return searchTarget.includes(search.toLowerCase());
  });

  return searchResults;
}

function getLocalElementIndex(searchItem) {
  const searchData = searchItem.prompt + searchItem.data[0] + searchItem.data[1] + searchItem.data[2];

  return AppState.data.localPromptList.findIndex((item) => {
    const itemData = item.prompt + item.data[0] + item.data[1] + item.data[2];
    return searchData === itemData;
  });
}

function isPromptInDictionary(prompt) {
  if (!prompt || typeof prompt !== "string") return false;

  const normalizedPrompt = prompt.toLowerCase().trim();

  const inLocal = AppState.data.localPromptList.some(
    (item) => item.prompt && item.prompt.toLowerCase().trim() === normalizedPrompt
  );

  if (inLocal) return true;

  const masterPrompts = getMasterPrompts();
  return masterPrompts.some((item) => item.prompt && item.prompt.toLowerCase().trim() === normalizedPrompt);
}

function isPromptInMasterDictionary(prompt) {
  if (!prompt || typeof prompt !== "string") return false;

  const normalizedPrompt = prompt.toLowerCase().trim();
  const masterPrompts = getMasterPrompts();

  return masterPrompts.some((item) => item.prompt && item.prompt.toLowerCase().trim() === normalizedPrompt);
}

async function initializeDataManager() {
  try {
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

    await loadPromptSlots();
  } catch (error) {
    if (!AppState.userSettings.optionData) {
      AppState.userSettings.optionData = {
        shaping: "SD",
        editType: "SELECT",
        isDeleteCheck: true,
        deeplAuthKey: "",
        showSuccessToast: true,
        showInfoToast: true,
        showWarningToast: true,
        showErrorToast: true,
        showCopyButton: false,
        showGenerateButton: false,
      };
    }
  }
}

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

async function saveCustomSites() {
  try {
    await Storage.set({ customSites: AppState.selector.customSites });
  } catch (error) {
    throw error;
  }
}

async function loadCustomSites() {
  try {
    const result = await Storage.get("customSites");
    if (result.customSites) {
      AppState.selector.customSites = result.customSites;
    }
  } catch (error) {}
}

async function addCustomSite(siteData) {
  try {
    const siteId = `custom_${siteData.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

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

    await saveCustomSites();
    return siteId;
  } catch (error) {
    throw error;
  }
}

async function deleteCustomSite(siteId) {
  try {
    if (AppState.selector.customSites[siteId]) {
      delete AppState.selector.customSites[siteId];
      await saveCustomSites();
      return true;
    }
    return false;
  } catch (error) {
    throw error;
  }
}

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
      return true;
    }
    return false;
  } catch (error) {
    throw error;
  }
}

function getAllSites() {
  const allSites = {};

  Object.keys(AppState.selector.serviceSets).forEach((key) => {
    allSites[key] = AppState.selector.serviceSets[key];
  });

  Object.keys(AppState.selector.customSites).forEach((key) => {
    allSites[key] = AppState.selector.customSites[key];
  });

  return allSites;
}

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

window.saveCustomSites = saveCustomSites;
window.loadCustomSites = loadCustomSites;
window.addCustomSite = addCustomSite;
window.deleteCustomSite = deleteCustomSite;
window.updateCustomSite = updateCustomSite;
window.getAllSites = getAllSites;

function getAllPromptDictionaries() {
  if (AppState.data.promptDictionaries) {
    return AppState.data.promptDictionaries;
  }
  return {
    main: {
      name: "メインリスト",
      prompts: [],
    },
  };
}

function getCurrentPromptDictionary() {
  const currentId = AppState.data.currentPromptDictionary || "main";
  const dictionaries = getAllPromptDictionaries();
  return dictionaries[currentId] || dictionaries.main;
}

function createPromptDictionary(name) {
  return "main"; // Phase 1では常にmainを返す
}

function switchPromptDictionary(dictId) {
  // Phase 1では何もしない
}

async function saveDebugSettings() {
  try {
    const debugSettings = {
      debugMode: AppState.config.debugMode,
    };
    await Storage.set({ debugSettings });
  } catch (error) {
    throw error;
  }
}

async function loadDebugSettings() {
  try {
    const result = await Storage.get("debugSettings");
    if (result.debugSettings) {
      AppState.config.debugMode = result.debugSettings.debugMode || false;
    } else {
      AppState.config.debugMode = false;
    }
  } catch (error) {
    AppState.config.debugMode = false;
  }
}

async function loadPromptSlots() {
  try {
    const result = await Storage.get("promptSlots");
    if (result.promptSlots && result.promptSlots.slots) {
      if (!AppState.data) {
        AppState.data = {};
      }
      AppState.data.promptSlots = result.promptSlots;

      if (window.promptSlotManager) {
        window.promptSlotManager.slots = [...result.promptSlots.slots];
        window.promptSlotManager._nextId = result.promptSlots.nextId || result.promptSlots.slots.length;
      }
    }
  } catch (error) {}
}

window.getAllPromptDictionaries = getAllPromptDictionaries;
window.getCurrentPromptDictionary = getCurrentPromptDictionary;
window.createPromptDictionary = createPromptDictionary;
window.switchPromptDictionary = switchPromptDictionary;
window.savePromptDictionaries = savePromptDictionaries;

function ensureDictionaryElementIds(dataArray) {
  if (!Array.isArray(dataArray)) {
    return dataArray;
  }

  let maxId = 0;

  dataArray.forEach((element) => {
    if (element && element.id !== undefined && element.id > maxId) {
      maxId = element.id;
    }
  });

  dataArray.forEach((element) => {
    if (element && (element.id === undefined || element.id === null)) {
      element.id = ++maxId;
    }
  });

  return dataArray;
}

async function ensureLocalPromptIntegrity(saveAfterUpdate = true) {
  try {
    AppState.data.localPromptList = ensureDictionaryElementIds(AppState.data.localPromptList);

    AppState.data.localPromptList.forEach((element, index) => {
      if (element && (element.sort === undefined || element.sort === null)) {
        element.sort = index;
      }
    });

    if (saveAfterUpdate) {
      await saveLocalList(AppState.data.localPromptList);
    }
  } catch (error) {
    throw error;
  }
}

function findDuplicatesWithMaster() {
  const localList = AppState.data.localPromptList || [];
  const masterList = getMasterPrompts();

  const masterMap = new Map();
  masterList.forEach((item) => {
    const key = `${item.data[0]}|${item.data[1]}|${item.data[2]}|${item.prompt}`;
    masterMap.set(key, item);
  });

  const duplicates = [];
  localList.forEach((item, index) => {
    const key = `${item.data[0]}|${item.data[1]}|${item.data[2]}|${item.prompt}`;
    if (masterMap.has(key)) {
      duplicates.push({
        index,
        item,
        masterMatch: masterMap.get(key),
      });
    }
  });

  return duplicates;
}

async function saveDuplicateCheckDismissed(dismissed) {
  await Storage.set({
    [STORAGE_KEYS.SETTINGS.DUPLICATE_CHECK_DISMISSED]: dismissed,
  });
}

async function loadDuplicateCheckDismissed() {
  const result = await Storage.get(STORAGE_KEYS.SETTINGS.DUPLICATE_CHECK_DISMISSED);
  return result[STORAGE_KEYS.SETTINGS.DUPLICATE_CHECK_DISMISSED] || false;
}

window.saveDebugSettings = saveDebugSettings;
window.loadDebugSettings = loadDebugSettings;

window.ensureDictionaryElementIds = ensureDictionaryElementIds;
window.ensureLocalPromptIntegrity = ensureLocalPromptIntegrity;

window.findDuplicatesWithMaster = findDuplicatesWithMaster;
window.saveDuplicateCheckDismissed = saveDuplicateCheckDismissed;
window.loadDuplicateCheckDismissed = loadDuplicateCheckDismissed;
