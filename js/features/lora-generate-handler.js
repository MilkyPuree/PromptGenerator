class LoraGenerateHandler extends GenerateHandlerBase {
  constructor() {
    super({ toggleButtonId: DOM_IDS.OTHER.LORA_GENERATE });
    this.currentIndex = 0;
    this.currentPrompt = null;
  }

  get data() {
    return window.loraTrainingMasterData || [];
  }

  async init() {
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (!generateButton) return;

    await this.loadSettings();
    this.attachEventListeners();
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
          if (window.autoGenerateHandler?.isRunning) {
            window.autoGenerateHandler.stop();
          }
          await this.start();
          this.updateToggleButtonState(true);
        } catch (error) {
          this.updateToggleButtonState(false);
        }
      }
    };

    toggle.addEventListener("click", this.boundClickHandler);
  }

  async validateBeforeStart() {
    if (this.data.length === 0) {
      UIHelpers.notifyWarning("LoRAトレーニングデータが見つかりません", NOTIFICATION_DURATION.LONG);
      throw new Error("LoRA training data not found");
    }
    return true;
  }

  onStartNotify() {
    UIHelpers.notifyInfo(`LoRA素材生成を開始します（全${this.data.length}枚）`, NOTIFICATION_DURATION.MEDIUM);
  }

  resetCounter() { this.currentIndex = 0; }
  incrementCounter() { this.currentIndex++; }

  isGenerationComplete() {
    return this.currentIndex >= this.data.length;
  }

  prepareGeneration() {
    const item = this.data[this.currentIndex];
    this.currentPrompt = item.prompt;
  }

  getDefaultProgressText() {
    return `LoRA生成中: ${this.currentIndex}/${this.data.length}`;
  }

  getGenerateStatusText() {
    const item = this.data[this.currentIndex];
    const label = item.data ? item.data.join(" > ") : "";
    return `生成中... ${this.currentIndex + 1}/${this.data.length} [${label}]`;
  }

  getNextWaitText() {
    const nextItem = this.data[this.currentIndex];
    const nextLabel = nextItem.data ? nextItem.data.join(" > ") : "";
    return `待機中... (次: ${this.currentIndex + 1}/${this.data.length} [${nextLabel}])`;
  }

  getStopMessage() {
    return `LoRA生成を停止しました（${this.currentIndex}/${this.data.length}枚完了）`;
  }

  getCompleteText() { return "LoRA生成完了！"; }
  getCompleteMessage() { return `LoRA素材生成が完了しました（全${this.data.length}枚）`; }

  getCurrentPromptValue() { return this.currentPrompt; }

  onStopCleanup() { this.currentPrompt = null; }
  onCompleteCleanup() { this.currentPrompt = null; }

  async loadSettings() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(["autoGenerateSettings"], resolve);
      });

      const settings = result.autoGenerateSettings;
      if (settings) {
        this.generateInterval = (settings.generateInterval || AUTO_GENERATE.DEFAULT_INTERVAL / 1000) * 1000;
      }
    } catch (error) {}
  }
}

window.LoraGenerateHandler = LoraGenerateHandler;
window.loraGenerateHandler = new LoraGenerateHandler();

window.addEventListener("beforeunload", () => {
  if (window.loraGenerateHandler) {
    window.loraGenerateHandler.cleanup();
  }
});
