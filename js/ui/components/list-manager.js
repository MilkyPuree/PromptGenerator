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
    title: "プロンプト入力欄に追加",
  },
  {
    type: "copy",
    getValue: (item) => item.prompt,
    title: "クリップボードにコピー",
  },
  {
    type: "favorite",
    getValue: (item) => ({
      title: item.data?.[2] || "",
      prompt: item.prompt || "",
    }),
    title: "お気に入りリストに追加",
  },
  {
    type: "generate",
    getValue: (item) => item.prompt,
    title: "重み最大(10)でGenerate実行",
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
    title: "プロンプトとして読み込み",
  },
  {
    type: "copy",
    getValue: (item) => item.prompt,
    title: "クリップボードにコピー",
  },
  {
    type: "generate",
    getValue: (item) => item.prompt,
    title: "このプロンプトでテスト生成",
  },
  {
    type: "delete",
    title: "お気に入りから削除",
  },
];

const LIST_TYPE_CONFIGS = {
  favorite: {
    fields: FAVORITE_FIELDS,
    buttons: FAVORITE_BUTTONS,
    sortable: true,
    listType: "favorite",
    scrollRestoreDelay: 100,
  },
  local: {
    fields: STANDARD_CATEGORY_FIELDS,
    buttons: [...STANDARD_BUTTONS, { type: "delete" }],
    sortable: true,
    listType: "add",
    scrollRestoreDelay: 100,
  },
  search: {
    fields: STANDARD_CATEGORY_FIELDS,
    buttons: STANDARD_BUTTONS,
    sortable: false,
    listType: "search",
  },
  master: {
    fields: STANDARD_CATEGORY_FIELDS,
    buttons: STANDARD_BUTTONS,
    sortable: false,
    readonly: true,
    useVirtualization: true,
    itemHeight: 35,
    containerHeight: 400,
    buffer: 10,
    scrollRestoreDelay: 100,
  },
  duplicateCheck: {
    fields: STANDARD_CATEGORY_FIELDS,
    buttons: [{ type: "delete" }],
    sortable: false,
    listType: "duplicate-check",
  },
};

class PromptListManager {
  constructor() {
    this.virtualLists = new Map(); // コンテナIDごとの仮想リストインスタンス管理
    this.refreshingLists = new Set(); // 現在リフレッシュ中のリストを追跡
    this.listConfigs = new Map(); // リスト設定の保存（リフレッシュ用）
    this.sortStates = new Map(); // 各リストのソート状態を管理 {column: string, direction: 'asc'|'desc'}
  }

  /**
   * 要素から最も近いflexible-list-containerを取得
   * @param {Element} element - 起点となる要素
   * @returns {Element|null} flexible-list-container要素、見つからない場合はnull
   */
  getFlexibleContainer(element) {
    if (!element) return null;
    return (
      element.closest(".flexible-list-container") ||
      (element.classList.contains("flexible-list-container") ? element : null)
    );
  }

  async saveLocalListImmediate() {
    try {
      await saveLocalList(true);
    } catch (error) {}
  }

