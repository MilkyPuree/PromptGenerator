/**
 * UI要素生成ファクトリー
 * jQuery依存を最小限に削減し、パフォーマンスを向上
 */
const UIFactory = {
  /**
   * 汎用ボタンを作成（Vanilla JS）
   * @param {Object} config - ボタン設定
   * @param {string} config.text - ボタンテキスト
   * @param {Function} config.onClick - クリックハンドラー
   * @param {string} [config.className] - CSSクラス名
   * @param {string} [config.title] - ツールチップ
   * @returns {HTMLButtonElement}
   */
  createButton(config) {
    const button = document.createElement(HTML_ELEMENTS.BUTTON);
    button.type = INPUT_TYPES.BUTTON;
    button.innerHTML = config.text;

    // 活性/非活性の設定（デフォルトは活性）
    const isEnabled = config.enabled !== false;
    button.disabled = !isEnabled;

    if (config.onClick) {
      button.addEventListener(DOM_EVENTS.CLICK, (event) => {
        // 無効状態の場合はクリックイベントを停止
        if (button.disabled) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        config.onClick(event);
      });
    }

    if (config.className) {
      button.className = config.className;
    }

    // 非活性時の追加クラス
    if (!isEnabled) {
      button.classList.add(CSS_CLASSES.BUTTON.DISABLED);
    }

    if (config.title) {
      button.title = config.title;
    }

    // 非活性時のツールチップメッセージ
    if (!isEnabled && config.disabledTitle) {
      button.title = config.disabledTitle;
    }

    // data-action属性の設定（ボタン種類別制御用）
    if (config.dataAction) {
      button.setAttribute('data-action', config.dataAction);
    }

    return button;
  },

  // createJQueryButton関数は削除されました（未使用のため）

  /**
   * 入力フィールドを作成（Vanilla JS版）
   * @param {Object} config - 入力フィールド設定
   * @returns {HTMLInputElement|jQuery}
   */
  createInput(config) {
    const input = document.createElement(HTML_ELEMENTS.INPUT);
    input.type = config.type || INPUT_TYPES.TEXT;
    input.value =
      config.value !== null && config.value !== undefined ? config.value : "";
    input.className = config.className || CSS_CLASSES.LIST.PROMPT_DATA;
    
    // ID生成（翻訳時のフォーカス保持に必要）
    if (config.id) {
      input.id = config.id;
    } else if (config.elementId !== undefined && config.fieldType) {
      // 要素ID + フィールドタイプでユニークなIDを生成
      input.id = `input-${config.elementId}-${config.fieldType}`;
    }
    
    // number typeの場合の追加設定
    if (config.type === INPUT_TYPES.NUMBER) {
      if (config.min !== undefined) input.min = config.min;
      if (config.max !== undefined) input.max = config.max;
      if (config.step !== undefined) input.step = config.step;
    }

    if (config.readonly) {
      input.readOnly = true;
    }

    if (config.style) {
      Object.assign(input.style, config.style);
    }

    if (config.onInput) {
      input.addEventListener(DOM_EVENTS.INPUT, () =>
        config.onInput(input.value, config.index)
      );
    }

    if (config.onBlur) {
      // console.log('[UIFactory] Adding blur event listener for input type:', config.type);
      input.addEventListener(DOM_EVENTS.BLUR, config.onBlur);
    }

    if (config.onChange) {
      input.addEventListener(DOM_EVENTS.CHANGE, config.onChange);
    }

    if (config.onKeydown) {
      input.addEventListener(DOM_EVENTS.KEY_DOWN, config.onKeydown);
    }

    if (config.placeholder) {
      input.placeholder = config.placeholder;
    }

    if (config.title) {
      input.title = config.title;
    }

    // ブラウザの自動補完を無効化（保存された情報の表示を防ぐ）
    input.setAttribute('autocomplete', 'off');
    
    // data-field属性を設定（list-manager.jsの単一要素更新で使用）
    if (config.dataField) {
      input.setAttribute('data-field', config.dataField);
    }

    // jQuery → Vanilla JS 置換 (Phase 8)
    // 互換性のため、新しいコードではVanilla JSで返す
    if (config.returnAsJQuery === true) {
      console.warn('[UIFactory] jQuery return is deprecated, use Vanilla JS instead');
      return window.$ ? $(input) : input; // jQueryが利用可能な場合のみ
    }

    return input;
  },

  /**
   * ヘッダー入力フィールドを作成
   * @param {string} value - 表示する値
   * @param {string} [columnType] - 列タイプ（'category', 'prompt', 'button'）
   * @returns {jQuery}
   */
  createHeaderInput(value, columnType) {
    const classNames = [CSS_CLASSES.LIST.PROMPT_DATA, CSS_CLASSES.LIST.HEADER_INPUT];

    // 列タイプに応じたクラスを追加
    if (columnType === "category") {
      classNames.push(CSS_CLASSES.FLEX_COL.CATEGORY);
    } else if (columnType === "prompt") {
      classNames.push(CSS_CLASSES.FLEX_COL.PROMPT);
    } else if (columnType === "weight") {
      classNames.push(CSS_CLASSES.FLEX_COL.WEIGHT);
    } else if (columnType === "button") {
      classNames.push(CSS_CLASSES.FLEX_COL.BUTTON);
    }

    return this.createInput({
      value: value,
      readonly: true,
      className: classNames.join(" "),
    });
  },

  /**
   * リストアイテムを作成（Vanilla JS版）
   * @param {Object} config - リストアイテム設定
   * @returns {jQuery}
   */
  createListItem(config) {
    const li = document.createElement("li");

    if (config.id !== undefined) {
      li.id = config.id;
    }

    if (config.sortable) {
      // リスト全体をドラッグハンドルにする（元の動作）
      li.className = CSS_CLASSES.LIST.SORTABLE_HANDLE;
    }

    // 現状のコードとの互換性のため、jQueryオブジェクトとして返す
    // jQuery → Vanilla JS 置換 (Phase 8)
    return li; // Vanilla JSオブジェクトで返す
  },

  // createButtonSet関数は削除されました
  // すべてのボタン生成はlist-manager.jsのcreateFlexibleButtonに移行済み

  // createPreviewButton関数は削除されました（未使用のため）

  // createDragIcon関数は削除されました（未使用のため）

  // createDragHandle関数は削除されました（未使用のため）

  /**
   * 汎用div要素を作成
   * @param {Object} config - div設定
   * @param {string} [config.className] - CSSクラス名
   * @param {Object} [config.styles] - インラインスタイル
   * @param {string} [config.id] - 要素ID
   * @param {string} [config.innerHTML] - 内部HTML
   * @param {string} [config.textContent] - テキストコンテンツ
   * @returns {HTMLDivElement}
   */
  createDiv(config = {}) {
    const div = document.createElement('div');
    
    if (config.className) {
      div.className = config.className;
    }
    
    if (config.id) {
      div.id = config.id;
    }
    
    if (config.innerHTML) {
      div.innerHTML = config.innerHTML;
    } else if (config.textContent) {
      div.textContent = config.textContent;
    }
    
    if (config.styles) {
      Object.assign(div.style, config.styles);
    }
    
    return div;
  },

  /**
   * option要素を作成
   * @param {Object} config - option設定
   * @param {string} config.value - option値
   * @param {string} [config.text] - 表示テキスト（valueと同じ場合は省略可能）
   * @param {boolean} [config.selected] - 選択状態
   * @returns {HTMLOptionElement}
   */
  createOption(config) {
    const option = document.createElement('option');
    option.value = config.value;
    option.textContent = config.text || config.value;
    
    if (config.selected) {
      option.selected = true;
    }
    
    return option;
  },


  /**
   * 空状態メッセージ用のdivを作成
   * @param {string} message - 表示メッセージ
   * @param {string} [className] - 追加CSSクラス
   * @returns {HTMLDivElement}
   */
  createEmptyStateDiv(message, className = '') {
    return this.createDiv({
      className: `empty-state-message ${className}`.trim(),
      textContent: message
    });
  },

  /**
   * CSSテキストを適用
   * @param {HTMLElement} element - 対象要素
   * @param {Object} styles - スタイルオブジェクト
   */
  applyCssText(element, styles) {
    const cssText = Object.entries(styles)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    element.style.cssText = cssText;
  },

  /**
   * 複数の属性を一括設定
   * @param {HTMLElement} element - 対象要素
   * @param {Object} attributes - 属性オブジェクト
   */
  setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  },

  /**
   * 複数のイベントリスナーを一括設定
   * @param {HTMLElement} element - 対象要素
   * @param {Object} events - イベントオブジェクト {eventName: handler}
   */
  addEventListeners(element, events) {
    Object.entries(events).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  },

  /**
   * canvas要素を作成
   * @param {Object} config - canvas設定
   * @param {number} [config.width] - キャンバス幅
   * @param {number} [config.height] - キャンバス高さ
   * @param {string} [config.className] - CSSクラス名
   * @returns {HTMLCanvasElement}
   */
  createCanvas(config = {}) {
    const canvas = document.createElement('canvas');
    
    if (config.width) {
      canvas.width = config.width;
    }
    
    if (config.height) {
      canvas.height = config.height;
    }
    
    if (config.className) {
      canvas.className = config.className;
    }
    
    return canvas;
  },

  /**
   * a要素（リンク）を作成
   * @param {Object} config - a要素設定
   * @param {string} [config.href] - リンク先URL
   * @param {string} [config.download] - ダウンロードファイル名
   * @param {string} [config.textContent] - リンクテキスト
   * @param {string} [config.className] - CSSクラス名
   * @returns {HTMLAnchorElement}
   */
  createAnchor(config = {}) {
    const a = document.createElement('a');
    
    if (config.href) {
      a.href = config.href;
    }
    
    if (config.download) {
      a.download = config.download;
    }
    
    if (config.textContent) {
      a.textContent = config.textContent;
    }
    
    if (config.className) {
      a.className = config.className;
    }
    
    return a;
  }
};

