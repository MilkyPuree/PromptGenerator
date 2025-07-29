/**
 * main.js - Prompt Generator メインスクリプト
 * Phase 2: コード品質改善版 + Phase 4: jQuery削除版 + Phase 5: モジュール分離版
 * Phase 8.5: タブモジュール化完了！
 */

// ============================================
// グローバル定数
// ============================================
const CONSTANTS = {
  TABS: {
    SEARCH: 0,
    DICTIONARY: 1,
    EDIT: 2,
    SLOT: 3,
    OTHER: 4,
  },

  UI_TYPES: {
    SD: "SD",
    NAI: "NAI",
    NONE: "None",
  },
  EDIT_TYPES: {
    SELECT: "SELECT",
    TEXT: "TEXT",
  },
};

// グローバルに公開（他のモジュールからアクセス可能にする）
if (typeof window !== "undefined") {
  window.CONSTANTS = CONSTANTS;
}

// ============================================
// アプリケーションクラス
// ============================================
class PromptGeneratorApp {
  constructor() {
    this.generateInput = {
      val: function (value) {
        const element = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (element) {
          if (arguments.length === 0) {
            return element.value;
          } else {
            element.value = value;
            return this;
          }
        }
        return arguments.length === 0 ? "" : this;
      },
      trigger: function (eventName) {
        const element = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (element) {
          element.dispatchEvent(new Event(eventName));
        }
        return this;
      },
      focus: function () {
        const element = document.getElementById(DOM_IDS.PROMPT.GENERATE);
        if (element) {
          element.focus();
        }
        return this;
      },
    };

    this.listManager = new PromptListManager();
    this.fileHandler = new FileHandler();
    this.searchHandler = new SearchHandler(this);
    this.editHandler = new EditHandler(this);
    this.dictionaryHandler = new DictionaryHandler(this);
    this.shortcutManager = new ShortcutManager();

    // Phase 8.5: タブモジュール
    this.tabs = {};

    this.initialized = false;
    this.lastFocusedInput = null; // 最後にフォーカスされた入力フィールドを記憶
  }

