class GenerateHistoryManager {
  constructor() {
    this.maxHistorySize = this.getMaxSizeFromSettings(); // 設定から最大履歴保持数を取得
    this.maxPromptLength = 2000; // プロンプトの最大長（ストレージ制限対策）
    this.storageKey = "generateHistory";
    this.historyModal = null;

    this.debounceTimers = {
      count: null,
      interval: null,
      maxSize: null,
    };

    this.init();
  }

  get history() {
    return AppState.data.generateHistory || [];
  }

  set history(value) {
    AppState.data.generateHistory = value;
  }

  getMaxSizeFromSettings() {
    try {
      if (window.AppState && window.AppState.userSettings && window.AppState.userSettings.optionData) {
        const maxSize = window.AppState.userSettings.optionData.historyMaxSize || 30;
        // ストレージ制限を考慮して最大100に制限
        return Math.min(maxSize, HISTORY_CONFIG.ABSOLUTE_MAX_SIZE);
      }
    } catch (error) {}
    return 30; // デフォルト値を少なめに設定
  }

  getAutoGenerateCount() {
    try {
      if (window.autoGenerateHandler) {
        return window.autoGenerateHandler.targetCount || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  getAutoGenerateInterval() {
    try {
      if (window.autoGenerateHandler) {
        return Math.floor(window.autoGenerateHandler.generateInterval / 1000) || 5;
      }
      return 5;
    } catch (error) {
      return 5;
    }
  }

  updateMaxSizeDebounced(newMaxSize) {
    if (this.debounceTimers.maxSize) {
      clearTimeout(this.debounceTimers.maxSize);
    }

    this.debounceTimers.maxSize = setTimeout(() => {
      this.updateMaxSize(newMaxSize);
    }, 500);
  }

  updateMaxSize(newMaxSize) {
    const oldMaxSize = this.maxHistorySize;
    this.maxHistorySize = newMaxSize;

    if (this.history.length > newMaxSize) {
      this.history = this.history.slice(0, newMaxSize);
      this.saveToStorage();
    }
  }

  updateAutoGenerateCountDebounced(newCount) {
    if (this.debounceTimers.count) {
      clearTimeout(this.debounceTimers.count);
    }

    this.debounceTimers.count = setTimeout(() => {
      this.updateAutoGenerateCount(newCount);
    }, 500);
  }

  updateAutoGenerateCount(newCount) {
    try {
      if (window.autoGenerateHandler) {
        window.autoGenerateHandler.targetCount = newCount;
        window.autoGenerateHandler.isInfiniteMode = newCount === 0;
        window.autoGenerateHandler.saveSettings();

        UIHelpers.notifySuccess(`生成回数を${newCount === 0 ? "無限" : newCount + "回"}に設定しました`, 2000);
      }
    } catch (error) {}
  }

  updateAutoGenerateIntervalDebounced(newInterval) {
    if (this.debounceTimers.interval) {
      clearTimeout(this.debounceTimers.interval);
    }

    this.debounceTimers.interval = setTimeout(() => {
      this.updateAutoGenerateInterval(newInterval);
    }, 500);
  }

  updateAutoGenerateInterval(newInterval) {
    try {
      if (window.autoGenerateHandler) {
        window.autoGenerateHandler.generateInterval = newInterval * 1000;
        window.autoGenerateHandler.saveSettings();

        UIHelpers.notifySuccess(`生成間隔を${newInterval}秒に設定しました`, 2000);
      }
    } catch (error) {}
  }

  async init() {
    // ストレージ読み込みは initializeDataManager() で既に実行済みのためスキップ
    this.setupEventListeners();
    this.initModal();
  }

  initModal() {
    this.historyModal = BaseModal.create(
      "generate-history-modal",
      "Generate設定",
      `
      <div class="generate-settings-section">
        <h3 class="settings-section-title">🤖 自動Generate設定</h3>
        <div class="auto-generate-settings-grid">
          <div class="setting-group">
            <label class="setting-label">
              生成回数:
              <input
                type="number"
                id="modal-generateCount"
                value="${this.getAutoGenerateCount()}"
                min="0"
                max="1000"
                class="setting-input"
                title="生成回数（0=無限）"
              />
              <span class="setting-unit">回</span>
            </label>
            <div class="setting-hint">0 = 無限モード</div>
          </div>
          <div class="setting-group">
            <label class="setting-label">
              生成間隔:
              <input
                type="number"
                id="modal-generateInterval"
                value="${this.getAutoGenerateInterval()}"
                min="3"
                max="60"
                class="setting-input"
                title="生成間隔（3-60秒）"
              />
              <span class="setting-unit">秒</span>
            </label>
            <div class="setting-hint">最小3秒</div>
          </div>
        </div>
      </div>
      
      <div class="generate-settings-section">
        <h3 class="settings-section-title">📊 履歴管理</h3>
        <div class="history-controls">
          <button id="modal-clear-all-history" class="history-control-btn danger" title="すべてのGenerate履歴を削除します（復元不可能）">
            <span>🗑️</span> 履歴をクリア
          </button>
          <button id="modal-export-history" class="history-control-btn primary" title="Generate履歴をJSONファイルでエクスポート">
            <span>📤</span> エクスポート
          </button>
        </div>
        <div class="history-list-section">
          <div class="history-list-header">
            <h4 class="history-list-title">履歴一覧</h4>
            <div class="history-stats-right">
              <span class="history-stats-compact">
                総件数: <span id="history-total-count">0</span>件
              </span>
              <span class="history-settings-compact">
                <label class="history-max-size-compact">
                  最大:
                  <input
                    type="number"
                    id="modal-historyMaxSize"
                    value="${this.maxHistorySize}"
                    min="10"
                    max="200"
                    class="history-max-size-input-compact"
                    title="最大保持件数（10-200件）"
                  />
                  件
                </label>
              </span>
            </div>
          </div>
          <div class="history-list-container">
            <div id="history-list"></div>
            <div id="empty-history-message" class="empty-message" style="display: none;">
              <p>履歴はまだありません</p>
            </div>
          </div>
        </div>
    `,
      {
        closeOnBackdrop: true,
        closeOnEsc: true,
        showCloseButton: true,
        showHeader: true,
        showFooter: false,
      }
    );

    this.setupHistoryItemListeners();

    this.historyModal.onShow(() => {
      this.updateHistoryDisplay();
      this.setupHistorySettingsListener();
      this.setupHistoryControlButtons();
      this.setupAutoGenerateSettingsListener();
    });
  }

  setupEventListeners() {
    const showHistoryBtn = document.getElementById("show-generate-history");
    if (showHistoryBtn) {
      showHistoryBtn.addEventListener("click", () => {
        this.showHistoryModal();
      });
    }

    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    const modal = document.getElementById("generate-history-modal");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideHistoryModal();
      }
    });

    const closeBtn = document.getElementById("close-history");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.hideHistoryModal();
      });
    }

    const clearAllBtn = document.getElementById("clear-all-history");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        this.clearAllHistory();
      });
    }

    const exportBtn = document.getElementById("export-history");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportHistory();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") {
        this.hideHistoryModal();
      }
    });
  }

  addToHistory(prompt, slotInfo = null) {
    if (!Validators.Quick.isValidPrompt(prompt)) return;

    const now = Date.now();
    let trimmedPrompt = prompt.trim();

    // プロンプトの長さ制限（ストレージ制限対策）
    if (trimmedPrompt.length > this.maxPromptLength) {
      trimmedPrompt = trimmedPrompt.substring(0, this.maxPromptLength) + "... [切り詰め]";
    }

    const existingIndex = this.history.findIndex((item) => item.prompt === trimmedPrompt);

    if (existingIndex !== -1) {
      const existingItem = this.history[existingIndex];
      existingItem.generationCount++;
      existingItem.lastGenerated = now;

      this.history.splice(existingIndex, 1);
      this.history.unshift(existingItem);
    } else {
      const historyItem = {
        id: now,
        prompt: trimmedPrompt,
        timestamp: now,
        lastGenerated: now,
        generationCount: 1,
        slotInfo: slotInfo || this.getCurrentSlotInfo(),
      };

      this.history.unshift(historyItem);
    }

    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    this.saveToStorage();

    this.refreshHistoryDisplayIfOpen();
  }

  refreshHistoryDisplayIfOpen() {
    const modal = document.getElementById("generate-history-modal");
    if (modal && modal.style.display === "flex") {
      this.updateHistoryDisplay();
    }
  }

  getCurrentSlotInfo() {
    if (window.promptSlotManager) {
      const slots = window.promptSlotManager.getUsedSlots();
      return {
        usedSlots: slots.length,
        currentSlot: window.promptSlotManager.currentSlot,
        slotNames: slots.map((slot) => slot.name || `スロット${slot.id}`),
      };
    }
    return null;
  }

  showHistoryModal() {
    this.historyModal.show();
  }

  hideHistoryModal() {
    this.historyModal.hide();
  }

  updateHistoryDisplay() {
    const countSpan = document.getElementById("history-total-count");
    const emptyMessage = document.getElementById("empty-history-message");
    const historyList = document.getElementById("history-list");

    if (!historyList) return;

    if (countSpan) {
      countSpan.textContent = this.history.length;
    }

    if (this.history.length === 0) {
      if (emptyMessage) {
        emptyMessage.classList.remove("hidden");
        emptyMessage.classList.add("show-flex");
      }
      historyList.classList.add("hidden");
      historyList.classList.remove("show-block");
      return;
    }

    if (emptyMessage) {
      emptyMessage.classList.remove("show-flex");
      emptyMessage.classList.add("hidden");
    }
    historyList.classList.remove("hidden");
    historyList.classList.add("show-block");

    historyList.innerHTML = this.history.map((item) => this.createHistoryItemHTML(item)).join("");
  }

  createHistoryItemHTML(item) {
    const date = new Date(item.lastGenerated);
    const timeString = date.toLocaleString();
    const shortPrompt =
      item.prompt.length > HISTORY_CONFIG.PREVIEW_LENGTH
        ? item.prompt.substring(0, HISTORY_CONFIG.PREVIEW_LENGTH) + "..."
        : item.prompt;

    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-header">
          <span class="history-timestamp">${timeString}</span>
          <span class="history-generation-count">${item.generationCount}回生成</span>
        </div>
        <div class="history-prompt">${this.escapeHtml(shortPrompt)}</div>
        <div class="history-actions">
          <button class="history-action-btn rerun" data-action="rerun" data-id="${item.id}" title="このプロンプトで再度Generate実行">
            🔄 再実行
          </button>
          <button class="history-action-btn auto-rerun" data-action="auto-rerun" data-id="${item.id}" title="自動Generate設定でこのプロンプトを連続実行">
            🔁 連続実行
          </button>
          <button class="history-action-btn copy" data-action="copy" data-id="${item.id}" title="プロンプトをクリップボードにコピー">
            📋 コピー
          </button>
          <button class="history-action-btn save-slot" data-action="save-slot" data-id="${item.id}" title="このプロンプトを現在のスロットに保存">
            💾 スロット保存
          </button>
        </div>
      </div>
    `;
  }

  setupHistoryItemListeners() {
    const historyList = document.getElementById("history-list");
    if (!historyList) return;

    if (this.boundHistoryClickHandler) {
      historyList.removeEventListener("click", this.boundHistoryClickHandler);
    }

    this.boundHistoryClickHandler = (e) => {
      const button = e.target.closest(".history-action-btn");
      if (!button) return;

      e.preventDefault();
      e.stopPropagation();

      const action = button.dataset.action;
      const itemId = parseInt(button.dataset.id);
      const item = this.history.find((h) => h.id === itemId);

      if (!item) return;

      switch (action) {
        case "rerun":
          this.rerunGenerate(item);
          break;
        case "auto-rerun":
          this.autoRerunGenerate(item);
          break;
        case "copy":
          this.copyToClipboard(item);
          break;
        case "save-slot":
          this.saveToSlot(item);
          break;
      }
    };

    historyList.addEventListener("click", this.boundHistoryClickHandler);
  }

  rerunGenerate(item) {
    if (window.autoGenerateHandler && window.autoGenerateHandler.isRunning) {
      window.autoGenerateHandler.stop();
    }

    this.executeDirectGenerate(item.prompt);

    UIHelpers.notifySuccess("履歴プロンプトを再実行しました", 2000);
  }

  autoRerunGenerate(item) {
    if (!window.autoGenerateHandler) {
      UIHelpers.notifyError("自動Generate機能が利用できません", 3000);
      return;
    }

    if (window.autoGenerateHandler.isRunning) {
      window.autoGenerateHandler.stop();
      setTimeout(() => {
        this.startDirectAutoGenerate(item);
      }, 500);
    } else {
      this.startDirectAutoGenerate(item);
    }
  }

  startDirectAutoGenerate(item) {
    if (window.autoGenerateHandler) {
      window.autoGenerateHandler.historyPrompt = item.prompt;

      window.autoGenerateHandler.updateToggleButtonState(true);

      window.autoGenerateHandler.start();
    }

    UIHelpers.notifySuccess("履歴プロンプトで自動生成を開始しました", 2000);
  }

  executeDirectGenerate(prompt) {
    if (!Validators.Quick.isValidPrompt(prompt)) {
      return;
    }

    if (typeof sendBackground === "function" && window.AppState) {
      sendBackground(
        "DOM",
        "Generate",
        prompt.trim(),
        window.AppState.selector.positiveSelector,
        window.AppState.selector.generateSelector
      );
    } else {
      const promptInput = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      if (promptInput) {
        promptInput.value = prompt;
        promptInput.dispatchEvent(new Event("input"));
      }

      const generateBtn = document.getElementById("GeneratoButton");
      if (generateBtn) {
        generateBtn.click();
      }
    }
  }

  async copyToClipboard(item) {
    try {
      await navigator.clipboard.writeText(item.prompt);

      UIHelpers.notifySuccess("プロンプトをコピーしました", 2000);
    } catch (error) {
      UIHelpers.notifyError("コピーに失敗しました", 2000);
    }
  }

  async saveToSlot(item) {
    if (!window.promptSlotManager) {
      return;
    }

    try {
      const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
      if (!currentSlot) {
        throw new Error("Current slot not found");
      }

      currentSlot.prompt = item.prompt;
      currentSlot.elements = []; // 履歴プロンプトは単純なテキストなのでelementsは空
      currentSlot.isUsed = true;
      currentSlot.lastModified = Date.now();
      currentSlot.mode = "normal"; // 通常モードに設定

      const generatePrompt = document.getElementById("GeneratePrompt");
      if (generatePrompt) {
        generatePrompt.value = item.prompt;
      }
      if (window.promptSlotManager) {
        const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
        if (currentSlot) {
          currentSlot.prompt = item.prompt;
          window.promptSlotManager.saveCurrentSlot();
        }
      }

      const promptInput = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      if (promptInput) {
        promptInput.value = item.prompt;
        promptInput.dispatchEvent(new Event("input"));
      }

      await window.promptSlotManager.saveToStorage();

      window.promptSlotManager.updateUI();

      // ListRefreshManagerで編集タブをリフレッシュ（プロンプト内容が変わったため）
      if (window.ListRefreshManager) {
        await window.ListRefreshManager.executeAction(window.ListRefreshManager.ACTIONS.PROMPT_CHANGE, {
          context: {
            source: "history_save",
            slotId: window.promptSlotManager.currentSlot,
            prompt: item.prompt,
          },
          showNotification: false,
          delay: ADDITIONAL_DELAYS.ELEMENT_UPDATE,
        });
      }

      const slotNumber = window.promptSlotManager.currentSlot + 1;
      UIHelpers.notifySuccess(`スロット${slotNumber}に保存しました`, 2000);
    } catch (error) {
      UIHelpers.notifyError("スロット保存に失敗しました", 2000);
    }
  }

  async clearAllHistory() {
    const shouldConfirm = window.AppState?.userSettings?.optionData?.isDeleteCheck !== false;

    if (!shouldConfirm || confirm("すべての履歴をクリアしますか？")) {
      this.history = [];
      await this.saveToStorage();
      this.updateHistoryDisplay();

      UIHelpers.notifySuccess("履歴をクリアしました", 2000);
    }
  }

  async exportHistory() {
    if (this.history.length === 0) {
      UIHelpers.notifyWarning("エクスポートする履歴がありません", 2000);
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      historyCount: this.history.length,
      history: this.history,
    };

    const filename = FileUtilities.generateTimestampedFilename(EXPORT_FILE_NAMES.GENERATE_HISTORY, "json");
    await FileUtilities.downloadJSON(exportData, filename);
  }

  async loadFromStorage() {
    try {
      if (typeof loadGenerateHistory === "function") {
        await loadGenerateHistory();
      } else {
        const result = await Storage.get(this.storageKey);
        if (result[this.storageKey]) {
          AppState.data.generateHistory = result[this.storageKey] || [];
        } else {
          AppState.data.generateHistory = [];
        }
      }
    } catch (error) {
      AppState.data.generateHistory = [];
    }
  }

  async saveToStorage() {
    try {
      if (typeof saveGenerateHistory === "function") {
        await saveGenerateHistory();
      } else {
        await Storage.set({
          [this.storageKey]: this.history,
        });
      }
    } catch (error) {
      // 容量制限エラーの場合は古い履歴を削除して再試行
      if (error.message && error.message.includes("quota")) {
        this.history = this.history.slice(0, Math.floor(this.history.length / 2));

        try {
          if (typeof saveGenerateHistory === "function") {
            await saveGenerateHistory();
          } else {
            await Storage.set({
              [this.storageKey]: this.history,
            });
          }
        } catch (retryError) {}
      }
    }
  }

  setupHistorySettingsListener() {
    const maxSizeInput = document.getElementById("modal-historyMaxSize");
    if (maxSizeInput) {
      maxSizeInput.value = this.maxHistorySize;

      maxSizeInput.addEventListener("change", (e) => {
        const newMaxSize = parseInt(e.target.value);
        if (newMaxSize >= 10 && newMaxSize <= 200) {
          if (AppState.userSettings.optionData) {
            AppState.userSettings.optionData.historyMaxSize = newMaxSize;
            if (typeof saveOptionData === "function") {
              saveOptionData();
            }
          }

          this.updateMaxSizeDebounced(newMaxSize);

          this.updateHistoryDisplay();
        }
      });

      maxSizeInput.addEventListener("wheel", (e) => {
        e.preventDefault();

        const currentValue = parseInt(maxSizeInput.value) || this.maxHistorySize;

        const wheelDelta = e.deltaY;

        const step = 5;
        let newValue;

        if (wheelDelta < 0) {
          newValue = currentValue + step;
        } else {
          newValue = currentValue - step;
        }

        // 範囲制限（10-200）
        newValue = Math.max(10, Math.min(200, newValue));

        if (newValue !== currentValue) {
          maxSizeInput.value = newValue;

          const changeEvent = new Event("change", { bubbles: true });
          maxSizeInput.dispatchEvent(changeEvent);
        }
      });
    }
  }

  setupHistoryControlButtons() {
    const clearBtn = document.getElementById("modal-clear-all-history");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.clearAllHistory();
      });
    }

    const exportBtn = document.getElementById("modal-export-history");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportHistory();
      });
    }
  }

  setupAutoGenerateSettingsListener() {
    const countInput = document.getElementById("modal-generateCount");
    if (countInput) {
      countInput.value = this.getAutoGenerateCount();

      countInput.addEventListener("change", (e) => {
        const newCount = parseInt(e.target.value) || 0;
        if (newCount >= 0 && newCount <= 1000) {
          this.updateAutoGenerateCountDebounced(newCount);
        }
      });

      countInput.addEventListener("wheel", (e) => {
        e.preventDefault();

        const currentValue = parseInt(countInput.value) || 0;
        const wheelDelta = e.deltaY;

        let step = 1;
        if (e.shiftKey) {
          step = 10;
        } else if (e.ctrlKey) {
          step = 100;
        }

        let newValue;
        if (wheelDelta < 0) {
          newValue = currentValue + step;
        } else {
          newValue = currentValue - step;
        }

        // 範囲制限（0-1000）
        newValue = Math.max(0, Math.min(1000, newValue));

        if (newValue !== currentValue) {
          countInput.value = newValue;
          const changeEvent = new Event("change", { bubbles: true });
          countInput.dispatchEvent(changeEvent);
        }
      });
    }

    const intervalInput = document.getElementById("modal-generateInterval");
    if (intervalInput) {
      intervalInput.value = this.getAutoGenerateInterval();

      intervalInput.addEventListener("change", (e) => {
        const newInterval = parseInt(e.target.value) || 5;
        if (newInterval >= 3 && newInterval <= 60) {
          this.updateAutoGenerateIntervalDebounced(newInterval);
        }
      });

      intervalInput.addEventListener("wheel", (e) => {
        e.preventDefault();

        const currentValue = parseInt(intervalInput.value) || 5;
        const wheelDelta = e.deltaY;

        let step = 1;
        if (e.shiftKey) {
          step = 5;
        } else if (e.ctrlKey) {
          step = 10;
        }

        let newValue;
        if (wheelDelta < 0) {
          newValue = currentValue + step;
        } else {
          newValue = currentValue - step;
        }

        // 範囲制限（3-60秒）
        newValue = Math.max(3, Math.min(60, newValue));

        if (newValue !== currentValue) {
          intervalInput.value = newValue;
          const changeEvent = new Event("change", { bubbles: true });
          intervalInput.dispatchEvent(changeEvent);
        }
      });
    }
  }

  clearAllHistory() {
    if (confirm("すべての履歴を削除しますか？この操作は元に戻せません。")) {
      this.history = [];
      this.saveToStorage();
      this.updateHistoryDisplay();
    }
  }

  exportHistory() {
    if (this.history.length === 0) {
      alert("エクスポートする履歴がありません。");
      return;
    }

    try {
      const exportData = {
        type: "generateHistory",
        version: "1.0",
        exportDate: new Date().toISOString(),
        totalCount: this.history.length,
        history: this.history,
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `generate-history-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (error) {
      alert("履歴のエクスポートに失敗しました。");
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  debug() {}

  cleanup() {
    const historyList = document.getElementById("history-list");
    if (historyList && this.boundHistoryClickHandler) {
      historyList.removeEventListener("click", this.boundHistoryClickHandler);
      this.boundHistoryClickHandler = null;
    }

    if (this.historyModal) {
      this.historyModal.cleanup();
      this.historyModal = null;
    }
  }
}

if (typeof window !== "undefined") {
  window.GenerateHistoryManager = GenerateHistoryManager;
}
