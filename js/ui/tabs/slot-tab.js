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

        this.cardBuilder = new SlotTabCardBuilder(this);
        this.slotTabGroupManager = new SlotTabGroupManager(this);

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

        this.slotTabGroupManager.initModal();

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

        this.slotTabGroupManager.addSlotImportExportButtons();

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
          const slotCard = this.cardBuilder.createSlotCard(info);
          container.appendChild(slotCard);
        });

        this.setupSortable();

        this.adjustContainerHeight();

        // 重み入力フィールドの設定を更新（shaping変更対応）
        setTimeout(() => {
          this.updateWeightInputFields();
        }, 10);
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
            currentSlotBeforeReorder.isUsed = currentPrompt.length > 0;
            currentSlotBeforeReorder.lastModified = currentSlotBeforeReorder.isUsed ? Date.now() : null;
          }
        }

        [this.slotManager.slots[slotIndex], this.slotManager.slots[targetIndex]] = [
          this.slotManager.slots[targetIndex],
          this.slotManager.slots[slotIndex],
        ];

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

        if (typeof UIHelpers !== "undefined") {
          UIHelpers.notifyInfo(`重み記法を${newShaping}形式に変更しました`, 2000);
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

      getCurrentDefaultWeight() {
        const shaping = this.getCurrentShaping();

        switch (shaping) {
          case "NAI":
            return 0.0;
          case "SD":
          case "NAIv45":
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
          case "NAIv45":
            return `プロンプト重み (NAI V4.5 数値強調形式)
・1.0: 重みなし（デフォルト）
・1.1以上: 強調 値::プロンプト::
・0.9以下: 弱調 値::プロンプト::
・マイナス値: 反転強調（-1::monochrome:: で色彩を促す等）
・範囲: ${weightConfig.min}～${weightConfig.max}
・ホイール/矢印キーで調整可能`;
          case "None":
          default:
            return `プロンプト重み (無効)
現在の設定では重み機能は使用されません`;
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
          UIHelpers.notifyWarning("使用中のスロットがありません", 2000);
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

        targetModal.classList.remove("hidden");
        targetModal.classList.add("show-flex");

        const oldModal = targetModal.cloneNode(true);
        targetModal.parentNode.replaceChild(oldModal, targetModal);

        const newModal = document.querySelector("#combine-preview-modal");

        newModal.addEventListener("click", (e) => {
          if (e.target === newModal) {
            newModal.classList.remove("show-flex");
            newModal.classList.add("hidden");
          }
        });

        document.getElementById(DOM_IDS.PANELS.CLOSE_PREVIEW).addEventListener("click", () => {
          newModal.classList.remove("show-flex");
          newModal.classList.add("hidden");
        });

        document.getElementById(DOM_IDS.BUTTONS.COPY_COMBINED).addEventListener("click", () => {
          navigator.clipboard.writeText(combined).then(() => {
            UIHelpers.notifySuccess("結合プロンプトをコピーしました", 2000);
          });
        });

        const handleEsc = (e) => {
          if (e.key === "Escape") {
            newModal.classList.remove("show-flex");
            newModal.classList.add("hidden");
            document.removeEventListener("keydown", handleEsc);
          }
        };
        document.addEventListener("keydown", handleEsc);
      }

      async handleClearAll() {
        if (UIHelpers.confirmDelete("すべてのスロットをクリアしますか？")) {
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

          if (UIHelpers.confirmDelete("このスロットの内容をクリアしますか？")) {
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

          if (UIHelpers.confirmDelete("このスロットを削除しますか？")) {
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
            UIHelpers.notifyError("無効な重み値です", 3000);
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
          UIHelpers.notifyError("重みの保存に失敗しました", 3000);
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

              const newCard = this.cardBuilder.createSlotCard(updatedInfo);
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
          UIHelpers.notifyError("プロンプトの保存に失敗しました", 3000);
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

        indicator.classList.remove("hidden");
        indicator.classList.add("show-inline-block");

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
          indicator.classList.remove("show-inline-block");
          indicator.classList.add("hidden");
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

      convertElementsForNewShaping(elements, oldShaping, newShaping) {
        if (!Array.isArray(elements) || typeof WeightConverter === "undefined") return;

        // [v1.1.x旧データ対応マイグレーション] 無重みデフォルト値
        // NAI は加算系 (0=無重み)、SD/NAIv45 は乗算系 (1.0=無重み)、None は重み無し
        const getDefaultWeight = (shaping) => {
          if (shaping === "NAI") return 0;
          if (shaping === "SD" || shaping === "NAIv45") return 1.0;
          return 0;
        };

        // shaping のフォールバック探索順序
        // [v1.1.x旧データ対応マイグレーション] 旧データは shaping フィールドが部分的にしか存在しない場合がある
        const FALLBACK_SHAPINGS = ["SD", "NAIv45", "NAI", "None"];

        const isValidWeight = (w) => w !== undefined && w !== null && Number.isFinite(w);

        elements.forEach((el) => {
          if (!el) return;

          // Step 1: Value に記法が埋め込まれていれば剥がして bareText + 重みに分解
          let parsedWeight = null;
          let parsedFormat = null;
          if (el.Value) {
            const info = WeightConverter.parseFirstWeight(el.Value);
            if (info) {
              el.Value = info.bareText;
              parsedWeight = info.weight;
              parsedFormat = info.format;
            }
          }

          let resolvedWeight;
          let resolvedSource = null;

          // Step 1: Value から抽出できた場合は最優先
          if (parsedWeight !== null && isValidWeight(parsedWeight)) {
            resolvedWeight =
              parsedFormat === newShaping
                ? parsedWeight
                : WeightConverter.convertWeight(parsedWeight, parsedFormat, newShaping);
            resolvedSource = `Value記法(${parsedFormat})`;
          }

          // Step 2: el[oldShaping]?.weight を参照
          if (!isValidWeight(resolvedWeight) && oldShaping && el[oldShaping]) {
            const oldWeight = el[oldShaping].weight;
            if (isValidWeight(oldWeight)) {
              resolvedWeight =
                oldShaping === newShaping ? oldWeight : WeightConverter.convertWeight(oldWeight, oldShaping, newShaping);
              resolvedSource = `oldShaping(${oldShaping})`;
            }
          }

          // Step 3: [v1.1.x旧データ対応マイグレーション] 他の shaping フィールドから探索
          // 旧データは部分的なフィールドしか持たない可能性があるため、見つかったものを変換して使う
          if (!isValidWeight(resolvedWeight)) {
            for (const candidate of FALLBACK_SHAPINGS) {
              if (candidate === oldShaping) continue; // Step 2 で確認済み
              if (!el[candidate]) continue;
              const candidateWeight = el[candidate].weight;
              if (isValidWeight(candidateWeight)) {
                resolvedWeight =
                  candidate === newShaping
                    ? candidateWeight
                    : WeightConverter.convertWeight(candidateWeight, candidate, newShaping);
                resolvedSource = `フォールバック(${candidate})`;
                break;
              }
            }
          }

          // Step 4: [v1.1.x旧データ対応マイグレーション] どこにも重み情報がなければデフォルト値
          // [CLAUDE.md違反対応] フォールバックではあるが旧データ救済のため必要。黙らず警告を出す
          if (!isValidWeight(resolvedWeight)) {
            resolvedWeight = getDefaultWeight(newShaping);
            console.warn(
              `[ShapingConvert] 要素 "${el.Value}" の重み情報が見つからず、デフォルト値 ${resolvedWeight} (${newShaping}) を適用しました`,
              el
            );
            resolvedSource = "デフォルト値";
          }

          // 新 shaping に書き戻し（既存オブジェクトがあれば weight だけ更新）
          if (!el[newShaping]) el[newShaping] = { weight: getDefaultWeight(newShaping) };
          el[newShaping].weight = resolvedWeight;

          if (AppState?.config?.debugMode) {
            console.log(`[ShapingConvert] 要素 "${el.Value}" を ${oldShaping}→${newShaping} 変換:`, {
              resolvedWeight,
              source: resolvedSource,
            });
          }
        });
      }

      regenerateSlotPromptFromElements(slot, shaping) {
        if (!slot.elements || !Array.isArray(slot.elements)) return slot.prompt || "";

        return slot.elements
          .filter((el) => el && el.Value)
          .slice()
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .map((el) => {
            const weight = el[shaping]?.weight;
            if (weight !== undefined && weight !== null) {
              return WeightConverter.applyWeightToPrompt(shaping, el.Value, weight);
            }
            return el.Value;
          })
          .filter((v) => v)
          .join(",");
      }

      convertSingleSlotForNewShaping(slot, oldShaping, newShaping) {
        let weightChanged = false;
        let promptChanged = false;

        if (slot.elements && Array.isArray(slot.elements) && oldShaping !== newShaping) {
          this.convertElementsForNewShaping(slot.elements, oldShaping, newShaping);
        }

        const oldPrompt = slot.prompt;
        if (oldPrompt && oldShaping !== newShaping) {
          const hasElements = slot.elements && slot.elements.length > 0;
          const convertedPrompt = hasElements
            ? this.regenerateSlotPromptFromElements(slot, newShaping)
            : WeightConverter.convertPromptNotation(oldPrompt, oldShaping, newShaping);

          if (convertedPrompt !== oldPrompt) {
            slot.prompt = convertedPrompt;
            promptChanged = true;
          }
        }

        // absoluteWeight の補正（NAI=0 と SD/NAIv45=1.0 が「重みなし」状態）
        const isMultiplierFormat = (f) => f === "SD" || f === "NAIv45";
        if (slot.absoluteWeight === 0 && oldShaping === "NAI" && isMultiplierFormat(newShaping)) {
          slot.absoluteWeight = 1.0;
        } else if (slot.absoluteWeight === 1.0 && isMultiplierFormat(oldShaping) && newShaping === "NAI") {
          slot.absoluteWeight = 0.0;
        }

        const oldWeight = slot.weight;
        if (newShaping === "NAI") {
          slot.weight = WeightConverter.convertSDToNAI(slot.absoluteWeight);
        } else if (isMultiplierFormat(newShaping)) {
          slot.weight = slot.absoluteWeight;
        } else {
          slot.weight = 1.0;
        }

        const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());
        slot.weight = Math.max(weightConfig.min, Math.min(weightConfig.max, slot.weight));

        if (oldWeight !== slot.weight) {
          weightChanged = true;
        }

        return { weightChanged, promptChanged };
      }

      syncCurrentSlotPromptToTextarea(oldShaping, newShaping) {
        const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (!generatePrompt) return;

        const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];

        if (currentSlot) {
          // currentSlot.prompt は convertSingleSlotForNewShaping で再生成・変換済み
          const desired = currentSlot.prompt || "";
          if (generatePrompt.value !== desired) {
            generatePrompt.value = desired;
          }
          if (window.app && typeof window.app.updatePromptDisplay === "function") {
            window.app.updatePromptDisplay();
          }
          return;
        }

        // フォールバック: スロットが取得できない場合は textarea を直接変換
        const editorPrompt = generatePrompt.value || "";
        if (editorPrompt) {
          const converted = WeightConverter.convertPromptNotation(editorPrompt, oldShaping, newShaping);
          if (converted !== editorPrompt) {
            generatePrompt.value = converted;
          }
        }
      }

      refreshEditTabIfActive() {
        if (window.app?.tabs?.edit?.isActive && typeof window.app.tabs.edit.refreshEditList === "function") {
          window.app.tabs.edit.refreshEditList();
        }
      }

      updateSlotWeightsForNewShaping(oldShaping, newShaping) {
        let updatedCount = 0;
        let promptUpdatedCount = 0;

        this.slotManager.slots.forEach((slot) => {
          const result = this.convertSingleSlotForNewShaping(slot, oldShaping, newShaping);
          if (result.weightChanged) updatedCount++;
          if (result.promptChanged) promptUpdatedCount++;
        });

        if (oldShaping !== newShaping) {
          this.syncCurrentSlotPromptToTextarea(oldShaping, newShaping);
        }

        this.updateWeightDisplayValues();
        this.updateDisplay();
        this.refreshEditTabIfActive();

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
            this.slotTabGroupManager.showGroupManagementModal();
          });
        }

        const closeBtn = document.getElementById("close-slot-group-management");
        const closeBtnFooter = document.getElementById("close-slot-group-management-footer");
        if (closeBtn) {
          this.addEventListener(closeBtn, "click", () => {
            this.slotTabGroupManager.hideGroupManagementModal();
          });
        }
        if (closeBtnFooter) {
          this.addEventListener(closeBtnFooter, "click", () => {
            this.slotTabGroupManager.hideGroupManagementModal();
          });
        }

        if (this.elements.groupModal) {
          this.addEventListener(this.elements.groupModal, "click", (e) => {
            if (e.target === this.elements.groupModal) {
              this.slotTabGroupManager.hideGroupManagementModal();
            }
          });
        }

        if (this.elements.groupCreateBtn) {
          this.addEventListener(this.elements.groupCreateBtn, "click", async () => {
            await this.slotTabGroupManager.handleCreateGroup();
          });
        }

        if (this.elements.groupCopyBtn) {
          this.addEventListener(this.elements.groupCopyBtn, "click", async () => {
            await this.slotTabGroupManager.handleCopyGroup();
          });
        }

        if (this.elements.groupDeleteBtn) {
          this.addEventListener(this.elements.groupDeleteBtn, "click", async () => {
            await this.slotTabGroupManager.handleDeleteGroup();
          });
        }

        if (this.elements.exportGroupBtn) {
          this.addEventListener(this.elements.exportGroupBtn, "click", async () => {
            await this.slotTabGroupManager.handleExportGroup();
          });
        }

        if (this.elements.importGroupBtn) {
          this.addEventListener(this.elements.importGroupBtn, "click", async () => {
            await this.slotTabGroupManager.handleImportGroup();
          });
        }

        const importAllBtn = document.getElementById("slot-group-import-all-btn");
        if (importAllBtn) {
          this.addEventListener(importAllBtn, "click", async () => {
            await this.slotTabGroupManager.handleImportAll();
          });
        }

        const exportAllBtn = document.getElementById("slot-group-export-all-btn");
        if (exportAllBtn) {
          this.addEventListener(exportAllBtn, "click", async () => {
            await this.slotTabGroupManager.handleExportAll();
          });
        }

        window.addEventListener("slotGroupChanged", (event) => {
          this.updateGroupDisplay();

          UIHelpers.notifySuccess(`グループ「${event.detail.groupName}」に切り替えました`);
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

          this.slotTabGroupManager.updateModalCurrentGroupInfo(currentGroup);

          if (this.elements.groupDeleteBtn) {
            this.elements.groupDeleteBtn.disabled = currentGroup.isDefault;
          }
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
