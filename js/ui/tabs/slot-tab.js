(function () {
  "use strict";

  function defineSlotTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineSlotTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    class SlotTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "slotTabBody",
          tabButtonId: "slotTab",
          tabIndex: 4, // CONSTANTS.TABS.SLOT
        });

        this.slotManager = null;
        this.groupManager = null;

        this.groupManagementModal = null;

        this.isGroupEditing = false;

        this.elements = {
          container: null,
          clearAllBtn: null,
          exportBtn: null,
          importBtn: null,
          groupSelector: null,
          groupDescription: null,
          groupManageBtn: null,
          groupModal: null,
          groupCreateBtn: null,
          groupCopyBtn: null,
          groupEditBtn: null,
          groupDeleteBtn: null,
          exportGroupBtn: null,
          importGroupBtn: null,
        };
      }

      async onInit() {
        await this.waitForSlotManagers();

        this.slotManager = window.promptSlotManager;
        if (!this.slotManager) {
          throw new Error("PromptSlotManager not found after waiting");
        }

        this.groupManager = window.slotGroupManager;
        if (!this.groupManager) {
          throw new Error("SlotGroupManager not found after waiting");
        }

        await this.groupManager.initialize();

        this.categoryUIManager = new CategoryUIManager();

        if (!this.slotManager.slots || this.slotManager.slots.length === 0) {
          await this.slotManager.loadFromStorage();
        }

        this.cacheElements();

        this.initModal();

        this.setupEventListeners();

        this.setupFixedButtonListeners();

        this.setupGroupEventListeners();

        this.updateDisplay();

        this.updateGroupDisplay();

        this.setupExtractionListeners();

        this.setupShapingChangeListener();

        this.currentShapingMode = this.getCurrentShaping();

        setTimeout(() => {
          this.adjustContainerHeight();
        }, 100);
      }

      setupFixedButtonListeners() {
        const addBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_ADD_BTN);
        if (addBtn) {
          addBtn.addEventListener("click", () => {
            this.slotManager.addNewSlot();
            this.updateDisplay();
          });
        }

        const previewBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_PREVIEW_BTN);
        if (previewBtn) {
          previewBtn.addEventListener("click", () => {
            this.showCombinePreview();
          });
        } else {
        }

        const clearAllBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CLEAR_ALL_BTN);
        if (clearAllBtn) {
          clearAllBtn.addEventListener("click", () => {
            this.handleClearAll();
          });
        }
      }

      setupExtractionListeners() {
        window.addEventListener("slotExtractionComplete", (event) => {
          this.updateSlotExtraction(event.detail.slotId, event.detail.extraction);
        });

        window.addEventListener("allExtractionsComplete", () => {
          if (this.isCurrentTab()) {
            this.refreshExtractionDisplays();
          }
        });

        window.addEventListener("slotModeChanged", (event) => {
          this.updateDisplay();

          if (this.app.tabs.edit && this.app.tabs.edit.initialized) {
            this.app.tabs.edit.checkExtractionMode();
          }

          const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];
          if (currentSlot && event.detail.slotId === currentSlot.id && event.detail.mode === "normal") {
            const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
            if (generatePrompt) {
              generatePrompt.value = currentSlot.prompt || "";
              generatePrompt.readOnly = false;
              generatePrompt.title = "";
            }
          }
        });
      }

      isCurrentTab() {
        const slotTab = this.getElement(DOM_SELECTORS.BY_ID.SLOT_TAB);
        return slotTab && slotTab.classList.contains("is-active");
      }

      cacheElements() {
        this.elements.container = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CONTAINER);
        this.elements.clearAllBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CLEAR_ALL_BTN);

        this.elements.groupSelector = document.getElementById("slot-group-selector");
        this.elements.groupDescription = document.getElementById("slot-group-description-compact");
        this.elements.groupManageBtn = document.getElementById("slot-group-manage-btn");
        this.elements.groupModal = document.getElementById("slot-group-management-modal");

        this.elements.groupCreateBtn = document.getElementById("slot-group-create-btn");
        this.elements.groupCopyBtn = document.getElementById("slot-group-copy-btn");
        this.elements.groupEditBtn = document.getElementById("slot-group-edit-btn");
        this.elements.groupDeleteBtn = document.getElementById("slot-group-delete-btn");
        this.elements.exportBtn = document.getElementById("export-slots");
        this.elements.importBtn = document.getElementById("import-slots");
        this.elements.exportGroupBtn = document.getElementById("export-group");
        this.elements.importGroupBtn = document.getElementById("import-group");
      }

      updateDisplay() {
        if (this.isGroupEditing) {
          return;
        }

        const container = this.elements.container;
        if (!container) return;

        this.addSlotImportExportButtons();

        container.innerHTML = "";

        const usedCount = this.slotManager.getUsedSlotsCount();
        const totalCount = this.slotManager.slots.length;
        const countSpan = this.getElement(DOM_SELECTORS.BY_ID.SLOT_USED_COUNT);
        if (countSpan) {
          countSpan.textContent = `${usedCount}/${totalCount}`;
        }

        this.slotManager.slots.forEach((slot, index) => {
          const info = this.slotManager.getSlotInfo(slot.id);
          info.displayNumber = index + 1;
          const slotCard = this.createSlotCard(info);
          container.appendChild(slotCard);
        });

        this.setupSortable();

        this.adjustContainerHeight();

        // 重み入力フィールドの設定を更新（shaping変更対応）
        setTimeout(() => {
          this.updateWeightInputFields();
        }, 10);
      }

      createSlotCard(info) {
        const card = UIFactory.createDiv();
        card.dataset.slotId = info.id;

        const slot = this.slotManager.slots.find((s) => s.id === info.id);
        const isExtractionMode = slot?.mode === "random" || slot?.mode === "sequential";

        card.className = `slot-card ${
          info.isCurrent ? "slot-card-current" : ""
        } ${isExtractionMode ? "slot-card-extraction" : ""} ${
          info.isUsed ? "slot-card-used" : ""
        } ${slot.muted ? "slot-card-muted" : ""}`;

        const canDelete = this.slotManager.slots.length > this.slotManager.minSlots && !info.isCurrent;

        const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());

        card.innerHTML = `
    <div class="slot-drag-handle">☰</div>
    <div class="slot-move-buttons">
      <button class="slot-move-up-btn" data-slot-id="${info.id}" title="このスロットを上に移動">↑</button>
      <button class="slot-move-down-btn" data-slot-id="${info.id}" title="このスロットを下に移動">↓</button>
    </div>

    <div class="slot-header">
      <div class="slot-header-left">
        <span class="slot-number ${info.isCurrent ? "slot-number-current" : ""}">
          ${info.displayNumber}
        </span>
        <input type="text"
               class="slot-name-edit"
               data-slot-id="${info.id}"
               value="${info.name || ""}"
               placeholder="スロット名を入力"
               title="スロットの識別用名前（空の場合は番号表示）">
      </div>
      <div class="slot-actions">
        <button class="slot-mute-btn" data-slot-id="${info.id}" 
                title="${slot.muted ? "ミュート解除" : "ミュート"}">
          ${slot.muted ? "🔇" : "🔊"}
        </button>
        <button class="slot-clear-btn" data-slot-id="${info.id}" title="このスロットの内容をクリア">クリア</button>
        <button class="slot-delete-btn" data-slot-id="${info.id}"
                ${!canDelete ? "disabled" : ""}
                title="${!canDelete ? "現在のスロットまたは最小数未満のため削除不可" : "このスロットを削除"}">削除</button>
      </div>
    </div>

    <!-- モード選択ドロップダウンと重み表示 -->
    <div class="slot-mode-container">
      <div class="slot-control-group">
        <label class="slot-control-label">モード</label>
        <select class="slot-mode-select" data-slot-id="${info.id}"
                title="スロットの動作モード&#10;・複数要素: 固定プロンプト&#10;・単一要素: スペース区切りテキスト&#10;・ランダム抽出: 辞書からランダム選択&#10;・連続抽出: 辞書から順次選択">
          <option value="normal" ${!slot?.mode || slot.mode === "normal" ? "selected" : ""}>複数要素</option>
          <option value="single" ${slot?.mode === "single" ? "selected" : ""}>単一要素</option>
          <option value="random" ${slot?.mode === "random" ? "selected" : ""}>ランダム抽出</option>
          <option value="sequential" ${slot?.mode === "sequential" ? "selected" : ""}>連続抽出</option>
        </select>
      </div>
      <div class="slot-control-group">
        <label class="slot-control-label">重み</label>
        <input type="number" 
               class="slot-weight-input" 
               data-slot-id="${info.id}"
               value="${slot?.weight !== undefined ? slot.weight : this.slotManager.getDefaultWeight()}"
               min="${weightConfig.min}" 
               max="${weightConfig.max}" 
               step="${weightConfig.delta}"
               title="${this.getWeightTooltip()}"
               placeholder="重み">
      </div>
    </div>

    <!-- 通常モード用テキストエリア -->
    <div class="normal-mode-content" style="display: ${!isExtractionMode ? "block" : "none"};">
      <div class="slot-prompt-container">
        <textarea class="slot-prompt-edit"
                  data-slot-id="${info.id}"
                  placeholder="${info.isUsed ? "プロンプト内容" : "このスロットは空です"}"
                  title="${info.isUsed ? "スロットのプロンプト内容（複数行入力可能）" : "空のスロットです（クリアで有効化）"}"
                  ${!info.isUsed ? "disabled" : ""}>${
                    info.isUsed
                      ? this.slotManager.getSlotDisplayValue(this.slotManager.slots.find((s) => s.id === info.id)) || ""
                      : ""
                  }</textarea>
        ${
          info.isUsed
            ? `<div class="slot-char-count">${
                this.slotManager.slots.find((s) => s.id === info.id)?.prompt?.length || 0
              } 文字</div>`
            : ""
        }
      </div>
    </div>

    <!-- 抽出モード用カテゴリー選択 -->
    <div class="extraction-mode-content" style="display: ${isExtractionMode ? "block" : "none"};">
      <div class="extraction-controls">
        <!-- 抽出元設定（スロット専用2行形式） -->
        <div class="slot-extraction-table">
          <!-- ヘッダー行 -->
          <div class="slot-extraction-header">
            <div class="slot-header-cell datasource">データソース</div>
            <div class="slot-header-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">大項目</div>
            <div class="slot-header-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">中項目</div>
            <div class="slot-header-cell category ${(slot?.dataSource || "dictionary") === "dictionary" ? "hidden" : ""}">お気に入り</div>
          </div>
          
          <!-- データ行 -->
          <div class="slot-extraction-data">
            <div class="slot-data-cell datasource">
              <select class="data-source-select" data-slot-id="${info.id}" title="抽出元のデータソースを選択">
                <option value="dictionary">${UI_LABELS.EXTRACTION_SOURCE_DICTIONARY}</option>
                <option value="favorites">${UI_LABELS.EXTRACTION_SOURCE_FAVORITES}</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">
              <select class="category-big-select" data-slot-id="${info.id}" title="抽出する大カテゴリを選択（空白ですべて）">
                <option value="">すべて</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">
              <select class="category-middle-select" data-slot-id="${info.id}"
                      ${!slot?.category?.big ? "disabled" : ""}>
                <option value="">すべて</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || "dictionary") === "dictionary" ? "hidden" : ""}">
              <select class="favorites-select" data-slot-id="${info.id}">
              </select>
            </div>
          </div>
        </div>
        </div>
      </div>
      ${
        slot?.mode === "sequential"
          ? `<div class="sequential-info">
              <label class="sequential-label">現在のインデックス:</label>
              <input type="number" class="sequential-index-input" 
                     data-slot-id="${info.id}"
                     value="${slot.sequentialIndex || 0}" 
                     min="0"
                     step="1">
              <span class="sequential-help">（0から開始）</span>
            </div>`
          : ""
      }
      <div class="current-extraction-display">
        ${
          slot?.currentExtraction
            ? `<div class="extraction-display-content">
                <strong>現在:</strong> ${slot.currentExtraction}
                ${slot.currentExtractionSmall ? `<br><small class="extraction-small-item">小項目: ${slot.currentExtractionSmall}</small>` : ""}
                <span class="extraction-timestamp">${
                  slot.lastExtractionTime ? new Date(slot.lastExtractionTime).toLocaleTimeString() : ""
                }</span>
              </div>`
            : ""
        }
      </div>
    </div>
  `;

        if (isExtractionMode) {
          this.setupDataSourceSelector(card, slot);
          this.setupCategorySelectors(card, slot);
        }

        if (slot?.mode === "sequential") {
          const sequentialInput = card.querySelector(".sequential-index-input");
          if (sequentialInput) {
            this.setupSequentialIndexControls(sequentialInput, slot);
          }
        }

        const weightInput = card.querySelector(".slot-weight-input");
        if (weightInput) {
          this.setupWeightInputControls(weightInput);
        }

        this.setupMoveButtons(card, info);

        return card;
      }

      setupWeightInputControls(weightInput) {
        const currentShaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(currentShaping);

        weightInput.min = weightConfig.min;
        weightInput.max = weightConfig.max;
        weightInput.step = weightConfig.delta;

        weightInput.addEventListener("wheel", (e) => {
          e.preventDefault(); // ページスクロールを防ぐ

          const rawValue = weightInput.value;
          const parsedValue = parseFloat(rawValue);
          const currentValue = parsedValue || 0;
          let delta = weightConfig.delta;

          if (e.shiftKey) {
            delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
          } else if (e.ctrlKey) {
            delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
          }

          const direction = e.deltaY > 0 ? -1 : 1;
          const newValue = currentValue + direction * delta;

          // 範囲内に制限
          const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

          weightInput.value = Math.round(clampedValue * 100) / 100;

          weightInput.dispatchEvent(new Event("input", { bubbles: true }));
        });

        weightInput.addEventListener("keydown", (e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();

            const currentValue = parseFloat(weightInput.value) || 0;
            let delta = weightConfig.delta;

            if (e.shiftKey) {
              delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
            } else if (e.ctrlKey) {
              delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
            }

            const direction = e.key === "ArrowUp" ? 1 : -1;
            const newValue = currentValue + delta * direction;

            // 範囲内に制限
            const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

            weightInput.value = Math.round(clampedValue * 100) / 100;

            weightInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
      }

      setupSequentialIndexControls(sequentialInput, slot) {
        sequentialInput.addEventListener("change", (e) => {
          const newIndex = parseInt(e.target.value, 10);

          if (isNaN(newIndex) || newIndex < 0) {
            e.target.value = slot.sequentialIndex || 0;
            return;
          }

          slot.sequentialIndex = newIndex;

          this.saveSlotData();
        });

        sequentialInput.addEventListener("keydown", (e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();

            const currentValue = parseInt(sequentialInput.value, 10) || 0;
            const direction = e.key === "ArrowUp" ? 1 : -1;
            let newValue = currentValue + direction;

            // 最小値制限
            newValue = Math.max(0, newValue);

            sequentialInput.value = newValue;

            sequentialInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        sequentialInput.addEventListener("wheel", (e) => {
          e.preventDefault();

          const currentValue = parseInt(sequentialInput.value, 10) || 0;
          const direction = e.deltaY > 0 ? -1 : 1;
          let newValue = currentValue + direction;

          // 最小値制限
          newValue = Math.max(0, newValue);

          sequentialInput.value = newValue;

          sequentialInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }

      setupMoveButtons(card, info) {
        const moveUpBtn = card.querySelector(".slot-move-up-btn");
        const moveDownBtn = card.querySelector(".slot-move-down-btn");

        if (!moveUpBtn || !moveDownBtn) return;

        const slotIndex = this.slotManager.slots.findIndex((s) => s.id === info.id);
        const totalSlots = this.slotManager.slots.length;

        if (slotIndex === 0) {
          moveUpBtn.disabled = true;
        } else {
          moveUpBtn.addEventListener("click", () => this.moveSlot(info.id, "up"));
        }

        if (slotIndex === totalSlots - 1) {
          moveDownBtn.disabled = true;
        } else {
          moveDownBtn.addEventListener("click", () => this.moveSlot(info.id, "down"));
        }
      }

      async moveSlot(slotId, direction) {
        const slotIndex = this.slotManager.slots.findIndex((s) => s.id === slotId);
        if (slotIndex === -1) return;

        const targetIndex = direction === "up" ? slotIndex - 1 : slotIndex + 1;

        if (targetIndex < 0 || targetIndex >= this.slotManager.slots.length) return;

        const currentSlotIdBeforeReorder = this.slotManager.slots[this.slotManager.currentSlot]?.id;
        if (currentSlotIdBeforeReorder !== undefined) {
          const currentSlotBeforeReorder = this.slotManager.slots[this.slotManager.currentSlot];
          if (currentSlotBeforeReorder) {
            const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
            const currentPrompt = generatePrompt?.value || "";
            currentSlotBeforeReorder.prompt = currentPrompt;
            // elements は現在のスロットの既存値を維持（入力フィールドからは取得不可）
            currentSlotBeforeReorder.isUsed = currentPrompt.length > 0;
            currentSlotBeforeReorder.lastModified = currentSlotBeforeReorder.isUsed ? Date.now() : null;
          }
        }

        [this.slotManager.slots[slotIndex], this.slotManager.slots[targetIndex]] = [
          this.slotManager.slots[targetIndex],
          this.slotManager.slots[slotIndex],
        ];

        // 重要: currentSlotインデックスを更新
        if (this.slotManager.currentSlot === slotIndex) {
          this.slotManager.currentSlot = targetIndex;
        } else if (this.slotManager.currentSlot === targetIndex) {
          this.slotManager.currentSlot = slotIndex;
        }

        this.slotManager.updateUI();

        await this.slotManager.saveToStorage();

        const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];
        if (currentSlot) {
          const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePrompt) {
            if (currentSlot.prompt) {
              const weightedPrompt = this.slotManager.applyWeightToPrompt(currentSlot.prompt, currentSlot.weight);
              generatePrompt.value = weightedPrompt;
            } else {
              generatePrompt.value =
                currentSlot.mode === "random" || currentSlot.mode === "sequential"
                  ? "[抽出待機中 - Generateボタンを押して抽出]"
                  : "";
            }
          }
        }

        this.updateDisplay();
      }

      getCurrentShaping() {
        if (typeof AppState !== "undefined" && AppState.userSettings?.optionData?.shaping) {
          return AppState.userSettings.optionData.shaping;
        }
        return "SD";
      }

      setupShapingChangeListener() {
        const shapingInputs = document.querySelectorAll('[name="UIType"]');

        shapingInputs.forEach((input, index) => {
          this.addEventListener(input, "change", async (event) => {
            if (AppState.ui.currentTab === CONSTANTS.TABS.SLOT) {
              const newShaping = event.target.value;
              const oldShaping = this.currentShapingMode || "SD";

              if (oldShaping !== newShaping) {
                this.currentShapingMode = newShaping;
                await this.handleShapingChange(event, oldShaping);
              } else {
              }
            }
          });
        });
      }

      async handleShapingChange(event, oldShaping = null) {
        const isSlotTabActive = AppState.ui.currentTab === CONSTANTS.TABS.SLOT;

        if (!isSlotTabActive) {
          return;
        }

        const newShaping = event.target.value;
        const previousShaping = oldShaping || AppState.userSettings?.optionData?.shaping || "SD";

        if (newShaping === previousShaping) {
          return;
        }

        this.updateSlotWeightsForNewShaping(previousShaping, newShaping);

        this.updateDisplay();

        this.updateWeightInputFields();

        if (window.ErrorHandler) {
          window.ErrorHandler.notify(`重み記法を${newShaping}形式に変更しました`, {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: "info",
            duration: 2000,
          });
        }
      }

      updateWeightInputFields() {
        const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());
        const weightInputs = document.querySelectorAll(".slot-weight-input");

        weightInputs.forEach((input) => {
          input.step = weightConfig.delta;
          input.min = weightConfig.min;
          input.max = weightConfig.max;
        });
      }

      setupDataSourceSelector(card, slot) {
        const dataSourceSelect = card.querySelector(".data-source-select");
        const favoritesSelect = card.querySelector(".favorites-select");
        const dictionarySelection = card.querySelector(".dictionary-selection");
        const favoritesSelection = card.querySelector(".favorites-selection");

        if (!dataSourceSelect) return;

        dataSourceSelect.value = slot.dataSource || "dictionary";

        this.populateFavoritesOptions(favoritesSelect);

        if (favoritesSelect && slot.favoriteDictionaryId) {
          favoritesSelect.value = slot.favoriteDictionaryId;
        }

        this.toggleDataSourceUI(card, slot.dataSource || "dictionary");

        dataSourceSelect.addEventListener("change", async (e) => {
          const newDataSource = e.target.value;
          slot.dataSource = newDataSource;

          this.toggleDataSourceUI(card, newDataSource);

          if (newDataSource === "favorites") {
            const allDictionaries = AppState.data.promptDictionaries || {};
            const firstDictionaryId = Object.keys(allDictionaries)[0] || "";

            slot.favoriteDictionaryId = firstDictionaryId;
            if (favoritesSelect) {
              favoritesSelect.value = firstDictionaryId;
            }
          } else {
            slot.category = { big: "", middle: "" };
            const bigSelect = card.querySelector(".category-big-select");
            const middleSelect = card.querySelector(".category-middle-select");
            if (bigSelect) bigSelect.value = "";
            if (middleSelect) middleSelect.value = "";
          }

          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotManager.saveToStorage();
        });

        if (favoritesSelect) {
          favoritesSelect.addEventListener("change", async (e) => {
            slot.favoriteDictionaryId = e.target.value;

            if (slot.mode === "sequential") {
              slot.sequentialIndex = 0;
              const indexSpan = card.querySelector(".sequential-index");
              if (indexSpan) {
                indexSpan.textContent = "0";
              }
            }

            await this.slotManager.saveToStorage();
          });
        }
      }

      toggleDataSourceUI(card, dataSource) {
        const headerCells = card.querySelectorAll(".slot-header-cell.category");
        const dataCells = card.querySelectorAll(".slot-data-cell.category");

        if (dataSource === "favorites") {
          headerCells.forEach((cell, index) => {
            if (index < 2) {
              // 大項目・中項目のヘッダー
              cell.classList.add("hidden");
            } else {
              // お気に入りのヘッダー
              cell.classList.remove("hidden");
            }
          });
          dataCells.forEach((cell, index) => {
            if (index < 2) {
              // 大項目・中項目のデータ
              cell.classList.add("hidden");
            } else {
              // お気に入りのデータ
              cell.classList.remove("hidden");
            }
          });
        } else {
          headerCells.forEach((cell, index) => {
            if (index < 2) {
              // 大項目・中項目のヘッダー
              cell.classList.remove("hidden");
            } else {
              // お気に入りのヘッダー
              cell.classList.add("hidden");
            }
          });
          dataCells.forEach((cell, index) => {
            if (index < 2) {
              // 大項目・中項目のデータ
              cell.classList.remove("hidden");
            } else {
              // お気に入りのデータ
              cell.classList.add("hidden");
            }
          });
        }
      }

      getCurrentDefaultWeight() {
        const shaping = this.getCurrentShaping();

        switch (shaping) {
          case "NAI":
            return 0.0;
          case "SD":
          default:
            return 1.0;
        }
      }

      getWeightTooltip() {
        const shaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(shaping);

        switch (shaping) {
          case "NAI":
            return `プロンプト重み (NAI形式)
・0: 重みなし（デフォルト）
・1以上: 強調 {プロンプト}
・-1以下: 弱調 [プロンプト]
・範囲: ${weightConfig.min}～${weightConfig.max}
・ホイール/矢印キーで調整可能`;
          case "SD":
            return `プロンプト重み (SD形式)
・1.0: 重みなし（デフォルト）
・1.1以上: 強調 (プロンプト:値)
・0.9以下: 弱調 (プロンプト:値)
・範囲: ${weightConfig.min}～${weightConfig.max}
・ホイール/矢印キーで調整可能`;
          case "None":
          default:
            return `プロンプト重み (無効)
現在の設定では重み機能は使用されません`;
        }
      }

      populateFavoritesOptions(favoritesSelect) {
        if (!favoritesSelect) return;

        const allDictionaries = AppState.data.promptDictionaries || {};
        const dictionaryIds = Object.keys(allDictionaries);

        const firstDictionaryId = dictionaryIds.length > 0 ? dictionaryIds[0] : "";

        favoritesSelect.innerHTML = "";

        dictionaryIds.forEach((dictId) => {
          const dict = allDictionaries[dictId];
          if (dict && dict.name) {
            const option = UIFactory.createOption({
              value: dictId,
              text: dict.name,
            });
            favoritesSelect.appendChild(option);
          }
        });

        if (firstDictionaryId) {
          favoritesSelect.value = firstDictionaryId;

          const slotId = parseInt(favoritesSelect.dataset.slotId);
          const slot = this.slotManager.slots.find((s) => s.id === slotId);
          if (slot && !slot.favoriteDictionaryId) {
            slot.favoriteDictionaryId = firstDictionaryId;
          }
        }
      }

      setupCategorySelectors(card, slot) {
        const bigSelect = card.querySelector(".category-big-select");
        const middleSelect = card.querySelector(".category-middle-select");

        if (!bigSelect) return;

        bigSelect.innerHTML = '<option value="">すべて</option>';
        const bigCategories = this.getCategoryOptions("big");

        bigCategories.forEach((cat) => {
          const option = UIFactory.createOption({
            value: cat,
            text: cat,
          });
          bigSelect.appendChild(option);
        });

        requestAnimationFrame(() => {
          if (slot.category && slot.category.big) {
            bigSelect.value = slot.category.big;
            this.updateCategoryTooltip(bigSelect); // ツールチップ更新
            this.updateMiddleCategories(middleSelect, slot.category.big);
            middleSelect.disabled = false;

            if (slot.category.middle) {
              requestAnimationFrame(() => {
                middleSelect.value = slot.category.middle;
                this.updateCategoryTooltip(middleSelect); // ツールチップ更新
              });
            }
          }
          this.updateCategoryTooltip(bigSelect);
          this.updateCategoryTooltip(middleSelect);
        });

        bigSelect.addEventListener("change", async (e) => {
          if (!slot.category) {
            slot.category = {};
          }
          slot.category.big = e.target.value;
          slot.category.middle = ""; // 中項目をリセット

          if (e.target.value) {
            this.updateMiddleCategories(middleSelect, e.target.value);
            middleSelect.disabled = false;

            setTimeout(() => {
              if (middleSelect && !middleSelect.disabled) {
                middleSelect.focus();

                try {
                  if (typeof middleSelect.showPicker === "function") {
                    middleSelect.showPicker();
                  } else {
                    const spaceEvent = new KeyboardEvent("keydown", {
                      key: " ",
                      code: "Space",
                      keyCode: 32,
                      which: 32,
                      bubbles: true,
                    });
                    middleSelect.dispatchEvent(spaceEvent);
                  }
                } catch (error) {
                  middleSelect.style.boxShadow = "0 0 10px var(--accent-primary)";
                  middleSelect.style.borderColor = "var(--accent-primary)";

                  setTimeout(() => {
                    middleSelect.style.boxShadow = "";
                    middleSelect.style.borderColor = "";
                  }, 1000);
                }
              }
            }, 150);
          } else {
            middleSelect.innerHTML = '<option value="">すべて</option>';
            middleSelect.disabled = true;
          }

          this.updateCategoryTooltip(bigSelect);
          this.updateCategoryTooltip(middleSelect);

          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotManager.saveToStorage();
        });

        middleSelect.addEventListener("change", async (e) => {
          if (!slot.category) {
            slot.category = {};
          }
          slot.category.middle = e.target.value;

          this.updateCategoryTooltip(middleSelect);

          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotManager.saveToStorage();
        });
      }

      updateCategoryTooltip(selectElement) {
        if (!selectElement) return;

        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption && selectedOption.value) {
          selectElement.title = selectedOption.text;
        } else {
          selectElement.title = "カテゴリーが選択されていません";
        }
      }

      getCategoryOptions(type) {
        if (type === "big") {
          return this.categoryUIManager.getCategoriesByLevel(0, null);
        }
        return [];
      }

      updateMiddleCategories(select, bigCategory) {
        this.categoryUIManager.populateSelectElement(select, 1, bigCategory, "すべて");
      }

      startGroupNameEdit(displayElement, editElement) {
        this.isGroupEditing = true;

        displayElement.style.display = "none";
        editElement.style.display = "inline-block";
        setTimeout(() => {
          editElement.focus();
          editElement.select();
        }, 10);
      }

      startGroupDescriptionEdit(displayElement, editElement) {
        this.isGroupEditing = true;

        displayElement.style.display = "none";
        editElement.style.display = "inline-block";
        setTimeout(() => {
          editElement.focus();
          editElement.select();
        }, 10);
      }

      async finishGroupNameEdit(groupId, displayElement, editElement) {
        const newName = editElement.value.trim();

        if (!newName) {
          ErrorHandler.notify("グループ名を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
          editElement.focus();
          return;
        }

        const groups = this.groupManager.getAllGroups();
        const existingGroup = groups.find((g) => g.id !== groupId && g.name === newName);

        if (existingGroup) {
          ErrorHandler.notify("同じ名前のグループが既に存在します", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
          editElement.focus();
          return;
        }

        try {
          await this.groupManager.updateGroup(groupId, { name: newName });

          displayElement.textContent = newName;
          displayElement.style.display = "block";
          editElement.style.display = "none";

          this.isGroupEditing = false;

          this.updateGroupDisplay();

          ErrorHandler.notify("グループ名を更新しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループ名の更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
          this.cancelGroupEdit(displayElement, editElement, displayElement.textContent);
        }
      }

      async finishGroupDescriptionEdit(groupId, displayElement, editElement) {
        const newDescription = editElement.value.trim();

        try {
          await this.groupManager.updateGroup(groupId, { description: newDescription });

          displayElement.textContent = newDescription || "説明なし";
          displayElement.style.display = "block";
          editElement.style.display = "none";

          this.isGroupEditing = false;

          this.updateGroupDisplay();

          ErrorHandler.notify("グループ説明を更新しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループ説明の更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
          this.cancelGroupEdit(displayElement, editElement, displayElement.textContent);
        }
      }

      cancelGroupEdit(displayElement, editElement, originalValue) {
        editElement.value = originalValue;
        displayElement.style.display = "block";
        editElement.style.display = "none";

        this.isGroupEditing = false;
      }

      addSlotImportExportButtons() {
        const currentGroup = this.groupManager.getCurrentGroup();
        if (!currentGroup) return;

        const existingContainer = document.getElementById("slot-import-export-container");
        if (existingContainer) {
          existingContainer.remove();
        }

        // スロット情報バーの後に配置するため、その要素を取得
        const slotInfoBar = document.querySelector(".slot-info-bar");
        if (!slotInfoBar) return;

        const buttonContainer = document.createElement("div");
        buttonContainer.id = "slot-import-export-container";
        buttonContainer.className = "slot-import-export-container";
        buttonContainer.style.cssText = "margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;";

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";
        fileInput.id = "slot-group-import-file";

        const exportBtn = document.createElement("button");
        exportBtn.className = "action-btn";
        exportBtn.textContent = "エクスポート";
        exportBtn.style.marginRight = "8px";
        exportBtn.id = "slot-group-export-btn";
        exportBtn.title = "現在のスロットグループをJSON形式でエクスポート（設定・スロット内容を含む）";

        const importBtn = document.createElement("button");
        importBtn.className = "action-btn";
        importBtn.textContent = "インポート";
        importBtn.id = "slot-group-import-btn";
        importBtn.title = "JSONファイルからスロットグループをインポート（現在のグループに追加）";

        buttonContainer.appendChild(fileInput);
        buttonContainer.appendChild(exportBtn);
        buttonContainer.appendChild(importBtn);

        slotInfoBar.parentNode.insertBefore(buttonContainer, slotInfoBar.nextSibling);

        this.setupSlotImportExportEvents(exportBtn, importBtn, fileInput);
      }

      setupSlotImportExportEvents(exportBtn, importBtn, fileInput) {
        exportBtn.addEventListener("click", () => {
          this.handleCurrentGroupExport();
        });

        importBtn.addEventListener("click", () => {
          fileInput.click();
        });

        fileInput.addEventListener("change", async (event) => {
          const file = event.target.files[0];
          if (file) {
            await this.handleCurrentGroupImport(file);
            event.target.value = ""; // ファイル選択をリセット
          }
        });
      }

      async handleCurrentGroupExport() {
        try {
          const currentGroup = this.groupManager.getCurrentGroup();
          if (!currentGroup) {
            ErrorHandler.notify("エクスポートするグループが見つかりません", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: NOTIFICATION_DURATION.MEDIUM,
            });
            return;
          }

          await this.groupManager.saveCurrentGroupSlots();

          const exportData = {
            type: "singleSlotGroup",
            version: "1.0",
            exportDate: new Date().toISOString(),
            group: {
              id: currentGroup.id,
              name: currentGroup.name,
              description: currentGroup.description,
            },
            slots: currentGroup.slots.filter((slot) => slot.isUsed),
          };

          const filename = FileUtilities.generateTimestampedFilename(
            `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${currentGroup.name}`,
            "json"
          );

          await FileUtilities.downloadJSON(exportData, filename);

          ErrorHandler.notify(`グループ「${currentGroup.name}」をエクスポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループのエクスポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      async handleCurrentGroupImport(file) {
        try {
          const currentGroup = this.groupManager.getCurrentGroup();
          if (!currentGroup) {
            ErrorHandler.notify("インポート先のグループが見つかりません", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: NOTIFICATION_DURATION.MEDIUM,
            });
            return;
          }

          const data = await FileUtilities.readJSONFile(file);

          if (!data || data.type !== "singleSlotGroup" || !data.slots) {
            throw new Error("Invalid import data format");
          }

          const importedSlotData = {
            version: "1.0",
            slots: data.slots.map((slot, index) => ({
              ...slot,
              id: index, // IDを再割り当て
            })),
          };

          await this.slotManager.importSlots(importedSlotData);

          if (data.group.name && data.group.description) {
            currentGroup.name = data.group.name;
            currentGroup.description = data.group.description;
            await this.groupManager.saveToStorage();
          }

          this.updateDisplay();
          this.updateGroupDisplay();

          ErrorHandler.notify(`グループ「${currentGroup.name}」にインポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループのインポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      setupSortable() {
        const container = this.elements.container;
        if (!container) return;

        $(container).sortable({
          handle: ".slot-drag-handle",
          axis: "y",
          containment: "parent",
          cursor: "move",
          opacity: 0.7,
          tolerance: "pointer",
          placeholder: "slot-card-placeholder",

          start: (event, ui) => {
            this.isSorting = true;
            ui.placeholder.height(ui.item.height());
          },

          stop: (event, ui) => {
            this.isSorting = false;
          },

          update: async (event, ui) => {
            const newOrder = Array.from(container.children).map((card) => parseInt(card.dataset.slotId) || 0);

            // 並び替えはスロットの順序のみを変更し、内容は変更しないため、
            // 現在の入力フィールドの内容を正しいスロットに保存する必要がある
            const currentSlotIdBeforeReorder = this.slotManager.slots[this.slotManager.currentSlot]?.id;

            if (currentSlotIdBeforeReorder !== undefined) {
              const currentSlotBeforeReorder = this.slotManager.slots[this.slotManager.currentSlot];
              if (currentSlotBeforeReorder) {
                const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
                const currentPrompt = generatePrompt?.value || "";
                currentSlotBeforeReorder.prompt = currentPrompt;
                // elements は現在のスロットの既存値を維持（入力フィールドからは取得不可）
                currentSlotBeforeReorder.isUsed = currentPrompt.length > 0;
                currentSlotBeforeReorder.lastModified = currentSlotBeforeReorder.isUsed ? Date.now() : null;
              }
            }

            this.slotManager.reorderSlots(newOrder);

            await this.slotManager.saveToStorage();

            // 重要: 並び替え後にGeneratePromptを現在のスロットの内容で更新
            const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];
            if (currentSlot) {
              const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
              if (generatePrompt) {
                if (currentSlot.prompt) {
                  const weightedPrompt = this.slotManager.applyWeightToPrompt(currentSlot.prompt, currentSlot.weight);
                  generatePrompt.value = weightedPrompt;
                } else {
                  generatePrompt.value =
                    currentSlot.mode === "random" || currentSlot.mode === "sequential"
                      ? "[抽出待機中 - Generateボタンを押して抽出]"
                      : "";
                }
              }
            }

            await this.slotManager.saveToStorage();

            this.updateSlotNumbers();
          },
        });
      }

      updateSlotNumbers() {
        const container = this.elements.container;
        if (!container) return;

        Array.from(container.children).forEach((card, index) => {
          const numberSpan = card.querySelector(".slot-number");
          if (numberSpan) {
            const displayNumber = index + 1;
            numberSpan.textContent = displayNumber;

            const slotId = parseInt(card.dataset.slotId);
            const isCurrentSlot = this.slotManager.slots[this.slotManager.currentSlot]?.id === slotId;

            if (isCurrentSlot) {
              numberSpan.classList.add("slot-number-current");
              card.classList.add("slot-card-current");
            } else {
              numberSpan.classList.remove("slot-number-current");
              card.classList.remove("slot-card-current");
            }
          }
        });

        const usedCount = this.slotManager.getUsedSlotsCount();
        const totalCount = this.slotManager.slots.length;
        const countSpan = this.getElement(DOM_SELECTORS.BY_ID.SLOT_USED_COUNT);
        if (countSpan) {
          countSpan.textContent = `${usedCount}/${totalCount}`;
        }
      }

      showCombinePreview() {
        const modalDirect = document.querySelector("#combine-preview-modal");

        const modal = this.getElement(DOM_SELECTORS.BY_ID.SLOT_PREVIEW_MODAL);

        if (!modal && !modalDirect) {
          return;
        }

        const targetModal = modal || modalDirect;

        const combined = this.slotManager.getCombinedPrompt();
        const usedSlots = this.slotManager.getUsedSlots();

        if (usedSlots.length === 0) {
          ErrorHandler.notify("使用中のスロットがありません", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: 2000,
          });
          return;
        }

        const previewCountElement = document.querySelector("#used-slots-count-preview");
        if (previewCountElement) {
          previewCountElement.textContent = usedSlots.length;
        }

        const slotTable = document.querySelector("#slot-info-table");
        if (slotTable) {
          slotTable.innerHTML = usedSlots
            .map((slot) => {
              let description = slot.name || "(名前なし)";

              if (slot.mode === "random" || slot.mode === "sequential") {
                description += ` <span class="extraction-mode-label">[${
                  slot.mode === "random" ? "ランダム" : "連続"
                }抽出]</span>`;
                if (slot.category?.big) {
                  description += ` ${slot.category.big}`;
                  if (slot.category.middle) {
                    description += ` > ${slot.category.middle}`;
                  }
                }
                if (slot.currentExtraction) {
                  description += `<br><small class="current-extraction-info">現在: ${slot.currentExtraction}</small>`;
                  if (slot.currentExtractionSmall) {
                    description += `<br><small class="current-extraction-small">小項目: ${slot.currentExtractionSmall}</small>`;
                  }
                }
              }

              const actualSlot = this.slotManager.slots.find((s) => s.id === slot.id);
              if (actualSlot?.muted) {
                description += ` <span style="color: var(--accent-warning); font-weight: bold;">[MUTED]</span>`;
              }

              return `
        <tr>
          <td class="slot-info-label">スロット${slot.id}:</td>
          <td class="slot-info-content">${description}</td>
        </tr>
      `;
            })
            .join("");
        }

        const resultDiv = document.querySelector("#combine-preview-result");
        if (resultDiv) {
          const formattedPrompt = combined
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
            .join(",<br>");
          resultDiv.innerHTML = formattedPrompt;
        }

        const charCountElement = document.querySelector("#combined-char-count");
        if (charCountElement) {
          charCountElement.textContent = combined.length;
        }

        targetModal.style.display = "flex";

        const oldModal = targetModal.cloneNode(true);
        targetModal.parentNode.replaceChild(oldModal, targetModal);

        const newModal = document.querySelector("#combine-preview-modal");

        newModal.addEventListener("click", (e) => {
          if (e.target === newModal) {
            newModal.style.display = "none";
          }
        });

        document.getElementById(DOM_IDS.PANELS.CLOSE_PREVIEW).addEventListener("click", () => {
          newModal.style.display = "none";
        });

        document.getElementById(DOM_IDS.BUTTONS.COPY_COMBINED).addEventListener("click", () => {
          navigator.clipboard.writeText(combined).then(() => {
            ErrorHandler.notify("結合プロンプトをコピーしました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: 2000,
            });
          });
        });

        const handleEsc = (e) => {
          if (e.key === "Escape") {
            newModal.style.display = "none";
            document.removeEventListener("keydown", handleEsc);
          }
        };
        document.addEventListener("keydown", handleEsc);
      }

      async handleClearAll() {
        const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;

        if (!shouldConfirm || confirm("すべてのスロットをクリアしますか？")) {
          await this.slotManager.clearAllSlots();
          this.updateDisplay();

          if (window.ListRefreshManager) {
            await window.ListRefreshManager.executeAction(window.ListRefreshManager.ACTIONS.SLOT_CLEAR, {
              context: { action: "clearAll" },
              showNotification: false, // すでに通知は表示済み
              delay: 100,
            });
          }
        }
      }

      async handleContainerClick(e) {
        if (this.isSorting) return;

        const target = e.target;

        if (target.classList.contains("slot-mute-btn")) {
          const slotId = parseInt(target.dataset.slotId);
          await this.slotManager.toggleSlotMute(slotId);
          this.updateDisplay();
          return;
        } else if (target.classList.contains("slot-clear-btn")) {
          const slotId = parseInt(target.dataset.slotId);
          const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;

          if (!shouldConfirm || confirm("このスロットの内容をクリアしますか？")) {
            await this.slotManager.clearSlot(slotId);
            this.updateDisplay();

            if (window.ListRefreshManager) {
              await window.ListRefreshManager.executeAction(window.ListRefreshManager.ACTIONS.SLOT_CLEAR, {
                context: { action: "clearSlot", slotId: slotId },
                showNotification: false, // すでに通知は表示済み
                delay: 100,
              });
            }
          }
        } else if (target.classList.contains("slot-delete-btn")) {
          const slotId = parseInt(target.dataset.slotId);
          const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;

          if (!shouldConfirm || confirm("このスロットを削除しますか？")) {
            await this.slotManager.deleteSlot(slotId);
            this.updateDisplay();
          }
          return;
        } else if (target.classList.contains("slot-weight-input")) {
          const slotId = parseInt(target.dataset.slotId);

          // inputイベントで即座に保存（ホイール操作とタイピング対応）
          if (event.type === "input") {
            await this.saveWeightEdit(slotId, parseFloat(target.value));
            return;
          }

          if (event.type === "keydown" && event.key === "Enter") {
            await this.saveWeightEdit(slotId, parseFloat(target.value));
            target.blur(); // フォーカスを外す
            return;
          }

          return;
        } else if (target.classList.contains("slot-card") || target.closest(".slot-card")) {
          if (
            target.matches(
              "button, input, select, textarea, .slot-actions *, .slot-weight-controls *, .slot-mode-container *, .slot-weight-input"
            )
          ) {
            return; // 既存のボタン処理を続行
          }

          const card = target.closest(".slot-card");
          if (card) {
            const slotId = parseInt(card.dataset.slotId);

            await this.slotManager.switchSlot(slotId);
            this.updateDisplay();
            return; // 処理完了
          }
        }
      }

      async saveWeightEdit(slotId, newWeight) {
        try {
          if (isNaN(newWeight)) {
            window.ErrorHandler?.notify("無効な重み値です", {
              type: window.ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: 3000,
            });
            return;
          }

          const slot = this.slotManager.slots.find((s) => s.id === slotId);
          if (!slot) return;

          slot.weight = newWeight;
          const shaping = this.getCurrentShaping();
          if (shaping === "NAI") {
            slot.absoluteWeight = WeightConverter.convertNAIToSD(newWeight);
          } else {
            slot.absoluteWeight = newWeight;
          }

          await this.slotManager.saveToStorage();

          this.updateWeightDisplay(slotId, newWeight);
        } catch (error) {
          window.ErrorHandler?.notify("重みの保存に失敗しました", {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: 3000,
          });
        }
      }

      updateWeightDisplay(slotId, newWeight) {
        const card = document.querySelector(`.slot-card[data-slot-id="${slotId}"]`);
        if (!card) return;

        const weightInput = card.querySelector(".slot-weight-input");

        if (weightInput) {
          weightInput.value = newWeight;
        }
      }

      async handleContainerChange(e) {
        const target = e.target;

        if (target.classList.contains("slot-mode-select")) {
          const slotId = parseInt(target.dataset.slotId);
          const newMode = target.value;
          const slot = this.slotManager.slots.find((s) => s.id === slotId);

          if (slot) {
            slot.mode = newMode;

            if (!slot.category) {
              slot.category = { big: "", middle: "" };
            }

            if (newMode === "sequential") {
              slot.sequentialIndex = 0;
            }

            await this.slotManager.saveToStorage();

            this.slotManager.updateUI();

            const card = target.closest(".slot-card");
            if (card) {
              const updatedInfo = this.slotManager.getSlotInfo(slotId);
              const slotIndex = this.slotManager.slots.findIndex((s) => s.id === slotId);
              updatedInfo.displayNumber = slotIndex + 1;

              const newCard = this.createSlotCard(updatedInfo);
              card.replaceWith(newCard);
            }
          }
        } else if (target.classList.contains("slot-name-edit")) {
          const slotId = parseInt(target.dataset.slotId);
          const newName = target.value;
          await this.slotManager.setSlotName(slotId, newName);
        } else if (target.classList.contains("slot-prompt-edit")) {
          await this.handlePromptEdit(target);
        }
      }

      async handlePromptEdit(target) {
        try {
          const slotId = parseInt(target.dataset.slotId);
          const newPrompt = target.value.trim();

          const slot = this.slotManager.slots.find((s) => s.id === slotId);
          if (!slot) {
            return;
          }

          slot.prompt = newPrompt;
          slot.isUsed = newPrompt.length > 0;
          slot.lastModified = slot.isUsed ? Date.now() : null;

          await this.slotManager.saveToStorage();

          this.updateDisplay();
        } catch (error) {
          window.ErrorHandler?.notify("プロンプトの保存に失敗しました", {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: 3000,
          });
        }
      }

      updateSlotExtraction(slotId, extraction) {
        const slotCard = document.querySelector(`.slot-card[data-slot-id="${slotId}"]`);
        if (!slotCard) return;

        const slot = this.slotManager.slots.find((s) => s.id === slotId);
        if (!slot) return;

        let indicator = slotCard.querySelector(".update-indicator");
        if (!indicator) {
          indicator = this.createUpdateIndicator(slotCard);
        }

        indicator.style.display = "inline-block";

        const extractionDisplay = slotCard.querySelector(".current-extraction-display");
        if (extractionDisplay) {
          extractionDisplay.innerHTML = `
      <div class="extraction-display-content">
        <strong>現在:</strong> ${extraction}
        ${slot.currentExtractionSmall ? `<br><small class="extraction-small-item">小項目: ${slot.currentExtractionSmall}</small>` : ""}
        <span class="extraction-timestamp">${new Date().toLocaleTimeString()}</span>
      </div>
    `;
        }

        const promptTextarea = slotCard.querySelector(`.slot-prompt-edit[data-slot-id="${slotId}"]`);
        if (promptTextarea) {
          promptTextarea.value = extraction;
          promptTextarea.disabled = false;

          const charCount = slotCard.querySelector(".slot-char-count");
          if (charCount) {
            charCount.textContent = `${extraction.length} 文字`;
          }
        }

        if (slot.mode === "sequential") {
          const sequentialInput = slotCard.querySelector(".sequential-index-input");
          if (sequentialInput) {
            sequentialInput.value = slot.sequentialIndex || 0;
          }
        }

        setTimeout(() => {
          indicator.style.display = "none";
        }, 500);
      }

      createUpdateIndicator(slotCard) {
        const indicator = document.createElement("span");
        indicator.className = "update-indicator";
        indicator.innerHTML = "🔄";
        slotCard.appendChild(indicator);
        return indicator;
      }

      refreshExtractionDisplays() {
        this.slotManager.slots.forEach((slot) => {
          if (slot.currentExtraction && (slot.mode === "random" || slot.mode === "sequential")) {
            this.updateSlotExtraction(slot.id, slot.currentExtraction);
          }
        });
      }

      async onShow() {
        await this.slotManager.saveCurrentSlot();

        await this.slotManager.loadFromStorage();

        // 他のタブで記法が変更された可能性があるため、現在の記法状態を同期
        const currentShaping = this.getCurrentShaping();
        if (this.currentShapingMode !== currentShaping) {
          this.updateSlotWeightsForNewShaping(this.currentShapingMode, currentShaping);

          this.currentShapingMode = currentShaping;
        }

        this.updateDisplay();
      }

      setupEventListeners() {
        const container = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CONTAINER);
        if (!container) return;

        this.addEventListener(container, "click", async (e) => {
          await this.handleContainerClick(e);
        });

        this.addEventListener(container, "keydown", async (e) => {
          await this.handleContainerClick(e);
        });

        this.addEventListener(
          container,
          "blur",
          async (e) => {
            await this.handleContainerClick(e);
          },
          true
        ); // キャプチャフェーズで処理

        // inputイベント（ホイール操作での値変更に対応）
        this.addEventListener(container, "input", async (e) => {
          await this.handleContainerClick(e);
        });

        this.addEventListener(container, "change", async (e) => {
          await this.handleContainerChange(e);
        });

        this.addEventListener(
          container,
          "blur",
          async (e) => {
            if (e.target.classList.contains("slot-prompt-edit")) {
              await this.handlePromptEdit(e.target);
            }
          },
          true
        ); // キャプチャフェーズで処理

        this.addEventListener(container, "keydown", async (e) => {
          if (e.target.classList.contains("slot-prompt-edit") && e.key === "Enter") {
            e.preventDefault(); // デフォルトの改行動作を防止
            await this.handlePromptEdit(e.target);
            e.target.blur(); // フォーカスを外す
          }
        });

        if (this.elements.clearAllBtn) {
          this.addEventListener(this.elements.clearAllBtn, "click", () => this.handleClearAll());
        }

        if (this.elements.exportBtn) {
          this.addEventListener(this.elements.exportBtn, "click", () => this.handleExport());
        }

        if (this.elements.importBtn) {
          this.addEventListener(this.elements.importBtn, "click", () => this.handleImport());
        }
      }

      updateSlotWeightsForNewShaping(oldShaping, newShaping) {
        const currentFormat = newShaping || "SD";
        let updatedCount = 0;
        let promptUpdatedCount = 0;

        this.slotManager.slots.forEach((slot, index) => {
          const oldPrompt = slot.prompt;

          if (oldPrompt && oldShaping !== newShaping) {
            const convertedPrompt = WeightConverter.convertPromptNotation(oldPrompt, oldShaping, newShaping);

            if (convertedPrompt !== oldPrompt) {
              slot.prompt = convertedPrompt;
              promptUpdatedCount++;
            }
          }

          // absoluteWeightが0の場合、それは間違った初期値の可能性があるため修正
          if (slot.absoluteWeight === 0 && oldShaping === "NAI" && newShaping === "SD") {
            slot.absoluteWeight = 1.0;
          } else if (slot.absoluteWeight === 1.0 && oldShaping === "SD" && newShaping === "NAI") {
            slot.absoluteWeight = 0.0;
          }

          const absoluteWeight = slot.absoluteWeight;
          const oldWeight = slot.weight;

          if (currentFormat === "NAI") {
            slot.weight = WeightConverter.convertSDToNAI(absoluteWeight);
          } else if (currentFormat === "SD") {
            slot.weight = absoluteWeight; // SD形式なら絶対値そのまま
          } else {
            slot.weight = 1.0; // None形式のデフォルト
          }

          // 範囲制限
          const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());
          slot.weight = Math.max(weightConfig.min, Math.min(weightConfig.max, slot.weight));

          if (oldWeight !== slot.weight) {
            updatedCount++;
          }
        });

        if (oldShaping !== newShaping) {
          const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          const currentEditorPrompt = generatePrompt?.value || "";

          if (currentEditorPrompt) {
            const convertedEditorPrompt = WeightConverter.convertPromptNotation(
              currentEditorPrompt,
              oldShaping,
              newShaping
            );

            if (convertedEditorPrompt !== currentEditorPrompt && generatePrompt) {
              generatePrompt.value = convertedEditorPrompt;

              // 現在のスロットにも反映
              const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];
              if (currentSlot) {
                currentSlot.prompt = convertedEditorPrompt;
              }

              if (window.app && typeof window.app.updatePromptDisplay === "function") {
                window.app.updatePromptDisplay();
              }
            }
          }
        }

        this.updateWeightDisplayValues();

        this.updateDisplay();

        if (updatedCount > 0 || promptUpdatedCount > 0) {
          this.slotManager.saveToStorage();
        }
      }

      updateWeightDisplayValues() {
        this.forceDisplayRefresh();
      }

      forceDisplayRefresh() {
        setTimeout(() => {
          this.updateDisplay();
        }, 50);
      }

      async onRefresh() {
        await this.slotManager.loadFromStorage();
        this.updateDisplay();
      }

      setupGroupEventListeners() {
        if (this.elements.groupSelector) {
          this.addEventListener(this.elements.groupSelector, "change", async (e) => {
            if (this.isGroupEditing) {
              return;
            }

            const groupId = e.target.value;

            const beforeGroup = this.groupManager.getCurrentGroup();

            await this.groupManager.switchToGroup(groupId);

            const afterGroup = this.groupManager.getCurrentGroup();

            this.updateDisplay();
            this.updateGroupDisplay();
          });
        }

        if (this.elements.groupManageBtn) {
          this.addEventListener(this.elements.groupManageBtn, "click", () => {
            this.showGroupManagementModal();
          });
        }

        const closeBtn = document.getElementById("close-slot-group-management");
        const closeBtnFooter = document.getElementById("close-slot-group-management-footer");
        if (closeBtn) {
          this.addEventListener(closeBtn, "click", () => {
            this.hideGroupManagementModal();
          });
        }
        if (closeBtnFooter) {
          this.addEventListener(closeBtnFooter, "click", () => {
            this.hideGroupManagementModal();
          });
        }

        if (this.elements.groupModal) {
          this.addEventListener(this.elements.groupModal, "click", (e) => {
            if (e.target === this.elements.groupModal) {
              this.hideGroupManagementModal();
            }
          });
        }

        if (this.elements.groupCreateBtn) {
          this.addEventListener(this.elements.groupCreateBtn, "click", async () => {
            await this.handleCreateGroup();
          });
        }

        if (this.elements.groupCopyBtn) {
          this.addEventListener(this.elements.groupCopyBtn, "click", async () => {
            await this.handleCopyGroup();
          });
        }

        if (this.elements.groupDeleteBtn) {
          this.addEventListener(this.elements.groupDeleteBtn, "click", async () => {
            await this.handleDeleteGroup();
          });
        }

        if (this.elements.exportGroupBtn) {
          this.addEventListener(this.elements.exportGroupBtn, "click", async () => {
            await this.handleExportGroup();
          });
        }

        if (this.elements.importGroupBtn) {
          this.addEventListener(this.elements.importGroupBtn, "click", async () => {
            await this.handleImportGroup();
          });
        }

        const importAllBtn = document.getElementById("slot-group-import-all-btn");
        if (importAllBtn) {
          this.addEventListener(importAllBtn, "click", async () => {
            await this.handleImportAll();
          });
        }

        const exportAllBtn = document.getElementById("slot-group-export-all-btn");
        if (exportAllBtn) {
          this.addEventListener(exportAllBtn, "click", async () => {
            await this.handleExportAll();
          });
        }

        window.addEventListener("slotGroupChanged", (event) => {
          this.updateGroupDisplay();

          ErrorHandler.notify(`グループ「${event.detail.groupName}」に切り替えました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        });
      }

      updateGroupDisplay() {
        if (this.isGroupEditing) {
          return;
        }

        const selector = this.elements.groupSelector;
        const description = this.elements.groupDescription;

        if (!selector || !description) {
          return;
        }

        selector.innerHTML = "";
        const groups = this.groupManager.getAllGroups();

        groups.forEach((group) => {
          const option = document.createElement("option");
          option.value = group.id;
          option.textContent = group.name;
          option.selected = group.isCurrent;
          selector.appendChild(option);
        });

        const currentGroup = this.groupManager.getCurrentGroup();
        if (currentGroup) {
          description.textContent = currentGroup.description || "";

          this.updateModalCurrentGroupInfo(currentGroup);

          if (this.elements.groupDeleteBtn) {
            this.elements.groupDeleteBtn.disabled = currentGroup.isDefault;
          }
        }
      }

      initModal() {
        this.groupManagementModal = BaseModal.create(
          "slot-group-management-modal",
          "📁 スロットグループ管理",
          `
          <div class="current-group-info">
            <h4>現在のグループ</h4>
            <div class="current-group-details">
              <strong id="current-group-name">-</strong>
              <p id="current-group-description">-</p>
            </div>
          </div>
          <div class="group-actions">
            <button id="slot-group-create-btn" title="新しいスロットグループを作成（最大20グループまで）">➕ 新しいグループを作成</button>
            <button id="slot-group-import-all-btn" title="JSONファイルから全グループデータをインポート（現在のデータは上書きされます）">📂 全体インポート</button>
            <button id="slot-group-export-all-btn" title="全グループのスロットデータをJSON形式でエクスポート（バックアップ・共有用）">📤 全体エクスポート</button>
          </div>
          <div class="all-groups-section">
            <h4>全グループ一覧</h4>
            <div id="all-groups-list" class="all-groups-container"></div>
          </div>
        `,
          {
            closeOnBackdrop: true,
            closeOnEsc: true,
            showCloseButton: true,
            showHeader: true,
            showFooter: false, // フッターを非表示にし統一感を保つ
            headerActions: [],
            // footerActionsを削除（コンテンツ部分に存在するため）
          }
        );

        this.groupManagementModal.onShow(() => {
          this.updateModalCurrentGroupInfo();
          this.updateAllGroupsList();
        });
      }

      showGroupManagementModal() {
        this.groupManagementModal.show();
      }

      hideGroupManagementModal() {
        this.groupManagementModal.hide();
      }

      updateModalCurrentGroupInfo(group = null) {
        const currentGroup = group || this.groupManager.getCurrentGroup();
        if (!currentGroup) return;

        const nameElement = document.getElementById("current-group-name");
        const descriptionElement = document.getElementById("current-group-description");

        if (nameElement) {
          nameElement.textContent = currentGroup.name;
        }
        if (descriptionElement) {
          descriptionElement.textContent = currentGroup.description || "説明なし";
        }
      }

      updateAllGroupsList() {
        if (this.isGroupEditing) {
          return;
        }

        const listContainer = document.getElementById("all-groups-list");
        if (!listContainer) return;

        listContainer.innerHTML = "";
        const groups = this.groupManager.getAllGroups();
        const currentGroup = this.groupManager.getCurrentGroup();

        groups.forEach((group) => {
          const item = document.createElement("div");
          item.className = `group-list-item ${group.id === currentGroup?.id ? "current" : ""}`;

          item.innerHTML = `
            <div class="group-item-info">
              <div class="group-item-name-container">
                <div class="group-item-name" data-group-id="${group.id}" title="ダブルクリックで名前を編集">${group.name}</div>
                <input class="group-item-name-edit" data-group-id="${group.id}" value="${group.name}" style="display: none;">
              </div>
              <div class="group-item-description-container">
                <div class="group-item-description" data-group-id="${group.id}" title="ダブルクリックで説明を編集">${group.description || "説明なし"}</div>
                <input class="group-item-description-edit" data-group-id="${group.id}" value="${group.description || ""}" style="display: none;">
              </div>
            </div>
            <div class="group-item-actions">
              <button class="action-btn small-btn copy-btn" data-group-id="${group.id}" title="このグループをコピー">
                📋
              </button>
              <button class="action-btn small-btn delete-btn" data-group-id="${group.id}" title="このグループを削除">
                🗑️
              </button>
            </div>
          `;

          item.addEventListener("click", (e) => {
            if (
              e.target.closest(".group-item-actions") ||
              e.target.classList.contains("group-item-name-edit") ||
              e.target.classList.contains("group-item-description-edit")
            ) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();
            const groupId = group.id;
            this.switchToGroup(groupId);
          });

          const copyButton = item.querySelector(".copy-btn");
          copyButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const groupId = e.target.dataset.groupId;
            this.handleCopyGroup(groupId);
          });

          const deleteButton = item.querySelector(".delete-btn");
          deleteButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const groupId = e.target.dataset.groupId;
            this.handleDeleteGroup(groupId);
          });

          const nameDisplay = item.querySelector(".group-item-name");
          const nameEdit = item.querySelector(".group-item-name-edit");

          nameDisplay.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.startGroupNameEdit(nameDisplay, nameEdit);
          });

          nameEdit.addEventListener("blur", async (e) => {
            await this.finishGroupNameEdit(group.id, nameDisplay, nameEdit);
          });

          nameEdit.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await this.finishGroupNameEdit(group.id, nameDisplay, nameEdit);
            } else if (e.key === "Escape") {
              this.cancelGroupEdit(nameDisplay, nameEdit, group.name);
            }
          });

          const descDisplay = item.querySelector(".group-item-description");
          const descEdit = item.querySelector(".group-item-description-edit");

          descDisplay.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.startGroupDescriptionEdit(descDisplay, descEdit);
          });

          descEdit.addEventListener("blur", async () => {
            await this.finishGroupDescriptionEdit(group.id, descDisplay, descEdit);
          });

          descEdit.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await this.finishGroupDescriptionEdit(group.id, descDisplay, descEdit);
            } else if (e.key === "Escape") {
              this.cancelGroupEdit(descDisplay, descEdit, group.description || "");
            }
          });

          listContainer.appendChild(item);
        });
      }

      async switchToGroup(groupId) {
        if (this.isGroupEditing) {
          return;
        }

        await this.groupManager.switchToGroup(groupId);
        this.updateDisplay();
        this.updateGroupDisplay();
        this.updateAllGroupsList();
      }

      async handleCreateGroup() {
        const name = prompt("新しいグループの名前を入力してください:");
        if (!name || name.trim() === "") return;

        const description = prompt("グループの説明を入力してください（省略可能）:") || "";

        try {
          const groupId = await this.groupManager.createGroup(name.trim(), description.trim());
          this.updateGroupDisplay();

          ErrorHandler.notify(`グループ「${name}」を作成しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループの作成に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      async handleCopyGroup(groupId = null) {
        const sourceGroup = groupId ? this.groupManager.getGroup(groupId) : this.groupManager.getCurrentGroup();
        if (!sourceGroup) return;

        const name = prompt(`「${sourceGroup.name}」のコピー名を入力してください:`, `${sourceGroup.name}のコピー`);
        if (!name || name.trim() === "") return;

        try {
          const newGroupId = await this.groupManager.copyGroup(sourceGroup.id, name.trim());
          this.updateGroupDisplay();
          this.updateAllGroupsList();

          ErrorHandler.notify(`グループ「${name}」をコピーしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループのコピーに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      async handleEditGroup(groupId = null) {
        const targetGroup = groupId ? this.groupManager.getGroup(groupId) : this.groupManager.getCurrentGroup();
        if (!targetGroup) return;

        const name = prompt("グループ名を編集してください:", targetGroup.name);
        if (!name || name.trim() === "") return;

        const description = prompt("グループの説明を編集してください:", targetGroup.description || "");

        try {
          await this.groupManager.updateGroup(targetGroup.id, {
            name: name.trim(),
            description: description?.trim() || "",
          });

          this.updateGroupDisplay();
          this.updateAllGroupsList();

          ErrorHandler.notify(`グループ「${name}」を更新しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループの編集に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      async handleDeleteGroup(groupId = null) {
        const targetGroup = groupId ? this.groupManager.getGroup(groupId) : this.groupManager.getCurrentGroup();
        if (!targetGroup) return;

        if (targetGroup.isDefault) {
          ErrorHandler.notify("デフォルトグループは削除できません", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
          return;
        }

        const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
        if (!shouldConfirm || confirm(`グループ「${targetGroup.name}」を削除しますか？`)) {
          try {
            await this.groupManager.deleteGroup(targetGroup.id);
            this.updateDisplay();
            this.updateGroupDisplay();
            this.updateAllGroupsList();

            ErrorHandler.notify(`グループ「${targetGroup.name}」を削除しました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.SHORT,
            });
          } catch (error) {
            ErrorHandler.notify("グループの削除に失敗しました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: NOTIFICATION_DURATION.MEDIUM,
            });
          }
        }
      }

      async handleExportGroup() {
        const currentGroup = this.groupManager.getCurrentGroup();
        if (!currentGroup) return;

        try {
          const exportData = this.groupManager.exportGroup(currentGroup.id);
          const filename = FileUtilities.generateTimestampedFilename(
            `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${currentGroup.name}`,
            "json"
          );

          await FileUtilities.downloadJSON(exportData, filename);

          ErrorHandler.notify(`グループ「${currentGroup.name}」をエクスポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループのエクスポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      async handleImportGroup() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const data = JSON.parse(text);

            const groupName = prompt(
              "インポートするグループの名前を入力してください:",
              data.group?.name || "インポートしたグループ"
            );
            if (!groupName || groupName.trim() === "") return;

            await this.groupManager.importGroup(data, groupName.trim());
            this.updateGroupDisplay();

            ErrorHandler.notify(`グループ「${groupName}」をインポートしました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.SHORT,
            });
          } catch (error) {
            ErrorHandler.notify("グループのインポートに失敗しました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: NOTIFICATION_DURATION.MEDIUM,
            });
          }
        });

        input.click();
      }

      async handleImportToGroup(groupId) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const data = JSON.parse(text);

            const targetGroup = this.groupManager.getGroup(groupId);
            if (!targetGroup) {
              ErrorHandler.notify("指定されたグループが見つかりません", {
                type: ErrorHandler.NotificationType.TOAST,
                messageType: "error",
                duration: NOTIFICATION_DURATION.MEDIUM,
              });
              return;
            }

            const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
            if (
              shouldConfirm &&
              !confirm(`グループ「${targetGroup.name}」にインポートしますか？\n現在のスロットデータは上書きされます。`)
            ) {
              return;
            }

            if (data.type === "singleSlotGroup" && data.group && data.slots) {
              await this.groupManager.switchToGroup(groupId);

              await this.slotManager.clearAllSlots();

              for (const slot of data.slots) {
                await this.slotManager.setSlot(slot.id, slot.prompt, slot.elements);
              }

              if (data.group.name && data.group.description) {
                const group = this.groupManager.groups.find((g) => g.id === groupId);
                if (group) {
                  group.name = data.group.name;
                  group.description = data.group.description;
                  await this.groupManager.saveToStorage();
                }
              }
            } else {
              throw new Error("Invalid import data format");
            }
            this.updateDisplay();
            this.updateGroupDisplay();
            this.updateAllGroupsList();

            ErrorHandler.notify(`グループ「${targetGroup.name}」にインポートしました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.SHORT,
            });
          } catch (error) {
            ErrorHandler.notify("グループのインポートに失敗しました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: NOTIFICATION_DURATION.MEDIUM,
            });
          }
        });

        input.click();
      }

      async handleExportSpecificGroup(groupId) {
        const targetGroup = this.groupManager.getGroup(groupId);
        if (!targetGroup) {
          ErrorHandler.notify("指定されたグループが見つかりません", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
          return;
        }

        try {
          const groupSlots = targetGroup.slots || [];

          const exportData = {
            type: "singleSlotGroup",
            version: "1.0",
            exportDate: new Date().toISOString(),
            group: {
              id: targetGroup.id,
              name: targetGroup.name,
              description: targetGroup.description,
            },
            slots: groupSlots.filter((slot) => slot.isUsed),
          };
          const filename = FileUtilities.generateTimestampedFilename(
            `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${targetGroup.name}`,
            "json"
          );

          await FileUtilities.downloadJSON(exportData, filename);

          ErrorHandler.notify(`グループ「${targetGroup.name}」をエクスポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("グループのエクスポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      async handleImportAll() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data || data.type !== "allSlotGroups") {
              throw new Error("無効なファイル形式です。全体エクスポートファイルを選択してください。");
            }

            const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
            if (
              shouldConfirm &&
              !confirm("全グループをインポートしますか？\n現在のすべてのスロットデータは上書きされます。")
            ) {
              return;
            }

            if (data.type === "allSlotGroups" && data.groups) {
              if (!(this.groupManager.groups instanceof Map)) {
                throw new Error("グループマネージャーが正しく初期化されていません");
              }

              const defaultGroup = Array.from(this.groupManager.groups.values()).find((g) => g.isDefault);
              const newGroups = new Map();
              if (defaultGroup) {
                newGroups.set(defaultGroup.id, defaultGroup);
              }

              if (!Array.isArray(data.groups)) {
                throw new Error("グループデータは配列形式である必要があります");
              }

              for (const group of data.groups) {
                if (!group.isDefault && group.id) {
                  newGroups.set(group.id, group);
                } else if (group.isDefault) {
                  if (defaultGroup) {
                    defaultGroup.slots = group.slots;
                    defaultGroup.name = group.name;
                    defaultGroup.description = group.description;
                  }
                }
              }

              this.groupManager.groups = newGroups;

              if (data.currentGroupId) {
                this.groupManager.currentGroupId = data.currentGroupId;
              }

              await this.groupManager.saveToStorage();

              await this.groupManager.loadGroupSlots(this.groupManager.currentGroupId);
            } else {
              throw new Error("Invalid import data format");
            }
            this.updateDisplay();
            this.updateGroupDisplay();
            this.updateAllGroupsList();

            ErrorHandler.notify("全グループをインポートしました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.SHORT,
            });

            this.hideGroupManagementModal();
          } catch (error) {
            ErrorHandler.notify(error.message || "全体インポートに失敗しました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "error",
              duration: NOTIFICATION_DURATION.MEDIUM,
            });
          }
        });

        input.click();
      }

      async handleExportAll() {
        try {
          const exportData = {
            type: "allSlotGroups",
            version: "1.0",
            exportDate: new Date().toISOString(),
            groups: Array.from(this.groupManager.groups.values()), // MapをArrayに変換
            currentGroupId: this.groupManager.currentGroupId,
          };
          const filename = FileUtilities.generateTimestampedFilename(EXPORT_FILE_NAMES.ALL_SLOT_GROUPS, "json");

          await FileUtilities.downloadJSON(exportData, filename);

          ErrorHandler.notify("全グループをエクスポートしました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        } catch (error) {
          ErrorHandler.notify("全体エクスポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM,
          });
        }
      }

      adjustContainerHeight() {
        const container = this.elements.container;
        if (!container) return;

        if (!this.isCurrentTab()) return;

        try {
          const slotTab = document.getElementById("slotTabBody");
          if (!slotTab || !slotTab.classList.contains("is-show")) return;

          const h2 = slotTab.querySelector("h2");
          const groupHeader = slotTab.querySelector(".slot-group-header-compact");
          const slotInfoBar = slotTab.querySelector(".slot-info-bar");

          let fixedHeight = 0;

          if (h2) fixedHeight += h2.offsetHeight;
          if (groupHeader) fixedHeight += groupHeader.offsetHeight;
          if (slotInfoBar) fixedHeight += slotInfoBar.offsetHeight;

          const computedStyle = window.getComputedStyle(slotTab);
          const tabPadding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);

          const parentContainer = slotTab.parentElement;
          const availableHeight = parentContainer.clientHeight - tabPadding - fixedHeight - 40; // 40pxはマージン調整

          const minHeight = 200;
          const maxHeight = Math.max(minHeight, availableHeight);

          container.style.maxHeight = `${maxHeight}px`;
          container.style.height = `${maxHeight}px`;
        } catch (error) {
          container.style.maxHeight = "calc(100vh - 320px)";
        }
      }

      handleWindowResize() {
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
          if (this.isCurrentTab()) {
            this.adjustContainerHeight();
          }
        }, 100);
      }

      async onShow() {
        await this.slotManager.saveCurrentSlot();

        await this.slotManager.loadFromStorage();

        // 他のタブで記法が変更された可能性があるため、現在の記法状態を同期
        const currentShaping = this.getCurrentShaping();
        if (this.currentShapingMode !== currentShaping) {
          this.updateSlotWeightsForNewShaping(this.currentShapingMode, currentShaping);

          this.currentShapingMode = currentShaping;
        }

        this.updateDisplay();

        if (!this.resizeListenerAdded) {
          window.addEventListener("resize", () => this.handleWindowResize());
          this.resizeListenerAdded = true;
        }
      }

      debug() {
        super.debug();
      }

      async waitForSlotManagers() {
        const maxWait = 2000; // 最大2秒待機（短縮）
        const checkInterval = 20; // 20ms間隔でチェック（高速化）
        let elapsed = 0;

        return new Promise((resolve, reject) => {
          const checkManagers = () => {
            if (window.promptSlotManager && window.slotGroupManager) {
              resolve();
              return;
            }

            elapsed += checkInterval;
            if (elapsed >= maxWait) {
              reject(new Error(`Slot managers not initialized within ${maxWait}ms`));
              return;
            }

            setTimeout(checkManagers, checkInterval);
          };

          checkManagers();
        });
      }
    }

    if (typeof window !== "undefined") {
      window.SlotTab = SlotTab;
    }
  }

  defineSlotTab();
})();
