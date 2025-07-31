/**
 * category-ui-manager.js - カテゴリーUI管理モジュール
 * Phase 7: カテゴリー処理の統一
 * 
 * 各タブで重複するカテゴリー関連の処理を統一管理
 * - 2段階チェーン（検索・辞書タブ）
 * - 3段階チェーン（編集タブ）
 * - 引数による動作切り分け
 */

class CategoryUIManager {
  constructor() {
    // カテゴリーチェーンの設定パターン
    this.chainConfigs = {
      // 検索タブ: 2段階ドロップダウン（小項目は入力フィールド）
      search: {
        chainLevel: 2,
        bigSelector: DOM_SELECTORS.BY_ID.SEARCH_CAT0,
        middleSelector: DOM_SELECTORS.BY_ID.SEARCH_CAT1,
        smallSelector: null, // 入力フィールドなので未使用
        inputFields: {
          big: DOM_SELECTORS.BY_ID.BIG,
          middle: DOM_SELECTORS.BY_ID.MIDDLE,
          small: DOM_SELECTORS.BY_ID.SMALL
        },
        resetSmallOnMiddleChange: false,
        autoSearch: true, // カテゴリー変更時に自動検索
        autoOpenMiddleDropdown: true // 大項目選択後に中項目ドロップダウンを自動で開く
      },
      
      // 編集タブ: 3段階ドロップダウン（選択編集モード）
      edit: {
        chainLevel: 3,
        bigSelector: null,    // FlexibleListで動的生成
        middleSelector: null, // FlexibleListで動的生成
        smallSelector: null,  // FlexibleListで動的生成
        resetSmallOnMiddleChange: true,
        autoSearch: false,
        enableSmallDropdown: true // 小項目ドロップダウンを有効化
      },
      
      // 辞書タブ: 2段階入力フィールド
      dictionary: {
        chainLevel: 2,
        bigSelector: null,
        middleSelector: null,
        smallSelector: null,
        inputFields: {
          big: DOM_SELECTORS.BY_ID.BIG,
          middle: DOM_SELECTORS.BY_ID.MIDDLE, 
          small: DOM_SELECTORS.BY_ID.SMALL
        },
        resetSmallOnMiddleChange: false,
        autoSearch: false
      }
    };
  }

  /**
   * カテゴリーチェーンを初期化
   * @param {string} configName - 設定名（search, edit, dictionary）
   * @param {Object} options - 追加オプション
   */
  initializeCategoryChain(configName, options = {}) {
    const config = { ...this.chainConfigs[configName], ...options };
    
    if (!config) {
      console.error(`Unknown category config: ${configName}`);
      return;
    }

    console.log(`[CategoryUIManager] Initializing ${configName} category chain`, config);

    switch (configName) {
      case 'search':
        this.initializeSearchCategoryChain(config);
        break;
      case 'edit':
        this.initializeEditCategoryChain(config);
        break;
      case 'dictionary':
        this.initializeDictionaryCategoryChain(config);
        break;
      default:
        console.warn(`No initialization method for config: ${configName}`);
    }
  }

  /**
   * 検索タブのカテゴリーチェーンを初期化
   */
  initializeSearchCategoryChain(config) {
    // 大カテゴリーを設定
    this.populateDropdown(config.bigSelector, 0);

    // 中カテゴリーを無効化（初期状態）
    const middleSelect = document.querySelector(config.middleSelector);
    if (middleSelect) {
      middleSelect.disabled = true;
    }

    // 大カテゴリー変更イベント
    const bigSelect = document.querySelector(config.bigSelector);
    if (bigSelect) {
      // 既存のイベントリスナーをクリア（重複回避）
      bigSelect.replaceWith(bigSelect.cloneNode(true));
      const newBigSelect = document.querySelector(config.bigSelector);
      
      newBigSelect.addEventListener('change', (e) => {
        this.handleBigCategoryChange(e.target.value, config);
      });
    }

    // 中カテゴリー変更イベント
    const newMiddleSelect = document.querySelector(config.middleSelector);
    if (newMiddleSelect) {
      // 既存のイベントリスナーをクリア（重複回避）
      newMiddleSelect.replaceWith(newMiddleSelect.cloneNode(true));
      const finalMiddleSelect = document.querySelector(config.middleSelector);
      
      finalMiddleSelect.addEventListener('change', (e) => {
        this.handleMiddleCategoryChange(e.target.value, config);
      });
    }

    // 入力フィールドのチェーン設定
    if (config.inputFields) {
      this.setupInputFieldsChain(config.inputFields);
    }
  }

