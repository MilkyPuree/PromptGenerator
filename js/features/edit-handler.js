/**
 * 編集ハンドラー
 *
 * 設計:
 * - 現在のスロットのelementsを直接操作
 * - 翻訳処理は残す（翻訳結果をelement.dataに保存）
 * - スロットのpromptはslot.elementsから再生成
 */
class EditHandler {
  constructor(app) {
    this.app = app; // PromptGeneratorAppインスタンスへの参照
    this.translatingItems = new Set();
    this.translationCache = new Map();
  }

  handleUITypeChange(event) {
    const selectedValue = event.target.value;
    AppState.userSettings.optionData.shaping = selectedValue;

    this.app.updatePromptDisplay();

    this.initializeEditMode();
    saveOptionData();
  }

  handleEditTypeChange(event) {
    const selectedValue = event.target.value;
    AppState.userSettings.optionData.editType = selectedValue;

    saveOptionData();

    this.app.updatePromptDisplay();

    this.initializeEditMode();
  }

  initializeEditMode() {
    const currentSlot = SlotUtils.getCurrentSlot();
    if (currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential")) {
      return;
    }

    let currentPrompt = "";

    if (currentSlot && currentSlot.prompt) {
      currentPrompt = currentSlot.prompt;
    }

    // スロットが空の場合のみGeneratePromptフィールドを参照（後方互換性）
    if (!currentPrompt) {
      const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      currentPrompt = generatePrompt ? generatePrompt.value : "";
    }

    this.refreshEditList();
  }

  async refreshEditList() {
    // EditTabのrefreshEditListを呼び出す
    if (this.app && this.app.tabs && this.app.tabs.edit) {
      await this.app.tabs.edit.refreshEditList();
    }
  }

  async processCategoryDataAfterDOMGeneration(elements) {
    await this.waitForDOMGeneration();

    const processingPromises = elements.map((element) =>
      this.processSingleElementCategoryAndTranslation(element, element.Value, false)
    );

    try {
      await Promise.all(processingPromises);
    } catch (error) {}
  }

  async waitForDOMGeneration() {
    return new Promise((resolve) => {
      const checkDOM = () => {
        const editList = document.querySelector("#editList-list");
        const hasRows = editList && editList.children.length > 1; // ヘッダー除く

        if (hasRows) {
          setTimeout(resolve, UI_DELAYS.EDIT_REFRESH);
        } else {
          setTimeout(checkDOM, 5);
        }
      };
      checkDOM();
    });
  }

  isTranslating(prompt) {
    return this.translatingItems.has(prompt) || this.translationCache.has(prompt);
  }

