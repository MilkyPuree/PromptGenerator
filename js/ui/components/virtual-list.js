class VirtualList {
  constructor(options = {}) {
    this.container = options.container; // コンテナ要素
    this.itemHeight = options.itemHeight || VIRTUAL_SCROLL.ITEM_HEIGHT; // アイテムの高さ
    this.containerHeight = options.containerHeight || "auto"; // コンテナの高さ
    this.bufferSize = options.bufferSize || VIRTUAL_SCROLL.BUFFER_SIZE; // 画面外のバッファアイテム数（上下各3画面分）
    this.onCreateItem = options.onCreateItem; // アイテム作成コールバック
    this.onUpdateItem = options.onUpdateItem; // アイテム更新コールバック

    if (!this.itemHeight || isNaN(this.itemHeight) || this.itemHeight <= 0) {
      this.itemHeight = VIRTUAL_SCROLL.ITEM_HEIGHT;
    }
    if (this.containerHeight === "auto") {
    } else if (!this.containerHeight || isNaN(this.containerHeight) || this.containerHeight <= 0) {
      this.containerHeight = "auto";
    } else {
    }
    if (!this.bufferSize || isNaN(this.bufferSize) || this.bufferSize <= 0) {
      this.bufferSize = VIRTUAL_SCROLL.BUFFER_SIZE;
    }

    if (this.containerHeight === "auto") {
      this.visibleCount = Math.ceil(VIRTUAL_SCROLL.CONTAINER_HEIGHT / this.itemHeight); // 仮の値
      this.bufferCount = this.visibleCount * this.bufferSize;
      this.renderCount = this.visibleCount + this.bufferCount * 2;
    } else {
      this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
      this.bufferCount = this.visibleCount * this.bufferSize;
      this.renderCount = this.visibleCount + this.bufferCount * 2;
    }

    this.data = [];
    this.filteredData = [];
    this.renderedItems = new Map(); // DOM要素のキャッシュ

    this.scrollTop = 0;
    this.startIndex = 0;
    this.endIndex = 0;

    this.viewport = null;
    this.listContainer = null;
    this.spacerTop = null;
    this.spacerBottom = null;

    this.isScrolling = false;
    this.scrollTimer = null;
    this.animationFrame = null;
  }

  init() {
    if (!this.container) {
      throw new Error("Container element is required");
    }

    this.createViewport();
    this.bindEvents();
    return this;
  }

  createViewport() {
    const existingHeader = this.container.querySelector("ui, .header");
    const promptListHeader = this.container.querySelector(".prompt-list-header");

    const existingItems = this.container.querySelectorAll("li:not(.header):not(.prompt-list-header)");
    existingItems.forEach((item) => item.remove());

    const existingViewport = this.container.querySelector(".virtual-list-viewport");
    if (existingViewport) {
      existingViewport.remove();
    }

    const heightValue = this.containerHeight === "auto" ? "auto" : `${this.containerHeight}px`;

    this.viewport = UIFactory.createDiv({
      className: "virtual-list-viewport",
      styles: {
        height: heightValue,
        "overflow-y": "auto",
        "overflow-x": "hidden",
        position: "relative",
      },
    });

    this.listContainer = UIFactory.createDiv({
      className: "virtual-list-container",
      styles: {
        position: "relative",
        width: "100%",
      },
    });

    this.spacerTop = UIFactory.createDiv({
      className: "virtual-list-spacer-top",
      styles: {
        height: "0px",
        "pointer-events": "none",
      },
    });

    this.spacerBottom = UIFactory.createDiv({
      className: "virtual-list-spacer-bottom",
      styles: {
        height: "0px",
        "pointer-events": "none",
      },
    });

    this.listContainer.appendChild(this.spacerTop);
    this.listContainer.appendChild(this.spacerBottom);
    this.viewport.appendChild(this.listContainer);

    if (existingHeader) {
      existingHeader.insertAdjacentElement("afterend", this.viewport);
    } else if (promptListHeader) {
      promptListHeader.insertAdjacentElement("afterend", this.viewport);
    } else {
      this.container.appendChild(this.viewport);
    }
  }

  bindEvents() {
    this.viewport.addEventListener(
      "scroll",
      (e) => {
        this.handleScroll(e);
      },
      { passive: true }
    );

    window.addEventListener("resize", () => {
      this.handleResize();
    });
  }

  handleScroll(e) {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const currentTime = performance.now();
    if (this.lastRenderTime && currentTime - this.lastRenderTime < this.dynamicThrottle) {
      return;
    }

    const currentScrollTop = this.viewport.scrollTop;
    if (this.lastEventScrollTop !== undefined && Math.abs(currentScrollTop - this.lastEventScrollTop) < 0.5) {
      this.duplicateEventCount = (this.duplicateEventCount || 0) + 1;
      if (this.duplicateEventCount > 3) {
        return;
      }
    } else {
      this.duplicateEventCount = 0;
      this.lastEventScrollTop = currentScrollTop;
    }

    this.animationFrame = requestAnimationFrame(async () => {
      const scrollStart = performance.now();

      const newScrollTop = this.viewport.scrollTop;

      const scrollDelta = Math.abs(newScrollTop - this.scrollTop);
      const isStableScroll = scrollDelta < 1; // 1px未満の変動は無視

      if (isStableScroll && this.lastStableTime && scrollStart - this.lastStableTime < 50) {
        this.animationFrame = null;
        return;
      }

      this.scrollTop = newScrollTop;
      if (scrollDelta >= 1) {
        this.lastStableTime = scrollStart;
      }

      const rangeUpdateTime = performance.now();

      const oldStartIndex = this.startIndex;
      const oldEndIndex = this.endIndex;
      this.updateVisibleRange();

      if (oldStartIndex === this.startIndex && oldEndIndex === this.endIndex) {
        this.animationFrame = null;
        return;
      }

      const renderStart = performance.now();
      await this.renderItems();
      const renderEnd = performance.now();

      const totalTime = renderEnd - scrollStart;
      if (totalTime > 50) {
        this.dynamicThrottle = Math.min(100, (this.dynamicThrottle || 16) * 1.5); // 最大100ms
      } else if (totalTime < 10) {
        this.dynamicThrottle = Math.max(8, (this.dynamicThrottle || 16) * 0.8); // 最小8ms
      }

      this.lastRenderTime = renderEnd;

      this.scrollEventCount = (this.scrollEventCount || 0) + 1;
      if (this.scrollEventCount % 50 === 0) {
        // 50回に1回チェック（頻度を削減）
        this.checkMemoryStatus();
      }

      this.animationFrame = null;
    });
  }

  handleResize() {
    if (this.containerHeight === "auto") {
      const parentHeight = this.viewport.parentElement
        ? this.viewport.parentElement.getBoundingClientRect().height
        : this.viewport.getBoundingClientRect().height;

      if (parentHeight > 0) {
        const effectiveHeight = Math.min(parentHeight, VIRTUAL_SCROLL.CONTAINER_HEIGHT); // 最大高さに制限
        this.visibleCount = Math.ceil(effectiveHeight / this.itemHeight);
        this.bufferCount = this.visibleCount * this.bufferSize;
        this.renderCount = this.visibleCount + this.bufferCount * 2;
        this.updateVisibleRange();
        this.renderItems();
      }
    } else {
      const rect = this.container.getBoundingClientRect();
      if (rect.height !== this.containerHeight) {
        this.containerHeight = rect.height;
        this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
        this.renderCount = this.visibleCount + this.bufferCount * 2;
        this.updateVisibleRange();
        this.renderItems();
      }
    }
  }

  updateVisibleRange() {
    const scrollTop = this.scrollTop;
    const startIndex = Math.floor(scrollTop / this.itemHeight);

    const oldStartIndex = this.startIndex;
    const oldEndIndex = this.endIndex;

    this.startIndex = Math.max(0, startIndex - this.bufferCount);
    this.endIndex = Math.min(this.filteredData.length - 1, startIndex + this.renderCount - 1);

    if (this.filteredData.length === 0) {
      this.startIndex = 0;
      this.endIndex = -1;
    }
  }

  async renderItems() {
    const topHeight = this.startIndex * this.itemHeight;
    const renderedItemCount = Math.max(0, this.endIndex - this.startIndex + 1);
    const remainingItems = Math.max(0, this.filteredData.length - this.startIndex - renderedItemCount);
    const bottomHeight = remainingItems * this.itemHeight;

    this.spacerTop.style.height = `${topHeight}px`;
    this.spacerBottom.style.height = `${bottomHeight}px`;

    const currentIndices = new Set();
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      currentIndices.add(i);
    }

    const itemsToRemove = [];
    if (this.renderedItems.size > 100) {
      for (const [index, element] of this.renderedItems) {
        if (!currentIndices.has(index)) {
          itemsToRemove.push([index, element]);
        }
      }
      for (const [index, element] of itemsToRemove) {
        if (element.parentNode) {
          element.remove();
        }
        this.renderedItems.delete(index);
      }
    } else {
      for (const [index, element] of this.renderedItems) {
        if (!currentIndices.has(index)) {
          if (element.parentNode) {
            element.remove();
          }
          this.renderedItems.delete(index);
        }
      }
    }

    // 必要なアイテムを作成・更新
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      if (i >= this.filteredData.length) break;

      let element = this.renderedItems.get(i);
      const item = this.filteredData[i];

      if (!element) {
        element = await this.createItemElement(item, i);
        this.renderedItems.set(i, element);
        this.insertElementInOrder(element, i);
      } else {
        const existingId = element.getAttribute("data-virtual-item-id");
        const existingSource = element.getAttribute("data-source");

        if (existingId !== item._itemId || existingSource !== item._source) {
          element.remove();
          this.renderedItems.delete(i);
          element = await this.createItemElement(item, i);
          this.renderedItems.set(i, element);
          this.insertElementInOrder(element, i);
        } else {
          await this.updateItemElement(element, item, i);
        }
      }
    }
  }

  async createItemElement(item, index) {
    const element = document.createElement("li");
    element.className = "prompt-list-item";
    UIFactory.applyCssText(element, {
      height: `${this.itemHeight}px`,
      "box-sizing": "border-box",
      display: "flex",
      "align-items": "center",
    });

    if (item._source) {
      element.setAttribute("data-source", item._source);
    }
    if (item._itemId) {
      element.setAttribute("data-virtual-item-id", item._itemId);
    }

    if (this.onCreateItem) {
      await this.onCreateItem(element, item, index);
    }

    return element;
  }

  async updateItemElement(element, item, index) {
    if (this.onUpdateItem) {
      await this.onUpdateItem(element, item, index);
    }
  }

  insertElementInOrder(element, index) {
    const existingElements = Array.from(this.listContainer.children).filter(
      (child) =>
        !child.classList.contains("virtual-list-spacer-top") && !child.classList.contains("virtual-list-spacer-bottom")
    );

    let insertBeforeElement = this.spacerBottom; // デフォルトは最後

    for (const existing of existingElements) {
      const existingIndex = this.getElementIndex(existing);
      if (existingIndex !== null && existingIndex > index) {
        insertBeforeElement = existing;
        break;
      }
    }

    this.listContainer.insertBefore(element, insertBeforeElement);
  }

  getElementIndex(element) {
    for (const [index, renderedElement] of this.renderedItems) {
      if (renderedElement === element) {
        return index;
      }
    }
    return null;
  }

  async setData(data) {
    if (!data || data.length === 0) {
      this.data = [];
    } else if (data.length > VIRTUAL_SCROLL.THRESHOLD) {
      this.data = data;
    } else {
      this.data = data.map((item) => {
        if (!item || typeof item !== "object") {
          return { prompt: "Invalid item", data: ["", "", ""] };
        }

        return {
          ...item,
          prompt: typeof item.prompt === "string" ? item.prompt : String(item.prompt || "No prompt"),
          data: Array.isArray(item.data) ? item.data : ["", "", ""],
        };
      });
    }
    this.filteredData = [...this.data];
    this.scrollTop = 0;
    this.viewport.scrollTop = 0;

    this.clearRenderedItems();
    this.updateVisibleRange();
    await this.renderItems();
  }

  async setFilter(filterFn) {
    if (typeof filterFn === "function") {
      this.filteredData = this.data.filter(filterFn);
    } else {
      this.filteredData = [...this.data];
    }

    this.scrollTop = 0;
    this.viewport.scrollTop = 0;

    this.clearRenderedItems();
    this.updateVisibleRange();
    await this.renderItems();
  }

  clearRenderedItems() {
    for (const [index, element] of this.renderedItems) {
      if (element.parentNode) {
        this.destroyCustomDropdowns(element);
        element.remove();
      }
    }
    this.renderedItems.clear();
  }

  destroyCustomDropdowns(element) {
    const destroyStart = performance.now();
    const inputs = element.querySelectorAll("input");
    let destroyedDropdowns = 0;
    let clearedLazyDropdowns = 0;
    let clearedWeightFields = 0;

    inputs.forEach((input) => {
      if (input.customDropdown) {
        input.customDropdown.destroy();
        destroyedDropdowns++;
      }

      if (input._lazyDropdownConfig) {
        input._lazyDropdownConfig = null;
        input.removeAttribute("data-dropdown-lazy");

        if (input._intersectionObserver) {
          input._intersectionObserver.disconnect();
          input._intersectionObserver = null;
        }

        if (input._pendingInit) {
          clearTimeout(input._pendingInit);
          input._pendingInit = null;
        }

        clearedLazyDropdowns++;
      }

      if (input.type === "number" && input.classList.contains("flex-col-weight")) {
        input.onchange = null;
        input.oninput = null;
        input.onblur = null;
        input.onkeydown = null;
        input.removeEventListener("wheel", input._wheelHandler);
        clearedWeightFields++;
      }
    });
  }

  scrollToIndex(index) {
    if (index < 0 || index >= this.filteredData.length) return;

    const targetScrollTop = index * this.itemHeight;
    this.viewport.scrollTop = targetScrollTop;
  }

  setItemHeight(height) {
    this.itemHeight = height;
    this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    this.renderCount = this.visibleCount + this.bufferCount * 2;

    this.updateVisibleRange();
    this.renderItems();
  }

  getStats() {
    return {
      totalItems: this.data.length,
      filteredItems: this.filteredData.length,
      renderedItems: this.renderedItems.size,
      visibleRange: `${this.startIndex}-${this.endIndex}`,
      scrollPosition: this.scrollTop,
      memoryEstimate: `${(this.renderedItems.size * 2).toFixed(1)}KB`, // 概算
    };
  }

  checkMemoryStatus() {
    this.lastScrollTime = Date.now();
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }

    this.clearRenderedItems();

    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}

if (typeof window !== "undefined") {
  window.VirtualList = VirtualList;
}
