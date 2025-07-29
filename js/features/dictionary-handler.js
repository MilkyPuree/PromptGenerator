// ============================================
// 辞書ハンドラークラス
// ============================================
class DictionaryHandler {
  constructor(app) {
    this.app = app; // PromptGeneratorAppインスタンスへの参照
  }

  /**
   * 辞書の表示/非表示を切り替え
   * @param {string} type - 辞書タイプ（prompt/element/master）
   */
  toggleDictionary(type) {
    const configs = {
      prompt: {
        listId: DOM_SELECTORS.BY_ID.FAVORITE_LIST,
        textId: "#promptDicText",
        openText: "▼お気に入りリスト　※ここをクリックで開閉",
        closeText: "▶お気に入りリスト　※ここをクリックで開閉",
        createFunc: async () => {
          const currentDict = getCurrentPromptDictionary();
          const sorted = [...(currentDict.prompts || [])].sort(
            (a, b) => (a.sort || 0) - (b.sort || 0)
          );
          await this.app.listManager.createFlexibleList(
            sorted,
            DOM_SELECTORS.BY_ID.FAVORITE_LIST,
            {
              fields: FAVORITE_FIELDS,
              buttons: FAVORITE_BUTTONS,
              sortable: true,
              listType: "favorite",
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.PROMPT, // ⭐️ お気に入りリスト
              scrollRestoreDelay: 100, // スクロール復元遅延時間
              refreshCallback: async () => {
                // 統一リフレッシュコールバック
                await this.refreshFavoriteList();
              },
              idOffset: ID_OFFSETS.FAVORITES,
            }
          );
        },
      },
      element: {
        listId: DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
        textId: "#elementDicText",
        openText: "▼要素辞書(ローカル)　※ここをクリックで開閉",
        closeText: "▶要素辞書(ローカル)　※ここをクリックで開閉",
        createFunc: async () => {
          const sorted = [...AppState.data.localPromptList].sort(
            (a, b) => (a.sort || 0) - (b.sort || 0)
          );
          await this.app.listManager.createFlexibleList(
            sorted,
            DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
            {
              fields: STANDARD_CATEGORY_FIELDS,
              buttons: [...STANDARD_BUTTONS, { type: "delete" }],
              sortable: true,
              listType: "add",
              header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT, // 💾 ユーザー辞書
              scrollRestoreDelay: 100, // スクロール復元遅延時間
              refreshCallback: async () => {
                // 統一リフレッシュコールバック
                await this.refreshElementList();
              },
              idOffset: ID_OFFSETS.USER_DICTIONARY,
            }
          );

          // リスト作成後にsortableを初期化
          setTimeout(() => {
            // ここで大項目・中項目のIDを持つ要素への参照をクリア
            // カテゴリー連動はFlexibleListのカスタムドロップダウンで自動設定されるため不要

            EventHandlers.setupSortableList(
              DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
              async (sortedIds) => {
                let baseIndex = 0;
                sortedIds.forEach((id) => {
                  if (!id) return;
                  AppState.data.localPromptList[id].sort = baseIndex++;
                });
                await saveLocalList();
              }
            );
          }, 100);
        },
      },
      master: {
        listId: DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
        textId: "#masterDicText",
        openText: "▼要素辞書(マスタ)　※ここをクリックで開閉",
        closeText: "▶要素辞書(マスタ)　※ここをクリックで開閉",
        createFunc: async () => {
          const masterData = getMasterPrompts();
          console.log(
            `[dictionary-handler] Loading master dictionary: ${masterData.length} items`
          );

          await this.app.listManager.createFlexibleList(
            masterData,
            DOM_SELECTORS.BY_ID.MASTER_DIC_LIST,
            {
              fields: STANDARD_CATEGORY_FIELDS,
              buttons: STANDARD_BUTTONS,
              showHeaders: true,
              readonly: true,
              // 大量データ用の仮想スクロール設定
              useVirtualization: true,
              itemHeight: 35,
              containerHeight: 400,
              buffer: 10,
              scrollRestoreDelay: 100, // スクロール復元遅延時間
              refreshCallback: async () => {
                // 統一リフレッシュコールバック
                await this.refreshMasterList();
              },
              idOffset: ID_OFFSETS.MASTER_DICTIONARY,
            }
          );
        },
      },
    };

    const config = configs[type];
    // jQuery → Vanilla JS 置換 (Phase 8)
    const listElement = document.querySelector(config.listId);
    const textElement = document.querySelector(config.textId);

    if (listElement && listElement.children.length > 0) {
      ListBuilder.clearList(config.listId);
      if (textElement) {
        textElement.textContent = config.closeText;
      }
    } else {
      config.createFunc();
      if (textElement) {
        textElement.textContent = config.openText;
      }
    }
  }

