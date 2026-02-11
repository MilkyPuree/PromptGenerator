class EditElementManager {
  constructor(app) {
    this.app = app;
    this.pendingUpdates = new Map(); // 遅延更新の管理
    this.updateQueue = new Set(); // 更新キューの重複防止
  }

  /**
   * 現在のスロットを取得
   */
  getCurrentSlot() {
    return window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot] || null;
  }

  /**
   * スロットのelementsをソートして取得
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
    await window.promptSlotManager?.saveToStorage();
  }

  async updateElement(elementId, updates, options = {}) {
    const config = {
      preserveFocus: true,
      updateFieldStates: true,
      updatePromptDisplay: true,
      delay: 0,
      ...options,
    };

    try {
      if (config.delay > 0) {
        return this.scheduleDelayedUpdate(elementId, updates, config);
      }

      return await this.executeUpdate(elementId, updates, config);
    } catch (error) {
      return false;
    }
  }

  async executeUpdate(elementId, updates, config) {
    const elementIndex = this.updateDataLayer(elementId, updates);
    if (elementIndex === -1) {
      return false;
    }

    const domSuccess = this.updateDOMLayer(elementId, updates, config);
    if (!domSuccess) {
      return false;
    }

    if (config.updatePromptDisplay && updates.prompt !== undefined) {
      this.updatePromptDisplay();
    }

    if (config.updateFieldStates) {
      this.scheduleFieldStateUpdate();
    }

    return true;
  }

  updateDataLayer(elementId, updates) {
    const currentSlot = this.getCurrentSlot();
    if (!currentSlot || !currentSlot.elements) {
      return -1;
    }

    const element = currentSlot.elements.find((el) => el.id === elementId);
    if (!element) {
      return -1;
    }

    const elementIndex = currentSlot.elements.indexOf(element);

    if (updates.data) {
      element.data = [updates.data[0] || "", updates.data[1] || "", updates.data[2] || ""];
    }

    if (updates.prompt !== undefined) {
      element.Value = updates.prompt;
      element.value = updates.prompt; // 小文字のvalueも更新
      element.prompt = updates.prompt; // promptプロパティも更新
    }

    if (updates.weight !== undefined) {
      const shaping = AppState.userSettings?.optionData?.shaping || "None";
      if (!element[shaping]) {
        element[shaping] = { weight: 0 };
      }
      element[shaping].weight = updates.weight;
    }

    return elementIndex;
  }

  updateDOMLayer(elementId, updates, config) {
    if (!this.app.listManager) {
      return false;
    }

    const domUpdates = {};

    if (updates.data) {
      domUpdates["data.0"] = updates.data[0] || "";
      domUpdates["data.1"] = updates.data[1] || "";
      domUpdates["data.2"] = updates.data[2] || "";
    }

    if (updates.prompt !== undefined) {
      domUpdates.prompt = updates.prompt;
    }

    if (updates.weight !== undefined) {
      domUpdates.weight = updates.weight;
    }

    if (!this.isDOMElementReady(elementId)) {
      return false;
    }

    try {
      return this.app.listManager.updateSingleElement(DOM_SELECTORS.BY_ID.EDIT_LIST, elementId, domUpdates, {
        preserveFocus: config.preserveFocus,
        preventEvents: true,
        searchMode: "id",
      });
    } catch (error) {
      setTimeout(() => {
        try {
          this.app.listManager.updateSingleElement(DOM_SELECTORS.BY_ID.EDIT_LIST, elementId, domUpdates, {
            preserveFocus: config.preserveFocus,
            preventEvents: true,
            searchMode: "id",
          });
        } catch (retryError) {}
      }, 100);

      return false;
    }
  }

  updatePromptDisplay() {
    if (window.app && window.app.updatePromptDisplay) {
      window.app.updatePromptDisplay();
    }
  }

  scheduleFieldStateUpdate(delay = 50) {
    if (this.updateQueue.has("fieldStates")) {
      return;
    }

    this.updateQueue.add("fieldStates");

    setTimeout(() => {
      try {
        if (this.app && this.app.listManager) {
          this.app.listManager.updateAllElementsReadonlyState(DOM_SELECTORS.BY_ID.EDIT_LIST);
        }
      } catch (error) {}
      this.updateQueue.delete("fieldStates");
    }, delay);
  }

  setTranslationStartFieldStates(elementId, delay = 50, retryCount = 0) {
    const queueKey = `translationStart-${elementId}`;
    if (this.updateQueue.has(queueKey) && retryCount === 0) {
      return;
    }

    if (retryCount === 0) {
      this.updateQueue.add(queueKey);
    }

    setTimeout(() => {
      try {
        const listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (listContainer) {
          // data-element-idまたはdata-original-idで検索
          let elementContainer = listContainer.querySelector(`[data-element-id="${elementId}"]`);
          if (!elementContainer) {
            elementContainer = listContainer.querySelector(`[data-original-id="${elementId}"]`);
          }
          if (elementContainer) {
            const categoryFields = elementContainer.querySelectorAll('input[data-field^="data."]');
            categoryFields.forEach((field) => {
              field.setAttribute("readonly", "true");
              field.disabled = true;
              field.classList.add("readonly-field");
              field.title = "翻訳中のため編集できません";
            });

            const regButton = elementContainer.querySelector('button[data-action="register"]');
            if (regButton) {
              regButton.disabled = true;
              regButton.classList.add("button-disabled");
              regButton.title = "翻訳中のため登録できません";
            }
            this.updateQueue.delete(queueKey);
          } else if (retryCount < 3) {
            // DOM要素が見つからない場合、再試行（最大3回）
            this.setTranslationStartFieldStates(elementId, 100, retryCount + 1);
            return;
          } else {
            this.updateQueue.delete(queueKey);
          }
        } else if (retryCount < 3) {
          // リストコンテナが見つからない場合も再試行
          this.setTranslationStartFieldStates(elementId, 100, retryCount + 1);
          return;
        } else {
          this.updateQueue.delete(queueKey);
        }
      } catch (error) {
        this.updateQueue.delete(queueKey);
      }
    }, delay);
  }

  updateSingleElementFieldStates(elementId, delay = 50) {
    const queueKey = `fieldStates-${elementId}`;
    if (this.updateQueue.has(queueKey)) {
      return;
    }

    this.updateQueue.add(queueKey);

    setTimeout(() => {
      try {
        const listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (listContainer) {
          // data-element-idまたはdata-original-idで検索
          let elementContainer = listContainer.querySelector(`[data-element-id="${elementId}"]`);
          if (!elementContainer) {
            elementContainer = listContainer.querySelector(`[data-original-id="${elementId}"]`);
          }
          if (elementContainer) {
            const categoryFields = elementContainer.querySelectorAll('input[data-field^="data."]');
            categoryFields.forEach((field) => {
              field.removeAttribute("readonly");
              field.disabled = false;
              field.classList.remove("readonly-field");

              if (field.title && field.title.includes("翻訳中")) {
                field.title = field.title.replace("翻訳中", "翻訳完了");
              }
            });

            const regButton = elementContainer.querySelector('button[data-action="register"]');
            if (regButton) {
              const promptField = elementContainer.querySelector(
                'input[data-field="prompt"], textarea[data-field="prompt"]'
              );
              const promptValue = promptField ? promptField.value : "";

              if (promptValue && typeof isPromptInDictionary === "function") {
                const existsInDictionary = isPromptInDictionary(promptValue);
                regButton.disabled = existsInDictionary;
                regButton.classList.toggle("button-disabled", existsInDictionary);
                regButton.title = existsInDictionary ? "既に登録済みのため登録できません" : "ローカル辞書に登録";
              } else {
                regButton.disabled = false;
                regButton.classList.remove("button-disabled");
                regButton.title = "ローカル辞書に登録";
              }
            }
          }
        }
      } catch (error) {}

      this.updateQueue.delete(queueKey);
    }, delay);
  }

  updateSingleElementRegisterButton(elementId, delay = 50) {
    const queueKey = `regButton-${elementId}`;
    if (this.updateQueue.has(queueKey)) {
      return;
    }

    this.updateQueue.add(queueKey);

    setTimeout(() => {
      try {
        const currentSlot = this.getCurrentSlot();
        if (!currentSlot || !currentSlot.elements) {
          return;
        }

        const element = currentSlot.elements.find((el) => el.id === elementId);
        if (!element) {
          return;
        }

        const elementIndex = currentSlot.elements.indexOf(element);
        const promptValue = element.Value || element.prompt || "";

        const listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (listContainer) {
          // data-element-idまたはdata-original-idで検索
          let elementContainer = listContainer.querySelector(`[data-element-id="${elementId}"]`);
          if (!elementContainer) {
            elementContainer = listContainer.querySelector(`[data-original-id="${elementId}"]`);
          }
          if (elementContainer) {
            const regButton = elementContainer.querySelector('button[data-action="register"]');
            if (regButton) {
              if (element.data && element.data[0] === "翻訳中") {
                regButton.disabled = true;
                regButton.title = "翻訳中のため登録できません";
              } else {
                const promptField = elementContainer.querySelector(
                  'input[data-field="prompt"], textarea[data-field="prompt"]'
                );
                const domPromptValue = promptField ? promptField.value : "";

                const existsInDictionary = isPromptInDictionary(promptValue);

                if (domPromptValue && domPromptValue !== promptValue) {
                  const domExistsInDictionary = isPromptInDictionary(domPromptValue);
                  const finalExists = domExistsInDictionary;

                  regButton.disabled = finalExists;
                  if (finalExists) {
                    regButton.title = "既に登録済みのため登録できません";
                    regButton.classList.add("button-disabled");
                  } else {
                    regButton.title = "ローカル辞書に登録";
                    regButton.classList.remove("button-disabled");
                  }
                  return;
                }

                regButton.disabled = existsInDictionary;
                if (existsInDictionary) {
                  regButton.title = "既に登録済みのため登録できません";
                  regButton.classList.add("button-disabled");
                  regButton.setAttribute("disabled", "true");
                } else {
                  regButton.title = "ローカル辞書に登録";
                  regButton.classList.remove("button-disabled");
                  regButton.removeAttribute("disabled");
                  regButton.disabled = false;

                  const newButton = regButton.cloneNode(true);
                  regButton.parentNode.replaceChild(newButton, regButton);

                  newButton.addEventListener("click", (event) => {
                    if (newButton.disabled) {
                      event.preventDefault();
                      event.stopPropagation();
                      return false;
                    }

                    if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.handleRegisterClick) {
                      this.app.tabs.edit.handleRegisterClick(promptValue, element, elementIndex);
                    }
                  });
                }
              }
            } else {
              if (this.app && this.app.listManager && this.app.listManager.updateRegisterButtonState) {
                this.app.listManager.updateRegisterButtonState(DOM_SELECTORS.BY_ID.EDIT_LIST, elementId);
              }
            }
          }
        }
      } catch (error) {}

      this.updateQueue.delete(queueKey);
    }, delay);
  }

  scheduleDelayedUpdate(elementId, updates, config) {
    if (this.pendingUpdates.has(elementId)) {
      clearTimeout(this.pendingUpdates.get(elementId));
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(async () => {
        this.pendingUpdates.delete(elementId);
        const result = await this.executeUpdate(elementId, updates, {
          ...config,
          delay: 0, // 遅延実行時は即座実行
        });
        resolve(result);
      }, config.delay);

      this.pendingUpdates.set(elementId, timeoutId);
    });
  }

  async updateCategoryOnly(elementId, categoryData, options = {}) {
    return this.updateElement(
      elementId,
      { data: categoryData },
      {
        updatePromptDisplay: false, // プロンプト表示は更新しない
        updateFieldStates: false, // スクロール位置保持のため無効化
        ...options,
      }
    );
  }

  async updatePromptOnly(elementId, promptValue, options = {}) {
    return this.updateElement(
      elementId,
      { prompt: promptValue },
      {
        updateFieldStates: false, // スクロール位置保持のため無効化
        ...options,
      }
    );
  }

  async setTranslationStartState(elementId, options = {}) {
    const result = await this.updateElement(
      elementId,
      {
        data: ["翻訳中", "翻訳中", "翻訳中"],
      },
      {
        updateFieldStates: false, // DOM更新のみ、フィールド状態は直接操作
        delay: 0,
        ...options,
      }
    );

    this.setTranslationStartFieldStates(elementId);

    return result;
  }

  async setTranslationCompleteState(elementId, translationResult, options = {}) {
    const { isAlphanumeric, translatedText, originalPrompt } = translationResult;

    const result = isAlphanumeric
      ? await this.updateElement(
          elementId,
          {
            data: ["翻訳完了", "Google翻訳", translatedText],
          },
          {
            updatePromptDisplay: false, // プロンプトは変更しない
            updateFieldStates: false, // フィールド状態更新をスキップ（スクロール位置保持）
            ...options,
          }
        )
      : await this.updateElement(
          elementId,
          {
            data: ["翻訳完了", "Google翻訳", originalPrompt],
            prompt: translatedText,
          },
          {
            updateFieldStates: false, // フィールド状態更新をスキップ（スクロール位置保持）
            ...options,
          }
        );

    this.updateSingleElementFieldStates(elementId, 100);

    // 翻訳完了後にRegボタンの状態を更新（全体リフレッシュ後に実行するため遅延）
    this.updateSingleElementRegisterButton(elementId, 500);

    // 翻訳でプロンプトが変わった場合はスロットを再生成
    if (!isAlphanumeric && this.app?.tabs?.edit?.isActive) {
      await this.regenerateAndSaveSlot();
    }

    return result;
  }

  async addElement(position = "bottom", value = "", options = {}) {
    try {
      const currentSlot = this.getCurrentSlot();
      if (!currentSlot) {
        throw new Error("現在のスロットが見つかりません");
      }

      if (!currentSlot.elements) {
        currentSlot.elements = [];
      }

      const wasEmpty = currentSlot.elements.length === 0;

      const editListContainer = document.querySelector("#editList");
      if (editListContainer) {
        const emptyStateMessage = editListContainer.querySelector(".empty-state-message");
        if (emptyStateMessage) {
          emptyStateMessage.remove();
        }
      }

      // 新しい要素を作成
      const newElement = {
        id: Date.now() + Math.random(),
        sort: position === "top" ? -1 : currentSlot.elements.length,
        Value: value,
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
        if (el) el.sort = idx;
      });

      await this.regenerateAndSaveSlot();

      if (window.app && window.app.updatePromptDisplay) {
        window.app.updatePromptDisplay();
      }

      if (wasEmpty) {
        if (this.app && this.app.tabs && this.app.tabs.edit) {
          await this.app.tabs.edit.refreshEditList();
        }
      } else {
        if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
          await this.addElementToDOM(newElement.id, position);
        }
      }

      return newElement.id;
    } catch (error) {
      throw error;
    }
  }

  async addElementToDOM(elementId, position) {
    try {
      const ulElement = document.querySelector("#editList-list");
      let listContainer = null;

      if (!ulElement) {
        listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (!listContainer) {
          return;
        }
      } else {
        listContainer = ulElement;
      }

      const currentSlot = this.getCurrentSlot();
      if (!currentSlot || !currentSlot.elements) {
        return;
      }

      const element = currentSlot.elements.find((el) => el.id === elementId);
      if (!element) {
        return;
      }

      const elementIndex = currentSlot.elements.indexOf(element);
      const elementData = element;

      const editTab = this.app?.tabs?.edit;
      if (!editTab) {
        return;
      }

      const editTabConfig = {
        fields: editTab.getEditFieldsConfig(),
        buttons: editTab.getEditButtonsConfig(),
        sortable: true,
        listType: "edit",
        weightDelta: editTab.getWeightConfig().delta,
        weightMin: editTab.getWeightConfig().min,
        weightMax: editTab.getWeightConfig().max,
        dropdownCount: 3,
        categoryChainBehavior: {
          focusNext: true,
          openDropdownOnFocus: true,
          focusPromptAfterSmall: true,
        },
        onFieldChange: editTab.handleUnifiedFieldChange?.bind(editTab),
        onSmallCategoryChange: editTab.handleSmallCategoryChangeForPrompt?.bind(editTab),
        onDelete: editTab.handleEditDelete?.bind(editTab),
        onSort: editTab.handleEditSort?.bind(editTab),
        onRegistration: editTab.handleRegistration?.bind(editTab),
      };

      const $li = UIFactory.createListItem({
        id: elementId,
        sortable: true,
      });

      // DOM要素の必要な属性を設定
      $li.setAttribute("id", elementId);
      $li.setAttribute("data-element-id", elementId);
      $li.setAttribute("data-id", elementIndex);

      if (this.app.listManager && this.app.listManager.createFlexibleItem) {
        await this.app.listManager.createFlexibleItem($li, elementData, elementIndex, editTabConfig);

        if (!$li.id || $li.id === "") {
          $li.setAttribute("id", elementId);
        }
      }

      const targetElement = listContainer;
      if (position === "top") {
        const firstDataLiElement = targetElement.querySelector("li:not(.prompt-list-header)");
        if (firstDataLiElement) {
          targetElement.insertBefore($li, firstDataLiElement);
        } else {
          const headerElement = targetElement.querySelector("li.prompt-list-header");
          if (headerElement && headerElement.nextSibling) {
            targetElement.insertBefore($li, headerElement.nextSibling);
          } else {
            targetElement.appendChild($li);
          }
        }
      } else {
        targetElement.appendChild($li);
      }

      setTimeout(() => {
        try {
          const addedElement = document.querySelector(`[data-element-id="${elementId}"]`);
          if (addedElement) {
            const regButton = addedElement.querySelector('button[data-action="register"]');
            if (regButton) {
              regButton.disabled = true;
              regButton.classList.add("button-disabled");
              regButton.title = "プロンプトを入力してください";
            }
          }
        } catch (error) {}
      }, 10);

      setTimeout(async () => {
        try {
          const currentSlot = this.getCurrentSlot();
          if (currentSlot && currentSlot.elements) {
            const updatedElement = currentSlot.elements.find((el) => el.id === elementId);
            if (updatedElement) {
              const updatedElementIndex = currentSlot.elements.indexOf(updatedElement);
              const domElement = document.querySelector(`[data-element-id="${elementId}"]`);
              if (domElement) {
                domElement.setAttribute("id", elementId);
                domElement.setAttribute("data-id", updatedElementIndex);
                domElement.setAttribute("data-element-id", elementId);
              }
            }
          }

          setTimeout(() => {
            this.focusOnAddedElement(elementId);
          }, 10);
        } catch (error) {}
      }, 50);
    } catch (error) {}
  }

  async removeElement(elementId, options = {}) {
    try {
      const currentSlot = this.getCurrentSlot();
      if (!currentSlot || !currentSlot.elements) {
        return false;
      }

      const elementIndex = currentSlot.elements.findIndex((el) => el.id === elementId);
      if (elementIndex === -1) {
        return false;
      }

      if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
        await this.removeElementFromDOM(elementId);
      }

      // 要素を削除
      currentSlot.elements.splice(elementIndex, 1);

      // sort値を再計算
      currentSlot.elements.forEach((el, idx) => {
        if (el) el.sort = idx;
      });

      await this.regenerateAndSaveSlot();

      if (window.app && window.app.updatePromptDisplay) {
        window.app.updatePromptDisplay();
      }

      if (currentSlot.elements.length === 0) {
        if (window.app && window.app.listManager) {
          window.app.listManager.createEmptyState("#editList", "edit");
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async removeElementFromDOM(elementId) {
    try {
      const ulElement = document.querySelector("#editList-list");
      if (!ulElement) {
        return;
      }

      const targetElement = ulElement.querySelector(`[data-element-id="${elementId}"]`);
      if (!targetElement) {
        return;
      }

      targetElement.remove();
    } catch (error) {}
  }

  focusOnAddedElement(elementId) {
    try {
      const editList = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
      if (editList) {
        const targetElement = editList.querySelector(`[data-element-id="${elementId}"] .prompt-list-input`);
        if (targetElement) {
          targetElement.focus();
        }
      }
    } catch (error) {}
  }

  cancelAllPendingUpdates() {
    for (const timeoutId of this.pendingUpdates.values()) {
      clearTimeout(timeoutId);
    }
    this.pendingUpdates.clear();
    this.updateQueue.clear();
  }

  isDOMElementReady(elementId) {
    const editList = document.querySelector("#editList-list");
    if (!editList) {
      return false;
    }

    const elementByElementId = editList.querySelector(`[data-element-id="${elementId}"]`);
    const elementByDataId = editList.querySelector(`[data-id="${elementId}"]`);
    // data-original-idでも検索（スロット要素のIDとの対応）
    const elementByOriginalId = editList.querySelector(`[data-original-id="${elementId}"]`);

    return !!(elementByElementId || elementByDataId || elementByOriginalId);
  }
}

window.EditElementManager = EditElementManager;
