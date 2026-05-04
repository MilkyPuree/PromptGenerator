const ListRefreshManager = {
  ACTIONS: {
    ELEMENT_ADD: "element_add", // 要素追加
    ELEMENT_DELETE: "element_delete", // 要素削除
    ELEMENT_EDIT: "element_edit", // 要素編集
    PROMPT_SAVE: "prompt_save", // プロンプト保存
    PROMPT_ADD: "prompt_add", // お気に入りリスト追加
    PROMPT_DELETE: "prompt_delete", // お気に入りリスト削除
    PROMPT_EDIT: "prompt_edit", // お気に入りリスト編集
    SLOT_SWITCH: "slot_switch", // スロット切替
    SLOT_CLEAR: "slot_clear", // スロットクリア
    CATEGORY_UPDATE: "category_update", // カテゴリ更新
    TRANSLATION_REG: "translation_reg", // 翻訳結果登録
    PROMPT_CHANGE: "prompt_change", // プロンプト変更
  },

  LISTS: {
    SEARCH_RESULTS: "search_results", // 検索結果
    LOCAL_DICTIONARY: "local_dictionary", // ローカル辞書
    EDIT_TAB: "edit_tab", // 編集タブ
    PROMPT_DICTIONARY: "prompt_dictionary", // お気に入りリスト
    SLOT_LIST: "slot_list", // スロット一覧
    CATEGORY_DROPDOWNS: "category_dropdowns", // カテゴリドロップダウン
  },

  ACTION_DEPENDENCIES: {
    [this.ACTIONS?.ELEMENT_ADD]: ["search_results", "local_dictionary", "category_dropdowns"],
    [this.ACTIONS?.ELEMENT_DELETE]: ["search_results", "local_dictionary", "edit_tab"],
    [this.ACTIONS?.ELEMENT_EDIT]: ["search_results", "local_dictionary", "edit_tab"],
    [this.ACTIONS?.PROMPT_SAVE]: ["prompt_dictionary"],
    [this.ACTIONS?.SLOT_SWITCH]: ["edit_tab"],
    [this.ACTIONS?.TRANSLATION_REG]: ["search_results", "local_dictionary"],
    [this.ACTIONS?.PROMPT_CHANGE]: ["edit_tab"],
  },

  LIST_REFRESHERS: {},

  init() {
    this.ACTION_DEPENDENCIES = {
      [this.ACTIONS.ELEMENT_ADD]: [
        this.LISTS.SEARCH_RESULTS,
        this.LISTS.LOCAL_DICTIONARY,
        this.LISTS.CATEGORY_DROPDOWNS,
        this.LISTS.EDIT_TAB,
      ],
      [this.ACTIONS.ELEMENT_DELETE]: [this.LISTS.SEARCH_RESULTS, this.LISTS.LOCAL_DICTIONARY, this.LISTS.EDIT_TAB],
      [this.ACTIONS.ELEMENT_EDIT]: [this.LISTS.SEARCH_RESULTS, this.LISTS.LOCAL_DICTIONARY, this.LISTS.EDIT_TAB],
      [this.ACTIONS.PROMPT_SAVE]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.PROMPT_ADD]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.PROMPT_DELETE]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.PROMPT_EDIT]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.SLOT_SWITCH]: [this.LISTS.EDIT_TAB],
      [this.ACTIONS.SLOT_CLEAR]: [this.LISTS.EDIT_TAB],
      [this.ACTIONS.TRANSLATION_REG]: [this.LISTS.LOCAL_DICTIONARY],
      [this.ACTIONS.PROMPT_CHANGE]: [this.LISTS.EDIT_TAB],
    };

    this.LIST_REFRESHERS = {
      [this.LISTS.SEARCH_RESULTS]: () => this.refreshSearchResults(),
      [this.LISTS.LOCAL_DICTIONARY]: () => this.refreshLocalDictionary(),
      [this.LISTS.EDIT_TAB]: () => this.refreshEditTab(),
      [this.LISTS.PROMPT_DICTIONARY]: () => this.refreshPromptDictionary(),
      [this.LISTS.SLOT_LIST]: () => this.refreshSlotList(),
      [this.LISTS.CATEGORY_DROPDOWNS]: () => this.refreshCategoryDropdowns(),
    };
  },

  async executeAction(action, options = {}) {
    const opts = {
      sourceList: null,
      context: {},
      delay: 700,
      showNotification: true,
      ...options,
    };

    const dependentLists = this.ACTION_DEPENDENCIES[action] || [];

    if (dependentLists.length === 0) {
      return;
    }

    const listsToRefresh = dependentLists.filter((list) => list !== opts.sourceList);

    if (opts.delay > 0) {
      setTimeout(async () => {
        await this.refreshLists(listsToRefresh, opts.context);
      }, opts.delay);
    } else {
      await this.refreshLists(listsToRefresh, opts.context);
    }

    if (opts.showNotification) {
      this.showActionSuccessNotification(action);
    }
  },

  async refreshLists(listNames, context = {}) {
    for (const listName of listNames) {
      if (listName === "edit_tab") {
        const app = window.app || window.promptApp;
        if (!app?.tabs?.edit?.initialized) {
          continue;
        }
      }

      if (listName === "local_dictionary") {
        const dictionaryTabElement = document.getElementById(DOM_IDS.DICTIONARY.TAB_BODY);
        if (!dictionaryTabElement || !dictionaryTabElement.classList.contains("is-show")) {
          continue;
        }
      }

      const refresher = this.LIST_REFRESHERS[listName];
      if (refresher) {
        try {
          await refresher(context);
        } catch (error) {}
      }
    }
  },

  async refreshSearchResults(context = {}) {
    let searchTab = null;

    if (window.app?.tabs?.search?.refreshSearchResults) {
      searchTab = window.app.tabs.search;
    } else if (window.app?.searchTab?.refreshSearchResults) {
      searchTab = window.app.searchTab;
    } else if (window.app?.tabs && typeof window.app.tabs === "object") {
      for (let [tabName, tab] of Object.entries(window.app.tabs)) {
        if (tab && typeof tab.refreshSearchResults === "function" && tab.constructor.name === "SearchTab") {
          searchTab = tab;
          break;
        }
      }
    }

    if (searchTab && typeof searchTab.refreshSearchResults === "function") {
      await searchTab.refreshSearchResults(true); // forceRefresh
    }
  },

  async refreshLocalDictionary(context = {}) {
    let dictionaryTab = null;

    if (window.app?.tabs?.dictionary?.refreshAddList) {
      dictionaryTab = window.app.tabs.dictionary;
    } else if (window.app?.dictionaryTab?.refreshAddList) {
      dictionaryTab = window.app.dictionaryTab;
    } else if (window.app?.tabs && typeof window.app.tabs === "object") {
      for (let [tabName, tab] of Object.entries(window.app.tabs)) {
        if (tab && typeof tab.refreshAddList === "function" && tab.constructor.name === "DictionaryTab") {
          dictionaryTab = tab;
          break;
        }
      }
    }

    if (dictionaryTab && typeof dictionaryTab.refreshAddList === "function") {
      await dictionaryTab.refreshAddList();
    } else {
      if (window.app?.refreshAddList) {
        window.app.refreshAddList();
      }
    }
  },

  async refreshEditTab(context = {}) {
    let editTab = null;

    if (window.app?.tabs?.edit?.refreshEditList) {
      editTab = window.app.tabs.edit;
    } else if (window.app?.editTab?.refreshEditList) {
      editTab = window.app.editTab;
    } else if (window.app?.tabs && typeof window.app.tabs === "object") {
      for (let [tabName, tab] of Object.entries(window.app.tabs)) {
        if (tab && typeof tab.refreshEditList === "function" && tab.constructor.name === "EditTab") {
          editTab = tab;
          break;
        }
      }
    }

    if (editTab && typeof editTab.refreshEditList === "function") {
      await editTab.refreshEditList();
    }
  },

  async refreshPromptDictionary(context = {}) {
    // TODO: 実装が必要な場合
  },

  async refreshSlotList(context = {}) {
    if (window.app?.slotTab?.refreshSlotList) {
      await window.app.slotTab.refreshSlotList();
    }
  },

  async refreshCategoryDropdowns(context = {}) {
    if (window.categoryData?.update) {
      await window.categoryData.update();
    }
  },

  showActionSuccessNotification(action) {
    const messages = {
      [this.ACTIONS.ELEMENT_ADD]: "要素を追加しました",
      [this.ACTIONS.ELEMENT_DELETE]: "要素を削除しました",
      [this.ACTIONS.ELEMENT_EDIT]: "要素を更新しました",
      [this.ACTIONS.PROMPT_SAVE]: "プロンプトを保存しました",
      [this.ACTIONS.PROMPT_ADD]: "プロンプトを追加しました",
      [this.ACTIONS.PROMPT_DELETE]: "プロンプトを削除しました",
      [this.ACTIONS.PROMPT_EDIT]: "プロンプトを更新しました",
      [this.ACTIONS.SLOT_SWITCH]: "スロットを切り替えました",
      [this.ACTIONS.SLOT_CLEAR]: "スロットをクリアしました",
      [this.ACTIONS.TRANSLATION_REG]: "ローカル辞書に登録しました",
    };

    const message = messages[action] || "アクションが完了しました";

    UIHelpers.notifySuccess(message, 1500);
  },

  addActionDependency(action, dependentLists) {
    this.ACTION_DEPENDENCIES[action] = dependentLists;
  },

  registerListRefresher(listName, refresher) {
    this.LIST_REFRESHERS[listName] = refresher;
  },
};

if (typeof window !== "undefined") {
  window.ListRefreshManager = ListRefreshManager;

  setTimeout(() => {
    ListRefreshManager.init();
  }, 100);
}