/**
 * リスト生成ヘルパー
 */
const ListBuilder = {
  /**
   * リストをクリア
   * @param {string} listId - リストのID
   */
  clearList(listId, preserveHeader = false) {
    const list = document.querySelector(listId);
    if (!list) return;

    // jQuery → Vanilla JS 置換 (Phase 8)
    const listElement = typeof list === 'string' ? document.querySelector(list) : list;
    if (!listElement) return;
    
    // イベントリスナーをクリーンアップ
    const allElements = listElement.querySelectorAll('*');
    allElements.forEach(element => {
      // CustomDropdownインスタンスを破棄
      const inputs = element.querySelectorAll('input');
      inputs.forEach(input => {
        if (input.customDropdown) {
          console.log('[LIST-BUILDER] Destroying custom dropdown for input:', input);
          input.customDropdown.destroy();
        }
      });
      
      // クローンでイベントリスナーをクリア
      const clone = element.cloneNode(false);
      if (element.parentNode) {
        element.parentNode.replaceChild(clone, element);
      }
    });

    // ソート機能が有効な場合は破棄
    if (listElement.classList.contains(CSS_CLASSES.LIST.SORTABLE_HANDLE)) {
      // jQuery UI Sortableが残っている場合のみ実行
      if (window.$ && typeof $(listElement).sortable === 'function') {
        $(listElement).sortable("destroy");
      }
    }

    if (preserveHeader) {
      // ヘッダーを保持してその他をクリア
      const header = list.querySelector('ui');
      const viewport = list.querySelector('.virtual-list-viewport');
      
      // ヘッダーとビューポート以外を削除
      Array.from(list.children).forEach(child => {
        if (child !== header && child !== viewport) {
          child.remove();
        }
      });
      
      // ビューポートがある場合はその中身もクリア
      if (viewport) {
        viewport.remove();
      }
    } else {
      // より高速な方法でリストをクリア
      while (list.firstChild) {
        list.removeChild(list.firstChild);
      }
    }
  },

  /**
   * ヘッダー行を作成
   * @param {string} listId - リストのID
   * @param {string[]} headers - ヘッダーテキストの配列
   * @param {Object} [columnTypes] - 列タイプのマッピング
   * @param {Object} [sortConfig] - ソート設定 {enabled: boolean, listManager: PromptListManager, dataArray: Array, refreshCallback: Function, saveCallback: Function}
   */
  createHeaders(listId, headers, columnTypes, sortable = false, sortConfig = null) {
    
    const list = document.querySelector(listId);
    if (!list) return;

    const headerRow = document.createElement("li");
    headerRow.classList.add(CSS_CLASSES.LIST.HEADER);

    // ヘッダースペーサーも削除

    headers.forEach((header, index) => {
      const columnType = columnTypes?.[index];
      const headerInput = UIFactory.createHeaderInput(header, columnType);
      
      // ヘッダー入力にも新しいクラスを適用
      const $headerInput = $(headerInput[0] || headerInput);
      $headerInput.addClass(CSS_CLASSES.LIST.INPUT);
      
      // フレックス列クラスを適用
      if (columnType === 'category') {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.CATEGORY);
      } else if (columnType === 'prompt') {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.PROMPT);
      } else if (columnType === 'weight') {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.WEIGHT);
      } else if (columnType === 'button') {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.BUTTON);
      }
      
      // 後方互換性のため旧クラスも追加
      $headerInput.addClass(CSS_CLASSES.LIST.PROMPT_DATA);
      
      // ソート機能を有効にする場合
      if (sortConfig && sortConfig.enabled && 
          (columnType === 'category' || columnType === 'prompt' || columnType === 'weight')) {
        
        
        // ソート可能なヘッダーとしてマーク
        $headerInput.addClass('sortable-header');
        
        // クリックイベントリスナーを追加
        $headerInput[0].addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // ListManagerのヘッダークリックソート機能を呼び出し
          if (sortConfig.listManager && typeof sortConfig.listManager.handleHeaderClickSort === 'function') {
            // カテゴリ列の場合、具体的な列インデックスを渡す
            let categoryIndex = null;
            if (columnType === 'category') {
              categoryIndex = index; // createHeaders内のforEachのindex
            }
            
            sortConfig.listManager.handleHeaderClickSort(
              listId,
              columnType,
              sortConfig.dataArray,
              sortConfig.refreshCallback,
              sortConfig.saveCallback,
              categoryIndex
            );
          }
        });
      }
      
      
      headerRow.appendChild($headerInput[0]);
    });

    list.appendChild(headerRow);
    
    // デバッグモード：ヘッダーの列幅確認（必要時のみ有効化）
    if (AppState.config.debugMode && window.FLEXIBLE_LIST_DEBUG) {
      setTimeout(() => {
        const headerElements = headerRow.querySelectorAll('.prompt-list-input');
        headerElements.forEach((element, index) => {
          const computedStyle = window.getComputedStyle(element);
          console.log(`[HEADER DEBUG] Column ${index}: width=${computedStyle.width}, padding=${computedStyle.paddingLeft}|${computedStyle.paddingRight}`);
        });
      }, 100);
    }
    
    // ソート機能が有効な場合、初期のソートインジケーターを設定
    if (sortConfig && sortConfig.enabled && sortConfig.listManager) {
      // 既存のソート状態があれば復元
      const currentSortState = sortConfig.listManager.sortStates.get(listId);
      if (currentSortState && currentSortState.column && currentSortState.direction) {
        sortConfig.listManager.updateHeaderSortIndicators(
          listId, 
          currentSortState.column, 
          currentSortState.direction
        );
      }
    }
    
    // スクロールバーが必要かどうかを後で判定してスペーサーを追加
    // 仮想リスト作成後に調整される
  },

  /**
   * 列幅を設定（CSS変数を使用した最適化版）
   * @param {string} listId - リストのID
   * @param {number} columnIndex - 列インデックス（1から開始）
   * @param {string} width - 幅（例: '100px'）
   */
  setColumnWidth(listId, columnIndex, width) {
    // CSSカスタムプロパティを使用してパフォーマンスを向上
    const list = document.querySelector(listId);
    if (list) {
      list.style.setProperty(`--column-${columnIndex}-width`, width);

      // 既存の要素に適用
      const selector = `${listId} li input:nth-of-type(${columnIndex}), ${listId} ui input:nth-of-type(${columnIndex})`;
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.style.width = width;
      });
    }
  },

  // setColumnWidths関数は削除されました（未使用のため）
};

