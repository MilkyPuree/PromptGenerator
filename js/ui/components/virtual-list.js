/**
 * virtual-list.js - 仮想スクロールリスト実装
 * 大量データのパフォーマンス最適化
 */

class VirtualList {
  constructor(options = {}) {
    // 設定
    this.container = options.container; // コンテナ要素
    this.itemHeight = options.itemHeight || VIRTUAL_SCROLL.ITEM_HEIGHT; // アイテムの高さ
    this.containerHeight = options.containerHeight || 'auto'; // コンテナの高さ
    this.bufferSize = options.bufferSize || VIRTUAL_SCROLL.BUFFER_SIZE; // 画面外のバッファアイテム数（上下各3画面分）
    this.onCreateItem = options.onCreateItem; // アイテム作成コールバック
    this.onUpdateItem = options.onUpdateItem; // アイテム更新コールバック
    
    // 値の検証と修正（デフォルト値適用）
    if (!this.itemHeight || isNaN(this.itemHeight) || this.itemHeight <= 0) {
      this.itemHeight = VIRTUAL_SCROLL.ITEM_HEIGHT;
    }
    // containerHeightは'auto'または数値を許可
    if (this.containerHeight === 'auto') {
    } else if (!this.containerHeight || isNaN(this.containerHeight) || this.containerHeight <= 0) {
      this.containerHeight = 'auto';
    } else {
    }
    if (!this.bufferSize || isNaN(this.bufferSize) || this.bufferSize <= 0) {
      this.bufferSize = VIRTUAL_SCROLL.BUFFER_SIZE;
    }
    
    // 計算値（autoの場合は初期値を設定、後でリサイズ時に再計算）
    if (this.containerHeight === 'auto') {
      // autoの場合はデフォルトの表示件数を設定
      this.visibleCount = Math.ceil(VIRTUAL_SCROLL.CONTAINER_HEIGHT / this.itemHeight); // 仮の値
      this.bufferCount = this.visibleCount * this.bufferSize;
      this.renderCount = this.visibleCount + (this.bufferCount * 2);
    } else {
      this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
      this.bufferCount = this.visibleCount * this.bufferSize;
      this.renderCount = this.visibleCount + (this.bufferCount * 2);
    }
    
    // データ
    this.data = [];
    this.filteredData = [];
    this.renderedItems = new Map(); // DOM要素のキャッシュ
    
    // スクロール状態
    this.scrollTop = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    
    // DOM要素
    this.viewport = null;
    this.listContainer = null;
    this.spacerTop = null;
    this.spacerBottom = null;
    
    // パフォーマンス最適化
    this.isScrolling = false;
    this.scrollTimer = null;
    this.animationFrame = null;
    
    if (AppState?.config?.debugMode) console.log(`VirtualList initialized: visible=${this.visibleCount}, buffer=${this.bufferCount}, render=${this.renderCount}`);
  }

  /**
   * 仮想リストを初期化
   */
  init() {
    if (!this.container) {
      throw new Error('Container element is required');
    }

    this.createViewport();
    this.bindEvents();
    return this;
  }

  /**
   * ビューポートのDOM構造を作成
   */
  createViewport() {
    // 既存のヘッダーを保持
    const existingHeader = this.container.querySelector('ui, .header');
    const promptListHeader = this.container.querySelector('.prompt-list-header');
    
    // 既存の非ヘッダー要素をクリア
    const existingItems = this.container.querySelectorAll('li:not(.header):not(.prompt-list-header)');
    existingItems.forEach(item => item.remove());
    
    // 既存のビューポートがあれば削除
    const existingViewport = this.container.querySelector('.virtual-list-viewport');
    if (existingViewport) {
      existingViewport.remove();
    }
    
    // ビューポート（スクロール可能領域）
    const heightValue = this.containerHeight === 'auto' ? 'auto' : `${this.containerHeight}px`;
    
    this.viewport = UIFactory.createDiv({
      className: 'virtual-list-viewport',
      styles: {
        height: heightValue,
        'overflow-y': 'auto',
        'overflow-x': 'hidden',
        position: 'relative'
      }
    });
    
    // リストコンテナ（アイテムを含む）
    this.listContainer = UIFactory.createDiv({
      className: 'virtual-list-container',
      styles: {
        position: 'relative',
        width: '100%'
      }
    });
    
    // 上部スペーサー
    this.spacerTop = UIFactory.createDiv({
      className: 'virtual-list-spacer-top',
      styles: {
        height: '0px',
        'pointer-events': 'none'
      }
    });
    
    // 下部スペーサー
    this.spacerBottom = UIFactory.createDiv({
      className: 'virtual-list-spacer-bottom',
      styles: {
        height: '0px',
        'pointer-events': 'none'
      }
    });
    
    // DOM構造を組み立て
    this.listContainer.appendChild(this.spacerTop);
    this.listContainer.appendChild(this.spacerBottom);
    this.viewport.appendChild(this.listContainer);
    
    // ヘッダーの後にビューポートを追加
    if (existingHeader) {
      existingHeader.insertAdjacentElement('afterend', this.viewport);
    } else if (promptListHeader) {
      promptListHeader.insertAdjacentElement('afterend', this.viewport);
    } else {
      this.container.appendChild(this.viewport);
    }
  }

