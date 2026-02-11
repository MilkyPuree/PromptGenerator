(function () {
  "use strict";

  function defineSearchTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineSearchTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    class SearchTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "searchTabBody",
          tabButtonId: null, // 検索タブは常に表示なのでボタンIDなし
          tabIndex: 0, // CONSTANTS.TABS.SEARCH
        });

        this.searchHandler = null;

        this.searchCache = new Map();
        this.cacheTimeout = 300000; // 5分

        this.lastDisplayedResults = [];
      }

      async onInit() {
        this.searchHandler = this.app.searchHandler;
        if (!this.searchHandler) {
          throw new Error("SearchHandler not found");
        }

        this.categoryUIManager = new CategoryUIManager();

        this.setupEventListeners();

        this.setupElementRegistration();

        this.initializeCategoryDropdownsWithRetry();

        this.restoreSearchCategories();
      }

      async onShow() {
        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        if (searchInput) {
          searchInput.focus();
        }

        await this.showInitialSearchPrompt();
      }

      async showInitialSearchPrompt() {
        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        const searchCat0 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT0);
        const searchCat1 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT1);

        const hasKeyword = searchInput && searchInput.value.trim().length > 0;
        const hasCategory = (searchCat0 && searchCat0.value) || (searchCat1 && searchCat1.value);

        if (!hasKeyword && !hasCategory) {
          this.searchHandler.showSearchPrompt();
        }
      }

      setupEventListeners() {
        const searchButton = this.getElement("#searchButton");
        if (searchButton) {
          this.addEventListener(searchButton, "click", () => {
            this.performSearch({ showLoading: true });
          });
        }

        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        if (searchInput) {
          this.addEventListener(searchInput, "keypress", (e) => {
            if (e.key === "Enter") {
              this.performSearch({ showLoading: true });
            }
          });

          this.addEventListener(searchInput, "input", () => {
            this.clearSearchCache();
          });
        }

        this.setupCategoryEventListeners();
      }

      setupCategoryEventListeners() {
        // CategoryUIManagerが自動的にイベントリスナーを設定するため、
        const searchCatReset = this.getElement("#search-cat-reset");
        if (searchCatReset) {
          this.addEventListener(searchCatReset, "click", () => {
            this.resetCategorySearch();
          });
        }
      }

      async initializeCategoryDropdownsWithRetry() {
        const maxRetries = 10;
        let retryCount = 0;

        const tryInitialize = () => {
          retryCount++;

          if (window.categoryData && categoryData.data && categoryData.data[0]?.length > 0) {
            this.categoryUIManager.initializeCategoryChain("search");
            return true;
          } else {
            if (retryCount < maxRetries) {
              setTimeout(tryInitialize, 500);
            } else {
              if (window.categoryData) {
                categoryData.update();
              }
            }
            return false;
          }
        };

        tryInitialize();
      }

      restoreSearchCategories() {
        if (AppState.data.searchCategory?.[0] || AppState.data.searchCategory?.[1]) {
          this.categoryUIManager.setCategoryValues("search", {
            big: AppState.data.searchCategory[0] || "",
            middle: AppState.data.searchCategory[1] || "",
            small: "",
          });
        }
      }

      // @deprecated CategoryUIManagerを使用するため廃止予定
      updateCategoryDropdown(level, parentValue) {
        if (level === 1) {
          this.categoryUIManager.populateDropdown(DOM_SELECTORS.BY_ID.SEARCH_CAT1, level, parentValue);
        }
      }

      async performSearch(options = {}) {
        if (AppState.ui.isSearching) return;

        const keyword = this.getElement(DOM_SELECTORS.BY_ID.SEARCH).value;
        const searchCat0 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT0).value;
        const searchCat1 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT1).value;
        const categories = [searchCat0, searchCat1];

        const cacheKey = JSON.stringify({ keyword, categories });

        // キャッシュは無効化（実装が不完全なため）
        // TODO: 将来的にキャッシュを実装する場合は、
        // SearchHandlerの結果を適切にキャッシュする必要がある

        AppState.data.searchCategory = categories;
        await saveCategory();

        await this.searchHandler.performSearch(options);

        // 注: 実際の結果はSearchHandlerが管理するため、ここではタイムスタンプのみ
        this.searchCache.set(cacheKey, {
          timestamp: Date.now(),
          results: null, // 将来的に結果もキャッシュする場合用
        });
      }

      resetCategorySearch() {
        this.categoryUIManager.resetCategoryChain("search");

        AppState.data.searchCategory = [,];
        saveCategory();

        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        if (searchInput && searchInput.value) {
          this.performSearch({ showLoading: false });
        }

        this.clearSearchCache();
      }

      displaySearchResults(results) {}

      clearSearchCache() {
        this.searchCache.clear();
      }

      getSearchHistory() {
        return [];
      }

      showAdvancedSearch() {}

      async onRefresh() {
        if (
          this.getElement(DOM_SELECTORS.BY_ID.SEARCH).value ||
          AppState.data.searchCategory?.[0] ||
          AppState.data.searchCategory?.[1]
        ) {
          await this.performSearch({ showLoading: false, forceRefresh: true });
        }
      }

      async refreshSearchResults(forceRefresh = false) {
        const keyword = this.getElement(DOM_SELECTORS.BY_ID.SEARCH)?.value || "";
        const searchCat0 = AppState.data.searchCategory?.[0] || "";
        const searchCat1 = AppState.data.searchCategory?.[1] || "";
        const hasActiveSearch = keyword || searchCat0 || searchCat1;

        if (hasActiveSearch || forceRefresh) {
          await this.performSearch({ showLoading: false, forceRefresh: true });
        }
      }

      setupElementRegistration() {
        const resistButton = this.getElement("#resist");
        if (resistButton) {
          this.addEventListener(resistButton, "click", async () => {
            await this.handleElementRegistration();
          });
        }

        // 注意: 要素追加フォームは辞書タブに移動済み

        this.setupCategoryInputs();
      }

      setupCategoryInputs() {
        const bigInput = this.getElement(DOM_SELECTORS.BY_ID.BIG);
        const middleInput = this.getElement(DOM_SELECTORS.BY_ID.MIDDLE);
        const smallInput = this.getElement(DOM_SELECTORS.BY_ID.SMALL);

        if (bigInput && middleInput) {
          this.app.listManager.setupStandardCategoryChain(
            [bigInput, middleInput, smallInput].filter(Boolean), // null/undefinedを除外
            null, // item（検索フィールドなのでnull）
            {
              ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
              categoryChainBehavior: {
                ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN.categoryChainBehavior,
                focusPromptAfterSmall: false, // 小項目後にプロンプトフィールドにフォーカスしない（検索なので）
              },
              listType: FLEXIBLE_LIST_TYPES.SEARCH, // 検索タブ用の設定
              useCustomDropdown: true,
            }
          );
        }
      }

      async handleElementRegistration() {
        const bigInput = this.getElement(DOM_SELECTORS.BY_ID.BIG);
        const middleInput = this.getElement(DOM_SELECTORS.BY_ID.MIDDLE);
        const smallInput = this.getElement(DOM_SELECTORS.BY_ID.SMALL);
        const promptInput = this.getElement(DOM_SELECTORS.BY_ID.PROMPT);

        const searchCat0 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT0);
        const searchCat1 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT1);
        const categoryState = {
          savedCat0Value: searchCat0 ? searchCat0.value : "",
          savedCat1Value: searchCat1 ? searchCat1.value : "",
        };

        await ElementRegistration.registerFromForm(
          {
            bigInput,
            middleInput,
            smallInput,
            promptInput,
          },
          categoryState
        );
      }

      async displaySearchResults(results) {
        this.lastDisplayedResults = results;

        await this.app.listManager.createFlexibleListWithHeader(results, "#searchResultsSection", {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: STANDARD_BUTTONS,
          showHeaders: true,
          sortable: false, // 検索結果はソート不可
          readonly: (item) => this.isReadonlyItem(item),
          refreshCallback: async () => {
            await this.refreshSearchResults();
          },
          onFieldChange: async (index, fieldKey, value, item) => {
            if (!this.isLocalDictionaryItem(item)) return;
            await this.handleSearchFieldChange(index, fieldKey, value, item);
          },
          ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
          onCategoryChange: async (level, value, inputElement) => {
            if (!inputElement || typeof inputElement.closest !== "function") {
              return;
            }

            const listElement = inputElement.closest("li, .flexible-list-item");
            if (listElement) {
              const elementId = listElement.getAttribute("data-element-id") || listElement.getAttribute("data-item-id");

              if (elementId) {
                const virtualList = this.app.listManager.virtualLists.get("#searchResultsSection-list");
                if (virtualList && virtualList.data) {
                  const dataItem = virtualList.data.find((item) => item.id === elementId || item._itemId === elementId);
                  if (dataItem && dataItem._source === "local") {
                    const fieldKey = level === "big" ? "data.0" : level === "middle" ? "data.1" : "data.2";
                    await this.updateLocalDictionaryItem(dataItem, fieldKey, value);
                  }
                } else {
                  const container = document.querySelector("#searchResultsSection");
                  if (container) {
                    const allItems = container.querySelectorAll("li:not(.prompt-list-header)");
                    const itemIndex = Array.from(allItems).indexOf(listElement);

                    if (this.lastDisplayedResults && this.lastDisplayedResults[itemIndex]) {
                      const dataItem = this.lastDisplayedResults[itemIndex];
                      if (dataItem && dataItem._source === "local") {
                        const fieldKey = level === "big" ? "data.0" : level === "middle" ? "data.1" : "data.2";
                        await this.updateLocalDictionaryItem(dataItem, fieldKey, value);
                      }
                    }
                  }
                }
              }
            }
          },
          listType: FLEXIBLE_LIST_TYPES.SEARCH,
          virtualScroll: 1000, // 1000件以上で仮想スクロール
          containerHeight: 600,
          bufferSize: 3,
          header: FLEXIBLE_LIST_HEADERS.SEARCH.RESULT,
          idOffset: ID_OFFSETS.SEARCH_RESULTS,
        });

        const isSearchElement = this.getElement("#isSearch");
        if (isSearchElement) {
          isSearchElement.innerHTML = "";
        }
      }

      async displayTranslationResults(results) {
        await this.app.listManager.createFlexibleListWithHeader(results, "#searchResultsSection", {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: [...STANDARD_BUTTONS, { type: "register" }],
          sortable: false, // 翻訳結果もソート不可
          readonly: true,
          refreshCallback: async () => {},
          header: FLEXIBLE_LIST_HEADERS.SEARCH.TRANSLATION_RESULT,
          onRegistration: (item, index) => this.handleRegistration(item, index),
          idOffset: ID_OFFSETS.SEARCH_RESULTS,
        });

        const isSearchElement = this.getElement("#isSearch");
        if (isSearchElement) {
          isSearchElement.innerHTML = "";
        }
      }

      async handleRegistration(item, index) {
        const success = await ElementRegistration.registerFromTranslation(item);

        if (success) {
          const container = document.querySelector("#searchResultsSection");
          if (container) {
            const allItems = container.querySelectorAll("li:not(.prompt-list-header)");
            const itemElement = allItems[index];

            if (itemElement) {
              const registerButton = itemElement.querySelector('[data-action="register"]');
              if (registerButton) {
                registerButton.disabled = true;
                registerButton.title = "登録済み";
              }
            }
          }
        }
      }

      handleRegister(value, item, index) {
        if (this.isLocalDictionaryItem(item)) {
          return;
        }

        const data = {
          big: item.data[0] || "",
          middle: item.data[1] || "",
          small: item.data[2] || "",
        };
        const success = register(data.big, data.middle, data.small, item.prompt);

        if (success) {
          ErrorHandler.notify("ローカル辞書に登録しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: 1500,
          });
          this.app.refreshAddList();
        }
      }

      isReadonlyItem(item) {
        return !this.isLocalDictionaryItem(item);
      }

      isLocalDictionaryItem(item) {
        if (item._source) {
          return item._source === "local";
        }

        if (item.element) {
          const source = item.element.getAttribute("data-source") || item.element.data("source");
          if (source) {
            return source === "local";
          }
        }

        return AppState.data.localPromptList.some(
          (localItem) =>
            localItem.prompt === item.prompt &&
            localItem.data[0] === item.data[0] &&
            localItem.data[1] === item.data[1] &&
            localItem.data[2] === item.data[2]
        );
      }

      adjustHeaderForScrollbar() {
        const viewport = document.querySelector(DOM_SELECTORS.BY_CLASS.VIRTUAL_VIEWPORT);
        const header = document.querySelector("#promptList ui");

        if (viewport && header) {
          const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;

          header.style.paddingRight = `${scrollbarWidth}px`;
        }
      }

      async handleSearchFieldChange(index, fieldKey, value, item) {
        if (!this.isLocalDictionaryItem(item)) return;

        await this.updateLocalDictionaryItem(item, fieldKey, value);
      }

      async updateLocalDictionaryItem(item, fieldKey, value) {
        const localIndex = AppState.data.localPromptList.findIndex(
          (localItem) =>
            localItem.prompt === item.prompt &&
            localItem.data[0] === item.data[0] &&
            localItem.data[1] === item.data[1] &&
            localItem.data[2] === item.data[2]
        );

        if (localIndex === -1) {
          return;
        }

        let categoryChanged = false;

        if (fieldKey.startsWith("data.")) {
          const dataIndex = parseInt(fieldKey.split(".")[1]);
          AppState.data.localPromptList[localIndex].data[dataIndex] = value;
          item.data[dataIndex] = value;
          if (dataIndex >= 0 && dataIndex <= 2) {
            categoryChanged = true;
          }
        } else if (fieldKey === "prompt") {
          AppState.data.localPromptList[localIndex].prompt = value;
          item.prompt = value;
        }

        await saveLocalList(true); // カテゴリー更新を含む

        if (categoryChanged) {
          immediateCategoryUpdate(); // 辞書タブと同じ処理
        }

        ErrorHandler.notify("ローカル辞書を更新しました", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "success",
          duration: 1500,
        });
      }

      setupKeyboardShortcuts() {}

      debug() {
        super.debug();
      }
    }

    if (typeof window !== "undefined") {
      window.SearchTab = SearchTab;
    }
  }

  defineSearchTab();
})();