  /**
   * 要素の登録処理
   */
  async handleElementRegistration() {
    const bigInput = document.getElementById(DOM_IDS.CATEGORY.BIG);
    const middleInput = document.getElementById(DOM_IDS.CATEGORY.MIDDLE);
    const smallInput = document.getElementById(DOM_IDS.CATEGORY.SMALL);
    const promptInput = document.getElementById(DOM_IDS.CATEGORY.PROMPT);

    const data = {
      big: bigInput ? bigInput.value : "",
      middle: middleInput ? middleInput.value : "",
      small: smallInput ? smallInput.value : "",
      prompt: promptInput ? promptInput.value : "",
    };

    // バリデーション
    const promptValidation = Validators.validatePrompt(data.prompt);
    if (!promptValidation.isValid) {
      ErrorHandler.notify(promptValidation.errors[0].message);
      return;
    }

    const categoryValidation = Validators.validateCategories(data);
    if (!categoryValidation.isValid) {
      ErrorHandler.notify(categoryValidation.errors[0].message);
      return;
    }

    // 登録
    const success = register(data.big, data.middle, data.small, data.prompt);
    if (success) {
      // 入力フィールドをクリア
      if (bigInput) bigInput.value = "";
      if (middleInput) middleInput.value = "";
      if (smallInput) smallInput.value = "";
      if (promptInput) promptInput.value = "";
      this.refreshAddList();
    }
  }

  /**
   * アーカイブリストを更新
   */
  async refreshFavoriteList() {
    const favoriteListElement = document.querySelector(
      DOM_SELECTORS.BY_ID.FAVORITE_LIST
    );
    if (favoriteListElement && favoriteListElement.children.length > 0) {
      const currentDict = getCurrentPromptDictionary();
      const sorted = [...(currentDict.prompts || [])].sort(
        (a, b) => (a.sort || 0) - (b.sort || 0)
      );
      await this.app.listManager.createFlexibleList(
        sorted,
        DOM_SELECTORS.BY_ID.FAVORITE_LIST,
        {
          fields: FAVORITE_FIELDS,
          buttons: FAVORITE_BUTTONS,
          sortable: true,
          listType: "favorite",
          idOffset: ID_OFFSETS.FAVORITES,
        }
      );
    }
  }

  /**
   * 追加リストを更新
   */
  async refreshAddList() {
    const addPromptListElement = document.querySelector(
      DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST
    );
    if (addPromptListElement && addPromptListElement.children.length > 0) {
      // sortableを破棄
      if (addPromptListElement.classList.contains("ui-sortable")) {
        if (
          window.$ &&
          typeof $(addPromptListElement).sortable === "function"
        ) {
          $(addPromptListElement).sortable("destroy");
        }
      }

      const sorted = [...AppState.data.localPromptList].sort(
        (a, b) => (a.sort || 0) - (b.sort || 0)
      );
      await this.app.listManager.createFlexibleList(
        sorted,
        DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
        {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: [...STANDARD_BUTTONS, { type: "delete" }],
          sortable: true,
          listType: "add",
          idOffset: ID_OFFSETS.USER_DICTIONARY,
        }
      );

      // sortableを再初期化
      EventHandlers.setupSortableList(
        DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST,
        async (sortedIds) => {
          let baseIndex = 0;
          sortedIds.forEach((id) => {
            if (!id) return;
            AppState.data.localPromptList[id].sort = baseIndex++;
          });
          await saveLocalList();
        }
      );
    }
  }

  /**
   * カテゴリー入力フィールドの設定
   */
  setupCategoryInputs() {
    const bigInput = document.getElementById(DOM_IDS.CATEGORY.BIG);
    const middleInput = document.getElementById(DOM_IDS.CATEGORY.MIDDLE);
    const smallInput = document.getElementById(DOM_IDS.CATEGORY.SMALL);

    if (bigInput && middleInput) {
      // 大項目、中項目、小項目の連動
      EventHandlers.setupCategoryChain([bigInput, middleInput, smallInput]);

      // クリア動作を追加
      EventHandlers.addInputClearBehavior(bigInput);
      EventHandlers.addInputClearBehavior(middleInput);

      // 小項目は単純な入力フィールドとして扱う
      if (smallInput) {
        EventHandlers.addInputClearBehavior(smallInput);
      }
    }
  }
}

// グローバルに公開
if (typeof window !== "undefined") {
  window.DictionaryHandler = DictionaryHandler;
}
