/**
 * list-scroll-manager.js
 * PromptListManagerのスクロール位置管理機能をミックスインとして提供
 *
 * 分離元: list-manager.js
 * 含まれる機能:
 *   - saveScrollPosition: スクロール位置の保存
 *   - restoreScrollPosition: スクロール位置の復元
 */

(function () {
  "use strict";

  function defineScrollHandlers() {
    if (typeof PromptListManager === "undefined") {
      setTimeout(defineScrollHandlers, 10);
      return;
    }

    /**
     * スクロール位置を保存
     * @param {string} listId - リストのセレクター
     * @returns {Object} スクロール情報オブジェクト
     */
    PromptListManager.prototype.saveScrollPosition = function (listId) {
      const container = document.querySelector(listId);
      if (!container) {
        return { scrollTop: 0, scrollLeft: 0 };
      }

      const scrollInfo = {
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
        windowScrollY: window.pageYOffset || document.documentElement.scrollTop,
        windowScrollX: window.pageXOffset || document.documentElement.scrollLeft,
      };

      const flexContent = container.querySelector(".flexible-list-content");
      if (flexContent) {
        scrollInfo.flexContentScrollTop = flexContent.scrollTop;
        scrollInfo.flexContentScrollLeft = flexContent.scrollLeft;
      }

      const uiSortable = container.querySelector(".ui-sortable") || document.querySelector(".ui-sortable");
      if (uiSortable) {
        scrollInfo.uiSortableScrollTop = uiSortable.scrollTop;
        scrollInfo.uiSortableScrollLeft = uiSortable.scrollLeft;
      }

      const viewport = container.querySelector(DOM_SELECTORS.BY_CLASS.VIRTUAL_VIEWPORT);
      if (viewport) {
        scrollInfo.viewportScrollTop = viewport.scrollTop;
        scrollInfo.viewportScrollLeft = viewport.scrollLeft;
      }

      const scrollableParent = container.closest('.scrollable, .tab-content, [style*="overflow"]');
      if (scrollableParent && scrollableParent !== container) {
        scrollInfo.parentScrollTop = scrollableParent.scrollTop;
        scrollInfo.parentScrollLeft = scrollableParent.scrollLeft;
      }

      return scrollInfo;
    };

    /**
     * スクロール位置を復元
     * @param {string} listId - リストのセレクター
     * @param {Object} scrollInfo - 保存されたスクロール情報
     */
    PromptListManager.prototype.restoreScrollPosition = function (listId, scrollInfo) {
      if (!scrollInfo) {
        return;
      }

      const hasValidScrollInfo =
        scrollInfo.scrollTop !== undefined ||
        scrollInfo.scrollLeft !== undefined ||
        scrollInfo.flexContentScrollTop !== undefined ||
        scrollInfo.flexContentScrollLeft !== undefined ||
        scrollInfo.viewportScrollTop !== undefined ||
        scrollInfo.parentScrollTop !== undefined;

      if (!hasValidScrollInfo) {
        return;
      }

      const container = document.querySelector(listId);
      if (!container) {
        return;
      }

      setTimeout(() => {
        if (scrollInfo.uiSortableScrollTop !== undefined || scrollInfo.uiSortableScrollLeft !== undefined) {
          const uiSortable = container.querySelector(".ui-sortable") || document.querySelector(".ui-sortable");
          if (uiSortable) {
            uiSortable.scrollTop = scrollInfo.uiSortableScrollTop || 0;
            uiSortable.scrollLeft = scrollInfo.uiSortableScrollLeft || 0;
          }
        }

        if (scrollInfo.flexContentScrollTop || scrollInfo.flexContentScrollLeft) {
          const flexContent = container.querySelector(".flexible-list-content");
          if (flexContent) {
            flexContent.scrollTop = scrollInfo.flexContentScrollTop || 0;
            flexContent.scrollLeft = scrollInfo.flexContentScrollLeft || 0;
          }
        }

        if (scrollInfo.scrollTop || scrollInfo.scrollLeft) {
          container.scrollTop = scrollInfo.scrollTop;
          container.scrollLeft = scrollInfo.scrollLeft;
        }

        if (scrollInfo.viewportScrollTop || scrollInfo.viewportScrollLeft) {
          const viewport = container.querySelector(DOM_SELECTORS.BY_CLASS.VIRTUAL_VIEWPORT);
          if (viewport) {
            viewport.scrollTop = scrollInfo.viewportScrollTop;
            viewport.scrollLeft = scrollInfo.viewportScrollLeft;
          }
        }

        if (scrollInfo.parentScrollTop || scrollInfo.parentScrollLeft) {
          const scrollableParent = container.closest('.scrollable, .tab-content, [style*="overflow"]');
          if (scrollableParent && scrollableParent !== container) {
            scrollableParent.scrollTop = scrollInfo.parentScrollTop;
            scrollableParent.scrollLeft = scrollInfo.parentScrollLeft;
          }
        }

        if (scrollInfo.windowScrollY !== undefined || scrollInfo.windowScrollX !== undefined) {
          window.scrollTo(scrollInfo.windowScrollX || 0, scrollInfo.windowScrollY || 0);
        }
      }, 100); // 遅延を100msに増加してDOM更新完了を確実に待つ
    };
  }

  defineScrollHandlers();
})();
