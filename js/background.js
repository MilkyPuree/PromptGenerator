let promptTabele = [];
let isMenuInitialized = false;
let isInitializing = false; // 初期化中フラグを追加

// 安全な初期化を保証する関数
async function ensureMenuInitialized() {
  // 既に初期化済みまたは初期化中の場合はスキップ
  if (isMenuInitialized || isInitializing) {
    return;
  }

  try {
    isInitializing = true;
    await createBaseMenuItems();
  } catch (error) {
    isInitializing = false; // エラー時はフラグをリセット
    throw error;
  }
}

// 初期化時にコンテキストメニューを作成
chrome.runtime.onInstalled.addListener(async () => {
  await ensureMenuInitialized();
});

// 拡張機能起動時にもメニューを作成（安全な遅延初期化）
(async () => {
  // onInstalledの処理を待つ
  await new Promise((resolve) => setTimeout(resolve, 200));
  await ensureMenuInitialized();
})();

// ベースとなるメニュー項目を作成
async function createBaseMenuItems() {
  if (isMenuInitialized) {
    return;
  }

  try {
    // 既存のメニューをすべてクリアする（Promise化）
    await new Promise((resolve) => {
      chrome.contextMenus.removeAll(() => {
        resolve();
      });
    });

    // promptTabeleもクリア
    promptTabele = [];

    // プロンプトを記録するメニュー（親メニュー）
    chrome.contextMenus.create({
      id: "PromptArchive",
      title: "プロンプトを記録する",
      contexts: ["selection"],
    });

    // 記録済みプロンプトの親メニュー
    chrome.contextMenus.create({
      id: "LoadPrompt",
      title: "記録済みプロンプト",
      contexts: ["editable"],
    });

    // プロンプト記録先の辞書メニューを作成
    await createArchiveDestinationMenus();

    // 初期のアーカイブリストを作成
    await CreateArchiveList();

    isMenuInitialized = true;
    isInitializing = false; // 初期化完了フラグもリセット
  } catch (error) {
    isInitializing = false; // エラー時はフラグをリセット
    throw error;
  }
}

// プロンプト記録先の辞書メニューを作成
async function createArchiveDestinationMenus() {
  try {
    const items = await chrome.storage.local.get(["promptDictionaries"]);
    const promptDictionaries = items.promptDictionaries || {
      main: { name: "メインリスト", prompts: [] },
    };

    const dictionaries = Object.keys(promptDictionaries);

    // まず既存の辞書メニューを削除
    for (const dictId of dictionaries) {
      const menuId = `PromptArchive_${dictId}`;
      await new Promise((resolve) => {
        chrome.contextMenus.remove(menuId, () => {
          // エラーを無視（存在しない場合）
          chrome.runtime.lastError;
          resolve();
        });
      });
    }

    // 辞書が1つだけの場合は直接保存（メニューを作らない）
    if (dictionaries.length === 1) {
      // 何もしない（PromptArchiveクリック時に直接保存）
      return;
    }

    // 複数辞書がある場合はサブメニューを作成
    for (const dictId of dictionaries) {
      const dict = promptDictionaries[dictId];
      const menuId = `PromptArchive_${dictId}`;

      chrome.contextMenus.create(
        {
          parentId: "PromptArchive",
          id: menuId,
          title: dict.name || dictId,
          contexts: ["selection"],
        },
        () => {
          // エラーを無視
          chrome.runtime.lastError;
        }
      );
    }
  } catch (error) {
    // 辞書メニュー作成エラー
  }
}

// コンテキストメニューのクリックイベント
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  // プロンプト記録系の処理
  if (info.menuItemId === "PromptArchive" || info.menuItemId.startsWith("PromptArchive_")) {
    // 辞書が1つだけの場合または特定の辞書が選択された場合
    const dictId = info.menuItemId === "PromptArchive" ? null : info.menuItemId.replace("PromptArchive_", "");
    handlePromptArchive(info, dictId);
    return;
  }

  switch (info.menuItemId) {
    case "LoadPrompt":
      // 読み込みプロンプトの親なだけなので特に処理はしない
      break;
    default:
      // IDからプロンプトテキストを取得
      const menuItem = promptTabele.find((item) => item.id === info.menuItemId);
      const promptText = menuItem ? menuItem.prompt : info.menuItemId;

      if (!menuItem) {
        return;
      }

      // まずポップアップへの送信を試みる
      chrome.runtime.sendMessage(
        {
          type: "insertPrompt",
          text: promptText,
        },
        (response) => {
          // runtime.lastErrorをチェックして無視
          chrome.runtime.lastError;

          // ポップアップが応答しない場合は、通常のページへの挿入を試みる
          if (!response || !response.success) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: (text) => {
                document.execCommand("insertText", false, text);
              },
              args: [promptText],
            });
          }
        }
      );
      break;
  }
});

