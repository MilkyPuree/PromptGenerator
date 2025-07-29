/**
 * element-registration.js - 要素登録の共通処理
 * 検索タブの要素追加とRegボタンで使用される共通機能
 */

/**
 * 要素登録処理の共通ユーティリティ
 */
const ElementRegistration = {
  /**
   * 要素を登録して後処理を実行（ListRefreshManager使用）
   * @param {Object} data - 登録データ
   * @param {string} data.big - 大項目
   * @param {string} data.middle - 中項目  
   * @param {string} data.small - 小項目
   * @param {string} data.prompt - プロンプト
   * @param {Object} options - オプション
   * @param {string} options.action - アクション種別（デフォルト: ELEMENT_ADD）
   * @param {string} options.sourceList - 発信元リスト（除外対象）
   * @param {Function} options.onSuccess - 成功時のコールバック
   * @param {Function} options.onError - エラー時のコールバック
   * @returns {Promise<boolean>} 登録成功かどうか
   */
  async registerElement(data, options = {}) {
    // デフォルトオプション
    const opts = {
      action: ListRefreshManager.ACTIONS.ELEMENT_ADD,
      sourceList: null,
      onSuccess: null,
      onError: null,
      ...options
    };

    try {
      // 登録実行
      const success = register(data.big, data.middle, data.small, data.prompt);
      
      if (success) {
        // ListRefreshManagerを使用してリフレッシュ
        await ListRefreshManager.executeAction(opts.action, {
          sourceList: opts.sourceList,
          context: { registeredData: data },
          delay: ADDITIONAL_DELAYS.STANDARD_REFRESH,
          showNotification: true
        });

        // 成功時のコールバック
        if (opts.onSuccess) {
          opts.onSuccess(data);
        }

        return true;
      } else {
        // 登録失敗
        ErrorHandler.notify("要素の追加に失敗しました", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "error",
          duration: 2000,
        });

        // エラー時のコールバック
        if (opts.onError) {
          opts.onError(new Error("Registration failed"));
        }

        return false;
      }
    } catch (error) {
      console.error("ElementRegistration error:", error);
      
      // エラー通知
      ErrorHandler.notify("要素の追加中にエラーが発生しました", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
        duration: 2000,
      });

      // エラー時のコールバック
      if (opts.onError) {
        opts.onError(error);
      }

      return false;
    }
  },


  /**
   * 検索タブの要素追加フォーム専用の登録処理
   * フォームの入力値クリア、フォーカス制御、カテゴリードロップダウン復元も含む
   * @param {Object} formElements - フォーム要素
   * @param {HTMLElement} formElements.bigInput - 大項目入力
   * @param {HTMLElement} formElements.middleInput - 中項目入力
   * @param {HTMLElement} formElements.smallInput - 小項目入力
   * @param {HTMLElement} formElements.promptInput - プロンプト入力
   * @param {Object} categoryState - カテゴリー状態保存用
   * @returns {Promise<boolean>} 登録成功かどうか
   */
  async registerFromForm(formElements, categoryState = {}) {
    const { bigInput, middleInput, smallInput, promptInput } = formElements;

    // 入力データを取得
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
      return false;
    }

    const categoryValidation = Validators.validateCategories(data);
    if (!categoryValidation.isValid) {
      ErrorHandler.notify(categoryValidation.errors[0].message);
      return false;
    }

    // 登録実行（ListRefreshManagerを使用）
    const success = await this.registerElement(data, {
      action: ListRefreshManager.ACTIONS.ELEMENT_ADD,
      onSuccess: () => {
        // 入力フィールドをクリア
        if (bigInput) bigInput.value = "";
        if (middleInput) middleInput.value = "";
        if (smallInput) smallInput.value = "";
        if (promptInput) promptInput.value = "";

        // プロンプト入力にフォーカスを戻す
        if (promptInput) {
          promptInput.focus();
        }

        // カテゴリードロップダウンの復元処理
        if (data.big || data.middle) {
          this.restoreCategoryDropdowns(categoryState);
        }
      }
    });

    return success;
  },

  /**
   * カテゴリードロップダウンの状態を復元
   * @param {Object} categoryState - 保存されたカテゴリー状態
   */
  restoreCategoryDropdowns(categoryState) {
    if (!categoryState.savedCat0Value) return;

    setTimeout(() => {
      const searchCat0 = document.querySelector(DOM_SELECTORS.BY_ID.SEARCH_CAT0);
      const searchCat1 = document.querySelector(DOM_SELECTORS.BY_ID.SEARCH_CAT1);
      
      if (searchCat0 && categoryState.savedCat0Value) {
        searchCat0.value = categoryState.savedCat0Value;
        
        // 中項目も復元
        if (categoryState.savedCat0Value && categoryState.savedCat1Value) {
          // SearchTabのupdateCategoryDropdownメソッドを呼び出し
          if (window.app && window.app.searchTab && window.app.searchTab.updateCategoryDropdown) {
            window.app.searchTab.updateCategoryDropdown(1, categoryState.savedCat0Value);
            setTimeout(() => {
              if (searchCat1) {
                searchCat1.value = categoryState.savedCat1Value;
              }
            }, ADDITIONAL_DELAYS.SHORT_DELAY);
          }
        }
      }
    }, ADDITIONAL_DELAYS.REFRESH_DELAY); // categoryData.update()の500ms + 余裕
  },

  /**
   * 翻訳結果のReg専用の登録処理
   * @param {Object} item - 翻訳結果アイテム
   * @returns {Promise<boolean>} 登録成功かどうか
   */
  async registerFromTranslation(item) {
    // 翻訳結果の安全性チェック
    let safePrompt = item.prompt || "";
    if (typeof safePrompt !== 'string') {
      console.warn('[ElementRegistration] Translation prompt is not a string:', {
        type: typeof safePrompt,
        value: safePrompt,
        item: item
      });
      
      // オブジェクトの場合、適切なプロパティから文字列を抽出
      if (typeof safePrompt === 'object' && safePrompt !== null) {
        if (safePrompt.text) {
          safePrompt = String(safePrompt.text);
        } else if (safePrompt.value) {
          safePrompt = String(safePrompt.value);
        } else if (safePrompt.toString && typeof safePrompt.toString === 'function') {
          safePrompt = safePrompt.toString();
        } else {
          safePrompt = String(safePrompt);
        }
      } else {
        safePrompt = String(safePrompt);
      }
      
      console.log(`[ElementRegistration] Converted translation prompt to string: "${safePrompt}"`);
    }
    
    const data = {
      big: item.data[0] || "",
      middle: item.data[1] || "",
      small: item.data[2] || "",
      prompt: safePrompt
    };

    // 翻訳結果登録アクションを実行
    const success = await this.registerElement(data, {
      action: ListRefreshManager.ACTIONS.TRANSLATION_REG,
      sourceList: ListRefreshManager.LISTS.SEARCH_RESULTS // 翻訳結果は検索結果から来るので除外
    });

    return success;
  }
};

// グローバルに公開
if (typeof window !== "undefined") {
  window.ElementRegistration = ElementRegistration;
}