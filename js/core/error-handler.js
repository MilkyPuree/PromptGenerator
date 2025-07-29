/**
 * エラーハンドリングモジュール
 * jQuery依存を削除し、より洗練された通知システムを実装
 */
const ErrorHandler = {
  /**
   * エラーレベルの定義
   */
  Level: MESSAGE_LEVELS,

  /**
   * ユーザーへの通知方法
   */
  NotificationType: {
    NONE: "none",
    CONSOLE: "console",
    ALERT: "alert",
    TOAST: "toast",
    INLINE: "inline",
  },

  /**
   * トースト通知のコンテナ
   */
  toastContainer: null,

  /**
   * 初期化
   */
  init() {
    try {
      // 既存のコンテナを使用
      this.toastContainer = document.getElementById(DOM_IDS.COMMON.ERROR_TOAST_CONTAINER);

      if (!this.toastContainer) {
        // フォールバック：コンテナが見つからない場合は作成
        console.warn("Error toast container not found in HTML, creating one");
        this.toastContainer = document.createElement("div");
        this.toastContainer.id = DOM_IDS.COMMON.ERROR_TOAST_CONTAINER;
        this.toastContainer.className = CSS_CLASSES.TOAST.CONTAINER;
        document.body.appendChild(this.toastContainer);
      }

      // エラーハンドラーを設定
      window.addEventListener(DOM_EVENTS.ERROR, (event) => {
        this.log(event.error || event.message, "JavaScript Error", this.Level.ERROR);
      });

      window.addEventListener(DOM_EVENTS.UNHANDLED_REJECTION, (event) => {
        this.log(event.reason, "Unhandled Promise Rejection", this.Level.ERROR);
      });

      // Chrome拡張機能のエラーハンドラー
      if (chrome?.runtime?.onError) {
        chrome.runtime.onError.addListener((error) => {
          this.log(error, "Extension Error", this.Level.ERROR);
        });
      }

      console.log("ErrorHandler initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ErrorHandler:", error);
    }
  },

  /**
   * グローバルエラーハンドラーの設定
   */
  setupGlobalHandlers() {
    // 未処理のPromiseエラー
    window.addEventListener(DOM_EVENTS.UNHANDLED_REJECTION, (event) => {
      this.log("Unhandled promise rejection", event.reason, this.Level.ERROR);
    });

    // 通常のエラー
    window.addEventListener(DOM_EVENTS.ERROR, (event) => {
      this.log("Global error", event.error, this.Level.ERROR);
    });
  },

  /**
   * エラーをログに記録
   * @param {string} message - エラーメッセージ
   * @param {Error} [error] - エラーオブジェクト
   * @param {string} [level] - エラーレベル
   */
  log(message, error = null, level = this.Level.ERROR) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : null,
    };

    // コンソールへの出力（カラー付き）
    const logStyles = {
      [this.Level.INFO]: "color: #2196F3; font-weight: bold;",
      [this.Level.WARNING]: "color: #FF9800; font-weight: bold;",
      [this.Level.ERROR]: "color: #f44336; font-weight: bold;",
      [this.Level.CRITICAL]:
        "color: #d32f2f; font-weight: bold; font-size: 1.1em;",
    };

    console.log(
      `%c[${timestamp}] ${level.toUpperCase()}: ${message}`,
      logStyles[level] || "",
      error
    );

    // ローカルストレージに保存
    this.saveToLocalStorage(logEntry);
  },

  /**
   * エラーログをローカルストレージに保存
   * @param {Object} logEntry - ログエントリ
   */
  saveToLocalStorage(logEntry) {
    try {
      const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY.ERROR_LOGS) || "[]");
      logs.push(logEntry);

      // 最新100件のみ保持
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }

      localStorage.setItem(STORAGE_KEYS.HISTORY.ERROR_LOGS, JSON.stringify(logs));
    } catch (e) {
      // ストレージが満杯の場合は古いログを削除
      localStorage.removeItem(STORAGE_KEYS.HISTORY.ERROR_LOGS);
    }
  },

  /**
   * 通知設定を確認
   * @param {string} messageType - メッセージタイプ ("success", "info", "warning", "error")
   * @returns {boolean} 通知を表示するかどうか
   */
  shouldShowNotification(messageType) {
    if (!window.AppState?.userSettings?.optionData) {
      return true; // 設定が読み込まれていない場合はデフォルトで表示
    }

    const settings = window.AppState.userSettings.optionData;
    
    switch (messageType) {
      case "success":
        return settings.showSuccessToast !== false;
      case "info":
        return settings.showInfoToast !== false;
      case "warning":
        return settings.showWarningToast !== false;
      case "error":
        return settings.showErrorToast !== false;
      default:
        return true;
    }
  },

  /**
   * ユーザーにエラーを通知
   * @param {string} message - ユーザー向けメッセージ
   * @param {Object} [options] - 通知オプション
   */
  notify(message, options = {}) {
    const {
      type = this.NotificationType.ALERT,
      duration = 3000,
      elementId = null,
      messageType = "error",
      position = "bottom-right",
    } = options;

    // トースト通知の場合、設定を確認
    if (type === this.NotificationType.TOAST) {
      if (!this.shouldShowNotification(messageType)) {
        return; // 設定で無効化されている場合はスキップ
      }
    }

    switch (type) {
      case this.NotificationType.ALERT:
        window.alert(message);
        break;

      case this.NotificationType.TOAST:
        this.showToast(message, duration, messageType, position);
        break;

      case this.NotificationType.INLINE:
        if (elementId) {
          this.showInlineError(elementId, message);
        }
        break;

      case this.NotificationType.CONSOLE:
        console.log("User notification:", message);
        break;
    }
  },

  /**
   * トースト通知を表示
   * @param {string} message - メッセージ
   * @param {number} duration - 表示時間（ミリ秒）
   * @param {string} [type='error'] - メッセージタイプ
   * @param {string} [position='bottom-right'] - 表示位置
   */
  showToast(message, duration, type = "error", position = "bottom-right") {
    // 初期化チェック
    if (!this.toastContainer) {
      this.init();
    }

    // ドロップダウン保護モードを有効化
    if (window.dropdownManager) {
      window.dropdownManager.setToastProtection(true);
    }

    // トースト要素を作成
    const toast = document.createElement("div");
    toast.className = `${CSS_CLASSES.ERROR.TOAST} ${CSS_CLASSES.TOAST[type.toUpperCase()]}`;
    
    // フォーカス競合を防ぐためtabindex=-1を設定
    toast.setAttribute('tabindex', '-1');
    toast.style.outline = 'none';

    // アイコンを追加
    const icons = {
      success: "✓",
      error: "✕",
      info: "ℹ",
      warning: "⚠",
    };

    // スタイルを設定
    const colors = {
      success: "#4CAF50",
      error: "#f44336",
      info: "#2196F3",
      warning: "#FF9800",
    };

    toast.className = `error-toast toast-${type}`;

    // コンテンツを設定
    toast.innerHTML = `
      <span style="font-size: 20px; margin-right: 10px;">${
        icons[type] || icons.error
      }</span>
      <span style="flex: 1;">${this.escapeHtml(message)}</span>
    `;

    // クリックで閉じる（ドロップダウンへの影響を最小化）
    toast.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dismissToast(toast);
    });

    // コンテナに追加
    this.toastContainer.appendChild(toast);

    // アニメーション開始
    requestAnimationFrame(() => {
      toast.style.transform = "translateX(0)";
    });

    // 自動削除タイマー
    const timer = setTimeout(() => {
      this.dismissToast(toast);
    }, duration);

    // ホバー時はタイマーを停止
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      setTimeout(() => this.dismissToast(toast), 1000);
    });

    // 保護モードを少し遅れて解除（トーストアニメーション完了後）
    setTimeout(() => {
      if (window.dropdownManager) {
        window.dropdownManager.setToastProtection(false);
      }
    }, 500); // トーストアニメーション完了後に解除
  },

  /**
   * トーストを削除
   * @param {HTMLElement} toast - トースト要素
   */
  dismissToast(toast) {
    toast.style.transform = "translateX(400px)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      
      // トースト削除時に保護モードを解除
      if (window.dropdownManager) {
        window.dropdownManager.setToastProtection(false);
      }
    }, 300);
  },

  /**
   * インラインエラーを表示
   * @param {string} elementId - 要素のID
   * @param {string} message - エラーメッセージ
   */
  showInlineError(elementId, message) {
    const element = document.querySelector(elementId);
    if (!element) return;

    // 既存のエラーメッセージを削除
    const existingError = element.parentNode.querySelector(".error-message");
    if (existingError) {
      existingError.remove();
    }

    // エラーメッセージを作成
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      color: #f44336;
      font-size: 12px;
      margin-top: 4px;
      animation: fadeIn 0.3s ease-in;
    `;

    // 要素の後に挿入
    element.parentNode.insertBefore(errorDiv, element.nextSibling);

    // 一定時間後に自動削除
    setTimeout(() => {
      errorDiv.style.animation = "fadeOut 0.3s ease-out";
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  },

  /**
   * HTMLエスケープ
   * @param {string} text - エスケープするテキスト
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 非同期処理のエラーハンドリングラッパー
   * @param {Function} asyncFunc - 非同期関数
   * @param {string} context - エラーコンテキスト
   * @param {Object} [options] - オプション
   * @returns {Promise}
   */
  async handleAsync(asyncFunc, context, options = {}) {
    const {
      showLoading = false,
      notifyOnError = true,
      defaultValue = null,
      loadingMessage = "読み込み中...",
    } = options;

    let loadingElement = null;

    try {
      if (showLoading) {
        loadingElement = this.showLoading(true, loadingMessage);
      }

      const result = await asyncFunc();

      if (showLoading && loadingElement) {
        this.showLoading(false, "", loadingElement);
      }

      return result;
    } catch (error) {
      this.log(`Error in ${context}`, error);

      if (notifyOnError) {
        const userMessage = this.getUserFriendlyMessage(error, context);
        this.notify(userMessage, {
          type: this.NotificationType.TOAST,
          messageType: "error",
        });
      }

      if (showLoading && loadingElement) {
        this.showLoading(false, "", loadingElement);
      }

      return defaultValue;
    }
  },

  /**
   * ユーザーフレンドリーなエラーメッセージを生成
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @returns {string}
   */
  getUserFriendlyMessage(error, context) {
    // エラーメッセージのマッピング
    const messageMap = {
      "chrome.runtime.lastError":
        "拡張機能との通信でエラーが発生しました。ページを再読み込みしてください。",
      fetch:
        "ネットワークエラーが発生しました。インターネット接続を確認してください。",
      storage: "データの保存中にエラーが発生しました。",
      load: "データの読み込み中にエラーが発生しました。",
      permission: "必要な権限がありません。",
      timeout: "処理がタイムアウトしました。",
    };

    // エラーメッセージから適切なメッセージを検索
    for (const [key, message] of Object.entries(messageMap)) {
      if (error.message?.includes(key) || context.includes(key)) {
        return message;
      }
    }

    // デフォルトメッセージ
    return `処理中にエラーが発生しました: ${context}`;
  },

  /**
   * ローディング表示の制御
   * @param {boolean} show - 表示/非表示
   * @param {string} [message] - ローディングメッセージ
   * @param {HTMLElement} [existingElement] - 既存のローディング要素
   * @returns {HTMLElement|null}
   */
  showLoading(show, message = "読み込み中...", existingElement = null) {
    if (show) {
      // 既存の要素があれば再利用
      let overlay =
        existingElement || document.getElementById("loading-overlay");

      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
        `;

        const spinner = document.createElement("div");
        spinner.style.cssText = `
          color: #fff;
          font-size: 18px;
          background: rgba(0, 0, 0, 0.8);
          padding: 20px 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 15px;
        `;

        // スピナーアニメーション
        spinner.innerHTML = `
          <div class="spinner" style="
            width: 24px;
            height: 24px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
          <span>${this.escapeHtml(message)}</span>
        `;

        overlay.appendChild(spinner);
        document.body.appendChild(overlay);

        // CSSアニメーション
        const style = document.createElement("style");
        style.textContent = `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(style);

        // フェードイン
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";
        });
      }

      return overlay;
    } else {
      const overlay =
        existingElement || document.getElementById("loading-overlay");
      if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 300);
      }
      return null;
    }
  },

  /**
   * 入力検証エラーのハンドリング
   * @param {Object} validationResult - 検証結果
   * @param {Object} fieldMapping - フィールドとIDのマッピング
   */
  handleValidationErrors(validationResult, fieldMapping) {
    // 既存のエラーをクリア
    document.querySelectorAll(".error-message").forEach((el) => el.remove());
    document.querySelectorAll(".error-highlight").forEach((el) => {
      el.classList.remove("error-highlight");
      el.style.borderColor = "";
    });

    if (!validationResult.isValid) {
      validationResult.errors.forEach((error) => {
        const elementId = fieldMapping[error.field];
        if (elementId) {
          const element = document.querySelector(elementId);
          if (element) {
            element.classList.add("error-highlight");
            element.style.borderColor = "#f44336";
            this.showInlineError(elementId, error.message);
          }
        }
      });
    }
  },

  /**
   * デバッグモードの設定
   * @param {boolean} enabled - デバッグモードの有効/無効
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    if (enabled) {
      this.notify("デバッグモードが有効になりました", {
        type: this.NotificationType.TOAST,
        messageType: "info",
        duration: 2000,
      });
    }
  },

  /**
   * エラーログをエクスポート
   * @returns {string} エラーログのJSON文字列
   */
  exportLogs() {
    try {
      const logs = localStorage.getItem("errorLogs") || "[]";
      return logs;
    } catch (error) {
      return "[]";
    }
  },

  /**
   * エラーログをクリア
   */
  clearLogs() {
    localStorage.removeItem("errorLogs");
    this.notify("エラーログをクリアしました", {
      type: this.NotificationType.TOAST,
      messageType: "success",
      duration: 2000,
    });
  },

  /**
   * エラー統計を取得
   * @returns {Object} エラー統計
   */
  getErrorStats() {
    try {
      const logs = JSON.parse(localStorage.getItem("errorLogs") || "[]");
      const stats = {
        total: logs.length,
        byLevel: {},
        recent: logs.slice(-10),
      };

      // レベル別集計
      logs.forEach((log) => {
        stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      });

      return stats;
    } catch (error) {
      return { total: 0, byLevel: {}, recent: [] };
    }
  },

  /**
   * 共通化されたtry-catch処理のヘルパーメソッド
   */

  /**
   * ファイル操作エラーの共通処理
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名（'read', 'write', 'import', 'export'）
   * @param {string} [fileName] - ファイル名
   * @param {Object} [options] - 追加オプション
   */
  handleFileError(error, operation, fileName = '', options = {}) {
    const operationNames = {
      read: '読み込み',
      write: '書き込み', 
      import: 'インポート',
      export: 'エクスポート'
    };
    
    const operationName = operationNames[operation] || operation;
    const fileInfo = fileName ? `ファイル「${fileName}」の` : 'ファイル';
    const message = `${fileInfo}${operationName}に失敗しました`;
    
    this.log(`File ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 5000, "error");
    
    if (options.debugMode) {
      console.error(`[FILE_ERROR] ${operation} operation failed:`, {
        fileName,
        error: error.message,
        stack: error.stack
      });
    }
  },

  /**
   * ネットワークエラーの共通処理
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名
   * @param {Object} [options] - 追加オプション
   */
  handleNetworkError(error, operation, options = {}) {
    const message = `ネットワーク${operation}に失敗しました`;
    
    this.log(`Network ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 5000, "error");
    
    if (options.debugMode) {
      console.error(`[NETWORK_ERROR] ${operation} failed:`, error);
    }
  },

  /**
   * データ処理エラーの共通処理
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名
   * @param {Object} [options] - 追加オプション
   */
  handleDataError(error, operation, options = {}) {
    const message = `データ${operation}処理でエラーが発生しました`;
    
    this.log(`Data ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 4000, "error");
    
    if (options.debugMode) {
      console.error(`[DATA_ERROR] ${operation} failed:`, error);
    }
  },

  /**
   * ストレージエラーの共通処理
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名（'save', 'load', 'delete'）
   * @param {Object} [options] - 追加オプション
   */
  handleStorageError(error, operation, options = {}) {
    const operationNames = {
      save: '保存',
      load: '読み込み',
      delete: '削除'
    };
    
    const operationName = operationNames[operation] || operation;
    const message = `データの${operationName}に失敗しました`;
    
    this.log(`Storage ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 4000, "error");
    
    if (options.debugMode) {
      console.error(`[STORAGE_ERROR] ${operation} failed:`, error);
    }
  },

  /**
   * 汎用的なtry-catchラッパー
   * @param {Function} asyncFunction - 実行する非同期関数
   * @param {string} errorContext - エラーコンテキスト
   * @param {Object} [options] - オプション
   * @returns {Promise<any>} 実行結果またはundefined（エラー時）
   */
  async wrapAsync(asyncFunction, errorContext, options = {}) {
    try {
      return await asyncFunction();
    } catch (error) {
      const {
        showToast = true,
        toastDuration = 4000,
        logLevel = this.Level.ERROR,
        debugMode = false
      } = options;

      this.log(`${errorContext} failed`, error, logLevel);
      
      if (showToast) {
        this.showToast(`${errorContext}でエラーが発生しました: ${error.message}`, toastDuration, "error");
      }
      
      if (debugMode) {
        console.error(`[WRAP_ERROR] ${errorContext}:`, error);
      }
      
      return undefined;
    }
  },

  /**
   * 同期関数用のtry-catchラッパー
   * @param {Function} syncFunction - 実行する同期関数
   * @param {string} errorContext - エラーコンテキスト
   * @param {Object} [options] - オプション
   * @returns {any} 実行結果またはundefined（エラー時）
   */
  wrapSync(syncFunction, errorContext, options = {}) {
    try {
      return syncFunction();
    } catch (error) {
      const {
        showToast = true,
        toastDuration = 4000,
        logLevel = this.Level.ERROR,
        debugMode = false
      } = options;

      this.log(`${errorContext} failed`, error, logLevel);
      
      if (showToast) {
        this.showToast(`${errorContext}でエラーが発生しました: ${error.message}`, toastDuration, "error");
      }
      
      if (debugMode) {
        console.error(`[WRAP_ERROR] ${errorContext}:`, error);
      }
      
      return undefined;
    }
  },
};

// 初期化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => ErrorHandler.init());
} else {
  ErrorHandler.init();
}

// グローバルに公開
if (typeof window !== "undefined") {
  window.ErrorHandler = ErrorHandler;
}
