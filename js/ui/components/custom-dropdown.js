class DropdownManager {
  constructor() {
    this.activeDropdown = null;
    this.isInitialized = false;
    this.toastProtectionMode = false; // トースト表示中の保護モード
  }

  init() {
    if (this.isInitialized) return;

    document.addEventListener("click", (e) => {
      if (this.activeDropdown && !this.activeDropdown.contains(e.target)) {
        this.closeActive();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.activeDropdown) {
        this.closeActive();
      }
    });

    this.isInitialized = true;
  }

  setActive(dropdown) {
    if (this.activeDropdown && this.activeDropdown !== dropdown) {
      this.activeDropdown.close();
    }
    this.activeDropdown = dropdown;
  }

  closeActive() {
    if (this.toastProtectionMode) {
      return;
    }

    if (this.activeDropdown) {
      this.activeDropdown.close();
      this.activeDropdown = null;
    }
  }

  setToastProtection(enabled) {
    this.toastProtectionMode = enabled;
  }

  unregister(dropdown) {
    if (this.activeDropdown === dropdown) {
      this.activeDropdown = null;
    }
  }
}

const dropdownManager = new DropdownManager();

class CustomDropdown {
  constructor(inputElement, options = {}) {
    this.inputElement = inputElement;
    this.options = {
      categoryLevel: 0, // 0=大項目, 1=中項目, 2=小項目
      placeholder: "",
      maxHeight: 400,
      onSubmit: null,
      onBlur: null, // Blur時のコールバック（保存のみ）
      onOpen: null,
      onClose: null,
      ...options,
    };

    this.isOpen = false;
    this.selectedIndex = -1;
    this.items = [];
    this.filteredItems = [];

    this.init();
  }

  init() {
    dropdownManager.init();

    if (this.inputElement.customDropdown !== this) {
      UIUtilities.destroyDropdown(this.inputElement);
    }

    this.inputElement.setAttribute("autocomplete", "off");

    this.createDropdownElement();
    this.bindEvents();

    this.inputElement.customDropdown = this;
  }

  createDropdownElement() {
    this.dropdownElement = document.createElement("div");
    this.dropdownElement.className = "custom-dropdown";
    this.dropdownElement.setAttribute("role", "listbox");
    this.dropdownElement.setAttribute("aria-hidden", "true");

    this.listElement = document.createElement("ul");
    this.listElement.className = "custom-dropdown-list";
    this.listElement.setAttribute("role", "list");

    this.dropdownElement.appendChild(this.listElement);

    document.body.appendChild(this.dropdownElement);

    this.updatePosition();
  }

