(function () {
  "use strict";

  function defineDictionaryTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineDictionaryTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    class DictionaryTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "addTabBody",
          tabButtonId: "addTab",
          tabIndex: 1, // CONSTANTS.TABS.DICTIONARY
        });

        this.dictionaryHandler = null;
        this.listManager = null;

        this.flexibleElementManager = null;

        this.dictionaryManagementModal = null;

        this.dictionaryStates = {
          prompt: false,
          element: false,
          master: false,
        };
      }

      async onInit() {
        this.dictionaryHandler = this.app.dictionaryHandler;
        this.listManager = this.app.listManager;

        if (!this.dictionaryHandler || !this.listManager) {
          throw new Error("Required dependencies not found");
        }

        this.categoryUIManager = new CategoryUIManager();

        if (window.FlexibleElementManager) {
          this.flexibleElementManager = new FlexibleElementManager(this.listManager);
        }

        this.setupEventListeners();

        this.updateStats();
      }

      setupEventListeners() {
        this.setupDictionaryNavigation();

        // 辞書の開閉（従来互換性のため残す）

        this.setupDownloadButtons();

        this.setupImportButtons();

        this.setupDuplicateCheckButton();

        this.setupFavoriteAddButton();

        this.setupElementRegistration();

        this.setupMultipleDictionaryManagement();
      }

      setupDictionaryNavigation() {
        const statItems = document.querySelectorAll(".stat-item");

        const sections = document.querySelectorAll(".dictionary-content-section");

        if (statItems.length === 0) {
          return;
        }

        if (sections.length === 0) {
          return;
        }

        statItems.forEach((item) => {
          this.addEventListener(item, "click", (e) => {
            e.preventDefault();

            const targetDictionary = item.getAttribute("data-dictionary");
            this.switchDictionaryTab(targetDictionary);
          });
        });

        setTimeout(() => {
          const favoriteSection = document.getElementById("favorite-section");
          if (favoriteSection) {
            this.switchDictionaryTab("favorite");
          } else {
            this.debugDOMStructure();
          }
        }, 100);
      }

      switchDictionaryTab(dictionaryType) {
        try {
          const allSections = document.querySelectorAll(".dictionary-content-section");

          const statItems = document.querySelectorAll(".stat-item");
          statItems.forEach((item) => item.classList.remove("active"));

          allSections.forEach((section) => {
            section.classList.remove("active");
          });

          const targetSectionId = `${dictionaryType}-section`;
          const targetSection = document.getElementById(targetSectionId);

          if (!targetSection) {
            throw new Error(`Section ${targetSectionId} not found`);
          }

          targetSection.classList.add("active");

          const targetStatItem = document.querySelector(`.stat-item[data-dictionary="${dictionaryType}"]`);
          if (targetStatItem) {
            targetStatItem.classList.add("active");
          }

          switch (dictionaryType) {
            case "favorite":
              setTimeout(() => this.refreshFavoriteList(), UI_DELAYS.STANDARD_UPDATE);
              break;
            case "local":
              setTimeout(() => this.refreshAddList(), UI_DELAYS.STANDARD_UPDATE);
              break;
            case "master":
              setTimeout(() => this.refreshMasterDictionary(), UI_DELAYS.STANDARD_UPDATE);
              break;
            default:
              return;
          }

          this.currentDictionary = dictionaryType;
        } catch (error) {}
      }

      debugDOMStructure() {
        // debugMode有効時のみコンソールで手動呼び出し用
      }

      setupDictionaryToggles() {
        const sections = [
          { containerId: "#promptDicContainer", type: "prompt" },
          { containerId: "#elementDicContainer", type: "element" },
          { containerId: "#masterDicContainer", type: "master" },
        ];

        sections.forEach(({ containerId, type }) => {
          const container = document.querySelector(containerId);
          if (container) {
            const section = container.closest(".search-results-section");
            if (section) {
              const header = section.querySelector(DICTIONARY_SELECTORS.CLICKABLE_HEADER);
              if (header) {
                this.addEventListener(header, "click", () => {
                  this.toggleDictionary(type);
                });
              }
            }
          }
        });

        // 統計アイテムクリックで対応する辞書を開閉
        const statItems = document.querySelectorAll(DICTIONARY_SELECTORS.STAT_ITEM);

        statItems.forEach((statItem, index) => {
          const dictionaryTypes = [
            DICTIONARY_TYPES_STORAGE.PROMPT,
            DICTIONARY_TYPES_STORAGE.ELEMENT,
            DICTIONARY_TYPES_STORAGE.MASTER,
          ];
          const type = dictionaryTypes[index];

          if (type && statItem) {
            this.addEventListener(statItem, "click", () => {
              this.toggleDictionary(type);
            });
          }
        });

        // 従来のUI互換性（隠し要素）
        const promptDicText = this.getElement(DOM_SELECTORS.BY_ID.PROMPT_DIC_TEXT);
        if (promptDicText) {
          this.addEventListener(promptDicText, "click", () => {
            this.toggleDictionary("prompt");
          });
        }

        const elementDicText = this.getElement(DOM_SELECTORS.BY_ID.ELEMENT_DIC_TEXT);
        if (elementDicText) {
          this.addEventListener(elementDicText, "click", () => {
            this.toggleDictionary("element");
          });
        }

        const masterDicText = this.getElement(DOM_SELECTORS.BY_ID.MASTER_DIC_TEXT);
        if (masterDicText) {
          this.addEventListener(masterDicText, "click", () => {
            this.toggleDictionary("master");
          });
        }
      }

      async toggleDictionary(type) {
        const configs = {
          prompt: {
            listId: DOM_SELECTORS.BY_ID.FAVORITE_LIST,
            containerId: DOM_SELECTORS.BY_ID.PROMPT_DIC_CONTAINER,
            textId: DOM_SELECTORS.BY_ID.PROMPT_DIC_TEXT,
            openText: DICTIONARY_TEXTS.PROMPT.OPEN,
            closeText: DICTIONARY_TEXTS.PROMPT.CLOSE,
            createFunc: async () => {
              const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict = AppState.data.promptDictionaries?.[currentDictId];
              const prompts = currentDict?.prompts || [];

              const sorted = [...prompts].sort((a, b) => (a.sort || 0) - (b.sort || 0));

              // 永続IDを確保（辞書タブでもソート問題解決のため）
              const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

              const favoriteListConfig = {
                fields: FAVORITE_FIELDS,
                buttons: FAVORITE_BUTTONS,
                sortable: true,
                listType: FLEXIBLE_LIST_TYPES.FAVORITE, // リアルタイム更新用
                header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT, // ⭐️ お気に入りリスト
                headerClickSort: {
                  enabled: true,
                  listManager: this.listManager,
                  dataArray: prompts, // 現在の辞書のプロンプト配列
                  refreshCallback: async () => await this.refreshFavoriteList(),
                  saveCallback: async () => await savePromptDictionaries(),
                },
                refreshCallback: async () => {
                  await this.refreshFavoriteList();
                },
                removeElementFromData: async (elementId) => {
                  const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                  const currentDict = AppState.data.promptDictionaries[currentDictId];

                  if (currentDict && currentDict.prompts) {
                    const index = currentDict.prompts.findIndex((item) => item.id === elementId);
                    if (index !== -1) {
                      currentDict.prompts.splice(index, 1);
                      await savePromptDictionaries();
                      return true;
                    }
                  }
                  return false;
                },
                onEnterBlurChange: async (index, fieldKey, value, item, eventType) => {
                  const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                  const currentDict = AppState.data.promptDictionaries[currentDictId];

                  if (currentDict && currentDict.prompts && index >= 0 && index < currentDict.prompts.length) {
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
                    if (this.flexibleElementManager && item?.id) {
                      this.flexibleElementManager.saveScrollPosition();

                      const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                      const currentDict = AppState.data.promptDictionaries[currentDictId];

                      if (currentDict && currentDict.prompts) {
                        const actualIndex = currentDict.prompts.findIndex(
                          (prompt) => prompt.title === item.title && prompt.prompt === item.prompt
                        );

                        if (actualIndex !== -1) {
                          currentDict.prompts.splice(actualIndex, 1);
                          currentDict.prompts.forEach((prompt, idx) => {
                            prompt.sort = idx;
                          });
                          await savePromptDictionaries();

                          const element = document.querySelector(`[data-element-id="${item.id}"]`);
                          if (element) {
                            element.remove();
                          }

                          setTimeout(() => {
                            this.flexibleElementManager.restoreScrollPosition();
                          }, 10);

                          this.updateStats();
                          return false;
                        }
                      }
                    }
                  } catch (error) {
                    throw error;
                  }

                  const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                  const currentDict = AppState.data.promptDictionaries[currentDictId];

                  if (currentDict && currentDict.prompts) {
                    const actualIndex = currentDict.prompts.findIndex(
                      (prompt) => prompt.title === item.title && prompt.prompt === item.prompt
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
                  const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                  const currentDict = AppState.data.promptDictionaries[currentDictId];

                  if (currentDict && currentDict.prompts) {
                    await this.listManager.handleSortCommon(sortedIds, currentDict.prompts, async () => {
                      if (window.ensureDictionaryElementIds) {
                        currentDict.prompts = window.ensureDictionaryElementIds(currentDict.prompts);
                      }
                      await savePromptDictionaries();
                    });
                  }
                },
              };

              if (this.flexibleElementManager) {
                this.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.FAVORITE_LIST, favoriteListConfig);
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
              const listManager = this.listManager;
              const sortState = listManager?.sortStates?.get("#addPromptList-list");
              const isHeaderSorted = sortState && sortState.column && sortState.direction;

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
                headerClickSort: {
                  enabled: true,
                  listManager: this.listManager,
                  dataArray: AppState.data.localPromptList,
                  refreshCallback: async () => await this.refreshAddList(),
                  saveCallback: async () => await saveLocalList(),
                },
                refreshCallback: async () => {
                  await this.refreshAddList();
                },
                ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
                categoryChainBehavior: {
                  ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN.categoryChainBehavior,
                  focusNext: false, // フォーカス移動を無効化
                  focusPromptAfterSmall: false, // プロンプト後のフォーカス移動も無効化
                },
                onEnterBlurChange: async (index, fieldKey, value, item, eventType) => {
                  if (this.flexibleElementManager && item?.id) {
                    await this.flexibleElementManager.updateFieldOnly(item.id, fieldKey, value);
                  }

                  if (index >= 0 && index < AppState.data.localPromptList.length) {
                    if (fieldKey === "data" && Array.isArray(value)) {
                      AppState.data.localPromptList[index].data = value;
                    } else if (fieldKey === "prompt") {
                      AppState.data.localPromptList[index].prompt = value;
                    } else if (fieldKey === "data.0") {
                      AppState.data.localPromptList[index].data[0] = value;
                    } else if (fieldKey === "data.1") {
                      AppState.data.localPromptList[index].data[1] = value;
                    } else if (fieldKey === "data.2") {
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
                  }
                },
                onDelete: async (index, item) => {
                  try {
                    if (item?.id !== undefined) {
                      const itemIndex = AppState.data.localPromptList.findIndex(
                        (localItem) =>
                          localItem.prompt === item.prompt &&
                          localItem.data &&
                          item.data &&
                          localItem.data[0] === item.data[0] &&
                          localItem.data[1] === item.data[1] &&
                          localItem.data[2] === item.data[2]
                      );

                      if (itemIndex !== -1) {
                        AppState.data.localPromptList.splice(itemIndex, 1);
                        await saveLocalList(false);

                        const element = document.querySelector(`[data-element-id="${item.id}"]`);
                        if (element) {
                          element.remove();
                        }

                        this.updateStats();
                      }

                      return false;
                    }

                    if (index >= 0 && index < AppState.data.localPromptList.length) {
                      AppState.data.localPromptList.splice(index, 1);
                      await saveLocalList(false);
                      this.updateStats();
                    }

                    return false;
                  } catch (error) {
                    return false;
                  }
                },
                onSort: async (sortedIds) => {
                  await this.listManager.handleSortCommon(sortedIds, AppState.data.localPromptList, async () => {
                    if (window.ensureLocalPromptIntegrity) {
                      await window.ensureLocalPromptIntegrity(true); // 保存も同時実行
                    } else {
                      await saveLocalList();
                    }
                  });
                },
                setupSpecialFeatures: ($li, inputs) => {},
              };

              if (this.flexibleElementManager) {
                this.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, listConfig);
              }

              await this.listManager.createFlexibleList(sortedWithIds, DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, listConfig);
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

                if (!masterData || masterData.length === 0) {
                  await this.listManager.createFlexibleList([], DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
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
                  });
                  return;
                }

                const masterDataWithIds = masterData.map((item, index) => ({
                  ...item,
                  id: `dict-master-${index}`,
                }));

                await this.listManager.createFlexibleList(masterDataWithIds, DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
                  fields: STANDARD_CATEGORY_FIELDS,
                  buttons: STANDARD_BUTTONS,
                  showHeaders: true,
                  readonly: true,
                  header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
                  containerHeight: 500,
                  virtualScroll: 1000, // 1000件以上で仮想スクロール（検索タブと同じ）
                  refreshCallback: async () => {
                    await this.refreshMasterDictionary();
                  },
                });
              } catch (error) {
                await this.listManager.createFlexibleList([], DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
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
                });
              }
            },
          },
        };

        const config = configs[type];
        const $list = $(config.listId);
        const $text = $(config.textId);
        const $container = $(config.containerId);

        const container = document.querySelector(config.containerId);
        const section = container ? container.closest(DICTIONARY_SELECTORS.RESULTS_SECTION) : null;
        const header = section ? section.querySelector(DICTIONARY_SELECTORS.CLICKABLE_HEADER) : null;
        const toggleIcon = header ? header.querySelector(DICTIONARY_SELECTORS.TOGGLE_ICON) : null;

        const isExpanded = this.dictionaryStates[type];

        if (isExpanded) {
          if (config.listId) {
            ListBuilder.clearList(config.listId);
          }
          $container.removeClass("expanded");
          if (header) header.setAttribute("data-expanded", "false");
          if (toggleIcon) toggleIcon.textContent = "▶";
          if ($text.length && config.closeText) $text.text(config.closeText);
          this.dictionaryStates[type] = false;
        } else {
          if (config.createFunc) {
            await config.createFunc();
          }
          $container.addClass("expanded");
          if (header) header.setAttribute("data-expanded", "true");
          if (toggleIcon) toggleIcon.textContent = "▼";
          if ($text.length && config.openText) $text.text(config.openText);
          this.dictionaryStates[type] = true;

          setTimeout(() => {
            this.updateStats();
          }, ADDITIONAL_DELAYS.ELEMENT_UPDATE);
        }

        this.updateStats();
      }

      async refreshFavoriteList() {
        const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
        const currentDict = AppState.data.promptDictionaries?.[currentDictId];
        const prompts = currentDict?.prompts || [];

        if (!currentDict) {
          return;
        }

        const listManager = this.listManager;
        const sortState = listManager?.sortStates?.get("#favoriteList-list");
        const isHeaderSorted = sortState && sortState.column && sortState.direction;

        const sorted = isHeaderSorted ? [...prompts] : [...prompts].sort((a, b) => (a.sort || 0) - (b.sort || 0));

        const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

        try {
          const refreshFavoriteConfig = {
            fields: FAVORITE_FIELDS,
            buttons: FAVORITE_BUTTONS,
            sortable: true,
            listType: FLEXIBLE_LIST_TYPES.FAVORITE, // リアルタイム更新用
            header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT, // ⭐️ お気に入りリスト
            headerClickSort: {
              enabled: true,
              listManager: this.listManager,
              dataArray: prompts, // 現在の辞書のプロンプト配列
              refreshCallback: async () => await this.refreshFavoriteList(),
              saveCallback: async () => await savePromptDictionaries(),
            },
            refreshCallback: async () => {
              await this.refreshFavoriteList();
            },
            removeElementFromData: async (elementId) => {
              const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict = AppState.data.promptDictionaries[currentDictId];

              if (currentDict && currentDict.prompts) {
                const index = currentDict.prompts.findIndex((item) => item.id === elementId);
                if (index !== -1) {
                  currentDict.prompts.splice(index, 1);
                  await savePromptDictionaries();
                  return true;
                }
              }
              return false;
            },
            onEnterBlurChange: async (index, fieldKey, value, item, eventType) => {
              if (this.flexibleElementManager && item?.id) {
                await this.flexibleElementManager.updateFieldOnly(item.id, fieldKey, value);
              }

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
              if (this.flexibleElementManager && item?.id) {
                const success = await this.flexibleElementManager.removeElement(item.id);
                if (success) {
                  return false; // ListManagerフローをスキップ
                }
              }

              const actualIndex = prompts.findIndex(
                (favorite) => favorite.title === item.title && favorite.prompt === item.prompt
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
              await this.listManager.handleSortCommon(sortedIds, prompts, async () => {
                if (window.ensureDictionaryElementIds) {
                  const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
                  const currentDict = AppState.data.promptDictionaries[currentDictId];
                  if (currentDict && currentDict.prompts) {
                    currentDict.prompts = window.ensureDictionaryElementIds(currentDict.prompts);
                  }
                }
                await savePromptDictionaries();
              });
            },
          };

          if (this.flexibleElementManager) {
            this.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.FAVORITE_LIST, refreshFavoriteConfig);
          }

          await this.listManager.createFlexibleList(sortedWithIds, DOM_SELECTORS.BY_ID.FAVORITE_LIST, {
            ...refreshFavoriteConfig,
            idOffset: ID_OFFSETS.FAVORITES,
          });
        } catch (error) {
          throw error;
        }
      }

      async refreshMasterDictionary() {
        try {
          const masterData = getMasterPrompts();

          const masterDataWithIds = masterData.map((item, index) => ({
            ...item,
            id: `dict-master-${index}`,
          }));

          await this.listManager.createFlexibleListWithHeader(masterDataWithIds, DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
            fields: STANDARD_CATEGORY_FIELDS,
            buttons: STANDARD_BUTTONS,
            showHeaders: true,
            readonly: true,
            sortable: false,
            listType: FLEXIBLE_LIST_TYPES.MASTER,
            header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
            refreshCallback: async () => {
              await this.refreshMasterDictionary();
            },
            idOffset: ID_OFFSETS.MASTER_DICTIONARY,
          });
        } catch (error) {
          await this.listManager.createFlexibleListWithHeader([], DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
            fields: STANDARD_CATEGORY_FIELDS,
            buttons: STANDARD_BUTTONS,
            showHeaders: true,
            readonly: true,
            sortable: false,
            listType: FLEXIBLE_LIST_TYPES.MASTER,
            header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
            idOffset: ID_OFFSETS.MASTER_DICTIONARY,
          });
        }
      }

      async refreshAddList() {
        const listManager = this.listManager;
        const sortState = listManager?.sortStates?.get("#addPromptList-list");
        const isHeaderSorted = sortState && sortState.column && sortState.direction;

        const sorted = isHeaderSorted
          ? [...AppState.data.localPromptList]
          : [...AppState.data.localPromptList].sort((a, b) => (a.sort || 0) - (b.sort || 0));

        const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

        const refreshListConfig = {
          fields: STANDARD_CATEGORY_FIELDS, // 元の定義を使用（item.promptで正しく動作）
          buttons: [...STANDARD_BUTTONS, { type: "delete" }],
          sortable: true,
          listType: FLEXIBLE_LIST_TYPES.ADD, // リアルタイム更新用
          header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT, // 💾 ユーザー辞書
          headerClickSort: {
            enabled: true,
            listManager: this.listManager,
            dataArray: AppState.data.localPromptList,
            refreshCallback: async () => await this.refreshAddList(),
            saveCallback: async () => await saveLocalList(),
          },
          refreshCallback: async () => {
            await this.refreshAddList();
          },
          ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
          onEnterBlurChange: async (index, fieldKey, value, item, eventType) => {
            if (this.flexibleElementManager && item?.id && eventType !== "blur_from_flexible_manager") {
              await this.flexibleElementManager.updateFieldOnly(item.id, fieldKey, value);
            }

            if (index >= 0 && index < AppState.data.localPromptList.length) {
              if (fieldKey === "data" && Array.isArray(value)) {
                AppState.data.localPromptList[index].data = value;
              } else if (fieldKey === "prompt") {
                AppState.data.localPromptList[index].prompt = value;
              } else if (fieldKey === "data.0") {
                AppState.data.localPromptList[index].data[0] = value;
              } else if (fieldKey === "data.1") {
                AppState.data.localPromptList[index].data[1] = value;
              } else if (fieldKey === "data.2") {
                AppState.data.localPromptList[index].data[2] = value;
              } else if (
                AppState.data.localPromptList[index].data &&
                typeof AppState.data.localPromptList[index].data === "object"
              ) {
                if (typeof fieldKey === "number") {
                  AppState.data.localPromptList[index].data[fieldKey] = value;
                }
              }
              await saveLocalList(false);
            }
          },
          onDelete: async (index, item) => {
            try {
              if (item?.id !== undefined) {
                const itemIndex = AppState.data.localPromptList.findIndex(
                  (localItem) =>
                    localItem.prompt === item.prompt &&
                    localItem.data &&
                    item.data &&
                    localItem.data[0] === item.data[0] &&
                    localItem.data[1] === item.data[1] &&
                    localItem.data[2] === item.data[2]
                );

                if (itemIndex !== -1) {
                  AppState.data.localPromptList.splice(itemIndex, 1);
                  await saveLocalList(false);

                  const element = document.querySelector(`[data-element-id="${item.id}"]`);
                  if (element) {
                    element.remove();
                  }
                }

                return false;
              }

              if (index >= 0 && index < AppState.data.localPromptList.length) {
                AppState.data.localPromptList.splice(index, 1);
                await saveLocalList(false);
              }
            } catch (error) {}

            return false;
          },
          onSort: async (sortedIds) => {
            await this.listManager.handleSortCommon(sortedIds, AppState.data.localPromptList, async () => {
              if (window.ensureLocalPromptIntegrity) {
                await window.ensureLocalPromptIntegrity(true); // 保存も同時実行
              } else {
                await saveLocalList();
              }
            });
          },
        };

        if (this.flexibleElementManager) {
          this.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, refreshListConfig);
        }

        await this.listManager.createFlexibleList(sortedWithIds, DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, {
          ...refreshListConfig,
          idOffset: ID_OFFSETS.USER_DICTIONARY,
        });
      }

      getDictionaryStats() {
        if (!AppState.data.promptDictionaries) {
          return {
            favorits: 0,
            localElements: AppState.data.localPromptList?.length || 0,
            masterElements: 0,
            openDictionaries: 0,
          };
        }

        const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
        const currentDict = AppState.data.promptDictionaries[currentDictId];

        const favoritsCount = currentDict?.prompts?.length || 0;

        return {
          favorits: favoritsCount,
          localElements: AppState.data.localPromptList?.length || 0,
          masterElements: typeof getMasterPrompts === "function" ? getMasterPrompts().length : 0,
          openDictionaries: Object.values(this.dictionaryStates).filter((state) => state).length,
        };
      }

      quickSearch(keyword) {}

      async onRefresh() {
        if (this.currentDictionary) {
          switch (this.currentDictionary) {
            case "favorite":
              await this.refreshFavoriteList();
              break;
            case "local":
              await this.refreshAddList();
              break;
            case "master":
              await this.refreshMasterDictionary();
              break;
          }
        }
      }

      updateStats() {
        const stats = this.getDictionaryStats();

        const favoriteCountEl = document.getElementById(DOM_IDS.DICTIONARY.FAVORITE_COUNT);
        const localCountEl = document.getElementById(DOM_IDS.DICTIONARY.LOCAL_COUNT);
        const masterCountEl = document.getElementById(DOM_IDS.DICTIONARY.MASTER_COUNT);

        if (favoriteCountEl) {
          favoriteCountEl.textContent = stats.favorits;
          if (stats.favorits > 999) {
            favoriteCountEl.textContent = (stats.favorits / 1000).toFixed(1) + "k";
          }
        }

        if (localCountEl) {
          localCountEl.textContent = stats.localElements;
          if (stats.localElements > 999) {
            localCountEl.textContent = (stats.localElements / 1000).toFixed(1) + "k";
          }
        }

        if (masterCountEl) {
          masterCountEl.textContent = stats.masterElements;
          if (stats.masterElements > 999) {
            masterCountEl.textContent = (stats.masterElements / 1000).toFixed(1) + "k";
          }
        }

        this.updateDuplicateCheckButtonVisibility();
      }

      async onShow() {
        this.updateStats();

        this.checkEditTabDOMState();

        setTimeout(() => {
          this.updateStats();
        }, ADDITIONAL_DELAYS.SHORT_DELAY);

        setTimeout(() => {
          if (this.currentDictionary) {
            this.switchDictionaryTab(this.currentDictionary);
          } else {
            this.switchDictionaryTab("favorite");
          }
        }, 200);
      }

      setupDownloadButtons() {
        const promptDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_DOWNLOAD);
        if (promptDownload) {
          this.addEventListener(promptDownload, "click", () => {
            const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
            const currentDict = AppState.data.promptDictionaries?.[currentDictId];
            const prompts = currentDict?.prompts || [];
            this.jsonDownload(prompts, EXPORT_FILE_NAMES.PROMPT_DICTIONARY);
          });
        }

        const localDicDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DOWNLOAD);
        if (localDicDownload) {
          this.addEventListener(localDicDownload, "click", () => {
            this.jsonDownload(AppState.data.localPromptList, EXPORT_FILE_NAMES.USER_DICTIONARY);
          });
        }

        this.setupAccordionDownloadButtons();
      }

      setupAccordionDownloadButtons() {
        // お気に入りリストダウンロード（複数辞書対応）
        const promptDictDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_DICT_DOWNLOAD);
        if (promptDictDownload) {
          this.addEventListener(promptDictDownload, "click", () => {
            const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
            const currentDict = AppState.data.promptDictionaries?.[currentDictId];
            const currentData = currentDict?.prompts || [];
            const currentDictName = currentDict?.name || "メインリスト";

            this.jsonDownload(currentData, EXPORT_FILE_NAMES.PROMPT_DICTIONARY, currentDictName);
          });
        }

        const localDictJsonDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_JSON_DOWNLOAD);
        if (localDictJsonDownload) {
          this.addEventListener(localDictJsonDownload, "click", () => {
            this.jsonDownload(AppState.data.localPromptList, EXPORT_FILE_NAMES.USER_DICTIONARY);
          });
        }

        const localDictCsvDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_CSV_DOWNLOAD);
        if (localDictCsvDownload) {
          this.addEventListener(localDictCsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(AppState.data.localPromptList, "csv", "elements");
            }
          });
        }

        const localDictTsvDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_TSV_DOWNLOAD);
        if (localDictTsvDownload) {
          this.addEventListener(localDictTsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(AppState.data.localPromptList, "tsv", "elements");
            }
          });
        }

        const promptDictCsvDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_CSV_DOWNLOAD);
        if (promptDictCsvDownload) {
          this.addEventListener(promptDictCsvDownload, "click", async () => {
            if (window.csvHandler) {
              const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict = AppState.data.promptDictionaries?.[currentDictId];
              const prompts = currentDict?.prompts || [];
              const currentDictName = currentDict?.name || "メインリスト";
              await window.csvHandler.exportToCSV(prompts, "csv", "prompts", currentDictName);
            }
          });
        }

        const promptDictTsvDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_TSV_DOWNLOAD);
        if (promptDictTsvDownload) {
          this.addEventListener(promptDictTsvDownload, "click", async () => {
            if (window.csvHandler) {
              const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
              const currentDict = AppState.data.promptDictionaries?.[currentDictId];
              const prompts = currentDict?.prompts || [];
              const currentDictName = currentDict?.name || "メインリスト";
              await window.csvHandler.exportToCSV(prompts, "tsv", "prompts", currentDictName);
            }
          });
        }

        const masterDictCsvDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_CSV_DOWNLOAD);
        if (masterDictCsvDownload) {
          this.addEventListener(masterDictCsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(getMasterPrompts(), "csv", "master");
            }
          });
        }

        const masterDictTsvDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_TSV_DOWNLOAD);
        if (masterDictTsvDownload) {
          this.addEventListener(masterDictTsvDownload, "click", async () => {
            if (window.csvHandler) {
              await window.csvHandler.exportToCSV(getMasterPrompts(), "tsv", "master");
            }
          });
        }

        const masterDictDownload = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_DICT_DOWNLOAD);
        if (masterDictDownload) {
          this.addEventListener(masterDictDownload, "click", () => {
            this.jsonDownload(getMasterPrompts(), EXPORT_FILE_NAMES.MASTER_DICTIONARY);
          });
        }
      }

      async jsonDownload(data, filename, dictName = null) {
        if (!data || data.length === 0) {
          if (window.ErrorHandler) {
            window.ErrorHandler.showToast(
              "JSONファイルをエクスポートしました（データが空のため、ヘッダー情報のみです）",
              3000,
              "info"
            );
          }
        }

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

        let dataType;
        if (dicType === DATA_TYPES.PROMPTS) {
          dataType = "prompts";
        } else if (dicType === "Master") {
          dataType = "master";
        } else {
          dataType = "elements";
        }
        const baseName = ExportFilenameGenerator.generateBaseName(dataType, dictName);

        const downloadFilename = FileUtilities.generateTimestampedFilename(baseName, "json");

        await FileUtilities.downloadJSON(formattedData, downloadFilename);
      }

      setupImportButtons() {
        const promptDictImportBtn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_IMPORT_BTN);
        const promptDictImport = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_IMPORT);

        if (promptDictImportBtn && promptDictImport) {
          this.addEventListener(promptDictImportBtn, "click", () => {
            promptDictImport.click();
          });

          this.addEventListener(promptDictImport, "change", async (event) => {
            const file = event.target.files[0];
            if (file) {
              await this.handleImportFile(file, "prompts");
              event.target.value = "";
            }
          });
        }

        const localDictImportBtn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_IMPORT_BTN);
        const localDictImport = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_IMPORT);

        if (localDictImportBtn && localDictImport) {
          this.addEventListener(localDictImportBtn, "click", () => {
            localDictImport.click();
          });

          this.addEventListener(localDictImport, "change", async (event) => {
            const file = event.target.files[0];
            if (file) {
              await this.handleImportFile(file, "elements");
              event.target.value = "";
            }
          });
        }
      }

      async handleImportFile(file, dictType) {
        try {
          const sizeValidation = Validators.validateFileSize(file, 10);
          if (!sizeValidation.isValid) {
            ErrorHandler.notify(sizeValidation.message);
            return;
          }

          const fileName = file.name.toLowerCase();
          let fileType = "json";
          if (fileName.endsWith(".csv")) {
            fileType = "csv";
          } else if (fileName.endsWith(".tsv")) {
            fileType = "tsv";
          }

          let data;
          if (fileType === "json") {
            const content = await this.readFileAsText(file);
            data = JSON.parse(content);
            await this.processDictionaryData(data, dictType);
          } else {
            const content = await this.readFileAsText(file);
            const delimiter = fileType === "tsv" ? "\t" : ",";
            data = this.parseCSVContent(content, delimiter);
            await this.processCSVData(data, dictType);
          }

          if (dictType === "prompts") {
            setTimeout(async () => {
              await this.refreshFavoriteList();
              this.updateDictionarySelector();
            }, UI_DELAYS.STANDARD_UPDATE);
          } else if (dictType === "elements") {
            setTimeout(async () => {
              await this.refreshAddList();
            }, UI_DELAYS.STANDARD_UPDATE);
          }

          this.updateStats();
        } catch (error) {
          ErrorHandler.showToast(`インポートに失敗しました: ${error.message}`, UI_DELAYS.LONG, "error");
        }
      }

      async readFileAsText(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error("ファイルの読み込みに失敗しました"));
          reader.readAsText(file, "UTF-8");
        });
      }

      parseCSVContent(content, delimiter = ",") {
        const cleanContent = content.replace(/^\uFEFF/, "");
        const lines = cleanContent.split("\n").filter((line) => line.trim());
        const result = [];

        for (let i = 0; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i], delimiter);
          if (values.length > 0) {
            result.push(values);
          }
        }

        return result;
      }

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

      async processDictionaryData(data, dictType) {
        let addCount = 0;

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
              } catch (error) {}
            }

            if (addCount > 0) {
              await saveLocalList();
              ErrorHandler.showToast(`${addCount}件の要素辞書を読み込みました`, 3000, "success");
            } else {
              ErrorHandler.showToast("追加できる新しい要素がありませんでした", 3000, "info");
            }
            break;

          case DATA_TYPES.PROMPTS:
            const currentDictId = AppState.data.currentPromptDictionary || "main";
            for (let i = 0; i < data.data.length; i++) {
              const item = data.data[i];
              try {
                if (this.addPromptDic(item, currentDictId)) {
                  addCount++;
                }
              } catch (error) {}
            }

            if (addCount > 0) {
              await savePromptDictionaries();
              ErrorHandler.showToast(`${addCount}件のお気に入りリストを読み込みました`, 3000, "success");
            } else {
              ErrorHandler.showToast("追加できる新しいプロンプトがありませんでした", 3000, "info");
            }
            break;

          default:
            throw new Error(`不明な辞書タイプです: ${data.dicType}`);
        }
      }

      addPromptDic(item, dictId = null) {
        try {
          const currentDictId = dictId || AppState.data.currentPromptDictionary || "main";

          if (!AppState.data.promptDictionaries[currentDictId]) {
            AppState.data.promptDictionaries[currentDictId] = {
              id: currentDictId,
              name: currentDictId === "main" ? "メインリスト" : currentDictId,
              prompts: [],
            };
          }

          const existingPrompts = AppState.data.promptDictionaries[currentDictId].prompts;
          const isDuplicate = existingPrompts.some(
            (existingItem) => existingItem.title === item.title && existingItem.prompt === item.prompt
          );

          if (isDuplicate) {
            return false;
          }

          const newItem = {
            title: item.title || "",
            prompt: item.prompt || "",
            id: Date.now() + Math.random(), // 一意のID
            sort: existingPrompts.length,
          };

          AppState.data.promptDictionaries[currentDictId].prompts.push(newItem);
          return true;
        } catch (error) {
          return false;
        }
      }

      async processCSVData(csvData, dictType) {
        let addCount = 0;

        if (dictType === "elements") {
          for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];

            // ヘッダー行をスキップ（BOM対応、カンマ/タブ混在対応）
            if (i === 0) {
              const firstCell = (row[0] || "").replace(/^\uFEFF/, ""); // BOM除去
              if (
                (firstCell === "大項目" && row[1] === "中項目") ||
                (firstCell.includes("大項目") && firstCell.includes("中項目"))
              ) {
                continue;
              }
            }

            if (row.length >= 4) {
              const item = {
                data: [row[0] || "", row[1] || "", row[2] || ""],
                prompt: row[3] || "",
              };
              try {
                if (registerDictionary(item, true)) {
                  addCount++;
                }
              } catch (error) {}
            }
          }

          if (addCount > 0) {
            await saveLocalList();
            ErrorHandler.showToast(`${addCount}件の要素辞書を読み込みました`, 3000, "success");
          } else {
            ErrorHandler.showToast("追加できる新しい要素がありませんでした", 3000, "info");
          }
        } else if (dictType === "prompts") {
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
              } catch (error) {}
            }
          }

          if (addCount > 0) {
            await savePromptDictionaries();
            ErrorHandler.showToast(`${addCount}件のお気に入りリストを読み込みました`, 3000, "success");
          } else {
            ErrorHandler.showToast("追加できる新しいプロンプトがありませんでした", 3000, "info");
          }
        }
      }

      setupFavoriteAddButton() {
        const addFavoriteButton = this.getElement("#addFavorite");

        if (addFavoriteButton) {
          this.addEventListener(addFavoriteButton, "click", async () => {
            await this.handleFavoriteAddition();
          });
        }

        this.setupFavoriteEnterKeyNavigation();
      }

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

      async handleFavoriteAddition() {
        const titleElement = this.getElement("#favoriteTitle");
        const promptElement = this.getElement("#favoritePrompt");

        const title = titleElement?.value || "";
        const prompt = promptElement?.value || "";

        if (!Validators.Quick.allRequired(title, prompt)) {
          ErrorHandler.showToast("タイトルとプロンプトを入力してください", UI_DELAYS.LONG, "error");
          return;
        }

        const trimmedValues = {
          title: title.trim(),
          prompt: prompt.trim(),
        };

        try {
          const currentDictId = AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
          const currentDict = AppState.data.promptDictionaries[currentDictId];

          if (!currentDict) {
            ErrorHandler.showToast("お気に入り辞書が見つかりません", UI_DELAYS.LONG, "error");
            return;
          }

          if (!currentDict.prompts) {
            currentDict.prompts = [];
          }

          // 重複チェック（既存のFavoボタンと同じ仕様）
          const validation = Validators.checkDuplicateFavorite(trimmedValues.prompt, currentDict.prompts);
          if (!validation.isValid) {
            ErrorHandler.showToast(validation.message, UI_DELAYS.LONG, "error");
            return;
          }

          const newFavorite = {
            id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: trimmedValues.title,
            prompt: trimmedValues.prompt,
            sort: currentDict.prompts.length, // ソート用インデックス
          };

          currentDict.prompts.push(newFavorite);

          await savePromptDictionaries();

          ErrorHandler.showToast("お気に入りを追加しました", UI_DELAYS.LONG, "success");

          if (titleElement) titleElement.value = "";
          if (promptElement) promptElement.value = "";

          this.updateStats();

          if (this.currentDictionary === "favorite") {
            await this.refreshFavoriteList();
          }
        } catch (error) {
          ErrorHandler.showToast("お気に入りの追加に失敗しました", UI_DELAYS.LONG, "error");
        }
      }

      setupElementRegistration() {
        const resistButton = this.getElement(`#${DOM_IDS.BUTTONS.RESIST}`);

        if (resistButton) {
          this.addEventListener(resistButton, "click", async () => {
            await this.handleElementRegistration();
          });
        } else {
          const directButton = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_RESIST_BTN);
          if (directButton) {
            this.addEventListener(directButton, "click", async () => {
              await this.handleElementRegistration();
            });
          }
        }

        this.setupFormCategoryChain();

        this.setupEnterKeyNavigation();
      }

      setupFormCategoryChain() {
        try {
          const config = this.categoryUIManager.chainConfigs.dictionary;
          if (config && config.inputFields) {
            this.categoryUIManager.setupInputFieldsChain(config.inputFields);
          }
        } catch (error) {}
      }

      setupEnterKeyNavigation() {
        const inputIds = DOM_ID_ARRAYS.FORM_INPUT_ORDER;

        inputIds.forEach((id, index) => {
          const input = this.getElement(`#${id}`);
          if (input) {
            this.addEventListener(input, "keydown", async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();

                if (id === DOM_IDS.CATEGORY.PROMPT) {
                  await this.handleElementRegistration();
                } else {
                  const nextIndex = index + 1;
                  if (nextIndex < inputIds.length) {
                    const nextInput = this.getElement(`#${inputIds[nextIndex]}`);
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

      async handleElementRegistration() {
        const bigElement = this.getElement(DOM_SELECTORS.BY_ID.BIG);
        const middleElement = this.getElement(DOM_SELECTORS.BY_ID.MIDDLE);
        const smallElement = this.getElement(DOM_SELECTORS.BY_ID.SMALL);
        const promptElement = this.getElement(DOM_SELECTORS.BY_ID.PROMPT);

        const big = bigElement?.value || "";
        const middle = middleElement?.value || "";
        const small = smallElement?.value || "";
        const prompt = promptElement?.value || "";

        if (!Validators.Quick.allRequired(small, prompt)) {
          ErrorHandler.showToast("小項目とプロンプトを入力してください", UI_DELAYS.LONG, "error");
          return;
        }

        const trimmedValues = {
          big: big.trim(),
          middle: middle.trim(),
          small: small.trim(),
          prompt: prompt.trim(),
        };

        try {
          const success = register(trimmedValues.big, trimmedValues.middle, trimmedValues.small, trimmedValues.prompt);

          if (success) {
            ErrorHandler.showToast("要素を追加しました", UI_DELAYS.LONG, "success");

            this.getElement(DOM_SELECTORS.BY_ID.BIG).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.MIDDLE).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.SMALL).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.PROMPT).value = "";

            // フォーカスはプロンプト入力に残す（連続入力のため）
            this.getElement(DOM_SELECTORS.BY_ID.PROMPT)?.focus();

            this.updateStats();

            // ローカル辞書をリフレッシュ（統一UIでは常に表示されているため）
            setTimeout(async () => {
              await this.refreshAddList();
            }, UI_DELAYS.STANDARD_UPDATE);
          } else {
            ErrorHandler.showToast("この要素は既に存在します", UI_DELAYS.LONG, "warning");
          }
        } catch (error) {
          ErrorHandler.showToast("要素の追加に失敗しました", UI_DELAYS.LONG, "error");
        }
      }

      setupMultipleDictionaryManagement() {
        const dictionarySelector = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_SELECTOR);
        if (dictionarySelector) {
          this.addEventListener(dictionarySelector, "change", async (e) => {
            await this.switchDictionary(e.target.value);
          });
        }

        const addDictionaryBtn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_ADD_BTN);
        if (addDictionaryBtn) {
          this.addEventListener(addDictionaryBtn, "click", () => {
            this.showAddDictionaryForm();
          });
        }

        const manageDictionariesBtn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MANAGE_BTN);

        if (manageDictionariesBtn) {
          this.addEventListener(manageDictionariesBtn, "click", () => {
            this.showDictionaryManagementModal();
          });
        } else {
          const directBtn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MANAGE_BTN);
          if (directBtn) {
            this.addEventListener(directBtn, "click", () => {
              this.showDictionaryManagementModal();
            });
          }
        }

        this.initModal();

        this.setupDictionaryManagementModal();

        this.updateDictionarySelector();
      }

      initModal() {
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

        this.dictionaryManagementModal.onShow(() => {
          this.updateDictionaryList();
          setTimeout(() => {
            const nameInput = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME);
            if (nameInput) {
              nameInput.focus();
            }
          }, 100);
        });
      }

      checkEditTabDOMState() {}

      setupDictionaryManagementModal() {
        const closeBtn = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_CLOSE_MANAGEMENT);
        if (closeBtn) {
          this.addEventListener(closeBtn, "click", () => {
            this.hideDictionaryManagementModal();
          });
        }

        const createBtn = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_CREATE_BTN);
        if (createBtn) {
          this.addEventListener(createBtn, "click", async () => {
            await this.createNewDictionary();
          });
        }

        // 辞書名入力フィールドでEnterキー対応
        const nameInput = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME);
        if (nameInput) {
          this.addEventListener(nameInput, "keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await this.createNewDictionary();
            }
          });
        }

        const modal = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_MANAGEMENT_MODAL);
        if (modal) {
          this.addEventListener(modal, "click", (e) => {
            if (e.target === modal) {
              this.hideDictionaryManagementModal();
            }
          });
        }
      }

      updateDictionarySelector() {
        const selector = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_SELECTOR);
        if (!selector) return;

        const currentValue = selector.value;

        selector.innerHTML = "";

        const sortedDictIds = Object.keys(AppState.data.promptDictionaries).sort((a, b) => {
          if (a === "main") return -1;
          if (b === "main") return 1;

          const timestampA = a.startsWith("dict_") ? parseInt(a.replace("dict_", "")) : 0;
          const timestampB = b.startsWith("dict_") ? parseInt(b.replace("dict_", "")) : 0;
          return timestampA - timestampB;
        });

        sortedDictIds.forEach((dictId) => {
          const dict = AppState.data.promptDictionaries[dictId];
          const option = UIFactory.createOption({
            value: dictId,
            text: dict.name || dictId,
            selected: dictId === AppState.data.currentPromptDictionary,
          });
          selector.appendChild(option);
        });
      }

      async switchDictionary(dictionaryId) {
        if (!AppState.data.promptDictionaries[dictionaryId]) {
          return;
        }

        if (window.ensureLocalPromptIntegrity) {
          try {
            await window.ensureLocalPromptIntegrity(false);
          } catch (error) {}
        }

        AppState.data.currentPromptDictionary = dictionaryId;

        await savePromptDictionaries();

        if (this.currentDictionary === "favorite") {
          await this.refreshFavoriteList();
        } else {
          const listElement = document.querySelector(DOM_SELECTORS.BY_ID.FAVORITE_LIST);
          if (listElement) {
            listElement.innerHTML = "";
          }
        }

        this.updateStats();
      }

      showAddDictionaryForm() {
        const name = prompt("新しいリストの名前を入力してください:", "");
        if (Validators.Quick.isValidName(name)) {
          this.createDictionary(name.trim());
        }
      }

      async createDictionary(name) {
        const dictId = `dict_${Date.now()}`;

        AppState.data.promptDictionaries[dictId] = {
          name: name,
          prompts: [], // 統一されたデータ構造を使用
        };

        await savePromptDictionaries();
        this.updateDictionarySelector();

        ErrorHandler.showToast(`辞書「${name}」を作成しました`, UI_DELAYS.LONG, "success");
      }

      showDictionaryManagementModal() {
        this.dictionaryManagementModal.show();
      }

      hideDictionaryManagementModal() {
        this.dictionaryManagementModal.hide();
      }

      updateDictionaryList() {
        const container = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LIST);

        if (!container) {
          const directContainer = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_LIST);
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

        const sortedDictIds = Object.keys(AppState.data.promptDictionaries).sort((a, b) => {
          if (a === "main") return -1;
          if (b === "main") return 1;

          const timestampA = a.startsWith("dict_") ? parseInt(a.replace("dict_", "")) : 0;
          const timestampB = b.startsWith("dict_") ? parseInt(b.replace("dict_", "")) : 0;
          return timestampA - timestampB;
        });

        sortedDictIds.forEach((dictId) => {
          const dict = AppState.data.promptDictionaries[dictId];
          const itemCount = dict.prompts ? dict.prompts.length : 0;

          const isCurrent = dictId === AppState.data.currentPromptDictionary;
          const item = UIFactory.createDiv({
            className: isCurrent ? "dictionary-item current-dictionary" : "dictionary-item",
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
              ${isCurrent ? '<span class="current-indicator">(現在選択中)</span>' : ""}
              <div class="item-count">${itemCount}件のプロンプト</div>
            </div>
            <div class="dictionary-actions">
              ${dictId !== "main" ? `<button class="delete-dict-btn" data-dict-id="${dictId}">削除</button>` : ""}
            </div>
          `;

          const dictNameDisplay = item.querySelector(".dictionary-name");
          const dictNameEdit = item.querySelector(".dictionary-name-edit");

          if (dictNameDisplay && dictNameEdit) {
            dictNameDisplay.addEventListener("dblclick", (e) => {
              e.stopPropagation();
              this.startDictionaryNameEdit(dictNameDisplay, dictNameEdit);
            });

            dictNameEdit.addEventListener("blur", async () => {
              await this.finishDictionaryNameEdit(dictId, dictNameDisplay, dictNameEdit);
            });

            dictNameEdit.addEventListener("keydown", async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                await this.finishDictionaryNameEdit(dictId, dictNameDisplay, dictNameEdit);
              } else if (e.key === "Escape") {
                this.cancelDictionaryNameEdit(dictNameDisplay, dictNameEdit);
              }
            });
          }

          item.addEventListener("click", async (e) => {
            if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
              return;
            }

            if (dictNameEdit && dictNameEdit.style.display !== "none") {
              return;
            }

            if (!isCurrent) {
              await this.switchDictionary(dictId);
              this.updateDictionaryList();
              this.updateDictionarySelector();
            }
          });

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

      async createNewDictionary() {
        const nameInput = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME);
        if (!nameInput) {
          return;
        }

        const name = nameInput.value.trim();
        if (!name) {
          ErrorHandler.showToast("辞書名を入力してください", UI_DELAYS.LONG, "warning");
          nameInput.focus();
          return;
        }

        const existingDict = Object.keys(AppState.data.promptDictionaries).find(
          (id) => AppState.data.promptDictionaries[id].name === name
        );

        if (existingDict) {
          ErrorHandler.showToast("同じ名前の辞書が既に存在します", UI_DELAYS.LONG, "warning");
          nameInput.focus();
          nameInput.select();
          return;
        }

        await this.createDictionary(name);
        nameInput.value = "";
        this.updateDictionaryList();

        setTimeout(() => {
          nameInput.focus();
        }, UI_DELAYS.FOCUS_RESTORE_DELAY);
      }

      async deleteDictionary(dictId) {
        if (dictId === "main") {
          ErrorHandler.showToast("メインリストは削除できません", UI_DELAYS.LONG, "warning");
          return;
        }

        const dict = AppState.data.promptDictionaries[dictId];
        if (!dict) return;

        const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;

        if (shouldConfirm) {
          const itemCount = dict.prompts ? dict.prompts.length : 0;
          const confirmMessage = `辞書「${dict.name}」を削除しますか？\n(${itemCount}件のプロンプトが失われます)`;
          if (!confirm(confirmMessage)) return;
        }

        delete AppState.data.promptDictionaries[dictId];

        if (AppState.data.currentPromptDictionary === dictId) {
          AppState.data.currentPromptDictionary = "main";
        }

        await savePromptDictionaries();
        this.updateDictionarySelector();
        this.updateDictionaryList();
        this.updateStats();

        ErrorHandler.showToast(`辞書「${dict.name}」を削除しました`, UI_DELAYS.LONG, "success");
      }

      startDictionaryNameEdit(displayElement, editElement) {
        displayElement.style.display = "none";
        editElement.style.display = "inline-block";
        editElement.focus();
        editElement.select();
      }

      async finishDictionaryNameEdit(dictId, displayElement, editElement) {
        const newName = editElement.value.trim();

        if (!newName) {
          ErrorHandler.showToast("辞書名を入力してください", UI_DELAYS.LONG, "warning");
          editElement.focus();
          return;
        }

        const existingDict = Object.keys(AppState.data.promptDictionaries).find(
          (id) => id !== dictId && AppState.data.promptDictionaries[id].name === newName
        );

        if (existingDict) {
          ErrorHandler.showToast("同じ名前の辞書が既に存在します", UI_DELAYS.LONG, "warning");
          editElement.focus();
          return;
        }

        try {
          AppState.data.promptDictionaries[dictId].name = newName;
          await savePromptDictionaries();

          displayElement.textContent = newName;
          displayElement.style.display = "inline";
          editElement.style.display = "none";

          this.updateDictionarySelector();

          ErrorHandler.showToast(`辞書名を「${newName}」に変更しました`, UI_DELAYS.LONG, "success");
        } catch (error) {
          ErrorHandler.showToast("辞書名の変更に失敗しました", UI_DELAYS.LONG, "error");
          this.cancelDictionaryNameEdit(displayElement, editElement);
        }
      }

      cancelDictionaryNameEdit(displayElement, editElement) {
        const dictId = editElement.dataset.dictId;
        const originalName = AppState.data.promptDictionaries[dictId]?.name || "";
        editElement.value = originalName;

        displayElement.style.display = "inline";
        editElement.style.display = "none";
      }

      setupDuplicateCheckButton() {
        const btn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DUPLICATE_CHECK);
        if (btn) {
          this.addEventListener(btn, "click", () => {
            this.showDuplicateCheckModal();
          });
          this.updateDuplicateCheckButtonVisibility();
        }
      }

      updateDuplicateCheckButtonVisibility() {
        const btn = this.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DUPLICATE_CHECK);
        if (!btn) return;

        const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];

        if (duplicates.length > 0) {
          btn.style.display = "";
          btn.title = `マスター辞書と重複している項目をチェック（${duplicates.length}件）`;
        } else {
          btn.style.display = "none";
        }
      }

      async showDuplicateCheckModal(isStartup = false) {
        const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];

        if (duplicates.length === 0) {
          if (!isStartup) {
            alert("重複している項目はありません");
          }
          return;
        }

        if (!this.duplicateCheckModal) {
          this.createDuplicateCheckModal();
        }

        await this.renderDuplicateList(duplicates);
        this.duplicateCheckModal.show();
      }

      createDuplicateCheckModal() {
        this.duplicateCheckModal = BaseModal.create(
          "duplicate-check-modal",
          "マスター辞書と重複している項目",
          `
          <div class="duplicate-check-content">
            <p class="duplicate-check-description">
              以下の項目はマスター辞書に採用されています。削除しても問題ありません。
            </p>
            <div id="duplicate-check-list" class="duplicate-check-list"></div>
          </div>
          `,
          {
            closeOnBackdrop: true,
            closeOnEsc: true,
            showCloseButton: true,
            showHeader: true,
            showFooter: true,
            footerActions: [
              {
                text: "一括削除",
                className: "danger",
                action: "bulk-delete",
              },
              {
                text: "閉じる",
                action: "close",
              },
              {
                text: "以降表示しない",
                action: "dismiss",
              },
            ],
          }
        );

        const modal = document.getElementById("duplicate-check-modal");
        if (modal) {
          const footer = modal.querySelector(".modal-footer");
          if (footer) {
            const note = document.createElement("span");
            note.className = "duplicate-check-footer-note";
            note.textContent = "※ 辞書タブの「重複チェック」ボタンからいつでも確認できます";
            footer.insertBefore(note, footer.firstChild);

            const bulkDeleteBtn = footer.querySelector('[data-action="bulk-delete"]');
            const closeBtn = footer.querySelector('[data-action="close"]');
            const dismissBtn = footer.querySelector('[data-action="dismiss"]');

            if (bulkDeleteBtn) {
              bulkDeleteBtn.addEventListener("click", async () => {
                const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];
                if (duplicates.length === 0) return;

                const confirmed = confirm(
                  `重複している${duplicates.length}件の項目を全て削除しますか？\nこの操作は取り消せません。`
                );
                if (!confirmed) return;

                const indicesToDelete = duplicates.map((d) => d.index).sort((a, b) => b - a);
                for (const index of indicesToDelete) {
                  AppState.data.localPromptList.splice(index, 1);
                }

                if (window.saveLocalList) {
                  await window.saveLocalList();
                }
                this.updateStats();
                this.duplicateCheckModal.hide();
                alert(`${duplicates.length}件の重複項目を削除しました`);
              });
            }

            if (closeBtn) {
              closeBtn.addEventListener("click", () => {
                this.duplicateCheckModal.hide();
              });
            }

            if (dismissBtn) {
              dismissBtn.addEventListener("click", async () => {
                if (window.saveDuplicateCheckDismissed) {
                  await window.saveDuplicateCheckDismissed(true);
                }
                this.duplicateCheckModal.hide();
              });
            }
          }
        }
      }

      async renderDuplicateList(duplicates) {
        const container = document.getElementById("duplicate-check-list");
        if (!container) return;

        await this.app.listManager.createFlexibleList(
          duplicates.map((d) => d.item),
          "#duplicate-check-list",
          {
            ...LIST_TYPE_CONFIGS.duplicateCheck,
            header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT,
            onDelete: async (index, item) => {
              const localIndex = AppState.data.localPromptList.findIndex(
                (local) =>
                  local.prompt === item.prompt &&
                  local.data[0] === item.data[0] &&
                  local.data[1] === item.data[1] &&
                  local.data[2] === item.data[2]
              );
              if (localIndex !== -1) {
                AppState.data.localPromptList.splice(localIndex, 1);
                if (window.saveLocalList) {
                  await window.saveLocalList();
                }
                this.updateStats();
              }

              const newDuplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];
              if (newDuplicates.length === 0) {
                this.duplicateCheckModal.hide();
                alert("すべての重複項目を削除しました");
              } else {
                await this.renderDuplicateList(newDuplicates);
              }
              return false; // ListManagerの標準削除処理をスキップ
            },
          }
        );
      }

      debug() {
        super.debug();
        // debugMode有効時のみ詳細表示
        if (AppState.config.debugMode) {
        }
      }
    }

    if (typeof window !== "undefined") {
      window.DictionaryTab = DictionaryTab;
    }
  }

  defineDictionaryTab();
})();
