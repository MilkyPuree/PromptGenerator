const categoryData = {
  data: [[], [], []],

  _isUpdating: false,

  init: function () {
    if (typeof loadCategory === "function") {
      loadCategory()
        .then(() => {
          if (AppState?.data?.categoryData && AppState.data.categoryData[0]?.length > 0) {
            this.data = AppState.data.categoryData;
          } else {
            this.update();
          }
        })
        .catch((error) => {
          ErrorHandler.log("カテゴリーデータの読み込みに失敗", error);
          this.update();
        });
    } else {
      Storage.get(["categoryData"])
        .then((items) => {
          if (items.categoryData != null && items.categoryData[0]?.length > 0) {
            this.data = items.categoryData;
          } else {
            this.update();
          }
        })
        .catch((error) => {
          ErrorHandler.log("カテゴリーデータの読み込みに失敗", error);
          this.update();
        });
    }
  },

  update: function () {
    if (this._isUpdating) {
      return Promise.resolve();
    }

    this._isUpdating = true;

    if (window.PerformanceMonitor) {
      PerformanceMonitor.start("categoryUpdate");
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          this.data = [[], [], []];

          const uniqueKeys = [new Map(), new Map(), new Map()];

          this.updateAsync(uniqueKeys, resolve);
        } catch (error) {
          this._isUpdating = false;
          resolve();
        }
      }, 0);
    });
  },

  updateAsync: function (uniqueKeys, resolve) {
    try {
      const localItems = AppState.data.localPromptList || [];

      localItems.forEach((item) => {
        if (item && item.data) {
          this.addItem(item, uniqueKeys);
        }
      });

      const masterItems = getMasterPrompts();
      this.processMasterDataChunked(masterItems, uniqueKeys, 0, resolve);
    } catch (error) {
      this._isUpdating = false;
      resolve();
    }
  },

  processMasterDataChunked: function (masterItems, uniqueKeys, index, resolve) {
    const chunkSize = 200; // 200件ずつ処理
    const endIndex = Math.min(index + chunkSize, masterItems.length);

    for (let i = index; i < endIndex; i++) {
      const item = masterItems[i];
      if (item && item.data) {
        this.addItem(item, uniqueKeys);
      }
    }

    if (endIndex < masterItems.length) {
      setTimeout(() => {
        this.processMasterDataChunked(masterItems, uniqueKeys, endIndex, resolve);
      }, 5); // 5ms間隔で処理
    } else {
      this.finishUpdate(resolve);
    }
  },

  finishUpdate: function (resolve) {
    try {
      if (typeof saveCategory === "function") {
        if (AppState?.data) {
          AppState.data.searchCategory = this.data;
        }
        saveCategory()
          .then(() => {})
          .catch((error) => {
            ErrorHandler.log("カテゴリーデータの保存に失敗", error);
          });
      } else {
        Storage.set({ categoryData: this.data })
          .then(() => {})
          .catch((error) => {
            ErrorHandler.log("カテゴリーデータの保存に失敗", error);
          });
      }
    } finally {
      this._isUpdating = false;

      if (window.PerformanceMonitor) {
        PerformanceMonitor.end("categoryUpdate");
      }

      if (resolve) resolve();
    }
  },

  addItem: function (item, uniqueKeys) {
    for (let i = 0; i < 3; i++) {
      const value = item.data[i];
      if (!value) continue;

      let parentKey = "";
      for (let j = 0; j < i; j++) {
        parentKey += (item.data[j] || "").replace(/[!\/]/g, "");
      }

      const uniqueKey = `${value}|${parentKey}`;

      if (!uniqueKeys[i].has(uniqueKey)) {
        uniqueKeys[i].set(uniqueKey, true);

        const pushData = { value: value };

        if (i > 0) {
          pushData.parent = parentKey;
        }

        this.data[i].push(pushData);
      }
    }
  },

  getCategoriesByParent: function (level, parentValue = null) {
    if (level < 0 || level > 2) return [];

    if (level === 0 || !parentValue) {
      let categories = this.data[level].map((item) => item.value);

      if (level === 0) {
        categories = this.filterNSFWCategories(categories);
      }

      return categories;
    }

    return this.data[level].filter((item) => item.parent === parentValue).map((item) => item.value);
  },

  filterNSFWCategories: function (categories) {
    const showNSFW = AppState.userSettings?.optionData?.showNSFWCategories === true;

    if (showNSFW) {
      return categories;
    }

    return categories.filter((category) => {
      const categoryStr = String(category || "").trim();

      const isNSFW =
        categoryStr === "NSFW" ||
        categoryStr.startsWith("NSFW:") ||
        categoryStr === "nsfw" ||
        categoryStr.startsWith("nsfw:") ||
        categoryStr.toUpperCase().includes("NSFW");

      return !isNSFW;
    });
  },

  exists: function (value, level, parent = null) {
    return this.data[level].some((item) => item.value === value && (parent === null || item.parent === parent));
  },

  getStats: function () {
    return {
      bigCategories: this.data[0].length,
      middleCategories: this.data[1].length,
      smallCategories: this.data[2].length,
      memoryEstimate: this.estimateMemoryUsage(),
    };
  },

  estimateMemoryUsage: function () {
    let totalChars = 0;

    this.data.forEach((level) => {
      level.forEach((item) => {
        totalChars += (item.value || "").length;
        totalChars += (item.parent || "").length;
      });
    });

    const estimatedBytes = totalChars * 2;

    if (estimatedBytes < 1024) {
      return `${estimatedBytes} B`;
    } else if (estimatedBytes < 1024 * 1024) {
      return `${(estimatedBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  },
};

// @deprecated CategoryUIManager.populateDropdown()を使用するため廃止予定
function setCategoryList(selectorId, categoryLevel) {
  if (window.CategoryUIManager) {
    const manager = new CategoryUIManager();
    manager.populateDropdown(selectorId, categoryLevel);
    return;
  }

  const selectElement = document.querySelector(selectorId);
  if (!selectElement) return;

  const currentValue = selectElement.value;

  selectElement.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "";
  selectElement.appendChild(emptyOption);

  const fragment = document.createDocumentFragment();

  categoryData.data[categoryLevel].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.value;
    fragment.appendChild(option);
  });

  selectElement.appendChild(fragment);
  selectElement.disabled = false;

  if (currentValue && Array.from(selectElement.options).some((opt) => opt.value === currentValue)) {
    selectElement.value = currentValue;
  }
}

function immediateCategoryUpdate() {
  categoryData.update();
}

if (typeof window !== "undefined") {
  window.categoryData = categoryData;
  window.setCategoryList = setCategoryList;
  window.immediateCategoryUpdate = immediateCategoryUpdate;
}
