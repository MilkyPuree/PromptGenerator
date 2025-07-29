/**
 * dictionary-tab.js - 辞書タブモジュール
 * Phase 8.5: 辞書管理機能
 * Phase 9: BaseModal統合完了
 * Updated: 2025-07-09
 */

// TabManagerが利用可能になるまで待つ
(function () {
  "use strict";

  // TabManagerが定義されるまで待機
  function defineDictionaryTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineDictionaryTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    // DictionaryTabクラスの定義
    class DictionaryTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "addTabBody",
          tabButtonId: "addTab",
          tabIndex: 1, // CONSTANTS.TABS.DICTIONARY
        });

        // 依存モジュールへの参照
        this.dictionaryHandler = null;
        this.listManager = null;

        // FlexibleElementManager初期化
        this.flexibleElementManager = null;

        // モーダル管理
        this.dictionaryManagementModal = null;

        // 辞書の表示状態
        this.dictionaryStates = {
          prompt: false,
          element: false,
          master: false,
        };
      }

      /**
       * 初期化処理
       */
      async onInit() {
        // 依存モジュールの参照を取得
        this.dictionaryHandler = this.app.dictionaryHandler;
        this.listManager = this.app.listManager;

        if (!this.dictionaryHandler || !this.listManager) {
          throw new Error("Required dependencies not found");
        }

        // CategoryUIManagerを初期化
        this.categoryUIManager = new CategoryUIManager();

        // FlexibleElementManagerを初期化
        if (window.FlexibleElementManager) {
          this.flexibleElementManager = new FlexibleElementManager(
            this.listManager
          );
          console.log("[DictionaryTab] FlexibleElementManager initialized");
        } else {
          console.warn("[DictionaryTab] FlexibleElementManager not available");
        }

        // イベントリスナーを設定
        this.setupEventListeners();

        // 統計情報を更新
        this.updateStats();

        // 自動開放は削除 - ユーザーの明示的なクリックで開くように

        console.log("DictionaryTab initialized");
      }

      /**
       * イベントリスナーの設定
       */
      setupEventListeners() {
        // 辞書ナビゲーションボタンの設定
        this.setupDictionaryNavigation();

        // 辞書の開閉（従来互換性のため残す）
        // this.setupDictionaryToggles(); // 新UI実装により無効化

        // カテゴリー入力の連動はFlexibleListのdropdownCount: 2で処理
        // CategoryUIManagerはフォーム登録部分のみで使用（競合を避ける）
        console.log(
          "[DICT_DEBUG] Dictionary category chain handled by FlexibleList dropdownCount"
        );

        // ダウンロードボタンの設定
        this.setupDownloadButtons();

        // インポートボタンの設定
        this.setupImportButtons();

        // お気に入り追加ボタンの設定
        this.setupFavoriteAddButton();

        // 要素追加フォームの設定
        this.setupElementRegistration();

        // 複数辞書管理の設定
        this.setupMultipleDictionaryManagement();
      }

      /**
       * 辞書ナビゲーションボタンの設定
       */
      setupDictionaryNavigation() {
        console.log('[DictionaryTab] Setting up dictionary navigation...');
        
        // 統計アイテムボタンの確認
        const statItems = document.querySelectorAll('.stat-item');
        console.log(`[DictionaryTab] Found ${statItems.length} stat items`);
        
        // セクションの確認
        const sections = document.querySelectorAll('.dictionary-content-section');
        const sectionIds = Array.from(sections).map(s => s.id);
        console.log(`[DictionaryTab] Found ${sections.length} content sections:`, sectionIds);
        console.log('[DictionaryTab] Section details:', Array.from(sections).map(s => ({
          id: s.id,
          className: s.className,
          tagName: s.tagName
        })));
        
        // 辞書統一コンテナの確認
        const unifiedContainer = document.querySelector('.dictionary-unified-container');
        console.log('[DictionaryTab] Unified container found:', !!unifiedContainer);
        
        if (statItems.length === 0) {
          console.error('[DictionaryTab] No stat items found! Check HTML structure.');
          return;
        }
        
        if (sections.length === 0) {
          console.error('[DictionaryTab] No content sections found! Check HTML structure.');
          return;
        }
        
        statItems.forEach(item => {
          this.addEventListener(item, 'click', (e) => {
            e.preventDefault();
            
            const targetDictionary = item.getAttribute('data-dictionary');
            console.log(`[DictionaryTab] Stat item clicked for: ${targetDictionary}`);
            this.switchDictionaryTab(targetDictionary);
          });
        });
        
        // 少し遅延を入れてからデフォルト表示
        setTimeout(() => {
          console.log('[DictionaryTab] Setting default dictionary to favorite...');
          
          // より詳細なDOM確認
          const addTabBody = document.getElementById('addTabBody');
          console.log('[DictionaryTab] addTabBody exists:', !!addTabBody);
          
          if (addTabBody) {
            const childElements = Array.from(addTabBody.children);
            console.log('[DictionaryTab] addTabBody children:', childElements.map(c => c.tagName + '.' + c.className));
            
            const unifiedContainer = addTabBody.querySelector('.dictionary-unified-container');
            console.log('[DictionaryTab] unified container in addTabBody:', !!unifiedContainer);
            
            if (unifiedContainer) {
              const sectionsInContainer = Array.from(unifiedContainer.querySelectorAll('.dictionary-content-section'));
              console.log('[DictionaryTab] sections in unified container:', sectionsInContainer.map(s => s.id));
            }
          }
          
          // 再度セクションの存在確認
          const favoriteSection = document.getElementById('favorite-section');
          if (favoriteSection) {
            console.log('[DictionaryTab] favorite-section found, proceeding with switch');
            this.switchDictionaryTab('favorite');
          } else {
            console.error('[DictionaryTab] favorite-section not found! Checking DOM structure...');
            this.debugDOMStructure();
          }
        }, 100);
      }

      /**
       * 辞書の切り替え（新UI用）
       * @param {string} dictionaryType - 'favorite', 'local', 'master'
       */
      switchDictionaryTab(dictionaryType) {
        try {
          console.log(`[DictionaryTab] === SWITCH START: ${dictionaryType} ===`);
          console.log(`[DictionaryTab] Attempting to switch to ${dictionaryType} dictionary`);
          
          // デバッグ: 全てのセクションを確認
          console.log(`[DictionaryTab] Step 1: Starting section check...`);
          const allSections = document.querySelectorAll('.dictionary-content-section');
          console.log(`[DictionaryTab] Found ${allSections.length} dictionary content sections:`, 
                     Array.from(allSections).map(s => s.id));
          console.log(`[DictionaryTab] Section check completed`);
        
          // 全ての統計アイテムからactiveクラスを削除
          console.log(`[DictionaryTab] Step 2: Starting stat item class removal...`);
          const statItems = document.querySelectorAll('.stat-item');
          console.log(`[DictionaryTab] Found ${statItems.length} stat items`);
          statItems.forEach(item => item.classList.remove('active'));
          console.log(`[DictionaryTab] Stat item class removal completed`);
          
          // 全てのセクションを非表示
          console.log(`[DictionaryTab] Step 3: Starting section hiding...`);
          allSections.forEach(section => {
            console.log(`[DictionaryTab] Hiding section: ${section.id}`);
            section.classList.remove('active');
          });
          console.log(`[DictionaryTab] Section hiding completed`);
          
          // 対象セクションを確認
          console.log(`[DictionaryTab] Step 4: Finding target section...`);
          const targetSectionId = `${dictionaryType}-section`;
          console.log(`[DictionaryTab] Looking for section with ID: ${targetSectionId}`);
          const targetSection = document.getElementById(targetSectionId);
          console.log(`[DictionaryTab] Target section found:`, !!targetSection);
          
          if (!targetSection) {
            console.error(`[DictionaryTab] ERROR: Section ${targetSectionId} not found!`);
            throw new Error(`Section ${targetSectionId} not found`);
          }
          
          // 対象セクションを表示
          console.log(`[DictionaryTab] Step 5: Showing target section...`);
          targetSection.classList.add('active');
          console.log(`[DictionaryTab] Target section ${targetSectionId} is now active`);
          
          // 対象統計アイテムをアクティブにする
          console.log(`[DictionaryTab] Step 6: Activating target stat item...`);
          const targetStatItem = document.querySelector(`.stat-item[data-dictionary="${dictionaryType}"]`);
          console.log(`[DictionaryTab] Target stat item found:`, !!targetStatItem);
          
          if (targetStatItem) {
            targetStatItem.classList.add('active');
            console.log(`[DictionaryTab] Target stat item activated`);
          } else {
            console.warn(`[DictionaryTab] WARNING: Stat item for ${dictionaryType} not found`);
          }
          
          // 各辞書タイプに応じたリストの更新
          console.log(`[DictionaryTab] Step 7: Updating dictionary content...`);
          switch (dictionaryType) {
            case 'favorite':
              console.log(`[DictionaryTab] Refreshing favorite list...`);
              setTimeout(() => this.refreshFavoriteList(), 100);
              break;
            case 'local':
              console.log(`[DictionaryTab] Refreshing local dictionary...`);
              setTimeout(() => this.refreshAddList(), 100);
              break;
            case 'master':
              console.log(`[DictionaryTab] Refreshing master dictionary...`);
              setTimeout(() => this.refreshMasterDictionary(), 100);
              break;
            default:
              console.error(`[DictionaryTab] Unknown dictionary type: ${dictionaryType}`);
              return;
          }
          console.log(`[DictionaryTab] Dictionary content update completed`);
          
          // 現在の辞書を保存
          console.log(`[DictionaryTab] Step 8: Saving current dictionary state...`);
          this.currentDictionary = dictionaryType;
          console.log(`[DictionaryTab] Current dictionary set to: ${this.currentDictionary}`);
        
          console.log(`[DictionaryTab] Switch completed for ${dictionaryType} dictionary`);
          console.log(`[DictionaryTab] === SWITCH END: ${dictionaryType} ===`);
        } catch (error) {
          console.error(`[DictionaryTab] ERROR in switchDictionary(${dictionaryType}):`, error);
          console.error(`[DictionaryTab] Error stack:`, error.stack);
          console.error(`[DictionaryTab] Error details:`, {
            name: error.name,
            message: error.message,
            dictionaryType: dictionaryType
          });
        }
      }

      /**
       * DOM構造のデバッグ
       */
      debugDOMStructure() {
        console.log('[DictionaryTab] === DOM DEBUG START ===');
        
        // 辞書タブボディの確認
        const tabBody = document.getElementById('addTabBody');
        console.log('addTabBody found:', !!tabBody);
        
        // 辞書ヘッダーの確認
        const dictHeader = document.querySelector('.dictionary-header');
        console.log('dictionary-header found:', !!dictHeader);
        
        // ナビゲーションの確認
        const dictNav = document.querySelector('.dictionary-navigation');
        console.log('dictionary-navigation found:', !!dictNav);
        
        // 統一コンテナの確認
        const unifiedContainer = document.querySelector('.dictionary-unified-container');
        console.log('dictionary-unified-container found:', !!unifiedContainer);
        
        if (unifiedContainer) {
          const children = Array.from(unifiedContainer.children);
          console.log('Unified container children:', children.map(c => c.tagName + '#' + c.id + '.' + c.className));
          
          // 各子要素の詳細を確認
          children.forEach((child, index) => {
            console.log(`Child ${index}:`, {
              tagName: child.tagName,
              id: child.id,
              className: child.className,
              hasClass_content_section: child.classList.contains('dictionary-content-section')
            });
          });
        }
        
        // 全てのIDを持つ要素を確認
        const allIdsInDictTab = Array.from(document.querySelectorAll('#addTabBody [id]'));
        console.log('All elements with IDs in dictionary tab:', 
                   allIdsInDictTab.map(el => `${el.tagName}#${el.id}`));
        
        console.log('[DictionaryTab] === DOM DEBUG END ===');
      }

      /**
       * 辞書の開閉トグル設定（従来互換性のため残す）
       */
      setupDictionaryToggles() {
        // 辞書ヘッダーで開閉（以前の方式に戻す）
        const sections = [
          { containerId: "#promptDicContainer", type: "prompt" },
          { containerId: "#elementDicContainer", type: "element" },
          { containerId: "#masterDicContainer", type: "master" },
        ];

        sections.forEach(({ containerId, type }) => {
          const debugId = `SETUP_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 5)}`;

          const container = document.querySelector(containerId);
          console.log(`[${debugId}] Setting up ${type} dictionary:`, {
            containerId,
            container: !!container,
            containerExists: container !== null,
          });

          if (container) {
            const section = container.closest(".search-results-section");
            console.log(`[${debugId}] Found section for ${type}:`, {
              section: !!section,
              sectionExists: section !== null,
            });

            if (section) {
              const header = section.querySelector(
                DICTIONARY_SELECTORS.CLICKABLE_HEADER
              );
              console.log(`[${debugId}] Found header for ${type}:`, {
                header: !!header,
                headerExists: header !== null,
                visible: header
                  ? window.getComputedStyle(header).display !== "none"
                  : false,
                position: header ? header.getBoundingClientRect() : null,
              });

              if (header) {
                // ヘッダークリックで開閉（統一された方式）
                this.addEventListener(header, "click", () => {
                  const clickDebugId = `CLICK_${Date.now()}_${Math.random()
                    .toString(36)
                    .substr(2, 5)}`;
                  console.log(
                    `[${clickDebugId}] Clicked ${type} dictionary header - Current state: ${this.dictionaryStates[type]}`
                  );
                  this.toggleDictionary(type);
                });
              } else {
                console.warn(
                  `[${debugId}] Header not found for ${type} dictionary`
                );
              }
            } else {
              console.warn(
                `[${debugId}] Section not found for ${type} dictionary`
              );
            }
          } else {
            console.warn(
              `[${debugId}] Container not found for ${type} dictionary with selector: ${containerId}`
            );
          }
        });

        // 統計アイテムクリックで対応する辞書を開閉（トグル）
        const statItems = document.querySelectorAll(
          DICTIONARY_SELECTORS.STAT_ITEM
        );
        console.log(`[STAT_SETUP] Found ${statItems.length} stat-items`);

        statItems.forEach((statItem, index) => {
          const dictionaryTypes = [
            DICTIONARY_TYPES_STORAGE.PROMPT,
            DICTIONARY_TYPES_STORAGE.ELEMENT,
            DICTIONARY_TYPES_STORAGE.MASTER,
          ];
          const type = dictionaryTypes[index];
          const statDebugId = `STAT_${index}_${Date.now()}`;

          console.log(
            `[${statDebugId}] Setting up stat-item ${index} for type: ${type}`,
            { statItem: !!statItem, type }
          );

          if (type && statItem) {
            this.addEventListener(statItem, "click", () => {
              const statClickId = `STAT_CLICK_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 5)}`;
              console.log(
                `[${statClickId}] Clicked ${type} stat-item (index: ${index}), current state: ${this.dictionaryStates[type]}`
              );
              console.log(
                `[${statClickId}] Dictionary states before toggle:`,
                this.dictionaryStates
              );

              // 開閉をトグル（開いている場合は閉じ、閉じている場合は開く）
              this.toggleDictionary(type);
            });
          } else {
            console.warn(
              `[${statDebugId}] Invalid stat-item setup: type=${type}, statItem=${!!statItem}`
            );
          }
        });

        // 従来のUI互換性（隠し要素）
        const promptDicText = this.getElement(
          DOM_SELECTORS.BY_ID.PROMPT_DIC_TEXT
        );
        if (promptDicText) {
          this.addEventListener(promptDicText, "click", () => {
            this.toggleDictionary("prompt");
          });
        }

        const elementDicText = this.getElement(
          DOM_SELECTORS.BY_ID.ELEMENT_DIC_TEXT
        );
        if (elementDicText) {
          this.addEventListener(elementDicText, "click", () => {
            this.toggleDictionary("element");
          });
        }

        const masterDicText = this.getElement(
          DOM_SELECTORS.BY_ID.MASTER_DIC_TEXT
        );
        if (masterDicText) {
          this.addEventListener(masterDicText, "click", () => {
            this.toggleDictionary("master");
          });
        }
      }

      /**
       * カテゴリー入力フィールドの設定
       * @deprecated CategoryUIManagerを使用するため廃止予定
       */
      setupCategoryInputs() {
        // CategoryUIManagerに移行済み
        console.warn(
          "[DictionaryTab] setupCategoryInputs is deprecated, use CategoryUIManager instead"
        );
      }

      /**
       * 辞書の表示/非表示を切り替え
       * @param {string} type - 辞書タイプ（prompt/element/master）
       */
      async toggleDictionary(type) {
        const configs = {
          prompt: {
            listId: DOM_SELECTORS.BY_ID.FAVORITE_LIST,
            containerId: DOM_SELECTORS.BY_ID.PROMPT_DIC_CONTAINER,
            textId: DOM_SELECTORS.BY_ID.PROMPT_DIC_TEXT,
            openText: DICTIONARY_TEXTS.PROMPT.OPEN,
            closeText: DICTIONARY_TEXTS.PROMPT.CLOSE,
            createFunc: async () => {
              // promptDictionaries システムを使用
              const currentDictId =
                AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict =
                AppState.data.promptDictionaries?.[currentDictId];
              const prompts = currentDict?.prompts || [];

              console.log(
                "Creating prompt dictionary list with data:",
                prompts
              );

              // ソート順でソート
              const sorted = [...prompts].sort(
                (a, b) => (a.sort || 0) - (b.sort || 0)
              );

              // 永続IDを確保（辞書タブでもソート問題解決のため）
              const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

              const favoriteListConfig = {
                fields: FAVORITE_FIELDS,
                buttons: FAVORITE_BUTTONS,
                sortable: true,
                listType: FLEXIBLE_LIST_TYPES.FAVORITE, // リアルタイム更新用
                header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT, // ⭐️ お気に入りリスト
                // ヘッダークリックソート機能を有効化
                headerClickSort: {
                  enabled: true,
                  listManager: this.listManager,
                  dataArray: prompts, // 現在の辞書のプロンプト配列
                  refreshCallback: async () => await this.refreshFavoriteList(),
                  saveCallback: async () => await savePromptDictionaries()
                },
                refreshCallback: async () => {
                  // 統一リフレッシュコールバック
                  await this.refreshFavoriteList();
                },
                // FlexibleElementManager用の削除コールバック
                removeElementFromData: async (elementId) => {
                  console.log('[DictionaryTab] removeElementFromData called:', elementId);
                  const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                  const currentDict = AppState.data.promptDictionaries[currentDictId];
                  
                  if (currentDict && currentDict.prompts) {
                    const index = currentDict.prompts.findIndex(item => item.id === elementId);
                    if (index !== -1) {
                      currentDict.prompts.splice(index, 1);
                      await savePromptDictionaries();
                      console.log('[DictionaryTab] Element removed from data:', elementId);
                      return true;
                    }
                  }
                  return false;
                },
                // Enter/Blurで自動保存を追加
                onEnterBlurChange: async (
                  index,
                  fieldKey,
                  value,
                  item,
                  eventType
                ) => {
                  console.log(
                    `[DictionaryTab] Favorite ${eventType} triggered:`,
                    {
                      index,
                      fieldKey,
                      value,
                    }
                  );

                  const currentDictId =
                    AppState.data.currentPromptDictionary ||
                    DEFAULT_DICTIONARY_ID;
                  const currentDict =
                    AppState.data.promptDictionaries[currentDictId];

                  if (
                    currentDict &&
                    currentDict.prompts &&
                    index >= 0 &&
                    index < currentDict.prompts.length
                  ) {
                    // データ層を直接更新（FlexibleElementManagerは使用しない - 無限ループ防止）
                    if (fieldKey === "title") {
                      currentDict.prompts[index].title = value;
                    } else if (fieldKey === "prompt") {
                      currentDict.prompts[index].prompt = value;
                    }
                    await savePromptDictionaries();
                  }
                },
                onDelete: async (index, item) => {
                  try {
                    console.log("[DictionaryTab] Delete operation started:", {
                      index,
                      item,
                    });

                    // FlexibleElementManagerを使用した削除（スクロール位置保持）
                    if (this.flexibleElementManager && item?.id) {
                      console.log(
                        "[DictionaryTab] Using FlexibleElementManager for deletion"
                      );

                      // スクロール位置を保存
                      this.flexibleElementManager.saveScrollPosition();

                      // データ層から削除
                      const currentDictId =
                        AppState.data.currentPromptDictionary ||
                        DEFAULT_DICTIONARY_ID;
                      const currentDict =
                        AppState.data.promptDictionaries[currentDictId];

                      if (currentDict && currentDict.prompts) {
                        const actualIndex = currentDict.prompts.findIndex(
                          (prompt) =>
                            prompt.title === item.title &&
                            prompt.prompt === item.prompt
                        );
                        console.log(
                          "[DictionaryTab] Found actualIndex:",
                          actualIndex
                        );

                        if (actualIndex !== -1) {
                          currentDict.prompts.splice(actualIndex, 1);
                          currentDict.prompts.forEach((prompt, idx) => {
                            prompt.sort = idx;
                          });
                          await savePromptDictionaries();
                          console.log(
                            "[DictionaryTab] Data saved successfully"
                          );

                          // DOM要素削除
                          const element = document.querySelector(
                            `[data-element-id="${item.id}"]`
                          );
                          console.log(
                            "[DictionaryTab] Found DOM element:",
                            element
                          );
                          if (element) {
                            element.remove();
                            console.log(
                              "[DictionaryTab] DOM element removed successfully"
                            );
                          }

                          // スクロール位置復元
                          setTimeout(() => {
                            this.flexibleElementManager.restoreScrollPosition();
                          }, 10);

                          // 統計更新
                          this.updateStats();
                          console.log(
                            "[DictionaryTab] Delete operation completed successfully"
                          );
                          return false; // ListManagerフローをスキップ
                        }
                      }
                    }
                  } catch (error) {
                    console.error(
                      "[DictionaryTab] Error in delete operation:",
                      error
                    );
                    throw error; // エラーを再スローして上位で処理
                  }

                  // フォールバック：従来の削除処理
                  const currentDictId =
                    AppState.data.currentPromptDictionary ||
                    DEFAULT_DICTIONARY_ID;
                  const currentDict =
                    AppState.data.promptDictionaries[currentDictId];

                  if (currentDict && currentDict.prompts) {
                    const actualIndex = currentDict.prompts.findIndex(
                      (prompt) =>
                        prompt.title === item.title &&
                        prompt.prompt === item.prompt
                    );
                    if (actualIndex !== -1) {
                      currentDict.prompts.splice(actualIndex, 1);
                      currentDict.prompts.forEach((prompt, idx) => {
                        prompt.sort = idx;
                      });
                      await savePromptDictionaries();
                      this.updateStats();
                    }
                  }
                },
                onSort: async (sortedIds) => {
                  const currentDictId =
                    AppState.data.currentPromptDictionary ||
                    DEFAULT_DICTIONARY_ID;
                  const currentDict =
                    AppState.data.promptDictionaries[currentDictId];

                  if (currentDict && currentDict.prompts) {
                    await this.listManager.handleSortCommon(
                      sortedIds,
                      currentDict.prompts,
                      async () => {
                        // ソート後にID整合性を確保してから保存（ソート問題解決）
                        if (window.ensureDictionaryElementIds) {
                          currentDict.prompts = window.ensureDictionaryElementIds(currentDict.prompts);
                        }
                        await savePromptDictionaries();
                      }
                    );
                  }
                },
              };

              // FlexibleElementManagerに現在のリスト設定を通知
              if (this.flexibleElementManager) {
                this.flexibleElementManager.setCurrentList(
                  DOM_SELECTORS.BY_ID.FAVORITE_LIST,
                  favoriteListConfig
                );
              }

              await this.listManager.createFlexibleList(
                sortedWithIds,
                DOM_SELECTORS.BY_ID.FAVORITE_LIST,
                favoriteListConfig
              );
            },
          },
          element: {
            listId: DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
            containerId: "#elementDicContainer",
            textId: "#elementDicText",
            openText: DICTIONARY_TEXTS.ELEMENT.OPEN,
            closeText: DICTIONARY_TEXTS.ELEMENT.CLOSE,
            createFunc: async () => {
              // ヘッダークリックソート中の場合は、元の順序を保持
              const listManager = this.listManager;
              const sortState = listManager?.sortStates?.get('#addPromptList-list');
              const isHeaderSorted = sortState && sortState.column && sortState.direction;
              
              console.log('[createFunc] Header sort state:', sortState);
              console.log('[createFunc] Is header sorted:', isHeaderSorted);
              
              const sorted = isHeaderSorted 
                ? [...AppState.data.localPromptList] // ヘッダーソート中は順序を保持
                : [...AppState.data.localPromptList].sort((a, b) => (a.sort || 0) - (b.sort || 0)); // 通常は元の順序

              // 永続IDを確保（辞書タブソート問題解決のため）
              const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

              const listConfig = {
                fields: STANDARD_CATEGORY_FIELDS, // 元の定義を使用（item.promptで正しく動作）
                buttons: [...STANDARD_BUTTONS, { type: "delete" }],
                sortable: true,
                listType: FLEXIBLE_LIST_TYPES.ADD, // リアルタイム更新用
                header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT, // 💾 ユーザー辞書
                // ヘッダークリックソート機能を有効化
                headerClickSort: {
                  enabled: true,
                  listManager: this.listManager,
                  dataArray: AppState.data.localPromptList,
                  refreshCallback: async () => await this.refreshAddList(),
                  saveCallback: async () => await saveLocalList()
                },
                refreshCallback: async () => {
                  // 統一リフレッシュコールバック
                  await this.refreshAddList();
                },
                // カスタムドロップダウン用のカテゴリーチェーン設定（フォーカス移動を無効化）
                ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
                categoryChainBehavior: {
                  ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN.categoryChainBehavior,
                  focusNext: false, // フォーカス移動を無効化
                  focusPromptAfterSmall: false, // プロンプト後のフォーカス移動も無効化
                },
                // Enter/Blurで自動保存を追加
                onEnterBlurChange: async (
                  index,
                  fieldKey,
                  value,
                  item,
                  eventType
                ) => {
                  console.log(
                    `[DictionaryTab] Local element ${eventType} triggered:`,
                    {
                      index,
                      fieldKey,
                      value,
                      item: item,
                      currentData: AppState.data.localPromptList[index],
                    }
                  );

                  // FlexibleElementManagerを使用して更新
                  if (this.flexibleElementManager && item?.id) {
                    await this.flexibleElementManager.updateFieldOnly(
                      item.id,
                      fieldKey,
                      value
                    );
                  }

                  // データ層を直接更新
                  if (
                    index >= 0 &&
                    index < AppState.data.localPromptList.length
                  ) {
                    if (fieldKey === "data" && Array.isArray(value)) {
                      AppState.data.localPromptList[index].data = value;
                    } else if (fieldKey === "prompt") {
                      // プロンプトフィールド（item.prompt）
                      AppState.data.localPromptList[index].prompt = value;
                    } else if (fieldKey === "data.0") {
                      // 大項目
                      AppState.data.localPromptList[index].data[0] = value;
                    } else if (fieldKey === "data.1") {
                      // 中項目
                      AppState.data.localPromptList[index].data[1] = value;
                    } else if (fieldKey === "data.2") {
                      // 小項目
                      AppState.data.localPromptList[index].data[2] = value;
                    } else if (
                      AppState.data.localPromptList[index].data &&
                      typeof AppState.data.localPromptList[index].data ===
                        "object"
                    ) {
                      if (typeof fieldKey === "number") {
                        AppState.data.localPromptList[index].data[fieldKey] =
                          value;
                      }
                    }
                    await saveLocalList(false); // リフレッシュなしで保存
                    console.log(`[DictionaryTab] After save - Updated data:`, {
                      updatedItem: AppState.data.localPromptList[index],
                      fieldKey: fieldKey,
                      value: value,
                    });
                  }
                },
                onDelete: async (index, item) => {
                  console.log(
                    "[DictionaryTab] Local list delete operation started"
                  );
                  console.log(
                    "[DictionaryTab] Raw parameters - index:",
                    index,
                    "type:",
                    typeof index
                  );
                  console.log("[DictionaryTab] Raw parameters - item:", item);
                  console.log(
                    "[DictionaryTab] Raw parameters - itemStringified:",
                    JSON.stringify(item)
                  );
                  console.log(
                    "[DictionaryTab] Raw parameters - itemKeys:",
                    item ? Object.keys(item) : "null"
                  );

                  try {
                    // item.idがある場合は編集タブと同じパターンで削除
                    if (item?.id !== undefined) {
                      console.log(
                        "[DictionaryTab] Using item.id for deletion:",
                        item.id
                      );
                      console.log("[DictionaryTab] Item details:", {
                        item,
                        itemId: item.id,
                        itemPrompt: item.prompt,
                        itemData: item.data,
                      });
                      console.log(
                        "[DictionaryTab] LocalPromptList length:",
                        AppState.data.localPromptList.length
                      );
                      console.log("[DictionaryTab] LocalPromptList sample:");
                      AppState.data.localPromptList
                        .slice(0, 3)
                        .forEach((localItem, idx) => {
                          console.log(`  [${idx}]:`, localItem);
                          console.log(
                            `  [${idx}] stringified:`,
                            JSON.stringify(localItem)
                          );
                          console.log(
                            `  [${idx}] id:`,
                            localItem?.id,
                            "type:",
                            typeof localItem?.id
                          );
                        });

                      // プロンプト値とデータで一致する要素を検索（IDは表示用のため使用しない）
                      const itemIndex = AppState.data.localPromptList.findIndex(
                        (localItem) =>
                          localItem.prompt === item.prompt &&
                          localItem.data &&
                          item.data &&
                          localItem.data[0] === item.data[0] &&
                          localItem.data[1] === item.data[1] &&
                          localItem.data[2] === item.data[2]
                      );

                      console.log(
                        "[DictionaryTab] Search result - itemIndex:",
                        itemIndex
                      );

                      if (itemIndex !== -1) {
                        console.log(
                          "[DictionaryTab] Found item at index:",
                          itemIndex
                        );
                        AppState.data.localPromptList.splice(itemIndex, 1);
                        await saveLocalList(false);

                        // DOM要素削除
                        const element = document.querySelector(
                          `[data-element-id="${item.id}"]`
                        );
                        if (element) {
                          element.remove();
                        }

                        // 統計更新
                        this.updateStats();
                        console.log(
                          "[DictionaryTab] Delete operation completed successfully"
                        );
                      } else {
                        console.warn(
                          "[DictionaryTab] Item not found in localPromptList:",
                          {
                            searchedItem: item,
                            searchedId: item.id,
                            localPromptListItems:
                              AppState.data.localPromptList.map(
                                (localItem) => ({
                                  id: localItem.id,
                                  prompt: localItem.prompt,
                                  hasId: "id" in localItem,
                                })
                              ),
                          }
                        );
                      }

                      return false; // ListManagerフローをスキップ
                    }

                    // フォールバック：indexベースの削除
                    console.log(
                      "[DictionaryTab] Using index-based deletion as fallback"
                    );
                    if (
                      index >= 0 &&
                      index < AppState.data.localPromptList.length
                    ) {
                      AppState.data.localPromptList.splice(index, 1);
                      await saveLocalList(false);

                      this.updateStats();
                      console.log(
                        "[DictionaryTab] Fallback delete operation completed"
                      );
                    } else {
                      console.error(
                        "[DictionaryTab] Invalid index for fallback:",
                        index
                      );
                    }

                    return false; // ListManagerフローをスキップ
                  } catch (error) {
                    console.error(
                      "[DictionaryTab] Error in delete operation:",
                      error
                    );
                    return false; // エラー時もListManagerフローをスキップ
                  }
                },
                onSort: async (sortedIds) => {
                  await this.listManager.handleSortCommon(
                    sortedIds,
                    AppState.data.localPromptList,
                    async () => {
                      // ソート後にローカルプロンプトリストのID整合性を確保（ソート問題解決）
                      if (window.ensureLocalPromptIntegrity) {
                        await window.ensureLocalPromptIntegrity(true); // 保存も同時実行
                      } else {
                        await saveLocalList();
                      }
                    }
                  );
                },
                setupSpecialFeatures: ($li, inputs) => {
                  // 入力フィールドのクリア機能設定
                  inputs.forEach((input, idx) => {
                    if (idx < 3) {
                      // カテゴリーフィールドのみ
                      EventHandlers.addInputClearBehavior(input);
                    }
                  });
                },
              };

              // FlexibleElementManagerに現在のリスト設定を通知
              if (this.flexibleElementManager) {
                this.flexibleElementManager.setCurrentList(
                  DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
                  listConfig
                );
              }

              await this.listManager.createFlexibleList(
                sortedWithIds,
                DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
                listConfig
              );
            },
          },
          master: {
            listId: DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
            containerId: "#masterDicContainer",
            textId: "#masterDicText",
            openText: DICTIONARY_TEXTS.MASTER.OPEN,
            closeText: DICTIONARY_TEXTS.MASTER.CLOSE,
            createFunc: async () => {
              try {
                const masterData = getMasterPrompts();
                console.log(
                  `Loading master dictionary: ${masterData.length} items`
                );

                if (!masterData || masterData.length === 0) {
                  console.warn("Master data is empty or not available");
                  // 空のリストを表示
                  await this.listManager.createFlexibleList(
                    [],
                    DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
                    {
                      fields: STANDARD_CATEGORY_FIELDS,
                      buttons: STANDARD_BUTTONS,
                      showHeaders: true,
                      readonly: true,
                      header: {
                        title: "要素辞書（マスター）- データなし",
                        icon: "🏛️",
                      },
                      containerHeight: 500,
                      virtualScroll: false,
                    }
                  );
                  return;
                }

                // DOM更新用のIDを付与
                const masterDataWithIds = masterData.map((item, index) => ({
                  ...item,
                  id: `dict-master-${index}`,
                }));

                await this.listManager.createFlexibleList(
                  masterDataWithIds,
                  DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
                  {
                    fields: STANDARD_CATEGORY_FIELDS,
                    buttons: STANDARD_BUTTONS,
                    showHeaders: true,
                    readonly: true,
                    header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
                    containerHeight: 500,
                    virtualScroll: 1000, // 1000件以上で仮想スクロール（検索タブと同じ）
                    refreshCallback: async () => {
                      // 統一リフレッシュコールバック
                      await this.refreshMasterDictionary();
                    },
                  }
                );

                console.log("Master dictionary list created successfully");
              } catch (error) {
                console.error("Error creating master dictionary:", error);
                // エラー時は空のリストを表示
                await this.listManager.createFlexibleList(
                  [],
                  DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
                  {
                    fields: STANDARD_CATEGORY_FIELDS,
                    buttons: STANDARD_BUTTONS,
                    showHeaders: true,
                    readonly: true,
                    header: {
                      title: "要素辞書（マスター）- エラー",
                      icon: "❌",
                    },
                    containerHeight: 500,
                    virtualScroll: false,
                  }
                );
              }
            },
          },
        };

        const config = configs[type];
        const $list = $(config.listId);
        const $text = $(config.textId);
        const $container = $(config.containerId);

        // コンテナから親のセクションとヘッダーを取得
        const container = document.querySelector(config.containerId);
        const section = container
          ? container.closest(DICTIONARY_SELECTORS.RESULTS_SECTION)
          : null;
        const header = section
          ? section.querySelector(DICTIONARY_SELECTORS.CLICKABLE_HEADER)
          : null;
        const toggleIcon = header
          ? header.querySelector(DICTIONARY_SELECTORS.TOGGLE_ICON)
          : null;

        const isExpanded = this.dictionaryStates[type];
        const toggleId = `TOGGLE_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 5)}`;

        console.log(
          `[${toggleId}] Toggle ${type}: isExpanded=${isExpanded}, container=${!!container}, section=${!!section}, header=${!!header}`
        );
        console.log(`[${toggleId}] Container selector: ${config.containerId}`);
        console.log(
          `[${toggleId}] Current dictionary states:`,
          this.dictionaryStates
        );

        if (isExpanded) {
          // 閉じる
          console.log(`[${toggleId}] Closing ${type} dictionary...`);
          if (config.listId) {
            ListBuilder.clearList(config.listId);
          }
          $container.removeClass("expanded");
          if (header) header.setAttribute("data-expanded", "false");
          if (toggleIcon) toggleIcon.textContent = "▶";
          if ($text.length && config.closeText) $text.text(config.closeText);
          this.dictionaryStates[type] = false;
          console.log(
            `[${toggleId}] ${type} dictionary closed. New state: ${this.dictionaryStates[type]}`
          );
        } else {
          // 開く
          console.log(`[${toggleId}] Opening ${type} dictionary...`);
          if (config.createFunc) {
            console.log(`[${toggleId}] Executing createFunc for ${type}...`);
            await config.createFunc();
            console.log(`[${toggleId}] createFunc completed for ${type}`);
          }
          $container.addClass("expanded");
          if (header) header.setAttribute("data-expanded", "true");
          if (toggleIcon) toggleIcon.textContent = "▼";
          if ($text.length && config.openText) $text.text(config.openText);
          this.dictionaryStates[type] = true;
          console.log(
            `[${toggleId}] ${type} dictionary opened. New state: ${this.dictionaryStates[type]}`
          );

          // 開いた後に統計を更新
          setTimeout(() => {
            this.updateStats();
          }, ADDITIONAL_DELAYS.ELEMENT_UPDATE);
        }

        // 統計情報を更新
        this.updateStats();
      }

      /**
       * お気に入りリストリストを更新（複数辞書システム対応）
       */
      async refreshFavoriteList() {
        const debugId = `REFRESH_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 5)}`;
        console.log(`[${debugId}] === refreshFavoriteList START ===`);

        const currentDictId =
          AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
        console.log(`[${debugId}] Current dictionary ID:`, currentDictId);

        const currentDict = AppState.data.promptDictionaries?.[currentDictId];
        console.log(`[${debugId}] Current dictionary:`, currentDict);

        // promptsプロパティを使用（統一された構造）
        const prompts = currentDict?.prompts || [];
        console.log(`[${debugId}] Prompts array:`, prompts.length, prompts);

        if (!currentDict) {
          console.log(`[${debugId}] ERROR: No current dictionary found`);
          return;
        }

        // 空の辞書でも表示を更新するため、returnは削除
        if (prompts.length === 0) {
          console.log(
            `[${debugId}] WARNING: No prompts found in dictionary - showing empty list`
          );
        }

        // 新UIの場合は常に更新（dictionaryStatesのチェックを削除）
        console.log(`[${debugId}] Updating favorite list...`);

        // 新UIでは常に更新する
        console.log(
          `[${debugId}] Dictionary is open, proceeding with list creation...`
        );
        // ヘッダークリックソート中の場合は、元の順序を保持
        const listManager = this.listManager;
        const sortState = listManager?.sortStates?.get('#favoriteList-list');
        const isHeaderSorted = sortState && sortState.column && sortState.direction;
        
        console.log(`[${debugId}] Header sort state:`, sortState);
        console.log(`[${debugId}] Is header sorted:`, isHeaderSorted);
        
        const sorted = isHeaderSorted 
          ? [...prompts] // ヘッダーソート中は順序を保持
          : [...prompts].sort((a, b) => (a.sort || 0) - (b.sort || 0)); // 通常は元の順序
          console.log(`[${debugId}] Sorted prompts:`, sorted.length);

          // 永続IDを確保（辞書タブソート問題解決のため）
          console.log(`[${debugId}] Ensuring dictionary element IDs...`);
          const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);
          console.log(
            `[${debugId}] Items with IDs:`,
            sortedWithIds.length,
            sortedWithIds
          );

          // DOM要素の存在確認
          const favoriteListElement = document.querySelector(
            DOM_SELECTORS.BY_ID.FAVORITE_LIST
          );
          console.log(
            `[${debugId}] Favorit list DOM element:`,
            !!favoriteListElement,
            favoriteListElement
          );

          console.log(
            `[${debugId}] Calling createFlexibleList with ${sortedWithIds.length} items...`
          );
          try {
            const refreshFavoriteConfig = {
              fields: FAVORITE_FIELDS,
              buttons: FAVORITE_BUTTONS,
              sortable: true,
              listType: FLEXIBLE_LIST_TYPES.FAVORITE, // リアルタイム更新用
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT, // ⭐️ お気に入りリスト
              // ヘッダークリックソート機能を有効化
              headerClickSort: {
                enabled: true,
                listManager: this.listManager,
                dataArray: prompts, // 現在の辞書のプロンプト配列
                refreshCallback: async () => await this.refreshFavoriteList(),
                saveCallback: async () => await savePromptDictionaries()
              },
              refreshCallback: async () => {
                // 統一リフレッシュコールバック
                await this.refreshFavoriteList();
              },
              // FlexibleElementManager用の削除コールバック
              removeElementFromData: async (elementId) => {
                console.log('[DictionaryTab] removeElementFromData called (refresh):', elementId);
                const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                const currentDict = AppState.data.promptDictionaries[currentDictId];
                
                if (currentDict && currentDict.prompts) {
                  const index = currentDict.prompts.findIndex(item => item.id === elementId);
                  if (index !== -1) {
                    currentDict.prompts.splice(index, 1);
                    await savePromptDictionaries();
                    console.log('[DictionaryTab] Element removed from data (refresh):', elementId);
                    return true;
                  }
                }
                return false;
              },
              // Enter/Blurのみで実行される統一コールバック
              onEnterBlurChange: async (
                index,
                fieldKey,
                value,
                item,
                eventType
              ) => {
                console.log(
                  `[DictionaryTab] Favorite refresh ${eventType} triggered:`,
                  {
                    index,
                    fieldKey,
                    value,
                  }
                );

                // FlexibleElementManagerを使用して更新
                if (this.flexibleElementManager && item?.id) {
                  await this.flexibleElementManager.updateFieldOnly(
                    item.id,
                    fieldKey,
                    value
                  );
                }

                // データ層を直接更新
                if (index >= 0 && index < prompts.length) {
                  if (fieldKey === "title") {
                    prompts[index].title = value;
                  } else if (fieldKey === "prompt") {
                    prompts[index].prompt = value;
                  }
                  await savePromptDictionaries();
                }
              },
              onDelete: async (index, item) => {
                // FlexibleElementManagerを使用した削除（スクロール位置保持）
                if (this.flexibleElementManager && item?.id) {
                  const success =
                    await this.flexibleElementManager.removeElement(item.id);
                  if (success) {
                    return false; // ListManagerフローをスキップ
                  }
                }

                // フォールバック：従来の削除処理
                const actualIndex = prompts.findIndex(
                  (favorite) =>
                    favorite.title === item.title &&
                    favorite.prompt === item.prompt
                );
                if (actualIndex !== -1) {
                  prompts.splice(actualIndex, 1);
                  prompts.forEach((favorite, idx) => {
                    favorite.sort = idx;
                  });
                  await savePromptDictionaries();
                  this.updateStats();
                }
              },
              onSort: async (sortedIds) => {
                await this.listManager.handleSortCommon(
                  sortedIds,
                  prompts,
                  async () => {
                    // ソート後にお気に入りリストのID整合性を確保してから保存（ソート問題解決）
                    if (window.ensureDictionaryElementIds) {
                      const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                      const currentDict = AppState.data.promptDictionaries[currentDictId];
                      if (currentDict && currentDict.prompts) {
                        currentDict.prompts = window.ensureDictionaryElementIds(currentDict.prompts);
                      }
                    }
                    await savePromptDictionaries();
                  }
                );
              },
            };

            // FlexibleElementManagerに現在のリスト設定を通知
            if (this.flexibleElementManager) {
              this.flexibleElementManager.setCurrentList(
                DOM_SELECTORS.BY_ID.FAVORITE_LIST,
                refreshFavoriteConfig
              );
            }

            // デバッグログを追加（バグ調査用）
            const sampleItems = sortedWithIds.slice(0, 3).map(item => `{id:"${item.id}", prompt:"${item.prompt || ''}", data:[${item.data?.join(', ') || ''}]}`);
            console.log(`[DICT_LIST_DEBUG] 📋 Creating favorite list: itemCount=${sortedWithIds.length}, sampleItems=[${sampleItems.join(' | ')}], editPromptElementsCount=${editPrompt?.elements?.length || 0}, containerElement="${DOM_SELECTORS.BY_ID.FAVORITE_LIST}"`);

            await this.listManager.createFlexibleList(
              sortedWithIds,
              DOM_SELECTORS.BY_ID.FAVORITE_LIST,
              {
                ...refreshFavoriteConfig,
                idOffset: ID_OFFSETS.FAVORITES
              }
            );
            console.log(
              `[${debugId}] createFlexibleList completed successfully`
            );
            
            console.log(`[DICT_LIST_DEBUG] ✅ Favorite list creation completed: itemCount=${sortedWithIds.length}, editPromptElementsAfter=${editPrompt?.elements?.length || 0}`);
        } catch (error) {
          console.error(`[${debugId}] ERROR in createFlexibleList:`, error);
          throw error;
        }

        console.log(`[${debugId}] === refreshFavoriteList END ===`);
      }

      /**
       * マスター辞書を更新
       */
      async refreshMasterDictionary() {
        console.log("refreshMasterDictionary called");
        
        try {
          const masterData = getMasterPrompts();
          console.log("Master data count:", masterData.length);
          
          // DOM更新用のIDを付与
          const masterDataWithIds = masterData.map((item, index) => ({
            ...item,
            id: `dict-master-${index}`,
          }));
          
          // マスター辞書リストを更新
          await this.listManager.createFlexibleListWithHeader(
            masterDataWithIds,
            DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
            {
              fields: STANDARD_CATEGORY_FIELDS,
              buttons: [{ type: "register" }],
              showHeaders: true,
              readonly: true, // マスター辞書は読み取り専用
              sortable: false,
              listType: FLEXIBLE_LIST_TYPES.MASTER,
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
              refreshCallback: async () => {
                await this.refreshMasterDictionary();
              },
              idOffset: ID_OFFSETS.MASTER_DICTIONARY,
            }
          );
          
          console.log("Master dictionary updated successfully");
        } catch (error) {
          console.error("Error refreshing master dictionary:", error);
          // エラー時は空のリストを作成
          await this.listManager.createFlexibleListWithHeader(
            [],
            DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
            {
              fields: STANDARD_CATEGORY_FIELDS,
              buttons: [{ type: "register" }],
              showHeaders: true,
              readonly: true,
              sortable: false,
              listType: FLEXIBLE_LIST_TYPES.MASTER,
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
              idOffset: ID_OFFSETS.MASTER_DICTIONARY,
            }
          );
        }
      }

      /**
       * 追加リストを更新
       */
      async refreshAddList() {
        const refreshOperationId = `REFRESH_LOCAL_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        if (AppState.config.debugMode) {
          console.log(`[🔄 ${refreshOperationId}] ===== REFRESH LOCAL LIST START =====`);
          console.log(`[🔄 ${refreshOperationId}] localPromptList length: ${AppState.data.localPromptList.length}`);
          console.log(`[🔄 ${refreshOperationId}] localPromptList contents BEFORE refresh:`, 
            AppState.data.localPromptList.map((item, idx) => ({
              index: idx,
              id: item?.id,
              sort: item?.sort,
              data: item?.data,
              prompt: item?.prompt?.substring(0, 20) + '...'
            }))
          );
        }

        // 新UIでは常に更新する
        // ヘッダークリックソート中の場合は、元の順序を保持
        const listManager = this.listManager;
        const sortState = listManager?.sortStates?.get('#addPromptList-list');
        const isHeaderSorted = sortState && sortState.column && sortState.direction;
        
        if (AppState.config.debugMode) {
          console.log(`[🔄 ${refreshOperationId}] Header sort state:`, sortState);
          console.log(`[🔄 ${refreshOperationId}] Is header sorted:`, isHeaderSorted);
        }
        
        const sorted = isHeaderSorted 
          ? [...AppState.data.localPromptList] // ヘッダーソート中は順序を保持
          : [...AppState.data.localPromptList].sort((a, b) => (a.sort || 0) - (b.sort || 0)); // 通常は元の順序

          // 永続IDを確保（編集タブと同じ方式でソート問題解決）
          const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

          console.log(
            "Updating local elements list with",
            sortedWithIds.length,
            "items"
          );

          const refreshListConfig = {
            fields: STANDARD_CATEGORY_FIELDS, // 元の定義を使用（item.promptで正しく動作）
            buttons: [...STANDARD_BUTTONS, { type: "delete" }],
            sortable: true,
            listType: FLEXIBLE_LIST_TYPES.ADD, // リアルタイム更新用
            header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT, // 💾 ユーザー辞書
            // ヘッダークリックソート機能を有効化
            headerClickSort: {
              enabled: true,
              listManager: this.listManager,
              dataArray: AppState.data.localPromptList,
              refreshCallback: async () => await this.refreshAddList(),
              saveCallback: async () => await saveLocalList()
            },
            refreshCallback: async () => {
              // 統一リフレッシュコールバック
              await this.refreshAddList();
            },
            // カスタムドロップダウン用のカテゴリーチェーン設定（共通定数使用）
            ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
            // Enter/Blurで自動保存を追加
            onEnterBlurChange: async (
              index,
              fieldKey,
              value,
              item,
              eventType
            ) => {
              console.log(
                `[DictionaryTab] Local element refresh ${eventType} triggered:`,
                {
                  index,
                  fieldKey,
                  value,
                  item: item,
                  currentData: AppState.data.localPromptList[index],
                }
              );

              // FlexibleElementManagerを使用して更新（無限ループ防止）
              if (this.flexibleElementManager && item?.id && eventType !== 'blur_from_flexible_manager') {
                await this.flexibleElementManager.updateFieldOnly(
                  item.id,
                  fieldKey,
                  value
                );
              }

              // データ層を直接更新
              if (index >= 0 && index < AppState.data.localPromptList.length) {
                if (fieldKey === "data" && Array.isArray(value)) {
                  AppState.data.localPromptList[index].data = value;
                } else if (fieldKey === "prompt") {
                  // プロンプトフィールド（item.prompt）
                  AppState.data.localPromptList[index].prompt = value;
                } else if (fieldKey === "data.0") {
                  // 大項目
                  AppState.data.localPromptList[index].data[0] = value;
                } else if (fieldKey === "data.1") {
                  // 中項目
                  AppState.data.localPromptList[index].data[1] = value;
                } else if (fieldKey === "data.2") {
                  // 小項目
                  AppState.data.localPromptList[index].data[2] = value;
                } else if (
                  AppState.data.localPromptList[index].data &&
                  typeof AppState.data.localPromptList[index].data === "object"
                ) {
                  if (typeof fieldKey === "number") {
                    AppState.data.localPromptList[index].data[fieldKey] = value;
                  }
                }
                await saveLocalList(false); // リフレッシュなしで保存
                console.log(
                  `[DictionaryTab] After refresh save - Updated data:`,
                  {
                    updatedItem: AppState.data.localPromptList[index],
                    fieldKey: fieldKey,
                    value: value,
                  }
                );
              }
            },
            onDelete: async (index, item) => {
              // この削除処理は実際にはユーザー辞書（element）として使われている
              // ユーザー辞書の削除処理と同じ処理を適用
              console.log(
                "[DictionaryTab] Element (user dictionary) delete operation started:",
                {
                  index,
                  item,
                  itemId: item?.id,
                }
              );

              try {
                // item.idがある場合はプロンプト値で削除
                if (item?.id !== undefined) {
                  console.log(
                    "[DictionaryTab] Using item data for element deletion"
                  );

                  // プロンプト値とデータで一致する要素を検索（ユーザー辞書用）
                  const itemIndex = AppState.data.localPromptList.findIndex(
                    (localItem) =>
                      localItem.prompt === item.prompt &&
                      localItem.data &&
                      item.data &&
                      localItem.data[0] === item.data[0] &&
                      localItem.data[1] === item.data[1] &&
                      localItem.data[2] === item.data[2]
                  );

                  console.log(
                    "[DictionaryTab] Element search result - itemIndex:",
                    itemIndex
                  );

                  if (itemIndex !== -1) {
                    console.log(
                      "[DictionaryTab] Found element at index:",
                      itemIndex
                    );
                    AppState.data.localPromptList.splice(itemIndex, 1);
                    await saveLocalList(false);

                    // DOM要素削除
                    const element = document.querySelector(
                      `[data-element-id="${item.id}"]`
                    );
                    if (element) {
                      element.remove();
                    }

                    console.log(
                      "[DictionaryTab] Element delete operation completed successfully"
                    );
                  } else {
                    console.warn(
                      "[DictionaryTab] Element not found in localPromptList:",
                      item
                    );
                  }

                  return false; // ListManagerフローをスキップ
                }

                // フォールバック：indexベースの削除
                console.log(
                  "[DictionaryTab] Using index-based element deletion as fallback"
                );
                if (
                  index >= 0 &&
                  index < AppState.data.localPromptList.length
                ) {
                  AppState.data.localPromptList.splice(index, 1);
                  await saveLocalList(false);

                  console.log(
                    "[DictionaryTab] Fallback element delete operation completed"
                  );
                } else {
                  console.error(
                    "[DictionaryTab] Invalid index for element fallback:",
                    index
                  );
                }
              } catch (error) {
                console.error(
                  "[DictionaryTab] Error in element delete operation:",
                  error
                );
              }

              return false; // ListManagerフローをスキップ
            },
            onSort: async (sortedIds) => {
              await this.listManager.handleSortCommon(
                sortedIds,
                AppState.data.localPromptList,
                async () => {
                  // ソート後にローカルプロンプトリストのID整合性を確保（ソート問題解決）
                  if (window.ensureLocalPromptIntegrity) {
                    await window.ensureLocalPromptIntegrity(true); // 保存も同時実行
                  } else {
                    await saveLocalList();
                  }
                }
              );
            },
          };

          // FlexibleElementManagerに現在のリスト設定を通知
          if (this.flexibleElementManager) {
            this.flexibleElementManager.setCurrentList(
              DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
              refreshListConfig
            );
          }

          if (AppState.config.debugMode) {
            console.log(`[🔄 ${refreshOperationId}] Creating flexible list with ${sortedWithIds.length} items...`);
          }
          
          await this.listManager.createFlexibleList(
            sortedWithIds,
            DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
            {
              ...refreshListConfig,
              idOffset: ID_OFFSETS.USER_DICTIONARY
            }
          );
          
          if (AppState.config.debugMode) {
            console.log(`[🔄 ${refreshOperationId}] ===== REFRESH LOCAL LIST END =====`);
          }
      }

      /**
       * 辞書データの統計情報を取得
       * @returns {Object} 統計情報
       */
      getDictionaryStats() {
        // データの初期化チェック
        if (!AppState.data.promptDictionaries) {
          return {
            favorits: 0,
            localElements: AppState.data.localPromptList?.length || 0,
            masterElements: 0,
            openDictionaries: 0,
          };
        }

        const currentDictId =
          AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
        const currentDict = AppState.data.promptDictionaries[currentDictId];
        
        // prompts プロパティを確認
        const favoritsCount = currentDict?.prompts?.length || 0;
        
        return {
          favorits: favoritsCount,
          localElements: AppState.data.localPromptList?.length || 0,
          masterElements: typeof getMasterPrompts === 'function' ? getMasterPrompts().length : 0,
          openDictionaries: Object.values(this.dictionaryStates).filter(
            (state) => state
          ).length,
        };
      }

      /**
       * クイック検索機能（将来の拡張用）
       * @param {string} keyword - 検索キーワード
       */
      quickSearch(keyword) {
        // 将来的に辞書内のクイック検索を実装
        console.log("Quick search not implemented yet:", keyword);
      }

      /**
       * タブのリフレッシュ
       */
      async onRefresh() {
        // 現在アクティブな辞書のみリフレッシュ
        if (this.currentDictionary) {
          switch (this.currentDictionary) {
            case 'favorite':
              await this.refreshFavoriteList();
              break;
            case 'local':
              await this.refreshAddList();
              break;
            case 'master':
              await this.refreshMasterDictionary();
              break;
          }
        }
      }

      /**
       * 統計情報を更新
       */
      updateStats() {
        const stats = this.getDictionaryStats();

        // DOM要素を取得
        const favoriteCountEl = document.getElementById("archive-count");
        const localCountEl = document.getElementById("local-count");
        const masterCountEl = document.getElementById("master-count");

        // お気に入り数を更新
        if (favoriteCountEl) {
          favoriteCountEl.textContent = stats.favorits;
          // 大きな数の場合は省略表示
          if (stats.favorits > 999) {
            favoriteCountEl.textContent =
              (stats.favorits / 1000).toFixed(1) + "k";
          }
        }

        // ローカル要素数を更新
        if (localCountEl) {
          localCountEl.textContent = stats.localElements;
          if (stats.localElements > 999) {
            localCountEl.textContent =
              (stats.localElements / 1000).toFixed(1) + "k";
          }
        }

        // マスター要素数を更新
        if (masterCountEl) {
          masterCountEl.textContent = stats.masterElements;
          if (stats.masterElements > 999) {
            masterCountEl.textContent =
              (stats.masterElements / 1000).toFixed(1) + "k";
          }
        }

        console.log("Dictionary stats updated:", stats);
      }

      /**
       * タブ表示時に統計情報を更新
       */
      async onShow() {
        // 統計情報を更新
        this.updateStats();
        
        // デバッグ用：編集タブのDOM状態をチェック
        this.checkEditTabDOMState();

        // 少し遅延を入れてからデータを再確認して統計を更新
        setTimeout(() => {
          this.updateStats();
        }, ADDITIONAL_DELAYS.SHORT_DELAY);

        // 現在のアクティブ辞書を更新
        setTimeout(() => {
          if (this.currentDictionary) {
            console.log(`[DictionaryTab] Restoring previous dictionary: ${this.currentDictionary}`);
            this.switchDictionaryTab(this.currentDictionary);
          } else {
            this.switchDictionaryTab('favorite');
          }
        }, 200);
      }

      /**
       * ダウンロードボタンの設定
       */
      setupDownloadButtons() {
        // お気に入りリストダウンロード
        const promptDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_DOWNLOAD
        );
        if (promptDownload) {
          this.addEventListener(promptDownload, "click", () => {
            const currentDictId =
              AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
            const currentDict =
              AppState.data.promptDictionaries?.[currentDictId];
            const prompts = currentDict?.prompts || [];
            this.jsonDownload(prompts, EXPORT_FILE_NAMES.PROMPT_DICTIONARY);
          });
        }

        // ローカル辞書ダウンロード
        const localDicDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DOWNLOAD
        );
        if (localDicDownload) {
          this.addEventListener(localDicDownload, "click", () => {
            this.jsonDownload(AppState.data.localPromptList, EXPORT_FILE_NAMES.USER_DICTIONARY);
          });
        }

        // CSV エクスポート（CSV ハンドラーは他タブで設定済み）

        // 各アコーディオン内のダウンロードボタン
        this.setupAccordionDownloadButtons();
      }

      /**
       * 各アコーディオン内のダウンロードボタン設定
       */
      setupAccordionDownloadButtons() {
        // お気に入りリストダウンロード（複数辞書対応）
        const promptDictDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_DICT_DOWNLOAD
        );
        if (promptDictDownload) {
          this.addEventListener(promptDictDownload, "click", () => {
            // 現在選択中の辞書のプロンプトをダウンロード
            const currentDictId =
              AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
            const currentDict =
              AppState.data.promptDictionaries?.[currentDictId];
            const currentData = currentDict?.prompts || [];
            const currentDictName = currentDict?.name || "メインリスト";

            this.jsonDownload(currentData, EXPORT_FILE_NAMES.PROMPT_DICTIONARY, currentDictName);
          });
        }

        // ローカル辞書 JSON ダウンロード
        const localDictJsonDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_JSON_DOWNLOAD
        );
        if (localDictJsonDownload) {
          this.addEventListener(localDictJsonDownload, "click", () => {
            this.jsonDownload(AppState.data.localPromptList, EXPORT_FILE_NAMES.USER_DICTIONARY);
          });
        }

        // ローカル辞書 CSV ダウンロード
        const localDictCsvDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_CSV_DOWNLOAD
        );
        if (localDictCsvDownload) {
          this.addEventListener(localDictCsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(
                AppState.data.localPromptList,
                "csv",
                "elements"
              );
            }
          });
        }

        // ローカル辞書 TSV ダウンロード
        const localDictTsvDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_TSV_DOWNLOAD
        );
        if (localDictTsvDownload) {
          this.addEventListener(localDictTsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(
                AppState.data.localPromptList,
                "tsv",
                "elements"
              );
            }
          });
        }

        // お気に入りリスト CSV ダウンロード
        const promptDictCsvDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_CSV_DOWNLOAD
        );
        if (promptDictCsvDownload) {
          this.addEventListener(promptDictCsvDownload, "click", async () => {
            if (window.csvHandler) {
              const currentDictId =
                AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict =
                AppState.data.promptDictionaries?.[currentDictId];
              const prompts = currentDict?.prompts || [];
              const currentDictName = currentDict?.name || "メインリスト";
              await window.csvHandler.exportToCSV(prompts, "csv", "prompts", currentDictName);
            }
          });
        }

        // お気に入りリスト TSV ダウンロード
        const promptDictTsvDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_TSV_DOWNLOAD
        );
        if (promptDictTsvDownload) {
          this.addEventListener(promptDictTsvDownload, "click", async () => {
            if (window.csvHandler) {
              const currentDictId =
                AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict =
                AppState.data.promptDictionaries?.[currentDictId];
              const prompts = currentDict?.prompts || [];
              const currentDictName = currentDict?.name || "メインリスト";
              await window.csvHandler.exportToCSV(prompts, "tsv", "prompts", currentDictName);
            }
          });
        }

        // マスター辞書 CSV ダウンロード
        const masterDictCsvDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_CSV_DOWNLOAD
        );
        if (masterDictCsvDownload) {
          this.addEventListener(masterDictCsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(
                getMasterPrompts(),
                "csv",
                "master"
              );
            }
          });
        }

        // マスター辞書 TSV ダウンロード
        const masterDictTsvDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_TSV_DOWNLOAD
        );
        if (masterDictTsvDownload) {
          this.addEventListener(masterDictTsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(
                getMasterPrompts(),
                "tsv",
                "master"
              );
            }
          });
        }

        // マスター辞書ダウンロード
        const masterDictDownload = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_DICT_DOWNLOAD
        );
        if (masterDictDownload) {
          this.addEventListener(masterDictDownload, "click", () => {
            this.jsonDownload(getMasterPrompts(), EXPORT_FILE_NAMES.MASTER_DICTIONARY);
          });
        }
      }

      /**
       * JSONファイルをダウンロード
       */
      async jsonDownload(data, filename, dictName = null) {
        // 空データの場合のトースト通知
        if (!data || data.length === 0) {
          if (window.ErrorHandler) {
            window.ErrorHandler.showToast(
              'JSONファイルをエクスポートしました（データが空のため、ヘッダー情報のみです）',
              3000,
              'info'
            );
          }
        }
        
        // FileHandlerが期待する形式に変換
        let dicType;
        if (filename === EXPORT_FILE_NAMES.PROMPT_DICTIONARY) {
          dicType = DATA_TYPES.PROMPTS;
        } else if (filename === EXPORT_FILE_NAMES.MASTER_DICTIONARY) {
          dicType = "Master"; // マスター辞書用の特別な型
        } else {
          dicType = DATA_TYPES.ELEMENTS;
        }
        const formattedData = {
          dicType: dicType,
          data: data,
          version: AppState.config.toolVersion || 5,
          exportDate: new Date().toISOString(),
          dictionaryName: dictName || filename,
        };

        // 共通のファイル名生成ロジックを使用
        let dataType;
        if (dicType === DATA_TYPES.PROMPTS) {
          dataType = "prompts";
        } else if (dicType === "Master") {
          dataType = "master";
        } else {
          dataType = "elements";
        }
        const baseName = ExportFilenameGenerator.generateBaseName(dataType, dictName);

        const downloadFilename = FileUtilities.generateTimestampedFilename(
          baseName,
          "json"
        );

        // FileUtilitiesを使用してダウンロード
        await FileUtilities.downloadJSON(formattedData, downloadFilename);
      }

      /**
       * インポートボタンの設定
       */
      setupImportButtons() {
        // お気に入りリストインポート
        const promptDictImportBtn = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_IMPORT_BTN
        );
        const promptDictImport = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_IMPORT
        );

        if (promptDictImportBtn && promptDictImport) {
          this.addEventListener(promptDictImportBtn, "click", () => {
            promptDictImport.click();
          });

          this.addEventListener(promptDictImport, "change", async (event) => {
            const file = event.target.files[0];
            if (file) {
              await this.handleImportFile(file, "prompts");
              // ファイル選択をリセット
              event.target.value = "";
            }
          });
        }

        // ローカル辞書インポート
        const localDictImportBtn = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_IMPORT_BTN
        );
        const localDictImport = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_IMPORT
        );

        if (localDictImportBtn && localDictImport) {
          this.addEventListener(localDictImportBtn, "click", () => {
            localDictImport.click();
          });

          this.addEventListener(localDictImport, "change", async (event) => {
            const file = event.target.files[0];
            if (file) {
              await this.handleImportFile(file, "elements");
              // ファイル選択をリセット
              event.target.value = "";
            }
          });
        }
      }

      /**
       * インポートファイルの処理
       */
      async handleImportFile(file, dictType) {
        try {
          console.log(
            `[IMPORT_DEBUG] Processing file: ${file.name}, type: ${dictType}`
          );

          // ファイルサイズ検証
          const sizeValidation = Validators.validateFileSize(file, 10);
          if (!sizeValidation.isValid) {
            ErrorHandler.notify(sizeValidation.message);
            return;
          }

          // ファイル形式の判定
          const fileName = file.name.toLowerCase();
          let fileType = "json";
          if (fileName.endsWith(".csv")) {
            fileType = "csv";
          } else if (fileName.endsWith(".tsv")) {
            fileType = "tsv";
          }

          let data;
          if (fileType === "json") {
            // JSONファイルの処理
            const content = await this.readFileAsText(file);
            data = JSON.parse(content);
            console.log(`[IMPORT_DEBUG] JSON data loaded:`, data);

            await this.processDictionaryData(data, dictType);
          } else {
            // CSV/TSVファイルの処理
            const content = await this.readFileAsText(file);
            const delimiter = fileType === "tsv" ? "\t" : ",";
            data = this.parseCSVContent(content, delimiter);
            console.log(`[IMPORT_DEBUG] CSV data loaded:`, data);

            await this.processCSVData(data, dictType);
          }

          // インポート後に該当する辞書を更新（常に実行）
          if (dictType === "prompts") {
            console.log("[IMPORT_DEBUG] Refreshing favorite list after import");
            setTimeout(async () => {
              await this.refreshFavoriteList();
              this.updateDictionarySelector();
              console.log("[IMPORT_DEBUG] Favorite list refresh completed");
            }, UI_DELAYS.STANDARD_UPDATE);
          } else if (dictType === "elements") {
            console.log("[IMPORT_DEBUG] Refreshing elements list after import");
            setTimeout(async () => {
              await this.refreshAddList();
              console.log("[IMPORT_DEBUG] Elements list refresh completed");
            }, UI_DELAYS.STANDARD_UPDATE);
          }

          // 統計情報を更新
          this.updateStats();
        } catch (error) {
          console.error("Import file error:", error);
          ErrorHandler.showToast(
            `インポートに失敗しました: ${error.message}`,
            UI_DELAYS.LONG,
            "error"
          );
        }
      }

      /**
       * ファイルをテキストとして読み込み
       */
      async readFileAsText(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) =>
            reject(new Error("ファイルの読み込みに失敗しました"));
          reader.readAsText(file, "UTF-8");
        });
      }

      /**
       * CSV内容をパース
       */
      parseCSVContent(content, delimiter = ",") {
        const lines = content.split("\n").filter((line) => line.trim());
        const result = [];

        for (let i = 0; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i], delimiter);
          if (values.length > 0) {
            result.push(values);
          }
        }

        return result;
      }

      /**
       * CSV行をパース（クォート対応）
       */
      parseCSVLine(line, delimiter = ",") {
        const values = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter && !inQuotes) {
            values.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }

        values.push(current.trim());
        return values;
      }

      /**
       * 辞書データの処理
       */
      async processDictionaryData(data, dictType) {
        console.log("[IMPORT_DEBUG] Processing dictionary data:", data);
        let addCount = 0;

        // データ形式の検証と自動検出
        if (!data.dicType) {
          if (Array.isArray(data)) {
            data = { dicType: "Elements", data: data };
          } else if (data.data && Array.isArray(data.data)) {
            const firstItem = data.data[0];
            if (firstItem && firstItem.title && firstItem.prompt) {
              data.dicType = DATA_TYPES.PROMPTS;
            } else {
              data.dicType = DATA_TYPES.ELEMENTS;
            }
          } else {
            throw new Error("不正なファイル形式です");
          }
        }

        switch (data.dicType) {
          case "Elements":
            for (let i = 0; i < data.data.length; i++) {
              const item = data.data[i];
              try {
                if (registerDictionary(item, true)) {
                  addCount++;
                }
              } catch (error) {
                console.error(`Element ${i} import error:`, error);
              }
            }

            if (addCount > 0) {
              await saveLocalList();
              ErrorHandler.showToast(
                `${addCount}件の要素辞書を読み込みました`,
                3000,
                "success"
              );
            } else {
              ErrorHandler.showToast(
                "追加できる新しい要素がありませんでした",
                3000,
                "info"
              );
            }
            break;

          case DATA_TYPES.PROMPTS:
            const currentDictId =
              AppState.data.currentPromptDictionary || "main";
            for (let i = 0; i < data.data.length; i++) {
              const item = data.data[i];
              try {
                if (this.addPromptDic(item, currentDictId)) {
                  addCount++;
                }
              } catch (error) {
                console.error(`Prompt ${i} import error:`, error);
              }
            }

            if (addCount > 0) {
              await savePromptDictionaries();
              ErrorHandler.showToast(
                `${addCount}件のお気に入りリストを読み込みました`,
                3000,
                "success"
              );
            } else {
              ErrorHandler.showToast(
                "追加できる新しいプロンプトがありませんでした",
                3000,
                "info"
              );
            }
            break;

          default:
            throw new Error(`不明な辞書タイプです: ${data.dicType}`);
        }
      }

      /**
       * お気に入りリストにプロンプトを追加
       */
      addPromptDic(item, dictId = null) {
        try {
          const currentDictId =
            dictId || AppState.data.currentPromptDictionary || "main";

          // 辞書が存在しない場合は作成
          if (!AppState.data.promptDictionaries[currentDictId]) {
            AppState.data.promptDictionaries[currentDictId] = {
              id: currentDictId,
              name: currentDictId === "main" ? "メインリスト" : currentDictId,
              prompts: [],
            };
          }

          // 重複チェック
          const existingPrompts =
            AppState.data.promptDictionaries[currentDictId].prompts;
          const isDuplicate = existingPrompts.some(
            (existingItem) =>
              existingItem.title === item.title &&
              existingItem.prompt === item.prompt
          );

          if (isDuplicate) {
            console.log(
              `[IMPORT_DEBUG] Duplicate prompt skipped: ${item.title}`
            );
            return false;
          }

          // プロンプトを追加
          const newItem = {
            title: item.title || "",
            prompt: item.prompt || "",
            id: Date.now() + Math.random(), // 一意のID
            sort: existingPrompts.length,
          };

          AppState.data.promptDictionaries[currentDictId].prompts.push(newItem);
          console.log(
            `[IMPORT_DEBUG] Added prompt: ${item.title} to dictionary: ${currentDictId}`
          );
          return true;
        } catch (error) {
          console.error(`[IMPORT_DEBUG] Failed to add prompt:`, error);
          return false;
        }
      }

      /**
       * CSVデータの処理
       */
      async processCSVData(csvData, dictType) {
        console.log("[IMPORT_DEBUG] Processing CSV data:", csvData);
        let addCount = 0;

        if (dictType === "elements") {
          // 要素辞書として処理（大項目、中項目、小項目、プロンプト）
          for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            if (row.length >= 4) {
              const item = {
                data: [row[0] || "", row[1] || "", row[2] || "", row[3] || ""],
              };
              try {
                if (registerDictionary(item, true)) {
                  addCount++;
                }
              } catch (error) {
                console.error(`CSV element ${i} import error:`, error);
              }
            }
          }

          if (addCount > 0) {
            await saveLocalList();
            ErrorHandler.showToast(
              `${addCount}件の要素辞書を読み込みました`,
              3000,
              "success"
            );
          } else {
            ErrorHandler.showToast(
              "追加できる新しい要素がありませんでした",
              3000,
              "info"
            );
          }
        } else if (dictType === "prompts") {
          // お気に入りリストとして処理（タイトル、プロンプト）
          const currentDictId = AppState.data.currentPromptDictionary || "main";
          for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            if (row.length >= 2) {
              const item = {
                title: row[0] || "",
                prompt: row[1] || "",
              };
              try {
                if (this.addPromptDic(item, currentDictId)) {
                  addCount++;
                }
              } catch (error) {
                console.error(`CSV prompt ${i} import error:`, error);
              }
            }
          }

          if (addCount > 0) {
            await savePromptDictionaries();
            ErrorHandler.showToast(
              `${addCount}件のお気に入りリストを読み込みました`,
              3000,
              "success"
            );
          } else {
            ErrorHandler.showToast(
              "追加できる新しいプロンプトがありませんでした",
              3000,
              "info"
            );
          }
        }
      }

      /**
       * お気に入り追加ボタンの設定
       */
      setupFavoriteAddButton() {
        console.log('[DictionaryTab] Setting up favorite add button...');
        const addFavoriteButton = this.getElement("#addFavorite");
        console.log('[DictionaryTab] Found addFavorite button:', !!addFavoriteButton);
        
        if (addFavoriteButton) {
          this.addEventListener(addFavoriteButton, "click", async () => {
            console.log('[DictionaryTab] Favorite add button clicked!');
            await this.handleFavoriteAddition();
          });
          console.log('[DictionaryTab] Event listener added to addFavorite button');
        } else {
          console.error('[DictionaryTab] addFavorite button not found!');
        }
        
        // お気に入り追加フォームのEnterキーナビゲーション
        this.setupFavoriteEnterKeyNavigation();
      }

      /**
       * お気に入り追加フォームのEnterキーナビゲーション
       */
      setupFavoriteEnterKeyNavigation() {
        const favoriteTitle = this.getElement("#favoriteTitle");
        const favoritePrompt = this.getElement("#favoritePrompt");
        
        if (favoriteTitle) {
          this.addEventListener(favoriteTitle, "keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (favoritePrompt) {
                favoritePrompt.focus();
              }
            }
          });
        }
        
        if (favoritePrompt) {
          this.addEventListener(favoritePrompt, "keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await this.handleFavoriteAddition();
            }
          });
        }
      }

      /**
       * お気に入り追加処理
       */
      async handleFavoriteAddition() {
        console.log('[DictionaryTab] handleFavoriteAddition called');
        const titleElement = this.getElement("#favoriteTitle");
        const promptElement = this.getElement("#favoritePrompt");
        
        console.log('[DictionaryTab] Found elements:', {
          titleElement: !!titleElement,
          promptElement: !!promptElement
        });
        
        const title = titleElement?.value || "";
        const prompt = promptElement?.value || "";
        
        console.log('[DictionaryTab] Input values:', { title, prompt });
        
        // 必須項目のバリデーション
        if (!Validators.Quick.allRequired(title, prompt)) {
          console.log('[DictionaryTab] Validation failed - missing required fields');
          ErrorHandler.showToast(
            "タイトルとプロンプトを入力してください",
            UI_DELAYS.LONG,
            "error"
          );
          return;
        }
        
        // バリデーション済みの値を取得
        const trimmedValues = {
          title: title.trim(),
          prompt: prompt.trim(),
        };
        
        try {
          // 現在のお気に入り辞書を取得
          const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
          const currentDict = AppState.data.promptDictionaries[currentDictId];
          
          console.log('[DictionaryTab] Current dictionary:', currentDict);
          
          if (!currentDict) {
            ErrorHandler.showToast(
              "お気に入り辞書が見つかりません",
              UI_DELAYS.LONG,
              "error"
            );
            return;
          }
          
          // prompts配列を取得または初期化
          if (!currentDict.prompts) {
            currentDict.prompts = [];
          }
          
          // 重複チェック（既存のFavoボタンと同じ仕様）
          const validation = Validators.checkDuplicateFavorite(
            trimmedValues.prompt,
            currentDict.prompts
          );
          if (!validation.isValid) {
            ErrorHandler.showToast(validation.message, UI_DELAYS.LONG, "error");
            return;
          }

          // 新しいお気に入り項目を追加（既存のFavoボタンと同じ形式）
          const newFavorite = {
            id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: trimmedValues.title,
            prompt: trimmedValues.prompt,
            sort: currentDict.prompts.length, // ソート用インデックス
          };
          
          console.log('[DictionaryTab] Adding new favorite:', newFavorite);
          currentDict.prompts.push(newFavorite);
          
          // データを保存
          await savePromptDictionaries();
          
          // 成功メッセージ
          ErrorHandler.showToast(
            "お気に入りを追加しました",
            UI_DELAYS.LONG,
            "success"
          );
          
          // フォームをクリア
          if (titleElement) titleElement.value = "";
          if (promptElement) promptElement.value = "";
          
          // 統計を更新
          this.updateStats();
          
          // お気に入りリストが表示されている場合はリストを更新
          if (this.currentDictionary === "favorite") {
            await this.refreshFavoriteList();
          }
          
        } catch (error) {
          console.error("Failed to add favorite:", error);
          ErrorHandler.showToast(
            "お気に入りの追加に失敗しました",
            UI_DELAYS.LONG,
            "error"
          );
        }
      }

      /**
       * 要素登録の設定
       */
      setupElementRegistration() {
        const resistButton = this.getElement(`#${DOM_IDS.BUTTONS.RESIST}`);

        if (resistButton) {
          this.addEventListener(resistButton, "click", async () => {
            await this.handleElementRegistration();
          });
        } else {
          const directButton = this.getElement(
            DOM_SELECTORS.BY_ID.DICTIONARY_RESIST_BTN
          );
          if (directButton) {
            this.addEventListener(directButton, "click", async () => {
              await this.handleElementRegistration();
            });
          }
        }

        // 要素登録フォーム専用のカテゴリー連動設定
        this.setupFormCategoryChain();

        // Enterキーナビゲーション
        this.setupEnterKeyNavigation();
      }

      /**
       * 要素登録フォーム専用のカテゴリー連動設定
       */
      setupFormCategoryChain() {
        console.log(
          "[DICT_DEBUG] Setting up form category chain for element registration"
        );
        try {
          const config = this.categoryUIManager.chainConfigs.dictionary;
          if (config && config.inputFields) {
            this.categoryUIManager.setupInputFieldsChain(config.inputFields);
            console.log("[DICT_DEBUG] Form category chain setup completed");
          }
        } catch (error) {
          console.error(
            "[DICT_DEBUG] Failed to setup form category chain:",
            error
          );
        }
      }

      /**
       * Enterキーナビゲーションの設定
       */
      setupEnterKeyNavigation() {
        const inputIds = DOM_ID_ARRAYS.FORM_INPUT_ORDER;

        inputIds.forEach((id, index) => {
          const input = this.getElement(`#${id}`);
          if (input) {
            this.addEventListener(input, "keydown", async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();

                if (id === DOM_IDS.CATEGORY.PROMPT) {
                  // プロンプト入力欄でEnterを押した場合は追加実行
                  await this.handleElementRegistration();
                } else {
                  // 大中小項目では次の項目にフォーカス移動
                  const nextIndex = index + 1;
                  if (nextIndex < inputIds.length) {
                    const nextInput = this.getElement(
                      `#${inputIds[nextIndex]}`
                    );
                    if (nextInput) {
                      nextInput.focus();
                    }
                  }
                }
              }
            });
          }
        });
      }

      /**
       * 要素登録処理
       */
      async handleElementRegistration() {
        const bigElement = this.getElement(DOM_SELECTORS.BY_ID.BIG);
        const middleElement = this.getElement(DOM_SELECTORS.BY_ID.MIDDLE);
        const smallElement = this.getElement(DOM_SELECTORS.BY_ID.SMALL);
        const promptElement = this.getElement(DOM_SELECTORS.BY_ID.PROMPT);

        const big = bigElement?.value || "";
        const middle = middleElement?.value || "";
        const small = smallElement?.value || "";
        const prompt = promptElement?.value || "";

        // 必須項目のバリデーション（小項目とプロンプトのみ）
        if (!Validators.Quick.allRequired(small, prompt)) {
          ErrorHandler.showToast(
            "小項目とプロンプトを入力してください",
            UI_DELAYS.LONG,
            "error"
          );
          return;
        }

        // バリデーション済みの値を取得
        const trimmedValues = {
          big: big.trim(),
          middle: middle.trim(),
          small: small.trim(),
          prompt: prompt.trim(),
        };

        try {
          // 要素を登録
          const success = register(
            trimmedValues.big,
            trimmedValues.middle,
            trimmedValues.small,
            trimmedValues.prompt
          );

          if (success) {
            ErrorHandler.showToast(
              "要素を追加しました",
              UI_DELAYS.LONG,
              "success"
            );

            // フォームをクリア
            this.getElement(DOM_SELECTORS.BY_ID.BIG).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.MIDDLE).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.SMALL).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.PROMPT).value = "";

            // フォーカスはプロンプト入力に残す（連続入力のため）
            this.getElement(DOM_SELECTORS.BY_ID.PROMPT)?.focus();

            // 統計を更新
            this.updateStats();

            // ローカル辞書をリフレッシュ（統一UIでは常に表示されているため）
            setTimeout(async () => {
              await this.refreshAddList();
            }, UI_DELAYS.STANDARD_UPDATE);
          } else {
            ErrorHandler.showToast(
              "この要素は既に存在します",
              UI_DELAYS.LONG,
              "warning"
            );
          }
        } catch (error) {
          console.error("要素登録エラー:", error);
          ErrorHandler.showToast(
            "要素の追加に失敗しました",
            UI_DELAYS.LONG,
            "error"
          );
        }
      }

      /**
       * 複数辞書管理の設定
       */
      setupMultipleDictionaryManagement() {
        // 辞書セレクターの設定
        const dictionarySelector = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_SELECTOR
        );
        if (dictionarySelector) {
          this.addEventListener(dictionarySelector, "change", async (e) => {
            await this.switchDictionary(e.target.value);
          });
        }

        // 新規辞書追加ボタン
        const addDictionaryBtn = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_ADD_BTN
        );
        if (addDictionaryBtn) {
          this.addEventListener(addDictionaryBtn, "click", () => {
            this.showAddDictionaryForm();
          });
        }

        // 辞書管理ボタン
        const manageDictionariesBtn = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_MANAGE_BTN
        );

        if (manageDictionariesBtn) {
          this.addEventListener(manageDictionariesBtn, "click", () => {
            this.showDictionaryManagementModal();
          });
        } else {
          const directBtn = this.getElement(
            DOM_SELECTORS.BY_ID.DICTIONARY_MANAGE_BTN
          );
          if (directBtn) {
            this.addEventListener(directBtn, "click", () => {
              this.showDictionaryManagementModal();
            });
          }
        }

        // BaseModalを初期化
        this.initModal();

        // 辞書管理モーダル内のボタン
        this.setupDictionaryManagementModal();

        // 初期化時に辞書セレクターを更新
        this.updateDictionarySelector();
      }

      /**
       * BaseModalを初期化
       */
      initModal() {
        // 統一フレームでモーダルを作成
        this.dictionaryManagementModal = BaseModal.create(
          "dictionary-management-modal",
          "📚 リスト管理",
          `
          <div class="dictionary-list-section">
            <h4>既存のリスト</h4>
            <div id="dictionary-list" class="dictionary-items-list"></div>
          </div>
          <div class="dictionary-add-section">
            <h4>新しいリストを作成</h4>
            <div class="dictionary-add-form">
              <input type="text" id="new-dictionary-name" placeholder="リスト名を入力" title="お気に入りリストの名前を入力してください" />
              <button id="create-dictionary" title="新しいお気に入りリストを作成します">作成</button>
            </div>
          </div>
        `,
          {
            closeOnBackdrop: true,
            closeOnEsc: true,
            showCloseButton: true,
            showHeader: true,
            showFooter: false,
            headerActions: [
              // 新規作成ボタンを削除（コンテンツ部分に存在するため）
            ],
          }
        );

        // モーダル表示時にコンテンツを更新
        this.dictionaryManagementModal.onShow(() => {
          this.updateDictionaryList();
          // 辞書名入力フィールドにフォーカス
          setTimeout(() => {
            const nameInput = this.getElement(
              DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME
            );
            if (nameInput) {
              nameInput.focus();
            }
          }, 100);
        });
      }

      /**
       * 編集タブのDOM状態をチェック（デバッグ用）
       */
      checkEditTabDOMState() {
        try {
          console.log(`[DICT_TAB_DEBUG] 🔍 === 辞書タブ表示時の編集タブDOM状態チェック ===`);
          
          // 編集リストコンテナを取得
          const editListContainer = document.getElementById(DOM_IDS.EDIT.LIST);
          if (!editListContainer) {
            console.log(`[DICT_TAB_DEBUG] ❌ 編集リストコンテナが見つかりません`);
            return;
          }
          
          // 各要素のDOM情報を取得
          const elementContainers = editListContainer.querySelectorAll('[data-element-id]');
          console.log(`[DICT_TAB_DEBUG] 📋 辞書タブ表示時のDOM要素数: ${elementContainers.length}`);
          
          elementContainers.forEach((container, index) => {
            const elementId = container.getAttribute('data-element-id');
            
            // カテゴリ入力フィールドを取得
            const categoryInputs = container.querySelectorAll('input[data-field^="data."]');
            const domCategoryData = Array.from(categoryInputs).map(input => input.value || '');
            
            // editPrompt.elementsの対応データを取得
            const editPromptElement = editPrompt?.elements?.find(el => el.id == elementId);
            const editPromptData = editPromptElement?.data || ['', '', ''];
            
            console.log(`[DICT_TAB_DEBUG] 📝 要素${index}: elementId=${elementId}, DOM[${domCategoryData.join(', ')}], EditPrompt[${editPromptData.join(', ')}]`);
            
            // 不一致をチェック
            const categoryMismatch = JSON.stringify(domCategoryData) !== JSON.stringify(editPromptData);
            if (categoryMismatch) {
              console.log(`[DICT_TAB_DEBUG] ⚠️ 要素${index} カテゴリ不一致! DOM[${domCategoryData.join(', ')}] vs EditPrompt[${editPromptData.join(', ')}]`);
            }
          });
          
          console.log(`[DICT_TAB_DEBUG] 🔍 === 編集タブDOM状態チェック 終了 ===`);
          
        } catch (error) {
          console.error(`[DICT_TAB_DEBUG] ❌ DOM状態チェックエラー:`, error);
        }
      }

      /**
       * 辞書管理モーダルの設定
       */
      setupDictionaryManagementModal() {
        // 閉じるボタン
        const closeBtn = document.querySelector("#close-dictionary-management");
        if (closeBtn) {
          this.addEventListener(closeBtn, "click", () => {
            this.hideDictionaryManagementModal();
          });
        }

        // 作成ボタン
        const createBtn = document.querySelector("#create-dictionary");
        console.log('[DictionaryTab] Found create-dictionary button:', !!createBtn);
        if (createBtn) {
          this.addEventListener(createBtn, "click", async () => {
            console.log('[DictionaryTab] Create dictionary button clicked!');
            await this.createNewDictionary();
          });
          console.log('[DictionaryTab] Event listener added to create-dictionary button');
        } else {
          console.error('[DictionaryTab] create-dictionary button not found!');
        }

        // 辞書名入力フィールドでEnterキー対応
        const nameInput = document.querySelector("#new-dictionary-name");
        if (nameInput) {
          this.addEventListener(nameInput, "keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await this.createNewDictionary();
            }
          });
        }

        // モーダル外クリックで閉じる
        const modal = document.querySelector("#dictionary-management-modal");
        if (modal) {
          this.addEventListener(modal, "click", (e) => {
            if (e.target === modal) {
              this.hideDictionaryManagementModal();
            }
          });
        }
      }

      /**
       * 辞書セレクターを更新
       */
      updateDictionarySelector() {
        const selector = this.getElement(
          DOM_SELECTORS.BY_ID.DICTIONARY_SELECTOR
        );
        if (!selector) return;

        // 現在の選択を保存
        const currentValue = selector.value;

        // オプションをクリア
        selector.innerHTML = "";

        // 辞書一覧を適切な順序でソート（メインリストを最初に、その後は作成順）
        const sortedDictIds = Object.keys(AppState.data.promptDictionaries).sort((a, b) => {
          // メインリストを最初に
          if (a === "main") return -1;
          if (b === "main") return 1;
          
          // その他は作成順（dict_timestampのtimestamp部分で比較）
          const timestampA = a.startsWith("dict_") ? parseInt(a.replace("dict_", "")) : 0;
          const timestampB = b.startsWith("dict_") ? parseInt(b.replace("dict_", "")) : 0;
          return timestampA - timestampB;
        });

        // ソート済みの辞書一覧を追加
        sortedDictIds.forEach((dictId) => {
          const dict = AppState.data.promptDictionaries[dictId];
          const option = UIFactory.createOption({
            value: dictId,
            text: dict.name || dictId,
            selected: dictId === AppState.data.currentPromptDictionary,
          });
          selector.appendChild(option);
        });

        console.log(
          `[DICT_UI] Updated dictionary selector with ${sortedDictIds.length} dictionaries in proper order`
        );
      }

      /**
       * 辞書を切り替え
       */
      async switchDictionary(dictionaryId) {
        console.log(`[DICT_SWITCH] Switching to dictionary: ${dictionaryId}`);

        if (!AppState.data.promptDictionaries[dictionaryId]) {
          console.error(`Dictionary ${dictionaryId} not found`);
          return;
        }

        // 辞書切り替え前にローカルプロンプトリストのID整合性を確保（ソート問題解決）
        if (window.ensureLocalPromptIntegrity) {
          try {
            await window.ensureLocalPromptIntegrity(false); // 保存は辞書切り替え後に行う
            if (AppState.config.debugMode) {
              console.log(`[DICT_SWITCH] Local prompt ID integrity ensured before switching`);
            }
          } catch (error) {
            console.warn(`[DICT_SWITCH] Failed to ensure ID integrity:`, error);
          }
        }

        AppState.data.currentPromptDictionary = dictionaryId;

        // 辞書システムの状態を保存
        await savePromptDictionaries();

        console.log(`[DICT_SWITCH] Current dictionary tab: ${this.currentDictionary}`);
        
        // お気に入りタブが現在表示されている場合はリストを更新
        if (this.currentDictionary === "favorite") {
          console.log(`[DICT_SWITCH] Refreshing favorite list for dictionary change`);
          await this.refreshFavoriteList();
        } else {
          console.log(`[DICT_SWITCH] Favorite tab not active, skipping refresh`);
          // 辞書が閉じている場合も次回開いた時に正しいデータを表示するため、
          // 辞書リストをクリアして次回の開放時に最新データを読み込むように設定
          const listElement = document.querySelector(
            DOM_SELECTORS.BY_ID.FAVORITE_LIST
          );
          if (listElement) {
            listElement.innerHTML = "";
            console.log(`[DICT_SWITCH] Cleared favorite list for next refresh`);
          }
        }

        // 統計を更新
        this.updateStats();
      }

      /**
       * 新規辞書追加フォームを表示
       */
      showAddDictionaryForm() {
        const name = prompt("新しいリストの名前を入力してください:", "");
        if (Validators.Quick.isValidName(name)) {
          this.createDictionary(name.trim());
        }
      }

      /**
       * 辞書を作成
       */
      async createDictionary(name) {
        const dictId = `dict_${Date.now()}`;

        AppState.data.promptDictionaries[dictId] = {
          name: name,
          prompts: [], // 統一されたデータ構造を使用
        };

        await savePromptDictionaries();
        this.updateDictionarySelector();

        console.log(
          `[DICT_CREATE] Created new dictionary: ${name} (${dictId})`
        );
        ErrorHandler.showToast(
          `辞書「${name}」を作成しました`,
          UI_DELAYS.LONG,
          "success"
        );
      }

      /**
       * 辞書管理モーダルを表示
       */
      showDictionaryManagementModal() {
        this.dictionaryManagementModal.show();
      }

      /**
       * 辞書管理モーダルを非表示
       */
      hideDictionaryManagementModal() {
        this.dictionaryManagementModal.hide();
      }

      /**
       * 辞書一覧を更新
       */
      updateDictionaryList() {
        const container = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LIST);

        if (!container) {
          const directContainer = document.querySelector("#dictionary-list");
          if (directContainer) {
            directContainer.innerHTML = "";
            this.populateDictionaryList(directContainer);
            return;
          } else {
            return;
          }
        }

        container.innerHTML = "";
        this.populateDictionaryList(container);
      }

      populateDictionaryList(container) {
        if (!AppState.data.promptDictionaries) {
          return;
        }

        // 辞書一覧を適切な順序でソート（メインリストを最初に、その後は作成順）
        const sortedDictIds = Object.keys(AppState.data.promptDictionaries).sort((a, b) => {
          // メインリストを最初に
          if (a === "main") return -1;
          if (b === "main") return 1;
          
          // その他は作成順（dict_timestampのtimestamp部分で比較）
          const timestampA = a.startsWith("dict_") ? parseInt(a.replace("dict_", "")) : 0;
          const timestampB = b.startsWith("dict_") ? parseInt(b.replace("dict_", "")) : 0;
          return timestampA - timestampB;
        });

        sortedDictIds.forEach((dictId) => {
          const dict = AppState.data.promptDictionaries[dictId];
          // promptsプロパティを使用（統一されたデータ構造）
          const itemCount = dict.prompts ? dict.prompts.length : 0;

          const isCurrent = dictId === AppState.data.currentPromptDictionary;
          const item = UIFactory.createDiv({
            className: isCurrent
              ? "dictionary-item current-dictionary"
              : "dictionary-item",
          });

          item.innerHTML = `
            <div class="dictionary-info" data-dict-id="${dictId}" style="flex: 1; cursor: pointer;">
              <div class="dictionary-name-container">
                <strong class="dictionary-name" data-dict-id="${dictId}" title="ダブルクリックで名前を編集">${
            dict.name
          }</strong>
                <input class="dictionary-name-edit" data-dict-id="${dictId}" value="${
            dict.name
          }" style="display: none;">
              </div>
              ${
                isCurrent
                  ? '<span class="current-indicator">(現在選択中)</span>'
                  : ""
              }
              <div class="item-count">${itemCount}件のプロンプト</div>
            </div>
            <div class="dictionary-actions">
              ${
                dictId !== "main"
                  ? `<button class="delete-dict-btn" data-dict-id="${dictId}">削除</button>`
                  : ""
              }
            </div>
          `;

          // 辞書名の編集機能
          const dictNameDisplay = item.querySelector(".dictionary-name");
          const dictNameEdit = item.querySelector(".dictionary-name-edit");

          if (dictNameDisplay && dictNameEdit) {
            // ダブルクリックで編集モード
            dictNameDisplay.addEventListener("dblclick", (e) => {
              e.stopPropagation();
              this.startDictionaryNameEdit(dictNameDisplay, dictNameEdit);
            });

            // 編集完了処理
            dictNameEdit.addEventListener("blur", async () => {
              await this.finishDictionaryNameEdit(
                dictId,
                dictNameDisplay,
                dictNameEdit
              );
            });

            dictNameEdit.addEventListener("keydown", async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                await this.finishDictionaryNameEdit(
                  dictId,
                  dictNameDisplay,
                  dictNameEdit
                );
              } else if (e.key === "Escape") {
                this.cancelDictionaryNameEdit(dictNameDisplay, dictNameEdit);
              }
            });
          }

          // 辞書アイテム全体のクリックイベント（編集中でない場合のみ）
          item.addEventListener("click", async (e) => {
            // ボタンクリック時は処理しない
            if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
              return;
            }

            // 編集中の場合はクリック選択を無効化
            if (dictNameEdit && dictNameEdit.style.display !== "none") {
              return;
            }

            if (!isCurrent) {
              await this.switchDictionary(dictId);
              this.updateDictionaryList();
              this.updateDictionarySelector();
            }
          });

          // Select button removed - using click selection instead

          // 削除ボタンのクリックイベント
          const deleteBtn = item.querySelector(".delete-dict-btn");
          if (deleteBtn) {
            deleteBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              await this.deleteDictionary(dictId);
            });
          }

          container.appendChild(item);
        });
      }

      /**
       * 新しい辞書を作成（モーダル内）
       */
      async createNewDictionary() {
        console.log('[DictionaryTab] createNewDictionary called');
        const nameInput = document.querySelector("#new-dictionary-name");
        console.log('[DictionaryTab] Found name input:', !!nameInput);
        if (!nameInput) {
          console.error('[DictionaryTab] Name input not found!');
          return;
        }

        const name = nameInput.value.trim();
        console.log('[DictionaryTab] Dictionary name:', name);
        if (!name) {
          console.log('[DictionaryTab] Empty name - showing error');
          ErrorHandler.showToast(
            "辞書名を入力してください",
            UI_DELAYS.LONG,
            "warning"
          );
          nameInput.focus();
          return;
        }

        // 同じ名前の辞書が既に存在するかチェック
        const existingDict = Object.keys(AppState.data.promptDictionaries).find(
          (id) => AppState.data.promptDictionaries[id].name === name
        );

        if (existingDict) {
          ErrorHandler.showToast(
            "同じ名前の辞書が既に存在します",
            UI_DELAYS.LONG,
            "warning"
          );
          nameInput.focus();
          nameInput.select();
          return;
        }

        await this.createDictionary(name);
        nameInput.value = "";
        this.updateDictionaryList();

        // 作成後にフォーカスを戻す
        setTimeout(() => {
          nameInput.focus();
        }, UI_DELAYS.FOCUS_RESTORE_DELAY);
      }

      /**
       * 辞書を削除
       */
      async deleteDictionary(dictId) {
        if (dictId === "main") {
          ErrorHandler.showToast(
            "メインリストは削除できません",
            UI_DELAYS.LONG,
            "warning"
          );
          return;
        }

        const dict = AppState.data.promptDictionaries[dictId];
        if (!dict) return;

        // オプションの削除確認フラグをチェック
        const shouldConfirm =
          AppState.userSettings.optionData?.isDeleteCheck !== false;

        if (shouldConfirm) {
          const itemCount = dict.prompts ? dict.prompts.length : 0;
          const confirmMessage = `辞書「${dict.name}」を削除しますか？\n(${itemCount}件のプロンプトが失われます)`;
          if (!confirm(confirmMessage)) return;
        }

        delete AppState.data.promptDictionaries[dictId];

        // 削除した辞書が現在選択中の場合はメインリストに切り替え
        if (AppState.data.currentPromptDictionary === dictId) {
          AppState.data.currentPromptDictionary = "main";
        }

        await savePromptDictionaries();
        this.updateDictionarySelector();
        this.updateDictionaryList();
        this.updateStats();

        ErrorHandler.showToast(
          `辞書「${dict.name}」を削除しました`,
          UI_DELAYS.LONG,
          "success"
        );
      }

      /**
       * 辞書名編集開始
       */
      startDictionaryNameEdit(displayElement, editElement) {
        displayElement.style.display = "none";
        editElement.style.display = "inline-block";
        editElement.focus();
        editElement.select();
      }

      /**
       * 辞書名編集完了
       */
      async finishDictionaryNameEdit(dictId, displayElement, editElement) {
        const newName = editElement.value.trim();

        if (!newName) {
          ErrorHandler.showToast(
            "辞書名を入力してください",
            UI_DELAYS.LONG,
            "warning"
          );
          editElement.focus();
          return;
        }

        // 同じ名前の辞書が既に存在するかチェック
        const existingDict = Object.keys(AppState.data.promptDictionaries).find(
          (id) =>
            id !== dictId &&
            AppState.data.promptDictionaries[id].name === newName
        );

        if (existingDict) {
          ErrorHandler.showToast(
            "同じ名前の辞書が既に存在します",
            UI_DELAYS.LONG,
            "warning"
          );
          editElement.focus();
          return;
        }

        try {
          // 辞書名を更新
          AppState.data.promptDictionaries[dictId].name = newName;
          await savePromptDictionaries();

          // 表示を更新
          displayElement.textContent = newName;
          displayElement.style.display = "inline";
          editElement.style.display = "none";

          // 辞書セレクターも更新
          this.updateDictionarySelector();

          console.log(
            `[DICT_RENAME] Dictionary renamed: ${dictId} -> ${newName}`
          );
          ErrorHandler.showToast(
            `辞書名を「${newName}」に変更しました`,
            UI_DELAYS.LONG,
            "success"
          );
        } catch (error) {
          console.error("Failed to rename dictionary:", error);
          ErrorHandler.showToast(
            "辞書名の変更に失敗しました",
            UI_DELAYS.LONG,
            "error"
          );
          this.cancelDictionaryNameEdit(displayElement, editElement);
        }
      }

      /**
       * 辞書名編集キャンセル
       */
      cancelDictionaryNameEdit(displayElement, editElement) {
        // 元の値に戻す
        const dictId = editElement.dataset.dictId;
        const originalName =
          AppState.data.promptDictionaries[dictId]?.name || "";
        editElement.value = originalName;

        // 表示を戻す
        displayElement.style.display = "inline";
        editElement.style.display = "none";
      }

      /**
       * デバッグ情報を出力（オーバーライド）
       */
      debug() {
        super.debug();
        console.log("Dictionary states:", this.dictionaryStates);
        console.log("Dictionary stats:", this.getDictionaryStats());
        console.log("Multiple dictionaries:", AppState.data.promptDictionaries);
        console.log(
          "Current dictionary:",
          AppState.data.currentPromptDictionary
        );
      }
    }

    // グローバルに公開
    if (typeof window !== "undefined") {
      window.DictionaryTab = DictionaryTab;
    }
  }

  // 初期実行
  defineDictionaryTab();
})();
