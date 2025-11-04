// ============================================
// 編集ハンドラークラス
// ============================================
class EditHandler {
  constructor(app) {
    this.app = app; // PromptGeneratorAppインスタンスへの参照
    // 翻訳中のアイテムを管理するセット
    this.translatingItems = new Set();
    // 翻訳結果キャッシュ
    this.translationCache = new Map();
    // 翻訳状態の定数（app-constants.jsから使用）
  }

  /**
   * UIタイプ変更時の処理
   * @param {Event} event - 変更イベント
   */
  handleUITypeChange(event) {
    const selectedValue = event.target.value;
    AppState.userSettings.optionData.shaping = selectedValue;

    // プロンプトを再生成
    editPrompt.generate();
    this.app.updatePromptDisplay();

    this.initializeEditMode();
    saveOptionData();
  }

  /**
   * 編集タイプ変更時の処理
   * @param {Event} event - 変更イベント
   */
  handleEditTypeChange(event) {
    const selectedValue = event.target.value;
    AppState.userSettings.optionData.editType = selectedValue;

    saveOptionData();

    // プロンプトを再生成して記法を更新
    editPrompt.generate();
    this.app.updatePromptDisplay();

    this.initializeEditMode();
  }

  /**
   * 編集モードを初期化
   */
  initializeEditMode() {
    // 抽出モードのスロットの場合は初期化しない
    if (typeof promptSlotManager !== 'undefined' && promptSlotManager.slots) {
      const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
      if (currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential")) {
        console.log(`[EditHandler] 抽出モードのスロットなのでinitializeEditModeをスキップ`);
        return;
      }
    }
    
    // 編集タブでは常に重み記法を含まない生のプロンプトを使用
    let currentPrompt = "";
    
    // スロットマネージャーから現在のスロットの生プロンプトを取得
    if (window.promptSlotManager && window.promptSlotManager.slots) {
      const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
      if (currentSlot && currentSlot.prompt) {
        currentPrompt = currentSlot.prompt;
      }
    }
    
    // スロットが空の場合のみGeneratePromptフィールドを参照（後方互換性）
    if (!currentPrompt) {
      const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      currentPrompt = generatePrompt ? generatePrompt.value : "";
    }

    if (currentPrompt && currentPrompt !== promptEditor.prompt) {
      promptEditor.init(currentPrompt);
    }

    this.refreshEditList();
  }

  /**
   * 編集リストを更新
   */
  async refreshEditList() {
    const editType = AppState.userSettings.optionData.editType;
    
    // 配列の整合性を確保（スパース配列修正）
    editPrompt.ensureArrayIntegrity();
    
    // sort値の整合性を確保（重複防止）
    editPrompt.ensureSortIntegrity();
    
    // sort プロパティで並び替えた要素を渡す
    const sortedElements = [...editPrompt.elements].sort(
      (a, b) => (a.sort || 0) - (b.sort || 0)
    );
    
    // 選択編集モードの場合はカテゴリーデータを準備
    if (editType === CONSTANTS.EDIT_TYPES.SELECT) {
      // editPrompt.elementsを直接更新（enrichedElementsは使わない）
      sortedElements.forEach(element => {
        // 初期値の設定（翻訳中状態は翻訳開始時に設定）
        if (!element.data) {
          element.data = ["", "", ""]; // 空状態で初期化
        }
      });

      // 統一されたリフレッシュメソッドを使用
      console.log('[REFRESH_TRACE] EditHandler calling refreshEditList from refreshEditList method');
      console.trace('[REFRESH_TRACE] Stack trace from EditHandler.refreshEditList');
      await this.app.tabs.edit.refreshEditList();
      
      // DOM生成後にカテゴリー検索・翻訳処理を実行
      await this.processCategoryDataAfterDOMGeneration(sortedElements);
    } else {
      // テキスト編集モード専用処理（統一されたリフレッシュメソッドを使用）
      console.log('[REFRESH_TRACE] EditHandler calling refreshEditList from text edit mode');
      console.trace('[REFRESH_TRACE] Stack trace from EditHandler text edit mode');
      await this.app.tabs.edit.refreshEditList();
    }
  }

  /**
   * DOM生成後にカテゴリーデータを処理
   * @param {Array} elements - 処理対象の要素配列
   */
  async processCategoryDataAfterDOMGeneration(elements) {
    // DOM生成完了を待機
    await this.waitForDOMGeneration();
    
    // 各要素のカテゴリー検索・翻訳処理を実行（初期化フラグをfalseに変更）
    // 非同期処理に変更（並列処理で高速化）
    const processingPromises = elements.map(element => 
      this.processSingleElementCategoryAndTranslation(element, element.Value, false)
    );
    
    try {
      await Promise.all(processingPromises);
    } catch (error) {
      console.error('[EditHandler] Error in parallel category processing:', error);
    }
  }

