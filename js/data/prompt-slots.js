class PromptSlotManager {
  constructor() {
    this.minSlots = PROMPT_SLOTS.MIN_SLOTS;
    this.maxSlots = PROMPT_SLOTS.MAX_SLOTS;
    this.currentSlot = 0;
    this.slots = [];
    this._nextId = 0;
  }

  initializeSlots(count = PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS) {
    this.slots = [];
    this._nextId = 0;

    for (let i = 0; i < count; i++) {
      const newSlot = {
        id: this._nextId++,
        name: "",
        prompt: "",
        elements: [],
        isUsed: false,
        lastModified: null,
        mode: "normal", // 'normal' | 'random' | 'sequential'
        category: { big: "", middle: "" },
        sequentialIndex: 0,
        currentExtraction: null,
        lastExtractionTime: null,
        absoluteWeight: this.getDefaultWeight(), // 現在の形式に応じたデフォルト重み
        weight: this.getDefaultWeight(), // 表示用重み（デフォルト値で初期化）
        muted: false, // ミュート状態
        dataSource: "dictionary", // 'dictionary' | 'favorites'
        favoriteDictionaryId: "", // お気に入り辞書のID
      };
      this.slots.push(newSlot);

      this.initializeSlotWeight(newSlot);
    }
  }

  addNewSlot() {
    if (this.slots.length >= this.maxSlots) {
      UIHelpers.notifyWarning(`スロットは最大${this.maxSlots}個までです`);
      return null;
    }

    const newSlot = {
      id: this._nextId++,
      name: "",
      prompt: "",
      elements: [],
      isUsed: false,
      lastModified: null,
      mode: "normal",
      category: { big: "", middle: "" },
      sequentialIndex: 0,
      currentExtraction: null,
      lastExtractionTime: null,
      absoluteWeight: this.getDefaultWeight(), // 現在の形式に応じたデフォルト重み
      weight: this.getDefaultWeight(), // 表示用重み（デフォルト値で初期化）
      muted: false, // ミュート状態
      dataSource: "dictionary", // 'dictionary' | 'favorites'
      favoriteDictionaryId: "", // お気に入り辞書のID
    };

    this.slots.push(newSlot);

    this.initializeSlotWeight(newSlot);

    this.updateUI();
    this.saveToStorage();

    UIHelpers.notifySuccess(`スロット${this.slots.length}を追加しました`, NOTIFICATION_DURATION.SHORT);

    return newSlot;
  }

  deleteSlot(slotId) {
    if (this.slots.length <= this.minSlots) {
      UIHelpers.notifyWarning(`スロットは最低${this.minSlots}個必要です`);
      return false;
    }

    const slotIndex = this.slots.findIndex((slot) => slot.id === slotId);
    if (slotIndex === this.currentSlot) {
      UIHelpers.notifyWarning("選択中のスロットは削除できません");
      return false;
    }

    if (slotIndex === -1) {
      return false;
    }

    this.slots.splice(slotIndex, 1);

    if (this.currentSlot > slotIndex) {
      this.currentSlot--;
    }

    this.updateUI();
    this.saveToStorage();

    UIHelpers.notifySuccess("スロットを削除しました", NOTIFICATION_DURATION.SHORT);

    return true;
  }

  async switchSlot(slotId) {
    const slotIndex = this.slots.findIndex((slot) => slot.id === slotId);
    if (slotIndex === -1) {
      return false;
    }

    if (slotIndex === this.currentSlot) {
      return true;
    }

    try {
      await this.saveCurrentSlot();
    } catch (error) {}

    this.currentSlot = slotIndex;
    const slot = this.slots[slotIndex];

    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (generatePrompt) {
      try {
        const displayValue = this.getSlotDisplayValue(slot);
        if (displayValue) {
          generatePrompt.value = displayValue;
        } else {
          generatePrompt.value =
            slot.mode === "random" || slot.mode === "sequential" || slot.mode === "single"
              ? "[抽出待機中 - Generateボタンを押して抽出]"
              : "";
        }

        generatePrompt.readOnly = slot.mode === "random" || slot.mode === "sequential";
        if (slot.mode === "single") {
          generatePrompt.title = "単一モード：内部はカンマ区切り、表示はスペース区切り（編集可能）";
        } else {
          generatePrompt.title = generatePrompt.readOnly ? "抽出モードで生成されたプロンプト（読み取り専用）" : "";
        }
      } catch (error) {}
    }

    this.updateUI();
    this.onSlotChanged(slotIndex);
    await this.saveToStorage();

    if (window.app && window.app.tabs && window.app.tabs.edit && window.app.tabs.edit.isActive) {
      setTimeout(async () => {
        const currentSlot = this.slots[this.currentSlot];
        const isExtractionMode = currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential");

        if (window.app.tabs.edit.updateSlotIntegrationPanel) {
          window.app.tabs.edit.updateSlotIntegrationPanel();
        }

        if (isExtractionMode) {
          window.app.tabs.edit.extractionModeActive = true;
          window.app.tabs.edit.showExtractionModeWithEmptyState();
        } else {
          window.app.tabs.edit.extractionModeActive = false;
          window.app.tabs.edit.editHandler.initializeEditMode();
        }
      }, 50);
    }

    return true;
  }

  getSlotDisplayValue(slot) {
    if (!slot || !slot.prompt) {
      return "";
    }

    if (slot.mode === "single") {
      return slot.prompt.replace(/,/g, " ");
    }

    return slot.prompt;
  }

  extractElement(slot) {
    if (slot.mode !== "random" && slot.mode !== "sequential") {
      return slot.prompt || "";
    }

    let filtered = [];

    if (slot.dataSource === "favorites") {
      if (!this.validateFavoriteDictionary(slot.favoriteDictionaryId)) {
        this.handleMissingDictionary(slot);
        return "";
      }
      filtered = this.getFavoritePrompts(slot.favoriteDictionaryId);
    } else {
      const allPrompts = [...AppState.data.localPromptList, ...getMasterPrompts()];

      filtered = allPrompts;

      if (slot.category && slot.category.big) {
        filtered = filtered.filter((item) => item.data[0] === slot.category.big);

        if (slot.category.middle) {
          filtered = filtered.filter((item) => item.data[1] === slot.category.middle);
        }
      }
    }

    if (filtered.length === 0) {
      let errorMessage;
      if (slot.dataSource === "favorites") {
        if (!slot.favoriteDictionaryId) {
          errorMessage = ERROR_MESSAGES.SLOT_FAVORITES_NOT_FOUND;
        } else {
          errorMessage = ERROR_MESSAGES.SLOT_FAVORITES_EMPTY;
        }
      } else {
        errorMessage = ERROR_MESSAGES.SLOT_EXTRACTION_FAILED;
      }

      if (window.ErrorHandler) {
        UIHelpers.notifyWarning(errorMessage, 3000);
      }

      slot.currentExtraction = null;
      return "";
    }

    let selectedElement;

    if (slot.mode === "random") {
      const randomIndex = Math.floor(Math.random() * filtered.length);
      selectedElement = filtered[randomIndex];
    } else {
      slot.sequentialIndex = (slot.sequentialIndex || 0) % filtered.length;
      selectedElement = filtered[slot.sequentialIndex];
      slot.sequentialIndex++;
    }

    slot.currentExtraction = selectedElement.prompt;
    slot.currentExtractionSmall = selectedElement.data && selectedElement.data[2] ? selectedElement.data[2] : null;
    slot.lastExtractionTime = Date.now();

    slot.prompt = selectedElement.prompt;
    slot.isUsed = true;
    slot.lastModified = Date.now();

    this.onExtractionComplete(slot);

    // UIに反映するため保存（既存のコード）
    this.saveToStorage();

    return this.applyWeightToPrompt(selectedElement.prompt, slot.weight);
  }

  validateFavoriteDictionary(dictionaryId) {
    if (!dictionaryId) {
      return false;
    }

    const allDictionaries = AppState.data.promptDictionaries || {};
    return dictionaryId in allDictionaries;
  }

  handleMissingDictionary(slot) {
    slot.favoriteDictionaryId = "";
    slot.currentExtraction = null;

    const allDictionaries = AppState.data.promptDictionaries || {};
    const availableDictionaries = Object.keys(allDictionaries);

    let errorMessage;
    if (availableDictionaries.length > 0) {
      const firstDictionaryId = availableDictionaries[0];
      slot.favoriteDictionaryId = firstDictionaryId;

      const firstDictName = allDictionaries[firstDictionaryId]?.name || "お気に入りリスト";
      errorMessage = `選択されたお気に入りリストが見つかりません。「${firstDictName}」に自動変更しました。`;
    } else {
      errorMessage = `選択されたお気に入りリストが見つかりません。お気に入りリストを確認してください。`;
    }

    UIHelpers.notifyWarning(errorMessage, 4000);

    this.updateUIAfterDictionaryChange();
  }

  updateUIAfterDictionaryChange() {
    const slotTab = window.app?.tabs?.slot;
    if (slotTab && typeof slotTab.updateDisplay === "function") {
      try {
        slotTab.updateDisplay();
      } catch (error) {}
    }

    this.saveToStorage();
  }

  async waitForDOMGeneration(maxWaitTime = 2000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const editList = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
      if (editList && editList.children.length > 0) {
        const elementWithId = editList.querySelector("[data-element-id]");
        if (elementWithId) {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, UI_DELAYS.EDIT_REFRESH));
    }

    return false;
  }

  validateAllFavoriteDictionaries() {
    let hasInvalidDictionary = false;

    this.slots.forEach((slot) => {
      if (slot.dataSource === "favorites" && slot.favoriteDictionaryId) {
        if (!this.validateFavoriteDictionary(slot.favoriteDictionaryId)) {
          hasInvalidDictionary = true;
          this.handleMissingDictionary(slot);
        }
      }
    });

    return !hasInvalidDictionary;
  }

  getFavoritePrompts(dictionaryId) {
    try {
      const allDictionaries = AppState.data.promptDictionaries || {};

      if (!dictionaryId || !allDictionaries[dictionaryId]) {
        return [];
      }

      const dictionary = allDictionaries[dictionaryId];
      const prompts = dictionary.prompts || [];

      return prompts
        .map((item) => ({
          prompt: item.prompt || item.title || "", // プロンプト本文
          data: [
            dictionary.name || "お気に入り", // 大項目：辞書名
            item.title || "タイトルなし", // 中項目：プロンプトタイトル
            "", // 小項目：空
          ],
          sort: item.sort || 0,
        }))
        .filter((item) => item.prompt.trim() !== ""); // 空のプロンプトを除外
    } catch (error) {
      if (window.ErrorHandler) {
        window.ErrorHandler.handleFileError(error, "お気に入り抽出", dictionaryId);
      }
      return [];
    }
  }

  applyWeightToPrompt(prompt, weight = 1.0) {
    if (!prompt) {
      return prompt;
    }

    const shaping = this.getCurrentShaping();

    if (
      (shaping === "SD" && weight === 1.0) ||
      (shaping === "NAI" && weight === 0) ||
      (shaping === "NAIv45" && weight === 1.0) ||
      shaping === "None"
    ) {
      return prompt;
    }

    const cleanPrompt = prompt.replace(/,\s*$/, "");

    const result = WeightConverter.applyWeightToPrompt(shaping, cleanPrompt, weight);
    return result;
  }

  getCurrentShaping() {
    if (typeof AppState !== "undefined" && AppState.userSettings?.optionData?.shaping) {
      return AppState.userSettings.optionData.shaping;
    } else if (typeof optionData !== "undefined" && optionData?.shaping) {
      return optionData.shaping;
    }
    return "SD"; // デフォルトはSD形式
  }

  initializeSlotWeight(slot) {
    const shaping = this.getCurrentShaping();

    if (shaping === "NAI") {
      slot.weight = WeightConverter.convertSDToNAI(slot.absoluteWeight);
    } else {
      // SD / NAIv45 / None はどれも「直接乗算」値（absoluteWeightをそのまま）
      slot.weight = slot.absoluteWeight;
    }
  }

  getDefaultWeight() {
    const shaping = this.getCurrentShaping();

    switch (shaping) {
      case "SD":
        return 1.0;
      case "NAI":
        return 0.0;
      case "NAIv45":
        return 1.0; // V4.5 では 1.0 が無効化される値
      case "None":
      default:
        return 1.0;
    }
  }

  onExtractionComplete(slot) {
    window.dispatchEvent(
      new CustomEvent("slotExtractionComplete", {
        detail: { slotId: slot.id, extraction: slot.currentExtraction },
      })
    );
  }

  async saveCurrentSlot() {
    if (this._savingInProgress) {
      return;
    }

    if (!this.slots || this.slots.length === 0) {
      return;
    }

    const currentSlot = this.slots[this.currentSlot];
    if (!currentSlot) {
      return;
    }

    this._savingInProgress = true;

    try {
      currentSlot.isUsed = currentSlot.prompt.length > 0;
      currentSlot.lastModified = currentSlot.isUsed ? Date.now() : null;

      await this.saveToStorage();
    } finally {
      this._savingInProgress = false;
    }
  }

  async setSlotName(slotId, name) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.name = name;
      await this.saveToStorage();
      this.updateUI();
    }
  }

  getUsedSlotsCount() {
    return this.slots.filter((slot) => slot.isUsed).length;
  }

  getSlotInfo(slotId) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return null;

    const slotIndex = this.slots.findIndex((s) => s.id === slotId);
    const displayNumber = slotIndex + 1;

    const info = {
      id: slot.id,
      displayNumber: displayNumber,
      name: slot.name || `プロンプト${displayNumber}`,
      isUsed: slot.isUsed || slot.mode !== "normal",
      isCurrent: slotIndex === this.currentSlot,
      preview: slot.prompt ? slot.prompt.substring(0, 20) + "..." : "(空)",
      lastModified: slot.lastModified,
      mode: slot.mode,
    };

    if (slot.mode === "random" || slot.mode === "sequential") {
      info.preview = `[${slot.mode === "random" ? "ランダム" : "連続"}抽出]`;
      if (slot.category && slot.category.big) {
        info.preview += ` ${slot.category.big}`;
        if (slot.category.middle) {
          info.preview += ` > ${slot.category.middle}`;
        }
      }
    }

    return info;
  }

  getAllSlotInfo() {
    return this.slots.map((slot) => this.getSlotInfo(slot.id));
  }

  async saveToStorage() {
    try {
      const dataToSave = {
        promptSlots: {
          currentSlot: this.currentSlot,
          slots: this.slots,
          nextId: this._nextId,
        },
      };

      if (AppState?.data) {
        AppState.data.promptSlots = dataToSave.promptSlots;
      }
      await Storage.set(dataToSave);
    } catch (error) {
      ErrorHandler.log("Failed to save prompt slots", error);
    }
  }

  async loadFromStorage() {
    try {
      let result;
      if (AppState?.data?.promptSlots) {
        result = { promptSlots: AppState.data.promptSlots };
      } else {
        result = await Storage.get("promptSlots");
        if (result.promptSlots && AppState?.data) {
          AppState.data.promptSlots = result.promptSlots;
        }
      }

      if (result.promptSlots && result.promptSlots.slots) {
        this.currentSlot = result.promptSlots.currentSlot || 0;
        this.slots = result.promptSlots.slots || [];
        this._nextId = result.promptSlots.nextId || this.slots.length;

        this.slots = this.slots.map((slot) => ({
          ...slot,
          mode: slot.mode || "normal",
          category: slot.category || { big: "", middle: "" },
          sequentialIndex: slot.sequentialIndex || 0,
          currentExtraction: slot.currentExtraction || null,
          lastExtractionTime: slot.lastExtractionTime || null,
          absoluteWeight: slot.absoluteWeight !== undefined ? slot.absoluteWeight : 1.0, // SD形式の絶対値
          weight: slot.weight !== undefined ? slot.weight : this.getDefaultWeight(), // 重みフィールドの初期化
          muted: slot.muted !== undefined ? slot.muted : false, // ミュート状態の初期化
        }));

        if (this.currentSlot >= this.slots.length) {
          this.currentSlot = 0;
        }

        return true;
      } else {
        this.initializeSlots(PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS);
        return false;
      }
    } catch (error) {
      ErrorHandler.log("Failed to load prompt slots", error);
      this.initializeSlots(PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS);
      return false;
    }
  }

  updateUI() {
    const selector = document.getElementById(DOM_IDS.SLOT.SELECTOR);
    if (!selector) return;

    selector.innerHTML = "";

    this.getAllSlotInfo().forEach((info, index) => {
      const option = document.createElement("option");
      option.value = info.id;

      if (this.slots[index].mode === "random" || this.slots[index].mode === "sequential") {
        option.style.color = "#58a6ff"; // アクセントカラーで抽出モードを示す
      }

      option.textContent = info.isUsed
        ? `${info.displayNumber}: ${info.name || info.preview}`
        : `${info.displayNumber}: (空)`;

      if (info.isCurrent) {
        option.style.fontWeight = "bold";
      }

      selector.appendChild(option);
    });

    const currentSlotId = this.slots[this.currentSlot]?.id;
    if (currentSlotId !== undefined) {
      selector.value = currentSlotId;
    }
  }

  onSlotChanged(slotIndex) {}

  async clearCurrentSlot() {
    const currentSlot = this.slots[this.currentSlot];
    currentSlot.prompt = "";
    currentSlot.elements = [];
    currentSlot.isUsed = false;
    currentSlot.lastModified = null;
    currentSlot.name = "";
    currentSlot.mode = "normal";
    currentSlot.category = { big: "", middle: "" };
    currentSlot.sequentialIndex = 0;
    currentSlot.currentExtraction = null;
    currentSlot.currentExtractionSmall = null;
    currentSlot.lastExtractionTime = null;
    currentSlot.muted = false;

    await this.saveToStorage();
    this.updateUI();
  }

  async clearSlot(slotId) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) {
      return false;
    }

    slot.prompt = "";
    slot.elements = [];
    slot.isUsed = false;
    slot.lastModified = null;
    slot.name = "";
    slot.mode = "normal";
    slot.category = { big: "", middle: "" };
    slot.sequentialIndex = 0;
    slot.currentExtraction = null;
    slot.currentExtractionSmall = null;
    slot.lastExtractionTime = null;
    slot.muted = false;

    await this.saveToStorage();
    this.updateUI();
    return true;
  }

  getCombinedPrompt() {
    this.validateAllFavoriteDictionaries();

    const usedSlots = this.slots.filter((slot) => {
      if (slot.muted) {
        return false;
      }

      const slotMode = slot.mode || "normal";

      if (slotMode === "normal") {
        const shouldInclude = slot.isUsed && slot.prompt;
        return shouldInclude;
      }

      const isExtractionMode = slotMode === "random" || slotMode === "sequential" || slotMode === "single";
      return isExtractionMode;
    });

    if (usedSlots.length === 0) {
      return "";
    }

    const prompts = usedSlots.map((slot, index) => {
      const slotMode = slot.mode || "normal";

      if (slotMode === "random" || slotMode === "sequential") {
        const extracted = this.extractElement(slot);
        return extracted;
      }
      if (slotMode === "single") {
        const basePrompt = slot.prompt ? slot.prompt.trim() : "";
        if (basePrompt) {
          const spacePrompt = basePrompt.replace(/,/g, " ");
          const weightedPrompt = this.applyWeightToPrompt(spacePrompt, slot.weight);
          return weightedPrompt;
        }
        return "";
      }
      const basePrompt = slot.prompt ? slot.prompt.trim() : "";
      if (basePrompt) {
        const weightedPrompt = this.applyWeightToPrompt(basePrompt, slot.weight);
        return weightedPrompt;
      }
      return "";
    });

    const validPrompts = prompts.filter((prompt) => prompt && prompt.length > 0);
    if (validPrompts.length === 0) {
      return "";
    }

    const combined = validPrompts.join(",");

    const normalized = combined
      .replace(/,\s*,+/g, ",")
      .replace(/^\s*,\s*$/, "")
      .replace(/\s*,\s*/g, ", ");

    window.dispatchEvent(new CustomEvent("allExtractionsComplete"));

    return normalized;
  }

  getUsedSlots() {
    return this.slots
      .map((slot, currentIndex) => {
        if (
          !slot.muted && // ミュートされていないスロットのみ
          (slot.isUsed || slot.mode === "random" || slot.mode === "sequential")
        ) {
          const info = {
            id: currentIndex + 1,
            name: slot.name || `スロット${currentIndex + 1}`,
            prompt: slot.prompt,
          };

          if (slot.mode === "random" || slot.mode === "sequential") {
            info.mode = slot.mode;
            info.category = slot.category;
            info.currentExtraction = slot.currentExtraction;
          }

          return info;
        }
        return null;
      })
      .filter((item) => item !== null);
  }

  async clearAllSlots() {
    const currentSlotCount = Math.max(this.slots.length, PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS);
    this.initializeSlots(currentSlotCount);
    this.currentSlot = 0;

    const promptInput = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (promptInput) {
      promptInput.value = "";
    }

    await this.saveToStorage();
    this.updateUI();
  }

  exportSlots() {
    return {
      version: "1.0",
      currentSlot: this.currentSlot,
      slots: this.slots.map((slot) => ({
        ...slot,
        id: undefined,
      })),
      exportDate: new Date().toISOString(),
    };
  }

  async importSlots(data) {
    try {
      if (!data.slots || !Array.isArray(data.slots)) {
        throw new Error("Invalid import data");
      }

      this.slots = [];
      this._nextId = 0;

      data.slots.forEach((slot) => {
        this.slots.push({
          ...slot,
          id: this._nextId++,
          mode: slot.mode || "normal",
          category: slot.category || { big: "", middle: "" },
          sequentialIndex: slot.sequentialIndex || 0,
          currentExtraction: slot.currentExtraction || null,
          lastExtractionTime: slot.lastExtractionTime || null,
        });
      });

      this.currentSlot = 0;
      await this.saveToStorage();
      this.updateUI();

      return true;
    } catch (error) {
      return false;
    }
  }

  async toggleSlotMute(slotId) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) {
      return false;
    }

    slot.muted = !slot.muted;
    await this.saveToStorage();
    this.updateUI();

    window.dispatchEvent(
      new CustomEvent("slotMuteChanged", {
        detail: { slotId: slot.id, muted: slot.muted },
      })
    );

    const action = slot.muted ? "ミュート" : "ミュート解除";
    UIHelpers.notifySuccess(`スロット${slotId}を${action}しました`, NOTIFICATION_DURATION.SHORT);

    return slot.muted;
  }

  reorderSlots(newOrder) {
    // 重要：並び替え前に現在のスロットIDを記録
    const currentSlotIdBeforeReorder = this.slots[this.currentSlot]?.id;

    const reorderedSlots = [];

    newOrder.forEach((slotId) => {
      const slot = this.slots.find((s) => s.id === slotId);
      if (slot) {
        reorderedSlots.push(slot);
      }
    });

    this.slots = reorderedSlots;

    if (currentSlotIdBeforeReorder !== undefined) {
      const newIndex = this.slots.findIndex((s) => s.id === currentSlotIdBeforeReorder);
      if (newIndex !== -1) {
        this.currentSlot = newIndex;
      }
    }

    this.updateUI();
  }

  async waitForDOMGenerationLight() {
    return new Promise((resolve) => {
      const checkDOM = () => {
        const editList = document.querySelector("#editList-list");
        const hasRows = editList && editList.children.length > 1; // ヘッダー除く

        const hasEditRows = editList && editList.querySelectorAll("[data-element-id], [data-id]").length > 0;

        if (hasRows && hasEditRows) {
          setTimeout(resolve, 5);
        } else {
          setTimeout(checkDOM, 3); // チェック間隔を短縮
        }
      };
      checkDOM();
    });
  }
}

if (typeof window !== "undefined") {
  window.PromptSlotManager = PromptSlotManager;
  window.promptSlotManager = new PromptSlotManager();
}
