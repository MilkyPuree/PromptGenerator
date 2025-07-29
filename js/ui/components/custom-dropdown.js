/**
 * custom-dropdown.js - カスタムドロップダウンコンポーネント
 * 
 * フレキシブルリストの大中小項目用カスタムドロップダウン
 * datalistの代替として、見た目のカスタマイズとメモリ効率の改善を実現
 */

/**
 * シングルトンドロップダウン管理クラス
 * 複数のドロップダウンの同時表示を防ぐ
 */
class DropdownManager {
  constructor() {
    this.activeDropdown = null;
    this.isInitialized = false;
    this.toastProtectionMode = false; // トースト表示中の保護モード
  }

  /**
   * グローバルイベントリスナーを初期化
   */
  init() {
    if (this.isInitialized) return;

    // ドキュメントクリックでドロップダウンを閉じる
    document.addEventListener('click', (e) => {
      if (this.activeDropdown && !this.activeDropdown.contains(e.target)) {
        this.closeActive();
      }
    });

    // ESCキーでドロップダウンを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeDropdown) {
        this.closeActive();
      }
    });

    this.isInitialized = true;
  }

  /**
   * アクティブなドロップダウンを設定
   * @param {CustomDropdown} dropdown - アクティブにするドロップダウン
   */
  setActive(dropdown) {
    if (this.activeDropdown && this.activeDropdown !== dropdown) {
      this.activeDropdown.close();
    }
    this.activeDropdown = dropdown;
  }

  /**
   * アクティブなドロップダウンを閉じる
   */
  closeActive() {
    // トースト保護モード中は閉じない
    if (this.toastProtectionMode) {
      if (AppState.config.debugMode) {
        console.log('[DROPDOWN] Toast protection mode - skipping close');
      }
      return;
    }
    
    if (this.activeDropdown) {
      this.activeDropdown.close();
      this.activeDropdown = null;
    }
  }

  /**
   * トースト表示中の保護モードを設定
   * @param {boolean} enabled - 保護モードの有効/無効
   */
  setToastProtection(enabled) {
    this.toastProtectionMode = enabled;
    if (AppState.config.debugMode) {
      console.log(`[DROPDOWN] Toast protection mode: ${enabled ? 'ON' : 'OFF'}`);
    }
  }

  /**
   * ドロップダウンの登録を解除
   * @param {CustomDropdown} dropdown - 解除するドロップダウン
   */
  unregister(dropdown) {
    if (this.activeDropdown === dropdown) {
      this.activeDropdown = null;
    }
  }
}

// シングルトンインスタンス
const dropdownManager = new DropdownManager();

/**
 * カスタムドロップダウンクラス
 */
class CustomDropdown {
  constructor(inputElement, options = {}) {
    this.inputElement = inputElement;
    this.options = {
      categoryLevel: 0, // 0=大項目, 1=中項目, 2=小項目
      placeholder: '',
      maxHeight: 400,
      onSubmit: null,
      onBlur: null,      // Blur時のコールバック（保存のみ）
      onOpen: null,
      onClose: null,
      ...options
    };

    this.isOpen = false;
    this.selectedIndex = -1;
    this.items = [];
    this.filteredItems = [];
    
    this.init();
  }

  /**
   * 初期化
   */
  init() {
    dropdownManager.init();
    
    // 既存のドロップダウンがある場合は破棄
    if (this.inputElement.customDropdown && this.inputElement.customDropdown !== this) {
      if (AppState.config.debugMode) {
        console.log('[DROPDOWN] Destroying existing dropdown');
      }
      this.inputElement.customDropdown.destroy();
    }
    
    // ブラウザの自動補完を無効化
    this.inputElement.setAttribute('autocomplete', 'off');
    
    if (AppState.config.debugMode) {
      console.log('[DROPDOWN] Creating new dropdown element');
    }
    this.createDropdownElement();
    this.bindEvents();
    
    // 入力要素にカスタムドロップダウンの参照を設定
    this.inputElement.customDropdown = this;
  }

