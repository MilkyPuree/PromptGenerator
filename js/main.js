const CONSTANTS = {
  TABS: {
    SEARCH: 0,
    DICTIONARY: 1,
    EDIT: 2,
    SLOT: 3,
    OTHER: 4,
  },

  UI_TYPES: {
    SD: "SD",
    NAI: "NAI",
    NONE: "None",
  },
  EDIT_TYPES: {
    SELECT: "SELECT",
    TEXT: "TEXT",
  },
};

if (typeof window !== "undefined") {
  window.CONSTANTS = CONSTANTS;
}

class PromptGeneratorApp {
  constructor() {
    this.listManager = new PromptListManager();
    this.fileHandler = new FileHandler();
    this.searchHandler = new SearchHandler(this);
    this.editHandler = new EditHandler(this);
    this.dictionaryHandler = new DictionaryHandler(this);
    this.shortcutManager = new ShortcutManager();

    // Phase 8.5: タブモジュール
    this.tabs = {};

    this.initialized = false;
    this.lastFocusedInput = null; // 最後にフォーカスされた入力フィールドを記憶
  }

  async init() {
    try {
      await initializeDataManager();

      if (window.themeManager) {
        await window.themeManager.loadTheme();
        window.themeManager.applyTheme(window.themeManager.currentTheme);
      }

      if (typeof toggleTooltips === "function") {
        const showTooltips = AppState.userSettings?.optionData?.showTooltips !== false;
        window.tooltipsEnabled = showTooltips;
        toggleTooltips(showTooltips);
      }

      categoryData.init();

      this.initializeUI();

      this.setupEventHandlers();

      this.setupContextMenuListener();

      // Phase 8.5: タブの初期化
      if (typeof SearchTab !== "undefined") {
        this.tabs.search = new SearchTab(this);
        await this.tabs.search.init();
      }

      if (typeof DictionaryTab !== "undefined") {
        this.tabs.dictionary = new DictionaryTab(this);
        await this.tabs.dictionary.init();
      }

      if (typeof EditTab !== "undefined") {
        this.tabs.edit = new EditTab(this);
        await this.tabs.edit.init();
      }

      if (typeof SlotTab !== "undefined") {
        this.tabs.slot = new SlotTab(this);
        await this.tabs.slot.init();
      }

      if (typeof OtherTab !== "undefined") {
        this.tabs.other = new OtherTab(this);
        await this.tabs.other.init();
      }

      await this.checkDuplicatesOnStartup();

      this.setupCloseHandlers();

      this.shortcutManager.setupEventListeners();

      const loaded = await promptSlotManager.loadFromStorage();

      this.autoRepairSlotElements();

      this.migrationDryRun();

      if (loaded) {
        const currentSlot = SlotUtils.getCurrentSlot();
        if (currentSlot && currentSlot.isUsed) {
          const generatePromptEl = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePromptEl) generatePromptEl.value = currentSlot.prompt;
        } else {
          const generatePromptEl = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePromptEl) generatePromptEl.value = "";
        }

        if (currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential")) {
          const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePrompt) {
            if (currentSlot.currentExtraction) {
              const weightedPrompt = promptSlotManager.applyWeightToPrompt(
                currentSlot.currentExtraction,
                currentSlot.weight
              );
              generatePrompt.value = weightedPrompt;
              generatePrompt.readOnly = true;
              generatePrompt.title = "抽出モードで生成されたプロンプト（読み取り専用）";
            } else {
              generatePrompt.value = "[抽出待機中 - Generateボタンを押して抽出]";
              generatePrompt.readOnly = true;
              generatePrompt.title = "抽出モードで生成されたプロンプト（読み取り専用）";
            }
          }
        }
      } else {
        const generatePromptEl = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        const currentPrompt = generatePromptEl ? generatePromptEl.value : "";
        if (currentPrompt) {
          promptSlotManager.slots[0].prompt = currentPrompt;
          promptSlotManager.slots[0].isUsed = true;
          await promptSlotManager.saveToStorage();
        }
      }

      promptSlotManager.updateUI();

      setTimeout(() => {
        if (window.autoGenerateHandler) {
          autoGenerateHandler.init();
        }
        if (window.loraGenerateHandler) {
          loraGenerateHandler.init();
          const loraButton = document.getElementById(DOM_IDS.OTHER.LORA_GENERATE);
          if (loraButton) {
            const show = AppState.userSettings.optionData?.showLoraButton || false;
            loraButton.classList.toggle("hidden", !show);
          }
        }
      }, 1000);

      if (typeof GenerateHistoryManager !== "undefined") {
        this.historyManager = new GenerateHistoryManager();
      }

      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          const service = this.detectService(tabs[0].url);

          // 念のため再確認
          const hasStoredSelectors = AppState.selector.positiveSelector && AppState.selector.generateSelector;

          if (hasStoredSelectors) {
            const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
            if (generateButton) {
              generateButton.classList.remove("hidden");
              generateButton.classList.add("show-block");
            }
          } else if (service && AppState.selector.serviceSets[service]) {
            const serviceSelectors = AppState.selector.serviceSets[service];
            if (serviceSelectors.positiveSelector && serviceSelectors.generateSelector) {
              AppState.selector.positiveSelector = serviceSelectors.positiveSelector;
              AppState.selector.generateSelector = serviceSelectors.generateSelector;
              AppState.selector.currentService = service;

              const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
              if (generateButton) {
                generateButton.classList.remove("hidden");
                generateButton.classList.add("show-block");
              }
            }
          }
        }
      });

      const uiTypeRadios = document.querySelectorAll(DOM_SELECTORS.BY_ATTRIBUTE.UI_TYPE_RADIOS);
      uiTypeRadios.forEach((radio) => {
        radio.addEventListener(DOM_EVENTS.CHANGE, (event) => {
          if (this.editHandler) {
            this.editHandler.handleUITypeChange(event);
          }

          if (AppState.ui.currentTab === CONSTANTS.TABS.EDIT && this.tabs.edit) {
            this.tabs.edit.currentShapingMode = event.target.value;
          }

          if (this.tabs.slot) {
            const oldShaping = this.tabs.slot.currentShapingMode || "SD";
            const newShaping = event.target.value;

            if (oldShaping !== newShaping) {
              this.tabs.slot.currentShapingMode = newShaping;
              this.tabs.slot.updateSlotWeightsForNewShaping(oldShaping, newShaping);
            }
          }

          const currentPrompt = SlotUtils.getCurrentSlot()?.prompt;
          if (currentPrompt) {
            const oldShaping = AppState.userSettings?.optionData?.shaping || "SD";
            const newShaping = event.target.value;

            if (oldShaping !== newShaping && window.WeightConverter) {
              const convertedPrompt = window.WeightConverter.convertPromptNotation(
                currentPrompt,
                oldShaping,
                newShaping
              );

              if (convertedPrompt !== currentPrompt) {
                const currentSlot = SlotUtils.getCurrentSlot();
                if (currentSlot) {
                  currentSlot.prompt = convertedPrompt;
                  // UIも更新
                  const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
                  if (generatePrompt) {
                    generatePrompt.value = convertedPrompt;
                  }
                }
              }
            }
          }
        });
      });

      const editTypeRadios = document.querySelectorAll(DOM_SELECTORS.BY_ATTRIBUTE.EDIT_TYPE_RADIOS);
      editTypeRadios.forEach((radio) => {
        radio.addEventListener(DOM_EVENTS.CHANGE, (event) => {
          if (this.editHandler) {
            this.editHandler.handleEditTypeChange(event);
          }

          if (AppState.ui.currentTab === CONSTANTS.TABS.EDIT && this.tabs.edit) {
            this.tabs.edit.currentEditMode = event.target.value;
          }
        });
      });

      this.initialized = true;
    } catch (error) {
      ErrorHandler.log("Application initialization failed", error, ErrorHandler.Level.CRITICAL);
      ErrorHandler.notify("アプリケーションの初期化に失敗しました。ページを再読み込みしてください。");
      throw error;
    }
  }

  detectService(url) {
    if (!url) return null;

    if (url.includes(SERVICE_URLS.NOVELAI)) return SERVICE_NAMES.NOVELAI;
    if (url.includes(SERVICE_URLS.SD_LOCAL) || url.includes(SERVICE_URLS.SD_LOCALHOST))
      return SERVICE_NAMES.STABLE_DIFFUSION;
    if (url.includes(SERVICE_URLS.COMFYUI)) return SERVICE_NAMES.COMFYUI;

    return SERVICE_NAMES.CUSTOM;
  }

  setupContextMenuListener() {
    document.addEventListener(
      "focus",
      (e) => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
          this.lastFocusedInput = e.target;
        }
      },
      true
    ); // useCapture: true でキャプチャフェーズで処理

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === CHROME_MESSAGES.INSERT_PROMPT) {
        const activeElement = document.activeElement;
        const targetElement =
          activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
            ? activeElement
            : this.lastFocusedInput;

        if (targetElement && (targetElement.tagName === "INPUT" || targetElement.tagName === "TEXTAREA")) {
          const start = targetElement.selectionStart || 0;
          const end = targetElement.selectionEnd || 0;
          const currentValue = targetElement.value || "";

          targetElement.value = currentValue.substring(0, start) + message.text + currentValue.substring(end);
          targetElement.selectionStart = targetElement.selectionEnd = start + message.text.length;

          targetElement.focus();

          targetElement.dispatchEvent(new Event(DOM_EVENTS.INPUT));
          targetElement.dispatchEvent(new Event(DOM_EVENTS.CHANGE));

          sendResponse({ success: true });
        } else {
          const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePrompt) {
            const currentValue = generatePrompt.value || "";
            generatePrompt.value = currentValue + message.text;
            generatePrompt.dispatchEvent(new Event(DOM_EVENTS.INPUT));
            generatePrompt.dispatchEvent(new Event(DOM_EVENTS.CHANGE));
            generatePrompt.focus();
          }

          sendResponse({ success: true });
        }
      }

      return true; // 非同期レスポンスのため
    });
  }

  initializeUI() {
    this.setupTabs();

    this.setupSortableLists();

    this.updateUIState();
  }

  setupEventHandlers() {
    this.setupWindowHandlers();

    this.setupTabs();

    this.setupOptionHandlers();

    this.setupPromptInputHandlers();

    this.setupButtonHandlers();

    this.setupPromptSlotHandlers();
  }

  setupTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener(DOM_EVENTS.CLICK, (e) => this.handleTabSwitch(e));
    });
  }

  async handleTabSwitch(event) {
    const clickedTab = event.currentTarget;

    if (clickedTab.classList.contains(CSS_CLASSES.TAB.IS_ACTIVE)) {
      return;
    }

    const activeTabs = document.querySelectorAll(`.tab.${CSS_CLASSES.TAB.IS_ACTIVE}`);
    activeTabs.forEach((tab) => tab.classList.remove(CSS_CLASSES.TAB.IS_ACTIVE));
    clickedTab.classList.add(CSS_CLASSES.TAB.IS_ACTIVE);

    const activePanels = document.querySelectorAll(`.panel.${CSS_CLASSES.TAB.IS_SHOW}`);
    activePanels.forEach((panel) => panel.classList.remove(CSS_CLASSES.TAB.IS_SHOW));

    const tabs = Array.from(document.querySelectorAll(".tab"));
    const tabIndex = tabs.indexOf(clickedTab);

    const panels = document.querySelectorAll(".panel");
    if (panels[tabIndex]) {
      panels[tabIndex].classList.add(CSS_CLASSES.TAB.IS_SHOW);
    }

    const previousTab = AppState.ui.currentTab;
    AppState.ui.currentTab = tabIndex;

    if (tabIndex === CONSTANTS.TABS.SEARCH && previousTab !== CONSTANTS.TABS.SEARCH) {
      if (this.tabs.search) {
        await this.tabs.search.show();
      }
    }

    if (tabIndex === CONSTANTS.TABS.DICTIONARY && previousTab !== CONSTANTS.TABS.DICTIONARY) {
      if (this.tabs.dictionary) {
        await this.tabs.dictionary.show();
      }
    }

    if (tabIndex === CONSTANTS.TABS.EDIT && previousTab !== CONSTANTS.TABS.EDIT) {
      if (this.tabs.edit) {
        await this.tabs.edit.show();
      }
    }

    if (tabIndex === CONSTANTS.TABS.SLOT && previousTab !== CONSTANTS.TABS.SLOT) {
      if (this.tabs.slot) {
        await this.tabs.slot.show();
      }
    }

    if (tabIndex === CONSTANTS.TABS.OTHER && previousTab !== CONSTANTS.TABS.OTHER) {
      if (this.tabs.other) {
        await this.tabs.other.show();
      }
    }

    this.closePopup();
  }

  setupWindowHandlers() {
    const showPanelBtn = document.getElementById(DOM_IDS.PANELS.SHOW_PANEL);
    if (showPanelBtn) {
      showPanelBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        const optionPanel = document.getElementById(DOM_IDS.PANELS.OPTION_PANEL);
        if (optionPanel) {
          optionPanel.classList.toggle("active");
        }
      });
    }

    const popupImage = document.getElementById(DOM_IDS.PANELS.POPUP_IMAGE);
    if (popupImage) {
      popupImage.addEventListener(DOM_EVENTS.CLICK, () => this.closePopup());
    }

    const showSettingsBtn = document.getElementById(DOM_IDS.BUTTONS.SHOW_SETTINGS);
    if (showSettingsBtn) {
      showSettingsBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        if (this.tabs.other && this.tabs.other.showSettingsModal) {
          this.tabs.other.showSettingsModal();
        }
      });
    }
  }

  closePopup() {
    const popup = document.getElementById(DOM_IDS.PANELS.POPUP);
    if (popup) {
      popup.classList.add("hidden");
      popup.classList.remove("show-flex", "show-block");
    }
  }

  setupPromptInputHandlers() {
    let previousPromptValue = "";

    const resolveWeightForShaping = (weight, format, shaping) => {
      if (weight === null || shaping === "None" || typeof WeightConverter === "undefined") return null;
      return format === shaping ? weight : WeightConverter.convertWeight(weight, format, shaping);
    };

    const lookupDataForValue = (value, promptMap) => {
      if (!value || !promptMap) return ["", "", ""];
      try {
        if (window.ElementSync && typeof window.ElementSync.lookupData === "function") {
          return window.ElementSync.lookupData(value, promptMap);
        }
      } catch (e) {}
      return ["", "", ""];
    };

    const buildElementFromPrompt = (rawPrompt, index, existingMap, shaping, promptMap) => {
      let bareValue = rawPrompt;
      let extractedWeight = null;
      let extractedFormat = null;

      if (typeof WeightConverter !== "undefined") {
        const info = WeightConverter.parseFirstWeight(rawPrompt);
        if (info) {
          bareValue = info.bareText;
          extractedWeight = info.weight;
          extractedFormat = info.format;
        }
      }

      const resolvedWeight = resolveWeightForShaping(extractedWeight, extractedFormat, shaping);
      const existing = existingMap.get(bareValue.toLowerCase().trim());

      if (existing) {
        const merged = { ...existing, Value: bareValue, sort: index };
        if (resolvedWeight !== null) {
          merged[shaping] = { ...(merged[shaping] || { weight: 0 }), weight: resolvedWeight };
        }
        const hasDataAlready = Array.isArray(merged.data) && (merged.data[0] || merged.data[1] || merged.data[2]);
        if (!hasDataAlready && promptMap) {
          const looked = lookupDataForValue(bareValue, promptMap);
          if (looked[0] || looked[1] || looked[2]) merged.data = looked;
        }
        return merged;
      }

      const newEl = {
        id: Date.now() + Math.random() + index,
        sort: index,
        Value: bareValue,
        data: lookupDataForValue(bareValue, promptMap),
        SD: { weight: 0 },
        NAI: { weight: 0 },
        NAIv45: { weight: 1 },
        None: { weight: 0 },
      };
      if (resolvedWeight !== null) {
        newEl[shaping] = { weight: resolvedWeight };
      }
      return newEl;
    };

    const regeneratePromptFromElements = (elements, shaping) => {
      if (typeof WeightConverter === "undefined") return null;
      return elements
        .slice()
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((el) => {
          const w = el[shaping]?.weight;
          if (w !== undefined && w !== null) {
            return WeightConverter.applyWeightToPrompt(shaping, el.Value, w);
          }
          return el.Value;
        })
        .filter((v) => v)
        .join(",");
    };

    const rebuildSlotFromPromptText = (slot, text) => {
      slot.prompt = text;

      const newPrompts = text.split(",").map((p) => p.trim()).filter((p) => p);

      const existingMap = new Map();
      if (slot.elements) {
        slot.elements.forEach((el) => {
          if (el && el.Value) existingMap.set(el.Value.toLowerCase().trim(), el);
        });
      }

      const shaping = AppState.userSettings?.optionData?.shaping || "SD";

      let promptMap = null;
      try {
        if (window.ElementSync && typeof window.ElementSync.buildPromptMap === "function") {
          promptMap = window.ElementSync.buildPromptMap(this.buildAllDictionaryEntries());
        }
      } catch (e) {}

      slot.elements = newPrompts.map((p, i) => buildElementFromPrompt(p, i, existingMap, shaping, promptMap));

      const regenerated = regeneratePromptFromElements(slot.elements, shaping);
      if (regenerated !== null && regenerated !== text) {
        slot.prompt = regenerated;
      }

      slot.lastModified = Date.now();
      return slot.prompt;
    };

    const handlePromptSave = async () => {
      const generatePromptEl = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      const rawValue = generatePromptEl ? generatePromptEl.value : "";

      if (rawValue === previousPromptValue) return;

      let finalValue = rawValue;

      if (window.promptSlotManager) {
        const currentSlot = SlotUtils.getCurrentSlot();
        if (currentSlot) {
          if (currentSlot.mode === "random" || currentSlot.mode === "sequential") return;

          finalValue = rebuildSlotFromPromptText(currentSlot, rawValue);
          if (generatePromptEl && generatePromptEl.value !== finalValue) {
            generatePromptEl.value = finalValue;
          }
          previousPromptValue = finalValue;
        }
      }

      this.updatePromptDisplay();

      if (window.promptSlotManager) {
        await promptSlotManager.saveCurrentSlot();
      }

      promptSlotManager.updateUI();

      try {
        await ListRefreshManager.executeAction(ListRefreshManager.ACTIONS.PROMPT_CHANGE, {
          context: { newPrompt: finalValue, source: "manual_input" },
          delay: 0,
        });
      } catch (error) {}

      if (this.tabs && this.tabs.edit && this.tabs.edit.isActive) {
        await this.tabs.edit.refreshEditList();
      }
    };

    const promptInput = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (promptInput) {
      previousPromptValue = promptInput.value || "";

      promptInput.addEventListener(DOM_EVENTS.KEY_DOWN, (e) => {
        if (e.key === "Enter") handlePromptSave();
      });

      promptInput.addEventListener(DOM_EVENTS.BLUR, handlePromptSave);

      // 異なる shaping の記法を含むペーストを即時に現 shaping 表記へ正規化
      promptInput.addEventListener("paste", () => {
        setTimeout(() => {
          if (typeof WeightConverter === "undefined") return;
          const value = promptInput.value || "";
          if (!value) return;
          const targetShaping = AppState.userSettings?.optionData?.shaping || "SD";
          const normalized = WeightConverter.normalizePromptToShaping(value, targetShaping);
          if (normalized !== value) {
            promptInput.value = normalized;
          }
        }, 0);
      });
    }
  }
  setupPromptSlotHandlers() {
    const slotSelector = document.getElementById(DOM_IDS.SLOT.SELECTOR);
    if (slotSelector) {
      slotSelector.addEventListener(DOM_EVENTS.CHANGE, async (e) => {
        const slotId = parseInt(e.target.value);
        await promptSlotManager.switchSlot(slotId);

        window.dispatchEvent(
          new CustomEvent("slotChanged", {
            detail: { slotId: slotId },
          })
        );
      });
    }

    window.addEventListener("slotExtractionComplete", (event) => {
      const { slotId, extraction } = event.detail;
      const currentSlot = SlotUtils.getCurrentSlot();

      if (currentSlot && currentSlot.id === slotId) {
        const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePrompt && currentSlot.mode !== "normal") {
          const weightedPrompt = promptSlotManager.applyWeightToPrompt(extraction, currentSlot.weight);
          generatePrompt.value = weightedPrompt;
          generatePrompt.readOnly = true;
          generatePrompt.title = "抽出モードで生成されたプロンプト（読み取り専用）";
        }
      }
    });
  }

  updatePromptDisplay() {
    const currentSlot = SlotUtils.getCurrentSlot();
    const newPrompt = currentSlot?.prompt || "";
    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);

    if (generatePrompt) {
      if (typeof promptSlotManager === "undefined" || !promptSlotManager.slots) {
        if (generatePrompt.value !== newPrompt) {
          generatePrompt.value = newPrompt;
        }
        return;
      }

      if (currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential")) {
        return; // 抽出モードの場合は更新しない
      }

      const currentValue = generatePrompt.value;

      if (newPrompt !== currentValue) {
        generatePrompt.value = newPrompt;
        promptSlotManager.saveCurrentSlot();
      }
    }
  }

  refreshAddList() {
    if (this.listManager) {
      this.listManager.createFlexibleList(AppState.data.localPromptList, "#addList", {
        fields: STANDARD_CATEGORY_FIELDS,
        buttons: STANDARD_BUTTONS,
        sortable: true,
        listType: "add",
        idOffset: ID_OFFSETS.USER_DICTIONARY,
      });
    }
  }

  setupButtonHandlers() {
    const copyButton = document.getElementById(DOM_IDS.BUTTONS.COPY);
    if (copyButton) {
      copyButton.addEventListener(DOM_EVENTS.CLICK, () => this.copyPrompt());
    }

    const clearButton = document.getElementById(DOM_IDS.BUTTONS.CLEAR);
    if (clearButton) {
      clearButton.addEventListener(DOM_EVENTS.CLICK, () => this.clearPrompt());
    }

    const saveButton = document.getElementById(DOM_IDS.BUTTONS.SAVE);
    if (saveButton) {
      saveButton.addEventListener(DOM_EVENTS.CLICK, () => this.favoriteList());
    }

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.addEventListener(DOM_EVENTS.MOUSE_ENTER, () => {
        const hasExtractionSlots = promptSlotManager.slots.some(
          (slot) => slot.mode === "random" || slot.mode === "sequential"
        );

        if (hasExtractionSlots) {
          const extractionSlots = promptSlotManager.slots.filter(
            (slot) => slot.mode === "random" || slot.mode === "sequential"
          ).length;
          generateButton.title = `抽出モード (${extractionSlots}個のスロット)\nGenerateをクリックして抽出を実行`;
        } else {
          const usedSlots = promptSlotManager.getUsedSlots();

          if (usedSlots.length > 1) {
            const normalPrompts = promptSlotManager.slots
              .filter((slot) => slot.isUsed && slot.prompt && (!slot.mode || slot.mode === "normal"))
              .map((slot) => slot.prompt.trim())
              .filter((p) => p.length > 0);
            const preview = normalPrompts.join(", ").substring(0, 100);
            generateButton.title = `結合プロンプト (${normalPrompts.length}個):\n${preview}...`;
          } else if (usedSlots.length === 1) {
            generateButton.title = "現在のプロンプトで生成";
          } else {
            generateButton.title = "使用中のプロンプトがありません";
          }
        }
      });

      generateButton.addEventListener(DOM_EVENTS.CLICK, () => this.generatePrompt());
    }

    const previewPositiveCopy = document.getElementById(DOM_IDS.BUTTONS.PREVIEW_POSITIVE_COPY);
    if (previewPositiveCopy) {
      previewPositiveCopy.addEventListener(DOM_EVENTS.CLICK, () => {
        const previewPrompt = document.getElementById(DOM_IDS.OTHER.PREVIEW_PROMPT);
        if (previewPrompt) {
          navigator.clipboard.writeText(previewPrompt.value);
        }
      });
    }

    const previewNegativeCopy = document.getElementById(DOM_IDS.BUTTONS.PREVIEW_NEGATIVE_COPY);
    if (previewNegativeCopy) {
      previewNegativeCopy.addEventListener(DOM_EVENTS.CLICK, () => {
        const negativePrompt = document.getElementById(DOM_IDS.OTHER.NEGATIVE_PROMPT);
        if (negativePrompt) {
          navigator.clipboard.writeText(negativePrompt.value);
        }
      });
    }

    const resetButton = document.getElementById(DOM_IDS.BUTTONS.RESET);
    if (resetButton) {
      resetButton.addEventListener(DOM_EVENTS.CLICK, () => {
        if (confirm(CONFIRM_MESSAGES.RESET_ALL_DATA)) {
          chrome.storage.local.clear(() => {
            location.reload();
          });
        }
      });
    }
  }

  copyPrompt() {
    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    const prompt = generatePrompt ? generatePrompt.value : "";
    navigator.clipboard.writeText(prompt);

    UIHelpers.notifySuccess("プロンプトをコピーしました", 1500);
  }

  async clearPrompt() {
    if (window.promptSlotManager) {
      const currentSlot = SlotUtils.getCurrentSlot();
      if (currentSlot) {
        currentSlot.prompt = "";
        currentSlot.elements = [];
      }
    }

    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (generatePrompt) {
      generatePrompt.value = "";
    }
    savePrompt();

    if (window.promptSlotManager) {
      await promptSlotManager.saveCurrentSlot();
    }

    if (window.promptSlotManager) {
      promptSlotManager.updateUI();

      if (window.app?.tabs?.slot) {
        const slotTab = window.app.tabs.slot;
        if (typeof slotTab.updateDisplay === "function") {
          slotTab.updateDisplay();
        }
      }
    }

    try {
      await ListRefreshManager.executeAction(ListRefreshManager.ACTIONS.PROMPT_CHANGE, {
        context: {
          newPrompt: "",
          source: "clear_button",
        },
        delay: 0,
      });
    } catch (error) {}
  }

  async favoriteList() {
    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    const prompt = generatePrompt ? generatePrompt.value : "";

    if (!prompt) {
      ErrorHandler.notify("プロンプトが入力されていません");
      return;
    }

    const currentDictId = AppState.data.currentPromptDictionary || "main";
    const currentDict = AppState.data.promptDictionaries?.[currentDictId];

    if (!currentDict) {
      ErrorHandler.notify("辞書が選択されていません");
      return;
    }

    if (!currentDict.prompts) {
      currentDict.prompts = [];
    }

    const validation = Validators.checkDuplicateFavorite(prompt, currentDict.prompts);
    if (!validation.isValid) {
      ErrorHandler.notify(validation.message);
      return;
    }

    const newFavoriteItem = {
      id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: "",
      prompt: prompt,
      sort: currentDict.prompts.length,
    };
    currentDict.prompts.push(newFavoriteItem);
    await savePromptDictionaries();

    if (this.tabs.dictionary) {
      this.tabs.dictionary.updateStats();

      if (AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
        try {
          await this.tabs.dictionary.refreshFavoriteList();
        } catch (error) {}
      }

      // 遅延を入れて再度更新（データの保存完了を確実にするため）
      setTimeout(async () => {
        this.tabs.dictionary.updateStats();
        if (AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
          try {
            await this.tabs.dictionary.refreshFavoriteList();
          } catch (error) {}
        }
      }, 300);
    }

    // 明示的にバックグラウンドに通知（念のため）
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: CHROME_MESSAGES.UPDATE_PROMPT_LIST }, (response) => {});
    }, 200);

    UIHelpers.notifySuccess("プロンプトを辞書に追加しました", 1500);
  }

  async generatePrompt() {
    const isAutoGenerateClick = window.autoGenerateHandler?.isInternalClick;
    const isLoraGenerateClick = window.loraGenerateHandler?.isInternalClick;

    if (!isAutoGenerateClick && !isLoraGenerateClick) {
      const hasSelectors = AppState.selector.positiveSelector && AppState.selector.generateSelector;

      if (!hasSelectors) {
        UIHelpers.notifyWarning(
          "セレクターが正しく設定されていない可能性があります。その他タブの「セレクター設定」でプロンプト入力欄とGenerateボタンのセレクターが有効かどうか確認してみてください。",
          NOTIFICATION_DURATION.LONG
        );
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["js/content.js"],
            });
          } catch (injectError) {}

          const positiveResponse = await chrome.tabs.sendMessage(tab.id, {
            action: "validateSelector",
            selector: AppState.selector.positiveSelector,
          });

          const generateResponse = await chrome.tabs.sendMessage(tab.id, {
            action: "validateSelector",
            selector: AppState.selector.generateSelector,
          });

          if (this.tabs.other) {
            this.tabs.other.validateSelector("selector-positive", AppState.selector.positiveSelector);
            this.tabs.other.validateSelector("selector-generate", AppState.selector.generateSelector);
          }

          if (!positiveResponse?.valid || !generateResponse?.valid) {
            UIHelpers.notifyWarning(
              "セレクターが正しく設定されていない可能性があります。その他タブの「セレクター設定」でプロンプト入力欄とGenerateボタンのセレクターが有効かどうか確認してみてください。",
              NOTIFICATION_DURATION.LONG
            );
            return;
          }
        }
      } catch (error) {
        if (this.tabs.other) {
          this.tabs.other.validateSelector("selector-positive", AppState.selector.positiveSelector);
          this.tabs.other.validateSelector("selector-generate", AppState.selector.generateSelector);
        }
        UIHelpers.notifyWarning(
          "セレクターが正しく設定されていない可能性があります。その他タブの「セレクター設定」でプロンプト入力欄とGenerateボタンのセレクターが有効かどうか確認してみてください。",
          NOTIFICATION_DURATION.LONG
        );
        return;
      }
    }

    if (
      window.autoGenerateHandler &&
      window.autoGenerateHandler.isRunning &&
      !window.autoGenerateHandler.isInternalClick
    ) {
      window.autoGenerateHandler.stop();
      return;
    }

    if (
      window.loraGenerateHandler &&
      window.loraGenerateHandler.isRunning &&
      !window.loraGenerateHandler.isInternalClick
    ) {
      window.loraGenerateHandler.stop();
      return;
    }

    const hasExtractionSlots = promptSlotManager.slots.some(
      (slot) => slot.mode === "random" || slot.mode === "sequential"
    );

    let targetPrompt;
    let usedSlots = [];

    if (window.loraGenerateHandler && window.loraGenerateHandler.isRunning && window.loraGenerateHandler.currentPrompt) {
      targetPrompt = window.loraGenerateHandler.currentPrompt;
    } else if (window.autoGenerateHandler && window.autoGenerateHandler.historyPrompt) {
      targetPrompt = window.autoGenerateHandler.historyPrompt;
    } else {
      targetPrompt = promptSlotManager.getCombinedPrompt();
      usedSlots = promptSlotManager.getUsedSlots();
    }

    if (!targetPrompt) {
      UIHelpers.notifyWarning("使用中のプロンプトがありません");
      return;
    }

    sendBackground(
      CHROME_MESSAGES.DOM_GENERATE,
      "Generate",
      targetPrompt,
      AppState.selector.positiveSelector,
      AppState.selector.generateSelector
    );

    if (window.loraGenerateHandler && window.loraGenerateHandler.isRunning && window.loraGenerateHandler.currentPrompt) {
      // LoRA生成中は通知不要（LoraGenerateHandler側で表示済み）
    } else if (window.autoGenerateHandler && window.autoGenerateHandler.historyPrompt) {
      UIHelpers.notifyInfo("履歴プロンプトで生成します", 2000);
    } else {
      UIHelpers.notifyInfo(`${usedSlots.length}個のスロットを結合して生成します`, 2000);
    }

    if (AppState.ui.currentTab === CONSTANTS.TABS.SLOT && this.tabs.slot) {
      setTimeout(() => {
        this.tabs.slot.refreshExtractionDisplays();
      }, 100);
    }
  }

  setupOptionHandlers() {
    const isDeleteCheck = document.getElementById(DOM_IDS.OTHER.DELETE_CHECK);
    if (isDeleteCheck) {
      isDeleteCheck.addEventListener(DOM_EVENTS.CHANGE, (e) => {
        AppState.userSettings.optionData.isDeleteCheck = e.target.checked;
        saveOptionData();
      });
    }

    const deeplAuth = document.getElementById(DOM_IDS.OTHER.DEEPL_AUTH);
    if (deeplAuth) {
      deeplAuth.addEventListener(DOM_EVENTS.CHANGE, (e) => {
        const apiKey = e.target.value;
        const validation = Validators.validateApiKey(apiKey, "DeepL");

        if (!validation.isValid) {
          ErrorHandler.showInlineError("#DeeplAuth", validation.message);
          return;
        }

        AppState.userSettings.optionData.deeplAuthKey = apiKey;
        saveOptionData();
      });
    }

    const historyMaxSize = document.getElementById(DOM_IDS.OTHER.HISTORY_MAX_SIZE);
    if (historyMaxSize) {
      historyMaxSize.addEventListener(DOM_EVENTS.CHANGE, (e) => {
        const maxSize = parseInt(e.target.value);

        if (isNaN(maxSize) || maxSize < 10 || maxSize > 200) {
          UIHelpers.notifyWarning("最大保持件数は10-200件の範囲で設定してください", 3000);

          e.target.value = AppState.userSettings.optionData.historyMaxSize || 50;
          return;
        }

        AppState.userSettings.optionData.historyMaxSize = maxSize;
        saveOptionData();

        if (this.historyManager) {
          this.historyManager.updateMaxSize(maxSize);
        }

        UIHelpers.notifySuccess(`履歴の最大保持件数を${maxSize}件に設定しました`, 2000);
      });
    }

    const exportSettingsBtn = document.getElementById(DOM_IDS.OTHER.EXPORT_SETTINGS);
    if (exportSettingsBtn) {
      exportSettingsBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        settingsManager.downloadExport();
      });
    }

    const importSettingsBtn = document.getElementById(DOM_IDS.OTHER.IMPORT_SETTINGS);
    if (importSettingsBtn) {
      importSettingsBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        const mergeMode = document.getElementById(DOM_IDS.OTHER.IMPORT_MERGE_MODE).checked;

        settingsManager.selectAndImport({
          includeSettings: true,
          includeLocalDict: true,
          includeFavorits: true,
          includeCategories: true,
          includeMaster: false, // マスターデータは通常除外
          merge: mergeMode,
        });
      });
    }
  }

  setupSortableLists() {
    EventHandlers.setupSortableList(DOM_SELECTORS.BY_ID.EDIT_LIST, (sortedIds) => {
      this.updatePromptDisplay();
    });
  }

  updateUIState() {
    // GenerateボタンON表示の更新（UIタイプ制限を削除）
    if (AppState.selector.positiveSelector != null && AppState.selector.generateSelector != null) {
      const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
      if (generateButton) {
        generateButton.classList.remove("hidden");
        generateButton.classList.add("show-block");
      }
    }
  }

  updateGeneratePromptForExtraction() {
    try {
      const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      if (generatePrompt) {
        const currentSlotInfo = this.getCurrentSlotExtractionInfo();
        generatePrompt.value = currentSlotInfo;
        generatePrompt.readOnly = true;
        generatePrompt.title = "抽出モードで生成されたプロンプト（読み取り専用）";

        if (this.tabs && this.tabs.edit && this.tabs.edit.extractionModeActive) {
          this.tabs.edit.setGeneratePromptExtractionMode();
        }
      }
    } catch (error) {}
  }

  getCurrentSlotExtractionInfo() {
    try {
      if (!window.promptSlotManager || !window.promptSlotManager.slots) {
        return "";
      }

      const currentSlot = SlotUtils.getCurrentSlot();
      if (!currentSlot) {
        return "";
      }

      if (currentSlot.mode === "random" || currentSlot.mode === "sequential") {
        if (currentSlot.currentExtraction) {
          return window.promptSlotManager.applyWeightToPrompt(currentSlot.currentExtraction, currentSlot.weight);
        } else {
          return "[抽出待機中]";
        }
      }

      if (currentSlot.mode === "single") {
        if (currentSlot.currentExtraction) {
          const spaceConverted = currentSlot.currentExtraction.replace(/,/g, " ");
          return window.promptSlotManager.applyWeightToPrompt(spaceConverted, currentSlot.weight);
        } else {
          return "[抽出待機中]";
        }
      }

      return currentSlot.prompt || "";
    } catch (error) {
      return "";
    }
  }

  updateSettingsUI() {
    const isDeleteCheck = document.getElementById(DOM_IDS.OTHER.DELETE_CHECK);
    if (isDeleteCheck) {
      isDeleteCheck.checked = AppState.userSettings.optionData.isDeleteCheck !== false;
    }

    const deeplAuth = document.getElementById(DOM_IDS.OTHER.DEEPL_AUTH);
    if (deeplAuth) {
      deeplAuth.value = AppState.userSettings.optionData.deeplAuthKey || "";
    }

    const checkPromptConflict = document.getElementById(DOM_IDS.BUTTONS.CHECK_PROMPT_CONFLICT);
    if (checkPromptConflict) {
      checkPromptConflict.checked = AppState.userSettings.optionData.checkPromptConflict === true;
    }

    const historyMaxSize = document.getElementById(DOM_IDS.OTHER.HISTORY_MAX_SIZE);
    if (historyMaxSize) {
      historyMaxSize.value = AppState.userSettings.optionData.historyMaxSize || 50;
    }
  }

  async checkDuplicatesOnStartup() {
    try {
      const dismissed = window.loadDuplicateCheckDismissed ? await window.loadDuplicateCheckDismissed() : false;

      if (dismissed) {
        return;
      }

      const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];

      if (duplicates.length > 0) {
        if (this.tabs.dictionary && this.tabs.dictionary.showDuplicateCheckModal) {
          await this.tabs.dictionary.showDuplicateCheckModal(true);
        }
      }
    } catch (error) {}
  }

  buildAllDictionaryEntries() {
    const allPrompts = [];
    try {
      if (Array.isArray(AppState.data.localPromptList)) {
        allPrompts.push(...AppState.data.localPromptList);
      }
      if (typeof getMasterPrompts === "function") {
        const master = getMasterPrompts();
        if (Array.isArray(master)) allPrompts.push(...master);
      }
      const favoriteDicts = AppState.data.promptDictionaries || {};
      Object.values(favoriteDicts).forEach((dict) => {
        if (!dict?.prompts) return;
        dict.prompts.forEach((item) => {
          if (!item?.prompt) return;
          allPrompts.push({
            prompt: item.prompt,
            data: [dict.name || "お気に入り", item.title || "", ""],
          });
        });
      });
    } catch (error) {
      ErrorHandler.log("buildAllDictionaryEntries failed", error);
    }
    return allPrompts;
  }

  autoRepairSlotElements() {
    try {
      if (!window.ElementSync || typeof window.ElementSync.autoRepairElements !== "function") return;
      if (!window.promptSlotManager?.slots?.length) return;

      const allPrompts = this.buildAllDictionaryEntries();

      let totalRepaired = 0;
      window.promptSlotManager.slots.forEach((slot) => {
        if (!slot || !Array.isArray(slot.elements) || slot.elements.length === 0) return;
        if (slot.mode && slot.mode !== "normal") return;

        const { repaired, hasChanges } = window.ElementSync.autoRepairElements(slot.elements, allPrompts);
        if (hasChanges) {
          const before = slot.elements.filter((el) => el && !el.Value && el.data?.some((d) => d)).length;
          const after = repaired.filter((el) => el && !el.Value && el.data?.some((d) => d)).length;
          totalRepaired += Math.max(0, before - after);
          slot.elements = repaired;
        }
      });

      if (totalRepaired > 0) {
        console.log(`[AutoRepair] ${totalRepaired} orphan element(s) restored from dictionary`);
        promptSlotManager.saveToStorage().catch(() => {});
      }
    } catch (error) {
      ErrorHandler.log("autoRepairSlotElements failed", error);
    }
  }

  migrationDryRun() {
    try {
      if (!window.PromptMigration || typeof window.PromptMigration.detectSchemaVersion !== "function") return;
      if (!window.slotGroupManager?.groups || typeof window.slotGroupManager.groups.values !== "function") return;

      const groups = Array.from(window.slotGroupManager.groups.values());
      if (groups.length === 0) return;

      const lines = [];
      let v1Count = 0;
      let v2Count = 0;

      groups.forEach((group) => {
        const name = group?.name || group?.id || "(unnamed)";
        try {
          const version = window.PromptMigration.detectSchemaVersion(group);
          if (version === 2) {
            v2Count += 1;
            const elementCount = Array.isArray(group.elements) ? group.elements.length : 0;
            const validation = window.PromptMigration.validateMigratedData([group]);
            const status = validation.valid ? "✓ valid" : `⚠ invalid (${validation.errors.length} error(s))`;
            lines.push(`  - "${name}" (v2): already migrated, ${elementCount} elements ${status}`);
            if (!validation.valid) validation.errors.forEach((e) => lines.push(`      - ${e}`));
          } else {
            v1Count += 1;
            const slotCount = Array.isArray(group.slots) ? group.slots.length : 0;
            const migrated = window.PromptMigration.migrateSlotGroup(group);
            const validation = window.PromptMigration.validateMigratedData([migrated]);
            const status = validation.valid ? "✓ valid" : `⚠ validation failed`;
            lines.push(`  - "${name}" (v1): ${slotCount} slots → ${migrated.elements.length} elements ${status}`);
            if (!validation.valid) validation.errors.forEach((e) => lines.push(`      - ${e}`));
          }
        } catch (innerError) {
          lines.push(`  - "${name}": dry-run error: ${innerError?.message || innerError}`);
        }
      });

      console.log(
        `[Migration Dry-Run] Detected ${groups.length} groups (v1: ${v1Count}, v2: ${v2Count})\n${lines.join("\n")}`
      );
    } catch (error) {
      ErrorHandler.log("migrationDryRun failed", error);
    }
  }

  setupCloseHandlers() {
    window.addEventListener("beforeunload", async () => {
      if (window.promptSlotManager) {
        await promptSlotManager.saveCurrentSlot();
      }
    });

    window.addEventListener("unload", async () => {
      if (window.promptSlotManager) {
        await promptSlotManager.saveCurrentSlot();
      }
    });

    // visibility change でも保存（念のため）
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) {
        if (window.promptSlotManager) {
          await promptSlotManager.saveCurrentSlot();
        }
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener(DOM_EVENTS.DOM_CONTENT_LOADED, async () => {
    try {
      window.app = new PromptGeneratorApp();
      await window.app.init();

      window.editElementManager = new EditElementManager(window.app);

      if (window.FlexibleElementManager) {
        window.flexibleElementManager = new FlexibleElementManager(window.app.listManager);
      }
    } catch (error) {
      alert("アプリケーションの初期化に失敗しました。ページを再読み込みしてください。");
    }
  });
} else {
  (async () => {
    try {
      window.app = new PromptGeneratorApp();
      await window.app.init();

      window.editElementManager = new EditElementManager(window.app);

      if (window.FlexibleElementManager) {
        window.flexibleElementManager = new FlexibleElementManager(window.app.listManager);
      }
    } catch (error) {
      alert("アプリケーションの初期化に失敗しました。ページを再読み込みしてください。");
    }
  })();
}
