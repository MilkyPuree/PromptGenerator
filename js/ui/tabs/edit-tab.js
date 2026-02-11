/**
 * 編集タブ
 *
 * 設計:
 * - 現在のスロットのelementsを直接参照・編集
 * - slot.elements = [{ id, sort, Value, SD, NAI, None, data }, ...]
 * - 表示: slot.elementsをソートしてFlexibleListに渡す
 * - 編集: slot.elementsを直接変更 → regenerateAndSaveSlot()で保存
 * - ウェイト変換はWeightConverterを使用
 */
(function () {
  "use strict";

  class EditTabState {
    constructor() {
      this.refreshMode = "normal"; // 'normal', 'suppressed', 'batch'
      this.updateMode = "auto"; // 'auto', 'manual'
      this.operationStack = []; // 実行中の操作スタック
    }

    canAutoRefresh() {
      return this.refreshMode === "normal" && !this.hasOperation("prompt_update");
    }

    canUpdateCategory() {
      return this.updateMode === "auto" && !this.hasOperation("category_change");
    }

    startOperation(operationType) {
      this.operationStack.push(operationType);
    }

    endOperation(operationType) {
      const index = this.operationStack.indexOf(operationType);
      if (index !== -1) {
        this.operationStack.splice(index, 1);
      }
    }

    hasOperation(operationType) {
      return this.operationStack.includes(operationType);
    }

    async executeProtected(operationType, callback) {
      this.startOperation(operationType);
      try {
        return await callback();
      } finally {
        this.endOperation(operationType);
      }
    }

    suppressRefresh(callback) {
      const originalMode = this.refreshMode;
      this.refreshMode = "suppressed";
      try {
        return callback();
      } finally {
        this.refreshMode = originalMode;
      }
    }
  }

  function defineEditTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineEditTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    class EditTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "editTabBody",
          tabButtonId: "editTab",
          tabIndex: 2, // CONSTANTS.TABS.EDIT
        });

        this.editHandler = null;

        this.currentEditMode = null;
        this.currentShapingMode = null;

        this.state = new EditTabState();

        this.extractionModeActive = false;

        this.hasBeenShown = false;
      }

      async onInit() {
        this.editHandler = this.app.editHandler;
        if (!this.editHandler) {
          throw new Error("EditHandler not found");
        }

        this.categoryUIManager = new CategoryUIManager();

        await this.waitForCategoryUIManagerReady();

        await this.setupEventListeners();

        this.updateCurrentModes();
      }

      /**
       * 現在のスロットを取得
       * @returns {Object|null} 現在のスロット、取得できない場合はnull
       */
      getCurrentSlot() {
        return window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot] || null;
      }

      /**
       * スロットのelementsをソートして取得
       * @returns {Array} ソート済みの要素配列（undefined除外済み）
       */
      getSortedElements() {
        const currentSlot = this.getCurrentSlot();
        if (!currentSlot || !currentSlot.elements) {
          return [];
        }
        return currentSlot.elements
          .filter((el) => el != null)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0));
      }

      /**
       * 要素IDからソート済み配列内のインデックスを取得
       * @param {*} elementId 要素ID
       * @returns {number} インデックス（見つからない場合は-1）
       */
      findElementIndex(elementId) {
        const elements = this.getSortedElements();
        return elements.findIndex((el) => el.id === elementId);
      }

      /**
       * スロットのpromptを再生成して保存
       */
      async regenerateAndSaveSlot() {
        const currentSlot = this.getCurrentSlot();
        if (!currentSlot) return;

        const elements = this.getSortedElements();
        currentSlot.prompt = elements
          .map((el) => el.Value || "")
          .filter((v) => v)
          .join(",");

        // GeneratePromptフィールドも更新
        const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePromptField) {
          generatePromptField.value = currentSlot.prompt;
        }

        currentSlot.lastModified = Date.now();
        await window.promptSlotManager.saveToStorage();
      }

      async onShow() {
        const isFirstShow = !this.hasBeenShown;
        if (isFirstShow) {
          this.hasBeenShown = true;
        }

        this.checkExtractionMode();

        this.updateSplitButtonVisibility();

        if (this.extractionModeActive) {
          this.showExtractionModeWithEmptyState();
        } else {
          // スロットのelementsを確認
          const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
          const elements = currentSlot?.elements || [];
          if (!this.editHandler.isInitialized || elements.length === 0) {
            this.editHandler.initializeEditMode();
          } else {
            await this.refreshEditList();
          }
        }

        this.updateCurrentModes();

        this.updateSlotIntegrationPanel();

        this.updateSlotWeightInputConfig();

        if (isFirstShow || this.shouldInitializeInitialValues()) {
          await this.initializeCurrentDataSource();
        }

        // 表示制御を強制実行（初期化時のため）
        setTimeout(() => {
          this.updateIntegrationPanelVisibility();
        }, 100);

        // 初回表示時のコールバック（必要に応じて）
        if (isFirstShow && this.onFirstShow) {
          await this.onFirstShow();
        }

        this.updateSlotMuteButton();
      }

      async setupEventListeners() {
        this.setupUITypeHandlers();

        this.setupEditTypeHandlers();

        this.setupAddElementHandlers();

        this.setupSlotModeChangeListener();

        this.setupExtractionCompleteListener();

        this.setupSlotChangeListener();

        await this.setupSlotIntegrationHandlers();

        this.setupSlotMuteHandler();
      }

      setupUITypeHandlers() {
        const uiTypeRadios = document.querySelectorAll(DOM_SELECTORS.BY_ATTRIBUTE.UI_TYPE_RADIOS);

        uiTypeRadios.forEach((radio) => {
          this.addEventListener(radio, "change", async (e) => {
            await this.handleUITypeChange(e);
          });
        });
      }

      setupEditTypeHandlers() {
        const editTypeSelect = this.getElement(DOM_SELECTORS.BY_ATTRIBUTE.EDIT_TYPE_SELECT);
        if (editTypeSelect) {
          this.addEventListener(editTypeSelect, "change", async (e) => {
            await this.handleEditTypeChange(e);
          });
        }
      }

      setupAddElementHandlers() {
        const addTopBtn = this.getElement("#addElementTop");
        if (addTopBtn) {
          this.addEventListener(addTopBtn, "click", () => {
            this.addEmptyElement("top");
          });
        }

        const addBottomBtn = this.getElement("#addElementBottom");
        if (addBottomBtn) {
          this.addEventListener(addBottomBtn, "click", () => {
            this.addEmptyElement("bottom");
          });
        }

        const splitSingleBtn = this.getElement("#splitSinglePrompt");
        if (splitSingleBtn) {
          this.addEventListener(splitSingleBtn, "click", () => {
            this.splitSinglePrompt();
          });
        }
      }

      async handleUITypeChange(event) {
        const selectedValue = event.target.value;
        const previousValue = this.currentShapingMode;

        this.editHandler.handleUITypeChange(event);

        this.currentShapingMode = selectedValue;

        if (previousValue && previousValue !== selectedValue) {
          const modeNames = {
            SD: "StableDiffusion",
            NAI: "NovelAI",
            None: "自動整形無し",
          };

          ErrorHandler.notify(`整形モードを「${modeNames[selectedValue]}」に変更しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "info",
            duration: NOTIFICATION_DURATION.STANDARD,
          });
        }

        //   autoGenerateHandler.init(); // 多重登録の原因となるため削除
      }

      async handleEditTypeChange(event) {
        const selectedValue = event.target.value;
        const previousValue = this.currentEditMode;

        this.editHandler.handleEditTypeChange(event);

        this.currentEditMode = selectedValue;

        if (previousValue && previousValue !== selectedValue) {
          const modeNames = {
            select: "選択編集モード",
            text: "テキスト編集モード",
          };

          ErrorHandler.notify(`編集モードを「${modeNames[selectedValue]}」に変更しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "info",
            duration: NOTIFICATION_DURATION.SHORT,
          });
        }
      }

      async refreshEditList() {
        // スロットからelementsを取得
        const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
        const elements = currentSlot?.elements || [];

        if (elements.length === 0) {
          if (this.extractionModeActive) {
            this.showExtractionModeWithEmptyState();
          } else {
            this.app.listManager.createEmptyState(DOM_SELECTORS.BY_ID.EDIT_LIST, "edit");
          }
          return;
        }

        // 要素にIDを付与（なければ）
        elements.forEach((el, idx) => {
          if (el.id === undefined) {
            el.id = ID_OFFSETS.EDIT_TAB + idx;
          }
          if (el.sort === undefined) {
            el.sort = idx;
          }
        });

        const sortedElements = [...elements].sort((a, b) => (a.sort || 0) - (b.sort || 0));
        const convertedElements = sortedElements.map((element, index) => {
          let categoryData = ["", "", ""];
          let promptValue = element.Value || element.prompt || "";

          if (typeof promptValue !== "string") {
            if (typeof promptValue === "object" && promptValue !== null) {
              if (promptValue.toString && typeof promptValue.toString === "function") {
                promptValue = promptValue.toString();
              } else if (promptValue.value && typeof promptValue.value === "string") {
                promptValue = promptValue.value;
              } else if (promptValue.text && typeof promptValue.text === "string") {
                promptValue = promptValue.text;
              } else {
                promptValue = "";
              }
            } else {
              promptValue = String(promptValue || "");
            }
          }

          if (element.data && Array.isArray(element.data) && element.data.some((item) => item && item.trim())) {
            categoryData = element.data;
          } else if (
            element.categoryData &&
            Array.isArray(element.categoryData) &&
            element.categoryData.some((item) => item && item.trim())
          ) {
            categoryData = element.categoryData;
          } else if (promptValue) {
            if (window.CategoryUIManager) {
              const categoryUIManager = new CategoryUIManager();
              const foundCategories = categoryUIManager.findCategoryByPrompt(promptValue);
              if (foundCategories) {
                categoryData = [foundCategories[0] || "", foundCategories[1] || "", foundCategories[2] || ""];
              }
            }
          }

          return {
            prompt: promptValue,
            data: categoryData,
            id: element.id !== undefined ? element.id : `edit-${index}`,
            sort: element.sort !== undefined ? element.sort : index,
            SD: element.SD,
            NAI: element.NAI,
            None: element.None,
            Value: element.Value,
            Weight: element.Weight,
          };
        });

        const sorted = [...convertedElements].sort((a, b) => {
          return a.sort - b.sort;
        });

        const weightConfig = this.getWeightConfig();

        await this.app.listManager.createFlexibleList(sorted, DOM_SELECTORS.BY_ID.EDIT_LIST, {
          fields: this.getEditFieldsConfig(),
          buttons: this.getEditButtonsConfig(),
          sortable: true,
          listType: FLEXIBLE_LIST_TYPES.EDIT,
          weightDelta: weightConfig.delta, // 重み値の増減幅
          weightMin: weightConfig.min, // 重み値の最小値
          weightMax: weightConfig.max, // 重み値の最大値
          header: FLEXIBLE_LIST_HEADERS.EDIT.PROMPT_EDITOR, // ✏️ 編集中のPrompt
          idOffset: ID_OFFSETS.EDIT_TAB, // 編集タブ専用IDオフセット: 10000番台
          headerClickSort: {
            enabled: true,
            listManager: this.app.listManager,
            dataArray: elements,
            refreshCallback: async () => await this.refreshEditList(),
            saveCallback: async () => {
              if (window.promptSlotManager) {
                await window.promptSlotManager.saveCurrentSlot();
              }
            },
          },
          refreshCallback: async () => {
            await this.refreshEditList();
          },
          onFieldChange: async (index, fieldKey, value, item, eventType) => {
            await this.handleUnifiedFieldChange(index, fieldKey, value, item, eventType);
          },
          onDelete: async (index, item) => {
            // 確認ダイアログ（設定による）
            const shouldDelete =
              !AppState.userSettings.optionData?.isDeleteCheck || window.confirm("本当に削除しますか？");

            if (shouldDelete) {
              await this.handleEditDelete(index, item);
            }

            // ListManagerのdefault削除処理をスキップ
            return false;
          },
          onSort: async (sortedIds) => {
            this.handleEditSort(sortedIds);
          },
          onMove: async (index, direction, item) => {
            await this.handleEditMove(index, direction, item);
          },
          onRegistration: async (item, index) => {
            this.handleRegistration(item, index);
          },
          dropdownCount: 3, // 作成するカスタムドロップダウンの数（大・中・小項目の3段階）
          categoryChainBehavior: {
            focusNext: true, // 次のフィールドにフォーカス移動
            openDropdownOnFocus: true, // フォーカス時にドロップダウンを開く
            focusPromptAfterSmall: true, // 小項目後にプロンプトフィールドにフォーカス
          },
          onSmallCategoryChange: async (smallValue, bigValue, middleValue, item) => {
            await this.handleSmallCategoryChangeForPrompt(smallValue, bigValue, middleValue, item);
          },
          setupSpecialFeatures: ($li, inputs) => {
            this.setupEditSpecialFeatures($li, inputs);
          },
          idOffset: ID_OFFSETS.EDIT_TAB,
        });
      }

      async handleUnifiedFieldChange(index, fieldKey, value, item, eventType) {
        const fieldKeyStr = typeof fieldKey === "string" ? fieldKey : "";
        const isWeightField = typeof fieldKey === "function" || fieldKeyStr.includes("weight");
        const elements = this.getSortedElements();

        // FlexibleListはIDを上書きするので、originalIdを優先使用
        const itemOriginalId = item?.originalId !== undefined ? item.originalId : item?.id;

        if (fieldKeyStr.startsWith("data.") && window.categoryDataSync) {
          const dataIndex = parseInt(fieldKeyStr.split(".")[1]);

          const actualElementIndex =
            itemOriginalId !== undefined ? elements.findIndex((el) => el.id === itemOriginalId) : index;

          if (actualElementIndex === -1) {
            return;
          }

          const elementId = elements[actualElementIndex]?.id;

          if (elementId !== undefined) {
            const success = await window.categoryDataSync.executeSafeUpdate(
              elementId,
              async (latestData) => {
                const updatedData = [...latestData];
                updatedData[dataIndex] = value;

                await window.categoryDataSync.syncAllSources(elementId, updatedData, {
                  caller: "edit-tab-field-change",
                  syncListManager: true, // ListManagerのitemデータも同期
                });

                return true;
              },
              "edit-tab-handleUnifiedFieldChange"
            );

            if (dataIndex === 2) {
              // 小項目
              await this.handleSmallCategoryChange(value, item, actualElementIndex);
            }
          }
        } else if (fieldKeyStr === "prompt" && window.editElementManager) {
          const actualElementIndex =
            itemOriginalId !== undefined ? elements.findIndex((el) => el.id === itemOriginalId) : index;

          if (actualElementIndex === -1) {
            return;
          }

          const promptElementId = elements[actualElementIndex]?.id;

          if (promptElementId !== undefined) {
            // スロットの要素を直接更新
            const currentSlot = this.getCurrentSlot();
            const slotElement = currentSlot?.elements?.find((el) => el.id === promptElementId);
            if (slotElement) {
              slotElement.Value = value;
            }

            await window.editElementManager.updatePromptOnly(promptElementId, value);

            // プロンプト変更時にカテゴリーを自動検索・設定（スクロール位置保持のため非同期処理を避ける）
            await this.handlePromptCategoryUpdateWithoutRefresh(value, actualElementIndex, item);

            if (window.editElementManager) {
              window.editElementManager.updateSingleElementRegisterButton(promptElementId, 100);
            }
          }
        } else if (isWeightField) {
          const actualIndex =
            itemOriginalId !== undefined ? elements.findIndex((el) => el.id === itemOriginalId) : index;

          if (actualIndex !== -1) {
            await this.handleWeightChange(actualIndex, value, item);
          }
        }

        // 【重要】プロンプトを再生成してスロットを保存
        await this.regenerateAndSaveSlot();

        window.app.updatePromptDisplay();
      }

      async handlePromptCategoryUpdate(promptValue, index) {
        const categoryData = this.categoryUIManager.findCategoryByPrompt(promptValue);
        const elements = this.getSortedElements();

        if (categoryData && elements[index]) {
          const currentSlot = this.getCurrentSlot();
          const slotElement = currentSlot?.elements?.find((el) => el.id === elements[index].id);
          if (slotElement) {
            slotElement.data = [...categoryData];
          }

          const categoryElementId = elements[index]?.id;
          if (categoryElementId !== undefined) {
            this.app.listManager.updateSingleElement(
              DOM_SELECTORS.BY_ID.EDIT_LIST,
              categoryElementId,
              {
                "data.0": categoryData[0] || "",
                "data.1": categoryData[1] || "",
                "data.2": categoryData[2] || "",
              },
              { preserveFocus: true, preventEvents: true, searchMode: "id" }
            );
          }
        }
      }

      async handlePromptCategoryUpdateWithoutRefresh(promptValue, index, item) {
        if (!this.state.canUpdateCategory()) {
          return;
        }

        return ErrorHandler.wrapAsync(
          async () => {
            await this.processSingleElementTranslation(promptValue, index, item);
          },
          "プロンプト変更時のカテゴリー自動設定",
          { showToast: false }
        );
      }

      async processSingleElementTranslation(promptValue, index, item) {
        if (!promptValue || !promptValue.trim()) {
          return;
        }

        const elements = this.getSortedElements();
        let element = null;
        // FlexibleListはIDを上書きするので、originalIdを優先使用
        const itemOriginalId = item?.originalId !== undefined ? item.originalId : item?.id;
        if (itemOriginalId !== undefined) {
          element = elements.find((el) => el.id === itemOriginalId);
        } else {
          element = elements[index];
        }

        if (this.editHandler && element) {
          try {
            await this.editHandler.processSingleElementCategoryAndTranslation(element, promptValue);
          } catch (error) {}
        }
      }

      async processTranslationForElements() {
        if (this.editHandler) {
          const elements = this.getSortedElements();
          for (const element of elements) {
            if (element.Value?.trim()) {
              this.editHandler.processSingleElementCategoryAndTranslation(element, element.Value, true);
            }
          }
        }
      }

      async handleSmallCategoryChangeForPrompt(smallValue, bigValue, middleValue, item) {
        return ErrorHandler.wrapAsync(
          async () => {
            if (!smallValue || !bigValue || !middleValue) {
              return;
            }

            await this._executeSmallCategoryChange(smallValue, bigValue, middleValue, item);
          },
          "小項目変更時のプロンプト自動入力",
          { showToast: false }
        );
      }

      async _executeSmallCategoryChange(smallValue, bigValue, middleValue, item) {
        // FlexibleListはIDを上書きするので、originalIdを優先使用
        const elementId = item?.originalId !== undefined ? item.originalId : item?.id;
        const elements = this.getSortedElements();
        const currentSlot = this.getCurrentSlot();

        // 要素を検索（複数の形式に対応）
        let element = elements.find((el) => el.id === elementId);

        if (!element && typeof elementId === "number") {
          element = elements.find((el) => el.id === elementId.toString());
        }

        if (!element && typeof elementId === "string") {
          const numericId = parseInt(elementId);
          if (!isNaN(numericId)) {
            element = elements.find((el) => el.id === numericId);
          }
        }

        if (!element && typeof elementId === "string" && elementId.startsWith("edit-")) {
          const sortOrder = parseInt(elementId.split("-")[1]);
          if (!isNaN(sortOrder) && sortOrder < elements.length) {
            element = elements[sortOrder];
          }
        }

        if (!element) {
          return;
        }

        const foundPrompt = this.categoryUIManager.findPromptByCategory(bigValue, middleValue, smallValue);

        if (foundPrompt) {
          await this.state.executeProtected("prompt_update", async () => {
            // スロットの要素を直接更新
            const slotElement = currentSlot?.elements?.find((el) => el.id === element.id);
            if (slotElement) {
              slotElement.Value = foundPrompt;
              if (!slotElement.data) {
                slotElement.data = ["", "", ""];
              }
              slotElement.data[0] = bigValue;
              slotElement.data[1] = middleValue;
              slotElement.data[2] = smallValue;
            }

            await this.regenerateAndSaveSlot();
            window.app.updatePromptDisplay();

            const smallCategoryElementId = element.id;

            if (smallCategoryElementId !== undefined) {
              this.app.listManager.updateSingleElement(
                DOM_SELECTORS.BY_ID.EDIT_LIST,
                smallCategoryElementId,
                {
                  prompt: foundPrompt,
                  "data.0": bigValue,
                  "data.1": middleValue,
                  "data.2": smallValue,
                },
                { preserveFocus: true, preventEvents: true, searchMode: "id" }
              );

              if (window.editElementManager) {
                setTimeout(() => {
                  window.editElementManager.updateSingleElementRegisterButton(smallCategoryElementId, 50);
                }, 100);
              }
            }
          });
        }
      }

      async handleSmallCategoryChange(value, item, actualElementIndex) {
        return this.state.executeProtected("category_change", async () => {
          const elements = this.getSortedElements();
          const element = elements[actualElementIndex];
          if (!element || !element.data) {
            return;
          }

          const foundPrompt = this.categoryUIManager.findPromptByCategory(
            element.data[0], // big
            element.data[1], // middle
            value // small
          );

          if (foundPrompt) {
            // スロットの要素を直接更新
            const currentSlot = this.getCurrentSlot();
            const slotElement = currentSlot?.elements?.find((el) => el.id === element.id);
            if (slotElement) {
              slotElement.Value = foundPrompt;
            }

            await this.regenerateAndSaveSlot();
            window.app.updatePromptDisplay();

            const handleSmallElementId = element.id;

            if (handleSmallElementId !== undefined) {
              this.app.listManager.updateSingleElement(
                DOM_SELECTORS.BY_ID.EDIT_LIST,
                handleSmallElementId,
                { prompt: foundPrompt },
                { preserveFocus: true, preventEvents: true, searchMode: "id" }
              );

              if (window.editElementManager) {
                setTimeout(() => {
                  window.editElementManager.updateSingleElementRegisterButton(handleSmallElementId, 50);
                }, 100);
              }
            }
          }
        });
      }

      updateSinglePromptField(index, promptValue) {
        try {
          const elements = this.getSortedElements();
          const promptFieldElementId = elements[index]?.id;
          if (promptFieldElementId === undefined) {
            return;
          }

          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            promptFieldElementId,
            { prompt: promptValue },
            {
              preserveFocus: true,
              preventEvents: true,
              searchMode: "id",
            }
          );
        } catch (error) {}
      }

      updateSingleElementUI(index) {
        try {
          const elements = this.getSortedElements();
          const element = elements[index];
          if (!element || !element.data) {
            return;
          }

          const uiElementId = element?.id;
          if (uiElementId === undefined) {
            return;
          }

          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            uiElementId,
            {
              "data.0": element.data[0] || "",
              "data.1": element.data[1] || "",
              "data.2": element.data[2] || "",
            },
            {
              preserveFocus: true,
              preventEvents: true,
              searchMode: "id",
            }
          );
        } catch (error) {}
      }

      getEditFieldsConfig() {
        const editMode = AppState.userSettings.optionData.editType;
        const weightField = {
          type: "weight",
          key: (item) => {
            const shaping = AppState.userSettings.optionData.shaping;
            const weight = item[shaping]?.weight;
            return weight !== undefined && weight !== null ? weight : 0;
          },
          label: "重み",
        };

        switch (editMode?.toLowerCase()) {
          case "text":
            return [{ type: "prompt", key: "prompt", label: UI_LABELS.PROMPT }, weightField];

          case "select":
          default:
            return [
              {
                type: "category",
                key: "data.0",
                label: UI_LABELS.BIG_CATEGORY,
                readonly: (item) => item.data && item.data[0] === "翻訳中",
              },
              {
                type: "category",
                key: "data.1",
                label: UI_LABELS.MIDDLE_CATEGORY,
                readonly: (item) => item.data && item.data[0] === "翻訳中",
              },
              {
                type: "category",
                key: "data.2",
                label: UI_LABELS.SMALL_CATEGORY,
                readonly: (item) => item.data && item.data[0] === "翻訳中",
              },
              { type: "prompt", key: "prompt", label: UI_LABELS.PROMPT },
              weightField,
            ];
        }
      }

      getWeightConfig() {
        return WeightConverter.getWeightConfig(this.getCurrentShaping());
      }

      getEditButtonsConfig() {
        const editMode = AppState.userSettings.optionData.editType;
        const baseButtons = [];

        if (editMode?.toLowerCase() === "select") {
          baseButtons.push({
            type: "register",
            enabled: (item) => {
              const promptValue = item.prompt || item.Value || "";

              if (item.data && item.data[0] === "翻訳中") {
                return false;
              }

              const existsInDictionary = isPromptInDictionary(promptValue);

              return !existsInDictionary;
            },
            disabledTitle: (item) => {
              const promptValue = item.prompt || item.Value || "";

              if (item.data && item.data[0] === "翻訳中") {
                return "翻訳中のため登録できません";
              }

              const existsInDictionary = isPromptInDictionary(promptValue);

              return existsInDictionary ? "既に登録済みのため登録できません" : undefined;
            },
          });
        }

        baseButtons.push({ type: "moveUp" });
        baseButtons.push({ type: "moveDown" });

        baseButtons.push({ type: "delete" });

        return baseButtons;
      }

      async handleWeightChange(index, value, item) {
        const inputWeight = parseFloat(value) || 0;
        const weightConfig = this.getWeightConfig();
        const elements = this.getSortedElements();
        const currentSlot = this.getCurrentSlot();

        if (index < 0 || index >= elements.length) {
          return;
        }

        const clampedWeight = Math.max(weightConfig.min, Math.min(weightConfig.max, inputWeight));
        const shaping = AppState.userSettings.optionData.shaping;
        const targetElement = elements[index];

        // スロットの要素を直接更新
        const slotElement = currentSlot?.elements?.find((el) => el.id === targetElement.id);
        if (slotElement) {
          if (!slotElement[shaping]) {
            slotElement[shaping] = { weight: 0 };
          }
          slotElement[shaping].weight = clampedWeight;
        }

        await this.regenerateAndSaveSlot();
        window.app.updatePromptDisplay();

        setTimeout(() => {
          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            targetElement.id,
            { weight: clampedWeight },
            {
              preserveFocus: true,
              preventEvents: true,
              searchMode: "id",
            }
          );
        }, 50);
      }

      async updateRegisterButtonStates() {
        if (window.editElementManager) {
          try {
            const elements = this.getSortedElements();
            const updatePromises = elements
              .map((element) => {
                if (element.id !== undefined && element.id !== null) {
                  return window.editElementManager.updateSingleElementRegisterButton(element.id, 10);
                }
              })
              .filter(Boolean);

            await Promise.all(updatePromises);
          } catch (error) {
            // エラー時もリフレッシュは行わない（外部から必要に応じて呼び出す）
          }
        }
      }

      setupEditSpecialFeatures($li, inputs) {}

      async handleRegistration(item, index) {
        const prompt = item.prompt || item.Value || "";
        const categoryData = item.data || item.categoryData || ["", "", ""];

        const success = register(categoryData[0] || "", categoryData[1] || "", categoryData[2] || "", prompt);

        if (success) {
          ErrorHandler.notify("ローカル辞書に登録しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: 1500,
          });

          if (window.editElementManager && item?.id !== undefined) {
            await window.editElementManager.updateSingleElementRegisterButton(item.id, 0);
          }

          if (window.app && window.app.tabs && window.app.tabs.dictionary) {
            window.app.tabs.dictionary.refreshAddList();
          }

          await this.updateRegisterButtonStates();
        }
      }

      async handleEditDelete(index, item) {
        const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
        if (!currentSlot || !currentSlot.elements) {
          return;
        }

        // undefined要素を除外してsortプロパティでソート（FlexibleListと同じ順序にする）
        const elements = currentSlot.elements
          .filter((el) => el != null)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0));

        // 渡されたindexをそのまま使用（FlexibleListの表示順と一致）
        const elementIndex = index;

        if (elementIndex === -1 || elementIndex >= elements.length) {
          return;
        }
        // 要素を削除
        elements.splice(elementIndex, 1);

        // sort値を再計算
        elements.forEach((el, idx) => {
          if (el) el.sort = idx;
        });

        // 更新した配列をスロットに戻す
        currentSlot.elements = elements;

        // promptを再生成
        currentSlot.prompt = elements
          .map((el) => el.Value || "")
          .filter((v) => v)
          .join(",");

        // スロットを保存
        currentSlot.lastModified = Date.now();
        await window.promptSlotManager.saveToStorage();

        // GeneratePromptフィールドも更新
        const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePromptField) {
          generatePromptField.value = currentSlot.prompt;
        }

        // リストをリフレッシュ
        await this.refreshEditList();
      }

      async handleEditSort(sortedIds) {
        const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
        if (!currentSlot || !currentSlot.elements || currentSlot.elements.length === 0) {
          return;
        }

        const elements = currentSlot.elements;

        // sortedIdsに基づいてsort値を更新
        sortedIds.forEach((id, newIndex) => {
          // IDは文字列または数値の可能性がある
          const numId = typeof id === 'string' ? parseFloat(id) : id;
          const element = elements.find((el) => {
            if (!el) return false;
            return el.id === id || el.id === numId || String(el.id) === String(id);
          });
          if (element) {
            element.sort = newIndex;
          }
        });

        // undefined要素を除外してソート
        const validElements = elements.filter((el) => el != null);
        validElements.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        currentSlot.elements = validElements;

        // promptを再生成
        currentSlot.prompt = validElements
          .map((el) => el.Value || "")
          .filter((v) => v)
          .join(",");

        // スロットを保存
        currentSlot.lastModified = Date.now();
        await window.promptSlotManager.saveToStorage();

        // GeneratePromptフィールドも更新
        const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePromptField) {
          generatePromptField.value = currentSlot.prompt;
        }

        // リストをリフレッシュ
        await this.refreshEditList();
      }

      async handleEditMove(index, direction, item) {
        const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
        if (!currentSlot || !currentSlot.elements || currentSlot.elements.length < 2) {
          return;
        }

        // undefined要素を除外してsortプロパティでソート（FlexibleListと同じ順序にする）
        const elements = currentSlot.elements
          .filter((el) => el != null)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0));

        if (elements.length < 2) {
          return;
        }

        // 渡されたindexをそのまま使用（FlexibleListの表示順と一致）
        const currentIndex = index;

        // インデックスが見つからない場合は終了
        if (currentIndex === -1 || currentIndex >= elements.length) {
          return;
        }

        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= elements.length) {
          return;
        }

        // 配列内の要素を入れ替え
        const temp = elements[currentIndex];
        elements[currentIndex] = elements[targetIndex];
        elements[targetIndex] = temp;

        // sort値を再計算
        elements.forEach((el, idx) => {
          if (el) el.sort = idx;
        });

        // 更新した配列をスロットに戻す
        currentSlot.elements = elements;

        // promptを再生成
        currentSlot.prompt = elements
          .map((el) => el.Value || "")
          .filter((v) => v)
          .join(",");

        // スロットを保存
        currentSlot.lastModified = Date.now();
        await window.promptSlotManager.saveToStorage();

        // GeneratePromptフィールドも更新
        const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePromptField) {
          generatePromptField.value = currentSlot.prompt;
        }

        // リストをリフレッシュ
        await this.refreshEditList();
      }

      async addEmptyElement(position = "bottom") {
        try {
          const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
          if (!currentSlot) {
            throw new Error("現在のスロットが見つかりません");
          }

          // elements配列がなければ初期化
          if (!currentSlot.elements) {
            currentSlot.elements = [];
          }

          // 新しい要素を作成
          const newElement = {
            id: Date.now() + Math.random(),
            sort: position === "top" ? -1 : currentSlot.elements.length,
            Value: "",
            data: ["", "", ""],
            SD: { weight: 0 },
            NAI: { weight: 0 },
            None: { weight: 0 },
          };

          // 位置に応じて追加
          if (position === "top") {
            currentSlot.elements.unshift(newElement);
          } else {
            currentSlot.elements.push(newElement);
          }

          // sort値を再計算
          currentSlot.elements.forEach((el, idx) => {
            el.sort = idx;
          });

          // promptを再生成
          currentSlot.prompt = currentSlot.elements
            .map((el) => el.Value || "")
            .filter((v) => v)
            .join(",");

          // スロットを保存
          currentSlot.lastModified = Date.now();
          await window.promptSlotManager.saveToStorage();

          // GeneratePromptフィールドも更新
          const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePromptField) {
            generatePromptField.value = currentSlot.prompt;
          }

          // リストをリフレッシュ
          await this.refreshEditList();

          const positionText = position === "top" ? "上部" : "下部";
          ErrorHandler.notify(`${positionText}に空の要素を追加しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT,
          });

          return newElement.id;
        } catch (error) {
          ErrorHandler.notify("要素の追加に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.STANDARD,
          });
        }
      }

      updateCurrentModes() {
        const checkedUIType = document.querySelector('[name="UIType"]:checked');
        if (checkedUIType) {
          this.currentShapingMode = checkedUIType.value;
        }

        const editTypeSelect = document.getElementById("EditType");
        if (editTypeSelect) {
          this.currentEditMode = editTypeSelect.value;
        }
      }

      updateSplitButtonVisibility() {
        const splitSingleBtn = this.getElement("#splitSinglePrompt");
        if (!splitSingleBtn) return;

        const currentSlot = window.promptSlotManager?.slots[window.promptSlotManager?.currentSlot];
        const isSingleMode = currentSlot?.mode === "single";

        // TODO: PromptEditor削除済み - スロットのelementsを使用
        const elements = currentSlot?.elements || [];
        const hasMultipleElements = elements.length > 1;
        const shouldShow = isSingleMode && !hasMultipleElements;

        splitSingleBtn.style.display = shouldShow ? "flex" : "none";
      }

      async splitSinglePrompt() {
        // TODO: PromptEditor削除済み - スロットのelementsを使用
        const currentSlot = window.promptSlotManager?.slots[window.promptSlotManager?.currentSlot];
        const elements = currentSlot?.elements || [];

        if (elements.length !== 1) {
          ErrorHandler.notify("分割処理は要素が1個の時のみ実行できます", {
            type: "warning",
            duration: 3000,
          });
          return;
        }

        const element = elements[0];
        const currentPrompt = element.Value || element.prompt || "";

        if (!currentPrompt.includes(" ")) {
          ErrorHandler.notify("スペースで区切られた要素がないため、分割できません", {
            type: "warning",
            duration: 3000,
          });
          return;
        }

        try {
          const convertedPrompt = currentPrompt.replace(/\s+/g, ",");

          if (window.promptSlotManager) {
            const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
            if (currentSlot) {
              currentSlot.prompt = convertedPrompt;
              currentSlot.isUsed = true;
              currentSlot.lastModified = Date.now();
              window.promptSlotManager.saveToStorage();
            }
          }

          // GeneratePromptも更新（後方互換性）
          const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePromptField) {
            generatePromptField.value = convertedPrompt;
          }

          this.editHandler.initializeEditMode();

          const splitCount = currentPrompt.split(/\s+/).length;
          ErrorHandler.notify(`${splitCount}個の要素に分割しました`, {
            type: "success",
            duration: 2000,
          });
        } catch (error) {
          ErrorHandler.notify("分割処理中にエラーが発生しました", {
            type: "error",
            duration: 3000,
          });
        }
      }

      checkExtractionMode() {
        try {
          if (typeof promptSlotManager !== "undefined" && promptSlotManager.slots) {
            const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
            const isCurrentSlotExtraction =
              currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential");

            this.extractionModeActive = isCurrentSlotExtraction;

            this.updateAddButtonsState();

            if (this.extractionModeActive) {
              this.setGeneratePromptExtractionMode();
            } else {
              this.setGeneratePromptNormalMode();
            }
          } else {
            this.extractionModeActive = false;
            this.updateAddButtonsState();
          }
        } catch (error) {
          this.extractionModeActive = false;
          this.updateAddButtonsState();
        }
      }

      updateAddButtonsState() {
        const addTopBtn = this.getElement("#addElementTop");
        const addBottomBtn = this.getElement("#addElementBottom");

        if (addTopBtn) {
          addTopBtn.disabled = this.extractionModeActive;
          if (this.extractionModeActive) {
            addTopBtn.title = "抽出モード中は要素を追加できません";
            addTopBtn.classList.add("disabled-extraction");
          } else {
            addTopBtn.title = "リストの上部に空の要素を追加";
            addTopBtn.classList.remove("disabled-extraction");
          }
        }

        if (addBottomBtn) {
          addBottomBtn.disabled = this.extractionModeActive;
          if (this.extractionModeActive) {
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

          this.app.listManager.createEmptyState(DOM_SELECTORS.BY_ID.EDIT_LIST, "extraction", { extractionSlots });

          this.setGeneratePromptExtractionMode();
        } catch (error) {}
      }

      showExtractionModeMessage() {
        try {
          const editList = this.getElement(`#${DOM_IDS.EDIT.LIST}`);
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
          this.extractionModeActive = false;

          this.updateAddButtonsState();

          this.setGeneratePromptNormalMode();

          if (this.isCurrentTab()) {
            this.editHandler.initializeEditMode();
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
                  this.updateSplitButtonVisibility();

                  if (this.isCurrentTab()) {
                    const editList = this.getElement(`#${DOM_IDS.EDIT.LIST}`);
                    if (editList) {
                      if (this.extractionModeActive) {
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
            if (this.isCurrentTab() && this.extractionModeActive) {
              setTimeout(() => {
                this.showExtractionModeWithEmptyState();
              }, 100);
            }
          });

          window.addEventListener("allExtractionsComplete", () => {
            if (this.isCurrentTab() && this.extractionModeActive) {
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
            if (this.isCurrentTab()) {
              this.checkExtractionMode();
              this.updateSplitButtonVisibility();

              if (this.extractionModeActive) {
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
          const currentSlot = this.getCurrentSlot();

          if (!currentSlot) {
            return;
          }

          if (!this.isCurrentTab()) {
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

      handleRegisterClick(promptValue, element, elementIndex) {
        if (!promptValue || !promptValue.trim()) {
          return;
        }

        if (isPromptInDictionary(promptValue)) {
          if (window.ErrorHandler && typeof ErrorHandler.showToast === "function") {
            ErrorHandler.showToast(`"${promptValue}" は既に辞書に登録済みです`, 3000, "info");
          }

          if (window.editElementManager && element?.id !== undefined) {
            setTimeout(() => {
              window.editElementManager.updateSingleElementRegisterButton(element.id, 100);
            }, 50);
          }

          return;
        }

        const newLocalItem = {
          prompt: promptValue.trim(),
          data: element?.data || ["", "", ""],
        };

        if (!AppState.data.localPromptList) {
          AppState.data.localPromptList = [];
        }

        AppState.data.localPromptList.push(newLocalItem);

        saveLocalList(false)
          .then(() => {
            if (window.editElementManager && element?.id !== undefined) {
              setTimeout(() => {
                window.editElementManager.updateSingleElementRegisterButton(element.id, 100);
              }, 50);
            }
          })
          .catch((error) => {});
      }

      async waitForCategoryUIManagerReady() {
        let attempts = 0;
        const maxAttempts = 20; // 最大2秒待機 (100ms × 20)

        while (attempts < maxAttempts) {
          const categories = this.categoryUIManager.getCategoriesByLevel(0, null);
          if (categories.length >= 10) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, UI_DELAYS.STANDARD_UPDATE));
          attempts++;
        }
      }

      async waitForSlotManager(maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          if (this.app && this.app.tabs && this.app.tabs.slot && this.app.tabs.slot.slotManager) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, UI_DELAYS.QUICK_UPDATE));
        }
        return false;
      }

      async setupSlotIntegrationHandlers() {
        const slotModeSelect = document.getElementById(DOM_IDS.EDIT.SLOT_MODE);
        if (slotModeSelect) {
          this.addEventListener(slotModeSelect, "change", async (e) => {
            await this.handleSlotModeChange(e);
          });
        }

        // スロット重み設定はsetupSlotWeightInputHandlersで処理するため、ここでは削除

        const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
        if (dataSourceSelect) {
          this.addEventListener(dataSourceSelect, "change", async (e) => {
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
          await this.waitForSlotManager();

          const currentSlot = this.getCurrentSlot();
          let currentDataSource = "dictionary"; // デフォルト

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

          // 大項目または中項目が空の場合は初期化が必要
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
          const currentSlot = this.getCurrentSlot();
          if (!currentSlot) {
            return;
          }

          currentSlot.mode = newMode;
          currentSlot.lastModified = Date.now();

          if (window.promptSlotManager) {
            await window.promptSlotManager.saveToStorage();
          }

          this.checkExtractionMode();

          if (this.extractionModeActive) {
            this.showExtractionModeWithEmptyState();
          } else {
            this.editHandler.initializeEditMode();
          }

          this.updateIntegrationPanelVisibility();
        } catch (error) {}
      }

      handleWeightWheelChange(event) {
        event.preventDefault();
        const input = event.target;

        const currentShaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(currentShaping);

        const currentValue = parseFloat(input.value) || 0;
        let delta = weightConfig.delta;

        if (event.shiftKey) {
          delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
        } else if (event.ctrlKey) {
          delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
        }

        const direction = event.deltaY > 0 ? -1 : 1;
        const newValue = currentValue + direction * delta;

        // 範囲内に制限
        const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

        input.value = Math.round(clampedValue * 100) / 100;

        input.dispatchEvent(new Event("input", { bubbles: true }));
      }

      async handleDataSourceChange(event) {
        const newDataSource = event.target.value;

        try {
          const currentSlot = this.getCurrentSlot();
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

      getCurrentSlot() {
        if (window.promptSlotManager && window.promptSlotManager.slots) {
          return window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
        }
        return null;
      }

      updateSlotIntegrationPanel() {
        try {
          const currentSlot = this.getCurrentSlot();
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
              : this.getDefaultWeight();
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
          dictionaryControls.forEach((control) => (control.style.display = "flex"));
          favoritesControls.forEach((control) => (control.style.display = "none"));
        } else if (dataSource === "favorites") {
          dictionaryControls.forEach((control) => (control.style.display = "none"));
          favoritesControls.forEach((control) => (control.style.display = "flex"));
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
          const currentSlot = this.getCurrentSlot();

          if (currentSlot) {
            if (!currentSlot.category) {
              currentSlot.category = {};
            }
            currentSlot.category.big = bigCategory;
            currentSlot.category.middle = ""; // 中項目をリセット

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
          const currentSlot = this.getCurrentSlot();

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
            const currentSlot = this.getCurrentSlot();

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
          return this.categoryUIManager.getCategoriesByLevel(0, null);
        }
        return [];
      }

      updateMiddleCategories(select, bigCategory) {
        this.categoryUIManager.populateSelectElement(select, 1, bigCategory, "すべて");
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

        const currentSlot = this.getCurrentSlot();
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

        const currentSlot = this.getCurrentSlot();
        const isExtractionMode = this.extractionModeActive;
        const dataSource = currentSlot?.dataSource || "dictionary";

        const editModeDropdown = document.querySelector(".edit-mode-dropdown");
        if (editModeDropdown) {
          editModeDropdown.style.display = isExtractionMode ? "none" : "flex";
        }

        const dataSourceControl = document.querySelector(".slot-data-source-control");
        if (dataSourceControl) {
          dataSourceControl.style.display = isExtractionMode ? "flex" : "none";
        }

        const dictionaryControls = document.querySelectorAll(".dictionary-selection-control");
        dictionaryControls.forEach((control) => {
          control.style.display = isExtractionMode && dataSource === "dictionary" ? "flex" : "none";
        });

        const favoritesControls = document.querySelectorAll(".favorites-selection-control");
        favoritesControls.forEach((control) => {
          control.style.display = isExtractionMode && dataSource === "favorites" ? "flex" : "none";
        });

        if (isExtractionMode) {
          modeSelectionPanel.classList.add("extraction-mode");
        } else {
          modeSelectionPanel.classList.remove("extraction-mode");
        }
      }

      getDefaultWeight() {
        const shaping = this.getCurrentShaping();
        switch (shaping) {
          case "SD":
            return 1.0; // SD形式では1.0が無効化される値
          case "NAI":
            return 0.0; // NAI形式では0.0が無効化される値
          case "None":
          default:
            return 1.0; // None形式では重みは使用されないが、1.0をデフォルトとする
        }
      }

      getCurrentShaping() {
        if (typeof AppState !== "undefined" && AppState.userSettings?.optionData?.shaping) {
          return AppState.userSettings.optionData.shaping;
        }
        return "SD";
      }

      setupSlotMuteHandler() {
        const muteBtn = this.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_BTN}`);
        if (muteBtn) {
          this.addEventListener(muteBtn, "click", () => {
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
        const muteBtn = this.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_BTN}`);
        const muteIcon = this.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_ICON}`);

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

      setupSlotWeightInputHandlers() {
        const weightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
        if (!weightInput) return;

        if (!this.handleSlotWeightWheel) {
          const self = this; // thisコンテキストを保持
          this.handleSlotWeightWheel = function (e) {
            e.preventDefault(); // ページスクロールを防ぐ

            const currentShaping = self.getCurrentShaping();
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

            // 範囲内に制限
            const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

            weightInput.value = Math.round(clampedValue * 100) / 100;

            weightInput.dispatchEvent(new Event("input", { bubbles: true }));
          };
        }

        if (!this.handleSlotWeightChange) {
          const self = this; // thisコンテキストを保持
          this.handleSlotWeightChange = async function (e) {
            const newWeight = parseFloat(e.target.value) || 0;
            const currentSlot = self.getCurrentSlot();

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

        weightInput.removeEventListener("wheel", this.handleSlotWeightWheel);
        weightInput.removeEventListener("input", this.handleSlotWeightChange);

        weightInput.addEventListener("wheel", this.handleSlotWeightWheel);
        weightInput.addEventListener("input", this.handleSlotWeightChange);
      }

      resetCurrentSlotWeightForNewShaping() {
        const currentSlot = this.getCurrentSlot();
        if (currentSlot) {
          const defaultWeight = window.promptSlotManager
            ? window.promptSlotManager.getDefaultWeight()
            : this.getDefaultWeight();

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

      updateSlotWeightInputConfig() {
        const weightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
        if (!weightInput) {
          return;
        }

        const currentShaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(currentShaping);

        weightInput.min = weightConfig.min;
        weightInput.max = weightConfig.max;
        weightInput.step = weightConfig.delta;
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

          this.app.listManager.createEmptyState(DOM_SELECTORS.BY_ID.EDIT_LIST, "extraction", { extractionSlots });

          this.setGeneratePromptExtractionMode();
        } catch (error) {}
      }

      debug() {
        super.debug();
        // デバッグ情報はdebugMode有効時のみ利用
      }
    }

    if (typeof window !== "undefined") {
      window.EditTab = EditTab;
    }
  }

  defineEditTab();
})();