  bindEvents() {
    this.inputElement.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.inputElement.addEventListener("input", (e) => {
      this.filterItems(e.target.value);
      if (!this.isOpen) {
        this.open();
      }
    });

    this.inputElement.addEventListener("keydown", (e) => {
      this.handleKeyDown(e);
    });

    this.inputElement.addEventListener("blur", (e) => {
      setTimeout(() => {
        if (dropdownManager.toastProtectionMode) {
          return;
        }

        if (this.isOpen && this.dropdownElement && this.dropdownElement.contains(document.activeElement)) {
          return;
        }

        this.handleBlur();
        this.close();
      }, 200);
    });

    this.dropdownElement.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = e.target.closest(".custom-dropdown-item");
      if (item) {
        this.selectItem(item.dataset.value);
      }
    });

    this.dropdownElement.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    window.addEventListener("resize", () => {
      if (this.isOpen) {
        this.updatePosition();
      }
    });

    this.scrollHandler = (e) => {
      if (this.isOpen) {
        if (dropdownManager.toastProtectionMode) {
          return;
        }

        if (this.dropdownElement && this.dropdownElement.contains(e.target)) {
          return;
        }
        this.close();
      }
    };

    window.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true });
    document.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true });
  }

  handleKeyDown(e) {
    if (!this.isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        this.open();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleSubmit();
        return;
      }
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.selectNext();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.selectPrevious();
        break;
      case "Enter":
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectItem(this.filteredItems[this.selectedIndex]);
        } else {
          this.handleSubmit();
        }
        break;
      case "Escape":
        e.preventDefault();
        this.close();
        break;
    }
  }

  open() {
    if (!this.inputElement || !this.dropdownElement) {
      return;
    }

    if (this.isOpen) {
      return;
    }

    dropdownManager.setActive(this);

    this.loadData();

    this.isOpen = true;
    this.dropdownElement.classList.add("open");
    this.dropdownElement.setAttribute("aria-hidden", "false");
    this.updatePosition();

    if (this.options.onOpen) {
      this.options.onOpen();
    }
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.selectedIndex = -1;

    if (this.dropdownElement) {
      this.dropdownElement.classList.remove("open");
      this.dropdownElement.setAttribute("aria-hidden", "true");
    }

    dropdownManager.unregister(this);

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  loadData() {
    const parentValue = this.getParentValue();

    if (typeof window.categoryUIManager !== "undefined") {
      this.items = window.categoryUIManager.getCategoriesByLevel(this.options.categoryLevel, parentValue);
    } else {
      this.items = [];
    }

    this.filteredItems = [...this.items];
    this.renderItems();
  }

  getParentValue() {
    const level = this.options.categoryLevel;

    if (level === 0) {
      return null;
    }

    let container = this.inputElement.closest(".flexible-list-item");
    if (!container) {
      container = this.inputElement.closest(".test-section");
    }
    if (!container) {
      container = this.inputElement.closest(".search-container");
    }
    if (!container) {
      container =
        this.inputElement.closest("[data-item-id]") ||
        this.inputElement.closest("li") ||
        this.inputElement.parentElement?.parentElement;
    }

    if (!container) {
      return null;
    }

    if (level === 1) {
      let bigInput = container.querySelector('input[data-field="data.0"]');
      if (!bigInput) {
        bigInput = container.querySelector("input.category-big");
      }
      if (!bigInput) {
        bigInput = container.querySelector("#big, #test-big");
      }
      if (!bigInput) {
        const inputs = container.querySelectorAll('input[type="text"]');
        if (inputs.length > 0) {
          bigInput = inputs[0];
        }
      }

      return bigInput ? bigInput.value : null;
    }

    if (level === 2) {
      let bigInput = container.querySelector('input[data-field="data.0"]');
      let middleInput = container.querySelector('input[data-field="data.1"]');

      if (!bigInput || !middleInput) {
        const inputs = container.querySelectorAll('input[type="text"]');
        if (inputs.length >= 2) {
          bigInput = inputs[0];
          middleInput = inputs[1];
        }
      }

      if (!bigInput || !middleInput) return null;

      const bigValue = bigInput.value || "";
      const middleValue = middleInput.value || "";

      return bigValue.replace(/[!\/]/g, "") + middleValue.replace(/[!\/]/g, "");
    }

    return null;
  }

  filterItems(query) {
    const lowerQuery = query.toLowerCase();
    this.filteredItems = this.items.filter((item) => item.toLowerCase().includes(lowerQuery));
    this.selectedIndex = -1;
    this.renderItems();

    if (this.isOpen) {
      this.updatePosition();
    }
  }

  renderItems() {
    this.listElement.innerHTML = "";

    if (this.filteredItems.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "custom-dropdown-item empty";
      emptyItem.textContent = "アイテムが見つかりません";
      this.listElement.appendChild(emptyItem);
      return;
    }

    const currentValue = this.inputElement.value.trim();
    let matchingIndex = -1;

    const fragment = document.createDocumentFragment();
    this.filteredItems.forEach((item, index) => {
      const listItem = document.createElement("li");
      listItem.className = "custom-dropdown-item";
      listItem.setAttribute("role", "option");
      listItem.setAttribute("data-value", item);
      listItem.textContent = item;

      if (currentValue && item === currentValue) {
        listItem.classList.add("current-match");
        matchingIndex = index;
      }

      if (index === this.selectedIndex) {
        listItem.classList.add("selected");
      }

      fragment.appendChild(listItem);
    });

    this.listElement.appendChild(fragment);

    if (matchingIndex >= 0) {
      setTimeout(() => {
        this.scrollToMatchingItem(matchingIndex);
      }, 50);
    }
  }

  scrollToMatchingItem(index) {
    const items = this.listElement.querySelectorAll(".custom-dropdown-item");
    const targetItem = items[index];

    if (targetItem) {
      targetItem.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "nearest",
      });
    }
  }

  selectNext() {
    if (this.filteredItems.length === 0) return;

    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
    this.updateSelection();
  }

  selectPrevious() {
    if (this.filteredItems.length === 0) return;

    this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
    this.updateSelection();
  }

  updateSelection() {
    const items = this.listElement.querySelectorAll(".custom-dropdown-item");
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("selected");
      }
    });
  }

  selectItem(value) {
    this.inputElement.value = value;
    this.handleSubmit();
    this.close();
  }

  handleSubmit() {
    if (!this.inputElement) {
      return;
    }

    if (this.options.onSubmit) {
      try {
        this.options.onSubmit(this.inputElement.value);
      } catch (error) {}
    }
  }

  handleBlur() {
    if (!this.inputElement) {
      return;
    }

    if (this.options.onBlur) {
      try {
        this.options.onBlur(this.inputElement.value);
      } catch (error) {}
    }
  }

  calculateOptimalHeight() {
    const itemHeight = 22; // 1項目の高さ（padding込み、少し余裕を持たせて）
    const padding = 12; // top + bottom padding（少し余裕を持たせて）
    const minHeight = 50; // 最小高さ（空状態でも見やすく）

    if (this.filteredItems.length === 0) {
      return minHeight;
    }

    const calculatedHeight = this.filteredItems.length * itemHeight + padding;
    return Math.min(calculatedHeight, this.options.maxHeight);
  }

  updatePosition() {
    if (!this.inputElement || !this.dropdownElement) {
      return;
    }

    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
    }

    // 位置計算前に少し待つ（DOM更新後の正確な位置取得のため）
    this.positionTimer = setTimeout(() => {
      this.positionTimer = null;

      if (!this.inputElement || !this.dropdownElement) {
        return;
      }

      let inputRect, dropdownParent, windowHeight;

      try {
        inputRect = this.inputElement.getBoundingClientRect();
        dropdownParent = this.dropdownElement.parentElement;
        windowHeight = window.innerHeight;

        if (inputRect.width === 0 || inputRect.height === 0) {
          return;
        }
      } catch (error) {
        return;
      }

      const actualContentHeight = this.calculateOptimalHeight();

      const spaceBelow = windowHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;
      const shouldShowAbove = spaceBelow < actualContentHeight && spaceAbove > spaceBelow;

      this.dropdownElement.style.position = "fixed";
      this.dropdownElement.style.width = `${inputRect.width}px`;
      this.dropdownElement.style.left = `${inputRect.left}px`;
      this.dropdownElement.style.zIndex = "9999";
      this.dropdownElement.style.height = `${actualContentHeight}px`;

      if (shouldShowAbove) {
        this.dropdownElement.style.top = `${inputRect.top - actualContentHeight}px`;
        this.dropdownElement.style.bottom = "auto";
        this.dropdownElement.classList.add("above");
      } else {
        this.dropdownElement.style.top = `${inputRect.bottom}px`;
        this.dropdownElement.style.bottom = "auto";
        this.dropdownElement.classList.remove("above");
      }
    }, 10); // 10ms遅延で位置計算
  }

  destroy() {
    dropdownManager.unregister(this);

    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
      this.positionTimer = null;
    }

    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      document.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.dropdownElement && this.dropdownElement.parentNode) {
      this.dropdownElement.remove();
      this.dropdownElement = null;
    }

    if (this.inputElement && this.inputElement.customDropdown === this) {
      this.inputElement.customDropdown = null;
    }

    this.inputElement = null;
    this.listElement = null;
    this.items = [];
    this.filteredItems = [];
    this.isOpen = false;
  }

  contains(element) {
    return this.inputElement.contains(element) || this.dropdownElement.contains(element);
  }
}

window.CustomDropdown = CustomDropdown;
window.dropdownManager = dropdownManager;
