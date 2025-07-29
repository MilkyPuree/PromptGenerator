/**
 * edit-tab.js - 編集タブモジュール
 * Phase 8.5: プロンプト編集機能
 */

// TabManagerが利用可能になるまで待つ
(function () {
  "use strict";

  /**
   * 編集タブの状態管理クラス
   * 複雑なフラグ管理を統一化
   */
  class EditTabState {
    constructor() {
      this.refreshMode = 'normal'; // 'normal', 'suppressed', 'batch'
      this.updateMode = 'auto'; // 'auto', 'manual'
      this.operationStack = []; // 実行中の操作スタック
    }
    
    /**
     * 自動リフレッシュが可能かチェック
     */
    canAutoRefresh() {
      return this.refreshMode === 'normal' && !this.hasOperation('prompt_update');
    }
    
    /**
     * カテゴリー更新が可能かチェック
     */
    canUpdateCategory() {
      return this.updateMode === 'auto' && !this.hasOperation('category_change');
    }
    
    /**
     * 操作を開始（スタックに追加）
     */
    startOperation(operationType) {
      this.operationStack.push(operationType);
      console.log(`[EditTabState] Started operation: ${operationType}, stack:`, this.operationStack);
    }
    
    /**
     * 操作を終了（スタックから削除）
     */
    endOperation(operationType) {
      const index = this.operationStack.indexOf(operationType);
      if (index !== -1) {
        this.operationStack.splice(index, 1);
      }
      console.log(`[EditTabState] Ended operation: ${operationType}, stack:`, this.operationStack);
    }
    
    /**
     * 指定された操作が実行中かチェック
     */
    hasOperation(operationType) {
      return this.operationStack.includes(operationType);
    }
    
    /**
     * 保護された操作を実行（自動でスタック管理）
     */
    async executeProtected(operationType, callback) {
      this.startOperation(operationType);
      try {
        return await callback();
      } finally {
        this.endOperation(operationType);
      }
    }
    
    /**
     * リフレッシュを一時的に抑制
     */
    suppressRefresh(callback) {
      const originalMode = this.refreshMode;
      this.refreshMode = 'suppressed';
      try {
        return callback();
      } finally {
        this.refreshMode = originalMode;
      }
    }
  }

  // TabManagerが定義されるまで待機
  function defineEditTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineEditTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    // EditTabクラスの定義
    class EditTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "editTabBody",
          tabButtonId: "editTab",
          tabIndex: 2, // CONSTANTS.TABS.EDIT
        });

        // EditHandlerへの参照
        this.editHandler = null;

        // 現在の編集モード
        this.currentEditMode = null;
        this.currentShapingMode = null;
        
        // 状態管理の統一化
        this.state = new EditTabState();
        
        // 抽出モード状態管理
        this.extractionModeActive = false;
        
        // 初回表示フラグ
        this.hasBeenShown = false;
      }

      /**
       * 初期化処理
       */
      async onInit() {
        // EditHandlerの参照を取得
        this.editHandler = this.app.editHandler;
        if (!this.editHandler) {
          throw new Error("EditHandler not found");
        }

        // CategoryUIManagerを初期化
        this.categoryUIManager = new CategoryUIManager();

        // CategoryUIManagerの準備完了を待機
        await this.waitForCategoryUIManagerReady();

        // イベントリスナーを設定
        await this.setupEventListeners();

        // 初期状態を設定
        this.updateCurrentModes();
      }

      /**
       * タブ表示時の処理
       */
      async onShow() {
        // 初回表示かどうかを記録
        const isFirstShow = !this.hasBeenShown;
        if (isFirstShow) {
          if (AppState.config.debugMode) {
            console.log('[EditTab] First time showing edit tab');
          }
          this.hasBeenShown = true;
        }
        
        // 抽出モード状態をチェック
        this.checkExtractionMode();
        
        // 分割ボタンの表示制御
        this.updateSplitButtonVisibility();
        
        // 抽出モードの場合は統一された空状態表示を使用
        if (this.extractionModeActive) {
          this.showExtractionModeWithEmptyState();
        } else {
          // 通常モードの場合は編集モードを初期化（初回のみ、またはデータが空の場合のみ）
          if (!this.editHandler.isInitialized || !editPrompt.elements || editPrompt.elements.length === 0) {
            if (AppState.config.debugMode) {
              console.log('[EditTab] Initializing edit mode (first time or empty data)');
            }
            this.editHandler.initializeEditMode();
          } else {
            if (AppState.config.debugMode) {
              console.log('[EditTab] Edit mode already initialized, skipping refresh');
            }
            await this.refreshEditList();
          }
        }

        // 現在のモードを更新
        this.updateCurrentModes();
        
        // 統合パネルの状態を更新
        this.updateSlotIntegrationPanel();
        
        // スロット重み入力フィールドの設定を更新
        this.updateSlotWeightInputConfig();
        
        // 編集タブ表示時に初期値を設定（初回表示時のみ、または値が未設定の場合）
        if (isFirstShow || this.shouldInitializeInitialValues()) {
          if (AppState.config.debugMode) {
            console.log('[EditTab] Setting initial values...', {
              isFirstShow,
              shouldInitialize: this.shouldInitializeInitialValues()
            });
          }
          await this.initializeCurrentDataSource();
        } else {
          if (AppState.config.debugMode) {
            console.log('[EditTab] Initial values already set, skipping initialization');
          }
        }
        
        // 表示制御を強制実行（初期化時のため）
        setTimeout(() => {
          this.updateIntegrationPanelVisibility();
        }, 100);
        
        // 初回表示時のコールバック（必要に応じて）
        if (isFirstShow && this.onFirstShow) {
          await this.onFirstShow();
        }
        
        // ミュートボタンの状態を更新
        this.updateSlotMuteButton();
      }

      /**
       * イベントリスナーの設定
       */
      async setupEventListeners() {
        // UIタイプ（整形モード）の変更
        this.setupUITypeHandlers();

        // 編集タイプの変更
        this.setupEditTypeHandlers();

        // プロンプト入力の監視（編集タブがアクティブな時のみリフレッシュ）
        this.setupPromptChangeListener();

        // 要素追加ボタンのイベントリスナー
        this.setupAddElementHandlers();
        
        // スロットモード変更の監視
        this.setupSlotModeChangeListener();
        
        // 抽出完了イベントの監視
        this.setupExtractionCompleteListener();
        
        // スロット変更イベントの監視
        this.setupSlotChangeListener();
        
        // 統合機能のハンドラー設定
        await this.setupSlotIntegrationHandlers();
        
        // スロットミュートボタンのハンドラー設定
        this.setupSlotMuteHandler();
      }

      /**
       * UIタイプ（整形モード）のハンドラー設定
       */
      setupUITypeHandlers() {
        const uiTypeRadios = document.querySelectorAll(DOM_SELECTORS.BY_ATTRIBUTE.UI_TYPE_RADIOS);

        uiTypeRadios.forEach((radio) => {
          this.addEventListener(radio, "change", async (e) => {
            await this.handleUITypeChange(e);
          });
        });
      }

      /**
       * 編集タイプのハンドラー設定
       */
      setupEditTypeHandlers() {
        const editTypeSelect = this.getElement(DOM_SELECTORS.BY_ATTRIBUTE.EDIT_TYPE_SELECT);
        if (editTypeSelect) {
          this.addEventListener(editTypeSelect, "change", async (e) => {
            await this.handleEditTypeChange(e);
          });
        }
      }

      /**
       * プロンプト変更リスナーの設定
       */
      setupPromptChangeListener() {
        // PromptEditorのイベントを監視
        promptEditor.on("change", () => {
          // プロンプト変更時は単行更新のみ使用（リフレッシュによるスクロール問題を回避）
          // カテゴリー情報が必要な場合は、個別の編集操作で対応
          if (this.isCurrentTab() && !this.suppressAutoRefresh) {
            // プロンプト表示を更新（GeneratePromptフィールドに反映）
            // PromptEditor内部でgenerate()が既に呼ばれているため、表示更新のみ実行
            if (window.app && window.app.updatePromptDisplay) {
              window.app.updatePromptDisplay();
            }
            
            // 分割ボタンの表示状態を更新
            this.updateSplitButtonVisibility();
          }
        });
      }

      /**
       * 要素追加ボタンのイベントリスナー設定
       */
      setupAddElementHandlers() {
        // 上部追加ボタン
        const addTopBtn = this.getElement('#addElementTop');
        if (addTopBtn) {
          this.addEventListener(addTopBtn, 'click', () => {
            this.addEmptyElement('top');
          });
        }

        // 下部追加ボタン
        const addBottomBtn = this.getElement('#addElementBottom');
        if (addBottomBtn) {
          this.addEventListener(addBottomBtn, 'click', () => {
            this.addEmptyElement('bottom');
          });
        }

        // 単一要素分割ボタン
        const splitSingleBtn = this.getElement('#splitSinglePrompt');
        if (splitSingleBtn) {
          this.addEventListener(splitSingleBtn, 'click', () => {
            this.splitSinglePrompt();
          });
        }
      }

      /**
       * UIタイプ変更時の処理
       */
      async handleUITypeChange(event) {
        const selectedValue = event.target.value;
        const previousValue = this.currentShapingMode;

        // EditHandlerに処理を委譲
        this.editHandler.handleUITypeChange(event);

        // モードを更新
        this.currentShapingMode = selectedValue;

        // 変更通知を表示
        if (previousValue && previousValue !== selectedValue) {
          const modeNames = {
            SD: "StableDiffusion",
            NAI: "NovelAI",
            None: "自動整形無し",
          };

          ErrorHandler.notify(
            `整形モードを「${modeNames[selectedValue]}」に変更しました`,
            {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "info",
              duration: NOTIFICATION_DURATION.STANDARD,
            }
          );
        }

        // 自動Generate機能の再初期化は不要（一度の初期化で十分）
        // if (selectedValue === "NAI" && window.autoGenerateHandler) {
        //   autoGenerateHandler.init(); // 多重登録の原因となるため削除
        // }
        
        // Shaping mode変更後は外部からのリフレッシュを想定（内部からは呼ばない）
        if (previousValue && previousValue !== selectedValue && this.isCurrentTab()) {
          console.log(`[EditTab] Shaping mode changed: ${previousValue} -> ${selectedValue} (external refresh may be needed for weight display)`);
        }
      }

      /**
       * 編集タイプ変更時の処理
       */
      async handleEditTypeChange(event) {
        const selectedValue = event.target.value;
        const previousValue = this.currentEditMode;

        // EditHandlerに処理を委譲
        this.editHandler.handleEditTypeChange(event);

        // モードを更新
        this.currentEditMode = selectedValue;

        // 変更通知を表示
        if (previousValue && previousValue !== selectedValue) {
          const modeNames = {
            select: "選択編集モード",
            text: "テキスト編集モード",
          };

          ErrorHandler.notify(
            `編集モードを「${modeNames[selectedValue]}」に変更しました`,
            {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "info",
              duration: NOTIFICATION_DURATION.SHORT,
            }
          );
        }
      }


      /**
       * 編集リストのリフレッシュ（ローカル辞書ベース実装）
       */
      async refreshEditList() {
        if (AppState.config.debugMode) {
          console.log('[EditTab] Refreshing edit list with elements:', editPrompt.elements?.length);
        }
        
        // editPrompt.elementsが空の場合は空状態を表示
        if (!editPrompt.elements || editPrompt.elements.length === 0) {
          // 抽出モードの場合は抽出モード用の空状態表示を使用
          if (this.extractionModeActive) {
            this.showExtractionModeWithEmptyState();
          } else {
            this.app.listManager.createEmptyState(DOM_SELECTORS.BY_ID.EDIT_LIST, 'edit');
          }
          return;
        }

        // 編集モードが選択編集の場合は翻訳処理を実行
        const editType = AppState.userSettings.optionData.editType;
        if (editType === 'select') {
          console.log(`[EditTab] Running translation processing for select mode`);
          await this.processTranslationForElements();
        }

        // ID整合性を確保（FlexibleListのIDオフセットに合わせる）
        editPrompt.ensureElementIds(ID_OFFSETS.EDIT_TAB);
        
        // editPrompt.elementsをsort値でソートしてからローカル辞書形式に変換
        const sortedElements = [...editPrompt.elements].sort((a, b) => (a.sort || 0) - (b.sort || 0));
        const convertedElements = sortedElements.map((element, index) => {
          // カテゴリー情報を取得（複数のソースから試行）
          let categoryData = ['', '', ''];
          let promptValue = element.Value || element.prompt || '';
          
          // promptValueが文字列でない場合の修正処理
          if (typeof promptValue !== 'string') {
            console.warn(`[EditTab] Non-string prompt value at index ${index}:`, {
              type: typeof promptValue,
              value: promptValue,
              element: element
            });
            
            // objectの場合、適切なプロパティから文字列を抽出
            if (typeof promptValue === 'object' && promptValue !== null) {
              if (promptValue.toString && typeof promptValue.toString === 'function') {
                promptValue = promptValue.toString();
              } else if (promptValue.value && typeof promptValue.value === 'string') {
                promptValue = promptValue.value;
              } else if (promptValue.text && typeof promptValue.text === 'string') {
                promptValue = promptValue.text;
              } else {
                promptValue = '';
              }
            } else {
              promptValue = String(promptValue || '');
            }
          }
          
          // 1. 既存のdataプロパティをチェック
          if (element.data && Array.isArray(element.data) && element.data.some(item => item && item.trim())) {
            categoryData = element.data;
            if (AppState.config.debugMode) {
              console.log(`[EditTab] Using existing data for element ${element.id}:`, categoryData);
            }
          } 
          // 2. categoryDataプロパティをチェック
          else if (element.categoryData && Array.isArray(element.categoryData) && element.categoryData.some(item => item && item.trim())) {
            categoryData = element.categoryData;
            if (AppState.config.debugMode) {
              console.log(`[EditTab] Using categoryData for element ${element.id}:`, categoryData);
            }
          } 
          // 3. プロンプト値から逆検索してカテゴリーを取得
          else if (promptValue) {
            // CategoryUIManagerを使用してカテゴリーを検索
            if (window.CategoryUIManager) {
              const categoryUIManager = new CategoryUIManager();
              const foundCategories = categoryUIManager.findCategoryByPrompt(promptValue);
              if (foundCategories) {
                categoryData = [
                  foundCategories[0] || '',
                  foundCategories[1] || '', 
                  foundCategories[2] || ''
                ];
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] Found categories for "${promptValue}":`, categoryData);
                }
              }
            }
          }
          
          return {
            prompt: promptValue,
            data: categoryData,
            id: element.id !== undefined ? element.id : `edit-${index}`,
            sort: element.sort !== undefined ? element.sort : index,
            // 重みデータをコピー
            SD: element.SD,
            NAI: element.NAI,
            None: element.None,
            Value: element.Value,
            Weight: element.Weight
          };
        });

        // ソート
        const sorted = [...convertedElements].sort((a, b) => {
          return a.sort - b.sort;
        });

        if (AppState.config.debugMode && sorted.length > 0) {
          console.log(`[EditTab] Converted elements sample:`, sorted[0]);
          
          const currentShaping = AppState.userSettings.optionData.shaping;
          console.log(`[EditTab] Current shaping mode: ${currentShaping}`);
          console.log(`[EditTab] Sample element weight data:`, {
            element: sorted[0],
            SD: sorted[0].SD,
            NAI: sorted[0].NAI,
            None: sorted[0].None,
            currentShapingWeight: sorted[0][currentShaping]?.weight
          });
        }

        const weightConfig = this.getWeightConfig();
        
        await this.app.listManager.createFlexibleList(
          sorted,
          DOM_SELECTORS.BY_ID.EDIT_LIST,
          {
            fields: this.getEditFieldsConfig(),
            buttons: this.getEditButtonsConfig(),
            sortable: true,
            listType: FLEXIBLE_LIST_TYPES.EDIT,
            weightDelta: weightConfig.delta,  // 重み値の増減幅
            weightMin: weightConfig.min,      // 重み値の最小値
            weightMax: weightConfig.max,      // 重み値の最大値
            header: FLEXIBLE_LIST_HEADERS.EDIT.PROMPT_EDITOR, // ✏️ 編集中のPrompt
            idOffset: ID_OFFSETS.EDIT_TAB,    // 編集タブ専用IDオフセット: 10000番台
            // ヘッダークリックソート機能を有効化
            headerClickSort: {
              enabled: true,
              listManager: this.app.listManager,
              dataArray: editPrompt.elements,
              refreshCallback: async () => await this.refreshEditList(),
              saveCallback: async () => await this.app.listManager.saveLocalListImmediate()
            },
            refreshCallback: async () => {
              // 統一リフレッシュコールバック
              await this.refreshEditList();
            },
            onFieldChange: async (index, fieldKey, value, item, eventType) => {
              // 全てのフィールド変更を統一ハンドラーで処理
              await this.handleUnifiedFieldChange(index, fieldKey, value, item, eventType);
            },
            onDelete: async (index, item) => {
              // EditElementManagerが使用可能な場合は直接削除（ListManagerのフローをバイパス）
              if (window.editElementManager && item?.id !== undefined) {
                
                // 削除前に確認
                const shouldDelete = !AppState.userSettings.optionData?.isDeleteCheck || 
                  window.confirm("本当に削除しますか？");
                
                if (shouldDelete) {
                  // EditElementManagerで直接削除（リフレッシュなし）
                  await window.editElementManager.removeElement(item.id);
                }
                
                // ListManagerのdefault削除処理をスキップするためにfalseを返す
                return false;
              } else {
                // フォールバック：通常のListManager削除フロー
                this.handleEditDelete(index, item);
              }
            },
            onSort: async (sortedIds) => {
              this.handleEditSort(sortedIds);
            },
            onRegistration: async (item, index) => {
              this.handleRegistration(item, index);
            },
            dropdownCount: 3, // 作成するカスタムドロップダウンの数（大・中・小項目の3段階）
            categoryChainBehavior: {
              focusNext: true,              // 次のフィールドにフォーカス移動
              openDropdownOnFocus: true,    // フォーカス時にドロップダウンを開く  
              focusPromptAfterSmall: true   // 小項目後にプロンプトフィールドにフォーカス
            },
            // 小項目変更時のプロンプト自動入力機能
            onSmallCategoryChange: async (smallValue, bigValue, middleValue, item) => {
              await this.handleSmallCategoryChangeForPrompt(smallValue, bigValue, middleValue, item);
            },
            setupSpecialFeatures: ($li, inputs) => {
              // 編集タブ固有の機能（重み入力フィールドなど）をここに追加
              this.setupEditSpecialFeatures($li, inputs);
            },
            idOffset: ID_OFFSETS.EDIT_TAB
          }
        );
        
        // 本格修正完了 - デバッグコード削除済み
      }



      /**
       * 統一フィールド変更ハンドラー（ローカル辞書ベース）
       */
      async handleUnifiedFieldChange(index, fieldKey, value, item, eventType) {
        
        // fieldKeyの型チェック
        const fieldKeyStr = typeof fieldKey === 'string' ? fieldKey : '';
        const isWeightField = typeof fieldKey === 'function' || fieldKeyStr.includes('weight');
        
        
        if (fieldKeyStr.startsWith("data.") && window.categoryDataSync) {
          // **本格修正**: CategoryDataSyncManagerを使用した統一処理
          const dataIndex = parseInt(fieldKeyStr.split(".")[1]);
          
          // 正しい要素インデックスを取得
          const actualElementIndex = item?.id !== undefined 
            ? editPrompt.elements.findIndex(el => el.id === item.id)
            : index;
          
          if (actualElementIndex === -1) {
            console.error('[EditTab ERROR] Element not found in editPrompt.elements for item.id:', item?.id);
            return;
          }
          
          const elementId = editPrompt.elements[actualElementIndex].id;
          
          if (elementId !== undefined) {
            // **本格修正**: CategoryDataSyncManagerで安全な更新実行
            const success = await window.categoryDataSync.executeSafeUpdate(
              elementId,
              async (latestData) => {
                // 最新データに基づいて特定フィールドのみ更新
                const updatedData = [...latestData];
                updatedData[dataIndex] = value;
                
                // 全データソースを統一同期
                await window.categoryDataSync.syncAllSources(elementId, updatedData, {
                  caller: 'edit-tab-field-change',
                  syncListManager: true // ListManagerのitemデータも同期
                });
                
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] Field updated via CategoryDataSync:`, {
                    elementId,
                    fieldIndex: dataIndex,
                    newValue: value,
                    finalData: updatedData
                  });
                }
                
                return true;
              },
              'edit-tab-handleUnifiedFieldChange'
            );
            
            if (!success) {
              console.warn(`[EditTab] CategoryDataSync update failed for element ${elementId}`);
            }
            
            // 小項目変更時の特殊処理（プロンプト自動検索）
            if (dataIndex === 2) { // 小項目
              await this.handleSmallCategoryChange(value, item, actualElementIndex);
            }
          }
        } else if (fieldKeyStr === "prompt" && window.editElementManager) {
          // プロンプト値の変更 - EditElementManagerを使用
          // 正しい要素インデックスを取得
          const actualElementIndex = item?.id !== undefined 
            ? editPrompt.elements.findIndex(el => el.id === item.id)
            : index;
          
          if (actualElementIndex === -1) {
            console.error('[EditTab ERROR] Element not found for prompt update, item.id:', item?.id);
            return;
          }
          
          const promptElementId = editPrompt.elements[actualElementIndex].id;
          
          if (promptElementId !== undefined) {
            await window.editElementManager.updatePromptOnly(promptElementId, value);
            
            // プロンプト変更時にカテゴリーを自動検索・設定（スクロール位置保持のため非同期処理を避ける）
            await this.handlePromptCategoryUpdateWithoutRefresh(value, actualElementIndex, item);
            
            // プロンプト変更時にregボタンの状態を更新（個別更新で最適化）
            if (window.editElementManager) {
              window.editElementManager.updateSingleElementRegisterButton(promptElementId, 100);
            }
          }
        } else if (isWeightField) {
          // 重み値の変更 - 要素IDから正確なインデックスを取得
          const actualIndex = item && item.id !== undefined 
            ? editPrompt.elements.findIndex(el => el.id === item.id)
            : index;
          
          if (actualIndex !== -1) {
            await this.handleWeightChange(actualIndex, value);
          } else {
            console.warn(`[EditTab] Cannot find element for weight change: itemId=${item?.id}, index=${index}`);
          }
        }
        
        // 【重要】プロンプトを再生成（GeneratePromptフィールドに反映するために必要）
        // EditElementManagerによる高速DOM更新後は、データ層の同期のためgenerate()が必須
        editPrompt.generate();
        
        // プロンプト表示を更新
        window.app.updatePromptDisplay();
        
        // プロンプトを保存
        await savePrompt();
        
      }

      /**
       * プロンプト変更時にカテゴリーを自動検索・設定
       */
      async handlePromptCategoryUpdate(promptValue, index) {
        console.log(`[EditTab] handlePromptCategoryUpdate called`, { promptValue, index });
        
        // プロンプト値からカテゴリーを逆検索（CategoryUIManagerを直接使用）
        const categoryData = this.categoryUIManager.findCategoryByPrompt(promptValue);
        
        if (categoryData) {
          console.log(`[EditTab] Found categories for prompt:`, categoryData);
          
          // カテゴリーデータを更新
          editPrompt.elements[index].data = [...categoryData];
          
          // DOM更新（リフレッシュなし）- 要素IDを使用
          const categoryElementId = editPrompt.elements[index]?.id;
          if (categoryElementId !== undefined) {
            this.app.listManager.updateSingleElement(
              DOM_SELECTORS.BY_ID.EDIT_LIST,
              categoryElementId,
              {
                'data.0': categoryData[0] || '',
                'data.1': categoryData[1] || '',
                'data.2': categoryData[2] || ''
              },
              { preserveFocus: true, preventEvents: true, searchMode: 'id' }
            );
          }
        }
      }
      
      /**
       * プロンプト変更時にカテゴリーを自動検索・設定（リフレッシュなし版）
       */
      async handlePromptCategoryUpdateWithoutRefresh(promptValue, index, item) {
        // 状態管理でカテゴリー更新可能かチェック
        if (!this.state.canUpdateCategory()) {
          console.log(`[EditTab] Category update suppressed by state management`);
          return;
        }
        
        // ErrorHandlerでラップして安全に実行
        return ErrorHandler.wrapAsync(
          async () => {
            console.log(`[EditTab] Starting category search and translation for "${promptValue}"`);
            await this.processSingleElementTranslation(promptValue, index, item);
          },
          "プロンプト変更時のカテゴリー自動設定",
          { showToast: false }
        );
      }

      /**
       * 単一要素のカテゴリー検索・翻訳処理（プロンプト編集時用）
       * 共通化されたEditHandlerのメソッドを使用
       */
      async processSingleElementTranslation(promptValue, index, item) {
        console.log(`[EditTab] processSingleElementTranslation called with promptValue: "${promptValue}", index: ${index}, item:`, item);
        
        if (!promptValue || !promptValue.trim()) {
          console.log(`[EditTab] Empty prompt value, skipping processing`);
          return;
        }
        
        // itemが渡されている場合はitemのIDで要素を検索、そうでなければindexを使用
        let element = null;
        if (item && item.id !== undefined) {
          const elementIndex = editPrompt.elements.findIndex(el => el.id === item.id);
          if (elementIndex !== -1) {
            element = editPrompt.elements[elementIndex];
            console.log(`[EditTab] Found element by item.id: ${item.id}, elementIndex: ${elementIndex}`);
          } else {
            console.warn(`[EditTab] Element not found by item.id: ${item.id}`);
          }
        } else {
          // フォールバック：indexを使用
          element = editPrompt.elements[index];
          console.log(`[EditTab] Using index fallback: ${index}`);
        }
        
        // EditHandlerの共通化されたカテゴリー検索・翻訳処理を呼び出す
        if (this.editHandler && element) {
          try {
            console.log(`[EditTab] Calling editHandler.processSingleElementCategoryAndTranslation for element ${element.id}`);
            // 共通化されたメソッドを使用（カテゴリー検索＋翻訳）
            this.editHandler.processSingleElementCategoryAndTranslation(element, promptValue);
            
          } catch (error) {
            console.error(`[EditTab] Category search and translation failed for element:`, error);
          }
        } else {
          console.warn(`[EditTab] EditHandler or element not available - editHandler:`, !!this.editHandler, 'element:', !!element);
        }
      }

      /**
       * 翻訳処理を実行（選択編集モード用）
       * EditHandlerの統一処理に完全委譲
       */
      async processTranslationForElements() {
        console.log(`[EditTab] processTranslationForElements - delegating to EditHandler`);
        
        if (this.editHandler) {
          // EditHandlerの統一された処理を使用
          for (const element of editPrompt.elements) {
            if (element.Value?.trim()) {
              this.editHandler.processSingleElementCategoryAndTranslation(element, element.Value, true);
            }
          }
        }
      }

      // findCategoriesByPromptは削除 - CategoryUIManager.findCategoryByPromptを直接使用

      /**
       * 小項目変更時のプロンプト自動入力（FlexibleListから呼び出される）
       */
      async handleSmallCategoryChangeForPrompt(smallValue, bigValue, middleValue, item) {
        return ErrorHandler.wrapAsync(
          async () => {
            console.log(`[EditTab] handleSmallCategoryChangeForPrompt called`, { smallValue, bigValue, middleValue, item });
            
            if (!smallValue || !bigValue || !middleValue) {
              console.log(`[EditTab] Insufficient category values for prompt lookup`);
              return;
            }
            
            await this._executeSmallCategoryChange(smallValue, bigValue, middleValue, item);
          },
          "小項目変更時のプロンプト自動入力",
          { showToast: false }
        );
      }
      
      /**
       * 小項目変更処理の実装部分（エラーハンドリング分離）
       */
      async _executeSmallCategoryChange(smallValue, bigValue, middleValue, item) {
        
        // 要素のインデックスを特定（複数の方法で試行）
        const elementId = item?.id;
        
        let index = editPrompt.elements.findIndex(el => el.id === elementId);
        
        // ID照合が失敗した場合、型変換して再試行
        if (index === -1) {
          // 数値を文字列として試行
          if (typeof elementId === 'number') {
            index = editPrompt.elements.findIndex(el => el.id === elementId.toString());
            console.log(`[EditTab] Retry with string ID "${elementId}", found index: ${index}`);
          }
          // 文字列を数値として試行
          else if (typeof elementId === 'string') {
            const numericId = parseInt(elementId);
            if (!isNaN(numericId)) {
              index = editPrompt.elements.findIndex(el => el.id === numericId);
              console.log(`[EditTab] Retry with numeric ID ${numericId}, found index: ${index}`);
            }
          }
        }
        
        // edit-プレフィックス付きIDの処理
        if (index === -1 && typeof elementId === 'string' && elementId.startsWith('edit-')) {
          const numericId = parseInt(elementId.split('-')[1]);
          if (!isNaN(numericId)) {
            index = editPrompt.elements.findIndex(el => el.id === numericId);
            console.log(`[EditTab] Retry with edit-prefix numeric ID ${numericId}, found index: ${index}`);
          }
        }
        
        // それでも見つからない場合、sort順序で推測
        if (index === -1 && typeof elementId === 'string' && elementId.startsWith('edit-')) {
          const sortOrder = parseInt(elementId.split('-')[1]);
          if (!isNaN(sortOrder)) {
            const sortedElements = [...editPrompt.elements].sort((a, b) => (a.sort || 0) - (b.sort || 0));
            const targetElement = sortedElements[sortOrder];
            if (targetElement) {
              index = editPrompt.elements.findIndex(el => el === targetElement);
              console.log(`[EditTab] Found by sort order ${sortOrder}, index: ${index}`);
            }
          }
        }
        
        if (index === -1) {
          console.warn(`[EditTab] Element not found with ID: ${elementId}`);
          return;
        }
        
        // カテゴリーに基づいてプロンプトを検索
        const foundPrompt = this.categoryUIManager.findPromptByCategory(bigValue, middleValue, smallValue);
        
        if (foundPrompt) {
          console.log(`[EditTab] Found prompt for categories: "${foundPrompt}"`);
          
          // 状態管理で保護された操作として実行
          await this.state.executeProtected('prompt_update', async () => {
            // プロンプト内容を更新
            editPrompt.elements[index].Value = foundPrompt;
            
            // editingValueは元の配列インデックスが必要なので、IDで正確なインデックスを取得
            const originalIndex = editPrompt.elements.findIndex(el => el.id === editPrompt.elements[index].id);
            
            editPrompt.editingValue(foundPrompt, originalIndex);
            window.app.updatePromptDisplay();
            
            // データ構造も更新（data配列を安全に初期化）
            if (!editPrompt.elements[index].data) {
              editPrompt.elements[index].data = ['', '', ''];
            }
            editPrompt.elements[index].data[0] = bigValue;
            editPrompt.elements[index].data[1] = middleValue; 
            editPrompt.elements[index].data[2] = smallValue;
            
            await savePrompt();
            
            // DOM更新（リフレッシュなし）- 要素IDを使用
            const smallCategoryElementId = editPrompt.elements[index]?.id;
            console.log(`[EditTab] _executeSmallCategoryChange - elementId: ${smallCategoryElementId}, foundPrompt: "${foundPrompt}"`);
            
            if (smallCategoryElementId !== undefined) {
              this.app.listManager.updateSingleElement(
                DOM_SELECTORS.BY_ID.EDIT_LIST,
                smallCategoryElementId,
                { 
                  prompt: foundPrompt,
                  'data.0': bigValue,
                  'data.1': middleValue,
                  'data.2': smallValue
                },
                { preserveFocus: true, preventEvents: true, searchMode: 'id' }
              );
              
              // プロンプト更新後にRegボタンの状態を更新
              if (window.editElementManager) {
                console.log(`[EditTab] Scheduling register button update for element ${smallCategoryElementId}`);
                setTimeout(() => {
                  console.log(`[EditTab] Executing register button update for element ${smallCategoryElementId} with prompt: "${foundPrompt}"`);
                  window.editElementManager.updateSingleElementRegisterButton(smallCategoryElementId, 50);
                }, 100);
              } else {
                console.warn(`[EditTab] editElementManager not available for register button update`);
              }
            } else {
              console.warn(`[EditTab] smallCategoryElementId is undefined, cannot update register button`);
            }
          });
        } else {
          console.log(`[EditTab] No prompt found for categories: ${bigValue} > ${middleValue} > ${smallValue}`);
        }
      }

      /**
       * 小項目変更時の特殊処理（旧メソッド - 統一ハンドラー用）
       */
      async handleSmallCategoryChange(value, item, actualElementIndex) {
        // 状態管理で保護された操作で実行
        return this.state.executeProtected('category_change', async () => {
          // 正しい要素を取得
          const element = editPrompt.elements[actualElementIndex];
          if (!element || !element.data) {
            console.warn(`[EditTab] Element not found at index ${actualElementIndex}`);
            return;
          }
          
          // 小項目変更時の特殊処理：プロンプト内容を自動検索
          const foundPrompt = this.categoryUIManager.findPromptByCategory(
            element.data[0], // big
            element.data[1], // middle
            value // small
          );
          
          if (foundPrompt) {
            // プロンプト内容を更新
            element.Value = foundPrompt;
            editPrompt.editingValue(foundPrompt, actualElementIndex);
            window.app.updatePromptDisplay();
            
            // DOM更新（リフレッシュなし）- 要素IDを使用
            const handleSmallElementId = element.id;
            console.log(`[EditTab] handleSmallElementId: ${handleSmallElementId}, foundPrompt: "${foundPrompt}"`);
            
            if (handleSmallElementId !== undefined) {
              this.app.listManager.updateSingleElement(
                DOM_SELECTORS.BY_ID.EDIT_LIST,
                handleSmallElementId,
                { prompt: foundPrompt },
                { preserveFocus: true, preventEvents: true, searchMode: 'id' }
              );
              
              // プロンプト更新後にRegボタンの状態を更新
              if (window.editElementManager) {
                console.log(`[EditTab] Scheduling register button update for element ${handleSmallElementId}`);
                setTimeout(() => {
                  console.log(`[EditTab] Executing register button update for element ${handleSmallElementId} with prompt: "${foundPrompt}"`);
                  window.editElementManager.updateSingleElementRegisterButton(handleSmallElementId, 50);
                }, 100);
              } else {
                console.warn(`[EditTab] editElementManager not available for register button update`);
              }
            } else {
              console.warn(`[EditTab] handleSmallElementId is undefined, cannot update register button`);
            }
          }
        });
      }

      /**
       * 単一プロンプトフィールドの部分更新（リフレッシュなし）
       */
      updateSinglePromptField(index, promptValue) {
        try {
          // 要素IDを取得
          const promptFieldElementId = editPrompt.elements[index]?.id;
          if (promptFieldElementId === undefined) {
            console.warn(`[EditTab] Element at index ${index} has no ID`);
            return;
          }
          
          // ListManagerの単一要素更新機能を使用 - 要素IDで検索
          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            promptFieldElementId,
            { prompt: promptValue },
            {
              preserveFocus: true,
              preventEvents: true,
              searchMode: 'id'
            }
          );
        } catch (error) {
          console.error(`[EditTab] Error updating prompt field:`, error);
        }
      }




      /**
       * 単一要素のUI更新（カテゴリーフィールドを含む）
       */
      updateSingleElementUI(index) {
        try {
          const element = editPrompt.elements[index];
          if (!element || !element.data) {
            return;
          }
          
          // 要素IDを取得
          const uiElementId = element?.id;
          if (uiElementId === undefined) {
            console.warn(`[EditTab] Element at index ${index} has no ID`);
            return;
          }
          
          // ListManagerの単一要素更新機能を使用してカテゴリーフィールドを更新 - 要素IDで検索
          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST,
            uiElementId,
            {
              'data.0': element.data[0] || '',
              'data.1': element.data[1] || '',
              'data.2': element.data[2] || ''
            },
            {
              preserveFocus: true,
              preventEvents: true,
              searchMode: 'id'
            }
          );
        } catch (error) {
          console.error(`[EditTab] Error updating element UI:`, error);
        }
      }

      /**
       * 編集タブ用フィールド設定を取得（重み機能・翻訳時readonly復元）
       */
      getEditFieldsConfig() {
        const editMode = AppState.userSettings.optionData.editType;
        const weightField = { 
          type: 'weight', 
          key: (item) => {
            const shaping = AppState.userSettings.optionData.shaping;
            const weight = item[shaping]?.weight;
            
            console.log(`[EditTab] Weight field key - shaping: ${shaping}, item[shaping]:`, item[shaping], 'weight:', weight);
            
            return weight !== undefined && weight !== null ? weight : 0;
          }, 
          label: '重み'
        };

        switch (editMode?.toLowerCase()) {
          case 'text':
            return [
              { type: "prompt", key: "prompt", label: UI_LABELS.PROMPT },
              weightField
            ];
          
          case 'select':
          default:
            return [
              { 
                type: "category", 
                key: "data.0", 
                label: UI_LABELS.BIG_CATEGORY,
                readonly: (item) => item.data && item.data[0] === "翻訳中"
              },
              { 
                type: "category", 
                key: "data.1", 
                label: UI_LABELS.MIDDLE_CATEGORY,
                readonly: (item) => item.data && item.data[0] === "翻訳中"
              },
              { 
                type: "category", 
                key: "data.2", 
                label: UI_LABELS.SMALL_CATEGORY,
                readonly: (item) => item.data && item.data[0] === "翻訳中"
              },
              { type: "prompt", key: "prompt", label: UI_LABELS.PROMPT },
              weightField
            ];
        }
      }

      /**
       * 重み値設定を取得（PromptEditorクラスと統一）
       */
      getWeightConfig() {
        return WeightConverter.getWeightConfig(this.getCurrentShaping());
      }

      /**
       * 編集モードに応じたボタン設定を取得
       */
      getEditButtonsConfig() {
        const editMode = AppState.userSettings.optionData.editType;
        const baseButtons = [];
        
        // 選択編集モードの場合のみ登録ボタンを表示
        if (editMode?.toLowerCase() === 'select') {
          baseButtons.push({
            type: "register",
            enabled: (item) => {
              // プロンプト値を取得
              const promptValue = item.prompt || item.Value || '';
              
              // 翻訳中の場合はreadonly（ボタンを押せない）
              if (item.data && item.data[0] === '翻訳中') {
                return false;
              }
              
              // ローカル辞書とマスター辞書の両方をチェック
              const existsInDictionary = isPromptInDictionary(promptValue);
              
              console.log('[EditTab] Register button readonly check:', {
                prompt: promptValue,
                existsInDictionary: existsInDictionary,
                disabled: existsInDictionary,
                canClick: !existsInDictionary
              });
              
              // 辞書に存在する場合はreadonly（ボタンを押せない）
              return !existsInDictionary;
            },
            disabledTitle: (item) => {
              const promptValue = item.prompt || item.Value || '';
              
              // 翻訳中の場合
              if (item.data && item.data[0] === '翻訳中') {
                return "翻訳中のため登録できません";
              }
              
              // ローカル辞書とマスター辞書の両方をチェック
              const existsInDictionary = isPromptInDictionary(promptValue);
              
              return existsInDictionary ? "既に登録済みのため登録できません" : undefined;
            }
          });
        }
        
        // 削除ボタン
        baseButtons.push({ type: "delete" });
        
        return baseButtons;
      }

      /**
       * 重み変更ハンドラー
       */
      async handleWeightChange(index, value) {
        // valueは既に数値として処理されている
        const inputWeight = parseFloat(value) || 0;
        const weightConfig = this.getWeightConfig();
        
        // インデックスの有効性をチェック
        if (index < 0 || index >= editPrompt.elements.length) {
          console.warn(`[EditTab] Invalid weight change index: ${index}, elements length: ${editPrompt.elements.length}`);
          return;
        }
        
        // 上限・下限チェック
        const clampedWeight = Math.max(
          weightConfig.min, 
          Math.min(weightConfig.max, inputWeight)
        );
        const shaping = AppState.userSettings.optionData.shaping;
        const targetElement = editPrompt.elements[index];
        const currentWeight = parseFloat(
          targetElement[shaping]?.weight
        ) || 0;
        const weightDelta = clampedWeight - currentWeight;
        
        console.log('[EditTab] Weight change via input field:', { 
          inputWeight, 
          clampedWeight, 
          currentWeight, 
          weightDelta, 
          index,
          elementId: targetElement.id,
          limits: { min: weightConfig.min, max: weightConfig.max }
        });
        
        // 重み変更を実行（スロットタブと同じく直接editingWeightを使用）
        editPrompt.editingWeight(clampedWeight, index);
        
        // プロンプト表示を即座に更新
        window.app.updatePromptDisplay();
        
        // スロットに保存
        await promptSlotManager.saveCurrentSlot();
        
        // 重み値変更後、要素IDベースでスポット更新（インデックスのズレを防ぐ）
        setTimeout(() => {
          const actualWeight = editPrompt.elements[index][shaping].weight;
          // 要素IDを使って正確な要素を特定
          this.app.listManager.updateSingleElement(
            DOM_SELECTORS.BY_ID.EDIT_LIST, 
            targetElement.id, // インデックスではなく要素IDを使用
            { weight: actualWeight },
            {
              preserveFocus: true,
              preventEvents: true,
              searchMode: 'id' // ID検索モードを明示
            }
          );
          console.log(
            `[EditTab] Updated weight for element ID ${targetElement.id} to: ${actualWeight} (was input: ${inputWeight})`
          );
        }, 50);
      }

      /**
       * regボタンの状態を更新（EditElementManager使用による軽量更新）
       */
      async updateRegisterButtonStates() {
        console.log('[EditTab] Updating register button states - using EditElementManager lightweight update');
        
        // EditElementManagerを使用して全要素のRegボタン状態のみを更新
        if (window.editElementManager) {
          try {
            // 全要素に対してRegボタンの状態更新
            const elements = editPrompt.elements || [];
            const updatePromises = elements.map(element => {
              if (element.id !== undefined && element.id !== null) {
                // 各要素のRegボタン状態のみを更新（リフレッシュなし）
                return window.editElementManager.updateSingleElementRegisterButton(element.id, 10);
              }
            }).filter(Boolean);
            
            await Promise.all(updatePromises);
            console.log(`[EditTab] Updated register button states for ${updatePromises.length} elements (no refresh)`);
            
          } catch (error) {
            console.error('[EditTab] Error updating register button states with EditElementManager:', error);
            // エラー時もリフレッシュは行わない（外部から必要に応じて呼び出す）
            console.log('[EditTab] Register button update failed - external refresh may be needed');
          }
        } else {
          // EditElementManagerが利用できない場合もリフレッシュは行わない
          console.warn('[EditTab] EditElementManager not available - register button states may not update automatically');
        }
      }
      

      /**
       * 編集タブ固有機能の設定
       */
      setupEditSpecialFeatures($li, inputs) {
        // 重み入力フィールドの追加や編集タブ固有の機能をここに実装
        // 現在は基本機能のみなので空実装
      }

      /**
       * 登録ハンドラー（編集タブから未登録プロンプトをローカル辞書に登録）
       */
      async handleRegistration(item, index) {
        const prompt = item.prompt || item.Value || '';
        const categoryData = item.data || item.categoryData || ['', '', ''];
        
        // ローカル辞書に登録
        const success = register(
          categoryData[0] || '', 
          categoryData[1] || '', 
          categoryData[2] || '', 
          prompt
        );
        
        if (success) {
          ErrorHandler.notify("ローカル辞書に登録しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: 1500,
          });
          
          // 登録した要素のRegボタンを即座に非活性化（スクロール位置保持）
          if (window.editElementManager && item?.id !== undefined) {
            console.log(`[EditTab] Immediately disabling register button for registered item: ${item.id}`);
            await window.editElementManager.updateSingleElementRegisterButton(item.id, 0);
          }
          
          // 辞書タブのローカルリストを更新
          if (window.app && window.app.tabs && window.app.tabs.dictionary) {
            window.app.tabs.dictionary.refreshAddList();
          }
          
          // 全要素のRegボタン状態を軽量更新（リフレッシュなし、スクロール位置保持）
          await this.updateRegisterButtonStates();
        }
      }

      /**
       * 削除ハンドラー（ListManagerの統一スクロール管理を使用）
       */
      async handleEditDelete(index, item) {
        if (window.editElementManager && item?.id !== undefined) {
          // EditElementManagerで統一削除（データ層のみ）
          await window.editElementManager.removeElement(item.id);
        } else {
          // フォールバック（旧実装）
          editPrompt.removeElement(index);
          window.app.updatePromptDisplay();
        }

        // ListManagerが自動的にスクロール位置保存・復元・リフレッシュを実行するので何もしない
      }

      /**
       * ソートハンドラー
       */
      handleEditSort(sortedIds) {
        console.log('[EditTab] handleEditSort called with sortedIds:', sortedIds);
        console.log('[EditTab] Current editPrompt.elements before sort:', editPrompt.elements?.map(el => ({ id: el.id, Value: el.Value, sort: el.sort })));
        
        this.app.listManager.handleSortCommon(sortedIds, editPrompt.elements, () => {
          console.log('[EditTab] Sort callback executed - regenerating prompt');
          console.log('[EditTab] editPrompt.elements after sort:', editPrompt.elements?.map(el => ({ id: el.id, Value: el.Value, sort: el.sort })));
          
          // プロンプト再生成前の状態
          const beforeGenerate = document.getElementById('generatePrompt')?.value;
          console.log('[EditTab] GeneratePrompt before generate():', beforeGenerate);
          
          editPrompt.generate();
          
          // プロンプト再生成後の状態
          const afterGenerate = document.getElementById('generatePrompt')?.value;
          console.log('[EditTab] GeneratePrompt after generate():', afterGenerate);
          
          window.app.updatePromptDisplay();
          
          // 最終的な状態
          const finalState = document.getElementById('generatePrompt')?.value;
          console.log('[EditTab] GeneratePrompt final state:', finalState);
          
          // ソート後は自動的にDOM順序が更新されるため、追加のリフレッシュは不要
          console.log('[EditTab] Sort completed - DOM order already updated by handleSortCommon');
        }, 'EDIT_TAB');
      }

      /**
       * 空の未設定要素を追加
       * @param {string} position - 追加位置 ('top' | 'bottom')
       */
      async addEmptyElement(position = 'bottom') {
        try {
          if (window.editElementManager) {
            // EditElementManagerで統一追加
            const addedElementId = await window.editElementManager.addElement(position, '');
            
            // 通知を表示
            const positionText = position === 'top' ? '上部' : '下部';
            ErrorHandler.notify(`${positionText}に空の要素を追加しました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.SHORT
            });
            
            return addedElementId;
          } else {
            // フォールバック（旧実装）
            const addedElementId = editPrompt.addElement(position, '', ID_OFFSETS.EDIT_TAB);
            // リフレッシュは外部から呼び出すことを想定（内部からは呼ばない）
            
            const positionText = position === 'top' ? '上部' : '下部';
            ErrorHandler.notify(`${positionText}に空の要素を追加しました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.SHORT
            });
            
            return addedElementId;
          }
        } catch (error) {
          console.error('[EditTab] Failed to add empty element:', error);
          ErrorHandler.notify('要素の追加に失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.STANDARD
          });
        }
      }

      /**
       * 現在のモードを更新
       */
      updateCurrentModes() {
        // 整形モード
        const checkedUIType = document.querySelector('[name="UIType"]:checked');
        if (checkedUIType) {
          this.currentShapingMode = checkedUIType.value;
        }

        // 編集モード（ドロップダウンから取得）
        const editTypeSelect = document.getElementById('EditType');
        if (editTypeSelect) {
          this.currentEditMode = editTypeSelect.value;
        }
      }

      /**
       * 単一要素モード用の分割ボタン表示制御
       */
      updateSplitButtonVisibility() {
        const splitSingleBtn = this.getElement('#splitSinglePrompt');
        if (!splitSingleBtn) return;

        // 現在のスロットモードをチェック
        const currentSlot = window.promptSlotManager?.slots[window.promptSlotManager?.currentSlot];
        const isSingleMode = currentSlot?.mode === 'single';
        
        // 単一要素モードで、かつ要素が1個の場合のみ表示
        const hasMultipleElements = editPrompt.elements.length > 1;
        const shouldShow = isSingleMode && !hasMultipleElements;
        
        splitSingleBtn.style.display = shouldShow ? 'flex' : 'none';
      }

      /**
       * 単一要素分割処理
       */
      async splitSinglePrompt() {
        if (editPrompt.elements.length !== 1) {
          ErrorHandler.notify('分割処理は要素が1個の時のみ実行できます', {
            type: 'warning',
            duration: 3000
          });
          return;
        }

        const element = editPrompt.elements[0];
        const currentPrompt = element.Value || element.prompt || '';
        
        if (!currentPrompt.includes(' ')) {
          ErrorHandler.notify('スペースで区切られた要素がないため、分割できません', {
            type: 'warning',
            duration: 3000
          });
          return;
        }

        try {
          // スペースをカンマに置き換え
          const convertedPrompt = currentPrompt.replace(/\s+/g, ',');
          
          // スロットマネージャーのプロンプトを更新
          if (window.promptSlotManager) {
            const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
            if (currentSlot) {
              currentSlot.prompt = convertedPrompt;
              currentSlot.isUsed = true;
              currentSlot.lastModified = Date.now();
              // スロットデータを保存
              window.promptSlotManager.saveToStorage();
            }
          }
          
          // GeneratePromptも更新（後方互換性）
          const generatePromptField = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePromptField) {
            generatePromptField.value = convertedPrompt;
          }
          
          // 編集タブを再初期化（既存の仕組みをすべて活用）
          this.editHandler.initializeEditMode();
          
          // 成功通知
          const splitCount = currentPrompt.split(/\s+/).length;
          ErrorHandler.notify(`${splitCount}個の要素に分割しました`, {
            type: 'success',
            duration: 2000
          });
          
        } catch (error) {
          console.error('[EditTab] Split error:', error);
          ErrorHandler.notify('分割処理中にエラーが発生しました', {
            type: 'error',
            duration: 3000
          });
        }
      }

      /**
       * 抽出モード状態をチェック（現在のスロットベース）
       */
      checkExtractionMode() {
        try {
          // promptSlotManagerが存在し、現在のスロットが抽出モードかチェック
          if (typeof promptSlotManager !== 'undefined' && promptSlotManager.slots) {
            const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
            const isCurrentSlotExtraction = currentSlot && 
              (currentSlot.mode === "random" || currentSlot.mode === "sequential");
            
            this.extractionModeActive = isCurrentSlotExtraction;
            console.log(`[EditTab] 現在のスロットの抽出モード状態: ${this.extractionModeActive}`);
            
            // 追加ボタンの状態を更新
            this.updateAddButtonsState();
            
            // 抽出モードに応じてGeneratePromptの状態を更新
            if (this.extractionModeActive) {
              this.setGeneratePromptExtractionMode();
            } else {
              this.setGeneratePromptNormalMode();
            }
          } else {
            this.extractionModeActive = false;
            this.updateAddButtonsState();
          }
        } catch (error) {
          console.error('[EditTab] 抽出モード状態チェック中にエラー:', error);
          this.extractionModeActive = false;
          this.updateAddButtonsState();
        }
      }

      /**
       * 追加ボタンの有効/無効状態を更新
       */
      updateAddButtonsState() {
        const addTopBtn = this.getElement('#addElementTop');
        const addBottomBtn = this.getElement('#addElementBottom');
        
        if (addTopBtn) {
          addTopBtn.disabled = this.extractionModeActive;
          if (this.extractionModeActive) {
            addTopBtn.title = "抽出モード中は要素を追加できません";
            addTopBtn.classList.add('disabled-extraction');
          } else {
            addTopBtn.title = "リストの上部に空の要素を追加";
            addTopBtn.classList.remove('disabled-extraction');
          }
        }
        
        if (addBottomBtn) {
          addBottomBtn.disabled = this.extractionModeActive;
          if (this.extractionModeActive) {
            addBottomBtn.title = "抽出モード中は要素を追加できません";
            addBottomBtn.classList.add('disabled-extraction');
          } else {
            addBottomBtn.title = "リストの下部に空の要素を追加";
            addBottomBtn.classList.remove('disabled-extraction');
          }
        }
        
        console.log(`[EditTab] 追加ボタンの状態を更新: ${this.extractionModeActive ? '無効' : '有効'}`);
      }

      /**
       * 抽出モード時のメッセージを統一された空状態表示で表示
       */
      showExtractionModeWithEmptyState() {
        try {
          // 抽出モードのスロット情報を収集
          const extractionSlots = promptSlotManager.slots
            .map((slot, index) => {
              if (slot.mode === "random" || slot.mode === "sequential") {
                return {
                  slotNumber: index + 1,
                  mode: slot.mode,
                  category: slot.category,
                  currentExtraction: slot.currentExtraction
                };
              }
              return null;
            })
            .filter(slot => slot !== null);
          
          // 統一された空状態表示を使用
          this.app.listManager.createEmptyState(
            DOM_SELECTORS.BY_ID.EDIT_LIST, 
            'extraction',
            { extractionSlots }
          );
          
          // GeneratePromptを抽出モード用に設定
          this.setGeneratePromptExtractionMode();
          
          console.log(`[EditTab] 抽出モードの空状態表示を作成しました`);
        } catch (error) {
          console.error('[EditTab] 抽出モード空状態表示作成中にエラー:', error);
        }
      }

      /**
       * 抽出モード時のメッセージを表示（旧メソッド）
       */
      showExtractionModeMessage() {
        try {
          const editList = this.getElement(`#${DOM_IDS.EDIT.LIST}`);
          if (!editList) return;

          const extractionSlots = promptSlotManager.slots.filter(slot => 
            slot.mode === "random" || slot.mode === "sequential"
          );

          const messageHTML = `
            <div class="extraction-mode-info">
              <h3>🎲 抽出モード有効</h3>
              <p>現在 ${extractionSlots.length} 個のスロットが抽出モードです。</p>
              <p>Generateボタンを押すと抽出されたプロンプトが表示されます。</p>
              <p>編集タブでの手動編集は無効です。</p>
              <div class="extraction-slots-info">
                ${extractionSlots.map((slot, index) => {
                  const slotNumber = promptSlotManager.slots.indexOf(slot) + 1;
                  return `
                    <div class="extraction-slot-item">
                      <span class="slot-number">${slotNumber}</span>
                      <span class="slot-mode">${slot.mode === "random" ? "ランダム" : "連続"}</span>
                      <span class="slot-category">${slot.category?.big || "全体"}</span>
                      ${slot.currentExtraction ? `
                        <div class="current-extraction">現在: ${slot.currentExtraction}</div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="extraction-note">
                <small>スロットタブで通常モードに切り替えることで編集が可能になります。</small>
              </div>
            </div>
          `;

          editList.innerHTML = messageHTML;
          
          // GeneratePromptを抽出モード用に設定
          this.setGeneratePromptExtractionMode();
          
          console.log(`[EditTab] 抽出モードメッセージを表示しました`);
        } catch (error) {
          console.error('[EditTab] 抽出モードメッセージ表示中にエラー:', error);
        }
      }

      /**
       * 通常モード復帰時の処理
       */
      restoreNormalMode() {
        try {
          this.extractionModeActive = false;
          console.log(`[EditTab] 通常モードに復帰しました`);
          
          // 追加ボタンを有効化
          this.updateAddButtonsState();
          
          // GeneratePromptを通常モードに復帰
          this.setGeneratePromptNormalMode();
          
          // 編集リストを通常モードで再初期化
          if (this.isCurrentTab()) {
            this.editHandler.initializeEditMode();
          }
        } catch (error) {
          console.error('[EditTab] 通常モード復帰中にエラー:', error);
        }
      }

      /**
       * スロットモード変更の監視
       */
      setupSlotModeChangeListener() {
        try {
          // スロットタブでのモード変更を監視
          const slotContainer = document.getElementById("slotContainer");
          if (slotContainer) {
            slotContainer.addEventListener("change", (e) => {
              if (e.target.classList.contains("slot-mode-radio")) {
                console.log(`[EditTab] スロットモード変更を検出: ${e.target.value}`);
                
                // 短時間後に抽出モード状態をチェック
                setTimeout(() => {
                  this.checkExtractionMode();
                  this.updateSplitButtonVisibility();
                  
                  // 現在編集タブがアクティブな場合のみ表示を更新
                  if (this.isCurrentTab()) {
                    const editList = this.getElement(`#${DOM_IDS.EDIT.LIST}`);
                    if (editList) {
                      if (this.extractionModeActive) {
                        this.showExtractionModeMessage();
                      } else {
                        this.restoreNormalMode();
                      }
                    }
                  }
                }, 100);
              }
            });
            
            console.log(`[EditTab] スロットモード変更監視を設定しました`);
          }
        } catch (error) {
          console.error('[EditTab] スロットモード変更監視設定中にエラー:', error);
        }
      }

      /**
       * 抽出完了イベントの監視
       */
      setupExtractionCompleteListener() {
        try {
          // 単一スロットの抽出完了イベント
          window.addEventListener("slotExtractionComplete", (event) => {
            console.log(`[EditTab] 抽出完了イベントを受信:`, event.detail);
            
            // 編集タブがアクティブかつ抽出モードの場合のみリフレッシュ
            if (this.isCurrentTab() && this.extractionModeActive) {
              setTimeout(() => {
                this.showExtractionModeWithEmptyState();
              }, 100);
            }
          });
          
          // 全スロットの抽出完了イベント
          window.addEventListener("allExtractionsComplete", () => {
            console.log(`[EditTab] 全抽出完了イベントを受信`);
            
            // 編集タブがアクティブかつ抽出モードの場合のみリフレッシュ
            if (this.isCurrentTab() && this.extractionModeActive) {
              setTimeout(() => {
                this.showExtractionModeWithEmptyState();
              }, 100);
            }
          });
          
          console.log(`[EditTab] 抽出完了イベント監視を設定しました`);
        } catch (error) {
          console.error('[EditTab] 抽出完了イベント監視設定中にエラー:', error);
        }
      }

      /**
       * スロット変更イベントの監視
       */
      setupSlotChangeListener() {
        try {
          window.addEventListener('slotChanged', (event) => {
            console.log(`[EditTab] スロット変更イベントを受信:`, event.detail);
            
            // 編集タブがアクティブな場合のみ処理
            if (this.isCurrentTab()) {
              // 抽出モード状態をチェックし、追加ボタンの状態を更新
              this.checkExtractionMode();
              this.updateSplitButtonVisibility();
              
              // 抽出モードの場合は表示を更新
              if (this.extractionModeActive) {
                this.showExtractionModeWithEmptyState();
              }

              // スロット切り替え時にジェネレートプロンプトを自動更新
              this.updateGeneratePromptOnSlotChange();
              
              // スロット統合パネルの値を更新
              this.updateSlotIntegrationPanel();
              
              // 統合パネルの表示制御を更新（モードに応じて表示・非表示）
              this.updateIntegrationPanelVisibility();
              
            }
          });
          
          console.log(`[EditTab] スロット変更イベント監視を設定しました`);
        } catch (error) {
          console.error('[EditTab] スロット変更イベント監視設定中にエラー:', error);
        }
      }

      /**
       * スロット切り替え時にジェネレートプロンプトを自動更新
       */
      async updateGeneratePromptOnSlotChange() {
        try {
          // 現在のスロット情報を取得
          const currentSlot = this.getCurrentSlot();
          
          if (!currentSlot) {
            console.log('[EditTab] No current slot for generate prompt update');
            return;
          }
          
          // 編集タブがアクティブでない場合はスキップ
          if (!this.isCurrentTab()) {
            console.log('[EditTab] Edit tab not active, skipping generate prompt update');
            return;
          }
          
          // スロットに保存されているプロンプトをジェネレートプロンプトに設定
          if (currentSlot.prompt) {
            const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
            if (generatePrompt) {
              generatePrompt.value = currentSlot.prompt;
              console.log('[EditTab] Updated generate prompt with slot content:', currentSlot.prompt.substring(0, 50) + '...');
            }
          }
          
        } catch (error) {
          console.error('[EditTab] Failed to update generate prompt on slot change:', error);
        }
      }

      /**
       * GeneratePromptを抽出モード用に設定
       */
      setGeneratePromptExtractionMode() {
        try {
          const generatePrompt = document.getElementById("generatePrompt");
          if (generatePrompt) {
            // 現在のスロットのプロンプトを設定（結合しない）
            const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
            if (currentSlot) {
              const weightedPrompt = currentSlot.prompt ? 
                promptSlotManager.applyWeightToPrompt(currentSlot.prompt, currentSlot.weight) : 
                "[抽出待機中 - Generateボタンを押して抽出]";
              generatePrompt.value = weightedPrompt;
              generatePrompt.readOnly = true;
              generatePrompt.title = "抽出モードで生成されたプロンプト（読み取り専用）";
              
              console.log(`[EditTab] GeneratePromptを現在のスロットのプロンプトで設定: "${weightedPrompt}"`);
            }
          }
        } catch (error) {
          console.error('[EditTab] GeneratePrompt抽出モード設定中にエラー:', error);
        }
      }

      /**
       * GeneratePromptを通常モードに復帰
       */
      setGeneratePromptNormalMode() {
        try {
          const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
          if (generatePrompt) {
            generatePrompt.readOnly = false;
            generatePrompt.title = "生成されたプロンプトが表示されます（手動編集も可能）";
            
            console.log(`[EditTab] GeneratePromptを通常モードに復帰しました`);
          }
        } catch (error) {
          console.error('[EditTab] GeneratePrompt通常モード復帰中にエラー:', error);
        }
      }

      /**
       * デバッグ情報を出力（オーバーライド）
       */
      /**
       * Registerボタンクリック処理
       * @param {string} promptValue - 登録するプロンプト値
       * @param {Object} element - 要素オブジェクト
       * @param {number} elementIndex - 要素インデックス
       */
      handleRegisterClick(promptValue, element, elementIndex) {
        console.log(`[EditTab] Register button clicked: prompt="${promptValue}", elementId=${element?.id}, index=${elementIndex}`);
        
        if (!promptValue || !promptValue.trim()) {
          console.warn(`[EditTab] Cannot register empty prompt`);
          return;
        }
        
        // 重複チェック
        if (isPromptInDictionary(promptValue)) {
          console.log(`[EditTab] Prompt already exists in dictionary: "${promptValue}"`);
          
          // トースト通知で登録済みを表示
          if (window.ErrorHandler && typeof ErrorHandler.showToast === 'function') {
            ErrorHandler.showToast(`"${promptValue}" は既に辞書に登録済みです`, 3000, 'info');
          } else {
            console.info(`[EditTab] Registration skipped: "${promptValue}" is already in dictionary`);
          }
          
          // Regボタンを非活性化
          if (window.editElementManager && element?.id !== undefined) {
            setTimeout(() => {
              window.editElementManager.updateSingleElementRegisterButton(element.id, 100);
            }, 50);
          }
          
          return;
        }
        
        // ローカル辞書に追加
        const newLocalItem = {
          prompt: promptValue.trim(),
          data: element?.data || ["", "", ""]
        };
        
        console.log(`[EditTab] Adding to local dictionary:`, newLocalItem);
        
        // AppState経由でローカルリストに追加
        if (!AppState.data.localPromptList) {
          AppState.data.localPromptList = [];
        }
        
        AppState.data.localPromptList.push(newLocalItem);
        
        // ローカルリストを保存
        saveLocalList(false).then(() => {
          console.log(`[EditTab] Successfully registered prompt to local dictionary: "${promptValue}"`);
          
          // 登録後にRegボタンの状態を更新（非活性にする）
          if (window.editElementManager && element?.id !== undefined) {
            setTimeout(() => {
              window.editElementManager.updateSingleElementRegisterButton(element.id, 100);
            }, 50);
          }
          
        }).catch(error => {
          console.error(`[EditTab] Failed to save local list after registration:`, error);
        });
      }

      /**
       * CategoryUIManagerの準備完了を待つ
       */
      async waitForCategoryUIManagerReady() {
        let attempts = 0;
        const maxAttempts = 20; // 最大2秒待機 (100ms × 20)
        
        while (attempts < maxAttempts) {
          const categories = this.categoryUIManager.getCategoriesByLevel(0, null);
          if (categories.length >= 10) {
            if (AppState.config.debugMode) {
              console.log(`[EditTab] CategoryUIManager準備完了。カテゴリー数: ${categories.length}`);
            }
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        console.warn(`[EditTab] CategoryUIManager準備タイムアウト。現在のカテゴリー数: ${this.categoryUIManager.getCategoriesByLevel(0, null).length}`);
      }

      /**
       * スロットマネージャーの初期化を待つ
       */
      async waitForSlotManager(maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          if (this.app && this.app.tabs && this.app.tabs.slot && this.app.tabs.slot.slotManager) {
            if (AppState.config.debugMode) {
              console.log('[EditTab] Slot manager is ready after', i, 'attempts');
            }
            return true;
          }
          if (AppState.config.debugMode) {
            console.log('[EditTab] Waiting for slot manager... attempt', i + 1);
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.warn('[EditTab] Slot manager not available after', maxAttempts, 'attempts');
        return false;
      }

      /**
       * スロット統合機能のハンドラー設定
       */
      async setupSlotIntegrationHandlers() {
        if (AppState.config.debugMode) {
          console.log('[EditTab] Setting up slot integration handlers...');
        }
        
        // スロットモード選択
        const slotModeSelect = document.getElementById(DOM_IDS.EDIT.SLOT_MODE);
        if (AppState.config.debugMode) {
          console.log('[EditTab] Slot mode select element:', slotModeSelect);
        }
        if (slotModeSelect) {
          this.addEventListener(slotModeSelect, "change", async (e) => {
            if (AppState.config.debugMode) {
              console.log('[EditTab] Slot mode changed:', e.target.value);
            }
            await this.handleSlotModeChange(e);
          });
        }

        // スロット重み設定はsetupSlotWeightInputHandlersで処理するため、ここでは削除

        // データソース選択
        const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
        if (AppState.config.debugMode) {
          console.log('[EditTab] Data source select element:', dataSourceSelect);
        }
        if (dataSourceSelect) {
          this.addEventListener(dataSourceSelect, "change", async (e) => {
            if (AppState.config.debugMode) {
              console.log('[EditTab] Data source changed:', e.target.value);
            }
            await this.handleDataSourceChange(e);
          });
        }
        
        // カテゴリー選択のイベントリスナーを設定（スロットタブと同じ処理）
        this.setupCategoryEventListeners();
        
        // 整形モード変更監視を追加
        const uiTypeRadios = document.querySelectorAll('[name="UIType"]');
        uiTypeRadios.forEach(radio => {
          radio.addEventListener('change', () => {
            console.log('[EditTab] Shaping mode changed to:', radio.value);
            this.updateSlotWeightInputConfig();
            // 現在のスロットの重み値もリセット
            this.resetCurrentSlotWeightForNewShaping();
          });
        });
        
        // スロット重み入力のイベントハンドラーを設定
        this.setupSlotWeightInputHandlers();
        
        // 初期化処理は onShow() メソッドで実行するため、ここでは削除
        if (AppState.config.debugMode) {
          console.log('[EditTab] Slot integration handlers setup completed - initial values will be set on tab show');
        }
      }

      /**
       * 現在のデータソース設定に基づいて初期化
       */
      async initializeCurrentDataSource() {
        try {
          if (AppState.config.debugMode) {
            console.log('[EditTab] === 初期化処理開始 ===');
          }
          
          // スロットマネージャーの初期化を待つ
          await this.waitForSlotManager();
          
          // 現在のスロットからデータソースを取得
          const currentSlot = this.getCurrentSlot();
          let currentDataSource = 'dictionary'; // デフォルト

          if (AppState.config.debugMode) {
            console.log('[EditTab] 初期化時のスロットデータ詳細:', {
              slot: currentSlot,
              dataSource: currentSlot?.dataSource,
              category: currentSlot?.category,
              favoritesDict: currentSlot?.favoritesDict
            });
          }
          
          // カテゴリー詳細を個別に表示
          if (currentSlot?.category) {
            if (AppState.config.debugMode) {
              console.log('[EditTab] カテゴリー詳細:', {
                big: currentSlot.category.big,
                middle: currentSlot.category.middle,
                bigType: typeof currentSlot.category.big,
                middleType: typeof currentSlot.category.middle
              });
            }
          }

          if (currentSlot && currentSlot.dataSource) {
            currentDataSource = currentSlot.dataSource;
          }

          if (AppState.config.debugMode) {
            console.log('[EditTab] 初期化データソース:', currentDataSource);
          }

          // データソース選択の値を設定
          const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
          if (dataSourceSelect) {
            dataSourceSelect.value = currentDataSource;
          }

          // データソース詳細の初期化
          await this.initializeDataSourceDetails(currentDataSource);
          
          // 初期表示状態を設定
          this.toggleDataSourceDetailsUI(currentDataSource);

          // 現在のスロットに保存されている選択値を復元
          if (currentSlot) {
            await this.restoreSlotSelections(currentSlot, currentDataSource);
          }

        } catch (error) {
          console.warn('[EditTab] Failed to initialize current data source:', error);
          // フォールバック：辞書モードで初期化
          await this.initializeDataSourceDetails('dictionary');
          this.toggleDataSourceDetailsUI('dictionary');
          
          // データソース選択の値も設定
          const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
          if (dataSourceSelect) {
            dataSourceSelect.value = 'dictionary';
          }
        }
      }

      /**
       * スロットに保存されている選択値を復元
       */
      async restoreSlotSelections(slot, dataSource) {
        if (AppState.config.debugMode) {
          console.log('[EditTab] Restoring slot selections:', {
            dataSource,
            slotCategory: slot.category,
            slotFavoriteDictionaryId: slot.favoriteDictionaryId
          });
        }
        
        if (AppState.config.debugMode) {
          console.log(`[EditTab] 復元処理条件チェック:`, {
            dataSource,
            isDict: dataSource === 'dictionary',
            hasCategory: !!slot.category,
            categoryBig: slot.category?.big,
            categoryMiddle: slot.category?.middle
          });
        }
        
        if (dataSource === 'dictionary' && slot.category) {
          if (AppState.config.debugMode) {
            console.log('[EditTab] Restoring dictionary categories:', slot.category);
          }
          
          // 大項目を復元
          const bigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
          
          if (AppState.config.debugMode) {
            console.log('[EditTab] Debug - bigSelect existence and category values:', {
              bigSelectExists: !!bigSelect,
              categoryBig: slot.category.big,
              categoryBigLength: slot.category.big?.length,
              isEmpty: slot.category.big === '',
              hasCategory: !!slot.category.big
            });
          }
          
          if (bigSelect && slot.category.big && slot.category.big !== '') {
            try {
              if (AppState.config.debugMode) {
                console.log(`[EditTab] 大項目復元: ${slot.category.big}`);
              }
              
              // セレクトボックスのオプション一覧を確認
              const availableOptions = Array.from(bigSelect.options).map(opt => opt.value);
              if (AppState.config.debugMode) {
                console.log(`[EditTab] 大項目の利用可能なオプション:`, availableOptions);
                console.log(`[EditTab] 設定しようとしている値: "${slot.category.big}"`);
                console.log(`[EditTab] オプションに値が存在するか:`, availableOptions.includes(slot.category.big));
              }
              
              bigSelect.value = slot.category.big;
              if (AppState.config.debugMode) {
                console.log(`[EditTab] 大項目設定後の実際の値: "${bigSelect.value}"`);
              }
              
              // 中項目セレクターを更新（イベント発火なし）  
              const middleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);
              if (middleSelect) {
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] 中項目オプション生成開始...`);
                }
                this.updateMiddleCategories(middleSelect, slot.category.big);
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] 中項目オプション生成完了。オプション数: ${middleSelect.options.length}`);
                }
                
                // 中項目を復元
                if (slot.category.middle && slot.category.middle !== '') {
                  if (AppState.config.debugMode) {
                    console.log(`[EditTab] 中項目復元: ${slot.category.middle}`);
                  }
                  middleSelect.value = slot.category.middle;
                  if (AppState.config.debugMode) {
                    console.log(`[EditTab] 中項目設定後の実際の値: "${middleSelect.value}"`);
                  }
                }
              } else {
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] 中項目セレクターが見つかりません`);
                }
              }
              
              // 復元完了後の最終確認
              setTimeout(() => {
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] 復元完了後の最終確認:`, {
                    bigSelectValue: bigSelect.value,
                    middleSelectValue: middleSelect?.value,
                    bigSelectOptions: bigSelect.options.length,
                    middleSelectOptions: middleSelect?.options.length
                  });
                }
              }, 200);
              
            } catch (error) {
              console.error(`[EditTab] カテゴリー復元中にエラー:`, error);
            }
            
          } else {
            if (AppState.config.debugMode) {
              console.log('[EditTab] No big category found or bigSelect not available:', {
                bigSelect: !!bigSelect,
                categoryBig: slot.category?.big,
                categoryBigValue: `"${slot.category?.big}"`,
                categoryBigType: typeof slot.category?.big,
                bigSelectValue: bigSelect?.value,
                bigSelectOptions: bigSelect ? Array.from(bigSelect.options).map(opt => opt.value) : []
              });
            }
          }
        } else if (dataSource === 'favorites' && slot.favoriteDictionaryId) {
          // お気に入り辞書を復元（スロットタブと同じプロパティ名を使用）
          const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);
          if (favoritesSelect) {
            // オプションが存在するかチェック
            const availableOptions = Array.from(favoritesSelect.options).map(opt => opt.value);
            if (AppState.config.debugMode) {
              console.log(`[EditTab] お気に入り辞書復元:`, {
                targetValue: slot.favoriteDictionaryId,
                availableOptions,
                optionExists: availableOptions.includes(slot.favoriteDictionaryId)
              });
            }
            
            if (availableOptions.includes(slot.favoriteDictionaryId)) {
              favoritesSelect.value = slot.favoriteDictionaryId;
              console.log(`[EditTab] お気に入り辞書設定完了: ${slot.favoriteDictionaryId}`);
              
              // 設定後の確認（少し遅延を入れて確実にチェック）
              setTimeout(() => {
                if (AppState.config.debugMode) {
                  console.log(`[EditTab] お気に入り辞書設定確認:`, {
                    expectedValue: slot.favoriteDictionaryId,
                    actualValue: favoritesSelect.value,
                    isCorrectlySet: favoritesSelect.value === slot.favoriteDictionaryId
                  });
                }
              }, 100);
              
            } else {
              console.warn(`[EditTab] お気に入り辞書が見つかりません: ${slot.favoriteDictionaryId}`);
              // デバッグ用：スロットの全プロパティを表示
              if (AppState.config.debugMode) {
                console.log('[EditTab] スロットの全プロパティ:', slot);
                console.log('[EditTab] 利用可能なオプション:', availableOptions);
              }
            }
          }
        }
      }

      /**
       * 初期値設定が必要かどうかを判定
       * @returns {boolean} 初期値設定が必要な場合true
       */
      shouldInitializeInitialValues() {
        // データソース選択の値をチェック
        const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
        if (!dataSourceSelect || !dataSourceSelect.value) {
          console.log('[EditTab] Data source not set, initialization needed');
          return true;
        }
        
        const currentDataSource = dataSourceSelect.value;
        console.log('[EditTab] Current data source:', currentDataSource);
        
        if (currentDataSource === 'dictionary') {
          // 辞書モードの場合：大項目・中項目の値をチェック
          const bigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
          const middleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);
          
          const bigValue = bigSelect?.value || '';
          const middleValue = middleSelect?.value || '';
          
          console.log('[EditTab] Dictionary mode values check:', {
            bigValue: `"${bigValue}"`,
            middleValue: `"${middleValue}"`,
            bigEmpty: bigValue === '',
            middleEmpty: middleValue === ''
          });
          
          // 大項目または中項目が空の場合は初期化が必要
          if (bigValue === '' || middleValue === '') {
            console.log('[EditTab] Dictionary categories empty, initialization needed');
            return true;
          }
        } else if (currentDataSource === 'favorites') {
          // お気に入りモードの場合：お気に入り選択の値をチェック
          const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);
          const favValue = favoritesSelect?.value || '';
          
          console.log('[EditTab] Favorites mode value check:', {
            favValue: `"${favValue}"`,
            favEmpty: favValue === ''
          });
          
          if (favValue === '') {
            console.log('[EditTab] Favorites selection empty, initialization needed');
            return true;
          }
        }
        
        console.log('[EditTab] All values are set, no initialization needed');
        return false;
      }

      /**
       * スロットモード変更ハンドラー
       */
      async handleSlotModeChange(event) {
        const newMode = event.target.value;
        console.log(`[EditTab] Slot mode changed to: ${newMode}`);
        
        try {
          const currentSlot = this.getCurrentSlot();
          if (!currentSlot) {
            console.warn('[EditTab] No current slot found for mode change');
            return;
          }
          
          // スロットモードを更新
          currentSlot.mode = newMode;
          currentSlot.lastModified = Date.now();
          
          // スロットマネージャーに保存
          if (window.promptSlotManager) {
            await window.promptSlotManager.saveToStorage();
          }
          
          // セパレーター更新処理
          if (window.updateGeneratePromptSeparatorForSlotMode) {
            await window.updateGeneratePromptSeparatorForSlotMode(newMode, 'EditTabSlotModeChange');
          }
          
          // 抽出モード状態を更新
          this.checkExtractionMode();
          
          // 編集タブの表示を更新
          if (this.extractionModeActive) {
            this.showExtractionModeWithEmptyState();
          } else {
            // 通常モードの場合は編集モードを再初期化
            this.editHandler.initializeEditMode();
          }
          
          // 統合パネルの表示制御を更新
          this.updateIntegrationPanelVisibility();
          
        } catch (error) {
          console.error('[EditTab] Error handling slot mode change:', error);
        }
      }
      
      
      /**
       * ホイール操作で重み変更（スロットタブと同じロジック）
       */
      handleWeightWheelChange(event) {
        event.preventDefault();
        const input = event.target;
        
        // スロットタブと同じ処理：WeightConverterを使用
        const currentShaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(currentShaping);
        
        const currentValue = parseFloat(input.value) || 0;
        let delta = weightConfig.delta;
        
        // 修飾キーによるdelta調整（スロットタブと同じ）
        if (event.shiftKey) {
          delta *= 10; // Shift: 大きく変更
        } else if (event.ctrlKey) {
          delta /= 10; // Ctrl: 細かく変更
        }
        
        // ホイールの方向に応じて値を増減
        const direction = event.deltaY > 0 ? -1 : 1;
        const newValue = currentValue + (direction * delta);
        
        // 範囲内に制限
        const clampedValue = Math.max(
          weightConfig.min,
          Math.min(weightConfig.max, newValue)
        );
        
        // 値を設定（適切な小数点精度で丸める）
        input.value = Math.round(clampedValue * 100) / 100;
        
        // changeイベントを発火
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      /**
       * データソース変更ハンドラー
       */
      async handleDataSourceChange(event) {
        const newDataSource = event.target.value;
        console.log(`[EditTab] Data source changed to: ${newDataSource}`);
        
        try {
          const currentSlot = this.getCurrentSlot();
          if (!currentSlot) {
            console.warn('[EditTab] No current slot found for data source change');
            return;
          }
          
          // データソースを更新
          currentSlot.dataSource = newDataSource;
          currentSlot.lastModified = Date.now();
          
          // データソース詳細UIを切り替え
          this.toggleDataSourceDetailsUI(newDataSource);
          
          // データソース詳細を初期化
          await this.initializeDataSourceDetails(newDataSource);
          
          // スロットマネージャーに保存
          if (window.promptSlotManager) {
            await window.promptSlotManager.saveToStorage();
          }
          
        } catch (error) {
          console.error('[EditTab] Error handling data source change:', error);
        }
      }
      
      /**
       * 現在のスロットを取得
       */
      getCurrentSlot() {
        if (window.promptSlotManager && window.promptSlotManager.slots) {
          return window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
        }
        return null;
      }
      
      /**
       * スロット統合パネルの更新
       */
      updateSlotIntegrationPanel() {
        try {
          const currentSlot = this.getCurrentSlot();
          if (!currentSlot) {
            console.warn('[EditTab] No current slot for integration panel update');
            return;
          }
          
          // スロットモードを更新
          const slotModeSelect = document.getElementById(DOM_IDS.EDIT.SLOT_MODE);
          if (slotModeSelect) {
            slotModeSelect.value = currentSlot.mode || 'normal';
          }
          
          // スロット重みを更新
          const slotWeightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
          if (slotWeightInput) {
            // スロットマネージャーのgetDefaultWeightを使用
            const defaultWeight = window.promptSlotManager ? 
              window.promptSlotManager.getDefaultWeight() : 
              this.getDefaultWeight();
            slotWeightInput.value = currentSlot.weight !== undefined ? 
              currentSlot.weight : 
              defaultWeight;
            
            console.log(`[EditTab] Setting slot weight:`, {
              slotWeight: currentSlot.weight,
              defaultWeight,
              finalValue: slotWeightInput.value,
              shaping: this.getCurrentShaping()
            });
          }
          
          // データソースを更新
          const dataSourceSelect = document.getElementById(DOM_IDS.EDIT.DATA_SOURCE);
          const currentDataSource = currentSlot.dataSource || 'dictionary';
          if (dataSourceSelect) {
            dataSourceSelect.value = currentDataSource;
          }
          
          // データソース詳細UIを切り替え
          this.toggleDataSourceDetailsUI(currentDataSource);
          
          // データソース詳細を初期化してから選択値を復元
          this.initializeDataSourceDetails(currentDataSource).then(() => {
            // 選択値を復元
            this.restoreSlotSelections(currentSlot, currentDataSource);
          });
          
          console.log('[EditTab] Updated slot integration panel, dataSource:', currentDataSource);
          
        } catch (error) {
          console.error('[EditTab] Error updating slot integration panel:', error);
        }
      }
      
      /**
       * データソース詳細UIの表示切り替え
       */
      toggleDataSourceDetailsUI(dataSource) {
        const dictionaryControls = document.querySelectorAll('.dictionary-selection-control');
        const favoritesControls = document.querySelectorAll('.favorites-selection-control');
        
        if (dataSource === 'dictionary') {
          dictionaryControls.forEach(control => control.style.display = 'flex');
          favoritesControls.forEach(control => control.style.display = 'none');
        } else if (dataSource === 'favorites') {
          dictionaryControls.forEach(control => control.style.display = 'none');
          favoritesControls.forEach(control => control.style.display = 'flex');
        }
        
        console.log(`[EditTab] Toggled data source UI to: ${dataSource}`);
      }
      
      /**
       * データソース詳細の初期化
       */
      async initializeDataSourceDetails(dataSource) {
        try {
          if (dataSource === 'dictionary') {
            await this.initializeDictionarySelectors();
          } else if (dataSource === 'favorites') {
            await this.initializeFavoritesSelector();
          }
        } catch (error) {
          console.error('[EditTab] Error initializing data source details:', error);
        }
      }
      
      /**
       * 辞書セレクターの初期化（スロットタブと同じ処理）
       */
      async initializeDictionarySelectors() {
        // スロットタブと同じsetupCategorySelectorを使用
        this.setupCategorySelectors();
      }
      
      /**
       * お気に入りセレクターの初期化
       */
      async initializeFavoritesSelector() {
        const favoritesSelect = document.getElementById(DOM_IDS.EDIT.FAVORITES_SELECT);
        
        if (favoritesSelect) {
          await this.populateFavoritesSelect(favoritesSelect);
        }
      }
      
      
      /**
       * お気に入りセレクターを辞書で埋める（スロットタブと同じ処理）
       */
      async populateFavoritesSelect(selectElement) {
        try {
          if (!selectElement) return;
          
          // スロットタブと同じ処理：AppState.data.promptDictionariesを使用
          const allDictionaries = AppState.data.promptDictionaries || {};
          const dictionaryIds = Object.keys(allDictionaries);
          
          console.log(`[EditTab] Loading favorites from AppState, found ${dictionaryIds.length} dictionaries`);
          
          // 既存オプションをクリア
          selectElement.innerHTML = '<option value="">選択してください</option>';
          
          // 辞書リストをオプションに追加
          dictionaryIds.forEach(dictId => {
            const dict = allDictionaries[dictId];
            if (dict && dict.name) {
              const option = document.createElement('option');
              option.value = dictId;
              option.textContent = dict.name;
              selectElement.appendChild(option);
              
              if (AppState.config.debugMode) {
                console.log(`[EditTab] Added favorites option: ${dict.name} (${dictId})`);
              }
            }
          });
          
          console.log(`[EditTab] Populated favorites select with ${dictionaryIds.length} dictionaries`);
          
        } catch (error) {
          console.error('[EditTab] Error populating favorites select:', error);
        }
      }
      
      /**
       * カテゴリー選択のイベントリスナーを設定（スロットタブと同じ処理）
       */
      setupCategoryEventListeners() {
        const categoryBigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
        const categoryMiddleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);
        
        if (!categoryBigSelect || !categoryMiddleSelect) {
          if (AppState.config.debugMode) {
            console.log('[EditTab] Category selects not found:', {
              categoryBigSelect: !!categoryBigSelect,
              categoryMiddleSelect: !!categoryMiddleSelect
            });
          }
          return;
        }
        
        // 大項目選択時のイベントリスナー（スロットタブと同じ）
        categoryBigSelect.addEventListener("change", async (e) => {
          const bigCategory = e.target.value;
          const currentSlot = this.getCurrentSlot();
          
          if (currentSlot) {
            if (!currentSlot.category) {
              currentSlot.category = {};
            }
            currentSlot.category.big = bigCategory;
            currentSlot.category.middle = ""; // 中項目をリセット
            
            // スロットマネージャーに保存
            if (window.promptSlotManager) {
              await window.promptSlotManager.saveToStorage();
            }
          }
          
          // 中項目オプションを更新
          if (bigCategory) {
            this.updateMiddleCategories(categoryMiddleSelect, bigCategory);
            categoryMiddleSelect.disabled = false;
          } else {
            categoryMiddleSelect.innerHTML = '<option value="">すべて</option>';
            categoryMiddleSelect.disabled = true;
          }
          
          if (AppState.config.debugMode) {
            console.log('[EditTab] Big category changed:', bigCategory);
          }
        });
        
        // 中項目選択時のイベントリスナー（スロットタブと同じ）
        categoryMiddleSelect.addEventListener("change", async (e) => {
          const middleCategory = e.target.value;
          const currentSlot = this.getCurrentSlot();
          
          if (currentSlot) {
            if (!currentSlot.category) {
              currentSlot.category = {};
            }
            currentSlot.category.middle = middleCategory;
            
            // スロットマネージャーに保存
            if (window.promptSlotManager) {
              await window.promptSlotManager.saveToStorage();
            }
          }
          
          if (AppState.config.debugMode) {
            console.log('[EditTab] Middle category changed:', middleCategory);
          }
        });
        
        if (AppState.config.debugMode) {
          console.log('[EditTab] Category event listeners setup completed');
        }
      }
      
      /**
       * カテゴリーオプションを取得（スロットタブと同じ処理）
       */
      getCategoryOptions(type) {
        if (type === "big") {
          // CategoryUIManagerのgetCategoriesByLevelを使用（スロットタブと同じ）
          return this.categoryUIManager.getCategoriesByLevel(0, null);
        }
        return [];
      }
      
      /**
       * 中項目カテゴリーを更新（スロットタブと同じ処理）
       */
      updateMiddleCategories(select, bigCategory) {
        // CategoryUIManagerのgetCategoriesByLevelを使用（スロットタブと同じ）
        const categories = this.categoryUIManager.getCategoriesByLevel(1, bigCategory);

        // まずクリアしてから追加
        select.innerHTML = '<option value="">すべて</option>';

        categories.forEach((cat) => {
          const option = document.createElement("option");
          option.value = cat;
          option.textContent = cat;
          select.appendChild(option);
        });
        
        if (AppState.config.debugMode) {
          console.log(`[EditTab] Updated middle categories for ${bigCategory}:`, categories);
        }
      }
      
      /**
       * カテゴリーセレクターを設定（スロットタブと同じ処理）
       */
      setupCategorySelectors() {
        const bigSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_BIG);
        const middleSelect = document.getElementById(DOM_IDS.EDIT.CATEGORY_MIDDLE);

        if (!bigSelect) return;

        // 大項目オプションを追加
        bigSelect.innerHTML = '<option value="">すべて</option>';
        const bigCategories = this.getCategoryOptions("big");
        
        bigCategories.forEach((cat) => {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat;
          bigSelect.appendChild(option);
        });

        // 現在のスロットの値を復元
        const currentSlot = this.getCurrentSlot();
        if (currentSlot && currentSlot.category) {
          // DOMが更新された後に値を設定
          requestAnimationFrame(() => {
            if (currentSlot.category.big) {
              bigSelect.value = currentSlot.category.big;
              this.updateMiddleCategories(middleSelect, currentSlot.category.big);
              middleSelect.disabled = false;

              if (currentSlot.category.middle) {
                requestAnimationFrame(() => {
                  middleSelect.value = currentSlot.category.middle;
                });
              }
            }
          });
        }
        
        if (AppState.config.debugMode) {
          console.log(`[EditTab] Setup category selectors with ${bigCategories.length} big categories`);
        }
      }
      
      /**
       * 統合パネルの表示制御（スロットモードに応じて要素を表示・非表示）
       */
      updateIntegrationPanelVisibility() {
        const modeSelectionPanel = document.querySelector('.edit-mode-selection');
        if (!modeSelectionPanel) {
          console.warn('[EditTab] Mode selection panel not found');
          return;
        }
        
        const currentSlot = this.getCurrentSlot();
        // checkExtractionMode()で既に設定されたフラグを使用
        const isExtractionMode = this.extractionModeActive;
        const dataSource = currentSlot?.dataSource || 'dictionary';
        
        // 編集モード選択の表示制御
        const editModeDropdown = document.querySelector('.edit-mode-dropdown');
        if (editModeDropdown) {
          editModeDropdown.style.display = isExtractionMode ? 'none' : 'flex';
        }
        
        // データソース選択の表示制御
        const dataSourceControl = document.querySelector('.slot-data-source-control');
        if (dataSourceControl) {
          dataSourceControl.style.display = isExtractionMode ? 'flex' : 'none';
        }
        
        // 辞書選択の表示制御
        const dictionaryControls = document.querySelectorAll('.dictionary-selection-control');
        dictionaryControls.forEach(control => {
          control.style.display = (isExtractionMode && dataSource === 'dictionary') ? 'flex' : 'none';
        });
        
        // お気に入り選択の表示制御
        const favoritesControls = document.querySelectorAll('.favorites-selection-control');
        favoritesControls.forEach(control => {
          control.style.display = (isExtractionMode && dataSource === 'favorites') ? 'flex' : 'none';
        });
        
        // 抽出モードの状態に応じてクラスを設定
        if (isExtractionMode) {
          modeSelectionPanel.classList.add('extraction-mode');
        } else {
          modeSelectionPanel.classList.remove('extraction-mode');
        }
        
        if (AppState.config.debugMode) {
          console.log('[EditTab] Updated integration panel visibility:', {
            isExtractionMode,
            dataSource,
            slotMode: currentSlot?.mode,
            editModeVisible: !isExtractionMode,
            dataSourceVisible: isExtractionMode,
            dictionaryControlsVisible: isExtractionMode && dataSource === 'dictionary',
            favoritesControlsVisible: isExtractionMode && dataSource === 'favorites'
          });
        }
      }
      

      /**
       * デフォルト重み値を取得
       */
      getDefaultWeight() {
        const shaping = this.getCurrentShaping();
        switch (shaping) {
          case 'SD':
            return 1.0; // SD形式では1.0が無効化される値
          case 'NAI':
            return 0.0; // NAI形式では0.0が無効化される値
          case 'None':
          default:
            return 1.0; // None形式では重みは使用されないが、1.0をデフォルトとする
        }
      }
      
      /**
       * 現在の整形モードを取得（スロットタブと統一）
       */
      getCurrentShaping() {
        if (typeof AppState !== 'undefined' && AppState.userSettings?.optionData?.shaping) {
          return AppState.userSettings.optionData.shaping;
        }
        return 'SD';
      }

      /**
       * スロットミュートボタンのハンドラー設定
       */
      setupSlotMuteHandler() {
        const muteBtn = this.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_BTN}`);
        if (muteBtn) {
          this.addEventListener(muteBtn, 'click', () => {
            this.toggleCurrentSlotMute();
          });
          console.log('[EditTab] Slot mute button handler setup completed');
        }
      }

      /**
       * 現在のスロットのミュート状態をトグル
       */
      async toggleCurrentSlotMute() {
        try {
          if (window.promptSlotManager) {
            const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
            if (currentSlot) {
              await window.promptSlotManager.toggleSlotMute(currentSlot.id);
              this.updateSlotMuteButton();
              console.log(`[EditTab] Slot ${currentSlot.id} mute toggled to: ${currentSlot.muted}`);
            }
          }
        } catch (error) {
          console.error('[EditTab] Error toggling slot mute:', error);
        }
      }

      /**
       * ミュートボタンの表示状態を更新
       */
      updateSlotMuteButton() {
        const muteBtn = this.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_BTN}`);
        const muteIcon = this.getElement(`#${DOM_IDS.EDIT.SLOT_MUTE_ICON}`);
        
        if (muteBtn && muteIcon && window.promptSlotManager) {
          const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
          if (currentSlot) {
            const isMuted = currentSlot.muted;
            muteIcon.textContent = isMuted ? '🔇' : '🔊';
            muteBtn.classList.toggle('muted', isMuted);
            muteBtn.title = isMuted ? 
              '現在のスロットをミュート解除' : 
              '現在のスロットをミュート';
          }
        }
      }

      /**
       * スロット重み入力のイベントハンドラーを設定
       */
      setupSlotWeightInputHandlers() {
        const weightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
        if (!weightInput) return;
        
        // ハンドラーを一度だけ定義（コンストラクタで定義済みの場合はスキップ）
        if (!this.handleSlotWeightWheel) {
          // ホイールイベント（スロットタブと完全に同じロジック）
          const self = this; // thisコンテキストを保持
          this.handleSlotWeightWheel = function(e) {
            e.preventDefault(); // ページスクロールを防ぐ
            
            const currentShaping = self.getCurrentShaping();
            const weightConfig = WeightConverter.getWeightConfig(currentShaping);
            
            const rawValue = weightInput.value;
            const parsedValue = parseFloat(rawValue);
            const currentValue = parsedValue || 0;
            let delta = weightConfig.delta;
            
            console.log(`[EditTab] Wheel event debug:`, {
              currentShaping,
              weightConfig,
              rawValue,
              parsedValue,
              currentValue,
              originalDelta: delta,
              deltaY: e.deltaY,
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey
            });
            
            // 修飾キーによるdelta調整（スロットタブと同じ）
            if (e.shiftKey) {
              delta *= 10; // Shift: 大きく変更
            } else if (e.ctrlKey) {
              delta /= 10; // Ctrl: 細かく変更
            }
            
            // ホイールの方向に応じて値を増減（スロットタブと同じ）
            const direction = e.deltaY > 0 ? -1 : 1;
            const newValue = currentValue + (direction * delta);
            
            // 範囲内に制限
            const clampedValue = Math.max(
              weightConfig.min,
              Math.min(weightConfig.max, newValue)
            );
            
            console.log(`[EditTab] Wheel calculation:`, {
              adjustedDelta: delta,
              direction,
              newValue,
              clampedValue,
              finalValue: Math.round(clampedValue * 100) / 100
            });
            
            // 値を設定（適切な小数点精度で丸める）
            weightInput.value = Math.round(clampedValue * 100) / 100;
            
            // 変更イベントを発火して保存処理をトリガー（スロットタブと同じ）
            weightInput.dispatchEvent(new Event('input', { bubbles: true }));
          };
        }
        
        if (!this.handleSlotWeightChange) {
          // 変更イベント（スロットタブと同じ処理を使用）
          const self = this; // thisコンテキストを保持
          this.handleSlotWeightChange = async function(e) {
            const newWeight = parseFloat(e.target.value) || 0;
            const currentSlot = self.getCurrentSlot();
            
            if (currentSlot && window.app.tabs.slot) {
              // スロットタブのsaveWeightEditメソッドを使用
              await window.app.tabs.slot.saveWeightEdit(currentSlot.id, newWeight);
              console.log(`[EditTab] Updated slot weight using slot tab logic: ${newWeight}`);
            } else {
              // フォールバック処理
              if (currentSlot) {
                currentSlot.weight = newWeight;
                currentSlot.lastModified = Date.now();
                
                // スロットマネージャーに保存
                if (window.promptSlotManager) {
                  await window.promptSlotManager.saveToStorage();
                }
                
                console.log(`[EditTab] Updated slot weight (fallback): ${newWeight}`);
              }
            }
          };
        }
        
        // 既存のイベントリスナーを削除（重複防止）
        weightInput.removeEventListener('wheel', this.handleSlotWeightWheel);
        weightInput.removeEventListener('input', this.handleSlotWeightChange);
        
        // イベントリスナーを追加（スロットタブと同じくinputのみ）
        weightInput.addEventListener('wheel', this.handleSlotWeightWheel);
        weightInput.addEventListener('input', this.handleSlotWeightChange);
        
        console.log('[EditTab] Slot weight input handlers setup completed');
      }

      /**
       * 整形モード変更時に現在のスロットの重み値をリセット
       */
      resetCurrentSlotWeightForNewShaping() {
        const currentSlot = this.getCurrentSlot();
        if (currentSlot) {
          const defaultWeight = window.promptSlotManager ? 
            window.promptSlotManager.getDefaultWeight() : 
            this.getDefaultWeight();
          
          console.log(`[EditTab] Resetting slot weight for new shaping:`, {
            oldWeight: currentSlot.weight,
            newWeight: defaultWeight,
            shaping: this.getCurrentShaping()
          });
          
          currentSlot.weight = defaultWeight;
          currentSlot.lastModified = Date.now();
          
          // UI も更新
          const slotWeightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
          if (slotWeightInput) {
            slotWeightInput.value = defaultWeight;
          }
          
          // スロットマネージャーに保存
          if (window.promptSlotManager) {
            window.promptSlotManager.saveToStorage();
          }
        }
      }

      /**
       * スロット重み入力フィールドの設定を更新（shaping変更対応）
       */
      updateSlotWeightInputConfig() {
        const weightInput = document.getElementById(DOM_IDS.EDIT.SLOT_WEIGHT);
        if (!weightInput) {
          console.warn('[EditTab] Slot weight input not found');
          return;
        }

        const currentShaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(currentShaping);
        
        console.log(`[EditTab] Updating slot weight input config:`, {
          currentShaping,
          weightConfig,
          oldStep: weightInput.step,
          oldMin: weightInput.min,
          oldMax: weightInput.max
        });
        
        // HTML属性を現在の設定に更新
        weightInput.min = weightConfig.min;
        weightInput.max = weightConfig.max;
        weightInput.step = weightConfig.delta;
        
        console.log(`[EditTab] Updated slot weight input attributes:`, {
          step: weightInput.step,
          min: weightInput.min,
          max: weightInput.max
        });
      }

      /**
       * 抽出モード時のメッセージを統一された空状態表示で表示
       */
      showExtractionModeWithEmptyState() {
        try {
          // 抽出モードのスロット情報を収集
          const extractionSlots = promptSlotManager.slots
            .map((slot, index) => {
              if (slot.mode === "random" || slot.mode === "sequential") {
                return {
                  slotNumber: index + 1,
                  mode: slot.mode,
                  category: slot.category,
                  currentExtraction: slot.currentExtraction
                };
              }
              return null;
            })
            .filter(slot => slot !== null);
          
          // 統一された空状態表示を使用
          this.app.listManager.createEmptyState(
            DOM_SELECTORS.BY_ID.EDIT_LIST, 
            'extraction',
            { extractionSlots }
          );
          
          // GeneratePromptを抽出モード用に設定
          this.setGeneratePromptExtractionMode();
          
          console.log(`[EditTab] 抽出モードの空状態表示を作成しました`);
        } catch (error) {
          console.error('[EditTab] 抽出モード空状態表示作成中にエラー:', error);
        }
      }

      debug() {
        super.debug();
        console.log("EditTab debug info:");
        console.log("- elements count:", editPrompt.elements?.length || 0);
        console.log("- suppressAutoRefresh:", this.suppressAutoRefresh);
        console.log("- currentShapingMode:", this.currentShapingMode);
        console.log("- currentEditMode:", this.currentEditMode);
        console.log("- extractionModeActive:", this.extractionModeActive);
        console.log("- hasBeenShown:", this.hasBeenShown);
      }
    }

    // グローバルに公開
    if (typeof window !== "undefined") {
      window.EditTab = EditTab;
    }
  }

  // 初期実行
  defineEditTab();
})();
