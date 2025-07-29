/**
 * generate-history-manager.js - Generate履歴管理機能
 * Phase 9: BaseModal統合完了
 */

class GenerateHistoryManager {
  constructor() {
    this.maxHistorySize = this.getMaxSizeFromSettings(); // 設定から最大履歴保持数を取得
    this.maxPromptLength = 2000; // プロンプトの最大長（ストレージ制限対策）
    this.storageKey = 'generateHistory';
    this.historyModal = null;
    
    // デバウンス用のタイマー
    this.debounceTimers = {
      count: null,
      interval: null,
      maxSize: null
    };
    
    // 初期化
    this.init();
  }

  /**
   * 履歴データへの参照を取得（AppState経由）
   */
  get history() {
    return AppState.data.generateHistory || [];
  }

  set history(value) {
    AppState.data.generateHistory = value;
  }

  /**
   * 設定から最大履歴保持数を取得
   */
  getMaxSizeFromSettings() {
    try {
      if (window.AppState && window.AppState.userSettings && window.AppState.userSettings.optionData) {
        const maxSize = window.AppState.userSettings.optionData.historyMaxSize || 30;
        // ストレージ制限を考慮して最大100に制限
        return Math.min(maxSize, HISTORY_CONFIG.ABSOLUTE_MAX_SIZE);
      }
    } catch (error) {
      console.warn('Failed to get history max size from settings:', error);
    }
    return 30; // デフォルト値を少なめに設定
  }

  /**
   * 自動Generate回数を取得
   */
  getAutoGenerateCount() {
    try {
      if (window.autoGenerateHandler) {
        return window.autoGenerateHandler.targetCount || 0;
      }
      // ヘッダーのDOM要素は削除済み
      return 0;
    } catch (error) {
      console.warn('Failed to get auto generate count:', error);
      return 0;
    }
  }

  /**
   * 自動Generate間隔を取得
   */
  getAutoGenerateInterval() {
    try {
      if (window.autoGenerateHandler) {
        return Math.floor(window.autoGenerateHandler.generateInterval / 1000) || 5;
      }
      // ヘッダーのDOM要素は削除済み
      return 5;
    } catch (error) {
      console.warn('Failed to get auto generate interval:', error);
      return 5;
    }
  }

  /**
   * デバウンス処理付きで最大履歴保持数を更新
   */
  updateMaxSizeDebounced(newMaxSize) {
    // 既存のタイマーをクリア
    if (this.debounceTimers.maxSize) {
      clearTimeout(this.debounceTimers.maxSize);
    }
    
    // 500ms後に実際の更新処理を実行
    this.debounceTimers.maxSize = setTimeout(() => {
      this.updateMaxSize(newMaxSize);
    }, 500);
  }

  /**
   * 最大履歴保持数を更新
   */
  updateMaxSize(newMaxSize) {
    const oldMaxSize = this.maxHistorySize;
    this.maxHistorySize = newMaxSize;

    // 履歴が新しい最大数を超えている場合は古いものを削除
    if (this.history.length > newMaxSize) {
      const removedCount = this.history.length - newMaxSize;
      this.history = this.history.slice(0, newMaxSize);
      console.log(`History trimmed: removed ${removedCount} old entries`);
      
      // ストレージに保存
      this.saveToStorage();
    }

    console.log(`History max size updated: ${oldMaxSize} → ${newMaxSize}`);
  }

  /**
   * デバウンス処理付きで自動Generate回数を更新
   */
  updateAutoGenerateCountDebounced(newCount) {
    // 既存のタイマーをクリア
    if (this.debounceTimers.count) {
      clearTimeout(this.debounceTimers.count);
    }
    
    // 500ms後に実際の更新処理を実行
    this.debounceTimers.count = setTimeout(() => {
      this.updateAutoGenerateCount(newCount);
    }, 500);
  }

