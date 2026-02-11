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

        this.editingSiteId = null;

        this.sectionStates = {
          selector: true, // セレクター設定（デフォルト開）
          "site-management": false, // サイト管理
          "file-management": false, // ファイル管理
          "shortcut-help": false, // ショートカットヘルプ
        };

        this.settingsModal = null;
      }

      async onInit() {
        this.fileHandler = this.app.fileHandler || new FileHandler();
        this.setupEventListeners();
        await this.loadNotice();
        await this.initializeSelectorUI();

        this.initializeAutoGenerate();

        await this.initializeSectionStates();

        this.initSiteManagementModal();

        this.initSettingsModal();
      }

      async onShow() {
        const tabButton = this.getElement(`#${this.tabButtonId}`);
        if (tabButton && tabButton.classList.contains("is-alert")) {
          tabButton.classList.remove("is-alert");
        }
        await this.refreshSelectorDisplay();

        this.refreshSiteList();
      }

      setupEventListeners() {
        this.setupAccordionEventListeners();
        this.setupSelectorEventListeners();
        this.setupSiteManagementEventListeners();
        this.setupSettingsEventListeners();
        this.setupDragDrop();

        const showSiteManagementBtn = this.getElement("#showSiteManagement");
        if (showSiteManagementBtn) {
          this.addEventListener(showSiteManagementBtn, "click", () => {
            this.showSiteManagementModal();
          });
        }

        const openSettingsModalBtn = this.getElement("#openSettingsModal");
        if (openSettingsModalBtn) {
          this.addEventListener(openSettingsModalBtn, "click", () => {
            this.showSettingsModal();
          });
        }
      }

      setupAccordionEventListeners() {
        document.querySelectorAll(".dictionary-clickable-header").forEach((header) => {
          this.addEventListener(header, "click", (e) => {
            const section = header.dataset.section;
            if (section) {
              this.toggleSection(section);
            }
          });
        });
      }

      toggleSection(sectionName) {
        const header = document.querySelector(`[data-section="${sectionName}"]`);
        const container = document.querySelector(`[data-section-content="${sectionName}"]`);

        if (!header || !container) return;

        this.sectionStates[sectionName] = !this.sectionStates[sectionName];
        const isExpanded = this.sectionStates[sectionName];

        header.dataset.expanded = isExpanded.toString();

        if (isExpanded) {
          container.classList.add("expanded");
          container.style.setProperty("--container-max-height", "1000px");
        } else {
          container.classList.remove("expanded");
        }

        this.saveSectionStates();
      }

      async initializeSectionStates() {
        await this.loadSectionStates();

        Object.keys(this.sectionStates).forEach((sectionName) => {
          const header = document.querySelector(`[data-section="${sectionName}"]`);
          const container = document.querySelector(`[data-section-content="${sectionName}"]`);

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

      saveSectionStates() {
        try {
          chrome.storage.local.set({
            otherTabSectionStates: this.sectionStates,
          });
        } catch (error) {}
      }

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
        } catch (error) {}
      }

      setupSelectorEventListeners() {
        const serviceSelect = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_SERVICE);
        if (serviceSelect) {
          this.addEventListener(serviceSelect, "change", async (e) => {
            await this.onServiceSelected(e.target.value);
          });
        }

        document.querySelectorAll(".visual-select-btn").forEach((btn) => {
          this.addEventListener(btn, "click", (e) => {
            const targetId = e.currentTarget.dataset.target;
            this.toggleVisualSelector(targetId, e.currentTarget);
          });
        });

        ["selector-positive", "selector-generate"].forEach((id) => {
          const input = this.getElement(`#${id}`);
          if (input) {
            this.addEventListener(input, "input", () => {
              this.validateSelector(id, input.value);
            });
          }
        });
      }

      setupSiteManagementEventListeners() {
        const addSiteBtn = this.getElement(`#${DOM_IDS.BUTTONS.ADD_SITE}`);
        if (addSiteBtn) {
          this.addEventListener(addSiteBtn, "click", () => this.addSite());
        }

        const cancelBtn = this.getElement(`#${DOM_IDS.BUTTONS.CANCEL_EDIT}`);
        if (cancelBtn) {
          this.addEventListener(cancelBtn, "click", () => this.exitEditMode());
        }

        document.querySelectorAll(".visual-select-btn").forEach((btn) => {
          const target = btn.dataset.target;
          if (target === "add-site-positive" || target === "add-site-generate") {
            this.addEventListener(btn, "click", (e) => {
              const targetId = e.currentTarget.dataset.target;
              this.toggleVisualSelector(targetId, e.currentTarget);
            });
          }
        });
      }

      setupSettingsEventListeners() {
        const isDeleteCheck = this.getElement(DOM_SELECTORS.BY_ID.DELETE_CHECK);
        if (isDeleteCheck) {
        }

        const deeplAuth = this.getElement(DOM_SELECTORS.BY_ID.DEEPL_AUTH);
        if (deeplAuth) {
        }
      }

      async initializeSelectorUI() {
        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tab && tab.url) {
            for (const [key, service] of Object.entries(AppState.selector.serviceSets)) {
              if (service.url && tab.url.includes(service.url)) {
                const serviceSelect = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_SERVICE);
                if (serviceSelect) {
                  serviceSelect.value = key;
                  this.onServiceSelected(key);
                }
                break;
              }
            }

            for (const [key, service] of Object.entries(AppState.selector.customSites)) {
              if (service.url && tab.url.includes(service.url)) {
                const serviceSelect = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_SERVICE);
                if (serviceSelect) {
                  serviceSelect.value = key;
                  this.onServiceSelected(key);
                }
                break;
              }
            }
          }
        } catch (error) {}

        await this.refreshSelectorDisplay();

        this.updateServiceSelector();

        this.refreshSiteList();
      }

      async onServiceSelected(serviceKey) {
        if (!serviceKey || serviceKey === "custom") {
          return;
        }

        await loadSelectors();

        let service = AppState.selector.serviceSets[serviceKey];
        if (!service) {
          service = AppState.selector.customSites[serviceKey];
        }

        if (!service) {
          return;
        }

        const positiveInput = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_POSITIVE);
        const generateInput = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_GENERATE);

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

        AppState.selector.positiveSelector = positiveSelector;
        AppState.selector.generateSelector = generateSelector;
      }

      async refreshSelectorDisplay() {
        try {
          await loadSelectors(); // ← この行を追加

          const positiveSelector = AppState.selector.positiveSelector;
          const generateSelector = AppState.selector.generateSelector;

          if (positiveSelector) {
            const input = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_POSITIVE);
            if (input) {
              input.value = positiveSelector;
              this.validateSelector("selector-positive", positiveSelector);
            }
          }

          if (generateSelector) {
            const input = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_GENERATE);
            if (input) {
              input.value = generateSelector;
              this.validateSelector("selector-generate", generateSelector);
            }
          }
        } catch (error) {}
      }

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

      async startVisualSelection(targetId) {
        this.visualSelectorState.mode = "selecting";
        this.visualSelectorState.targetInputId = targetId;

        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab) return;

        try {
          if (this.boundSelectorMessageHandler) {
            chrome.runtime.onMessage.removeListener(this.boundSelectorMessageHandler);
          }

          this.boundSelectorMessageHandler = this.handleSelectorMessage.bind(this);
          chrome.runtime.onMessage.addListener(this.boundSelectorMessageHandler);

          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["js/content.js"],
            });
          } catch (injectError) {}

          await chrome.tabs.sendMessage(tab.id, {
            action: "startVisualSelection",
          });

          ErrorHandler.notify("要素をクリックして選択してください（ESCで終了）", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          ErrorHandler.notify("ビジュアルセレクターの開始に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          this.endVisualSelection();
        }
      }

      handleSelectorMessage(message, sender, sendResponse) {
        if (message.action === "selectorSelected") {
          const input = this.getElement(`#${this.visualSelectorState.targetInputId}`);
          if (input) {
            input.value = message.selector;

            setTimeout(() => {
              this.validateSelector(this.visualSelectorState.targetInputId, message.selector);
            }, 100);

            if (this.visualSelectorState.targetInputId === "selector-positive") {
              AppState.selector.positiveSelector = message.selector;
            } else if (this.visualSelectorState.targetInputId === "selector-generate") {
              AppState.selector.generateSelector = message.selector;
            }
          }
          this.endVisualSelection();

          if (this.visualSelectorState.targetInputId === "selector-positive") {
            AppState.selector.positiveSelector = message.selector;
          } else if (this.visualSelectorState.targetInputId === "selector-generate") {
            AppState.selector.generateSelector = message.selector;
          }
        } else if (message.action === "visualSelectionCanceled") {
          this.endVisualSelection();
        }
      }

      endVisualSelection() {
        this.visualSelectorState.mode = "inactive";

        if (this.boundSelectorMessageHandler) {
          chrome.runtime.onMessage.removeListener(this.boundSelectorMessageHandler);
          this.boundSelectorMessageHandler = null;
        }

        document.querySelectorAll(".visual-select-btn").forEach((btn) => {
          btn.classList.remove("active");
          btn.style.background = "";
          btn.style.color = "";
        });

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

          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["js/content.js"],
            });
          } catch (injectError) {}

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
          statusElement.textContent = "✗ 検証できません（ページを開いてください）";
          statusElement.className = "selector-status invalid";
          statusElement.style.display = "block";
        }
      }

      updateGenerateButtonVisibility() {
        const genBtn = this.getElement(`#${DOM_IDS.BUTTONS.GENERATE}`);

        if (genBtn) {
          const hasSelectors = AppState.selector.positiveSelector && AppState.selector.generateSelector;
          const showButton = hasSelectors;

          genBtn.style.display = showButton ? "block" : "none";

          const autoGenerateOption = this.getElement("#autoGenerateOption");
          if (autoGenerateOption) {
            autoGenerateOption.style.display = showButton ? "block" : "none";
          }
        }
      }

      initializeAutoGenerate() {
        if (window.autoGenerateHandler) {
          autoGenerateHandler.init();
        }
      }

      async loadNotice() {}

      setupDragDrop() {
        const inclued = this.getElement("#inclued");
        if (inclued && this.fileHandler) {
          this.fileHandler.setupDragDrop(inclued);
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

      refreshSiteList() {
        const siteListContainer = this.getElement("#siteList");
        if (!siteListContainer) return;

        const allSites = getAllSites();
        const siteKeys = Object.keys(allSites);

        if (siteKeys.length === 0) {
          siteListContainer.innerHTML = '<div class="site-list-empty">登録済みサイトがありません</div>';
          return;
        }

        const siteItems = siteKeys
          .map((key) => {
            const site = allSites[key];
            const isBuiltIn = site.isBuiltIn || false;

            return `
            <div class="site-item ${isBuiltIn ? "built-in" : ""}" data-site-id="${key}">
              <div class="site-item-header">
                <span class="site-item-name">${site.name}</span>
                <span class="site-item-badge ${isBuiltIn ? "built-in" : "custom"}">
                  ${isBuiltIn ? "組み込み" : "カスタム"}
                </span>
              </div>
              <div class="site-item-url">${site.url || "設定なし"}</div>
              <div class="site-item-selectors">
                <div class="site-item-selector">
                  <div class="site-item-selector-label">プロンプト入力欄:</div>
                  <div class="site-item-selector-value">${site.positiveSelector || "未設定"}</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">Generateボタン:</div>
                  <div class="site-item-selector-value">${site.generateSelector || "未設定"}</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">入力後遅延:</div>
                  <div class="site-item-selector-value">${site.inputDelay || 0}ms</div>
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

      async addSite() {
        if (this.editingSiteId) {
          return this.updateSite();
        }

        const name = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`)?.value?.trim();
        const url = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`)?.value?.trim();
        const positiveSelector = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`)?.value?.trim();
        const generateSelector = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`)?.value?.trim();

        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

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

          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`).value = "";
          this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`).value = "0";

          this.refreshSiteList();

          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を追加しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          ErrorHandler.notify("サイトの追加に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

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
          ErrorHandler.notify("サイトの削除に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      editSite(siteId) {
        const site = AppState.selector.customSites[siteId];
        if (!site) return;

        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`).value = site.name;
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`).value = site.url;
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`).value = site.positiveSelector || "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`).value = site.generateSelector || "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`).value = site.inputDelay || 0;

        this.editingSiteId = siteId;

        const addBtn = this.getElement(`#${DOM_IDS.BUTTONS.ADD_SITE}`);
        const cancelBtn = this.getElement(`#${DOM_IDS.BUTTONS.CANCEL_EDIT}`);
        if (addBtn) {
          addBtn.innerHTML = "<span>✏️</span> サイトを更新";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "flex";
        }

        const addSiteForm = document.querySelector(".add-site-form");
        if (addSiteForm) {
          addSiteForm.scrollIntoView({ behavior: "smooth" });
        }

        ErrorHandler.notify(`サイト「${site.name}」を編集モードにしました`, {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "info",
        });
      }

      async updateSite() {
        if (!this.editingSiteId) return;

        const name = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`)?.value?.trim();
        const url = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`)?.value?.trim();
        const positiveSelector = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`)?.value?.trim();
        const generateSelector = this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`)?.value?.trim();
        const inputDelay = parseInt(this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`)?.value) || 0;

        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

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

          this.exitEditMode();

          this.refreshSiteList();
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を更新しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          ErrorHandler.notify("サイトの更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      exitEditMode() {
        this.editingSiteId = null;

        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_NAME}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_URL}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_POSITIVE}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_GENERATE}`).value = "";
        this.getElement(`#${DOM_IDS.OTHER.ADD_SITE_DELAY}`).value = "0";

        const addBtn = this.getElement(`#${DOM_IDS.BUTTONS.ADD_SITE}`);
        const cancelBtn = this.getElement(`#${DOM_IDS.BUTTONS.CANCEL_EDIT}`);
        if (addBtn) {
          addBtn.innerHTML = "<span>➕</span> サイトを追加";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "none";
        }
      }

      updateServiceSelector() {
        const serviceSelect = this.getElement(DOM_SELECTORS.BY_ID.SELECTOR_SERVICE);
        if (!serviceSelect) return;

        const currentValue = serviceSelect.value;

        const existingCustomOptions = serviceSelect.querySelectorAll("option[data-custom]");
        existingCustomOptions.forEach((option) => option.remove());

        Object.keys(AppState.selector.customSites).forEach((key) => {
          const site = AppState.selector.customSites[key];
          const option = UIFactory.createOption({
            value: key,
            text: site.name,
          });
          option.setAttribute("data-custom", "true");
          serviceSelect.appendChild(option);
        });

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

      initSiteManagementModal() {
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

        this.siteManagementModal.onShow(() => {
          this.refreshModalSiteList();
          this.setupModalEventListeners();
        });
      }

      showSiteManagementModal() {
        this.siteManagementModal.show();
      }

      refreshModalSiteList() {
        const siteListContainer = document.getElementById("modal-site-list");
        if (!siteListContainer) return;

        const allSites = getAllSites();
        const siteKeys = Object.keys(allSites);

        if (siteKeys.length === 0) {
          siteListContainer.innerHTML = '<div class="site-list-empty">登録済みサイトがありません</div>';
          return;
        }

        const siteItems = siteKeys
          .map((key) => {
            const site = allSites[key];
            const isBuiltIn = site.isBuiltIn || false;

            return `
            <div class="site-item ${isBuiltIn ? "built-in" : ""}" data-site-id="${key}">
              <div class="site-item-header">
                <span class="site-item-name">${site.name}</span>
                <span class="site-item-badge ${isBuiltIn ? "built-in" : "custom"}">
                  ${isBuiltIn ? "組み込み" : "カスタム"}
                </span>
              </div>
              <div class="site-item-url">${site.url || "設定なし"}</div>
              <div class="site-item-selectors">
                <div class="site-item-selector">
                  <div class="site-item-selector-label">プロンプト入力欄:</div>
                  <div class="site-item-selector-value">${site.positiveSelector || "未設定"}</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">Generateボタン:</div>
                  <div class="site-item-selector-value">${site.generateSelector || "未設定"}</div>
                </div>
                <div class="site-item-selector">
                  <div class="site-item-selector-label">入力後遅延:</div>
                  <div class="site-item-selector-value">${site.inputDelay || 0}ms</div>
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

      setupModalEventListeners() {
        const addBtn = document.getElementById("modal-add-site");
        if (addBtn) {
          addBtn.addEventListener("click", () => this.handleModalAddSite());
        }

        const cancelBtn = document.getElementById("modal-cancel-edit");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => this.cancelModalEdit());
        }

        document.querySelectorAll("#site-management-modal .visual-select-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const targetId = e.currentTarget.dataset.target;
            this.toggleVisualSelector(targetId, e.currentTarget);
          });
        });

        document.querySelectorAll("#modal-site-list .site-action-btn").forEach((btn) => {
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

      async handleModalAddSite() {
        if (this.editingSiteId) {
          return this.updateModalSite();
        }

        const name = document.getElementById("modal-add-site-name")?.value?.trim();
        const url = document.getElementById("modal-add-site-url")?.value?.trim();
        const positiveSelector = document.getElementById("modal-add-site-positive")?.value?.trim();
        const generateSelector = document.getElementById("modal-add-site-generate")?.value?.trim();
        const inputDelay = parseInt(document.getElementById("modal-add-site-delay")?.value) || 0;

        if (!name || !url || !positiveSelector || !generateSelector) {
          ErrorHandler.notify("すべての項目を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
          return;
        }

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

          document.getElementById("modal-add-site-name").value = "";
          document.getElementById("modal-add-site-url").value = "";
          document.getElementById("modal-add-site-positive").value = "";
          document.getElementById("modal-add-site-generate").value = "";
          document.getElementById("modal-add-site-delay").value = "0";

          this.refreshModalSiteList();
          this.refreshSiteList(); // 元のリストも更新
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を追加しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          ErrorHandler.notify("サイトの追加に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      editModalSite(siteId) {
        const site = AppState.selector.customSites[siteId];
        if (!site) return;

        document.getElementById("modal-add-site-name").value = site.name;
        document.getElementById("modal-add-site-url").value = site.url;
        document.getElementById("modal-add-site-positive").value = site.positiveSelector || "";
        document.getElementById("modal-add-site-generate").value = site.generateSelector || "";
        document.getElementById("modal-add-site-delay").value = site.inputDelay || 0;

        this.editingSiteId = siteId;

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

      async updateModalSite() {
        if (!this.editingSiteId) return;

        const name = document.getElementById("modal-add-site-name")?.value?.trim();
        const url = document.getElementById("modal-add-site-url")?.value?.trim();
        const positiveSelector = document.getElementById("modal-add-site-positive")?.value?.trim();
        const generateSelector = document.getElementById("modal-add-site-generate")?.value?.trim();
        const inputDelay = parseInt(document.getElementById("modal-add-site-delay")?.value) || 0;

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

          this.cancelModalEdit();

          this.refreshModalSiteList();
          this.refreshSiteList(); // 元のリストも更新
          this.updateServiceSelector();

          ErrorHandler.notify(`サイト「${name}」を更新しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
          });
        } catch (error) {
          ErrorHandler.notify("サイトの更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

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
          ErrorHandler.notify("サイトの削除に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      cancelModalEdit() {
        this.editingSiteId = null;

        document.getElementById("modal-add-site-name").value = "";
        document.getElementById("modal-add-site-url").value = "";
        document.getElementById("modal-add-site-positive").value = "";
        document.getElementById("modal-add-site-generate").value = "";
        document.getElementById("modal-add-site-delay").value = "0";

        const addBtn = document.getElementById("modal-add-site");
        const cancelBtn = document.getElementById("modal-cancel-edit");
        if (addBtn) {
          addBtn.innerHTML = "<span>➕</span> サイトを追加";
        }
        if (cancelBtn) {
          cancelBtn.style.display = "none";
        }
      }

      initSettingsModal() {
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
                <label class="settings-checkbox-label" title="LoRA素材連続生成ボタンをヘッダーに表示します">
                  <input type="checkbox" id="modal-showLoraButton" value="showLoraButton" />
                  LoRA生成ボタンを表示する
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

        this.settingsModal.onShow(() => {
          this.loadSettingsToModal();
          this.setupSettingsModalEventListeners();
        });
      }

      showSettingsModal() {
        this.settingsModal.show();
      }

      refreshAllCategoryDisplays() {
        try {
          const searchCat0 = document.getElementById("search-cat0");
          if (searchCat0) {
            searchCat0.innerHTML = '<option value="">-- 選択してください --</option>';
            searchCat0.disabled = false;
          }

          if (window.categoryUIManager) {
            window.categoryUIManager.initializeCategoryChain("search");
          }

          if (window.editTab && typeof window.editTab.refreshCategoryOptions === "function") {
            window.editTab.refreshCategoryOptions();
          }

          if (typeof refreshCategoryRelatedDisplays === "function") {
            refreshCategoryRelatedDisplays();
          }
        } catch (error) {}
      }

      updateLoraButtonVisibility() {
        const loraButton = document.getElementById(DOM_IDS.OTHER.LORA_GENERATE);
        if (loraButton) {
          const show = AppState.userSettings.optionData?.showLoraButton || false;
          loraButton.classList.toggle("hidden", !show);
        }
      }

      loadSettingsToModal() {
        const isDeleteCheck = document.getElementById("modal-isDeleteCheck");
        const deeplAuth = document.getElementById("modal-DeeplAuth");
        const checkPromptConflict = document.getElementById("modal-checkPromptConflict");

        if (isDeleteCheck && AppState.userSettings.optionData) {
          isDeleteCheck.checked = AppState.userSettings.optionData.isDeleteCheck !== false;
        }
        if (deeplAuth && AppState.userSettings.optionData) {
          deeplAuth.value = AppState.userSettings.optionData.deeplAuth || "";
        }
        if (checkPromptConflict && AppState.userSettings.optionData) {
          checkPromptConflict.checked = AppState.userSettings.optionData.checkPromptConflict || false;
        }

        const debugModeCheck = document.getElementById("modal-debugMode");
        if (debugModeCheck && AppState.config) {
          debugModeCheck.checked = AppState.config.debugMode || false;
        }

        const showTooltipsCheck = document.getElementById("modal-showTooltips");
        if (showTooltipsCheck && AppState.userSettings.optionData) {
          showTooltipsCheck.checked = AppState.userSettings.optionData.showTooltips !== false;
        }

        const showNSFWCategoriesCheck = document.getElementById("modal-showNSFWCategories");
        if (showNSFWCategoriesCheck && AppState.userSettings.optionData) {
          showNSFWCategoriesCheck.checked = AppState.userSettings.optionData.showNSFWCategories || false;
        }

        const showLoraButtonCheck = document.getElementById("modal-showLoraButton");
        if (showLoraButtonCheck && AppState.userSettings.optionData) {
          showLoraButtonCheck.checked = AppState.userSettings.optionData.showLoraButton || false;
        }

        const themeSelector = document.getElementById("modal-theme-selector");
        if (themeSelector && AppState.userSettings.optionData) {
          themeSelector.value = AppState.userSettings.optionData.theme || "dark";
        }

        const showSuccessToast = document.getElementById("modal-showSuccessToast");
        const showInfoToast = document.getElementById("modal-showInfoToast");
        const showWarningToast = document.getElementById("modal-showWarningToast");
        const showErrorToast = document.getElementById("modal-showErrorToast");

        if (showSuccessToast && AppState.userSettings.optionData) {
          showSuccessToast.checked = AppState.userSettings.optionData.showSuccessToast !== false;
        }
        if (showInfoToast && AppState.userSettings.optionData) {
          showInfoToast.checked = AppState.userSettings.optionData.showInfoToast !== false;
        }
        if (showWarningToast && AppState.userSettings.optionData) {
          showWarningToast.checked = AppState.userSettings.optionData.showWarningToast !== false;
        }
        if (showErrorToast && AppState.userSettings.optionData) {
          showErrorToast.checked = AppState.userSettings.optionData.showErrorToast !== false;
        }
      }

      setupSettingsModalEventListeners() {
        const isDeleteCheck = document.getElementById("modal-isDeleteCheck");
        const deeplAuth = document.getElementById("modal-DeeplAuth");
        const checkPromptConflict = document.getElementById("modal-checkPromptConflict");

        if (isDeleteCheck) {
          isDeleteCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.isDeleteCheck = isDeleteCheck.checked;
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
              AppState.userSettings.optionData.checkPromptConflict = checkPromptConflict.checked;
              saveOptionData();
            }
          });
        }

        const debugModeCheck = document.getElementById("modal-debugMode");
        if (debugModeCheck) {
          debugModeCheck.addEventListener("change", () => {
            if (AppState.config) {
              AppState.config.debugMode = debugModeCheck.checked;
              if (window.saveDebugSettings) {
                window.saveDebugSettings();
              }
            }
          });
        }

        const showTooltipsCheck = document.getElementById("modal-showTooltips");
        if (showTooltipsCheck) {
          showTooltipsCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showTooltips = showTooltipsCheck.checked;
              saveOptionData();

              if (typeof toggleTooltips === "function") {
                toggleTooltips(showTooltipsCheck.checked);
              }
            }
          });
        }

        const showNSFWCategoriesCheck = document.getElementById("modal-showNSFWCategories");
        if (showNSFWCategoriesCheck) {
          showNSFWCategoriesCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showNSFWCategories = showNSFWCategoriesCheck.checked;
              saveOptionData();
              this.refreshAllCategoryDisplays();
            }
          });
        }

        const showLoraButtonCheck = document.getElementById("modal-showLoraButton");
        if (showLoraButtonCheck) {
          showLoraButtonCheck.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showLoraButton = showLoraButtonCheck.checked;
              saveOptionData();
              this.updateLoraButtonVisibility();
            }
          });
        }

        const themeSelector = document.getElementById("modal-theme-selector");
        if (themeSelector) {
          themeSelector.addEventListener("change", async () => {
            if (AppState.userSettings.optionData && window.themeManager) {
              const selectedTheme = themeSelector.value;
              await window.themeManager.switchTheme(selectedTheme);
            }
          });
        }

        const showSuccessToast = document.getElementById("modal-showSuccessToast");
        const showInfoToast = document.getElementById("modal-showInfoToast");
        const showWarningToast = document.getElementById("modal-showWarningToast");
        const showErrorToast = document.getElementById("modal-showErrorToast");

        if (showSuccessToast) {
          showSuccessToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showSuccessToast = showSuccessToast.checked;
              saveOptionData();
            }
          });
        }

        if (showInfoToast) {
          showInfoToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showInfoToast = showInfoToast.checked;
              saveOptionData();
            }
          });
        }

        if (showWarningToast) {
          showWarningToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showWarningToast = showWarningToast.checked;
              saveOptionData();
            }
          });
        }

        if (showErrorToast) {
          showErrorToast.addEventListener("change", () => {
            if (AppState.userSettings.optionData) {
              AppState.userSettings.optionData.showErrorToast = showErrorToast.checked;
              saveOptionData();
            }
          });
        }

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

      async exportSettings() {
        try {
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
          ErrorHandler.notify("エクスポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      async importSettings() {
        try {
          if (window.settingsManager) {
            await window.settingsManager.selectAndImport({
              includeSettings: true,
              includeLocalDict: true,
              includeFavorits: true,
              includeCategories: true,
              includeMaster: false,
              merge: false,
            });
          } else {
            throw new Error("SettingsManager が見つかりません");
          }
        } catch (error) {
          ErrorHandler.notify("インポートに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      async resetSettings() {
        try {
          if (!confirm("すべての設定をリセットしますか？この操作は元に戻せません。")) {
            return;
          }

          const generatePromptElement = document.getElementById(DOM_IDS.GENERATE_PROMPT);
          if (generatePromptElement) {
            generatePromptElement.value = "";
          }

          if (window.promptSlotManager) {
            window.promptSlotManager.currentSlot = 0;
            await window.promptSlotManager.clearAllSlots();
          }

          await chrome.storage.local.clear();

          if (window.promptSlotManager) {
            window.promptSlotManager.initializeSlots(3);
            await window.promptSlotManager.saveToStorage();
          }

          if (window.slotGroupManager && window.promptSlotManager) {
            window.slotGroupManager.groups.clear();

            const emptyDefaultGroup = {
              id: "default",
              name: window.slotGroupManager.defaultGroupName,
              description: "初期設定のスロットグループ",
              createdAt: Date.now(),
              lastModified: Date.now(),
              slots: window.slotGroupManager.cloneSlots(window.promptSlotManager.slots), // promptSlotManagerのスロットをクローン
              isDefault: true,
            };

            window.slotGroupManager.groups.set("default", emptyDefaultGroup);
            window.slotGroupManager.currentGroupId = "default";

            await window.slotGroupManager.saveToStorage();
          }

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

          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          ErrorHandler.notify("リセットに失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        }
      }

      async adjustSlotWeightsAfterReset() {
        try {
          const currentShaping = AppState.userSettings?.optionData?.shaping || "SD";

          if (currentShaping !== "NAI") {
            return;
          }

          if (window.promptSlotManager?.slots) {
            window.promptSlotManager.slots.forEach((slot) => {
              if (slot.weight === 1.0) {
                // SD基準の値が設定されている場合のみ修正
                slot.weight = 0.0;
              }
              if (slot.absoluteWeight === 1.0) {
                // absoluteWeightも調整
                slot.absoluteWeight = 0.0;
              }
            });

            await window.promptSlotManager.saveToStorage();
          }
        } catch (error) {}
      }

      debug() {
        super.debug();
      }
    }

    if (typeof window !== "undefined") {
      window.OtherTab = OtherTab;
    }
  }

  defineOtherTab();
})();