  /**
   * 編集タブのカテゴリーチェーンを初期化（FlexibleList経由）
   */
  initializeEditCategoryChain(config) {
    // 編集タブのカテゴリーチェーンはFlexibleListで管理されるため
    // ここでは設定のみ保存し、実際の処理はlist-manager.jsで行う
    console.log('[CategoryUIManager] Edit category chain config saved', config);
  }

  /**
   * 辞書タブのカテゴリーチェーンを初期化
   */
  initializeDictionaryCategoryChain(config) {
    console.log("[DICT_DEBUG] initializeDictionaryCategoryChain called with config:", config);
    
    if (config.inputFields) {
      console.log("[DICT_DEBUG] Setting up input fields chain:", config.inputFields);
      this.setupInputFieldsChain(config.inputFields);
      console.log("[DICT_DEBUG] Input fields chain setup completed");
    } else {
      console.warn("[DICT_DEBUG] No input fields found in config");
    }
  }

  /**
   * ドロップダウンにカテゴリーデータを設定
   * @param {string} selector - セレクター
   * @param {number} level - カテゴリーレベル（0=大項目, 1=中項目, 2=小項目）
   * @param {string} parentValue - 親カテゴリーの値（中項目・小項目の場合）
   */
  populateDropdown(selector, level, parentValue = null) {
    const selectElement = document.querySelector(selector);
    if (!selectElement) {
      console.warn(`Dropdown element not found: ${selector}`);
      return;
    }

    // 現在の選択値を保存
    const currentValue = selectElement.value;

    // 既存のオプションをクリア
    selectElement.innerHTML = '';

    // 空のオプションを追加
    const emptyOption = UIFactory.createOption({
      value: '',
      text: ''
    });
    selectElement.appendChild(emptyOption);

    // カテゴリーデータを取得
    const categories = this.getCategoriesByLevel(level, parentValue);
    
    // DocumentFragmentを使用してパフォーマンス向上
    const fragment = document.createDocumentFragment();
    
    categories.forEach(categoryValue => {
      const option = UIFactory.createOption({
        value: categoryValue,
        text: categoryValue
      });
      fragment.appendChild(option);
    });

    selectElement.appendChild(fragment);
    selectElement.disabled = false;

    // 現在の値が新しいオプションに存在する場合は復元
    if (currentValue && categories.includes(currentValue)) {
      selectElement.value = currentValue;
    }

    console.log(`[CategoryUIManager] Populated ${selector} with ${categories.length} options`);
  }

  /**
   * 大カテゴリー変更ハンドラー
   */
  handleBigCategoryChange(value, config) {
    console.log(`[CategoryUIManager] Big category changed: ${value}`);

    // 検索タブの場合はAppStateを更新
    if (config === this.chainConfigs.search) {
      AppState.data.searchCategory[0] = value;
      AppState.data.searchCategory[1] = ''; // 中項目をリセット
      saveCategory();
    }

    // 中カテゴリーを更新
    if (config.middleSelector) {
      this.populateDropdown(config.middleSelector, 1, value);
      
      // 大項目選択後に中項目ドロップダウンを自動で開く
      if (value && config.autoOpenMiddleDropdown) { // 値が選択されており、自動開く設定が有効な場合のみ
        setTimeout(() => {
          const middleSelect = document.querySelector(config.middleSelector);
          if (middleSelect && !middleSelect.disabled && middleSelect.options.length > 1) { // 選択肢が2個以上ある場合のみ（空のオプション + 実際のオプション）
            try {
              // selectタグのドロップダウンを開く（複数の方法を試行）
              middleSelect.focus();
              
              // Method 1: clickイベント
              middleSelect.click();
              
              // Method 2: mousedownイベント（ブラウザによってはこちらが有効）
              const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              middleSelect.dispatchEvent(mousedownEvent);
              
              // Method 3: showPickerメソッド（Chrome等の新しいブラウザ）
              if (typeof middleSelect.showPicker === 'function') {
                middleSelect.showPicker();
              }
              
              console.log('[CategoryUIManager] Middle dropdown auto-opened after big category selection');
            } catch (error) {
              // エラーが発生しても処理を続行
              console.log('[CategoryUIManager] Could not auto-open middle dropdown:', error);
            }
          }
        }, 100); // 100ms遅延でドロップダウン更新の完了を待つ
      }
    }

    // 小項目をリセット（必要に応じて）
    if (config.resetSmallOnMiddleChange && config.smallSelector) {
      const smallSelect = document.querySelector(config.smallSelector);
      if (smallSelect) {
        smallSelect.innerHTML = '<option value=""></option>';
        smallSelect.disabled = true;
      }
    }

    // 自動検索を実行
    if (config.autoSearch) {
      this.triggerAutoSearch(config);
    }
  }

