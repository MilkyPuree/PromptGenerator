// ============================================
// 自動Generate機能
// ============================================

/**
 * NovelAI専用の自動生成機能を管理するクラス
 * - 指定回数の自動生成
 * - 生成間隔の制御
 * - 進行状況の表示
 */
class AutoGenerateHandler {
  constructor() {
    this.isRunning = false;
    this.currentCount = 0;
    this.targetCount = AUTO_GENERATE.DEFAULT_COUNT;
    this.checkInterval = null;
    this.generateInterval = AUTO_GENERATE.DEFAULT_INTERVAL; // 生成間隔（ミリ秒）
    this.lastGenerateTime = null;
    this.waitingForComplete = false;
    this.isInfiniteMode = false;
    this.isInternalClick = false; // 内部クリックフラグ
    this.historyPrompt = null; // 履歴プロンプト（連続実行用）
    
    // プログレスバー関連
    this.progressInterval = null;
    this.waitStartTime = null;
    this.waitDuration = 0;
    
    // デバウンス処理用（根本修正により不要だが、安全のため残す）
    this.lastClickTime = 0;
    this.clickDebounceDelay = 200; // 200msに短縮（誤クリック防止のみ）
  }

  /**
   * 初期化
   */
  async init() {
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);

    // Generateボタンがない場合のみ終了
    if (!generateButton) {
      console.log("Auto Generate: Generate button not found");
      return;
    }

    // 設定を読み込み
    await this.loadSettings();

    // 進行状況UIを設定
    this.setupProgressUI();

