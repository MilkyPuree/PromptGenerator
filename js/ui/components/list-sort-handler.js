/**
 * list-sort-handler.js
 * PromptListManagerのソート関連機能をミックスインとして提供
 *
 * 分離元: list-manager.js
 * 含まれる機能:
 *   - handleSortCommon: ドラッグソート後の共通処理
 *   - handleHeaderClickSort: ヘッダークリックによるソート
 *   - updateHeaderSortIndicators: ソートインジケーター更新
 *   - performColumnSort: 実際のソート処理
 *   - reorderDOMElements: DOM要素の並び替え（未実装）
 */

(function () {
  "use strict";

  function defineSortHandlers() {
    if (typeof PromptListManager === "undefined") {
      setTimeout(defineSortHandlers, 10);
      return;
    }

    /**
     * ドラッグソート後の共通処理
     * @param {Array} sortedIds - ソート後のID配列
     * @param {Array} dataArray - データ配列（参照渡しで更新される）
     * @param {Function} afterSortCallback - ソート後のコールバック
     * @param {string} debugContext - デバッグ用コンテキスト名
     */
    PromptListManager.prototype.handleSortCommon = function (
      sortedIds,
      dataArray,
      afterSortCallback,
      debugContext = "SORT"
    ) {
      const validIds = sortedIds.filter((id) => id !== "" && id !== null && id !== undefined);

      const sortedElements = validIds
        .map((id) => {
          let element = dataArray.find((el) => el && el.id == id);
          return element;
        })
        .filter(Boolean);

      if (sortedElements.length === 0) {
        return;
      }

      sortedElements.forEach((element, index) => {
        if (element) {
          element.sort = index;
        }
      });

      dataArray.length = 0; // 配列をクリア
      dataArray.push(...sortedElements); // ソート済み要素で置き換え

      if (typeof afterSortCallback === "function") {
        try {
          afterSortCallback();
        } catch (error) {}
      }
    };

    /**
     * ヘッダークリックによるソート処理
     * @param {string} listId - リストのセレクター
     * @param {string} columnType - ソート対象カラム('category', 'prompt', 'weight')
     * @param {Array} dataArray - データ配列
     * @param {Function} refreshCallback - リフレッシュコールバック
     * @param {Function} saveCallback - 保存コールバック
     * @param {number|null} categoryIndex - カテゴリーインデックス（0:大, 1:中, 2:小）
     */
    PromptListManager.prototype.handleHeaderClickSort = function (
      listId,
      columnType,
      dataArray,
      refreshCallback,
      saveCallback,
      categoryIndex = null
    ) {
      const currentState = this.sortStates.get(listId) || { column: null, direction: null };

      let newDirection;
      if (currentState.column === columnType) {
        if (currentState.direction === "asc") {
          newDirection = "desc";
        } else {
          newDirection = "asc";
        }
      } else {
        newDirection = "asc";
      }

      this.sortStates.set(listId, {
        column: columnType,
        direction: newDirection,
      });

      this.updateHeaderSortIndicators(listId, columnType, newDirection, categoryIndex);

      this.performColumnSort(dataArray, columnType, newDirection, listId, categoryIndex);

      if (dataArray && dataArray.length > 0) {
        dataArray.forEach((item, index) => {
          if (item && item.sort !== undefined) {
            item.sort = index;
          }
        });
      }

      if (typeof saveCallback === "function") {
        saveCallback();
      }

      if (typeof refreshCallback === "function") {
        refreshCallback();
      }
    };

    /**
     * ヘッダーのソートインジケーターを更新
     * @param {string} listId - リストのセレクター
     * @param {string} activeColumn - アクティブなカラム
     * @param {string} direction - ソート方向('asc' or 'desc')
     * @param {number|null} targetColumnIndex - カテゴリーカラムのインデックス
     */
    PromptListManager.prototype.updateHeaderSortIndicators = function (
      listId,
      activeColumn,
      direction,
      targetColumnIndex = null
    ) {
      const list = document.querySelector(listId);
      if (!list) return;

      const headerInputs = list.querySelectorAll(".prompt-list-header .prompt-list-input");

      headerInputs.forEach((input, index) => {
        input.classList.remove("sortable-header", "sort-asc", "sort-desc");

        const columnConfig = [
          { type: "category", index: 0 }, // 大項目
          { type: "category", index: 1 }, // 中項目
          { type: "category", index: 2 }, // 小項目
          { type: "prompt", index: null },
          { type: "weight", index: null },
        ];

        if (index < columnConfig.length) {
          const config = columnConfig[index];
          input.classList.add("sortable-header");

          let isActiveColumn = false;
          if (activeColumn === "category" && config.type === "category") {
            isActiveColumn = targetColumnIndex !== null && config.index === targetColumnIndex;
          } else if (activeColumn === config.type) {
            isActiveColumn = true;
          }

          if (isActiveColumn && direction) {
            input.classList.add(`sort-${direction}`);
          }
        }
      });
    };

    /**
     * 実際のカラムソート処理
     * @param {Array} dataArray - ソート対象の配列
     * @param {string} columnType - カラムタイプ
     * @param {string} direction - ソート方向
     * @param {string} listId - リストID（未使用だが将来の拡張用）
     * @param {number|null} categoryIndex - カテゴリーインデックス
     */
    PromptListManager.prototype.performColumnSort = function (
      dataArray,
      columnType,
      direction,
      listId,
      categoryIndex = null
    ) {
      dataArray.sort((a, b) => {
        let valueA, valueB;

        switch (columnType) {
          case "category":
            if (categoryIndex !== null) {
              if (categoryIndex === 0 && a.title !== undefined) {
                valueA = a.title || "";
                valueB = b.title || "";
              } else {
                valueA = (a.data || [])[categoryIndex] || "";
                valueB = (b.data || [])[categoryIndex] || "";
              }
            } else {
              valueA = (a.data || []).join(" > ");
              valueB = (b.data || []).join(" > ");
            }
            break;
          case "prompt":
            valueA = a.prompt || "";
            valueB = b.prompt || "";
            break;
          case "weight":
            valueA = parseFloat(a.weight) || 0;
            valueB = parseFloat(b.weight) || 0;
            break;
          default:
            return 0;
        }

        if (typeof valueA === "string" && typeof valueB === "string") {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }

        let result;
        if (valueA < valueB) {
          result = -1;
        } else if (valueA > valueB) {
          result = 1;
        } else {
          result = 0;
        }

        return direction === "desc" ? -result : result;
      });
    };

    /**
     * DOM要素の並び替え（将来の実装用）
     * @param {string} listId - リストのセレクター
     * @param {Array} sortedDataArray - ソート済みデータ配列
     */
    PromptListManager.prototype.reorderDOMElements = function (listId, sortedDataArray) {
      // 将来の実装用プレースホルダー
    };
  }

  defineSortHandlers();
})();