  /**
   * DOM生成完了を待機
   */
  async waitForDOMGeneration() {
    return new Promise(resolve => {
      const checkDOM = () => {
        const editList = document.querySelector('#editList-list');
        const hasRows = editList && editList.children.length > 1; // ヘッダー除く
        
        if (hasRows) {
          // さらに10ms待機してDOM安定化を確保
          setTimeout(resolve, 10);
        } else {
          setTimeout(checkDOM, 5);
        }
      };
      checkDOM();
    });
  }

  /**
   * 翻訳中かどうかをチェック
   * @param {string} prompt - チェックするプロンプト
   * @returns {boolean} 翻訳中かどうか
   */
  isTranslating(prompt) {
    return this.translatingItems.has(prompt) || this.translationCache.has(prompt);
  }

  /**
   * 単一要素のカテゴリー検索・翻訳処理（根本修正版）
   * CategoryDataSyncManagerを使用した統一同期処理
   * @param {Object} element - 処理対象の要素
   * @param {string} promptValue - プロンプト値
   * @param {boolean} isInitialization - 初期化時かどうか
   */
  async processSingleElementCategoryAndTranslation(element, promptValue, isInitialization = false) {
    if (AppState.config.debugMode) {
      console.log(`[EditHandler] processSingleElementCategoryAndTranslation called for prompt: "${promptValue}", isInitialization: ${isInitialization}`);
    }
    
    if (!promptValue || !promptValue.trim()) {
      console.log(`[EditHandler] Empty prompt, skipping processing`);
      return;
    }

    const elementId = element.id;
    
    // **修正**: DOM上の翻訳中状態やカテゴリチェイン中の値をチェック
    let shouldSkipCategorySearch = false;
    
    if (!isInitialization && elementId !== undefined && window.categoryDataSync) {
      // DOM上の最新値を取得
      const currentCategoryData = window.categoryDataSync.getCurrentDOMValues(elementId);
      
      // 翻訳中状態や明示的にカテゴリが設定済みの場合のみスキップ
      if (currentCategoryData && currentCategoryData.length >= 3) {
        const [cat0, cat1, cat2] = currentCategoryData;
        
        // 翻訳中状態の場合はスキップ（翻訳完了は除く）
        if (cat0 === '翻訳中' || cat0 === '翻訳失敗') {
          shouldSkipCategorySearch = true;
          if (AppState.config.debugMode) {
            console.log(`[EditHandler] Skipping category search - translation state: ${cat0}`);
          }
        }
        // 翻訳完了の場合は、翻訳されたプロンプトに対して逆検索を実行
        else if (cat0 === '翻訳完了') {
          if (AppState.config.debugMode) {
            console.log(`[EditHandler] Translation completed - will perform category search on translated prompt: "${promptValue}"`);
          }
          // shouldSkipCategorySearch = falseのまま（逆検索を実行）
        }
        
        
        if (shouldSkipCategorySearch) {
          // 全データソースを統一同期
          await window.categoryDataSync.syncAllSources(elementId, currentCategoryData, {
            caller: 'edit-handler-existing-data'
          });
          return; // 処理完了
        }
      }
    }

    // DOM上にデータがない場合、または初期化時はカテゴリ検索を実行
    let category = null;
    if (window.CategoryUIManager) {
      const categoryUIManager = new CategoryUIManager();
      
      category = categoryUIManager.findCategoryByPrompt(promptValue);
    } else {
      console.warn('[EditHandler] CategoryUIManager not available');
    }
    

    if (category) {
      // カテゴリーが見つかった場合、統一同期で設定
      if (elementId !== undefined && window.categoryDataSync) {
        await window.categoryDataSync.syncAllSources(elementId, category, {
          caller: 'edit-handler-category-found'
        });
      } else {
        // フォールバック：直接設定
        element.data = category;
      }
      
      // 翻訳完了後にカテゴリが見つかった場合、翻訳状態をクリア
      const currentData = window.categoryDataSync?.getCurrentDOMValues(elementId);
      if (currentData && currentData[0] === '翻訳完了') {
        // EditElementManagerで翻訳状態をクリア
        if (window.editElementManager && elementId !== undefined) {
          await window.editElementManager.updateCategoryOnly(elementId, category);
        }
      }
      
    } else {
      // 初期化時のコメント（翻訳中状態は翻訳開始時に設定）
      // カテゴリーが見つからない場合は翻訳処理を実行
      console.log(`[EditHandler] No category found, starting translation process`);
      
      const prompt = promptValue.toLowerCase().trim();
      
      // 翻訳条件をチェック
      if (!Validators.Quick.isValidCategoryPromptPair(null, prompt)) {
        console.log(`[EditHandler] Prompt does not require translation`);
        return;
      }

      if (this.translationCache.has(prompt)) {
        // キャッシュされた翻訳結果を適用
        const cachedResult = this.translationCache.get(prompt);
        const isAlphanumeric = /^[a-zA-Z0-9\s:]+$/.test(prompt);
        if (isAlphanumeric) {
          element.data = [TRANSLATION_STATES.COMPLETED, TRANSLATION_STATES.SOURCES.GOOGLE, cachedResult];
        } else {
          element.Value = cachedResult;
          element.data = [TRANSLATION_STATES.COMPLETED, TRANSLATION_STATES.SOURCES.GOOGLE, prompt];
        }
        
        // キャッシュ適用後にDOM更新（リフレッシュなし）- EditElementManagerを使用
        const cachedElementId = element.id;
        if (cachedElementId !== undefined && window.editElementManager) {
          window.editElementManager.updateCategoryOnly(cachedElementId, element.data);
        }
        
      } else if (!this.translatingItems.has(prompt)) {
        // 初期化時は常に翻訳を開始、編集時はユーザーが入力中でないことを確認
        const isTyping = isInitialization ? false : this.isUserCurrentlyTyping();
        
        if (!isTyping) {
          console.log('[EditHandler] Setting translation state for:', prompt);
          
          // 同じプロンプトを持つ全ての要素を「翻訳中」状態に設定
          if (editPrompt && editPrompt.elements) {
            editPrompt.elements.forEach((el) => {
              // 編集タブ要素のプロンプト値を正しく取得（Valueプロパティを使用）
              const elPromptValue = (el.Value || '').toLowerCase().trim();
              if (elPromptValue === prompt) {
                // 翻訳中状態に設定
                el.data = [...TRANSLATION_STATES.IN_PROGRESS];
                console.log(`[EditHandler] Set translation state for element ID ${el.id} with prompt: "${prompt}"`);
                
                // EditElementManagerでDOM更新（初期化時以外）
                if (!isInitialization && window.editElementManager && el.id !== undefined) {
                  window.editElementManager.setTranslationStartState(el.id);
                }
              }
            });
          }
          
          // 翻訳処理を実行（コールバックなしで全体リフレッシュを使用）
          this.translateElementAsync(element, prompt, null);
        }
      } else {
        // 翻訳中の場合、この要素も翻訳中状態にする
        console.log(`[EditHandler] Translation already in progress for "${prompt}", setting this element to translation state`);
        element.data = [...TRANSLATION_STATES.IN_PROGRESS];
        
        // EditElementManagerでDOM更新（初期化時以外）
        if (!isInitialization && window.editElementManager && element.id !== undefined) {
          window.editElementManager.setTranslationStartState(element.id);
        }
      }
    }
  }

