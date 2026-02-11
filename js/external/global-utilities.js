function toggleDebugMode(enabled) {
  if (enabled === undefined) {
    AppState.config.debugMode = !AppState.config.debugMode;
  } else {
    AppState.config.debugMode = enabled;
  }

  return AppState.config.debugMode;
}

function toggleTooltips(enabled) {
  if (typeof enabled !== "boolean") {
    return;
  }

  if (!enabled) {
    const elementsWithTitle = document.querySelectorAll("[title]");
    elementsWithTitle.forEach((element) => {
      if (!element.hasAttribute("data-original-title")) {
        element.setAttribute("data-original-title", element.getAttribute("title"));
        element.removeAttribute("title");
      }
    });

    // 新しく追加される要素のためのMutationObserver
    if (!window.tooltipObserver) {
      window.tooltipObserver = new MutationObserver((mutations) => {
        if (!window.tooltipsEnabled) {
          // ツールチップが無効の場合のみ
          mutations.forEach((mutation) => {
            if (mutation.type === "childList") {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  if (node.hasAttribute && node.hasAttribute("title")) {
                    node.setAttribute("data-original-title", node.getAttribute("title"));
                    node.removeAttribute("title");
                  }
                  const childrenWithTitle = node.querySelectorAll && node.querySelectorAll("[title]");
                  if (childrenWithTitle) {
                    childrenWithTitle.forEach((child) => {
                      child.setAttribute("data-original-title", child.getAttribute("title"));
                      child.removeAttribute("title");
                    });
                  }
                }
              });
            } else if (mutation.type === "attributes" && mutation.attributeName === "title") {
              const element = mutation.target;
              if (element.hasAttribute("title") && !element.hasAttribute("data-original-title")) {
                element.setAttribute("data-original-title", element.getAttribute("title"));
                element.removeAttribute("title");
              }
            }
          });
        }
      });

      window.tooltipObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["title"],
      });
    }

    window.tooltipsEnabled = false;
  } else {
    const elementsWithOriginalTitle = document.querySelectorAll("[data-original-title]");
    elementsWithOriginalTitle.forEach((element) => {
      element.setAttribute("title", element.getAttribute("data-original-title"));
      element.removeAttribute("data-original-title");
    });

    window.tooltipsEnabled = true;
  }

  return enabled;
}

// @deprecated 将来的にはapp.updatePromptDisplay()を直接使用
function UpdateGenaretePrompt() {
  if (window.app) {
    window.app.updatePromptDisplay();
  }
}

// @deprecated 将来的にはapp.refreshFavoriteList()を直接使用
function favoritesInit() {
  // jQuery → Vanilla JS 置換 (Phase 8)
  const favoriteListElement = document.querySelector(DOM_SELECTORS.BY_ID.FAVORITE_LIST);
  if (window.app && favoriteListElement && favoriteListElement.children.length > 0) {
    const currentDict = getCurrentPromptDictionary();
    window.app.listManager.createFlexibleList(currentDict.prompts || [], DOM_SELECTORS.BY_ID.FAVORITE_LIST, {
      ...LIST_TYPE_CONFIGS.favorite,
      refreshCallback: async () => await favoritesInit(),
      idOffset: ID_OFFSETS.FAVORITES,
    });
  }
}

// @deprecated DOM操作用の特殊なメッセージ送信
function sendBackground(service, execType, value1, value2, value3) {
  if (service === "DOM" && execType === "Generate" && value1) {
    if (window.app && window.app.historyManager) {
      let slotInfo = { usedSlots: 0, slotNames: ["直接実行"] };

      if (window.autoGenerateHandler && window.autoGenerateHandler.historyPrompt) {
        slotInfo = { usedSlots: 0, slotNames: ["履歴プロンプト"] };
      } else if (window.promptSlotManager) {
        const usedSlots = window.promptSlotManager.getUsedSlots();
        if (usedSlots && usedSlots.length > 0) {
          slotInfo = {
            usedSlots: usedSlots.length,
            slotNames: usedSlots.map((slot) => slot.name || `スロット${slot.id}`),
          };
        }
      }

      window.app.historyManager.addToHistory(value1, slotInfo);
    }
  }

  const message = {
    type: "DOM",
    args: [service, execType, value1, value2, value3],
  };

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
    }
  });
}

// @deprecated 将来的にはapp.updateUIState()を直接使用
function setSearchCategory() {
  if (window.app) {
    window.app.updateUIState();
    if (AppState.data.searchCategory?.[0]) {
      window.app.searchHandler.performSearch({ showLoading: false });
    }
  }
}

// @deprecated 標準のforEachやfor...ofループを使用推奨
function jsonLoop(json, callback) {
  if (!json) return;

  const length = Array.isArray(json) ? json.length : Object.keys(json).length;
  for (let i = 0; i < length; i++) {
    callback(json[i], i);
  }
}

// グローバルに公開（後方互換性のため）
if (typeof window !== "undefined") {
  window.UpdateGenaretePrompt = UpdateGenaretePrompt;
  window.favoritesInit = favoritesInit;
  window.sendBackground = sendBackground;
  window.setSearchCategory = setSearchCategory;
  window.jsonLoop = jsonLoop;
}
