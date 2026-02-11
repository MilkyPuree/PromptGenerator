class ShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.setupDefaultShortcuts();
  }

  setupDefaultShortcuts() {
    this.register("A", { shift: true }, (e) => {
      e.preventDefault();

      const searchTab = document.querySelector(".tab.tab-A");
      if (searchTab) {
        if (!searchTab.classList.contains("is-active")) {
          searchTab.click();
        }

        setTimeout(() => {
          const searchInput = document.getElementById(DOM_IDS.SEARCH.INPUT);
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 100);
      }
    });

    this.register("S", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.OTHER.ADD_TAB)?.click();
    });

    this.register("D", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.OTHER.EDIT_TAB)?.click();
    });

    this.register("F", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.SLOT.TAB)?.click();
    });

    this.register("G", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.OTHER.NOTICE_TAB)?.click();
    });

    this.register("Enter", {}, (e) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.contentEditable === "true";

      if (isInputFocused) {
        return; // 入力中は通常のEnter動作
      }

      e.preventDefault();
      const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
      if (generateButton) {
        generateButton.click();
      }
    });

    this.register("g", { ctrl: true }, (e) => {
      e.preventDefault();
      const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
      if (generateButton) {
        generateButton.click();
      }
    });
  }

  register(key, modifiers, handler) {
    const shortcutKey = this.createShortcutKey(key, modifiers);
    this.shortcuts.set(shortcutKey, handler);
  }

  createShortcutKey(key, modifiers) {
    const parts = [];
    if (modifiers.ctrl) parts.push("Ctrl");
    if (modifiers.alt) parts.push("Alt");
    if (modifiers.shift) parts.push("Shift");
    parts.push(key);
    return parts.join("+");
  }

  getShortcutFromEvent(event) {
    const modifiers = {
      ctrl: event.ctrlKey || event.metaKey, // MacのCommandキーも含む
      alt: event.altKey,
      shift: event.shiftKey,
    };
    return this.createShortcutKey(event.key, modifiers);
  }

  setupEventListeners() {
    document.addEventListener("keydown", (event) => {
      const shortcutKey = this.getShortcutFromEvent(event);
      const handler = this.shortcuts.get(shortcutKey);

      if (handler) {
        handler(event);
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "executeShortcut") {
        sendResponse({ success: true });
      }
    });
  }
}

if (typeof window !== "undefined") {
  window.ShortcutManager = ShortcutManager;
}