  updateRegisterButtonState(listId, elementId) {
    try {
      const listElement = this.findListElement(listId, elementId);
      if (!listElement) {
        return false;
      }

      const regButton = listElement.querySelector('button[data-action="register"]');
      if (!regButton) {
        return false;
      }

      const promptInput = listElement.querySelector('input[data-field="prompt"], textarea[data-field="prompt"]');
      const promptValue = promptInput ? promptInput.value : "";

      if (promptValue && typeof isPromptInDictionary === "function") {
        const existsInDictionary = isPromptInDictionary(promptValue);

        regButton.disabled = existsInDictionary;
        regButton.title = existsInDictionary ? "既に登録済みのため登録できません" : "ローカル辞書に登録";

        if (existsInDictionary) {
          regButton.classList.add("button-disabled");
          regButton.setAttribute("disabled", "true");
        } else {
          regButton.classList.remove("button-disabled");
          regButton.removeAttribute("disabled");
          regButton.disabled = false;
        }

        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  findListElement(listId, itemId) {
    const cleanListId = listId.replace("#", "");

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
        return element;
      }
    }

    return null;
  }

  updateSingleElement(listId, elementIdentifier, updates, options = {}) {
    const config = {
      preserveFocus: true,
      preventEvents: true,
      searchMode: "auto",
      ...options,
    };

    try {
      let focusState = null;
      if (config.preserveFocus) {
        focusState = this.saveFocusState();
      }

      const domElement = this.findDomElement(listId, elementIdentifier, config.searchMode);
      if (!domElement) return false;

      let updateSuccess = true;
      for (const [fieldType, newValue] of Object.entries(updates)) {
        if (!this.updateSingleField(domElement, fieldType, newValue, config)) {
          updateSuccess = false;
        }
      }

      if (config.preserveFocus && focusState) {
        this.restoreFocusState(focusState);
      }

      return updateSuccess;
    } catch (error) {
      return false;
    }
  }

  // スクロール位置管理は list-scroll-manager.js に分離
  // saveScrollPosition, restoreScrollPosition

  saveListConfig(listId, config) {
    if (!this.listConfigs) {
      this.listConfigs = new Map();
    }
    this.listConfigs.set(listId, config);
  }

  getListConfig(listId) {
    if (!this.listConfigs) {
      return null;
    }
    return this.listConfigs.get(listId) || null;
  }

  findDomElement(listId, identifier, searchMode = "auto") {
    let domElement = null;

    if (searchMode === "auto" || searchMode === "id") {
      // FlexibleListが生成したIDで検索
      domElement = document.querySelector(`${listId} [data-element-id="${identifier}"]`);
      if (domElement) return domElement;

      // 見つからない場合、data-original-idで検索（スロット要素のIDとの対応）
      domElement = document.querySelector(`${listId} [data-original-id="${identifier}"]`);
      if (domElement) return domElement;
    }

    if (searchMode === "auto" || searchMode === "index") {
      const dataRows = document.querySelectorAll(`${listId} li:not(.prompt-list-header)`);
      if (typeof identifier === "number" && identifier >= 0 && identifier < dataRows.length) {
        return dataRows[identifier];
      }
    }

    return null;
  }

  updateSingleField(domElement, fieldType, newValue, config) {
    try {
      let selectorClass = FIELD_TYPE_SELECTORS[fieldType];

      if (!selectorClass) {
        if (fieldType.startsWith(".") || fieldType.startsWith("#")) {
          selectorClass = fieldType;
        } else {
          return false;
        }
      }

      const targetInput = domElement.querySelector(selectorClass);
      if (!targetInput) {
        return false;
      }

      if (config.preventEvents) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        if (descriptor && descriptor.set) descriptor.set.call(targetInput, newValue);
        else targetInput.value = newValue;
      } else {
        targetInput.value = newValue;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

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

  restoreFocusState(focusState) {
    if (focusState && focusState.elementId) {
      const element = document.getElementById(focusState.elementId);
      if (element && element.tagName === "INPUT") {
        try {
          element.focus();
          if (typeof focusState.selectionStart === "number" && typeof focusState.selectionEnd === "number") {
            element.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
          }
        } catch (error) {}
      }
    }
  }

  async createFlexibleList(data, listId, config = {}) {
    if (this.refreshingLists.has(listId)) {
      return;
    }
    this.refreshingLists.add(listId);

    try {
      const dynamicHeight = this.calculateOptimalContainerHeight(data.length, config.itemHeight || 40);

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
        onAdd: null,
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

      finalConfig._totalItems = data.length;

      this.saveListConfig(listId, finalConfig);

      if (finalConfig.header) {
        return await this.createFlexibleListWithHeader(data, listId, finalConfig);
      }

      const shouldUseVirtualScroll = this.shouldUseVirtualScroll(data.length, finalConfig.virtualScroll);

      let result;
      if (shouldUseVirtualScroll) {
        result = await this.createVirtualScrollList(data, listId, finalConfig);
      } else {
        result = await this.createStandardList(data, listId, finalConfig);
      }

      return result;
    } finally {
      this.refreshingLists.delete(listId);
    }
  }

  async createFlexibleListWithHeader(data, listId, config) {
    // jQuery → Vanilla JS 置換 (Phase 8)
    const container = document.querySelector(listId);
    if (!container) {
      return;
    }

    container.innerHTML = "";

    // jQuery → Vanilla JS 置換 (Phase 8)
    container.classList.add("flexible-list-container");

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

    // jQuery → Vanilla JS 置換 (Phase 8)
    container.innerHTML = headerHtml;

    const newListId = `#${cleanListId}-list`;
    let containerHeight = "auto";

    if (config.maxItems && typeof config.maxItems === "number") {
      containerHeight = this.calculateOptimalContainerHeight(data.length, 40, {
        maxItems: config.maxItems,
        minItems: 1,
        headerHeight: 0, // ヘッダーは別途存在するので除外
        padding: 8,
      });
    }

    const listConfig = {
      ...config,
      header: null,
      containerHeight: config.containerHeight || containerHeight,
    };
    const shouldUseVirtualScroll = this.shouldUseVirtualScroll(data.length, listConfig.virtualScroll);

    if (containerHeight !== "auto") {
      const contentContainer = document.querySelector(`${listId} .flexible-list-content`);
      if (contentContainer) {
        contentContainer.style.maxHeight = `${containerHeight}px`;
        contentContainer.style.overflowY = "auto";
      }
    }

    let result;
    if (shouldUseVirtualScroll) {
      result = await this.createVirtualScrollList(data, newListId, listConfig);
    } else {
      result = await this.createStandardList(data, newListId, listConfig);
    }

    this.setupButtonToggle(listId, cleanListId);

    return result;
  }

  calculateOptimalContainerHeight(dataLength, itemHeight = 40, options = {}) {
    const minItems = options.minItems || 1; // 最小表示行数
    const maxItems = options.maxItems || VIRTUAL_SCROLL.MAX_VISIBLE_ITEMS; // 最大表示行数
    const headerHeight = options.headerHeight || 42; // ヘッダー分の高さ
    const padding = options.padding || 4; // パディング分を少し縮小

    let visibleItems;
    if (dataLength === 0) {
      visibleItems = 0;
    } else {
      visibleItems = Math.max(minItems, Math.min(dataLength, maxItems));
    }

    const contentHeight = visibleItems * itemHeight;
    const totalHeight = contentHeight + headerHeight + padding;

    return totalHeight;
  }

  shouldUseVirtualScroll(dataLength, virtualScrollConfig) {
    if (virtualScrollConfig === true || virtualScrollConfig === false) {
      return virtualScrollConfig;
    }

    if (virtualScrollConfig && typeof virtualScrollConfig === "object") {
      if (virtualScrollConfig.useVirtualization !== undefined) {
        return virtualScrollConfig.useVirtualization;
      }
    }

    // マスター辞書（8000件以上）には仮想スクロールが必要
    return dataLength >= VIRTUAL_SCROLL.THRESHOLD;
  }

  // @deprecated - 保守性向上のため、常に仮想スクロールを使用
  async createStandardList(data, listId, finalConfig) {
    ListBuilder.clearList(listId);

    const headers = finalConfig.headers || this.generateHeaders(finalConfig.fields, finalConfig.buttons);
    const columnTypes = this.generateColumnTypes(finalConfig.fields, finalConfig.buttons);
    ListBuilder.createHeaders(listId, headers, columnTypes || null, finalConfig.sortable, finalConfig.headerClickSort);

    if (data.length === 0) {
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

    const container = document.querySelector(listId);
    if (container) {
      container.classList.add("prompt-list-container");
      if (finalConfig.sortable) {
        container.classList.add("sortable-list");
      }
      const isEditTabAvoidDoubleScroll = listId.includes("edit") || listId.includes("Edit");
      if (!isEditTabAvoidDoubleScroll && finalConfig.containerHeight !== "auto") {
        container.style.maxHeight = `${finalConfig.containerHeight}px`;
      }
    }

    finalConfig._allItems = data;

    for (let i = 0; i < data.length; i++) {
      const itemId = data[i]?.id !== undefined ? data[i].id : i;
      const $li = UIFactory.createListItem({
        id: finalConfig.sortable ? itemId : undefined,
        sortable: finalConfig.sortable,
      });

      await this.createFlexibleItem($li, data[i], i, finalConfig);
      // containerは行743で取得済み（ループ内での再取得を削減）
      if (container) {
        container.appendChild($li);
      }
    }

    if (finalConfig.sortable && finalConfig.onSort) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          EventHandlers.setupSortableList(listId, finalConfig.onSort);
        }, 100);
      });
    }
  }

  async createVirtualScrollList(data, listId, finalConfig) {
    const container = document.querySelector(listId);
    if (!container) {
      throw new Error(`Container not found: ${listId}`);
    }

    const containerId = listId;
    if (this.virtualLists.has(containerId)) {
      this.virtualLists.get(containerId).destroy();
      this.virtualLists.delete(containerId);
    }

    container.innerHTML = "";
    container.classList.add("prompt-list-container");

    if (finalConfig.sortable) {
      container.classList.add("sortable-list");
    }

    container.style.maxHeight = `${finalConfig.containerHeight}px`;

    const headers = finalConfig.headers || this.generateHeaders(finalConfig.fields, finalConfig.buttons);
    const columnTypes = this.generateColumnTypes(finalConfig.fields, finalConfig.buttons);
    ListBuilder.createHeaders(listId, headers, columnTypes || null, finalConfig.sortable, finalConfig.headerClickSort);

    if (data.length === 0) {
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

    data.forEach((item, index) => {
      if (!item.id) {
        const listType = finalConfig?.listType || "virtual";
        item.id = `${listType}-${index}-${Date.now()}`;
      }
    });

    const virtualList = new VirtualList(virtualListOptions);
    virtualList.init();
    await virtualList.setData(data);

    this.virtualLists.set(containerId, virtualList);

    const viewport = container.querySelector(DOM_SELECTORS.BY_CLASS.VIRTUAL_VIEWPORT);
    if (viewport) {
      viewport._virtualList = virtualList;
    }

    setTimeout(() => {
      this.adjustHeaderForScrollbar(listId);
    }, UI_DELAYS.REFRESH_DELAY);

    if (finalConfig.sortable && finalConfig.onSort) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          EventHandlers.setupSortableList(listId, finalConfig.onSort);
        }, UI_DELAYS.SLOW_UPDATE);
      });
    }

    return virtualList;
  }

  async createVirtualListItem(element, item, index, config) {
    // jQuery → Vanilla JS 置換 (Phase 8)
    const $element = element;

    while ($element.firstChild) {
      $element.removeChild($element.firstChild);
    }

    // jQuery → Vanilla JS 置換 (Phase 8)
    $element.classList.add("prompt-list-item-virtual");

    await this.createFlexibleItem($element, item, index, config);

    // jQuery → Vanilla JS 置換 (Phase 8)
    Object.assign($element.style, {
      height: `${config.itemHeight}px`,
      minHeight: `${config.itemHeight}px`,
      maxHeight: `${config.itemHeight}px`,
      boxSizing: "border-box",
    });
  }

  async updateVirtualListItem(element, item, index, config) {
    const hasInputFields = element.querySelectorAll("input, select").length > 0;

    if (hasInputFields && this.tryUpdateExistingFields(element, item, config)) {
      return;
    }

    await this.createVirtualListItem(element, item, index, config);
  }

  tryUpdateExistingFields(element, item, config) {
    try {
      const fields = config.fields || STANDARD_CATEGORY_FIELDS;
      let updateSuccess = true;

      fields.forEach((field, fieldIndex) => {
        const input = element.querySelector(`[data-field="${field.key}"]`);
        if (input) {
          const newValue = this.getFieldValue(item, field);

          if (input.value !== newValue) {
            input.value = newValue;
          }
        } else {
          updateSuccess = false;
        }
      });

      return updateSuccess;
    } catch (error) {
      return false;
    }
  }

  initializeDropdownOnDemand(input, dropdownConfig) {
    input._lazyDropdownConfig = dropdownConfig;
    input.setAttribute("data-dropdown-lazy", "true");

    let isVisible = true; // デフォルトは表示状態

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (!isVisible && input._pendingInit) {
            clearTimeout(input._pendingInit);
            input._pendingInit = null;
          }
        });
      },
      { threshold: 0.1 }
    ); // 10%見えていれば表示中とみなす

    observer.observe(input);
    input._intersectionObserver = observer;

    const initializeDropdown = () => {
      if (!input.customDropdown && input._lazyDropdownConfig) {
        if (!isVisible) {
          input._pendingInit = setTimeout(() => {
            if (input._lazyDropdownConfig) {
              initializeDropdown();
            }
          }, 100); // 100ms後に再チェック
          return;
        }

        input.customDropdown = new CustomDropdown(input, input._lazyDropdownConfig);
        input.removeAttribute("data-dropdown-lazy");

        input._lazyDropdownConfig = null;
        if (input._initializeDropdownHandler) {
          input.removeEventListener("focus", input._initializeDropdownHandler);
          input.removeEventListener("click", input._initializeDropdownHandler);
          input._initializeDropdownHandler = null;
        }

        if (input._intersectionObserver) {
          input._intersectionObserver.disconnect();
          input._intersectionObserver = null;
        }
      }

      if (input.customDropdown) {
        setTimeout(() => input.focus(), 0);
      }
    };

    if (input._initializeDropdownHandler) {
      input.removeEventListener("focus", input._initializeDropdownHandler);
      input.removeEventListener("click", input._initializeDropdownHandler);
    }

    input._initializeDropdownHandler = initializeDropdown;
    input.addEventListener("focus", initializeDropdown, { once: false });
    input.addEventListener("click", initializeDropdown, { once: false });
  }

  adjustHeaderForScrollbar(listId) {
    const viewport = document.querySelector(`${listId} .virtual-list-viewport`);
    const header = document.querySelector(`${listId} .prompt-list-header`);

    if (viewport && header) {
      const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
      const hasScrollbar = scrollbarWidth > 0;

      let spacer = header.querySelector(".header-scrollbar-spacer");

      if (hasScrollbar && !spacer) {
        spacer = UIFactory.createDiv({
          className: "header-scrollbar-spacer",
        });
        header.appendChild(spacer);
      } else if (!hasScrollbar && spacer) {
        spacer.remove();
      }
    }
  }

  getVirtualList(containerId) {
    return this.virtualLists.get(containerId) || null;
  }

  destroyAllVirtualLists() {
    for (const [containerId, virtualList] of this.virtualLists) {
      virtualList.destroy();
    }
    this.virtualLists.clear();
  }

  getVirtualListStats() {
    const stats = {};
    for (const [containerId, virtualList] of this.virtualLists) {
      stats[containerId] = virtualList.getStats();
    }
    return stats;
  }

  generateHeaders(fields, buttons) {
    const headers = [];

    fields.forEach((field, index) => {
      const headerLabel = field.label || field.key || "フィールド";
      headers.push(headerLabel);
    });

    if (typeof buttons === "function") {
      headers.push("Del", "Reg");
    } else {
      buttons.forEach((button, index) => {
        const buttonLabel = button.label || this.getButtonLabel(button.type);
        headers.push(buttonLabel);
      });
    }

    return headers;
  }

  generateColumnTypes(fields, buttons) {
    const columnTypes = {};
    let index = 0;

    fields.forEach((field, fieldIndex) => {
      const columnType = this.getFieldColumnType(field.type);
      columnTypes[index] = columnType;
      index++;
    });

    if (typeof buttons === "function") {
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

    return columnTypes;
  }

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

  createEmptyState(listId, type = "default", options = {}) {
    const container = document.querySelector(listId);
    if (!container) {
      return;
    }

    let contentArea = container.querySelector(".flexible-list-content, .search-results-content");
    if (!contentArea) {
      contentArea = container;
    }

    contentArea.innerHTML = "";

    const emptyStateDiv = UIFactory.createDiv({
      className: "empty-state-message",
    });

    const stateData = EMPTY_STATE_MESSAGES[type] || EMPTY_STATE_MESSAGES.default;
    const { message, icon } = stateData;

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
                const current = slot.currentExtraction ? `現在: ${slot.currentExtraction}` : "抽出待機中";
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
  }

  async createFlexibleItem($li, item, index, config) {
    const inputs = [];

    // jQuery → Vanilla JS 置換 (Phase 8) - UIFactoryがVanilla JSを返すようになったため
    $li.classList.add("prompt-list-item");

    const idOffset = config?.idOffset || 0;

    // 元のIDを保存（スロット要素との対応付けに使用）
    if (item.id !== undefined && item.id !== null) {
      item.originalId = item.id;
    }

    const needsIdGeneration =
      item.id === undefined ||
      item.id === null ||
      (idOffset > 0 && (item.id < idOffset || item.id >= idOffset + 10000));

    if (needsIdGeneration) {
      if (!config._idCounter) {
        config._idCounter = idOffset;
        if (config._allItems) {
          for (const existingItem of config._allItems) {
            const eid = existingItem?.id;
            if (typeof eid === "number" && eid >= idOffset && eid < idOffset + 10000 && eid >= config._idCounter) {
              config._idCounter = eid;
            }
          }
        }
      }

      item.id = ++config._idCounter;
    }

    $li.setAttribute("data-element-id", item.id);
    // 元のIDも保存（スロット要素との対応付けに使用）
    if (item.originalId !== undefined) {
      $li.setAttribute("data-original-id", item.originalId);
    }

    const configReadonly = typeof config.readonly === "function" ? config.readonly(item) : config.readonly;
    const isItemReadonly = configReadonly || false;

    let hasReadonlyField = false;

    config.fields.forEach((field, fieldIndex) => {
      const value = this.getFieldValue(item, field);

      const fieldReadonly = typeof field.readonly === "function" ? field.readonly(item) : field.readonly;
      const isReadonly = isItemReadonly || fieldReadonly || false;

      if (fieldReadonly) {
        hasReadonlyField = true;
      }

      const fieldTooltip = this.getFieldTooltip(field);

      const fieldValue = field.type === "weight" ? (value !== undefined && value !== null ? value : "") : value || "";

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
          const isPromptField = field.type === "prompt";
          const isSmallCategoryField = field.key === "data.2"; // 小項目フィールド

          if (!isPromptField && !isSmallCategoryField) {
            this.handleFieldChange(item, index, field, newValue, config);
          }
        },
        onBlur: (e) => this.handleFieldBlur(e, field, item, index, config),
        onChange:
          field.type === "weight" && config.listType === "edit"
            ? (e) => this.handleFieldChange(item, index, field, e.target.value, config)
            : undefined,
        onKeydown: (e) => {
          if (e.key === "Enter" && this.handleEnterKeyForField(e, field, item, index, config)) {
            return;
          }
          if (field.type === "weight" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            this.handleWeightArrowKey(e, field, item, index, config);
          }
        },
        placeholder: field.placeholder || "",
      });

      // jQuery → Vanilla JS 置換 (Phase 8) - UIFactoryがVanilla JSを返すようになったため
      $input.classList.add("prompt-list-input");

      if (isReadonly) {
        $input.classList.add("readonly-field");
      }

      // jQuery → Vanilla JS 置換 (Phase 8)
      if (field.type === "category") {
        $input.classList.add("flex-col-category");
      } else if (field.type === "prompt") {
        $input.classList.add("flex-col-prompt");
      } else if (field.type === "weight") {
        $input.classList.add("flex-col-weight"); // 重み専用クラス (80px)

        if (!isReadonly) {
          const inputElement = $input[0] || $input;
          const wheelHandler = (e) => {
            e.preventDefault();

            const currentValue = parseFloat(inputElement.value) || 0;
            let delta = config.weightDelta || WEIGHT_CONFIG.DELTA;

            if (e.shiftKey) {
              delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
            } else if (e.ctrlKey) {
              delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
            }

            let newValue = e.deltaY < 0 ? currentValue + delta : currentValue - delta;

            newValue = Math.round(newValue * 1000) / 1000;

            if (config.weightMin !== undefined && config.weightMax !== undefined) {
              newValue = Math.max(config.weightMin, Math.min(config.weightMax, newValue));
            }

            inputElement.value = newValue;
            this.handleFieldChange(item, index, field, newValue, config);
          };

          inputElement._wheelHandler = wheelHandler;
          inputElement.addEventListener("wheel", wheelHandler, {
            passive: false,
          });
        }
      }

      // 後方互換性のため旧クラスも追加
      $input.classList.add("promptData");

      if (Validators.Quick.hasValue(value)) {
        $input.setAttribute("title", value.toString().trim());
      }

      if (field.attributes) {
        Object.entries(field.attributes).forEach(([attr, attrValue]) => {
          $input.setAttribute(attr, attrValue);
        });
      }

      inputs.push($input);
      $li.appendChild($input);
    });

    if (isItemReadonly) {
      $li.classList.add("readonly");
    }

    const buttons = typeof config.buttons === "function" ? config.buttons(item) : config.buttons;
    buttons.forEach((buttonDef) => {
      const button = this.createFlexibleButton(buttonDef, item, index, config);
      if (button) {
        button.classList.add("flex-col-button");
        $li.appendChild(button);
      }
    });

    if (typeof config.dropdownCount === "function") {
      config.dropdownCount(inputs, item, index);
    } else if (config.dropdownCount === true || this.hasCategoryFields(config.fields)) {
      this.setupStandardCategoryChain(inputs, item, config);
    }

    if (config.setupSpecialFeatures) {
      config.setupSpecialFeatures($li, inputs, item, index);
    }
  }

  getFieldValue(item, field) {
    if (typeof field.getValue === "function") {
      return field.getValue(item);
    }

    if (typeof field.key === "string") {
      return field.key.split(".").reduce((obj, key) => obj?.[key], item);
    }

    if (typeof field.key === "function") {
      return field.key(item);
    }

    return item[field.key] || "";
  }

  getFieldTooltip(field) {
    if (field.type === "category") {
      return FIELD_TOOLTIPS.category[field.key] || "";
    }
    return FIELD_TOOLTIPS[field.type] || "";
  }

  findLocalPromptIndex(itemId) {
    if (itemId === undefined || itemId === null) return -1;

    return AppState.data.localPromptList.findIndex((prompt, idx) => {
      if (prompt.id !== undefined && prompt.id === itemId) return true;
      if (typeof itemId === "string" && prompt.id !== undefined && prompt.id.toString() === itemId) return true;
      if (typeof itemId === "number" && idx === itemId) return true;
      if (typeof itemId === "string" && idx.toString() === itemId) return true;
      // dict-local-プレフィックスはユーザー辞書のDOM要素ID形式
      if (typeof itemId === "string" && itemId.startsWith("dict-local-")) {
        const extractedIndex = parseInt(itemId.replace("dict-local-", ""));
        if (!isNaN(extractedIndex) && extractedIndex === idx) return true;
      }
      return false;
    });
  }

  updateLocalPromptCategory(index, dataIndex, value) {
    if (index !== -1 && AppState.data.localPromptList[index]) {
      AppState.data.localPromptList[index].data[dataIndex] = value;
      this.saveLocalListImmediate();
    }
  }

  getDataIndexFromFieldKey(fieldKey) {
    const mapping = { "data.0": 0, "data.1": 1, "data.2": 2 };
    return mapping[fieldKey];
  }

  updateLocalPromptByFieldKey(elementId, fieldKey, value) {
    const dataIndex = this.getDataIndexFromFieldKey(fieldKey);
    if (dataIndex === undefined) return;
    const actualIndex = this.findLocalPromptIndex(elementId);
    this.updateLocalPromptCategory(actualIndex, dataIndex, value);
  }

  handleFieldBlur(e, field, item, index, config) {
    const newValue = e.target.value;
    const isEditMode = config.listType === "edit";

    if (field.type === "weight" && isEditMode) {
      const currentWeight = this.getFieldValue(item, field);
      if (String(newValue) === String(currentWeight)) return;
      this.handleFieldChange(item, index, field, newValue, config, "blur");
      return;
    }

    if (field.type === "prompt" || field.key === "data.2") {
      const currentValue = this.getFieldValue(item, field);
      if (newValue === currentValue) {
        return;
      }

      if (isEditMode && item?.id !== undefined && window.categoryDataSync) {
        const latestData = window.categoryDataSync.getCurrentDOMValues(item.id);
        if (latestData) {
          item.data = [...latestData];
        }
      }
      this.handleFieldChange(item, index, field, newValue, config, "blur");
      if (isEditMode && config.onPromptSave) {
        config.onPromptSave(newValue, item, index);
      }
      return;
    }

    if (field.type === "category" && (config.categoryChainBehavior?.focusNext || field.key === "title")) {
      this.handleCategoryBlur(e, field, item, index, config, newValue);
    }
  }

  handleCategoryBlur(e, field, item, index, config, newValue) {
    if (e.target.getAttribute("data-dropdown-enabled")) return;

    const currentValue = this.getFieldValue(item, field);
    if (newValue === currentValue) return;

    this.handleFieldChange(item, index, field, newValue, config, "blur");

    if (config.listType === "add") {
      const listItem = e.target.closest("li");
      const dataElementId = listItem?.getAttribute("data-element-id");
      if (dataElementId) {
        this.updateLocalPromptByFieldKey(dataElementId, field.key, newValue);
      }
    }
  }

  handleEnterKeyForField(e, field, item, index, config) {
    e.preventDefault();
    e.stopPropagation();

    if (field.type === "prompt" || field.key === "data.2" || (field.type === "weight" && config.listType === "edit")) {
      e.target.blur();
      return true;
    }

    if (field.type === "category" && (config.categoryChainBehavior?.focusNext || field.key === "title")) {
      if (e.target.getAttribute("data-dropdown-enabled")) return true;

      const newValue = e.target.value;
      const currentValue = this.getFieldValue(item, field);

      if (newValue !== currentValue) {
        this.handleFieldChange(item, index, field, newValue, config, "enter");
        if (config.listType === "add") {
          const listItem = e.target.closest("li");
          const dataElementId = listItem?.getAttribute("data-element-id");
          if (dataElementId) {
            this.updateLocalPromptByFieldKey(dataElementId, field.key, newValue);
          }
        }
      }

      const currentLevel = this.getDataIndexFromFieldKey(field.key) || 0;
      const listItem = e.target.closest("li");
      if (listItem) {
        const categoryInputs = listItem.querySelectorAll(".flex-col-category");
        const promptInput = listItem.querySelector(".flex-col-prompt");
        const allInputs = [...categoryInputs, promptInput].filter(Boolean);
        this.focusNextCategoryInput(currentLevel, allInputs, config);
      }
      return true;
    }
    return false;
  }

  handleWeightArrowKey(e, field, item, index, config) {
    e.preventDefault();
    const currentValue = parseFloat(e.target.value) || 0;
    let delta = config.weightDelta || WEIGHT_CONFIG.DELTA;

    if (e.shiftKey) {
      delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
    } else if (e.ctrlKey) {
      delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
    }

    let newValue = e.key === "ArrowUp" ? currentValue + delta : currentValue - delta;
    newValue = Math.round(newValue * 1000) / 1000;

    e.target.value = newValue;
    this.handleFieldChange(item, index, field, newValue, config);
  }

  handleFieldChange(item, index, field, newValue, config, eventType = "input") {
    if (field.onChange) {
      field.onChange(newValue, item, index);
    }

    if ((eventType === "blur" || eventType === "enter") && config.onEnterBlurChange) {
      config.onEnterBlurChange(index, field.key, newValue, item, eventType);
    }

    // カテゴリフィールドの場合、カスタムドロップダウンが直接保存を処理するため
    // 従来の汎用フィールド変更コールバック（後方互換性維持）
    if (config.onFieldChange) {
      config.onFieldChange(index, field.key, newValue, item, eventType);
    }

    if (field.type === "category" && config.onFieldCategoryChange) {
      config.onFieldCategoryChange(index, field.key, newValue, item);
    }
  }

  createFlexibleButton(buttonDef, item, index, config) {
    const type = buttonDef.type;
    const defaults = FLEXIBLE_BUTTON_DEFINITIONS[type] || {};

    const baseConfig = {
      text: buttonDef.text || defaults.text || type,
      title: buttonDef.title || defaults.title || type,
      dataAction: defaults.dataAction || type,
    };

    switch (type) {
      case "add":
        // Addボタン: 現在のスロットの末尾に要素を追加
        return UIFactory.createButton({
          ...baseConfig,
          onClick: async () => {
            const value = buttonDef.getValue ? buttonDef.getValue(item) : "";
            if (config.onAdd) {
              config.onAdd(value, item, index);
            } else {
              // スロットに直接追加
              if (window.promptSlotManager) {
                const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
                if (currentSlot) {
                  if (!currentSlot.elements) {
                    currentSlot.elements = [];
                  }
                  const newElement = {
                    id: Date.now(),
                    sort: currentSlot.elements.length,
                    Value: value,
                    data: ["", "", ""],
                  };
                  currentSlot.elements.push(newElement);

                  await SlotUtils.regenerateAndSaveSlot();
                }
              }
            }
          },
        });

      case "copy":
        return UIFactory.createButton({
          ...baseConfig,
          onClick: () => {
            const value = buttonDef.getValue ? buttonDef.getValue(item) : "";
            if (config.onCopy) {
              config.onCopy(value, item, index);
            } else {
              navigator.clipboard.writeText(value);
            }
          },
        });

      case "delete":
        const deleteConfig = {
          containerId: config.containerId,
          listType: config.listType,
          onDelete: config.onDelete,
          refreshCallback: config.refreshCallback,
        };

        const capturedIndex = index;
        const capturedItem = item;

        return UIFactory.createButton({
          ...baseConfig,
          onClick: async () => {
            const shouldDelete =
              !AppState.userSettings.optionData?.isDeleteCheck || window.confirm("本当に削除しますか？");

            if (shouldDelete && deleteConfig.onDelete) {
              let savedScrollPosition = null;
              if (deleteConfig.refreshCallback && typeof deleteConfig.refreshCallback === "function") {
                savedScrollPosition = this.saveScrollPosition(deleteConfig.containerId);
              }

              let deleteResult;
              try {
                deleteResult = await deleteConfig.onDelete(capturedIndex, capturedItem);
              } catch (error) {
                return;
              }

              if (deleteResult === false) {
                return;
              }

              if (
                deleteConfig.refreshCallback &&
                typeof deleteConfig.refreshCallback === "function" &&
                savedScrollPosition !== null
              ) {
                const originalConfig = this.getListConfig(deleteConfig.containerId);
                if (originalConfig) {
                  originalConfig.autoPreserveScroll = false;
                }
                try {
                  const container = document.querySelector(deleteConfig.containerId);
                  const currentScrollTop = container ? container.scrollTop : 0;
                  await deleteConfig.refreshCallback();
                  if (originalConfig) {
                    originalConfig.autoPreserveScroll = true;
                  }
                } catch (error) {
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
          ...baseConfig,
          onClick: async () => {
            const value = buttonDef.getValue ? buttonDef.getValue(item) : "";
            if (config.onLoad) {
              config.onLoad(value, item, index);
            } else {
              const input = document.getElementById(DOM_IDS.PROMPT.GENERATE);
              if (input) {
                input.value = value;
              }

              // スロットに保存
              if (window.promptSlotManager) {
                const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
                if (currentSlot) {
                  currentSlot.prompt = value;
                  window.promptSlotManager.saveCurrentSlot();
                }
              }

              savePrompt();
            }
          },
        });

      case "favorite":
        return UIFactory.createButton({
          ...baseConfig,
          onClick: async () => {
            const favoriteData = buttonDef.getValue
              ? buttonDef.getValue(item)
              : { title: "", prompt: item.prompt || "" };

            if (config.onFavorite) {
              config.onFavorite(favoriteData, item, index);
            } else {
              try {
                await this.addToFavoriteList(favoriteData);
                UIHelpers.notifySuccess("お気に入りに追加しました", NOTIFICATION_DURATION.SHORT);
              } catch (error) {
                UIHelpers.notifyError("お気に入りの追加に失敗しました", NOTIFICATION_DURATION.STANDARD);
              }
            }
          },
        });

      case "generate":
        return UIFactory.createButton({
          ...baseConfig,
          onClick: async () => {
            const prompt = buttonDef.getValue ? buttonDef.getValue(item) : item.prompt;
            if (config.onGenerate) {
              config.onGenerate(prompt, item, index);
            } else {
              await this.executeDirectGenerateWithMaxWeight(prompt);

              UIHelpers.notifySuccess("重み最大でテスト生成を実行しました", 1500);
            }
          },
        });

      case "register":
        const isLocalItem = item._source === "local";
        let isEnabled;
        if (buttonDef.enabled !== undefined) {
          isEnabled = typeof buttonDef.enabled === "function" ? buttonDef.enabled(item) : buttonDef.enabled;
        } else {
          isEnabled = !isLocalItem;
        }

        let registerDisabledTitle = defaults.disabledTitle || "この項目は登録できません";
        if (buttonDef.disabledTitle) {
          registerDisabledTitle =
            typeof buttonDef.disabledTitle === "function" ? buttonDef.disabledTitle(item) : buttonDef.disabledTitle;
        }

        return UIFactory.createButton({
          ...baseConfig,
          title: isEnabled ? (isLocalItem ? "登録済み項目" : baseConfig.title) : registerDisabledTitle,
          enabled: isEnabled,
          disabledTitle: registerDisabledTitle,
          onClick: isEnabled
            ? () => {
                if (config.onRegister) {
                  config.onRegister(item.prompt, item, index);
                } else if (config.onRegistration) {
                  config.onRegistration(item, index);
                }
              }
            : null,
        });

      case "moveUp":
        const isFirstItem = index === 0;
        return UIFactory.createButton({
          ...baseConfig,
          title: isFirstItem ? defaults.disabledTitle || "これ以上上に移動できません" : baseConfig.title,
          enabled: !isFirstItem,
          onClick: isFirstItem
            ? null
            : async () => {
                if (config.onMove) {
                  await config.onMove(index, "up", item);
                }
              },
        });

      case "moveDown":
        const totalItems = config._totalItems || 0;
        const isLastItem = index === totalItems - 1;
        return UIFactory.createButton({
          ...baseConfig,
          title: isLastItem ? defaults.disabledTitle || "これ以上下に移動できません" : baseConfig.title,
          enabled: !isLastItem,
          onClick: isLastItem
            ? null
            : async () => {
                if (config.onMove) {
                  await config.onMove(index, "down", item);
                }
              },
        });

      default:
        if (buttonDef.onClick) {
          return UIFactory.createButton({
            ...baseConfig,
            onClick: () => buttonDef.onClick(item, index),
          });
        }
        return null;
    }
  }

  async addToFavoriteList(favoriteData) {
    const { title, prompt } = favoriteData;

    if (!prompt) {
      throw new Error("プロンプトが入力されていません");
    }

    const currentDictId = AppState.data.currentPromptDictionary || "main";
    const currentDict = AppState.data.promptDictionaries?.[currentDictId];

    if (!currentDict) {
      throw new Error("辞書が選択されていません");
    }

    if (!currentDict.prompts) {
      currentDict.prompts = [];
    }

    const validation = Validators.checkDuplicateFavorite(prompt, currentDict.prompts);
    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    const newFavoriteItem = {
      id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || "",
      prompt: prompt,
      sort: currentDict.prompts.length,
    };

    currentDict.prompts.push(newFavoriteItem);
    await savePromptDictionaries();

    if (window.app?.tabs?.dictionary && AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
      window.app.tabs.dictionary.updateStats();

      if (window.app.tabs.dictionary.dictionaryStates.prompt) {
        await window.app.tabs.dictionary.refreshFavoriteList();
      }
    }
  }

  hasCategoryFields(fields) {
    return fields.some((field) => field.type === "category");
  }

  setupStandardCategoryChain(inputs, item, config) {
    const categoryInputs = inputs.filter((input, index) => {
      return config.fields[index]?.type === "category";
    });

    if (categoryInputs.length < 2) return; // 最低2つのカテゴリーフィールドが必要

    const [bigInput, middleInput, smallInput] = categoryInputs;

    const chainLevel = config.chainLevel || (config.dropdownCount === true ? 3 : config.dropdownCount || 0);

    this.setupCustomDropdownChain(bigInput, middleInput, smallInput, chainLevel, config);
  }

  setupCustomDropdownChain(bigInput, middleInput, smallInput, chainLevel, config) {
    if (typeof CustomDropdown === "undefined") {
      return;
    }

    if (!window.categoryUIManager) {
      window.categoryUIManager = new CategoryUIManager();
    }

    if (bigInput) {
      bigInput.removeAttribute("list");
      bigInput.setAttribute("data-dropdown-enabled", "true");

      UIUtilities.destroyDropdown(bigInput);

      let originalBigValue = bigInput.value;

      this.initializeDropdownOnDemand(bigInput, {
        categoryLevel: CATEGORY_LEVELS.BIG.level,
        onSubmit: (value) => {
          if (value === originalBigValue) return;
          originalBigValue = value;

          if (config.resetMiddleOnBigChange && middleInput) {
            middleInput.value = "";
          }
          const resetLevel = config.resetLevel || chainLevel;
          if (resetLevel >= 3 && smallInput) {
            smallInput.value = "";
          }

          if (config.listType === "add") {
            const item = this.getItemFromInput(bigInput);
            if (item && item.id !== undefined) {
              const actualIndex = this.findLocalPromptIndex(item.id);
              this.updateLocalPromptCategory(actualIndex, CATEGORY_LEVELS.BIG.dataIndex, value);
            }
          }

          if (config.categoryChainBehavior?.focusNext) {
            this.focusNextCategoryInput(0, [bigInput, middleInput, smallInput], config);
          }

          if (config.onCategoryChange) {
            config.onCategoryChange(CATEGORY_LEVELS.BIG.name, value, bigInput);
          }
        },
        onBlur: (value) => {
          if (value === originalBigValue) return;
          originalBigValue = value;

          if (config.listType === "add") {
            const item = this.getItemFromInput(bigInput);
            if (item && item.id !== undefined) {
              const actualIndex = this.findLocalPromptIndex(item.id);
              this.updateLocalPromptCategory(actualIndex, CATEGORY_LEVELS.BIG.dataIndex, value);
            }
          }

          if (config.onCategoryChange) {
            config.onCategoryChange(CATEGORY_LEVELS.BIG.name, value, bigInput);
          }
        },
      });
    }

    if (middleInput && chainLevel >= 2) {
      middleInput.removeAttribute("list");
      middleInput.setAttribute("data-dropdown-enabled", "true");

      UIUtilities.destroyDropdown(middleInput);

      let originalMiddleValue = middleInput.value;

      try {
        this.initializeDropdownOnDemand(middleInput, {
          categoryLevel: CATEGORY_LEVELS.MIDDLE.level,
          onSubmit: (value) => {
            if (value === originalMiddleValue) return;
            originalMiddleValue = value;

            const resetLevel = config.resetLevel || chainLevel;
            if (resetLevel >= 3 && smallInput) {
              smallInput.value = "";
            }

            if (config.listType === "add") {
              const item = this.getItemFromInput(middleInput);
              if (item && item.id !== undefined) {
                const actualIndex = this.findLocalPromptIndex(item.id);
                this.updateLocalPromptCategory(actualIndex, CATEGORY_LEVELS.MIDDLE.dataIndex, value);
              }
            }

            if (config.categoryChainBehavior?.focusNext) {
              this.focusNextCategoryInput(CATEGORY_LEVELS.MIDDLE.level, [bigInput, middleInput, smallInput], config);
            }

            if (config.onCategoryChange) {
              config.onCategoryChange(CATEGORY_LEVELS.MIDDLE.name, value, middleInput);
            }
          },
          onBlur: (value) => {
            if (value === originalMiddleValue) return;
            originalMiddleValue = value;

            if (config.listType === "add") {
              const item = this.getItemFromInput(middleInput);
              if (item && item.id !== undefined) {
                const actualIndex = this.findLocalPromptIndex(item.id);
                this.updateLocalPromptCategory(actualIndex, CATEGORY_LEVELS.MIDDLE.dataIndex, value);
              }
            }

            if (config.onCategoryChange) {
              config.onCategoryChange(CATEGORY_LEVELS.MIDDLE.name, value, middleInput);
            }
          },
        });
      } catch (error) {}
    }

    if (smallInput && config.dropdownCount >= 3) {
      smallInput.removeAttribute("list");
      smallInput.setAttribute("data-dropdown-enabled", "true");

      UIUtilities.destroyDropdown(smallInput);

      let originalSmallValue = smallInput.value;

      this.initializeDropdownOnDemand(smallInput, {
        categoryLevel: CATEGORY_LEVELS.SMALL.level,
        onSubmit: (value) => {
          if (value === originalSmallValue) return;
          originalSmallValue = value;

          if (config.onSmallCategoryChange) {
            const bigValue = bigInput ? bigInput.value : "";
            const middleValue = middleInput ? middleInput.value : "";
            const item = this.getItemFromInput(smallInput);
            config.onSmallCategoryChange(value, bigValue, middleValue, item);
          }

          if (config.categoryChainBehavior?.focusNext && config.listType !== "edit") {
            this.focusNextCategoryInput(CATEGORY_LEVELS.SMALL.level, [bigInput, middleInput, smallInput], config);
          }

          if (config.onCategoryChange) {
            config.onCategoryChange(CATEGORY_LEVELS.SMALL.name, value, smallInput);
          }
        },
      });
    } else if (smallInput) {
      smallInput.removeAttribute("data-dropdown-enabled");
      smallInput.removeAttribute("list");

      UIUtilities.destroyDropdown(smallInput);
    }
  }

  focusNextCategoryInput(currentLevel, inputs, config) {
    const behavior = config.categoryChainBehavior || {};
    const chainLevel = config.chainLevel || (config.dropdownCount === true ? 3 : config.dropdownCount || 0);

    const nextLevel = currentLevel + 1;
    const nextInput = inputs[nextLevel];

    if (nextInput && nextLevel < chainLevel) {
      setTimeout(() => {
        nextInput.focus();

        if (behavior.openDropdownOnFocus && nextInput.customDropdown) {
          nextInput.customDropdown.open();
        }
      }, 150); // 少し長めの遅延でDOM更新を待つ
    } else if (nextLevel >= chainLevel && behavior.focusPromptAfterSmall) {
      let promptInput = null;

      const lastInput = inputs[inputs.length - 1];
      if (lastInput && lastInput.classList.contains("flex-col-prompt")) {
        promptInput = lastInput;
      } else {
        promptInput = this.findPromptInputInSameRow(inputs[0]);
      }

      if (promptInput) {
        setTimeout(() => {
          promptInput.focus();
        }, 150);
      }
    }
  }

  findPromptInputInSameRow(categoryInput) {
    const listItem = categoryInput.closest("li");
    if (listItem) {
      const promptInput = listItem.querySelector(".flex-col-prompt");
      return promptInput;
    }
    return null;
  }

  getItemFromInput(inputElement) {
    const listItemWithElementId = inputElement.closest(
      "li[data-element-id], .flexible-list-item[data-element-id], .prompt-list-item[data-element-id]"
    );
    if (listItemWithElementId) {
      const elementId = listItemWithElementId.getAttribute("data-element-id");
      const numericId = parseInt(elementId);
      const item = { id: isNaN(numericId) ? elementId : numericId };
      // 元のID（スロット要素との対応付け用）があれば取得
      const originalId = listItemWithElementId.getAttribute("data-original-id");
      if (originalId !== null) {
        const numericOriginalId = parseFloat(originalId);
        item.originalId = isNaN(numericOriginalId) ? originalId : numericOriginalId;
      }
      return item;
    }

    const listItemWithItemId = inputElement.closest("li[data-item-id], .flexible-list-item[data-item-id]");
    if (listItemWithItemId) {
      const itemId = listItemWithItemId.getAttribute("data-item-id");
      const numericId = parseInt(itemId);
      return { id: isNaN(numericId) ? itemId : numericId };
    }

    const parent = inputElement.closest("li[id]");
    if (parent) {
      const parentId = parent.id;
      if (parentId.startsWith("edit-")) {
        const numericId = parseInt(parentId.split("-")[1]);
        return { id: isNaN(numericId) ? parentId : numericId };
      }

      const numericId = parseInt(parentId);
      return { id: isNaN(numericId) ? parentId : numericId };
    }

    return null;
  }

  filterVirtualList(filterFn) {
    if (this.currentVirtualList) {
      this.currentVirtualList.setFilter(filterFn);
    }
  }

  destroyVirtualList() {
    if (this.currentVirtualList) {
      this.currentVirtualList.destroy();
      this.currentVirtualList = null;
    }
  }

  refreshList(listType, containerId) {
    const isAddOrFavorite =
      containerId === DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST || containerId === DOM_SELECTORS.BY_ID.FAVORITE_LIST;
    if (isAddOrFavorite && window.app?.tabs?.dictionary) {
      if (listType === "add" && containerId === DOM_SELECTORS.BY_ID.ADD_PROMPT_LIST) {
        window.app.tabs.dictionary.refreshAddList();
      } else if (listType === "favorite" && containerId === DOM_SELECTORS.BY_ID.FAVORITE_LIST) {
        window.app.tabs.dictionary.refreshFavoriteList();
      }
      return;
    }

    let dataSource = null;
    let config = {};

    switch (listType) {
      case "add":
        dataSource = AppState.data.localPromptList;
        config = {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: [...STANDARD_BUTTONS, { type: "delete", title: "ユーザー辞書から削除" }],
          sortable: true,
          listType: "add",
        };
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
        break;
      case "search":
        dataSource = AppState.temp.searchResults;
        config = {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: STANDARD_BUTTONS,
          listType: "search",
        };
        break;
      case "edit":
        if (window.app && window.app.tabs && window.app.tabs.edit) {
          window.app.tabs.edit.refreshEditList();
          return;
        } else {
          return;
        }
      default:
        return;
    }

    if (dataSource) {
      this.createFlexibleList(dataSource, containerId, config);
    }
  }

  validateGenerateEnvironment(prompt) {
    if (!prompt || !prompt.trim()) {
      UIHelpers.notifyError("プロンプトが空です", 2000);
      return false;
    }
    if (typeof sendBackground !== "function") {
      UIHelpers.notifyError("Generate機能が利用できません", 2000);
      return false;
    }
    if (!window.AppState || !AppState.selector) {
      UIHelpers.notifyError("セレクター設定が見つかりません", 2000);
      return false;
    }
    return true;
  }

  executeGenerateSendBackground(prompt) {
    if (window.autoGenerateHandler && window.autoGenerateHandler.isRunning) {
      window.autoGenerateHandler.stop();
    }
    sendBackground("DOM", "Generate", prompt, AppState.selector.positiveSelector, AppState.selector.generateSelector);
  }

  async executeDirectGenerate(prompt) {
    if (!this.validateGenerateEnvironment(prompt)) return;

    try {
      this.executeGenerateSendBackground(prompt.trim());
    } catch (error) {
      UIHelpers.notifyError("生成実行中にエラーが発生しました", 2000);
    }
  }

  async executeDirectGenerateWithMaxWeight(prompt) {
    if (typeof WeightConverter === "undefined") {
      await this.executeDirectGenerate(prompt);
      return;
    }

    if (!this.validateGenerateEnvironment(prompt)) return;

    try {
      const checkedUIType = document.querySelector('[name="UIType"]:checked');
      const uiType = checkedUIType ? checkedUIType.value : "SD";
      const weightedPrompt = WeightConverter.applyWeightToPrompt(uiType, prompt.trim(), 10);
      this.executeGenerateSendBackground(weightedPrompt);
    } catch (error) {
      UIHelpers.notifyError("重み最大生成実行中にエラーが発生しました", 2000);
    }
  }

  updateAllElementsReadonlyState(listId) {
    try {
      const container = document.querySelector(`#${listId}`);
      if (!container) {
        return;
      }

      const listConfig = this.listConfigs.get(listId);
      if (!listConfig) {
        return;
      }

      const listItems = container.querySelectorAll("li[data-element-id]");

      listItems.forEach((listItem) => {
        const elementId = listItem.getAttribute("data-element-id");

        if (listConfig.listType === "edit") {
          const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
          const elements = currentSlot?.elements || [];
          const element = elements.find((el) => el.id?.toString() === elementId);
          if (element) {
            this.updateElementReadonlyState(listItem, element, listConfig);
          }
        }
      });
    } catch (error) {}
  }

  updateElementReadonlyState(listItem, itemData, config) {
    try {
      config.fields.forEach((field) => {
        const input = listItem.querySelector(`[data-field="${field.key}"]`);
        if (input) {
          const fieldReadonly = typeof field.readonly === "function" ? field.readonly(itemData) : field.readonly;

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
    } catch (error) {}
  }
}

if (typeof window !== "undefined") {
  window.PromptListManager = PromptListManager;
  window.STANDARD_CATEGORY_FIELDS = STANDARD_CATEGORY_FIELDS;
  window.STANDARD_BUTTONS = STANDARD_BUTTONS;
  window.FAVORITE_FIELDS = FAVORITE_FIELDS;
  window.FAVORITE_BUTTONS = FAVORITE_BUTTONS;
}
