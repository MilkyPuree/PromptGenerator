(function () {
  "use strict";

  class SlotTabCardBuilder {
    constructor(slotTab) {
      this.slotTab = slotTab;
    }

    createSlotCard(info) {
      const card = UIFactory.createDiv();
      card.dataset.slotId = info.id;

      const slot = this.slotTab.slotManager.slots.find((s) => s.id === info.id);
      const isExtractionMode = slot?.mode === "random" || slot?.mode === "sequential";

      card.className = `slot-card ${
        info.isCurrent ? "slot-card-current" : ""
      } ${isExtractionMode ? "slot-card-extraction" : ""} ${
        info.isUsed ? "slot-card-used" : ""
      } ${slot.muted ? "slot-card-muted" : ""}`;

      const canDelete = this.slotTab.slotManager.slots.length > this.slotTab.slotManager.minSlots && !info.isCurrent;

      const weightConfig = WeightConverter.getWeightConfig(this.slotTab.getCurrentShaping());

      card.innerHTML = `
    <div class="slot-drag-handle">☰</div>
    <div class="slot-move-buttons">
      <button class="slot-move-up-btn" data-slot-id="${info.id}" title="このスロットを上に移動">↑</button>
      <button class="slot-move-down-btn" data-slot-id="${info.id}" title="このスロットを下に移動">↓</button>
    </div>

    <div class="slot-header">
      <div class="slot-header-left">
        <span class="slot-number ${info.isCurrent ? "slot-number-current" : ""}">
          ${info.displayNumber}
        </span>
        <input type="text"
               class="slot-name-edit"
               data-slot-id="${info.id}"
               value="${info.name || ""}"
               placeholder="スロット名を入力"
               title="スロットの識別用名前（空の場合は番号表示）">
      </div>
      <div class="slot-actions">
        <button class="slot-mute-btn" data-slot-id="${info.id}"
                title="${slot.muted ? "ミュート解除" : "ミュート"}">
          ${slot.muted ? "🔇" : "🔊"}
        </button>
        <button class="slot-clear-btn" data-slot-id="${info.id}" title="このスロットの内容をクリア">クリア</button>
        <button class="slot-delete-btn" data-slot-id="${info.id}"
                ${!canDelete ? "disabled" : ""}
                title="${!canDelete ? "現在のスロットまたは最小数未満のため削除不可" : "このスロットを削除"}">削除</button>
      </div>
    </div>

    <!-- モード選択ドロップダウンと重み表示 -->
    <div class="slot-mode-container">
      <div class="slot-control-group">
        <label class="slot-control-label">モード</label>
        <select class="slot-mode-select" data-slot-id="${info.id}"
                title="スロットの動作モード&#10;・複数要素: 固定プロンプト&#10;・単一要素: スペース区切りテキスト&#10;・ランダム抽出: 辞書からランダム選択&#10;・連続抽出: 辞書から順次選択">
          <option value="normal" ${!slot?.mode || slot.mode === "normal" ? "selected" : ""}>複数要素</option>
          <option value="single" ${slot?.mode === "single" ? "selected" : ""}>単一要素</option>
          <option value="random" ${slot?.mode === "random" ? "selected" : ""}>ランダム抽出</option>
          <option value="sequential" ${slot?.mode === "sequential" ? "selected" : ""}>連続抽出</option>
        </select>
      </div>
      <div class="slot-control-group">
        <label class="slot-control-label">重み</label>
        <input type="number"
               class="slot-weight-input"
               data-slot-id="${info.id}"
               value="${slot?.weight !== undefined ? slot.weight : this.slotTab.slotManager.getDefaultWeight()}"
               min="${weightConfig.min}"
               max="${weightConfig.max}"
               step="${weightConfig.delta}"
               title="${this.slotTab.getWeightTooltip()}"
               placeholder="重み">
      </div>
    </div>

    <!-- 通常モード用テキストエリア -->
    <div class="normal-mode-content" style="display: ${!isExtractionMode ? "block" : "none"};">
      <div class="slot-prompt-container">
        <textarea class="slot-prompt-edit"
                  data-slot-id="${info.id}"
                  placeholder="${info.isUsed ? "プロンプト内容" : "このスロットは空です"}"
                  title="${info.isUsed ? "スロットのプロンプト内容（複数行入力可能）" : "空のスロットです（クリアで有効化）"}"
                  ${!info.isUsed ? "disabled" : ""}>${
                    info.isUsed
                      ? this.slotTab.slotManager.getSlotDisplayValue(this.slotTab.slotManager.slots.find((s) => s.id === info.id)) || ""
                      : ""
                  }</textarea>
        ${
          info.isUsed
            ? `<div class="slot-char-count">${
                this.slotTab.slotManager.slots.find((s) => s.id === info.id)?.prompt?.length || 0
              } 文字</div>`
            : ""
        }
      </div>
    </div>

    <!-- 抽出モード用カテゴリー選択 -->
    <div class="extraction-mode-content" style="display: ${isExtractionMode ? "block" : "none"};">
      <div class="extraction-controls">
        <!-- 抽出元設定（スロット専用2行形式） -->
        <div class="slot-extraction-table">
          <!-- ヘッダー行 -->
          <div class="slot-extraction-header">
            <div class="slot-header-cell datasource">データソース</div>
            <div class="slot-header-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">大項目</div>
            <div class="slot-header-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">中項目</div>
            <div class="slot-header-cell category ${(slot?.dataSource || "dictionary") === "dictionary" ? "hidden" : ""}">お気に入り</div>
          </div>

          <!-- データ行 -->
          <div class="slot-extraction-data">
            <div class="slot-data-cell datasource">
              <select class="data-source-select" data-slot-id="${info.id}" title="抽出元のデータソースを選択">
                <option value="dictionary">${UI_LABELS.EXTRACTION_SOURCE_DICTIONARY}</option>
                <option value="favorites">${UI_LABELS.EXTRACTION_SOURCE_FAVORITES}</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">
              <select class="category-big-select" data-slot-id="${info.id}" title="抽出する大カテゴリを選択（空白ですべて）">
                <option value="">すべて</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || "dictionary") === "favorites" ? "hidden" : ""}">
              <select class="category-middle-select" data-slot-id="${info.id}"
                      ${!slot?.category?.big ? "disabled" : ""}>
                <option value="">すべて</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || "dictionary") === "dictionary" ? "hidden" : ""}">
              <select class="favorites-select" data-slot-id="${info.id}">
              </select>
            </div>
          </div>
        </div>
        </div>
      </div>
      ${
        slot?.mode === "sequential"
          ? `<div class="sequential-info">
              <label class="sequential-label">現在のインデックス:</label>
              <input type="number" class="sequential-index-input"
                     data-slot-id="${info.id}"
                     value="${slot.sequentialIndex || 0}"
                     min="0"
                     step="1">
              <span class="sequential-help">（0から開始）</span>
            </div>`
          : ""
      }
      <div class="current-extraction-display">
        ${
          slot?.currentExtraction
            ? `<div class="extraction-display-content">
                <strong>現在:</strong> ${slot.currentExtraction}
                ${slot.currentExtractionSmall ? `<br><small class="extraction-small-item">小項目: ${slot.currentExtractionSmall}</small>` : ""}
                <span class="extraction-timestamp">${
                  slot.lastExtractionTime ? new Date(slot.lastExtractionTime).toLocaleTimeString() : ""
                }</span>
              </div>`
            : ""
        }
      </div>
    </div>
  `;

      if (isExtractionMode) {
        this.setupDataSourceSelector(card, slot);
        this.setupCategorySelectors(card, slot);
      }

      if (slot?.mode === "sequential") {
        const sequentialInput = card.querySelector(".sequential-index-input");
        if (sequentialInput) {
          this.setupSequentialIndexControls(sequentialInput, slot);
        }
      }

      const weightInput = card.querySelector(".slot-weight-input");
      if (weightInput) {
        this.setupWeightInputControls(weightInput);
      }

      this.setupMoveButtons(card, info);

      return card;
    }

    setupWeightInputControls(weightInput) {
      const currentShaping = this.slotTab.getCurrentShaping();
      const weightConfig = WeightConverter.getWeightConfig(currentShaping);

      weightInput.min = weightConfig.min;
      weightInput.max = weightConfig.max;
      weightInput.step = weightConfig.delta;

      weightInput.addEventListener("wheel", (e) => {
        e.preventDefault();

        const rawValue = weightInput.value;
        const parsedValue = parseFloat(rawValue);
        const currentValue = parsedValue || 0;
        let delta = weightConfig.delta;

        if (e.shiftKey) {
          delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
        } else if (e.ctrlKey) {
          delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
        }

        const direction = e.deltaY > 0 ? -1 : 1;
        const newValue = currentValue + direction * delta;

        const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

        weightInput.value = Math.round(clampedValue * 100) / 100;

        weightInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      weightInput.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();

          const currentValue = parseFloat(weightInput.value) || 0;
          let delta = weightConfig.delta;

          if (e.shiftKey) {
            delta *= WEIGHT_CONFIG.SHIFT_MULTIPLIER;
          } else if (e.ctrlKey) {
            delta *= WEIGHT_CONFIG.CTRL_MULTIPLIER;
          }

          const direction = e.key === "ArrowUp" ? 1 : -1;
          const newValue = currentValue + delta * direction;

          const clampedValue = Math.max(weightConfig.min, Math.min(weightConfig.max, newValue));

          weightInput.value = Math.round(clampedValue * 100) / 100;

          weightInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    }

    setupSequentialIndexControls(sequentialInput, slot) {
      sequentialInput.addEventListener("change", (e) => {
        const newIndex = parseInt(e.target.value, 10);

        if (isNaN(newIndex) || newIndex < 0) {
          e.target.value = slot.sequentialIndex || 0;
          return;
        }

        slot.sequentialIndex = newIndex;

        this.slotTab.slotManager.saveToStorage();
      });

      sequentialInput.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();

          const currentValue = parseInt(sequentialInput.value, 10) || 0;
          const direction = e.key === "ArrowUp" ? 1 : -1;
          let newValue = currentValue + direction;

          newValue = Math.max(0, newValue);

          sequentialInput.value = newValue;

          sequentialInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      sequentialInput.addEventListener("wheel", (e) => {
        e.preventDefault();

        const currentValue = parseInt(sequentialInput.value, 10) || 0;
        const direction = e.deltaY > 0 ? -1 : 1;
        let newValue = currentValue + direction;

        newValue = Math.max(0, newValue);

        sequentialInput.value = newValue;

        sequentialInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    setupMoveButtons(card, info) {
      const moveUpBtn = card.querySelector(".slot-move-up-btn");
      const moveDownBtn = card.querySelector(".slot-move-down-btn");

      if (!moveUpBtn || !moveDownBtn) return;

      const slotIndex = this.slotTab.slotManager.slots.findIndex((s) => s.id === info.id);
      const totalSlots = this.slotTab.slotManager.slots.length;

      if (slotIndex === 0) {
        moveUpBtn.disabled = true;
      } else {
        moveUpBtn.addEventListener("click", () => this.slotTab.moveSlot(info.id, "up"));
      }

      if (slotIndex === totalSlots - 1) {
        moveDownBtn.disabled = true;
      } else {
        moveDownBtn.addEventListener("click", () => this.slotTab.moveSlot(info.id, "down"));
      }
    }

    setupDataSourceSelector(card, slot) {
      const dataSourceSelect = card.querySelector(".data-source-select");
      const favoritesSelect = card.querySelector(".favorites-select");
      const dictionarySelection = card.querySelector(".dictionary-selection");
      const favoritesSelection = card.querySelector(".favorites-selection");

      if (!dataSourceSelect) return;

      dataSourceSelect.value = slot.dataSource || "dictionary";

      this.populateFavoritesOptions(favoritesSelect);

      if (favoritesSelect && slot.favoriteDictionaryId) {
        favoritesSelect.value = slot.favoriteDictionaryId;
      }

      this.toggleDataSourceUI(card, slot.dataSource || "dictionary");

      dataSourceSelect.addEventListener("change", async (e) => {
        const newDataSource = e.target.value;
        slot.dataSource = newDataSource;

        this.toggleDataSourceUI(card, newDataSource);

        if (newDataSource === "favorites") {
          const allDictionaries = AppState.data.promptDictionaries || {};
          const firstDictionaryId = Object.keys(allDictionaries)[0] || "";

          slot.favoriteDictionaryId = firstDictionaryId;
          if (favoritesSelect) {
            favoritesSelect.value = firstDictionaryId;
          }
        } else {
          slot.category = { big: "", middle: "" };
          const bigSelect = card.querySelector(".category-big-select");
          const middleSelect = card.querySelector(".category-middle-select");
          if (bigSelect) bigSelect.value = "";
          if (middleSelect) middleSelect.value = "";
        }

        if (slot.mode === "sequential") {
          slot.sequentialIndex = 0;
          const indexSpan = card.querySelector(".sequential-index");
          if (indexSpan) {
            indexSpan.textContent = "0";
          }
        }

        await this.slotTab.slotManager.saveToStorage();
      });

      if (favoritesSelect) {
        favoritesSelect.addEventListener("change", async (e) => {
          slot.favoriteDictionaryId = e.target.value;

          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotTab.slotManager.saveToStorage();
        });
      }
    }

    toggleDataSourceUI(card, dataSource) {
      const headerCells = card.querySelectorAll(".slot-header-cell.category");
      const dataCells = card.querySelectorAll(".slot-data-cell.category");

      if (dataSource === "favorites") {
        headerCells.forEach((cell, index) => {
          if (index < 2) {
            cell.classList.add("hidden");
          } else {
            cell.classList.remove("hidden");
          }
        });
        dataCells.forEach((cell, index) => {
          if (index < 2) {
            cell.classList.add("hidden");
          } else {
            cell.classList.remove("hidden");
          }
        });
      } else {
        headerCells.forEach((cell, index) => {
          if (index < 2) {
            cell.classList.remove("hidden");
          } else {
            cell.classList.add("hidden");
          }
        });
        dataCells.forEach((cell, index) => {
          if (index < 2) {
            cell.classList.remove("hidden");
          } else {
            cell.classList.add("hidden");
          }
        });
      }
    }

    populateFavoritesOptions(favoritesSelect) {
      if (!favoritesSelect) return;

      const allDictionaries = AppState.data.promptDictionaries || {};
      const dictionaryIds = Object.keys(allDictionaries);

      const firstDictionaryId = dictionaryIds.length > 0 ? dictionaryIds[0] : "";

      favoritesSelect.innerHTML = "";

      dictionaryIds.forEach((dictId) => {
        const dict = allDictionaries[dictId];
        if (dict && dict.name) {
          const option = UIFactory.createOption({
            value: dictId,
            text: dict.name,
          });
          favoritesSelect.appendChild(option);
        }
      });

      if (firstDictionaryId) {
        favoritesSelect.value = firstDictionaryId;

        const slotId = parseInt(favoritesSelect.dataset.slotId);
        const slot = this.slotTab.slotManager.slots.find((s) => s.id === slotId);
        if (slot && !slot.favoriteDictionaryId) {
          slot.favoriteDictionaryId = firstDictionaryId;
        }
      }
    }

    setupCategorySelectors(card, slot) {
      const bigSelect = card.querySelector(".category-big-select");
      const middleSelect = card.querySelector(".category-middle-select");

      if (!bigSelect) return;

      bigSelect.innerHTML = '<option value="">すべて</option>';
      const bigCategories = this.getCategoryOptions("big");

      bigCategories.forEach((cat) => {
        const option = UIFactory.createOption({
          value: cat,
          text: cat,
        });
        bigSelect.appendChild(option);
      });

      requestAnimationFrame(() => {
        if (slot.category && slot.category.big) {
          bigSelect.value = slot.category.big;
          this.updateCategoryTooltip(bigSelect);
          this.updateMiddleCategories(middleSelect, slot.category.big);
          middleSelect.disabled = false;

          if (slot.category.middle) {
            requestAnimationFrame(() => {
              middleSelect.value = slot.category.middle;
              this.updateCategoryTooltip(middleSelect);
            });
          }
        }
        this.updateCategoryTooltip(bigSelect);
        this.updateCategoryTooltip(middleSelect);
      });

      bigSelect.addEventListener("change", async (e) => {
        if (!slot.category) {
          slot.category = {};
        }
        slot.category.big = e.target.value;
        slot.category.middle = "";

        if (e.target.value) {
          this.updateMiddleCategories(middleSelect, e.target.value);
          middleSelect.disabled = false;

          setTimeout(() => {
            if (middleSelect && !middleSelect.disabled) {
              middleSelect.focus();

              try {
                if (typeof middleSelect.showPicker === "function") {
                  middleSelect.showPicker();
                } else {
                  const spaceEvent = new KeyboardEvent("keydown", {
                    key: " ",
                    code: "Space",
                    keyCode: 32,
                    which: 32,
                    bubbles: true,
                  });
                  middleSelect.dispatchEvent(spaceEvent);
                }
              } catch (error) {
                middleSelect.classList.add("select-focus-highlight");

                setTimeout(() => {
                  middleSelect.classList.remove("select-focus-highlight");
                }, 1000);
              }
            }
          }, 150);
        } else {
          middleSelect.innerHTML = '<option value="">すべて</option>';
          middleSelect.disabled = true;
        }

        this.updateCategoryTooltip(bigSelect);
        this.updateCategoryTooltip(middleSelect);

        if (slot.mode === "sequential") {
          slot.sequentialIndex = 0;
          const indexSpan = card.querySelector(".sequential-index");
          if (indexSpan) {
            indexSpan.textContent = "0";
          }
        }

        await this.slotTab.slotManager.saveToStorage();
      });

      middleSelect.addEventListener("change", async (e) => {
        if (!slot.category) {
          slot.category = {};
        }
        slot.category.middle = e.target.value;

        this.updateCategoryTooltip(middleSelect);

        if (slot.mode === "sequential") {
          slot.sequentialIndex = 0;
          const indexSpan = card.querySelector(".sequential-index");
          if (indexSpan) {
            indexSpan.textContent = "0";
          }
        }

        await this.slotTab.slotManager.saveToStorage();
      });
    }

    updateCategoryTooltip(selectElement) {
      if (!selectElement) return;

      const selectedOption = selectElement.options[selectElement.selectedIndex];
      if (selectedOption && selectedOption.value) {
        selectElement.title = selectedOption.text;
      } else {
        selectElement.title = "カテゴリーが選択されていません";
      }
    }

    getCategoryOptions(type) {
      if (type === "big") {
        return this.slotTab.categoryUIManager.getCategoriesByLevel(0, null);
      }
      return [];
    }

    updateMiddleCategories(select, bigCategory) {
      this.slotTab.categoryUIManager.populateSelectElement(select, 1, bigCategory, "すべて");
    }
  }

  if (typeof window !== "undefined") {
    window.SlotTabCardBuilder = SlotTabCardBuilder;
  }
})();