  /**
   * 中カテゴリー変更ハンドラー
   */
  handleMiddleCategoryChange(value, config) {
    console.log(`[CategoryUIManager] Middle category changed: ${value}`);

    const bigValue = config.bigSelector ? 
      document.querySelector(config.bigSelector)?.value : '';

    // 検索タブの場合はAppStateを更新
    if (config === this.chainConfigs.search) {
      AppState.data.searchCategory[1] = value;
      saveCategory();
    }

    // 小カテゴリーを更新（3段階チェーンの場合）
    if (config.chainLevel === 3 && config.smallSelector) {
      // parentKeyをcategory-manager.jsと同じ形式で構築（記号除去）
      const parentKey = (bigValue || "").replace(/[!\/]/g, "") + (value || "").replace(/[!\/]/g, "");
      this.populateDropdown(config.smallSelector, 2, parentKey);
    }

    // 自動検索を実行
    if (config.autoSearch) {
      this.triggerAutoSearch(config);
    }
  }

  /**
   * 小カテゴリー変更ハンドラー
   */
  handleSmallCategoryChange(value, config, onSmallChange = null) {
    console.log(`[CategoryUIManager] Small category changed: ${value}`);

    // カスタムコールバックを実行（編集タブのプロンプト自動検索など）
    if (onSmallChange && typeof onSmallChange === 'function') {
      const bigValue = config.bigSelector ? 
        document.querySelector(config.bigSelector)?.value : '';
      const middleValue = config.middleSelector ? 
        document.querySelector(config.middleSelector)?.value : '';
      
      onSmallChange(value, bigValue, middleValue);
    }
  }

  /**
   * 入力フィールドのチェーン設定
   */
  setupInputFieldsChain(inputFields) {
    console.log("[DICT_DEBUG] setupInputFieldsChain called with:", inputFields);
    
    const bigInput = document.querySelector(inputFields.big);
    const middleInput = document.querySelector(inputFields.middle);
    const smallInput = document.querySelector(inputFields.small);

    console.log("[DICT_DEBUG] Input elements found:", {
      big: !!bigInput,
      middle: !!middleInput,
      small: !!smallInput,
      bigSelector: inputFields.big,
      middleSelector: inputFields.middle,
      smallSelector: inputFields.small
    });

    if (bigInput && middleInput) {
      console.log("[DICT_DEBUG] Setting up category chain for big and middle inputs");
      
      // 大項目、中項目、小項目の連動（EventHandlersを使用）
      if (window.EventHandlers && typeof EventHandlers.setupCategoryChain === 'function') {
        console.log("[DICT_DEBUG] EventHandlers.setupCategoryChain is available, calling...");
        EventHandlers.setupCategoryChain([bigInput, middleInput, smallInput]);
        console.log("[DICT_DEBUG] setupCategoryChain completed");
      } else {
        console.error("[DICT_DEBUG] EventHandlers.setupCategoryChain is not available:", {
          EventHandlers: !!window.EventHandlers,
          setupCategoryChain: window.EventHandlers ? typeof EventHandlers.setupCategoryChain : 'undefined'
        });
      }

      // クリア動作を追加
      if (window.EventHandlers && typeof EventHandlers.addInputClearBehavior === 'function') {
        console.log("[DICT_DEBUG] Adding clear behavior to inputs");
        EventHandlers.addInputClearBehavior(bigInput);
        EventHandlers.addInputClearBehavior(middleInput);

        // 小項目は単純な入力フィールドとして扱う
        if (smallInput) {
          EventHandlers.addInputClearBehavior(smallInput);
        }
        console.log("[DICT_DEBUG] Clear behavior setup completed");
      } else {
        console.error("[DICT_DEBUG] EventHandlers.addInputClearBehavior is not available");
      }
    } else {
      console.error("[DICT_DEBUG] Required input elements not found", {
        bigInput: !!bigInput,
        middleInput: !!middleInput,
        selectors: inputFields
      });
    }
  }

