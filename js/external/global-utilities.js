/**
 * global-utilities.js - グローバルユーティリティ関数モジュール
 * Phase 5 Step 5: 後方互換性のために残されているグローバル関数群
 */

// ============================================
// デバッグモード関連
// ============================================

/**
 * デバッグモードを切り替え
 * @param {boolean} [enabled] - 省略時は現在の状態を切り替え
 */
function toggleDebugMode(enabled) {
  if (enabled === undefined) {
    AppState.config.debugMode = !AppState.config.debugMode;
  } else {
    AppState.config.debugMode = enabled;
  }
  
  console.log(`[DEBUG] Debug mode ${AppState.config.debugMode ? 'ON' : 'OFF'}`);
  
  if (AppState.config.debugMode) {
    console.log('[DEBUG] Debug logs for [BUTTON_DEBUG], [DICT_DEBUG], [DROPDOWN] are now enabled');
  } else {
    console.log('[DEBUG] Debug logs are now disabled');
  }
  
  return AppState.config.debugMode;
}

/**
 * ツールチップ表示を切り替え
 * @param {boolean} enabled - true: ツールチップ表示, false: ツールチップ非表示
 */
function toggleTooltips(enabled) {
  if (typeof enabled !== 'boolean') {
    console.warn('[TOOLTIP] toggleTooltips(): enabled parameter must be boolean');
    return;
  }
  
  if (!enabled) {
    // ツールチップを無効化：title属性を一時的に保存してdata-original-titleに移動
    const elementsWithTitle = document.querySelectorAll('[title]');
    elementsWithTitle.forEach(element => {
      if (!element.hasAttribute('data-original-title')) {
        element.setAttribute('data-original-title', element.getAttribute('title'));
        element.removeAttribute('title');
      }
    });
    
    // 新しく追加される要素のためのMutationObserver
    if (!window.tooltipObserver) {
      window.tooltipObserver = new MutationObserver((mutations) => {
        if (!window.tooltipsEnabled) {  // ツールチップが無効の場合のみ
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  // 追加されたノード自体
                  if (node.hasAttribute && node.hasAttribute('title')) {
                    node.setAttribute('data-original-title', node.getAttribute('title'));
                    node.removeAttribute('title');
                  }
                  // 追加されたノードの子要素
                  const childrenWithTitle = node.querySelectorAll && node.querySelectorAll('[title]');
                  if (childrenWithTitle) {
                    childrenWithTitle.forEach(child => {
                      child.setAttribute('data-original-title', child.getAttribute('title'));
                      child.removeAttribute('title');
                    });
                  }
                }
              });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
              const element = mutation.target;
              if (element.hasAttribute('title') && !element.hasAttribute('data-original-title')) {
                element.setAttribute('data-original-title', element.getAttribute('title'));
                element.removeAttribute('title');
              }
            }
          });
        }
      });
      
      window.tooltipObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title']
      });
    }
    
    window.tooltipsEnabled = false;
  } else {
    // ツールチップを有効化：data-original-titleからtitle属性を復元
    const elementsWithOriginalTitle = document.querySelectorAll('[data-original-title]');
    elementsWithOriginalTitle.forEach(element => {
      element.setAttribute('title', element.getAttribute('data-original-title'));
      element.removeAttribute('data-original-title');
    });
    
    window.tooltipsEnabled = true;
  }
  
  if (AppState.config?.debugMode) {
    console.log(`[TOOLTIP] Tooltips ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  return enabled;
}

// ============================================
// プロンプト更新関連
// ============================================

/**
 * プロンプトの表示を更新
 * @deprecated 将来的にはapp.updatePromptDisplay()を直接使用
 */
function UpdateGenaretePrompt() {
  if (window.app) {
    window.app.updatePromptDisplay();
  }
}

/**
 * プロンプトを初期化
 * @param {string} str - プロンプト文字列
 * @deprecated 将来的にはpromptEditor.init()を直接使用
 */
function InitGenaretePrompt(str) {
  // 重複した初期化を防ぐ
  if (str !== editPrompt.prompt) {
    editPrompt.init(str);
    if (window.app) {
      window.app.generateInput.val(editPrompt.prompt);
    }
  }
}

// ============================================
// リスト更新関連
// ============================================

/**
 * 編集リストを初期化
 * @deprecated 将来的にはapp.refreshEditList()を直接使用
 */
function editInit() {
  if (window.app) {
    window.app.refreshEditList();
  }
}

/**
 * アーカイブリストを初期化
 * @deprecated 将来的にはapp.refreshFavoriteList()を直接使用
 */
function favoritesInit() {
  // jQuery → Vanilla JS 置換 (Phase 8)
  const favoriteListElement = document.querySelector(
    DOM_SELECTORS.BY_ID.FAVORITE_LIST
  );
  if (
    window.app &&
    favoriteListElement &&
    favoriteListElement.children.length > 0
  ) {
    const currentDict = getCurrentPromptDictionary();
    window.app.listManager.createFlexibleList(
      currentDict.prompts || [],
      DOM_SELECTORS.BY_ID.FAVORITE_LIST,
      {
        fields: FAVORITE_FIELDS,
        buttons: FAVORITE_BUTTONS,
        sortable: true,
        listType: "favorite",
        scrollRestoreDelay: 100, // スクロール復元遅延時間
        refreshCallback: async () => {
          // 統一リフレッシュコールバック
          await favoritesInit();
        },
        idOffset: ID_OFFSETS.FAVORITES,
      }
    );
  }
}

/**
 * 追加リストを初期化
 * @deprecated 将来的にはapp.refreshAddList()を直接使用
 */
function addInit() {
  if (window.app) {
    window.app.refreshAddList();
  }
}

// ============================================
// バックグラウンド通信
// ============================================

/**
 * バックグラウンドスクリプトにメッセージを送信
 * @param {string} service - サービス名
 * @param {string} execType - 実行タイプ
 * @param {*} value1 - パラメータ1
 * @param {*} value2 - パラメータ2
 * @param {*} value3 - パラメータ3
 * @deprecated DOM操作用の特殊なメッセージ送信
 */
function sendBackground(service, execType, value1, value2, value3) {
  // Generate実行の場合は履歴に登録
  if (service === "DOM" && execType === "Generate" && value1) {
    if (window.app && window.app.historyManager) {
      // プロンプト情報を判定
      let slotInfo = { usedSlots: 0, slotNames: ["直接実行"] };

      if (
        window.autoGenerateHandler &&
        window.autoGenerateHandler.historyPrompt
      ) {
        // 履歴プロンプトの場合
        slotInfo = { usedSlots: 0, slotNames: ["履歴プロンプト"] };
      } else if (window.promptSlotManager) {
        // 通常のスロット使用の場合
        const usedSlots = window.promptSlotManager.getUsedSlots();
        if (usedSlots && usedSlots.length > 0) {
          slotInfo = {
            usedSlots: usedSlots.length,
            slotNames: usedSlots.map(
              (slot) => slot.name || `スロット${slot.id}`
            ),
          };
        }
      }

      // 履歴に追加
      window.app.historyManager.addToHistory(value1, slotInfo);
      console.log(
        "Generate history registered:",
        value1.substring(0, 50) + "..."
      );
    }
  }

  const message = {
    type: "DOM",
    args: [service, execType, value1, value2, value3],
  };

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Runtime error:", chrome.runtime.lastError.message);
    }
  });
}

// ============================================
// カテゴリー関連
// ============================================

/**
 * カテゴリーリストを設定
 * @param {string} id - セレクト要素のID（jQueryセレクタ形式）
 * @param {number} category - カテゴリーレベル
 * @deprecated 将来的にはcategoryData.getCategoriesByParent()を使用
 */
function setCategoryList(id, category) {
  // jQuery → Vanilla JS 置換 (Phase 8)
  const selectElement = document.querySelector(id);
  if (!selectElement) return;

  // オプションを削除
  const options = selectElement.querySelectorAll("option");
  options.forEach((option) => option.remove());

  // 新しいオプションを追加
  categoryData.data[category].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.value;
    selectElement.appendChild(option);
  });

  // プロパティ設定
  selectElement.disabled = false;
  selectElement.value = "";
}

/**
 * 検索カテゴリーを設定
 * @deprecated 将来的にはapp.updateUIState()を直接使用
 */
function setSearchCategory() {
  if (window.app) {
    window.app.updateUIState();
    if (AppState.data.searchCategory?.[0]) {
      // 初期表示時はローディングを表示しない
      window.app.searchHandler.performSearch({ showLoading: false });
    }
  }
}

// ============================================
// ユーティリティ
// ============================================

/**
 * JSONオブジェクトをループ処理
 * @param {Object|Array} json - 処理対象のJSON
 * @param {Function} callback - 各要素に対するコールバック
 * @deprecated 標準のforEachやfor...ofループを使用推奨
 */
function jsonLoop(json, callback) {
  if (!json) return;

  const length = Array.isArray(json) ? json.length : Object.keys(json).length;
  for (let i = 0; i < length; i++) {
    callback(json[i], i);
  }
}

/**
 * プロンプトを生成（NovelAI用）
 * @deprecated 将来的にはapp.generatePrompt()を直接使用
 */
function Generate() {
  if (window.app) {
    window.app.generatePrompt();
  }
}

// ============================================
// モジュール情報
// ============================================

/**
 * このモジュールの情報を表示（デバッグ用）
 */
function showGlobalUtilitiesInfo() {
  console.group("Global Utilities Module");

  console.groupEnd();
}

// グローバルに公開（後方互換性のため）
if (typeof window !== "undefined") {
  window.UpdateGenaretePrompt = UpdateGenaretePrompt;
  window.InitGenaretePrompt = InitGenaretePrompt;
  window.editInit = editInit;
  window.favoritesInit = favoritesInit;
  window.addInit = addInit;
  window.sendBackground = sendBackground;
  window.setCategoryList = setCategoryList;
  window.setSearchCategory = setSearchCategory;
  window.jsonLoop = jsonLoop;
  window.Generate = Generate;
  window.showGlobalUtilitiesInfo = showGlobalUtilitiesInfo;
  window.updateGeneratePromptSeparatorForSlotMode = updateGeneratePromptSeparatorForSlotMode;
}

// ============================================
// スロット切り替え時の区切り文字変換
// ============================================

/**
 * スロットモード変更時にジェネレートプロンプトの区切り文字を適切に更新（要素配列ベース）
 * @param {string} mode - スロットモード ('single', 'normal', 'random', 'sequential')
 * @param {string} caller - 呼び出し元の識別子（ログ用）
 */
async function updateGeneratePromptSeparatorForSlotMode(mode, caller = 'Unknown') {
  try {
    console.log(`[${caller}] Updating prompt separator for mode: ${mode}`);
    
    // editPromptのgenerate()メソッドを呼び出して要素配列から再生成
    if (window.editPrompt && typeof window.editPrompt.generate === 'function') {
      window.editPrompt.generate();
      console.log(`[${caller}] Regenerated prompt from elements for mode: ${mode}`);
    } else {
      console.warn(`[${caller}] editPrompt.generate() not available`);
    }

  } catch (error) {
    console.error(`[${caller}] Error updating generate prompt separator:`, error);
  }
}
