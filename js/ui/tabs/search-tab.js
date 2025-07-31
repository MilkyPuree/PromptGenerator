/**
 * search-tab.js - 検索タブモジュール
 * Phase 8.5: 検索、カテゴリーフィルター、翻訳機能
 */

// TabManagerが利用可能になるまで待つ
(function () {
  "use strict";

  // TabManagerが定義されるまで待機
  function defineSearchTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineSearchTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    // SearchTabクラスの定義
    class SearchTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "searchTabBody",
          tabButtonId: null, // 検索タブは常に表示なのでボタンIDなし
          tabIndex: 0, // CONSTANTS.TABS.SEARCH
        });

        // SearchHandlerへの参照
        this.searchHandler = null;

        // 検索結果のキャッシュ（パフォーマンス向上）
        this.searchCache = new Map();
        this.cacheTimeout = 300000; // 5分
        
        // 最後に表示された検索結果データ（カテゴリ変更処理用）
        this.lastDisplayedResults = [];
      }

      /**
       * 初期化処理
       */
      async onInit() {
        // SearchHandlerの参照を取得
        this.searchHandler = this.app.searchHandler;
        if (!this.searchHandler) {
          throw new Error("SearchHandler not found");
        }

        // CategoryUIManagerを初期化
        this.categoryUIManager = new CategoryUIManager();

        // イベントリスナーを設定
        this.setupEventListeners();

        // 検索結果セクションの開閉機能を設定
        this.setupSearchResultToggle();

        // 要素追加機能の設定
        this.setupElementRegistration();

        // カテゴリードロップダウンを初期化（CategoryUIManager使用）
        // categoryDataの初期化を待つ
        this.initializeCategoryDropdownsWithRetry();

        // 保存された検索カテゴリーを復元
        this.restoreSearchCategories();

        console.log("SearchTab initialized");
      }

      /**
       * タブ表示時の処理
       */
      async onShow() {
        // 検索フィールドにフォーカス
        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        if (searchInput) {
          searchInput.focus();
        }

        // 前回の検索状態を復元（表示のみ、自動検索は行わない）
        // カテゴリードロップダウンの選択状態は復元されるが、
        // ユーザーが明示的に検索ボタンを押すかEnterキーを押すまで検索は実行しない
        
        // 検索条件がない場合は検索プロンプトを表示
        await this.showInitialSearchPrompt();
      }

      /**
       * 初期検索プロンプトの表示
       */
      async showInitialSearchPrompt() {
        // 現在の検索条件を確認
        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        const searchCat0 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT0);
        const searchCat1 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT1);
        
        const hasKeyword = searchInput && searchInput.value.trim().length > 0;
        const hasCategory = (searchCat0 && searchCat0.value) || (searchCat1 && searchCat1.value);
        
        // 検索条件がない場合のみプロンプトを表示
        if (!hasKeyword && !hasCategory) {
          this.searchHandler.showSearchPrompt();
        }
      }

      /**
       * イベントリスナーの設定
       */
      setupEventListeners() {
        // キーワード検索
        const searchButton = this.getElement("#searchButton");
        if (searchButton) {
          this.addEventListener(searchButton, "click", () => {
            this.performSearch({ showLoading: true });
          });
        }

        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        if (searchInput) {
          // Enterキーで検索
          this.addEventListener(searchInput, "keypress", (e) => {
            if (e.key === "Enter") {
              this.performSearch({ showLoading: true });
            }
          });

          // 入力内容が変更されたらキャッシュをクリア
          this.addEventListener(searchInput, "input", () => {
            this.clearSearchCache();
          });
        }

        // カテゴリー検索
        this.setupCategoryEventListeners();
      }

      /**
       * カテゴリー検索のイベントリスナー設定
       * CategoryUIManagerに一元化のため、リセットボタンのみ設定
       */
      setupCategoryEventListeners() {
        // CategoryUIManagerが自動的にイベントリスナーを設定するため、
        // ここではリセットボタンのみ設定（イベント重複を避ける）
        console.log('[SearchTab] Setting up reset button only, category events handled by CategoryUIManager');

        const searchCatReset = this.getElement("#search-cat-reset");
        if (searchCatReset) {
          this.addEventListener(searchCatReset, "click", () => {
            this.resetCategorySearch();
          });
        }
      }

      /**
       * 検索結果セクションの開閉機能を設定
       * @deprecated 検索結果は常時表示のため、この機能は無効化
       */
      setupSearchResultToggle() {
        // 検索結果セクションは常時表示のため、開閉機能は不要
        // この関数は互換性のために残していますが、何もしません
      }

      /**
       * カテゴリードロップダウンを初期化
       * @deprecated CategoryUIManagerを使用するため廃止予定
       */
      initializeCategoryDropdowns() {
        // CategoryUIManagerに移行済み
        console.warn('[SearchTab] initializeCategoryDropdowns is deprecated, use CategoryUIManager instead');
      }

      /**
       * カテゴリーデータの初期化を待ってドロップダウンを初期化
       */
      async initializeCategoryDropdownsWithRetry() {
        const maxRetries = 10;
        let retryCount = 0;

        const tryInitialize = () => {
          retryCount++;
          console.log(`[SearchTab] Attempting to initialize category dropdowns (attempt ${retryCount}/${maxRetries})`);

          // categoryDataが利用可能かチェック
          if (window.categoryData && categoryData.data && categoryData.data[0]?.length > 0) {
            console.log('[SearchTab] CategoryData is available, initializing dropdowns');
            this.categoryUIManager.initializeCategoryChain('search');
            return true;
          } else {
            console.log('[SearchTab] CategoryData not ready yet:', {
              categoryDataExists: !!window.categoryData,
              hasData: !!(categoryData?.data),
              level0Length: categoryData?.data?.[0]?.length || 0
            });

            if (retryCount < maxRetries) {
              // 500ms後に再試行
              setTimeout(tryInitialize, 500);
            } else {
              console.error('[SearchTab] Failed to initialize category dropdowns after max retries');
              // 強制的にcategoryDataを更新
              if (window.categoryData) {
                console.log('[SearchTab] Forcing category data update...');
                categoryData.update();
              }
            }
            return false;
          }
        };

        // 初回実行
        tryInitialize();
      }

      /**
       * 保存された検索カテゴリーを復元
       */
      restoreSearchCategories() {
        if (AppState.data.searchCategory?.[0] || AppState.data.searchCategory?.[1]) {
          // CategoryUIManagerを使用して復元
          this.categoryUIManager.setCategoryValues('search', {
            big: AppState.data.searchCategory[0] || '',
            middle: AppState.data.searchCategory[1] || '',
            small: ''
          });
        }
      }


      /**
       * カテゴリードロップダウンを更新
       * @deprecated CategoryUIManagerを使用するため廃止予定
       * @param {number} level - カテゴリーレベル（1=中カテゴリー）
       * @param {string} parentValue - 親カテゴリーの値
       */
      updateCategoryDropdown(level, parentValue) {
        // CategoryUIManagerに移行済み
        if (level === 1) {
          this.categoryUIManager.populateDropdown(DOM_SELECTORS.BY_ID.SEARCH_CAT1, level, parentValue);
        }
      }

      /**
       * 検索を実行
       * @param {Object} options - 検索オプション
       */
      async performSearch(options = {}) {
        if (AppState.ui.isSearching) return;

        const keyword = this.getElement(DOM_SELECTORS.BY_ID.SEARCH).value;
        const searchCat0 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT0).value;
        const searchCat1 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT1).value;
        const categories = [searchCat0, searchCat1];

        // キャッシュキーを生成
        const cacheKey = JSON.stringify({ keyword, categories });

        // キャッシュは無効化（実装が不完全なため）
        // TODO: 将来的にキャッシュを実装する場合は、
        // SearchHandlerの結果を適切にキャッシュする必要がある

        AppState.data.searchCategory = categories;
        await saveCategory();

        // SearchHandlerに処理を委譲
        await this.searchHandler.performSearch(options);

        // 結果をキャッシュ（SearchHandlerが結果を表示した後）
        // 注: 実際の結果はSearchHandlerが管理するため、ここではタイムスタンプのみ
        this.searchCache.set(cacheKey, {
          timestamp: Date.now(),
          results: null, // 将来的に結果もキャッシュする場合用
        });
      }

      /**
       * カテゴリー検索をリセット
       */
      resetCategorySearch() {
        // CategoryUIManagerを使用してリセット
        this.categoryUIManager.resetCategoryChain('search');

        // AppStateもクリア
        AppState.data.searchCategory = [,];
        saveCategory();

        const searchInput = this.getElement(DOM_SELECTORS.BY_ID.SEARCH);
        if (searchInput && searchInput.value) {
          // リセット時はローディングを表示しない
          this.performSearch({ showLoading: false });
        }

        // キャッシュもクリア
        this.clearSearchCache();
      }

      /**
       * 検索結果を表示（将来の拡張用）
       * @param {Array} results - 検索結果
       */
      displaySearchResults(results) {
        // 現在は未実装
        // 将来的にタブ内で検索結果を管理する場合に使用
      }

      /**
       * 検索キャッシュをクリア
       */
      clearSearchCache() {
        this.searchCache.clear();
      }

      /**
       * 検索履歴を取得（将来の拡張用）
       * @returns {Array} 検索履歴
       */
      getSearchHistory() {
        // 将来的に検索履歴機能を追加する場合用
        return [];
      }

      /**
       * 高度な検索オプションを表示（将来の拡張用）
       */
      showAdvancedSearch() {
        // 将来的に高度な検索機能を追加する場合用
      }

      /**
       * タブのリフレッシュ
       */
      async onRefresh() {
        // 検索結果をリフレッシュ
        if (
          this.getElement(DOM_SELECTORS.BY_ID.SEARCH).value ||
          AppState.data.searchCategory?.[0] ||
          AppState.data.searchCategory?.[1]
        ) {
          await this.performSearch({ showLoading: false, forceRefresh: true });
        }
      }

      /**
       * 検索結果を表示し直す
       * @param {boolean} forceRefresh - 検索条件がなくても強制的に更新するか
       */
      async refreshSearchResults(forceRefresh = false) {
        // 現在の検索条件を確認
        const keyword = this.getElement(DOM_SELECTORS.BY_ID.SEARCH)?.value || "";
        const searchCat0 = AppState.data.searchCategory?.[0] || "";
        const searchCat1 = AppState.data.searchCategory?.[1] || "";
        const hasActiveSearch = keyword || searchCat0 || searchCat1;

        console.log("SearchTab.refreshSearchResults debug:", {
          keyword: keyword,
          searchCat0: searchCat0,
          searchCat1: searchCat1,
          hasActiveSearch: hasActiveSearch,
          forceRefresh: forceRefresh,
          AppStateSearchCategory: AppState.data.searchCategory,
        });

        // 何らかの検索条件がある場合、または強制更新の場合に再検索
        if (hasActiveSearch || forceRefresh) {
          console.log("Performing search refresh...");
          // 現在の検索条件で再検索
          await this.performSearch({ showLoading: false, forceRefresh: true });
          console.log("Search refresh completed");
        } else {
          console.log(
            "No active search conditions found and no force refresh, skipping refresh"
          );
        }
      }

      /**
       * 要素登録の設定
       */
      setupElementRegistration() {
        const resistButton = this.getElement("#resist");
        if (resistButton) {
          this.addEventListener(resistButton, "click", async () => {
            await this.handleElementRegistration();
          });
        }

        // 注意: 要素追加フォームは辞書タブに移動済み

        // カテゴリー入力フィールドの設定
        this.setupCategoryInputs();
      }

      /**
       * カテゴリー入力フィールドの設定
       */
      setupCategoryInputs() {
        const bigInput = this.getElement(DOM_SELECTORS.BY_ID.BIG);
        const middleInput = this.getElement(DOM_SELECTORS.BY_ID.MIDDLE);
        const smallInput = this.getElement(DOM_SELECTORS.BY_ID.SMALL);

        if (bigInput && middleInput) {
          // カスタムドロップダウンを使用した新しい実装
          // 大項目と中項目のみドロップダウン（辞書タブと同じ設定）
          this.app.listManager.setupStandardCategoryChain(
            [bigInput, middleInput, smallInput].filter(Boolean), // null/undefinedを除外
            null, // item（検索フィールドなのでnull）
            {
              // カスタムドロップダウン用のカテゴリーチェーン設定（共通定数使用）
              ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
              categoryChainBehavior: {
                ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN.categoryChainBehavior,
                focusPromptAfterSmall: false  // 小項目後にプロンプトフィールドにフォーカスしない（検索なので）
              },
              listType: FLEXIBLE_LIST_TYPES.SEARCH, // 検索タブ用の設定
              useCustomDropdown: true
            }
          );

          // クリア動作を追加
          EventHandlers.addInputClearBehavior(bigInput);
          EventHandlers.addInputClearBehavior(middleInput);

          // 小項目は単純な入力フィールドとして扱う
          if (smallInput) {
            EventHandlers.addInputClearBehavior(smallInput);
          }
        }
      }

      /**
       * 要素の登録処理（共通化版）
       */
      async handleElementRegistration() {
        const bigInput = this.getElement(DOM_SELECTORS.BY_ID.BIG);
        const middleInput = this.getElement(DOM_SELECTORS.BY_ID.MIDDLE);
        const smallInput = this.getElement(DOM_SELECTORS.BY_ID.SMALL);
        const promptInput = this.getElement(DOM_SELECTORS.BY_ID.PROMPT);

        // 現在のドロップダウン選択値を保存
        const searchCat0 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT0);
        const searchCat1 = this.getElement(DOM_SELECTORS.BY_ID.SEARCH_CAT1);
        const categoryState = {
          savedCat0Value: searchCat0 ? searchCat0.value : "",
          savedCat1Value: searchCat1 ? searchCat1.value : "",
        };

        // 共通の登録処理を使用
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

      /**
       * 検索結果を表示（createFlexibleListWithHeader統一版）
       * @param {Array} results - 検索結果データ
       */
      async displaySearchResults(results) {
        // 検索結果データを保存（カテゴリ変更処理用）
        this.lastDisplayedResults = results;
        
        // createFlexibleListWithHeader統一版（他のリストと同じ処理）
        await this.app.listManager.createFlexibleListWithHeader(results, '#searchResultsSection', {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: STANDARD_BUTTONS,
          showHeaders: true,
          sortable: false, // 検索結果はソート不可
          readonly: (item) => this.isReadonlyItem(item),
          refreshCallback: async () => {
            // 統一リフレッシュコールバック
            await this.refreshSearchResults();
          },
          onFieldChange: async (index, fieldKey, value, item) => {
            // ローカル辞書の項目のみ編集可能
            if (!this.isLocalDictionaryItem(item)) return;
            await this.handleSearchFieldChange(index, fieldKey, value, item);
          },
          // カスタムドロップダウン用のカテゴリーチェーン設定（共通定数使用）
          ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
          // 検索結果でのカテゴリー変更コールバック（ローカル辞書項目のみ）
          onCategoryChange: async (level, value, inputElement) => {
            // inputElementが無効、またはDOM要素でない場合は処理をスキップ
            if (!inputElement || typeof inputElement.closest !== 'function') {
              console.warn('[SearchTab] Invalid inputElement provided to onCategoryChange:', inputElement);
              return;
            }
            
            // ローカル辞書項目かどうかを判定
            const listElement = inputElement.closest('li, .flexible-list-item');
            if (listElement) {
              const elementId = listElement.getAttribute('data-element-id') || listElement.getAttribute('data-item-id');
              
              if (elementId) {
                // 検索結果データから該当アイテムを取得
                const virtualList = this.app.listManager.virtualLists.get('#searchResultsSection-list');
                if (virtualList && virtualList.data) {
                  const dataItem = virtualList.data.find(item => item.id === elementId || item._itemId === elementId);
                  if (dataItem && dataItem._source === 'local') {
                    const fieldKey = level === 'big' ? 'data.0' : level === 'middle' ? 'data.1' : 'data.2';
                    await this.updateLocalDictionaryItem(dataItem, fieldKey, value);
                  }
                } else {
                  // フォールバック: li要素のindex順で検索結果データにアクセス
                  const container = document.querySelector('#searchResultsSection');
                  if (container) {
                    const allItems = container.querySelectorAll('li:not(.prompt-list-header)');
                    const itemIndex = Array.from(allItems).indexOf(listElement);
                    
                    // 検索結果データを直接参照（最後に表示されたデータ）
                    if (this.lastDisplayedResults && this.lastDisplayedResults[itemIndex]) {
                      const dataItem = this.lastDisplayedResults[itemIndex];
                      if (dataItem && dataItem._source === 'local') {
                        const fieldKey = level === 'big' ? 'data.0' : level === 'middle' ? 'data.1' : 'data.2';
                        await this.updateLocalDictionaryItem(dataItem, fieldKey, value);
                      }
                    }
                  }
                }
              }
            }
          },
          listType: FLEXIBLE_LIST_TYPES.SEARCH,
          // 仮想スクロール設定（大量データで自動有効）
          virtualScroll: 1000, // 1000件以上で仮想スクロール
          containerHeight: 600,
          bufferSize: 3,
          // ヘッダー設定（他のリストと統一）
          header: FLEXIBLE_LIST_HEADERS.SEARCH.RESULT,
          idOffset: ID_OFFSETS.SEARCH_RESULTS,
        });

        const isSearchElement = this.getElement("#isSearch");
        if (isSearchElement) {
          isSearchElement.innerHTML = "";
        }
      }

      /**
       * 翻訳結果を表示（createFlexibleListWithHeader統一版）
       * @param {Array} results - 翻訳結果データ
       */
      async displayTranslationResults(results) {
        await this.app.listManager.createFlexibleListWithHeader(results, '#searchResultsSection', {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: [...STANDARD_BUTTONS, { type: "register" }],
          sortable: false, // 翻訳結果もソート不可
          readonly: true,
          refreshCallback: async () => {
            // 統一リフレッシュコールバック（翻訳結果は通常リフレッシュ不要）
            console.log('[SearchTab] Translation results refresh requested');
          },
          header: FLEXIBLE_LIST_HEADERS.SEARCH.TRANSLATION_RESULT,
          onRegistration: (item, index) => this.handleRegistration(item, index),
          idOffset: ID_OFFSETS.SEARCH_RESULTS,
        });

        const isSearchElement = this.getElement("#isSearch");
        if (isSearchElement) {
          isSearchElement.innerHTML = "";
        }
      }


      /**
       * 新規登録ボタンのハンドラー（翻訳結果用）
       */
      async handleRegistration(item, index) {
        const success = await ElementRegistration.registerFromTranslation(item);
        
        if (success) {
          // 登録成功後、該当のRegボタンを非活性化（シンプル版）
          const container = document.querySelector('#searchResultsSection');
          if (container) {
            // 翻訳結果にはdata-id属性がないので、li要素の順番で特定
            const allItems = container.querySelectorAll('li:not(.prompt-list-header)');
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

      /**
       * Registerボタンのハンドラー（検索結果用）
       */
      handleRegister(value, item, index) {
        // ローカル辞書項目は登録不可
        if (this.isLocalDictionaryItem(item)) {
          return;
        }

        // マスター辞書項目を登録
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

      /**
       * アイテムが読み取り専用かどうかを判定
       */
      isReadonlyItem(item) {
        // ローカル辞書の項目は編集可能、マスター辞書は読み取り専用
        return !this.isLocalDictionaryItem(item);
      }

      /**
       * ローカル辞書のアイテムかどうかを判定
       */
      isLocalDictionaryItem(item) {
        // _sourceプロパティを最優先で判定
        if (item._source) {
          return item._source === "local";
        }

        // DOM要素から判定（フォールバック）
        if (item.element) {
          const source =
            item.element.getAttribute("data-source") ||
            item.element.data("source");
          if (source) {
            return source === "local";
          }
        }

        // 最後の手段として従来の方法で判定
        return AppState.data.localPromptList.some(
          (localItem) =>
            localItem.prompt === item.prompt &&
            localItem.data[0] === item.data[0] &&
            localItem.data[1] === item.data[1] &&
            localItem.data[2] === item.data[2]
        );
      }

      /**
       * ヘッダーとスクロールバーの幅調整
       */
      adjustHeaderForScrollbar() {
        const viewport = document.querySelector(".virtual-list-viewport");
        const header = document.querySelector("#promptList ui");

        if (viewport && header) {
          // 実際のスクロールバー幅を計算
          const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;

          // ヘッダーのpadding-rightを動的に設定
          header.style.paddingRight = `${scrollbarWidth}px`;

          console.log(`Adjusted header padding-right to ${scrollbarWidth}px`);
        }
      }

      /**
       * 検索結果のフィールド変更ハンドラー（共通関数使用）
       */
      async handleSearchFieldChange(index, fieldKey, value, item) {
        // ローカル辞書の項目のみ編集可能
        if (!this.isLocalDictionaryItem(item)) return;

        // 共通の辞書更新処理を使用
        await this.updateLocalDictionaryItem(item, fieldKey, value);
      }

      /**
       * ローカル辞書項目更新の共通処理（辞書タブと完全に同じ）
       */
      async updateLocalDictionaryItem(item, fieldKey, value) {
        // ローカル辞書での該当アイテムを検索
        const localIndex = AppState.data.localPromptList.findIndex(
          (localItem) =>
            localItem.prompt === item.prompt &&
            localItem.data[0] === item.data[0] &&
            localItem.data[1] === item.data[1] &&
            localItem.data[2] === item.data[2]
        );

        if (localIndex === -1) {
          console.warn('[SearchTab] Could not find matching item in localPromptList for update');
          return;
        }

        // カテゴリー変更フラグ
        let categoryChanged = false;

        // データを更新
        if (fieldKey.startsWith("data.")) {
          const dataIndex = parseInt(fieldKey.split(".")[1]);
          AppState.data.localPromptList[localIndex].data[dataIndex] = value;
          // 表示中のアイテムも更新
          item.data[dataIndex] = value;
          // カテゴリー（data.0, data.1, data.2）の変更かチェック
          if (dataIndex >= 0 && dataIndex <= 2) {
            categoryChanged = true;
          }
        } else if (fieldKey === "prompt") {
          AppState.data.localPromptList[localIndex].prompt = value;
          // 表示中のアイテムも更新
          item.prompt = value;
        }

        console.log(`[SearchTab] Updating local dictionary item: index=${localIndex}, field=${fieldKey}, value="${value}", categoryChanged=${categoryChanged}`);

        // ローカル辞書を保存（辞書タブと同じ処理）
        await saveLocalList(true); // カテゴリー更新を含む

        // カテゴリーが変更された場合は即座にカテゴリーデータを更新
        if (categoryChanged) {
          console.log('[SearchTab] Category changed, updating category data...');
          immediateCategoryUpdate(); // 辞書タブと同じ処理
        }

        // 成功通知
        ErrorHandler.notify("ローカル辞書を更新しました", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "success",
          duration: 1500,
        });
      }

      /**
       * キーボードショートカット設定（将来の拡張用）
       */
      setupKeyboardShortcuts() {
        // Ctrl+K: 検索フォーカス（main.jsで実装済み）
        // 将来的に追加のショートカットを実装
      }

      /**
       * デバッグ情報を出力（オーバーライド）
       */
      debug() {
        super.debug();
        console.log("SearchHandler:", this.searchHandler);
        console.log("Cache size:", this.searchCache.size);
        console.log("Current categories:", AppState.data.searchCategory);
      }
    }

    // グローバルに公開
    if (typeof window !== "undefined") {
      window.SearchTab = SearchTab;
    }
  }

  // 初期実行
  defineSearchTab();
})();