  /**
   * カテゴリーデータをレベル別に取得
   * NSFWフィルタリングを含む統一処理
   */
  getCategoriesByLevel(level, parentValue = null) {
    if (!window.categoryData || !categoryData.data) {
      console.warn('[CategoryUIManager] CategoryData not available:', {
        windowCategoryData: !!window.categoryData,
        categoryDataExists: !!categoryData,
        categoryDataData: categoryData?.data?.length || 'N/A'
      });
      return [];
    }

    // categoryData.getCategoriesByParentを使用してNSFWフィルタリングを確実に通す
    console.log(`[CategoryUIManager] 📞 Calling getCategoriesByParent for level=${level}, parent=${parentValue}`);
    const result = categoryData.getCategoriesByParent(level, parentValue);
    console.log(`[CategoryUIManager] 📞 Got ${result.length} categories from getCategoriesByParent`);
    return result;
  }

  /**
   * 自動検索をトリガー
   */
  triggerAutoSearch(config) {
    // 検索タブの場合のみ自動検索を実行
    if (config.autoSearch && window.app && window.app.searchHandler) {
      // 中項目ドロップダウンが自動で開く場合は、それが終わってから検索を実行
      const searchDelay = (config.autoOpenMiddleDropdown && config.middleSelector) ? 200 : 50;
      
      setTimeout(() => {
        window.app.searchHandler.performSearch({ showLoading: false });
      }, searchDelay);
    }
  }

  /**
   * カテゴリー選択値を取得
   * @param {string} configName - 設定名
   * @returns {Object} { big, middle, small }
   */
  getCategoryValues(configName) {
    const config = this.chainConfigs[configName];
    if (!config) return { big: '', middle: '', small: '' };

    const result = { big: '', middle: '', small: '' };

    if (config.bigSelector) {
      const bigElement = document.querySelector(config.bigSelector);
      result.big = bigElement ? bigElement.value : '';
    }

    if (config.middleSelector) {
      const middleElement = document.querySelector(config.middleSelector);
      result.middle = middleElement ? middleElement.value : '';
    }

    if (config.smallSelector) {
      const smallElement = document.querySelector(config.smallSelector);
      result.small = smallElement ? smallElement.value : '';
    }

    return result;
  }

  /**
   * カテゴリー選択値を設定
   * @param {string} configName - 設定名
   * @param {Object} values - { big, middle, small }
   */
  setCategoryValues(configName, values) {
    const config = this.chainConfigs[configName];
    if (!config) return;

    // 大カテゴリーを設定
    if (config.bigSelector && values.big) {
      const bigElement = document.querySelector(config.bigSelector);
      if (bigElement) {
        bigElement.value = values.big;
        this.handleBigCategoryChange(values.big, config);
      }
    }

    // 中カテゴリーを設定（遅延実行で確実に設定）
    if (config.middleSelector && values.middle) {
      setTimeout(() => {
        const middleElement = document.querySelector(config.middleSelector);
        if (middleElement) {
          middleElement.value = values.middle;
          this.handleMiddleCategoryChange(values.middle, config);
        }
      }, 50);
    }

    // 小カテゴリーを設定（さらに遅延実行）
    if (config.smallSelector && values.small) {
      setTimeout(() => {
        const smallElement = document.querySelector(config.smallSelector);
        if (smallElement) {
          smallElement.value = values.small;
        }
      }, 100);
    }
  }