    // イベントリスナーを設定（セレクターがなくても設定してトーストで警告）
    this.attachEventListeners();
  }

  /**
   * 進行状況UIを設定（Generateボタンの隣）
   */
  setupProgressUI() {
    // 既に追加済みの場合はスキップ
    if (document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS)) {
      return;
    }

    // Generate設定ボタンを探す
    const generateHistoryButton = document.getElementById('show-generate-history');
    if (!generateHistoryButton) {
      console.error("Generate settings button not found");
      return;
    }

    // 進行状況を表示する要素を作成
    const progress = document.createElement("span");
    progress.id = "autoGenerateProgress";
    progress.style.cssText = `
      display: none;
      margin-left: 10px;
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: normal;
      vertical-align: middle;
    `;

    // Generate設定ボタンの直後に挿入
    generateHistoryButton.parentNode.insertBefore(
      progress,
      generateHistoryButton.nextSibling
    );
  }

  /**
   * イベントリスナーを設定
   * 注意: ヘッダーの自動Generate設定は削除されたため、
   * Generate設定モーダル経由でのみ設定を変更可能
   */
  attachEventListeners() {
    // 自動Generateトグルボタン
    const autoGenerateToggle = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE);
    if (autoGenerateToggle) {
      // 既存のイベントリスナーがある場合は削除
      if (this.boundClickHandler) {
        autoGenerateToggle.removeEventListener("click", this.boundClickHandler);
      }
      
      // クリックハンドラーをバインド
      this.boundClickHandler = async (e) => {
        console.log(`🖱️ Toggle button clicked!`);
        console.log(`🖱️ Event type: ${e.type}, button: ${e.button}, detail: ${e.detail}, timeStamp: ${e.timeStamp}`);
        console.log(`🖱️ Event target:`, e.target);
        console.log(`🖱️ Event currentTarget:`, e.currentTarget);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // 他のイベントリスナーも停止
        
        // デバウンス処理：連続クリックを防ぐ
        const currentTime = Date.now();
        if (currentTime - this.lastClickTime < this.clickDebounceDelay) {
          console.log(`🖱️ Click ignored - too soon after last click (${currentTime - this.lastClickTime}ms < ${this.clickDebounceDelay}ms)`);
          return;
        }
        this.lastClickTime = currentTime;
        
        // 現在の状態を確認
        const isActive = autoGenerateToggle.classList.contains('active');
        const isRunning = this.isRunning;
        console.log(`🖱️ Button state: ${isActive ? 'ACTIVE' : 'INACTIVE'}, AutoGen running: ${isRunning}`);
        
        if (isActive) {
          console.log(`🖱️ Attempting to STOP auto generate...`);
          // 停止処理（stop()内でトグルボタンも自動的にOFFになる）
          this.stop();
          console.log(`🖱️ Stop completed`);
        } else {
          console.log(`🖱️ Attempting to START auto generate...`);
          
          try {
            // 先にstart()を呼び出してから、結果に応じてボタン状態を更新
            await this.start();
            console.log(`🖱️ Start completed successfully`);
            // 開始が成功した場合のみボタンをONにする
            this.updateToggleButtonState(true);
          } catch (error) {
            console.error(`🖱️ Start failed:`, error);
            // エラーが発生した場合はボタンをOFFにする
            this.updateToggleButtonState(false);
          }
        }
        
        // 非同期処理完了後に最終状態を確認（停止処理の場合はスキップ）
        setTimeout(() => {
          // 停止処理中の場合は状態同期をスキップ
          if (!this.isRunning) {
            console.log(`🖱️ Skipping state sync - auto generate is stopped`);
            return;
          }
          
          const finalButtonState = autoGenerateToggle.classList.contains('active');
          const finalRunningState = this.isRunning;
          console.log(`🖱️ Final state - Button: ${finalButtonState ? 'ACTIVE' : 'INACTIVE'}, Running: ${finalRunningState}`);
          
          // 状態が一致していない場合は修正（実行中の場合のみ）
          if (finalButtonState !== finalRunningState && finalRunningState) {
            console.warn(`🖱️ STATE MISMATCH! Button: ${finalButtonState}, Running: ${finalRunningState}`);
            console.log(`🖱️ Correcting button state to match running state: ${finalRunningState}`);
            this.updateToggleButtonState(finalRunningState);
          }
        }, 100); // 100ms後に状態をチェック
      };
      
      // イベントリスナーを登録
      autoGenerateToggle.addEventListener("click", this.boundClickHandler);
    }
    
    console.log("Auto Generate: Toggle button event listener attached");
  }

  /**
   * 自動生成を開始
   */
  async start() {
    console.log(`🚀 start() called, isRunning: ${this.isRunning}`);
    console.log(`🚀 Stack trace:`, new Error().stack);
    
    if (this.isRunning) {
      console.log(`🚀 Already running, returning early`);
      return;
    }
    
    // Generateボタンの確認
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (!generateButton) {
      ErrorHandler.notify("Generateボタンが見つかりません。", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
        duration: NOTIFICATION_DURATION.LONG,
      });
      throw new Error("Generate button not found");
    }
    
    // 最新設定を再読み込み
    await this.loadSettings();
    console.log(`🚀 After loadSettings - targetCount: ${this.targetCount}, isInfiniteMode: ${this.isInfiniteMode}, generateInterval: ${this.generateInterval}ms`);

    // Generateボタンにクラスを追加
    generateButton.classList.add("auto-generating");

    console.log("🚀 Auto Generate: Starting...");
    console.log(`🚀 Final Settings - targetCount: ${this.targetCount}, isInfiniteMode: ${this.isInfiniteMode}, generateInterval: ${this.generateInterval}ms`);
    this.isRunning = true;
    this.currentCount = 0;
    this.waitingForComplete = false;
    console.log(`🚀 Set isRunning to: ${this.isRunning}`);

    // 設定値はloadSettings()で既に取得済み
    // Generate設定モーダル経由で操作するため、DOM要素は参照しない
    this.showProgress();
    this.updateProgress();

    // 最初の生成を実行
    console.log(`🚀 About to call generate() for first time`);
    const generateResult = await this.generate();
    console.log(`🚀 First generate() result:`, generateResult);

    // 定期的なチェックを開始
    console.log(`🚀 Setting up check interval`);
    this.checkInterval = setInterval(() => {
      this.checkGenerateStatus();
    }, AUTO_GENERATE.CHECK_INTERVAL);
    
    console.log(`🚀 start() method completed, isRunning: ${this.isRunning}`);
  }

  /**
   * 自動生成を停止
   */
  stop() {
    console.log(`⏹️ stop() called, isRunning: ${this.isRunning}`);
    console.log(`⏹️ Stack trace:`, new Error().stack);
    
    if (!this.isRunning) {
      console.log(`⏹️ Not running, returning early`);
      return;
    }

    console.log("⏹️ Auto Generate: Stopping...");
    this.isRunning = false;
    this.waitingForComplete = false;
    console.log(`⏹️ Set isRunning to: ${this.isRunning}`);

    // インターバルをクリア
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // 履歴プロンプトをクリア
    this.historyPrompt = null;

    // プログレスバーを停止
    this.stopWaitProgress();

    // UI更新：進行状況を非表示とトグルボタンをOFFに更新
    this.hideProgress();
    this.updateToggleButtonState(false);

    // 完了通知
    const message = this.isInfiniteMode
      ? `自動生成を停止しました（${this.currentCount}回生成）`
      : `自動生成を停止しました（${this.currentCount}/${this.targetCount}回完了）`;

    ErrorHandler.notify(message, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "info",
      duration: NOTIFICATION_DURATION.MEDIUM,
    });

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.classList.remove("auto-generating");
    }
  }

  /**
   * 生成を実行
   */
  async generate() {
    console.log(`⚡ generate() called`);
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    
    const displayCount = this.isInfiniteMode
      ? `${this.currentCount + 1}回目`
      : `${this.currentCount + 1}/${this.targetCount}`;

    console.log(`⚡ Auto Generate: Generating ${displayCount}`);
    this.updateProgress(`生成中... ${displayCount}`);
    
    // 生成中はプログレスバーを停止
    this.stopWaitProgress();

    try {
      // 1. プロンプト入力を実行
      await this.executePromptInput();
      
      // 2. 設定された遅延時間を適用
      const delay = this.getCurrentSiteDelay();
      if (delay > 0) {
        console.log(`Auto Generate: Waiting ${delay}ms for prompt input to settle...`);
        this.updateProgress(`プロンプト入力後待機中... (${delay}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // 3. Generateボタンをクリック（バリデーション無効化）
      if (generateButton) {
        this.lastGenerateTime = Date.now();
        this.waitingForComplete = true;
        
        // 内部クリックフラグを設定
        this.isInternalClick = true;
        console.log(`⚡ Clicking generate button...`);
        generateButton.click();
        this.isInternalClick = false;
        
        console.log(`⚡ generate() returning true`);
        return true;
      } else {
        console.log("⚡ Auto Generate: Generate button not found");
        this.stop();
        return false;
      }
    } catch (error) {
      console.error("⚡ Auto Generate: Error during generate:", error);
      this.stop();
      return false;
    }
  }

  /**
   * プロンプト入力を実行
   */
  async executePromptInput() {
    const positiveSelector = AppState.selector.positiveSelector;
    if (!positiveSelector) {
      console.log("Auto Generate: Positive selector not configured, skipping prompt input");
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) throw new Error("No active tab found");

      // コンテンツスクリプトを注入
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["js/content.js"],
        });
      } catch (injectError) {
        console.log("Content script injection:", injectError.message);
      }

      // プロンプトを入力（履歴プロンプトがある場合はそれを優先）
      const currentPrompt = this.historyPrompt || 
                           window.app?.generateInput?.val?.() || 
                           document.getElementById(DOM_IDS.PROMPT.GENERATE)?.value || "";
      
      if (currentPrompt) {
        await chrome.tabs.sendMessage(tab.id, {
          action: "inputPrompt",
          selector: positiveSelector,
          prompt: currentPrompt,
        });
        console.log("Auto Generate: Prompt input completed", this.historyPrompt ? "(using history prompt)" : "");
      } else {
        console.log("Auto Generate: No prompt to input");
      }
    } catch (error) {
      console.log("Auto Generate: Prompt input failed:", error.message);
      // プロンプト入力に失敗してもGenerateボタンは押す
    }
  }

  /**
   * 現在のサイトの遅延時間を取得
   */
  getCurrentSiteDelay() {
    // 現在選択されているサービスの遅延時間を取得
    const serviceSelect = document.getElementById(DOM_IDS.OTHER.SELECTOR_SERVICE);
    if (serviceSelect && serviceSelect.value) {
      const serviceKey = serviceSelect.value;
      
      // 組み込みサイトをチェック
      const builtInSite = AppState.selector.serviceSets[serviceKey];
      if (builtInSite && builtInSite.inputDelay !== undefined) {
        return builtInSite.inputDelay;
      }
      
      // カスタムサイトをチェック
      const customSite = AppState.selector.customSites[serviceKey];
      if (customSite && customSite.inputDelay !== undefined) {
        return customSite.inputDelay;
      }
    }
    
    // デフォルトは0（遅延なし）
    return 0;
  }

  /**
   * 生成状態をチェック
   */
  checkGenerateStatus() {
    if (!this.isRunning || !this.waitingForComplete) {
      if (AppState?.config?.debugMode) console.log(`🔍 checkGenerateStatus: skipping (isRunning: ${this.isRunning}, waitingForComplete: ${this.waitingForComplete})`);
      return;
    }

    const elapsed = Date.now() - this.lastGenerateTime;
    if (AppState?.config?.debugMode) console.log(`🔍 checkGenerateStatus: elapsed ${elapsed}ms`);

    // 生成に時間がかかりすぎている場合
    if (elapsed > AUTO_GENERATE.TIMEOUT) {
      console.log("🔍 Auto Generate: Timeout detected");
      this.updateProgress("タイムアウト - 次の生成を開始します");
      this.onGenerateComplete();
      return;
    }

    // 生成完了の簡易判定
    if (elapsed > AUTO_GENERATE.COMPLETION_TIMEOUT) {
      console.log(`🔍 Auto Generate: Completion timeout reached (${elapsed}ms > ${AUTO_GENERATE.COMPLETION_TIMEOUT}ms)`);
      this.onGenerateComplete();
    }
  }

  /**
   * 生成完了時の処理
   */
  onGenerateComplete() {
    console.log(`✅ onGenerateComplete() called, waitingForComplete: ${this.waitingForComplete}`);
    
    if (!this.waitingForComplete) return;

    this.waitingForComplete = false;
    this.currentCount++;

    console.log(`✅ Auto Generate: Completed ${this.currentCount} generations`);
    console.log(`✅ Mode check - isInfiniteMode: ${this.isInfiniteMode}, currentCount: ${this.currentCount}, targetCount: ${this.targetCount}`);

    // 無限モードでない場合、目標回数に達したかチェック
    if (!this.isInfiniteMode && this.currentCount >= this.targetCount) {
      console.log(`✅ Target reached, calling complete()`);
      this.complete();
      return;
    } else {
      console.log(`✅ Continuing - infinite mode: ${this.isInfiniteMode}, or not reached target (${this.currentCount}/${this.targetCount})`);
    }

    // 次の生成までの待機
    const nextCount = this.isInfiniteMode
      ? `${this.currentCount + 1}回目`
      : `${this.currentCount + 1}/${this.targetCount}`;

    this.updateProgress(`待機中... (次: ${nextCount})`);

    // プログレスバーを開始
    this.startWaitProgress();

    console.log(`✅ Setting timeout for next generation in ${this.generateInterval}ms`);
    setTimeout(() => {
      console.log(`⏰ Timeout fired, isRunning: ${this.isRunning}`);
      if (this.isRunning) {
        console.log(`⏰ Calling next generate()`);
        this.stopWaitProgress();
        this.generate();
      } else {
        console.log(`⏰ Not running, skipping next generate()`);
      }
    }, this.generateInterval);
  }

  /**
   * 待機時間プログレスバーを開始
   */
  startWaitProgress() {
    this.waitStartTime = Date.now();
    this.waitDuration = this.generateInterval;
    
    // プログレスバーを100ms間隔で更新
    this.progressInterval = setInterval(() => {
      this.updateWaitProgress();
    }, 100);
    
    // 開始時の進捗を設定
    this.updateWaitProgress();
  }

  /**
   * 待機時間プログレスバーを停止
   */
  stopWaitProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // プログレスバーをリセット
    this.setGenerateButtonProgress(0);
  }

  /**
   * 待機時間プログレスを更新
   */
  updateWaitProgress() {
    if (!this.waitStartTime) return;
    
    const elapsed = Date.now() - this.waitStartTime;
    const progress = Math.min(elapsed / this.waitDuration, 1);
    
    this.setGenerateButtonProgress(progress);
  }

  /**
   * Generateボタンの進捗を設定
   */
  setGenerateButtonProgress(progress) {
    const progressBar = document.getElementById('generate-progress-bar');
    const progressFill = progressBar ? progressBar.querySelector('.progress-fill') : null;
    
    if (progressBar && progressFill) {
      const progressPercent = `${progress * 100}%`;
      progressFill.style.width = progressPercent;
      
      // 進捗が0より大きい場合は表示
      if (progress > 0) {
        progressBar.classList.add('active');
      } else {
        progressBar.classList.remove('active');
      }
      
      if (AppState?.config?.debugMode) console.log(`Progress bar updated: ${progressPercent}`);
    } else {
      console.error("Progress bar elements not found");
    }
  }

  /**
   * 進行状況を更新
   */
  updateProgress(status = null) {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (!progressElement) return;

    let text = "";
    if (this.isInfiniteMode) {
      text = `自動生成中: ${this.currentCount}回`;
    } else {
      text = `自動生成中: ${this.currentCount}/${this.targetCount}`;
    }

    if (status) {
      text = status;
    }

    progressElement.textContent = text;
  }

  /**
   * 進行状況を表示
   */
  showProgress() {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (progressElement) {
      progressElement.style.display = "inline";
    }
  }

  /**
   * 進行状況を非表示
   */
  hideProgress() {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (progressElement) {
      progressElement.style.display = "none";
    }
  }

  /**
   * 自動生成完了
   */
  complete() {
    console.log("🏁 complete() called - Auto Generate: All generations completed!");
    console.log(`🏁 Stack trace:`, new Error().stack);

    // 停止処理
    this.isRunning = false;
    this.waitingForComplete = false;
    console.log(`🏁 Set isRunning to: ${this.isRunning}`);
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // 履歴プロンプトをクリア
    this.historyPrompt = null;

    // プログレスバーを停止
    this.stopWaitProgress();

    // UI更新：完了メッセージを表示（トグルボタンの状態は自動完了時のみ変更）
    this.updateToggleButtonState(false);
    this.updateProgress("完了しました！");

    // 一定時間後に進行状況を非表示
    setTimeout(() => {
      this.hideProgress();
    }, NOTIFICATION_DURATION.STANDARD);

    // 完了通知
    ErrorHandler.notify(`自動生成が完了しました（${this.currentCount}回）`, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "success",
      duration: NOTIFICATION_DURATION.LONG,
    });

    // 完了音を鳴らす
    this.playCompletionSound();

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.classList.remove("auto-generating");
    }
  }

  /**
   * 完了音を再生
   */
  playCompletionSound() {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log("Could not play completion sound:", error);
    }
  }

  /**
   * 設定を保存
   */
  async saveSettings() {
    try {
      const settings = {
        generateCount: this.targetCount,
        generateInterval: Math.floor(this.generateInterval / 1000),
      };

      // chrome.storage.localを使用
      await new Promise((resolve) => {
        chrome.storage.local.set({ autoGenerateSettings: settings }, resolve);
      });

      console.log("Auto generate settings saved:", settings);
    } catch (error) {
      console.error("Failed to save auto generate settings:", error);
    }
  }

  /**
   * 設定を読み込み
   */
  async loadSettings() {
    try {
      console.log(`💾 loadSettings() called`);
      
      // localStorageではなくchrome.storage.localを使用
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(["autoGenerateSettings"], resolve);
      });

      console.log(`💾 Storage result:`, result);
      const settings = result.autoGenerateSettings;
      console.log(`💾 Settings found:`, settings);

      if (settings) {
        console.log(`💾 Before applying settings - targetCount: ${this.targetCount}, isInfiniteMode: ${this.isInfiniteMode}`);
        
        this.targetCount = settings.generateCount ?? AUTO_GENERATE.DEFAULT_COUNT;
        this.isInfiniteMode = this.targetCount === 0;
        this.generateInterval = (settings.generateInterval || AUTO_GENERATE.DEFAULT_INTERVAL / 1000) * 1000;

        console.log(`💾 After applying settings - targetCount: ${this.targetCount}, isInfiniteMode: ${this.isInfiniteMode}, generateInterval: ${this.generateInterval}ms`);
        
        // DOM要素への反映はGenerate設定モーダル経由で行う
        console.log(`Auto Generate settings loaded: count=${this.targetCount}, interval=${Math.floor(this.generateInterval / 1000)}s`);
      } else {
        console.log(`💾 No settings found, using defaults - targetCount: ${this.targetCount}, isInfiniteMode: ${this.isInfiniteMode}`);
      }
    } catch (error) {
      console.error("Failed to load auto generate settings:", error);
    }
  }

  /**
   * トグルボタンの状態を更新
   */
  updateToggleButtonState(isActive) {
    console.log(`🔄 updateToggleButtonState called with: ${isActive ? 'ON' : 'OFF'}`);
    console.log(`🔄 Stack trace:`, new Error().stack);
    
    const autoGenerateToggle = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE);
    if (autoGenerateToggle) {
      const currentState = autoGenerateToggle.classList.contains('active');
      console.log(`🔄 Current button state: ${currentState ? 'ON' : 'OFF'} -> ${isActive ? 'ON' : 'OFF'}`);
      
      if (isActive) {
        autoGenerateToggle.classList.add('active');
        autoGenerateToggle.querySelector('.toggle-status').textContent = 'ON';
      } else {
        autoGenerateToggle.classList.remove('active');
        autoGenerateToggle.querySelector('.toggle-status').textContent = 'OFF';
      }
      
      const newState = autoGenerateToggle.classList.contains('active');
      console.log(`🔄 Button state after update: ${newState ? 'ON' : 'OFF'}`);
    } else {
      console.error(`🔄 Toggle button not found!`);
    }
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.stop();
    
    // イベントリスナーのクリーンアップ
    const autoGenerateToggle = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE);
    if (autoGenerateToggle && this.boundClickHandler) {
      autoGenerateToggle.removeEventListener("click", this.boundClickHandler);
      this.boundClickHandler = null;
    }
  }
}

// ============================================
// 統合とエクスポート
// ============================================

// グローバルに公開
window.AutoGenerateHandler = AutoGenerateHandler;
window.autoGenerateHandler = new AutoGenerateHandler();

// ページ遷移時のクリーンアップ
window.addEventListener("beforeunload", () => {
  if (window.autoGenerateHandler) {
    autoGenerateHandler.cleanup();
  }
});
