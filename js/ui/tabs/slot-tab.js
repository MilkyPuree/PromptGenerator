/**
 * slot-tab.js - スロットタブモジュール
 * Phase 8.5: 複数プロンプトスロット管理
 * Phase 9: BaseModal統合完了
 */

// TabManagerが利用可能になるまで待つ
(function () {
  "use strict";

  // TabManagerが定義されるまで待機
  function defineSlotTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineSlotTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    // SlotTabクラスの定義
    class SlotTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "slotTabBody",
          tabButtonId: "slotTab",
          tabIndex: 4, // CONSTANTS.TABS.SLOT
        });

        // スロットマネージャーへの参照
        this.slotManager = null;
        this.groupManager = null;
        
        // モーダル管理
        this.groupManagementModal = null;
        
        // 編集状態管理
        this.isGroupEditing = false;

        // DOM要素のキャッシュ
        this.elements = {
          container: null,
          clearAllBtn: null,
          exportBtn: null,
          importBtn: null,
          groupSelector: null,
          groupDescription: null,
          groupManageBtn: null,
          groupModal: null,
          groupCreateBtn: null,
          groupCopyBtn: null,
          groupEditBtn: null,
          groupDeleteBtn: null,
          exportGroupBtn: null,
          importGroupBtn: null,
        };
      }

      /**
       * 初期化処理
       */
      async onInit() {
        // スロットマネージャーの初期化を待機
        await this.waitForSlotManagers();
        
        // スロットマネージャーの参照を取得
        this.slotManager = window.promptSlotManager;
        if (!this.slotManager) {
          throw new Error("PromptSlotManager not found after waiting");
        }

        // グループマネージャーの参照を取得
        this.groupManager = window.slotGroupManager;
        if (!this.groupManager) {
          throw new Error("SlotGroupManager not found after waiting");
        }

        // グループマネージャーを初期化
        await this.groupManager.initialize();

        // CategoryUIManagerを初期化（検索タブと同じ方式）
        this.categoryUIManager = new CategoryUIManager();

        // 初回読み込み時にスロット情報を確実に取得
        if (!this.slotManager.slots || this.slotManager.slots.length === 0) {
          console.log("Slots not loaded, loading from storage...");
          await this.slotManager.loadFromStorage();
        }

        // DOM要素をキャッシュ
        this.cacheElements();
        
        // BaseModalを初期化
        this.initModal();

        // イベントリスナーを設定
        this.setupEventListeners();

        // 固定ボタンのイベントリスナーを設定（追加）
        this.setupFixedButtonListeners();

        // グループ管理のイベントリスナーを設定
        this.setupGroupEventListeners();

        // 初期表示を更新
        this.updateDisplay();

        // グループ表示を更新
        this.updateGroupDisplay();

        // 抽出完了イベントのリスナーを設定
        this.setupExtractionListeners();

        // shaping設定変更のリスナーを設定
        this.setupShapingChangeListener();
        
        // スロットタブ独自の記法状態を保存
        this.currentShapingMode = this.getCurrentShaping();
        
        // 初期化完了後に高さ調整（DOM構築完了後）
        setTimeout(() => {
          this.adjustContainerHeight();
        }, 100);
      }

      /**
       * 固定ボタンのイベントリスナーを設定
       */
      setupFixedButtonListeners() {
        
        // スロット追加ボタン
        const addBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_ADD_BTN);
        if (addBtn) {
          addBtn.addEventListener("click", () => {
            this.slotManager.addNewSlot();
            this.updateDisplay();
          });
        }

        // 結合プレビューボタン（IDを修正）
        const previewBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_PREVIEW_BTN);
        if (previewBtn) {
          previewBtn.addEventListener("click", () => {
            this.showCombinePreview();
          });
        } else {
        }

        // すべてクリアボタン
        const clearAllBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CLEAR_ALL_BTN);
        if (clearAllBtn) {
          clearAllBtn.addEventListener("click", () => {
            this.handleClearAll();
          });
        }

      }

      /**
       * 抽出イベントのリスナー設定
       */
      setupExtractionListeners() {
        // 個別のスロット抽出完了
        window.addEventListener("slotExtractionComplete", (event) => {
          this.updateSlotExtraction(
            event.detail.slotId,
            event.detail.extraction
          );
        });

        // 全体の抽出完了（Generate後）
        window.addEventListener("allExtractionsComplete", () => {
          if (this.isCurrentTab()) {
            // 現在スロットタブが表示されている場合のみ更新
            this.refreshExtractionDisplays();
          }
        });
        
        // スロットモード変更時のイベントリスナー追加
        window.addEventListener("slotModeChanged", (event) => {
          this.updateDisplay();
          
          // 編集タブに変更を通知（初期化済みの場合のみ）
          if (this.app.tabs.edit && this.app.tabs.edit.initialized) {
            this.app.tabs.edit.checkExtractionMode();
          }
          
          // 現在のスロットが通常モードに戻った場合、GeneratePromptを通常モードに戻す
          const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];
          if (currentSlot && event.detail.slotId === currentSlot.id && event.detail.mode === "normal") {
            const generatePrompt = document.getElementById("generatePrompt");
            if (generatePrompt) {
              generatePrompt.value = currentSlot.prompt || "";
              generatePrompt.readOnly = false;
              generatePrompt.title = "";
            }
          }
        });
      }

      /**
       * shaping設定変更のリスナー設定
       */

      /**
       * 現在のタブかどうかを確認
       */
      isCurrentTab() {
        const slotTab = this.getElement(DOM_SELECTORS.BY_ID.SLOT_TAB);
        return slotTab && slotTab.classList.contains("is-active");
      }

      /**
       * DOM要素をキャッシュ
       */
      cacheElements() {
        this.elements.container = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CONTAINER);
        this.elements.clearAllBtn = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CLEAR_ALL_BTN);
        
        // 新しいUI要素
        this.elements.groupSelector = document.getElementById('slot-group-selector');
        this.elements.groupDescription = document.getElementById('slot-group-description-compact');
        this.elements.groupManageBtn = document.getElementById('slot-group-manage-btn');
        this.elements.groupModal = document.getElementById('slot-group-management-modal');
        
        // モーダル内の要素
        this.elements.groupCreateBtn = document.getElementById('slot-group-create-btn');
        this.elements.groupCopyBtn = document.getElementById('slot-group-copy-btn');
        this.elements.groupEditBtn = document.getElementById('slot-group-edit-btn');
        this.elements.groupDeleteBtn = document.getElementById('slot-group-delete-btn');
        this.elements.exportBtn = document.getElementById('export-slots');
        this.elements.importBtn = document.getElementById('import-slots');
        this.elements.exportGroupBtn = document.getElementById('export-group');
        this.elements.importGroupBtn = document.getElementById('import-group');
      }

      /**
       * スロット情報を更新
       */
      updateDisplay() {
        // 編集中の場合は更新をスキップ
        if (this.isGroupEditing) {
          return;
        }
        
        const container = this.elements.container;
        if (!container) return;

        console.log(
          "Updating slot display with slots:",
          this.slotManager.slots
        );

        // スロットグループのインポート・エクスポートボタンを追加（ビューポート外）
        this.addSlotImportExportButtons();

        container.innerHTML = "";

        // 使用中のスロット数を更新
        const usedCount = this.slotManager.getUsedSlotsCount();
        const totalCount = this.slotManager.slots.length;
        const countSpan = this.getElement(DOM_SELECTORS.BY_ID.SLOT_USED_COUNT);
        if (countSpan) {
          countSpan.textContent = `${usedCount}/${totalCount}`;
        }

        // 各スロットのカードを作成
        this.slotManager.slots.forEach((slot, index) => {
          console.log(`Creating card for slot ${slot.id}:`, {
            mode: slot.mode,
            category: slot.category,
          });

          const info = this.slotManager.getSlotInfo(slot.id);
          // 表示番号を現在の順序に基づいて上書き
          info.displayNumber = index + 1;
          const slotCard = this.createSlotCard(info);
          container.appendChild(slotCard);
        });

        // ソート機能を設定
        this.setupSortable();
        
        // 動的な高さ調整
        this.adjustContainerHeight();
        
        // 重み入力フィールドの設定を更新（shaping変更対応）
        setTimeout(() => {
          this.updateWeightInputFields();
        }, 10);
      }

      /**
       * スロットカードを作成
       */
      createSlotCard(info) {
        const card = UIFactory.createDiv();
        card.dataset.slotId = info.id;

        // 現在のスロットの設定を取得
        const slot = this.slotManager.slots.find((s) => s.id === info.id);
        const isExtractionMode =
          slot?.mode === "random" || slot?.mode === "sequential";

        // カードのクラスを設定
        card.className = `slot-card ${
          info.isCurrent ? "slot-card-current" : ""
        } ${isExtractionMode ? "slot-card-extraction" : ""} ${
          info.isUsed ? "slot-card-used" : ""
        } ${slot.muted ? "slot-card-muted" : ""}`;

        // 削除ボタンの無効化判定
        const canDelete =
          this.slotManager.slots.length > this.slotManager.minSlots &&
          !info.isCurrent;

        // 重み設定を取得
        const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());

        card.innerHTML = `
    <div class="slot-drag-handle">☰</div>

    <div class="slot-header">
      <div class="slot-header-left">
        <span class="slot-number ${
          info.isCurrent ? "slot-number-current" : ""
        }">
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
               value="${slot?.weight !== undefined ? slot.weight : this.slotManager.getDefaultWeight()}"
               min="${weightConfig.min}" 
               max="${weightConfig.max}" 
               step="${weightConfig.delta}"
               title="${this.getWeightTooltip()}"
               placeholder="重み">
      </div>
    </div>

    <!-- 通常モード用テキストエリア -->
    <div class="normal-mode-content" style="display: ${
      !isExtractionMode ? "block" : "none"
    };">
      <div class="slot-prompt-container">
        <textarea class="slot-prompt-edit"
                  data-slot-id="${info.id}"
                  placeholder="${
                    info.isUsed ? "プロンプト内容" : "このスロットは空です"
                  }"
                  title="${info.isUsed ? "スロットのプロンプト内容（複数行入力可能）" : "空のスロットです（クリアで有効化）"}"
                  ${!info.isUsed ? "disabled" : ""}>${
          info.isUsed
            ? this.slotManager.getSlotDisplayValue(this.slotManager.slots.find((s) => s.id === info.id)) || ""
            : ""
        }</textarea>
        ${
          info.isUsed
            ? `<div class="slot-char-count">${
                this.slotManager.slots.find((s) => s.id === info.id)?.prompt
                  ?.length || 0
              } 文字</div>`
            : ""
        }
      </div>
    </div>

    <!-- 抽出モード用カテゴリー選択 -->
    <div class="extraction-mode-content" style="display: ${
      isExtractionMode ? "block" : "none"
    };">
      <div class="extraction-controls">
        <!-- 抽出元設定（スロット専用2行形式） -->
        <div class="slot-extraction-table">
          <!-- ヘッダー行 -->
          <div class="slot-extraction-header">
            <div class="slot-header-cell datasource">データソース</div>
            <div class="slot-header-cell category ${(slot?.dataSource || 'dictionary') === 'favorites' ? 'hidden' : ''}">大項目</div>
            <div class="slot-header-cell category ${(slot?.dataSource || 'dictionary') === 'favorites' ? 'hidden' : ''}">中項目</div>
            <div class="slot-header-cell category ${(slot?.dataSource || 'dictionary') === 'dictionary' ? 'hidden' : ''}">お気に入り</div>
          </div>
          
          <!-- データ行 -->
          <div class="slot-extraction-data">
            <div class="slot-data-cell datasource">
              <select class="data-source-select" data-slot-id="${info.id}" title="抽出元のデータソースを選択">
                <option value="dictionary">${UI_LABELS.EXTRACTION_SOURCE_DICTIONARY}</option>
                <option value="favorites">${UI_LABELS.EXTRACTION_SOURCE_FAVORITES}</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || 'dictionary') === 'favorites' ? 'hidden' : ''}">
              <select class="category-big-select" data-slot-id="${info.id}" title="抽出する大カテゴリを選択（空白ですべて）">
                <option value="">すべて</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || 'dictionary') === 'favorites' ? 'hidden' : ''}">
              <select class="category-middle-select" data-slot-id="${info.id}"
                      ${!slot?.category?.big ? "disabled" : ""}>
                <option value="">すべて</option>
              </select>
            </div>
            <div class="slot-data-cell category ${(slot?.dataSource || 'dictionary') === 'dictionary' ? 'hidden' : ''}">
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
                  slot.lastExtractionTime
                    ? new Date(slot.lastExtractionTime).toLocaleTimeString()
                    : ""
                }</span>
              </div>`
            : ""
        }
      </div>
    </div>
  `;

        // データソースとカテゴリー選択肢を設定
        if (isExtractionMode) {
          this.setupDataSourceSelector(card, slot);
          this.setupCategorySelectors(card, slot);
        }


        // 連続抽出モードの場合、インデックス入力フィールドのイベントリスナーを追加
        if (slot?.mode === "sequential") {
          const sequentialInput = card.querySelector('.sequential-index-input');
          if (sequentialInput) {
            this.setupSequentialIndexControls(sequentialInput, slot);
          }
        }

        // 重み入力フィールドのホイール・キーボード操作を設定
        const weightInput = card.querySelector('.slot-weight-input');
        if (weightInput) {
          this.setupWeightInputControls(weightInput);
        }

        return card;
      }


      /**
       * スロット重み入力フィールドにキーボード・ホイール操作を設定
       */
      setupWeightInputControls(weightInput) {
        const currentShaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(currentShaping);
        
        
        // HTML属性を現在の設定に更新
        weightInput.min = weightConfig.min;
        weightInput.max = weightConfig.max;
        weightInput.step = weightConfig.delta;
        
        
        // ホイールイベント
        weightInput.addEventListener('wheel', (e) => {
          e.preventDefault(); // ページスクロールを防ぐ
          
          const rawValue = weightInput.value;
          const parsedValue = parseFloat(rawValue);
          const currentValue = parsedValue || 0;
          let delta = weightConfig.delta;
          
          
          // 修飾キーによるdelta調整
          if (e.shiftKey) {
            delta *= 10; // Shift: 大きく変更
          } else if (e.ctrlKey) {
            delta /= 10; // Ctrl: 細かく変更
          }
          
          // ホイールの方向に応じて値を増減
          const direction = e.deltaY > 0 ? -1 : 1;
          const newValue = currentValue + (direction * delta);
          
          
          // 範囲内に制限
          const clampedValue = Math.max(
            weightConfig.min,
            Math.min(weightConfig.max, newValue)
          );
          
          
          // 値を設定（適切な小数点精度で丸める）
          weightInput.value = Math.round(clampedValue * 100) / 100;
          
          // 変更イベントを発火して保存処理をトリガー
          weightInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        
        // 矢印キーイベント
        weightInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            
            const currentValue = parseFloat(weightInput.value) || 0;
            let delta = weightConfig.delta;
            
            // 修飾キーによるdelta調整
            if (e.shiftKey) {
              delta *= 10;
            } else if (e.ctrlKey) {
              delta /= 10;
            }
            
            const direction = e.key === 'ArrowUp' ? 1 : -1;
            const newValue = currentValue + (delta * direction);
            
            // 範囲内に制限
            const clampedValue = Math.max(
              weightConfig.min,
              Math.min(weightConfig.max, newValue)
            );
            
            // 値を設定（適切な小数点精度で丸める）
            weightInput.value = Math.round(clampedValue * 100) / 100;
            
            // 変更イベントを発火
            weightInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      /**
       * 連続抽出インデックス入力フィールドのイベントリスナーを設定
       */
      setupSequentialIndexControls(sequentialInput, slot) {
        // 値変更時のイベント
        sequentialInput.addEventListener('change', (e) => {
          const newIndex = parseInt(e.target.value, 10);
          
          // バリデーション
          if (isNaN(newIndex) || newIndex < 0) {
            e.target.value = slot.sequentialIndex || 0;
            return;
          }
          
          // スロットのインデックスを更新
          slot.sequentialIndex = newIndex;
          
          // データを保存
          this.saveSlotData();
          
        });

        // 矢印キーでの増減
        sequentialInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            
            const currentValue = parseInt(sequentialInput.value, 10) || 0;
            const direction = e.key === 'ArrowUp' ? 1 : -1;
            let newValue = currentValue + direction;
            
            // 最小値制限
            newValue = Math.max(0, newValue);
            
            sequentialInput.value = newValue;
            
            // 変更イベントを発火
            sequentialInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        // マウスホイールでの増減
        sequentialInput.addEventListener('wheel', (e) => {
          e.preventDefault();
          
          const currentValue = parseInt(sequentialInput.value, 10) || 0;
          const direction = e.deltaY > 0 ? -1 : 1;
          let newValue = currentValue + direction;
          
          // 最小値制限
          newValue = Math.max(0, newValue);
          
          sequentialInput.value = newValue;
          
          // 変更イベントを発火
          sequentialInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      /**
       * 重み設定を取得（WeightConverterを使用）
       */

      /**
       * 現在のshaping設定を取得
       */
      getCurrentShaping() {
        if (typeof AppState !== 'undefined' && AppState.userSettings?.optionData?.shaping) {
          return AppState.userSettings.optionData.shaping;
        }
        return 'SD';
      }

      setupShapingChangeListener() {
        
        const shapingInputs = document.querySelectorAll('[name="UIType"]');
        
        shapingInputs.forEach((input, index) => {
          
          // TabManagerのaddEventListenerメソッドを使用
          this.addEventListener(input, 'change', async (event) => {
            
            // スロットタブがアクティブな場合のみ処理
            if (AppState.ui.currentTab === CONSTANTS.TABS.SLOT) {
              const newShaping = event.target.value;
              const oldShaping = this.currentShapingMode || 'SD';
              
              
              // 異なる値の場合のみ処理
              if (oldShaping !== newShaping) {
                // 状態を更新
                this.currentShapingMode = newShaping;
                await this.handleShapingChange(event, oldShaping);
              } else {
              }
            }
          });
        });
      }

      /**
       * shaping設定変更時の処理
       */
      async handleShapingChange(event, oldShaping = null) {
        
        // 編集タブと同様に、より確実なアクティブ状態チェック
        const isSlotTabActive = AppState.ui.currentTab === CONSTANTS.TABS.SLOT;
        
        if (!isSlotTabActive) {
          return;
        }
        
        const newShaping = event.target.value;
        // 変更前の値を使用（引数から受け取るか、現在の値を使用）
        const previousShaping = oldShaping || (AppState.userSettings?.optionData?.shaping || 'SD');
        
        
        if (newShaping === previousShaping) {
          return;
        }
        
        
        // 既存スロットの重み値を新形式に変換
        this.updateSlotWeightsForNewShaping(previousShaping, newShaping);
        
        
        // スロットカードを再描画（重み値の更新を含む）
        this.updateDisplay();
        
        // 重み入力フィールドの設定を更新（再描画後に実行）
        this.updateWeightInputFields();
        
        
        // 変更通知
        if (window.ErrorHandler) {
          window.ErrorHandler.notify(`重み記法を${newShaping}形式に変更しました`, {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: 'info',
            duration: 2000
          });
        }
      }

      /**
       * 重み入力フィールドの設定を更新
       */
      updateWeightInputFields() {
        const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());
        const weightInputs = document.querySelectorAll('.slot-weight-input');


        weightInputs.forEach(input => {
          input.step = weightConfig.delta;
          input.min = weightConfig.min;
          input.max = weightConfig.max;
          
        });
      }

      /**
       * データソースセレクターを設定
       */
      setupDataSourceSelector(card, slot) {
        const dataSourceSelect = card.querySelector(".data-source-select");
        const favoritesSelect = card.querySelector(".favorites-select");
        const dictionarySelection = card.querySelector(".dictionary-selection");
        const favoritesSelection = card.querySelector(".favorites-selection");

        if (!dataSourceSelect) return;

        // 初期値を設定
        dataSourceSelect.value = slot.dataSource || 'dictionary';

        // お気に入りリストのオプションを追加
        this.populateFavoritesOptions(favoritesSelect);

        // 既存スロットのお気に入り辞書IDを設定
        if (favoritesSelect && slot.favoriteDictionaryId) {
          favoritesSelect.value = slot.favoriteDictionaryId;
        }

        // 初期表示を設定
        this.toggleDataSourceUI(card, slot.dataSource || 'dictionary');

        // データソース選択イベントリスナー
        dataSourceSelect.addEventListener("change", async (e) => {
          const newDataSource = e.target.value;
          slot.dataSource = newDataSource;

          // UIの表示切り替え
          this.toggleDataSourceUI(card, newDataSource);

          // 抽出設定をリセット
          if (newDataSource === 'favorites') {
            // お気に入りに切り替えた時は最初の辞書を自動選択
            const allDictionaries = AppState.data.promptDictionaries || {};
            const firstDictionaryId = Object.keys(allDictionaries)[0] || '';
            
            slot.favoriteDictionaryId = firstDictionaryId;
            if (favoritesSelect) {
              favoritesSelect.value = firstDictionaryId;
            }
          } else {
            slot.category = { big: '', middle: '' };
            const bigSelect = card.querySelector(".category-big-select");
            const middleSelect = card.querySelector(".category-middle-select");
            if (bigSelect) bigSelect.value = '';
            if (middleSelect) middleSelect.value = '';
          }

          // 連続抽出モードの場合はインデックスをリセット
          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotManager.saveToStorage();
        });

        // お気に入り選択イベントリスナー
        if (favoritesSelect) {
          favoritesSelect.addEventListener("change", async (e) => {
            slot.favoriteDictionaryId = e.target.value;

            // 連続抽出モードの場合はインデックスをリセット
            if (slot.mode === "sequential") {
              slot.sequentialIndex = 0;
              const indexSpan = card.querySelector(".sequential-index");
              if (indexSpan) {
                indexSpan.textContent = "0";
              }
            }

            await this.slotManager.saveToStorage();
          });
        }
      }

      /**
       * データソースUIの表示切り替え
       */
      toggleDataSourceUI(card, dataSource) {
        // 新しいスロット専用のテーブルのセル表示切り替え
        const headerCells = card.querySelectorAll(".slot-header-cell.category");
        const dataCells = card.querySelectorAll(".slot-data-cell.category");

        if (dataSource === 'favorites') {
          // お気に入りモード：辞書関連を隠して、お気に入りを表示
          headerCells.forEach((cell, index) => {
            if (index < 2) { // 大項目・中項目のヘッダー
              cell.classList.add('hidden');
            } else { // お気に入りのヘッダー
              cell.classList.remove('hidden');
            }
          });
          dataCells.forEach((cell, index) => {
            if (index < 2) { // 大項目・中項目のデータ
              cell.classList.add('hidden');
            } else { // お気に入りのデータ
              cell.classList.remove('hidden');
            }
          });
        } else {
          // 辞書モード：お気に入りを隠して、辞書関連を表示
          headerCells.forEach((cell, index) => {
            if (index < 2) { // 大項目・中項目のヘッダー
              cell.classList.remove('hidden');
            } else { // お気に入りのヘッダー
              cell.classList.add('hidden');
            }
          });
          dataCells.forEach((cell, index) => {
            if (index < 2) { // 大項目・中項目のデータ
              cell.classList.remove('hidden');
            } else { // お気に入りのデータ
              cell.classList.add('hidden');
            }
          });
        }
      }


      /**
       * 現在の形式に応じたデフォルト重み値を取得
       * @returns {number} デフォルト重み値
       */
      getCurrentDefaultWeight() {
        const shaping = this.getCurrentShaping();
        
        switch (shaping) {
          case 'NAI':
            return 0.0;
          case 'SD':
          default:
            return 1.0;
        }
      }

      /**
       * 重み入力フィールド用のツールチップテキストを取得
       * @returns {string} ツールチップテキスト
       */
      getWeightTooltip() {
        const shaping = this.getCurrentShaping();
        const weightConfig = WeightConverter.getWeightConfig(shaping);
        
        switch (shaping) {
          case 'NAI':
            return `プロンプト重み (NAI形式)
