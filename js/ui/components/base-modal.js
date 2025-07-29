/**
 * base-modal.js - 統一モーダル基底クラス
 * 
 * 全てのモーダル処理を統一し、冗長なコードを削減
 * CLAUDE.mdの共通化ファースト原則に準拠
 */

class BaseModal {
  constructor(modalId, options = {}) {
    this.modalId = modalId;
    this.modal = null;
    this.options = {
      closeOnBackdrop: true,
      closeOnEsc: true,
      showCloseButton: true,
      title: '',
      content: '',
      showHeader: true,
      showFooter: false,
      headerActions: [],
      footerActions: [],
      cssClass: 'modal-base',
      zIndex: 10000,
      autoGenerate: false, // 動的生成モード
      ...options
    };

    this.isVisible = false;
    this.closeCallbacks = [];
    this.showCallbacks = [];

    // イベントリスナーのbind
    this.handleBackdropClick = this.handleBackdropClick.bind(this);
    this.handleEscKey = this.handleEscKey.bind(this);
    this.handleCloseClick = this.handleCloseClick.bind(this);

    this.init();
  }

  init() {
    this.modal = document.getElementById(this.modalId);
    
    // 動的生成モードの場合、フレームを生成
    if (this.options.autoGenerate) {
      this.generateUnifiedFrame();
    } else if (!this.modal) {
      console.warn(`Modal element with ID "${this.modalId}" not found`);
      return;
    }

    // 基本スタイル適用
    this.applyBaseStyles();
    
    // 閉じるボタンの設定
    if (this.options.showCloseButton) {
      this.setupCloseButton();
    }

    // イベントリスナーの設定
    this.setupEventListeners();
  }

