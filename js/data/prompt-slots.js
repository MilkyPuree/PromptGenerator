/**
 * prompt-slots.js - 動的プロンプト管理モジュール
 * Phase 8: 可変スロット数対応版
 *
 * 使用方法:
 * 1. スロットの追加・削除が可能
 */

class PromptSlotManager {
  constructor() {
    this.minSlots = PROMPT_SLOTS.MIN_SLOTS;
    this.maxSlots = PROMPT_SLOTS.MAX_SLOTS;
    this.currentSlot = 0;
    this.slots = [];
    this._nextId = 0;
  }

  /**
   * スロットを初期化
   */
  initializeSlots(count = PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS) {
    this.slots = [];
    this._nextId = 0;

    for (let i = 0; i < count; i++) {
      const newSlot = {
        id: this._nextId++,
        name: "",
        prompt: "",
        elements: [],
        isUsed: false,
        lastModified: null,
        // 新規追加フィールド
        mode: "normal", // 'normal' | 'random' | 'sequential'
        category: { big: "", middle: "" },
        sequentialIndex: 0,
        currentExtraction: null,
        lastExtractionTime: null,
        absoluteWeight: this.getDefaultWeight(), // 現在の形式に応じたデフォルト重み
        weight: this.getDefaultWeight(), // 表示用重み（デフォルト値で初期化）
        muted: false, // ミュート状態
        // データソース関連
        dataSource: 'dictionary', // 'dictionary' | 'favorites'
        favoriteDictionaryId: '', // お気に入り辞書のID
      };
      this.slots.push(newSlot);
      
      // 表示用重みを初期化
      this.initializeSlotWeight(newSlot);
    }
  }

  /**
   * 新しいスロットを追加
   */
  addNewSlot() {
    if (this.slots.length >= this.maxSlots) {
      ErrorHandler.notify(`スロットは最大${this.maxSlots}個までです`, {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
      });
      return null;
    }

    const newSlot = {
      id: this._nextId++,
      name: "",
      prompt: "",
      elements: [],
      isUsed: false,
      lastModified: null,
      // 新規追加フィールド
      mode: "normal",
      category: { big: "", middle: "" },
      sequentialIndex: 0,
      currentExtraction: null,
      lastExtractionTime: null,
      absoluteWeight: this.getDefaultWeight(), // 現在の形式に応じたデフォルト重み
      weight: this.getDefaultWeight(), // 表示用重み（デフォルト値で初期化）
      muted: false, // ミュート状態
      // データソース関連
      dataSource: 'dictionary', // 'dictionary' | 'favorites'
      favoriteDictionaryId: '', // お気に入り辞書のID
    };

    this.slots.push(newSlot);
    
    // 表示用重みを初期化
    this.initializeSlotWeight(newSlot);
    
    this.updateUI();
    this.saveToStorage();

    ErrorHandler.notify(`スロット${this.slots.length}を追加しました`, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "success",
      duration: NOTIFICATION_DURATION.SHORT,
    });

