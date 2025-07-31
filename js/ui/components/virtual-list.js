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
    
    // 緊急改善: レンダリング時間によって動的にスロットリング
    const currentTime = performance.now();
    if (this.lastRenderTime && (currentTime - this.lastRenderTime) < this.dynamicThrottle) {
      // 前回のレンダリングが完了してから十分な時間が経過していない場合はスキップ
      if (AppState?.config?.debugMode) {
        console.log(`[PERF_THROTTLE] Skipping render, throttle: ${this.dynamicThrottle}ms`);
      }
      return;
    }
    
    // イベント洪水防止：同一スクロール位置での重複イベントを無視
    const currentScrollTop = this.viewport.scrollTop;
    if (this.lastEventScrollTop !== undefined && Math.abs(currentScrollTop - this.lastEventScrollTop) < 0.5) {
      // 0.5px未満の変動は重複イベントとして無視
      this.duplicateEventCount = (this.duplicateEventCount || 0) + 1;
      if (this.duplicateEventCount > 3) {
        if (AppState?.config?.debugMode) {
          console.log(`[PERF_SKIP] Duplicate scroll events ignored: ${this.duplicateEventCount}`);
        }
        return;
      }
    } else {
      this.duplicateEventCount = 0;
      this.lastEventScrollTop = currentScrollTop;
    }
    
    this.animationFrame = requestAnimationFrame(async () => {
      const scrollStart = performance.now();
      
      const newScrollTop = this.viewport.scrollTop;
      
      // スクロール位置の安定化チェック（微細な振動を無視）
      const scrollDelta = Math.abs(newScrollTop - this.scrollTop);
      const isStableScroll = scrollDelta < 1; // 1px未満の変動は無視
      
      if (isStableScroll && this.lastStableTime && (scrollStart - this.lastStableTime) < 50) {
        // 50ms以内の微細な変動は無視
        if (AppState?.config?.debugMode) {
          console.log(`[PERF_SKIP] Micro scroll ignored: delta=${scrollDelta.toFixed(2)}px`);
        }
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
      
      // 範囲が変更されていない場合はレンダリングをスキップ
      if (oldStartIndex === this.startIndex && oldEndIndex === this.endIndex) {
        if (AppState?.config?.debugMode) {
          console.log(`[PERF_SKIP] Range unchanged, skipping render: ${this.startIndex}-${this.endIndex} (scroll delta: ${scrollDelta.toFixed(2)}px)`);
        }
        this.animationFrame = null;
        return;
      }
      
      const renderStart = performance.now();
      await this.renderItems();
      const renderEnd = performance.now();
      
      // 動的スロットリング調整
      const totalTime = renderEnd - scrollStart;
      if (totalTime > 50) {
        this.dynamicThrottle = Math.min(100, (this.dynamicThrottle || 16) * 1.5); // 最大100ms
      } else if (totalTime < 10) {
        this.dynamicThrottle = Math.max(8, (this.dynamicThrottle || 16) * 0.8); // 最小8ms
      }
      
      this.lastRenderTime = renderEnd;
      
      // メモリ状況チェック（一定間隔で実行）
      this.scrollEventCount = (this.scrollEventCount || 0) + 1;
      if (this.scrollEventCount % 50 === 0) { // 50回に1回チェック（頻度を削減）
        this.checkMemoryStatus();
      }
      
      // パフォーマンス測定ログ（大量データ対応版・ワーニング軽減）
      if (AppState?.config?.debugMode) {
        // 大量データの判定（9000件以上のマスター辞書など）
        const isLargeDataset = this.filteredData.length > 5000;
        
        // マスター辞書などの大量データでは非常に寛容な閾値
        const scrollThreshold = isLargeDataset ? 500 : 150; // 大量データ: 500ms, 通常: 150ms
        
        // 大量データでは基本的にログを出さない（500ms超過時のみ情報ログ）
        if (totalTime > scrollThreshold) {
          const rangeTime = rangeUpdateTime - scrollStart;
          const renderTime = renderEnd - renderStart;
          console.log(`[PERF_SCROLL] Total: ${totalTime.toFixed(2)}ms, Range: ${rangeTime.toFixed(2)}ms, Render: ${renderTime.toFixed(2)}ms, Throttle: ${this.dynamicThrottle || 16}ms (scroll: ${this.scrollTop}) | Dataset: ${this.filteredData.length} items`);
          
          // 全て情報ログに統一（ワーニング廃止）
          if (isLargeDataset) {
            console.log(`[PERF_SCROLL] 📊 Large dataset scroll time: ${totalTime.toFixed(2)}ms (${this.filteredData.length} items - within expected range)`);
          } else {
            console.log(`[PERF_SCROLL] 📈 Scroll performance: ${totalTime.toFixed(2)}ms > ${scrollThreshold}ms threshold (consider optimization)`);
          }
        }
        // マスター辞書: ~500ms, 通常データ: ~150ms までは完全に無視
      }
      
      // animationFrameをクリア（メモリリーク防止）
      this.animationFrame = null;
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
    
    // 範囲が変更された場合のログ（最適化版）
    if (oldStartIndex !== this.startIndex || oldEndIndex !== this.endIndex) {
      if (AppState?.config?.debugMode) console.log(`[VirtualList] Range changed: ${oldStartIndex}-${oldEndIndex} → ${this.startIndex}-${this.endIndex} (scroll: ${scrollTop})`);
      
      // 🚀 最適化: 大量データではローカル項目チェックを軽量化
      if (this.filteredData.length > 5000) {
        // 大量データでは詳細チェックをスキップ（パフォーマンス優先）
        if (AppState?.config?.debugMode) {
          console.log(`[VirtualList] Large dataset (${this.filteredData.length} items), skipping detailed local item check`);
        }
      } else {
        // 通常データのみ詳細チェック
        const localItemsInRange = [];
        const rangeSize = this.endIndex - this.startIndex + 1;
        
        // 範囲が大きすぎる場合も軽量化
        if (rangeSize > 200) {
          if (AppState?.config?.debugMode) {
            console.log(`[VirtualList] Large range (${rangeSize} items), using sampling check`);
          }
          // サンプリングチェック: 10個置きにチェック
          for (let i = this.startIndex; i <= this.endIndex; i += 10) {
            if (i < this.filteredData.length) {
              const item = this.filteredData[i];
              if (item._source === 'local') {
                localItemsInRange.push(i);
              }
            }
          }
          if (localItemsInRange.length > 0) {
            if (AppState?.config?.debugMode) console.log(`[VirtualList] Local items sampled: [${localItemsInRange.join(', ')}] (sampled)`);
          }
        } else {
          // 通常の詳細チェック
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
    }
  }

  /**
   * アイテムをレンダリング
   */
  async renderItems() {
    const renderStartTime = performance.now();
    
    if (AppState?.config?.debugMode) console.log(`[VirtualList] renderItems: range ${this.startIndex}-${this.endIndex}, total=${this.filteredData.length}`);
    
    // スペーサーの高さを更新（修正版）
    const spacerStart = performance.now();
    const topHeight = this.startIndex * this.itemHeight;
    
    // レンダリング済みアイテム数を正確に計算
    const renderedItemCount = Math.max(0, this.endIndex - this.startIndex + 1);
    const remainingItems = Math.max(0, this.filteredData.length - this.startIndex - renderedItemCount);
    const bottomHeight = remainingItems * this.itemHeight;
    
    if (AppState?.config?.debugMode) console.log(`[VirtualList] Spacer heights: top=${topHeight}px, bottom=${bottomHeight}px (total items: ${this.filteredData.length})`);
    
    this.spacerTop.style.height = `${topHeight}px`;
    this.spacerBottom.style.height = `${bottomHeight}px`;
    const spacerTime = performance.now() - spacerStart;
    
    // 現在表示されているアイテムのインデックスセット
    const currentIndices = new Set();
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      currentIndices.add(i);
    }
    
    // 🚀 最適化: 不要なアイテムを効率的に削除
    const removeStart = performance.now();
    const removedItems = [];
    
    // 大量データでは削除対象を事前に特定して効率化
    const itemsToRemove = [];
    if (this.renderedItems.size > 100) {
      // 削除対象を先に配列に収集（Mapの反復中の削除を避ける）
      for (const [index, element] of this.renderedItems) {
        if (!currentIndices.has(index)) {
          itemsToRemove.push([index, element]);
        }
      }
      
      // 一括削除処理
      for (const [index, element] of itemsToRemove) {
        const item = this.filteredData[index];
        const source = item?._source || 'unknown';
        removedItems.push(`${index}(${source})`);
        
        if (element.parentNode) {
          element.remove();
        }
        this.renderedItems.delete(index);
      }
    } else {
      // 通常の削除処理（少量データ用）
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
    }
    const removeTime = performance.now() - removeStart;
    if (removedItems.length > 0) {
      if (AppState?.config?.debugMode) console.log(`[VirtualList] Removed items: [${removedItems.join(', ')}]`);
    }
    
    // 必要なアイテムを作成・更新
    const createUpdateStart = performance.now();
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
    const createUpdateTime = performance.now() - createUpdateStart;
    
    // パフォーマンス統計ログ（シンプル版）
    const totalRenderTime = performance.now() - renderStartTime;
    
    // パフォーマンス監視（大量データ対応版・ワーニング軽減）
    if (AppState?.config?.debugMode && totalRenderTime > 100) { // 初期閾値を100msに引き上げ
      // 大量データの判定（9000件以上のマスター辞書など）
      const isLargeDataset = this.filteredData.length > 5000;
      const totalProcessedItems = createdItems.length + (recreatedItems.length * 2); // recreatedは2倍重い
      
      // さらに寛容な閾値設定
      const dynamicThreshold = isLargeDataset 
        ? 400 + (totalProcessedItems * 5)  // 大量データ：400ms基準 + 処理数×5ms
        : 200 + (totalProcessedItems * 3); // 通常データ：200ms基準 + 処理数×3ms
      
      const isActuallySlow = totalRenderTime > dynamicThreshold;
      
      if (isActuallySlow) {
        // 真の性能問題の場合のみログ出力
        console.log(`[PERF_RENDER] Total: ${totalRenderTime.toFixed(2)}ms | Spacer: ${spacerTime.toFixed(2)}ms | Remove: ${removeTime.toFixed(2)}ms | Create/Update: ${createUpdateTime.toFixed(2)}ms`);
        
        // 全て情報ログに統一（ワーニング廃止）
        if (isLargeDataset) {
          console.log(`[PERF_RENDER] 📊 Large dataset render time: ${totalRenderTime.toFixed(2)}ms (${this.filteredData.length} items - processing ${totalProcessedItems} items)`);
        } else {
          console.log(`[PERF_RENDER] 📈 Render performance: ${totalRenderTime.toFixed(2)}ms > ${dynamicThreshold}ms threshold | Items: ${createdItems.length} created, ${updatedItems.length} updated, ${recreatedItems.length} recreated, ${removedItems.length} removed | Dataset: ${this.filteredData.length} items`);
        }
      }
      // マスター辞書などの大量データでは400ms+処理数×5ms まで完全に無視
    }
    
    // 詳細ログは問題発生時のみ表示
    if (AppState?.config?.debugMode && totalRenderTime > 30) {
      console.log(`[VirtualList] Rendered range ${this.startIndex}-${this.endIndex}:`);
      if (createdItems.length > 0) console.log(`  Created: [${createdItems.join(', ')}]`);
      if (updatedItems.length > 0) console.log(`  Updated: [${updatedItems.join(', ')}]`);
      if (recreatedItems.length > 0) console.log(`  Recreated: [${recreatedItems.join(', ')}]`);
    }
    
  }

  /**
   * アイテム要素を作成
   */
  async createItemElement(item, index) {
    const createElementStart = performance.now();
    
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
    
    const domCreateTime = performance.now() - createElementStart;
    
    // アイテム作成コールバックを呼び出し（async対応）
    if (this.onCreateItem) {
      const callbackStart = performance.now();
      await this.onCreateItem(element, item, index);
      const callbackTime = performance.now() - callbackStart;
      
      // 重いコールバック検出（フィルタリングワード: /PERF_CREATE/)
      if (AppState?.config?.debugMode && callbackTime > 15) {
        console.log(`[PERF_CREATE] 📊 CreateItem time: ${callbackTime.toFixed(2)}ms for index ${index} (${item._source || 'unknown'})`);
      }
    }
    
    const totalCreateTime = performance.now() - createElementStart;
    if (AppState?.config?.debugMode && totalCreateTime > 10) {
      console.log(`[PERF_CREATE] 📊 createElement time: ${totalCreateTime.toFixed(2)}ms | DOM: ${domCreateTime.toFixed(2)}ms for index ${index}`);
    }
    
    return element;
  }

  /**
   * アイテム要素を更新
   */
  async updateItemElement(element, item, index) {
    const updateStart = performance.now();
    
    // アイテム更新コールバックを呼び出し（async対応）
    if (this.onUpdateItem) {
      const callbackStart = performance.now();
      await this.onUpdateItem(element, item, index);
      const callbackTime = performance.now() - callbackStart;
      
      // 重いコールバック検出（フィルタリングワード: /PERF_UPDATE/)
      if (AppState?.config?.debugMode && callbackTime > 10) {
        console.log(`[PERF_UPDATE] 📊 UpdateItem time: ${callbackTime.toFixed(2)}ms for index ${index} (${item._source || 'unknown'})`);
      }
    }
    
    const totalUpdateTime = performance.now() - updateStart;
    if (AppState?.config?.debugMode && totalUpdateTime > 5) {
      console.log(`[PERF_UPDATE] 📊 updateItemElement time: ${totalUpdateTime.toFixed(2)}ms for index ${index}`);
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
    const destroyStart = performance.now();
    const inputs = element.querySelectorAll('input');
    let destroyedDropdowns = 0;
    let clearedLazyDropdowns = 0;
    let clearedWeightFields = 0;
    
    inputs.forEach(input => {
      // カスタムドロップダウンの破棄
      if (input.customDropdown) {
        if (AppState?.config?.debugMode) console.log('[VIRTUAL-LIST] Destroying custom dropdown for input:', input);
        input.customDropdown.destroy();
        destroyedDropdowns++;
      }
      
      // 遅延初期化用のメタデータクリーンアップ
      if (input._lazyDropdownConfig) {
        input._lazyDropdownConfig = null;
        input.removeAttribute('data-dropdown-lazy');
        
        // Intersection Observer のクリーンアップ
        if (input._intersectionObserver) {
          input._intersectionObserver.disconnect();
          input._intersectionObserver = null;
        }
        
        // 保留中の初期化をキャンセル
        if (input._pendingInit) {
          clearTimeout(input._pendingInit);
          input._pendingInit = null;
        }
        
        clearedLazyDropdowns++;
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
        clearedWeightFields++;
      }
    });
    
    const destroyTime = performance.now() - destroyStart;
    
    // パフォーマンス測定ログ（フィルタリングワード: /PERF_DESTROY/)
    if (AppState?.config?.debugMode && destroyTime > 1) {
      console.log(`[PERF_DESTROY] Cleanup: ${destroyTime.toFixed(2)}ms | Dropdowns: ${destroyedDropdowns}, Lazy: ${clearedLazyDropdowns}, Weight fields: ${clearedWeightFields}`);
    }
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
   * メモリ使用量とリソース状況をチェック
   */
  checkMemoryStatus() {
    const stats = this.getStats();
    const currentTime = Date.now();
    
    // メモリ状況ログ（フィルタリングワード: /MEMORY_CHECK/)
    if (AppState?.config?.debugMode) {
      console.log(`[MEMORY_CHECK] Items: ${stats.renderedItems}/${stats.filteredItems} | Range: ${stats.visibleRange} | Scroll: ${stats.scrollPosition}`);
      
      // 異常なメモリ使用量の検出
      if (stats.renderedItems > (this.renderCount * 1.5)) {
        console.log(`[MEMORY_CHECK] 📊 Rendered items count: ${stats.renderedItems} > ${Math.floor(this.renderCount * 1.5)} (monitoring)`);
      }
      
      // animationFrameリークの検出（大幅緩和）
      if (this.animationFrame && this.lastScrollTime && (currentTime - this.lastScrollTime) > 30000) {
        // 30秒以上の場合のみ情報ログ（警告ではない）
        console.log(`[MEMORY_CHECK] Long scroll pause detected: ${Math.floor((currentTime - this.lastScrollTime) / 1000)}s (no action needed)`);
      }
    }
    
    this.lastScrollTime = currentTime;
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