  /**
   * アプリケーションを初期化
   */
  async init() {
    try {
      // データの初期化
      await initializeDataManager();

      // テーママネージャーの初期化（データ読み込み後に再実行）
      if (window.themeManager) {
        await window.themeManager.loadTheme();
        window.themeManager.applyTheme(window.themeManager.currentTheme);
        console.log(`[Main] テーマを初期化: ${window.themeManager.currentTheme}`);
      }

      // ツールチップ設定の初期化
      if (typeof toggleTooltips === 'function') {
        const showTooltips = AppState.userSettings?.optionData?.showTooltips !== false;
        window.tooltipsEnabled = showTooltips; // グローバル状態を初期化
        toggleTooltips(showTooltips);
        console.log(`[Main] ツールチップを初期化: ${showTooltips ? 'enabled' : 'disabled'}`);
      }

      // カテゴリーデータの初期化
      categoryData.init();

      // PromptEditorのイベントリスナーを設定
      this.setupPromptEditorListeners();

      // UIの初期化
      this.initializeUI();

      // イベントハンドラーの設定
      this.setupEventHandlers();

      // コンテキストメニューからのメッセージを受信
      this.setupContextMenuListener();

      // Phase 8.5: タブの初期化
      if (typeof SearchTab !== "undefined") {
        this.tabs.search = new SearchTab(this);
        await this.tabs.search.init();
      }

      if (typeof DictionaryTab !== "undefined") {
        this.tabs.dictionary = new DictionaryTab(this);
        await this.tabs.dictionary.init();
      }

      if (typeof EditTab !== "undefined") {
        this.tabs.edit = new EditTab(this);
        await this.tabs.edit.init();
      }

      if (typeof SlotTab !== "undefined") {
        this.tabs.slot = new SlotTab(this);
        await this.tabs.slot.init();
      }

      if (typeof OtherTab !== "undefined") {
        this.tabs.other = new OtherTab(this);
        await this.tabs.other.init();
      }

      // 終了時の処理を設定
      this.setupCloseHandlers();

      // ショートカットキーの初期化
      this.shortcutManager.setupEventListeners();

      // プロンプトスロットの初期化（改善版）
      console.log("Initializing prompt slots...");
      const loaded = await promptSlotManager.loadFromStorage();

      if (loaded) {
        // 保存されているスロットから復元
        const currentSlot =
          promptSlotManager.slots[promptSlotManager.currentSlot];
        if (currentSlot && currentSlot.isUsed) {
          // 保存されているスロットのプロンプトを設定
          promptEditor.init(currentSlot.prompt);
          this.generateInput.val(currentSlot.prompt);
        } else {
          // 現在のスロットが空の場合
          promptEditor.init("");
          this.generateInput.val("");
        }

        // 抽出モードのスロットの場合、初期化時にGeneratePromptを更新
        if (
          currentSlot &&
          (currentSlot.mode === "random" || currentSlot.mode === "sequential")
        ) {
          const generatePrompt = document.getElementById("generatePrompt");
          if (generatePrompt) {
            if (currentSlot.currentExtraction) {
              const weightedPrompt = promptSlotManager.applyWeightToPrompt(
                currentSlot.currentExtraction,
                currentSlot.weight
              );
              generatePrompt.value = weightedPrompt;
              generatePrompt.readOnly = true;
              generatePrompt.title =
                "抽出モードで生成されたプロンプト（読み取り専用）";
            } else {
              generatePrompt.value =
                "[抽出待機中 - Generateボタンを押して抽出]";
              generatePrompt.readOnly = true;
              generatePrompt.title =
                "抽出モードで生成されたプロンプト（読み取り専用）";
            }
          }
        }
      } else {
        // 初回起動時：現在のプロンプトをスロット0に保存
        const currentPrompt = this.generateInput.val() || "";
        promptEditor.init(currentPrompt);
        if (currentPrompt) {
          promptSlotManager.slots[0].prompt = currentPrompt;
          promptSlotManager.slots[0].isUsed = true;
          // 初期化時はダイレクトに保存（saveCurrentSlotを使わない）
          await promptSlotManager.saveToStorage();
        }
      }

      promptSlotManager.updateUI();

      // 自動Generate機能の初期化（NAIチェックを削除）
      setTimeout(() => {
        if (window.autoGenerateHandler) {
          console.log("Initializing Auto Generate feature...");
          autoGenerateHandler.init();
        }
      }, 1000);

      // Generate履歴管理機能の初期化
      if (typeof GenerateHistoryManager !== "undefined") {
        this.historyManager = new GenerateHistoryManager();
        console.log("Generate History Manager initialized");
      }

      // 現在のタブのサービスを検出してセレクターを設定（統合版）
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          const service = this.detectService(tabs[0].url);

          // まずストレージから読み込み（これは既にinitializeDataManagerで実行済みのはず）
          // 念のため再確認
          const hasStoredSelectors =
            AppState.selector.positiveSelector &&
            AppState.selector.generateSelector;

          // ストレージに保存された値がある場合はそれを優先
          if (hasStoredSelectors) {
            const generateButton = document.getElementById(
              DOM_IDS.BUTTONS.GENERATE
            );
            if (generateButton) {
              generateButton.style.display = "block";
              console.log("Using saved selectors from storage");
            }
          }
          // ストレージに値がない場合のみ、サービス固有のセレクターを使用
          else if (service && AppState.selector.serviceSets[service]) {
            const serviceSelectors = AppState.selector.serviceSets[service];
            if (
              serviceSelectors.positiveSelector &&
              serviceSelectors.generateSelector
            ) {
              AppState.selector.positiveSelector =
                serviceSelectors.positiveSelector;
              AppState.selector.generateSelector =
                serviceSelectors.generateSelector;
              AppState.selector.currentService = service;

              const generateButton = document.getElementById(
                DOM_IDS.BUTTONS.GENERATE
              );
              if (generateButton) {
                generateButton.style.display = "block";
                console.log(`Using default selectors for ${service}`);
              }
            }
          }
        }
      });

      const uiTypeRadios = document.querySelectorAll(
        DOM_SELECTORS.BY_ATTRIBUTE.UI_TYPE_RADIOS
      );
      uiTypeRadios.forEach((radio) => {
        radio.addEventListener(DOM_EVENTS.CHANGE, (event) => {
          console.log("UIType changed to:", event.target.value);

          // EditHandlerに処理を委譲
          if (this.editHandler) {
            this.editHandler.handleUITypeChange(event);
          }

          // 編集タブがアクティブな場合、タブにも通知
          if (
            AppState.ui.currentTab === CONSTANTS.TABS.EDIT &&
            this.tabs.edit
          ) {
            this.tabs.edit.currentShapingMode = event.target.value;
          }

          // スロットタブの記法変換処理も実行（アクティブでなくても）
          if (this.tabs.slot) {
            const oldShaping = this.tabs.slot.currentShapingMode || 'SD';
            const newShaping = event.target.value;
            
            if (oldShaping !== newShaping) {
              this.tabs.slot.currentShapingMode = newShaping;
              this.tabs.slot.updateSlotWeightsForNewShaping(oldShaping, newShaping);
            }
          }

          // 現在編集中のプロンプト内容も記法変換
          if (window.promptEditor) {
            const currentPrompt = window.promptEditor.prompt;
            if (currentPrompt) {
              const oldShaping = AppState.userSettings?.optionData?.shaping || 'SD';
              const newShaping = event.target.value;
              
              if (oldShaping !== newShaping && window.WeightConverter) {
                const convertedPrompt = window.WeightConverter.convertPromptNotation(
                  currentPrompt, oldShaping, newShaping
                );
                
                if (convertedPrompt !== currentPrompt) {
                  window.promptEditor.prompt = convertedPrompt;
                }
              }
            }
          }
        });
      });

      const editTypeRadios = document.querySelectorAll(
        DOM_SELECTORS.BY_ATTRIBUTE.EDIT_TYPE_RADIOS
      );
      editTypeRadios.forEach((radio) => {
        radio.addEventListener(DOM_EVENTS.CHANGE, (event) => {
          console.log("EditType changed to:", event.target.value);

          if (this.editHandler) {
            this.editHandler.handleEditTypeChange(event);
          }

          if (
            AppState.ui.currentTab === CONSTANTS.TABS.EDIT &&
            this.tabs.edit
          ) {
            this.tabs.edit.currentEditMode = event.target.value;
          }
        });
      });

      this.initialized = true;
      console.log("Application initialized successfully");
    } catch (error) {
      ErrorHandler.log(
        "Application initialization failed",
        error,
        ErrorHandler.Level.CRITICAL
      );
      ErrorHandler.notify(
        "アプリケーションの初期化に失敗しました。ページを再読み込みしてください。"
      );
      throw error;
    }
  }

  // サービス検出メソッドを追加
  detectService(url) {
    if (!url) return null;

    if (url.includes(SERVICE_URLS.NOVELAI)) return SERVICE_NAMES.NOVELAI;
    if (
      url.includes(SERVICE_URLS.SD_LOCAL) ||
      url.includes(SERVICE_URLS.SD_LOCALHOST)
    )
      return SERVICE_NAMES.STABLE_DIFFUSION;
    if (url.includes(SERVICE_URLS.COMFYUI)) return SERVICE_NAMES.COMFYUI;

    return SERVICE_NAMES.CUSTOM;
  }

  /**
   * PromptEditorのイベントリスナーを設定
   * Phase 3: イベント駆動の実装例
   */
  setupPromptEditorListeners() {
    // プロンプト変更時の処理
    promptEditor.on("change", (data) => {
      console.log(`[Main] PromptEditor changed: "${data.prompt}"`);

      // 抽出モードのスロットの場合はGeneratePromptを更新しない
      if (typeof promptSlotManager !== "undefined" && promptSlotManager.slots) {
        const currentSlot =
          promptSlotManager.slots[promptSlotManager.currentSlot];
        console.log(
          `[Main] PromptEditor change - 現在スロット: ${currentSlot?.id}, モード: ${currentSlot?.mode}`
        );
        if (
          currentSlot &&
          (currentSlot.mode === "random" || currentSlot.mode === "sequential")
        ) {
          console.log(
            `[Main] PromptEditor change - 抽出モードなのでGeneratePromptを更新しません`
          );
          return;
        }
      }

      // 通常モードの場合は更新を実行
      console.log(
        `[Main] PromptEditor change - 通常モードなのでupdatePromptDisplayを実行`
      );
      this.updatePromptDisplay();
    });

    // 要素更新時の処理
    promptEditor.on("elementUpdated", (data) => {
      console.log("Element updated:", data.index, data.element);
      // 将来的には、ここで特定の要素のUI更新を行う
    });

    // 要素削除時の処理
    promptEditor.on("elementRemoved", (data) => {
      console.log("Element removed:", data.index);
      // 将来的には、ここでUIからの要素削除を行う
    });
  }

  /**
   * コンテキストメニューからのメッセージリスナーを設定（jQuery削除版）
   */
  setupContextMenuListener() {
    // フォーカストラッキングを追加
    document.addEventListener(
      "focus",
      (e) => {
        if (
          e.target &&
          (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        ) {
          this.lastFocusedInput = e.target;
        }
      },
      true
    ); // useCapture: true でキャプチャフェーズで処理

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === CHROME_MESSAGES.INSERT_PROMPT) {
        console.log("Received prompt to insert:", message.text);

        // 現在フォーカスされている要素、または最後にフォーカスされた要素を取得
        const activeElement = document.activeElement;
        const targetElement =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA")
            ? activeElement
            : this.lastFocusedInput;

        if (
          targetElement &&
          (targetElement.tagName === "INPUT" ||
            targetElement.tagName === "TEXTAREA")
        ) {
          // 現在のカーソル位置にテキストを挿入
          const start = targetElement.selectionStart || 0;
          const end = targetElement.selectionEnd || 0;
          const currentValue = targetElement.value || "";

          targetElement.value =
            currentValue.substring(0, start) +
            message.text +
            currentValue.substring(end);
          targetElement.selectionStart = targetElement.selectionEnd =
            start + message.text.length;

          // フォーカスを戻す
          targetElement.focus();

          // イベントを発火
          targetElement.dispatchEvent(new Event(DOM_EVENTS.INPUT));
          targetElement.dispatchEvent(new Event(DOM_EVENTS.CHANGE));

          sendResponse({ success: true });
        } else {
          // メインのプロンプト入力フィールドに挿入
          const generatePrompt = document.getElementById(
            DOM_IDS.PROMPT.GENERATE
          );
          if (generatePrompt) {
            const currentValue = generatePrompt.value || "";
            generatePrompt.value = currentValue + message.text;
            generatePrompt.dispatchEvent(new Event(DOM_EVENTS.INPUT));
            generatePrompt.dispatchEvent(new Event(DOM_EVENTS.CHANGE));
            generatePrompt.focus();
          }

          sendResponse({ success: true });
        }
      }

      return true; // 非同期レスポンスのため
    });
  }

  /**
   * UIを初期化
   */
  initializeUI() {
    // タブの初期設定
    this.setupTabs();

    // ソート可能なリストの設定
    this.setupSortableLists();

    // 初期表示の設定
    this.updateUIState();
  }

  /**
   * イベントハンドラーを設定
   */
  setupEventHandlers() {
    // ウィンドウ操作
    this.setupWindowHandlers();

    // タブ操作
    this.setupTabs();

    // オプション設定
    this.setupOptionHandlers();

    // プロンプト入力
    this.setupPromptInputHandlers();

    // ボタン操作
    this.setupButtonHandlers();

    // プロンプトスロット機能を追加
    this.setupPromptSlotHandlers();
  }

  // ============================================

  // ============================================

  setupTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener(DOM_EVENTS.CLICK, (e) => this.handleTabSwitch(e));
    });
  }

  async handleTabSwitch(event) {
    const clickedTab = event.currentTarget;

    // すでにアクティブなタブをクリックした場合は何もしない
    if (clickedTab.classList.contains(CSS_CLASSES.TAB.IS_ACTIVE)) {
      return;
    }

    // アクティブタブの切り替え
    const activeTabs = document.querySelectorAll(
      `.tab.${CSS_CLASSES.TAB.IS_ACTIVE}`
    );
    activeTabs.forEach((tab) =>
      tab.classList.remove(CSS_CLASSES.TAB.IS_ACTIVE)
    );
    clickedTab.classList.add(CSS_CLASSES.TAB.IS_ACTIVE);

    // パネルの切り替え
    const activePanels = document.querySelectorAll(
      `.panel.${CSS_CLASSES.TAB.IS_SHOW}`
    );
    activePanels.forEach((panel) =>
      panel.classList.remove(CSS_CLASSES.TAB.IS_SHOW)
    );

    const tabs = Array.from(document.querySelectorAll(".tab"));
    const tabIndex = tabs.indexOf(clickedTab);

    const panels = document.querySelectorAll(".panel");
    if (panels[tabIndex]) {
      panels[tabIndex].classList.add(CSS_CLASSES.TAB.IS_SHOW);
    }

    // タブ別の処理
    const previousTab = AppState.ui.currentTab;
    AppState.ui.currentTab = tabIndex;

    console.log("Tab switched from", previousTab, "to", tabIndex);

    // 検索タブの処理
    if (
      tabIndex === CONSTANTS.TABS.SEARCH &&
      previousTab !== CONSTANTS.TABS.SEARCH
    ) {
      console.log("Switching to search tab...");
      if (this.tabs.search) {
        await this.tabs.search.show();
      }
    }

    // 辞書タブの処理
    if (
      tabIndex === CONSTANTS.TABS.DICTIONARY &&
      previousTab !== CONSTANTS.TABS.DICTIONARY
    ) {
      console.log("Switching to dictionary tab...");
      if (this.tabs.dictionary) {
        await this.tabs.dictionary.show();
      }
    }

    // 編集タブの処理
    if (
      tabIndex === CONSTANTS.TABS.EDIT &&
      previousTab !== CONSTANTS.TABS.EDIT
    ) {
      console.log("Switching to edit tab...");
      if (this.tabs.edit) {
        await this.tabs.edit.show();
      }
    }

    // スロットタブの処理
    if (
      tabIndex === CONSTANTS.TABS.SLOT &&
      previousTab !== CONSTANTS.TABS.SLOT
    ) {
      console.log("Switching to slot tab...");
      if (this.tabs.slot) {
        await this.tabs.slot.show();
      }
    }

    // その他タブの処理
    if (
      tabIndex === CONSTANTS.TABS.OTHER &&
      previousTab !== CONSTANTS.TABS.OTHER
    ) {
      console.log("Switching to other tab...");
      if (this.tabs.other) {
        await this.tabs.other.show();
      }
    }

    // ポップアップを閉じる
    this.closePopup();
  }

  // ============================================

  // ============================================

  setupWindowHandlers() {
    const showPanelBtn = document.getElementById(DOM_IDS.PANELS.SHOW_PANEL);
    if (showPanelBtn) {
      showPanelBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        const optionPanel = document.getElementById(
          DOM_IDS.PANELS.OPTION_PANEL
        );
        if (optionPanel) {
          optionPanel.classList.toggle("active");
        }
      });
    }

    const popupImage = document.getElementById(DOM_IDS.PANELS.POPUP_IMAGE);
    if (popupImage) {
      popupImage.addEventListener(DOM_EVENTS.CLICK, () => this.closePopup());
    }

    // 設定ボタン
    const showSettingsBtn = document.getElementById(
      DOM_IDS.BUTTONS.SHOW_SETTINGS
    );
    if (showSettingsBtn) {
      showSettingsBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        // その他タブの設定モーダルを表示
        if (this.tabs.other && this.tabs.other.showSettingsModal) {
          this.tabs.other.showSettingsModal();
        }
      });
    }
  }

  closePopup() {
    const popup = document.getElementById(DOM_IDS.PANELS.POPUP);
    if (popup) {
      popup.style.display = "none";
    }
  }

  // ============================================

  // ============================================

  setupPromptInputHandlers() {
    const handlePromptSave = async () => {
      const value = this.generateInput.val();
      console.log("Prompt saved on Enter/Blur:", value);

      // テキスト変更時は編集タブのみ更新（要素分割を防ぐ）
      if (value.trim()) {
        editPrompt.init(value);
      }

      this.updatePromptDisplay();

      // 現在のスロットに自動保存（初期化後のみ）
      if (window.promptEditor) {
        await promptSlotManager.saveCurrentSlot();
      }

      // ドロップダウンも更新
      promptSlotManager.updateUI();

      // ListRefreshManagerで統一されたリフレッシュ処理
      try {
        await ListRefreshManager.executeAction(
          ListRefreshManager.ACTIONS.PROMPT_CHANGE,
          {
            context: {
              newPrompt: value,
              source: "manual_input",
            },
            delay: 0, // 即座実行
          }
        );
      } catch (error) {
        console.error("ListRefreshManager error on prompt change:", error);
      }
    };

    const promptInput = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (promptInput) {
      // Enter押下時の処理
      promptInput.addEventListener(DOM_EVENTS.KEY_DOWN, (e) => {
        if (e.key === "Enter") {
          handlePromptSave();
        }
      });

      // フォーカスアウト時の処理
      promptInput.addEventListener(DOM_EVENTS.BLUR, handlePromptSave);
    }
  }
  setupPromptSlotHandlers() {
    // スロットセレクター
    const slotSelector = document.getElementById("prompt-slot-selector");
    if (slotSelector) {
      slotSelector.addEventListener(DOM_EVENTS.CHANGE, async (e) => {
        const slotId = parseInt(e.target.value);
        await promptSlotManager.switchSlot(slotId);
        
        // スロット変更イベントを発火（編集タブなどが状態を更新できるように）
        window.dispatchEvent(new CustomEvent('slotChanged', {
          detail: { slotId: slotId }
        }));
      });
    }

    // スロット抽出完了イベントのリスナー設定
    window.addEventListener("slotExtractionComplete", (event) => {
      const { slotId, extraction } = event.detail;
      const currentSlot =
        promptSlotManager.slots[promptSlotManager.currentSlot];

      // 現在のスロットの抽出が完了した場合、GeneratePromptを更新
      if (currentSlot && currentSlot.id === slotId) {
        const generatePrompt = document.getElementById("generatePrompt");
        if (generatePrompt && currentSlot.mode !== "normal") {
          // 重み付きプロンプト記法を適用
          const weightedPrompt = promptSlotManager.applyWeightToPrompt(
            extraction,
            currentSlot.weight
          );
          generatePrompt.value = weightedPrompt;
          generatePrompt.readOnly = true;
          generatePrompt.title =
            "抽出モードで生成されたプロンプト（読み取り専用）";
          console.log(
            `[Main] スロット${slotId}の抽出結果をGeneratePromptに表示: ${weightedPrompt}`
          );
        }
      }
    });
  }

  updatePromptDisplay() {
    const newPrompt = editPrompt.prompt;
    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);

    if (generatePrompt) {
      // promptSlotManagerの初期化チェック
      if (typeof promptSlotManager === 'undefined' || !promptSlotManager.slots) {
        console.warn('[Main] promptSlotManager not initialized yet, skipping slot mode check');
        // スロット管理が未初期化の場合は通常モードとして扱う
        if (generatePrompt.value !== newPrompt) {
          generatePrompt.value = newPrompt;
          console.log(`[Main] updatePromptDisplay - GeneratePromptを更新: "${generatePrompt.value}" -> "${newPrompt}"`);
        }
        return;
      }

      // 抽出モードの場合は更新しない
      const currentSlot =
        promptSlotManager.slots[promptSlotManager.currentSlot];
      console.log(
        `[Main] updatePromptDisplay - 現在スロット: ${currentSlot?.id}, モード: ${currentSlot?.mode}`
      );
      console.log(`[Main] updatePromptDisplay - newPrompt: "${newPrompt}"`);
      console.log(
        `[Main] updatePromptDisplay - 現在のGeneratePrompt: "${generatePrompt.value}"`
      );

      if (
        currentSlot &&
        (currentSlot.mode === "random" || currentSlot.mode === "sequential")
      ) {
        console.log(
          `[Main] updatePromptDisplay - 抽出モードなのでGeneratePromptを更新しません`
        );
        return; // 抽出モードの場合は更新しない
      }

      const currentValue = generatePrompt.value;

      // 値が変わった場合のみ更新
      if (newPrompt !== currentValue) {
        console.log(
          `[Main] updatePromptDisplay - GeneratePromptを更新: "${currentValue}" -> "${newPrompt}"`
        );
        generatePrompt.value = newPrompt;
        savePrompt();

        // スロットにも保存（追加）
        if (window.promptEditor) {
          promptSlotManager.saveCurrentSlot();
        }
      } else {
        console.log(`[Main] updatePromptDisplay - 値が同じなので更新しません`);
      }
    }
  }

  /**
   * 追加リストを更新
   */
  refreshAddList() {
    if (this.listManager) {
      this.listManager.createFlexibleList(
        AppState.data.localPromptList,
        "#addList",
        {
          fields: STANDARD_CATEGORY_FIELDS,
          buttons: STANDARD_BUTTONS,
          sortable: true,
          listType: "add",
          idOffset: ID_OFFSETS.USER_DICTIONARY,
        }
      );
    }
  }

  // ============================================

  // ============================================

  setupButtonHandlers() {
    // プロンプト操作
    const copyButton = document.getElementById(DOM_IDS.BUTTONS.COPY);
    if (copyButton) {
      copyButton.addEventListener(DOM_EVENTS.CLICK, () => this.copyPrompt());
    }

    const clearButton = document.getElementById(DOM_IDS.BUTTONS.CLEAR);
    if (clearButton) {
      clearButton.addEventListener(DOM_EVENTS.CLICK, () => this.clearPrompt());
    }

    const saveButton = document.getElementById(DOM_IDS.BUTTONS.SAVE);
    if (saveButton) {
      saveButton.addEventListener(DOM_EVENTS.CLICK, () => this.favoriteList());
    }


    // Generate ボタン
    const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
    if (generateButton) {
      // マウスオーバーでプレビューを表示（抽出を実行しない）
      generateButton.addEventListener(DOM_EVENTS.MOUSE_ENTER, () => {
        const hasExtractionSlots = promptSlotManager.slots.some(
          (slot) => slot.mode === "random" || slot.mode === "sequential"
        );

        if (hasExtractionSlots) {
          // 抽出モードの場合はプレビューを表示しない
          const extractionSlots = promptSlotManager.slots.filter(
            (slot) => slot.mode === "random" || slot.mode === "sequential"
          ).length;
          generateButton.title = `抽出モード (${extractionSlots}個のスロット)\nGenerateをクリックして抽出を実行`;
        } else {
          // 通常モードのみの場合
          const usedSlots = promptSlotManager.getUsedSlots();

          if (usedSlots.length > 1) {
            // 通常モードのプロンプトを結合（抽出を実行しない）
            const normalPrompts = promptSlotManager.slots
              .filter(
                (slot) =>
                  slot.isUsed &&
                  slot.prompt &&
                  (!slot.mode || slot.mode === "normal")
              )
              .map((slot) => slot.prompt.trim())
              .filter((p) => p.length > 0);
            const preview = normalPrompts.join(", ").substring(0, 100);
            generateButton.title = `結合プロンプト (${normalPrompts.length}個):\n${preview}...`;
          } else if (usedSlots.length === 1) {
            generateButton.title = "現在のプロンプトで生成";
          } else {
            generateButton.title = "使用中のプロンプトがありません";
          }
        }
      });

      generateButton.addEventListener(DOM_EVENTS.CLICK, () =>
        this.generatePrompt()
      );
    }

    // プレビューコピー
    const previewPositiveCopy = document.getElementById(
      "preview-positive-copy"
    );
    if (previewPositiveCopy) {
      previewPositiveCopy.addEventListener(DOM_EVENTS.CLICK, () => {
        const previewPrompt = document.getElementById("preview-prompt");
        if (previewPrompt) {
          navigator.clipboard.writeText(previewPrompt.value);
        }
      });
    }

    const previewNegativeCopy = document.getElementById(
      "preview-negative-copy"
    );
    if (previewNegativeCopy) {
      previewNegativeCopy.addEventListener(DOM_EVENTS.CLICK, () => {
        const negativePrompt = document.getElementById("negative-prompt");
        if (negativePrompt) {
          navigator.clipboard.writeText(negativePrompt.value);
        }
      });
    }

    // ダウンロードボタンは辞書タブで処理

    // リセット
    const resetButton = document.getElementById(DOM_IDS.BUTTONS.RESET);
    if (resetButton) {
      resetButton.addEventListener(DOM_EVENTS.CLICK, () => {
        if (confirm(CONFIRM_MESSAGES.RESET_ALL_DATA)) {
          chrome.storage.local.clear(() => {
            location.reload();
          });
        }
      });
    }
  }

  copyPrompt() {
    navigator.clipboard.writeText(editPrompt.prompt);

    ErrorHandler.notify("プロンプトをコピーしました", {
      type: ErrorHandler.NotificationType.TOAST,
      duration: 1500,
      messageType: "success",
    });
  }

  async clearPrompt() {
    // editPromptを完全にリセット（要素配列もクリア）
    editPrompt.init("");

    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (generatePrompt) {
      generatePrompt.value = "";
    }
    savePrompt();

    // 現在のスロットも更新（初期化後のみ）
    if (window.promptEditor && window.promptSlotManager) {
      await promptSlotManager.saveCurrentSlot();
      
      // Clear後のスロット状態を確認
      const currentSlot = promptSlotManager.slots[promptSlotManager.currentSlot];
      if (currentSlot) {
        console.log("🗑️ [CLEAR_PROMPT] 現在のスロットをクリアしました:", {
          slotId: currentSlot.id,
          prompt: currentSlot.prompt || '空',
          isUsed: currentSlot.isUsed
        });
      }
    }

    // スロットタブのUIも更新
    if (window.promptSlotManager) {
      // スロットタブの現在のスロットカードを更新
      promptSlotManager.updateUI();
      
      // スロットタブが表示されている場合は、現在のスロットカードの表示も更新
      if (window.app?.tabs?.slot) {
        const slotTab = window.app.tabs.slot;
        if (typeof slotTab.updateDisplay === 'function') {
          console.log("🗑️ [CLEAR_PROMPT] スロットタブの表示を更新");
          slotTab.updateDisplay();
        }
      }
    }

    // ListRefreshManagerで統一されたリフレッシュ処理
    try {
      await ListRefreshManager.executeAction(
        ListRefreshManager.ACTIONS.PROMPT_CHANGE,
        {
          context: {
            newPrompt: "",
            source: "clear_button",
          },
          delay: 0, // 即座実行
        }
      );
    } catch (error) {
      console.error("ListRefreshManager error on prompt clear:", error);
    }
  }

  async favoriteList() {
    const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    const prompt = generatePrompt ? generatePrompt.value : "";

    if (!prompt) {
      ErrorHandler.notify("プロンプトが入力されていません");
      return;
    }

    // 現在の辞書を取得
    const currentDictId = AppState.data.currentPromptDictionary || "main";
    const currentDict = AppState.data.promptDictionaries?.[currentDictId];

    if (!currentDict) {
      ErrorHandler.notify("辞書が選択されていません");
      return;
    }

    // プロンプト配列の初期化確認（prompts プロパティを使用）
    if (!currentDict.prompts) {
      currentDict.prompts = [];
    }

    const validation = Validators.checkDuplicateFavorite(
      prompt,
      currentDict.prompts
    );
    if (!validation.isValid) {
      ErrorHandler.notify(validation.message);
      return;
    }

    // 新しいアイテムにIDとソート番号を設定
    const newFavoriteItem = {
      id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: "",
      prompt: prompt,
      sort: currentDict.prompts.length,
    };
    currentDict.prompts.push(newFavoriteItem);
    await savePromptDictionaries();

    // 辞書タブが存在する場合は常にリフレッシュ処理を実行
    console.log("Checking for dictionary tab update...", {
      hasDictionaryTab: !!this.tabs.dictionary,
      currentTab: AppState.ui.currentTab,
      isDictionaryActive: AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY,
      promptDictionaryOpen: this.tabs.dictionary?.dictionaryStates?.prompt,
    });

    if (this.tabs.dictionary) {
      console.log("Dictionary tab exists, updating...");

      // 統計情報を即座に更新
      console.log("Updating dictionary stats...");
      this.tabs.dictionary.updateStats();

      // 辞書タブがアクティブな場合は必ずリストを更新（開閉状態に関係なく）
      if (AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
        console.log("Dictionary tab is active, forcing favorite list refresh...");
        try {
          await this.tabs.dictionary.refreshFavoriteList();
          console.log("Favorite list refresh completed successfully");
        } catch (error) {
          console.error("Error during favorite list refresh:", error);
        }
      } else {
        console.log("Dictionary tab exists but not active, stats updated only");
      }

      // 遅延を入れて再度更新（データの保存完了を確実にするため）
      setTimeout(async () => {
        console.log("Delayed update check...");
        this.tabs.dictionary.updateStats();
        // 辞書タブがアクティブな場合は再度リスト更新
        if (AppState.ui.currentTab === CONSTANTS.TABS.DICTIONARY) {
          try {
            console.log("Delayed favorite list refresh...");
            await this.tabs.dictionary.refreshFavoriteList();
            console.log("Delayed favorite list refresh completed");
          } catch (error) {
            console.error("Error during delayed favorite list refresh:", error);
          }
        }
      }, 300); // 遅延時間を300msに増加してデータ保存完了を確実にする

      console.log("Dictionary tab updated after favorite save");
    } else {
      console.log("Dictionary tab not available, skipping update");
    }

    // 明示的にバックグラウンドに通知（念のため）
    setTimeout(() => {
      chrome.runtime.sendMessage(
        { type: CHROME_MESSAGES.UPDATE_PROMPT_LIST },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to notify background:",
              chrome.runtime.lastError
            );
          } else {
            console.log("Background notified of favorite update");
          }
        }
      );
    }, 200);

    // 成功通知
    ErrorHandler.notify("プロンプトを辞書に追加しました", {
      type: ErrorHandler.NotificationType.TOAST,
      duration: 1500,
      messageType: "success",
    });
  }

  async generatePrompt() {
    // 自動ジェネレート中の内部クリックかチェック
    const isAutoGenerateClick = window.autoGenerateHandler?.isInternalClick;
    
    // セレクター検証（手動Generate時のみ実行）
    if (!isAutoGenerateClick) {
      const hasSelectors =
        AppState.selector.positiveSelector && AppState.selector.generateSelector;
      
      if (!hasSelectors) {
        ErrorHandler.notify("セレクターが正しく設定されていない可能性があります。その他タブの「セレクター設定」でプロンプト入力欄とGenerateボタンのセレクターが有効かどうか確認してみてください。", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "warning",
          duration: NOTIFICATION_DURATION.LONG,
        });
        return;
      }
      
      // セレクターの有効性を実際にチェック
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        
        if (tab) {
          // コンテンツスクリプトを注入
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["js/content.js"],
            });
          } catch (injectError) {
            console.log("Content script injection:", injectError.message);
          }

          // プロンプト入力欄のセレクターをチェック
          const positiveResponse = await chrome.tabs.sendMessage(tab.id, {
            action: "validateSelector",
            selector: AppState.selector.positiveSelector,
          });

          // Generateボタンのセレクターをチェック
          const generateResponse = await chrome.tabs.sendMessage(tab.id, {
            action: "validateSelector",
            selector: AppState.selector.generateSelector,
          });

          // どちらかが無効な場合はトーストを表示
          if (!positiveResponse?.valid || !generateResponse?.valid) {
            ErrorHandler.notify("セレクターが正しく設定されていない可能性があります。その他タブの「セレクター設定」でプロンプト入力欄とGenerateボタンのセレクターが有効かどうか確認してみてください。", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "warning",
              duration: NOTIFICATION_DURATION.LONG,
            });
            return;
          }
        }
      } catch (error) {
        console.log("セレクター検証でエラー:", error);
        ErrorHandler.notify("セレクターが正しく設定されていない可能性があります。その他タブの「セレクター設定」でプロンプト入力欄とGenerateボタンのセレクターが有効かどうか確認してみてください。", {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "warning",
          duration: NOTIFICATION_DURATION.LONG,
        });
        return;
      }
    }

    // 自動生成中で、かつ手動クリックの場合は停止
    if (
      window.autoGenerateHandler &&
      window.autoGenerateHandler.isRunning &&
      !window.autoGenerateHandler.isInternalClick
    ) {
      window.autoGenerateHandler.stop();
      return;
    }

    // 抽出モード状態をチェック
    const hasExtractionSlots = promptSlotManager.slots.some(
      (slot) => slot.mode === "random" || slot.mode === "sequential"
    );

    // 履歴プロンプトがある場合はそれを使用、なければ通常のスロット結合
    let targetPrompt;
    let usedSlots = [];

    if (
      window.autoGenerateHandler &&
      window.autoGenerateHandler.historyPrompt
    ) {
      // 履歴プロンプトを使用
      targetPrompt = window.autoGenerateHandler.historyPrompt;
      console.log("Generating with history prompt:", targetPrompt);
    } else {
      // 通常のスロット結合を使用（これが抽出処理を実行）
      targetPrompt = promptSlotManager.getCombinedPrompt();
      usedSlots = promptSlotManager.getUsedSlots();
      console.log("Generating with combined prompt from slots:", usedSlots);
    }

    if (!targetPrompt) {
      ErrorHandler.notify("使用中のプロンプトがありません", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "warning",
      });
      return;
    }

    // プロンプトで生成
    sendBackground(
      CHROME_MESSAGES.DOM_GENERATE,
      "Generate",
      targetPrompt,
      AppState.selector.positiveSelector,
      AppState.selector.generateSelector
    );

    // 通知（オプション）
    if (
      window.autoGenerateHandler &&
      window.autoGenerateHandler.historyPrompt
    ) {
      ErrorHandler.notify("履歴プロンプトで生成します", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "info",
        duration: 2000,
      });
    } else {
      ErrorHandler.notify(
        `${usedSlots.length}個のスロットを結合して生成します`,
        {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "info",
          duration: 2000,
        }
      );
    }

    // Generate履歴への追加はsendBackground内で自動実行される

    // 追加：スロットタブが開いている場合、表示を更新
    if (AppState.ui.currentTab === CONSTANTS.TABS.SLOT && this.tabs.slot) {
      // 少し遅延を入れて、抽出処理が完了してから更新
      setTimeout(() => {
        this.tabs.slot.refreshExtractionDisplays();
      }, 100);
    }
  }

  // ============================================

  // ============================================

  setupOptionHandlers() {
    const isDeleteCheck = document.getElementById(DOM_IDS.OTHER.DELETE_CHECK);
    if (isDeleteCheck) {
      isDeleteCheck.addEventListener(DOM_EVENTS.CHANGE, (e) => {
        AppState.userSettings.optionData.isDeleteCheck = e.target.checked;
        saveOptionData();
      });
    }

    const deeplAuth = document.getElementById(DOM_IDS.OTHER.DEEPL_AUTH);
    if (deeplAuth) {
      deeplAuth.addEventListener(DOM_EVENTS.CHANGE, (e) => {
        const apiKey = e.target.value;
        const validation = Validators.validateApiKey(apiKey, "DeepL");

        if (!validation.isValid) {
          ErrorHandler.showInlineError("#DeeplAuth", validation.message);
          return;
        }

        AppState.userSettings.optionData.deeplAuthKey = apiKey;
        saveOptionData();
      });
    }

    // Generate履歴最大保持件数の設定
    const historyMaxSize = document.getElementById("historyMaxSize");
    if (historyMaxSize) {
      historyMaxSize.addEventListener(DOM_EVENTS.CHANGE, (e) => {
        const maxSize = parseInt(e.target.value);

        // バリデーション
        if (isNaN(maxSize) || maxSize < 10 || maxSize > 200) {
          ErrorHandler.notify(
            "最大保持件数は10-200件の範囲で設定してください",
            {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "warning",
              duration: 3000,
            }
          );

          // デフォルト値に戻す
          e.target.value =
            AppState.userSettings.optionData.historyMaxSize || 50;
          return;
        }

        AppState.userSettings.optionData.historyMaxSize = maxSize;
        saveOptionData();

        // 履歴マネージャーに設定を反映
        if (this.historyManager) {
          this.historyManager.updateMaxSize(maxSize);
        }

        ErrorHandler.notify(`履歴の最大保持件数を${maxSize}件に設定しました`, {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "success",
          duration: 2000,
        });
      });
    }

    // 通知設定は設定モーダルに移動済み

    // 設定エクスポート
    const exportSettingsBtn = document.getElementById("exportSettings");
    if (exportSettingsBtn) {
      exportSettingsBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        settingsManager.downloadExport();
      });
    }

    // 設定インポート
    const importSettingsBtn = document.getElementById("importSettings");
    if (importSettingsBtn) {
      importSettingsBtn.addEventListener(DOM_EVENTS.CLICK, () => {
        const mergeMode = document.getElementById("importMergeMode").checked;

        settingsManager.selectAndImport({
          includeSettings: true,
          includeLocalDict: true,
          includeFavorits: true,
          includeCategories: true,
          includeMaster: false, // マスターデータは通常除外
          merge: mergeMode,
        });
      });
    }
  }

  // ============================================
  // ソート可能なリスト
  // ============================================
  setupSortableLists() {
    // 編集リストのソート
    EventHandlers.setupSortableList(
      DOM_SELECTORS.BY_ID.EDIT_LIST,
      (sortedIds) => {
        let baseIndex = 0;
        sortedIds.forEach((id) => {
          if (!id) return;
          editPrompt.elements[id].sort = baseIndex++;
        });
        editPrompt.generate();
        this.updatePromptDisplay();
      }
    );
  }

  // ============================================

  // ============================================

  updateUIState() {
    // GenerateボタンON表示の更新（UIタイプ制限を削除）
    if (
      AppState.selector.positiveSelector != null &&
      AppState.selector.generateSelector != null
    ) {
      const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
      if (generateButton) {
        generateButton.style.display = "block";
      }
    }
  }

  /**
   * 抽出モード用のGeneratePrompt更新
   */
  updateGeneratePromptForExtraction() {
    try {
      const generatePrompt = document.getElementById("generatePrompt");
      if (generatePrompt) {
        // 現在のスロットの情報のみを表示
        const currentSlotInfo = this.getCurrentSlotExtractionInfo();
        generatePrompt.value = currentSlotInfo;
        generatePrompt.readOnly = true;
        generatePrompt.title =
          "抽出モードで生成されたプロンプト（読み取り専用）";

        console.log(
          "[Main] GeneratePromptを現在のスロット情報で更新しました:",
          currentSlotInfo
        );

        // 編集タブが存在し、抽出モードの場合はそちらも更新
        if (
          this.tabs &&
          this.tabs.edit &&
          this.tabs.edit.extractionModeActive
        ) {
          this.tabs.edit.setGeneratePromptExtractionMode();
        }
      }
    } catch (error) {
      console.error("[Main] GeneratePrompt抽出モード更新中にエラー:", error);
    }
  }

  /**
   * 現在のスロットの抽出情報を取得
   * @returns {string} 現在のスロットの抽出情報
   */
  getCurrentSlotExtractionInfo() {
    try {
      if (!window.promptSlotManager || !window.promptSlotManager.slots) {
        return "";
      }

      const currentSlot =
        window.promptSlotManager.slots[window.promptSlotManager.currentSlot];
      if (!currentSlot) {
        return "";
      }

      // 抽出モードの場合は抽出結果を表示
      if (currentSlot.mode === "random" || currentSlot.mode === "sequential") {
        if (currentSlot.currentExtraction) {
          // 重み付きプロンプト記法を適用
          return window.promptSlotManager.applyWeightToPrompt(
            currentSlot.currentExtraction,
            currentSlot.weight
          );
        } else {
          return "[抽出待機中]";
        }
      }

      // 単一モードの場合はスペース区切りで表示
      if (currentSlot.mode === "single") {
        if (currentSlot.currentExtraction) {
          // カンマをスペースに置換して重み付きプロンプト記法を適用
          const spaceConverted = currentSlot.currentExtraction.replace(/,/g, ' ');
          return window.promptSlotManager.applyWeightToPrompt(
            spaceConverted,
            currentSlot.weight
          );
        } else {
          return "[抽出待機中]";
        }
      }

      // 通常モードの場合は通常のプロンプト
      return currentSlot.prompt || "";
    } catch (error) {
      console.error("[Main] 現在のスロット情報取得中にエラー:", error);
      return "";
    }
  }

  // 通知設定は設定モーダルに移動済み（other-tab.js内でハンドリング）

  /**
   * 設定値をUIに反映
   */
  updateSettingsUI() {
    // 削除確認チェックボックス
    const isDeleteCheck = document.getElementById(DOM_IDS.OTHER.DELETE_CHECK);
    if (isDeleteCheck) {
      isDeleteCheck.checked =
        AppState.userSettings.optionData.isDeleteCheck !== false;
    }

    // DeepL APIキー
    const deeplAuth = document.getElementById(DOM_IDS.OTHER.DEEPL_AUTH);
    if (deeplAuth) {
      deeplAuth.value = AppState.userSettings.optionData.deeplAuthKey || "";
    }

    // プロンプト重複警告チェックボックス
    const checkPromptConflict = document.getElementById("checkPromptConflict");
    if (checkPromptConflict) {
      checkPromptConflict.checked =
        AppState.userSettings.optionData.checkPromptConflict === true;
    }

    // Generate履歴最大保持件数
    const historyMaxSize = document.getElementById("historyMaxSize");
    if (historyMaxSize) {
      historyMaxSize.value =
        AppState.userSettings.optionData.historyMaxSize || 50;
    }

    // 通知設定は設定モーダルに移動済み
  }

  // ============================================
  // 終了時の処理
  // ============================================
  setupCloseHandlers() {
    // ページを閉じる/リロードする前に現在のスロットを保存
    window.addEventListener("beforeunload", async () => {
      console.log("Saving current slot before close...");
      if (window.promptEditor && window.promptSlotManager) {
        await promptSlotManager.saveCurrentSlot();
      }
    });

    // 拡張機能のポップアップが閉じられる時
    window.addEventListener("unload", async () => {
      console.log("Extension closing, saving state...");
      if (window.promptEditor && window.promptSlotManager) {
        await promptSlotManager.saveCurrentSlot();
      }
    });

    // visibility change でも保存（念のため）
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) {
        console.log("Page hidden, saving current slot...");
        if (window.promptEditor && window.promptSlotManager) {
          await promptSlotManager.saveCurrentSlot();
        }
      }
    });
  }
}

