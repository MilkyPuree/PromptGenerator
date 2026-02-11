const UIFactory = {
  createButton(config) {
    const button = document.createElement(HTML_ELEMENTS.BUTTON);
    button.type = INPUT_TYPES.BUTTON;
    button.innerHTML = config.text;

    const isEnabled = config.enabled !== false;
    button.disabled = !isEnabled;

    if (config.onClick) {
      button.addEventListener(DOM_EVENTS.CLICK, (event) => {
        if (button.disabled) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        config.onClick(event);
      });
    }

    if (config.className) {
      button.className = config.className;
    }

    if (!isEnabled) {
      button.classList.add(CSS_CLASSES.BUTTON.DISABLED);
    }

    if (config.title) {
      button.title = config.title;
    }

    if (!isEnabled && config.disabledTitle) {
      button.title = config.disabledTitle;
    }

    if (config.dataAction) {
      button.setAttribute("data-action", config.dataAction);
    }

    return button;
  },

  createInput(config) {
    const input = document.createElement(HTML_ELEMENTS.INPUT);
    input.type = config.type || INPUT_TYPES.TEXT;
    input.value = config.value !== null && config.value !== undefined ? config.value : "";
    input.className = config.className || CSS_CLASSES.LIST.PROMPT_DATA;

    // ID生成（翻訳時のフォーカス保持に必要）
    if (config.id) {
      input.id = config.id;
    } else if (config.elementId !== undefined && config.fieldType) {
      input.id = `input-${config.elementId}-${config.fieldType}`;
    }

    if (config.type === INPUT_TYPES.NUMBER) {
      if (config.min !== undefined) input.min = config.min;
      if (config.max !== undefined) input.max = config.max;
      if (config.step !== undefined) input.step = config.step;
    }

    if (config.readonly) {
      input.readOnly = true;
    }

    if (config.style) {
      Object.assign(input.style, config.style);
    }

    if (config.onInput) {
      input.addEventListener(DOM_EVENTS.INPUT, () => config.onInput(input.value, config.index));
    }

    if (config.onBlur) {
      input.addEventListener(DOM_EVENTS.BLUR, config.onBlur);
    }

    if (config.onChange) {
      input.addEventListener(DOM_EVENTS.CHANGE, config.onChange);
    }

    if (config.onKeydown) {
      input.addEventListener(DOM_EVENTS.KEY_DOWN, config.onKeydown);
    }

    if (config.placeholder) {
      input.placeholder = config.placeholder;
    }

    if (config.title) {
      input.title = config.title;
    }

    input.setAttribute("autocomplete", "off");

    if (config.dataField) {
      input.setAttribute("data-field", config.dataField);
    }

    // jQuery → Vanilla JS 置換 (Phase 8)
    // 互換性のため、新しいコードではVanilla JSで返す
    if (config.returnAsJQuery === true) {
      return window.$ ? $(input) : input; // jQueryが利用可能な場合のみ
    }

    return input;
  },

  createHeaderInput(value, columnType) {
    const classNames = [CSS_CLASSES.LIST.PROMPT_DATA, CSS_CLASSES.LIST.HEADER_INPUT];

    if (columnType === "category") {
      classNames.push(CSS_CLASSES.FLEX_COL.CATEGORY);
    } else if (columnType === "prompt") {
      classNames.push(CSS_CLASSES.FLEX_COL.PROMPT);
    } else if (columnType === "weight") {
      classNames.push(CSS_CLASSES.FLEX_COL.WEIGHT);
    } else if (columnType === "button") {
      classNames.push(CSS_CLASSES.FLEX_COL.BUTTON);
    }

    return this.createInput({
      value: value,
      readonly: true,
      className: classNames.join(" "),
    });
  },

  createListItem(config) {
    const li = document.createElement("li");

    if (config.id !== undefined) {
      li.id = config.id;
    }

    if (config.sortable) {
      li.className = CSS_CLASSES.LIST.SORTABLE_HANDLE;
    }

    // 現状のコードとの互換性のため、jQueryオブジェクトとして返す
    // jQuery → Vanilla JS 置換 (Phase 8)
    return li;
  },

  createDiv(config = {}) {
    const div = document.createElement("div");

    if (config.className) {
      div.className = config.className;
    }

    if (config.id) {
      div.id = config.id;
    }

    if (config.innerHTML) {
      div.innerHTML = config.innerHTML;
    } else if (config.textContent) {
      div.textContent = config.textContent;
    }

    if (config.styles) {
      Object.assign(div.style, config.styles);
    }

    return div;
  },

  createOption(config) {
    const option = document.createElement("option");
    option.value = config.value;
    option.textContent = config.text || config.value;

    if (config.selected) {
      option.selected = true;
    }

    return option;
  },

  createEmptyStateDiv(message, className = "") {
    return this.createDiv({
      className: `empty-state-message ${className}`.trim(),
      textContent: message,
    });
  },

  applyCssText(element, styles) {
    const cssText = Object.entries(styles)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ");
    element.style.cssText = cssText;
  },

  setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  },

  addEventListeners(element, events) {
    Object.entries(events).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  },

  createCanvas(config = {}) {
    const canvas = document.createElement("canvas");

    if (config.width) {
      canvas.width = config.width;
    }

    if (config.height) {
      canvas.height = config.height;
    }

    if (config.className) {
      canvas.className = config.className;
    }

    return canvas;
  },

  createAnchor(config = {}) {
    const a = document.createElement("a");

    if (config.href) {
      a.href = config.href;
    }

    if (config.download) {
      a.download = config.download;
    }

    if (config.textContent) {
      a.textContent = config.textContent;
    }

    if (config.className) {
      a.className = config.className;
    }

    return a;
  },
};

