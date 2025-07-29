/**
 * flexible-element-manager.js - FlexibleList用の統一要素管理システム
 * EditElementManagerと同じパフォーマンス最適化をFlexibleListに適用
 * Phase 11: スクロール位置保持とリアルタイム更新の統一化
 * Created: 2025-07-13
 */

(function () {
  "use strict";

  /**
   * FlexibleList用の統一要素管理クラス
   * EditElementManagerと同様のAPI提供でスクロール位置保持を実現
   */
  class FlexibleElementManager {
    constructor(listManager) {
      this.listManager = listManager;
      this.currentListId = null;
      this.currentConfig = null;
      this.scrollPositions = new Map(); // リスト別スクロール位置保持
      
      // パフォーマンス監視
      this.performanceMetrics = {
        updateCount: 0,
        averageUpdateTime: 0,
        lastUpdateTime: 0
      };

      console.log("[FlexibleElementManager] Initialized");
    }

    /**
     * 要素の統一更新（EditElementManagerと同じAPI）
     * @param {number|string} elementId - 要素の一意ID
     * @param {Object} updates - 更新内容
     * @param {Object} options - 更新オプション
     */
    async updateElement(elementId, updates, options = {}) {
      const startTime = performance.now();
      
      try {
        const {
          preserveFocus = true,
          updateFieldStates = true,
          updateDisplay = true,
          delay = 0,
          skipRefresh = true // デフォルトでリフレッシュをスキップ
        } = options;

        // 遅延実行
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // スクロール位置を保存
        this.saveScrollPosition();

        // DOM要素を直接更新（EditElementManagerと同様）
        const success = await this.updateElementDirectly(elementId, updates);
        
        if (success) {
          // フィールド状態更新
          if (updateFieldStates) {
            this.updateSingleElementFieldStates(elementId);
          }

          // 表示更新（必要な場合のみ）
          if (updateDisplay && !skipRefresh) {
            await this.refreshCurrentList();
          }

          // フォーカス復元
          if (preserveFocus) {
            this.restoreFocus(elementId);
          }

          // スクロール位置復元
          setTimeout(() => {
            this.restoreScrollPosition();
          }, 50);
        }

        this.updatePerformanceMetrics(startTime);
        return success;
        
      } catch (error) {
        console.error('[FlexibleElementManager] Update failed:', error);
        return false;
      }
    }

    /**
     * 個別フィールド更新（超高速版）
     */
    async updateFieldOnly(elementId, fieldKey, value) {
      return await this.updateElement(elementId, { [fieldKey]: value }, {
        preserveFocus: false, // フォーカス復元を無効化（辞書タブでの意図しないフォーカス移動を防止）
        updateFieldStates: false,
        updateDisplay: false,
        skipRefresh: true
      });
    }

    /**
     * 要素追加（スクロール位置保持）
     */
    async addElement(position = 'bottom', initialData = {}) {
      const startTime = performance.now();
      
      try {
        this.saveScrollPosition();

        // データ層に追加
        const newElementId = await this.addElementToData(position, initialData);
        
        if (newElementId) {
          // DOM直接追加（リフレッシュなし）
          await this.addElementToDOM(newElementId, position, initialData);
          
          // 最小限のリフレッシュで要素ID整合性確保
          this.ensureElementIdConsistency();
          
          // スクロール位置復元
          setTimeout(() => {
            this.restoreScrollPosition();
          }, 100);
        }

        this.updatePerformanceMetrics(startTime);
        return newElementId;
        
      } catch (error) {
        console.error('[FlexibleElementManager] Add element failed:', error);
        return null;
      }
    }

    /**
     * 要素削除（ListManagerフローバイパス版）
     */
    async removeElement(elementId) {
      const startTime = performance.now();
      
      try {
        this.saveScrollPosition();

        // DOM直接削除
        const success = await this.removeElementFromDOM(elementId);
        
        if (success) {
          // データ層から削除
          await this.removeElementFromData(elementId);
          
          // ListManagerフローを完全スキップしてスクロール位置維持
          setTimeout(() => {
            this.restoreScrollPosition();
          }, 10);
        }

        this.updatePerformanceMetrics(startTime);
        return success;
        
      } catch (error) {
        console.error('[FlexibleElementManager] Remove element failed:', error);
        return false;
      }
    }

    /**
     * リスト設定を記憶
     */
    setCurrentList(listId, config) {
      this.currentListId = listId;
      this.currentConfig = config;
      console.log(`[FlexibleElementManager] Set current list: ${listId}`);
    }

    /**
     * DOM要素を直接更新（EditElementManagerのパターン）
     */
    async updateElementDirectly(elementId, updates) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!element) {
        console.warn(`[FlexibleElementManager] Element not found: ${elementId}`);
        return false;
      }

      try {
        // 各フィールドを直接更新
        Object.keys(updates).forEach(fieldKey => {
          let input = element.querySelector(`[data-field="${fieldKey}"]`);
          
          // プロンプトフィールドの場合、実際のdata-fieldは"prompt"
          if (!input && fieldKey === 'prompt') {
            input = element.querySelector(`[data-field="prompt"]`);
          }
          
          if (input) {
            // 値を更新するだけで、イベントは発火しない（重複防止）
            input.value = updates[fieldKey];
            console.log(`[FlexibleElementManager] Updated field ${fieldKey} to: ${updates[fieldKey]}`);
          } else {
            console.warn(`[FlexibleElementManager] Input field not found for key: ${fieldKey}`);
          }
        });

        return true;
        
      } catch (error) {
        console.error('[FlexibleElementManager] Direct update failed:', error);
        return false;
      }
    }

    /**
     * スクロール位置保存
     */
    saveScrollPosition() {
      if (!this.currentListId) return;
      
      // currentListIdが既に#を含んでいるかチェック
      const selector = this.currentListId.startsWith('#') ? this.currentListId : `#${this.currentListId}`;
      const container = document.querySelector(selector);
      if (container) {
        const scrollTop = container.scrollTop;
        this.scrollPositions.set(this.currentListId, scrollTop);
        console.log(`[FlexibleElementManager] Saved scroll position: ${scrollTop} for ${this.currentListId}`);
      } else {
        console.warn(`[FlexibleElementManager] Container not found for selector: ${selector}`);
      }
    }

    /**
     * スクロール位置復元
     */
    restoreScrollPosition() {
      if (!this.currentListId) return;
      
      const savedPosition = this.scrollPositions.get(this.currentListId);
      if (savedPosition !== undefined) {
        // currentListIdが既に#を含んでいるかチェック
        const selector = this.currentListId.startsWith('#') ? this.currentListId : `#${this.currentListId}`;
        const container = document.querySelector(selector);
        if (container) {
          container.scrollTop = savedPosition;
          console.log(`[FlexibleElementManager] Restored scroll position: ${savedPosition} for ${this.currentListId}`);
        } else {
          console.warn(`[FlexibleElementManager] Container not found for restore: ${selector}`);
        }
      }
    }

    /**
     * フォーカス復元
     */
    restoreFocus(elementId) {
      // フォーカス復元を無効化（辞書タブでの意図しないフォーカス移動を防止）
      // 小項目やプロンプト入力後に大項目にフォーカスが移動してしまう問題を解消
      console.log(`[FlexibleElementManager] Focus restore disabled for element: ${elementId}`);
    }

    /**
     * 単一要素のフィールド状態更新
     */
    updateSingleElementFieldStates(elementId) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!element) return;

      // readonly状態を解除
      const inputs = element.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        if (input.hasAttribute('readonly')) {
          input.removeAttribute('readonly');
          input.disabled = false;
          input.classList.remove('readonly-field');
        }
      });
    }

    /**
     * 現在のリストをリフレッシュ（必要時のみ）
     */
    async refreshCurrentList() {
      if (!this.currentConfig || !this.currentConfig.refreshCallback) {
        console.warn('[FlexibleElementManager] No refresh callback available');
        return;
      }

      try {
        await this.currentConfig.refreshCallback();
      } catch (error) {
        console.error('[FlexibleElementManager] Refresh failed:', error);
      }
    }

    /**
     * データ層に要素追加
     */
    async addElementToData(position, initialData) {
      if (!this.currentConfig?.addElementToData) {
        console.warn('[FlexibleElementManager] No addElementToData callback configured');
        return null;
      }
      return await this.currentConfig.addElementToData(position, initialData);
    }

    /**
     * DOMに要素追加
     */
    async addElementToDOM(elementId, position, initialData) {
      if (!this.currentConfig?.addElementToDOM) {
        console.warn('[FlexibleElementManager] No addElementToDOM callback configured');
        return;
      }
      await this.currentConfig.addElementToDOM(elementId, position, initialData);
    }

    /**
     * DOMから要素削除
     */
    async removeElementFromDOM(elementId) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (element) {
        // スクロール位置を保存してから削除
        this.saveScrollPosition();
        element.remove();
        return true;
      }
      return false;
    }

    /**
     * データ層から要素削除
     */
    async removeElementFromData(elementId) {
      if (!this.currentConfig?.removeElementFromData) {
        console.warn('[FlexibleElementManager] No removeElementFromData callback configured');
        return false;
      }
      return await this.currentConfig.removeElementFromData(elementId);
    }

    /**
     * 要素ID整合性確保
     */
    ensureElementIdConsistency() {
      if (!this.currentListId) return;
      
      const container = document.querySelector(`#${this.currentListId}`);
      if (!container) return;

      const elements = container.querySelectorAll('[data-element-id]');
      elements.forEach((element, index) => {
        // data-id属性を配列インデックスに合わせて更新
        element.setAttribute('data-id', index);
      });
    }

    /**
     * パフォーマンス監視
     */
    updatePerformanceMetrics(startTime) {
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      this.performanceMetrics.updateCount++;
      this.performanceMetrics.lastUpdateTime = updateTime;
      this.performanceMetrics.averageUpdateTime = 
        (this.performanceMetrics.averageUpdateTime * (this.performanceMetrics.updateCount - 1) + updateTime) / 
        this.performanceMetrics.updateCount;

      if (updateTime > 100) { // 100ms以上の場合は警告
        console.warn(`[FlexibleElementManager] Slow update detected: ${updateTime.toFixed(2)}ms`);
      }
    }

    /**
     * パフォーマンス統計表示
     */
    getPerformanceStats() {
      return {
        ...this.performanceMetrics,
        averageUpdateTime: Math.round(this.performanceMetrics.averageUpdateTime * 100) / 100
      };
    }

    /**
     * デバッグ情報表示
     */
    debug() {
      console.log('[FlexibleElementManager] Debug Info:', {
        currentListId: this.currentListId,
        scrollPositions: Object.fromEntries(this.scrollPositions),
        performanceStats: this.getPerformanceStats(),
        currentConfig: this.currentConfig ? 'Set' : 'Not Set'
      });
    }

    /**
     * クリーンアップ
     */
    cleanup() {
      this.scrollPositions.clear();
      this.currentListId = null;
      this.currentConfig = null;
      console.log('[FlexibleElementManager] Cleaned up');
    }
  }

  // グローバルに公開
  if (typeof window !== "undefined") {
    window.FlexibleElementManager = FlexibleElementManager;
  }

  // モジュールエクスポート対応
  if (typeof module !== "undefined" && module.exports) {
    module.exports = FlexibleElementManager;
  }
})();