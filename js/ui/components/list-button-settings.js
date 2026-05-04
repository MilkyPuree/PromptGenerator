/**
 * list-button-settings.js
 * PromptListManagerのボタン・カラム表示設定機能をミックスインとして提供
 *
 * 分離元: list-manager.js
 * 含まれる機能:
 *   - setupButtonToggle: ボタン表示切り替えの初期設定
 *   - setButtonVisibility: ボタン表示/非表示の切り替え
 *   - setColumnVisibility: カラム表示/非表示の切り替え
 *   - applyColumnSettings: カラム設定の適用
 *   - detectAvailableColumns: 利用可能なカラムの検出
 *   - checkAllButtonTypesHidden: 全ボタン非表示状態のチェック
 *   - updateHeaderButtonColumns: ヘッダーボタンカラムの更新
 *   - updateToggleButtonState: トグルボタン状態の更新
 *   - applyIndividualButtonSettings: 個別ボタン設定の適用
 *   - showButtonSettingsModal: 表示設定モーダルの表示
 */

(function () {
  "use strict";

  function defineButtonSettingsHandlers() {
    if (typeof PromptListManager === "undefined") {
      setTimeout(defineButtonSettingsHandlers, 10);
      return;
    }

    /**
     * ボタン表示切り替えの初期設定
     */
    PromptListManager.prototype.setupButtonToggle = function (listId, cleanListId) {
      const allToggleBtn = document.querySelector(`[data-list-id="${cleanListId}"][data-button-type="all"]`);
      const settingsBtn = document.querySelector(`[data-list-id="${cleanListId}"].button-controls-settings`);

      if (!allToggleBtn) {
        return;
      }

      const allStorageKey = `buttonVisible_${cleanListId}_all`;
      const allVisible = localStorage.getItem(allStorageKey) !== "false"; // デフォルトtrue

      this.setButtonVisibility(listId, allVisible, "all");
      this.updateToggleButtonState(allToggleBtn, allVisible);

      allToggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentVisible = localStorage.getItem(allStorageKey) !== "false";
        const newVisible = !currentVisible;

        localStorage.setItem(allStorageKey, newVisible.toString());

        this.setButtonVisibility(listId, newVisible, "all", cleanListId);
        this.updateToggleButtonState(allToggleBtn, newVisible);
      });

      if (settingsBtn) {
        settingsBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showButtonSettingsModal(listId, cleanListId);
        });
      }

      this.applyIndividualButtonSettings(listId, cleanListId);

      this.applyColumnSettings(listId, cleanListId);
    };

    /**
     * ボタン表示/非表示の切り替え
     */
    PromptListManager.prototype.setButtonVisibility = function (
      listId,
      isVisible,
      buttonType = "all",
      cleanListId = null
    ) {
      const container = document.querySelector(listId);
      if (!container) return;

      const flexibleContainer = this.getFlexibleContainer(container);
      if (!flexibleContainer) return;

      if (buttonType === "all") {
        if (isVisible) {
          flexibleContainer.classList.remove("buttons-hidden");
          flexibleContainer.classList.remove("hide-all-button-types");
          if (!cleanListId) {
            const headerElement = flexibleContainer.querySelector(".search-results-header");
            if (headerElement) {
              const toggleBtn = headerElement.querySelector("[data-list-id]");
              if (toggleBtn) {
                cleanListId = toggleBtn.getAttribute("data-list-id");
              }
            }
            if (!cleanListId) {
              cleanListId = listId.replace("#", "").replace("-list", "");
            }
          }
          this.applyIndividualButtonSettings(listId, cleanListId);
        } else {
          flexibleContainer.classList.add("buttons-hidden");
          flexibleContainer.classList.remove("hide-all-button-types");
        }
      } else {
        const hideClass = `hide-${buttonType}-buttons`;
        flexibleContainer.classList.toggle(hideClass, !isVisible);

        this.updateHeaderButtonColumns(flexibleContainer, buttonType, isVisible);

        this.checkAllButtonTypesHidden(flexibleContainer);
      }
    };

    /**
     * カラム表示/非表示の切り替え
     */
    PromptListManager.prototype.setColumnVisibility = function (listId, isVisible, columnType) {
      const container = document.querySelector(listId);
      if (!container) return;

      const flexibleContainer = this.getFlexibleContainer(container);
      if (!flexibleContainer) return;

      const hideClass = `hide-column-${columnType.replace(".", "-")}`;
      flexibleContainer.classList.toggle(hideClass, !isVisible);
    };

    /**
     * カラム設定の適用
     */
    PromptListManager.prototype.applyColumnSettings = function (listId, cleanListId) {
      const container = document.querySelector(listId);
      if (!container) return;

      if (typeof COLUMN_TYPES === "undefined") return;

      const availableColumns = this.detectAvailableColumns(container);

      availableColumns.forEach((columnType) => {
        const storageKey = `columnVisible_${cleanListId}_${columnType}`;
        const isVisible = localStorage.getItem(storageKey) !== "false"; // デフォルトtrue

        if (!isVisible) {
          this.setColumnVisibility(listId, false, columnType);
        }
      });
    };

    /**
     * 利用可能なカラムの検出
     */
    PromptListManager.prototype.detectAvailableColumns = function (container) {
      const availableColumns = [];

      const dataFieldMappings = {
        "data.0": "category.0",
        "data.1": "category.1",
        "data.2": "category.2",
        prompt: "prompt",
      };

      Object.entries(dataFieldMappings).forEach(([dataField, columnType]) => {
        const inputs = container.querySelectorAll(`[data-field="${dataField}"]`);
        if (inputs.length > 0 && COLUMN_TYPES[columnType]) {
          availableColumns.push(columnType);
        }
      });

      return availableColumns;
    };

    /**
     * 全ボタン非表示状態のチェック
     */
    PromptListManager.prototype.checkAllButtonTypesHidden = function (flexibleContainer) {
      const existingButtonTypes = new Set();
      const allButtons = flexibleContainer.querySelectorAll("button[data-action]");
      allButtons.forEach((button) => {
        const action = button.getAttribute("data-action");
        if (action && BUTTON_TYPES[action]) {
          existingButtonTypes.add(action);
        }
      });

      if (existingButtonTypes.size === 0) {
        flexibleContainer.classList.remove("hide-all-button-types");
        return;
      }

      const allExistingHidden = Array.from(existingButtonTypes).every((buttonType) =>
        flexibleContainer.classList.contains(`hide-${buttonType}-buttons`)
      );

      if (allExistingHidden) {
        flexibleContainer.classList.add("hide-all-button-types");
      } else {
        flexibleContainer.classList.remove("hide-all-button-types");
      }
    };

    /**
     * ヘッダーボタンカラムの更新
     */
    PromptListManager.prototype.updateHeaderButtonColumns = function (flexibleContainer, buttonType, isVisible) {
      const firstButtonRow = flexibleContainer.querySelector(".prompt-list-item, li:not(.prompt-list-header)");
      if (!firstButtonRow) {
        return;
      }

      const buttonElements = firstButtonRow.querySelectorAll("button[data-action]");
      const targetButtonColumnIndex = [];

      buttonElements.forEach((button, index) => {
        const action = button.getAttribute("data-action");
        if (action === buttonType) {
          targetButtonColumnIndex.push(index);
        }
      });

      if (targetButtonColumnIndex.length === 0) {
        return;
      }

      const headerSelectors = [".prompt-list-header .flex-col-button", "li.prompt-list-header .flex-col-button"];

      let headerColumns = [];
      for (const selector of headerSelectors) {
        headerColumns = flexibleContainer.querySelectorAll(selector);
        if (headerColumns.length > 0) {
          break;
        }
      }

      if (headerColumns.length > 0) {
        targetButtonColumnIndex.forEach((buttonIndex) => {
          if (buttonIndex < headerColumns.length) {
            const headerColumn = headerColumns[buttonIndex];
            if (isVisible) {
              headerColumn.classList.remove("header-column-hidden");
              headerColumn.classList.remove("hidden");
            } else {
              headerColumn.classList.add("header-column-hidden");
            }
          }
        });
      }
    };

    /**
     * トグルボタン状態の更新
     */
    PromptListManager.prototype.updateToggleButtonState = function (toggleBtn, isVisible) {
      const icon = toggleBtn.querySelector(".toggle-icon");
      const text = toggleBtn.querySelector(".toggle-text");

      if (icon) {
        icon.textContent = isVisible ? "👁️" : "🙈";
      }
      if (text) {
        text.textContent = isVisible ? "全て" : "非表示";
      }

      if (isVisible) {
        toggleBtn.classList.remove("buttons-hidden");
        toggleBtn.classList.add("buttons-visible");
      } else {
        toggleBtn.classList.remove("buttons-visible");
        toggleBtn.classList.add("buttons-hidden");
      }
    };

    /**
     * 個別ボタン設定の適用
     */
    PromptListManager.prototype.applyIndividualButtonSettings = function (listId, cleanListId) {
      const container = document.querySelector(listId);
      if (!container) return;

      const flexibleContainer = this.getFlexibleContainer(container);
      if (!flexibleContainer) return;

      const existingButtonTypes = new Set();
      const allButtons = flexibleContainer.querySelectorAll("button[data-action]");
      allButtons.forEach((button) => {
        const action = button.getAttribute("data-action");
        if (action && BUTTON_TYPES[action]) {
          existingButtonTypes.add(action);
        }
      });

      existingButtonTypes.forEach((buttonType) => {
        const storageKey = `buttonVisible_${cleanListId}_${buttonType}`;
        const isVisible = localStorage.getItem(storageKey) !== "false"; // デフォルトtrue

        if (!isVisible) {
          this.setButtonVisibility(listId, false, buttonType, cleanListId);
        } else {
          // 明示的に表示クラスを削除（全ボタン表示後の個別設定適用時に必要）
          flexibleContainer.classList.remove(`hide-${buttonType}-buttons`);
          this.updateHeaderButtonColumns(flexibleContainer, buttonType, true);
        }
      });

      this.checkAllButtonTypesHidden(flexibleContainer);
    };

    /**
     * 表示設定モーダルの表示
     */
    PromptListManager.prototype.showButtonSettingsModal = function (listId, cleanListId) {
      const existingModal = document.querySelector(".button-settings-modal");
      if (existingModal) {
        existingModal.remove();
      }

      const container = document.querySelector(listId);
      const availableButtons = new Set();

      if (container) {
        const buttons = container.querySelectorAll("button[data-action]");
        buttons.forEach((button) => {
          const action = button.getAttribute("data-action");
          if (action && BUTTON_TYPES[action]) {
            availableButtons.add(action);
          }
        });
      }

      if (availableButtons.size === 0) {
        return;
      }

      const availableColumns = new Set();
      if (container && typeof COLUMN_TYPES !== "undefined") {
        const detectedColumns = this.detectAvailableColumns(container);
        detectedColumns.forEach((col) => availableColumns.add(col));
      }

      const columnSettingsHTML =
        availableColumns.size > 0
          ? `
        <div class="column-settings-section">
          <div class="column-settings-section-title">列表示</div>
          ${Array.from(availableColumns)
            .map((columnType) => {
              const columnInfo = COLUMN_TYPES[columnType];
              const storageKey = `columnVisible_${cleanListId}_${columnType}`;
              const isVisible = localStorage.getItem(storageKey) !== "false";

              return `
              <div class="button-setting-item">
                <div class="button-setting-label">
                  <span>${columnInfo.icon}</span>
                  <span>${columnInfo.label}</span>
                </div>
                <div class="button-setting-toggle column-toggle ${isVisible ? "active" : ""}"
                     data-column-type="${columnType}"
                     data-list-id="${cleanListId}">
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      `
          : "";

      const modalHTML = `
        <div class="button-settings-modal">
          <div class="button-settings-content">
            <div class="button-settings-header">
              <span class="button-settings-title">表示設定</span>
              <button class="button-settings-close">×</button>
            </div>
            <div class="button-settings-list">
              <div class="column-settings-section-title">ボタン表示</div>
              ${Array.from(availableButtons)
                .map((buttonType) => {
                  const buttonInfo = BUTTON_TYPES[buttonType];
                  const storageKey = `buttonVisible_${cleanListId}_${buttonType}`;
                  const isVisible = localStorage.getItem(storageKey) !== "false";

                  return `
                  <div class="button-setting-item">
                    <div class="button-setting-label">
                      <span>${buttonInfo.icon}</span>
                      <span>${buttonInfo.label}</span>
                    </div>
                    <div class="button-setting-toggle ${isVisible ? "active" : ""}"
                         data-button-type="${buttonType}"
                         data-list-id="${cleanListId}">
                    </div>
                  </div>
                `;
                })
                .join("")}
              ${columnSettingsHTML}
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHTML);
      const modal = document.querySelector(".button-settings-modal");

      const closeBtn = modal.querySelector(".button-settings-close");
      const buttonToggles = modal.querySelectorAll(".button-setting-toggle:not(.column-toggle)");
      const columnToggles = modal.querySelectorAll(".button-setting-toggle.column-toggle");

      closeBtn.addEventListener("click", () => {
        modal.remove();
      });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      buttonToggles.forEach((toggle) => {
        toggle.addEventListener("click", () => {
          const buttonType = toggle.getAttribute("data-button-type");
          const currentActive = toggle.classList.contains("active");
          const newActive = !currentActive;

          const storageKey = `buttonVisible_${cleanListId}_${buttonType}`;
          localStorage.setItem(storageKey, newActive.toString());

          toggle.classList.toggle("active", newActive);
          this.setButtonVisibility(listId, newActive, buttonType);
        });
      });

      columnToggles.forEach((toggle) => {
        toggle.addEventListener("click", () => {
          const columnType = toggle.getAttribute("data-column-type");
          const currentActive = toggle.classList.contains("active");
          const newActive = !currentActive;

          const storageKey = `columnVisible_${cleanListId}_${columnType}`;
          localStorage.setItem(storageKey, newActive.toString());

          toggle.classList.toggle("active", newActive);
          this.setColumnVisibility(listId, newActive, columnType);
        });
      });
    };
  }

  defineButtonSettingsHandlers();
})();
