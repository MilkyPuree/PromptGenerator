/**
 * other-tab.js - その他タブモジュール
 * 既存のセレクター処理を拡張してビジュアルセレクター機能を追加
 */

(function () {
  "use strict";

  function defineOtherTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineOtherTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    class OtherTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "noticeBody",
          tabButtonId: "noticeTab",
          tabIndex: 4,
        });

        this.fileHandler = null;
        this.visualSelectorState = {
          mode: "inactive",
          targetInputId: null,
        };

        // メッセージハンドラーを保存（重複登録を防ぐため）
        this.boundSelectorMessageHandler = null;

        // サイト編集状態
        this.editingSiteId = null;

        // アコーディオン状態管理
        this.sectionStates = {
          selector: true, // セレクター設定（デフォルト開）
          "site-management": false, // サイト管理
          "file-management": false, // ファイル管理
          "shortcut-help": false, // ショートカットヘルプ
        };

        // 設定モーダル
        this.settingsModal = null;
      }

      async onInit() {
        this.fileHandler = this.app.fileHandler || new FileHandler();
        this.setupEventListeners();
        await this.loadNotice();
        await this.initializeSelectorUI();

        // 自動Generate機能の初期化を追加
        this.initializeAutoGenerate();

        // アコーディオン状態の初期化
        await this.initializeSectionStates();

        // サイト管理モーダルの初期化
        this.initSiteManagementModal();

        // 設定モーダルの初期化
        this.initSettingsModal();

        console.log("OtherTab initialized");
      }

      async onShow() {
        const tabButton = this.getElement(`#${this.tabButtonId}`);
        if (tabButton && tabButton.classList.contains("is-alert")) {
          tabButton.classList.remove("is-alert");
        }
        // 現在のセレクター情報を表示
        await this.refreshSelectorDisplay();

        // サイトリストを更新
        this.refreshSiteList();

        // 自動Generate機能の再初期化は不要（初期化時に一度だけ実行済み）
        // this.initializeAutoGenerate(); // 多重登録の原因となるため削除
      }

      setupEventListeners() {
        this.setupAccordionEventListeners();
        this.setupSelectorEventListeners();
        this.setupSiteManagementEventListeners();
        this.setupSettingsEventListeners();
        this.setupDragDrop();

        // サイト管理モーダル表示ボタン
        const showSiteManagementBtn = this.getElement("#showSiteManagement");
        if (showSiteManagementBtn) {
          this.addEventListener(showSiteManagementBtn, "click", () => {
            this.showSiteManagementModal();
          });
        }

        // 設定モーダル表示ボタン
        const openSettingsModalBtn = this.getElement("#openSettingsModal");
        if (openSettingsModalBtn) {
          this.addEventListener(openSettingsModalBtn, "click", () => {
            this.showSettingsModal();
          });
        }
      }

      // アコーディオン機能のイベントリスナー
      setupAccordionEventListeners() {
        // アコーディオンヘッダーのクリックイベント
        document
          .querySelectorAll(".dictionary-clickable-header")
          .forEach((header) => {
            this.addEventListener(header, "click", (e) => {
              const section = header.dataset.section;
              if (section) {
                this.toggleSection(section);
              }
            });
          });
      }

      // セクションの開閉を切り替え
      toggleSection(sectionName) {
        const header = document.querySelector(
          `[data-section="${sectionName}"]`
        );
        const container = document.querySelector(
          `[data-section-content="${sectionName}"]`
        );

        if (!header || !container) return;

        // 状態を切り替え
        this.sectionStates[sectionName] = !this.sectionStates[sectionName];
        const isExpanded = this.sectionStates[sectionName];

        // UI更新
        header.dataset.expanded = isExpanded.toString();

        if (isExpanded) {
          container.classList.add("expanded");
          container.style.setProperty("--container-max-height", "1000px");
        } else {
          container.classList.remove("expanded");
        }

        // 状態を保存
        this.saveSectionStates();
      }

      // セクション状態を初期化
      async initializeSectionStates() {
        // 保存された状態を読み込み
        await this.loadSectionStates();

        // 各セクションの状態を適用
        Object.keys(this.sectionStates).forEach((sectionName) => {
          const header = document.querySelector(
            `[data-section="${sectionName}"]`
          );
          const container = document.querySelector(
            `[data-section-content="${sectionName}"]`
          );

          if (header && container) {
            const isExpanded = this.sectionStates[sectionName];
            header.dataset.expanded = isExpanded.toString();

            if (isExpanded) {
              container.classList.add("expanded");
              container.style.setProperty("--container-max-height", "1000px");
            } else {
              container.classList.remove("expanded");
            }
          }
        });
      }

      // セクション状態を保存
      saveSectionStates() {
        try {
          chrome.storage.local.set({
            otherTabSectionStates: this.sectionStates,
          });
        } catch (error) {
          console.error("Failed to save section states:", error);
        }
      }

      // セクション状態を読み込み
      async loadSectionStates() {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(["otherTabSectionStates"], resolve);
          });

          if (result.otherTabSectionStates) {
            this.sectionStates = {
              ...this.sectionStates,
              ...result.otherTabSectionStates,
            };
          }
        } catch (error) {
          console.error("Failed to load section states:", error);
        }
      }

      // セレクター関連のイベントリスナー
      setupSelectorEventListeners() {
        // サービス選択ドロップダウン
        const serviceSelect = this.getElement(
          DOM_SELECTORS.BY_ID.SELECTOR_SERVICE
        );
        if (serviceSelect) {
          this.addEventListener(serviceSelect, "change", async (e) => {
            await this.onServiceSelected(e.target.value);
          });
        }

        // ビジュアル選択ボタン
        document.querySelectorAll(".visual-select-btn").forEach((btn) => {
          this.addEventListener(btn, "click", (e) => {
            const targetId = e.currentTarget.dataset.target;
            this.toggleVisualSelector(targetId, e.currentTarget);
          });
        });

        // アクションボタン（保存・クリアボタンは削除済み）

        // セレクター入力フィールドの変更監視
        ["selector-positive", "selector-generate"].forEach((id) => {
          const input = this.getElement(`#${id}`);
          if (input) {
            this.addEventListener(input, "input", () => {
              this.validateSelector(id, input.value);
            });
          }
        });
      }

      // サイト管理関連のイベントリスナー
      setupSiteManagementEventListeners() {
        // サイト追加ボタン
        const addSiteBtn = this.getElement(`#${DOM_IDS.BUTTONS.ADD_SITE}`);
        if (addSiteBtn) {
          this.addEventListener(addSiteBtn, "click", () => this.addSite());
        }

        // キャンセルボタン
        const cancelBtn = this.getElement(`#${DOM_IDS.BUTTONS.CANCEL_EDIT}`);
        if (cancelBtn) {
          this.addEventListener(cancelBtn, "click", () => this.exitEditMode());
        }

        // ビジュアルセレクターボタン（追加フォーム用）
        document.querySelectorAll(".visual-select-btn").forEach((btn) => {
          const target = btn.dataset.target;
          if (
            target === "add-site-positive" ||
            target === "add-site-generate"
          ) {
            this.addEventListener(btn, "click", (e) => {
              const targetId = e.currentTarget.dataset.target;
              this.toggleVisualSelector(targetId, e.currentTarget);
            });
          }
        });
      }

      // 設定関連のイベントリスナー（既存の処理を維持）
      setupSettingsEventListeners() {
        // 既存の設定処理はそのまま維持
        const isDeleteCheck = this.getElement(DOM_SELECTORS.BY_ID.DELETE_CHECK);
        if (isDeleteCheck) {
          // 既存の処理を維持
        }

        const deeplAuth = this.getElement(DOM_SELECTORS.BY_ID.DEEPL_AUTH);
        if (deeplAuth) {
          // 既存の処理を維持
        }

        // その他の設定も同様
      }

      // セレクターUIの初期化
      async initializeSelectorUI() {
        // 現在のURLからサービスを判定
        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tab && tab.url) {
            // 組み込みサービスをチェック
            for (const [key, service] of Object.entries(
              AppState.selector.serviceSets
            )) {
              if (service.url && tab.url.includes(service.url)) {
                const serviceSelect = this.getElement(
                  DOM_SELECTORS.BY_ID.SELECTOR_SERVICE
                );
                if (serviceSelect) {
                  serviceSelect.value = key;
                  this.onServiceSelected(key);
                }
                break;
              }
            }

            // カスタムサイトもチェック
            for (const [key, service] of Object.entries(
              AppState.selector.customSites
            )) {
              if (service.url && tab.url.includes(service.url)) {
                const serviceSelect = this.getElement(
                  DOM_SELECTORS.BY_ID.SELECTOR_SERVICE
                );
                if (serviceSelect) {
                  serviceSelect.value = key;
                  this.onServiceSelected(key);
                }
                break;
              }
            }
          }
        } catch (error) {
          console.log("Could not detect current service");
        }

        // 既存のセレクターを表示
        await this.refreshSelectorDisplay();

        // サービス選択ドロップダウンを更新
        this.updateServiceSelector();

        // サイトリスト表示の初期化
        this.refreshSiteList();
      }

      // サービスが選択されたときの処理
      async onServiceSelected(serviceKey) {
        if (!serviceKey || serviceKey === "custom") {
          // カスタムの場合は何もしない
          return;
        }

        // 最新のセレクター情報をストレージから読み込む
        await loadSelectors();

        // 組み込みサービスまたはカスタムサイトを検索
        let service = AppState.selector.serviceSets[serviceKey];
        if (!service) {
          service = AppState.selector.customSites[serviceKey];
        }

        if (!service) {
          return;
        }

        // セレクターフィールドに値を設定
        const positiveInput = this.getElement(
          DOM_SELECTORS.BY_ID.SELECTOR_POSITIVE
        );
        const generateInput = this.getElement(
          DOM_SELECTORS.BY_ID.SELECTOR_GENERATE
        );

        // 保存された値があればそれを優先、なければサービスのデフォルト値を使用
        const positiveSelector = service.positiveSelector || "";
        const generateSelector = service.generateSelector || "";

        if (positiveInput) {
          positiveInput.value = positiveSelector;
          this.validateSelector("selector-positive", positiveSelector);
        }

        if (generateInput) {
          generateInput.value = generateSelector;
          this.validateSelector("selector-generate", generateSelector);
        }

        // AppStateを更新（保存された値を反映）
        AppState.selector.positiveSelector = positiveSelector;
        AppState.selector.generateSelector = generateSelector;
      }

      // 現在のセレクター情報を表示
      async refreshSelectorDisplay() {
        try {
          // まずストレージから読み込む
          await loadSelectors(); // ← この行を追加

          const positiveSelector = AppState.selector.positiveSelector;
          const generateSelector = AppState.selector.generateSelector;

          if (positiveSelector) {
            const input = this.getElement(
              DOM_SELECTORS.BY_ID.SELECTOR_POSITIVE
            );
            if (input) {
              input.value = positiveSelector;
              this.validateSelector("selector-positive", positiveSelector);
            }
          }

          if (generateSelector) {
            const input = this.getElement(
              DOM_SELECTORS.BY_ID.SELECTOR_GENERATE
            );
            if (input) {
              input.value = generateSelector;
              this.validateSelector("selector-generate", generateSelector);
            }
          }
        } catch (error) {
          console.error("Failed to refresh selector display:", error);
        }
      }

      // ビジュアルセレクターの切り替え
      async toggleVisualSelector(targetId, button) {
        if (this.visualSelectorState.mode === "selecting") {
          this.endVisualSelection();
          button.classList.remove("active");
        } else {
          button.classList.add("active");
          button.style.background = "#dc3545";
          button.style.color = "white";
          this.startVisualSelection(targetId);
        }
      }

      // ビジュアル選択モードを開始
      async startVisualSelection(targetId) {
        this.visualSelectorState.mode = "selecting";
        this.visualSelectorState.targetInputId = targetId;

        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab) return;

        try {
          // 既存のリスナーがあれば削除
          if (this.boundSelectorMessageHandler) {
            chrome.runtime.onMessage.removeListener(
              this.boundSelectorMessageHandler
            );
          }

          // 新しいリスナーを作成して保存
          this.boundSelectorMessageHandler =
            this.handleSelectorMessage.bind(this);
          chrome.runtime.onMessage.addListener(
            this.boundSelectorMessageHandler
          );

          // コンテンツスクリプトを注入してからビジュアルセレクターを起動
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["js/content.js"],
            });
          } catch (injectError) {
            // 既に注入済みの場合のエラーは無視
            console.log("Content script injection:", injectError.message);
          }

          // content.jsのビジュアルセレクターを起動
          await chrome.tabs.sendMessage(tab.id, {
            action: "startVisualSelection",
          });

          ErrorHandler.notify(
            "要素をクリックして選択してください（ESCで終了）",
            {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
            }
          );
        } catch (error) {
          console.error("Failed to start visual selection:", error);
          ErrorHandler.notify("ビジュアルセレクターの開始に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          this.endVisualSelection();
        }
      }

      // セレクター選択メッセージの処理
      handleSelectorMessage(message, sender, sendResponse) {
        if (message.action === "selectorSelected") {
          const input = this.getElement(
            `#${this.visualSelectorState.targetInputId}`
          );
          if (input) {
            input.value = message.selector;

            // ビジュアルセレクターで選択された要素は確実に存在するので、通常の検証を実行
            setTimeout(() => {
              this.validateSelector(
                this.visualSelectorState.targetInputId,
                message.selector
              );
            }, 100);

            // AppStateに値を保存（メインセレクターの場合）
            if (
              this.visualSelectorState.targetInputId === "selector-positive"
            ) {
              AppState.selector.positiveSelector = message.selector;
            } else if (
              this.visualSelectorState.targetInputId === "selector-generate"
            ) {
              AppState.selector.generateSelector = message.selector;
            }
            // 追加フォームの場合は保存しない（フォーム送信時に保存）
          }
          this.endVisualSelection();

          // メインセレクターの場合はAppStateに直接保存
          if (
            this.visualSelectorState.targetInputId === "selector-positive"
          ) {
            AppState.selector.positiveSelector = message.selector;
          } else if (
            this.visualSelectorState.targetInputId === "selector-generate"
          ) {
            AppState.selector.generateSelector = message.selector;
          }
        } else if (message.action === "visualSelectionCanceled") {
          this.endVisualSelection();
        }
      }

      // ビジュアル選択モードを終了
      endVisualSelection() {
        this.visualSelectorState.mode = "inactive";

        // リスナーを削除
        if (this.boundSelectorMessageHandler) {
          chrome.runtime.onMessage.removeListener(
            this.boundSelectorMessageHandler
          );
          this.boundSelectorMessageHandler = null;
        }

        // ボタンの状態をリセット
        document.querySelectorAll(".visual-select-btn").forEach((btn) => {
          btn.classList.remove("active");
          btn.style.background = "";
          btn.style.color = "";
        });

        // content.jsに終了を通知
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs
              .sendMessage(tabs[0].id, {
                action: "endVisualSelection",
              })
              .catch(() => {});
          }
        });
      }

      // セレクターを検証
      async validateSelector(inputId, selector) {
        const statusId = inputId.replace("Selector", "Status");
        const statusElement = this.getElement(`#${statusId}`);

        if (!statusElement || !selector) return;

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!tab) return;

          // コンテンツスクリプトを注入
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["js/content.js"],
            });
          } catch (injectError) {
            // 既に注入済みの場合のエラーは無視
            console.log("Content script injection:", injectError.message);
          }

          // content.jsの既存の検証機能を使用
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "validateSelector",
            selector: selector,
          });

          if (response && response.valid) {
            statusElement.textContent = `✓ 要素が見つかりました (${response.count}個)`;
            statusElement.className = "selector-status valid";
            statusElement.style.display = "block";
          } else {
            statusElement.textContent = "✗ 要素が見つかりません";
            statusElement.className = "selector-status invalid";
            statusElement.style.display = "block";
          }
        } catch (error) {
          statusElement.textContent =
            "✗ 検証できません（ページを開いてください）";
          statusElement.className = "selector-status invalid";
          statusElement.style.display = "block";
        }
      }


      // Generateボタンの表示/非表示を更新
      updateGenerateButtonVisibility() {
        const genBtn = this.getElement(`#${DOM_IDS.BUTTONS.GENERATE}`);

        if (genBtn) {
          const hasSelectors =
            AppState.selector.positiveSelector &&
            AppState.selector.generateSelector;
          const showButton = hasSelectors;

          genBtn.style.display = showButton ? "block" : "none";

          // 自動Generate機能の表示も更新
          const autoGenerateOption = this.getElement("#autoGenerateOption");
          if (autoGenerateOption) {
            autoGenerateOption.style.display = showButton ? "block" : "none";
          }
        }
      }

      // 自動Generate機能の初期化
      initializeAutoGenerate() {
        // autoGenerateHandlerが存在する場合は初期化
        if (window.autoGenerateHandler) {
          autoGenerateHandler.init();
        }
      }

      // お知らせを読み込み
      async loadNotice() {
        // 既存の処理を維持
      }

      // ドラッグ&ドロップの設定（既存の処理を維持）
      setupDragDrop() {
        const inclued = this.getElement("#inclued");
        if (inclued && this.fileHandler) {
          console.log("Setting up drag and drop for file management");
          this.fileHandler.setupDragDrop(inclued);
        } else {
          console.warn(
            "Could not setup drag and drop - element or fileHandler not found"
          );
        }
      }

      clearPngPreview() {
        const preview = this.getElement("#preview");
        const pngInfo = this.getElement("#pngInfo");

        if (preview) {
          preview.src = "";
          preview.style.display = "none";
        }

        if (pngInfo) {
          pngInfo.innerHTML = "";
        }
      }

      async onRefresh() {
        await this.refreshSelectorDisplay();
        this.refreshSiteList();
      }

      // ============================================
      // サイト管理機能
      // ============================================

      // サイトリストを更新表示
      refreshSiteList() {
        const siteListContainer = this.getElement("#siteList");
        if (!siteListContainer) return;

        const allSites = getAllSites();
        const siteKeys = Object.keys(allSites);

        if (siteKeys.length === 0) {
          siteListContainer.innerHTML =
            '<div class="site-list-empty">登録済みサイトがありません</div>';
          return;
        }

        const siteItems = siteKeys
          .map((key) => {
            const site = allSites[key];
            const isBuiltIn = site.isBuiltIn || false;

            return `
            <div class="site-item ${
              isBuiltIn ? "built-in" : ""
            }" data-site-id="${key}">
              <div class="site-item-header">
                <span class="site-item-name">${site.name}</span>
                <span class="site-item-badge ${
                  isBuiltIn ? "built-in" : "custom"
                }">
                  ${isBuiltIn ? "組み込み" : "カスタム"}
                </span>
              </div>
              <div class="site-item-url">${site.url || "設定なし"}</div>
              <div class="site-item-selectors">
                <div class="site-item-selector">
                  <div class="site-item-selector-label">プロンプト入力欄:</div>
                  <div class="site-item-selector-value">${
                    site.positiveSelector || "未設定"
                  }</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">Generateボタン:</div>
                  <div class="site-item-selector-value">${
                    site.generateSelector || "未設定"
                  }</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">入力後遅延:</div>
                  <div class="site-item-selector-value">${
                    site.inputDelay || 0
                  }ms</div>
                </div>
              </div>
              <div class="site-item-actions">
                ${
                  !isBuiltIn
                    ? `
                  <button class="site-action-btn edit" onclick="window.app.tabs.other.editSite('${key}')">
                    <span>✏️</span> 編集
                  </button>
                  <button class="site-action-btn delete" onclick="window.app.tabs.other.deleteSite('${key}')">
                    <span>🗑️</span> 削除
                  </button>
                `
                    : `
                  <button class="site-action-btn edit" disabled title="組み込みサイトは編集できません">
                    <span>🔒</span> 組み込み
                  </button>
                `
                }
              </div>
            </div>
          `;
          })
          .join("");

        siteListContainer.innerHTML = siteItems;
      }

      // サイトを追加
      async addSite() {
        // 編集モードの場合は更新処理を実行
        if (this.editingSiteId) {
          return this.updateSite();
        }

        const name = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_NAME}`
        )?.value?.trim();
        const url = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_URL}`
        )?.value?.trim();
        const positiveSelector = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`
        )?.value?.trim();
        const generateSelector = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`
        )?.value?.trim();

        // バリデーション
        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        // URL形式チェック
        try {
          new URL(url);
        } catch {
          ErrorHandler.notify("正しいURL形式で入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        try {
          const siteData = {
            name,
            url,
            positiveSelector,
            generateSelector,
            inputDelay,
          };
          const siteId = await addCustomSite(siteData);

          // フォームをクリア
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`).value = "0";

          // サイトリストを更新
          this.refreshSiteList();

          // サービス選択ドロップダウンを更新
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を追加しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });

          console.log("Site added successfully:", siteId);
        } catch (error) {
          console.error("Failed to add site:", error);
          ErrorHandler.notify("サイトの追加に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      // サイトを削除
      async deleteSite(siteId) {
        const site = AppState.selector.customSites[siteId];
        if (!site) return;

        if (!confirm(`サイト「${site.name}」を削除しますか？`)) return;

        try {
          await deleteCustomSite(siteId);
          this.refreshSiteList();
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${site.name}」を削除しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          console.error("Failed to delete site:", error);
          ErrorHandler.notify("サイトの削除に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      // サイトを編集
      editSite(siteId) {
        const site = AppState.selector.customSites[siteId];
        if (!site) return;

        // 追加フォームに現在の値を設定
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`).value = site.name;
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`).value = site.url;
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`).value =
          site.positiveSelector || "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`).value =
          site.generateSelector || "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`).value =
          site.inputDelay || 0;

        // 一時的に編集モードに設定
        this.editingSiteId = siteId;

        // ボタンテキストを変更
        const addBtn = this.getElement(`#${DOM_IDS.BUTTONS.ADD_SITE}`);
        const cancelBtn = this.getElement(`#${DOM_IDS.BUTTONS.CANCEL_EDIT}`);
        if (addBtn) {
          addBtn.innerHTML = "<span>✏️</span> サイトを更新";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "flex";
        }

        // フォームまでスクロール
        const addSiteForm = document.querySelector(".add-site-form");
        if (addSiteForm) {
          addSiteForm.scrollIntoView({ behavior: "smooth" });
        }

        ErrorHandler.notify(`サイト「${site.name}」を編集モードにしました`, {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "info",
        });
      }

      // サイトを更新
      async updateSite() {
        if (!this.editingSiteId) return;

        const name = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_NAME}`
        )?.value?.trim();
        const url = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_URL}`
        )?.value?.trim();
        const positiveSelector = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`
        )?.value?.trim();
        const generateSelector = this.getElement(
          `#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`
        )?.value?.trim();
        const inputDelay =
          parseInt(
            this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`)?.value
          ) || 0;

        // バリデーション
        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        // URL形式チェック
        try {
          new URL(url);
        } catch {
          ErrorHandler.notify("正しいURL形式で入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        try {
          const siteData = {
            name,
            url,
            positiveSelector,
            generateSelector,
            inputDelay,
          };
          await updateCustomSite(this.editingSiteId, siteData);

          // 編集モードを終了
          this.exitEditMode();

          // サイトリストを更新
          this.refreshSiteList();
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を更新しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          console.error("Failed to update site:", error);
          ErrorHandler.notify("サイトの更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      // 編集モードを終了
      exitEditMode() {
        this.editingSiteId = null;

        // フォームをクリア
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`).value = "0";

        // ボタンを元に戻す
        const addBtn = this.getElement(`#${DOM_IDS.BUTTONS.ADD_SITE}`);
        const cancelBtn = this.getElement(`#${DOM_IDS.BUTTONS.CANCEL_EDIT}`);
        if (addBtn) {
          addBtn.innerHTML = "<span>➕</span> サイトを追加";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "none";
        }
      }

      // サービス選択ドロップダウンを更新
      updateServiceSelector() {
        const serviceSelect = this.getElement(
          DOM_SELECTORS.BY_ID.SELECTOR_SERVICE
        );
        if (!serviceSelect) return;

        const currentValue = serviceSelect.value;

        // 既存のカスタムオプションを削除
        const existingCustomOptions = serviceSelect.querySelectorAll(
          "option[data-custom]"
        );
        existingCustomOptions.forEach((option) => option.remove());

        // カスタムサイトを追加
        Object.keys(AppState.selector.customSites).forEach((key) => {
          const site = AppState.selector.customSites[key];
          const option = UIFactory.createOption({
            value: key,
            text: site.name,
          });
          option.setAttribute("data-custom", "true");
          serviceSelect.appendChild(option);
        });

        // 値を復元
        serviceSelect.value = currentValue;
      }

      setNoticeAlert(showAlert, message) {
        const tabButton = this.getElement(`#${this.tabButtonId}`);
        if (tabButton) {
          if (showAlert) {
            tabButton.classList.add("is-alert");
          } else {
            tabButton.classList.remove("is-alert");
          }
        }

        if (message) {
          const noticeElement = this.getElement(`#${DOM_IDS.OTHER.NOTICE}`);
          if (noticeElement) {
            noticeElement.innerHTML = message;
          }
        }
      }

      /**
       * サイト管理モーダルの初期化
       */
      initSiteManagementModal() {
        // BaseModalでサイト管理モーダルを作成
        this.siteManagementModal = BaseModal.create(
          "site-management-modal",
          "🌐 サイト管理",
          `
          <div class="site-management-modal-content">
            <!-- カスタムサイト追加フォーム -->
            <div class="add-site-form">
              <h4>新しいサイトを追加</h4>
              <div class="add-site-fields">
                <div class="field-group">
                  <label for="modal-add-site-name">サイト名:</label>
                  <input type="text" id="modal-add-site-name" placeholder="例: My Custom Site" class="site-input" title="管理用のサイト名を入力してください" />
                </div>
                <div class="field-group">
                  <label for="modal-add-site-url">URL:</label>
                  <input type="text" id="modal-add-site-url" placeholder="例: https://example.com" class="site-input" title="対象サイトのURLを入力してください（プロトコル必須）" />
                </div>
                <div class="field-group">
                  <label for="modal-add-site-positive">プロンプト入力欄セレクター:</label>
                  <div class="selector-control">
                    <input type="text" id="modal-add-site-positive" placeholder="例: #positive-prompt" class="site-input" title="プロンプトを入力するテキストエリアのCSSセレクターを指定" />
                    <button class="visual-select-btn" data-target="modal-add-site-positive" title="ビジュアル選択でセレクターを取得">👁</button>
                  </div>
                </div>
                <div class="field-group">
                  <label for="modal-add-site-generate">Generateボタンセレクター:</label>
                  <div class="selector-control">
                    <input type="text" id="modal-add-site-generate" placeholder="例: #generate-button" class="site-input" title="生成実行ボタンのCSSセレクターを指定" />
                    <button class="visual-select-btn" data-target="modal-add-site-generate" title="ビジュアル選択でセレクターを取得">👁</button>
                  </div>
                </div>
                <div class="field-group">
                  <label for="modal-add-site-delay">プロンプト入力後の遅延時間 (ミリ秒):</label>
                  <input type="number" id="modal-add-site-delay" placeholder="例: 1000" min="0" max="10000" value="0" class="site-input" title="プロンプト入力後、Generateボタンを押すまでの待機時間（ChatAIサイトなど、入力後にボタンが有効になるサイト用）" />
                  <small class="field-help">0 = 遅延なし、1000 = 1秒、ChatAIサイトには500-2000ms推奨</small>
                </div>
                <div class="add-site-actions">
                  <button id="modal-cancel-edit" class="action-btn cancel-btn" style="display: none;" title="編集をキャンセルして元の状態に戻します">
                    <span>❌</span> キャンセル
                  </button>
                  <button id="modal-add-site" class="action-btn add-btn" title="入力した内容でカスタムサイトを登録します">
                    <span>➕</span> サイトを追加
                  </button>
                </div>
              </div>
            </div>

            <!-- 既存サイト一覧 -->
            <div class="site-list">
              <h4>登録済みサイト</h4>
              <div id="modal-site-list" class="site-list-container">
                <!-- 動的に生成されるサイト一覧 -->
              </div>
            </div>
          </div>
        `,
          {
            closeOnBackdrop: true,
            closeOnEsc: true,
            showCloseButton: true,
            showHeader: true,
            showFooter: false,
          }
        );

        // モーダル表示時にサイトリストを更新
        this.siteManagementModal.onShow(() => {
          this.refreshModalSiteList();
          this.setupModalEventListeners();
        });
      }

      /**
       * サイト管理モーダルを表示
       */
      showSiteManagementModal() {
        this.siteManagementModal.show();
      }

      /**
       * モーダル内のサイトリストを更新
       */
      refreshModalSiteList() {
        const siteListContainer = document.getElementById("modal-site-list");
        if (!siteListContainer) return;

        const allSites = getAllSites();
        const siteKeys = Object.keys(allSites);

        if (siteKeys.length === 0) {
          siteListContainer.innerHTML =
            '<div class="site-list-empty">登録済みサイトがありません</div>';
          return;
        }

        const siteItems = siteKeys
          .map((key) => {
            const site = allSites[key];
            const isBuiltIn = site.isBuiltIn || false;

            return `
            <div class="site-item ${
              isBuiltIn ? "built-in" : ""
            }" data-site-id="${key}">
              <div class="site-item-header">
                <span class="site-item-name">${site.name}</span>
                <span class="site-item-badge ${
                  isBuiltIn ? "built-in" : "custom"
                }">
                  ${isBuiltIn ? "組み込み" : "カスタム"}
                </span>
              </div>
              <div class="site-item-url">${site.url || "設定なし"}</div>
              <div class="site-item-selectors">
                <div class="site-item-selector">
                  <div class="site-item-selector-label">プロンプト入力欄:</div>
                  <div class="site-item-selector-value">${
                    site.positiveSelector || "未設定"
                  }</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">Generateボタン:</div>
                  <div class="site-item-selector-value">${
                    site.generateSelector || "未設定"
                  }</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">入力後遅延:</div>
                  <div class="site-item-selector-value">${
                    site.inputDelay || 0
                  }ms</div>
                </div>
              </div>
              <div class="site-item-actions">
                ${
                  !isBuiltIn
                    ? `
                  <button class="site-action-btn edit" data-site-id="${key}" title="このサイトの設定を編集">
                    <span>✏️</span> 編集
                  </button>
                  <button class="site-action-btn delete" data-site-id="${key}" title="このサイトを削除">
                    <span>🗑️</span> 削除
                  </button>
                `
                    : `
                  <button class="site-action-btn edit" disabled title="組み込みサイトは編集できません">
                    <span>🔒</span> 組み込み
                  </button>
                `
                }
              </div>
            </div>
          `;
          })
          .join("");

        siteListContainer.innerHTML = siteItems;
      }

      /**
       * モーダル内のイベントリスナーを設定
       */
      setupModalEventListeners() {
        // 追加ボタン
        const addBtn = document.getElementById("modal-add-site");
        if (addBtn) {
          addBtn.addEventListener("click", () => this.handleModalAddSite());
        }

        // キャンセルボタン
        const cancelBtn = document.getElementById("modal-cancel-edit");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => this.cancelModalEdit());
        }

        // ビジュアルセレクターボタン
        document
          .querySelectorAll("#site-management-modal .visual-select-btn")
          .forEach((btn) => {
            btn.addEventListener("click", (e) => {
              const targetId = e.currentTarget.dataset.target;
              this.toggleVisualSelector(targetId, e.currentTarget);
            });
          });

        // 編集・削除ボタン
        document
          .querySelectorAll("#modal-site-list .site-action-btn")
          .forEach((btn) => {
            btn.addEventListener("click", (e) => {
              const siteId = e.currentTarget.dataset.siteId;
              if (e.currentTarget.classList.contains("edit")) {
                this.editModalSite(siteId);
              } else if (e.currentTarget.classList.contains("delete")) {
                this.deleteModalSite(siteId);
              }
            });
          });
      }

      /**
       * モーダル内でサイトを追加
       */
      async handleModalAddSite() {
        // 編集モードの場合は更新処理を実行
        if (this.editingSiteId) {
          return this.updateModalSite();
        }

        const name = document
          .getElementById("modal-add-site-name")
          ?.value?.trim();
        const url = document
          .getElementById("modal-add-site-url")
          ?.value?.trim();
        const positiveSelector = document
          .getElementById("modal-add-site-positive")
          ?.value?.trim();
        const generateSelector = document
          .getElementById("modal-add-site-generate")
          ?.value?.trim();
        const inputDelay =
          parseInt(document.getElementById("modal-add-site-delay")?.value) || 0;

        // バリデーション
        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        // URL形式チェック
        try {
          new URL(url);
        } catch {
          ErrorHandler.notify("正しいURL形式で入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        try {
          const siteData = {
            name,
            url,
            positiveSelector,
            generateSelector,
            inputDelay,
          };
          const siteId = await addCustomSite(siteData);

          // フォームをクリア
          document.getElementById("modal-add-site-name").value = "";
          document.getElementById("modal-add-site-url").value = "";
          document.getElementById("modal-add-site-positive").value = "";
          document.getElementById("modal-add-site-generate").value = "";
          document.getElementById("modal-add-site-delay").value = "0";

          // サイトリストを更新
          this.refreshModalSiteList();
          this.refreshSiteList(); // 元のリストも更新
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を追加しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });

          console.log("Site added successfully:", siteId);
        } catch (error) {
          console.error("Failed to add site:", error);
          ErrorHandler.notify("サイトの追加に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      /**
       * モーダル内でサイトを編集
       */
      editModalSite(siteId) {
        const site = AppState.selector.customSites[siteId];
        if (!site) return;

        // フォームに現在の値を設定
        document.getElementById("modal-add-site-name").value = site.name;
        document.getElementById("modal-add-site-url").value = site.url;
        document.getElementById("modal-add-site-positive").value =
          site.positiveSelector || "";
        document.getElementById("modal-add-site-generate").value =
          site.generateSelector || "";
        document.getElementById("modal-add-site-delay").value =
          site.inputDelay || 0;

        // 編集モードに設定
        this.editingSiteId = siteId;

        // ボタンテキストを変更
        const addBtn = document.getElementById("modal-add-site");
        const cancelBtn = document.getElementById("modal-cancel-edit");
        if (addBtn) {
          addBtn.innerHTML = "<span>✏️</span> サイトを更新";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "flex";
        }

        ErrorHandler.notify(`サイト「${site.name}」を編集モードにしました`, {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "info",
        });
      }

      /**
       * モーダル内でサイトを更新
       */
      async updateModalSite() {
        if (!this.editingSiteId) return;

        const name = document
          .getElementById("modal-add-site-name")
          ?.value?.trim();
        const url = document
          .getElementById("modal-add-site-url")
          ?.value?.trim();
        const positiveSelector = document
          .getElementById("modal-add-site-positive")
          ?.value?.trim();
        const generateSelector = document
          .getElementById("modal-add-site-generate")
          ?.value?.trim();
        const inputDelay =
          parseInt(document.getElementById("modal-add-site-delay")?.value) || 0;

        // バリデーション
        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

        try {
          const siteData = {
            name,
            url,
            positiveSelector,
            generateSelector,
            inputDelay,
          };
          await updateCustomSite(this.editingSiteId, siteData);

          // 編集モードを終了
          this.cancelModalEdit();

          // サイトリストを更新
          this.refreshModalSiteList();
          this.refreshSiteList(); // 元のリストも更新
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を更新しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          console.error("Failed to update site:", error);
          ErrorHandler.notify("サイトの更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      /**
       * モーダル内でサイトを削除
       */
      async deleteModalSite(siteId) {
        const site = AppState.selector.customSites[siteId];
        if (!site) return;

        if (!confirm(`サイト「${site.name}」を削除しますか？`)) return;

        try {
          await deleteCustomSite(siteId);
          this.refreshModalSiteList();
          this.refreshSiteList(); // 元のリストも更新
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${site.name}」を削除しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          console.error("Failed to delete site:", error);
          ErrorHandler.notify("サイトの削除に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      /**
       * モーダル編集をキャンセル
       */
      cancelModalEdit() {
        this.editingSiteId = null;

        // フォームをクリア
        document.getElementById("modal-add-site-name").value = "";
        document.getElementById("modal-add-site-url").value = "";
        document.getElementById("modal-add-site-positive").value = "";
        document.getElementById("modal-add-site-generate").value = "";
        document.getElementById("modal-add-site-delay").value = "0";

        // ボタンを元に戻す
        const addBtn = document.getElementById("modal-add-site");
        const cancelBtn = document.getElementById("modal-cancel-edit");
        if (addBtn) {
          addBtn.innerHTML = "<span>➕</span> サイトを追加";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "none";
        }
      }

      /**
       * 設定モーダルの初期化
       */
      initSettingsModal() {
        // BaseModalで設定モーダルを作成
        this.settingsModal = BaseModal.create(
          "settings-modal",
          "⚙️ 設定",
          `
          <div class="settings-modal-content">
            <!-- 基本設定セクション -->
            <div class="settings-section-modal">
              <h4>基本設定</h4>
              <div class="basic-settings-modal">
                <label class="settings-checkbox-label" title="プロンプトや要素を削除する際に確認ダイアログを表示します">
                  <input type="checkbox" id="modal-isDeleteCheck" value="isDeleteCheck" />
                  項目の削除時に確認をする
                </label>
                <label class="settings-checkbox-label" title="同じプロンプトを追加しようとした際に警告を表示します">
                  <input type="checkbox" id="modal-checkPromptConflict" value="checkPromptConflict" />
                  プロンプトの重複時に警告をする
                </label>
                <label class="settings-checkbox-label" title="コンソールに詳細なデバッグ情報を出力します（開発者向け）">
                  <input type="checkbox" id="modal-debugMode" value="debugMode" />
                  デバッグモードを有効にする
                </label>
                <label class="settings-checkbox-label" title="マウスオーバー時のヘルプ表示を有効/無効にします">
                  <input type="checkbox" id="modal-showTooltips" value="showTooltips" />
                  ツールチップ（ヘルプ表示）を有効にする
                </label>
                <label class="settings-checkbox-label" title="成人向けコンテンツ用のカテゴリを検索・編集時に表示します">
                  <input type="checkbox" id="modal-showNSFWCategories" value="showNSFWCategories" />
                  NSFWカテゴリを表示する
                </label>
                <label class="settings-input-label" title="DeepL APIを使用した翻訳機能に必要なAPIキーです">
                  DeepL APIキー
                  <input type="password" id="modal-DeeplAuth" placeholder="DeepL APIキーを入力" class="settings-input" title="無料プランまたは有料プランのAPIキーを入力してください" />
                </label>
                <label class="settings-input-label" title="拡張機能の外観テーマを変更します">
                  テーマ
                  <select id="modal-theme-selector" class="settings-input" title="お好みのテーマを選択してください">
                    <option value="dark">ダークテーマ</option>
                    <option value="light">ライトテーマ</option>
                    <option value="novelai">NovelAIテーマ</option>
                    <option value="stablediffusion">AUTOMATIC1111 (ライト)</option>
                    <option value="automatic1111-dark">AUTOMATIC1111 (ダーク)</option>
                    <option value="comfyui">ComfyUI (ダーク)</option>
                    <option value="spring-sakura">🌸 春の桜</option>
                    <option value="summer-ocean">🌊 夏の海</option>
                    <option value="autumn-leaves">🍁 秋の紅葉</option>
                    <option value="winter-snow">❄️ 冬の雪原</option>
                  </select>
                </label>
              </div>
            </div>

            <!-- 通知設定セクション -->
            <div class="settings-section-modal">
              <h4>通知設定</h4>
              <div class="notification-settings-modal">
                <label class="settings-checkbox-label" title="操作成功時の緑色トースト通知を表示します">
                  <input type="checkbox" id="modal-showSuccessToast" />
                  <span>成功通知を表示する</span>
                </label>
                <label class="settings-checkbox-label" title="一般的な情報の青色トースト通知を表示します">
                  <input type="checkbox" id="modal-showInfoToast" />
                  <span>情報通知を表示する</span>
                </label>
                <label class="settings-checkbox-label" title="注意が必要な黄色トースト通知を表示します">
                  <input type="checkbox" id="modal-showWarningToast" />
                  <span>警告通知を表示する</span>
                </label>
                <label class="settings-checkbox-label" title="エラー発生時の赤色トースト通知を表示します">
                  <input type="checkbox" id="modal-showErrorToast" />
                  <span>エラー通知を表示する</span>
                </label>
                <p class="settings-help-text-modal">
                  各種トースト通知の表示を個別に設定できます
                </p>
              </div>
            </div>

            <!-- 設定管理セクション -->
            <div class="settings-section-modal">
              <h4>設定管理</h4>
              <div class="settings-management-modal">
                <div class="settings-button-grid-modal">
                  <button id="modal-exportSettings" class="settings-action-btn" title="全データバックアップをJSON形式でエクスポート（全設定・辞書・お気に入り・マスター等を含む完全バックアップ）">
                    <span>💾</span> 全データバックアップ
                  </button>
                  <button id="modal-importSettings" class="settings-action-btn" title="JSONファイルから全データをインポート（現在のデータは上書きされます）">
                    <span>📂</span> 全データインポート
                  </button>
                  <button id="modal-resetButton" class="settings-action-btn danger-button" title="全データを初期状態に戻す（復元不可能・完全削除）">
                    <span>⚠️</span> 全データ初期化
                  </button>
                </div>
                <p class="settings-help-text-modal">
                  すべての設定（辞書、スロット、カスタマイズ）をバックアップ・復元できます
                </p>
              </div>
            </div>
          </div>
        `,
          {
            closeOnBackdrop: true,
            closeOnEsc: true,
            showCloseButton: true,
            showHeader: true,
            showFooter: false,
          }
        );

        // モーダル表示時に設定値をロードする
        this.settingsModal.onShow(() => {
          this.loadSettingsToModal();
          this.setupSettingsModalEventListeners();
        });
      }

      /**
       * 設定モーダルを表示
       */
      showSettingsModal() {
        this.settingsModal.show();
      }

      /**
       * 全タブのカテゴリ表示を強制更新
       */
      refreshAllCategoryDisplays() {
        try {
          // 検索タブの大項目ドロップダウンを強制リセット
          const searchCat0 = document.getElementById('search-cat0');
          if (searchCat0) {
            searchCat0.innerHTML = '<option value="">-- 選択してください --</option>';
            searchCat0.disabled = false;
          }
          
          // 検索タブのドロップダウンを更新
          if (window.categoryUIManager) {
            window.categoryUIManager.initializeCategoryChain('search');
          }
          
          // 編集タブのカテゴリドロップダウンも更新（存在する場合）
          if (window.editTab && typeof window.editTab.refreshCategoryOptions === 'function') {
            window.editTab.refreshCategoryOptions();
          }
          
          // 他のカテゴリ依存の表示も更新
          if (typeof refreshCategoryRelatedDisplays === 'function') {
            refreshCategoryRelatedDisplays();
          }
          
        } catch (error) {
          console.error('[Settings] Error refreshing category displays:', error);
        }
      }

      /**
       * モーダルに現在の設定値をロード
       */
      loadSettingsToModal() {
        // 基本設定をロード
        const isDeleteCheck = document.getElementById("modal-isDeleteCheck");
        const deeplAuth = document.getElementById("modal-DeeplAuth");
        const checkPromptConflict = document.getElementById(
          "modal-checkPromptConflict"
        );

        if (isDeleteCheck && AppState.userSettings.optionData) {
          isDeleteCheck.checked =
            AppState.userSettings.optionData.isDeleteCheck !== false;
        }
        if (deeplAuth && AppState.userSettings.optionData) {
          deeplAuth.value = AppState.userSettings.optionData.deeplAuth || "";
        }
        if (checkPromptConflict && AppState.userSettings.optionData) {
          checkPromptConflict.checked =
            AppState.userSettings.optionData.checkPromptConflict || false;
        }

        // デバッグモード設定をロード
        const debugModeCheck = document.getElementById("modal-debugMode");
        if (debugModeCheck && AppState.config) {
          debugModeCheck.checked = AppState.config.debugMode || false;
        }

        // ツールチップ設定をロード
        const showTooltipsCheck = document.getElementById("modal-showTooltips");
        if (showTooltipsCheck && AppState.userSettings.optionData) {
          showTooltipsCheck.checked = AppState.userSettings.optionData.showTooltips !== false;
        }

        // NSFWカテゴリ表示設定をロード
        const showNSFWCategoriesCheck = document.getElementById("modal-showNSFWCategories");
        if (showNSFWCategoriesCheck && AppState.userSettings.optionData) {
          showNSFWCategoriesCheck.checked = AppState.userSettings.optionData.showNSFWCategories || false;
        }

        // テーマ設定をロード
        const themeSelector = document.getElementById("modal-theme-selector");
        if (themeSelector && AppState.userSettings.optionData) {
          themeSelector.value =
            AppState.userSettings.optionData.theme || "dark";
        }

        // 通知設定をロード
        const showSuccessToast = document.getElementById(
          "modal-showSuccessToast"
        );
        const showInfoToast = document.getElementById("modal-showInfoToast");
        const showWarningToast = document.getElementById(
          "modal-showWarningToast"
        );
        const showErrorToast = document.getElementById("modal-showErrorToast");

        if (showSuccessToast && AppState.userSettings.optionData) {
          showSuccessToast.checked =
            AppState.userSettings.optionData.showSuccessToast !== false;
        }
        if (showInfoToast && AppState.userSettings.optionData) {
          showInfoToast.checked =
            AppState.userSettings.optionData.showInfoToast !== false;
        }
        if (showWarningToast && AppState.userSettings.optionData) {
          showWarningToast.checked =
            AppState.userSettings.optionData.showWarningToast !== false;
        }
        if (showErrorToast && AppState.userSettings.optionData) {
          showErrorToast.checked =
            AppState.userSettings.optionData.showErrorToast !== false;
        }
      }

      /**
       * 設定モーダルのイベントリスナーを設定
       */
      setupSettingsModalEventListeners() {
        // 基本設定の変更を監視
        const isDeleteCheck = document.getElementById("modal-isDeleteCheck");
        const deeplAuth = document.getElementById("modal-DeeplAuth");
        const checkPromptConflict = document.getElementById(
          "modal-checkPromptConflict"
        );

        if (isDeleteCheck) {
          isDeleteCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.isDeleteCheck =
                isDeleteCheck.checked;
              saveOptionData();
            }
          });
        }

        if (deeplAuth) {
          deeplAuth.addEventListener("input", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.deeplAuth = deeplAuth.value;
              saveOptionData();
            }
          });
        }

        if (checkPromptConflict) {
          checkPromptConflict.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.checkPromptConflict =
                checkPromptConflict.checked;
              saveOptionData();
            }
          });
        }

        // デバッグモード設定の変更を監視
        const debugModeCheck = document.getElementById("modal-debugMode");
        if (debugModeCheck) {
          debugModeCheck.addEventListener("change", () => {
            if (AppState.config) {
              AppState.config.debugMode = debugModeCheck.checked;
              console.log(`[Settings] Debug mode ${debugModeCheck.checked ? 'enabled' : 'disabled'}`);
              
              // デバッグ設定を永続化
              if (window.saveDebugSettings) {
                window.saveDebugSettings();
              }
            }
          });
        }

        // ツールチップ設定の変更を監視
        const showTooltipsCheck = document.getElementById("modal-showTooltips");
        if (showTooltipsCheck) {
          showTooltipsCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showTooltips = showTooltipsCheck.checked;
              saveOptionData();
              
              // ツールチップ表示を即座に切り替え
              if (typeof toggleTooltips === 'function') {
                toggleTooltips(showTooltipsCheck.checked);
              }
              
              console.log(`[Settings] Tooltips ${showTooltipsCheck.checked ? 'enabled' : 'disabled'}`);
            }
          });
        }

        // NSFWカテゴリ表示設定の変更を監視
        const showNSFWCategoriesCheck = document.getElementById("modal-showNSFWCategories");
        if (showNSFWCategoriesCheck) {
          showNSFWCategoriesCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showNSFWCategories = showNSFWCategoriesCheck.checked;
              saveOptionData();
              
              console.log(`[Settings] NSFW categories ${showNSFWCategoriesCheck.checked ? 'enabled' : 'disabled'}`);
              
              // カテゴリ表示を即座に更新
              this.refreshAllCategoryDisplays();
            }
          });
        }

        // テーマ設定の変更を監視
        const themeSelector = document.getElementById("modal-theme-selector");
        if (themeSelector) {
          themeSelector.addEventListener("change", async () => {
            if (AppState.userSettings.optionData && window.themeManager) {
              const selectedTheme = themeSelector.value;
              await window.themeManager.switchTheme(selectedTheme);
              console.log(`テーマを切り替えました: ${selectedTheme}`);
            }
          });
        }

        // 通知設定の変更を監視
        const showSuccessToast = document.getElementById(
          "modal-showSuccessToast"
        );
        const showInfoToast = document.getElementById("modal-showInfoToast");
        const showWarningToast = document.getElementById(
          "modal-showWarningToast"
        );
        const showErrorToast = document.getElementById("modal-showErrorToast");

        if (showSuccessToast) {
          showSuccessToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showSuccessToast =
                showSuccessToast.checked;
              saveOptionData();
            }
          });
        }

        if (showInfoToast) {
          showInfoToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showInfoToast =
                showInfoToast.checked;
              saveOptionData();
            }
          });
        }

        if (showWarningToast) {
          showWarningToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showWarningToast =
                showWarningToast.checked;
              saveOptionData();
            }
          });
        }

        if (showErrorToast) {
          showErrorToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showErrorToast =
                showErrorToast.checked;
              saveOptionData();
            }
          });
        }

        // 設定管理ボタン
        const exportBtn = document.getElementById("modal-exportSettings");
        const importBtn = document.getElementById("modal-importSettings");
        const resetBtn = document.getElementById("modal-resetButton");

        if (exportBtn) {
          exportBtn.addEventListener("click", () => this.exportSettings());
        }

        if (importBtn) {
          importBtn.addEventListener("click", () => this.importSettings());
        }

        if (resetBtn) {
          resetBtn.addEventListener("click", () => this.resetSettings());
        }
      }

      /**
       * 設定をエクスポート
       */
      async exportSettings() {
        try {
          // SettingsManagerを直接使用
          if (window.settingsManager) {
            await window.settingsManager.downloadExport();
            ErrorHandler.notify("設定をエクスポートしました", {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
            });
          } else {
            throw new Error("SettingsManager が見つかりません");
          }
        } catch (error) {
          console.error("Failed to export settings:", error);
          ErrorHandler.notify("エクスポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      /**
       * 設定をインポート
       */
      async importSettings() {
        try {
          // SettingsManagerを直接使用
          if (window.settingsManager) {
            await window.settingsManager.selectAndImport({
              // インポート設定
              includeSettings: true,
              includeLocalDict: true,
              includeFavorits: true,
              includeCategories: true,
              includeMaster: false,
              merge: false
            });
          } else {
            throw new Error("SettingsManager が見つかりません");
          }
        } catch (error) {
          console.error("Failed to import settings:", error);
          ErrorHandler.notify("インポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      /**
       * 設定をリセット
       */
      async resetSettings() {
        try {
          if (
            !confirm(
              "すべての設定をリセットしますか？この操作は元に戻せません。"
            )
          ) {
            return;
          }

          // ジェネレートプロンプトをクリア（リセット前に必ず実行）
          const generatePromptElement = document.getElementById(DOM_IDS.GENERATE_PROMPT);
          if (generatePromptElement) {
            generatePromptElement.value = "";
          }

          // 現在選択中のスロットもクリア
          if (window.promptSlotManager) {
            // 現在のスロットインデックスをリセット
            window.promptSlotManager.currentSlot = 0;
            // すべてのスロットをクリア（これにより現在選択中のスロットも確実にリセット）
            await window.promptSlotManager.clearAllSlots();
          }

          // Chrome Storageをクリア
          await chrome.storage.local.clear();

          // まず、promptSlotManagerを正しく初期化
          if (window.promptSlotManager) {
            // 3つのスロットで初期化
            window.promptSlotManager.initializeSlots(3);
            await window.promptSlotManager.saveToStorage();
          }

          // その後、スロットグループマネージャーを初期化
          if (window.slotGroupManager && window.promptSlotManager) {
            // 既存のグループデータをクリア
            window.slotGroupManager.groups.clear();
            
            // promptSlotManagerの現在のスロットデータを使用してデフォルトグループを作成
            const emptyDefaultGroup = {
              id: 'default',
              name: window.slotGroupManager.defaultGroupName,
              description: '初期設定のスロットグループ',
              createdAt: Date.now(),
              lastModified: Date.now(),
              slots: window.slotGroupManager.cloneSlots(window.promptSlotManager.slots), // promptSlotManagerのスロットをクローン
              isDefault: true
            };
            
            window.slotGroupManager.groups.set('default', emptyDefaultGroup);
            window.slotGroupManager.currentGroupId = 'default';
            
            // ストレージに保存
            await window.slotGroupManager.saveToStorage();
          }

          // AppStateをリセット
          if (window.settingsManager) {
            await window.settingsManager.reloadAppState();
          }

          // 全データ削除後の重み調整（NAIモード対応）
          if (window.promptSlotManager) {
            await this.adjustSlotWeightsAfterReset();
          }

          ErrorHandler.notify("設定をリセットしました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });

          // ページをリロードして完全にリセット
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          console.error("Failed to reset settings:", error);
          ErrorHandler.notify("リセットに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      /**
       * 全データリセット後のスロット重み調整処理
       * NAIモード時に正しい重み値(0.0)に調整する
       */
      async adjustSlotWeightsAfterReset() {
        try {
          // 現在のshaping設定を取得
          const currentShaping = AppState.userSettings?.optionData?.shaping || 'SD';
          
          // NAIモードでない場合は何もしない
          if (currentShaping !== 'NAI') {
            return;
          }

          // NAIモード時のみ、全スロットの重みを0.0に調整
          if (window.promptSlotManager?.slots) {
            window.promptSlotManager.slots.forEach(slot => {
              if (slot.weight === 1.0) { // SD基準の値が設定されている場合のみ修正
                slot.weight = 0.0;
              }
              if (slot.absoluteWeight === 1.0) { // absoluteWeightも調整
                slot.absoluteWeight = 0.0;
              }
            });

            // スロットデータを保存
            await window.promptSlotManager.saveToStorage();

            if (AppState.debugMode) {
              console.log('[RESET_SETTINGS] NAIモード用重み調整完了: 全スロット0.0に設定');
            }
          }
        } catch (error) {
          console.error('[RESET_SETTINGS] スロット重み調整でエラー:', error);
        }
      }

      debug() {
        super.debug();
        console.log("FileHandler:", this.fileHandler);
        console.log("Visual Selector State:", this.visualSelectorState);
        console.log("Current selectors:", {
          positive: AppState.selector.positiveSelector,
          generate: AppState.selector.generateSelector,
        });
      }
    }

    if (typeof window !== "undefined") {
      window.OtherTab = OtherTab;
    }
  }

  defineOtherTab();
})();
