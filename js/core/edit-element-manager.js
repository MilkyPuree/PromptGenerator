/**
 * EditElementManager - 編集タブの要素更新を統一管理
 * 
 * 【解決する問題】
 * - DOM更新処理の分散
 * - 状態管理の分裂（data, DOM, フィールド状態）
 * - インデックス/ID の混在
 * - 非同期処理の複雑化
 * 
 * 【統一する処理】
 * - editPrompt.elements の更新
 * - DOM の更新  
 * - フィールド状態の更新
 * - プロンプト表示の更新
 */

class EditElementManager {
  constructor(app) {
    this.app = app;
    this.pendingUpdates = new Map(); // 遅延更新の管理
    this.updateQueue = new Set(); // 更新キューの重複防止
  }

  /**
   * 要素データの統一更新
   * @param {string|number} elementId - 要素ID
   * @param {Object} updates - 更新内容
   * @param {Array} [updates.data] - カテゴリデータ [big, middle, small]
   * @param {string} [updates.prompt] - プロンプト値
   * @param {Object} [updates.weight] - 重み値
   * @param {Object} options - オプション
   * @param {boolean} [options.preserveFocus=true] - フォーカス保持
   * @param {boolean} [options.updateFieldStates=true] - フィールド状態更新
   * @param {boolean} [options.updatePromptDisplay=true] - プロンプト表示更新
   * @param {number} [options.delay=0] - 更新遅延（ms）
   * @returns {Promise<boolean>} 更新成功の可否
   */
  async updateElement(elementId, updates, options = {}) {
    const config = {
      preserveFocus: true,
      updateFieldStates: true,
      updatePromptDisplay: true,
      delay: 0,
      ...options
    };

    try {
      // 遅延更新の場合
      if (config.delay > 0) {
        return this.scheduleDelayedUpdate(elementId, updates, config);
      }

      // 即座更新の場合
      return await this.executeUpdate(elementId, updates, config);

    } catch (error) {
      console.error(`[EditElementManager] Error updating element ${elementId}:`, error);
      return false;
    }
  }

  /**
   * 即座更新の実行
   */
  async executeUpdate(elementId, updates, config) {
    if (AppState.config.debugMode) {
      console.log(`[EditElementManager] Updating element ${elementId}:`, updates);
    }

    // 1. データ層の更新
    const elementIndex = this.updateDataLayer(elementId, updates);
    if (elementIndex === -1) {
      console.warn(`[EditElementManager] Element not found: ${elementId}`);
      return false;
    }

    // 2. DOM層の更新
    const domSuccess = this.updateDOMLayer(elementId, updates, config);
    if (!domSuccess) {
      console.warn(`[EditElementManager] DOM update failed: ${elementId}`);
      return false;
    }

    // 3. プロンプト表示の更新
    if (config.updatePromptDisplay && updates.prompt !== undefined) {
      this.updatePromptDisplay();
    }

    // 4. フィールド状態の更新（readonly等）
    if (config.updateFieldStates) {
      this.scheduleFieldStateUpdate();
    }

    console.log(`[EditElementManager] Successfully updated element ${elementId}`);
    return true;
  }

  /**
   * データ層（editPrompt.elements）の更新
   */
  updateDataLayer(elementId, updates) {
    const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) {
      return -1;
    }

    const element = editPrompt.elements[elementIndex];

    // カテゴリデータの更新
    if (updates.data) {
      // 読み取り専用配列の場合は新しい配列を作成
      element.data = [
        updates.data[0] || '',
        updates.data[1] || '',
        updates.data[2] || ''
      ];
      
      if (AppState.config.debugMode) {
        console.log(`[EditElementManager] Updated element data:`, {
          elementId: elementId,
          newData: element.data
        });
      }
    }

    // プロンプト値の更新
    if (updates.prompt !== undefined) {
      element.Value = updates.prompt;
      element.value = updates.prompt; // 小文字のvalueも更新
      element.prompt = updates.prompt; // promptプロパティも更新
      
      // 重み値関連の更新（editingValueの代わりに直接更新）
      const currentNotation = AppState.userSettings?.optionData?.shaping || 'None';
      if (currentNotation === 'SD' && element.SD) {
        element.SD.value = promptEditor.getValue("SD", updates.prompt, element.SD.weight);
      } else if (currentNotation === 'NAI' && element.NAI) {
        element.NAI.value = promptEditor.getValue("NAI", updates.prompt, element.NAI.weight);
      }
    }