/**
 * イベントハンドラーヘルパー
 */
const EventHandlers = {
  /**
   * 入力フィールドのクリア機能を追加（Vanilla JS版）
   * @deprecated マウスオーバー時のクリア機能は削除されました
   * @param {jQuery|HTMLElement} input - 入力フィールド
   */
  addInputClearBehavior(input) {
    // 機能を無効化：マウスオーバー時にクリアする機能は削除
    // ユーザーエクスペリエンスを向上させるために無効化
    // console.warn('[DEPRECATED] addInputClearBehavior is deprecated and disabled');
  },

  /**
   * 複数の入力フィールドにクリア機能を追加
   * @deprecated マウスオーバー時のクリア機能は削除されました
   * @param {Array} inputs - 入力フィールドの配列
   */
  addInputClearBehaviorToMany(inputs) {
    // 機能を無効化：マウスオーバー時にクリアする機能は削除
    // console.warn('[DEPRECATED] addInputClearBehaviorToMany is deprecated and disabled');
  },

  /**
   * カテゴリー連動の設定（検索タブ・辞書タブ用）
   * @param {Array} inputs - [大カテゴリー, 中カテゴリー, 小カテゴリー]の入力フィールド
   * 注意：編集タブではlist-manager.jsのsetupStandardCategoryChainを使用
   */
  setupCategoryChain(inputs) {
    const [bigInput, middleInput, smallInput] = inputs.map((input) =>
      input && input.jquery ? input[0] : input
    );

    // カスタムドロップダウンを使用
    console.log('[EventHandlers] Setting up custom dropdown chain');
    
    // CategoryUIManagerの初期化を確認
    if (!window.categoryUIManager) {
      window.categoryUIManager = new CategoryUIManager();
    }

    // 大項目のカスタムドロップダウン
    if (bigInput.customDropdown) {
      bigInput.customDropdown.destroy();
    }
    bigInput.customDropdown = new CustomDropdown(bigInput, {
      categoryLevel: 0,
      onSubmit: (value) => {
        console.log('[EventHandlers] Big category onSubmit called with:', value);
        if (middleInput) {
          middleInput.value = '';
          // 大項目が選択されたら中項目にフォーカス移動
          setTimeout(() => {
            middleInput.focus();
            middleInput.click(); // ドロップダウンも開く
            console.log('[EventHandlers] Focus moved to middle input and clicked');
          }, 50);
        }
        if (smallInput) {
          smallInput.value = '';
        }
      }
    });

    // 中項目のカスタムドロップダウン
    if (middleInput) {
      if (middleInput.customDropdown) {
        middleInput.customDropdown.destroy();
      }
      middleInput.customDropdown = new CustomDropdown(middleInput, {
        categoryLevel: 1,
        onSubmit: (value) => {
          console.log('[EventHandlers] Middle category onSubmit called with:', value);
          console.log('[EventHandlers] smallInput available:', !!smallInput, smallInput);
          if (smallInput && smallInput.nodeType === Node.ELEMENT_NODE) {
            smallInput.value = '';
            // 中項目が選択されたら小項目にフォーカス移動
            setTimeout(() => {
              console.log('[EventHandlers] Attempting to focus small input:', smallInput);
              smallInput.focus();
              console.log('[EventHandlers] Focus moved to small input, document.activeElement:', document.activeElement);
            }, 50);
          } else {
            console.warn('[EventHandlers] smallInput is not available for focus:', {
              exists: !!smallInput,
              type: typeof smallInput,
              nodeType: smallInput?.nodeType
            });
          }
        }
      });
    }

    // 小項目は入力フィールドのみ（検索タブ・辞書タブでは選択不可）
    // smallInputにはカスタムドロップダウンを適用しない
    
    // 小項目でEnterキーを押したらプロンプト入力欄にフォーカス移動
    if (smallInput) {
      // 既存のイベントリスナーを削除（重複避け）
      smallInput.removeEventListener('keydown', EventHandlers._smallInputEnterHandler);
      
      EventHandlers._smallInputEnterHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const promptInput = document.getElementById(DOM_IDS.CATEGORY.PROMPT);
          if (promptInput) {
            console.log('[EventHandlers] Moving focus from small to prompt input');
            promptInput.focus();
          }
        }
      };
      
      smallInput.addEventListener('keydown', EventHandlers._smallInputEnterHandler);
    }
    
    // プロンプト入力でEnterキーを押したら自動追加して大項目にフォーカス戻し
    const promptInput = document.getElementById(DOM_IDS.CATEGORY.PROMPT);
    if (promptInput) {
      // 既存のイベントリスナーを削除（重複避け）
      promptInput.removeEventListener('keydown', EventHandlers._promptEnterHandler);
      
      // 新しいイベントリスナーを追加
      EventHandlers._promptEnterHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          // 追加ボタンをクリック
          const resistButton = document.getElementById(DOM_IDS.BUTTONS.RESIST) || 
                              document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_RESIST_BTN);
          if (resistButton) {
            console.log('[EventHandlers] Auto-clicking resist button');
            resistButton.click();
            
            // 要素追加時は大項目にフォーカスを戻す（連続追加のため）
            setTimeout(() => {
              bigInput.focus();
              console.log('[EventHandlers] Focus returned to big input after adding for continuous addition');
              
              // ドロップダウンも自動で開く
              if (bigInput.customDropdown) {
                setTimeout(() => {
                  bigInput.click(); // ドロップダウンを開く
                  console.log('[EventHandlers] Big input dropdown opened after adding');
                }, 50);
              }
            }, 100);
          }
        }
      };
      
      promptInput.addEventListener('keydown', EventHandlers._promptEnterHandler);
    }
  },
  /**
   * 並び替え可能なリストを設定
   * @param {string} listId - リストのID
   * @param {Function} onUpdate - 更新時のコールバック
   */
  setupSortableList(listId, onUpdate) {
    // jQuery UIのsortableは現状維持（Phase 4の後半で対応）
    if (!window.$ || !window.$.ui) {
      console.error('jQuery UI is not available. Sortable functionality will be disabled.');
      return;
    }
    const $list = $(listId);

    console.log(`setupSortableList called for ${listId}, existing sortable: ${$list.hasClass("ui-sortable")}`);

    if ($list.hasClass("ui-sortable")) {
      console.log(`Destroying existing sortable for ${listId}`);
      $list.sortable("destroy");
    }

    // 編集タブの場合はcontainmentを無効化
    const isEditTab = listId === DOM_SELECTORS.BY_ID.EDIT_LIST;

    const sortableOptions = {
      cancel: JQUERY_UI_CONFIG.SORTABLE_CANCEL_SELECTOR, // フォーム要素でのドラッグを無効化
      revert: JQUERY_UI_CONFIG.SORTABLE_REVERT,
      distance: JQUERY_UI_CONFIG.SORTABLE_DISTANCE,
      tolerance: JQUERY_UI_CONFIG.SORTABLE_TOLERANCE,
      cursor: JQUERY_UI_CONFIG.SORTABLE_CURSOR,
      opacity: JQUERY_UI_CONFIG.SORTABLE_OPACITY,
      scroll: !isEditTab, // 編集タブではスクロール機能を無効化
      scrollSensitivity: JQUERY_UI_CONFIG.SORTABLE_SCROLL_SENSITIVITY,
      scrollSpeed: JQUERY_UI_CONFIG.SORTABLE_SCROLL_SPEED,
      helper: isEditTab ? function(event, element) {
        // 編集タブ用カスタムヘルパー: スクロール問題を完全回避
        const $clone = element.clone();
        $clone.css({
          width: element.outerWidth(),
          height: element.outerHeight(),
          position: "fixed",
          "z-index": 99999,
          "pointer-events": "none",
          transform: "none",
          webkitTransform: "none"
        });
        return $clone;
      } : JQUERY_UI_CONFIG.SORTABLE_HELPER,
      // ハンドル指定は削除（全体をドラッグ可能にする）
      // 編集タブ用の追加設定
      ...(isEditTab ? { 
        appendTo: "body",
        cursorAt: { top: 10, left: 10 } // カーソル位置を固定
      } : { containment: listId }),
      // ドラッグ開始時（座標修正版）
      start: function (event, ui) {
        console.log("Drag started, item:", ui.item[0], "isEditTab:", isEditTab);

        // オリジナル要素のサイズを取得
        const width = ui.item.outerWidth();
        const height = ui.item.outerHeight();
        
        // デバッグ用ログは削除

        // ヘルパーのスタイルを設定（編集タブと辞書タブで異なる設定）
        const helperStyle = {
          width: width,
          height: height,
          "z-index": 99999,
          background: "var(--bg-tertiary)",
          border: "2px solid var(--accent-primary)",
          "border-radius": "var(--radius-md)",
          "box-shadow": "0 10px 30px rgba(0,0,0,0.5)",
          opacity: "0.9",
          cursor: "grabbing",
          "pointer-events": "none",
        };

        // 編集タブはカスタムヘルパーで既に設定済み、辞書タブのみ追加スタイルを適用
        if (!isEditTab) {
          helperStyle.position = "absolute";
          ui.helper.css(helperStyle);
        }

        // プレースホルダーのスタイル
        ui.placeholder.css({
          height: height + "px",
          visibility: "visible",
          background: "var(--bg-accent)",
          border: "2px dashed var(--accent-primary)",
          "border-radius": "var(--radius-md)",
          margin: "4px 0",
          opacity: "0.7",
        });

        // 元の要素を半透明に
        ui.item.css("opacity", "0.5");
      },
      // ドラッグ終了時
      stop: function (event, ui) {
        ui.item.css("opacity", "1");
        
        // ドラッグハンドルのカーソルをリセット
        const dragHandle = ui.item.find('.drag-handle')[0];
        if (dragHandle) {
          dragHandle.style.cursor = 'grab';
        }
      },
      update: function (event, ui) {
        const sortedIds = $list.sortable("toArray");
        console.log(`[UIFactory] Sortable update for ${listId}, new order:`, sortedIds);
        console.log(`[UIFactory] Calling onUpdate callback with sortedIds:`, sortedIds);
        onUpdate(sortedIds);
        console.log(`[UIFactory] onUpdate callback completed for ${listId}`);
      },
    };

    $list.sortable(sortableOptions);
    
    console.log(`Sortable initialized for ${listId}, sortable items count: ${$list.find('.ui-sortable-handle').length}`);
  },

  // delegate関数は削除されました（未使用のため）
};

// パフォーマンス測定ユーティリティ（デバッグ用）
const PerformanceMonitor = {
  marks: new Map(),

  start(label) {
    if (typeof performance !== "undefined") {
      performance.mark(`${label}-start`);
      this.marks.set(label, performance.now());
    }
  },

  end(label) {
    if (typeof performance !== "undefined" && this.marks.has(label)) {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);

      const duration = performance.now() - this.marks.get(label);
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);

      this.marks.delete(label);
    }
  },
};

// グローバルに公開
if (typeof window !== "undefined") {
  window.UIFactory = UIFactory;
  window.ListBuilder = ListBuilder;
  window.EventHandlers = EventHandlers;
  window.PerformanceMonitor = PerformanceMonitor;
}