  /**
   * カテゴリーチェーンをリセット
   * @param {string} configName - 設定名
   */
  resetCategoryChain(configName) {
    const config = this.chainConfigs[configName];
    if (!config) return;

    // 各セレクターをクリア
    [config.bigSelector, config.middleSelector, config.smallSelector].forEach(selector => {
      if (selector) {
        const element = document.querySelector(selector);
        if (element) {
          element.value = '';
          if (element !== document.querySelector(config.bigSelector)) {
            element.disabled = true;
          }
        }
      }
    });

    // 入力フィールドもクリア
    if (config.inputFields) {
      Object.values(config.inputFields).forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          element.value = '';
        }
      });
    }

    // 自動検索を実行（検索タブの場合）
    if (config.autoSearch) {
      this.triggerAutoSearch(config);
    }
  }

  /**
   * 3段階カテゴリチェーン用のコールバック設定
   * 編集タブのFlexibleListで使用
   */
  createThreeLevelCallbacks(onBigChange, onMiddleChange, onSmallChange) {
    return {
      onBigCategoryChange: (value, item) => {
        if (onBigChange) onBigChange(value, item);
      },
      
      onMiddleCategoryChange: (value, bigValue, item) => {
        if (onMiddleChange) onMiddleChange(value, bigValue, item);
      },
      
      onSmallCategoryChange: (value, bigValue, middleValue, item) => {
        if (onSmallChange) onSmallChange(value, bigValue, middleValue, item);
      }
    };
  }

  /**
   * カテゴリーに基づいてプロンプトを検索
   * 編集タブの小項目変更時に使用
   */
  findPromptByCategory(big, middle, small) {
    if (!big || !middle || !small) {
      return null;
    }
    
    // ローカル辞書から検索（優先）
    const localResult = AppState.data.localPromptList.find(item => 
      item.data[0] === big && item.data[1] === middle && item.data[2] === small
    );
    
    if (localResult) {
      return localResult.prompt;
    }
    
    // マスター辞書から検索
    const masterData = getMasterPrompts();
    const masterResult = masterData.find(item => 
      item.data[0] === big && item.data[1] === middle && item.data[2] === small
    );
    
    return masterResult?.prompt || null;
  }

  /**
   * プロンプトに基づいてカテゴリーを検索（共通化された逆検索機能）
   * edit-handler.jsとedit-tab.jsで使用される共通機能
   */
  findCategoryByPrompt(promptValue) {
    if (!promptValue || !promptValue.trim()) {
      return null;
    }
    
    // promptValueが文字列でない場合の安全性チェック
    if (typeof promptValue !== 'string') {
      console.warn('[CategoryUIManager] findCategoryByPrompt called with non-string value:', {
        type: typeof promptValue,
        value: promptValue
      });
      return null;
    }
    
    const trimmedPrompt = promptValue.trim().toLowerCase();
    
    // 共通のカテゴリー検索ロジック
    const findCategory = (dataList, dataSource = 'unknown') => {
      const found = dataList.find((dicData, index) => {
        // 安全性チェック: promptが文字列であることを確認
        if (!dicData || !dicData.prompt || typeof dicData.prompt !== 'string') {
          // デバッグ用ログ（無効なデータ構造の場合）
          if (dicData && typeof dicData.prompt !== 'string' && dicData.prompt != null) {
            console.warn(`[CategoryUIManager] Invalid prompt type in ${dataSource} at index ${index}:`, {
              type: typeof dicData.prompt,
              value: dicData.prompt,
              fullItem: dicData,
              expectedString: promptValue
            });
          }
          return false;
        }
        const normalizedPrompt = dicData.prompt.toLowerCase().trim();
        return normalizedPrompt === trimmedPrompt;
      });
      return found?.data || null;
    };

    // ローカル辞書を優先してチェック
    const localResult = findCategory(AppState.data.localPromptList || [], 'localPromptList');
    const masterResult = localResult || findCategory(getMasterPrompts() || [], 'masterPrompts');
    
    return masterResult;
  }

  /**
   * デバッグ情報を出力
   */
  debug() {
    console.group('[CategoryUIManager] Debug Info');
    console.log('Available configs:', Object.keys(this.chainConfigs));
    console.log('Category data stats:', window.categoryData?.getStats());
    console.groupEnd();
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.CategoryUIManager = CategoryUIManager;
}