  /**
   * 自動Generate回数を更新
   */
  updateAutoGenerateCount(newCount) {
    try {
      if (window.autoGenerateHandler) {
        console.log(`🔧 updateAutoGenerateCount called with: ${newCount}`);
        console.log(`🔧 Before update - targetCount: ${window.autoGenerateHandler.targetCount}, isInfiniteMode: ${window.autoGenerateHandler.isInfiniteMode}`);
        
        window.autoGenerateHandler.targetCount = newCount;
        window.autoGenerateHandler.isInfiniteMode = newCount === 0;
        window.autoGenerateHandler.saveSettings();
        
        console.log(`🔧 After update - targetCount: ${window.autoGenerateHandler.targetCount}, isInfiniteMode: ${window.autoGenerateHandler.isInfiniteMode}`);
        
        // 元のDOM要素は削除済み（ヘッダーエリアから削除）
        // Generate設定モーダル経由でのみ操作
        
        console.log(`Auto generate count updated: ${newCount}`);
        
        // 通知
        if (window.ErrorHandler) {
          window.ErrorHandler.notify(`生成回数を${newCount === 0 ? '無限' : newCount + '回'}に設定しました`, {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: 2000
          });
        }
      }
    } catch (error) {
      console.error('Failed to update auto generate count:', error);
    }
  }

  /**
   * デバウンス処理付きで自動Generate間隔を更新
   */
  updateAutoGenerateIntervalDebounced(newInterval) {
    // 既存のタイマーをクリア
    if (this.debounceTimers.interval) {
      clearTimeout(this.debounceTimers.interval);
    }
    
    // 500ms後に実際の更新処理を実行
    this.debounceTimers.interval = setTimeout(() => {
      this.updateAutoGenerateInterval(newInterval);
    }, 500);
  }

  /**
   * 自動Generate間隔を更新
   */
  updateAutoGenerateInterval(newInterval) {
    try {
      if (window.autoGenerateHandler) {
        window.autoGenerateHandler.generateInterval = newInterval * 1000; // 秒をミリ秒に変換
        window.autoGenerateHandler.saveSettings();
        
        // 元のDOM要素は削除済み（ヘッダーエリアから削除）
        // Generate設定モーダル経由でのみ操作
        
        console.log(`Auto generate interval updated: ${newInterval} seconds`);
        
        // 通知
        if (window.ErrorHandler) {
          window.ErrorHandler.notify(`生成間隔を${newInterval}秒に設定しました`, {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: 2000
          });
        }
      }
    } catch (error) {
      console.error('Failed to update auto generate interval:', error);
    }
  }

  /**
   * 初期化処理
   */
  async init() {
    // ストレージ読み込みは initializeDataManager() で既に実行済みのためスキップ
    // await this.loadFromStorage();
    this.setupEventListeners();
    this.initModal();
  }

