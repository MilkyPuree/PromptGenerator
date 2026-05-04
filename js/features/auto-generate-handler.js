class AutoGenerateHandler extends GenerateHandlerBase {
  constructor() {
    super({ toggleButtonId: DOM_IDS.OTHER.AUTO_GENERATE });
    this.currentCount = 0;
    this.targetCount = AUTO_GENERATE.DEFAULT_COUNT;
    this.isInfiniteMode = false;
    this.historyPrompt = null;
  }

  async init() {
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (!generateButton) return;

    await this.loadSettings();
    this.setupProgressUI();
    this.attachEventListeners();
  }

  setupProgressUI() {
    if (document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS)) return;

    const generateHistoryButton = document.getElementById("show-generate-history");
    if (!generateHistoryButton) return;

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

    generateHistoryButton.parentNode.insertBefore(progress, generateHistoryButton.nextSibling);
  }

  attachEventListeners() {
    const toggle = document.getElementById(this.toggleButtonId);
    if (!toggle) return;

    if (this.boundClickHandler) {
      toggle.removeEventListener("click", this.boundClickHandler);
    }

    this.boundClickHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const currentTime = Date.now();
      if (currentTime - this.lastClickTime < this.clickDebounceDelay) return;
      this.lastClickTime = currentTime;

      const isActive = toggle.classList.contains("active");

      if (isActive) {
        this.stop();
      } else {
        try {
          await this.start();
          this.updateToggleButtonState(true);
        } catch (error) {
          this.updateToggleButtonState(false);
        }
      }

      setTimeout(() => {
        if (!this.isRunning) return;

        const finalButtonState = toggle.classList.contains("active");
        if (finalButtonState !== this.isRunning && this.isRunning) {
          this.updateToggleButtonState(this.isRunning);
        }
      }, 100);
    };

    toggle.addEventListener("click", this.boundClickHandler);
  }

  resetCounter() { this.currentCount = 0; }
  incrementCounter() { this.currentCount++; }

  isGenerationComplete() {
    return !this.isInfiniteMode && this.currentCount >= this.targetCount;
  }

  getDefaultProgressText() {
    return this.isInfiniteMode
      ? `自動生成中: ${this.currentCount}回`
      : `自動生成中: ${this.currentCount}/${this.targetCount}`;
  }

  getGenerateStatusText() {
    const displayCount = this.isInfiniteMode
      ? `${this.currentCount + 1}回目`
      : `${this.currentCount + 1}/${this.targetCount}`;
    return `生成中... ${displayCount}`;
  }

  getWaitDelayText(delay) {
    return `プロンプト入力後待機中... (${delay}ms)`;
  }

  getNextWaitText() {
    const nextCount = this.isInfiniteMode
      ? `${this.currentCount + 1}回目`
      : `${this.currentCount + 1}/${this.targetCount}`;
    return `待機中... (次: ${nextCount})`;
  }

  getStopMessage() {
    return this.isInfiniteMode
      ? `自動生成を停止しました（${this.currentCount}回生成）`
      : `自動生成を停止しました（${this.currentCount}/${this.targetCount}回完了）`;
  }

  getCompleteText() { return "完了しました！"; }
  getCompleteMessage() { return `自動生成が完了しました（${this.currentCount}回）`; }

  getCurrentPromptValue() {
    return this.historyPrompt ||
      document.getElementById(DOM_IDS.PROMPT.GENERATE)?.value ||
      "";
  }

  onStopCleanup() { this.historyPrompt = null; }
  onCompleteCleanup() { this.historyPrompt = null; }

  async saveSettings() {
    try {
      const settings = {
        generateCount: this.targetCount,
        generateInterval: Math.floor(this.generateInterval / 1000),
      };

      await new Promise((resolve) => {
        chrome.storage.local.set({ autoGenerateSettings: settings }, resolve);
      });
    } catch (error) {}
  }

  async loadSettings() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(["autoGenerateSettings"], resolve);
      });

      const settings = result.autoGenerateSettings;

      if (settings) {
        this.targetCount = settings.generateCount ?? AUTO_GENERATE.DEFAULT_COUNT;
        this.isInfiniteMode = this.targetCount === 0;
        this.generateInterval = (settings.generateInterval || AUTO_GENERATE.DEFAULT_INTERVAL / 1000) * 1000;
      }
    } catch (error) {}
  }
}

window.AutoGenerateHandler = AutoGenerateHandler;
window.autoGenerateHandler = new AutoGenerateHandler();

window.addEventListener("beforeunload", () => {
  if (window.autoGenerateHandler) {
    autoGenerateHandler.cleanup();
  }
});
