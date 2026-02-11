class LoraGenerateHandler {
  constructor() {
    this.isRunning = false;
    this.currentIndex = 0;
    this.checkInterval = null;
    this.lastGenerateTime = null;
    this.waitingForComplete = false;
    this.isInternalClick = false;
    this.currentPrompt = null;

    this.generateInterval = AUTO_GENERATE.DEFAULT_INTERVAL;
    this.progressInterval = null;
    this.waitStartTime = null;
    this.waitDuration = 0;

    this.lastClickTime = 0;
    this.clickDebounceDelay = 200;
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
    const loraButton = document.getElementById(DOM_IDS.OTHER.LORA_GENERATE);
    if (!loraButton) return;

    if (this.boundClickHandler) {
      loraButton.removeEventListener("click", this.boundClickHandler);
    }

    this.boundClickHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const currentTime = Date.now();
      if (currentTime - this.lastClickTime < this.clickDebounceDelay) return;
      this.lastClickTime = currentTime;

      const isActive = loraButton.classList.contains("active");

      if (isActive) {
        this.stop();
      } else {
        try {
          if (window.autoGenerateHandler?.isRunning) {
            window.autoGenerateHandler.stop();
          }
          await this.start();
          this.updateButtonState(true);
        } catch (error) {
          this.updateButtonState(false);
        }
      }
    };

    loraButton.addEventListener("click", this.boundClickHandler);
  }

  async start() {
    if (this.isRunning) return;

    if (this.data.length === 0) {
      ErrorHandler.notify("LoRAトレーニングデータが見つかりません", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
        duration: NOTIFICATION_DURATION.LONG,
      });
      throw new Error("LoRA training data not found");
    }

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (!generateButton) {
      ErrorHandler.notify("Generateボタンが見つかりません", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
        duration: NOTIFICATION_DURATION.LONG,
      });
      throw new Error("Generate button not found");
    }

    await this.loadSettings();

    generateButton.classList.add("auto-generating");

    this.isRunning = true;
    this.currentIndex = 0;
    this.waitingForComplete = false;

    this.showProgress();
    this.updateProgress();

    ErrorHandler.notify(`LoRA素材生成を開始します（全${this.data.length}枚）`, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "info",
      duration: NOTIFICATION_DURATION.MEDIUM,
    });

    await this.generate();

    this.checkInterval = setInterval(() => {
      this.checkGenerateStatus();
    }, AUTO_GENERATE.CHECK_INTERVAL);
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.waitingForComplete = false;
    this.currentPrompt = null;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.stopWaitProgress();
    this.hideProgress();
    this.updateButtonState(false);

    ErrorHandler.notify(
      `LoRA生成を停止しました（${this.currentIndex}/${this.data.length}枚完了）`,
      {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "info",
        duration: NOTIFICATION_DURATION.MEDIUM,
      }
    );

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.classList.remove("auto-generating");
    }
  }

  async generate() {
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    const item = this.data[this.currentIndex];

    this.currentPrompt = item.prompt;
    const label = item.data ? item.data.join(" > ") : "";

    this.updateProgress(`生成中... ${this.currentIndex + 1}/${this.data.length} [${label}]`);
    this.stopWaitProgress();

    try {
      await this.executePromptInput();

      const delay = this.getCurrentSiteDelay();
      if (delay > 0) {
        this.updateProgress(`入力待機中... (${delay}ms)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (generateButton) {
        this.lastGenerateTime = Date.now();
        this.waitingForComplete = true;

        this.isInternalClick = true;
        generateButton.click();
        this.isInternalClick = false;

        return true;
      } else {
        this.stop();
        return false;
      }
    } catch (error) {
      this.stop();
      return false;
    }
  }

  async executePromptInput() {
    const positiveSelector = AppState.selector.positiveSelector;
    if (!positiveSelector) return;

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) throw new Error("No active tab found");

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["js/content.js"],
        });
      } catch (injectError) {}

      if (this.currentPrompt) {
        await chrome.tabs.sendMessage(tab.id, {
          action: "inputPrompt",
          selector: positiveSelector,
          prompt: this.currentPrompt,
        });
      }
    } catch (error) {}
  }

  getCurrentSiteDelay() {
    const serviceSelect = document.getElementById(DOM_IDS.OTHER.SELECTOR_SERVICE);
    if (serviceSelect && serviceSelect.value) {
      const serviceKey = serviceSelect.value;

      const builtInSite = AppState.selector.serviceSets[serviceKey];
      if (builtInSite && builtInSite.inputDelay !== undefined) {
        return builtInSite.inputDelay;
      }

      const customSite = AppState.selector.customSites[serviceKey];
      if (customSite && customSite.inputDelay !== undefined) {
        return customSite.inputDelay;
      }
    }

    return 0;
  }

  checkGenerateStatus() {
    if (!this.isRunning || !this.waitingForComplete) return;

    const elapsed = Date.now() - this.lastGenerateTime;

    if (elapsed > AUTO_GENERATE.TIMEOUT) {
      this.updateProgress("タイムアウト - 次の生成を開始します");
      this.onGenerateComplete();
      return;
    }

    if (elapsed > AUTO_GENERATE.COMPLETION_TIMEOUT) {
      this.onGenerateComplete();
    }
  }

  onGenerateComplete() {
    if (!this.waitingForComplete) return;

    this.waitingForComplete = false;
    this.currentIndex++;

    if (this.currentIndex >= this.data.length) {
      this.complete();
      return;
    }

    const nextItem = this.data[this.currentIndex];
    const nextLabel = nextItem.data ? nextItem.data.join(" > ") : "";

    this.updateProgress(`待機中... (次: ${this.currentIndex + 1}/${this.data.length} [${nextLabel}])`);

    this.startWaitProgress();

    setTimeout(() => {
      if (this.isRunning) {
        this.stopWaitProgress();
        this.generate();
      }
    }, this.generateInterval);
  }

  startWaitProgress() {
    this.waitStartTime = Date.now();
    this.waitDuration = this.generateInterval;

    this.progressInterval = setInterval(() => {
      this.updateWaitProgress();
    }, 100);

    this.updateWaitProgress();
  }

  stopWaitProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    this.setGenerateButtonProgress(0);
  }

  updateWaitProgress() {
    if (!this.waitStartTime) return;

    const elapsed = Date.now() - this.waitStartTime;
    const progress = Math.min(elapsed / this.waitDuration, 1);

    this.setGenerateButtonProgress(progress);
  }

  setGenerateButtonProgress(progress) {
    const progressBar = document.getElementById("generate-progress-bar");
    const progressFill = progressBar ? progressBar.querySelector(".progress-fill") : null;

    if (progressBar && progressFill) {
      progressFill.style.width = `${progress * 100}%`;

      if (progress > 0) {
        progressBar.classList.add("active");
      } else {
        progressBar.classList.remove("active");
      }
    }
  }

  updateProgress(status = null) {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (!progressElement) return;

    let text = `LoRA生成中: ${this.currentIndex}/${this.data.length}`;

    if (status) {
      text = status;
    }

    progressElement.textContent = text;
  }

  showProgress() {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (progressElement) {
      progressElement.style.display = "inline";
    }
  }

  hideProgress() {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (progressElement) {
      progressElement.style.display = "none";
    }
  }

  complete() {
    this.isRunning = false;
    this.waitingForComplete = false;
    this.currentPrompt = null;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.stopWaitProgress();
    this.updateButtonState(false);
    this.updateProgress("LoRA生成完了！");

    setTimeout(() => {
      this.hideProgress();
    }, NOTIFICATION_DURATION.STANDARD);

    ErrorHandler.notify(`LoRA素材生成が完了しました（全${this.data.length}枚）`, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "success",
      duration: NOTIFICATION_DURATION.LONG,
    });

    this.playCompletionSound();

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.classList.remove("auto-generating");
    }
  }

  playCompletionSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {}
  }

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

  updateButtonState(isActive) {
    const loraButton = document.getElementById(DOM_IDS.OTHER.LORA_GENERATE);
    if (loraButton) {
      if (isActive) {
        loraButton.classList.add("active");
        loraButton.querySelector(".toggle-status").textContent = "ON";
      } else {
        loraButton.classList.remove("active");
        loraButton.querySelector(".toggle-status").textContent = "OFF";
      }
    }
  }

  cleanup() {
    this.stop();

    const loraButton = document.getElementById(DOM_IDS.OTHER.LORA_GENERATE);
    if (loraButton && this.boundClickHandler) {
      loraButton.removeEventListener("click", this.boundClickHandler);
      this.boundClickHandler = null;
    }
  }
}

window.LoraGenerateHandler = LoraGenerateHandler;
window.loraGenerateHandler = new LoraGenerateHandler();

window.addEventListener("beforeunload", () => {
  if (window.loraGenerateHandler) {
    window.loraGenerateHandler.cleanup();
  }
});
