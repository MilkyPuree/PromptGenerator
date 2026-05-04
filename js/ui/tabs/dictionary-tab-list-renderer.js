(function () {
  "use strict";

  class DictionaryTabListRenderer {
    constructor(dictTab) {
      this.dictTab = dictTab;
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
        this.dictTab.addEventListener(item, "click", (e) => {
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
          this.dictTab.debugDOMStructure();
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

        this.dictTab.currentDictionary = dictionaryType;
      } catch (error) {}
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
            const currentDictId = UIHelpers.getCurrentDictId();
            const currentDict = AppState.data.promptDictionaries?.[currentDictId];
            const prompts = currentDict?.prompts || [];

            const sorted = [...prompts].sort((a, b) => (a.sort || 0) - (b.sort || 0));

            const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

            const favoriteListConfig = {
              fields: FAVORITE_FIELDS,
              buttons: FAVORITE_BUTTONS,
              sortable: true,
              listType: FLEXIBLE_LIST_TYPES.FAVORITE,
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT,
              headerClickSort: {
                enabled: true,
                listManager: this.dictTab.listManager,
                dataArray: prompts,
                refreshCallback: async () => await this.refreshFavoriteList(),
                saveCallback: async () => await savePromptDictionaries(),
              },
              refreshCallback: async () => {
                await this.refreshFavoriteList();
              },
              removeElementFromData: async (elementId) => {
                const currentDictId = UIHelpers.getCurrentDictId();
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
                const currentDictId = UIHelpers.getCurrentDictId();
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
                  if (this.dictTab.flexibleElementManager && item?.id) {
                    this.dictTab.flexibleElementManager.saveScrollPosition();

                    const currentDictId = UIHelpers.getCurrentDictId();
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
                          this.dictTab.flexibleElementManager.restoreScrollPosition();
                        }, 10);

                        this.dictTab.updateStats();
                        return false;
                      }
                    }
                  }
                } catch (error) {
                  throw error;
                }

                const currentDictId = UIHelpers.getCurrentDictId();
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
                    this.dictTab.updateStats();
                  }
                }
              },
              onSort: async (sortedIds) => {
                const currentDictId = UIHelpers.getCurrentDictId();
                const currentDict = AppState.data.promptDictionaries[currentDictId];

                if (currentDict && currentDict.prompts) {
                  await this.dictTab.listManager.handleSortCommon(sortedIds, currentDict.prompts, async () => {
                    if (window.ensureDictionaryElementIds) {
                      currentDict.prompts = window.ensureDictionaryElementIds(currentDict.prompts);
                    }
                    await savePromptDictionaries();
                  });
                }
              },
            };

            if (this.dictTab.flexibleElementManager) {
              this.dictTab.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.FAVORITE_LIST, favoriteListConfig);
            }

            await this.dictTab.listManager.createFlexibleList(
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
            const listManager = this.dictTab.listManager;
            const sortState = listManager?.sortStates?.get("#addPromptList-list");
            const isHeaderSorted = sortState && sortState.column && sortState.direction;

            const sorted = isHeaderSorted
              ? [...AppState.data.localPromptList]
              : [...AppState.data.localPromptList].sort((a, b) => (a.sort || 0) - (b.sort || 0));

            const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

            const listConfig = {
              fields: STANDARD_CATEGORY_FIELDS,
              buttons: [...STANDARD_BUTTONS, { type: "delete" }],
              sortable: true,
              listType: FLEXIBLE_LIST_TYPES.ADD,
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT,
              headerClickSort: {
                enabled: true,
                listManager: this.dictTab.listManager,
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
                focusNext: false,
                focusPromptAfterSmall: false,
              },
              onEnterBlurChange: async (index, fieldKey, value, item, eventType) => {
                if (this.dictTab.flexibleElementManager && item?.id) {
                  await this.dictTab.flexibleElementManager.updateFieldOnly(item.id, fieldKey, value);
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

                      this.dictTab.updateStats();
                    }

                    return false;
                  }

                  if (index >= 0 && index < AppState.data.localPromptList.length) {
                    AppState.data.localPromptList.splice(index, 1);
                    await saveLocalList(false);
                    this.dictTab.updateStats();
                  }

                  return false;
                } catch (error) {
                  return false;
                }
              },
              onSort: async (sortedIds) => {
                await this.dictTab.listManager.handleSortCommon(sortedIds, AppState.data.localPromptList, async () => {
                  if (window.ensureLocalPromptIntegrity) {
                    await window.ensureLocalPromptIntegrity(true);
                  } else {
                    await saveLocalList();
                  }
                });
              },
              setupSpecialFeatures: ($li, inputs) => {},
            };

            if (this.dictTab.flexibleElementManager) {
              this.dictTab.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, listConfig);
            }

            await this.dictTab.listManager.createFlexibleList(sortedWithIds, DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, listConfig);
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
                await this.dictTab.listManager.createFlexibleList([], DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
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

              await this.dictTab.listManager.createFlexibleList(masterDataWithIds, DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
                fields: STANDARD_CATEGORY_FIELDS,
                buttons: STANDARD_BUTTONS,
                showHeaders: true,
                readonly: true,
                header: FLEXIBLE_LIST_HEADERS.DICTIONARY.MASTER,
                containerHeight: 500,
                virtualScroll: 1000,
                refreshCallback: async () => {
                  await this.refreshMasterDictionary();
                },
              });
            } catch (error) {
              await this.dictTab.listManager.createFlexibleList([], DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
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

      const isExpanded = this.dictTab.dictionaryStates[type];

      if (isExpanded) {
        if (config.listId) {
          ListBuilder.clearList(config.listId);
        }
        $container.removeClass("expanded");
        if (header) header.setAttribute("data-expanded", "false");
        if (toggleIcon) toggleIcon.textContent = "▶";
        if ($text.length && config.closeText) $text.text(config.closeText);
        this.dictTab.dictionaryStates[type] = false;
      } else {
        if (config.createFunc) {
          await config.createFunc();
        }
        $container.addClass("expanded");
        if (header) header.setAttribute("data-expanded", "true");
        if (toggleIcon) toggleIcon.textContent = "▼";
        if ($text.length && config.openText) $text.text(config.openText);
        this.dictTab.dictionaryStates[type] = true;

        setTimeout(() => {
          this.dictTab.updateStats();
        }, ADDITIONAL_DELAYS.ELEMENT_UPDATE);
      }

      this.dictTab.updateStats();
    }

    async refreshFavoriteList() {
      const currentDictId = UIHelpers.getCurrentDictId();
      const currentDict = AppState.data.promptDictionaries?.[currentDictId];
      const prompts = currentDict?.prompts || [];

      if (!currentDict) {
        return;
      }

      const listManager = this.dictTab.listManager;
      const sortState = listManager?.sortStates?.get("#favoriteList-list");
      const isHeaderSorted = sortState && sortState.column && sortState.direction;

      const sorted = isHeaderSorted ? [...prompts] : [...prompts].sort((a, b) => (a.sort || 0) - (b.sort || 0));

      const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

      try {
        const refreshFavoriteConfig = {
          fields: FAVORITE_FIELDS,
          buttons: FAVORITE_BUTTONS,
          sortable: true,
          listType: FLEXIBLE_LIST_TYPES.FAVORITE,
          header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT,
          headerClickSort: {
            enabled: true,
            listManager: this.dictTab.listManager,
            dataArray: prompts,
            refreshCallback: async () => await this.refreshFavoriteList(),
            saveCallback: async () => await savePromptDictionaries(),
          },
          refreshCallback: async () => {
            await this.refreshFavoriteList();
          },
          removeElementFromData: async (elementId) => {
            const currentDictId = UIHelpers.getCurrentDictId();
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
            if (this.dictTab.flexibleElementManager && item?.id) {
              await this.dictTab.flexibleElementManager.updateFieldOnly(item.id, fieldKey, value);
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
            if (this.dictTab.flexibleElementManager && item?.id) {
              const success = await this.dictTab.flexibleElementManager.removeElement(item.id);
              if (success) {
                return false;
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
              this.dictTab.updateStats();
            }
          },
          onSort: async (sortedIds) => {
            await this.dictTab.listManager.handleSortCommon(sortedIds, prompts, async () => {
              if (window.ensureDictionaryElementIds) {
                const currentDictId = UIHelpers.getCurrentDictId();
                const currentDict = AppState.data.promptDictionaries[currentDictId];
                if (currentDict && currentDict.prompts) {
                  currentDict.prompts = window.ensureDictionaryElementIds(currentDict.prompts);
                }
              }
              await savePromptDictionaries();
            });
          },
        };

        if (this.dictTab.flexibleElementManager) {
          this.dictTab.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.FAVORITE_LIST, refreshFavoriteConfig);
        }

        await this.dictTab.listManager.createFlexibleList(sortedWithIds, DOM_SELECTORS.BY_ID.FAVORITE_LIST, {
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

        await this.dictTab.listManager.createFlexibleListWithHeader(masterDataWithIds, DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
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
        await this.dictTab.listManager.createFlexibleListWithHeader([], DOM_SELECTORS.BY_ID.MASTER_DIC_LIST, {
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
      const listManager = this.dictTab.listManager;
      const sortState = listManager?.sortStates?.get("#addPromptList-list");
      const isHeaderSorted = sortState && sortState.column && sortState.direction;

      const sorted = isHeaderSorted
        ? [...AppState.data.localPromptList]
        : [...AppState.data.localPromptList].sort((a, b) => (a.sort || 0) - (b.sort || 0));

      const sortedWithIds = window.ensureDictionaryElementIds([...sorted]);

      const refreshListConfig = {
        fields: STANDARD_CATEGORY_FIELDS,
        buttons: [...STANDARD_BUTTONS, { type: "delete" }],
        sortable: true,
        listType: FLEXIBLE_LIST_TYPES.ADD,
        header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT,
        headerClickSort: {
          enabled: true,
          listManager: this.dictTab.listManager,
          dataArray: AppState.data.localPromptList,
          refreshCallback: async () => await this.refreshAddList(),
          saveCallback: async () => await saveLocalList(),
        },
        refreshCallback: async () => {
          await this.refreshAddList();
        },
        ...CATEGORY_CHAIN_CONFIG.TWO_CHAIN,
        onEnterBlurChange: async (index, fieldKey, value, item, eventType) => {
          if (this.dictTab.flexibleElementManager && item?.id && eventType !== "blur_from_flexible_manager") {
            await this.dictTab.flexibleElementManager.updateFieldOnly(item.id, fieldKey, value);
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
          await this.dictTab.listManager.handleSortCommon(sortedIds, AppState.data.localPromptList, async () => {
            if (window.ensureLocalPromptIntegrity) {
              await window.ensureLocalPromptIntegrity(true);
            } else {
              await saveLocalList();
            }
          });
        },
      };

      if (this.dictTab.flexibleElementManager) {
        this.dictTab.flexibleElementManager.setCurrentList(DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, refreshListConfig);
      }

      await this.dictTab.listManager.createFlexibleList(sortedWithIds, DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST, {
        ...refreshListConfig,
        idOffset: ID_OFFSETS.USER_DICTIONARY,
      });
    }
  }

  if (typeof window !== "undefined") {
    window.DictionaryTabListRenderer = DictionaryTabListRenderer;
  }
})();
