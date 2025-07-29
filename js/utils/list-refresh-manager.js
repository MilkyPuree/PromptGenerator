/**
 * list-refresh-manager.js - リスト更新管理システム
 * アクションとリストの依存関係を中央管理し、適切なリフレッシュを実行
 */

/**
 * リスト更新管理システム
 */
const ListRefreshManager = {
  // アクション定義
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

  // リスト定義
  LISTS: {
    SEARCH_RESULTS: "search_results", // 検索結果
    LOCAL_DICTIONARY: "local_dictionary", // ローカル辞書
    EDIT_TAB: "edit_tab", // 編集タブ
    PROMPT_DICTIONARY: "prompt_dictionary", // お気に入りリスト
    SLOT_LIST: "slot_list", // スロット一覧
    CATEGORY_DROPDOWNS: "category_dropdowns", // カテゴリドロップダウン
  },

  // アクション-リスト依存関係マッピング
  ACTION_DEPENDENCIES: {
    [this.ACTIONS?.ELEMENT_ADD]: [
      "search_results",
      "local_dictionary",
      "category_dropdowns",
    ],
    [this.ACTIONS?.ELEMENT_DELETE]: [
      "search_results",
      "local_dictionary",
      "edit_tab",
    ],
    [this.ACTIONS?.ELEMENT_EDIT]: [
      "search_results",
      "local_dictionary",
      "edit_tab",
    ],
    [this.ACTIONS?.PROMPT_SAVE]: ["prompt_dictionary"],
    [this.ACTIONS?.SLOT_SWITCH]: ["edit_tab"],
    [this.ACTIONS?.TRANSLATION_REG]: ["search_results", "local_dictionary"],
    [this.ACTIONS?.PROMPT_CHANGE]: ["edit_tab"],
  },

  // リスト更新関数のマッピング
  LIST_REFRESHERS: {},

  /**
   * 初期化 - リスト更新関数を登録
   */
  init() {
    // 実際の更新関数を登録
    this.ACTION_DEPENDENCIES = {
      [this.ACTIONS.ELEMENT_ADD]: [
        this.LISTS.SEARCH_RESULTS,
        this.LISTS.LOCAL_DICTIONARY,
        this.LISTS.CATEGORY_DROPDOWNS,
        this.LISTS.EDIT_TAB,
      ],
      [this.ACTIONS.ELEMENT_DELETE]: [
        this.LISTS.SEARCH_RESULTS,
        this.LISTS.LOCAL_DICTIONARY,
        this.LISTS.EDIT_TAB,
      ],
      [this.ACTIONS.ELEMENT_EDIT]: [
        this.LISTS.SEARCH_RESULTS,
        this.LISTS.LOCAL_DICTIONARY,
        this.LISTS.EDIT_TAB,
      ],
      [this.ACTIONS.PROMPT_SAVE]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.PROMPT_ADD]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.PROMPT_DELETE]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.PROMPT_EDIT]: [this.LISTS.PROMPT_DICTIONARY],
      [this.ACTIONS.SLOT_SWITCH]: [this.LISTS.EDIT_TAB],
      [this.ACTIONS.SLOT_CLEAR]: [this.LISTS.EDIT_TAB],
      [this.ACTIONS.TRANSLATION_REG]: [
        this.LISTS.LOCAL_DICTIONARY,
      ],
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

    console.log("ListRefreshManager initialized");
  },

  /**
   * アクション実行時のリスト更新
   * @param {string} action - アクション名
   * @param {Object} options - オプション
   * @param {string} options.sourceList - 更新の発信元リスト（除外対象）
   * @param {Object} options.context - コンテキスト情報
   * @param {number} options.delay - 更新遅延時間（ms）
   * @param {boolean} options.showNotification - 成功通知を表示するか
   */
  async executeAction(action, options = {}) {
    const opts = {
      sourceList: null,
      context: {},
      delay: 700,
      showNotification: true,
      ...options,
    };

    console.log(`ListRefreshManager: Executing action '${action}'`, opts);

    // 依存するリストを取得
    const dependentLists = this.ACTION_DEPENDENCIES[action] || [];

    if (dependentLists.length === 0) {
      console.warn(`No dependent lists found for action: ${action}`);
      return;
    }

    // 除外対象を除いたリストでリフレッシュ実行
    const listsToRefresh = dependentLists.filter(
      (list) => list !== opts.sourceList
    );

    console.log(`Lists to refresh:`, listsToRefresh);
    console.log(`Excluded source list:`, opts.sourceList);

    // 遅延実行でリフレッシュ
    if (opts.delay > 0) {
      setTimeout(async () => {
        await this.refreshLists(listsToRefresh, opts.context);
      }, opts.delay);
    } else {
      await this.refreshLists(listsToRefresh, opts.context);
    }

    // 成功通知
    if (opts.showNotification) {
      this.showActionSuccessNotification(action);
    }
  },

  /**
   * 複数のリストを更新
   * @param {Array} listNames - 更新するリスト名の配列
   * @param {Object} context - コンテキスト情報
   */
  async refreshLists(listNames, context = {}) {
    console.log("ListRefreshManager.refreshLists called with:", listNames);
    console.log("Available refreshers:", Object.keys(this.LIST_REFRESHERS));

    for (const listName of listNames) {
      // 編集タブ関連のリフレッシュは、編集タブが初期化済みの場合のみ実行
      if (listName === "edit_tab") {
        const app = window.app || window.promptApp;
        if (!app?.tabs?.edit?.initialized) {
          console.log(`Skipping refresh for '${listName}': EditTab not initialized`);
          continue;
        }
      }
      
      // ローカル辞書関連のリフレッシュは、辞書タブが表示中の場合のみ実行
      if (listName === "local_dictionary") {
        const dictionaryTabElement = document.getElementById("addTabBody");
        if (!dictionaryTabElement || !dictionaryTabElement.classList.contains("is-show")) {
          console.log(`Skipping refresh for '${listName}': DictionaryTab not visible`);
          continue;
        }
      }

      const refresher = this.LIST_REFRESHERS[listName];
      if (refresher) {
        try {
          console.log(`Refreshing list: ${listName}`);
          await refresher(context);
          console.log(`Successfully refreshed: ${listName}`);
        } catch (error) {
          console.error(`Failed to refresh list '${listName}':`, error);
        }
      } else {
        console.warn(`No refresher found for list: ${listName}`, {
          requestedList: listName,
          availableRefreshers: Object.keys(this.LIST_REFRESHERS),
        });
      }
    }
  },

  /**
   * 検索結果を更新
   */
  async refreshSearchResults(context = {}) {
    console.log("ListRefreshManager.refreshSearchResults called", context);

    // 複数の方法でSearchTabを取得を試行
    let searchTab = null;

    // 方法1: window.app.tabs.search（正しい構造）
    if (window.app?.tabs?.search?.refreshSearchResults) {
      searchTab = window.app.tabs.search;
      console.log("Found searchTab via window.app.tabs.search");
    }
    // 方法2: window.app.searchTab（直接参照がある場合）
    else if (window.app?.searchTab?.refreshSearchResults) {
      searchTab = window.app.searchTab;
      console.log("Found searchTab via window.app.searchTab");
    }
    // 方法3: window.app.tabsオブジェクトのプロパティを検索
    else if (window.app?.tabs && typeof window.app.tabs === "object") {
      for (let [tabName, tab] of Object.entries(window.app.tabs)) {
        if (
          tab &&
          typeof tab.refreshSearchResults === "function" &&
          tab.constructor.name === "SearchTab"
        ) {
          searchTab = tab;
          console.log(`Found searchTab via window.app.tabs.${tabName}`);
          break;
        }
      }
    }

    console.log("Final searchTab:", searchTab);
    console.log("window.app:", window.app);
    console.log("window.app.tabs:", window.app?.tabs);

    if (searchTab && typeof searchTab.refreshSearchResults === "function") {
      console.log(
        "Calling searchTab.refreshSearchResults with forceRefresh=true"
      );
      await searchTab.refreshSearchResults(true); // forceRefresh
      console.log("searchTab.refreshSearchResults completed");
    } else {
      console.warn("SearchTab or refreshSearchResults method not found", {
        searchTab: searchTab,
        appTabs: window.app?.tabs,
        appSearchTab: window.app?.searchTab,
      });
    }
  },

  /**
   * ローカル辞書を更新
   */
  async refreshLocalDictionary(context = {}) {
    console.log("ListRefreshManager.refreshLocalDictionary called", context);

    // 複数の方法でDictionaryTabを取得を試行
    let dictionaryTab = null;

    // 方法1: window.app.tabs.dictionary（正しい構造）
    if (window.app?.tabs?.dictionary?.refreshAddList) {
      dictionaryTab = window.app.tabs.dictionary;
      console.log("Found dictionaryTab via window.app.tabs.dictionary");
    }
    // 方法2: window.app.dictionaryTab（直接参照がある場合）
    else if (window.app?.dictionaryTab?.refreshAddList) {
      dictionaryTab = window.app.dictionaryTab;
      console.log("Found dictionaryTab via window.app.dictionaryTab");
    }
    // 方法3: window.app.tabsオブジェクトのプロパティを検索
    else if (window.app?.tabs && typeof window.app.tabs === "object") {
      for (let [tabName, tab] of Object.entries(window.app.tabs)) {
        if (
          tab &&
          typeof tab.refreshAddList === "function" &&
          tab.constructor.name === "DictionaryTab"
        ) {
          dictionaryTab = tab;
          console.log(`Found dictionaryTab via window.app.tabs.${tabName}`);
          break;
        }
      }
    }

    console.log("Final dictionaryTab:", dictionaryTab);
    console.log("Debug info:");
    console.log("- window.app:", window.app);
    console.log("- window.app.tabs:", window.app?.tabs);
    console.log("- window.app.tabs.dictionary:", window.app?.tabs?.dictionary);
    console.log("- window.app.tabs.dictionary type:", typeof window.app?.tabs?.dictionary);
    if (window.app?.tabs?.dictionary) {
      console.log("- dictionary constructor:", window.app.tabs.dictionary.constructor.name);
      console.log("- has refreshAddList:", typeof window.app.tabs.dictionary.refreshAddList);
    }

    if (
      dictionaryTab &&
      typeof dictionaryTab.refreshAddList === "function"
    ) {
      console.log(
        "Calling dictionaryTab.refreshAddList with unified refresh system"
      );
      // 統一リフレッシュシステムを使用してローカル辞書を更新
      await dictionaryTab.refreshAddList();
      console.log("dictionaryTab.refreshAddList completed");
    } else {
      // フォールバック: 古い方法で更新を試行
      console.warn("DictionaryTab not found, trying legacy method");
      if (window.app?.refreshAddList) {
        window.app.refreshAddList();
      }
    }
  },

  /**
   * 編集タブを更新
   */
  async refreshEditTab(context = {}) {
    // 複数の方法でEditTabを取得を試行
    let editTab = null;

    // 方法1: window.app.tabs.edit（正しい構造）
    if (window.app?.tabs?.edit?.refreshEditList) {
      editTab = window.app.tabs.edit;
      console.log("Found editTab via window.app.tabs.edit");
    }
    // 方法2: window.app.editTab（直接参照がある場合）
    else if (window.app?.editTab?.refreshEditList) {
      editTab = window.app.editTab;
      console.log("Found editTab via window.app.editTab");
    }
    // 方法3: window.app.tabsオブジェクトのプロパティを検索
    else if (window.app?.tabs && typeof window.app.tabs === "object") {
      for (let [tabName, tab] of Object.entries(window.app.tabs)) {
        if (
          tab &&
          typeof tab.refreshEditList === "function" &&
          tab.constructor.name === "EditTab"
        ) {
          editTab = tab;
          console.log(`Found editTab via window.app.tabs.${tabName}`);
          break;
        }
      }
    }

    console.log("Final editTab:", editTab);

    if (editTab && typeof editTab.refreshEditList === "function") {
      console.log("Calling editTab.refreshEditList");
      await editTab.refreshEditList();
      console.log("editTab.refreshEditList completed");
    } else {
      console.warn("EditTab or refreshEditList method not found", {
        editTab: editTab,
        appTabs: window.app?.tabs,
        appEditTab: window.app?.editTab,
      });
    }
  },

  /**
   * お気に入りリストを更新
   */
  async refreshPromptDictionary(context = {}) {
    // お気に入りリストの更新処理
    console.log("Refreshing prompt dictionary");
    // TODO: 実装が必要な場合
  },

  /**
   * スロット一覧を更新
   */
  async refreshSlotList(context = {}) {
    // SlotTabから更新
    if (window.app?.slotTab?.refreshSlotList) {
      await window.app.slotTab.refreshSlotList();
    }
  },

  /**
   * カテゴリドロップダウンを更新
   */
  async refreshCategoryDropdowns(context = {}) {
    // カテゴリデータを更新
    if (window.categoryData?.update) {
      await window.categoryData.update();
    }
  },

  /**
   * アクション成功通知を表示
   * @param {string} action - アクション名
   */
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

    if (window.ErrorHandler) {
      window.ErrorHandler.notify(message, {
        type: window.ErrorHandler.NotificationType.TOAST,
        messageType: "success",
        duration: 1500,
      });
    }
  },

  /**
   * 新しいアクション-リスト依存関係を追加
   * @param {string} action - アクション名
   * @param {Array} dependentLists - 依存するリスト名の配列
   */
  addActionDependency(action, dependentLists) {
    this.ACTION_DEPENDENCIES[action] = dependentLists;
    console.log(
      `Added action dependency: ${action} -> ${dependentLists.join(", ")}`
    );
  },

  /**
   * 新しいリスト更新関数を登録
   * @param {string} listName - リスト名
   * @param {Function} refresher - 更新関数
   */
  registerListRefresher(listName, refresher) {
    this.LIST_REFRESHERS[listName] = refresher;
    console.log(`Registered list refresher: ${listName}`);
  },

  /**
   * デバッグ情報を出力
   */
  debug() {
    console.log("=== ListRefreshManager Debug ===");
    console.log("Actions:", this.ACTIONS);
    console.log("Lists:", this.LISTS);
    console.log("Dependencies:", this.ACTION_DEPENDENCIES);
    console.log("Refreshers:", Object.keys(this.LIST_REFRESHERS));
  },
};

// グローバルに公開
if (typeof window !== "undefined") {
  window.ListRefreshManager = ListRefreshManager;

  // 初期化を遅延実行（他のモジュールの読み込み完了を待つ）
  setTimeout(() => {
    ListRefreshManager.init();
  }, 100);
}