  /**
   * ドロップダウン要素を作成
   */
  createDropdownElement() {
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.className = 'custom-dropdown';
    this.dropdownElement.setAttribute('role', 'listbox');
    this.dropdownElement.setAttribute('aria-hidden', 'true');
    
    this.listElement = document.createElement('ul');
    this.listElement.className = 'custom-dropdown-list';
    this.listElement.setAttribute('role', 'list');
    
    this.dropdownElement.appendChild(this.listElement);
    
    // bodyに配置（元の動作）
    document.body.appendChild(this.dropdownElement);
    
    // 位置調整
    this.updatePosition();
  }

  /**
   * イベントをバインド
   */
  bindEvents() {
    // 入力フィールドのイベント
    this.inputElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.inputElement.addEventListener('input', (e) => {
      this.filterItems(e.target.value);
      if (!this.isOpen) {
        this.open();
      }
    });

    this.inputElement.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    this.inputElement.addEventListener('blur', (e) => {
      // 少し遅延させてドロップダウンのクリックイベントを優先
      setTimeout(() => {
        // トースト保護モード中は閉じない
        if (dropdownManager.toastProtectionMode) {
          if (AppState.config.debugMode) {
            console.log('[DROPDOWN] Toast protection mode - skipping blur close');
          }
          return;
        }
        
        // ドロップダウンが開いていて、フォーカスがドロップダウン内にある場合は何もしない
        if (this.isOpen && this.dropdownElement && this.dropdownElement.contains(document.activeElement)) {
          return;
        }
        
        // それ以外の場合はBlur処理して閉じる（フォーカス移動なし）
        this.handleBlur();
        this.close();
      }, 200);
    });

    // ドロップダウンのイベント
    this.dropdownElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('.custom-dropdown-item');
      if (item) {
        this.selectItem(item.dataset.value);
      }
    });

    // ドロップダウンにフォーカスが移動した時
    this.dropdownElement.addEventListener('mousedown', (e) => {
      // デフォルトのblur動作を阻止
      e.preventDefault();
    });

    // リサイズ時の位置調整
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.updatePosition();
      }
    });

    // スクロール時に閉じる（ドロップダウン内のスクロールは除外）
    this.scrollHandler = (e) => {
      if (this.isOpen) {
        // トースト保護モード中は閉じない
        if (dropdownManager.toastProtectionMode) {
          return;
        }
        
        // ドロップダウン内のスクロールは無視
        if (this.dropdownElement && this.dropdownElement.contains(e.target)) {
          return;
        }
        this.close();
      }
    };
    
    // スクロールイベントをリスン（パッシブで軽量化）
    window.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
    document.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
  }

  /**
   * キーボードイベントハンドラー
   */
  handleKeyDown(e) {
    if (!this.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.open();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSubmit();
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectItem(this.filteredItems[this.selectedIndex]);
        } else {
          this.handleSubmit();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  /**
   * ドロップダウンを開く
   */
  open() {
    // インスタンスが破棄されている場合は何もしない
    if (!this.inputElement || !this.dropdownElement) {
      return;
    }
    
    if (this.isOpen) {
      return;
    }

    // 他のドロップダウンを閉じる
    dropdownManager.setActive(this);
    
    // データを読み込み
    this.loadData();
    
    this.isOpen = true;
    this.dropdownElement.classList.add('open');
    this.dropdownElement.setAttribute('aria-hidden', 'false');
    this.updatePosition();
    
    if (this.options.onOpen) {
      this.options.onOpen();
    }
  }

  /**
   * ドロップダウンを閉じる
   */
  close() {
    if (!this.isOpen) return;

    // インスタンスが破棄されている場合でも安全に処理
    this.isOpen = false;
    this.selectedIndex = -1;
    
    if (this.dropdownElement) {
      this.dropdownElement.classList.remove('open');
      this.dropdownElement.setAttribute('aria-hidden', 'true');
    }
    
    dropdownManager.unregister(this);
    
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * ドロップダウンを切り替え
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * データを読み込み
   */
  loadData() {
    const parentValue = this.getParentValue();
    
    // CategoryUIManagerを使用してカテゴリーデータを取得
    if (typeof window.categoryUIManager !== 'undefined') {
      this.items = window.categoryUIManager.getCategoriesByLevel(
        this.options.categoryLevel, 
        parentValue
      );
    } else {
      if (AppState.config.debugMode) {
        console.warn('[DROPDOWN] CategoryUIManager not found');
      }
      this.items = [];
    }
    
    this.filteredItems = [...this.items];
    this.renderItems();
  }

  /**
   * 親カテゴリーの値を取得
   */
  getParentValue() {
    const level = this.options.categoryLevel;
    if (AppState.config.debugMode) {
      console.log(`[DROPDOWN] Getting parent value for level ${level}`);
    }
    
    if (level === 0) {
      // 大項目の場合、親はなし
      if (AppState.config.debugMode) {
        console.log(`[DROPDOWN] Level 0, no parent needed`);
      }
      return null;
    }
    
    // 入力フィールドの階層構造から親要素を取得
    // 検索順序を調整：より具体的なセレクタから探す
    let container = this.inputElement.closest('.flexible-list-item');
    if (!container) {
      container = this.inputElement.closest('.test-section');
    }
    if (!container) {
      container = this.inputElement.closest('.search-container');
    }
    if (!container) {
      // フォールバック：より広い範囲で検索
      container = this.inputElement.closest('[data-item-id]') || 
                 this.inputElement.closest('li') ||
                 this.inputElement.parentElement?.parentElement;
    }
    
    if (AppState.config.debugMode) {
      console.log(`[DROPDOWN] Container search result:`, {
        found: !!container,
        className: container?.className,
        tagName: container?.tagName,
        dataItemId: container?.getAttribute?.('data-item-id')
      });
    }
    
    if (!container) {
      if (AppState.config.debugMode) {
        console.warn(`[DROPDOWN] No container found for parent value`);
      }
      return null;
    }
    
    if (level === 1) {
      // 中項目の場合、大項目を取得
      // より具体的なセレクタで検索
      let bigInput = container.querySelector('input[data-field="data.0"]');
      if (!bigInput) {
        bigInput = container.querySelector('input.category-big');
      }
      if (!bigInput) {
        bigInput = container.querySelector('#big, #test-big');
      }
      if (!bigInput) {
        // 最後の手段：最初のinput要素を探す
        const inputs = container.querySelectorAll('input[type="text"]');
        if (inputs.length > 0) {
          bigInput = inputs[0];
        }
      }
      
      if (AppState.config.debugMode) {
        console.log(`[DROPDOWN] Big input search result:`, {
          found: !!bigInput,
          value: bigInput?.value,
          dataField: bigInput?.getAttribute?.('data-field'),
          className: bigInput?.className
        });
      }
      
      return bigInput ? bigInput.value : null;
    }
    
    if (level === 2) {
      // 小項目の場合、大項目+中項目を組み合わせ
      let bigInput = container.querySelector('input[data-field="data.0"]');
      let middleInput = container.querySelector('input[data-field="data.1"]');
      
      if (!bigInput || !middleInput) {
        // フォールバック検索
        const inputs = container.querySelectorAll('input[type="text"]');
        if (inputs.length >= 2) {
          bigInput = inputs[0];
          middleInput = inputs[1];
        }
      }
      
      if (AppState.config.debugMode) {
        console.log(`[DROPDOWN] Small item parent search:`, {
          bigFound: !!bigInput,
          bigValue: bigInput?.value,
          middleFound: !!middleInput,
          middleValue: middleInput?.value
        });
      }
      
      if (!bigInput || !middleInput) return null;
      
      const bigValue = bigInput.value || '';
      const middleValue = middleInput.value || '';
      
      // category-manager.jsと同じ形式で構築（記号除去）
      return bigValue.replace(/[!\/]/g, '') + middleValue.replace(/[!\/]/g, '');
    }
    
    return null;
  }

  /**
   * 項目をフィルタリング
   */
  filterItems(query) {
    const lowerQuery = query.toLowerCase();
    this.filteredItems = this.items.filter(item => 
      item.toLowerCase().includes(lowerQuery)
    );
    this.selectedIndex = -1;
    this.renderItems();
    
    // フィルタリング後にサイズを更新
    if (this.isOpen) {
      this.updatePosition();
    }
  }

  /**
   * 項目をレンダリング
   */
  renderItems() {
    this.listElement.innerHTML = '';
    
    if (this.filteredItems.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'custom-dropdown-item empty';
      emptyItem.textContent = 'アイテムが見つかりません';
      this.listElement.appendChild(emptyItem);
      return;
    }

    const currentValue = this.inputElement.value.trim();
    let matchingIndex = -1;

    const fragment = document.createDocumentFragment();
    this.filteredItems.forEach((item, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'custom-dropdown-item';
      listItem.setAttribute('role', 'option');
      listItem.setAttribute('data-value', item);
      listItem.textContent = item;
      
      // 現在の入力値と完全一致する項目をチェック
      if (currentValue && item === currentValue) {
        listItem.classList.add('current-match');
        matchingIndex = index;
      }
      
      if (index === this.selectedIndex) {
        listItem.classList.add('selected');
      }
      
      fragment.appendChild(listItem);
    });
    
    this.listElement.appendChild(fragment);
    
    // 一致する項目がある場合、その位置にスクロール
    if (matchingIndex >= 0) {
      setTimeout(() => {
        this.scrollToMatchingItem(matchingIndex);
      }, 50);
    }
    
  }

  /**
   * 一致する項目の位置にスクロール
   */
  scrollToMatchingItem(index) {
    const items = this.listElement.querySelectorAll('.custom-dropdown-item');
    const targetItem = items[index];
    
    if (targetItem) {
      // 一発でスクロール位置をセット（アニメーションなし）
      targetItem.scrollIntoView({
        behavior: 'instant',
        block: 'center',
        inline: 'nearest'
      });
    }
  }

  /**
   * 次の項目を選択
   */
  selectNext() {
    if (this.filteredItems.length === 0) return;
    
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
    this.updateSelection();
  }

  /**
   * 前の項目を選択
   */
  selectPrevious() {
    if (this.filteredItems.length === 0) return;
    
    this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
    this.updateSelection();
  }

  /**
   * 選択状態を更新
   */
  updateSelection() {
    const items = this.listElement.querySelectorAll('.custom-dropdown-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * 項目を選択
   */
  selectItem(value) {
    this.inputElement.value = value;
    this.handleSubmit();
    this.close();
  }

  /**
   * 送信処理（フォーカス移動あり）
   */
  handleSubmit() {
    // inputElementが存在しない場合は早期リターン
    if (!this.inputElement) {
      return;
    }
    
    if (this.options.onSubmit) {
      try {
        this.options.onSubmit(this.inputElement.value);
      } catch (error) {
        if (AppState.config.debugMode) {
          console.error('[DROPDOWN] Error in onSubmit callback:', error);
        }
      }
    }
  }

  /**
   * Blur処理（保存のみ、フォーカス移動なし）
   */
  handleBlur() {
    // inputElementが存在しない場合は早期リターン
    if (!this.inputElement) {
      return;
    }
    
    if (this.options.onBlur) {
      try {
        this.options.onBlur(this.inputElement.value);
      } catch (error) {
        if (AppState.config.debugMode) {
          console.error('[DROPDOWN] Error in onBlur callback:', error);
        }
      }
    }
  }

  /**
   * ドロップダウンの最適な高さを計算
   */
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

  /**
   * 位置を更新
   */
  updatePosition() {
    // インスタンスが破棄されている場合は早期リターン
    if (!this.inputElement || !this.dropdownElement) {
      return;
    }
    
    // 既存のタイマーをクリア
    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
    }
    
    // 位置計算前に少し待つ（DOM更新後の正確な位置取得のため）
    this.positionTimer = setTimeout(() => {
      // タイマーをクリア
      this.positionTimer = null;
      
      // 再度チェック（setTimeout中に破棄される可能性）
      if (!this.inputElement || !this.dropdownElement) {
        return;
      }
      
      let inputRect, dropdownParent, windowHeight;
      
      try {
        inputRect = this.inputElement.getBoundingClientRect();
        dropdownParent = this.dropdownElement.parentElement;
        windowHeight = window.innerHeight;
        
        // 入力フィールドが見つからない場合は早期リターン
        if (inputRect.width === 0 || inputRect.height === 0) {
          return;
        }
      } catch (error) {
        if (AppState.config.debugMode) {
          console.warn('[DROPDOWN] Error during position calculation:', error);
        }
        return;
      }
      
      // 最適な高さを計算
      const actualContentHeight = this.calculateOptimalHeight();
      
      // 下に表示する空間があるかチェック
      const spaceBelow = windowHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;
      const shouldShowAbove = spaceBelow < actualContentHeight && spaceAbove > spaceBelow;
      
      if (AppState.config.debugMode) {
        console.log(`[DROPDOWN] Items: ${this.filteredItems.length}, Actual height: ${actualContentHeight}px, Space below: ${spaceBelow}px, Space above: ${spaceAbove}px, Show above: ${shouldShowAbove}`);
      }
      
      // bodyに配置する場合は固定位置
      this.dropdownElement.style.position = 'fixed';
      this.dropdownElement.style.width = `${inputRect.width}px`;
      this.dropdownElement.style.left = `${inputRect.left}px`;
      this.dropdownElement.style.zIndex = '9999';
      this.dropdownElement.style.height = `${actualContentHeight}px`;
      
      if (shouldShowAbove) {
        // 上に表示
        this.dropdownElement.style.top = `${inputRect.top - actualContentHeight}px`;
        this.dropdownElement.style.bottom = 'auto';
        this.dropdownElement.classList.add('above');
      } else {
        // 下に表示
        this.dropdownElement.style.top = `${inputRect.bottom}px`;
        this.dropdownElement.style.bottom = 'auto';
        this.dropdownElement.classList.remove('above');
      }
    }, 10); // 10ms遅延で位置計算
  }

  /**
   * 破棄処理
   */
  destroy() {
    if (AppState.config.debugMode) {
      console.log('[DROPDOWN] Destroying dropdown for input:', this.inputElement);
    }
    
    // アクティブなドロップダウンから登録解除
    dropdownManager.unregister(this);
    
    // タイマーをクリア
    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
      this.positionTimer = null;
    }
    
    // イベントリスナーを削除
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      document.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    
    // DOM要素を削除
    if (this.dropdownElement && this.dropdownElement.parentNode) {
      this.dropdownElement.remove();
      this.dropdownElement = null;
    }
    
    
    // 入力要素の参照をクリア
    if (this.inputElement && this.inputElement.customDropdown === this) {
      this.inputElement.customDropdown = null;
    }
    
    // 内部状態をクリア
    this.inputElement = null;
    this.listElement = null;
    this.items = [];
    this.filteredItems = [];
    this.isOpen = false;
  }


  /**
   * カスタムドロップダウンが要素に含まれるかチェック
   */
  contains(element) {
    return this.inputElement.contains(element) || this.dropdownElement.contains(element);
  }
}

// グローバルアクセス用
window.CustomDropdown = CustomDropdown;
window.dropdownManager = dropdownManager;