  applyBaseStyles() {
    if (!this.modal) return;

    // 基本CSSクラス追加（スペース区切りの場合は分割して追加）
    const cssClasses = this.options.cssClass.split(' ').filter(cls => cls.trim());
    cssClasses.forEach(cls => this.modal.classList.add(cls));
    
    // 基本スタイル適用
    Object.assign(this.modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--overlay-dark)',
      zIndex: this.options.zIndex.toString(),
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center'
    });
  }

  setupCloseButton() {
    if (!this.modal) return;

    // 既存の閉じるボタンを探す
    let closeBtn = this.modal.querySelector('[data-modal-close], .modal-close-btn, #close-help, #close-dictionary-management, #close-slot-group-management');
    
    if (!closeBtn) {
      // 閉じるボタンが存在しない場合は作成
      closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.className = 'modal-close-btn';
      closeBtn.setAttribute('data-modal-close', 'true');
      
      // モーダルコンテンツの最初の子要素（ヘッダー）に追加
      const modalContent = this.modal.querySelector('.modal-container, .dictionary-management-content, .shortcut-info-section, .generate-history-content') || this.modal.firstElementChild;
      if (modalContent) {
        modalContent.appendChild(closeBtn);
      }
    }

    closeBtn.addEventListener('click', this.handleCloseClick);
  }

  setupEventListeners() {
    if (!this.modal) return;

    // 背景クリックで閉じる
    if (this.options.closeOnBackdrop) {
      this.modal.addEventListener('click', this.handleBackdropClick);
    }

    // ESCキーで閉じる
    if (this.options.closeOnEsc) {
      document.addEventListener('keydown', this.handleEscKey);
    }
  }

  removeEventListeners() {
    if (!this.modal) return;

    this.modal.removeEventListener('click', this.handleBackdropClick);
    document.removeEventListener('keydown', this.handleEscKey);
    
    const closeBtn = this.modal.querySelector('[data-modal-close], .modal-close-btn, #close-help, #close-dictionary-management, #close-slot-group-management');
    if (closeBtn) {
      closeBtn.removeEventListener('click', this.handleCloseClick);
    }
  }

  handleBackdropClick(event) {
    // ボタンクリックの場合は何もしない
    if (event.target.closest('button, .history-action-btn, .modal-close-btn')) {
      return;
    }

    // モーダルコンテンツ以外をクリックした場合のみ閉じる
    const modalContent = this.modal.querySelector('.modal-container, .dictionary-management-content, .shortcut-info-section, .generate-history-content');
    if (modalContent && !modalContent.contains(event.target)) {
      this.hide();
    }
  }

  handleEscKey(event) {
    if (event.key === 'Escape' && this.isVisible) {
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
    this.modal.style.display = 'flex';
    
    // アニメーション対応
    requestAnimationFrame(() => {
      this.modal.style.opacity = '1';
    });

    // showコールバック実行
    this.showCallbacks.forEach(callback => {
      try {
        callback(this);
      } catch (error) {
        console.error('Error in show callback:', error);
      }
    });

    // カスタムイベント発火
    this.modal.dispatchEvent(new CustomEvent('modal:show', {
      detail: { modalId: this.modalId }
    }));
  }

  hide() {
    if (!this.modal || !this.isVisible) return;

    this.isVisible = false;
    this.modal.style.opacity = '0';
    
    // アニメーション後に非表示
    setTimeout(() => {
      if (!this.isVisible) {
        this.modal.style.display = 'none';
      }
    }, 150);

    // closeコールバック実行
    this.closeCallbacks.forEach(callback => {
      try {
        callback(this);
      } catch (error) {
        console.error('Error in close callback:', error);
      }
    });

    // カスタムイベント発火
    this.modal.dispatchEvent(new CustomEvent('modal:hide', {
      detail: { modalId: this.modalId }
    }));
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // コンテンツ更新用メソッド
  updateContent(content) {
    if (!this.modal) return;

    const contentArea = this.modal.querySelector('.modal-content, .dictionary-management-content, .shortcut-info-section, .generate-history-content');
    if (contentArea) {
      if (typeof content === 'string') {
        contentArea.innerHTML = content;
      } else if (content instanceof Element) {
        contentArea.innerHTML = '';
        contentArea.appendChild(content);
      }
    }
  }

  // タイトル更新用メソッド
  updateTitle(title) {
    if (!this.modal) return;

    const titleElement = this.modal.querySelector('.modal-header h3, .dictionary-management-header h3, .shortcut-info-section h3, .generate-history-header h3');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  // コールバック登録メソッド
  onShow(callback) {
    if (typeof callback === 'function') {
      this.showCallbacks.push(callback);
    }
  }

  onClose(callback) {
    if (typeof callback === 'function') {
      this.closeCallbacks.push(callback);
    }
  }

  // モーダル要素取得（互換性のため）
  getElement() {
    return this.modal;
  }

  // 破棄処理
  destroy() {
    this.removeEventListeners();
    this.showCallbacks = [];
    this.closeCallbacks = [];
    
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  // 静的メソッド：既存のモーダル要素から BaseModal インスタンスを作成
  static fromExisting(modalId, options = {}) {
    const existingModal = document.getElementById(modalId);
    if (!existingModal) {
      console.warn(`Modal element with ID "${modalId}" not found`);
      return null;
    }

    return new BaseModal(modalId, options);
  }

  /**
   * 統一フレームを動的生成
   */
  generateUnifiedFrame() {
    // 既存のモーダル要素を削除
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    // 統一フレームHTML生成
    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = this.options.cssClass;
    modal.style.display = 'none';

    // ヘッダー生成
    const headerHTML = this.options.showHeader ? `
      <div class="modal-header">
        <h3 class="modal-title">${this.options.title}</h3>
        ${this.options.showCloseButton ? '<button class="modal-close-btn" data-modal-close="true">×</button>' : ''}
        ${this.generateHeaderActions()}
      </div>
    ` : '';

    // フッター生成
    const footerHTML = this.options.showFooter ? `
      <div class="modal-footer">
        ${this.generateFooterActions()}
      </div>
    ` : '';

    // 統一フレーム構造
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

  /**
   * ヘッダーアクションボタン生成
   */
  generateHeaderActions() {
    if (!this.options.headerActions || this.options.headerActions.length === 0) {
      return '';
    }

    const actions = this.options.headerActions.map(action => `
      <button class="modal-header-action ${action.className || ''}" 
              data-action="${action.action}"
              ${action.title ? `title="${action.title}"` : ''}>
        ${action.text}
      </button>
    `).join('');

    return `<div class="modal-header-actions">${actions}</div>`;
  }

  /**
   * フッターアクションボタン生成
   */
  generateFooterActions() {
    if (!this.options.footerActions || this.options.footerActions.length === 0) {
      return '';
    }

    return this.options.footerActions.map(action => `
      <button class="modal-footer-action ${action.className || ''}" 
              data-action="${action.action}"
              ${action.title ? `title="${action.title}"` : ''}>
        ${action.text}
      </button>
    `).join('');
  }

  // 静的メソッド：HTMLを動的生成してモーダルを作成
  static create(modalId, title, content, options = {}) {
    return new BaseModal(modalId, {
      title: title,
      content: content,
      autoGenerate: true,
      ...options
    });
  }
}

// グローバルエクスポート
window.BaseModal = BaseModal;