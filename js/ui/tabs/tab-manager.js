/**
 * tab-manager.js - タブ管理基底クラス
 * Phase 8.5: すべてのタブクラスの基底となるクラス
 */

class TabManager {
  constructor(app, config) {
    this.app = app; // PromptGeneratorAppへの参照
    this.tabId = config.tabId; // タブボディのID
    this.tabButtonId = config.tabButtonId; // タブボタンのID
    this.tabIndex = config.tabIndex; // タブのインデックス
    this.initialized = false;
    this.isActive = false;

    // イベントリスナーを保持（クリーンアップ用）
    this._eventListeners = [];
  }

  /**
   * タブを初期化
   * @returns {Promise<void>}
   */
  async init() {
    console.log(`Initializing ${this.constructor.name}...`);

    try {
      // 基本的なDOM要素の確認
      this.validateElements();

      // 派生クラスの初期化処理
      await this.onInit();

      this.initialized = true;
      console.log(`${this.constructor.name} initialized successfully`);
    } catch (error) {
      ErrorHandler.log(`Failed to initialize ${this.constructor.name}`, error);
      throw error;
    }
  }

  /**
   * DOM要素の存在確認
   */
  validateElements() {
    const tabBody = document.getElementById(this.tabId);
    if (!tabBody) {
      throw new Error(`Tab body element not found: ${this.tabId}`);
    }

    if (this.tabButtonId) {
      const tabButton = document.getElementById(this.tabButtonId);
      if (!tabButton) {
        throw new Error(`Tab button element not found: ${this.tabButtonId}`);
      }
    }
  }

  /**
   * タブが表示される時の処理
   */
  async show() {
    console.log(`Showing ${this.constructor.name}`);
    this.isActive = true;

    // 初回表示時の初期化
    if (!this.initialized) {
      await this.init();
    }

    // 派生クラスの表示処理
    await this.onShow();
  }

  /**
   * タブが非表示になる時の処理
   */
  async hide() {
    console.log(`Hiding ${this.constructor.name}`);
    this.isActive = false;

    // 派生クラスの非表示処理
    await this.onHide();
  }

  /**
   * データをリフレッシュ
   */
  async refresh() {
    if (!this.initialized) return;

    console.log(`Refreshing ${this.constructor.name}`);
    await this.onRefresh();
  }

  /**
   * クリーンアップ処理
   */
  destroy() {
    console.log(`Destroying ${this.constructor.name}`);

    // 登録されたイベントリスナーを削除
    this._eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this._eventListeners = [];

    // 派生クラスのクリーンアップ
    this.onDestroy();

    this.initialized = false;
  }

  // ============================================
  // 派生クラスでオーバーライドするメソッド
  // ============================================

  /**
   * 初期化時の処理（派生クラスで実装）
   */
  async onInit() {
    // Override in derived classes
  }

  /**
   * 表示時の処理（派生クラスで実装）
   */
  async onShow() {
    // Override in derived classes
  }

  /**
   * 非表示時の処理（派生クラスで実装）
   */
  async onHide() {
    // Override in derived classes
  }

  /**
   * リフレッシュ時の処理（派生クラスで実装）
   */
  async onRefresh() {
    // Override in derived classes
  }

  /**
   * 破棄時の処理（派生クラスで実装）
   */
  onDestroy() {
    // Override in derived classes
  }

  // ============================================
  // ユーティリティメソッド
  // ============================================

  /**
   * イベントリスナーを追加（自動クリーンアップ付き）
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this._eventListeners.push({ element, event, handler });
  }

  /**
   * 複数のイベントリスナーを一括追加
   */
  addEventListeners(listeners) {
    listeners.forEach(({ selector, event, handler }) => {
      const element =
        typeof selector === "string"
          ? document.querySelector(selector)
          : selector;

      if (element) {
        this.addEventListener(element, event, handler);
      }
    });
  }

  /**
   * タブ内の要素を取得
   */
  getElement(selector) {
    const tabBody = document.getElementById(this.tabId);
    return tabBody ? tabBody.querySelector(selector) : null;
  }

  /**
   * タブ内のすべての要素を取得
   */
  getElements(selector) {
    const tabBody = document.getElementById(this.tabId);
    return tabBody ? Array.from(tabBody.querySelectorAll(selector)) : [];
  }

  /**
   * 現在アクティブかどうか
   */
  isCurrentTab() {
    return this.isActive && AppState.ui.currentTab === this.tabIndex;
  }

  /**
   * デバッグ情報を出力
   */
  debug() {
    console.group(`${this.constructor.name} Debug Info`);
    console.log("Tab ID:", this.tabId);
    console.log("Tab Button ID:", this.tabButtonId);
    console.log("Tab Index:", this.tabIndex);
    console.log("Initialized:", this.initialized);
    console.log("Active:", this.isActive);
    console.log("Event Listeners:", this._eventListeners.length);
    console.groupEnd();
  }
}

// グローバルに公開（クラス定義の直後に移動）
if (typeof window !== "undefined") {
  window.TabManager = TabManager;
}