    return newSlot;
  }

  /**
   * スロットを削除
   * @param {number} slotId - 削除するスロットID
   * @returns {boolean} 削除成功の可否
   */
  deleteSlot(slotId) {
    // 最小スロット数チェック
    if (this.slots.length <= this.minSlots) {
      ErrorHandler.notify(`スロットは最低${this.minSlots}個必要です`, {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
      });
      return false;
    }

    // 現在選択中のスロットは削除不可
    const slotIndex = this.slots.findIndex((slot) => slot.id === slotId);
    if (slotIndex === this.currentSlot) {
      ErrorHandler.notify("選択中のスロットは削除できません", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
      });
      return false;
    }

    if (slotIndex === -1) {
      console.error("Slot not found:", slotId);
      return false;
    }

    // スロットを削除
    this.slots.splice(slotIndex, 1);

    // 現在のスロットインデックスを調整
    if (this.currentSlot > slotIndex) {
      this.currentSlot--;
    }

    // UIを更新
    this.updateUI();
    this.saveToStorage();

    ErrorHandler.notify("スロットを削除しました", {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "success",
      duration: NOTIFICATION_DURATION.SHORT,
    });

    return true;
  }

  /**
   * スロットを切り替え
   */
  async switchSlot(slotId) {
    console.log("🔄 [SLOT_SWITCH_DEBUG] === スロット切り替え開始 ===");
    console.log("🔄 [SLOT_SWITCH_DEBUG] 要求されたslotId:", slotId);
    console.log("🔄 [SLOT_SWITCH_DEBUG] 切り替え前 currentSlot:", this.currentSlot);
    console.log("🔄 [SLOT_SWITCH_DEBUG] 切り替え前 currentSlotId:", this.slots[this.currentSlot]?.id);
    
    const slotIndex = this.slots.findIndex((slot) => slot.id === slotId);
    if (slotIndex === -1) {
      console.error("🔄 [SLOT_SWITCH_DEBUG] Invalid slot ID:", slotId);
      console.log("🔄 [SLOT_SWITCH_DEBUG] 利用可能なスロットID:", this.slots.map(s => s.id));
      return false;
    }

    const targetSlot = this.slots[slotIndex];
    console.log("🔄 [SLOT_SWITCH_DEBUG] 切り替え先スロット:", {
      index: slotIndex,
      id: targetSlot.id,
      prompt: targetSlot.prompt?.substring(0, 50) || '空'
    });

    // 同じスロットへの切り替えは無視
    if (slotIndex === this.currentSlot) {
      if (AppState.debugMode) {
        console.log("🔄 [SLOT_SWITCH] 同じスロットへの切り替えのためスキップ");
      }
      return true;
    }

    // 現在のスロットを保存
    if (AppState.debugMode) {
      console.log("🔄 [SLOT_SWITCH] 現在のスロットを保存中...");
    }
    
    try {
      await this.saveCurrentSlot();
    } catch (error) {
      console.error("🔄 [SLOT_SWITCH] saveCurrentSlot() でエラー発生:", error);
    }

    // 新しいスロットに切り替え
    if (AppState.debugMode) {
      console.log("🔄 [SLOT_SWITCH] スロット切り替え実行:", this.currentSlot, "→", slotIndex);
    }
    
    this.currentSlot = slotIndex;
    const slot = this.slots[slotIndex];
    
    if (AppState.debugMode) {
      console.log("🔄 [SLOT_SWITCH] 切り替え後のスロット:", {
        id: slot.id,
        prompt: slot.prompt?.substring(0, 30) || '空',
        mode: slot.mode
      });
    }

    // プロンプトエディタに反映（安全な初期化）
    if (!window.promptEditor) {
      console.warn("🔄 [SLOT_SWITCH] promptEditorが存在しません");
      return false;
    }
    
    try {
      if (slot.mode === "random" || slot.mode === "sequential") {
        // 抽出モードの場合はprompEditorは空に設定（編集タブでの結合を防ぐ）
        promptEditor.init("");
        if (AppState.debugMode) {
          console.log(`[SlotManager] 抽出モードなのでpromptEditorを空に設定`);
        }
      } else {
        // 通常モードの場合は通常処理
        if (slot.isUsed && slot.prompt) {
          promptEditor.init(slot.prompt);
          if (slot.elements && slot.elements.length > 0) {
            promptEditor.elements = [...slot.elements];
            promptEditor.generate();
          }
        } else {
          // 空のスロットの場合
          promptEditor.init("");
        }
      }
    } catch (error) {
      console.error("🔄 [SLOT_SWITCH] promptEditor初期化でエラー:", error);
      // エラーが発生してもスロット切り替えは続行
    }
    
    // GeneratePromptを更新（抽出モードも通常モードも同じ処理）
    const generatePrompt = document.getElementById("generatePrompt");
    if (generatePrompt) {
      try {
        console.log("🔄 [SLOT_SWITCH] スロット切り替え - GeneratePrompt更新:", {
          slotId: slot.id,
          mode: slot.mode,
          prompt: slot.prompt || "空",
          currentExtraction: slot.currentExtraction || "なし",
          hasPrompt: !!slot.prompt,
          hasCurrentExtraction: !!slot.currentExtraction
        });
        
        // 表示専用メソッドを使用してスロット値を取得（重み適用なし）
        const displayValue = this.getSlotDisplayValue(slot);
        if (displayValue) {
          generatePrompt.value = displayValue;
          console.log("🔄 [SLOT_SWITCH] GeneratePrompt設定完了:", {
            mode: slot.mode,
            original: slot.prompt,
            display: displayValue,
            final: generatePrompt.value
          });
        } else {
          generatePrompt.value = slot.mode === "random" || slot.mode === "sequential" || slot.mode === "single" ? 
            "[抽出待機中 - Generateボタンを押して抽出]" : "";
          console.log("🔄 [SLOT_SWITCH] GeneratePrompt設定完了 (待機中):", generatePrompt.value);
        }
        
        // readonly設定のみモードで分ける（単一モードは編集可能）
        generatePrompt.readOnly = (slot.mode === "random" || slot.mode === "sequential");
        if (slot.mode === "single") {
          generatePrompt.title = "単一モード：内部はカンマ区切り、表示はスペース区切り（編集可能）";
        } else {
          generatePrompt.title = generatePrompt.readOnly ? "抽出モードで生成されたプロンプト（読み取り専用）" : "";
        }
      } catch (error) {
        console.error("🔄 [SLOT_SWITCH] GeneratePrompt更新でエラー:", error);
      }
    }

    // UIを更新
    this.updateUI();
    this.onSlotChanged(slotIndex);
    await this.saveToStorage();

    // 編集タブがアクティブな場合はリフレッシュ
    if (window.app && window.app.tabs && window.app.tabs.edit && window.app.tabs.edit.isActive) {
      setTimeout(async () => {
        // 現在のスロットを再度取得して確実なモードをチェック
        const currentSlot = this.slots[this.currentSlot];
        const isExtractionMode = currentSlot && (currentSlot.mode === "random" || currentSlot.mode === "sequential");
        
        console.log(`[SlotManager] 編集タブリフレッシュ - スロット${currentSlot?.id}のモード: ${currentSlot?.mode}`);
        
        // スロット統合パネルを先に更新
        if (window.app.tabs.edit.updateSlotIntegrationPanel) {
          window.app.tabs.edit.updateSlotIntegrationPanel();
        }
        
        if (isExtractionMode) {
          window.app.tabs.edit.extractionModeActive = true;
          window.app.tabs.edit.showExtractionModeWithEmptyState();
        } else {
          window.app.tabs.edit.extractionModeActive = false;
          // DOM待機を削除して元の動作に戻す（エラーは無視）
          window.app.tabs.edit.editHandler.initializeEditMode();
        }
      }, 50); // 元の待機時間に戻す
    }

    console.log("🔄 [SLOT_SWITCH_DEBUG] === スロット切り替え完了 ===");
    return true;
  }

  /**
   * スロットの表示用プロンプト値を取得（抽出処理なし）
   * @param {Object} slot - スロットオブジェクト
   * @returns {string} 表示用のプロンプト値
   */
  getSlotDisplayValue(slot) {
    if (!slot || !slot.prompt) {
      return "";
    }
    
    // 単一モードの場合はスペース区切りに変換
    if (slot.mode === "single") {
      return slot.prompt.replace(/,/g, ' ');
    }
    
    // その他のモードは元の値をそのまま返す
    return slot.prompt;
  }

  /**
   * 要素を抽出
   * @param {Object} slot - 対象スロット
   * @returns {string} 抽出された要素のプロンプト
   */
  extractElement(slot) {
    if (slot.mode !== "random" && slot.mode !== "sequential") {
      return slot.prompt || "";
    }

    // データソースに応じて抽出対象を決定
    let filtered = [];
    
    if (slot.dataSource === 'favorites') {
      // お気に入りからの抽出（事前チェック付き）
      if (!this.validateFavoriteDictionary(slot.favoriteDictionaryId)) {
        // 無効な辞書IDの場合はエラー処理
        this.handleMissingDictionary(slot);
        return "";
      }
      filtered = this.getFavoritePrompts(slot.favoriteDictionaryId);
    } else {
      // 辞書からの抽出（従来の方式）
      const allPrompts = [
        ...AppState.data.localPromptList,
        ...getMasterPrompts(),
      ];

      filtered = allPrompts;

      // カテゴリーフィルター
      if (slot.category && slot.category.big) {
        filtered = filtered.filter((item) => item.data[0] === slot.category.big);

        if (slot.category.middle) {
          filtered = filtered.filter(
            (item) => item.data[1] === slot.category.middle
          );
        }
      }
    }

    if (filtered.length === 0) {
      console.warn(`[SLOT_EXTRACT] No elements found for extraction - Source: ${slot.dataSource}, Dictionary: ${slot.favoriteDictionaryId}, Category: ${JSON.stringify(slot.category)}`);
      
      // データソース別のエラーメッセージ
      let errorMessage;
      if (slot.dataSource === 'favorites') {
        if (!slot.favoriteDictionaryId) {
          errorMessage = ERROR_MESSAGES.SLOT_FAVORITES_NOT_FOUND;
        } else {
          errorMessage = ERROR_MESSAGES.SLOT_FAVORITES_EMPTY;
        }
      } else {
        errorMessage = ERROR_MESSAGES.SLOT_EXTRACTION_FAILED;
      }

      // エラー通知
      if (window.ErrorHandler) {
        window.ErrorHandler.notify(errorMessage, {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'warning',
          duration: 3000
        });
      }
      
      slot.currentExtraction = null;
      return "";
    }

    let selectedElement;

    if (slot.mode === "random") {
      // 単純なランダム抽出（確率重み付けは削除）
      const randomIndex = Math.floor(Math.random() * filtered.length);
      selectedElement = filtered[randomIndex];
    } else {
      // 連続抽出
      slot.sequentialIndex = (slot.sequentialIndex || 0) % filtered.length;
      selectedElement = filtered[slot.sequentialIndex];
      slot.sequentialIndex++;
    }

    // 現在の抽出を記録（プロンプトと小項目を含む）
    slot.currentExtraction = selectedElement.prompt;
    slot.currentExtractionSmall = selectedElement.data && selectedElement.data[2] ? selectedElement.data[2] : null;
    slot.lastExtractionTime = Date.now();
    
    // 抽出結果をスロットの通常プロンプトにも反映
    slot.prompt = selectedElement.prompt;
    slot.isUsed = true;
    slot.lastModified = Date.now();
    
    // プロンプトエディタにも反映（現在のスロットの場合）
    if (this.slots[this.currentSlot] && this.slots[this.currentSlot].id === slot.id) {
      if (window.promptEditor) {
        window.promptEditor.init(selectedElement.prompt);
      }
    }

    // 追加：抽出イベントを発火
    this.onExtractionComplete(slot);

    // UIに反映するため保存（既存のコード）
    this.saveToStorage();

    console.log(`[SLOT_EXTRACT] ${slot.mode} extraction: ${selectedElement.prompt}`);
    
    // 重み付きプロンプト記法を適用
    return this.applyWeightToPrompt(selectedElement.prompt, slot.weight);
  }

  /**
   * お気に入り辞書の存在を検証
   * @param {string} dictionaryId - お気に入り辞書のID
   * @returns {boolean} 辞書が存在するかどうか
   */
  validateFavoriteDictionary(dictionaryId) {
    if (!dictionaryId) {
      return false;
    }

    const allDictionaries = AppState.data.promptDictionaries || {};
    return dictionaryId in allDictionaries;
  }

  /**
   * 欠損したお気に入り辞書のハンドリング
   * @param {Object} slot - 問題のあるスロット
   */
  handleMissingDictionary(slot) {
    const missingId = slot.favoriteDictionaryId;
    
    // デバッグモードの場合のみログ出力
    if (AppState.debugMode) {
      console.warn(`[SLOT_FAVORITES] Missing dictionary detected: ${missingId}`);
    }
    
    // スロットの設定をリセット
    slot.favoriteDictionaryId = '';
    slot.currentExtraction = null;
    
    // 利用可能な辞書を取得
    const allDictionaries = AppState.data.promptDictionaries || {};
    const availableDictionaries = Object.keys(allDictionaries);
    
    let errorMessage;
    if (availableDictionaries.length > 0) {
      // 利用可能な辞書がある場合は最初の辞書を自動選択
      const firstDictionaryId = availableDictionaries[0];
      slot.favoriteDictionaryId = firstDictionaryId;
      
      const firstDictName = allDictionaries[firstDictionaryId]?.name || 'お気に入りリスト';
      errorMessage = `選択されたお気に入りリストが見つかりません。「${firstDictName}」に自動変更しました。`;
    } else {
      // 利用可能な辞書がない場合
      errorMessage = `選択されたお気に入りリストが見つかりません。お気に入りリストを確認してください。`;
    }
    
    // エラー通知
    if (window.ErrorHandler) {
      window.ErrorHandler.notify(errorMessage, {
        type: window.ErrorHandler.NotificationType.TOAST,
        messageType: 'warning',
        duration: 4000
      });
    }
    
    // UIを更新（スロットタブが表示されている場合）
    this.updateUIAfterDictionaryChange();
  }

  /**
   * 辞書変更後のUI更新
   */
  updateUIAfterDictionaryChange() {
    // スロットタブのUIを更新（正しい参照を使用）
    const slotTab = window.app?.tabs?.slot;
    if (slotTab && typeof slotTab.updateDisplay === 'function') {
      try {
        slotTab.updateDisplay();
      } catch (error) {
        console.warn('[SLOT_UI_UPDATE] Failed to update slot tab display:', error);
      }
    }
    
    // 設定を保存
    this.saveToStorage();
  }

  /**
   * DOM生成完了を待機するメソッド
   */
  async waitForDOMGeneration(maxWaitTime = 2000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      // EditTabのDOM要素が生成されているかチェック
      const editList = document.querySelector(DOM_SELECTORS.BY_ID.EDIT_LIST);
      if (editList && editList.children.length > 0) {
        // data-element-id要素が存在するかチェック
        const elementWithId = editList.querySelector('[data-element-id]');
        if (elementWithId) {
          console.log(`[SlotManager] DOM generation confirmed after ${Date.now() - startTime}ms`);
          return true;
        }
      }
      
      // 10ms待機してリトライ
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.warn(`[SlotManager] DOM generation timeout after ${maxWaitTime}ms`);
    return false;
  }

  /**
   * 全スロットのお気に入り辞書の存在を事前検証
   */
  validateAllFavoriteDictionaries() {
    let hasInvalidDictionary = false;
    
    this.slots.forEach(slot => {
      if (slot.dataSource === 'favorites' && slot.favoriteDictionaryId) {
        if (!this.validateFavoriteDictionary(slot.favoriteDictionaryId)) {
          // デバッグモードの場合のみログ出力
          if (AppState.debugMode) {
            console.warn(`[SLOT_VALIDATION] Invalid dictionary in slot ${slot.id}: ${slot.favoriteDictionaryId}`);
          }
          hasInvalidDictionary = true;
          this.handleMissingDictionary(slot);
        }
      }
    });
    
    return !hasInvalidDictionary;
  }

  /**
   * お気に入りリストからプロンプトを取得
   * @param {string} dictionaryId - お気に入り辞書のID
   * @returns {Array} 辞書データと同じ形式の配列
   */
  getFavoritePrompts(dictionaryId) {
    try {
      const allDictionaries = AppState.data.promptDictionaries || {};
      
      if (!dictionaryId || !allDictionaries[dictionaryId]) {
        console.warn(`[SLOT_FAVORITES] Dictionary not found: ${dictionaryId}`);
        return [];
      }

      const dictionary = allDictionaries[dictionaryId];
      const prompts = dictionary.prompts || [];

      // お気に入りデータを辞書データ形式に変換
      return prompts.map(item => ({
        prompt: item.prompt || item.title || '', // プロンプト本文
        data: [
          dictionary.name || 'お気に入り', // 大項目：辞書名
          item.title || 'タイトルなし',     // 中項目：プロンプトタイトル  
          ''                              // 小項目：空
        ],
        sort: item.sort || 0
      })).filter(item => item.prompt.trim() !== ''); // 空のプロンプトを除外

    } catch (error) {
      console.error('[SLOT_FAVORITES] Error loading favorite prompts:', error);
      if (window.ErrorHandler) {
        window.ErrorHandler.handleFileError(error, 'お気に入り抽出', dictionaryId);
      }
      return [];
    }
  }

  /**
   * プロンプトに重み記法を適用（編集タブと同じ処理）
   * @param {string} prompt - 元のプロンプト文字列
   * @param {number} weight - 重み値（デフォルト: 1.0）
   * @returns {string} 重み記法が適用されたプロンプト
   */
  applyWeightToPrompt(prompt, weight = 1.0) {
    if (!prompt) {
      return prompt;
    }
    
    // shaping形式によって早期リターンの条件を変える
    const shaping = this.getCurrentShaping();
    
    if ((shaping === 'SD' && weight === 1.0) || 
        (shaping === 'NAI' && weight === 0) || 
        (shaping === 'None')) {
      return prompt;
    }
    
    // 末尾のカンマを除去（スロット重み適用前の整理）
    const cleanPrompt = prompt.replace(/,\s*$/, '');
    
    // WeightConverterを直接使用
    const result = WeightConverter.applyWeightToPrompt(shaping, cleanPrompt, weight);
    return result;
  }


  /**
   * 現在のshaping設定を取得
   * @returns {string} 'SD' | 'NAI' | 'None'
   */
  getCurrentShaping() {
    // AppStateからshaping設定を取得
    if (typeof AppState !== 'undefined' && AppState.userSettings?.optionData?.shaping) {
      return AppState.userSettings.optionData.shaping;
    } else if (typeof optionData !== 'undefined' && optionData?.shaping) {
      return optionData.shaping;
    }
    return 'SD'; // デフォルトはSD形式
  }

  /**
   * スロットの表示用重みを初期化
   * @param {Object} slot - 初期化するスロット
   */
  initializeSlotWeight(slot) {
    const shaping = this.getCurrentShaping();
    
    // absoluteWeight（SD形式の絶対値）から適切な表示重みを計算
    if (shaping === 'NAI') {
      slot.weight = WeightConverter.convertSDToNAI(slot.absoluteWeight);
    } else {
      slot.weight = slot.absoluteWeight;
    }
  }

  /**
   * デフォルト重みを取得（形式別対応）
   * @returns {number} 現在の形式に応じたデフォルト重み
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


  // 新規：抽出完了時のコールバック
  onExtractionComplete(slot) {
    // カスタムイベントを発火
    window.dispatchEvent(
      new CustomEvent("slotExtractionComplete", {
        detail: { slotId: slot.id, extraction: slot.currentExtraction },
      })
    );
  }

  /**
   * 現在のスロットを保存
   */
  async saveCurrentSlot() {
    // 既に保存処理中の場合は重複実行を防ぐ
    if (this._savingInProgress) {
      if (AppState.debugMode) {
        console.log("💾 [SLOT_SAVE] 保存処理が既に進行中です。スキップします。");
      }
      return;
    }
    
    // スロットが初期化されていない場合はスキップ
    if (!this.slots || this.slots.length === 0) {
      if (AppState.debugMode) {
        console.log("💾 [SLOT_SAVE] スロット未初期化のため保存をスキップ");
      }
      return;
    }
    
    // promptEditorが存在しない場合はスキップ
    if (!window.promptEditor) {
      if (AppState.debugMode) {
        console.log("💾 [SLOT_SAVE] promptEditor未定義のため保存をスキップ");
      }
      return;
    }
    
    const currentSlot = this.slots[this.currentSlot];
    if (!currentSlot) {
      if (AppState.debugMode) {
        console.log("💾 [SLOT_SAVE] 保存対象スロットが見つかりません:", this.currentSlot);
      }
      return;
    }

    // 保存処理開始フラグを設定
    this._savingInProgress = true;
    
    try {
      // デバッグログ（必要時のみ）
      if (AppState.debugMode) {
        console.log("💾 [SLOT_SAVE] スロット保存:", {
          id: currentSlot.id,
          prompt: currentSlot.prompt?.substring(0, 30) || '空',
          elements: promptEditor.elements?.length || 0
        });
      }

      // 現在の状態を保存
      currentSlot.prompt = promptEditor.prompt || "";
      currentSlot.elements = [...promptEditor.elements];
      currentSlot.isUsed = currentSlot.prompt.length > 0;
      currentSlot.lastModified = currentSlot.isUsed ? Date.now() : null;

      // ストレージに保存
      await this.saveToStorage();
    } finally {
      // 保存処理完了フラグをリセット
      this._savingInProgress = false;
    }
  }

  /**
   * スロットに名前を設定
   * @param {number} slotId - スロットID
   * @param {string} name - スロット名
   */
  async setSlotName(slotId, name) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.name = name;
      await this.saveToStorage();
      this.updateUI();
    }
  }

  /**
   * 使用中のスロット数を取得
   */
  getUsedSlotsCount() {
    return this.slots.filter((slot) => slot.isUsed).length;
  }

  /**
   * スロット情報を取得
   */
  getSlotInfo(slotId) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return null;

    const slotIndex = this.slots.findIndex((s) => s.id === slotId);
    const displayNumber = slotIndex + 1;

    const info = {
      id: slot.id,
      displayNumber: displayNumber,
      name: slot.name || `プロンプト${displayNumber}`,
      isUsed: slot.isUsed || slot.mode !== "normal",
      isCurrent: slotIndex === this.currentSlot,
      preview: slot.prompt ? slot.prompt.substring(0, 20) + "..." : "(空)",
      lastModified: slot.lastModified,
      mode: slot.mode,
    };

    if (slot.mode === "random" || slot.mode === "sequential") {
      info.preview = `[${slot.mode === "random" ? "ランダム" : "連続"}抽出]`;
      if (slot.category && slot.category.big) {
        info.preview += ` ${slot.category.big}`;
        if (slot.category.middle) {
          info.preview += ` > ${slot.category.middle}`;
        }
      }
    }

    return info;
  }

  /**
   * すべてのスロット情報を取得
   */
  getAllSlotInfo() {
    return this.slots.map((slot) => this.getSlotInfo(slot.id));
  }

  /**
   * ストレージに保存
   */
  async saveToStorage() {
    try {
      const dataToSave = {
        promptSlots: {
          currentSlot: this.currentSlot,
          slots: this.slots,
          nextId: this._nextId,
        },
      };

      console.log("Saving slots to storage:", {
        slotCount: this.slots.length,
        slots: this.slots.map((s) => ({ id: s.id, isUsed: s.isUsed })),
      });

      // data-manager.jsのパターンに合わせて、AppState経由で保存
      if (AppState?.data) {
        AppState.data.promptSlots = dataToSave.promptSlots;
      }
      await Storage.set(dataToSave);
      console.log("Slots saved successfully");
    } catch (error) {
      ErrorHandler.log("Failed to save prompt slots", error);
    }
  }

  /**
   * ストレージから読み込み
   */
  async loadFromStorage() {
    try {
      // AppStateから優先的に読み込み
      let result;
      if (AppState?.data?.promptSlots) {
        result = { promptSlots: AppState.data.promptSlots };
        console.log("Loading from AppState:", result);
      } else {
        result = await Storage.get("promptSlots");
        console.log("Loading from storage:", result);
        // 読み込んだデータをAppStateにも保存
        if (result.promptSlots && AppState?.data) {
          AppState.data.promptSlots = result.promptSlots;
        }
      }

      if (result.promptSlots && result.promptSlots.slots) {
        // 保存されているデータを復元
        this.currentSlot = result.promptSlots.currentSlot || 0;
        this.slots = result.promptSlots.slots || [];
        this._nextId = result.promptSlots.nextId || this.slots.length;

        // 既存のスロットにデフォルト値を設定
        this.slots = this.slots.map((slot) => ({
          ...slot,
          mode: slot.mode || "normal",
          category: slot.category || { big: "", middle: "" },
          sequentialIndex: slot.sequentialIndex || 0,
          currentExtraction: slot.currentExtraction || null,
          lastExtractionTime: slot.lastExtractionTime || null,
          absoluteWeight: slot.absoluteWeight !== undefined ? slot.absoluteWeight : 1.0, // SD形式の絶対値
          weight: slot.weight !== undefined ? slot.weight : this.getDefaultWeight(), // 重みフィールドの初期化
          muted: slot.muted !== undefined ? slot.muted : false, // ミュート状態の初期化
        }));

        // currentSlotが範囲外の場合は調整
        if (this.currentSlot >= this.slots.length) {
          this.currentSlot = 0;
        }

        console.log("Loaded slots from storage:", {
          currentSlot: this.currentSlot,
          slotCount: this.slots.length,
          nextId: this._nextId,
        });

        return true;
      } else {
        // データがない場合のみ初期化
        console.log("No saved data, initializing with 3 slots");
        this.initializeSlots(PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS);
        return false;
      }
    } catch (error) {
      console.error("Failed to load prompt slots:", error);
      ErrorHandler.log("Failed to load prompt slots", error);
      // エラー時のみ初期化
      this.initializeSlots(PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS);
      return false;
    }
  }

  /**
   * UIを更新
   */
  updateUI() {
    const selector = document.getElementById("prompt-slot-selector");
    if (!selector) return;

    // オプションを再作成
    selector.innerHTML = "";

    this.getAllSlotInfo().forEach((info, index) => {
      const option = document.createElement("option");
      option.value = info.id;

      // 抽出モードのスロットのみ色を変えて表示（選択は可能）
      if (this.slots[index].mode === "random" || this.slots[index].mode === "sequential") {
        option.style.color = "#58a6ff"; // アクセントカラーで抽出モードを示す
      }

      option.textContent = info.isUsed
        ? `${info.displayNumber}: ${info.name || info.preview}`
        : `${info.displayNumber}: (空)`;

      if (info.isCurrent) {
        option.style.fontWeight = "bold";
      }

      selector.appendChild(option);
    });

    // 現在のスロットを選択
    const currentSlotId = this.slots[this.currentSlot]?.id;
    if (currentSlotId !== undefined) {
      selector.value = currentSlotId;
    }
  }

  /**
   * スロット変更時のコールバック
   */
  onSlotChanged(slotIndex) {
    console.log("Switched to slot index:", slotIndex);
    // シンプルに：何もしない
    // GeneratePromptの更新はswitchSlotメソッドで実行済み
    // 編集タブの更新はタブを開いた時に実行
  }

  /**
   * 現在のスロットをクリア
   */
  async clearCurrentSlot() {
    const currentSlot = this.slots[this.currentSlot];
    currentSlot.prompt = "";
    currentSlot.elements = [];
    currentSlot.isUsed = false;
    currentSlot.lastModified = null;
    currentSlot.name = "";
    currentSlot.mode = "normal";
    currentSlot.category = { big: "", middle: "" };
    currentSlot.sequentialIndex = 0;
    currentSlot.currentExtraction = null;
    currentSlot.currentExtractionSmall = null;
    currentSlot.lastExtractionTime = null;
    currentSlot.muted = false;

    // エディタもクリア
    promptEditor.init("");

    await this.saveToStorage();
    this.updateUI();
  }

  /**
   * 指定したスロットをクリア（切り替えなし）
   * @param {number} slotId - クリアするスロットID
   */
  async clearSlot(slotId) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) {
      console.error("Slot not found:", slotId);
      return false;
    }

    slot.prompt = "";
    slot.elements = [];
    slot.isUsed = false;
    slot.lastModified = null;
    slot.name = "";
    slot.mode = "normal";
    slot.category = { big: "", middle: "" };
    slot.sequentialIndex = 0;
    slot.currentExtraction = null;
    slot.currentExtractionSmall = null;
    slot.lastExtractionTime = null;
    slot.muted = false;

    await this.saveToStorage();
    this.updateUI();
    return true;
  }

  /**
   * すべての使用中スロットのプロンプトを結合（修正版）
   */
  getCombinedPrompt() {
    
    // 事前にお気に入り辞書の存在をチェック
    this.validateAllFavoriteDictionaries();
    
    const usedSlots = this.slots.filter((slot) => {
      // ミュートされたスロットは除外
      if (slot.muted) {
        return false;
      }

      // modeがない場合は'normal'として扱う
      const slotMode = slot.mode || "normal";

      // 通常モードは従来通り
      if (slotMode === "normal") {
        const shouldInclude = slot.isUsed && slot.prompt;
        return shouldInclude;
      }
      
      // 抽出モードと単一モードは常に含める
      const isExtractionMode = slotMode === "random" || slotMode === "sequential" || slotMode === "single";
      return isExtractionMode;
    });

    if (usedSlots.length === 0) {
      return "";
    }

    // Generate時に抽出を実行
    const prompts = usedSlots.map((slot, index) => {
      const slotMode = slot.mode || "normal";

      if (slotMode === "random" || slotMode === "sequential") {
        const extracted = this.extractElement(slot);
        return extracted;
      }
      if (slotMode === "single") {
        // 単一モード：通常モードと同様に重みを適用してからスペース変換
        const basePrompt = slot.prompt ? slot.prompt.trim() : "";
        console.log(`[GENERATE_DEBUG] スロット${slot.id} (単一モード): 元プロンプト = "${basePrompt}"`);
        if (basePrompt) {
          // 先にスペース変換
          const spacePrompt = basePrompt.replace(/,/g, ' ');
          // その後重み適用
          const weightedPrompt = this.applyWeightToPrompt(spacePrompt, slot.weight);
          console.log(`[GENERATE_DEBUG] スロット${slot.id}: スペース変換 = "${spacePrompt}"`);
          console.log(`[GENERATE_DEBUG] スロット${slot.id}: 重み適用後 = "${weightedPrompt}" (重み: ${slot.weight})`);
          return weightedPrompt;
        }
        return "";
      }
      // 通常モードのスロット - 重みを適用
      const basePrompt = slot.prompt ? slot.prompt.trim() : "";
      if (basePrompt) {
        const weightedPrompt = this.applyWeightToPrompt(basePrompt, slot.weight);
        return weightedPrompt;
      }
      return "";
    });

    // 空の要素を除外
    const validPrompts = prompts.filter(
      (prompt) => prompt && prompt.length > 0
    );
    if (validPrompts.length === 0) {
      return "";
    }

    // プロンプトを結合
    const combined = validPrompts.join(",");

    // 連続するカンマを1つに正規化
    const normalized = combined
      .replace(/,\s*,+/g, ",")
      .replace(/^\s*,\s*$/, "")
      .replace(/\s*,\s*/g, ", ");

    console.log(`Combined ${validPrompts.length} prompts:`, validPrompts);

    // 追加：全体の抽出完了イベント
    window.dispatchEvent(new CustomEvent("allExtractionsComplete"));

    return normalized;
  }

  /**
   * 使用中のスロット情報を取得
   */
  getUsedSlots() {
    return this.slots
      .map((slot, currentIndex) => {
        if (
          !slot.muted && // ミュートされていないスロットのみ
          (slot.isUsed ||
          slot.mode === "random" ||
          slot.mode === "sequential")
        ) {
          const info = {
            id: currentIndex + 1,
            name: slot.name || `スロット${currentIndex + 1}`,
            prompt: slot.prompt,
          };

          if (slot.mode === "random" || slot.mode === "sequential") {
            info.mode = slot.mode;
            info.category = slot.category;
            info.currentExtraction = slot.currentExtraction;
          }

          return info;
        }
        return null;
      })
      .filter((item) => item !== null);
  }

  /**
   * すべてのスロットをクリア
   */
  async clearAllSlots() {
    // 現在のスロット数を維持してクリア
    const currentSlotCount = Math.max(this.slots.length, PROMPT_SLOTS.DEFAULT_INITIAL_SLOTS);
    this.initializeSlots(currentSlotCount);
    this.currentSlot = 0;
    promptEditor.init("");

    const promptInput = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (promptInput) {
      promptInput.value = "";
    }

    await this.saveToStorage();
    this.updateUI();
  }

  /**
   * スロットデータをエクスポート
   */
  exportSlots() {
    return {
      version: "1.0",
      currentSlot: this.currentSlot,
      slots: this.slots.map((slot) => ({
        ...slot,
        // IDは除外（インポート時に再割り当て）
        id: undefined,
      })),
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * スロットデータをインポート
   */
  async importSlots(data) {
    try {
      if (!data.slots || !Array.isArray(data.slots)) {
        throw new Error("Invalid import data");
      }

      // 新しいIDで再構築
      this.slots = [];
      this._nextId = 0;

      data.slots.forEach((slot) => {
        this.slots.push({
          ...slot,
          id: this._nextId++,
          // デフォルト値を確保
          mode: slot.mode || "normal",
          category: slot.category || { big: "", middle: "" },
          sequentialIndex: slot.sequentialIndex || 0,
          currentExtraction: slot.currentExtraction || null,
          lastExtractionTime: slot.lastExtractionTime || null,
        });
      });

      this.currentSlot = 0;
      await this.saveToStorage();
      this.updateUI();

      return true;
    } catch (error) {
      console.error("Import failed:", error);
      return false;
    }
  }

  /**
   * スロットのミュート状態を切り替え
   * @param {number} slotId - 対象スロットID
   * @returns {boolean} 新しいミュート状態
   */
  async toggleSlotMute(slotId) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) {
      console.error("Slot not found:", slotId);
      return false;
    }

    slot.muted = !slot.muted;
    await this.saveToStorage();
    this.updateUI();

    // ミュート状態変更イベントを発火
    window.dispatchEvent(
      new CustomEvent("slotMuteChanged", {
        detail: { slotId: slot.id, muted: slot.muted },
      })
    );

    const action = slot.muted ? "ミュート" : "ミュート解除";
    ErrorHandler.notify(`スロット${slotId}を${action}しました`, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "success",
      duration: NOTIFICATION_DURATION.SHORT,
    });

    return slot.muted;
  }

  /**
   * スロットの順序を変更
   * @param {Array<number>} newOrder - 新しい順序のスロットID配列
   */
  reorderSlots(newOrder) {
    console.log("🔄 [SLOT_REORDER_DEBUG] === スロット順序変更開始 ===");
    console.log("🔄 [SLOT_REORDER_DEBUG] 新しい順序:", newOrder);
    console.log("🔄 [SLOT_REORDER_DEBUG] 変更前 currentSlot:", this.currentSlot);
    
    // 重要：並び替え前に現在のスロットIDを記録
    const currentSlotIdBeforeReorder = this.slots[this.currentSlot]?.id;
    console.log("🔄 [SLOT_REORDER_DEBUG] 変更前 currentSlotId:", currentSlotIdBeforeReorder);
    
    // 変更前のスロット状態をログ出力
    console.log("🔄 [SLOT_REORDER_DEBUG] 変更前スロット一覧:");
    this.slots.forEach((slot, index) => {
      console.log(`🔄   [${index}] ID:${slot.id}, prompt:"${slot.prompt?.substring(0, 50) || '空'}", isCurrent:${index === this.currentSlot}`);
    });

    // 新しい順序でスロット配列を再構築
    const reorderedSlots = [];

    newOrder.forEach((slotId, index) => {
      const slot = this.slots.find((s) => s.id === slotId);
      if (slot) {
        console.log(`🔄   新しい位置[${index}]にスロットID:${slotId} (prompt:"${slot.prompt?.substring(0, 30) || '空'}") を配置`);
        reorderedSlots.push(slot);
      } else {
        console.error(`🔄   [ERROR] スロットID:${slotId} が見つかりません！`);
      }
    });

    // 配列を置き換え
    this.slots = reorderedSlots;

    // 現在のスロットインデックスを更新
    // 並び替え前に記録したスロットIDを使用
    if (currentSlotIdBeforeReorder !== undefined) {
      const newIndex = this.slots.findIndex((s) => s.id === currentSlotIdBeforeReorder);
      if (newIndex !== -1) {
        console.log(`🔄 [SLOT_REORDER_DEBUG] currentSlotインデックス更新: ${this.currentSlot} → ${newIndex} (ID:${currentSlotIdBeforeReorder})`);
        this.currentSlot = newIndex;
      } else {
        console.error(`🔄 [SLOT_REORDER_DEBUG] 現在のスロットID:${currentSlotIdBeforeReorder} が見つかりません！`);
      }
    }

    console.log("🔄 [SLOT_REORDER_DEBUG] 変更後 currentSlot:", this.currentSlot);
    console.log("🔄 [SLOT_REORDER_DEBUG] 変更後 currentSlotId:", this.slots[this.currentSlot]?.id);
    
    // 変更後のスロット状態をログ出力
    console.log("🔄 [SLOT_REORDER_DEBUG] 変更後スロット一覧:");
    this.slots.forEach((slot, index) => {
      console.log(`🔄   [${index}] ID:${slot.id}, prompt:"${slot.prompt?.substring(0, 50) || '空'}", isCurrent:${index === this.currentSlot}`);
    });
    console.log("🔄 [SLOT_REORDER_DEBUG] === スロット順序変更完了 ===");

    // UIを更新（ドロップダウンの表示を更新）
    this.updateUI();

    console.log(
      "Slots reordered. New order:",
      this.slots.map((s) => s.id)
    );
  }

  /**
   * DOM生成待機（軽量版・高速）
   */
  async waitForDOMGenerationLight() {
    return new Promise(resolve => {
      const checkDOM = () => {
        const editList = document.querySelector('#editList-list');
        const hasRows = editList && editList.children.length > 1; // ヘッダー除く
        
        // より厳密なチェック：実際の編集行が存在するか
        const hasEditRows = editList && editList.querySelectorAll('[data-element-id], [data-id]').length > 0;
        
        if (hasRows && hasEditRows) {
          // 軽量版では最小限の安定化待機（5ms）
          setTimeout(resolve, 5);
        } else {
          setTimeout(checkDOM, 3); // チェック間隔を短縮
        }
      };
      checkDOM();
    });
  }
}

// グローバルに公開
if (typeof window !== "undefined") {
  window.PromptSlotManager = PromptSlotManager;
  window.promptSlotManager = new PromptSlotManager();
}