    // 重み値の更新
    if (updates.weight !== undefined) {
      // 重み値の処理は既存ロジックを使用
      // TODO: 重み値更新の実装
    }

    return elementIndex;
  }

  /**
   * DOM層の更新
   */
  updateDOMLayer(elementId, updates, config) {
    if (!this.app.listManager) {
      console.warn(`[EditElementManager] ListManager not available`);
      return false;
    }

    // DOM更新用のフィールドマップを作成
    const domUpdates = {};

    if (updates.data) {
      domUpdates['data.0'] = updates.data[0] || '';
      domUpdates['data.1'] = updates.data[1] || '';
      domUpdates['data.2'] = updates.data[2] || '';
    }

    if (updates.prompt !== undefined) {
      domUpdates.prompt = updates.prompt;
    }

    if (updates.weight !== undefined) {
      domUpdates.weight = updates.weight;
    }

    // DOM要素の存在確認
    if (!this.isDOMElementReady(elementId)) {
      console.warn(`[EditElementManager] DOM element not ready for element ${elementId}, skipping DOM update`);
      return false;
    }

    // DOM更新実行（安全性チェック付き）
    try {
      return this.app.listManager.updateSingleElement(
        DOM_SELECTORS.BY_ID.EDIT_LIST,
        elementId,
        domUpdates,
        {
          preserveFocus: config.preserveFocus,
          preventEvents: true,
          searchMode: 'id'
        }
      );
    } catch (error) {
      console.warn(`[EditElementManager] DOM update failed for element ${elementId}, DOM may not be ready:`, error);
      
      // DOM生成待機して再試行
      setTimeout(() => {
        try {
          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            elementId,
            domUpdates,
            {
              preserveFocus: config.preserveFocus,
              preventEvents: true,
              searchMode: 'id'
            }
          );
          console.log(`[EditElementManager] DOM update retry succeeded for element ${elementId}`);
        } catch (retryError) {
          console.warn(`[EditElementManager] DOM update retry also failed for element ${elementId}:`, retryError);
        }
      }, 100);
      
      return false; // 初回は失敗として扱う
    }
  }

  /**
   * プロンプト表示の更新
   */
  updatePromptDisplay() {
    if (window.app && window.app.updatePromptDisplay) {
      window.app.updatePromptDisplay();
    }
  }

  /**
   * フィールド状態の更新（readonly等の再評価）
   */
  scheduleFieldStateUpdate(delay = 50) {
    // 重複実行防止
    if (this.updateQueue.has('fieldStates')) {
      return;
    }

    this.updateQueue.add('fieldStates');

    setTimeout(() => {
      try {
        // 編集タブのすべての要素のreadonly状態を再評価
        if (this.app && this.app.listManager) {
          console.log(`[EditElementManager] Re-evaluating readonly states for all elements`);
          this.app.listManager.updateAllElementsReadonlyState(DOM_SELECTORS.BY_ID.EDIT_LIST);
        }
      } catch (error) {
        console.error(`[EditElementManager] Error updating field states:`, error);
      }
      
      console.log(`[EditElementManager] Field states update completed`);
      this.updateQueue.delete('fieldStates');
    }, delay);
  }

  /**
   * 翻訳開始時のフィールド非活性化（確実に動作する直接DOM操作）
   */
  setTranslationStartFieldStates(elementId, delay = 50) {
    // 重複実行防止
    const queueKey = `translationStart-${elementId}`;
    if (this.updateQueue.has(queueKey)) {
      return;
    }

    this.updateQueue.add(queueKey);

    setTimeout(() => {
      try {
        // DOM操作で翻訳開始時のフィールドを非活性化
        const listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (listContainer) {
          const elementContainer = listContainer.querySelector(`[data-element-id="${elementId}"]`);
          if (elementContainer) {
            // カテゴリフィールドを非活性化
            const categoryFields = elementContainer.querySelectorAll('input[data-field^="data."]');
            categoryFields.forEach(field => {
              field.setAttribute('readonly', 'true');
              field.disabled = true;
              field.classList.add('readonly-field');
              field.title = '翻訳中のため編集できません';
            });
            
            // Regボタンを非活性化
            const regButton = elementContainer.querySelector('button[data-action="register"]');
            if (regButton) {
              regButton.disabled = true;
              regButton.classList.add('button-disabled');
              regButton.title = '翻訳中のため登録できません';
              console.log(`[EditElementManager] Disabled register button for element ${elementId}`);
            }
            
            console.log(`[EditElementManager] Set translation start readonly state for element ${elementId}`);
          } else {
            console.warn(`[EditElementManager] Element container not found for ID: ${elementId}`);
          }
        } else {
          console.warn(`[EditElementManager] Edit list container not found`);
        }
      } catch (error) {
        console.error(`[EditElementManager] Error setting translation start field states for element ${elementId}:`, error);
      }
      
      this.updateQueue.delete(queueKey);
    }, delay);
  }

  /**
   * 特定要素のフィールド状態のみ更新（スクロール位置保持）
   */
  updateSingleElementFieldStates(elementId, delay = 50) {
    // 重複実行防止
    const queueKey = `fieldStates-${elementId}`;
    if (this.updateQueue.has(queueKey)) {
      return;
    }

    this.updateQueue.add(queueKey);

    setTimeout(() => {
      try {
        // DOM操作で翻訳完了後のフィールドを強制的に活性化
        const listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (listContainer) {
          const elementContainer = listContainer.querySelector(`[data-element-id="${elementId}"]`);
          if (elementContainer) {
            const categoryFields = elementContainer.querySelectorAll('input[data-field^="data."]');
            categoryFields.forEach(field => {
              // readonly状態を完全に解除
              field.removeAttribute('readonly');
              field.disabled = false;
              field.classList.remove('readonly-field');
              
              // titleも更新
              if (field.title && field.title.includes('翻訳中')) {
                field.title = field.title.replace('翻訳中', '翻訳完了');
              }
            });
            
            // Regボタンを活性化（状況に応じて）
            const regButton = elementContainer.querySelector('button[data-action="register"]');
            if (regButton) {
              // プロンプト値を取得してRegボタンの状態を正しく設定
              const promptField = elementContainer.querySelector('input[data-field="prompt"], textarea[data-field="prompt"]');
              const promptValue = promptField ? promptField.value : '';
              
              if (promptValue && typeof isPromptInDictionary === 'function') {
                const existsInDictionary = isPromptInDictionary(promptValue);
                
                regButton.disabled = existsInDictionary;
                regButton.classList.toggle('button-disabled', existsInDictionary);
                regButton.title = existsInDictionary ? '既に登録済みのため登録できません' : 'ローカル辞書に登録';
                
                console.log(`[EditElementManager] Set register button state: disabled=${existsInDictionary} for element ${elementId}`);
              } else {
                // フォールバック：活性化
                regButton.disabled = false;
                regButton.classList.remove('button-disabled');
                regButton.title = 'ローカル辞書に登録';
              }
            }
          }
        }
      } catch (error) {
        console.error(`[EditElementManager] Error updating field states for element ${elementId}:`, error);
      }
      
      this.updateQueue.delete(queueKey);
    }, delay);
  }

  /**
   * 特定要素のRegボタン状態のみ更新（スクロール位置保持）
   */
  updateSingleElementRegisterButton(elementId, delay = 50) {
    // 重複実行防止
    const queueKey = `regButton-${elementId}`;
    if (this.updateQueue.has(queueKey)) {
      return;
    }

    this.updateQueue.add(queueKey);

    setTimeout(() => {
      try {
        console.log(`[EditElementManager] Updating register button state for element ${elementId}`);
        
        // 要素データを取得
        const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
        if (elementIndex === -1) {
          console.warn(`[EditElementManager] Element not found for register button update: ${elementId}`);
          return;
        }
        
        const element = editPrompt.elements[elementIndex];
        const promptValue = element.Value || element.prompt || '';
        
        console.log(`[EditElementManager] Element data for button update:`, {
          elementId,
          promptValue,
          data: element.data,
          isTranslating: element.data && element.data[0] === '翻訳中'
        });
        
        // DOM操作でRegボタンの状態を更新
        const listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (listContainer) {
          const elementContainer = listContainer.querySelector(`[data-element-id="${elementId}"]`);
          if (elementContainer) {
            const regButton = elementContainer.querySelector('button[data-action="register"]');
            if (regButton) {
              console.log(`[EditElementManager] Found register button for element ${elementId}`);
              
              // 翻訳中の場合は無効化
              if (element.data && element.data[0] === '翻訳中') {
                regButton.disabled = true;
                regButton.title = "翻訳中のため登録できません";
                console.log(`[EditElementManager] Disabled register button - translation in progress`);
              } else {
                // ローカル辞書とマスター辞書の両方をチェック
                console.log(`[EditElementManager] Checking if prompt exists in dictionary: "${promptValue}"`);
                
                // DOM上のプロンプト値も確認
                const promptField = elementContainer.querySelector('input[data-field="prompt"], textarea[data-field="prompt"]');
                const domPromptValue = promptField ? promptField.value : '';
                console.log(`[EditElementManager] DOM prompt value: "${domPromptValue}"`);
                
                const existsInDictionary = isPromptInDictionary(promptValue);
                console.log(`[EditElementManager] isPromptInDictionary result: ${existsInDictionary} for prompt: "${promptValue}"`);
                
                // DOM上の値でも確認
                if (domPromptValue && domPromptValue !== promptValue) {
                  const domExistsInDictionary = isPromptInDictionary(domPromptValue);
                  console.log(`[EditElementManager] DOM value check: ${domExistsInDictionary} for DOM prompt: "${domPromptValue}"`);
                  // より新しいDOM値を優先
                  const finalExists = domExistsInDictionary;
                  console.log(`[EditElementManager] Using DOM value result: ${finalExists}`);
                  
                  regButton.disabled = finalExists;
                  if (finalExists) {
                    regButton.title = "既に登録済みのため登録できません";
                    regButton.classList.add('button-disabled');
                  } else {
                    regButton.title = "ローカル辞書に登録";
                    regButton.classList.remove('button-disabled');
                  }
                  console.log(`[EditElementManager] Set register button disabled=${finalExists} using DOM value for element ${elementId}`);
                  return;
                }
                
                // ボタンの更新処理
                let actualButton = regButton; // デフォルトは元のボタン
                
                regButton.disabled = existsInDictionary;
                if (existsInDictionary) {
                  regButton.title = "既に登録済みのため登録できません";
                  regButton.classList.add('button-disabled');
                  regButton.setAttribute('disabled', 'true');
                } else {
                  regButton.title = "ローカル辞書に登録";
                  regButton.classList.remove('button-disabled');
                  regButton.removeAttribute('disabled');
                  // JavaScriptプロパティを明示的にfalseに設定
                  regButton.disabled = false;
                  
                  // クリックハンドラーを正しく再設定（有効状態用）
                  // 既存のイベントリスナーをクリア
                  const newButton = regButton.cloneNode(true);
                  regButton.parentNode.replaceChild(newButton, regButton);
                  
                  // 新しいクリックハンドラーを設定
                  newButton.addEventListener('click', (event) => {
                    // UIFactoryと同じ無効状態チェック
                    if (newButton.disabled) {
                      event.preventDefault();
                      event.stopPropagation();
                      return false;
                    }
                    
                    console.log(`[EditElementManager] Register button clicked for element ${elementId}`);
                    
                    // 編集タブのonRegisterハンドラーを呼び出し
                    if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.handleRegisterClick) {
                      this.app.tabs.edit.handleRegisterClick(promptValue, element, elementIndex);
                    } else {
                      console.warn(`[EditElementManager] No register handler available`);
                    }
                  });
                  
                  // 有効状態では新しいボタンを参照
                  actualButton = newButton;
                  console.log(`[EditElementManager] Re-created register button with active click handler for element ${elementId}`);
                }
                
                console.log(`[EditElementManager] Set register button disabled=${existsInDictionary} for element ${elementId}`);
              }
              
            } else {
              console.warn(`[EditElementManager] Register button not found for element ${elementId}`);
              
              // Regボタンが見つからない場合は、ListManagerの汎用メソッドを使用
              if (this.app && this.app.listManager && this.app.listManager.updateRegisterButtonState) {
                console.log(`[EditElementManager] Using ListManager updateRegisterButtonState for element ${elementId}`);
                this.app.listManager.updateRegisterButtonState(DOM_SELECTORS.BY_ID.EDIT_LIST, elementId);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[EditElementManager] Error updating register button for element ${elementId}:`, error);
      }
      
      this.updateQueue.delete(queueKey);
    }, delay);
  }

  /**
   * 遅延更新のスケジュール
   */
  scheduleDelayedUpdate(elementId, updates, config) {
    // 既存の遅延更新をキャンセル
    if (this.pendingUpdates.has(elementId)) {
      clearTimeout(this.pendingUpdates.get(elementId));
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(async () => {
        this.pendingUpdates.delete(elementId);
        const result = await this.executeUpdate(elementId, updates, {
          ...config,
          delay: 0 // 遅延実行時は即座実行
        });
        resolve(result);
      }, config.delay);

      this.pendingUpdates.set(elementId, timeoutId);
    });
  }

  /**
   * カテゴリのみ更新（プロンプト保持）
   */
  async updateCategoryOnly(elementId, categoryData, options = {}) {
    return this.updateElement(elementId, { data: categoryData }, {
      updatePromptDisplay: false, // プロンプト表示は更新しない
      updateFieldStates: false, // スクロール位置保持のため無効化
      ...options
    });
  }

  /**
   * プロンプトのみ更新（カテゴリ保持）
   */
  async updatePromptOnly(elementId, promptValue, options = {}) {
    return this.updateElement(elementId, { prompt: promptValue }, {
      updateFieldStates: false, // スクロール位置保持のため無効化
      ...options
    });
  }

  /**
   * 翻訳開始状態の設定
   */
  async setTranslationStartState(elementId, options = {}) {
    console.log(`[EditElementManager] Setting translation start state for element ${elementId}`);
    
    const result = await this.updateElement(elementId, {
      data: ["翻訳中", "翻訳中", "翻訳中"]
    }, {
      updateFieldStates: false, // DOM更新のみ、フィールド状態は直接操作
      delay: 0,
      ...options
    });
    
    // 翻訳開始時は確実に動作する直接DOM操作を使用
    this.setTranslationStartFieldStates(elementId);
    
    return result;
  }

  /**
   * 翻訳完了状態の設定
   */
  async setTranslationCompleteState(elementId, translationResult, options = {}) {
    const { isAlphanumeric, translatedText, originalPrompt } = translationResult;

    const result = isAlphanumeric ? 
      // 英語の場合: カテゴリのみ更新、プロンプトは保持
      await this.updateElement(elementId, {
        data: ["翻訳完了", "Google翻訳", translatedText]
      }, {
        updatePromptDisplay: false, // プロンプトは変更しない
        updateFieldStates: false, // フィールド状態更新をスキップ（スクロール位置保持）
        ...options
      }) :
      // 日本語の場合: 翻訳結果をプロンプトに、元テキストを小項目に
      await this.updateElement(elementId, {
        data: ["翻訳完了", "Google翻訳", originalPrompt],
        prompt: translatedText
      }, {
        updateFieldStates: false, // フィールド状態更新をスキップ（スクロール位置保持）
        ...options
      });

    // 翻訳完了後にフィールド状態のみ更新（スクロール位置保持）
    this.updateSingleElementFieldStates(elementId, 100);
    
    // 翻訳完了後にRegボタンの状態を更新（全体リフレッシュ後に実行するため遅延）
    console.log(`[EditElementManager] Scheduling register button update for translation completion: ${elementId}`);
    this.updateSingleElementRegisterButton(elementId, 500);
    
    // 翻訳完了後は既にRegボタンの状態更新が完了しているため、追加のリフレッシュは不要
    // EditTabの軽量なupdateRegisterButtonStatesで十分に処理されている
    console.log(`[EditElementManager] Translation complete - no additional refresh needed (handled by lightweight button updates)`);
    
    // 日本語翻訳完了時のみプロンプトを再生成（編集タブの場合のみ）
    // 英語入力の場合はプロンプト自体は変更されないので再生成不要
    if (!isAlphanumeric && this.app?.tabs?.edit?.isActive && window.editPrompt && typeof window.editPrompt.generate === 'function') {
      console.log('[EditElementManager] Regenerating prompt after Japanese translation completion');
      window.editPrompt.generate();
    }
    
    return result;
  }

  /**
   * 要素の追加（スクロール位置保持 - リフレッシュ不要版）
   * @param {string} position - 追加位置 ('top' | 'bottom')
   * @param {string} value - 初期プロンプト値
   * @param {Object} options - オプション
   * @returns {Promise<string>} 追加された要素のID
   */
  async addElement(position = 'bottom', value = '', options = {}) {
    try {
      console.log(`[EditElementManager] Adding element at ${position} with value: "${value}" (no refresh)`);
      
      // リストが空かどうかを事前にチェック
      const wasEmpty = editPrompt.elements.length === 0;
      
      // 要素追加前にempty-stateが存在する場合は削除
      const editListContainer = document.querySelector('#editList');
      if (editListContainer) {
        const emptyStateMessage = editListContainer.querySelector('.empty-state-message');
        if (emptyStateMessage) {
          console.log(`[EditElementManager] Removing empty state before adding element`);
          emptyStateMessage.remove();
        }
      }
      
      // データ層に要素追加
      const addedElementId = editPrompt.addElement(position, value);
      
      // プロンプト表示を更新
      if (window.app && window.app.updatePromptDisplay) {
        window.app.updatePromptDisplay();
      }
      
      // 最初の1個目の場合はリフレッシュ、2個目以降は直接DOM追加
      if (wasEmpty) {
        console.log(`[EditElementManager] First element added - refreshing list to create proper headers`);
        // 編集タブのリフレッシュを実行（ヘッダーも含めて完全に再構築）
        if (this.app && this.app.tabs && this.app.tabs.edit) {
          await this.app.tabs.edit.refreshEditList();
        }
      } else {
        console.log(`[EditElementManager] Additional element added - using direct DOM addition`);
        // 編集タブの場合は個別DOM追加（リフレッシュなし）
        if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
          await this.addElementToDOM(addedElementId, position);
        }
      }
      
      console.log(`[EditElementManager] Successfully added element with ID: ${addedElementId}`);
      return addedElementId;
      
    } catch (error) {
      console.error(`[EditElementManager] Error adding element:`, error);
      throw error;
    }
  }

  /**
   * DOMに要素を直接追加（リフレッシュなし）
   */
  async addElementToDOM(elementId, position) {
    try {
      // FlexibleListが作成するUL要素を取得（editList-list）
      const ulElement = document.querySelector('#editList-list');
      let listContainer = null;
      
      if (!ulElement) {
        console.log('[EditElementManager] Edit list UL element (editList-list) not found - likely empty state, using fallback');
        // フォールバックとして外側のコンテナを取得
        listContainer = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
        if (!listContainer) {
          console.warn('[EditElementManager] Edit list container not found for DOM addition');
          return;
        }
        console.log('[EditElementManager] Using fallback container for DOM addition');
      } else {
        console.log('[EditElementManager] Using correct UL element (editList-list) for DOM addition');
        listContainer = ulElement; // UL要素をlistContainerとして設定
      }

      // 追加する要素データを取得
      const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
      if (elementIndex === -1) {
        console.warn(`[EditElementManager] Element not found for DOM addition: ${elementId}`);
        return;
      }

      const elementData = editPrompt.elements[elementIndex];
      
      // EditTabの既存configを使用（統一性を保つ）
      const editTab = this.app?.tabs?.edit;
      if (!editTab) {
        console.error('[EditElementManager] EditTab not available for config');
        return;
      }
      
      const editTabConfig = {
        fields: editTab.getEditFieldsConfig(),
        buttons: editTab.getEditButtonsConfig(),
        sortable: true,
        listType: 'edit',
        weightDelta: editTab.getWeightConfig().delta,
        weightMin: editTab.getWeightConfig().min,
        weightMax: editTab.getWeightConfig().max,
        dropdownCount: 3,
        categoryChainBehavior: {
          focusNext: true,
          openDropdownOnFocus: true,
          focusPromptAfterSmall: true
        },
        onFieldChange: editTab.handleUnifiedFieldChange?.bind(editTab),
        onSmallCategoryChange: editTab.handleSmallCategoryChangeForPrompt?.bind(editTab),
        onDelete: editTab.handleEditDelete?.bind(editTab),
        onSort: editTab.handleEditSort?.bind(editTab),
        onRegistration: editTab.handleRegistration?.bind(editTab)
      };

      // 新しいDOM要素を作成（data-element-idにはelementIdを使用）
      const $li = UIFactory.createListItem({
        id: elementId,
        sortable: true
      });
      
      // DOM要素の必要な属性を設定
      $li.setAttribute('id', elementId); // jQuery UI sortableが使用するid属性
      $li.setAttribute('data-element-id', elementId);
      $li.setAttribute('data-id', elementIndex); // ListManager互換性
      
      console.log(`[EditElementManager] Setting id=${elementId}, data-element-id=${elementId}, data-id=${elementIndex} for new element`);
      
      // DOM要素の属性が正しく設定されているか確認
      console.log(`[EditElementManager] Verification - element.id: "${$li.id}", element.getAttribute('id'): "${$li.getAttribute('id')}"`);

      // FlexibleListのcreateFlexibleItemを使用してフィールドを追加
      if (this.app.listManager && this.app.listManager.createFlexibleItem) {
        await this.app.listManager.createFlexibleItem($li, elementData, elementIndex, editTabConfig);
        
        // createFlexibleItem後にid属性が保持されているか再確認
        console.log(`[EditElementManager] After createFlexibleItem - element.id: "${$li.id}", element.getAttribute('id'): "${$li.getAttribute('id')}"`);
        if (!$li.id || $li.id === '') {
          console.warn(`[EditElementManager] ID was cleared by createFlexibleItem, restoring to ${elementId}`);
          $li.setAttribute('id', elementId);
        }
      }

      // DOM挿入位置を決定（すでにlistContainerに正しい要素が設定済み）
      const targetElement = listContainer;
      if (position === 'top') {
        // ヘッダー以外の最初のLI要素を探して、その前に挿入
        const firstDataLiElement = targetElement.querySelector('li:not(.prompt-list-header)');
        if (firstDataLiElement) {
          targetElement.insertBefore($li, firstDataLiElement);
          console.log('[EditElementManager] Inserted new element before first data LI element (skipping header)');
        } else {
          // データLI要素が存在しない場合は、ヘッダー後に追加
          const headerElement = targetElement.querySelector('li.prompt-list-header');
          if (headerElement && headerElement.nextSibling) {
            targetElement.insertBefore($li, headerElement.nextSibling);
            console.log('[EditElementManager] Inserted new element after header (no data elements exist)');
          } else {
            // ヘッダーが最後の要素の場合は通常通り追加
            targetElement.appendChild($li);
            console.log('[EditElementManager] Appended new element after header');
          }
        }
      } else {
        // 最後に追加
        targetElement.appendChild($li);
      }

      console.log(`[EditElementManager] Successfully added DOM element at ${position} for ID: ${elementId}`);
      
      // 新規追加要素のRegボタンを初期状態（非活性）に設定
      setTimeout(() => {
        try {
          const addedElement = document.querySelector(`[data-element-id="${elementId}"]`);
          if (addedElement) {
            const regButton = addedElement.querySelector('button[data-action="register"]');
            if (regButton) {
              regButton.disabled = true;
              regButton.classList.add('button-disabled');
              regButton.title = 'プロンプトを入力してください';
              console.log(`[EditElementManager] Set initial register button state to disabled for new element ${elementId}`);
            }
          }
        } catch (error) {
          console.error(`[EditElementManager] Error setting initial register button state:`, error);
        }
      }, 10);
      
      // DOM追加後、スクロール位置を保持しながらID整合性を確保
      setTimeout(async () => {
        try {
          // 現在のスクロール位置を保存
          const scrollElement = document.querySelector('#editList');
          const scrollTop = scrollElement ? scrollElement.scrollTop : 0;
          
          console.log('[EditElementManager] Saving scroll position before refresh:', scrollTop);
          
          // ID整合性を確保
          editPrompt.ensureElementIds();
          
          // DOM要素の属性を最新状態で更新
          const updatedElementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
          if (updatedElementIndex !== -1) {
            const domElement = document.querySelector(`[data-element-id="${elementId}"]`);
            if (domElement) {
              // すべての必要な属性を更新
              domElement.setAttribute('id', elementId); // jQuery UI sortable用
              domElement.setAttribute('data-id', updatedElementIndex); // ListManager用
              domElement.setAttribute('data-element-id', elementId); // EditElementManager用
              
              console.log(`[EditElementManager] Updated all attributes for element ${elementId}: id=${elementId}, data-id=${updatedElementIndex}`);
              console.log(`[EditElementManager] Final verification - domElement.id: "${domElement.id}"`);
            } else {
              console.warn(`[EditElementManager] DOM element not found for data-element-id="${elementId}"`);
            }
          }
          
          // sortable機能は既にEditTabで初期化済みのため、再初期化は不要
          // 新しい要素も自動的に並び替え対象になる
          console.log('[EditElementManager] New element added - existing sortable functionality will handle it automatically');
          
          // DOM追加後の処理（リフレッシュなし）
          console.log('[EditElementManager] Element added to DOM - no refresh needed (external refresh if required)');
          
          // フォーカスを設定
          setTimeout(() => {
            this.focusOnAddedElement(elementId);
          }, 10);
        } catch (error) {
          console.error('[EditElementManager] Error in post-addition sync:', error);
        }
      }, 50);
      
    } catch (error) {
      console.error('[EditElementManager] Error adding element to DOM:', error);
      // エラー時もリフレッシュは行わない（外部から必要に応じて呼び出す）
      console.log('[EditElementManager] DOM addition failed - external refresh may be needed');
    }
  }

  /**
   * 要素の削除（スクロール位置保持）
   * @param {string|number} elementId - 削除する要素のID
   * @param {Object} options - オプション
   * @returns {Promise<boolean>} 削除成功の可否
   */
  async removeElement(elementId, options = {}) {
    try {
      console.log(`[EditElementManager] Removing element with ID: ${elementId}`);
      
      // 要素のインデックスを取得
      const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
      if (elementIndex === -1) {
        console.warn(`[EditElementManager] Element not found for deletion: ${elementId}`);
        return false;
      }
      
      // 編集タブの場合はDOM削除を先に実行（データ削除前）
      if (this.app && this.app.tabs && this.app.tabs.edit && this.app.tabs.edit.isActive) {
        await this.removeElementFromDOM(elementId);
      }
      
      // データ層から要素削除
      console.log(`[EditElementManager] Removing element from data layer at index: ${elementIndex}`);
      editPrompt.removeElement(elementIndex);
      
      // プロンプト表示を更新
      if (window.app && window.app.updatePromptDisplay) {
        console.log(`[EditElementManager] Updating prompt display`);
        window.app.updatePromptDisplay();
      }
      
      // リストが空になった場合はempty-stateを表示
      if (editPrompt.elements.length === 0) {
        console.log(`[EditElementManager] List is now empty, showing empty state`);
        if (window.app && window.app.listManager) {
          window.app.listManager.createEmptyState('#editList', 'edit');
        }
      }
      
      console.log(`[EditElementManager] Successfully removed element with ID: ${elementId}`);
      return true;
      
    } catch (error) {
      console.error(`[EditElementManager] Error removing element:`, error);
      return false;
    }
  }

  /**
   * DOMから要素を直接削除（リフレッシュなし）
   */
  async removeElementFromDOM(elementId) {
    try {
      // FlexibleListが作成する実際のUL要素を取得
      const ulElement = document.querySelector('#editList-list');
      if (!ulElement) {
        console.warn('[EditElementManager] Edit list UL element not found for DOM removal');
        return;
      }

      // 削除対象のDOM要素を検索
      const targetElement = ulElement.querySelector(`[data-element-id="${elementId}"]`);
      if (!targetElement) {
        console.warn(`[EditElementManager] DOM element not found for deletion: ${elementId}`);
        return;
      }

      console.log(`[EditElementManager] Removing DOM element with data-element-id: ${elementId}`);
      
      // DOM要素を削除
      targetElement.remove();
      
      console.log(`[EditElementManager] Successfully removed DOM element for ID: ${elementId}`);
      
    } catch (error) {
      console.error('[EditElementManager] Error removing element from DOM:', error);
      // エラー時もリフレッシュは行わない（外部から必要に応じて呼び出す）
      console.log('[EditElementManager] DOM removal failed - external refresh may be needed');
    }
  }

  /**
   * 追加された要素にフォーカス
   */
  focusOnAddedElement(elementId) {
    try {
      const editList = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
      if (editList) {
        const targetElement = editList.querySelector(`[data-element-id="${elementId}"] .prompt-list-input`);
        if (targetElement) {
          targetElement.focus();
          console.log(`[EditElementManager] Focused on added element with ID ${elementId}`);
        } else {
          console.warn(`[EditElementManager] Could not find input element for ID ${elementId}`);
        }
      }
    } catch (error) {
      console.error(`[EditElementManager] Error focusing on added element:`, error);
    }
  }

  /**
   * 全ての遅延更新をキャンセル
   */
  cancelAllPendingUpdates() {
    for (const timeoutId of this.pendingUpdates.values()) {
      clearTimeout(timeoutId);
    }
    this.pendingUpdates.clear();
    this.updateQueue.clear();
  }

  /**
   * デバッグ用：現在の状態を出力
   */
  debugCurrentState(elementId) {
    const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
    if (elementIndex !== -1) {
      const element = editPrompt.elements[elementIndex];
      console.log(`[EditElementManager] Debug element ${elementId}:`, {
        index: elementIndex,
        data: element.data,
        Value: element.Value,
        value: element.value
      });
    } else {
      console.log(`[EditElementManager] Debug element ${elementId}: NOT FOUND`);
    }
  }

  /**
   * DOM要素が準備完了かどうかをチェック
   * @param {number} elementId - 要素ID
   * @returns {boolean} DOM要素が存在するかどうか
   */
  isDOMElementReady(elementId) {
    const editList = document.querySelector('#editList-list');
    if (!editList) {
      return false;
    }
    
    // data-element-id または data-id でDOM要素を検索
    const elementByElementId = editList.querySelector(`[data-element-id="${elementId}"]`);
    const elementByDataId = editList.querySelector(`[data-id="${elementId}"]`);
    
    return !!(elementByElementId || elementByDataId);
  }
}

// グローバルエクスポート
window.EditElementManager = EditElementManager;