// プロンプトアーカイブ処理（辞書指定対応）
function handlePromptArchive(info, targetDictId = null) {
  const selectedText = info.selectionText;

  // プロンプトの基本バリデーション
  if (!selectedText || selectedText.trim().length < 2) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendNotificationToTab(tabs[0].id, "選択されたテキストが短すぎます（2文字以上必要）", "warning");
    });
    return;
  }

  chrome.storage.local.get(["promptDictionaries", "currentPromptDictionary"], function (items) {
    let promptDictionaries = items.promptDictionaries || {
      main: { name: "メインリスト", prompts: [] },
    };

    // targetDictIdがnullの場合（辞書が1つだけの場合）は現在の辞書を使用
    const dictId = targetDictId || items.currentPromptDictionary || "main";
    const targetDict = promptDictionaries[dictId];

    if (!targetDict) {
      return;
    }

    if (!targetDict.prompts) {
      targetDict.prompts = [];
    }

    // 重複チェック（正規化して比較）
    const normalizedSelectedText = selectedText.trim().toLowerCase();

    // 1. 対象辞書内での重複チェック
    const matchedIndex = targetDict.prompts.findIndex(
      (obj) => obj.prompt && obj.prompt.trim().toLowerCase() === normalizedSelectedText
    );

    // 2. 全辞書にわたる重複チェック
    let duplicateDict = null;
    for (const [checkDictId, checkDict] of Object.entries(promptDictionaries)) {
      if (checkDict.prompts) {
        const found = checkDict.prompts.find(
          (obj) => obj.prompt && obj.prompt.trim().toLowerCase() === normalizedSelectedText
        );
        if (found) {
          duplicateDict = { id: checkDictId, name: checkDict.name || checkDictId };
          break;
        }
      }
    }

    if (matchedIndex !== -1 || duplicateDict) {
      // 既に存在する場合は通知を表示
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const duplicateLocation = duplicateDict ? duplicateDict.name : targetDict.name || dictId;
        sendNotificationToTab(tabs[0].id, `このプロンプトは「${duplicateLocation}」に既に保存されています`, "warning");
      });
    } else {
      // 新規追加（ポップアップなしで即座に保存）
      const newPrompt = {
        title: "", // タイトルは後で編集可能
        prompt: selectedText,
        sort: targetDict.prompts.length,
      };

      targetDict.prompts.push(newPrompt);

      chrome.storage.local.set({ promptDictionaries: promptDictionaries }, () => {
        // プロンプトリストを更新
        UpdatePromptList();

        // 成功通知
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          sendNotificationToTab(tabs[0].id, `プロンプトを「${targetDict.name || dictId}」に保存しました`, "success");
        });
      });
    }
  });
}

// メッセージリスナー（一つに統合）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // promptResponse の処理を async/await で修正
  if (message.type === "promptResponse") {
    handlePromptResponse(message.text)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 非同期レスポンスのためにtrueを返す
    return true;
  }

  // 他のメッセージタイプの処理
  switch (message.type) {
    case "openWindow":
      chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: message.windowType === "normal" ? "popup" : message.windowType,
        width: 400,
        height: 800,
      });
      sendResponse({ success: true });
      break;

    case "openPage":
      chrome.tabs.create({
        url: chrome.runtime.getURL("popup.html"),
      });
      sendResponse({ success: true });
      break;

    case "UpdatePromptList":
      UpdatePromptList().then(() => {
        sendResponse({ text: "バックグラウンド処理の終了", success: true });
      });
      return true; // 非同期レスポンス

    case "DOM":
      handleDOMOperation(message.args);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: "Unknown message type" });
      break;
  }
});

let isUpdatingMenu = false;