const ListBuilder = {
  clearList(listId, preserveHeader = false) {
    const list = document.querySelector(listId);
    if (!list) return;

    // jQuery → Vanilla JS 置換 (Phase 8)
    const listElement = typeof list === "string" ? document.querySelector(list) : list;
    if (!listElement) return;

    const allElements = listElement.querySelectorAll("*");
    allElements.forEach((element) => {
      const inputs = element.querySelectorAll("input");
      inputs.forEach((input) => {
        if (input.customDropdown) {
          input.customDropdown.destroy();
        }
      });

      const clone = element.cloneNode(false);
      if (element.parentNode) {
        element.parentNode.replaceChild(clone, element);
      }
    });

    if (listElement.classList.contains(CSS_CLASSES.LIST.SORTABLE_HANDLE)) {
      if (window.$ && typeof $(listElement).sortable === "function") {
        $(listElement).sortable("destroy");
      }
    }

    if (preserveHeader) {
      const header = list.querySelector("ui");
      const viewport = list.querySelector(".virtual-list-viewport");

      Array.from(list.children).forEach((child) => {
        if (child !== header && child !== viewport) {
          child.remove();
        }
      });

      if (viewport) {
        viewport.remove();
      }
    } else {
      while (list.firstChild) {
        list.removeChild(list.firstChild);
      }
    }
  },

  createHeaders(listId, headers, columnTypes, sortable = false, sortConfig = null) {
    const list = document.querySelector(listId);
    if (!list) return;

    const headerRow = document.createElement("li");
    headerRow.classList.add(CSS_CLASSES.LIST.HEADER);

    headers.forEach((header, index) => {
      const columnType = columnTypes?.[index];
      const headerInput = UIFactory.createHeaderInput(header, columnType);

      const $headerInput = $(headerInput[0] || headerInput);
      $headerInput.addClass(CSS_CLASSES.LIST.INPUT);

      if (columnType === "category") {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.CATEGORY);
      } else if (columnType === "prompt") {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.PROMPT);
      } else if (columnType === "weight") {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.WEIGHT);
      } else if (columnType === "button") {
        $headerInput.addClass(CSS_CLASSES.FLEX_COL.BUTTON);
      }

      // 後方互換性のため旧クラスも追加
      $headerInput.addClass(CSS_CLASSES.LIST.PROMPT_DATA);

      if (
        sortConfig &&
        sortConfig.enabled &&
        (columnType === "category" || columnType === "prompt" || columnType === "weight")
      ) {
        $headerInput.addClass("sortable-header");

        $headerInput[0].addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (sortConfig.listManager && typeof sortConfig.listManager.handleHeaderClickSort === "function") {
            let categoryIndex = null;
            if (columnType === "category") {
              categoryIndex = index; // createHeaders内のforEachのindex
            }

            sortConfig.listManager.handleHeaderClickSort(
              listId,
              columnType,
              sortConfig.dataArray,
              sortConfig.refreshCallback,
              sortConfig.saveCallback,
              categoryIndex
            );
          }
        });
      }

      headerRow.appendChild($headerInput[0]);
    });

    list.appendChild(headerRow);

    if (sortConfig && sortConfig.enabled && sortConfig.listManager) {
      const currentSortState = sortConfig.listManager.sortStates.get(listId);
      if (currentSortState && currentSortState.column && currentSortState.direction) {
        sortConfig.listManager.updateHeaderSortIndicators(listId, currentSortState.column, currentSortState.direction);
      }
    }

    // スクロールバーが必要かどうかを後で判定してスペーサーを追加
  },

  setColumnWidth(listId, columnIndex, width) {
    const list = document.querySelector(listId);
    if (list) {
      list.style.setProperty(`--column-${columnIndex}-width`, width);

      const selector = `${listId} li input:nth-of-type(${columnIndex}), ${listId} ui input:nth-of-type(${columnIndex})`;
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.style.width = width;
      });
    }
  },
};

