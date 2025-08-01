// ============================================
// リスト管理クラス - 共通設定定数
// ============================================

// 共通フィールド設定（DRY原則対応）
const STANDARD_CATEGORY_FIELDS = [
  { type: "category", key: "data.0", label: UI_LABELS.BIG_CATEGORY },
  { type: "category", key: "data.1", label: UI_LABELS.MIDDLE_CATEGORY },
  { type: "category", key: "data.2", label: UI_LABELS.SMALL_CATEGORY },
  { type: "prompt", key: "prompt", label: UI_LABELS.PROMPT },
];

const STANDARD_BUTTONS = [
  { 
    type: "add", 
    getValue: (item) => item.prompt,
    title: "プロンプト入力欄に追加"
  },
  { 
    type: "copy", 
    getValue: (item) => item.prompt,
    title: "クリップボードにコピー"
  },
  {
    type: "favorite",
    getValue: (item) => ({
      title: item.data?.[2] || "",
      prompt: item.prompt || "",
    }),
    title: "お気に入りリストに追加"
  },
  { 
    type: "generate", 
    getValue: (item) => item.prompt,
    title: "重み最大(10)でGenerate実行"
  },
];

const FAVORITE_FIELDS = [
  { type: "category", key: "title", label: UI_LABELS.NAME },
  { type: "prompt", key: "prompt", label: UI_LABELS.PROMPT },
];

const FAVORITE_BUTTONS = [
  { 
    type: "load", 
    getValue: (item) => item.prompt,
    title: "プロンプトとして読み込み"
  },
  { 
    type: "copy", 
    getValue: (item) => item.prompt,
    title: "クリップボードにコピー"
  },
  { 
    type: "generate", 
    getValue: (item) => item.prompt,
    title: "このプロンプトでテスト生成"
  },
  { 
    type: "delete",
    title: "お気に入りから削除"
  },
];

// ============================================
// リスト管理クラス
// ============================================
class PromptListManager {
  constructor() {
    this.virtualLists = new Map(); // コンテナIDごとの仮想リストインスタンス管理
    this.refreshingLists = new Set(); // 現在リフレッシュ中のリストを追跡
    this.listConfigs = new Map(); // リスト設定の保存（リフレッシュ用）
    this.sortStates = new Map(); // 各リストのソート状態を管理 {column: string, direction: 'asc'|'desc'}
  }

  /**
   * ローカルリストの即座保存（共通処理を使用）
   */
  async saveLocalListImmediate() {
    try {
      console.log("[SAVE] Saving local list using common saveLocalList...");
      // 共通のsaveLocalList関数を使用（カテゴリ更新あり）
      await saveLocalList(true);
      console.log("[SAVE] Local list saved successfully via common function");
    } catch (error) {
      console.error("[SAVE] Failed to save local list:", error);
    }
  }

  /**
   * 特定要素のRegisterボタン状態のみを更新（汎用的な解決策）
   * @param {string} listId - リストID
   * @param {string|number} elementId - 要素ID
   * @returns {boolean} 更新成功の可否
   */
  updateRegisterButtonState(listId, elementId) {
    if (AppState.config.debugMode)
      console.log(
        `[LIST_MANAGER] updateRegisterButtonState called for ${listId}, element ${elementId}`
      );
    try {
      const listElement = this.findListElement(listId, elementId);
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] findListElement result:`, listElement);
      if (!listElement) {
        console.warn(
          `[LIST_MANAGER] Element not found for register button update: ${listId}, ${elementId}`
        );
        return false;
      }

      const regButton = listElement.querySelector(
        'button[data-action="register"]'
      );
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] Register button found:`, regButton);
      if (!regButton) {
        console.warn(
          `[LIST_MANAGER] Register button not found for element: ${elementId}`
        );
        return false;
      }

