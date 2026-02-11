(function () {
  "use strict";

  class FlexibleElementManager {
    constructor(listManager) {
      this.listManager = listManager;
      this.currentListId = null;
      this.currentConfig = null;
      this.scrollPositions = new Map(); // リスト別スクロール位置保持

      this.performanceMetrics = {
        updateCount: 0,
        averageUpdateTime: 0,
        lastUpdateTime: 0,
      };
    }

    async updateElement(elementId, updates, options = {}) {
      const startTime = performance.now();

      try {
        const {
          preserveFocus = true,
          updateFieldStates = true,
          updateDisplay = true,
          delay = 0,
          skipRefresh = true, // デフォルトでリフレッシュをスキップ
        } = options;

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        this.saveScrollPosition();

        const success = await this.updateElementDirectly(elementId, updates);

        if (success) {
          if (updateFieldStates) {
            this.updateSingleElementFieldStates(elementId);
          }

          // 表示更新（必要な場合のみ）
          if (updateDisplay && !skipRefresh) {
            await this.refreshCurrentList();
          }

          if (preserveFocus) {
            this.restoreFocus(elementId);
          }

          setTimeout(() => {
            this.restoreScrollPosition();
          }, 50);
        }

        this.updatePerformanceMetrics(startTime);
        return success;
      } catch (error) {
        return false;
      }
    }

    async updateFieldOnly(elementId, fieldKey, value) {
      return await this.updateElement(
        elementId,
        { [fieldKey]: value },
        {
          preserveFocus: false, // フォーカス復元を無効化（辞書タブでの意図しないフォーカス移動を防止）
          updateFieldStates: false,
          updateDisplay: false,
          skipRefresh: true,
        }
      );
    }

    async addElement(position = "bottom", initialData = {}) {
      const startTime = performance.now();

      try {
        this.saveScrollPosition();

        const newElementId = await this.addElementToData(position, initialData);

        if (newElementId) {
          await this.addElementToDOM(newElementId, position, initialData);

          this.ensureElementIdConsistency();

          setTimeout(() => {
            this.restoreScrollPosition();
          }, 100);
        }

        this.updatePerformanceMetrics(startTime);
        return newElementId;
      } catch (error) {
        return null;
      }
    }

    async removeElement(elementId) {
      const startTime = performance.now();

      try {
        this.saveScrollPosition();

        const success = await this.removeElementFromDOM(elementId);

        if (success) {
          await this.removeElementFromData(elementId);

          setTimeout(() => {
            this.restoreScrollPosition();
          }, 10);
        }

        this.updatePerformanceMetrics(startTime);
        return success;
      } catch (error) {
        return false;
      }
    }

    setCurrentList(listId, config) {
      this.currentListId = listId;
      this.currentConfig = config;
    }

    async updateElementDirectly(elementId, updates) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!element) {
        return false;
      }

      try {
        Object.keys(updates).forEach((fieldKey) => {
          let input = element.querySelector(`[data-field="${fieldKey}"]`);

          if (!input && fieldKey === "prompt") {
            input = element.querySelector(`[data-field="prompt"]`);
          }

          if (input) {
            input.value = updates[fieldKey];
          }
        });

        return true;
      } catch (error) {
        return false;
      }
    }

    saveScrollPosition() {
      if (!this.currentListId) return;

      const selector = this.currentListId.startsWith("#") ? this.currentListId : `#${this.currentListId}`;
      const container = document.querySelector(selector);
      if (container) {
        const scrollTop = container.scrollTop;
        this.scrollPositions.set(this.currentListId, scrollTop);
      }
    }

    restoreScrollPosition() {
      if (!this.currentListId) return;

      const savedPosition = this.scrollPositions.get(this.currentListId);
      if (savedPosition !== undefined) {
        const selector = this.currentListId.startsWith("#") ? this.currentListId : `#${this.currentListId}`;
        const container = document.querySelector(selector);
        if (container) {
          container.scrollTop = savedPosition;
        }
      }
    }

    restoreFocus(elementId) {}

    updateSingleElementFieldStates(elementId) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!element) return;

      const inputs = element.querySelectorAll("input, textarea");
      inputs.forEach((input) => {
        if (input.hasAttribute("readonly")) {
          input.removeAttribute("readonly");
          input.disabled = false;
          input.classList.remove("readonly-field");
        }
      });
    }

    async refreshCurrentList() {
      if (!this.currentConfig || !this.currentConfig.refreshCallback) {
        return;
      }

      try {
        await this.currentConfig.refreshCallback();
      } catch (error) {}
    }

    async addElementToData(position, initialData) {
      if (!this.currentConfig?.addElementToData) {
        return null;
      }
      return await this.currentConfig.addElementToData(position, initialData);
    }

    async addElementToDOM(elementId, position, initialData) {
      if (!this.currentConfig?.addElementToDOM) {
        return;
      }
      await this.currentConfig.addElementToDOM(elementId, position, initialData);
    }

    async removeElementFromDOM(elementId) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (element) {
        this.saveScrollPosition();
        element.remove();
        return true;
      }
      return false;
    }

    async removeElementFromData(elementId) {
      if (!this.currentConfig?.removeElementFromData) {
        return false;
      }
      return await this.currentConfig.removeElementFromData(elementId);
    }

    ensureElementIdConsistency() {
      if (!this.currentListId) return;

      const container = document.querySelector(`#${this.currentListId}`);
      if (!container) return;

      const elements = container.querySelectorAll("[data-element-id]");
      elements.forEach((element, index) => {
        element.setAttribute("data-id", index);
      });
    }

    updatePerformanceMetrics(startTime) {
      const endTime = performance.now();
      const updateTime = endTime - startTime;

      this.performanceMetrics.updateCount++;
      this.performanceMetrics.lastUpdateTime = updateTime;
      this.performanceMetrics.averageUpdateTime =
        (this.performanceMetrics.averageUpdateTime * (this.performanceMetrics.updateCount - 1) + updateTime) /
        this.performanceMetrics.updateCount;
    }

    getPerformanceStats() {
      return {
        ...this.performanceMetrics,
        averageUpdateTime: Math.round(this.performanceMetrics.averageUpdateTime * 100) / 100,
      };
    }

    cleanup() {
      this.scrollPositions.clear();
      this.currentListId = null;
      this.currentConfig = null;
    }
  }

  if (typeof window !== "undefined") {
    window.FlexibleElementManager = FlexibleElementManager;
  }

  // モジュールエクスポート対応
  if (typeof module !== "undefined" && module.exports) {
    module.exports = FlexibleElementManager;
  }
})();