  /**
   * BaseModalを初期化
   */
  initModal() {
    // 統一フレームでモーダルを作成
    this.historyModal = BaseModal.create('generate-history-modal', 'Generate設定', `
      <div class="generate-settings-section">
        <h3 class="settings-section-title">🤖 自動Generate設定</h3>
        <div class="auto-generate-settings-grid">
          <div class="setting-group">
            <label class="setting-label">
              生成回数:
              <input
                type="number"
                id="modal-generateCount"
                value="${this.getAutoGenerateCount()}"
                min="0"
                max="1000"
                class="setting-input"
                title="生成回数（0=無限）"
              />
              <span class="setting-unit">回</span>
            </label>
            <div class="setting-hint">0 = 無限モード</div>
          </div>
          <div class="setting-group">
            <label class="setting-label">
              生成間隔:
              <input
                type="number"
                id="modal-generateInterval"
                value="${this.getAutoGenerateInterval()}"
                min="3"
                max="60"
                class="setting-input"
                title="生成間隔（3-60秒）"
              />
              <span class="setting-unit">秒</span>
            </label>
            <div class="setting-hint">最小3秒</div>
          </div>
        </div>
      </div>
      
      <div class="generate-settings-section">
        <h3 class="settings-section-title">📊 履歴管理</h3>
        <div class="history-controls">
          <button id="modal-clear-all-history" class="history-control-btn danger" title="すべてのGenerate履歴を削除します（復元不可能）">
            <span>🗑️</span> 履歴をクリア
          </button>
          <button id="modal-export-history" class="history-control-btn primary" title="Generate履歴をJSONファイルでエクスポート">
            <span>📤</span> エクスポート
          </button>
        </div>
        <div class="history-list-section">
          <div class="history-list-header">
            <h4 class="history-list-title">履歴一覧</h4>
            <div class="history-stats-right">
              <span class="history-stats-compact">
                総件数: <span id="history-total-count">0</span>件
              </span>
              <span class="history-settings-compact">
                <label class="history-max-size-compact">
                  最大:
                  <input
                    type="number"
                    id="modal-historyMaxSize"
                    value="${this.maxHistorySize}"
                    min="10"
                    max="200"
                    class="history-max-size-input-compact"
                    title="最大保持件数（10-200件）"
                  />
                  件
                </label>
              </span>
            </div>
          </div>
          <div class="history-list-container">
            <div id="history-list"></div>
            <div id="empty-history-message" class="empty-message" style="display: none;">
              <p>履歴はまだありません</p>
            </div>
          </div>
        </div>
    `, {
      closeOnBackdrop: true,
      closeOnEsc: true,
      showCloseButton: true,
      showHeader: true,
      showFooter: false
    });

    // 履歴項目のイベントリスナーを一度だけ設定（イベント委譲）
    this.setupHistoryItemListeners();
    
    // モーダル表示時にコンテンツを更新
    this.historyModal.onShow(() => {
      this.updateHistoryDisplay();
      this.setupHistorySettingsListener();
      this.setupHistoryControlButtons();
      this.setupAutoGenerateSettingsListener();
    });
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // 履歴表示ボタン
    const showHistoryBtn = document.getElementById('show-generate-history');
    if (showHistoryBtn) {
      showHistoryBtn.addEventListener('click', () => {
        this.showHistoryModal();
      });
    }

    // モーダル関連のイベント
    this.setupModalEventListeners();
  }