  /**
   * イベントリスナーを設定
   */
  bindEvents() {
    // スクロールイベント（throttled）
    this.viewport.addEventListener('scroll', (e) => {
      this.handleScroll(e);
    }, { passive: true });
    
    // リサイズイベント
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  /**
   * スクロールイベントハンドラー
   */
  handleScroll(e) {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(async () => {
      this.scrollTop = this.viewport.scrollTop;
      this.updateVisibleRange();
      await this.renderItems();
    });
  }

  /**
   * リサイズイベントハンドラー
   */
  handleResize() {
    // autoの場合は親要素のサイズを取得
    if (this.containerHeight === 'auto') {
      const parentHeight = this.viewport.parentElement ? 
        this.viewport.parentElement.getBoundingClientRect().height : 
        this.viewport.getBoundingClientRect().height;
      
      if (parentHeight > 0) {
        const effectiveHeight = Math.min(parentHeight, VIRTUAL_SCROLL.CONTAINER_HEIGHT); // 最大高さに制限
        this.visibleCount = Math.ceil(effectiveHeight / this.itemHeight);
        this.bufferCount = this.visibleCount * this.bufferSize;
        this.renderCount = this.visibleCount + (this.bufferCount * 2);
        this.updateVisibleRange();
        this.renderItems();
      }
    } else {
      // 固定高さの場合の処理
      const rect = this.container.getBoundingClientRect();
      if (rect.height !== this.containerHeight) {
        this.containerHeight = rect.height;
        this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
        this.renderCount = this.visibleCount + (this.bufferCount * 2);
        this.updateVisibleRange();
        this.renderItems();
      }
    }
  }

  /**
   * 表示範囲を更新
   */
  updateVisibleRange() {
    const scrollTop = this.scrollTop;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    
    const oldStartIndex = this.startIndex;
    const oldEndIndex = this.endIndex;
    
    // バッファを考慮した開始・終了インデックス
    this.startIndex = Math.max(0, startIndex - this.bufferCount);
    this.endIndex = Math.min(
      this.filteredData.length - 1,
      startIndex + this.renderCount - 1
    );
    
    // データ長が0の場合の特別処理
    if (this.filteredData.length === 0) {
      this.startIndex = 0;
      this.endIndex = -1;
    }
    
    // 範囲が変更された場合のログ
    if (oldStartIndex !== this.startIndex || oldEndIndex !== this.endIndex) {
      if (AppState?.config?.debugMode) console.log(`[VirtualList] Range changed: ${oldStartIndex}-${oldEndIndex} → ${this.startIndex}-${this.endIndex} (scroll: ${scrollTop})`);
      
      // ローカル辞書項目の範囲をチェック
      const localItemsInRange = [];
      for (let i = this.startIndex; i <= this.endIndex; i++) {
        if (i < this.filteredData.length) {
          const item = this.filteredData[i];
          if (item._source === 'local') {
            localItemsInRange.push(i);
          }
        }
      }
      
      if (localItemsInRange.length > 0) {
        if (AppState?.config?.debugMode) console.log(`[VirtualList] Local items in new range: [${localItemsInRange.join(', ')}]`);
      } else {
        if (AppState?.config?.debugMode) console.log(`[VirtualList] No local items in new range`);
      }
    }
  }

  /**
   * アイテムをレンダリング
   */
  async renderItems() {
    if (AppState?.config?.debugMode) console.log(`[VirtualList] renderItems: range ${this.startIndex}-${this.endIndex}, total=${this.filteredData.length}`);
    
    // スペーサーの高さを更新（修正版）
    const topHeight = this.startIndex * this.itemHeight;
    
    // レンダリング済みアイテム数を正確に計算
    const renderedItemCount = Math.max(0, this.endIndex - this.startIndex + 1);
    const remainingItems = Math.max(0, this.filteredData.length - this.startIndex - renderedItemCount);
    const bottomHeight = remainingItems * this.itemHeight;
    
    if (AppState?.config?.debugMode) console.log(`[VirtualList] Spacer heights: top=${topHeight}px, bottom=${bottomHeight}px (total items: ${this.filteredData.length})`);
    
    this.spacerTop.style.height = `${topHeight}px`;
    this.spacerBottom.style.height = `${bottomHeight}px`;
    
    // 現在表示されているアイテムのインデックスセット
    const currentIndices = new Set();
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      currentIndices.add(i);
    }
    
    // 不要なアイテムを削除
    const removedItems = [];
    for (const [index, element] of this.renderedItems) {
      if (!currentIndices.has(index)) {
        const item = this.filteredData[index];
        const source = item?._source || 'unknown';
        removedItems.push(`${index}(${source})`);
        
        if (element.parentNode) {
          element.remove();
        }
        this.renderedItems.delete(index);
      }
    }
    if (removedItems.length > 0) {
      if (AppState?.config?.debugMode) console.log(`[VirtualList] Removed items: [${removedItems.join(', ')}]`);
    }
    
    // 必要なアイテムを作成・更新
    const createdItems = [];
    const updatedItems = [];
    const recreatedItems = [];
    
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      if (i >= this.filteredData.length) break;
      
      let element = this.renderedItems.get(i);
      const item = this.filteredData[i];
      const source = item._source || 'unknown';
      const prompt = (typeof item.prompt === 'string' && item.prompt) ? item.prompt.substring(0, 15) + '...' : 'no-prompt';
      
      if (!element) {
        // 新しいアイテムを作成
        element = await this.createItemElement(item, i);
        this.renderedItems.set(i, element);
        
        // インデックス順に正しい位置に挿入
        this.insertElementInOrder(element, i);
        createdItems.push(`${i}(${source})`);
      } else {
        // 既存のアイテムを更新（アイテムIDが変わった場合は再作成）
        const existingId = element.getAttribute('data-virtual-item-id');
        const existingSource = element.getAttribute('data-source');
        
        if (existingId !== item._itemId || existingSource !== item._source) {
          if (AppState?.config?.debugMode) console.log(`[VirtualList] Item changed: ${existingSource}/${existingId} -> ${item._source}/${item._itemId}, recreating ${i}`);
          element.remove();
          this.renderedItems.delete(i);
          
          element = await this.createItemElement(item, i);
          this.renderedItems.set(i, element);
          
          // インデックス順に正しい位置に挿入
          this.insertElementInOrder(element, i);
          recreatedItems.push(`${i}(${source})`);
        } else {
          // 同じアイテムなので更新のみ
          await this.updateItemElement(element, item, i);
          updatedItems.push(`${i}(${source})`);
        }
      }
    }
    
