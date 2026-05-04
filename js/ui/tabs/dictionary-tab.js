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

        this.importExport = new DictionaryTabImportExport(this);
        this.listRenderer = new DictionaryTabListRenderer(this);
        this.modalManager = new DictionaryTabModalManager(this);
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
        this.listRenderer.setupDictionaryNavigation();

        this.importExport.setupDownloadButtons();

        this.importExport.setupImportButtons();

        this.modalManager.setupDuplicateCheckButton();

        this.setupFavoriteAddButton();

        this.setupElementRegistration();

        this.modalManager.setupMultipleDictionaryManagement();
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

        this.modalManager.updateDuplicateCheckButtonVisibility();
      }

      async onShow() {
        this.updateStats();

        this.checkEditTabDOMState();

        setTimeout(() => {
          this.updateStats();
        }, ADDITIONAL_DELAYS.SHORT_DELAY);

        setTimeout(() => {
          if (this.currentDictionary) {
            this.listRenderer.switchDictionaryTab(this.currentDictionary);
          } else {
            this.listRenderer.switchDictionaryTab("favorite");
          }
        }, 200);
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
          UIHelpers.notifyError("タイトルとプロンプトを入力してください", UI_DELAYS.LONG);
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
            UIHelpers.notifyError("お気に入り辞書が見つかりません", UI_DELAYS.LONG);
            return;
          }

          if (!currentDict.prompts) {
            currentDict.prompts = [];
          }

          const validation = Validators.checkDuplicateFavorite(trimmedValues.prompt, currentDict.prompts);
          if (!validation.isValid) {
            UIHelpers.notifyError(validation.message, UI_DELAYS.LONG);
            return;
          }

          const newFavorite = {
            id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: trimmedValues.title,
            prompt: trimmedValues.prompt,
            sort: currentDict.prompts.length,
          };

          currentDict.prompts.push(newFavorite);

          await savePromptDictionaries();

          UIHelpers.notifySuccess("お気に入りを追加しました", UI_DELAYS.LONG);

          if (titleElement) titleElement.value = "";
          if (promptElement) promptElement.value = "";

          this.updateStats();

          if (this.currentDictionary === "favorite") {
            await this.refreshFavoriteList();
          }
        } catch (error) {
          UIHelpers.notifyError("お気に入りの追加に失敗しました", UI_DELAYS.LONG);
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
          UIHelpers.notifyError("小項目とプロンプトを入力してください", UI_DELAYS.LONG);
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
            UIHelpers.notifySuccess("要素を追加しました", UI_DELAYS.LONG);

            this.getElement(DOM_SELECTORS.BY_ID.BIG).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.MIDDLE).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.SMALL).value = "";
            this.getElement(DOM_SELECTORS.BY_ID.PROMPT).value = "";

            this.getElement(DOM_SELECTORS.BY_ID.PROMPT)?.focus();

            this.updateStats();

            setTimeout(async () => {
              await this.refreshAddList();
            }, UI_DELAYS.STANDARD_UPDATE);
          } else {
            UIHelpers.notifyWarning("この要素は既に存在します", UI_DELAYS.LONG);
          }
        } catch (error) {
          UIHelpers.notifyError("要素の追加に失敗しました", UI_DELAYS.LONG);
        }
      }

      checkEditTabDOMState() {}

      debugDOMStructure() {
        // debugMode有効時のみコンソールで手動呼び出し用
      }

      // 外部からの呼び出し用委譲メソッド
      async refreshFavoriteList() {
        return this.listRenderer.refreshFavoriteList();
      }

      async refreshAddList() {
        return this.listRenderer.refreshAddList();
      }

      async refreshMasterDictionary() {
        return this.listRenderer.refreshMasterDictionary();
      }

      async showDuplicateCheckModal(isStartup = false) {
        return this.modalManager.showDuplicateCheckModal(isStartup);
      }

      updateDictionarySelector() {
        return this.modalManager.updateDictionarySelector();
      }

      updateDuplicateCheckButtonVisibility() {
        return this.modalManager.updateDuplicateCheckButtonVisibility();
      }

      debug() {
        super.debug();
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
