/**
 * category-data-sync-manager.js - カテゴリデータ統一同期管理システム
 * 本格修正: カテゴリリセット問題の根本解決
 */

class CategoryDataSyncManager {
  constructor() {
    this.debugMode = AppState?.config?.debugMode || false;
  }

  /**
   * カテゴリデータを全データソースに同期
   * @param {number} elementId - 要素ID
   * @param {Array} categoryData - カテゴリデータ [大項目, 中項目, 小項目]
   * @param {Object} options - オプション設定
   */
  async syncAllSources(elementId, categoryData, options = {}) {
    const {
      syncDOM = true,
      syncEditPrompt = true,
      syncListManager = true,
      caller = 'unknown'
    } = options;

    if (this.debugMode) {
      console.log(`[CategoryDataSync] Syncing all sources for element ${elementId}:`, {
        categoryData,
        caller,
        options
      });
    }

    // 1. DOM上の値を同期
    if (syncDOM) {
      this.syncDOMValues(elementId, categoryData);
    }

    // 2. editPrompt.elementsのデータを同期
    if (syncEditPrompt) {
      this.syncEditPromptData(elementId, categoryData);
    }

    // 3. ListManagerのitemデータを同期（必要に応じて）
    if (syncListManager) {
      this.syncListManagerData(elementId, categoryData);
    }

    if (this.debugMode) {
      console.log(`[CategoryDataSync] Sync completed for element ${elementId}`);
    }
  }

  /**
   * DOM上のカテゴリ入力フィールドの値を更新
   */
  syncDOMValues(elementId, categoryData) {
    const elementContainer = document.querySelector(`[data-element-id="${elementId}"]`);
    if (!elementContainer) {
      return false;
    }
    
    const categoryInputs = elementContainer.querySelectorAll('input[data-field^="data."]');
    
    categoryInputs.forEach((input, index) => {
      if (index < 3 && categoryData[index] !== undefined) {
        const newValue = categoryData[index] || '';
        input.value = newValue;
      }
    });
    
    return true;
  }

  /**
   * editPrompt.elementsのデータを同期
   */
  syncEditPromptData(elementId, categoryData) {
    if (!window.editPrompt || !editPrompt.elements) {
      console.warn(`[CategoryDataSync] editPrompt not available`);
      return false;
    }

    const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) {
      console.warn(`[CategoryDataSync] Element not found in editPrompt.elements: ${elementId}`);
      return false;
    }

    // データを安全にコピー
    editPrompt.elements[elementIndex].data = [
      categoryData[0] || '',
      categoryData[1] || '',
      categoryData[2] || ''
    ];

    return true;
  }

  /**
   * ListManagerのitemデータを同期（必要な場合のみ）
   */
  syncListManagerData(elementId, categoryData) {
    // ListManagerの内部itemデータは通常、DOM値から自動同期されるため
    // 特別な処理は不要だが、将来の拡張性のためにメソッドを用意
    if (this.debugMode) {
      console.log(`[CategoryDataSync] ListManager sync requested for ${elementId}`);
    }
    return true;
  }

  /**
   * DOM上の最新値を取得
   */
  getCurrentDOMValues(elementId) {
    const elementContainer = document.querySelector(`[data-element-id="${elementId}"]`);
    if (!elementContainer) {
      return null;
    }

    const categoryInputs = elementContainer.querySelectorAll('input[data-field^="data."]');
    const currentData = ['', '', ''];
    
    categoryInputs.forEach((input, index) => {
      if (index < 3) {
        currentData[index] = input.value || '';
      }
    });

    return currentData;
  }

  /**
   * データの一貫性を検証
   */
  validateDataConsistency(elementId) {
    const domData = this.getCurrentDOMValues(elementId);
    if (!domData) {
      return { consistent: false, error: 'DOM data not available' };
    }

    // editPrompt.elementsのデータと比較
    if (window.editPrompt && editPrompt.elements) {
      const elementIndex = editPrompt.elements.findIndex(el => el.id === elementId);
      if (elementIndex !== -1) {
        const promptData = editPrompt.elements[elementIndex].data || [];
        const isConsistent = domData.every((value, index) => value === (promptData[index] || ''));
        
        if (!isConsistent) {
          return {
            consistent: false,
            domData,
            promptData,
            error: 'DOM and editPrompt data mismatch'
          };
        }
      }
    }

    return { consistent: true, data: domData };
  }

  /**
   * カテゴリチェイン処理完了の待機
   */
  async waitForCategoryChainComplete() {
    // カテゴリチェイン処理の完了を待つ
    // 実装に応じて調整が必要
    return new Promise((resolve) => {
      setTimeout(resolve, 50); // 最小限の待機時間
    });
  }

  /**
   * 安全な非同期更新実行
   */
  async executeSafeUpdate(elementId, updateFunction, caller = 'unknown') {
    try {
      // カテゴリチェイン処理の完了を待機
      await this.waitForCategoryChainComplete();

      // 最新のDOM値を取得
      const latestData = this.getCurrentDOMValues(elementId);
      if (!latestData) {
        throw new Error(`Unable to get DOM data for element ${elementId}`);
      }

      // 全データソースを同期
      await this.syncAllSources(elementId, latestData, { caller });

      // 更新関数を実行（必要な場合）
      if (typeof updateFunction === 'function') {
        return await updateFunction(latestData);
      }

      return true;
    } catch (error) {
      console.error(`[CategoryDataSync] Safe update failed for element ${elementId}:`, error);
      return false;
    }
  }
}

// グローバルインスタンス作成
if (typeof window !== 'undefined') {
  window.CategoryDataSyncManager = CategoryDataSyncManager;
  window.categoryDataSync = new CategoryDataSyncManager();
}

// モジュールエクスポート（必要に応じて）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CategoryDataSyncManager;
}