    if (AppState?.config?.debugMode) console.log(`[VirtualList] Rendered range ${this.startIndex}-${this.endIndex}:`);
    if (createdItems.length > 0 && AppState?.config?.debugMode) console.log(`  Created: [${createdItems.join(', ')}]`);
    if (updatedItems.length > 0 && AppState?.config?.debugMode) console.log(`  Updated: [${updatedItems.join(', ')}]`);
    if (recreatedItems.length > 0 && AppState?.config?.debugMode) console.log(`  Recreated: [${recreatedItems.join(', ')}]`);
    
  }

  /**
   * アイテム要素を作成
   */
  async createItemElement(item, index) {
    const element = document.createElement('li');
    element.className = 'prompt-list-item';
    UIFactory.applyCssText(element, {
      height: `${this.itemHeight}px`,
      'box-sizing': 'border-box',
      display: 'flex',
      'align-items': 'center'
    });
    
    // アイテム識別情報を事前に設定（再作成判定用）
    if (item._source) {
      element.setAttribute('data-source', item._source);
    }
    if (item._itemId) {
      element.setAttribute('data-virtual-item-id', item._itemId);
    }
    
    // アイテム作成コールバックを呼び出し（async対応）
    if (this.onCreateItem) {
      await this.onCreateItem(element, item, index);
    }
    
    return element;
  }

  /**
   * アイテム要素を更新
   */
  async updateItemElement(element, item, index) {
    // アイテム更新コールバックを呼び出し（async対応）
    if (this.onUpdateItem) {
      await this.onUpdateItem(element, item, index);
    }
  }

  /**
   * 要素をインデックス順に正しい位置に挿入
   */
  insertElementInOrder(element, index) {
    // 現在のコンテナ内の要素を取得（spacerを除く）
    const existingElements = Array.from(this.listContainer.children).filter(
      child => !child.classList.contains('virtual-list-spacer-top') && 
               !child.classList.contains('virtual-list-spacer-bottom')
    );

    // 挿入位置を決定
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

  /**
   * 要素のインデックスを取得
   */
  getElementIndex(element) {
    // レンダリング済みアイテムから逆引きでインデックスを取得
    for (const [index, renderedElement] of this.renderedItems) {
      if (renderedElement === element) {
        return index;
      }
    }
    return null;
  }

  /**
   * データを設定
   */
  async setData(data) {
    // 高速化：大量データの場合は検証をスキップ
    if (!data || data.length === 0) {
      this.data = [];
    } else if (data.length > VIRTUAL_SCROLL.THRESHOLD) {
      // マスターデータなど大量データは事前に正規化済みと仮定
      this.data = data;
    } else {
      // 少量データのみ詳細検証
      this.data = data.map(item => {
        if (!item || typeof item !== 'object') {
          return { prompt: 'Invalid item', data: ['', '', ''] };
        }
        
        return {
          ...item,
          prompt: typeof item.prompt === 'string' ? item.prompt : String(item.prompt || 'No prompt'),
          data: Array.isArray(item.data) ? item.data : ['', '', '']
        };
      });
    }
    this.filteredData = [...this.data];
    this.scrollTop = 0;
    this.viewport.scrollTop = 0;
    
    // レンダリングをリセット
    this.clearRenderedItems();
    this.updateVisibleRange();
    await this.renderItems();
    
    if (AppState?.config?.debugMode) console.log(`Data set: ${this.data.length} items`);
  }

  /**
   * フィルターを適用
   */
  async setFilter(filterFn) {
    if (typeof filterFn === 'function') {
      this.filteredData = this.data.filter(filterFn);
    } else {
      this.filteredData = [...this.data];
    }
    
    this.scrollTop = 0;
    this.viewport.scrollTop = 0;
    
    // レンダリングをリセット
    this.clearRenderedItems();
    this.updateVisibleRange();
    await this.renderItems();
    
    if (AppState?.config?.debugMode) console.log(`Filter applied: ${this.filteredData.length}/${this.data.length} items`);
  }

  /**
   * レンダリング済みアイテムをクリア
   */
  clearRenderedItems() {
    for (const [index, element] of this.renderedItems) {
      if (element.parentNode) {
        // CustomDropdownインスタンスを破棄
        this.destroyCustomDropdowns(element);
        element.remove();
      }
    }
    this.renderedItems.clear();
  }

  /**
   * 要素内のカスタムドロップダウンとイベントリスナーを破棄
   */
  destroyCustomDropdowns(element) {
    const inputs = element.querySelectorAll('input');
    inputs.forEach(input => {
      // カスタムドロップダウンの破棄
      if (input.customDropdown) {
        if (AppState?.config?.debugMode) console.log('[VIRTUAL-LIST] Destroying custom dropdown for input:', input);
        input.customDropdown.destroy();
      }
      
      // イベントリスナーのクリーンアップ（重み変更の重複問題対策）
      if (input.type === 'number' && input.classList.contains('flex-col-weight')) {
        // 重みフィールドのイベントリスナーをクリア
        input.onchange = null;
        input.oninput = null;
        input.onblur = null;
        input.onkeydown = null;
        input.removeEventListener('wheel', input._wheelHandler);
        if (AppState?.config?.debugMode) console.log('[VIRTUAL-LIST] Cleared weight field event listeners:', input);
      }
    });
  }

  /**
   * 指定したインデックスにスクロール
   */
  scrollToIndex(index) {
    if (index < 0 || index >= this.filteredData.length) return;
    
    const targetScrollTop = index * this.itemHeight;
    this.viewport.scrollTop = targetScrollTop;
  }

  /**
   * アイテムの高さを動的に変更
   */
  setItemHeight(height) {
    this.itemHeight = height;
    this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    this.renderCount = this.visibleCount + (this.bufferCount * 2);
    
    // 再レンダリング
    this.updateVisibleRange();
    this.renderItems();
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      totalItems: this.data.length,
      filteredItems: this.filteredData.length,
      renderedItems: this.renderedItems.size,
      visibleRange: `${this.startIndex}-${this.endIndex}`,
      scrollPosition: this.scrollTop,
      memoryEstimate: `${(this.renderedItems.size * 2).toFixed(1)}KB` // 概算
    };
  }

  /**
   * リソースを破棄
   */
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    
    this.clearRenderedItems();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    if (AppState?.config?.debugMode) console.log('VirtualList destroyed');
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.VirtualList = VirtualList;
}