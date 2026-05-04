class BaseModal {
  constructor(modalId, options = {}) {
    this.modalId = modalId;
    this.modal = null;
    this.options = {
      closeOnBackdrop: true,
      closeOnEsc: true,
      showCloseButton: true,
      title: "",
      content: "",
      showHeader: true,
      showFooter: false,
      headerActions: [],
      footerActions: [],
      cssClass: "modal-base",
      zIndex: 10000,
      autoGenerate: false, // 動的生成モード
      ...options,
    };

    this.isVisible = false;
    this.closeCallbacks = [];
    this.showCallbacks = [];

    this.handleBackdropClick = this.handleBackdropClick.bind(this);
    this.handleEscKey = this.handleEscKey.bind(this);
    this.handleCloseClick = this.handleCloseClick.bind(this);

    this.init();
  }

  init() {
    this.modal = document.getElementById(this.modalId);

    if (this.options.autoGenerate) {
      this.generateUnifiedFrame();
    } else if (!this.modal) {
      return;
    }

    this.applyBaseStyles();

    if (this.options.showCloseButton) {
      this.setupCloseButton();
    }

    this.setupEventListeners();
  }

  applyBaseStyles() {
    if (!this.modal) return;

    const cssClasses = this.options.cssClass.split(" ").filter((cls) => cls.trim());
    cssClasses.forEach((cls) => this.modal.classList.add(cls));

    Object.assign(this.modal.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: "var(--overlay-dark)",
      zIndex: this.options.zIndex.toString(),
      display: "none",
      justifyContent: "center",
      alignItems: "center",
    });
  }

  setupCloseButton() {
    if (!this.modal) return;

    let closeBtn = this.modal.querySelector(
      "[data-modal-close], .modal-close-btn, #close-help, #close-dictionary-management, #close-slot-group-management"
    );

    if (!closeBtn) {
      closeBtn = document.createElement("button");
      closeBtn.innerHTML = "×";
      closeBtn.className = "modal-close-btn";
      closeBtn.setAttribute("data-modal-close", "true");

      const modalContent =
        this.modal.querySelector(
          ".modal-container, .dictionary-management-content, .shortcut-info-section, .generate-history-content"
        ) || this.modal.firstElementChild;
      if (modalContent) {
        modalContent.appendChild(closeBtn);
      }
    }

    closeBtn.addEventListener("click", this.handleCloseClick);
  }

  setupEventListeners() {
    if (!this.modal) return;

    if (this.options.closeOnBackdrop) {
      this.modal.addEventListener("click", this.handleBackdropClick);
    }

    if (this.options.closeOnEsc) {
      document.addEventListener("keydown", this.handleEscKey);
    }
  }

  removeEventListeners() {
    if (!this.modal) return;

    this.modal.removeEventListener("click", this.handleBackdropClick);
    document.removeEventListener("keydown", this.handleEscKey);

    const closeBtn = this.modal.querySelector(
      "[data-modal-close], .modal-close-btn, #close-help, #close-dictionary-management, #close-slot-group-management"
    );
    if (closeBtn) {
      closeBtn.removeEventListener("click", this.handleCloseClick);
    }
  }

  handleBackdropClick(event) {
    if (event.target.closest("button, .history-action-btn, .modal-close-btn")) {
      return;
    }

    const modalContent = this.modal.querySelector(
      ".modal-container, .dictionary-management-content, .shortcut-info-section, .generate-history-content"
    );
    if (modalContent && !modalContent.contains(event.target)) {
      this.hide();
    }
  }

  handleEscKey(event) {
    if (event.key === "Escape" && this.isVisible) {
      this.hide();
    }
  }

  handleCloseClick(event) {
    event.preventDefault();
    event.stopPropagation();
    this.hide();
  }

  show() {
    if (!this.modal || this.isVisible) return;

    this.isVisible = true;
    this.modal.classList.remove("hidden");
    this.modal.classList.add("show-flex");

    // アニメーション対応（.modal-base.show で opacity: 1 が定義済み）
    requestAnimationFrame(() => {
      this.modal.classList.add("show");
    });

    this.showCallbacks.forEach((callback) => {
      try {
        callback(this);
      } catch (error) {}
    });

    this.modal.dispatchEvent(
      new CustomEvent("modal:show", {
        detail: { modalId: this.modalId },
      })
    );
  }

  hide() {
    if (!this.modal || !this.isVisible) return;

    this.isVisible = false;
    this.modal.classList.remove("show");

    setTimeout(() => {
      if (!this.isVisible) {
        this.modal.classList.remove("show-flex");
        this.modal.classList.add("hidden");
      }
    }, 150);

    this.closeCallbacks.forEach((callback) => {
      try {
        callback(this);
      } catch (error) {}
    });

    this.modal.dispatchEvent(
      new CustomEvent("modal:hide", {
        detail: { modalId: this.modalId },
      })
    );
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  updateContent(content) {
    if (!this.modal) return;

    const contentArea = this.modal.querySelector(
      ".modal-content, .dictionary-management-content, .shortcut-info-section, .generate-history-content"
    );
    if (contentArea) {
      if (typeof content === "string") {
        contentArea.innerHTML = content;
      } else if (content instanceof Element) {
        contentArea.innerHTML = "";
        contentArea.appendChild(content);
      }
    }
  }

  updateTitle(title) {
    if (!this.modal) return;

    const titleElement = this.modal.querySelector(
      ".modal-header h3, .dictionary-management-header h3, .shortcut-info-section h3, .generate-history-header h3"
    );
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  onShow(callback) {
    if (typeof callback === "function") {
      this.showCallbacks.push(callback);
    }
  }

  onClose(callback) {
    if (typeof callback === "function") {
      this.closeCallbacks.push(callback);
    }
  }

  // モーダル要素取得（互換性のため）
  getElement() {
    return this.modal;
  }

  destroy() {
    this.removeEventListeners();
    this.showCallbacks = [];
    this.closeCallbacks = [];

    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  static fromExisting(modalId, options = {}) {
    const existingModal = document.getElementById(modalId);
    if (!existingModal) {
      return null;
    }

    return new BaseModal(modalId, options);
  }

  generateUnifiedFrame() {
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = this.modalId;
    modal.className = this.options.cssClass;
    modal.classList.add("hidden");

    const headerHTML = this.options.showHeader
      ? `
      <div class="modal-header">
        <h3 class="modal-title">${this.options.title}</h3>
        ${this.options.showCloseButton ? '<button class="modal-close-btn" data-modal-close="true">×</button>' : ""}
        ${this.generateHeaderActions()}
      </div>
    `
      : "";

    const footerHTML = this.options.showFooter
      ? `
      <div class="modal-footer">
        ${this.generateFooterActions()}
      </div>
    `
      : "";

    modal.innerHTML = `
      <div class="modal-container">
        ${headerHTML}
        <div class="modal-content">
          ${this.options.content}
        </div>
        ${footerHTML}
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
  }

  generateHeaderActions() {
    if (!this.options.headerActions || this.options.headerActions.length === 0) {
      return "";
    }

    const actions = this.options.headerActions
      .map(
        (action) => `
      <button class="modal-header-action ${action.className || ""}" 
              data-action="${action.action}"
              ${action.title ? `title="${action.title}"` : ""}>
        ${action.text}
      </button>
    `
      )
      .join("");

    return `<div class="modal-header-actions">${actions}</div>`;
  }

  generateFooterActions() {
    if (!this.options.footerActions || this.options.footerActions.length === 0) {
      return "";
    }

    return this.options.footerActions
      .map(
        (action) => `
      <button class="modal-footer-action ${action.className || ""}" 
              data-action="${action.action}"
              ${action.title ? `title="${action.title}"` : ""}>
        ${action.text}
      </button>
    `
      )
      .join("");
  }

  static create(modalId, title, content, options = {}) {
    return new BaseModal(modalId, {
      title: title,
      content: content,
      autoGenerate: true,
      ...options,
    });
  }
}

window.BaseModal = BaseModal;
