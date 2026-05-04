const ErrorHandler = {
  Level: MESSAGE_LEVELS,

  NotificationType: {
    NONE: "none",
    CONSOLE: "console",
    ALERT: "alert",
    TOAST: "toast",
    INLINE: "inline",
  },

  toastContainer: null,

  init() {
    try {
      this.toastContainer = document.getElementById(DOM_IDS.COMMON.ERROR_TOAST_CONTAINER);

      if (!this.toastContainer) {
        this.toastContainer = document.createElement("div");
        this.toastContainer.id = DOM_IDS.COMMON.ERROR_TOAST_CONTAINER;
        this.toastContainer.className = CSS_CLASSES.TOAST.CONTAINER;
        document.body.appendChild(this.toastContainer);
      }

      window.addEventListener(DOM_EVENTS.ERROR, (event) => {
        this.log(event.error || event.message, "JavaScript Error", this.Level.ERROR);
      });

      window.addEventListener(DOM_EVENTS.UNHANDLED_REJECTION, (event) => {
        this.log(event.reason, "Unhandled Promise Rejection", this.Level.ERROR);
      });

      if (chrome?.runtime?.onError) {
        chrome.runtime.onError.addListener((error) => {
          this.log(error, "Extension Error", this.Level.ERROR);
        });
      }
    } catch (error) {}
  },

  setupGlobalHandlers() {
    window.addEventListener(DOM_EVENTS.UNHANDLED_REJECTION, (event) => {
      this.log("Unhandled promise rejection", event.reason, this.Level.ERROR);
    });

    window.addEventListener(DOM_EVENTS.ERROR, (event) => {
      this.log("Global error", event.error, this.Level.ERROR);
    });
  },

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

    this.saveToLocalStorage(logEntry);
  },

  saveToLocalStorage(logEntry) {
    try {
      const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY.ERROR_LOGS) || "[]");
      logs.push(logEntry);

      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }

      localStorage.setItem(STORAGE_KEYS.HISTORY.ERROR_LOGS, JSON.stringify(logs));
    } catch (e) {
      localStorage.removeItem(STORAGE_KEYS.HISTORY.ERROR_LOGS);
    }
  },

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

  notify(message, options = {}) {
    const {
      type = this.NotificationType.ALERT,
      duration = 3000,
      elementId = null,
      messageType = "error",
      position = "bottom-right",
    } = options;

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
        break;
    }
  },

  showToast(message, duration, type = "error", position = "bottom-right") {
    if (!this.toastContainer) {
      this.init();
    }

    if (window.dropdownManager) {
      window.dropdownManager.setToastProtection(true);
    }

    const toast = document.createElement("div");

    const icons = {
      success: "✓",
      error: "✕",
      info: "ℹ",
      warning: "⚠",
    };

    toast.className = `error-toast toast-${type} toast-no-outline`;

    // フォーカス競合を防ぐためtabindex=-1を設定
    toast.setAttribute("tabindex", "-1");

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.error}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;

    toast.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dismissToast(toast);
    });

    this.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    const timer = setTimeout(() => {
      this.dismissToast(toast);
    }, duration);

    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      setTimeout(() => this.dismissToast(toast), 1000);
    });

    setTimeout(() => {
      if (window.dropdownManager) {
        window.dropdownManager.setToastProtection(false);
      }
    }, 500); // トーストアニメーション完了後に解除
  },

  dismissToast(toast) {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }

      if (window.dropdownManager) {
        window.dropdownManager.setToastProtection(false);
      }
    }, 300);
  },

  showInlineError(elementId, message) {
    const element = document.querySelector(elementId);
    if (!element) return;

    const existingError = element.parentNode.querySelector(".error-message");
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message inline-error-message";
    errorDiv.textContent = message;

    element.parentNode.insertBefore(errorDiv, element.nextSibling);

    setTimeout(() => {
      errorDiv.classList.add("fade-out");
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

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

  getUserFriendlyMessage(error, context) {
    const messageMap = {
      "chrome.runtime.lastError": "拡張機能との通信でエラーが発生しました。ページを再読み込みしてください。",
      fetch: "ネットワークエラーが発生しました。インターネット接続を確認してください。",
      storage: "データの保存中にエラーが発生しました。",
      load: "データの読み込み中にエラーが発生しました。",
      permission: "必要な権限がありません。",
      timeout: "処理がタイムアウトしました。",
    };

    for (const [key, message] of Object.entries(messageMap)) {
      if (error.message?.includes(key) || context.includes(key)) {
        return message;
      }
    }

    return `処理中にエラーが発生しました: ${context}`;
  },

  showLoading(show, message = "読み込み中...", existingElement = null) {
    if (show) {
      let overlay = existingElement || document.getElementById(DOM_IDS.COMMON.LOADING_OVERLAY);

      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.className = "loading-overlay";

        const spinner = document.createElement("div");
        spinner.className = "loading-spinner-box";

        spinner.innerHTML = `
          <div class="loading-spinner"></div>
          <span>${this.escapeHtml(message)}</span>
        `;

        overlay.appendChild(spinner);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
          overlay.classList.add("visible");
        });
      }

      return overlay;
    } else {
      const overlay = existingElement || document.getElementById(DOM_IDS.COMMON.LOADING_OVERLAY);
      if (overlay) {
        overlay.classList.remove("visible");
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 300);
      }
      return null;
    }
  },

  handleValidationErrors(validationResult, fieldMapping) {
    document.querySelectorAll(".error-message").forEach((el) => el.remove());
    document.querySelectorAll(".error-highlight").forEach((el) => {
      el.classList.remove("error-highlight");
      el.classList.remove("error-highlight-border");
    });

    if (!validationResult.isValid) {
      validationResult.errors.forEach((error) => {
        const elementId = fieldMapping[error.field];
        if (elementId) {
          const element = document.querySelector(elementId);
          if (element) {
            element.classList.add("error-highlight");
            element.classList.add("error-highlight-border");
            this.showInlineError(elementId, error.message);
          }
        }
      });
    }
  },

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

  exportLogs() {
    try {
      const logs = localStorage.getItem("errorLogs") || "[]";
      return logs;
    } catch (error) {
      return "[]";
    }
  },

  clearLogs() {
    localStorage.removeItem("errorLogs");
    this.notify("エラーログをクリアしました", {
      type: this.NotificationType.TOAST,
      messageType: "success",
      duration: 2000,
    });
  },

  getErrorStats() {
    try {
      const logs = JSON.parse(localStorage.getItem("errorLogs") || "[]");
      const stats = {
        total: logs.length,
        byLevel: {},
        recent: logs.slice(-10),
      };

      logs.forEach((log) => {
        stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      });

      return stats;
    } catch (error) {
      return { total: 0, byLevel: {}, recent: [] };
    }
  },

  handleFileError(error, operation, fileName = "", options = {}) {
    const operationNames = {
      read: "読み込み",
      write: "書き込み",
      import: "インポート",
      export: "エクスポート",
    };

    const operationName = operationNames[operation] || operation;
    const fileInfo = fileName ? `ファイル「${fileName}」の` : "ファイル";
    const message = `${fileInfo}${operationName}に失敗しました`;

    this.log(`File ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 5000, "error");
  },

  handleNetworkError(error, operation, options = {}) {
    const message = `ネットワーク${operation}に失敗しました`;

    this.log(`Network ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 5000, "error");
  },

  handleDataError(error, operation, options = {}) {
    const message = `データ${operation}処理でエラーが発生しました`;

    this.log(`Data ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 4000, "error");
  },

  handleStorageError(error, operation, options = {}) {
    const operationNames = {
      save: "保存",
      load: "読み込み",
      delete: "削除",
    };

    const operationName = operationNames[operation] || operation;
    const message = `データの${operationName}に失敗しました`;

    this.log(`Storage ${operation} failed`, error, this.Level.ERROR);
    this.showToast(`${message}: ${error.message}`, 4000, "error");
  },

  async wrapAsync(asyncFunction, errorContext, options = {}) {
    try {
      return await asyncFunction();
    } catch (error) {
      const { showToast = true, toastDuration = 4000, logLevel = this.Level.ERROR, debugMode = false } = options;

      this.log(`${errorContext} failed`, error, logLevel);

      if (showToast) {
        this.showToast(`${errorContext}でエラーが発生しました: ${error.message}`, toastDuration, "error");
      }

      return undefined;
    }
  },

  wrapSync(syncFunction, errorContext, options = {}) {
    try {
      return syncFunction();
    } catch (error) {
      const { showToast = true, toastDuration = 4000, logLevel = this.Level.ERROR, debugMode = false } = options;

      this.log(`${errorContext} failed`, error, logLevel);

      if (showToast) {
        this.showToast(`${errorContext}でエラーが発生しました: ${error.message}`, toastDuration, "error");
      }

      return undefined;
    }
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => ErrorHandler.init());
} else {
  ErrorHandler.init();
}

if (typeof window !== "undefined") {
  window.ErrorHandler = ErrorHandler;
}