  async processSingleElementCategoryAndTranslation(element, promptValue, isInitialization = false) {
    if (!promptValue || !promptValue.trim()) {
      return;
    }

    const elementId = element.id;

    let shouldSkipCategorySearch = false;

    if (!isInitialization && elementId !== undefined && window.categoryDataSync) {
      const currentCategoryData = window.categoryDataSync.getCurrentDOMValues(elementId);

      if (currentCategoryData && currentCategoryData.length >= 3) {
        const [cat0, cat1, cat2] = currentCategoryData;

        if (cat0 === "翻訳中" || cat0 === "翻訳失敗") {
          shouldSkipCategorySearch = true;
        }

        if (shouldSkipCategorySearch) {
          await window.categoryDataSync.syncAllSources(elementId, currentCategoryData, {
            caller: "edit-handler-existing-data",
          });
          return;
        }
      }
    }

    let category = null;
    let englishPrompt = null;

    if (window.CategoryUIManager) {
      const categoryUIManager = new CategoryUIManager();

      const jpResult = categoryUIManager.findByJapaneseSmallCategory(promptValue);

      if (jpResult) {
        category = jpResult.data;
        englishPrompt = jpResult.prompt;
      } else {
        category = categoryUIManager.findCategoryByPrompt(promptValue);
      }
    }

    if (category) {
      // 日本語入力で見つかった場合、プロンプトを英語に置き換え
      if (englishPrompt) {
        element.Value = englishPrompt;

        // スロットの要素も更新
        const currentSlot = SlotUtils.getCurrentSlot();
        const slotElement = currentSlot?.elements?.find((el) => el.id === elementId);
        if (slotElement) {
          slotElement.Value = englishPrompt;
        }

        // DOM上のプロンプトフィールドも更新
        if (window.app?.listManager) {
          window.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            elementId,
            { prompt: englishPrompt },
            { preserveFocus: true, preventEvents: true, searchMode: "id" }
          );
        }

        await SlotUtils.regenerateAndSaveSlot();
      }

      if (elementId !== undefined && window.categoryDataSync) {
        await window.categoryDataSync.syncAllSources(elementId, category, {
          caller: "edit-handler-category-found",
        });
      } else {
        element.data = category;
      }

      const currentData = window.categoryDataSync?.getCurrentDOMValues(elementId);
      if (currentData && currentData[0] === "翻訳完了") {
        if (window.editElementManager && elementId !== undefined) {
          await window.editElementManager.updateCategoryOnly(elementId, category);
        }
      }
    } else {
      const prompt = promptValue.toLowerCase().trim();

      if (!Validators.Quick.isValidCategoryPromptPair(null, prompt)) {
        return;
      }

      if (this.translationCache.has(prompt)) {
        const cachedResult = this.translationCache.get(prompt);
        const isAlphanumeric = !/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(prompt);
        if (isAlphanumeric) {
          element.data = [TRANSLATION_STATES.COMPLETED, TRANSLATION_STATES.SOURCES.GOOGLE, cachedResult];
        } else {
          element.Value = cachedResult;
          element.data = [TRANSLATION_STATES.COMPLETED, TRANSLATION_STATES.SOURCES.GOOGLE, prompt];
        }

        const cachedElementId = element.id;
        if (cachedElementId !== undefined && window.editElementManager) {
          window.editElementManager.updateCategoryOnly(cachedElementId, element.data);
        }
      } else if (!this.translatingItems.has(prompt)) {
        const isTyping = isInitialization ? false : this.isUserCurrentlyTyping();

        if (!isTyping) {
          const elements = SlotUtils.getSortedElements();
          const currentSlot = SlotUtils.getCurrentSlot();
          if (elements.length > 0 && currentSlot) {
            elements.forEach((el) => {
              const elPromptValue = (el.Value || "").toLowerCase().trim();
              if (elPromptValue === prompt) {
                const slotElement = currentSlot.elements?.find((sEl) => sEl.id === el.id);
                if (slotElement) {
                  slotElement.data = [...TRANSLATION_STATES.IN_PROGRESS];
                }
                if (!isInitialization && window.editElementManager && el.id !== undefined) {
                  window.editElementManager.setTranslationStartState(el.id);
                }
              }
            });
          }
          this.translateElementAsync(element, prompt, null);
        }
      } else {
        element.data = [...TRANSLATION_STATES.IN_PROGRESS];

        if (!isInitialization && window.editElementManager && element.id !== undefined) {
          window.editElementManager.setTranslationStartState(element.id);
        }
      }
    }
  }

  async translateElementAsync(element, prompt, onComplete = null, elementIndex = null) {
    if (this.translatingItems.has(prompt)) {
      return;
    }

    element.data = [...TRANSLATION_STATES.IN_PROGRESS];
    this.translatingItems.add(prompt);

    try {
      const hasDeeplKey = AppState.userSettings.optionData?.deeplAuth || AppState.userSettings.optionData?.deeplAuthKey;
      const translateFunc = hasDeeplKey ? translateDeepl : translateGoogle;

      await translateFunc(prompt, (translationResult) => {
        if (translationResult && Array.isArray(translationResult) && translationResult.length > 0) {
          const translatedText = translationResult[0];
          this.translatingItems.delete(prompt);
          this.translationCache.set(prompt, translatedText);

          const matchingElements = [];
          const elements = SlotUtils.getSortedElements();
          const currentSlot = SlotUtils.getCurrentSlot();
          if (elements.length > 0) {
            elements.forEach((el, index) => {
              const elPromptValue = (el.Value || "").toLowerCase().trim();
              if (elPromptValue === prompt && el.data && el.data[0] === "翻訳中") {
                matchingElements.push({ element: el, index: index });
              }
            });
          }

          if (matchingElements.length > 0 && window.editElementManager) {
            const isAlphanumeric = !/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(prompt);
            const translationResultData = {
              isAlphanumeric,
              translatedText,
              originalPrompt: prompt,
            };

            matchingElements.forEach(({ element: currentElement, index }, idx) => {
              const currentElementId = currentElement.id;

              if (onComplete && idx === 0) {
                setTimeout(() => {
                  onComplete(currentElement);
                }, UI_DELAYS.TRANSLATION_CALLBACK);
              } else {
                setTimeout(
                  async () => {
                    try {
                      if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
                        await window.editElementManager.setTranslationCompleteState(
                          currentElementId,
                          translationResultData
                        );
                      }
                    } catch (error) {}
                  },
                  UI_DELAYS.TRANSLATION_CALLBACK + idx * 50
                );
              }
            });
          }
        } else {
          this.translatingItems.delete(prompt);
          if (element.data && element.data[0] === "翻訳中") {
            element.data = ["翻訳失敗", "エラー", ""];

            // スロットの要素を直接更新
            const currentSlot = SlotUtils.getCurrentSlot();
            const slotElement = currentSlot?.elements?.find((el) => el.id === element.id);
            if (slotElement) {
              slotElement.data = element.data;
            }

            if (onComplete) {
              setTimeout(() => {
                onComplete(element);
              }, UI_DELAYS.TRANSLATION_CALLBACK);
            }
          }
        }
      });
    } catch (error) {
      this.translatingItems.delete(prompt);
      if (element.data && element.data[0] === "翻訳中") {
        element.data = ["翻訳エラー", "システムエラー", ""];

        // スロットの要素を直接更新
        const currentSlot = SlotUtils.getCurrentSlot();
        const slotElement = currentSlot?.elements?.find((el) => el.id === element.id);
        if (slotElement) {
          slotElement.data = element.data;
        }

        if (onComplete) {
          setTimeout(() => {
            onComplete(element);
          }, UI_DELAYS.TRANSLATION_CALLBACK);
        }
      }
    }
  }

  isUserCurrentlyTyping() {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      activeElement.tagName === "INPUT" &&
      activeElement.type === "text" &&
      activeElement.classList.contains("prompt-list-input")
    ) {
      return true;
    }
    return false;
  }
}

if (typeof window !== "undefined") {
  window.EditHandler = EditHandler;
}