  /**
   * 要素の非同期翻訳処理
   * @param {Object} element - 翻訳対象の要素（参照用、実際の更新は配列インデックスで行う）
   * @param {string} prompt - 翻訳するプロンプト
   * @param {Function} onComplete - 翻訳完了時のコールバック（オプション）
   * @param {number} elementIndex - 要素のインデックス（単一要素更新用）
   */
  async translateElementAsync(element, prompt, onComplete = null, elementIndex = null) {
    // 重複チェック
    if (this.translatingItems.has(prompt)) {
      return;
    }
    
    // 翻訳開始時に「翻訳中」状態を設定
    element.data = [...TRANSLATION_STATES.IN_PROGRESS];
    console.log(`[EditHandler] Setting translation state for prompt: "${prompt}"`);
    
    this.translatingItems.add(prompt);
    try {
      console.log(`[EditHandler] Starting translation for prompt: "${prompt}"`);
      console.log(`[EditHandler] Initial element state:`, {
        id: element.id,
        data: element.data,
        Value: element.Value
      });
      
      // 翻訳APIを呼び出し（DeepL優先、フォールバックでGoogle翻訳）
      // deeplAuth と deeplAuthKey の両方をサポート（互換性のため）
      const hasDeeplKey = AppState.userSettings.optionData?.deeplAuth ||
                          AppState.userSettings.optionData?.deeplAuthKey;
      const translateFunc = hasDeeplKey ? translateDeepl : translateGoogle;
      const translationService = hasDeeplKey ? 'DeepL' : 'Google';

      console.log(`[EditHandler] Using ${translationService} translation service`);

      await translateFunc(prompt, (translationResult) => {
        console.log(`[EditHandler] Translation result received:`, translationResult);
        
        // Google翻訳の結果は配列で返される
        if (translationResult && Array.isArray(translationResult) && translationResult.length > 0) {
          const translatedText = translationResult[0];
          console.log(`[EditHandler] Translation successful: "${prompt}" -> "${translatedText}"`);
          
          // 翻訳完了処理
          this.translatingItems.delete(prompt);
          this.translationCache.set(prompt, translatedText);
          
          // 同じプロンプトを持つ全ての要素を検索して更新
          const matchingElements = [];
          if (editPrompt && editPrompt.elements) {
            editPrompt.elements.forEach((el, index) => {
              // 編集タブ要素のプロンプト値を正しく取得（Valueプロパティを使用）
              const elPromptValue = (el.Value || '').toLowerCase().trim();
              if (elPromptValue === prompt && el.data && el.data[0] === '翻訳中') {
                matchingElements.push({ element: el, index: index });
              }
            });
          }
          
          console.log(`[EditHandler] Found ${matchingElements.length} elements with matching prompt "${prompt}" in translation state`);
          
          if (matchingElements.length > 0 && window.editElementManager) {
            // 翻訳結果の設定
            const isAlphanumeric = /^[a-zA-Z0-9\s:]+$/.test(prompt);
            const translationResultData = {
              isAlphanumeric,
              translatedText,
              originalPrompt: prompt
            };
            
            console.log(`[EditHandler] Setting translation complete state for ${matchingElements.length} elements - isAlphanumeric: ${isAlphanumeric}`);
            
            // 全ての該当要素を更新
            matchingElements.forEach(({ element: currentElement, index }, idx) => {
              const currentElementId = currentElement.id;
              
              if (onComplete && idx === 0) {
                // 単一要素更新用のコールバックがある場合は最初の要素にのみ使用
                console.log(`[EditHandler] Calling onComplete callback for first element:`, currentElementId);
                setTimeout(() => {
                  onComplete(currentElement);
                }, UI_DELAYS.TRANSLATION_CALLBACK);
              } else {
                // EditElementManagerによる統一更新
                setTimeout(async () => {
                  try {
                    if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
                      console.log(`[EditHandler] Updating translation complete state for element ${currentElementId} (${idx + 1}/${matchingElements.length})`);
                      await window.editElementManager.setTranslationCompleteState(currentElementId, translationResultData);
                    }
                  } catch (error) {
                    console.error(`Failed to update element ${currentElementId} after translation:`, error);
                  }
                }, UI_DELAYS.TRANSLATION_CALLBACK + (idx * 50)); // 少し遅延をずらして順次更新
              }
            });
          }
          
        } else {
          // 翻訳失敗時の処理
          console.log(`[EditHandler] Translation failed - no valid result:`, translationResult);
          this.translatingItems.delete(prompt);
          if (element.data && element.data[0] === '翻訳中') {
            element.data = ['翻訳失敗', 'エラー', ''];
            
            // editPrompt.elementsの実際のデータも更新
            const elementIndex = editPrompt.elements.findIndex(el => el.id === element.id);
            if (elementIndex !== -1) {
              editPrompt.elements[elementIndex].data = element.data;
            }
            
            // 翻訳失敗後の処理
            if (onComplete) {
              setTimeout(() => {
                onComplete(element);
              }, UI_DELAYS.TRANSLATION_CALLBACK);
            } else {
              setTimeout(async () => {
                try {
                  if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
                    console.log('[EditHandler] Translation failure handled - external refresh may be needed');
                  }
                } catch (error) {
                  console.error('Failed to update element after translation failure:', error);
                }
              }, UI_DELAYS.TRANSLATION_CALLBACK);
            }
          }
        }
      });
    } catch (error) {
      console.error(`[EditHandler] Translation error for "${prompt}":`, error);
      // エラー時の処理
      this.translatingItems.delete(prompt);
      if (element.data && element.data[0] === '翻訳中') {
        element.data = ['翻訳エラー', 'システムエラー', ''];
        
        // editPrompt.elementsの実際のデータも更新
        const elementIndex = editPrompt.elements.findIndex(el => el.id === element.id);
        if (elementIndex !== -1) {
          editPrompt.elements[elementIndex].data = element.data;
        }
        
        // エラー後の処理
        if (onComplete) {
          setTimeout(() => {
            onComplete(element);
          }, UI_DELAYS.TRANSLATION_CALLBACK);
        } else {
          setTimeout(async () => {
            try {
              if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
                console.log('[EditHandler] Translation error handled - external refresh may be needed');
              }
            } catch (error) {
              console.error('Failed to update element after translation error:', error);
            }
          }, UI_DELAYS.TRANSLATION_CALLBACK);
        }
      }
    }
  }

  /**
   * ユーザーが現在入力中かどうかを判定
   * @returns {boolean} 入力中の場合true
   */
  isUserCurrentlyTyping() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'INPUT' && 
        activeElement.type === 'text' &&
        activeElement.classList.contains('prompt-list-input')) {
      // プロンプト入力フィールドにフォーカスがある場合は入力中と判定
      return true;
    }
    return false;
  }

}

// グローバルに公開
if (typeof window !== "undefined") {
  window.EditHandler = EditHandler;
}