// ============================================

// ============================================

if (document.readyState === "loading") {
  document.addEventListener(DOM_EVENTS.DOM_CONTENT_LOADED, async () => {
    try {
      // グローバルアプリケーションインスタンス
      window.app = new PromptGeneratorApp();
      await window.app.init();

      // EditElementManager の初期化
      window.editElementManager = new EditElementManager(window.app);
      console.log('[MAIN] EditElementManager initialized');

      // FlexibleElementManager の初期化（辞書タブなどで使用）
      if (window.FlexibleElementManager) {
        window.flexibleElementManager = new FlexibleElementManager(window.app.listManager);
        console.log('[MAIN] FlexibleElementManager initialized');
      } else {
        console.warn('[MAIN] FlexibleElementManager not available');
      }

      console.log("Prompt Generator initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      alert(
        "アプリケーションの初期化に失敗しました。ページを再読み込みしてください。"
      );
    }
  });
} else {
  // 既にDOMが読み込まれている場合
  (async () => {
    try {
      window.app = new PromptGeneratorApp();
      await window.app.init();

      // EditElementManager の初期化
      window.editElementManager = new EditElementManager(window.app);
      console.log('[MAIN] EditElementManager initialized');

      // FlexibleElementManager の初期化（辞書タブなどで使用）
      if (window.FlexibleElementManager) {
        window.flexibleElementManager = new FlexibleElementManager(window.app.listManager);
        console.log('[MAIN] FlexibleElementManager initialized');
      } else {
        console.warn('[MAIN] FlexibleElementManager not available');
      }

      console.log("Prompt Generator initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      alert(
        "アプリケーションの初期化に失敗しました。ページを再読み込みしてください。"
      );
    }
  })();
}
