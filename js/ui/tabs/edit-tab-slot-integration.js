(function () {
  "use strict";

  class EditTabSlotIntegration {
    constructor(editTab) {
      this.editTab = editTab;
    }

    async setupSlotIntegrationHandlers() {
      const slotModeSelect = document.getElementById(DOM_IDS.EDIT.SLOT_MODE);
      if (slotModeSelect) {
        this.editTab.addEventListener(slotModeSelect, "change", async (e) => {
          await this.handleSlotModeChange(e);
        });
      }

      const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
      if (dataSourceSelect) {
        this.editTab.addEventListener(dataSourceSelect, "change", async (e) => {
          await this.handleDataSourceChange(e);
        });
      }

      this.setupCategoryEventListeners();

      const uiTypeRadios = document.querySelectorAll('[name="UIType"]');
      uiTypeRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
          this.updateSlotWeightInputConfig();
          this.resetCurrentSlotWeightForNewShaping();
        });
      });

      this.setupSlotWeightInputHandlers();
    }

    async initializeCurrentDataSource() {
      try {
        await this.editTab.waitForSlotManager();

        const currentSlot = SlotUtils.getCurrentSlot();
        let currentDataSource = "dictionary";

        if (currentSlot && currentSlot.dataSource) {
          currentDataSource = currentSlot.dataSource;
        }

        const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
        if (dataSourceSelect) {
          dataSourceSelect.value = currentDataSource;
        }

        await this.initializeDataSourceDetails(currentDataSource);

        this.toggleDataSourceDetailsUI(currentDataSource);

        if (currentSlot) {
          await this.restoreSlotSelections(currentSlot, currentDataSource);
        }
      } catch (error) {
        await this.initializeDataSourceDetails("dictionary");
        this.toggleDataSourceDetailsUI("dictionary");

        const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
        if (dataSourceSelect) {
          dataSourceSelect.value = "dictionary";
        }
      }
    }

    async restoreSlotSelections(slot, dataSource) {
      if (dataSource === "dictionary" && slot.category) {
        const bigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);

        if (bigSelect && slot.category.big && slot.category.big !== "") {
          try {
            bigSelect.value = slot.category.big;

            const middleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);
            if (middleSelect) {
              this.updateMiddleCategories(middleSelect, slot.category.big);

              if (slot.category.middle && slot.category.middle !== "") {
                middleSelect.value = slot.category.middle;
              }
            }
          } catch (error) {}
        }
      } else if (dataSource === "favorites" && slot.favoriteDictionaryId) {
        const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);
        if (favoritesSelect) {
          const availableOptions = Array.from(favoritesSelect.options).map((opt) => opt.value);

          if (availableOptions.includes(slot.favoriteDictionaryId)) {
            favoritesSelect.value = slot.favoriteDictionaryId;
          }
        }
      }
    }

    shouldInitializeInitialValues() {
      const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
      if (!dataSourceSelect || !dataSourceSelect.value) {
        return true;
      }

      const currentDataSource = dataSourceSelect.value;

      if (currentDataSource === "dictionary") {
        const bigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
        const middleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);

        const bigValue = bigSelect?.value || "";
        const middleValue = middleSelect?.value || "";

        if (bigValue === "" || middleValue === "") {
          return true;
        }
      } else if (currentDataSource === "favorites") {
        const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);
        const favValue = favoritesSelect?.value || "";

        if (favValue === "") {
          return true;
        }
      }

      return false;
    }

    async handleSlotModeChange(event) {
      const newMode = event.target.value;

      try {
        const currentSlot = SlotUtils.getCurrentSlot();
        if (!currentSlot) {
          return;
        }

        currentSlot.mode = newMode;
        currentSlot.lastModified = Date.now();

        if (window.promptSlotManager) {
          await window.promptSlotManager.saveToStorage();
        }

        this.checkExtractionMode();

        if (this.editTab.extractionModeActive) {
          this.showExtractionModeWithEmptyState();
        } else {
          this.editTab.editHandler.initializeEditMode();
        }

        this.updateIntegrationPanelVisibility();
      } catch (error) {}
    }

    async handleDataSourceChange(event) {
      const newDataSource = event.target.value;

      try {
        const currentSlot = SlotUtils.getCurrentSlot();
        if (!currentSlot) {
          return;
        }

        currentSlot.dataSource = newDataSource;
        currentSlot.lastModified = Date.now();

        this.toggleDataSourceDetailsUI(newDataSource);

        await this.initializeDataSourceDetails(newDataSource);

        if (window.promptSlotManager) {
          await window.promptSlotManager.saveToStorage();
        }
      } catch (error) {}
    }

    updateSlotIntegrationPanel() {
      try {
        const currentSlot = SlotUtils.getCurrentSlot();
        if (!currentSlot) {
          return;
        }

        const slotModeSelect = document.getElementById(DOM_IDS.EDIT.SLOT_MODE);
        if (slotModeSelect) {
          slotModeSelect.value = currentSlot.mode || "normal";
        }

        const slotWeightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
        if (slotWeightInput) {
          const defaultWeight = window.promptSlotManager
            ? window.promptSlotManager.getDefaultWeight()
            : this.editTab.getDefaultWeight();
          slotWeightInput.value = currentSlot.weight !== undefined ? currentSlot.weight : defaultWeight;
        }

        const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
        const currentDataSource = currentSlot.dataSource || "dictionary";
        if (dataSourceSelect) {
          dataSourceSelect.value = currentDataSource;
        }

        this.toggleDataSourceDetailsUI(currentDataSource);

        this.initializeDataSourceDetails(currentDataSource).then(() => {
          this.restoreSlotSelections(currentSlot, currentDataSource);
        });
      } catch (error) {}
    }

    toggleDataSourceDetailsUI(dataSource) {
      const dictionaryControls = document.querySelectorAll(".dictionary-selection-control");
      const favoritesControls = document.querySelectorAll(".favorites-selection-control");

      if (dataSource === "dictionary") {
        dictionaryControls.forEach((control) => {
          control.classList.remove("hidden");
          control.classList.add("show-flex");
        });
        favoritesControls.forEach((control) => {
          control.classList.remove("show-flex");
          control.classList.add("hidden");
        });
      } else if (dataSource === "favorites") {
        dictionaryControls.forEach((control) => {
          control.classList.remove("show-flex");
          control.classList.add("hidden");
        });
        favoritesControls.forEach((control) => {
          control.classList.remove("hidden");
          control.classList.add("show-flex");
        });
      }
    }

    async initializeDataSourceDetails(dataSource) {
      try {
        if (dataSource === "dictionary") {
          await this.initializeDictionarySelectors();
        } else if (dataSource === "favorites") {
          await this.initializeFavoritesSelector();
        }
      } catch (error) {}
    }

    async initializeDictionarySelectors() {
      this.setupCategorySelectors();
    }

    async initializeFavoritesSelector() {
      const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);

      if (favoritesSelect) {
        await this.populateFavoritesSelect(favoritesSelect);
      }
    }

    async populateFavoritesSelect(selectElement) {
      try {
        if (!selectElement) return;

        const allDictionaries = AppState.data.promptDictionaries || {};
        const dictionaryIds = Object.keys(allDictionaries);

        selectElement.innerHTML = '<option value="">選択してください</option>';

        dictionaryIds.forEach((dictId) => {
          const dict = allDictionaries[dictId];
          if (dict && dict.name) {
            const option = document.createElement("option");
            option.value = dictId;
            option.textContent = dict.name;
            selectElement.appendChild(option);
          }
        });
      } catch (error) {}
    }

    setupCategoryEventListeners() {
      const categoryBigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
      const categoryMiddleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);
      const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);

      if (!categoryBigSelect || !categoryMiddleSelect) {
        return;
      }

      categoryBigSelect.addEventListener("change", async (e) => {
        const bigCategory = e.target.value;
        const currentSlot = SlotUtils.getCurrentSlot();

        if (currentSlot) {
          if (!currentSlot.category) {
            currentSlot.category = {};
          }
          currentSlot.category.big = bigCategory;
          currentSlot.category.middle = "";

          if (window.promptSlotManager) {
            await window.promptSlotManager.saveToStorage();
          }
        }

        if (bigCategory) {
          this.updateMiddleCategories(categoryMiddleSelect, bigCategory);
          categoryMiddleSelect.disabled = false;
        } else {
          categoryMiddleSelect.innerHTML = '<option value="">すべて</option>';
          categoryMiddleSelect.disabled = true;
        }
      });

      categoryMiddleSelect.addEventListener("change", async (e) => {
        const middleCategory = e.target.value;
        const currentSlot = SlotUtils.getCurrentSlot();

        if (currentSlot) {
          if (!currentSlot.category) {
            currentSlot.category = {};
          }
          currentSlot.category.middle = middleCategory;

          if (window.promptSlotManager) {
            await window.promptSlotManager.saveToStorage();
          }
        }
      });

      if (favoritesSelect) {
        favoritesSelect.addEventListener("change", async (e) => {
          const currentSlot = SlotUtils.getCurrentSlot();

          if (currentSlot) {
            currentSlot.favoriteDictionaryId = e.target.value;

            if (currentSlot.mode === "sequential") {
              currentSlot.sequentialIndex = 0;
            }

            if (window.promptSlotManager) {
              await window.promptSlotManager.saveToStorage();
            }
          }
        });
      }
    }

    getCategoryOptions(type) {
      if (type === "big") {
        return this.editTab.categoryUIManager.getCategoriesByLevel(0, null);
      }
      return [];
    }

    updateMiddleCategories(select, bigCategory) {
      this.editTab.categoryUIManager.populateSelectElement(select, 1, bigCategory, "すべて");
    }

    setupCategorySelectors() {
      const bigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
      const middleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);

      if (!bigSelect) return;

      bigSelect.innerHTML = '<option value="">すべて</option>';
      const bigCategories = this.getCategoryOptions("big");

      bigCategories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        bigSelect.appendChild(option);
      });

      const currentSlot = SlotUtils.getCurrentSlot();
      if (currentSlot && currentSlot.category) {
        requestAnimationFrame(() => {
          if (currentSlot.category.big) {
            bigSelect.value = currentSlot.category.big;
            this.updateMiddleCategories(middleSelect, currentSlot.category.big);
            middleSelect.disabled = false;

            if (currentSlot.category.middle) {
              requestAnimationFrame(() => {
                middleSelect.value = currentSlot.category.middle;
              });
            }
          }
        });
      }
    }

    updateIntegrationPanelVisibility() {
      const modeSelectionPanel = document.querySelector(".edit-mode-selection");
      if (!modeSelectionPanel) {
        return;
      }

      const currentSlot = SlotUtils.getCurrentSlot();
      const isExtractionMode = this.editTab.extractionModeActive;
      const dataSource = currentSlot?.dataSource || "dictionary";

      const editModeDropdown = document.querySelector(".edit-mode-dropdown");
      if (editModeDropdown) {
        if (isExtractionMode) {
          editModeDropdown.classList.remove("show-flex");
          editModeDropdown.classList.add("hidden");
        } else {
          editModeDropdown.classList.remove("hidden");
          editModeDropdown.classList.add("show-flex");
        }
      }

      const dataSourceControl = document.querySelector(".slot-data-source-control");
      if (dataSourceControl) {
        if (isExtractionMode) {
          dataSourceControl.classList.remove("hidden");
          dataSourceControl.classList.add("show-flex");
        } else {
          dataSourceControl.classList.remove("show-flex");
          dataSourceControl.classList.add("hidden");
        }
      }

      const dictionaryControls = document.querySelectorAll(".dictionary-selection-control");
      dictionaryControls.forEach((control) => {
        if (isExtractionMode && dataSource === "dictionary") {
          control.classList.remove("hidden");
          control.classList.add("show-flex");
        } else {
          control.classList.remove("show-flex");
          control.classList.add("hidden");
        }
      });

      const favoritesControls = document.querySelectorAll(".favorites-selection-control");
      favoritesControls.forEach((control) => {
        if (isExtractionMode && dataSource === "favorites") {
          control.classList.remove("hidden");
          control.classList.add("show-flex");
        } else {
          control.classList.remove("show-flex");
          control.classList.add("hidden");
        }
      });

      if (isExtractionMode) {
        modeSelectionPanel.classList.add("extraction-mode");
      } else {
        modeSelectionPanel.classList.remove("extraction-mode");
      }
    }

    setupSlotWeightInputHandlers() {
      const weightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
      if (!weightInput) return;

      if (!this._handleSlotWeightWheel) {
        const self = this;
        this._handleSlotWeightWheel = function (e) {
          e.preventDefault();

          const currentShaping = self.editTab.getCurrentShaping();
          const weightConfig = WeightConverter.getWeightConfig(currentShaping);

          const currentValue = parseFloat(weightInput.value) || 0;
          let delta = weightConfig.delta;

          if (e.shiftKey) {
            delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
          } else if (e.ctrlKey) {
            delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
          }

          const direction = e.deltaY > 0 ? -1 : 1;
          const newValue = currentValue + direction * delta;

          const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

          weightInput.value = Math.round(clampedValue * 100) / 100;

          weightInput.dispatchEvent(new Event("input", { bubbles: true }));
        };
      }

      if (!this._handleSlotWeightChange) {
        const self = this;
        this._handleSlotWeightChange = async function (e) {
          const newWeight = parseFloat(e.target.value) || 0;
          const currentSlot = self.editTab.getCurrentSlot();

          if (currentSlot && window.app.tabs.slot) {
            await window.app.tabs.slot.saveWeightEdit(currentSlot.id, newWeight);
          } else {
            if (currentSlot) {
              currentSlot.weight = newWeight;
              currentSlot.lastModified = Date.now();

              if (window.promptSlotManager) {
                await window.promptSlotManager.saveToStorage();
              }
            }
          }
        };
      }

      weightInput.removeEventListener("wheel", this._handleSlotWeightWheel);
      weightInput.removeEventListener("input", this._handleSlotWeightChange);

      weightInput.addEventListener("wheel", this._handleSlotWeightWheel);
      weightInput.addEventListener("input", this._handleSlotWeightChange);
    }

    updateSlotWeightInputConfig() {
      const weightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
      if (!weightInput) {
        return;
      }

      const currentShaping = this.editTab.getCurrentShaping();
      const weightConfig = WeightConverter.getWeightConfig(currentShaping);

      weightInput.min = weightConfig.min;
      weightInput.max = weightConfig.max;
      weightInput.step = weightConfig.delta;
    }

    resetCurrentSlotWeightForNewShaping() {
      const currentSlot = SlotUtils.getCurrentSlot();
      if (currentSlot) {
        const defaultWeight = window.promptSlotManager
          ? window.promptSlotManager.getDefaultWeight()
          : this.editTab.getDefaultWeight();

        currentSlot.weight = defaultWeight;
        currentSlot.lastModified = Date.now();

        const slotWeightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
        if (slotWeightInput) {
          slotWeightInput.value = defaultWeight;
        }

        if (window.promptSlotManager) {
          window.promptSlotManager.saveToStorage();
        }
      }
    }

    setupSlotMuteHandler() {
      const muteBtn = this.editTab.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_BTN}`);
      if (muteBtn) {
        this.editTab.addEventListener(muteBtn, "click", () => {
          this.toggleCurrentSlotMute();
        });
      }
    }

    async toggleCurrentSlotMute() {
      try {
        if (window.promptSlotManager) {
          const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
          if (currentSlot) {
            await window.promptSlotManager.toggleSlotMute(currentSlot.id);
            this.updateSlotMuteButton();
          }
        }
      } catch (error) {}
    }

    updateSlotMuteButton() {
      const muteBtn = this.editTab.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_BTN}`);
      const muteIcon = this.editTab.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_ICON}`);

      if (muteBtn && muteIcon && window.promptSlotManager) {
        const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
        if (currentSlot) {
          const isMuted = currentSlot.muted;
          muteIcon.textContent = isMuted ? "🔇" : "🔊";
          muteBtn.classList.toggle("muted", isMuted);
          muteBtn.title = isMuted ? "現在のスロットをミュート解除" : "現在のスロットをミュート";
        }
      }
    }

    checkExtractionMode() {
      try {
        if (typeof promptSlotManager !== "undefined" && promptSlotManager.slots) {
          const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
          const isCurrentSlotExtraction =
            currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential");

          this.editTab.extractionModeActive = isCurrentSlotExtraction;

          this.updateAddButtonsState();

          if (this.editTab.extractionModeActive) {
            this.setGeneratePromptExtractionMode();
          } else {
            this.setGeneratePromptNormalMode();
          }
        } else {
          this.editTab.extractionModeActive = false;
          this.updateAddButtonsState();
        }
      } catch (error) {
        this.editTab.extractionModeActive = false;
        this.updateAddButtonsState();
      }
    }

    updateAddButtonsState() {
      const addTopBtn = this.editTab.getElement("#addElementTop");
      const addBottomBtn = this.editTab.getElement("#addElementBottom");

      if (addTopBtn) {
        addTopBtn.disabled = this.editTab.extractionModeActive;
        if (this.editTab.extractionModeActive) {
          addTopBtn.title = "抽出モード中は要素を追加できません";
          addTopBtn.classList.add("disabled-extraction");
        } else {
          addTopBtn.title = "リストの上部に空の要素を追加";
          addTopBtn.classList.remove("disabled-extraction");
        }
      }

      if (addBottomBtn) {
        addBottomBtn.disabled = this.editTab.extractionModeActive;
        if (this.editTab.extractionModeActive) {
          addBottomBtn.title = "抽出モード中は要素を追加できません";
          addBottomBtn.classList.add("disabled-extraction");
        } else {
          addBottomBtn.title = "リストの下部に空の要素を追加";
          addBottomBtn.classList.remove("disabled-extraction");
        }
      }
    }

    showExtractionModeWithEmptyState() {
      try {
        const extractionSlots = promptSlotManager.slots
          .map((slot, index) => {
            if (slot.mode === "random" || slot.mode === "sequential") {
              return {
                slotNumber: index + 1,
                mode: slot.mode,
                category: slot.category,
                currentExtraction: slot.currentExtraction,
              };
            }
            return null;
          })
          .filter((slot) => slot !== null);

        this.editTab.app.listManager.createEmptyState(DOM_SELECTORS.BY_ID.EDIT_LIST, "extraction", { extractionSlots });

        this.setGeneratePromptExtractionMode();
      } catch (error) {}
    }

    showExtractionModeMessage() {
      try {
        const editList = this.editTab.getElement(`#${DOM_IDS.EDIT.LIST}`);
        if (!editList) return;

        const extractionSlots = promptSlotManager.slots.filter(
          (slot) => slot.mode === "random" || slot.mode === "sequential"
        );

        const messageHTML = `
          <div class="extraction-mode-info">
            <h3>🎲 抽出モード有効</h3>
            <p>現在 ${extractionSlots.length} 個のスロットが抽出モードです。</p>
            <p>Generateボタンを押すと抽出されたプロンプトが表示されます。</p>
            <p>編集タブでの手動編集は無効です。</p>
            <div class="extraction-slots-info">
              ${extractionSlots
                .map((slot, index) => {
                  const slotNumber = promptSlotManager.slots.indexOf(slot) + 1;
                  return `
                  <div class="extraction-slot-item">
                    <span class="slot-number">${slotNumber}</span>
                    <span class="slot-mode">${slot.mode === "random" ? "ランダム" : "連続"}</span>
                    <span class="slot-category">${slot.category?.big || "全体"}</span>
                    ${
                      slot.currentExtraction
                        ? `
                      <div class="current-extraction">現在: ${slot.currentExtraction}</div>
                    `
                        : ""
                    }
                  </div>
                `;
                })
                .join("")}
            </div>
            <div class="extraction-note">
              <small>スロットタブで通常モードに切り替えることで編集が可能になります。</small>
            </div>
          </div>
        `;

        editList.innerHTML = messageHTML;

        this.setGeneratePromptExtractionMode();
      } catch (error) {}
    }

    restoreNormalMode() {
      try {
        this.editTab.extractionModeActive = false;

        this.updateAddButtonsState();

        this.setGeneratePromptNormalMode();

        if (this.editTab.isCurrentTab()) {
          this.editTab.editHandler.initializeEditMode();
        }
      } catch (error) {}
    }

    setGeneratePromptExtractionMode() {
      try {
        const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePrompt) {
          const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
          if (currentSlot) {
            const weightedPrompt = currentSlot.prompt
              ? promptSlotManager.applyWeightToPrompt(currentSlot.prompt, currentSlot.weight)
              : "[抽出待機中 - Generateボタンを押して抽出]";
            generatePrompt.value = weightedPrompt;
            generatePrompt.readOnly = true;
            generatePrompt.title = "抽出モードで生成されたプロンプト（読み取り専用）";
          }
        }
      } catch (error) {}
    }

    setGeneratePromptNormalMode() {
      try {
        const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePrompt) {
          generatePrompt.readOnly = false;
          generatePrompt.title = "生成されたプロンプトが表示されます（手動編集も可能）";
        }
      } catch (error) {}
    }

    setupSlotModeChangeListener() {
      try {
        const slotContainer = document.getElementById("slotContainer");
        if (slotContainer) {
          slotContainer.addEventListener("change", (e) => {
            if (e.target.classList.contains("slot-mode-radio")) {
              setTimeout(() => {
                this.checkExtractionMode();
                this.editTab.updateSplitButtonVisibility();

                if (this.editTab.isCurrentTab()) {
                  const editList = this.editTab.getElement(`#${DOM_IDS.EDIT.LIST}`);
                  if (editList) {
                    if (this.editTab.extractionModeActive) {
                      this.showExtractionModeMessage();
                    } else {
                      this.restoreNormalMode();
                    }
                  }
                }
              }, 100);
            }
          });
        }
      } catch (error) {}
    }

    setupExtractionCompleteListener() {
      try {
        window.addEventListener("slotExtractionComplete", (event) => {
          if (this.editTab.isCurrentTab() && this.editTab.extractionModeActive) {
            setTimeout(() => {
              this.showExtractionModeWithEmptyState();
            }, 100);
          }
        });

        window.addEventListener("allExtractionsComplete", () => {
          if (this.editTab.isCurrentTab() && this.editTab.extractionModeActive) {
            setTimeout(() => {
              this.showExtractionModeWithEmptyState();
            }, 100);
          }
        });
      } catch (error) {}
    }

    setupSlotChangeListener() {
      try {
        window.addEventListener("slotChanged", (event) => {
          if (this.editTab.isCurrentTab()) {
            this.checkExtractionMode();
            this.editTab.updateSplitButtonVisibility();

            if (this.editTab.extractionModeActive) {
              this.showExtractionModeWithEmptyState();
            }

            this.updateGeneratePromptOnSlotChange();

            this.updateSlotIntegrationPanel();

            this.updateIntegrationPanelVisibility();
          }
        });
      } catch (error) {}
    }

    async updateGeneratePromptOnSlotChange() {
      try {
        const currentSlot = SlotUtils.getCurrentSlot();

        if (!currentSlot) {
          return;
        }

        if (!this.editTab.isCurrentTab()) {
          return;
        }

        if (currentSlot.prompt) {
          const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePrompt) {
            generatePrompt.value = currentSlot.prompt;
          }
        }
      } catch (error) {}
    }
  }

  if (typeof window !== "undefined") {
    window.EditTabSlotIntegration = EditTabSlotIntegration;
  }
})();