      // プロンプト値を取得
      const promptInput = listElement.querySelector(
        'input[data-field="prompt"], textarea[data-field="prompt"]'
      );
      const promptValue = promptInput ? promptInput.value : "";
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] Prompt value retrieved: "${promptValue}"`);

      if (AppState.config.debugMode)
        console.log(
          `[LIST_MANAGER] isPromptInDictionary function available:`,
          typeof isPromptInDictionary
        );
      if (promptValue && typeof isPromptInDictionary === "function") {
        const existsInDictionary = isPromptInDictionary(promptValue);
        if (AppState.config.debugMode)
          console.log(
            `[LIST_MANAGER] isPromptInDictionary result: ${existsInDictionary}`
          );

        // ボタンの状態を更新（disabledプロパティとCSSクラスの両方）
        regButton.disabled = existsInDictionary;
        regButton.title = existsInDictionary
          ? "既に登録済みのため登録できません"
          : "ローカル辞書に登録";

        // CSSクラスも適切に管理
        if (existsInDictionary) {
          regButton.classList.add("button-disabled");
          regButton.setAttribute("disabled", "true");
        } else {
          regButton.classList.remove("button-disabled");
          regButton.removeAttribute("disabled");
          // JavaScriptプロパティを明示的にfalseに設定
          regButton.disabled = false;
        }

        if (AppState.config.debugMode)
          console.log(
            `[LIST_MANAGER] Updated register button for element ${elementId}: disabled=${existsInDictionary}`
          );

        return true;
      } else {
        console.warn(
          `[LIST_MANAGER] Cannot update button: promptValue="${promptValue}", isPromptInDictionary=${typeof isPromptInDictionary}`
        );
      }

      return false;
    } catch (error) {
      console.error(
        `[LIST_MANAGER] Error updating register button state:`,
        error
      );
      return false;
    }
  }

  /**
   * リストアイテムの個別更新（リフレッシュなし）
   * @param {string} listId - リストID (#editList, #addPromptList 等)
   * @param {string} itemId - アイテムのID (data-element-id または data-item-id)
   * @param {string} bigCategory - 大項目
   * @param {string} middleCategory - 中項目
   * @param {string} smallCategory - 小項目
   * @param {string} prompt - プロンプト
   * @returns {boolean} 更新成功の可否
   */
  updateListItem(
    listId,
    itemId,
    bigCategory = "",
    middleCategory = "",
    smallCategory = "",
    prompt = ""
  ) {
    try {
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] updateListItem called:`, {
          listId,
          itemId,
          bigCategory,
          middleCategory,
          smallCategory,
          prompt,
        });

      // DOM要素を検索
      const listElement = this.findListElement(listId, itemId);
      if (!listElement) {
        console.error(
          `[LIST_MANAGER] List item not found: ${listId}, ${itemId}`
        );
        return false;
      }

      // 各フィールドを更新
      this.updateItemField(listElement, "data.0", bigCategory);
      this.updateItemField(listElement, "data.1", middleCategory);
      this.updateItemField(listElement, "data.2", smallCategory);
      this.updateItemField(listElement, "prompt", prompt);

      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] Successfully updated item: ${itemId}`);
      return true;
    } catch (error) {
      console.error(`[LIST_MANAGER] Error updating list item:`, error);
      return false;
    }
  }

  /**
   * リスト要素を検索（ID、data-element-id、data-item-idで検索）
   * @param {string} listId - リストID
   * @param {string} itemId - アイテムID
   * @returns {HTMLElement|null} 見つかった要素
   */
  findListElement(listId, itemId) {
    const cleanListId = listId.replace("#", "");

    // 複数のセレクターでリスト要素を探す
    const selectors = [
      `${listId} li[data-element-id="${itemId}"]`,
      `${listId} li[data-item-id="${itemId}"]`,
      `${listId} li[id="${itemId}"]`,
      `#${cleanListId} li[data-element-id="${itemId}"]`,
      `#${cleanListId} li[data-item-id="${itemId}"]`,
      `#${cleanListId} li[id="${itemId}"]`,
      `#${cleanListId}-list li[data-element-id="${itemId}"]`,
      `#${cleanListId}-list li[data-item-id="${itemId}"]`,
      `#${cleanListId}-list li[id="${itemId}"]`,
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (AppState.config.debugMode)
          console.log(
            `[LIST_MANAGER] Found element with selector: ${selector}`
          );
        return element;
      }
    }

    console.warn(
      `[LIST_MANAGER] Element not found with any selector for itemId: ${itemId}`
    );
    return null;
  }

  /**
   * アイテムの特定フィールドを更新
   * @param {HTMLElement} listElement - リスト要素
   * @param {string} fieldKey - フィールドキー (data.0, data.1, data.2, prompt)
   * @param {string} value - 新しい値
   */
  updateItemField(listElement, fieldKey, value) {
    // フィールドに対応する入力要素を検索
    const inputElement =
      listElement.querySelector(`input[data-field="${fieldKey}"]`) ||
      listElement.querySelector(`.prompt-list-input[data-field="${fieldKey}"]`);

    if (inputElement) {
      const oldValue = inputElement.value;
      inputElement.value = value;
      if (AppState.config.debugMode)
        console.log(
          `[LIST_MANAGER] Updated field ${fieldKey}: "${oldValue}" -> "${value}"`
        );

      // カスタムイベントを発火（他のコンポーネントが変更を検知できるように）
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      console.warn(`[LIST_MANAGER] Input field not found for: ${fieldKey}`);
    }
  }

  /**
   * 単一要素のスポット更新（共通化版）- 完全リフレッシュを避けてDOM要素のみ更新
   * @param {string} listId - リストID (#editList, #addPromptList 等)
   * @param {string|number} elementIdentifier - 要素識別子 (data-element-id または インデックス)
   * @param {Object} updates - 更新内容 { fieldType: newValue, ... }
   * @param {Object} options - オプション設定
   * @param {boolean} [options.preserveFocus=true] - フォーカス状態を保持するか
   * @param {boolean} [options.preventEvents=true] - イベント発生を防ぐか
   * @param {string} [options.searchMode='auto'] - 検索モード ('id', 'index', 'auto')
   * @returns {boolean} 更新成功の可否
   */
  updateSingleElement(listId, elementIdentifier, updates, options = {}) {
    const config = {
      preserveFocus: true,
      preventEvents: true,
      searchMode: "auto",
      ...options,
    };

    try {
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] === updateSingleElement START ===`);
      if (AppState.config.debugMode)
        console.log(
          `[LIST_MANAGER] ListId: ${listId}, Identifier: ${elementIdentifier}`
        );
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] Updates:`, updates);
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] Config:`, config);

      // フォーカス状態を保存
      let focusState = null;
      if (config.preserveFocus) {
        focusState = this.saveFocusState();
      }

      // DOM要素を検索
      const domElement = this.findDomElement(
        listId,
        elementIdentifier,
        config.searchMode
      );
      if (!domElement) {
        console.warn(
          `[LIST_MANAGER] DOM element not found for identifier: ${elementIdentifier}, listId: ${listId}, searchMode: ${config.searchMode}`
        );

        // デバッグ情報を追加
        const container = document.getElementById(listId);
        if (container) {
          const allElements = container.querySelectorAll("[data-id]");
          console.debug(
            `[LIST_MANAGER] Available elements in ${listId}:`,
            Array.from(allElements).map((el) => el.getAttribute("data-id"))
          );
        } else {
          console.debug(`[LIST_MANAGER] Container ${listId} not found`);
        }

        return false;
      }

      // 各フィールドを更新
      let updateSuccess = true;
      for (const [fieldType, newValue] of Object.entries(updates)) {
        const fieldUpdateResult = this.updateSingleField(
          domElement,
          fieldType,
          newValue,
          config
        );
        if (!fieldUpdateResult) {
          if (AppState.config.debugMode)
            console.warn(`[LIST_MANAGER] Failed to update field: ${fieldType}`);
          updateSuccess = false;
        }
      }

      // フォーカス状態を復元
      if (config.preserveFocus && focusState) {
        this.restoreFocusState(focusState);
      }

      if (AppState.config.debugMode)
        console.log(
          `[LIST_MANAGER] updateSingleElement completed: ${updateSuccess}`
        );
      return updateSuccess;
    } catch (error) {
      console.error("[LIST_MANAGER] Error in updateSingleElement:", error);
      return false;
    }
  }

  /**
   * スクロール位置を保存
   * @param {string} listId - リストID
   * @returns {Object} 保存されたスクロール情報
   */
  saveScrollPosition(listId) {
    const container = document.querySelector(listId);
    if (!container) {
      console.log(`[LIST_MANAGER] Container not found for ${listId}`);
      return { scrollTop: 0, scrollLeft: 0 };
    }

    // 複数の要素からスクロール位置を取得
    const scrollInfo = {
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft,
      // ページ全体のスクロール位置も保存
      windowScrollY: window.pageYOffset || document.documentElement.scrollTop,
      windowScrollX: window.pageXOffset || document.documentElement.scrollLeft,
    };

    console.log(`[SCROLL_TRACE] saveScrollPosition for ${listId}:`, scrollInfo);
    console.log(
      `[LIST_MANAGER] saveScrollPosition call stack:`,
      new Error().stack
    );

    // flexible-list-contentをチェック
    const flexContent = container.querySelector(".flexible-list-content");
    if (flexContent) {
      scrollInfo.flexContentScrollTop = flexContent.scrollTop;
      scrollInfo.flexContentScrollLeft = flexContent.scrollLeft;
    }

    // ui-sortable要素をチェック（実際にスクロールしている要素）
    const uiSortable =
      container.querySelector(".ui-sortable") ||
      document.querySelector(".ui-sortable");
    if (uiSortable) {
      scrollInfo.uiSortableScrollTop = uiSortable.scrollTop;
      scrollInfo.uiSortableScrollLeft = uiSortable.scrollLeft;
    }

    // 親要素やビューポートもチェック
    const viewport = container.querySelector(".virtual-list-viewport");
    if (viewport) {
      scrollInfo.viewportScrollTop = viewport.scrollTop;
      scrollInfo.viewportScrollLeft = viewport.scrollLeft;
    }

    // 親のスクロール可能な要素もチェック
    const scrollableParent = container.closest(
      '.scrollable, .tab-content, [style*="overflow"]'
    );
    if (scrollableParent && scrollableParent !== container) {
      scrollInfo.parentScrollTop = scrollableParent.scrollTop;
      scrollInfo.parentScrollLeft = scrollableParent.scrollLeft;
    }

    console.log(
      `[LIST_MANAGER] Saved scroll position for ${listId}:`,
      scrollInfo,
      "container:",
      container,
      "flexContent:",
      flexContent,
      "viewport:",
      viewport,
      "scrollableParent:",
      scrollableParent
    );
    return scrollInfo;
  }

  /**
   * スクロール位置を復元
   * @param {string} listId - リストID
   * @param {Object} scrollInfo - 復元するスクロール情報
   */
  restoreScrollPosition(listId, scrollInfo) {
    console.log(
      `[SCROLL_TRACE] restoreScrollPosition called for ${listId}:`,
      scrollInfo
    );
    console.log(
      `[LIST_MANAGER] restoreScrollPosition call stack:`,
      new Error().stack
    );
    if (!scrollInfo) {
      console.log(
        `[LIST_MANAGER] No scroll info to restore for ${listId} - scrollInfo is null/undefined`
      );
      return;
    }

    // 0の値も有効なスクロール位置として扱う
    const hasValidScrollInfo =
      scrollInfo.scrollTop !== undefined ||
      scrollInfo.scrollLeft !== undefined ||
      scrollInfo.flexContentScrollTop !== undefined ||
      scrollInfo.flexContentScrollLeft !== undefined ||
      scrollInfo.viewportScrollTop !== undefined ||
      scrollInfo.parentScrollTop !== undefined;

    if (!hasValidScrollInfo) {
      console.log(
        `[LIST_MANAGER] No valid scroll info to restore for ${listId} - scrollInfo:`,
        scrollInfo
      );
      return;
    }

    const container = document.querySelector(listId);
    if (!container) {
      console.log(`[LIST_MANAGER] Container not found for restore ${listId}`);
      return;
    }

    console.log(
      `[LIST_MANAGER] Attempting to restore scroll position for ${listId}:`,
      scrollInfo
    );

    // 少し遅延を入れてDOM更新完了を待つ
    setTimeout(() => {
      // ui-sortable要素の復元（最優先）
      if (
        scrollInfo.uiSortableScrollTop !== undefined ||
        scrollInfo.uiSortableScrollLeft !== undefined
      ) {
        const uiSortable =
          container.querySelector(".ui-sortable") ||
          document.querySelector(".ui-sortable");
        if (uiSortable) {
          uiSortable.scrollTop = scrollInfo.uiSortableScrollTop || 0;
          uiSortable.scrollLeft = scrollInfo.uiSortableScrollLeft || 0;
          console.log(
            `[LIST_MANAGER] Restored ui-sortable scroll: ${uiSortable.scrollTop}`
          );
        }
      }

      // flexible-list-contentの復元（フォールバック）
      if (scrollInfo.flexContentScrollTop || scrollInfo.flexContentScrollLeft) {
        const flexContent = container.querySelector(".flexible-list-content");
        if (flexContent) {
          flexContent.scrollTop = scrollInfo.flexContentScrollTop || 0;
          flexContent.scrollLeft = scrollInfo.flexContentScrollLeft || 0;
          console.log(
            `[LIST_MANAGER] Restored flex-content scroll: ${flexContent.scrollTop}`
          );
        }
      }

      // メインコンテナの復元
      if (scrollInfo.scrollTop || scrollInfo.scrollLeft) {
        container.scrollTop = scrollInfo.scrollTop;
        container.scrollLeft = scrollInfo.scrollLeft;
        console.log(
          `[LIST_MANAGER] Restored container scroll: ${container.scrollTop}`
        );
      }

      // ビューポートの復元
      if (scrollInfo.viewportScrollTop || scrollInfo.viewportScrollLeft) {
        const viewport = container.querySelector(".virtual-list-viewport");
        if (viewport) {
          viewport.scrollTop = scrollInfo.viewportScrollTop;
          viewport.scrollLeft = scrollInfo.viewportScrollLeft;
          console.log(
            `[LIST_MANAGER] Restored viewport scroll: ${viewport.scrollTop}`
          );
        }
      }

      // 親要素の復元
      if (scrollInfo.parentScrollTop || scrollInfo.parentScrollLeft) {
        const scrollableParent = container.closest(
          '.scrollable, .tab-content, [style*="overflow"]'
        );
        if (scrollableParent && scrollableParent !== container) {
          scrollableParent.scrollTop = scrollInfo.parentScrollTop;
          scrollableParent.scrollLeft = scrollInfo.parentScrollLeft;
          console.log(
            `[LIST_MANAGER] Restored parent scroll: ${scrollableParent.scrollTop}`
          );
        }
      }

      // ページ全体のスクロール位置復元
      if (
        scrollInfo.windowScrollY !== undefined ||
        scrollInfo.windowScrollX !== undefined
      ) {
        window.scrollTo(
          scrollInfo.windowScrollX || 0,
          scrollInfo.windowScrollY || 0
        );
        console.log(
          `[LIST_MANAGER] Restored window scroll: ${scrollInfo.windowScrollY}`
        );
      }

      console.log(
        `[LIST_MANAGER] Restored scroll position for ${listId}:`,
        scrollInfo
      );
    }, 100); // 遅延を100msに増加してDOM更新完了を確実に待つ
  }

  /**
   * リスト単位の統一リフレッシュメソッド（スクロール位置保持付き）
   * @param {string} listId - リストID
   * @param {Object} storedConfig - 保存された設定（refreshCallback含む）
   */
  async refreshFlexibleList(listId, storedConfig = null) {
    if (AppState.config.debugMode)
      console.log(`[LIST_MANAGER] Refreshing flexible list: ${listId}`);
    if (AppState.config.debugMode)
      console.trace(`[LIST_MANAGER] Stack trace for refresh: ${listId}`);

    // 保存された設定から取得
    let config = storedConfig || this.getListConfig(listId);
    if (!config) {
      console.warn(
        `[LIST_MANAGER] No stored config for ${listId}, cannot refresh`
      );
      console.warn(
        `[LIST_MANAGER] Available configs:`,
        Array.from(this.listConfigs.keys())
      );
      return;
    }

    if (AppState.config.debugMode)
      console.log(`[LIST_MANAGER] Retrieved config for ${listId}:`, {
        autoPreserveScroll: config.autoPreserveScroll,
        refreshCallback: !!config.refreshCallback,
      });

    // スクロール位置を保存（自動保持が有効な場合）
    let scrollPosition = null;
    if (config.autoPreserveScroll) {
      scrollPosition = this.saveScrollPosition(listId);
      if (AppState.config.debugMode)
        console.log(
          `[LIST_MANAGER] Saved scroll position for refresh: ${listId}`,
          scrollPosition
        );
    }

    // refreshCallbackが設定されている場合は実行
    if (
      config.refreshCallback &&
      typeof config.refreshCallback === "function"
    ) {
      if (AppState.config.debugMode)
        console.log(`[LIST_MANAGER] Executing refresh callback for ${listId}`);
      await config.refreshCallback();
    } else {
      if (AppState.config.debugMode)
        console.log(
          `[LIST_MANAGER] No refresh callback for ${listId}, skipping refresh`
        );
    }
  }

  /**
   * 設定を保存する仕組み（リフレッシュ用）
   * @param {string} listId - リストID
   * @param {Object} config - 設定オブジェクト
   */
  saveListConfig(listId, config) {
    if (!this.listConfigs) {
      this.listConfigs = new Map();
    }
    this.listConfigs.set(listId, config);
    if (AppState.config.debugMode)
      console.log(`[LIST_MANAGER] Saved config for ${listId}`);
  }

  /**
   * 保存された設定を取得
   * @param {string} listId - リストID
   * @returns {Object|null} 保存された設定
   */
  getListConfig(listId) {
    if (!this.listConfigs) {
      return null;
    }
    return this.listConfigs.get(listId) || null;
  }

  /**
   * DOM要素を検索（複数の方法を試行）
   * @param {string} listId - リストID
   * @param {string|number} identifier - 要素識別子
   * @param {string} searchMode - 検索モード
   * @returns {Element|null} 見つかったDOM要素
   */
  findDomElement(listId, identifier, searchMode = "auto") {
    let domElement = null;

    if (searchMode === "auto" || searchMode === "id") {
      // data-element-id で検索
      domElement = document.querySelector(
        `${listId} [data-element-id="${identifier}"]`
      );
      if (domElement) {
        if (AppState.config.debugMode)
          console.log(
            `[LIST_MANAGER] Found element by data-element-id: ${identifier}`
          );
        return domElement;
      }
    }

    if (searchMode === "auto" || searchMode === "index") {
      // インデックスで検索（ヘッダー行を除外）
      const dataRows = document.querySelectorAll(
        `${listId} li:not(.prompt-list-header)`
      );
      if (
        typeof identifier === "number" &&
        identifier >= 0 &&
        identifier < dataRows.length
      ) {
        domElement = dataRows[identifier];
        if (AppState.config.debugMode)
          console.log(`[LIST_MANAGER] Found element by index: ${identifier}`);
        return domElement;
      }
    }

    console.warn(
      `[LIST_MANAGER] Element not found with identifier: ${identifier}, searchMode: ${searchMode}`
    );

    // 詳細デバッグ: 利用可能な全要素をログ出力
    const container = document.querySelector(listId);
    if (container) {
      const allDataIds = container.querySelectorAll("[data-id]");
      const allElementIds = container.querySelectorAll("[data-element-id]");
      const allRows = container.querySelectorAll("li:not(.prompt-list-header)");

      console.error(`[LIST_MANAGER_ERROR] === DETAILED DEBUG INFO ===`);
      console.error(`[LIST_MANAGER_ERROR] Container: ${listId}`);
      console.error(
        `[LIST_MANAGER_ERROR] Searching for: ${identifier} (type: ${typeof identifier})`
      );
      console.error(`[LIST_MANAGER_ERROR] Search mode: ${searchMode}`);
      console.error(
        `[LIST_MANAGER_ERROR] Total data-id elements:`,
        allDataIds.length
      );
      console.error(
        `[LIST_MANAGER_ERROR] Total data-element-id elements:`,
        allElementIds.length
      );
      console.error(
        `[LIST_MANAGER_ERROR] Total rows (excluding header):`,
        allRows.length
      );

      // より詳細な情報をログ出力
      console.error(
        `[LIST_MANAGER_ERROR] Available data-id values:`,
        Array.from(allDataIds).map((el) => `"${el.getAttribute("data-id")}"`)
      );
      console.error(
        `[LIST_MANAGER_ERROR] Available data-element-id values:`,
        Array.from(allElementIds).map(
          (el) => `"${el.getAttribute("data-element-id")}"`
        )
      );

      // 最初の数行の詳細情報
      const firstFewRows = Array.from(allRows).slice(0, 5);
      console.error(`[LIST_MANAGER_ERROR] First 5 rows details:`);
      firstFewRows.forEach((row, idx) => {
        console.error(
          `[LIST_MANAGER_ERROR] Row ${idx}: data-id="${row.getAttribute(
            "data-id"
          )}", data-element-id="${row.getAttribute("data-element-id")}"`
        );
      });

      // プロンプトエディタの要素情報もログ出力
      if (window.promptEditor && window.promptEditor.elements) {
        console.error(
          `[LIST_MANAGER_ERROR] PromptEditor elements count:`,
          window.promptEditor.elements.length
        );
        console.error(
          `[LIST_MANAGER_ERROR] PromptEditor element IDs:`,
          window.promptEditor.elements.map(
            (el) => `${el.id} (${el.Value?.substring(0, 20)}...)`
          )
        );
      }
    }

    return null;
  }

  /**
   * 単一フィールドを更新
   * @param {Element} domElement - DOM要素
   * @param {string} fieldType - フィールドタイプ
   * @param {any} newValue - 新しい値
   * @param {Object} config - 設定
   * @returns {boolean} 更新成功の可否
   */
  updateSingleField(domElement, fieldType, newValue, config) {
    try {
      let targetInput = null;
      let selectorClass = null;

      // フィールドタイプに応じてセレクターを決定
      switch (fieldType) {
        case "prompt":
          selectorClass = ".flex-col-prompt";
          break;
        case "weight":
          selectorClass = ".flex-col-weight";
          break;
        case "category":
        case "category.0":
          selectorClass = ".flex-col-category:nth-of-type(1)";
          break;
        case "category.1":
          selectorClass = ".flex-col-category:nth-of-type(2)";
          break;
        case "category.2":
          selectorClass = ".flex-col-category:nth-of-type(3)";
          break;
        case "data.0":
          selectorClass = 'input[data-field="data.0"]';
          break;
        case "data.1":
          selectorClass = 'input[data-field="data.1"]';
          break;
        case "data.2":
          selectorClass = 'input[data-field="data.2"]';
          break;
        default:
          // カスタムセレクター (例: ".custom-field")
          if (fieldType.startsWith(".") || fieldType.startsWith("#")) {
            selectorClass = fieldType;
          } else {
            console.warn(`[LIST_MANAGER] Unknown field type: ${fieldType}`);
            return false;
          }
      }

      // 入力要素を取得
      targetInput = domElement.querySelector(selectorClass);
      if (!targetInput) {
        console.warn(
          `[LIST_MANAGER] Input not found for field: ${fieldType} (${selectorClass})`
        );
        return false;
      }

      // 値を更新
      if (config.preventEvents) {
        // イベント発生を防ぐため、直接プロパティを変更
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        );
        if (descriptor && descriptor.set) {
          descriptor.set.call(targetInput, newValue);
        } else {
          targetInput.value = newValue;
        }
      } else {
        // 通常の値設定（イベント発生あり）
        targetInput.value = newValue;
      }

      console.log(`[LIST_MANAGER] Updated field ${fieldType}: ${newValue}`);
      return true;
    } catch (error) {
      console.error(`[LIST_MANAGER] Error updating field ${fieldType}:`, error);
      return false;
    }
  }

  /**
   * フォーカス状態を保存
   * @returns {Object|null} フォーカス状態
   */
  saveFocusState() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === "INPUT") {
      return {
        elementId: activeElement.id,
        selectionStart: activeElement.selectionStart,
        selectionEnd: activeElement.selectionEnd,
        value: activeElement.value,
      };
    }
    return null;
  }

  /**
   * フォーカス状態を復元
   * @param {Object|null} focusState - 保存されたフォーカス状態
   */
  restoreFocusState(focusState) {
    if (focusState && focusState.elementId) {
      const element = document.getElementById(focusState.elementId);
      if (element && element.tagName === "INPUT") {
        try {
          element.focus();
          if (
            typeof focusState.selectionStart === "number" &&
            typeof focusState.selectionEnd === "number"
          ) {
            element.setSelectionRange(
              focusState.selectionStart,
              focusState.selectionEnd
            );
          }
          console.log(
            `[LIST_MANAGER] Restored focus to: ${focusState.elementId}`
          );
        } catch (error) {
          console.warn("[LIST_MANAGER] Failed to restore focus:", error);
        }
      }
    }
  }

  // 標準的な3カテゴリ+プロンプト構造のヘルパー
  createStandardFields(item, readonly = false, onChangeCallbacks = {}) {
    return [
      {
        type: "category",
        value: item.data[0],
        readonly,
        onChange: onChangeCallbacks.category0,
      },
      {
        type: "category",
        value: item.data[1],
        readonly,
        onChange: onChangeCallbacks.category1,
      },
      {
        type: "category",
        value: item.data[2],
        readonly,
        onChange: onChangeCallbacks.category2,
      },
      {
        type: "prompt",
        value: item.prompt,
        readonly,
        onChange: onChangeCallbacks.prompt,
      },
    ];
  }

  // ============================================
  // フレキシブルリスト機能（メイン）
  // ============================================

  /**
   * フレキシブルリストを作成（自動スクロール位置保持版 - 後方互換性用）
   * @param {Array} data - 表示データ
   * @param {string} listId - リストのコンテナID
   * @param {Object} config - 設定オプション
   * @returns {Promise} 作成完了Promise
   * @deprecated 統一されたcreateFlexibleListのautoPreserveScrollオプションを使用してください
   */
  async createFlexibleListWithAutoScrollRestore(data, listId, config = {}) {
    console.log(
      `[LIST_MANAGER] Creating flexible list with auto scroll restore for ${listId} (deprecated method)`
    );

    // 統一されたメソッドを使用
    return await this.createFlexibleList(data, listId, {
      ...config,
    });
  }

  /**
   * フレキシブルリストを作成（仮想スクロール対応の統合版）
   * @param {Array} data - 表示データ
   * @param {string} listId - リストのコンテナID
   * @param {Object} config - 設定オプション
   * @param {Array} [config.fields] - フィールド設定
   * @param {Array|Function} [config.buttons] - ボタン設定
   * @param {boolean} [config.sortable] - ソート可能かどうか
   * @param {boolean} [config.readonly] - 読み取り専用かどうか
   * @param {boolean} [config.showHeaders] - ヘッダー表示するかどうか
   * @param {Object} [config.header] - ヘッダー設定 {title: string, icon: string}
   * @param {number} [config.itemHeight] - アイテム高さ（仮想スクロール用）
   * @param {number} [config.idOffset] - ID自動生成時のオフセット値（例: 10000, 20000）
   * @param {Function} [config.onFieldChange] - フィールド変更コールバック（全イベント対象）
   * @param {Function} [config.onDelete] - 削除コールバック
   * @param {Function} [config.onSort] - ソートコールバック
   * @param {Function} [config.onRegistration] - 新規登録コールバック（翻訳結果用）
   * @param {Function} [config.onFieldCategoryChange] - 汎用カテゴリーフィールド変更コールバック
   * @param {Function} [config.dropdownCount] - カスタムドロップダウン数設定コールバック
   * @param {Function} [config.setupSpecialFeatures] - 特殊機能設定コールバック
   * @param {boolean} [config.autoPreserveScroll] - 自動スクロール位置保持（内部使用）
   */
  async createFlexibleList(data, listId, config = {}) {
    
    // 同時リフレッシュの防止
    if (this.refreshingLists.has(listId)) {
      console.log(
        `[LIST_MANAGER] Skipping refresh for ${listId} - already in progress`
      );
      return;
    }
    this.refreshingLists.add(listId);

    try {
      // スクロール位置の保存を削除（リフレッシュレス編集により不要）

      // 動的コンテナ高さを計算
      const dynamicHeight = this.calculateOptimalContainerHeight(
        data.length,
        config.itemHeight || 40
      );

      // デフォルト設定
      const defaults = {
        fields: [],
        buttons: [],
        headers: null,
        header: null, // ヘッダー設定 {title: string, icon: string}
        readonly: false,
        sortable: false,
        virtualScroll: null, // null=自動判定, true=強制有効, false=強制無効
        itemHeight: 40,
        containerHeight: dynamicHeight,
        bufferSize: 3,
        listType: null, // リアルタイム更新用
        containerId: listId, // リアルタイム更新用
        autoPreserveScroll: true, // 自動スクロール位置保持（常に有効）
        refreshCallback: null, // リフレッシュコールバック関数
        onFieldChange: null,
        onCategoryChange: null,
        onBigCategoryChange: null,
        onMiddleCategoryChange: null,
        onSmallCategoryChange: null,
        resetMiddleOnBigChange: true,
        resetSmallOnMiddleChange: false,
        onDelete: null,
        onSort: null,
        onPreview: null,
        onLoad: null,
        onSet: null,
        onCopy: null,
        onWeightChange: null,
        onRegistration: null,
        onFieldCategoryChange: null,
        dropdownCount: null,
        categoryChainBehavior: {
          focusNext: false, // 次のフィールドにフォーカス移動
          openDropdownOnFocus: false, // フォーカス時にドロップダウンを開く
          skipEmptyCategories: false, // 空のカテゴリをスキップ
          focusPromptAfterSmall: false, // 小項目後にプロンプトフィールドにフォーカス
        },
        setupSpecialFeatures: null,
      };

      const finalConfig = { ...defaults, ...config };

      // 設定を保存（リフレッシュ用）
      this.saveListConfig(listId, finalConfig);

      console.log(
        `[LIST_MANAGER] Creating flexible list with ${data.length} items for ${listId}`
      );
      console.log(
        `[LIST_MANAGER] createFlexibleList call stack:`,
        new Error().stack
      );
      console.log(
        `[LIST_MANAGER] Data sample:`,
        data
          .slice(0, 5)
          .map(
            (item, i) =>
              `${i}: ${item.Value || item.prompt || item.title || "unknown"}`
          )
      );

      // ヘッダー付きの構造を生成する場合
      if (finalConfig.header) {
        return await this.createFlexibleListWithHeader(
          data,
          listId,
          finalConfig
        );
      }

      // 仮想スクロール判定
      const shouldUseVirtualScroll = this.shouldUseVirtualScroll(
        data.length,
        finalConfig.virtualScroll
      );

      console.log(
        `[LIST_MANAGER] ${listId} - shouldUseVirtualScroll: ${shouldUseVirtualScroll}, dataLength: ${data.length}`
      );

      let result;
      if (shouldUseVirtualScroll) {
        console.log(`[LIST_MANAGER] ${listId} - Using virtual scroll`);
        result = await this.createVirtualScrollList(data, listId, finalConfig);
      } else {
        console.log(`[LIST_MANAGER] ${listId} - Using standard list`);
        result = await this.createStandardList(data, listId, finalConfig);
      }

      // スクロール位置の復元を削除（リフレッシュレス編集により不要）

      return result;
    } finally {
      // リフレッシュ状態をクリア
      this.refreshingLists.delete(listId);
    }
  }

  /**
   * ヘッダー付きフレキシブルリストを作成
   * @param {Array} data - 表示データ
   * @param {string} listId - リストのコンテナID
   * @param {Object} config - 設定オプション
   */
  async createFlexibleListWithHeader(data, listId, config) {
    // スクロール位置の保存・復元を削除（リフレッシュレス編集により不要）

    // jQuery → Vanilla JS 置換 (Phase 8)
    const container = document.querySelector(listId);
    if (!container) {
      console.error(`Container not found: ${listId}`);
      return;
    }

    // 既存のコンテナをクリア
    container.innerHTML = "";

    // flexible-list-containerクラスを追加（統一スタイリング用）
    // jQuery → Vanilla JS 置換 (Phase 8)
    container.classList.add("flexible-list-container");

    // シンプルな構造でヘッダー + リストコンテナ
    const cleanListId = listId.replace("#", "");
    const headerHtml = `
      <div class="search-results-header accent-line-top">
        <div class="search-results-title">
          <span class="icon">${config.header.icon || "📄"}</span>
          <span>${config.header.title || "リスト"}</span>
        </div>
        <div class="header-controls">
          <div class="button-controls-group">
            <button class="button-toggle-btn all-buttons" data-list-id="${cleanListId}" data-button-type="all" title="全ボタンの表示/非表示を切り替え">
              <span class="toggle-icon">👁️</span>
              <span class="toggle-text">全て</span>
            </button>
            <button class="button-controls-settings" data-list-id="${cleanListId}" title="個別ボタン設定を開く">
              <span class="settings-icon">⚙️</span>
            </button>
          </div>
        </div>
      </div>
      <div class="flexible-list-content" id="${cleanListId}-content">
        <ul class="full-size" id="${cleanListId}-list"></ul>
      </div>
    `;

    // 構造を追加
    // jQuery → Vanilla JS 置換 (Phase 8)
    container.innerHTML = headerHtml;

    // 実際のリスト生成（maxItems設定があれば高さを動的計算）
    const newListId = `#${cleanListId}-list`;
    let containerHeight = "auto";

    // maxItems設定がある場合は動的高さを計算
    if (config.maxItems && typeof config.maxItems === "number") {
      containerHeight = this.calculateOptimalContainerHeight(data.length, 40, {
        maxItems: config.maxItems,
        minItems: 1,
        headerHeight: 0, // ヘッダーは別途存在するので除外
        padding: 8,
      });
      console.log(
        `[HEADER_LIST] Calculated height for maxItems(${config.maxItems}): ${containerHeight}px`
      );
    }

    const listConfig = {
      ...config,
      header: null,
      containerHeight: config.containerHeight || containerHeight, // 元の設定を優先
    };
    const shouldUseVirtualScroll = this.shouldUseVirtualScroll(
      data.length,
      listConfig.virtualScroll
    );

    console.log(
      `[HEADER_LIST] Creating list for ${newListId}, virtualScroll: ${shouldUseVirtualScroll}`
    );

    // 高さ制限をCSSに適用（ヘッダー付きリストのコンテンツ部分）
    if (containerHeight !== "auto") {
      const contentContainer = document.querySelector(
        `${listId} .flexible-list-content`
      );
      if (contentContainer) {
        contentContainer.style.maxHeight = `${containerHeight}px`;
        contentContainer.style.overflowY = "auto";
        console.log(
          `[HEADER_LIST] Applied max-height ${containerHeight}px to flexible-list-content`
        );
      }
    }

    let result;
    if (shouldUseVirtualScroll) {
      result = await this.createVirtualScrollList(data, newListId, listConfig);
    } else {
      result = await this.createStandardList(data, newListId, listConfig);
    }

    // ボタン表示トグル機能を設定
    this.setupButtonToggle(listId, cleanListId);

    // スクロール位置の復元を削除（リフレッシュレス編集により不要）

    return result;
  }

  /**
   * 最適なコンテナ高さを計算
   * @param {number} dataLength - データ数
   * @param {number} itemHeight - アイテム高さ
   * @param {Object} options - オプション
   * @returns {number} 最適なコンテナ高さ
   */
  calculateOptimalContainerHeight(dataLength, itemHeight = 40, options = {}) {
    const minItems = options.minItems || 1; // 最小表示行数
    const maxItems = options.maxItems || VIRTUAL_SCROLL.MAX_VISIBLE_ITEMS; // 最大表示行数
    const headerHeight = options.headerHeight || 42; // ヘッダー分の高さ
    const padding = options.padding || 4; // パディング分を少し縮小

    // アイテム数に基づく高さ制限
    let visibleItems;
    if (dataLength === 0) {
      // データが空の場合は最小限の高さ（ヘッダーのみ）
      visibleItems = 0;
    } else {
      // 実際のデータ数に合わせて調整（最小1、最大15）
      visibleItems = Math.max(minItems, Math.min(dataLength, maxItems));
    }

    const contentHeight = visibleItems * itemHeight;
    const totalHeight = contentHeight + headerHeight + padding;

    console.log(
      `[ContainerHeight] Data: ${dataLength} items, Visible: ${visibleItems} items, Height: ${totalHeight}px (maxItems: ${maxItems})`
    );

    return totalHeight;
  }

  /**
   * 仮想スクロールを使用するかどうかを判定（保守性重視：常に仮想スクロール）
   */
  shouldUseVirtualScroll(dataLength, virtualScrollConfig) {
    // 明示的に指定されている場合はそれに従う
    if (virtualScrollConfig === true || virtualScrollConfig === false) {
      return virtualScrollConfig;
    }

    // useVirtualization設定がある場合はそれに従う
    if (virtualScrollConfig && typeof virtualScrollConfig === "object") {
      if (virtualScrollConfig.useVirtualization !== undefined) {
        return virtualScrollConfig.useVirtualization;
      }
    }

    // 自動判定：閾値以上で仮想スクロールを使用
    // マスター辞書（8000件以上）には仮想スクロールが必要
    // ローカル辞書（通常100件以下）には不要
    return dataLength >= VIRTUAL_SCROLL.THRESHOLD;
  }

  /**
   * 標準リスト作成（廃止予定：常に仮想スクロール使用）
   * @deprecated - 保守性向上のため、常に仮想スクロールを使用
   */
  async createStandardList(data, listId, finalConfig) {
    // リストクリア
    ListBuilder.clearList(listId);

    // ヘッダー作成（毎回作成）
    const headers =
      finalConfig.headers ||
      this.generateHeaders(finalConfig.fields, finalConfig.buttons);
    const columnTypes = this.generateColumnTypes(
      finalConfig.fields,
      finalConfig.buttons
    );

    if (columnTypes) {
      ListBuilder.createHeaders(
        listId,
        headers,
        columnTypes,
        finalConfig.sortable,
        finalConfig.headerClickSort
      );
    } else {
      ListBuilder.createHeaders(listId, headers, null, finalConfig.sortable, finalConfig.headerClickSort);
    }

    // データが空の場合
    if (data.length === 0) {
      // リストIDに基づいて適切なタイプを判定
      let emptyType = "default";
      if (listId.includes("edit") || listId.includes("Edit")) {
        emptyType = "edit";
      } else if (listId.includes("search") || listId.includes("Search")) {
        emptyType = "search";
      } else if (listId.includes("dic") || listId.includes("Dic")) {
        emptyType = "dictionary";
      } else if (listId.includes("slot") || listId.includes("Slot")) {
        emptyType = "slot";
      }

      this.createEmptyState(listId, emptyType);
      return;
    }

    // コンテナにクラスを追加（統一デザイン）
    const container = document.querySelector(listId);
    if (container) {
      container.classList.add("prompt-list-container");
      // ソート可能な場合はクラスを追加
      if (finalConfig.sortable) {
        container.classList.add("sortable-list");
      }
      // 編集タブは二重スクロール回避のためmax-heightをスキップ
      if (listId.includes("edit") || listId.includes("Edit")) {
        console.log(
          `[STANDARD_LIST] Skipping max-height for edit tab to prevent double scrolling:`,
          listId
        );
      } else if (finalConfig.containerHeight !== "auto") {
        container.style.maxHeight = `${finalConfig.containerHeight}px`;
        console.log(
          `[STANDARD_LIST] Applied max-height: ${finalConfig.containerHeight}px to`,
          listId
        );
      } else {
        console.log(
          `[STANDARD_LIST] Skipping height restriction for`,
          listId,
          "(containerHeight: auto)"
        );
      }
    }

    // アイテム作成
    for (let i = 0; i < data.length; i++) {
      // ソート時のID問題解決：要素の永続IDをDOMのIDとして使用
      const itemId = data[i]?.id !== undefined ? data[i].id : i;
      const $li = UIFactory.createListItem({
        id: finalConfig.sortable ? itemId : undefined,
        sortable: finalConfig.sortable,
      });

      await this.createFlexibleItem($li, data[i], i, finalConfig);
      // jQuery → Vanilla JS 置換 (Phase 8)
      const listContainer = document.querySelector(listId);
      if (listContainer) {
        listContainer.appendChild($li);
      }
    }

    // ソート機能設定
    if (finalConfig.sortable && finalConfig.onSort) {
      // DOMの更新完了を待ってからソート機能を設定
      requestAnimationFrame(() => {
        setTimeout(() => {
          // jQuery → Vanilla JS 置換 (Phase 8)
          const listContainer = document.querySelector(listId);
          const itemCount = listContainer
            ? listContainer.querySelectorAll("li:not(.prompt-list-header)")
                .length
            : 0;
          console.log(
            "Setting up sortable for:",
            listId,
            "items count:",
            itemCount
          );
          EventHandlers.setupSortableList(listId, finalConfig.onSort);
        }, 100);
      });
    }

    // jQuery → Vanilla JS 置換 (Phase 8)
    const listContainer = document.querySelector(listId);
    const childrenCount = listContainer ? listContainer.children.length : 0;
    console.log(`Standard list created, final children count:`, childrenCount);
  }

  /**
   * 仮想スクロールリスト作成（統合版）
   */
  async createVirtualScrollList(data, listId, finalConfig) {
    const container = document.querySelector(listId);
    if (!container) {
      throw new Error(`Container not found: ${listId}`);
    }

    console.log(
      `Creating virtual scroll list with ${data.length} items for ${listId}`
    );

    // 既存の仮想リストを破棄（特定のコンテナのみ）
    const containerId = listId;
    if (this.virtualLists.has(containerId)) {
      this.virtualLists.get(containerId).destroy();
      this.virtualLists.delete(containerId);
    }

    // コンテナをクリア
    container.innerHTML = "";
    container.classList.add("prompt-list-container");

    // ソート可能な場合はクラスを追加
    if (finalConfig.sortable) {
      container.classList.add("sortable-list");
    }

    // 外側コンテナにも動的高さを適用
    container.style.maxHeight = `${finalConfig.containerHeight}px`;

    // ヘッダー作成
    const headers =
      finalConfig.headers ||
      this.generateHeaders(finalConfig.fields, finalConfig.buttons);
    const columnTypes = this.generateColumnTypes(
      finalConfig.fields,
      finalConfig.buttons
    );

    if (columnTypes) {
      ListBuilder.createHeaders(
        listId,
        headers,
        columnTypes,
        finalConfig.sortable,
        finalConfig.headerClickSort
      );
    } else {
      ListBuilder.createHeaders(listId, headers, null, finalConfig.sortable, finalConfig.headerClickSort);
    }

    // データが空の場合
    if (data.length === 0) {
      // リストIDに基づいて適切なタイプを判定
      let emptyType = "default";
      if (listId.includes("edit") || listId.includes("Edit")) {
        emptyType = "edit";
      } else if (listId.includes("search") || listId.includes("Search")) {
        emptyType = "search";
      } else if (listId.includes("dic") || listId.includes("Dic")) {
        emptyType = "dictionary";
      } else if (listId.includes("slot") || listId.includes("Slot")) {
        emptyType = "slot";
      }

      this.createEmptyState(listId, emptyType);
      return;
    }

    // 仮想リスト設定
    const virtualListOptions = {
      container: container,
      itemHeight: finalConfig.itemHeight,
      containerHeight: finalConfig.containerHeight,
      bufferSize: finalConfig.bufferSize,
      onCreateItem: (element, item, index) => {
        this.createVirtualListItem(element, item, index, finalConfig);
      },
      onUpdateItem: (element, item, index) => {
        this.updateVirtualListItem(element, item, index, finalConfig);
      },
    };

    // データにIDが不足している場合は自動生成
    data.forEach((item, index) => {
      if (!item.id) {
        const listType = finalConfig?.listType || "virtual";
        item.id = `${listType}-${index}-${Date.now()}`;
      }
    });

    // 仮想リストを初期化
    const virtualList = new VirtualList(virtualListOptions);
    virtualList.init();
    await virtualList.setData(data);

    // コンテナIDで仮想リストを管理
    this.virtualLists.set(containerId, virtualList);

    // ビューポートに仮想リストインスタンスを関連付け（デバッグ用）
    const viewport = container.querySelector(".virtual-list-viewport");
    if (viewport) {
      viewport._virtualList = virtualList;
      console.log(`VirtualList instance attached to viewport for ${listId}`);
    }

    // スクロールバー幅を動的に調整（DOM更新後に実行）
    setTimeout(() => {
      this.adjustHeaderForScrollbar(listId);
    }, UI_DELAYS.REFRESH_DELAY);

    // ソート機能設定（仮想スクロールリスト用）
    if (finalConfig.sortable && finalConfig.onSort) {
      // DOMの更新完了を待ってからソート機能を設定
      requestAnimationFrame(() => {
        setTimeout(() => {
          // jQuery → Vanilla JS 置換 (Phase 8)
          const listElement = document.querySelector(listId);
          const itemsCount = listElement
            ? listElement.querySelectorAll("li:not(.prompt-list-header)").length
            : 0;
          console.log(
            "Setting up sortable for virtual list:",
            listId,
            "items count:",
            itemsCount
          );
          EventHandlers.setupSortableList(listId, finalConfig.onSort);
        }, UI_DELAYS.SLOW_UPDATE);
      });
    }

    console.log(`Virtual list created with ${data.length} items`);
    return virtualList;
  }

  /**
   * 仮想リストアイテムを作成（統合版）
   */
  async createVirtualListItem(element, item, index, config) {
    // jQuery → Vanilla JS 置換 (Phase 8)
    const $element = element;

    // 要素をクリア
    while ($element.firstChild) {
      $element.removeChild($element.firstChild);
    }

    // クラスを追加
    // jQuery → Vanilla JS 置換 (Phase 8)
    $element.classList.add("prompt-list-item-virtual");

    // 既存のcreateFlexibleItemメソッドを活用
    await this.createFlexibleItem($element, item, index, config);

    // 高さを調整
    // jQuery → Vanilla JS 置換 (Phase 8)
    Object.assign($element.style, {
      height: `${config.itemHeight}px`,
      minHeight: `${config.itemHeight}px`,
      maxHeight: `${config.itemHeight}px`,
      boxSizing: "border-box",
    });
  }

  /**
   * 仮想リストアイテムを更新（統合版）
   */
  async updateVirtualListItem(element, item, index, config) {
    const updateStart = performance.now();
    
    // パフォーマンス改善: 差分更新を試行
    const hasInputFields = element.querySelectorAll('input, select').length > 0;
    
    // 既存要素の値のみ更新を試行
    if (hasInputFields && this.tryUpdateExistingFields(element, item, config)) {
      const fastUpdateTime = performance.now() - updateStart;
      if (AppState?.config?.debugMode && fastUpdateTime > 1) {
        console.log(`[PERF_FAST_UPDATE] Fast update: ${fastUpdateTime.toFixed(2)}ms for index ${index}`);
      }
      return;
    }
    
    // フォールバック: 従来の再作成方式
    if (AppState?.config?.debugMode) {
      console.log(`[PERF_FALLBACK] Falling back to full recreation for index ${index}`);
    }
    await this.createVirtualListItem(element, item, index, config);
    
    const totalUpdateTime = performance.now() - updateStart;
    if (AppState?.config?.debugMode && totalUpdateTime > 5) {
      console.warn(`[PERF_FALLBACK] ⚠️ Slow fallback update: ${totalUpdateTime.toFixed(2)}ms for index ${index}`);
    }
  }

  /**
   * 既存フィールドの差分更新を試行（パフォーマンス改善）
   */
  tryUpdateExistingFields(element, item, config) {
    try {
      const fields = config.fields || STANDARD_CATEGORY_FIELDS;
      let updateSuccess = true;
      
      fields.forEach((field, fieldIndex) => {
        const input = element.querySelector(`[data-field="${field.key}"]`);
        if (input) {
          const newValue = this.getFieldValue(item, field);
          
          // 値が変更された場合のみ更新
          if (input.value !== newValue) {
            input.value = newValue;
          }
        } else {
          // フィールドが見つからない場合は差分更新失敗
          updateSuccess = false;
        }
      });
      
      return updateSuccess;
    } catch (error) {
      if (AppState?.config?.debugMode) {
        console.warn('[PERF_FAST_UPDATE] Differential update failed:', error);
      }
      return false;
    }
  }

  /**
   * CustomDropdownの遅延初期化（パフォーマンス改善）
   */
  initializeDropdownOnDemand(input, dropdownConfig) {
    // 遅延初期化用のメタデータを設定
    input._lazyDropdownConfig = dropdownConfig;
    input.setAttribute('data-dropdown-lazy', 'true');
    
    // Intersection Observer による可視性監視
    let isVisible = true; // デフォルトは表示状態
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (!isVisible && input._pendingInit) {
          // 画面外に移動した場合、初期化をキャンセル
          clearTimeout(input._pendingInit);
          input._pendingInit = null;
          if (AppState?.config?.debugMode) {
            console.log(`[PERF_LAZY_DROPDOWN] Cancelled initialization (element moved out of view)`);
          }
        }
      });
    }, { threshold: 0.1 }); // 10%見えていれば表示中とみなす
    
    observer.observe(input);
    input._intersectionObserver = observer;
    
    // フォーカス時に初期化
    const initializeDropdown = () => {
      if (!input.customDropdown && input._lazyDropdownConfig) {
        // 画面外の場合は初期化を遅延
        if (!isVisible) {
          if (AppState?.config?.debugMode) {
            console.log(`[PERF_LAZY_DROPDOWN] Delaying initialization (element out of view)`);
          }
          input._pendingInit = setTimeout(() => {
            if (input._lazyDropdownConfig) {
              initializeDropdown();
            }
          }, 100); // 100ms後に再チェック
          return;
        }
        
        const initStart = performance.now();
        
        input.customDropdown = new CustomDropdown(input, input._lazyDropdownConfig);
        input.removeAttribute('data-dropdown-lazy');
        
        const initTime = performance.now() - initStart;
        if (AppState?.config?.debugMode) {
          console.log(`[PERF_LAZY_DROPDOWN] Initialized CustomDropdown: ${initTime.toFixed(2)}ms for level ${input._lazyDropdownConfig.categoryLevel}`);
        }
        
        // 初期化後にクリーンアップ
        input._lazyDropdownConfig = null;
        if (input._initializeDropdownHandler) {
          input.removeEventListener('focus', input._initializeDropdownHandler);
          input.removeEventListener('click', input._initializeDropdownHandler);
          input._initializeDropdownHandler = null;
        }
        
        // Intersection Observer も停止
        if (input._intersectionObserver) {
          input._intersectionObserver.disconnect();
          input._intersectionObserver = null;
        }
      }
      
      // フォーカス移動（初期化後）
      if (input.customDropdown) {
        setTimeout(() => input.focus(), 0);
      }
    };
    
    // フォーカスまたはクリック時に初期化（重複防止）
    // 既存のリスナーがある場合は削除してから追加
    if (input._initializeDropdownHandler) {
      input.removeEventListener('focus', input._initializeDropdownHandler);
      input.removeEventListener('click', input._initializeDropdownHandler);
    }
    
    // 関数参照を保存して確実に削除できるようにする
    input._initializeDropdownHandler = initializeDropdown;
    input.addEventListener('focus', initializeDropdown, { once: false });
    input.addEventListener('click', initializeDropdown, { once: false });
  }

  /**
   * ヘッダーとスクロールバーの幅調整（統合版）
   * スクロールバーの有無に応じてスペーサーを動的に追加/削除
   */
  adjustHeaderForScrollbar(listId) {
    const viewport = document.querySelector(`${listId} .virtual-list-viewport`);
    const header = document.querySelector(`${listId} .prompt-list-header`);

    if (viewport && header) {
      // 実際のスクロールバー幅を計算
      const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
      const hasScrollbar = scrollbarWidth > 0;

      // 既存のスペーサーを取得
      let spacer = header.querySelector(".header-scrollbar-spacer");

      if (hasScrollbar && !spacer) {
        // スクロールバーがあるがスペーサーがない場合：スペーサーを追加
        spacer = UIFactory.createDiv({
          className: "header-scrollbar-spacer",
        });
        header.appendChild(spacer);
        console.log(
          `Added scrollbar spacer for ${listId} (scrollbar width: ${scrollbarWidth}px)`
        );
      } else if (!hasScrollbar && spacer) {
        // スクロールバーがないがスペーサーがある場合：スペーサーを削除
        spacer.remove();
        console.log(
          `Removed scrollbar spacer for ${listId} (no scrollbar needed)`
        );
      } else if (hasScrollbar && spacer) {
        console.log(
          `Scrollbar spacer maintained for ${listId} (scrollbar width: ${scrollbarWidth}px)`
        );
      } else {
        console.log(`No scrollbar spacer needed for ${listId} (no scrollbar)`);
      }
    }
  }

  /**
   * 特定のコンテナの仮想リストを取得
   */
  getVirtualList(containerId) {
    return this.virtualLists.get(containerId) || null;
  }

  /**
   * 全ての仮想リストを破棄（クリーンアップ用）
   */
  destroyAllVirtualLists() {
    for (const [containerId, virtualList] of this.virtualLists) {
      console.log(`Destroying virtual list for ${containerId}`);
      virtualList.destroy();
    }
    this.virtualLists.clear();
  }

  /**
   * 仮想リストの統計情報を取得
   */
  getVirtualListStats() {
    const stats = {};
    for (const [containerId, virtualList] of this.virtualLists) {
      stats[containerId] = virtualList.getStats();
    }
    return stats;
  }

  /**
   * ヘッダーを自動生成
   */
  generateHeaders(fields, buttons) {
    const headers = [];

    // フィールドからヘッダーを生成
    fields.forEach((field, index) => {
      const headerLabel = field.label || field.key || "フィールド";
      headers.push(headerLabel);
    });

    // ボタンからヘッダーを生成
    if (typeof buttons === "function") {
      // 動的ボタンの場合、基本的なボタンを推定（+/-ボタンは削除済み）
      headers.push("Del", "Reg");
    } else {
      buttons.forEach((button, index) => {
        const buttonLabel = button.label || this.getButtonLabel(button.type);
        headers.push(buttonLabel);
      });
    }

    if (AppState.config.debugMode && window.FLEXIBLE_LIST_DEBUG) {
      console.log("[HEADER DEBUG] Generated headers:", headers);
    }

    return headers;
  }

  /**
   * 列タイプを自動生成
   */
  generateColumnTypes(fields, buttons) {
    const columnTypes = {};
    let index = 0;

    // フィールドの列タイプ
    fields.forEach((field, fieldIndex) => {
      const columnType = this.getFieldColumnType(field.type);
      columnTypes[index] = columnType;
      index++;
    });

    // ボタンの列タイプ（動的ボタンの場合は基本的な数を仮定）
    if (typeof buttons === "function") {
      // 動的ボタンの場合、基本的なボタン数を仮定
      for (let i = 0; i < 4; i++) {
        columnTypes[index] = "button";
        index++;
      }
    } else {
      buttons.forEach((button, buttonIndex) => {
        columnTypes[index] = "button";
        index++;
      });
    }

    if (AppState.config.debugMode && window.FLEXIBLE_LIST_DEBUG) {
      console.log("[COLUMN DEBUG] Column types:", columnTypes);
    }

    return columnTypes;
  }

  /**
   * フィールドタイプに応じた列タイプを取得
   */
  getFieldColumnType(fieldType) {
    const typeMap = {
      category: "category",
      prompt: "prompt",
      weight: "weight",
      title: "category",
      name: "category",
    };
    return typeMap[fieldType] || "category";
  }

  /**
   * ボタンタイプに応じたラベルを取得
   */
  getButtonLabel(buttonType) {
    const labelMap = {
      add: "Add",
      copy: "Cpy",
      delete: "Del",
      load: "Lod",
      weightPlus: "+",
      weightMinus: "-",
      register: "Reg",
      favorite: "Fav",
      generate: "Gen",
    };
    return labelMap[buttonType] || buttonType;
  }

  /**
   * 空の状態表示を作成
   */
  createEmptyState(listId, type = "default", options = {}) {
    const container = document.querySelector(listId);
    if (!container) {
      console.warn(`[EMPTY_STATE] Container not found: ${listId}`);
      return;
    }

    // コンテンツエリアを取得または作成
    let contentArea = container.querySelector(
      ".flexible-list-content, .search-results-content"
    );
    if (!contentArea) {
      contentArea = container;
    }

    // 既存のコンテンツをクリア
    contentArea.innerHTML = "";

    // 空の状態メッセージを作成
    const emptyStateDiv = UIFactory.createDiv({
      className: "empty-state-message",
    });

    // メッセージタイプに応じた内容を設定
    let message, icon;
    switch (type) {
      case "search":
        message = "検索結果が見つかりませんでした";
        icon = "🔍";
        break;
      case "edit":
        message = "プロンプトを生成してから編集してください";
        icon = "✏️";
        break;
      case "dictionary":
        message = "辞書データがありません";
        icon = "📚";
        break;
      case "slot":
        message = "スロットが空です";
        icon = "🎰";
        break;
      case "extraction":
        message = "抽出モード中です - 編集はできません";
        icon = "🎲";
        break;
      default:
        message = "データがありません";
        icon = "📄";
    }

    // 抽出モードの場合は詳細情報を追加
    let extraContent = "";
    if (type === "extraction" && options.extractionSlots) {
      extraContent = `
        <div class="extraction-mode-details">
          <h4>抽出モードスロット (${options.extractionSlots.length}個)</h4>
          <div class="extraction-slots-list">
            ${options.extractionSlots
              .map((slot) => {
                const slotNumber = slot.slotNumber || "不明";
                const mode = slot.mode === "random" ? "ランダム" : "連続";
                const category = slot.category?.big || "全体";
                const current = slot.currentExtraction
                  ? `現在: ${slot.currentExtraction}`
                  : "抽出待機中";
                return `
                <div class="extraction-slot-item">
                  <span class="slot-number">スロット${slotNumber}</span>
                  <span class="slot-mode">${mode}</span>
                  <span class="slot-category">${category}</span>
                  <div class="slot-current">${current}</div>
                </div>
              `;
              })
              .join("")}
          </div>
          <div class="extraction-note">
            <small>スロットタブで通常モードに切り替えると編集が可能になります。</small>
          </div>
        </div>
      `;
    }

    emptyStateDiv.innerHTML = `
      <div class="empty-state-content">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-text">${message}</div>
        ${extraContent}
      </div>
    `;

    contentArea.appendChild(emptyStateDiv);
    console.log(
      `[EMPTY_STATE] Created empty state for ${listId} (type: ${type})`
    );
  }

  /**
   * フレキシブルアイテム作成
   * @param {HTMLElement} $li - リストアイテム要素
   * @param {Object} item - アイテムデータ
   * @param {number} index - アイテムインデックス
   * @param {Object} config - 設定オブジェクト（idOffsetを含む）
   */
  async createFlexibleItem($li, item, index, config) {
    const inputs = [];

    // jQuery → Vanilla JS 置換 (Phase 8) - UIFactoryがVanilla JSを返すようになったため
    // リストアイテムにクラスとdata属性を追加
    $li.classList.add("prompt-list-item");

    // ID自動生成機能（統一ID管理）
    const idOffset = config?.idOffset || 0;
    
    // IDが未設定またはオフセット範囲外の場合は再生成
    const needsIdGeneration = item.id === undefined || 
                             item.id === null || 
                             (idOffset > 0 && (item.id < idOffset || item.id >= idOffset + 10000));
    
    if (needsIdGeneration) {
      // リストインスタンス固有のカウンター初期化
      if (!config._idCounter) {
        config._idCounter = idOffset;
      }
      
      // 新しいIDを生成
      const oldId = item.id;
      item.id = ++config._idCounter;
      console.log(`[ID_DEBUG] Generated ID: ${oldId} → ${item.id} (offset: ${idOffset}) for item: "${(item.prompt || item.Value || '').substring(0, 20)}..."`);
    }

    // 部分更新用のdata属性を設定
    $li.setAttribute("data-element-id", item.id);

    // readonly判定（共通判定を事前に実行）
    const configReadonly =
      typeof config.readonly === "function"
        ? config.readonly(item)
        : config.readonly;
    const isItemReadonly = configReadonly || false;

    // フィールドレベルのreadonly状況を事前チェック
    let hasReadonlyField = false;

    // ドラッグハンドルは削除、代わりに左側余白を広げる

    // フィールド作成
    config.fields.forEach((field, fieldIndex) => {
      const value = this.getFieldValue(item, field);

      // readonly判定：フィールド固有 OR アイテム全体のreadonly
      const fieldReadonly =
        typeof field.readonly === "function"
          ? field.readonly(item)
          : field.readonly;
      const isReadonly = isItemReadonly || fieldReadonly || false;

      // readonly フィールドが存在することを記録
      if (fieldReadonly) {
        hasReadonlyField = true;
      }

      // フィールドタイプに応じたツールチップを生成
      let fieldTooltip = '';
      if (field.type === "weight") {
        fieldTooltip = `重み値(-10〜10)：値が大きいほど影響度が高い`;
      } else if (field.type === "category") {
        if (field.key === "data.0") {
          fieldTooltip = "大カテゴリ：人物・背景・モードなどの大分類";
        } else if (field.key === "data.1") {
          fieldTooltip = "中カテゴリ：大カテゴリをさらに細かく分類";
        } else if (field.key === "data.2") {
          fieldTooltip = "小カテゴリ：最も具体的な特徴や属性";
        } else if (field.key === "title") {
          fieldTooltip = "表示名：お気に入りの識別用タイトル";
        }
      } else if (field.type === "prompt") {
        fieldTooltip = "プロンプト：AI画像生成で使用される実際のキーワード";
      }

      // フィールド作成
      const fieldValue = field.type === "weight"
        ? value !== undefined && value !== null ? value : ""
        : value || "";
      
      const $input = UIFactory.createInput({
        value: fieldValue,
        type: field.type === "weight" ? "number" : "text", // 重みフィールドはnumberタイプ
        step: field.type === "weight" ? config.weightDelta || 0.1 : undefined,
        min: field.type === "weight" ? config.weightMin || -10 : undefined,
        max: field.type === "weight" ? config.weightMax || 10 : undefined,
        readonly: isReadonly,
        index: fieldIndex,
        elementId: item.id, // 要素IDを渡す
        fieldType: field.type, // フィールドタイプを渡す
        dataField: field.key, // data-field属性として使用するキーを渡す
        title: fieldTooltip, // ツールチップを追加
        onInput: (newValue) => {
          // プロンプトフィールドと小項目フィールドはEnter/Blurのみで更新、重みフィールドは即座に更新
          const isPromptField = field.type === "prompt";
          const isSmallCategoryField = field.key === "data.2"; // 小項目フィールド

          if (!isPromptField && !isSmallCategoryField) {
            // 重みフィールドのみ即座に更新
            this.handleFieldChange(item, index, field, newValue, config);
          }
        },
        onBlur:
          config.listType === "edit"
            ? (e) => {
                const newValue = e.target.value;

                // 編集タブ専用処理（カスタムドロップダウンがない場合のみ）
                if (config.listType === "edit") {
                  if (field.type === "weight") {
                    console.log(
                      "[ListManager] Weight field Blur triggered, value:",
                      newValue
                    );
                    this.handleFieldChange(
                      item,
                      index,
                      field,
                      newValue,
                      config,
                      "blur"
                    );
                  } else if (field.type === "prompt" || field.key === "data.2") {
                    // プロンプトフィールドと小項目フィールドをBlur時に更新
                    // プロンプトフィールドでBlur時の処理
                    // **本格修正**: DOM上の最新値でitem.dataを同期（CategoryDataSyncManagerと連携）
                    if (item && item.id !== undefined && window.categoryDataSync) {
                      const latestData = window.categoryDataSync.getCurrentDOMValues(item.id);
                      if (latestData) {
                        item.data = [...latestData];
                        
                        if (AppState.config.debugMode) {
                          console.log(`[ListManager] Synced item.data from DOM:`, {
                            elementId: item.id,
                            syncedData: item.data
                          });
                        }
                      }
                    }
                    
                    this.handleFieldChange(
                      item,
                      index,
                      field,
                      newValue,
                      config,
                      "blur"
                    );
                    // その後保存処理を実行（編集タブのみ）
                    if (config.onPromptSave) {
                      config.onPromptSave(newValue, item, index);
                    }
                  } else if (
                    field.type === "category" &&
                    (config.categoryChainBehavior?.focusNext ||
                      field.key === "title")
                  ) {
                    // カテゴリフィールドのBlur処理（保存のみ、フォーカス移動なし）
                    // カスタムドロップダウンでない場合（普通の入力フィールド）
                    if (!e.target.getAttribute("data-dropdown-enabled")) {
                      console.log(
                        "[FOCUS] Category field Blur triggered, checking for changes and saving..."
                      );

                      const currentValue = this.getFieldValue(item, field);

                      // 値が変更されている場合は保存処理を実行
                      if (newValue !== currentValue) {
                        console.log(
                          `[FOCUS] Value changed from "${currentValue}" to "${newValue}", saving...`
                        );
                        this.handleFieldChange(
                          item,
                          index,
                          field,
                          newValue,
                          config,
                          "blur"
                        );

                        // ユーザー辞書の場合の特別な保存処理
                        if (config.listType === "add") {
                          const listItem = e.target.closest("li");
                          const dataElementId =
                            listItem?.getAttribute("data-element-id");

                          if (dataElementId) {
                            const actualIndex =
                              AppState.data.localPromptList.findIndex(
                                (prompt, idx) => {
                                  const elementIdStr = dataElementId.replace(
                                    "dict-local-",
                                    ""
                                  );
                                  return (
                                    idx.toString() === elementIdStr ||
                                    idx === parseInt(elementIdStr)
                                  );
                                }
                              );

                            if (actualIndex !== -1) {
                              // フィールドキーに応じて適切なデータ位置に保存
                              if (field.key === "data.0") {
                                AppState.data.localPromptList[
                                  actualIndex
                                ].data[0] = newValue;
                              } else if (field.key === "data.1") {
                                AppState.data.localPromptList[
                                  actualIndex
                                ].data[1] = newValue;
                              } else if (field.key === "data.2") {
                                AppState.data.localPromptList[
                                  actualIndex
                                ].data[2] = newValue;
                              }

                              // 非同期で保存
                              this.saveLocalListImmediate();
                              console.log(
                                `[FOCUS] Saved category change for index ${actualIndex}`
                              );
                            }
                          }
                        }
                      }

                      // Blurイベントではフォーカス移動しない（Enterキーのみ）
                    }
                  }
                }
              }
            : (e) => {
                // 編集タブ以外でのBlur処理（辞書タブ、検索タブなど）
                const newValue = e.target.value;

                // プロンプトフィールドと小項目フィールドのBlur処理（全タブ共通）
                if (field.type === "prompt" || field.key === "data.2") {
                  console.log(
                    "[BLUR] Prompt/Small category field blur triggered (non-edit), saving..."
                  );
                  this.handleFieldChange(
                    item,
                    index,
                    field,
                    newValue,
                    config,
                    "blur"
                  );
                }
                // カテゴリフィールドのBlur処理（カテゴリチェーンまたは辞書のタイトルフィールド）
                else if (
                  field.type === "category" &&
                  (config.categoryChainBehavior?.focusNext ||
                    field.key === "title")
                ) {
                  // カスタムドロップダウンでない場合（普通の入力フィールド）
                  if (!e.target.getAttribute("data-dropdown-enabled")) {
                    console.log(
                      "[FOCUS] Category field Blur triggered (non-edit), checking for changes and saving..."
                    );

                    const newValue = e.target.value;
                    const currentValue = this.getFieldValue(item, field);

                    // 値が変更されている場合は保存処理を実行
                    if (newValue !== currentValue) {
                      console.log(
                        `[FOCUS] Value changed from "${currentValue}" to "${newValue}", saving...`
                      );
                      this.handleFieldChange(
                        item,
                        index,
                        field,
                        newValue,
                        config,
                        "blur"
                      );

                      // ユーザー辞書の場合の特別な保存処理
                      if (config.listType === "add") {
                        const listItem = e.target.closest("li");
                        const dataElementId =
                          listItem?.getAttribute("data-element-id");

                        if (dataElementId) {
                          const actualIndex =
                            AppState.data.localPromptList.findIndex(
                              (prompt, idx) => {
                                const elementIdStr = dataElementId.replace(
                                  "dict-local-",
                                  ""
                                );
                                return (
                                  idx.toString() === elementIdStr ||
                                  idx === parseInt(elementIdStr)
                                );
                              }
                            );

                          if (actualIndex !== -1) {
                            // フィールドキーに応じて適切なデータ位置に保存
                            if (field.key === "data.0") {
                              AppState.data.localPromptList[
                                actualIndex
                              ].data[0] = newValue;
                            } else if (field.key === "data.1") {
                              AppState.data.localPromptList[
                                actualIndex
                              ].data[1] = newValue;
                            } else if (field.key === "data.2") {
                              AppState.data.localPromptList[
                                actualIndex
                              ].data[2] = newValue;
                            }

                            // 非同期で保存
                            this.saveLocalListImmediate();
                            console.log(
                              `[FOCUS] Saved category change for index ${actualIndex}`
                            );
                          }
                        }
                      }
                    }

                    // Blurイベントではフォーカス移動しない（Enterキーのみ）
                  }
                }
              },
        onChange:
          field.type === "weight" && config.listType === "edit"
            ? (e) => {
                console.log(
                  "[ListManager] Weight field Change triggered (spin buttons), value:",
                  e.target.value
                );
                this.handleFieldChange(
                  item,
                  index,
                  field,
                  e.target.value,
                  config
                );
              }
            : undefined,
        onKeydown: (e) => {
          // プロンプトフィールドと小項目フィールドのEnter処理（全タブ対応）
          if ((field.type === "prompt" || field.key === "data.2") && e.key === "Enter") {
            e.preventDefault(); // Enterキーのデフォルト動作を防ぐ
            e.stopPropagation(); // イベントバブリングを停止してショートカット処理を防ぐ
            e.target.blur(); // フォーカスを外してBlurイベントを発生させる（こちらで統一処理）
            return; // onKeydownでの処理は終了（Blurで処理される）
          }
          // 重みフィールドのEnter処理（編集タブのみ）
          else if (
            field.type === "weight" &&
            config.listType === "edit" &&
            e.key === "Enter"
          ) {
            e.preventDefault(); // Enterキーのデフォルト動作を防ぐ
            e.stopPropagation(); // イベントバブリングを停止してショートカット処理を防ぐ
            e.target.blur(); // フォーカスを外してBlurイベントを発生させる（こちらで統一処理）
            return; // onKeydownでの処理は終了（Blurで処理される）
          }
          // カテゴリフィールドのEnter処理（フォーカス移動またはタイトルフィールドの保存）
          else if (
            field.type === "category" &&
            e.key === "Enter" &&
            (config.categoryChainBehavior?.focusNext || field.key === "title")
          ) {
            e.preventDefault(); // Enterキーのデフォルト動作を防ぐ
            e.stopPropagation(); // イベントバブリングを停止してショートカット処理を防ぐ

            // カスタムドロップダウンでない場合（普通の入力フィールド）
            if (!e.target.getAttribute("data-dropdown-enabled")) {
              console.log(
                "[FOCUS] Category field Enter pressed, checking for changes and moving focus..."
              );

              const newValue = e.target.value;
              const currentValue = this.getFieldValue(item, field);

              // 値が変更されている場合は保存処理を実行
              if (newValue !== currentValue) {
                console.log(
                  `[FOCUS] Value changed from "${currentValue}" to "${newValue}", saving...`
                );
                this.handleFieldChange(
                  item,
                  index,
                  field,
                  newValue,
                  config,
                  "enter"
                );

                // ユーザー辞書の場合の特別な保存処理
                if (config.listType === "add") {
                  const listItem = e.target.closest("li");
                  const dataElementId =
                    listItem?.getAttribute("data-element-id");

                  if (dataElementId) {
                    const actualIndex = AppState.data.localPromptList.findIndex(
                      (prompt, idx) => {
                        const elementIdStr = dataElementId.replace(
                          "dict-local-",
                          ""
                        );
                        return (
                          idx.toString() === elementIdStr ||
                          idx === parseInt(elementIdStr)
                        );
                      }
                    );

                    if (actualIndex !== -1) {
                      // フィールドキーに応じて適切なデータ位置に保存
                      if (field.key === "data.0") {
                        AppState.data.localPromptList[actualIndex].data[0] =
                          newValue;
                      } else if (field.key === "data.1") {
                        AppState.data.localPromptList[actualIndex].data[1] =
                          newValue;
                      } else if (field.key === "data.2") {
                        AppState.data.localPromptList[actualIndex].data[2] =
                          newValue;
                      }

                      // 非同期で保存
                      this.saveLocalListImmediate();
                      console.log(
                        `[FOCUS] Saved category change for index ${actualIndex}`
                      );
                    }
                  }
                }
              }

              // 現在のフィールドレベルを特定
              const fieldKey = field.key;
              let currentLevel = 0;
              if (fieldKey === "data.0") currentLevel = 0; // 大項目
              else if (fieldKey === "data.1") currentLevel = 1; // 中項目
              else if (fieldKey === "data.2") currentLevel = 2; // 小項目

              // 同じ行の入力フィールドを取得
              const listItem = e.target.closest("li");
              if (listItem) {
                const categoryInputs =
                  listItem.querySelectorAll(".flex-col-category");
                const promptInput = listItem.querySelector(".flex-col-prompt");
                const allInputs = [...categoryInputs, promptInput].filter(
                  Boolean
                );

                this.focusNextCategoryInput(currentLevel, allInputs, config);
              }
            }
            return;
          }
          // 重みフィールドの上下矢印キー処理
          else if (
            field.type === "weight" &&
            (e.key === "ArrowUp" || e.key === "ArrowDown")
          ) {
            e.preventDefault(); // デフォルトの動作を防ぐ
            const currentValue = parseFloat(e.target.value) || 0;
            let delta = config.weightDelta || 0.1;

            // Shift: 大きく変更（10倍）、Ctrl: 細かく変更（1/10）
            if (e.shiftKey) {
              delta *= 10;
            } else if (e.ctrlKey) {
              delta /= 10;
            }

            let newValue =
              e.key === "ArrowUp" ? currentValue + delta : currentValue - delta;

            // 浮動小数点の精度問題を修正
            newValue = Math.round(newValue * 1000) / 1000;

            e.target.value = newValue;
            // フィールド変更処理を実行
            this.handleFieldChange(item, index, field, newValue, config);
          }
        },
        placeholder: field.placeholder || "",
      });

      // jQuery → Vanilla JS 置換 (Phase 8) - UIFactoryがVanilla JSを返すようになったため
      // 新しい汎用クラスを適用
      $input.classList.add("prompt-list-input");

      // readonly フィールドには専用クラスを追加
      if (isReadonly) {
        $input.classList.add("readonly-field");
      }

      // フレックス列クラスを適用
      // jQuery → Vanilla JS 置換 (Phase 8)
      if (field.type === "category") {
        $input.classList.add("flex-col-category");
      } else if (field.type === "prompt") {
        $input.classList.add("flex-col-prompt");
      } else if (field.type === "weight") {
        $input.classList.add("flex-col-weight"); // 重み専用クラス (80px)

        // 重みフィールドにマウスホイールイベントを追加
        if (!isReadonly) {
          const inputElement = $input[0] || $input;
          const wheelHandler = (e) => {
            e.preventDefault(); // ページスクロールを防ぐ

            const currentValue = parseFloat(inputElement.value) || 0;
            let delta = config.weightDelta || 0.1;

            // Shift: 大きく変更（10倍）、Ctrl: 細かく変更（1/10）
            if (e.shiftKey) {
              delta *= 10;
            } else if (e.ctrlKey) {
              delta /= 10;
            }

            // ホイールの方向で増減
            let newValue =
              e.deltaY < 0 ? currentValue + delta : currentValue - delta;

            // 浮動小数点の精度問題を修正
            newValue = Math.round(newValue * 1000) / 1000;

            // 重み値の上限・下限チェック（ホイール操作時）
            if (
              config.weightMin !== undefined &&
              config.weightMax !== undefined
            ) {
              newValue = Math.max(
                config.weightMin,
                Math.min(config.weightMax, newValue)
              );
            }

            inputElement.value = newValue;
            // フィールド変更処理を実行
            this.handleFieldChange(item, index, field, newValue, config);
          };

          // wheelHandlerを要素に保存（後でクリーンアップ用）
          inputElement._wheelHandler = wheelHandler;
          inputElement.addEventListener("wheel", wheelHandler, { passive: false });
        }
      }

      // 後方互換性のため旧クラスも追加
      // jQuery → Vanilla JS 置換 (Phase 8)
      $input.classList.add("promptData");

      // ツールチップを追加（項目とPromptの内容を表示）
      if (Validators.Quick.hasValue(value)) {
        // jQuery → Vanilla JS 置換 (Phase 8)
        $input.setAttribute("title", value.toString().trim());
      }

      // フィールド固有の属性
      if (field.attributes) {
        Object.entries(field.attributes).forEach(([attr, attrValue]) => {
          // jQuery → Vanilla JS 置換 (Phase 8)
          $input.setAttribute(attr, attrValue);
        });
      }

      inputs.push($input);
      $li.appendChild($input);
    });

    // readonly項目には専用クラスを追加（アイテム全体がreadonly）
    if (isItemReadonly) {
      // jQuery → Vanilla JS 置換 (Phase 8)
      $li.classList.add("readonly");
    }

    // ボタン作成
    const buttons =
      typeof config.buttons === "function"
        ? config.buttons(item)
        : config.buttons;
    buttons.forEach((buttonDef) => {
      const button = this.createFlexibleButton(buttonDef, item, index, config);
      if (button) {
        // jQuery → Vanilla JS 置換 (Phase 8)
        button.classList.add("flex-col-button");
        $li.appendChild(button);
      }
    });

    // カテゴリー連動設定
    if (typeof config.dropdownCount === "function") {
      config.dropdownCount(inputs, item, index);
    } else if (
      config.dropdownCount === true ||
      this.hasCategoryFields(config.fields)
    ) {
      // デフォルトのカテゴリー連動設定
      this.setupStandardCategoryChain(inputs, item, config);
    }

    // 特殊機能設定
    if (config.setupSpecialFeatures) {
      config.setupSpecialFeatures($li, inputs, item, index);
    }

    
    // デバッグモード：アイテムの列幅確認（必要時のみ有効化）
    if (AppState.config.debugMode && window.FLEXIBLE_LIST_DEBUG) {
      setTimeout(() => {
        const itemElements = $li.querySelectorAll('.prompt-list-input, button');
        itemElements.forEach((element, index) => {
          const computedStyle = window.getComputedStyle(element);
          console.log(`[ITEM DEBUG] Element ${index}: width=${computedStyle.width}, padding=${computedStyle.paddingLeft}|${computedStyle.paddingRight}`);
        });
      }, 100);
    }
  }

  /**
   * フィールド値を取得
   */
  getFieldValue(item, field) {
    if (typeof field.getValue === "function") {
      return field.getValue(item);
    }

    if (typeof field.key === "string") {
      // ドット記法をサポート (例: "data.0", "category.big")
      return field.key.split(".").reduce((obj, key) => obj?.[key], item);
    }

    if (typeof field.key === "function") {
      return field.key(item);
    }

    return item[field.key] || "";
  }

  /**
   * フィールド変更ハンドラー
   */
  handleFieldChange(item, index, field, newValue, config, eventType = "input") {
    // フィールド固有のコールバック
    if (field.onChange) {
      field.onChange(newValue, item, index);
    }

    // Enter/Blurイベントでの統一保存処理（プロンプトフィールドなど）
    if (
      (eventType === "blur" || eventType === "enter") &&
      config.onEnterBlurChange
    ) {
      console.log(
        `[ListManager] Calling onEnterBlurChange for ${field.type} field:`,
        {
          eventType,
          fieldKey: field.key,
          value: newValue,
          index,
        }
      );
      config.onEnterBlurChange(index, field.key, newValue, item, eventType);
    }

    // カテゴリフィールドの場合、カスタムドロップダウンが直接保存を処理するため
    // カテゴリフィールドのonEnterBlurChangeは重複を避ける

    // 従来の汎用フィールド変更コールバック（後方互換性維持）
    if (config.onFieldChange) {
      config.onFieldChange(index, field.key, newValue, item);
    }

    // カテゴリー変更の場合の特別処理（汎用フィールド変更用、カスタムドロップダウンとは別）
    if (field.type === "category" && config.onFieldCategoryChange) {
      config.onFieldCategoryChange(index, field.key, newValue, item);
    }
  }

  /**
   * フレキシブルボタン作成
   */
  createFlexibleButton(buttonDef, item, index, config) {
    if (AppState.config.debugMode) {
      console.log("[BUTTON_DEBUG] Creating button:", {
        type: buttonDef.type,
        hasCustomHandler:
          !!config[
            `on${
              buttonDef.type.charAt(0).toUpperCase() + buttonDef.type.slice(1)
            }`
          ],
        item: item,
        index: index,
      });
    }

    switch (buttonDef.type) {
      case "add":
        return UIFactory.createButton({
          text: buttonDef.text || "➕",
          title: buttonDef.title || "プロンプト入力欄に追加",
          dataAction: "add",
          onClick: () => {
            if (AppState.config.debugMode) {
              console.log("[SET_BUTTON_DEBUG] Button clicked", {
                item,
                index,
                config: !!config.onSet,
              });
            }
            const value = buttonDef.getValue ? buttonDef.getValue(item) : "";
            if (config.onSet) {
              if (AppState.config.debugMode) {
                console.log("[SET_BUTTON_DEBUG] Using custom onSet handler");
              }
              config.onSet(value, item, index);
            } else {
              if (AppState.config.debugMode) {
                console.log("[SET_BUTTON_DEBUG] Using default set behavior");
              }
              // デフォルト動作
              const input = document.getElementById(DOM_IDS.PROMPT.GENERATE);
              if (input) {
                const newValue = input.value + value + ",";
                console.log(
                  `[LIST_MANAGER] SET button - initializing with new prompt:`,
                  newValue.substring(0, 50)
                );
                editPrompt.init(newValue);
                input.value = editPrompt.prompt;
                console.log(
                  `[LIST_MANAGER] SET button - promptEditor now has ${editPrompt.elements.length} elements`
                );

                // プロンプト保存後にリフレッシュを実行（タイミング問題解決）
                savePrompt();

                // ListRefreshManagerで統一されたリフレッシュ処理
                // editPrompt.initが完了してからリフレッシュするために少し遅延を追加
                setTimeout(() => {
                  try {
                    console.log(
                      `[LIST_MANAGER] SET button - executing refresh for edit tab`
                    );
                    ListRefreshManager.executeAction(
                      ListRefreshManager.ACTIONS.PROMPT_CHANGE,
                      {
                        context: {
                          newPrompt: newValue,
                          source: "set_button",
                          elementCount: editPrompt.elements.length,
                        },
                        delay: 0,
                        showNotification: false, // SETボタンでは通知不要
                      }
                    );
                  } catch (error) {
                    console.error(
                      "ListRefreshManager error on set button:",
                      error
                    );
                  }
                }, UI_DELAYS.REFRESH_DELAY); // editPrompt.initが完全に完了するための小さな遅延
              }
            }
          },
        });

      case "copy":
        return UIFactory.createButton({
          text: buttonDef.text || "📋",
          title: buttonDef.title || "クリップボードにコピー",
          dataAction: "copy",
          onClick: () => {
            console.log("[COPY_BUTTON_DEBUG] Button clicked", {
              item,
              index,
              config: !!config.onCopy,
            });
            const value = buttonDef.getValue ? buttonDef.getValue(item) : "";
            if (config.onCopy) {
              console.log("[COPY_BUTTON_DEBUG] Using custom onCopy handler");
              config.onCopy(value, item, index);
            } else {
              console.log("[COPY_BUTTON_DEBUG] Using default copy behavior");
              // デフォルト動作
              const temp = editPrompt.prompt;
              editPrompt.init(value);
              navigator.clipboard.writeText(editPrompt.prompt);
              editPrompt.init(temp);
            }
          },
        });

      case "delete":
        // 削除ボタン作成時に設定をコピーして保存（クロージャーで正しい設定を保持）
        const deleteConfig = {
          containerId: config.containerId,
          listType: config.listType,
          onDelete: config.onDelete,
          refreshCallback: config.refreshCallback,
        };

        // index と item をクロージャーでキャプチャ
        const capturedIndex = index;
        const capturedItem = item;

        return UIFactory.createButton({
          text: buttonDef.text || "🗑️",
          title: buttonDef.title || "アイテムを削除",
          dataAction: "delete",
          onClick: async () => {
            console.log("[ListManager] Delete button clicked:", {
              capturedIndex,
              capturedItem,
              capturedIndexType: typeof capturedIndex,
              capturedItemType: typeof capturedItem,
              itemId: capturedItem?.id,
            });

            const shouldDelete =
              !AppState.userSettings.optionData?.isDeleteCheck ||
              window.confirm("本当に削除しますか？");

            if (shouldDelete && deleteConfig.onDelete) {
              // 削除前にスクロール位置を保存（削除処理がスクロールをリセットする前に）
              let savedScrollPosition = null;
              if (
                deleteConfig.refreshCallback &&
                typeof deleteConfig.refreshCallback === "function"
              ) {
                savedScrollPosition = this.saveScrollPosition(
                  deleteConfig.containerId
                );
                console.log(
                  "[ListManager] Saved scroll position before deletion:",
                  savedScrollPosition
                );
              }

              let deleteResult;
              try {
                deleteResult = await deleteConfig.onDelete(
                  capturedIndex,
                  capturedItem
                );
              } catch (error) {
                console.error("Delete operation failed:", error);
                return;
              }

              // onDeleteがfalseを返した場合はrefreshCallbackをスキップ
              if (deleteResult === false) {
                console.log(
                  "[ListManager] Skipping refreshCallback (onDelete returned false)"
                );
                return;
              }

              // 削除処理後、refreshCallbackが設定されている場合は呼び出す
              if (
                deleteConfig.refreshCallback &&
                typeof deleteConfig.refreshCallback === "function" &&
                savedScrollPosition !== null
              ) {
                // refreshCallback実行中は自動スクロール保存・復元を無効化
                const originalConfig = this.getListConfig(
                  deleteConfig.containerId
                );
                if (originalConfig) {
                  originalConfig.autoPreserveScroll = false;
                }

                try {
                  // リフレッシュ実行前に現在のスクロール位置を再度取得
                  const container = document.querySelector(
                    deleteConfig.containerId
                  );
                  const currentScrollTop = container ? container.scrollTop : 0;

                  await deleteConfig.refreshCallback();

                  // 自動スクロール設定を元に戻す
                  if (originalConfig) {
                    originalConfig.autoPreserveScroll = true;
                  }

                  // スクロール位置の復元を削除（リフレッシュレス編集により不要）
                } catch (error) {
                  console.error("RefreshCallback failed:", error);
                  // エラー時も設定を元に戻す
                  if (originalConfig) {
                    originalConfig.autoPreserveScroll = true;
                  }
                }
              }
            }
          },
        });

      case "load":
        return UIFactory.createButton({
          text: buttonDef.text || "⬆️",
          title: buttonDef.title || "プロンプトとして読み込み",
          dataAction: "load",
          onClick: async () => {
            const value = buttonDef.getValue ? buttonDef.getValue(item) : "";
            if (config.onLoad) {
              config.onLoad(value, item, index);
            } else {
              // デフォルト動作
              console.log("[LOAD_BUTTON] Loading prompt from favorite:", value);
              editPrompt.init(value);
              UpdateGenaretePrompt();
              savePrompt();

              // Loadボタン押下後に編集タブをリフレッシュ（ListRefreshManager使用）
              console.log("[LOAD_BUTTON] Refreshing edit tab after load...");
              await ListRefreshManager.executeAction(
                ListRefreshManager.ACTIONS.PROMPT_CHANGE,
                {
                  sourceList: ListRefreshManager.LISTS.PROMPT_DICTIONARY,
                  context: {
                    reason: "prompt_loaded_from_favorite",
                    loadedPrompt: value,
                  },
                  delay: 100, // プロンプトの読み込み完了を待つ
                  showNotification: false,
                }
              );
              console.log("[LOAD_BUTTON] Edit tab refresh scheduled");
            }
          },
        });

      case "favorite":
        return UIFactory.createButton({
          text: buttonDef.text || "⭐️",
          title: buttonDef.title || "お気に入りに追加",
          dataAction: "favorite",
          onClick: async () => {
            const favoriteData = buttonDef.getValue
              ? buttonDef.getValue(item)
              : { title: "", prompt: item.prompt || "" };

            if (config.onFavorite) {
              config.onFavorite(favoriteData, item, index);
            } else {
              // デフォルト動作：現在設定されているお気に入りリストに追加
              try {
                await this.addToFavoriteList(favoriteData);
                ErrorHandler.notify("お気に入りに追加しました", {
                  type: ErrorHandler.NotificationType.TOAST,
                  messageType: "success",
                  duration: NOTIFICATION_DURATION.SHORT,
                });
              } catch (error) {
                console.error("Favorite addition failed:", error);
                ErrorHandler.notify("お気に入りの追加に失敗しました", {
                  type: ErrorHandler.NotificationType.TOAST,
                  messageType: "error",
                  duration: NOTIFICATION_DURATION.STANDARD,
                });
              }
            }
          },
        });

      case "generate":
        return UIFactory.createButton({
          text: buttonDef.text || "⚡",
          title: buttonDef.title || "このプロンプトでテスト生成",
          dataAction: "generate",
          onClick: async () => {
            const prompt = buttonDef.getValue
              ? buttonDef.getValue(item)
              : item.prompt;
            if (config.onGenerate) {
              config.onGenerate(prompt, item, index);
            } else {
              // デフォルト動作：重み最大(10)で直接生成
              await this.executeDirectGenerateWithMaxWeight(prompt);

              // 成功通知
              ErrorHandler.notify("重み最大でテスト生成を実行しました", {
                type: ErrorHandler.NotificationType.TOAST,
                messageType: "success",
                duration: 1500,
              });
            }
          },
        });

      case "register":
        // ローカル辞書項目は登録不可（非活性）
        const isLocalItem = item._source === "local";
        // buttonDef.enabledが明示的に設定されている場合はそれを優先
        // enabledが関数の場合は評価する
        let isEnabled;
        if (buttonDef.enabled !== undefined) {
          isEnabled =
            typeof buttonDef.enabled === "function"
              ? buttonDef.enabled(item)
              : buttonDef.enabled;
        } else {
          isEnabled = !isLocalItem;
        }

        // disabledTitleが関数の場合は評価する
        let disabledTitle = "この項目は登録できません";
        if (buttonDef.disabledTitle) {
          disabledTitle =
            typeof buttonDef.disabledTitle === "function"
              ? buttonDef.disabledTitle(item)
              : buttonDef.disabledTitle;
        }

        return UIFactory.createButton({
          text: buttonDef.text || "💾",
          title: isEnabled
            ? isLocalItem
              ? "登録済み項目"
              : "辞書に新規登録"
            : disabledTitle,
          enabled: isEnabled,
          disabledTitle: disabledTitle,
          dataAction: "register",
          onClick: isEnabled
            ? () => {
                console.log(
                  `[LIST_MANAGER] Register button clicked for item:`,
                  { prompt: item.prompt, index, enabled: isEnabled }
                );
                if (config.onRegister) {
                  config.onRegister(item.prompt, item, index);
                } else if (config.onRegistration) {
                  config.onRegistration(item, index);
                }
              }
            : () => {
                console.warn(
                  `[LIST_MANAGER] Register button clicked but disabled for item:`,
                  { prompt: item.prompt, index, enabled: isEnabled }
                );
              },
        });

      default:
        if (buttonDef.onClick) {
          return UIFactory.createButton({
            text: buttonDef.text || buttonDef.type,
            title: buttonDef.title || buttonDef.text || buttonDef.type,
            onClick: () => buttonDef.onClick(item, index),
          });
        }
        return null;
    }
  }

  /**
   * お気に入りリストにアイテムを追加（共通処理）
   * @param {Object} favoriteData - お気に入りデータ { title, prompt }
   */
  async addToFavoriteList(favoriteData) {
    const { title, prompt } = favoriteData;

    if (!prompt) {
      throw new Error("プロンプトが入力されていません");
    }

    // 現在の辞書を取得
    const currentDictId = AppState.data.currentPromptDictionary || "main";
    const currentDict = AppState.data.promptDictionaries?.[currentDictId];

    if (!currentDict) {
      throw new Error("辞書が選択されていません");
    }

    // プロンプト配列の初期化確認
    if (!currentDict.prompts) {
      currentDict.prompts = [];
    }

    // 重複チェック
    const validation = Validators.checkDuplicateFavorite(
      prompt,
      currentDict.prompts
    );
    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    // 新しいアイテムにIDとソート番号を設定
    const newFavoriteItem = {
      id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || "",
      prompt: prompt,
      sort: currentDict.prompts.length,
    };

    currentDict.prompts.push(newFavoriteItem);
    await savePromptDictionaries();

    // お気に入りリストの更新（dictionary-tabが存在し、アクティブな場合）
    if (
      window.app?.tabs?.dictionary &&
      AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY
    ) {
      // 統計情報を即座に更新
      window.app.tabs.dictionary.updateStats();

      // お気に入りリストが開いている場合はリストを更新
      if (window.app.tabs.dictionary.dictionaryStates.prompt) {
        await window.app.tabs.dictionary.refreshFavoriteList();
      }
    }
  }

  /**
   * カテゴリーフィールドが含まれているかチェック
   */
  hasCategoryFields(fields) {
    return fields.some((field) => field.type === "category");
  }

  /**
   * 標準的なカテゴリー連動設定（カスタムドロップダウン版）
   *
   * 動作仕様（設定により制御可能）：
   * - 大項目変更時：config.resetMiddleOnBigChange による制御（デフォルト：中項目をリセット）
   * - 中項目変更時：config.resetSmallOnMiddleChange による制御（デフォルト：小項目を保持）
   * - カスタムドロップダウンでオンデマンドデータ取得
   *
   * dropdownCount レベル制御：
   * - true または 3: 大項目・中項目・小項目すべて連動
   * - 2: 大項目・中項目のみ連動（小項目は入力フィールドのみ）
   * - 1: 大項目のみ連動
   *
   * @param {Array} inputs - 入力フィールドの配列
   * @param {Object} item - データアイテム
   * @param {Object} config - 設定オブジェクト
   */
  setupStandardCategoryChain(inputs, item, config) {
    const categoryInputs = inputs.filter((input, index) => {
      return config.fields[index]?.type === "category";
    });

    if (categoryInputs.length < 2) return; // 最低2つのカテゴリーフィールドが必要

    const [bigInput, middleInput, smallInput] = categoryInputs;

    // 連動レベルを取得（true または 3 = 全連動、2 = 大中のみ、1 = 大のみ）
    const chainLevel =
      config.chainLevel ||
      (config.dropdownCount === true ? 3 : config.dropdownCount || 0);

    // console.log(`[CATEGORY_CHAIN] Setup chain level: ${chainLevel}, config.chainLevel: ${config.chainLevel}, config.dropdownCount: ${config.dropdownCount}`);

    // カスタムドロップダウンシステムを使用
    this.setupCustomDropdownChain(
      bigInput,
      middleInput,
      smallInput,
      chainLevel,
      config
    );
  }

  /**
   * カスタムドロップダウンチェーンを設定
   */
  setupCustomDropdownChain(
    bigInput,
    middleInput,
    smallInput,
    chainLevel,
    config
  ) {
    if (AppState.config.debugMode) {
      console.log("[DICT_DEBUG] setupCustomDropdownChain called with:", {
        bigInput: !!bigInput,
        middleInput: !!middleInput,
        smallInput: !!smallInput,
        chainLevel: chainLevel,
        customDropdownAvailable: typeof CustomDropdown !== "undefined",
      });
    }

    // CustomDropdownクラスの利用可能性をチェック
    if (typeof CustomDropdown === "undefined") {
      console.error("[DICT_DEBUG] CustomDropdown class is not available!");
      return;
    }

    // CategoryUIManagerの初期化を確認
    if (!window.categoryUIManager) {
      window.categoryUIManager = new CategoryUIManager();
    }

    // 大項目のカスタムドロップダウン
    if (bigInput) {
      // list属性をクリア（既存のdatalist設定をリセット）
      bigInput.removeAttribute("list");
      bigInput.setAttribute("data-dropdown-enabled", "true");

      // 既存のカスタムドロップダウンがあれば削除
      if (bigInput.customDropdown) {
        bigInput.customDropdown.destroy();
      }

      // 元の値を保存
      let originalBigValue = bigInput.value;

      // 新しいカスタムドロップダウンを作成
      if (AppState.config.debugMode)
        console.log(
          "[DROPDOWN] Creating big category custom dropdown with config:",
          {
            categoryLevel: 0,
            listType: config.listType,
          }
        );

      // パフォーマンス改善: CustomDropdownの遅延初期化
      this.initializeDropdownOnDemand(bigInput, {
        categoryLevel: 0,
        onSubmit: (value) => {
          if (AppState.config.debugMode)
            console.log(
              "[DROPDOWN] Big category onSubmit called with value:",
              value
            );
          // 値が変更されていない場合は早期リターン
          if (value === originalBigValue) {
            if (AppState.config.debugMode)
              console.log(
                "[DROPDOWN] Big category value unchanged, skipping callbacks"
              );
            return;
          }

          // 元の値を更新
          originalBigValue = value;

          // 大項目変更時の処理
          if (config.resetMiddleOnBigChange && middleInput) {
            middleInput.value = "";
          }
          // 大項目変更時は小項目もリセット（resetLevel設定に応じて）
          const resetLevel = config.resetLevel || chainLevel; // resetLevelが未設定の場合はchainLevelをフォールバック
          if (resetLevel >= 3 && smallInput) {
            smallInput.value = "";
          }

          // データを保存（辞書タブのみ - 検索タブはonCategoryChangeで処理）
          if (config.listType === "add") {
            if (AppState.config.debugMode)
              console.log(
                "[DROPDOWN] Big category submit triggered, listType:",
                config.listType
              );
            const item = this.getItemFromInput(bigInput);
            if (AppState.config.debugMode)
              console.log("[DROPDOWN] Found item from input:", item);

            if (item && item.id !== undefined) {
              // 配列インデックスを検索（IDまたはインデックスで検索）
              const actualIndex = AppState.data.localPromptList.findIndex(
                (prompt, idx) => {
                  // IDが設定されている場合はIDで比較
                  if (prompt.id !== undefined && prompt.id === item.id) {
                    return true;
                  }
                  // IDが文字列の場合の比較
                  if (
                    typeof item.id === "string" &&
                    prompt.id !== undefined &&
                    prompt.id.toString() === item.id
                  ) {
                    return true;
                  }
                  // dict-local-${index} 形式のIDから配列インデックスを抽出
                  if (
                    typeof item.id === "string" &&
                    item.id.startsWith("dict-local-")
                  ) {
                    const extractedIndex = parseInt(
                      item.id.replace("dict-local-", "")
                    );
                    if (!isNaN(extractedIndex) && extractedIndex === idx) {
                      return true;
                    }
                  }
                  // インデックスでの比較（0も含む）
                  if (typeof item.id === "number" && idx === item.id) {
                    return true;
                  }
                  // 文字列インデックスとの比較
                  if (
                    typeof item.id === "string" &&
                    idx.toString() === item.id
                  ) {
                    return true;
                  }
                  return false;
                }
              );

              if (AppState.config.debugMode)
                console.log(
                  `[DROPDOWN] Big category search result: actualIndex=${actualIndex}, localPromptList length=${AppState.data.localPromptList.length}`
                );

              if (actualIndex !== -1) {
                if (AppState.config.debugMode)
                  console.log(
                    `[DROPDOWN] Saving big category change: index=${actualIndex}, value="${value}"`
                  );
                AppState.data.localPromptList[actualIndex].data[0] = value;
                // 非同期で保存
                this.saveLocalListImmediate();
              } else {
                console.warn(
                  "[DROPDOWN] Could not find matching item in localPromptList"
                );
              }
            } else {
              console.warn("[DROPDOWN] Could not get item from input");
            }
          }

          // フォーカス移動処理
          if (config.categoryChainBehavior?.focusNext) {
            this.focusNextCategoryInput(
              0,
              [bigInput, middleInput, smallInput],
              config
            );
          }

          // コールバック実行
          if (config.onCategoryChange) {
            config.onCategoryChange("big", value, bigInput);
          }
        },
        onBlur: (value) => {
          console.log(
            "[DROPDOWN] Big category onBlur called with value:",
            value
          );
          // 値が変更されていない場合は早期リターン
          if (value === originalBigValue) {
            console.log(
              "[DROPDOWN] Big category value unchanged, skipping blur callbacks"
            );
            return;
          }

          // 元の値を更新
          originalBigValue = value;

          // Blur時は保存のみ（フォーカス移動なし - 検索タブはonCategoryChangeで処理）
          if (config.listType === "add") {
            console.log(
              "[DROPDOWN] Big category blur triggered, listType:",
              config.listType
            );
            const item = this.getItemFromInput(bigInput);
            console.log("[DROPDOWN] Found item from input:", item);

            if (item && item.id !== undefined) {
              const actualIndex = AppState.data.localPromptList.findIndex(
                (prompt, idx) => {
                  if (
                    typeof item.id === "string" &&
                    prompt.id !== undefined &&
                    prompt.id.toString() === item.id
                  ) {
                    return true;
                  }
                  if (typeof item.id === "number" && idx === item.id) {
                    return true;
                  }
                  if (
                    typeof item.id === "string" &&
                    idx.toString() === item.id
                  ) {
                    return true;
                  }
                  return false;
                }
              );

              if (actualIndex !== -1) {
                console.log(
                  `[DROPDOWN] Saving big category blur: index=${actualIndex}, value="${value}"`
                );
                AppState.data.localPromptList[actualIndex].data[0] = value;
                this.saveLocalListImmediate();
              }
            }
          }

          // コールバック実行（保存のみ）
          if (config.onCategoryChange) {
            config.onCategoryChange("big", value, bigInput);
          }
        },
      });
    }

    // 中項目のカスタムドロップダウン
    if (middleInput && chainLevel >= 2) {
      if (AppState.config.debugMode) {
        console.log("[DICT_DEBUG] Setting up middle category custom dropdown");
      }

      // list属性をクリア（既存のdatalist設定をリセット）
      middleInput.removeAttribute("list");
      middleInput.setAttribute("data-dropdown-enabled", "true");

      // 既存のカスタムドロップダウンがあれば削除
      if (middleInput.customDropdown) {
        middleInput.customDropdown.destroy();
      }

      // 元の値を保存
      let originalMiddleValue = middleInput.value;

      // 新しいカスタムドロップダウンを作成
      try {
        if (AppState.config.debugMode)
          console.log(
            "[DROPDOWN] Creating middle category custom dropdown with config:",
            {
              categoryLevel: 1,
              listType: config.listType,
            }
          );

        // パフォーマンス改善: CustomDropdownの遅延初期化
        this.initializeDropdownOnDemand(middleInput, {
          categoryLevel: 1,
          onSubmit: (value) => {
            if (AppState.config.debugMode)
              console.log(
                "[DROPDOWN] Middle category onSubmit called with value:",
                value
              );
            // 値が変更されていない場合は早期リターン
            if (value === originalMiddleValue) {
              if (AppState.config.debugMode)
                console.log(
                  "[DROPDOWN] Middle category value unchanged, skipping callbacks"
                );
              return;
            }

            // 元の値を更新
            originalMiddleValue = value;

            // 中項目変更時の処理：小項目をリセット（resetLevel設定に応じて）
            const resetLevel = config.resetLevel || chainLevel; // resetLevelが未設定の場合はchainLevelをフォールバック
            if (resetLevel >= 3 && smallInput) {
              smallInput.value = "";
            }

            // データを保存（辞書タブのみ - 検索タブはonCategoryChangeで処理）
            if (config.listType === "add") {
              if (AppState.config.debugMode)
                console.log(
                  "[DROPDOWN] Middle category submit triggered, listType:",
                  config.listType
                );
              const item = this.getItemFromInput(middleInput);
              if (AppState.config.debugMode)
                console.log("[DROPDOWN] Found item from middle input:", item);

              if (item && item.id !== undefined) {
                // 配列インデックスを検索（IDまたはインデックスで検索）
                const actualIndex = AppState.data.localPromptList.findIndex(
                  (prompt, idx) => {
                    // IDが設定されている場合はIDで比較
                    if (prompt.id !== undefined && prompt.id === item.id) {
                      return true;
                    }
                    // IDが文字列の場合の比較
                    if (
                      typeof item.id === "string" &&
                      prompt.id !== undefined &&
                      prompt.id.toString() === item.id
                    ) {
                      return true;
                    }
                    // dict-local-${index} 形式のIDから配列インデックスを抽出
                    if (
                      typeof item.id === "string" &&
                      item.id.startsWith("dict-local-")
                    ) {
                      const extractedIndex = parseInt(
                        item.id.replace("dict-local-", "")
                      );
                      if (!isNaN(extractedIndex) && extractedIndex === idx) {
                        return true;
                      }
                    }
                    // インデックスでの比較（0も含む）
                    if (typeof item.id === "number" && idx === item.id) {
                      return true;
                    }
                    // 文字列インデックスとの比較
                    if (
                      typeof item.id === "string" &&
                      idx.toString() === item.id
                    ) {
                      return true;
                    }
                    return false;
                  }
                );

                if (AppState.config.debugMode)
                  console.log(
                    `[DROPDOWN] Middle search result: actualIndex=${actualIndex}, localPromptList length=${AppState.data.localPromptList.length}`
                  );

                if (actualIndex !== -1) {
                  if (AppState.config.debugMode)
                    console.log(
                      `[DROPDOWN] Saving middle category change: index=${actualIndex}, value="${value}"`
                    );
                  AppState.data.localPromptList[actualIndex].data[1] = value;
                  // 非同期で保存
                  this.saveLocalListImmediate();
                } else {
                  console.warn(
                    "[DROPDOWN] Could not find matching item in localPromptList for middle"
                  );
                }
              } else {
                console.warn("[DROPDOWN] Could not get item from middle input");
              }
            }

            // フォーカス移動処理
            if (config.categoryChainBehavior?.focusNext) {
              this.focusNextCategoryInput(
                1,
                [bigInput, middleInput, smallInput],
                config
              );
            }

            // コールバック実行
            if (config.onCategoryChange) {
              config.onCategoryChange("middle", value, middleInput);
            }
          },
          onBlur: (value) => {
            console.log(
              "[DROPDOWN] Middle category onBlur called with value:",
              value
            );
            // 値が変更されていない場合は早期リターン
            if (value === originalMiddleValue) {
              console.log(
                "[DROPDOWN] Middle category value unchanged, skipping blur callbacks"
              );
              return;
            }

            // 元の値を更新
            originalMiddleValue = value;

            // Blur時は保存のみ（フォーカス移動なし - 検索タブはonCategoryChangeで処理）
            if (config.listType === "add") {
              console.log(
                "[DROPDOWN] Middle category blur triggered, listType:",
                config.listType
              );
              const item = this.getItemFromInput(middleInput);
              console.log("[DROPDOWN] Found middle item from input:", item);

              if (item && item.id !== undefined) {
                const actualIndex = AppState.data.localPromptList.findIndex(
                  (prompt, idx) => {
                    if (
                      typeof item.id === "string" &&
                      prompt.id !== undefined &&
                      prompt.id.toString() === item.id
                    ) {
                      return true;
                    }
                    if (typeof item.id === "number" && idx === item.id) {
                      return true;
                    }
                    if (
                      typeof item.id === "string" &&
                      idx.toString() === item.id
                    ) {
                      return true;
                    }
                    return false;
                  }
                );

                if (actualIndex !== -1) {
                  console.log(
                    `[DROPDOWN] Saving middle category blur: index=${actualIndex}, value="${value}"`
                  );
                  AppState.data.localPromptList[actualIndex].data[1] = value;
                  this.saveLocalListImmediate();
                }
              }
            }

            // コールバック実行（保存のみ）
            if (config.onCategoryChange) {
              config.onCategoryChange("middle", value, middleInput);
            }
          },
        });
        if (AppState.config.debugMode) {
          console.log(
            "[DICT_DEBUG] Middle category custom dropdown created successfully"
          );
        }
      } catch (error) {
        console.error(
          "[DICT_DEBUG] Failed to create middle category custom dropdown:",
          error
        );
      }
    }

    // 小項目のカスタムドロップダウン（dropdownCountが3以上の場合のみ）
    if (smallInput && config.dropdownCount >= 3) {
      // list属性をクリア（既存のdatalist設定をリセット）
      smallInput.removeAttribute("list");
      smallInput.setAttribute("data-dropdown-enabled", "true");

      // 既存のカスタムドロップダウンがあれば削除
      if (smallInput.customDropdown) {
        smallInput.customDropdown.destroy();
      }

      // 元の値を保存
      let originalSmallValue = smallInput.value;

      // 新しいカスタムドロップダウンを作成
      // パフォーマンス改善: CustomDropdownの遅延初期化
      this.initializeDropdownOnDemand(smallInput, {
        categoryLevel: 2,
        onSubmit: (value) => {
          // 値が変更されていない場合は早期リターン
          if (value === originalSmallValue) {
            return;
          }

          // 元の値を更新
          originalSmallValue = value;

          // 小項目特有のコールバック（プロンプト自動設定）
          if (config.onSmallCategoryChange) {
            const bigValue = bigInput ? bigInput.value : "";
            const middleValue = middleInput ? middleInput.value : "";
            const item = this.getItemFromInput(smallInput);
            config.onSmallCategoryChange(value, bigValue, middleValue, item);
          }

          // フォーカス移動処理（編集タブでは無効、ユーザー辞書では有効）
          if (
            config.categoryChainBehavior?.focusNext &&
            config.listType !== "edit"
          ) {
            this.focusNextCategoryInput(
              2,
              [bigInput, middleInput, smallInput],
              config
            );
          }

          // 汎用カテゴリー変更コールバック
          if (config.onCategoryChange) {
            config.onCategoryChange("small", value, smallInput);
          }
        },
      });
    } else if (smallInput) {
      // 小項目を普通の入力フィールドにする場合
      if (AppState.config.debugMode)
        console.log("[DROPDOWN] Setting small input as regular field");

      // カスタムドロップダウン関連の属性を削除
      smallInput.removeAttribute("data-dropdown-enabled");
      smallInput.removeAttribute("list");

      // 既存のカスタムドロップダウンがあれば削除
      if (smallInput.customDropdown) {
        smallInput.customDropdown.destroy();
        smallInput.customDropdown = null;
      }
    }
  }

  /**
   * 次のカテゴリ入力フィールドにフォーカス移動
   * @param {number} currentLevel - 現在のレベル（0=大項目, 1=中項目, 2=小項目）
   * @param {Array} inputs - [bigInput, middleInput, smallInput]
   * @param {Object} config - 設定オブジェクト
   */
  focusNextCategoryInput(currentLevel, inputs, config) {
    const behavior = config.categoryChainBehavior || {};
    const chainLevel =
      config.chainLevel ||
      (config.dropdownCount === true ? 3 : config.dropdownCount || 0);

    if (AppState.config.debugMode)
      console.log(
        `[FOCUS] Moving focus from level ${currentLevel}, chainLevel: ${chainLevel}, inputs length: ${inputs.length}`
      );
    if (AppState.config.debugMode)
      console.log(
        `[FOCUS] Available inputs:`,
        inputs.map((input) => input?.className || "null")
      );

    // 次のレベルの入力フィールドを取得
    const nextLevel = currentLevel + 1;
    const nextInput = inputs[nextLevel];

    // 次のカテゴリフィールドが存在し、チェーンレベル内にある場合
    if (nextInput && nextLevel < chainLevel) {
      // 次のカテゴリフィールドにフォーカス
      setTimeout(() => {
        console.log(
          `[FOCUS] Focusing next category field: level ${nextLevel}, element:`,
          nextInput.className
        );
        nextInput.focus();

        // カスタムドロップダウンの場合、設定により自動で開く
        if (behavior.openDropdownOnFocus && nextInput.customDropdown) {
          console.log(`[FOCUS] Opening dropdown for level ${nextLevel}`);
          nextInput.customDropdown.open();
        }
      }, 150); // 少し長めの遅延でDOM更新を待つ
    } else if (nextLevel >= chainLevel && behavior.focusPromptAfterSmall) {
      // カテゴリレベルを超えた場合（すべてのカテゴリを通った後）、プロンプトフィールドにフォーカス
      let promptInput = null;

      // 配列の最後がプロンプトフィールドかチェック
      const lastInput = inputs[inputs.length - 1];
      if (lastInput && lastInput.classList.contains("flex-col-prompt")) {
        promptInput = lastInput;
      } else {
        // フォールバック：同じ行で検索
        promptInput = this.findPromptInputInSameRow(inputs[0]);
      }

      if (promptInput) {
        setTimeout(() => {
          console.log(
            `[FOCUS] Focusing prompt field after completing all categories`
          );
          promptInput.focus();
        }, 150);
      } else {
        console.warn(
          `[FOCUS] No prompt input found to focus after completing categories`
        );
      }
    } else {
      console.log(
        `[FOCUS] No focus movement: nextLevel=${nextLevel}, chainLevel=${chainLevel}, hasNextInput=${!!nextInput}, focusPromptAfterSmall=${
          behavior.focusPromptAfterSmall
        }`
      );
    }
  }

  /**
   * 同じ行のプロンプトフィールドを検索
   * @param {HTMLElement} categoryInput - カテゴリ入力フィールド
   * @returns {HTMLElement|null} プロンプト入力フィールド
   */
  findPromptInputInSameRow(categoryInput) {
    // 同じ行（li要素）内のプロンプトフィールドを検索
    const listItem = categoryInput.closest("li");
    if (listItem) {
      // .flex-col-prompt クラスを持つ入力フィールドを検索
      const promptInput = listItem.querySelector(".flex-col-prompt");
      console.log(`[FOCUS] Found prompt input in same row:`, !!promptInput);
      return promptInput;
    }

    console.warn(`[FOCUS] Could not find prompt input in same row`);
    return null;
  }

  /**
   * 入力フィールドから対応するアイテムを取得
   */
  getItemFromInput(inputElement) {
    // まずdata-element-idを探す（編集タブ用）
    const listItemWithElementId = inputElement.closest(
      "li[data-element-id], .flexible-list-item[data-element-id], .prompt-list-item[data-element-id]"
    );
    if (listItemWithElementId) {
      const elementId = listItemWithElementId.getAttribute("data-element-id");
      // IDを数値として返す（edit-tab.jsとの互換性のため）
      const numericId = parseInt(elementId);
      return { id: isNaN(numericId) ? elementId : numericId };
    }

    // 次にdata-item-idを探す（他のタブ用）
    const listItemWithItemId = inputElement.closest(
      "li[data-item-id], .flexible-list-item[data-item-id]"
    );
    if (listItemWithItemId) {
      const itemId = listItemWithItemId.getAttribute("data-item-id");
      // IDを数値として返す（edit-tab.jsとの互換性のため）
      const numericId = parseInt(itemId);
      return { id: isNaN(numericId) ? itemId : numericId };
    }

    // フォールバック：親要素のIDから推測
    const parent = inputElement.closest("li[id]");
    if (parent) {
      const parentId = parent.id;
      // edit-から始まる場合は数値部分を抽出
      if (parentId.startsWith("edit-")) {
        const numericId = parseInt(parentId.split("-")[1]);
        return { id: isNaN(numericId) ? parentId : numericId };
      }

      const numericId = parseInt(parentId);
      return { id: isNaN(numericId) ? parentId : numericId };
    }

    return null;
  }

  /**
   * 仮想リストにフィルターを適用
   */
  filterVirtualList(filterFn) {
    if (this.currentVirtualList) {
      this.currentVirtualList.setFilter(filterFn);
    }
  }

  /**
   * 仮想リストを破棄
   */
  destroyVirtualList() {
    if (this.currentVirtualList) {
      this.currentVirtualList.destroy();
      this.currentVirtualList = null;
    }
  }

  /**
   * リストを再描画（削除後のリアルタイム更新用）
   */
  refreshList(listType, containerId) {
    console.log("[REFRESH_DEBUG] refreshList called:", {
      listType: listType,
      containerId: containerId,
      timestamp: new Date().toLocaleTimeString(),
    });

    // 辞書タブの場合は専用の更新メソッドを使用
    if (
      (containerId === DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST ||
        containerId === DOM_SELECTORS.BY_ID.FAVORITE_LIST) &&
      window.app &&
      window.app.tabs &&
      window.app.tabs.dictionary
    ) {
      console.log("[REFRESH_DEBUG] Using dictionary tab refresh methods");

      if (
        listType === "add" &&
        containerId === DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST
      ) {
        console.log("[REFRESH_DEBUG] Calling refreshAddList");
        window.app.tabs.dictionary.refreshAddList();
      } else if (
        listType === "favorite" &&
        containerId === DOM_SELECTORS.BY_ID.FAVORITE_LIST
      ) {
        console.log("[REFRESH_DEBUG] Calling refreshFavoriteList");
        window.app.tabs.dictionary.refreshFavoriteList();
      }
      return;
    }

    // 通常リストは廃止 - すべてフレキシブルリストを使用
    let dataSource = null;
    let config = {};

    // リストタイプに応じてデータソースと設定を特定
    switch (listType) {
      case "add":
        dataSource = AppState.data.localPromptList;
        config = {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: [...STANDARD_BUTTONS, { type: "delete", title: "ユーザー辞書から削除" }],
          sortable: true,
          listType: "add",
        };
        console.log(
          "[REFRESH_DEBUG] Local list data count:",
          dataSource.length
        );
        break;
      case "favorite":
        const currentDict = getCurrentPromptDictionary();
        dataSource = currentDict.prompts || [];
        config = {
          fields: FAVORITE_FIELDS,
          buttons: FAVORITE_BUTTONS,
          sortable: true,
          listType: "favorite",
        };
        console.log(
          "[REFRESH_DEBUG] favorite list data count:",
          dataSource.length
        );
        break;
      case "search":
        dataSource = AppState.temp.searchResults;
        config = {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: STANDARD_BUTTONS,
          listType: "search",
        };
        console.log("[REFRESH_DEBUG] Search results count:", dataSource.length);
        break;
      case "edit":
        // 編集タブの場合は編集タブの専用更新を使用
        if (window.app && window.app.tabs && window.app.tabs.edit) {
          console.log("[REFRESH_DEBUG] Using edit tab refresh method");
          window.app.tabs.edit.refreshEditList();
          return;
        } else {
          console.warn("[REFRESH_DEBUG] Edit tab not available for refresh");
          return;
        }
      default:
        console.warn(
          "[REFRESH_DEBUG] Unknown list type for refresh:",
          listType
        );
        return;
    }

    // フレキシブルリストで再作成
    if (dataSource) {
      console.log(
        "[REFRESH_DEBUG] Recreating flexible list with",
        dataSource.length,
        "items"
      );
      this.createFlexibleList(dataSource, containerId, config);
      console.log("[REFRESH_DEBUG] Flexible list recreation completed");
    } else {
      console.warn(
        "[REFRESH_DEBUG] No data source found for listType:",
        listType
      );
    }
  }

  /**
   * 共通ソート処理関数
   * 各タブで統一されたソート処理を提供
   * @param {Array} sortedIds - ソートされたID配列（['', '1', '3', '0', '2'] 形式）
   * @param {Array} dataArray - ソート対象のデータ配列
   * @param {Function} afterSortCallback - ソート後に実行するコールバック関数
   * @param {string} debugContext - デバッグ用のコンテキスト名
   */
  handleSortCommon(
    sortedIds,
    dataArray,
    afterSortCallback,
    debugContext = "SORT"
  ) {
    // デバッグ情報の詳細化（デバッグモード時のみ）
    const sortOperationId = `${debugContext}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] ===== SORT OPERATION START =====`);
      console.log(`[🔄 ${sortOperationId}] Context: ${debugContext}`);
      console.log(`[🔄 ${sortOperationId}] Input sortedIds:`, sortedIds);
      console.log(`[🔄 ${sortOperationId}] DataArray length BEFORE sort:`, dataArray.length);
      console.log(`[🔄 ${sortOperationId}] DataArray contents BEFORE sort:`, 
        dataArray.map((item, idx) => ({
          index: idx,
          id: item?.id,
          sort: item?.sort,
          data: item?.data,
          prompt: item?.prompt?.substring(0, 20) + '...'
        }))
      );
    }

    // 空文字列やnull/undefinedを除外して有効なIDのみを取得
    const validIds = sortedIds.filter(
      (id) => id !== "" && id !== null && id !== undefined
    );
    
    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] Valid IDs after filtering:`, validIds);
    }

    // 有効なIDに対応する要素を取得（永続ID検索のみ）
    const sortedElements = validIds.map((id) => {
      // 永続IDプロパティで検索（編集タブ・辞書タブ共通）
      let element = dataArray.find(el => el && (el.id == id));
      
      if (AppState.config.debugMode) {
        if (!element) {
          console.warn(`[🔄 ${sortOperationId}] ❌ Element not found for ID: ${id}`);
          console.log(`[🔄 ${sortOperationId}] Available IDs in dataArray:`, 
            dataArray.map((el, idx) => ({ idx, id: el?.id }))
          );
        } else {
          console.log(`[🔄 ${sortOperationId}] ✅ Found element for ID ${id}:`, {
            id: element.id,
            sort: element.sort,
            data: element.data
          });
        }
      }
      return element;
    }).filter(Boolean);
    
    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] Sorted elements count: ${sortedElements.length}`);
      console.log(`[🔄 ${sortOperationId}] Sorted elements IDs: ${sortedElements.map(el => el.id)}`);
    }

    if (sortedElements.length === 0) {
      if (AppState.config.debugMode) {
        console.warn(`[🔄 ${sortOperationId}] ❌ No valid elements found for sorting - OPERATION ABORTED`);
      }
      return;
    }

    // sortプロパティを更新
    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] Updating sort properties...`);
    }
    
    sortedElements.forEach((element, index) => {
      if (element) {
        const oldSort = element.sort;
        element.sort = index;
        
        if (AppState.config.debugMode) {
          console.log(`[🔄 ${sortOperationId}] Element ${element.id}: sort ${oldSort} → ${index}`);
        }
      }
    });

    // 元の配列を物理的に並び替え
    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] Replacing array contents...`);
    }
    
    const originalLength = dataArray.length;
    dataArray.length = 0; // 配列をクリア
    dataArray.push(...sortedElements); // ソート済み要素で置き換え

    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] Array replacement: ${originalLength} → ${dataArray.length} elements`);
      console.log(`[🔄 ${sortOperationId}] DataArray contents AFTER sort:`, 
        dataArray.map((item, idx) => ({
          index: idx,
          id: item?.id,
          sort: item?.sort,
          data: item?.data,
          prompt: item?.prompt?.substring(0, 20) + '...'
        }))
      );
    }

    // コールバック関数を実行
    if (typeof afterSortCallback === "function") {
      if (AppState.config.debugMode) {
        console.log(`[🔄 ${sortOperationId}] Executing after-sort callback...`);
      }
      
      const callbackStart = Date.now();
      try {
        afterSortCallback();
        
        if (AppState.config.debugMode) {
          console.log(`[🔄 ${sortOperationId}] ✅ Callback executed successfully (${Date.now() - callbackStart}ms)`);
        }
      } catch (error) {
        console.error(`[🔄 ${sortOperationId}] ❌ Callback execution failed:`, error);
      }
    } else if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] No after-sort callback provided`);
    }

    if (AppState.config.debugMode) {
      console.log(`[🔄 ${sortOperationId}] ===== SORT OPERATION END =====`);
    }
  }
  /**
   * ボタン表示トグル機能を設定
   * @param {string} listId - リストID
   * @param {string} cleanListId - クリーンなリストID
   */
  setupButtonToggle(listId, cleanListId) {
    const allToggleBtn = document.querySelector(
      `[data-list-id="${cleanListId}"][data-button-type="all"]`
    );
    const settingsBtn = document.querySelector(
      `[data-list-id="${cleanListId}"].button-controls-settings`
    );

    if (!allToggleBtn) {
      console.warn(
        `[ButtonToggle] All toggle button not found for ${cleanListId}`
      );
      return;
    }

    // 全ボタンの初期状態を設定（デフォルト：表示）
    const allStorageKey = `buttonVisible_${cleanListId}_all`;
    const allVisible = localStorage.getItem(allStorageKey) !== "false"; // デフォルトtrue

    this.setButtonVisibility(listId, allVisible, "all");
    this.updateToggleButtonState(allToggleBtn, allVisible);

    // 全ボタンのクリックイベントリスナーを設定
    allToggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const currentVisible = localStorage.getItem(allStorageKey) !== "false";
      const newVisible = !currentVisible;

      // 状態を保存
      localStorage.setItem(allStorageKey, newVisible.toString());

      // ボタンの表示/非表示を切り替え（cleanListIdも渡す）
      this.setButtonVisibility(listId, newVisible, "all", cleanListId);
      this.updateToggleButtonState(allToggleBtn, newVisible);

      console.log(
        `[ButtonToggle] ${cleanListId} all buttons ${
          newVisible ? "shown" : "hidden"
        }`
      );
    });

    // 設定ボタンのクリックイベントリスナーを設定
    if (settingsBtn) {
      settingsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showButtonSettingsModal(listId, cleanListId);
      });
    }

    // 初期状態で個別ボタン設定を適用
    this.applyIndividualButtonSettings(listId, cleanListId);
  }

  /**
   * リスト内のボタンの表示/非表示を制御
   * @param {string} listId - リストID
   * @param {boolean} isVisible - 表示するかどうか
   * @param {string} buttonType - ボタン種類（'all'または特定のボタンタイプ）
   * @param {string} cleanListId - クリーンなリストID（オプション）
   */
  setButtonVisibility(
    listId,
    isVisible,
    buttonType = "all",
    cleanListId = null
  ) {
    const container = document.querySelector(listId);
    if (!container) return;

    // flexible-list-containerを取得（listIdの親要素またはlistId自体）
    const flexibleContainer =
      container.closest(".flexible-list-container") ||
      (container.classList.contains("flexible-list-container")
        ? container
        : null);

    if (!flexibleContainer) {
      console.warn(
        `[ButtonVisibility] flexible-list-container not found for ${listId}`
      );
      return;
    }

    if (buttonType === "all") {
      // 全ボタンの制御
      if (isVisible) {
        flexibleContainer.classList.remove("buttons-hidden");
        flexibleContainer.classList.remove("hide-all-button-types");
        // 個別設定を再適用（共通処理を使用）
        if (!cleanListId) {
          // cleanListIdが渡されていない場合は、data属性から取得を試みる
          const headerElement = flexibleContainer.querySelector(
            ".search-results-header"
          );
          if (headerElement) {
            const toggleBtn = headerElement.querySelector("[data-list-id]");
            if (toggleBtn) {
              cleanListId = toggleBtn.getAttribute("data-list-id");
            }
          }
          if (!cleanListId) {
            // それでも取得できない場合はフォールバック
            cleanListId = listId.replace("#", "").replace("-list", "");
          }
        }
        this.applyIndividualButtonSettings(listId, cleanListId);
      } else {
        flexibleContainer.classList.add("buttons-hidden");
        flexibleContainer.classList.remove("hide-all-button-types");
      }
    } else {
      // 特定のボタン種類の制御
      const hideClass = `hide-${buttonType}-buttons`;

      if (isVisible) {
        flexibleContainer.classList.remove(hideClass);
      } else {
        flexibleContainer.classList.add(hideClass);
      }

      // ヘッダー行の該当ボタン列も制御
      this.updateHeaderButtonColumns(flexibleContainer, buttonType, isVisible);

      // 全てのボタン種類が非表示になったかチェック
      this.checkAllButtonTypesHidden(flexibleContainer);
    }
  }

  /**
   * 全ボタン種類が非表示になったかチェック
   * @param {Element} flexibleContainer - フレキシブルリストコンテナ
   */
  checkAllButtonTypesHidden(flexibleContainer) {
    // 実際にこのリストに存在するボタン種類のみを取得
    const existingButtonTypes = new Set();
    const allButtons = flexibleContainer.querySelectorAll(
      "button[data-action]"
    );
    allButtons.forEach((button) => {
      const action = button.getAttribute("data-action");
      if (action && BUTTON_TYPES[action]) {
        existingButtonTypes.add(action);
      }
    });

    console.log(
      `[ButtonVisibility] Existing button types in this list:`,
      Array.from(existingButtonTypes)
    );

    if (existingButtonTypes.size === 0) {
      // ボタンが全くない場合
      flexibleContainer.classList.remove("hide-all-button-types");
      console.log(
        "[ButtonVisibility] No buttons in this list, removed hide-all-button-types class"
      );
      return;
    }

    // 存在するボタン種類が全て非表示になっているかチェック
    const allExistingHidden = Array.from(existingButtonTypes).every(
      (buttonType) =>
        flexibleContainer.classList.contains(`hide-${buttonType}-buttons`)
    );

    if (allExistingHidden) {
      flexibleContainer.classList.add("hide-all-button-types");
      console.log(
        "[ButtonVisibility] All existing button types hidden, added hide-all-button-types class"
      );
    } else {
      flexibleContainer.classList.remove("hide-all-button-types");
      console.log(
        "[ButtonVisibility] Not all existing button types hidden, removed hide-all-button-types class"
      );
    }
  }

  /**
   * ヘッダー行のボタン列を更新
   * @param {Element} flexibleContainer - フレキシブルリストコンテナ
   * @param {string} buttonType - ボタン種類
   * @param {boolean} isVisible - 表示するかどうか
   */
  updateHeaderButtonColumns(flexibleContainer, buttonType, isVisible) {
    console.log(
      `[HeaderColumns] Updating header columns for ${buttonType}, visible: ${isVisible}`
    );

    // まず、実際のボタン行からボタンの位置情報を取得
    const firstButtonRow = flexibleContainer.querySelector(
      ".prompt-list-item, li:not(.prompt-list-header)"
    );
    if (!firstButtonRow) {
      console.log(`[HeaderColumns] No button rows found`);
      return;
    }

    // ボタン行から直接ボタン要素を取得（.flex-col-buttonクラスのボタンを探す）
    const buttonElements = firstButtonRow.querySelectorAll(
      "button[data-action]"
    );
    const targetButtonColumnIndex = [];

    console.log(
      `[HeaderColumns] Found ${buttonElements.length} button elements in first row`
    );

    // 対象ボタン種類のインデックスを特定
    buttonElements.forEach((button, index) => {
      const action = button.getAttribute("data-action");
      console.log(`[HeaderColumns] Button ${index}: action=${action}`);
      if (action === buttonType) {
        targetButtonColumnIndex.push(index);
        console.log(
          `[HeaderColumns] Found ${buttonType} button at index ${index}`
        );
      }
    });

    if (targetButtonColumnIndex.length === 0) {
      console.log(
        `[HeaderColumns] No ${buttonType} buttons found in any column`
      );
      return;
    }

    // ヘッダー行のボタン列（入力フィールド）を制御
    const headerSelectors = [
      ".prompt-list-header .flex-col-button",
      "li.prompt-list-header .flex-col-button",
    ];

    let headerColumns = [];
    for (const selector of headerSelectors) {
      headerColumns = flexibleContainer.querySelectorAll(selector);
      if (headerColumns.length > 0) {
        console.log(
          `[HeaderColumns] Found ${headerColumns.length} header columns with selector: ${selector}`
        );
        break;
      }
    }

    if (headerColumns.length > 0) {
      targetButtonColumnIndex.forEach((buttonIndex) => {
        if (buttonIndex < headerColumns.length) {
          const headerColumn = headerColumns[buttonIndex];
          if (isVisible) {
            headerColumn.classList.remove("header-column-hidden");
            headerColumn.style.display = "";
            console.log(
              `[HeaderColumns] Showing header column ${buttonIndex} for ${buttonType}`
            );
          } else {
            headerColumn.classList.add("header-column-hidden");
            console.log(
              `[HeaderColumns] Hiding header column ${buttonIndex} for ${buttonType}`
            );
          }
        }
      });
    }
  }

  /**
   * トグルボタンの状態を更新
   * @param {Element} toggleBtn - トグルボタン要素
   * @param {boolean} isVisible - 表示状態
   */
  updateToggleButtonState(toggleBtn, isVisible) {
    const icon = toggleBtn.querySelector(".toggle-icon");
    const text = toggleBtn.querySelector(".toggle-text");

    if (icon) {
      icon.textContent = isVisible ? "👁️" : "🙈";
    }
    if (text) {
      text.textContent = isVisible ? "全て" : "非表示";
    }

    toggleBtn.setAttribute(
      "title",
      isVisible ? "全ボタンを非表示にする" : "全ボタンを表示する"
    );

    // 視覚的な状態を示すクラスを追加
    if (isVisible) {
      toggleBtn.classList.remove("buttons-hidden");
      toggleBtn.classList.add("buttons-visible");
    } else {
      toggleBtn.classList.remove("buttons-visible");
      toggleBtn.classList.add("buttons-hidden");
    }
  }

  /**
   * 個別ボタン設定を適用
   * @param {string} listId - リストID
   * @param {string} cleanListId - クリーンなリストID
   */
  applyIndividualButtonSettings(listId, cleanListId) {
    const container = document.querySelector(listId);
    if (!container) return;

    const flexibleContainer =
      container.closest(".flexible-list-container") ||
      (container.classList.contains("flexible-list-container")
        ? container
        : null);

    if (!flexibleContainer) return;

    // 実際にこのリストに存在するボタン種類のみを処理
    const existingButtonTypes = new Set();
    const allButtons = flexibleContainer.querySelectorAll(
      "button[data-action]"
    );
    allButtons.forEach((button) => {
      const action = button.getAttribute("data-action");
      if (action && BUTTON_TYPES[action]) {
        existingButtonTypes.add(action);
      }
    });

    // 存在するボタン種類のみ個別設定を適用
    existingButtonTypes.forEach((buttonType) => {
      const storageKey = `buttonVisible_${cleanListId}_${buttonType}`;
      const isVisible = localStorage.getItem(storageKey) !== "false"; // デフォルトtrue

      // 個別ボタンの制御（ヘッダー列も含む）
      if (!isVisible) {
        this.setButtonVisibility(listId, false, buttonType, cleanListId);
      } else {
        // 明示的に表示クラスを削除（全ボタン表示後の個別設定適用時に必要）
        flexibleContainer.classList.remove(`hide-${buttonType}-buttons`);
        this.updateHeaderButtonColumns(flexibleContainer, buttonType, true);
      }
    });

    // 全ボタン種類が非表示かチェック
    this.checkAllButtonTypesHidden(flexibleContainer);
  }

  /**
   * ボタン設定モーダルを表示
   * @param {string} listId - リストID
   * @param {string} cleanListId - クリーンなリストID
   */
  showButtonSettingsModal(listId, cleanListId) {
    // 既存のモーダルがあれば削除
    const existingModal = document.querySelector(".button-settings-modal");
    if (existingModal) {
      existingModal.remove();
    }

    // 現在のリストにあるボタン種類を判定
    const container = document.querySelector(listId);
    const availableButtons = new Set();

    if (container) {
      const buttons = container.querySelectorAll("button[data-action]");
      console.log(
        `[ButtonSettings] Found buttons with data-action:`,
        buttons.length
      );
      buttons.forEach((button) => {
        const action = button.getAttribute("data-action");
        console.log(
          `[ButtonSettings] Button action:`,
          action,
          BUTTON_TYPES[action] ? "valid" : "invalid"
        );
        if (action && BUTTON_TYPES[action]) {
          availableButtons.add(action);
        }
      });
    }

    console.log(
      `[ButtonSettings] Available buttons for ${cleanListId}:`,
      Array.from(availableButtons)
    );

    // 利用可能なボタンがない場合は終了
    if (availableButtons.size === 0) {
      console.warn(
        `[ButtonSettings] No available buttons found for ${cleanListId}`
      );
      // デバッグ情報を出力
      const allButtons = container?.querySelectorAll("button");
      console.log(
        `[ButtonSettings] All buttons in container:`,
        allButtons?.length || 0
      );
      allButtons?.forEach((btn) => {
        console.log(
          `[ButtonSettings] Button:`,
          btn.textContent,
          btn.getAttribute("data-action")
        );
      });
      return;
    }

    // モーダルHTML生成
    const modalHTML = `
      <div class="button-settings-modal">
        <div class="button-settings-content">
          <div class="button-settings-header">
            <span class="button-settings-title">ボタン表示設定</span>
            <button class="button-settings-close">×</button>
          </div>
          <div class="button-settings-list">
            ${Array.from(availableButtons)
              .map((buttonType) => {
                const buttonInfo = BUTTON_TYPES[buttonType];
                const storageKey = `buttonVisible_${cleanListId}_${buttonType}`;
                const isVisible = localStorage.getItem(storageKey) !== "false";

                return `
                <div class="button-setting-item">
                  <div class="button-setting-label">
                    <span>${buttonInfo.icon}</span>
                    <span>${buttonInfo.label}</span>
                  </div>
                  <div class="button-setting-toggle ${
                    isVisible ? "active" : ""
                  }"
                       data-button-type="${buttonType}"
                       data-list-id="${cleanListId}">
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;

    // モーダルをDOMに追加
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    const modal = document.querySelector(".button-settings-modal");

    // イベントリスナー設定
    const closeBtn = modal.querySelector(".button-settings-close");
    const toggles = modal.querySelectorAll(".button-setting-toggle");

    // 閉じるボタン
    closeBtn.addEventListener("click", () => {
      modal.remove();
    });

    // 背景クリックで閉じる
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // トグルボタン
    toggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const buttonType = toggle.getAttribute("data-button-type");
        const currentActive = toggle.classList.contains("active");
        const newActive = !currentActive;

        // 状態を保存
        const storageKey = `buttonVisible_${cleanListId}_${buttonType}`;
        localStorage.setItem(storageKey, newActive.toString());

        // 表示を更新
        toggle.classList.toggle("active", newActive);
        this.setButtonVisibility(listId, newActive, buttonType);

        console.log(
          `[ButtonSettings] ${buttonType} button ${
            newActive ? "shown" : "hidden"
          } for ${cleanListId}`
        );
      });
    });
  }

  /**
   * プロンプトで直接生成を実行（履歴再実行と同じ方式）
   * @param {string} prompt - 生成するプロンプト
   */
  async executeDirectGenerate(prompt) {
    if (!prompt || !prompt.trim()) {
      ErrorHandler.notify("プロンプトが空です", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });
      return;
    }

    // sendBackground 関数と AppState の存在確認
    if (typeof sendBackground !== "function") {
      ErrorHandler.notify("Generate機能が利用できません", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });
      console.error("[GENERATE] sendBackground function not found");
      return;
    }

    if (!window.AppState || !AppState.selector) {
      ErrorHandler.notify("セレクター設定が見つかりません", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });
      console.error("[GENERATE] AppState.selector not found");
      return;
    }

    try {
      // 自動生成が動いている場合は停止
      if (window.autoGenerateHandler && window.autoGenerateHandler.isRunning) {
        window.autoGenerateHandler.stop();
      }

      console.log(
        "[GENERATE] Executing direct generate with prompt:",
        prompt.substring(0, 100) + "..."
      );

      // generate-history-manager.js と同じ方式で直接生成実行
      sendBackground(
        "DOM", // または CHROME_MESSAGES.DOM_GENERATE
        "Generate",
        prompt.trim(),
        AppState.selector.positiveSelector,
        AppState.selector.generateSelector
      );

      console.log("[GENERATE] Direct generate executed successfully");
    } catch (error) {
      console.error("[GENERATE] Error in executeDirectGenerate:", error);
      ErrorHandler.notify("生成実行中にエラーが発生しました", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });
    }
  }

  /**
   * 重み最大(10)でGenerate実行
   * @param {string} prompt - 生成するプロンプト
   */
  async executeDirectGenerateWithMaxWeight(prompt) {
    if (!prompt || !prompt.trim()) {
      ErrorHandler.notify("プロンプトが空です", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });
      return;
    }

    // WeightConverter の存在確認
    if (typeof WeightConverter === "undefined") {
      console.error("[GENERATE] WeightConverter not found, falling back to normal generate");
      await this.executeDirectGenerate(prompt);
      return;
    }

    try {
      // 現在のUIタイプを取得
      const checkedUIType = document.querySelector('[name="UIType"]:checked');
      const uiType = checkedUIType ? checkedUIType.value : "SD";
      const maxWeight = 10;

      // 重み最大(10)を適用
      const weightedPrompt = WeightConverter.applyWeightToPrompt(uiType, prompt.trim(), maxWeight);

      console.log(
        `[GENERATE] Executing generate with max weight (${maxWeight}):`,
        `${uiType} format: ${weightedPrompt.substring(0, 100)}...`
      );

      // sendBackground 関数と AppState の存在確認
      if (typeof sendBackground !== "function") {
        ErrorHandler.notify("Generate機能が利用できません", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "error",
          duration: 2000,
        });
        console.error("[GENERATE] sendBackground function not found");
        return;
      }

      if (!window.AppState || !AppState.selector) {
        ErrorHandler.notify("セレクター設定が見つかりません", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "error",
          duration: 2000,
        });
        console.error("[GENERATE] AppState.selector not found");
        return;
      }

      // 自動生成が動いている場合は停止
      if (window.autoGenerateHandler && window.autoGenerateHandler.isRunning) {
        window.autoGenerateHandler.stop();
      }

      // 重み適用済みプロンプトで生成実行
      sendBackground(
        "DOM",
        "Generate",
        weightedPrompt,
        AppState.selector.positiveSelector,
        AppState.selector.generateSelector
      );

      console.log("[GENERATE] Max weight generate executed successfully");
    } catch (error) {
      console.error("[GENERATE] Error in executeDirectGenerateWithMaxWeight:", error);
      ErrorHandler.notify("重み最大生成実行中にエラーが発生しました", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });
    }
  }

  /**
   * 全要素のreadonly状態を再評価
   * @param {string} listId - リストID
   */
  updateAllElementsReadonlyState(listId) {
    try {
      const container = document.querySelector(`#${listId}`);
      if (!container) {
        console.warn(`[ListManager] Container not found: ${listId}`);
        return;
      }

      const listConfig = this.listConfigs.get(listId);
      if (!listConfig) {
        console.warn(`[ListManager] List config not found: ${listId}`);
        return;
      }

      // すべてのリストアイテムを取得
      const listItems = container.querySelectorAll("li[data-element-id]");

      listItems.forEach((listItem) => {
        const elementId = listItem.getAttribute("data-element-id");

        // 編集タブの場合、editPrompt.elementsから要素データを取得
        if (listConfig.listType === "edit" && window.editPrompt) {
          const element = window.editPrompt.elements.find(
            (el) => el.id.toString() === elementId
          );
          if (element) {
            this.updateElementReadonlyState(listItem, element, listConfig);
          }
        }
      });

      console.log(
        `[ListManager] Updated readonly states for ${listItems.length} elements in ${listId}`
      );
    } catch (error) {
      console.error(`[ListManager] Error updating readonly states:`, error);
    }
  }

  /**
   * 単一要素のreadonly状態を更新
   * @param {HTMLElement} listItem - リストアイテム要素
   * @param {Object} itemData - アイテムデータ
   * @param {Object} config - リスト設定
   */
  updateElementReadonlyState(listItem, itemData, config) {
    try {
      config.fields.forEach((field) => {
        const input = listItem.querySelector(`[data-field="${field.key}"]`);
        if (input) {
          // readonly状態を再評価
          const fieldReadonly =
            typeof field.readonly === "function"
              ? field.readonly(itemData)
              : field.readonly;

          if (fieldReadonly) {
            input.setAttribute("readonly", "true");
            input.disabled = true;
            input.classList.add("readonly-field");
            input.title = "翻訳中のため編集できません";
          } else {
            input.removeAttribute("readonly");
            input.disabled = false;
            input.classList.remove("readonly-field");
            input.title = "";
          }
        }
      });
    } catch (error) {
      console.error(
        `[ListManager] Error updating element readonly state:`,
        error
      );
    }
  }

  /**
   * ヘッダークリックによるソート機能
   * @param {string} listId - リストID
   * @param {string} columnType - ソート対象の列タイプ（'category', 'prompt', 'weight'）
   * @param {Array} dataArray - ソート対象のデータ配列
   * @param {Function} refreshCallback - リフレッシュコールバック関数
   * @param {Function} saveCallback - 保存コールバック関数
   */
  handleHeaderClickSort(listId, columnType, dataArray, refreshCallback, saveCallback, categoryIndex = null) {
    
    const currentState = this.sortStates.get(listId) || { column: null, direction: null };
    
    // ソート方向を決定
    let newDirection;
    if (currentState.column === columnType) {
      // 同じ列をクリックした場合：昇順⇔降順の切り替え
      if (currentState.direction === 'asc') {
        newDirection = 'desc';
      } else {
        newDirection = 'asc';
      }
    } else {
      // 異なる列をクリックした場合：昇順から開始
      newDirection = 'asc';
    }

    // ソート状態を更新
    this.sortStates.set(listId, { 
      column: columnType, 
      direction: newDirection 
    });

    // ヘッダーの視覚状態を更新（カテゴリインデックスを渡す）
    this.updateHeaderSortIndicators(listId, columnType, newDirection, categoryIndex);

    // データをソート（列の詳細情報とカテゴリインデックスを渡す）
    this.performColumnSort(dataArray, columnType, newDirection, listId, categoryIndex);
    
    // ソート後にsortプロパティを更新（永続化のため）
    if (dataArray === AppState.data.localPromptList) {
      // ローカル辞書の場合
      dataArray.forEach((item, index) => {
        item.sort = index;
      });
    } else if (dataArray && dataArray.length > 0 && dataArray[0].title !== undefined) {
      // プロンプト辞書の場合（titleプロパティで判定）
      dataArray.forEach((item, index) => {
        item.sort = index;
      });
    }
    
    // データ保存
    if (typeof saveCallback === 'function') {
      saveCallback();
    }
    
    // ソート後にリフレッシュを実行
    if (typeof refreshCallback === 'function') {
      refreshCallback();
    }
  }

  /**
   * ヘッダーのソートインジケーターを更新
   * @param {string} listId - リストID
   * @param {string} activeColumn - アクティブな列
   * @param {string|null} direction - ソート方向
   */
  updateHeaderSortIndicators(listId, activeColumn, direction, targetColumnIndex = null) {
    const list = document.querySelector(listId);
    if (!list) return;

    const headerInputs = list.querySelectorAll('.prompt-list-header .prompt-list-input');
    
    headerInputs.forEach((input, index) => {
      // すべてのソートクラスをリセット
      input.classList.remove('sortable-header', 'sort-asc', 'sort-desc');
      
      // ソート可能な列の判定（STANDARD_CATEGORY_FIELDSに基づく）
      // 0=大項目(category), 1=中項目(category), 2=小項目(category), 3=プロンプト(prompt), 4=重み(weight)
      const columnConfig = [
        { type: 'category', index: 0 }, // 大項目
        { type: 'category', index: 1 }, // 中項目  
        { type: 'category', index: 2 }, // 小項目
        { type: 'prompt', index: null },
        { type: 'weight', index: null }
      ];
      
      if (index < columnConfig.length) {
        const config = columnConfig[index];
        input.classList.add('sortable-header');
        
        // アクティブな列の判定
        let isActiveColumn = false;
        if (activeColumn === 'category' && config.type === 'category') {
          // カテゴリ列の場合：targetColumnIndexで判定
          isActiveColumn = (targetColumnIndex !== null && config.index === targetColumnIndex);
        } else if (activeColumn === config.type) {
          // プロンプト・重み列の場合：タイプで判定
          isActiveColumn = true;
        }
        
        if (isActiveColumn && direction) {
          input.classList.add(`sort-${direction}`);
        }
      }
    });
  }

  /**
   * 列データによるソートを実行
   * @param {Array} dataArray - ソート対象のデータ配列
   * @param {string} columnType - 列タイプ
   * @param {string} direction - ソート方向（'asc' or 'desc'）
   */
  performColumnSort(dataArray, columnType, direction, listId, categoryIndex = null) {
    dataArray.sort((a, b) => {
      let valueA, valueB;
      
      // 列タイプに応じて比較値を取得
      switch (columnType) {
        case 'category':
          if (categoryIndex !== null) {
            // 特定のカテゴリ列のみで比較
            if (categoryIndex === 0 && a.title !== undefined) {
              // お気に入りリストの場合：title フィールドで比較
              valueA = a.title || '';
              valueB = b.title || '';
            } else {
              // 通常のカテゴリ列：data配列で比較
              valueA = (a.data || [])[categoryIndex] || '';
              valueB = (b.data || [])[categoryIndex] || '';
            }
          } else {
            // フォールバック：全カテゴリ結合
            valueA = (a.data || []).join(' > ');
            valueB = (b.data || []).join(' > ');
          }
          break;
        case 'prompt':
          valueA = a.prompt || '';
          valueB = b.prompt || '';
          break;
        case 'weight':
          valueA = parseFloat(a.weight) || 0;
          valueB = parseFloat(b.weight) || 0;
          break;
        default:
          return 0;
      }

      // 文字列比較（大文字小文字を区別しない）
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      // 比較結果
      let result;
      if (valueA < valueB) {
        result = -1;
      } else if (valueA > valueB) {
        result = 1;
      } else {
        result = 0;
      }

      // 降順の場合は結果を反転
      return direction === 'desc' ? -result : result;
    });
  }

  /**
   * DOM要素の順序をデータ配列の順序に合わせて並び替える
   * @param {string} listId - リストID
   * @param {Array} sortedDataArray - ソート済みのデータ配列
   */
  reorderDOMElements(listId, sortedDataArray) {
    console.log(`[reorderDOMElements] Starting DOM reorder for ${listId}`);
    
    // シンプルにリフレッシュを呼び出してみる（テスト用）
    // 実際には、この時点でソート済みの配列が保存されているので、
    // リフレッシュすればソート結果が反映されるはず
    console.log(`[reorderDOMElements] TODO: Implement proper DOM reordering`);
    console.log(`[reorderDOMElements] For now, data is sorted but DOM needs manual refresh`);
  }

}

// グローバルに公開
if (typeof window !== "undefined") {
  window.PromptListManager = PromptListManager;
  window.STANDARD_CATEGORY_FIELDS = STANDARD_CATEGORY_FIELDS;
  window.STANDARD_BUTTONS = STANDARD_BUTTONS;
  window.FAVORITE_FIELDS = FAVORITE_FIELDS;
  window.FAVORITE_BUTTONS = FAVORITE_BUTTONS;
}