async function UpdatePromptList() {
  // 既に更新中または初期化中の場合はスキップ
  if (isUpdatingMenu || isInitializing) {
    return;
  }

  try {
    isUpdatingMenu = true;

    // 全メニューを削除して最初から作り直す
    await new Promise((resolve) => {
      chrome.contextMenus.removeAll(() => {
        resolve();
      });
    });

    // promptTabeleもクリア
    promptTabele = [];

    // 初期化フラグをリセット
    isMenuInitialized = false;
    isInitializing = false; // 初期化中フラグもリセット

    // ベースメニューから再作成
    await createBaseMenuItems();
  } catch (error) {
    // メニュー更新エラー
  } finally {
    // 必ずフラグをリセット
    isUpdatingMenu = false;
  }
}

// プロンプト辞書からコンテキストメニューを作成（2段階メニュー対応）
async function CreateArchiveList() {
  try {
    const items = await chrome.storage.local.get(["promptDictionaries"]);
    const promptDictionaries = items.promptDictionaries || {
      main: { name: "メインリスト", prompts: [] },
    };

    const dictionaries = Object.keys(promptDictionaries);

    // 辞書が1つだけの場合は直接中身を表示
    if (dictionaries.length === 1) {
      const dictId = dictionaries[0];
      const dict = promptDictionaries[dictId];

      if (dict.prompts && dict.prompts.length > 0) {
        await createPromptMenuItems("LoadPrompt", dict.prompts);
      }
    } else {
      // 複数辞書がある場合は2段階メニュー
      for (let i = 0; i < dictionaries.length; i++) {
        const dictId = dictionaries[i];
        const dict = promptDictionaries[dictId];

        if (dict.prompts && dict.prompts.length > 0) {
          // 1段階目：辞書名のメニュー（シンプルなIDに変更）
          const sanitizedDictId = dictId.replace(/[^a-zA-Z0-9]/g, "");
          const dictMenuId = `dict_${sanitizedDictId}_${Date.now()}`;

          try {
            let menuCreated = false;
            await new Promise((resolve) => {
              chrome.contextMenus.create(
                {
                  parentId: "LoadPrompt",
                  id: dictMenuId,
                  title: (dict.name || dictId).substring(0, 30), // タイトル長制限
                  contexts: ["editable"],
                },
                () => {
                  if (!chrome.runtime.lastError) {
                    menuCreated = true;
                  }
                  resolve();
                }
              );
            });

            // メニューが正常に作成された場合のみ子メニューを作成
            if (menuCreated) {
              // 少し待機してから子メニューを作成
              await new Promise((resolve) => setTimeout(resolve, 50));

              // 2段階目：その辞書のプロンプト一覧
              await createPromptMenuItems(dictMenuId, dict.prompts);
            }
          } catch (error) {
            // エラーでも次の辞書の処理を続行
          }
        }
      }
    }
  } catch (error) {
    // メニュー作成エラー
  }
}

// プロンプトメニューアイテムを作成するヘルパー関数
async function createPromptMenuItems(parentId, prompts) {
  let count = 1;

  // 最大リトライ回数を制限
  const maxItems = Math.min(prompts.length, 20); // 最大20個まで

  for (let index = 0; index < maxItems; index++) {
    const item = prompts[index];

    // アイテムのバリデーション
    if (!item || (!item.title && !item.prompt)) {
      continue;
    }

    try {
      // シンプルな一意IDを使用
      const menuId = `prompt_${index}_${count}_${Date.now()}`;

      await new Promise((resolve) => {
        const menuTitle = `${count}: ${(item.title || "無題").substring(0, 50)}`;

        chrome.contextMenus.create(
          {
            parentId: parentId,
            id: menuId,
            title: menuTitle, // タイトル長制限
            contexts: ["editable"],
          },
          () => {
            if (!chrome.runtime.lastError) {
              // プロンプトテキストとIDの対応を保存
              promptTabele.push({
                id: menuId,
                prompt: item.prompt || "",
              });
            }
            // エラーでも成功でも続行
            resolve();
          }
        );
      });
      count++;

      // 連続作成の間隔を調整
      if (index % 5 === 4) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    } catch (error) {
      // エラーでも次のアイテムの処理を続行
    }
  }
}

// DOM操作処理
function handleDOMOperation(args) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    // セレクターベースの汎用的な処理
    const [service, method, value, positivePromptSelector, generateButtonSelector] = args;

    // セレクターが設定されているか確認
    if (!positivePromptSelector || !generateButtonSelector) {
      return;
    }

    // 汎用的なDOM操作関数
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: genericDOMOperation,
      args: [args],
    });
  });
}