・0: 重みなし（デフォルト）
・1以上: 強調 {プロンプト}
・-1以下: 弱調 [プロンプト]
・範囲: ${weightConfig.min}～${weightConfig.max}
・ホイール/矢印キーで調整可能`;
          case 'SD':
            return `プロンプト重み (SD形式)
・1.0: 重みなし（デフォルト）
・1.1以上: 強調 (プロンプト:値)
・0.9以下: 弱調 (プロンプト:値)
・範囲: ${weightConfig.min}～${weightConfig.max}
・ホイール/矢印キーで調整可能`;
          case 'None':
          default:
            return `プロンプト重み (無効)
現在の設定では重み機能は使用されません`;
        }
      }

      /**
       * お気に入りリストのオプションを追加
       */
      populateFavoritesOptions(favoritesSelect) {
        if (!favoritesSelect) return;

        // お気に入り辞書を取得
        const allDictionaries = AppState.data.promptDictionaries || {};
        const dictionaryIds = Object.keys(allDictionaries);

        // 最初の辞書IDを取得（デフォルト選択用）
        const firstDictionaryId = dictionaryIds.length > 0 ? dictionaryIds[0] : '';

        // 空のオプションは追加せず、直接辞書リストを追加
        favoritesSelect.innerHTML = '';

        dictionaryIds.forEach(dictId => {
          const dict = allDictionaries[dictId];
          if (dict && dict.name) {
            const option = UIFactory.createOption({
              value: dictId,
              text: dict.name
            });
            favoritesSelect.appendChild(option);
          }
        });

        // 最初の辞書をデフォルト選択として設定
        if (firstDictionaryId) {
          favoritesSelect.value = firstDictionaryId;
          
          // スロットのfavoriteDictionaryIdも更新
          const slotId = parseInt(favoritesSelect.dataset.slotId);
          const slot = this.slotManager.slots.find(s => s.id === slotId);
          if (slot && !slot.favoriteDictionaryId) {
            slot.favoriteDictionaryId = firstDictionaryId;
          }
        }
      }

      /**
       * カテゴリーセレクターを設定
       */
      setupCategorySelectors(card, slot) {
        const bigSelect = card.querySelector(".category-big-select");
        const middleSelect = card.querySelector(".category-middle-select");

        if (!bigSelect) return;

        // オプションを追加
        bigSelect.innerHTML = '<option value="">すべて</option>';
        const bigCategories = this.getCategoryOptions("big");
        
        bigCategories.forEach((cat) => {
          const option = UIFactory.createOption({
            value: cat,
            text: cat
          });
          bigSelect.appendChild(option);
        });

        // DOMが更新された後に値を設定
        requestAnimationFrame(() => {
          if (slot.category && slot.category.big) {
            bigSelect.value = slot.category.big;
            this.updateCategoryTooltip(bigSelect); // ツールチップ更新
            this.updateMiddleCategories(middleSelect, slot.category.big);
            middleSelect.disabled = false;

            if (slot.category.middle) {
              requestAnimationFrame(() => {
                middleSelect.value = slot.category.middle;
                this.updateCategoryTooltip(middleSelect); // ツールチップ更新
              });
            }
          }
          // 初期状態でもツールチップを設定
          this.updateCategoryTooltip(bigSelect);
          this.updateCategoryTooltip(middleSelect);
        });

        // 大項目選択時のイベントリスナーを追加
        bigSelect.addEventListener("change", async (e) => {
          if (!slot.category) {
            slot.category = {};
          }
          slot.category.big = e.target.value;
          slot.category.middle = ""; // 中項目をリセット

          // 中項目オプションを更新
          if (e.target.value) {
            this.updateMiddleCategories(middleSelect, e.target.value);
            middleSelect.disabled = false;
            
            // 中項目ドロップダウンを自動で開く
            setTimeout(() => {
              if (middleSelect && !middleSelect.disabled) {
                middleSelect.focus();
                
                // 複数の方法でドロップダウンを開く試行
                try {
                  // 1. showPicker() API (Chrome 99+)
                  if (typeof middleSelect.showPicker === 'function') {
                    middleSelect.showPicker();
                  } else {
                    // 2. キーボードイベントのシミュレーション (スペースキー)
                    const spaceEvent = new KeyboardEvent('keydown', {
                      key: ' ',
                      code: 'Space',
                      keyCode: 32,
                      which: 32,
                      bubbles: true
                    });
                    middleSelect.dispatchEvent(spaceEvent);
                  }
                } catch (error) {
                  // 3. フォールバック：視覚的なハイライト
                  middleSelect.style.boxShadow = '0 0 10px var(--accent-primary)';
                  middleSelect.style.borderColor = 'var(--accent-primary)';
                  
                  // 1秒後にハイライトを削除
                  setTimeout(() => {
                    middleSelect.style.boxShadow = '';
                    middleSelect.style.borderColor = '';
                  }, 1000);
                  
                  console.log('ドロップダウンの自動開閉は制限されています。フォーカスのみ移動しました。');
                }
              }
            }, 150);
          } else {
            middleSelect.innerHTML = '<option value="">すべて</option>';
            middleSelect.disabled = true;
          }

          // ツールチップを更新
          this.updateCategoryTooltip(bigSelect);
          this.updateCategoryTooltip(middleSelect);

          // 連続抽出モードの場合はインデックスをリセット
          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotManager.saveToStorage();
        });

        middleSelect.addEventListener("change", async (e) => {
          if (!slot.category) {
            slot.category = {};
          }
          slot.category.middle = e.target.value;

          // ツールチップを更新
          this.updateCategoryTooltip(middleSelect);

          // 連続抽出モードの場合はインデックスをリセット
          if (slot.mode === "sequential") {
            slot.sequentialIndex = 0;
            const indexSpan = card.querySelector(".sequential-index");
            if (indexSpan) {
              indexSpan.textContent = "0";
            }
          }

          await this.slotManager.saveToStorage();
        });
      }

      /**
       * カテゴリーselect要素のツールチップを更新
       */
      updateCategoryTooltip(selectElement) {
        if (!selectElement) return;
        
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption && selectedOption.value) {
          selectElement.title = selectedOption.text;
        } else {
          selectElement.title = "カテゴリーが選択されていません";
        }
      }

      /**
       * カテゴリーオプションを取得（CategoryUIManager経由）
       */
      getCategoryOptions(type) {
        if (type === "big") {
          // CategoryUIManagerのgetCategoriesByLevelを使用（検索タブと同じ）
          return this.categoryUIManager.getCategoriesByLevel(0, null);
        }
        return [];
      }

      /**
       * 中項目カテゴリーを更新（CategoryUIManager経由）
       */
      updateMiddleCategories(select, bigCategory) {
        // CategoryUIManagerのgetCategoriesByLevelを使用（検索タブと同じ）
        const categories = this.categoryUIManager.getCategoriesByLevel(1, bigCategory);

        // まずクリアしてから追加
        select.innerHTML = '<option value="">すべて</option>';

        categories
          .forEach((cat) => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
          });
      }

      /**
       * グループ名の編集を開始
       */
      startGroupNameEdit(displayElement, editElement) {
        
        // 編集状態フラグを設定
        this.isGroupEditing = true;
        
        displayElement.style.display = "none";
        editElement.style.display = "inline-block";
        // フォーカス設定を少し遅延させて安定化
        setTimeout(() => {
          editElement.focus();
          editElement.select();
        }, 10);
      }

      /**
       * グループ説明の編集を開始
       */
      startGroupDescriptionEdit(displayElement, editElement) {
        // 編集状態フラグを設定
        this.isGroupEditing = true;
        
        displayElement.style.display = "none";
        editElement.style.display = "inline-block";
        // フォーカス設定を少し遅延させて安定化
        setTimeout(() => {
          editElement.focus();
          editElement.select();
        }, 10);
      }

      /**
       * グループ名の編集を完了
       */
      async finishGroupNameEdit(groupId, displayElement, editElement) {
        const newName = editElement.value.trim();
        
        // バリデーション
        if (!newName) {
          ErrorHandler.notify("グループ名を入力してください", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: NOTIFICATION_DURATION.MEDIUM
          });
          editElement.focus();
          return;
        }
        
        // 重複チェック
        const groups = this.groupManager.getAllGroups();
        const existingGroup = groups.find(g => g.id !== groupId && g.name === newName);
        
        if (existingGroup) {
          ErrorHandler.notify("同じ名前のグループが既に存在します", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: NOTIFICATION_DURATION.MEDIUM
          });
          editElement.focus();
          return;
        }
        
        try {
          // データ更新
          await this.groupManager.updateGroup(groupId, { name: newName });
          
          // 表示を更新
          displayElement.textContent = newName;
          displayElement.style.display = "block";
          editElement.style.display = "none";
          
          // 編集状態フラグをリセット
          this.isGroupEditing = false;
          
          // UIの更新
          this.updateGroupDisplay();
          
          ErrorHandler.notify("グループ名を更新しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループ名更新エラー:', error);
          ErrorHandler.notify("グループ名の更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM
          });
          // 編集をキャンセル
          this.cancelGroupEdit(displayElement, editElement, displayElement.textContent);
        }
      }

      /**
       * グループ説明の編集を完了
       */
      async finishGroupDescriptionEdit(groupId, displayElement, editElement) {
        const newDescription = editElement.value.trim();
        
        try {
          // データ更新
          await this.groupManager.updateGroup(groupId, { description: newDescription });
          
          // 表示を更新
          displayElement.textContent = newDescription || '説明なし';
          displayElement.style.display = "block";
          editElement.style.display = "none";
          
          // 編集状態フラグをリセット
          this.isGroupEditing = false;
          
          // UIの更新
          this.updateGroupDisplay();
          
          ErrorHandler.notify("グループ説明を更新しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "success",
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループ説明更新エラー:', error);
          ErrorHandler.notify("グループ説明の更新に失敗しました", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
            duration: NOTIFICATION_DURATION.MEDIUM
          });
          // 編集をキャンセル
          this.cancelGroupEdit(displayElement, editElement, displayElement.textContent);
        }
      }

      /**
       * グループ編集をキャンセル
       */
      cancelGroupEdit(displayElement, editElement, originalValue) {
        editElement.value = originalValue;
        displayElement.style.display = "block";
        editElement.style.display = "none";
        
        // 編集状態フラグをリセット
        this.isGroupEditing = false;
      }

      /**
       * スロットグループのインポート・エクスポートボタンを追加
       */
      addSlotImportExportButtons() {
        const currentGroup = this.groupManager.getCurrentGroup();
        if (!currentGroup) return;

        // 既存のボタンがあれば削除
        const existingContainer = document.getElementById('slot-import-export-container');
        if (existingContainer) {
          existingContainer.remove();
        }

        // スロット情報バーの後に配置するため、その要素を取得
        const slotInfoBar = document.querySelector('.slot-info-bar');
        if (!slotInfoBar) return;

        // ボタンコンテナを作成（辞書タブと同じスタイル）
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'slot-import-export-container';
        buttonContainer.className = 'slot-import-export-container';
        buttonContainer.style.cssText = 'margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;';
        
        // 非表示のファイル入力
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.id = 'slot-group-import-file';
        
        // エクスポートボタン
        const exportBtn = document.createElement('button');
        exportBtn.className = 'action-btn';
        exportBtn.textContent = 'エクスポート';
        exportBtn.style.marginRight = '8px';
        exportBtn.id = 'slot-group-export-btn';
        exportBtn.title = '現在のスロットグループをJSON形式でエクスポート（設定・スロット内容を含む）';
        
        // インポートボタン
        const importBtn = document.createElement('button');
        importBtn.className = 'action-btn';
        importBtn.textContent = 'インポート';
        importBtn.id = 'slot-group-import-btn';
        importBtn.title = 'JSONファイルからスロットグループをインポート（現在のグループに追加）';
        
        // ボタンコンテナに要素を追加
        buttonContainer.appendChild(fileInput);
        buttonContainer.appendChild(exportBtn);
        buttonContainer.appendChild(importBtn);
        
        // スロット情報バーの後にボタンコンテナを追加
        slotInfoBar.parentNode.insertBefore(buttonContainer, slotInfoBar.nextSibling);
        
        // イベントリスナーを設定
        this.setupSlotImportExportEvents(exportBtn, importBtn, fileInput);
      }

      /**
       * インポート・エクスポートボタンのイベントリスナーを設定
       */
      setupSlotImportExportEvents(exportBtn, importBtn, fileInput) {
        // エクスポートボタンのイベント
        exportBtn.addEventListener('click', () => {
          this.handleCurrentGroupExport();
        });
        
        // インポートボタンのイベント
        importBtn.addEventListener('click', () => {
          fileInput.click();
        });
        
        // ファイル選択のイベント
        fileInput.addEventListener('change', async (event) => {
          const file = event.target.files[0];
          if (file) {
            await this.handleCurrentGroupImport(file);
            event.target.value = ''; // ファイル選択をリセット
          }
        });
      }

      /**
       * 現在のグループをエクスポート
       */
      async handleCurrentGroupExport() {
        try {
          const currentGroup = this.groupManager.getCurrentGroup();
          if (!currentGroup) {
            ErrorHandler.notify('エクスポートするグループが見つかりません', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: NOTIFICATION_DURATION.MEDIUM
            });
            return;
          }

          // 現在のスロットデータを保存してからエクスポート
          await this.groupManager.saveCurrentGroupSlots();
          
          const exportData = {
            type: 'singleSlotGroup',
            version: '1.0',
            exportDate: new Date().toISOString(),
            group: {
              id: currentGroup.id,
              name: currentGroup.name,
              description: currentGroup.description
            },
            slots: currentGroup.slots.filter(slot => slot.isUsed)
          };

          const filename = FileUtilities.generateTimestampedFilename(
            `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${currentGroup.name}`, 'json'
          );
          
          await FileUtilities.downloadJSON(exportData, filename);
          
          ErrorHandler.notify(`グループ「${currentGroup.name}」をエクスポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループエクスポートエラー:', error);
          ErrorHandler.notify('グループのエクスポートに失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * 現在のグループにインポート
       */
      async handleCurrentGroupImport(file) {
        try {
          const currentGroup = this.groupManager.getCurrentGroup();
          if (!currentGroup) {
            ErrorHandler.notify('インポート先のグループが見つかりません', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: NOTIFICATION_DURATION.MEDIUM
            });
            return;
          }

          const data = await FileUtilities.readJSONFile(file);
          
          // データ形式をバリデーション
          if (!data || data.type !== 'singleSlotGroup' || !data.slots) {
            throw new Error('Invalid import data format');
          }

          // インポートデータを直接設定
          const importedSlotData = {
            version: '1.0',
            slots: data.slots.map((slot, index) => ({
              ...slot,
              id: index // IDを再割り当て
            }))
          };
          
          // SlotManagerのインポート機能を使用
          await this.slotManager.importSlots(importedSlotData);
          
          // グループ情報を更新
          if (data.group.name && data.group.description) {
            currentGroup.name = data.group.name;
            currentGroup.description = data.group.description;
            await this.groupManager.saveToStorage();
          }

          this.updateDisplay();
          this.updateGroupDisplay();
          
          ErrorHandler.notify(`グループ「${currentGroup.name}」にインポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループインポートエラー:', error);
          ErrorHandler.notify('グループのインポートに失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * ソート機能を設定
       */
      setupSortable() {
        const container = this.elements.container;
        if (!container) return;

        $(container).sortable({
          handle: ".slot-drag-handle",
          axis: "y",
          containment: "parent",
          cursor: "move",
          opacity: 0.7,
          tolerance: "pointer",
          placeholder: "slot-card-placeholder",

          // ソート開始時
          start: (event, ui) => {
            this.isSorting = true;
            // プレースホルダーの高さを設定
            ui.placeholder.height(ui.item.height());
          },

          // ソート終了時
          stop: (event, ui) => {
            this.isSorting = false;
          },

          // 更新時
          update: async (event, ui) => {
            // 新しい順序を取得
            const newOrder = Array.from(container.children).map(
              (card) => parseInt(card.dataset.slotId) || 0
            );


            // 重要: 並び替え前に現在のプロンプトを適切なスロットに保存
            // 並び替えはスロットの順序のみを変更し、内容は変更しないため、
            // 現在のプロンプトエディタの内容を正しいスロットに保存する必要がある
            const currentSlotIdBeforeReorder = this.slotManager.slots[this.slotManager.currentSlot]?.id;

            // 現在のプロンプトエディタの内容を、並び替え前の現在のスロットに保存
            if (currentSlotIdBeforeReorder !== undefined && window.promptEditor) {
              const currentSlotBeforeReorder = this.slotManager.slots[this.slotManager.currentSlot];
              if (currentSlotBeforeReorder) {
                currentSlotBeforeReorder.prompt = promptEditor.prompt || "";
                currentSlotBeforeReorder.elements = [...promptEditor.elements];
                currentSlotBeforeReorder.isUsed = currentSlotBeforeReorder.prompt.length > 0;
                currentSlotBeforeReorder.lastModified = currentSlotBeforeReorder.isUsed ? Date.now() : null;
              }
            }

            // スロットマネージャーの順序を更新
            this.slotManager.reorderSlots(newOrder);

            // 並び替え後にストレージに保存
            await this.slotManager.saveToStorage();

            // 重要: 並び替え後にGeneratePromptを現在のスロットの内容で更新
            const currentSlot = this.slotManager.slots[this.slotManager.currentSlot];
            if (currentSlot) {
              
              const generatePrompt = document.getElementById("generatePrompt");
              if (generatePrompt) {
                if (currentSlot.prompt) {
                  const weightedPrompt = this.slotManager.applyWeightToPrompt(currentSlot.prompt, currentSlot.weight);
                  generatePrompt.value = weightedPrompt;
                } else {
                  generatePrompt.value = currentSlot.mode === "random" || currentSlot.mode === "sequential" ? 
                    "[抽出待機中 - Generateボタンを押して抽出]" : "";
                }
              }
            }

            // ストレージに保存
            await this.slotManager.saveToStorage();

            // 番号表示を更新（カード全体を再作成せずに番号だけ更新）
            this.updateSlotNumbers();
          },
        });
      }

      /**
       * スロット番号のみを更新（新規メソッド）
       */
      updateSlotNumbers() {
        const container = this.elements.container;
        if (!container) return;

        // 各カードの番号を更新
        Array.from(container.children).forEach((card, index) => {
          const numberSpan = card.querySelector(".slot-number");
          if (numberSpan) {
            const displayNumber = index + 1;
            numberSpan.textContent = displayNumber;

            // 現在のスロットかどうかチェック
            const slotId = parseInt(card.dataset.slotId);
            const isCurrentSlot =
              this.slotManager.slots[this.slotManager.currentSlot]?.id ===
              slotId;

            if (isCurrentSlot) {
              numberSpan.classList.add("slot-number-current");
              card.classList.add("slot-card-current");
            } else {
              numberSpan.classList.remove("slot-number-current");
              card.classList.remove("slot-card-current");
            }
          }
        });

        // 使用中スロット数も更新
        const usedCount = this.slotManager.getUsedSlotsCount();
        const totalCount = this.slotManager.slots.length;
        const countSpan = this.getElement(DOM_SELECTORS.BY_ID.SLOT_USED_COUNT);
        if (countSpan) {
          countSpan.textContent = `${usedCount}/${totalCount}`;
        }
      }

      /**
       * 結合プレビューを表示（モーダルダイアログ版）
       */
      showCombinePreview() {
        
        // 直接document.querySelectorでも試してみる
        const modalDirect = document.querySelector("#combine-preview-modal");
        
        const modal = this.getElement(DOM_SELECTORS.BY_ID.SLOT_PREVIEW_MODAL);
        
        if (!modal && !modalDirect) {
          return;
        }
        
        // どちらかが見つかった場合は、見つかった方を使用
        const targetModal = modal || modalDirect;

        const combined = this.slotManager.getCombinedPrompt();
        const usedSlots = this.slotManager.getUsedSlots();

        if (usedSlots.length === 0) {
          ErrorHandler.notify("使用中のスロットがありません", {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "warning",
            duration: 2000,
          });
          return;
        }

        // スロット数を更新
        const previewCountElement = document.querySelector("#used-slots-count-preview");
        if (previewCountElement) {
          previewCountElement.textContent = usedSlots.length;
        }

        // スロット情報のテーブルを更新
        const slotTable = document.querySelector("#slot-info-table");
        if (slotTable) {
          slotTable.innerHTML = usedSlots
            .map((slot) => {
            let description = slot.name || "(名前なし)";

            if (slot.mode === "random" || slot.mode === "sequential") {
              description += ` <span class="extraction-mode-label">[${
                slot.mode === "random" ? "ランダム" : "連続"
              }抽出]</span>`;
              if (slot.category?.big) {
                description += ` ${slot.category.big}`;
                if (slot.category.middle) {
                  description += ` > ${slot.category.middle}`;
                }
              }
              if (slot.currentExtraction) {
                description += `<br><small class="current-extraction-info">現在: ${slot.currentExtraction}</small>`;
                if (slot.currentExtractionSmall) {
                  description += `<br><small class="current-extraction-small">小項目: ${slot.currentExtractionSmall}</small>`;
                }
              }
            }

            // ミュート状態を表示に反映
            const actualSlot = this.slotManager.slots.find(s => s.id === slot.id);
            if (actualSlot?.muted) {
              description += ` <span style="color: var(--accent-warning); font-weight: bold;">[MUTED]</span>`;
            }

            return `
        <tr>
          <td class="slot-info-label">スロット${slot.id}:</td>
          <td class="slot-info-content">${description}</td>
        </tr>
      `;
            })
            .join("");
        }

        // 結合結果を更新
        const resultDiv = document.querySelector("#combine-preview-result");
        if (resultDiv) {
          const formattedPrompt = combined
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
            .join(",<br>");
          resultDiv.innerHTML = formattedPrompt;
        }

        // 文字数を更新
        const charCountElement = document.querySelector("#combined-char-count");
        if (charCountElement) {
          charCountElement.textContent = combined.length;
        }

        // モーダルを表示
        targetModal.style.display = "flex";

        // イベントリスナー設定（既存のリスナーを削除してから追加）
        const oldModal = targetModal.cloneNode(true);
        targetModal.parentNode.replaceChild(oldModal, targetModal);

        // 新しい参照を取得
        const newModal = document.querySelector("#combine-preview-modal");

        // 背景クリックで閉じる
        newModal.addEventListener("click", (e) => {
          if (e.target === newModal) {
            newModal.style.display = "none";
          }
        });

        // 閉じるボタン
        document
          .getElementById("close-preview")
          .addEventListener("click", () => {
            newModal.style.display = "none";
          });

        // コピーボタン
        document
          .getElementById("copy-combined")
          .addEventListener("click", () => {
            navigator.clipboard.writeText(combined).then(() => {
              ErrorHandler.notify("結合プロンプトをコピーしました", {
                type: ErrorHandler.NotificationType.TOAST,
                messageType: "success",
                duration: 2000,
              });
            });
          });

        // ESCキーで閉じる
        const handleEsc = (e) => {
          if (e.key === "Escape") {
            newModal.style.display = "none";
            document.removeEventListener("keydown", handleEsc);
          }
        };
        document.addEventListener("keydown", handleEsc);
      }

      /**
       * すべてのスロットをクリア
       */
      async handleClearAll() {
        const shouldConfirm =
          AppState.userSettings.optionData?.isDeleteCheck !== false;

        if (!shouldConfirm || confirm("すべてのスロットをクリアしますか？")) {
          await this.slotManager.clearAllSlots();
          this.updateDisplay();
          
          // ListRefreshManagerで編集タブを更新
          if (window.ListRefreshManager) {
            await window.ListRefreshManager.executeAction(
              window.ListRefreshManager.ACTIONS.SLOT_CLEAR,
              {
                context: { action: 'clearAll' },
                showNotification: false, // すでに通知は表示済み
                delay: 100
              }
            );
          }
        }
      }

      /**
       * コンテナ内のクリックイベントを処理
       */
      async handleContainerClick(e) {
        // ソート中はクリックイベントを無視
        if (this.isSorting) return;

        const target = e.target;

        // ミュートボタン
        if (target.classList.contains("slot-mute-btn")) {
          const slotId = parseInt(target.dataset.slotId);
          await this.slotManager.toggleSlotMute(slotId);
          this.updateDisplay();
          return;
        }

        // クリアボタン
        else if (target.classList.contains("slot-clear-btn")) {
          const slotId = parseInt(target.dataset.slotId);
          const shouldConfirm =
            AppState.userSettings.optionData?.isDeleteCheck !== false;

          if (
            !shouldConfirm ||
            confirm("このスロットの内容をクリアしますか？")
          ) {
            await this.slotManager.clearSlot(slotId);
            this.updateDisplay();
            
            // ListRefreshManagerで編集タブを更新
            if (window.ListRefreshManager) {
              await window.ListRefreshManager.executeAction(
                window.ListRefreshManager.ACTIONS.SLOT_CLEAR,
                {
                  context: { action: 'clearSlot', slotId: slotId },
                  showNotification: false, // すでに通知は表示済み
                  delay: 100
                }
              );
            }
          }
        }

        // 削除ボタン
        else if (target.classList.contains("slot-delete-btn")) {
          const slotId = parseInt(target.dataset.slotId);
          const shouldConfirm =
            AppState.userSettings.optionData?.isDeleteCheck !== false;

          if (!shouldConfirm || confirm("このスロットを削除しますか？")) {
            await this.slotManager.deleteSlot(slotId);
            this.updateDisplay();
          }
          return;
        }

        // 重み入力フィールドのイベント
        else if (target.classList.contains("slot-weight-input")) {
          const slotId = parseInt(target.dataset.slotId);
          
          // inputイベントで即座に保存（ホイール操作とタイピング対応）
          if (event.type === 'input') {
            await this.saveWeightEdit(slotId, parseFloat(target.value));
            return;
          }
          
          // Enterキーで保存とフォーカス移動
          if (event.type === 'keydown' && event.key === 'Enter') {
            await this.saveWeightEdit(slotId, parseFloat(target.value));
            target.blur(); // フォーカスを外す
            return;
          }
          
          return;
        }

        // スロットカード全体のクリック（選択機能）
        else if (target.classList.contains("slot-card") || target.closest(".slot-card")) {
          // ボタンやフォーム要素のクリックは除外
          if (target.matches('button, input, select, textarea, .slot-actions *, .slot-weight-controls *, .slot-mode-container *, .slot-weight-input')) {
            return; // 既存のボタン処理を続行
          }
          
          const card = target.closest(".slot-card");
          if (card) {
            const slotId = parseInt(card.dataset.slotId);
            console.log("Selecting slot via card click:", slotId);
            
            await this.slotManager.switchSlot(slotId);
            this.updateDisplay();
            return; // 処理完了
          }
        }
      }


      /**
       * 重み編集を保存
       */
      async saveWeightEdit(slotId, newWeight) {
        try {
          // 値の検証
          if (isNaN(newWeight)) {
            window.ErrorHandler?.notify('無効な重み値です', {
              type: window.ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: 3000
            });
            return;
          }

          // スロットの重みを更新
          const slot = this.slotManager.slots.find(s => s.id === slotId);
          if (!slot) return;

          // 表示用重みと絶対重みを更新
          slot.weight = newWeight;
          const shaping = this.getCurrentShaping();
          if (shaping === 'NAI') {
            slot.absoluteWeight = WeightConverter.convertNAIToSD(newWeight);
          } else {
            slot.absoluteWeight = newWeight;
          }

          // ストレージに保存
          await this.slotManager.saveToStorage();

          // 表示を更新（重み値のみ）
          this.updateWeightDisplay(slotId, newWeight);
          
          
        } catch (error) {
          window.ErrorHandler?.notify('重みの保存に失敗しました', {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: 3000
          });
        }
      }

      /**
       * 重み表示のみを更新
       */
      updateWeightDisplay(slotId, newWeight) {
        const card = document.querySelector(`.slot-card[data-slot-id="${slotId}"]`);
        if (!card) return;

        const weightInput = card.querySelector('.slot-weight-input');
        
        if (weightInput) {
          weightInput.value = newWeight;
        }
      }


      /**
       * コンテナ内の変更イベントを処理
       */
      async handleContainerChange(e) {
        const target = e.target;

        // モード変更
        if (target.classList.contains("slot-mode-select")) {
          const slotId = parseInt(target.dataset.slotId);
          const newMode = target.value;
          const slot = this.slotManager.slots.find((s) => s.id === slotId);


          if (slot) {
            slot.mode = newMode;

            // カテゴリー情報を初期化（まだ存在しない場合）
            if (!slot.category) {
              slot.category = { big: "", middle: "" };
            }

            // 連続抽出の場合はインデックスを初期化
            if (newMode === "sequential") {
              slot.sequentialIndex = 0;
            }

            await this.slotManager.saveToStorage();
            
            // 現在選択中のスロットのモード変更時はセパレーター更新処理を実行
            if (slotId === this.slotManager.slots[this.slotManager.currentSlot]?.id) {
              if (window.updateGeneratePromptSeparatorForSlotMode) {
                await window.updateGeneratePromptSeparatorForSlotMode(newMode, 'SlotTabModeChange');
              }
            }
            
            // メインのドロップダウンも更新（抽出モードのスロットを無効化）
            this.slotManager.updateUI();

            // カードを再描画して表示を更新
            const card = target.closest(".slot-card");
            if (card) {
              const updatedInfo = this.slotManager.getSlotInfo(slotId);
              const slotIndex = this.slotManager.slots.findIndex(
                (s) => s.id === slotId
              );
              updatedInfo.displayNumber = slotIndex + 1;

              const newCard = this.createSlotCard(updatedInfo);
              card.replaceWith(newCard);
            }
          }
        }

        // 名前の変更
        else if (target.classList.contains("slot-name-edit")) {
          const slotId = parseInt(target.dataset.slotId);
          const newName = target.value;
          await this.slotManager.setSlotName(slotId, newName);
        }

        // プロンプトの変更
        else if (target.classList.contains("slot-prompt-edit")) {
          await this.handlePromptEdit(target);
        }

      }

      /**
       * プロンプト編集を保存
       */
      async handlePromptEdit(target) {
        try {
          const slotId = parseInt(target.dataset.slotId);
          const newPrompt = target.value.trim();
          
          // スロットを検索
          const slot = this.slotManager.slots.find(s => s.id === slotId);
          if (!slot) {
            return;
          }

          // プロンプト内容を更新
          slot.prompt = newPrompt;
          slot.isUsed = newPrompt.length > 0;
          slot.lastModified = slot.isUsed ? Date.now() : null;

          // ストレージに保存
          await this.slotManager.saveToStorage();

          // 表示を更新（使用中スロット数を含む）
          this.updateDisplay();
          
          
        } catch (error) {
          window.ErrorHandler?.notify('プロンプトの保存に失敗しました', {
            type: window.ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: 3000
          });
        }
      }

      // 新規：スロットの抽出表示を更新
      updateSlotExtraction(slotId, extraction) {
        const slotCard = document.querySelector(
          `.slot-card[data-slot-id="${slotId}"]`
        );
        if (!slotCard) return;

        // 現在のスロット情報を取得
        const slot = this.slotManager.slots.find((s) => s.id === slotId);
        if (!slot) return;

        // インジケーターを表示
        let indicator = slotCard.querySelector(".update-indicator");
        if (!indicator) {
          indicator = this.createUpdateIndicator(slotCard);
        }

        indicator.style.display = "inline-block";

        // 抽出表示を更新（小項目も含める）
        const extractionDisplay = slotCard.querySelector(
          ".current-extraction-display"
        );
        if (extractionDisplay) {
          extractionDisplay.innerHTML = `
      <div class="extraction-display-content">
        <strong>現在:</strong> ${extraction}
        ${slot.currentExtractionSmall ? `<br><small class="extraction-small-item">小項目: ${slot.currentExtractionSmall}</small>` : ""}
        <span class="extraction-timestamp">${new Date().toLocaleTimeString()}</span>
      </div>
    `;
        }
        
        // 通常モードのテキストエリアも更新
        const promptTextarea = slotCard.querySelector(
          `.slot-prompt-edit[data-slot-id="${slotId}"]`
        );
        if (promptTextarea) {
          promptTextarea.value = extraction;
          promptTextarea.disabled = false;
          
          // 文字数も更新
          const charCount = slotCard.querySelector(".slot-char-count");
          if (charCount) {
            charCount.textContent = `${extraction.length} 文字`;
          }
        }

        // 連続抽出モードの場合、インデックス表示も更新
        if (slot.mode === "sequential") {
          const sequentialInput = slotCard.querySelector(".sequential-index-input");
          if (sequentialInput) {
            sequentialInput.value = slot.sequentialIndex || 0;
          }
        }

        // インジケーターを隠す
        setTimeout(() => {
          indicator.style.display = "none";
        }, 500);
      }

      createUpdateIndicator(slotCard) {
        const indicator = document.createElement("span");
        indicator.className = "update-indicator";
        indicator.innerHTML = "🔄";
        slotCard.appendChild(indicator);
        return indicator;
      }

      // 新規：すべての抽出表示を更新
      refreshExtractionDisplays() {
        this.slotManager.slots.forEach((slot) => {
          if (
            slot.currentExtraction &&
            (slot.mode === "random" || slot.mode === "sequential")
          ) {
            this.updateSlotExtraction(slot.id, slot.currentExtraction);
          }
        });
      }

      /**
       * タブ表示時の処理
       */
      async onShow() {
        console.log("Switching to slot tab, updating display...");

        // 現在のスロットを保存
        await this.slotManager.saveCurrentSlot();

        // ストレージから最新データを再読み込み
        await this.slotManager.loadFromStorage();

        // shaping変更の監視はonInitで設定済み

        // 他のタブで記法が変更された可能性があるため、現在の記法状態を同期
        const currentShaping = this.getCurrentShaping();
        if (this.currentShapingMode !== currentShaping) {
          
          // 記法が変更されていた場合、スロットの重み値を新しい記法に合わせて更新
          this.updateSlotWeightsForNewShaping(this.currentShapingMode, currentShaping);
          
          // 状態を同期
          this.currentShapingMode = currentShaping;
        }

        // 表示を更新
        this.updateDisplay();
      }

      /**
       * イベントリスナーの設定
       */
      setupEventListeners() {
        const container = this.getElement(DOM_SELECTORS.BY_ID.SLOT_CONTAINER);
        if (!container) return;

        // イベントデリゲーション for クリックイベント
        this.addEventListener(container, "click", async (e) => {
          await this.handleContainerClick(e);
        });

        // 重み編集用のイベントリスナー
        this.addEventListener(container, "keydown", async (e) => {
          await this.handleContainerClick(e);
        });

        this.addEventListener(container, "blur", async (e) => {
          await this.handleContainerClick(e);
        }, true); // キャプチャフェーズで処理

        // inputイベント（ホイール操作での値変更に対応）
        this.addEventListener(container, "input", async (e) => {
          await this.handleContainerClick(e);
        });

        // 名前の編集
        this.addEventListener(container, "change", async (e) => {
          await this.handleContainerChange(e);
        });


        // プロンプト編集のblur時保存
        this.addEventListener(container, "blur", async (e) => {
          if (e.target.classList.contains("slot-prompt-edit")) {
            await this.handlePromptEdit(e.target);
          }
        }, true); // キャプチャフェーズで処理

        // プロンプト編集のEnter時保存
        this.addEventListener(container, "keydown", async (e) => {
          if (e.target.classList.contains("slot-prompt-edit") && e.key === 'Enter') {
            e.preventDefault(); // デフォルトの改行動作を防止
            await this.handlePromptEdit(e.target);
            e.target.blur(); // フォーカスを外す
          }
        });

        // shaping設定変更の監視はonInitで設定済み

        // その他のボタン
        if (this.elements.clearAllBtn) {
          this.addEventListener(this.elements.clearAllBtn, "click", () =>
            this.handleClearAll()
          );
        }

        if (this.elements.exportBtn) {
          this.addEventListener(this.elements.exportBtn, "click", () =>
            this.handleExport()
          );
        }

        if (this.elements.importBtn) {
          this.addEventListener(this.elements.importBtn, "click", () =>
            this.handleImport()
          );
        }
      }

      // 重複する setupShapingChangeListener 削除済み（457行目に統合）

      // 重複する handleShapingChange 削除済み（485行目に統合）

      /**
       * 重み入力フィールドの設定を更新（重複削除済み）
       */

      /**
       * 全スロットの重み値と記法を新しいshaping形式に合わせて更新
       * @param {string} oldShaping - 元のshaping設定
       * @param {string} newShaping - 新しいshaping設定
       */
      updateSlotWeightsForNewShaping(oldShaping, newShaping) {
        console.log('[SD/NAI切替] === 重み更新処理開始 ===');
        console.log('[SD/NAI切替] 変更:', oldShaping, '→', newShaping);
        console.log('[SD/NAI切替] 現在のスロット数:', this.slotManager.slots.length);
        console.log('[SD/NAI切替] スロットデータ:', this.slotManager.slots.map((s, i) => ({
          index: i + 1,
          id: s.id,
          mode: s.mode,
          absoluteWeight: s.absoluteWeight,
          weight: s.weight,
          prompt: s.prompt ? s.prompt.substring(0, 30) + '...' : '空'
        })));
        
        // 引数で受け取った新しいshaping設定を使用
        const currentFormat = newShaping || 'SD';
        let updatedCount = 0;
        let promptUpdatedCount = 0;

        this.slotManager.slots.forEach((slot, index) => {
          console.log(`[SD/NAI切替] スロット${index + 1}の処理開始:`, {
            id: slot.id,
            mode: slot.mode,
            前_absoluteWeight: slot.absoluteWeight,
            前_weight: slot.weight
          });
          
          // 全スロットを対象に記法変換を実行（通常モードも含む）
          const oldPrompt = slot.prompt;
          
          // プロンプト内容の記法変換
          if (oldPrompt && oldShaping !== newShaping) {
            const convertedPrompt = WeightConverter.convertPromptNotation(oldPrompt, oldShaping, newShaping);
            
            if (convertedPrompt !== oldPrompt) {
              slot.prompt = convertedPrompt;
              promptUpdatedCount++;
              console.log(`[SD/NAI切替] スロット${index + 1}: プロンプト記法変換完了`);
            }
          }
          
          // すべてのスロットで重み値を更新（normalモードも含む）
          // absoluteWeightが0の場合、それは間違った初期値の可能性があるため修正
          if (slot.absoluteWeight === 0 && oldShaping === 'NAI' && newShaping === 'SD') {
            // NAI→SDの切り替えで、absoluteWeightが0の場合は1.0に修正
            slot.absoluteWeight = 1.0;
            console.log(`[SD/NAI切替] スロット${index + 1}: absoluteWeightを0→1.0に修正`);
          } else if (slot.absoluteWeight === 1.0 && oldShaping === 'SD' && newShaping === 'NAI') {
            // SD→NAIの切り替えで、absoluteWeightが1.0の場合は0.0に修正
            slot.absoluteWeight = 0.0;
            console.log(`[SD/NAI切替] スロット${index + 1}: absoluteWeightを1.0→0.0に修正`);
          }
          
          const absoluteWeight = slot.absoluteWeight;
          const oldWeight = slot.weight;
          
          // 絶対値（SD値）を現在の形式に変換して表示用weightに設定
          if (currentFormat === 'NAI') {
            slot.weight = WeightConverter.convertSDToNAI(absoluteWeight);
          } else if (currentFormat === 'SD') {
            slot.weight = absoluteWeight; // SD形式なら絶対値そのまま
          } else {
            slot.weight = 1.0; // None形式のデフォルト
          }
          
          // 範囲制限
          const weightConfig = WeightConverter.getWeightConfig(this.getCurrentShaping());
          slot.weight = Math.max(weightConfig.min, Math.min(weightConfig.max, slot.weight));
          
          console.log(`[SD/NAI切替] スロット${index + 1}: 重み更新`, {
            mode: slot.mode,
            absoluteWeight,
            oldWeight,
            newWeight: slot.weight,
            currentFormat
          });
          
          if (oldWeight !== slot.weight) {
            updatedCount++;
          }
          
          console.log(`[SD/NAI切替] スロット${index + 1}の処理完了:`, {
            後_absoluteWeight: slot.absoluteWeight,
            後_weight: slot.weight
          });
        });

        // 現在編集中のプロンプトエディタの内容も記法変換
        if (window.promptEditor && oldShaping !== newShaping) {
          const currentEditorPrompt = window.promptEditor.prompt;
          
          if (currentEditorPrompt) {
            const convertedEditorPrompt = WeightConverter.convertPromptNotation(currentEditorPrompt, oldShaping, newShaping);
            
            if (convertedEditorPrompt !== currentEditorPrompt) {
              window.promptEditor.init(convertedEditorPrompt);
              
              // main.jsのupdatePromptDisplay()を呼び出してGeneratePromptも更新
              if (window.app && typeof window.app.updatePromptDisplay === 'function') {
                window.app.updatePromptDisplay();
              }
            }
          }
        }
        
        // 必ず表示を更新（重み値が変わっていなくても入力フィールドの値を更新）
        this.updateWeightDisplayValues();
        
        // スロットカードを再描画して記法変換後のプロンプト内容を表示
        this.updateDisplay();
        
        console.log('[SD/NAI切替] === 重み更新処理完了 ===', {
          更新されたスロット数: updatedCount,
          変換されたプロンプト数: promptUpdatedCount,
          最終スロットデータ: this.slotManager.slots.map((s, i) => ({
            index: i + 1,
            id: s.id,
            absoluteWeight: s.absoluteWeight,
            weight: s.weight
          }))
        });
        
        if (updatedCount > 0 || promptUpdatedCount > 0) {
          // ストレージに保存
          this.slotManager.saveToStorage();
          console.log('[SD/NAI切替] ストレージ保存完了');
        }
      }

      /**
       * 重み表示値を更新（DOM内の入力フィールドの値を更新）
       */
      updateWeightDisplayValues() {
        // 旧式の.weight-inputは削除済み、.slot-weight-inputが統一フィールド
        // スロットカード再描画時に.slot-weight-inputは自動的に正しい値に設定される
        this.forceDisplayRefresh();
      }

      /**
       * 強制的に表示を再描画
       */
      forceDisplayRefresh() {
        // 少し遅延をかけて再描画を実行
        setTimeout(() => {
          this.updateDisplay();
        }, 50);
      }

      /**
       * タブのリフレッシュ
       */
      async onRefresh() {
        await this.slotManager.loadFromStorage();
        this.updateDisplay();
      }

      /**
       * グループ管理のイベントリスナーを設定
       */
      setupGroupEventListeners() {
        // グループ選択
        if (this.elements.groupSelector) {
          this.addEventListener(this.elements.groupSelector, 'change', async (e) => {
            // 編集中の場合はグループ切り替えをスキップ
            if (this.isGroupEditing) {
              return;
            }
            
            const groupId = e.target.value;
            
            // 切り替え前のグループ情報
            const beforeGroup = this.groupManager.getCurrentGroup();
            
            await this.groupManager.switchToGroup(groupId);
            
            // 切り替え後のグループ情報
            const afterGroup = this.groupManager.getCurrentGroup();
            
            this.updateDisplay();
            this.updateGroupDisplay();
          });
        }

        // グループ管理ボタン
        if (this.elements.groupManageBtn) {
          this.addEventListener(this.elements.groupManageBtn, 'click', () => {
            this.showGroupManagementModal();
          });
        }

        // モーダル閉じるボタン
        const closeBtn = document.getElementById('close-slot-group-management');
        const closeBtnFooter = document.getElementById('close-slot-group-management-footer');
        if (closeBtn) {
          this.addEventListener(closeBtn, 'click', () => {
            this.hideGroupManagementModal();
          });
        }
        if (closeBtnFooter) {
          this.addEventListener(closeBtnFooter, 'click', () => {
            this.hideGroupManagementModal();
          });
        }

        // モーダル背景クリックで閉じる
        if (this.elements.groupModal) {
          this.addEventListener(this.elements.groupModal, 'click', (e) => {
            if (e.target === this.elements.groupModal) {
              this.hideGroupManagementModal();
            }
          });
        }

        // 新規グループ作成
        if (this.elements.groupCreateBtn) {
          this.addEventListener(this.elements.groupCreateBtn, 'click', async () => {
            await this.handleCreateGroup();
          });
        }

        // グループコピー
        if (this.elements.groupCopyBtn) {
          this.addEventListener(this.elements.groupCopyBtn, 'click', async () => {
            await this.handleCopyGroup();
          });
        }


        // グループ削除
        if (this.elements.groupDeleteBtn) {
          this.addEventListener(this.elements.groupDeleteBtn, 'click', async () => {
            await this.handleDeleteGroup();
          });
        }

        // グループエクスポート
        if (this.elements.exportGroupBtn) {
          this.addEventListener(this.elements.exportGroupBtn, 'click', async () => {
            await this.handleExportGroup();
          });
        }

        // グループインポート
        if (this.elements.importGroupBtn) {
          this.addEventListener(this.elements.importGroupBtn, 'click', async () => {
            await this.handleImportGroup();
          });
        }

        // 全体インポート
        const importAllBtn = document.getElementById('slot-group-import-all-btn');
        if (importAllBtn) {
          this.addEventListener(importAllBtn, 'click', async () => {
            await this.handleImportAll();
          });
        }

        // 全体エクスポート
        const exportAllBtn = document.getElementById('slot-group-export-all-btn');
        if (exportAllBtn) {
          this.addEventListener(exportAllBtn, 'click', async () => {
            await this.handleExportAll();
          });
        }

        // グループ変更イベントのリスナー
        window.addEventListener('slotGroupChanged', (event) => {
          console.log('Group changed to:', event.detail.groupName);
          this.updateGroupDisplay();
          
          ErrorHandler.notify(`グループ「${event.detail.groupName}」に切り替えました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        });
      }

      /**
       * グループ表示を更新
       */
      updateGroupDisplay() {
        // 編集中の場合は更新をスキップ
        if (this.isGroupEditing) {
          return;
        }
        
        const selector = this.elements.groupSelector;
        const description = this.elements.groupDescription;
        
        if (!selector || !description) {
          return;
        }

        // セレクターの選択肢を更新
        selector.innerHTML = '';
        const groups = this.groupManager.getAllGroups();
        
        groups.forEach(group => {
          const option = document.createElement('option');
          option.value = group.id;
          option.textContent = group.name;
          option.selected = group.isCurrent;
          selector.appendChild(option);
        });

        // 現在のグループの説明を表示
        const currentGroup = this.groupManager.getCurrentGroup();
        if (currentGroup) {
          description.textContent = currentGroup.description || '';
          
          // モーダル内の現在グループ情報も更新
          this.updateModalCurrentGroupInfo(currentGroup);
          
          // デフォルトグループの場合は削除ボタンを無効化
          if (this.elements.groupDeleteBtn) {
            this.elements.groupDeleteBtn.disabled = currentGroup.isDefault;
          }
        }
      }

      /**
       * BaseModalを初期化
       */
      initModal() {
        // 統一フレームでモーダルを作成
        this.groupManagementModal = BaseModal.create('slot-group-management-modal', '📁 スロットグループ管理', `
          <div class="current-group-info">
            <h4>現在のグループ</h4>
            <div class="current-group-details">
              <strong id="current-group-name">-</strong>
              <p id="current-group-description">-</p>
            </div>
          </div>
          <div class="group-actions">
            <button id="slot-group-create-btn" title="新しいスロットグループを作成（最大20グループまで）">➕ 新しいグループを作成</button>
            <button id="slot-group-import-all-btn" title="JSONファイルから全グループデータをインポート（現在のデータは上書きされます）">📂 全体インポート</button>
            <button id="slot-group-export-all-btn" title="全グループのスロットデータをJSON形式でエクスポート（バックアップ・共有用）">📤 全体エクスポート</button>
          </div>
          <div class="all-groups-section">
            <h4>全グループ一覧</h4>
            <div id="all-groups-list" class="all-groups-container"></div>
          </div>
        `, {
          closeOnBackdrop: true,
          closeOnEsc: true,
          showCloseButton: true,
          showHeader: true,
          showFooter: false, // フッターを非表示にし統一感を保つ
          headerActions: [
            // インポート・エクスポートボタンを各グループ選択ボタンの隣に移動
          ],
          // footerActionsを削除（コンテンツ部分に存在するため）
        });

        // モーダル表示時にコンテンツを更新
        this.groupManagementModal.onShow(() => {
          this.updateModalCurrentGroupInfo();
          this.updateAllGroupsList();
        });
      }

      /**
       * グループ管理モーダルを表示
       */
      showGroupManagementModal() {
        this.groupManagementModal.show();
      }

      /**
       * グループ管理モーダルを非表示
       */
      hideGroupManagementModal() {
        this.groupManagementModal.hide();
      }

      /**
       * モーダル内の現在グループ情報を更新
       */
      updateModalCurrentGroupInfo(group = null) {
        const currentGroup = group || this.groupManager.getCurrentGroup();
        if (!currentGroup) return;

        const nameElement = document.getElementById('current-group-name');
        const descriptionElement = document.getElementById('current-group-description');
        
        if (nameElement) {
          nameElement.textContent = currentGroup.name;
        }
        if (descriptionElement) {
          descriptionElement.textContent = currentGroup.description || '説明なし';
        }
      }

      /**
       * 全グループ一覧を更新
       */
      updateAllGroupsList() {
        // 編集中の場合は更新をスキップ
        if (this.isGroupEditing) {
          return;
        }
        
        const listContainer = document.getElementById('all-groups-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const groups = this.groupManager.getAllGroups();
        const currentGroup = this.groupManager.getCurrentGroup();

        groups.forEach(group => {
          const item = document.createElement('div');
          item.className = `group-list-item ${group.id === currentGroup?.id ? 'current' : ''}`;
          
          item.innerHTML = `
            <div class="group-item-info">
              <div class="group-item-name-container">
                <div class="group-item-name" data-group-id="${group.id}" title="ダブルクリックで名前を編集">${group.name}</div>
                <input class="group-item-name-edit" data-group-id="${group.id}" value="${group.name}" style="display: none;">
              </div>
              <div class="group-item-description-container">
                <div class="group-item-description" data-group-id="${group.id}" title="ダブルクリックで説明を編集">${group.description || '説明なし'}</div>
                <input class="group-item-description-edit" data-group-id="${group.id}" value="${group.description || ''}" style="display: none;">
              </div>
            </div>
            <div class="group-item-actions">
              <button class="action-btn small-btn copy-btn" data-group-id="${group.id}" title="このグループをコピー">
                📋
              </button>
              <button class="action-btn small-btn delete-btn" data-group-id="${group.id}" title="このグループを削除">
                🗑️
              </button>
            </div>
          `;
          
          // アイテム全体のクリックイベントリスナーを追加
          item.addEventListener('click', (e) => {
            // アクションボタンや編集入力フィールドのクリックは除外
            if (e.target.closest('.group-item-actions') || 
                e.target.classList.contains('group-item-name-edit') ||
                e.target.classList.contains('group-item-description-edit')) {
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            const groupId = group.id;
            this.switchToGroup(groupId);
          });
          
          // コピーボタンのイベントリスナー
          const copyButton = item.querySelector('.copy-btn');
          copyButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const groupId = e.target.dataset.groupId;
            this.handleCopyGroup(groupId);
          });
          
          
          // 削除ボタンのイベントリスナー
          const deleteButton = item.querySelector('.delete-btn');
          deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const groupId = e.target.dataset.groupId;
            this.handleDeleteGroup(groupId);
          });
          
          // グループ名のダブルクリックイベント
          const nameDisplay = item.querySelector('.group-item-name');
          const nameEdit = item.querySelector('.group-item-name-edit');
          
          nameDisplay.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startGroupNameEdit(nameDisplay, nameEdit);
          });
          
          nameEdit.addEventListener('blur', async (e) => {
            await this.finishGroupNameEdit(group.id, nameDisplay, nameEdit);
          });
          
          nameEdit.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              await this.finishGroupNameEdit(group.id, nameDisplay, nameEdit);
            } else if (e.key === 'Escape') {
              this.cancelGroupEdit(nameDisplay, nameEdit, group.name);
            }
          });
          
          // グループ説明のダブルクリックイベント
          const descDisplay = item.querySelector('.group-item-description');
          const descEdit = item.querySelector('.group-item-description-edit');
          
          descDisplay.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startGroupDescriptionEdit(descDisplay, descEdit);
          });
          
          descEdit.addEventListener('blur', async () => {
            await this.finishGroupDescriptionEdit(group.id, descDisplay, descEdit);
          });
          
          descEdit.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              await this.finishGroupDescriptionEdit(group.id, descDisplay, descEdit);
            } else if (e.key === 'Escape') {
              this.cancelGroupEdit(descDisplay, descEdit, group.description || '');
            }
          });
          
          listContainer.appendChild(item);
        });
      }

      /**
       * 指定グループに切り替え
       */
      async switchToGroup(groupId) {
        // 編集中の場合は切り替えをスキップ
        if (this.isGroupEditing) {
          return;
        }
        
        await this.groupManager.switchToGroup(groupId);
        this.updateDisplay();
        this.updateGroupDisplay();
        this.updateAllGroupsList();
      }

      /**
       * 新規グループ作成
       */
      async handleCreateGroup() {
        const name = prompt('新しいグループの名前を入力してください:');
        if (!name || name.trim() === '') return;
        
        const description = prompt('グループの説明を入力してください（省略可能）:') || '';
        
        try {
          const groupId = await this.groupManager.createGroup(name.trim(), description.trim());
          this.updateGroupDisplay();
          
          ErrorHandler.notify(`グループ「${name}」を作成しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループ作成エラー:', error);
          ErrorHandler.notify('グループの作成に失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * グループコピー
       */
      async handleCopyGroup(groupId = null) {
        const sourceGroup = groupId ? this.groupManager.getGroup(groupId) : this.groupManager.getCurrentGroup();
        if (!sourceGroup) return;
        
        const name = prompt(`「${sourceGroup.name}」のコピー名を入力してください:`, 
                          `${sourceGroup.name}のコピー`);
        if (!name || name.trim() === '') return;
        
        try {
          const newGroupId = await this.groupManager.copyGroup(sourceGroup.id, name.trim());
          this.updateGroupDisplay();
          this.updateAllGroupsList();
          
          ErrorHandler.notify(`グループ「${name}」をコピーしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループコピーエラー:', error);
          ErrorHandler.notify('グループのコピーに失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * グループ編集
       */
      async handleEditGroup(groupId = null) {
        const targetGroup = groupId ? this.groupManager.getGroup(groupId) : this.groupManager.getCurrentGroup();
        if (!targetGroup) return;
        
        const name = prompt('グループ名を編集してください:', targetGroup.name);
        if (!name || name.trim() === '') return;
        
        const description = prompt('グループの説明を編集してください:', targetGroup.description || '');
        
        try {
          await this.groupManager.updateGroup(targetGroup.id, {
            name: name.trim(),
            description: description?.trim() || ''
          });
          
          this.updateGroupDisplay();
          this.updateAllGroupsList();
          
          ErrorHandler.notify(`グループ「${name}」を更新しました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループ編集エラー:', error);
          ErrorHandler.notify('グループの編集に失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * グループ削除
       */
      async handleDeleteGroup(groupId = null) {
        const targetGroup = groupId ? this.groupManager.getGroup(groupId) : this.groupManager.getCurrentGroup();
        if (!targetGroup) return;
        
        if (targetGroup.isDefault) {
          ErrorHandler.notify('デフォルトグループは削除できません', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'warning',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
          return;
        }
        
        const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
        if (!shouldConfirm || confirm(`グループ「${targetGroup.name}」を削除しますか？`)) {
          try {
            await this.groupManager.deleteGroup(targetGroup.id);
            this.updateDisplay();
            this.updateGroupDisplay();
            this.updateAllGroupsList();
            
            ErrorHandler.notify(`グループ「${targetGroup.name}」を削除しました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'success',
              duration: NOTIFICATION_DURATION.SHORT
            });
          } catch (error) {
            console.error('グループ削除エラー:', error);
            ErrorHandler.notify('グループの削除に失敗しました', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: NOTIFICATION_DURATION.MEDIUM
            });
          }
        }
      }

      /**
       * グループエクスポート
       */
      async handleExportGroup() {
        const currentGroup = this.groupManager.getCurrentGroup();
        if (!currentGroup) return;
        
        try {
          const exportData = this.groupManager.exportGroup(currentGroup.id);
          const filename = FileUtilities.generateTimestampedFilename(
            `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${currentGroup.name}`, 'json'
          );
          
          await FileUtilities.downloadJSON(exportData, filename);
          
          ErrorHandler.notify(`グループ「${currentGroup.name}」をエクスポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループエクスポートエラー:', error);
          ErrorHandler.notify('グループのエクスポートに失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * グループインポート
       */
      async handleImportGroup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            const groupName = prompt('インポートするグループの名前を入力してください:', 
                                   data.group?.name || 'インポートしたグループ');
            if (!groupName || groupName.trim() === '') return;
            
            await this.groupManager.importGroup(data, groupName.trim());
            this.updateGroupDisplay();
            
            ErrorHandler.notify(`グループ「${groupName}」をインポートしました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'success',
              duration: NOTIFICATION_DURATION.SHORT
            });
          } catch (error) {
            console.error('グループインポートエラー:', error);
            ErrorHandler.notify('グループのインポートに失敗しました', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: NOTIFICATION_DURATION.MEDIUM
            });
          }
        });
        
        input.click();
      }

      /**
       * 特定のグループをインポート
       */
      async handleImportToGroup(groupId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            const targetGroup = this.groupManager.getGroup(groupId);
            if (!targetGroup) {
              ErrorHandler.notify('指定されたグループが見つかりません', {
                type: ErrorHandler.NotificationType.TOAST,
                messageType: 'error',
                duration: NOTIFICATION_DURATION.MEDIUM
              });
              return;
            }
            
            const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
            if (shouldConfirm && !confirm(`グループ「${targetGroup.name}」にインポートしますか？\n現在のスロットデータは上書きされます。`)) {
              return;
            }
            
            // グループデータをインポート
    if (data.type === 'singleSlotGroup' && data.group && data.slots) {
      // 指定されたグループに切り替え
      await this.groupManager.switchToGroup(groupId);
      
      // 既存のスロットをクリア
      await this.slotManager.clearAllSlots();
      
      // インポートしたスロットを設定
      for (const slot of data.slots) {
        await this.slotManager.setSlot(slot.id, slot.prompt, slot.elements);
      }
      
      // グループ情報を更新
      if (data.group.name && data.group.description) {
        const group = this.groupManager.groups.find(g => g.id === groupId);
        if (group) {
          group.name = data.group.name;
          group.description = data.group.description;
          await this.groupManager.saveToStorage();
        }
      }
    } else {
      throw new Error('Invalid import data format');
    }
            this.updateDisplay();
            this.updateGroupDisplay();
            this.updateAllGroupsList();
            
            ErrorHandler.notify(`グループ「${targetGroup.name}」にインポートしました`, {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'success',
              duration: NOTIFICATION_DURATION.SHORT
            });
          } catch (error) {
            console.error('グループインポートエラー:', error);
            ErrorHandler.notify('グループのインポートに失敗しました', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: NOTIFICATION_DURATION.MEDIUM
            });
          }
        });
        
        input.click();
      }

      /**
       * 特定のグループをエクスポート
       */
      async handleExportSpecificGroup(groupId) {
        const targetGroup = this.groupManager.getGroup(groupId);
        if (!targetGroup) {
          ErrorHandler.notify('指定されたグループが見つかりません', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
          return;
        }
        
        try {
          // 対象グループのスロットデータを取得
          const groupSlots = targetGroup.slots || [];
          
          const exportData = {
      type: 'singleSlotGroup',
      version: '1.0',
      exportDate: new Date().toISOString(),
      group: {
        id: targetGroup.id,
        name: targetGroup.name,
        description: targetGroup.description
      },
      slots: groupSlots.filter(slot => slot.isUsed)
    };
          const filename = FileUtilities.generateTimestampedFilename(
            `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${targetGroup.name}`, 'json'
          );
          
          await FileUtilities.downloadJSON(exportData, filename);
          
          ErrorHandler.notify(`グループ「${targetGroup.name}」をエクスポートしました`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
        } catch (error) {
          console.error('グループエクスポートエラー:', error);
          ErrorHandler.notify('グループのエクスポートに失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * 全体インポート処理
       */
      async handleImportAll() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // データ形式の検証
            if (!data || data.type !== 'allSlotGroups') {
              throw new Error('無効なファイル形式です。全体エクスポートファイルを選択してください。');
            }
            
            const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
            if (shouldConfirm && !confirm('全グループをインポートしますか？\n現在のすべてのスロットデータは上書きされます。')) {
              return;
            }
            
            // 全グループデータをインポート
    if (data.type === 'allSlotGroups' && data.groups) {
      // groupsがMapであることを確認
      if (!(this.groupManager.groups instanceof Map)) {
        throw new Error('グループマネージャーが正しく初期化されていません');
      }
      
      // 既存のグループをクリア（デフォルトグループ以外）
      const defaultGroup = Array.from(this.groupManager.groups.values()).find(g => g.isDefault);
      const newGroups = new Map();
      if (defaultGroup) {
        newGroups.set(defaultGroup.id, defaultGroup);
      }
      
      // インポートしたグループを追加
      if (!Array.isArray(data.groups)) {
        throw new Error('グループデータは配列形式である必要があります');
      }
      
      
      // グループを追加
      for (const group of data.groups) {
        if (!group.isDefault && group.id) {
          newGroups.set(group.id, group);
        } else if (group.isDefault) {
          // デフォルトグループのデータでdefaultGroupを更新
          if (defaultGroup) {
            defaultGroup.slots = group.slots;
            defaultGroup.name = group.name;
            defaultGroup.description = group.description;
          }
        }
      }
      
      // groupsを更新
      this.groupManager.groups = newGroups;
      
      // 現在のグループを設定
      if (data.currentGroupId) {
        this.groupManager.currentGroupId = data.currentGroupId;
      }
      
      
      await this.groupManager.saveToStorage();
      
      // インポート後は古いストレージデータを読み込まないよう、
      // onRefreshではなく、直接現在のグループのスロットを読み込み
      await this.groupManager.loadGroupSlots(this.groupManager.currentGroupId);
      
    } else {
      throw new Error('Invalid import data format');
    }
            this.updateDisplay();
            this.updateGroupDisplay();
            this.updateAllGroupsList();
            
            ErrorHandler.notify('全グループをインポートしました', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'success',
              duration: NOTIFICATION_DURATION.SHORT
            });
            
            // モーダルを閉じる
            this.hideGroupManagementModal();
            
          } catch (error) {
            console.error('全体インポートエラー:', error);
            ErrorHandler.notify(error.message || '全体インポートに失敗しました', {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: 'error',
              duration: NOTIFICATION_DURATION.MEDIUM
            });
          }
        });
        
        input.click();
      }

      /**
       * 全体エクスポート処理
       */
      async handleExportAll() {
        try {
          const exportData = {
      type: 'allSlotGroups',
      version: '1.0',
      exportDate: new Date().toISOString(),
      groups: Array.from(this.groupManager.groups.values()), // MapをArrayに変換
      currentGroupId: this.groupManager.currentGroupId
    };
          const filename = FileUtilities.generateTimestampedFilename(
            EXPORT_FILE_NAMES.ALL_SLOT_GROUPS, 'json'
          );
          
          await FileUtilities.downloadJSON(exportData, filename);
          
          ErrorHandler.notify('全グループをエクスポートしました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'success',
            duration: NOTIFICATION_DURATION.SHORT
          });
          
        } catch (error) {
          console.error('全体エクスポートエラー:', error);
          ErrorHandler.notify('全体エクスポートに失敗しました', {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: 'error',
            duration: NOTIFICATION_DURATION.MEDIUM
          });
        }
      }

      /**
       * スロットコンテナの高さを動的に調整
       */
      adjustContainerHeight() {
        const container = this.elements.container;
        if (!container) return;

        // タブが表示されている時だけ実行
        if (!this.isCurrentTab()) return;

        try {
          // スロットタブのメインコンテナを取得
          const slotTab = document.getElementById('slotTabBody');
          if (!slotTab || !slotTab.classList.contains('is-show')) return;

          // 固定要素の高さを計算
          const h2 = slotTab.querySelector('h2');
          const groupHeader = slotTab.querySelector('.slot-group-header-compact');
          const slotInfoBar = slotTab.querySelector('.slot-info-bar');
          
          let fixedHeight = 0;
          
          if (h2) fixedHeight += h2.offsetHeight;
          if (groupHeader) fixedHeight += groupHeader.offsetHeight;
          if (slotInfoBar) fixedHeight += slotInfoBar.offsetHeight;
          
          // マージンとパディングを考慮
          const computedStyle = window.getComputedStyle(slotTab);
          const tabPadding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
          
          // 親コンテナの高さを取得
          const parentContainer = slotTab.parentElement;
          const availableHeight = parentContainer.clientHeight - tabPadding - fixedHeight - 40; // 40pxはマージン調整
          
          // 最小高さと最大高さを設定
          const minHeight = 200;
          const maxHeight = Math.max(minHeight, availableHeight);
          
          // スロットコンテナの高さを設定
          container.style.maxHeight = `${maxHeight}px`;
          container.style.height = `${maxHeight}px`;
          
          
        } catch (error) {
          // フォールバック：CSSの初期値を使用
          container.style.maxHeight = 'calc(100vh - 320px)';
        }
      }

      /**
       * ウィンドウリサイズ時の高さ調整
       */
      handleWindowResize() {
        // デバウンス処理
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
          if (this.isCurrentTab()) {
            this.adjustContainerHeight();
          }
        }, 100);
      }

      /**
       * タブ表示時の処理
       */
      async onShow() {
        console.log("Switching to slot tab, updating display...");

        // 現在のスロットを保存
        await this.slotManager.saveCurrentSlot();

        // ストレージから最新データを再読み込み
        await this.slotManager.loadFromStorage();

        // shaping変更の監視はonInitで設定済み

        // 他のタブで記法が変更された可能性があるため、現在の記法状態を同期
        const currentShaping = this.getCurrentShaping();
        if (this.currentShapingMode !== currentShaping) {
          
          // 記法が変更されていた場合、スロットの重み値を新しい記法に合わせて更新
          this.updateSlotWeightsForNewShaping(this.currentShapingMode, currentShaping);
          
          // 状態を同期
          this.currentShapingMode = currentShaping;
        }

        // スロット詳細比較ログ
        console.log('[スロットタブonShow] promptSlotManagerスロット数:', this.slotManager?.slots?.length);
        console.log('[スロットタブonShow] slotGroupManagerデフォルトグループスロット数:', this.groupManager?.getGroup('default')?.slots?.length);
        
        // スロット0の詳細比較
        const promptSlot0 = this.slotManager?.slots?.[0];
        const groupSlot0 = this.groupManager?.getGroup('default')?.slots?.[0];
        
        if (promptSlot0) {
          console.log('[スロットタブonShow] promptSlotスロット0:', 
            `prompt="${promptSlot0.prompt}", mode="${promptSlot0.mode}", category="${promptSlot0.category?.big}|${promptSlot0.category?.middle}", dataSource="${promptSlot0.dataSource}", favoriteDictionaryId="${promptSlot0.favoriteDictionaryId}"`);
        }
        
        if (groupSlot0) {
          console.log('[スロットタブonShow] groupSlotスロット0:',
            `prompt="${groupSlot0.prompt}", mode="${groupSlot0.mode}", category="${groupSlot0.category?.big}|${groupSlot0.category?.middle}", dataSource="${groupSlot0.dataSource}", favoriteDictionaryId="${groupSlot0.favoriteDictionaryId}"`);
        }

        // 表示を更新
        this.updateDisplay();
        
        // リサイズイベントリスナーを追加
        if (!this.resizeListenerAdded) {
          window.addEventListener('resize', () => this.handleWindowResize());
          this.resizeListenerAdded = true;
        }
      }

      /**
       * デバッグ情報を出力（オーバーライド）
       */
      debug() {
        super.debug();
        console.log("SlotManager:", this.slotManager);
        console.log("GroupManager:", this.groupManager);
        console.log("Current slots:", this.slotManager?.slots);
        console.log("Used slots count:", this.slotManager?.getUsedSlotsCount());
        console.log("Current group:", this.groupManager?.getCurrentGroup());
      }

      /**
       * スロットマネージャーの初期化完了を待機
       */
      async waitForSlotManagers() {
        const maxWait = 2000; // 最大2秒待機（短縮）
        const checkInterval = 20; // 20ms間隔でチェック（高速化）
        let elapsed = 0;

        return new Promise((resolve, reject) => {
          const checkManagers = () => {
            if (window.promptSlotManager && window.slotGroupManager) {
              resolve();
              return;
            }

            elapsed += checkInterval;
            if (elapsed >= maxWait) {
              reject(new Error(`Slot managers not initialized within ${maxWait}ms`));
              return;
            }

            setTimeout(checkManagers, checkInterval);
          };

          checkManagers();
        });
      }
    }

    // グローバルに公開
    if (typeof window !== "undefined") {
      window.SlotTab = SlotTab;
    }
  }

  // 初期実行
  defineSlotTab();
})();
