(function () {
  "use strict";

  class EditTabListManager {
    constructor(editTab) {
      this.editTab = editTab;
    }

    async refreshEditList() {
      const currentSlot = SlotUtils.getCurrentSlot();
      const elements = currentSlot?.elements || [];

      if (elements.length === 0) {
        if (this.editTab.extractionModeActive) {
          this.editTab.showExtractionModeWithEmptyState();
        } else {
          this.editTab.app.listManager.createEmptyState(DOM_SELECTORS.BY_ID.EDIT_LIST, "edit");
        }
        return;
      }

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
          NAIv45: element.NAIv45,
          None: element.None,
          Value: element.Value,
          Weight: element.Weight,
        };
      });

      const sorted = [...convertedElements].sort((a, b) => {
        return a.sort - b.sort;
      });

      const weightConfig = this.getWeightConfig();

      await this.editTab.app.listManager.createFlexibleList(sorted, DOM_SELECTORS.BY_ID.EDIT_LIST, {
        fields: this.getEditFieldsConfig(),
        buttons: this.getEditButtonsConfig(),
        sortable: true,
        listType: FLEXIBLE_LIST_TYPES.EDIT,
        weightDelta: weightConfig.delta,
        weightMin: weightConfig.min,
        weightMax: weightConfig.max,
        header: FLEXIBLE_LIST_HEADERS.EDIT.PROMPT_EDITOR,
        idOffset: ID_OFFSETS.EDIT_TAB,
        headerClickSort: {
          enabled: true,
          listManager: this.editTab.app.listManager,
          getDataArray: () => SlotUtils.getSortedElements(),
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
          const shouldDelete =
            !AppState.userSettings.optionData?.isDeleteCheck || window.confirm("本当に削除しますか？");

          if (shouldDelete) {
            await this.handleEditDelete(index, item);
          }

          return false;
        },
        onSort: async (sortedIds) => {
          await this.handleEditSort(sortedIds);
        },
        onMove: async (index, direction, item) => {
          await this.handleEditMove(index, direction, item);
        },
        onRegistration: async (item, index) => {
          this.handleRegistration(item, index);
        },
        dropdownCount: 3,
        categoryChainBehavior: {
          focusNext: true,
          openDropdownOnFocus: true,
          focusPromptAfterSmall: true,
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

    getEditFieldsConfig() {
      const editMode = AppState.userSettings.optionData.editType;
      const weightField = {
        type: "weight",
        key: (item) => {
          const shaping = AppState.userSettings.optionData.shaping;
          const weight = item[shaping]?.weight;
          if (weight !== undefined && weight !== null) return weight;

          // [マイグレーション] 旧データで shaping フィールド未定義時のデフォルト
          // SD/NAIv45 は乗算系で 1.0 が無重み、NAI は加算系で 0 が無重み
          switch (shaping) {
            case "NAIv45": return 1;
            case "SD": return 1;
            case "NAI": return 0;
            case "None": return 0;
            default:
              console.warn(`[EditTabListManager] Unknown shaping format: ${shaping}`);
              return 0;
          }
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
      return WeightConverter.getWeightConfig(this.editTab.getCurrentShaping());
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

    setupEditSpecialFeatures($li, inputs) {}

    setupUITypeHandlers() {
      const uiTypeRadios = document.querySelectorAll(DOM_SELECTORS.BY_ATTRIBUTE.UI_TYPE_RADIOS);

      uiTypeRadios.forEach((radio) => {
        this.editTab.addEventListener(radio, "change", async (e) => {
          await this.handleUITypeChange(e);
        });
      });
    }

    setupEditTypeHandlers() {
      const editTypeSelect = this.editTab.getElement(DOM_SELECTORS.BY_ATTRIBUTE.EDIT_TYPE_SELECT);
      if (editTypeSelect) {
        this.editTab.addEventListener(editTypeSelect, "change", async (e) => {
          await this.handleEditTypeChange(e);
        });
      }
    }

    async handleUITypeChange(event) {
      const selectedValue = event.target.value;
      const previousValue = this.editTab.currentShapingMode;

      this.editTab.editHandler.handleUITypeChange(event);

      this.editTab.currentShapingMode = selectedValue;

      if (previousValue && previousValue !== selectedValue) {
        const modeNames = {
          SD: "StableDiffusion",
          NAI: "NovelAI",
          None: "自動整形無し",
        };

        UIHelpers.notifyInfo(`整形モードを「${modeNames[selectedValue]}」に変更しました`, NOTIFICATION_DURATION.STANDARD);
      }
    }

    async handleEditTypeChange(event) {
      const selectedValue = event.target.value;
      const previousValue = this.editTab.currentEditMode;

      this.editTab.editHandler.handleEditTypeChange(event);

      this.editTab.currentEditMode = selectedValue;

      if (previousValue && previousValue !== selectedValue) {
        const modeNames = {
          select: "選択編集モード",
          text: "テキスト編集モード",
        };

        UIHelpers.notifyInfo(`編集モードを「${modeNames[selectedValue]}」に変更しました`);
      }
    }

    updateCurrentModes() {
      const checkedUIType = document.querySelector('[name="UIType"]:checked');
      if (checkedUIType) {
        this.editTab.currentShapingMode = checkedUIType.value;
      }

      const editTypeSelect = document.getElementById("EditType");
      if (editTypeSelect) {
        this.editTab.currentEditMode = editTypeSelect.value;
      }
    }

    async handleUnifiedFieldChange(index, fieldKey, value, item, eventType) {
      const previous = this._fieldChangeQueue || Promise.resolve();
      this._fieldChangeQueue = previous.then(() =>
        this._executeFieldChange(index, fieldKey, value, item, eventType)
      );
      return this._fieldChangeQueue;
    }

    async _executeFieldChange(index, fieldKey, value, item, eventType) {
      const fieldKeyStr = typeof fieldKey === "string" ? fieldKey : "";
      const isWeightField = typeof fieldKey === "function" || fieldKeyStr.includes("weight");
      const elements = SlotUtils.getSortedElements();

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
                syncListManager: true,
              });

              return true;
            },
            "edit-tab-handleUnifiedFieldChange"
          );

          if (dataIndex === 2) {
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
          const currentSlot = SlotUtils.getCurrentSlot();
          const slotElement = currentSlot?.elements?.find((el) => el.id === promptElementId);
          if (slotElement) {
            slotElement.Value = value;
          }

          await window.editElementManager.updatePromptOnly(promptElementId, value);

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

      await SlotUtils.regenerateAndSaveSlot();

      window.app.updatePromptDisplay();
    }

    async handlePromptCategoryUpdate(promptValue, index) {
      const categoryData = this.editTab.categoryUIManager.findCategoryByPrompt(promptValue);
      const elements = SlotUtils.getSortedElements();

      if (categoryData && elements[index]) {
        const currentSlot = SlotUtils.getCurrentSlot();
        const slotElement = currentSlot?.elements?.find((el) => el.id === elements[index].id);
        if (slotElement) {
          slotElement.data = [...categoryData];
        }

        const categoryElementId = elements[index]?.id;
        if (categoryElementId !== undefined) {
          this.editTab.app.listManager.updateSingleElement(
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
      const canUpdate = this.editTab.state.canUpdateCategory();
      if (!canUpdate) {
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

      const elements = SlotUtils.getSortedElements();
      let element = null;
      const itemOriginalId = item?.originalId !== undefined ? item.originalId : item?.id;
      if (itemOriginalId !== undefined) {
        element = elements.find((el) => el.id === itemOriginalId);
      } else {
        element = elements[index];
      }

      if (this.editTab.editHandler && element) {
        try {
          await this.editTab.editHandler.processSingleElementCategoryAndTranslation(element, promptValue);
        } catch (error) {
        }
      }
    }

    async processTranslationForElements() {
      if (this.editTab.editHandler) {
        const elements = SlotUtils.getSortedElements();
        for (const element of elements) {
          if (element.Value?.trim()) {
            this.editTab.editHandler.processSingleElementCategoryAndTranslation(element, element.Value, true);
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
      const elementId = item?.originalId !== undefined ? item.originalId : item?.id;
      const elements = SlotUtils.getSortedElements();
      const currentSlot = SlotUtils.getCurrentSlot();

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

      const foundPrompt = this.editTab.categoryUIManager.findPromptByCategory(bigValue, middleValue, smallValue);

      if (foundPrompt) {
        await this.editTab.state.executeProtected("prompt_update", async () => {
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

          await SlotUtils.regenerateAndSaveSlot();
          window.app.updatePromptDisplay();

          const smallCategoryElementId = element.id;

          if (smallCategoryElementId !== undefined) {
            this.editTab.app.listManager.updateSingleElement(
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
      return this.editTab.state.executeProtected("category_change", async () => {
        const elements = SlotUtils.getSortedElements();
        const element = elements[actualElementIndex];
        if (!element || !element.data) {
          return;
        }

        const foundPrompt = this.editTab.categoryUIManager.findPromptByCategory(
          element.data[0],
          element.data[1],
          value
        );

        if (foundPrompt) {
          const currentSlot = SlotUtils.getCurrentSlot();
          const slotElement = currentSlot?.elements?.find((el) => el.id === element.id);
          if (slotElement) {
            slotElement.Value = foundPrompt;
          }

          await SlotUtils.regenerateAndSaveSlot();
          window.app.updatePromptDisplay();

          const handleSmallElementId = element.id;

          if (handleSmallElementId !== undefined) {
            this.editTab.app.listManager.updateSingleElement(
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
        const elements = SlotUtils.getSortedElements();
        const promptFieldElementId = elements[index]?.id;
        if (promptFieldElementId === undefined) {
          return;
        }

        this.editTab.app.listManager.updateSingleElement(
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
        const elements = SlotUtils.getSortedElements();
        const element = elements[index];
        if (!element || !element.data) {
          return;
        }

        const uiElementId = element?.id;
        if (uiElementId === undefined) {
          return;
        }

        this.editTab.app.listManager.updateSingleElement(
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

    setupAddElementHandlers() {
      const addTopBtn = this.editTab.getElement("#addElementTop");
      if (addTopBtn) {
        this.editTab.addEventListener(addTopBtn, "click", () => {
          this.addEmptyElement("top");
        });
      }

      const addBottomBtn = this.editTab.getElement("#addElementBottom");
      if (addBottomBtn) {
        this.editTab.addEventListener(addBottomBtn, "click", () => {
          this.addEmptyElement("bottom");
        });
      }

      const splitSingleBtn = this.editTab.getElement("#splitSinglePrompt");
      if (splitSingleBtn) {
        this.editTab.addEventListener(splitSingleBtn, "click", () => {
          this.splitSinglePrompt();
        });
      }
    }

    async addEmptyElement(position = "bottom") {
      try {
        const currentSlot = SlotUtils.getCurrentSlot();
        if (!currentSlot) {
          throw new Error("現在のスロットが見つかりません");
        }

        if (!currentSlot.elements) {
          currentSlot.elements = [];
        }

        const newElement = {
          id: Date.now() + Math.random(),
          sort: position === "top" ? -1 : currentSlot.elements.length,
          Value: "",
          data: ["", "", ""],
          SD: { weight: 0 },
          NAI: { weight: 0 },
          NAIv45: { weight: 1 },
          None: { weight: 0 },
        };

        if (position === "top") {
          currentSlot.elements.unshift(newElement);
        } else {
          currentSlot.elements.push(newElement);
        }

        currentSlot.elements.forEach((el, idx) => {
          el.sort = idx;
        });

        await SlotUtils.regenerateAndSaveSlot();

        await this.refreshEditList();

        const positionText = position === "top" ? "上部" : "下部";
        UIHelpers.notifySuccess(`${positionText}に空の要素を追加しました`);

        return newElement.id;
      } catch (error) {
        UIHelpers.notifyError("要素の追加に失敗しました", NOTIFICATION_DURATION.STANDARD);
      }
    }

    async handleEditDelete(index, item) {
      const currentSlot = SlotUtils.getCurrentSlot();
      if (!currentSlot || !currentSlot.elements) {
        return;
      }

      const elements = currentSlot.elements
        .filter((el) => el != null)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));

      const elementIndex = index;

      if (elementIndex === -1 || elementIndex >= elements.length) {
        return;
      }
      elements.splice(elementIndex, 1);

      elements.forEach((el, idx) => {
        if (el) el.sort = idx;
      });

      currentSlot.elements = elements;

      await SlotUtils.regenerateAndSaveSlot();

      await this.refreshEditList();
    }

    async handleEditSort(sortedIds) {
      const currentSlot = SlotUtils.getCurrentSlot();
      if (!currentSlot || !currentSlot.elements || currentSlot.elements.length === 0) {
        return;
      }

      const elements = currentSlot.elements;

      sortedIds.forEach((id, newIndex) => {
        const numId = typeof id === 'string' ? parseFloat(id) : id;
        const element = elements.find((el) => {
          if (!el) return false;
          return el.id === id || el.id === numId || String(el.id) === String(id);
        });
        if (element) {
          element.sort = newIndex;
        }
      });

      const validElements = elements.filter((el) => el != null);
      validElements.sort((a, b) => (a.sort || 0) - (b.sort || 0));
      currentSlot.elements = validElements;

      await SlotUtils.regenerateAndSaveSlot();

      await this.refreshEditList();
    }

    async handleEditMove(index, direction, item) {
      const currentSlot = SlotUtils.getCurrentSlot();
      if (!currentSlot || !currentSlot.elements || currentSlot.elements.length < 2) {
        return;
      }

      const elements = currentSlot.elements
        .filter((el) => el != null)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));

      if (elements.length < 2) {
        return;
      }

      const currentIndex = index;

      if (currentIndex === -1 || currentIndex >= elements.length) {
        return;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= elements.length) {
        return;
      }

      const temp = elements[currentIndex];
      elements[currentIndex] = elements[targetIndex];
      elements[targetIndex] = temp;

      elements.forEach((el, idx) => {
        if (el) el.sort = idx;
      });

      currentSlot.elements = elements;

      await SlotUtils.regenerateAndSaveSlot();

      await this.refreshEditList();
    }

    updateSplitButtonVisibility() {
      const splitSingleBtn = this.editTab.getElement("#splitSinglePrompt");
      if (!splitSingleBtn) return;

      const currentSlot = SlotUtils.getCurrentSlot();
      const isSingleMode = currentSlot?.mode === "single";

      const elements = currentSlot?.elements || [];
      const hasMultipleElements = elements.length > 1;
      const shouldShow = isSingleMode && !hasMultipleElements;

      if (shouldShow) {
        splitSingleBtn.classList.remove("hidden");
        splitSingleBtn.classList.add("show-flex");
      } else {
        splitSingleBtn.classList.remove("show-flex");
        splitSingleBtn.classList.add("hidden");
      }
    }

    async splitSinglePrompt() {
      const currentSlot = SlotUtils.getCurrentSlot();
      const elements = currentSlot?.elements || [];

      if (elements.length !== 1) {
        UIHelpers.notifyWarning("分割処理は要素が1個の時のみ実行できます", 3000);
        return;
      }

      const element = elements[0];
      const currentPrompt = element.Value || element.prompt || "";

      if (!currentPrompt.includes(" ")) {
        UIHelpers.notifyWarning("スペースで区切られた要素がないため、分割できません", 3000);
        return;
      }

      try {
        const convertedPrompt = currentPrompt.replace(/\s+/g, ",");

        const currentSlotForSplit = SlotUtils.getCurrentSlot();
        if (currentSlotForSplit) {
          currentSlotForSplit.prompt = convertedPrompt;
          currentSlotForSplit.isUsed = true;
          currentSlotForSplit.lastModified = Date.now();
          window.promptSlotManager?.saveToStorage();
        }

        const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (generatePromptField) {
          generatePromptField.value = convertedPrompt;
        }

        this.editTab.editHandler.initializeEditMode();

        const splitCount = currentPrompt.split(/\s+/).length;
        UIHelpers.notifySuccess(`${splitCount}個の要素に分割しました`, 2000);
      } catch (error) {
        UIHelpers.notifyError("分割処理中にエラーが発生しました", 3000);
      }
    }

    async handleWeightChange(index, value, item) {
      const inputWeight = parseFloat(value) || 0;
      const weightConfig = this.getWeightConfig();
      const elements = SlotUtils.getSortedElements();
      const currentSlot = SlotUtils.getCurrentSlot();

      if (index < 0 || index >= elements.length) {
        return;
      }

      const clampedWeight = Math.max(weightConfig.min, Math.min(weightConfig.max, inputWeight));
      const shaping = AppState.userSettings.optionData.shaping;
      const targetElement = elements[index];

      const slotElement = currentSlot?.elements?.find((el) => el.id === targetElement.id);
      if (slotElement) {
        if (!slotElement[shaping]) {
          slotElement[shaping] = { weight: 0 };
        }
        slotElement[shaping].weight = clampedWeight;
      }

      await SlotUtils.regenerateAndSaveSlot();
      window.app.updatePromptDisplay();

      setTimeout(() => {
        this.editTab.app.listManager.updateSingleElement(
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

    handleWeightWheelChange(event) {
      event.preventDefault();
      const input = event.target;

      const currentShaping = this.editTab.getCurrentShaping();
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

      const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

      input.value = Math.round(clampedValue * 100) / 100;

      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    async updateRegisterButtonStates() {
      if (window.editElementManager) {
        try {
          const elements = SlotUtils.getSortedElements();
          const updatePromises = elements
            .map((element) => {
              if (element.id !== undefined && element.id !== null) {
                return window.editElementManager.updateSingleElementRegisterButton(element.id, 10);
              }
            })
            .filter(Boolean);

          await Promise.all(updatePromises);
        } catch (error) {}
      }
    }

    async handleRegistration(item, index) {
      const prompt = item.prompt || item.Value || "";
      const categoryData = item.data || item.categoryData || ["", "", ""];

      const success = register(categoryData[0] || "", categoryData[1] || "", categoryData[2] || "", prompt);

      if (success) {
        UIHelpers.notifySuccess("ローカル辞書に登録しました", 1500);

        if (window.editElementManager && item?.id !== undefined) {
          await window.editElementManager.updateSingleElementRegisterButton(item.id, 0);
        }

        if (window.app && window.app.tabs && window.app.tabs.dictionary) {
          window.app.tabs.dictionary.refreshAddList();
        }

        await this.updateRegisterButtonStates();
      }
    }

    handleRegisterClick(promptValue, element, elementIndex) {
      if (!promptValue || !promptValue.trim()) {
        return;
      }

      if (isPromptInDictionary(promptValue)) {
        UIHelpers.notifyInfo(`"${promptValue}" は既に辞書に登録済みです`, 3000);

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
  }

  if (typeof window !== "undefined") {
    window.EditTabListManager = EditTabListManager;
  }
})();