function genericDOMOperation(args) {
  const [service, method, value, positivePromptSelector, generateButtonSelector] = args;

  switch (method) {
    case "Generate":
      const positivePromptText = document.querySelector(positivePromptSelector);
      const generateButton = document.querySelector(generateButtonSelector);

      if (positivePromptText && generateButton) {
        // Stable Diffusion WebUI用の改善された値設定
        if (positivePromptText.tagName === "TEXTAREA") {
          // 1. フォーカスを当てる
          positivePromptText.focus();

          // 2. 値を設定
          positivePromptText.value = value;

          // 3. 複数のイベントを発火
          positivePromptText.dispatchEvent(new Event("input", { bubbles: true }));
          positivePromptText.dispatchEvent(new Event("change", { bubbles: true }));

          // 4. React/Svelteアプリケーション用の追加処理
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
          ).set;
          nativeInputValueSetter.call(positivePromptText, value);

          const inputEvent = new Event("input", { bubbles: true });
          positivePromptText.dispatchEvent(inputEvent);
        } else {
          // その他の要素の場合
          positivePromptText.value = value;
          positivePromptText.innerHTML = value;
          const event = new Event("change", { bubbles: true });
          positivePromptText.dispatchEvent(event);
        }

        // 100～200msのランダムな遅延
        const randomDelay = Math.floor(Math.random() * 101) + 100;
        setTimeout(() => {
          generateButton.click();
        }, randomDelay);
      }
      break;
  }
}
// ショートカットキーのリスナーを修正
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case "_execute_action": // Alt+G でこれが呼ばれる
      // サイドパネルを開く
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        await chrome.sidePanel.open({ tabId: tabs[0].id });
      });
      break;
    case "save-prompt":
      // アクティブタブから選択テキストを取得
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        try {
          // コンテンツスクリプトを実行して選択テキストを取得
          const [result] = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString().trim(),
          });

          const selectedText = result.result;

          if (!selectedText) {
            // 選択テキストがない場合は、従来の動作（ストレージから取得）
            const { generatePrompt } = await chrome.storage.local.get("generatePrompt");
            if (generatePrompt) {
              await saveToArchive(generatePrompt, tabs[0].id);
            } else {
              sendNotificationToTab(tabs[0].id, "保存するテキストを選択してください", "warning");
            }
          } else {
            // 選択テキストを辞書に保存
            await saveToArchive(selectedText, tabs[0].id);
          }
        } catch (error) {
          sendNotificationToTab(tabs[0].id, "このページでは使用できません", "error");
        }
      });
      break;
  }
});

// プロンプト辞書に保存する関数
async function saveToArchive(text, tabId) {
  const { promptDictionaries, currentPromptDictionary } = await chrome.storage.local.get([
    "promptDictionaries",
    "currentPromptDictionary",
  ]);

  let dictionaries = promptDictionaries || {
    main: { name: "メインリスト", prompts: [] },
  };
  const currentDictId = currentPromptDictionary || "main";
  const currentDict = dictionaries[currentDictId];

  if (!currentDict || !currentDict.prompts) {
    currentDict.prompts = [];
  }

  // 重複チェック
  const isDuplicate = currentDict.prompts.some((item) => item.prompt === text);

  if (isDuplicate) {
    sendNotificationToTab(tabId, "このテキストは既に保存されています", "warning");
  } else {
    // 新規保存
    currentDict.prompts.push({
      title: "", // タイトルは後で編集可能
      prompt: text,
      sort: currentDict.prompts.length,
    });

    await chrome.storage.local.set({ promptDictionaries: dictionaries });

    // プロンプトリストを更新
    UpdatePromptList();

    sendNotificationToTab(tabId, "選択テキストを辞書に保存しました", "success");
  }
}

// タブに通知を送信する関数
function sendNotificationToTab(tabId, message, type) {
  chrome.tabs
    .sendMessage(tabId, {
      type: "showNotification",
      message: message,
      messageType: type,
    })
    .catch((error) => {
      // content-scriptが注入されていない場合は、簡易的なアラート
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (msg) => alert(msg),
        args: [message],
      });
    });
}

// コンテンツスクリプトを注入する関数
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["js/content.js"],
    });
  } catch (error) {
    // コンテンツスクリプト注入済みまたは注入不可
  }
}

// タブがアクティブになったときにコンテンツスクリプトを注入
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await injectContentScript(activeInfo.tabId);
});

// 拡張機能アイコンクリック時の動作も変更可能
chrome.action.onClicked.addListener(async (tab) => {
  // サイドパネルを開く
  await chrome.sidePanel.open({ tabId: tab.id });
});
