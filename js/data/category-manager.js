/**
 * カテゴリー管理モジュール
 * メモリ効率とパフォーマンスを重視した実装
 */
const categoryData = {
  // カテゴリーデータ
  data: [[], [], []],

  // 更新中フラグ
  _isUpdating: false,

  /**
   * 初期化（キャッシュ優先・非同期最適化）
   */
  init: function () {
    console.log('[Category] Initializing category data...');
    
    // data-manager.jsのloadCategory()を使用
    if (typeof loadCategory === 'function') {
      loadCategory()
        .then(() => {
          // AppStateからカテゴリーデータを取得
          if (AppState?.data?.categoryData && AppState.data.categoryData[0]?.length > 0) {
            console.log('[Category] Using cached category data from AppState');
            this.data = AppState.data.categoryData;
          } else {
            console.log('[Category] No cached data found, performing full update...');
            // キャッシュがない場合のみフル更新
            this.update();
          }
        })
        .catch((error) => {
          ErrorHandler.log("カテゴリーデータの読み込みに失敗", error);
          // エラーの場合もフル更新を試行
          this.update();
        });
    } else {
      // フォールバック：直接ストレージから読み込み
      Storage.get(["categoryData"])
        .then((items) => {
          if (items.categoryData != null && items.categoryData[0]?.length > 0) {
            console.log('[Category] Using cached category data from Storage');
            this.data = items.categoryData;
          } else {
            console.log('[Category] No cached data in storage, performing full update...');
            this.update();
          }
        })
        .catch((error) => {
          ErrorHandler.log("カテゴリーデータの読み込みに失敗", error);
          this.update();
        });
    }
  },

  /**
   * カテゴリーデータを更新（最適化版・非同期）
   */
  update: function () {
    // 更新中の場合はスキップ
    if (this._isUpdating) {
      console.log("Category update already in progress, skipping");
      return Promise.resolve();
    }

    this._isUpdating = true;

    // パフォーマンス測定開始
    if (window.PerformanceMonitor) {
      PerformanceMonitor.start("categoryUpdate");
    }

    return new Promise((resolve) => {
      // 非同期処理で重い処理を分割
      setTimeout(() => {
        try {
          // データをリセット
          this.data = [[], [], []];

          // 重複チェック用のMapを使用（高速化）
          const uniqueKeys = [new Map(), new Map(), new Map()];

          // 非同期でデータソースを取得
          this.updateAsync(uniqueKeys, resolve);
        } catch (error) {
          console.error('Category update error:', error);
          this._isUpdating = false;
          resolve();
        }
      }, 0);
    });
  },

  /**
   * 非同期カテゴリー更新処理
   */
  updateAsync: function(uniqueKeys, resolve) {
    try {
      // ローカルデータを先に処理（高速）
      console.log('[Category] Processing local data...');
      const localItems = AppState.data.localPromptList || [];
      
      localItems.forEach((item) => {
        if (item && item.data) {
          this.addItem(item, uniqueKeys);
        }
      });

      // マスターデータを分割処理（重い処理）
      console.log('[Category] Processing master data...');
      const masterItems = getMasterPrompts();
      this.processMasterDataChunked(masterItems, uniqueKeys, 0, resolve);
    } catch (error) {
      console.error('Category updateAsync error:', error);
      this._isUpdating = false;
      resolve();
    }
  },

  /**
   * マスターデータをチャンク処理
   */
  processMasterDataChunked: function(masterItems, uniqueKeys, index, resolve) {
    const chunkSize = 200; // 200件ずつ処理
    const endIndex = Math.min(index + chunkSize, masterItems.length);

    // チャンクを処理
    for (let i = index; i < endIndex; i++) {
      const item = masterItems[i];
      if (item && item.data) {
        this.addItem(item, uniqueKeys);
      }
    }

    console.log(`[Category] Processed ${endIndex}/${masterItems.length} master items`);

    if (endIndex < masterItems.length) {
      // 次のチャンクを非同期で処理
      setTimeout(() => {
        this.processMasterDataChunked(masterItems, uniqueKeys, endIndex, resolve);
      }, 5); // 5ms間隔で処理
    } else {
      // 全ての処理が完了
      this.finishUpdate(resolve);
    }
  },

  /**
   * 更新処理の完了
   */
  finishUpdate: function(resolve) {
    try {
      console.log('[Category] Finalizing update...');

      // バッチ処理はupdateAsyncに移動

      // data-manager.jsのsaveCategory()を使用
      if (typeof saveCategory === 'function') {
        // AppStateにデータを設定してから保存
        if (AppState?.data) {
          AppState.data.searchCategory = this.data;
        }
        saveCategory()
          .then(() => {
            console.log("Category data saved successfully");
          })
          .catch((error) => {
            ErrorHandler.log("カテゴリーデータの保存に失敗", error);
          });
      } else {
        // フォールバック：直接ストレージに保存
        Storage.set({ categoryData: this.data })
          .then(() => {
            console.log("Category data saved successfully");
          })
          .catch((error) => {
            ErrorHandler.log("カテゴリーデータの保存に失敗", error);
          });
      }

      
      console.log(`[Category] Update completed - Big: ${this.data[0].length}, Middle: ${this.data[1].length}, Small: ${this.data[2].length}`);
    } finally {
      this._isUpdating = false;

      if (window.PerformanceMonitor) {
        PerformanceMonitor.end("categoryUpdate");
      }
      
      if (resolve) resolve();
    }
  },

  /**
   * カテゴリーアイテムを追加
   * @param {Object} item - 追加するアイテム
   * @param {Map[]} uniqueKeys - 重複チェック用のMap配列
   */
  addItem: function (item, uniqueKeys) {
    for (let i = 0; i < 3; i++) {
      const value = item.data[i];
      if (!value) continue;

      // 親要素のキーを構築
      let parentKey = "";
      for (let j = 0; j < i; j++) {
        parentKey += (item.data[j] || "").replace(/[!\/]/g, "");
      }

      // ユニークキーを生成
      const uniqueKey = `${value}|${parentKey}`;

      // 重複チェック（Map使用で高速化）
      if (!uniqueKeys[i].has(uniqueKey)) {
        uniqueKeys[i].set(uniqueKey, true);

        const pushData = { value: value };

        // parentは i > 0 の場合のみ設定（元のコードと同じ構造）
        if (i > 0) {
          pushData.parent = parentKey;
        }

        this.data[i].push(pushData);
      }
    }
  },





  /**
   * カテゴリーを検索
   * @param {number} level - カテゴリーレベル（0-2）
   * @param {string} parentValue - 親カテゴリーの値
   * @returns {Array} マッチするカテゴリーの配列
   */
  getCategoriesByParent: function (level, parentValue = null) {
    if (level < 0 || level > 2) return [];

    if (level === 0 || !parentValue) {
      return this.data[level].map((item) => item.value);
    }

    return this.data[level]
      .filter((item) => item.parent === parentValue)
      .map((item) => item.value);
  },

  /**
   * カテゴリーの存在確認（高速版）
   * @param {string} value - 確認する値
   * @param {number} level - カテゴリーレベル
   * @param {string} [parent] - 親カテゴリー
   * @returns {boolean}
   */
  exists: function (value, level, parent = null) {
    return this.data[level].some(
      (item) =>
        item.value === value && (parent === null || item.parent === parent)
    );
  },

  /**
   * カテゴリーデータの統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats: function () {
    return {
      bigCategories: this.data[0].length,
      middleCategories: this.data[1].length,
      smallCategories: this.data[2].length,
      memoryEstimate: this.estimateMemoryUsage(),
    };
  },

  /**
   * メモリ使用量の推定
   * @returns {string} 推定メモリ使用量
   */
  estimateMemoryUsage: function () {
    let totalChars = 0;

    this.data.forEach((level) => {
      level.forEach((item) => {
        totalChars += (item.value || "").length;
        totalChars += (item.parent || "").length;
      });
    });

    // 文字数から大まかなメモリ使用量を推定（1文字約2バイト）
    const estimatedBytes = totalChars * 2;

    if (estimatedBytes < 1024) {
      return `${estimatedBytes} B`;
    } else if (estimatedBytes < 1024 * 1024) {
      return `${(estimatedBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  },

  /**
   * デバッグ情報を出力
   */
  debug: function () {
    const stats = this.getStats();
    console.group("CategoryData Debug Info");
    console.log("Statistics:", stats);
    console.log("Data structure:", this.data);
    console.groupEnd();
  },
};

/**
 * カテゴリー選択ヘルパー関数
 * @deprecated CategoryUIManager.populateDropdown()を使用するため廃止予定
 * 後方互換性のため残していますが、新規コードではCategoryUIManagerを使用してください
 */
function setCategoryList(selectorId, categoryLevel) {
  console.warn('[category-manager.js] setCategoryList is deprecated, use CategoryUIManager.populateDropdown() instead');
  
  // CategoryUIManagerが利用可能な場合はそちらを使用
  if (window.CategoryUIManager) {
    const manager = new CategoryUIManager();
    manager.populateDropdown(selectorId, categoryLevel);
    return;
  }
  
  // フォールバック：従来の処理
  const selectElement = document.querySelector(selectorId);
  if (!selectElement) return;

  // 現在の選択値を保存
  const currentValue = selectElement.value;

  // 既存のオプションをクリア
  selectElement.innerHTML = "";

  // 空のオプションを追加
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "";
  selectElement.appendChild(emptyOption);

  // DocumentFragmentを使用
  const fragment = document.createDocumentFragment();

  categoryData.data[categoryLevel].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.value;
    fragment.appendChild(option);
  });

  selectElement.appendChild(fragment);
  selectElement.disabled = false;
  
  // 現在の値が新しいオプションに存在する場合は復元
  if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
    selectElement.value = currentValue;
  }
}

/**
 * 即座カテゴリー更新
 * カテゴリー管理の一部として、このモジュール内で管理
 */
function immediateCategoryUpdate() {
  categoryData.update();
}

// グローバルに公開
if (typeof window !== "undefined") {
  window.categoryData = categoryData;
  window.setCategoryList = setCategoryList;
  window.immediateCategoryUpdate = immediateCategoryUpdate;
}