const EventHandlers = {
  setupCategoryChain(inputs) {
    const [bigInput, middleInput, smallInput] = inputs.map((input) => (input && input.jquery ? input[0] : input));

    if (!window.categoryUIManager) {
      window.categoryUIManager = new CategoryUIManager();
    }

    if (bigInput.customDropdown) {
      bigInput.customDropdown.destroy();
    }
    bigInput.customDropdown = new CustomDropdown(bigInput, {
      categoryLevel: 0,
      onSubmit: (value) => {
        if (middleInput) {
          middleInput.value = "";
          setTimeout(() => {
            middleInput.focus();
            middleInput.click(); // ドロップダウンも開く
          }, 50);
        }
        if (smallInput) {
          smallInput.value = "";
        }
      },
    });

    if (middleInput) {
      if (middleInput.customDropdown) {
        middleInput.customDropdown.destroy();
      }
      middleInput.customDropdown = new CustomDropdown(middleInput, {
        categoryLevel: 1,
        onSubmit: (value) => {
          if (smallInput && smallInput.nodeType === Node.ELEMENT_NODE) {
            smallInput.value = "";
            setTimeout(() => {
              smallInput.focus();
            }, 50);
          }
        },
      });
    }

    if (smallInput) {
      smallInput.removeEventListener("keydown", EventHandlers._smallInputEnterHandler);

      EventHandlers._smallInputEnterHandler = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const promptInput = document.getElementById(DOM_IDS.CATEGORY.PROMPT);
          if (promptInput) {
            promptInput.focus();
          }
        }
      };

      smallInput.addEventListener("keydown", EventHandlers._smallInputEnterHandler);
    }

    const promptInput = document.getElementById(DOM_IDS.CATEGORY.PROMPT);
    if (promptInput) {
      promptInput.removeEventListener("keydown", EventHandlers._promptEnterHandler);

      EventHandlers._promptEnterHandler = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();

          const resistButton =
            document.getElementById(DOM_IDS.BUTTONS.RESIST) ||
            document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_RESIST_BTN);
          if (resistButton) {
            resistButton.click();

            // 要素追加時は大項目にフォーカスを戻す（連続追加のため）
            setTimeout(() => {
              bigInput.focus();

              if (bigInput.customDropdown) {
                setTimeout(() => {
                  bigInput.click(); // ドロップダウンを開く
                }, 50);
              }
            }, 100);
          }
        }
      };

      promptInput.addEventListener("keydown", EventHandlers._promptEnterHandler);
    }
  },

  setupSortableList(listId, onUpdate) {
    // jQuery UIのsortableは現状維持（Phase 4の後半で対応）
    if (!window.$ || !window.$.ui) {
      return;
    }
    const $list = $(listId);

    if ($list.hasClass("ui-sortable")) {
      $list.sortable("destroy");
    }

    const isEditTab = listId === DOM_SELECTORS.BY_ID.EDIT_LIST;

    const sortableOptions = {
      cancel: JQUERY_UI_CONFIG.SORTABLE_CANCEL_SELECTOR, // フォーム要素でのドラッグを無効化
      revert: JQUERY_UI_CONFIG.SORTABLE_REVERT,
      distance: JQUERY_UI_CONFIG.SORTABLE_DISTANCE,
      tolerance: JQUERY_UI_CONFIG.SORTABLE_TOLERANCE,
      cursor: JQUERY_UI_CONFIG.SORTABLE_CURSOR,
      opacity: JQUERY_UI_CONFIG.SORTABLE_OPACITY,
      scroll: !isEditTab, // 編集タブではスクロール機能を無効化
      scrollSensitivity: JQUERY_UI_CONFIG.SORTABLE_SCROLL_SENSITIVITY,
      scrollSpeed: JQUERY_UI_CONFIG.SORTABLE_SCROLL_SPEED,
      helper: isEditTab
        ? function (event, element) {
            // 編集タブ用カスタムヘルパー: スクロール問題を完全回避
            const $clone = element.clone();
            $clone.css({
              width: element.outerWidth(),
              height: element.outerHeight(),
              position: "fixed",
              "z-index": 99999,
              "pointer-events": "none",
              transform: "none",
              webkitTransform: "none",
            });
            return $clone;
          }
        : JQUERY_UI_CONFIG.SORTABLE_HELPER,
      ...(isEditTab
        ? {
            appendTo: "body",
            cursorAt: { top: 10, left: 10 }, // カーソル位置を固定
          }
        : { containment: listId }),
      start: function (event, ui) {
        const width = ui.item.outerWidth();
        const height = ui.item.outerHeight();

        const helperStyle = {
          width: width,
          height: height,
          "z-index": 99999,
          background: "var(--bg-tertiary)",
          border: "2px solid var(--accent-primary)",
          "border-radius": "var(--radius-md)",
          "box-shadow": "0 10px 30px rgba(0,0,0,0.5)",
          opacity: "0.9",
          cursor: "grabbing",
          "pointer-events": "none",
        };

        if (!isEditTab) {
          helperStyle.position = "absolute";
          ui.helper.css(helperStyle);
        }

        ui.placeholder.css({
          height: height + "px",
          visibility: "visible",
          background: "var(--bg-accent)",
          border: "2px dashed var(--accent-primary)",
          "border-radius": "var(--radius-md)",
          margin: "4px 0",
          opacity: "0.7",
        });

        ui.item.css("opacity", "0.5");
      },
      stop: function (event, ui) {
        ui.item.css("opacity", "1");

        const dragHandle = ui.item.find(".drag-handle")[0];
        if (dragHandle) {
          dragHandle.style.cursor = "grab";
        }
      },
      update: function (event, ui) {
        const sortedIds = $list.sortable("toArray");
        onUpdate(sortedIds);
      },
    };

    $list.sortable(sortableOptions);
  },
};

const PerformanceMonitor = {
  marks: new Map(),

  start(label) {
    if (typeof performance !== "undefined") {
      performance.mark(`${label}-start`);
      this.marks.set(label, performance.now());
    }
  },

  end(label) {
    if (typeof performance !== "undefined" && this.marks.has(label)) {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      this.marks.delete(label);
    }
  },
};

if (typeof window !== "undefined") {
  window.UIFactory = UIFactory;
  window.ListBuilder = ListBuilder;
  window.EventHandlers = EventHandlers;
  window.PerformanceMonitor = PerformanceMonitor;
}
