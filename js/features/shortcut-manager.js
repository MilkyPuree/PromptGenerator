/**
 * shortcut-manager.js - ポップアップ内のショートカットキー管理
 * Phase 6: 基本機能強化
 * Phase 9: BaseModal統合完了
 */

class ShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.setupDefaultShortcuts();
  }

  /**
   * デフォルトのショートカットを設定
   */
  setupDefaultShortcuts() {
    // Ctrl+C: 削除（ブラウザのデフォルト動作を優先）

    // Ctrl+S: 削除（ブラウザのデフォルト動作を優先）

    // Shift+A: 検索タブに切り替えてフォーカス（All search）
    this.register("A", { shift: true }, (e) => {
      e.preventDefault();
      
      // 検索タブボタンを取得（最初のタブ）
      const searchTab = document.querySelector(".tab.tab-A");
      if (searchTab) {
        // タブが既にアクティブでない場合はクリックして切り替え
        if (!searchTab.classList.contains("is-active")) {
          searchTab.click();
        }
        
        // 少し待ってから検索入力欄にフォーカス
        setTimeout(() => {
          const searchInput = document.getElementById(DOM_IDS.SEARCH.INPUT);
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 100);
      }
    });

    // Shift+S: 辞書タブへ（Save/Store）
    this.register("S", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.OTHER.ADD_TAB)?.click();
    });

    // Shift+D: 編集タブへ（Design/Draft）
    this.register("D", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.OTHER.EDIT_TAB)?.click();
    });

    // Shift+F: スロットタブへ（Favorites/Fill）
    this.register("F", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById("slotTab")?.click();
    });

    // Shift+G: その他タブへ（General/Go to settings）
    this.register("G", { shift: true }, (e) => {
      e.preventDefault();
      document.getElementById(DOM_IDS.OTHER.NOTICE_TAB)?.click();
    });


    // Enter: 入力フィールドにフォーカスがない時はGenerate実行
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

    // Ctrl+G: Generate実行（Gキーでジェネレート）
    this.register("g", { ctrl: true }, (e) => {
      e.preventDefault();
      const generateButton = document.getElementById(DOM_IDS.BUTTONS.GENERATE);
      if (generateButton) {
        generateButton.click();
      }
    });
  }

  /**
   * ショートカットを登録
   */
  register(key, modifiers, handler) {
    const shortcutKey = this.createShortcutKey(key, modifiers);
    this.shortcuts.set(shortcutKey, handler);
  }

  /**
   * ショートカットキーの文字列を生成
   */
  createShortcutKey(key, modifiers) {
    const parts = [];
    if (modifiers.ctrl) parts.push("Ctrl");
    if (modifiers.alt) parts.push("Alt");
    if (modifiers.shift) parts.push("Shift");
    parts.push(key);
    return parts.join("+");
  }

  /**
   * キーボードイベントからショートカットキーを生成
   */
  getShortcutFromEvent(event) {
    const modifiers = {
      ctrl: event.ctrlKey || event.metaKey, // MacのCommandキーも含む
      alt: event.altKey,
      shift: event.shiftKey,
    };
    return this.createShortcutKey(event.key, modifiers);
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    document.addEventListener("keydown", (event) => {
      const shortcutKey = this.getShortcutFromEvent(event);
      const handler = this.shortcuts.get(shortcutKey);

      if (handler) {
        handler(event);
      }
    });

    // バックグラウンドからのショートカット実行メッセージ
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "executeShortcut") {
        // save と copy ショートカットは削除済み
        sendResponse({ success: true });
      }
    });
  }

}

// グローバルに公開
if (typeof window !== "undefined") {
  window.ShortcutManager = ShortcutManager;
}