  /**
   * モーダルのイベントリスナー設定
   */
  setupModalEventListeners() {
    const modal = document.getElementById('generate-history-modal');
    if (!modal) return;

    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideHistoryModal();
      }
    });

    // 閉じるボタン
    const closeBtn = document.getElementById('close-history');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideHistoryModal();
      });
    }

    // 全履歴クリアボタン
    const clearAllBtn = document.getElementById('clear-all-history');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        this.clearAllHistory();
      });
    }

    // エクスポートボタン
    const exportBtn = document.getElementById('export-history');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportHistory();
      });
    }

    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        this.hideHistoryModal();
      }
    });
  }

  /**
   * Generate実行時に履歴を追加
   */
  addToHistory(prompt, slotInfo = null) {
    if (!Validators.Quick.isValidPrompt(prompt)) return;

    const now = Date.now();
    let trimmedPrompt = prompt.trim();
    
    // プロンプトの長さ制限（ストレージ制限対策）
    if (trimmedPrompt.length > this.maxPromptLength) {
      trimmedPrompt = trimmedPrompt.substring(0, this.maxPromptLength) + '... [切り詰め]';
      console.warn(`Prompt truncated to ${this.maxPromptLength} characters for storage`);
    }

    // 既存の同じプロンプトを検索
    const existingIndex = this.history.findIndex(item => item.prompt === trimmedPrompt);

    if (existingIndex !== -1) {
      // 既存のプロンプトがある場合は生成回数を増やして最新に移動
      const existingItem = this.history[existingIndex];
      existingItem.generationCount++;
      existingItem.lastGenerated = now;
      
      // 配列の最初に移動
      this.history.splice(existingIndex, 1);
      this.history.unshift(existingItem);
    } else {
      // 新規プロンプトの場合
      const historyItem = {
        id: now,
        prompt: trimmedPrompt,
        timestamp: now,
        lastGenerated: now,
        generationCount: 1,
        slotInfo: slotInfo || this.getCurrentSlotInfo()
      };

      // 配列の最初に追加
      this.history.unshift(historyItem);
    }

    // 最大サイズを超えた場合は古いものを削除
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    // ストレージに保存
    this.saveToStorage();

    // 履歴モーダルが開いている場合は表示を更新
    this.refreshHistoryDisplayIfOpen();

    console.log('Added to generate history:', trimmedPrompt);
  }

  /**
   * 履歴モーダルが開いている場合のみ表示を更新
   */
  refreshHistoryDisplayIfOpen() {
    const modal = document.getElementById('generate-history-modal');
    if (modal && modal.style.display === 'flex') {
      // モーダルが開いている場合のみ更新
      this.updateHistoryDisplay();
      console.log('History display refreshed');
    }
  }

  /**
   * 現在のスロット情報を取得
   */
  getCurrentSlotInfo() {
    if (window.promptSlotManager) {
      const slots = window.promptSlotManager.getUsedSlots();
      return {
        usedSlots: slots.length,
        currentSlot: window.promptSlotManager.currentSlot,
        slotNames: slots.map(slot => slot.name || `スロット${slot.id}`)
      };
    }
    return null;
  }

  /**
   * 履歴モーダルを表示
   */
  showHistoryModal() {
    this.historyModal.show();
  }

  /**
   * 履歴モーダルを非表示
   */
  hideHistoryModal() {
    this.historyModal.hide();
  }

  /**
   * 履歴表示を更新
   */
  updateHistoryDisplay() {
    const countSpan = document.getElementById('history-total-count');
    const emptyMessage = document.getElementById('empty-history-message');
    const historyList = document.getElementById('history-list');

    if (!historyList) return;

    // 件数を更新
    if (countSpan) {
      countSpan.textContent = this.history.length;
    }

    // 履歴が空の場合
    if (this.history.length === 0) {
      if (emptyMessage) emptyMessage.style.display = 'flex';
      historyList.style.display = 'none';
      return;
    }

    // 履歴がある場合
    if (emptyMessage) emptyMessage.style.display = 'none';
    historyList.style.display = 'block';

    // 履歴項目を生成
    historyList.innerHTML = this.history.map(item => this.createHistoryItemHTML(item)).join('');

    // イベントリスナーは初期化時に一度だけ設定（重複登録を防ぐ）
    // this.setupHistoryItemListeners(); // 多重登録の原因となるため削除
  }

  /**
   * 履歴項目のHTMLを生成
   */
  createHistoryItemHTML(item) {
    const date = new Date(item.lastGenerated);
    const timeString = date.toLocaleString();
    const shortPrompt = item.prompt.length > HISTORY_CONFIG.PREVIEW_LENGTH ? 
      item.prompt.substring(0, HISTORY_CONFIG.PREVIEW_LENGTH) + '...' : 
      item.prompt;

    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-header">
          <span class="history-timestamp">${timeString}</span>
          <span class="history-generation-count">${item.generationCount}回生成</span>
        </div>
        <div class="history-prompt">${this.escapeHtml(shortPrompt)}</div>
        <div class="history-actions">
          <button class="history-action-btn rerun" data-action="rerun" data-id="${item.id}" title="このプロンプトで再度Generate実行">
            🔄 再実行
          </button>
          <button class="history-action-btn auto-rerun" data-action="auto-rerun" data-id="${item.id}" title="自動Generate設定でこのプロンプトを連続実行">
            🔁 連続実行
          </button>
          <button class="history-action-btn copy" data-action="copy" data-id="${item.id}" title="プロンプトをクリップボードにコピー">
            📋 コピー
          </button>
          <button class="history-action-btn save-slot" data-action="save-slot" data-id="${item.id}" title="このプロンプトを現在のスロットに保存">
            💾 スロット保存
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 履歴項目のイベントリスナー設定
   */
  setupHistoryItemListeners() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    // 既存のイベントリスナーがあれば削除
    if (this.boundHistoryClickHandler) {
      historyList.removeEventListener('click', this.boundHistoryClickHandler);
    }

    // イベントハンドラーをバインド
    this.boundHistoryClickHandler = (e) => {
      const button = e.target.closest('.history-action-btn');
      if (!button) return;

      // イベントバブリングを防ぐ（モーダルが閉じるのを防止）
      e.preventDefault();
      e.stopPropagation();

      const action = button.dataset.action;
      const itemId = parseInt(button.dataset.id);
      const item = this.history.find(h => h.id === itemId);

      if (!item) return;

      switch (action) {
        case 'rerun':
          this.rerunGenerate(item);
          break;
        case 'auto-rerun':
          this.autoRerunGenerate(item);
          break;
        case 'copy':
          this.copyToClipboard(item);
          break;
        case 'save-slot':
          this.saveToSlot(item);
          break;
      }
    };

    // イベントリスナーを登録
    historyList.addEventListener('click', this.boundHistoryClickHandler);
  }

  /**
   * 再実行
   */
  rerunGenerate(item) {
    // 自動Generateがオンの場合はオフにする
    if (window.autoGenerateHandler && window.autoGenerateHandler.isRunning) {
      // 自動生成を停止（stop()内でトグルボタンも自動的にOFFになる）
      window.autoGenerateHandler.stop();
      console.log('Auto Generate disabled for history rerun');
    }

    // 履歴のプロンプトで直接Generate実行
    this.executeDirectGenerate(item.prompt);

    // モーダルを閉じる（ユーザー要望により無効化 - 履歴ウィンドウを開いたままにする）
    // this.hideHistoryModal();

    // 通知
    if (window.ErrorHandler) {
      window.ErrorHandler.notify('履歴プロンプトを再実行しました', {
        type: window.ErrorHandler.NotificationType.TOAST,
        messageType: 'success',
        duration: 2000
      });
    }
  }

  /**
   * 連続実行（自動Generate）
   */
  autoRerunGenerate(item) {
    // 自動Generateハンドラーが利用可能かチェック
    if (!window.autoGenerateHandler) {
      if (window.ErrorHandler) {
        window.ErrorHandler.notify('自動Generate機能が利用できません', {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'error',
          duration: 3000
        });
      }
      return;
    }

    // 既に自動生成が動作中の場合は停止
    if (window.autoGenerateHandler.isRunning) {
      window.autoGenerateHandler.stop();
      // 少し待ってから開始
      setTimeout(() => {
        this.startDirectAutoGenerate(item);
      }, 500);
    } else {
      this.startDirectAutoGenerate(item);
    }
  }

  /**
   * 履歴プロンプトで直接自動生成を開始（現在のプロンプトに影響なし）
   */
  startDirectAutoGenerate(item) {
    // 履歴プロンプトを使用した専用の自動生成を開始
    if (window.autoGenerateHandler) {
      // 履歴プロンプトを一時的に保存
      window.autoGenerateHandler.historyPrompt = item.prompt;
      
      // 自動生成トグルボタンをONにして開始
      window.autoGenerateHandler.updateToggleButtonState(true);
      
      // 直接start()メソッドを呼び出し
      window.autoGenerateHandler.start();
    }

    // 通知
    if (window.ErrorHandler) {
      window.ErrorHandler.notify('履歴プロンプトで自動生成を開始しました', {
        type: window.ErrorHandler.NotificationType.TOAST,
        messageType: 'success',
        duration: 2000
      });
    }

    // ログ出力
    console.log('Direct Auto Generate started with history prompt:', item.prompt);
  }

  /**
   * プロンプトを直接Generate実行（スロット設定せず）
   */
  executeDirectGenerate(prompt) {
    if (!Validators.Quick.isValidPrompt(prompt)) {
      console.error('Empty prompt provided for direct generate');
      return;
    }

    // sendBackground関数を使用して直接Generate実行
    if (typeof sendBackground === 'function' && window.AppState) {
      sendBackground(
        'DOM',
        'Generate',
        prompt.trim(),
        window.AppState.selector.positiveSelector,
        window.AppState.selector.generateSelector
      );
      
      console.log('Direct generate executed with prompt:', prompt.trim());
      
      // Generate履歴への追加はsendBackground内で自動実行される
    } else {
      console.error('sendBackground function or AppState not available');
      
      // フォールバック: プロンプト入力欄に設定してGenerateボタンをクリック
      const promptInput = document.getElementById('generatePrompt');
      if (promptInput) {
        promptInput.value = prompt;
        promptInput.dispatchEvent(new Event('input'));
      }

      const generateBtn = document.getElementById('GeneratoButton');
      if (generateBtn) {
        generateBtn.click();
      }
    }
  }

  /**
   * クリップボードにコピー
   */
  async copyToClipboard(item) {
    try {
      await navigator.clipboard.writeText(item.prompt);
      
      if (window.ErrorHandler) {
        window.ErrorHandler.notify('プロンプトをコピーしました', {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'success',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      if (window.ErrorHandler) {
        window.ErrorHandler.notify('コピーに失敗しました', {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'error',
          duration: 2000
        });
      }
    }
  }

  /**
   * スロットに保存
   */
  async saveToSlot(item) {
    if (!window.promptSlotManager) {
      console.error('Slot manager not available');
      return;
    }

    try {
      // 履歴のプロンプトを現在のスロットに設定
      const currentSlot = window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
      if (!currentSlot) {
        throw new Error('Current slot not found');
      }

      // スロットに履歴プロンプトを設定
      currentSlot.prompt = item.prompt;
      currentSlot.elements = []; // 履歴プロンプトは単純なテキストなのでelementsは空
      currentSlot.isUsed = true;
      currentSlot.lastModified = Date.now();
      currentSlot.mode = "normal"; // 通常モードに設定

      // プロンプトエディタにも反映
      if (window.promptEditor) {
        window.promptEditor.init(item.prompt);
      }

      // プロンプト入力欄にも反映
      const promptInput = document.getElementById('generatePrompt');
      if (promptInput) {
        promptInput.value = item.prompt;
        promptInput.dispatchEvent(new Event('input'));
      }

      // ストレージに保存
      await window.promptSlotManager.saveToStorage();
      
      // UIを更新
      window.promptSlotManager.updateUI();

      // ListRefreshManagerで編集タブをリフレッシュ（プロンプト内容が変わったため）
      if (window.ListRefreshManager) {
        await window.ListRefreshManager.executeAction(
          window.ListRefreshManager.ACTIONS.PROMPT_CHANGE,
          {
            context: { 
              source: 'history_save',
              slotId: window.promptSlotManager.currentSlot,
              prompt: item.prompt
            },
            showNotification: false,
            delay: ADDITIONAL_DELAYS.ELEMENT_UPDATE
          }
        );
      }

      if (window.ErrorHandler) {
        const slotNumber = window.promptSlotManager.currentSlot + 1;
        window.ErrorHandler.notify(`スロット${slotNumber}に保存しました`, {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'success',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Failed to save to slot:', error);
      
      if (window.ErrorHandler) {
        window.ErrorHandler.notify('スロット保存に失敗しました', {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'error',
          duration: 2000
        });
      }
    }
  }

  /**
   * 全履歴をクリア
   */
  async clearAllHistory() {
    const shouldConfirm = window.AppState?.userSettings?.optionData?.isDeleteCheck !== false;

    if (!shouldConfirm || confirm('すべての履歴をクリアしますか？')) {
      this.history = [];
      await this.saveToStorage();
      this.updateHistoryDisplay();

      if (window.ErrorHandler) {
        window.ErrorHandler.notify('履歴をクリアしました', {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'success',
          duration: 2000
        });
      }
    }
  }

  /**
   * 履歴をエクスポート
   */
  async exportHistory() {
    if (this.history.length === 0) {
      if (window.ErrorHandler) {
        window.ErrorHandler.notify('エクスポートする履歴がありません', {
          type: window.ErrorHandler.NotificationType.TOAST,
          messageType: 'warning',
          duration: 2000
        });
      }
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      historyCount: this.history.length,
      history: this.history
    };

    // FileUtilitiesを使用してダウンロード
    const filename = FileUtilities.generateTimestampedFilename(EXPORT_FILE_NAMES.GENERATE_HISTORY, 'json');
    await FileUtilities.downloadJSON(exportData, filename);
  }

  /**
   * ストレージから読み込み
   */
  async loadFromStorage() {
    try {
      // data-manager.jsの共通関数を使用
      if (typeof loadGenerateHistory === 'function') {
        await loadGenerateHistory();
        console.log('Loaded generate history:', this.history.length, 'items');
      } else {
        // フォールバック: data-manager.jsのloadGenerateHistory()を使用
        if (typeof loadGenerateHistory === 'function') {
          await loadGenerateHistory();
        } else {
          // 最終フォールバック: 直接Storage APIを使用
          const result = await Storage.get(this.storageKey);
          if (result[this.storageKey]) {
            AppState.data.generateHistory = result[this.storageKey] || [];
          } else {
            AppState.data.generateHistory = [];
          }
        }
      }
    } catch (error) {
      console.error('Failed to load generate history:', error);
      AppState.data.generateHistory = [];
    }
  }

  /**
   * ストレージに保存
   */
  async saveToStorage() {
    try {
      // data-manager.jsの共通関数を使用
      if (typeof saveGenerateHistory === 'function') {
        await saveGenerateHistory();
        console.log(`Generate history saved: ${this.history.length} items`);
      } else {
        // フォールバック: 直接Storage APIを使用
        await Storage.set({
          [this.storageKey]: this.history
        });
        console.log(`Generate history saved: ${this.history.length} items`);
      }
    } catch (error) {
      console.error('Failed to save generate history:', error);
      
      // 容量制限エラーの場合は古い履歴を削除して再試行
      if (error.message && error.message.includes('quota')) {
        console.warn('Storage quota exceeded, reducing history size...');
        const originalSize = this.history.length;
        this.history = this.history.slice(0, Math.floor(originalSize / 2));
        
        try {
          if (typeof saveGenerateHistory === 'function') {
            await saveGenerateHistory();
          } else {
            await Storage.set({
              [this.storageKey]: this.history
            });
          }
          console.log(`History size reduced from ${originalSize} to ${this.history.length} and saved`);
        } catch (retryError) {
          console.error('Failed to save even after reducing history size:', retryError);
        }
      }
    }
  }

  /**
   * 履歴設定のイベントリスナーを設定
   */
  setupHistorySettingsListener() {
    const maxSizeInput = document.getElementById('modal-historyMaxSize');
    if (maxSizeInput) {
      // 現在の値を設定
      maxSizeInput.value = this.maxHistorySize;
      
      // 変更イベントリスナー
      maxSizeInput.addEventListener('change', (e) => {
        const newMaxSize = parseInt(e.target.value);
        if (newMaxSize >= 10 && newMaxSize <= 200) {
          // 設定を保存
          if (AppState.userSettings.optionData) {
            AppState.userSettings.optionData.historyMaxSize = newMaxSize;
            if (typeof saveOptionData === 'function') {
              saveOptionData();
            }
          }
          
          // 最大数を更新
          this.updateMaxSizeDebounced(newMaxSize);
          
          // 表示を更新
          this.updateHistoryDisplay();
        }
      });

      // マウスホイールイベントリスナーを追加
      maxSizeInput.addEventListener('wheel', (e) => {
        // デフォルトのスクロール動作を防止
        e.preventDefault();
        
        // 現在の値を取得
        const currentValue = parseInt(maxSizeInput.value) || this.maxHistorySize;
        
        // ホイールの方向を判定（負の値は上スクロール、正の値は下スクロール）
        const wheelDelta = e.deltaY;
        
        // 増減量を設定（5件単位）
        const step = 5;
        let newValue;
        
        if (wheelDelta < 0) {
          // 上スクロール：値を増加
          newValue = currentValue + step;
        } else {
          // 下スクロール：値を減少
          newValue = currentValue - step;
        }
        
        // 範囲制限（10-200）
        newValue = Math.max(10, Math.min(200, newValue));
        
        // 値が変更された場合のみ処理
        if (newValue !== currentValue) {
          // input要素の値を更新
          maxSizeInput.value = newValue;
          
          // changeイベントを発火させて保存処理を実行
          const changeEvent = new Event('change', { bubbles: true });
          maxSizeInput.dispatchEvent(changeEvent);
        }
      });
    }
  }

  /**
   * 履歴コントロールボタンのイベントリスナーを設定
   */
  setupHistoryControlButtons() {
    // クリアボタン
    const clearBtn = document.getElementById('modal-clear-all-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAllHistory();
      });
    }

    // エクスポートボタン
    const exportBtn = document.getElementById('modal-export-history');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportHistory();
      });
    }
  }

  /**
   * 自動Generate設定のイベントリスナーを設定
   */
  setupAutoGenerateSettingsListener() {
    // 生成回数の設定
    const countInput = document.getElementById('modal-generateCount');
    if (countInput) {
      // 現在の値を設定
      countInput.value = this.getAutoGenerateCount();
      
      // 変更イベントリスナー
      countInput.addEventListener('change', (e) => {
        const newCount = parseInt(e.target.value) || 0;
        if (newCount >= 0 && newCount <= 1000) {
          this.updateAutoGenerateCountDebounced(newCount);
        }
      });

      // マウスホイールイベントリスナー
      countInput.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const currentValue = parseInt(countInput.value) || 0;
        const wheelDelta = e.deltaY;
        
        // 増減量を設定
        let step = 1;
        if (e.shiftKey) {
          step = 10;
        } else if (e.ctrlKey) {
          step = 100;
        }
        
        let newValue;
        if (wheelDelta < 0) {
          newValue = currentValue + step;
        } else {
          newValue = currentValue - step;
        }
        
        // 範囲制限（0-1000）
        newValue = Math.max(0, Math.min(1000, newValue));
        
        if (newValue !== currentValue) {
          countInput.value = newValue;
          const changeEvent = new Event('change', { bubbles: true });
          countInput.dispatchEvent(changeEvent);
        }
      });
    }

    // 生成間隔の設定
    const intervalInput = document.getElementById('modal-generateInterval');
    if (intervalInput) {
      // 現在の値を設定
      intervalInput.value = this.getAutoGenerateInterval();
      
      // 変更イベントリスナー
      intervalInput.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value) || 5;
        if (newInterval >= 3 && newInterval <= 60) {
          this.updateAutoGenerateIntervalDebounced(newInterval);
        }
      });

      // マウスホイールイベントリスナー
      intervalInput.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const currentValue = parseInt(intervalInput.value) || 5;
        const wheelDelta = e.deltaY;
        
        // 増減量を設定
        let step = 1;
        if (e.shiftKey) {
          step = 5;
        } else if (e.ctrlKey) {
          step = 10;
        }
        
        let newValue;
        if (wheelDelta < 0) {
          newValue = currentValue + step;
        } else {
          newValue = currentValue - step;
        }
        
        // 範囲制限（3-60秒）
        newValue = Math.max(3, Math.min(60, newValue));
        
        if (newValue !== currentValue) {
          intervalInput.value = newValue;
          const changeEvent = new Event('change', { bubbles: true });
          intervalInput.dispatchEvent(changeEvent);
        }
      });
    }
  }

  /**
   * 全履歴をクリア
   */
  clearAllHistory() {
    if (confirm('すべての履歴を削除しますか？この操作は元に戻せません。')) {
      this.history = [];
      this.saveToStorage();
      this.updateHistoryDisplay();
      console.log('All generate history cleared');
    }
  }

  /**
   * 履歴をエクスポート
   */
  exportHistory() {
    if (this.history.length === 0) {
      alert('エクスポートする履歴がありません。');
      return;
    }

    try {
      const exportData = {
        type: 'generateHistory',
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalCount: this.history.length,
        history: this.history
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `generate-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      console.log('Generate history exported successfully');
    } catch (error) {
      console.error('Failed to export history:', error);
      alert('履歴のエクスポートに失敗しました。');
    }
  }

  /**
   * HTMLエスケープ
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * デバッグ情報を出力
   */
  debug() {
    console.log('GenerateHistoryManager Debug Info:');
    console.log('History count:', this.history.length);
    console.log('History items:', this.history);
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    // イベントリスナーのクリーンアップ
    const historyList = document.getElementById('history-list');
    if (historyList && this.boundHistoryClickHandler) {
      historyList.removeEventListener('click', this.boundHistoryClickHandler);
      this.boundHistoryClickHandler = null;
    }

    // モーダルのクリーンアップ
    if (this.historyModal) {
      this.historyModal.cleanup();
      this.historyModal = null;
    }
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.GenerateHistoryManager = GenerateHistoryManager;
}