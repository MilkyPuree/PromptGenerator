class CategoryUIManager {
  constructor() {
    this.chainConfigs = {
      search: {
        chainLevel: 2,
        bigSelector: DOM_SELECTORS.BY_ID.SEARCH_CAT0,
        middleSelector: DOM_SELECTORS.BY_ID.SEARCH_CAT1,
        smallSelector: null, // 入力フィールドなので未使用
        inputFields: {
          big: DOM_SELECTORS.BY_ID.BIG,
          middle: DOM_SELECTORS.BY_ID.MIDDLE,
          small: DOM_SELECTORS.BY_ID.SMALL,
        },
        resetSmallOnMiddleChange: false,
        autoSearch: true, // カテゴリー変更時に自動検索
        autoOpenMiddleDropdown: true, // 大項目選択後に中項目ドロップダウンを自動で開く
      },

      edit: {
        chainLevel: 3,
        bigSelector: null, // FlexibleListで動的生成
        middleSelector: null, // FlexibleListで動的生成
        smallSelector: null, // FlexibleListで動的生成
        resetSmallOnMiddleChange: true,
        autoSearch: false,
        enableSmallDropdown: true, // 小項目ドロップダウンを有効化
      },

      dictionary: {
        chainLevel: 2,
        bigSelector: null,
        middleSelector: null,
        smallSelector: null,
        inputFields: {
          big: DOM_SELECTORS.BY_ID.BIG,
          middle: DOM_SELECTORS.BY_ID.MIDDLE,
          small: DOM_SELECTORS.BY_ID.SMALL,
        },
        resetSmallOnMiddleChange: false,
        autoSearch: false,
      },
    };
  }

  initializeCategoryChain(configName, options = {}) {
    const config = { ...this.chainConfigs[configName], ...options };

    if (!config) {
      return;
    }

    switch (configName) {
      case "search":
        this.initializeSearchCategoryChain(config);
        break;
      case "edit":
        this.initializeEditCategoryChain(config);
        break;
      case "dictionary":
        this.initializeDictionaryCategoryChain(config);
        break;
      default:
        break;
    }
  }

  initializeSearchCategoryChain(config) {
    this.populateDropdown(config.bigSelector, 0);

    const middleSelect = document.querySelector(config.middleSelector);
    if (middleSelect) {
      middleSelect.disabled = true;
    }

    const bigSelect = document.querySelector(config.bigSelector);
    if (bigSelect) {
      // 既存のイベントリスナーをクリア（重複回避）
      bigSelect.replaceWith(bigSelect.cloneNode(true));
      const newBigSelect = document.querySelector(config.bigSelector);

      newBigSelect.addEventListener("change", (e) => {
        this.handleBigCategoryChange(e.target.value, config);
      });
    }

    const newMiddleSelect = document.querySelector(config.middleSelector);
    if (newMiddleSelect) {
      // 既存のイベントリスナーをクリア（重複回避）
      newMiddleSelect.replaceWith(newMiddleSelect.cloneNode(true));
      const finalMiddleSelect = document.querySelector(config.middleSelector);

      finalMiddleSelect.addEventListener("change", (e) => {
        this.handleMiddleCategoryChange(e.target.value, config);
      });
    }

    if (config.inputFields) {
      this.setupInputFieldsChain(config.inputFields);
    }
  }

  initializeEditCategoryChain(config) {
    // 編集タブのカテゴリーチェーンはFlexibleListで管理されるため
  }

  initializeDictionaryCategoryChain(config) {
    if (config.inputFields) {
      this.setupInputFieldsChain(config.inputFields);
    }
  }

  populateDropdown(selector, level, parentValue = null) {
    const selectElement = document.querySelector(selector);
    if (!selectElement) {
      return;
    }

    const currentValue = selectElement.value;

    selectElement.innerHTML = "";

    const emptyOption = UIFactory.createOption({
      value: "",
      text: "",
    });
    selectElement.appendChild(emptyOption);

    const categories = this.getCategoriesByLevel(level, parentValue);

    const fragment = document.createDocumentFragment();

    categories.forEach((categoryValue) => {
      const option = UIFactory.createOption({
        value: categoryValue,
        text: categoryValue,
      });
      fragment.appendChild(option);
    });

    selectElement.appendChild(fragment);
    selectElement.disabled = false;

    if (currentValue && categories.includes(currentValue)) {
      selectElement.value = currentValue;
    }
  }

  handleBigCategoryChange(value, config) {
    if (config === this.chainConfigs.search) {
      AppState.data.searchCategory[0] = value;
      AppState.data.searchCategory[1] = ""; // 中項目をリセット
      saveCategory();
    }

    if (config.middleSelector) {
      this.populateDropdown(config.middleSelector, 1, value);

      if (value && config.autoOpenMiddleDropdown) {
        // 値が選択されており、自動開く設定が有効な場合のみ
        setTimeout(() => {
          const middleSelect = document.querySelector(config.middleSelector);
          if (middleSelect && !middleSelect.disabled && middleSelect.options.length > 1) {
            // 選択肢が2個以上ある場合のみ（空のオプション + 実際のオプション）
            try {
              middleSelect.focus();

              middleSelect.click();

              const mousedownEvent = new MouseEvent("mousedown", {
                bubbles: true,
                cancelable: true,
                view: window,
              });
              middleSelect.dispatchEvent(mousedownEvent);

              if (typeof middleSelect.showPicker === "function") {
                middleSelect.showPicker();
              }
            } catch (error) {}
          }
        }, 100); // 100ms遅延でドロップダウン更新の完了を待つ
      }
    }

    // 小項目をリセット（必要に応じて）
    if (config.resetSmallOnMiddleChange && config.smallSelector) {
      const smallSelect = document.querySelector(config.smallSelector);
      if (smallSelect) {
        smallSelect.innerHTML = '<option value=""></option>';
        smallSelect.disabled = true;
      }
    }

    if (config.autoSearch) {
      this.triggerAutoSearch(config);
    }
  }

  handleMiddleCategoryChange(value, config) {
    const bigValue = config.bigSelector ? document.querySelector(config.bigSelector)?.value : "";

    if (config === this.chainConfigs.search) {
      AppState.data.searchCategory[1] = value;
      saveCategory();
    }

    if (config.chainLevel === 3 && config.smallSelector) {
      const parentKey = (bigValue || "").replace(/[!\/]/g, "") + (value || "").replace(/[!\/]/g, "");
      this.populateDropdown(config.smallSelector, 2, parentKey);
    }

    if (config.autoSearch) {
      this.triggerAutoSearch(config);
    }
  }

  handleSmallCategoryChange(value, config, onSmallChange = null) {
    if (onSmallChange && typeof onSmallChange === "function") {
      const bigValue = config.bigSelector ? document.querySelector(config.bigSelector)?.value : "";
      const middleValue = config.middleSelector ? document.querySelector(config.middleSelector)?.value : "";

      onSmallChange(value, bigValue, middleValue);
    }
  }

  setupInputFieldsChain(inputFields) {
    const bigInput = document.querySelector(inputFields.big);
    const middleInput = document.querySelector(inputFields.middle);
    const smallInput = document.querySelector(inputFields.small);

    if (bigInput && middleInput) {
      if (window.EventHandlers && typeof EventHandlers.setupCategoryChain === "function") {
        EventHandlers.setupCategoryChain([bigInput, middleInput, smallInput]);
      }
    }
  }

  getCategoriesByLevel(level, parentValue = null) {
    if (!window.categoryData || !categoryData.data) {
      return [];
    }

    return categoryData.getCategoriesByParent(level, parentValue);
  }

  populateSelectElement(selectElement, level, parentValue = null, emptyText = "すべて") {
    if (!selectElement) return;

    selectElement.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyText;
    selectElement.appendChild(emptyOption);

    const categories = this.getCategoriesByLevel(level, parentValue);
    const fragment = document.createDocumentFragment();

    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      fragment.appendChild(option);
    });

    selectElement.appendChild(fragment);
  }

  triggerAutoSearch(config) {
    if (config.autoSearch && window.app && window.app.searchHandler) {
      const searchDelay = config.autoOpenMiddleDropdown && config.middleSelector ? 200 : 50;

      setTimeout(() => {
        window.app.searchHandler.performSearch({ showLoading: false });
      }, searchDelay);
    }
  }

  getCategoryValues(configName) {
    const config = this.chainConfigs[configName];
    if (!config) return { big: "", middle: "", small: "" };

    const result = { big: "", middle: "", small: "" };

    if (config.bigSelector) {
      const bigElement = document.querySelector(config.bigSelector);
      result.big = bigElement ? bigElement.value : "";
    }

    if (config.middleSelector) {
      const middleElement = document.querySelector(config.middleSelector);
      result.middle = middleElement ? middleElement.value : "";
    }

    if (config.smallSelector) {
      const smallElement = document.querySelector(config.smallSelector);
      result.small = smallElement ? smallElement.value : "";
    }

    return result;
  }

  setCategoryValues(configName, values) {
    const config = this.chainConfigs[configName];
    if (!config) return;

    if (config.bigSelector && values.big) {
      const bigElement = document.querySelector(config.bigSelector);
      if (bigElement) {
        bigElement.value = values.big;
        this.handleBigCategoryChange(values.big, config);
      }
    }

    if (config.middleSelector && values.middle) {
      setTimeout(() => {
        const middleElement = document.querySelector(config.middleSelector);
        if (middleElement) {
          middleElement.value = values.middle;
          this.handleMiddleCategoryChange(values.middle, config);
        }
      }, 50);
    }

    if (config.smallSelector && values.small) {
      setTimeout(() => {
        const smallElement = document.querySelector(config.smallSelector);
        if (smallElement) {
          smallElement.value = values.small;
        }
      }, 100);
    }
  }

  resetCategoryChain(configName) {
    const config = this.chainConfigs[configName];
    if (!config) return;

    [config.bigSelector, config.middleSelector, config.smallSelector].forEach((selector) => {
      if (selector) {
        const element = document.querySelector(selector);
        if (element) {
          element.value = "";
          if (element !== document.querySelector(config.bigSelector)) {
            element.disabled = true;
          }
        }
      }
    });

    if (config.inputFields) {
      Object.values(config.inputFields).forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.value = "";
        }
      });
    }

    if (config.autoSearch) {
      this.triggerAutoSearch(config);
    }
  }

  createThreeLevelCallbacks(onBigChange, onMiddleChange, onSmallChange) {
    return {
      onBigCategoryChange: (value, item) => {
        if (onBigChange) onBigChange(value, item);
      },

      onMiddleCategoryChange: (value, bigValue, item) => {
        if (onMiddleChange) onMiddleChange(value, bigValue, item);
      },

      onSmallCategoryChange: (value, bigValue, middleValue, item) => {
        if (onSmallChange) onSmallChange(value, bigValue, middleValue, item);
      },
    };
  }

  findPromptByCategory(big, middle, small) {
    if (!big || !middle || !small) {
      return null;
    }

    const localResult = AppState.data.localPromptList.find(
      (item) => item.data[0] === big && item.data[1] === middle && item.data[2] === small
    );

    if (localResult) {
      return localResult.prompt;
    }

    const masterData = getMasterPrompts();
    const masterResult = masterData.find(
      (item) => item.data[0] === big && item.data[1] === middle && item.data[2] === small
    );

    return masterResult?.prompt || null;
  }

  findCategoryByPrompt(promptValue) {
    if (!promptValue || !promptValue.trim()) {
      return null;
    }

    if (typeof promptValue !== "string") {
      return null;
    }

    const trimmedPrompt = promptValue.trim().toLowerCase();

    const findCategory = (dataList) => {
      const found = dataList.find((dicData) => {
        if (!dicData || !dicData.prompt || typeof dicData.prompt !== "string") {
          return false;
        }
        const normalizedPrompt = dicData.prompt.toLowerCase().trim();
        return normalizedPrompt === trimmedPrompt;
      });
      return found?.data || null;
    };

    const localResult = findCategory(AppState.data.localPromptList || []);
    const masterResult = localResult || findCategory(getMasterPrompts() || []);

    // 英語プロンプトで見つからない場合、日本語の小項目（data[2]）で検索
    if (!masterResult) {
      const jpResult = this.findByJapaneseSmallCategory(promptValue);
      if (jpResult) {
        return jpResult.data;
      }
    }

    return masterResult;
  }

  /**
   * 日本語の小項目（data[2]）で検索し、見つかった場合は対応する英語プロンプトとカテゴリーを返す
   * @param {string} japaneseValue - 日本語の検索値
   * @returns {{ prompt: string, data: Array } | null} 見つかった場合はプロンプトとデータ、見つからない場合はnull
   */
  findByJapaneseSmallCategory(japaneseValue) {
    if (!japaneseValue || !japaneseValue.trim()) {
      return null;
    }

    const trimmedValue = japaneseValue.trim();

    const findInList = (dataList) => {
      return dataList.find((dicData) => {
        if (!dicData || !dicData.data || !Array.isArray(dicData.data)) {
          return false;
        }
        // data[2]（小項目）で完全一致検索
        const smallCategory = dicData.data[2];
        return smallCategory && smallCategory.trim() === trimmedValue;
      });
    };

    // ローカル辞書を優先検索
    let found = findInList(AppState.data.localPromptList || []);
    if (!found) {
      found = findInList(getMasterPrompts() || []);
    }

    if (found) {
      return {
        prompt: found.prompt,
        data: found.data
      };
    }

    return null;
  }

  debug() {}
}

if (typeof window !== "undefined") {
  window.CategoryUIManager = CategoryUIManager;
}
