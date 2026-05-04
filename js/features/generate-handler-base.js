class GenerateHandlerBase {
  constructor(config = {}) {
    this.isRunning = false;
    this.checkInterval = null;
    this.lastGenerateTime = null;
    this.waitingForComplete = false;
    this.isInternalClick = false;

    this.generateInterval = AUTO_GENERATE.DEFAULT_INTERVAL;
    this.progressInterval = null;
    this.waitStartTime = null;
    this.waitDuration = 0;

    this.lastClickTime = 0;
    this.clickDebounceDelay = 200;
    this.boundClickHandler = null;

    this.toggleButtonId = config.toggleButtonId;
  }

  getDefaultProgressText() { return ""; }
  getStopMessage() { return ""; }
  getCompleteMessage() { return ""; }
  getCompleteText() { return "完了しました！"; }
  getGenerateStatusText() { return ""; }
  getNextWaitText() { return ""; }
  getWaitDelayText(delay) { return `入力待機中... (${delay}ms)`; }
  getCurrentPromptValue() { return ""; }
  isGenerationComplete() { return false; }
  incrementCounter() {}
  async validateBeforeStart() { return true; }
  resetCounter() {}
  onStartNotify() {}
  prepareGeneration() {}
  onStopCleanup() {}
  onCompleteCleanup() {}

  async start() {
    if (this.isRunning) return;

    const valid = await this.validateBeforeStart();
    if (!valid) return;

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (!generateButton) {
      UIHelpers.notifyWarning("Generateボタンが見つかりません", NOTIFICATION_DURATION.LONG);
      throw new Error("Generate button not found");
    }

    await this.loadSettings();

    generateButton.classList.add("auto-generating");

    this.isRunning = true;
    this.resetCounter();
    this.waitingForComplete = false;

    this.showProgress();
    this.updateProgress();

    this.onStartNotify();

    await this.generate();

    this.checkInterval = setInterval(() => {
      this.checkGenerateStatus();
    }, AUTO_GENERATE.CHECK_INTERVAL);
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.waitingForComplete = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.onStopCleanup();

    this.stopWaitProgress();
    this.hideProgress();
    this.updateToggleButtonState(false);

    UIHelpers.notifyInfo(this.getStopMessage(), NOTIFICATION_DURATION.MEDIUM);

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.classList.remove("auto-generating");
    }
  }

  async generate() {
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);

    this.prepareGeneration();
    this.updateProgress(this.getGenerateStatusText());
    this.stopWaitProgress();

    try {
      await this.executePromptInput();

      const delay = this.getCurrentSiteDelay();
      if (delay > 0) {
        this.updateProgress(this.getWaitDelayText(delay));
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

      const currentPrompt = this.getCurrentPromptValue();

      if (currentPrompt) {
        await chrome.tabs.sendMessage(tab.id, {
          action: "inputPrompt",
          selector: positiveSelector,
          prompt: currentPrompt,
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
    this.incrementCounter();

    if (this.isGenerationComplete()) {
      this.complete();
      return;
    }

    this.updateProgress(this.getNextWaitText());
    this.startWaitProgress();

    setTimeout(() => {
      if (this.isRunning) {
        this.stopWaitProgress();
        this.generate();
      }
    }, this.generateInterval);
  }

  complete() {
    this.isRunning = false;
    this.waitingForComplete = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.onCompleteCleanup();

    this.stopWaitProgress();
    this.updateToggleButtonState(false);
    this.updateProgress(this.getCompleteText());

    setTimeout(() => {
      this.hideProgress();
    }, NOTIFICATION_DURATION.STANDARD);

    UIHelpers.notifySuccess(this.getCompleteMessage(), NOTIFICATION_DURATION.LONG);

    this.playCompletionSound();

    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      generateButton.classList.remove("auto-generating");
    }
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

    progressElement.textContent = status || this.getDefaultProgressText();
  }

  showProgress() {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (progressElement) {
      progressElement.classList.remove("hidden");
      progressElement.classList.add("show-inline");
    }
  }

  hideProgress() {
    const progressElement = document.getElementById(DOM_IDS.OTHER.AUTO_GENERATE_PROGRESS);
    if (progressElement) {
      progressElement.classList.remove("show-inline");
      progressElement.classList.add("hidden");
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

  updateToggleButtonState(isActive) {
    const button = document.getElementById(this.toggleButtonId);
    if (button) {
      if (isActive) {
        button.classList.add("active");
        button.querySelector(".toggle-status").textContent = "ON";
      } else {
        button.classList.remove("active");
        button.querySelector(".toggle-status").textContent = "OFF";
      }
    }
  }

  cleanup() {
    this.stop();

    const button = document.getElementById(this.toggleButtonId);
    if (button && this.boundClickHandler) {
      button.removeEventListener("click", this.boundClickHandler);
      this.boundClickHandler = null;
    }
  }

  async loadSettings() {}
}

window.GenerateHandlerBase = GenerateHandlerBase;
