let promptTabele = [];
let isMenuInitialized = false;
let isInitializing = false; // 初期化中フラグを追加

// 安全な初期化を保証する関数
async function ensureMenuInitialized() {
  console.log("🔍 [INIT_DEBUG] ensureMenuInitialized called");
  console.log("🔍 [INIT_DEBUG] isMenuInitialized:", isMenuInitialized);
  console.log("🔍 [INIT_DEBUG] isInitializing:", isInitializing);
  
  // 既に初期化済みまたは初期化中の場合はスキップ
  if (isMenuInitialized || isInitializing) {
    console.log("🔍 [INIT_DEBUG] スキップ: 初期化済みまたは初期化中");
    return;
  }
  
  try {
    isInitializing = true;
    console.log("🔍 [INIT_DEBUG] 初期化開始");
    await createBaseMenuItems();
    console.log("🔍 [INIT_DEBUG] 初期化完了");
  } catch (error) {
    console.error("🔍 [INIT_DEBUG] 初期化エラー:", error);
    isInitializing = false; // エラー時はフラグをリセット
    throw error;
  }
}

// 初期化時にコンテキストメニューを作成
chrome.runtime.onInstalled.addListener(async () => {
  console.log("🔍 [INIT_DEBUG] onInstalled triggered");
  await ensureMenuInitialized();
});

// 拡張機能起動時にもメニューを作成（安全な遅延初期化）
(async () => {
  console.log("🔍 [INIT_DEBUG] 即時実行関数開始");
  // onInstalledの処理を待つ
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log("🔍 [INIT_DEBUG] 遅延後の初期化チェック");
  await ensureMenuInitialized();
})();

// ベースとなるメニュー項目を作成
async function createBaseMenuItems() {
  console.log("🔍 [INIT_DEBUG] createBaseMenuItems called");
  console.log("🔍 [INIT_DEBUG] isMenuInitialized:", isMenuInitialized);
  
  if (isMenuInitialized) {
    console.log("🔍 [INIT_DEBUG] Menu already initialized, skipping...");
    return;
  }
  
  try {
    console.log("🔍 [INIT_DEBUG] メニュー全削除開始");
    // 既存のメニューをすべてクリアする（Promise化）
    await new Promise((resolve) => {
      chrome.contextMenus.removeAll(() => {
        console.log("🔍 [INIT_DEBUG] メニュー全削除完了");
        resolve();
      });
    });

    // promptTabeleもクリア
    promptTabele = [];
    console.log("🔍 [INIT_DEBUG] promptTabeleクリア完了");

    console.log("🔍 [INIT_DEBUG] 親メニュー作成開始");
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
    console.log("🔍 [INIT_DEBUG] 親メニュー作成完了");

    // プロンプト記録先の辞書メニューを作成
    console.log("🔍 [INIT_DEBUG] 辞書メニュー作成開始");
    await createArchiveDestinationMenus();
    console.log("🔍 [INIT_DEBUG] 辞書メニュー作成完了");
    
    // 初期のアーカイブリストを作成
    console.log("🔍 [INIT_DEBUG] アーカイブリスト作成開始");
    await CreateArchiveList();
    console.log("🔍 [INIT_DEBUG] アーカイブリスト作成完了");
    
    isMenuInitialized = true;
    isInitializing = false; // 初期化完了フラグもリセット
    console.log("🔍 [INIT_DEBUG] createBaseMenuItems完了 - isMenuInitialized:", isMenuInitialized);
  } catch (error) {
    console.error("🔍 [INIT_DEBUG] createBaseMenuItemsエラー:", error);
    isInitializing = false; // エラー時はフラグをリセット
    throw error;
  }
}

// プロンプト記録先の辞書メニューを作成
async function createArchiveDestinationMenus() {
  try {
    const items = await chrome.storage.local.get(["promptDictionaries"]);
    const promptDictionaries = items.promptDictionaries || {
      main: { name: "メインリスト", prompts: [] }
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
      
      chrome.contextMenus.create({
        parentId: "PromptArchive",
        id: menuId,
        title: dict.name || dictId,
        contexts: ["selection"],
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error creating menu:", chrome.runtime.lastError);
        }
      });
    }
  } catch (error) {
    console.error("Error creating archive destination menus:", error);
  }
}

// コンテキストメニューのクリックイベント
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  console.log("Context menu clicked:", info.menuItemId);

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
      // プロンプトを挿入
      console.log("Inserting prompt:", info.menuItemId);
      console.log("Current promptTabele:", promptTabele);

      // IDからプロンプトテキストを取得
      const menuItem = promptTabele.find((item) => item.id === info.menuItemId);
      console.log("Found menu item:", menuItem);
      
      const promptText = menuItem ? menuItem.prompt : info.menuItemId;
      console.log("Prompt text to insert:", promptText);

      if (!menuItem) {
        console.error("Menu item not found for ID:", info.menuItemId);
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
          if (chrome.runtime.lastError) {
            console.log("Popup not available, inserting directly into page");
          } else {
            console.log("Popup response:", response);
          }
          
          // ポップアップが応答しない場合は、通常のページへの挿入を試みる
          if (!response || !response.success) {
            console.log("Inserting into page directly");
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: (text) => {
                console.log("Inserting text:", text);
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
  
  console.log("🔍 [DUPLICATE_DEBUG] === プロンプト登録開始 ===");
  console.log("🔍 [DUPLICATE_DEBUG] 選択テキスト:", selectedText);
  console.log("🔍 [DUPLICATE_DEBUG] 対象辞書ID:", targetDictId);
  
  // プロンプトの基本バリデーション
  if (!selectedText || selectedText.trim().length < 2) {
    console.log("🔍 [DUPLICATE_DEBUG] バリデーション失敗: テキストが短すぎる");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendNotificationToTab(
        tabs[0].id,
        "選択されたテキストが短すぎます（2文字以上必要）",
        "warning"
      );
    });
    return;
  }

  chrome.storage.local.get(["promptDictionaries", "currentPromptDictionary"], function (items) {
    let promptDictionaries = items.promptDictionaries || {
      main: { name: "メインリスト", prompts: [] }
    };
    
    console.log("🔍 [DUPLICATE_DEBUG] 読み込み辞書数:", Object.keys(promptDictionaries).length);
    console.log("🔍 [DUPLICATE_DEBUG] 辞書一覧:", Object.keys(promptDictionaries));
    console.log("🔍 [DUPLICATE_DEBUG] 現在の辞書ID:", items.currentPromptDictionary);
    
    // targetDictIdがnullの場合（辞書が1つだけの場合）は現在の辞書を使用
    const dictId = targetDictId || items.currentPromptDictionary || "main";
    const targetDict = promptDictionaries[dictId];
    
    console.log("🔍 [DUPLICATE_DEBUG] 決定された対象辞書ID:", dictId);
    console.log("🔍 [DUPLICATE_DEBUG] 対象辞書名:", targetDict?.name);
    console.log("🔍 [DUPLICATE_DEBUG] 対象辞書内プロンプト数:", targetDict?.prompts?.length || 0);
    
    if (!targetDict) {
      console.error(`🔍 [DUPLICATE_DEBUG] Dictionary not found: ${dictId}`);
      return;
    }
    
    if (!targetDict.prompts) {
      targetDict.prompts = [];
    }

    // 重複チェック（正規化して比較）
    const normalizedSelectedText = selectedText.trim().toLowerCase();
    console.log("🔍 [DUPLICATE_DEBUG] 正規化されたテキスト:", normalizedSelectedText);
    
    // 1. 対象辞書内での重複チェック
    console.log("🔍 [DUPLICATE_DEBUG] === 対象辞書内重複チェック ===");
    const matchedIndex = targetDict.prompts.findIndex(
      (obj) => obj.prompt && obj.prompt.trim().toLowerCase() === normalizedSelectedText
    );
    console.log("🔍 [DUPLICATE_DEBUG] 対象辞書内マッチ:", matchedIndex !== -1 ? `インデックス${matchedIndex}` : "なし");

    // 2. 全辞書にわたる重複チェック
    console.log("🔍 [DUPLICATE_DEBUG] === 全辞書横断重複チェック ===");
    let duplicateDict = null;
    for (const [checkDictId, checkDict] of Object.entries(promptDictionaries)) {
      if (checkDict.prompts) {
        console.log(`🔍 [DUPLICATE_DEBUG] チェック中辞書: ${checkDictId} (${checkDict.prompts.length}個)`);
        const found = checkDict.prompts.find(
          (obj) => obj.prompt && obj.prompt.trim().toLowerCase() === normalizedSelectedText
        );
        if (found) {
          duplicateDict = { id: checkDictId, name: checkDict.name || checkDictId };
          console.log(`🔍 [DUPLICATE_DEBUG] 重複発見: ${checkDictId} - "${found.prompt}"`);
          break;
        }
      }
    }
    console.log("🔍 [DUPLICATE_DEBUG] 全辞書重複結果:", duplicateDict ? `${duplicateDict.id}に存在` : "なし");

    if (matchedIndex !== -1 || duplicateDict) {
      // 既に存在する場合は通知を表示
      console.log("🔍 [DUPLICATE_DEBUG] === 重複検出 - 登録拒否 ===");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const duplicateLocation = duplicateDict ? duplicateDict.name : (targetDict.name || dictId);
        console.log("🔍 [DUPLICATE_DEBUG] 重複場所:", duplicateLocation);
        sendNotificationToTab(
          tabs[0].id,
          `このプロンプトは「${duplicateLocation}」に既に保存されています`,
          "warning"
        );
      });
    } else {
      // 新規追加（ポップアップなしで即座に保存）
      console.log("🔍 [DUPLICATE_DEBUG] === 新規登録実行 ===");
      const newPrompt = {
        title: "", // タイトルは後で編集可能
        prompt: selectedText,
        sort: targetDict.prompts.length,
      };
      
      console.log("🔍 [DUPLICATE_DEBUG] 新規プロンプト:", newPrompt);
      console.log("🔍 [DUPLICATE_DEBUG] 登録前のプロンプト数:", targetDict.prompts.length);
      
      targetDict.prompts.push(newPrompt);
      
      console.log("🔍 [DUPLICATE_DEBUG] 登録後のプロンプト数:", targetDict.prompts.length);
      console.log("🔍 [DUPLICATE_DEBUG] 辞書全体のプロンプト数:", Object.values(promptDictionaries).reduce((total, dict) => total + (dict.prompts?.length || 0), 0));

      chrome.storage.local.set({ promptDictionaries: promptDictionaries }, () => {
        console.log("🔍 [DUPLICATE_DEBUG] ストレージ保存完了");
        
        // プロンプトリストを更新
        UpdatePromptList();

        // 成功通知
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          sendNotificationToTab(
            tabs[0].id,
            `プロンプトを「${targetDict.name || dictId}」に保存しました`,
            "success"
          );
        });
      });
    }
    
    console.log("🔍 [DUPLICATE_DEBUG] === プロンプト登録処理完了 ===");
  });
}

// メッセージリスナー（一つに統合）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message.type);

  // promptResponse の処理を async/await で修正
  if (message.type === "promptResponse") {
    handlePromptResponse(message.text)
      .then(() => {
        console.log("Prompt response handled successfully");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error in promptResponse:", error);
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

// プロンプトリストの更新
// メニュー更新の競合を防ぐためのフラグ
let isUpdatingMenu = false;

async function UpdatePromptList() {
  console.log("🔍 [UPDATE_DEBUG] UpdatePromptList called");
  console.log("🔍 [UPDATE_DEBUG] isUpdatingMenu:", isUpdatingMenu);
  console.log("🔍 [UPDATE_DEBUG] isInitializing:", isInitializing);
  
  // 既に更新中または初期化中の場合はスキップ
  if (isUpdatingMenu || isInitializing) {
    console.log("🔍 [UPDATE_DEBUG] UpdatePromptList already in progress or initializing, skipping...");
    return;
  }
  
  try {
    isUpdatingMenu = true;
    console.log("🔍 [UPDATE_DEBUG] UpdatePromptList開始");
    
    // 全メニューを削除して最初から作り直す
    console.log("🔍 [UPDATE_DEBUG] メニュー全削除開始");
    await new Promise((resolve) => {
      chrome.contextMenus.removeAll(() => {
        console.log("🔍 [UPDATE_DEBUG] メニュー全削除完了");
        resolve();
      });
    });
    
    // promptTabeleもクリア
    promptTabele = [];
    console.log("🔍 [UPDATE_DEBUG] promptTabeleクリア完了");
    
    // 初期化フラグをリセット
    isMenuInitialized = false;
    isInitializing = false; // 初期化中フラグもリセット
    console.log("🔍 [UPDATE_DEBUG] フラグリセット完了");

    // ベースメニューから再作成
    console.log("🔍 [UPDATE_DEBUG] ベースメニュー再作成開始");
    await createBaseMenuItems();
    
    console.log("🔍 [UPDATE_DEBUG] Menus recreated with", promptTabele.length, "items");
  } catch (error) {
    console.error("🔍 [UPDATE_DEBUG] Error updating prompt list:", error);
  } finally {
    // 必ずフラグをリセット
    isUpdatingMenu = false;
    console.log("🔍 [UPDATE_DEBUG] UpdatePromptList完了 - isUpdatingMenu:", isUpdatingMenu);
  }
}

// プロンプト辞書からコンテキストメニューを作成（2段階メニュー対応）
async function CreateArchiveList() {
  try {
    console.log("🔍 [MENU_DEBUG] === メニュー作成開始 ===");
    const items = await chrome.storage.local.get(["promptDictionaries"]);
    const promptDictionaries = items.promptDictionaries || {
      main: { name: "メインリスト", prompts: [] }
    };

    const dictionaries = Object.keys(promptDictionaries);
    console.log("🔍 [MENU_DEBUG] 辞書数:", dictionaries.length);
    console.log("🔍 [MENU_DEBUG] 辞書一覧:", dictionaries);
    
    // 各辞書の詳細をログ出力
    for (const dictId of dictionaries) {
      const dict = promptDictionaries[dictId];
      console.log(`🔍 [MENU_DEBUG] 辞書[${dictId}]:`, {
        name: dict.name,
        promptCount: dict.prompts?.length || 0,
        hasPrompts: !!(dict.prompts && dict.prompts.length > 0)
      });
    }
    
    // 辞書が1つだけの場合は直接中身を表示
    if (dictionaries.length === 1) {
      console.log("🔍 [MENU_DEBUG] === 単一辞書モード ===");
      const dictId = dictionaries[0];
      const dict = promptDictionaries[dictId];
      
      console.log(`🔍 [MENU_DEBUG] 対象辞書: ${dictId} (${dict.name})`);
      console.log(`🔍 [MENU_DEBUG] プロンプト数: ${dict.prompts?.length || 0}`);
      
      if (dict.prompts && dict.prompts.length > 0) {
        console.log("🔍 [MENU_DEBUG] 直接プロンプトメニュー作成開始");
        await createPromptMenuItems("LoadPrompt", dict.prompts);
        console.log("🔍 [MENU_DEBUG] 直接プロンプトメニュー作成完了");
      } else {
        console.log("🔍 [MENU_DEBUG] プロンプトなし - メニュー作成スキップ");
      }
    } else {
      console.log("🔍 [MENU_DEBUG] === 複数辞書モード ===");
      console.log(`🔍 [MENU_DEBUG] 処理対象辞書数: ${dictionaries.length}`);
      
      // 複数辞書がある場合は2段階メニュー
      for (let i = 0; i < dictionaries.length; i++) {
        const dictId = dictionaries[i];
        const dict = promptDictionaries[dictId];
        
        console.log(`🔍 [MENU_DEBUG] [${i+1}/${dictionaries.length}] 処理中: ${dictId}`);
        console.log(`🔍 [MENU_DEBUG] 辞書名: ${dict.name || dictId}`);
        console.log(`🔍 [MENU_DEBUG] プロンプト数: ${dict.prompts?.length || 0}`);
        
        if (dict.prompts && dict.prompts.length > 0) {
          // 1段階目：辞書名のメニュー（シンプルなIDに変更）
          const sanitizedDictId = dictId.replace(/[^a-zA-Z0-9]/g, '');
          const dictMenuId = `dict_${sanitizedDictId}_${Date.now()}`;
          
          console.log(`🔍 [MENU_DEBUG] 辞書メニューID生成: ${dictMenuId}`);
          
          try {
            let menuCreated = false;
            await new Promise((resolve) => {
              console.log(`🔍 [MENU_DEBUG] 辞書メニュー作成開始: ${dictMenuId}`);
              chrome.contextMenus.create(
                {
                  parentId: "LoadPrompt",
                  id: dictMenuId,
                  title: (dict.name || dictId).substring(0, 30), // タイトル長制限
                  contexts: ["editable"],
                },
                () => {
                  if (chrome.runtime.lastError) {
                    console.warn(`🔍 [MENU_DEBUG] 辞書メニュー作成失敗 ${dictId}:`, chrome.runtime.lastError.message);
                  } else {
                    console.log(`🔍 [MENU_DEBUG] 辞書メニュー作成成功: ${dictMenuId}`);
                    menuCreated = true;
                  }
                  resolve();
                }
              );
            });
            
            // メニューが正常に作成された場合のみ子メニューを作成
            if (menuCreated) {
              console.log(`🔍 [MENU_DEBUG] 子メニュー作成待機中: ${dictMenuId}`);
              // 少し待機してから子メニューを作成
              await new Promise(resolve => setTimeout(resolve, 50));
              
              // 2段階目：その辞書のプロンプト一覧
              console.log(`🔍 [MENU_DEBUG] 子メニュー作成開始: ${dictMenuId}`);
              await createPromptMenuItems(dictMenuId, dict.prompts);
              console.log(`🔍 [MENU_DEBUG] 子メニュー作成完了: ${dictMenuId}`);
            } else {
              console.log(`🔍 [MENU_DEBUG] 辞書メニュー作成失敗のため子メニュースキップ: ${dictId}`);
            }
          } catch (error) {
            console.warn(`🔍 [MENU_DEBUG] 辞書処理エラー ${dictId}:`, error.message);
            // エラーでも次の辞書の処理を続行
          }
        } else {
          console.log(`🔍 [MENU_DEBUG] プロンプトなし - 辞書スキップ: ${dictId}`);
        }
      }
    }
    
    console.log("🔍 [MENU_DEBUG] === メニュー作成完了 ===");
  } catch (error) {
    console.error("Error creating archive list:", error);
  }
}

// プロンプトメニューアイテムを作成するヘルパー関数
async function createPromptMenuItems(parentId, prompts) {
  console.log(`🔍 [MENU_DEBUG] === プロンプトメニュー作成開始 (親ID: ${parentId}) ===`);
  console.log(`🔍 [MENU_DEBUG] 対象プロンプト数: ${prompts.length}`);
  
  let count = 1;
  
  // 最大リトライ回数を制限
  const maxItems = Math.min(prompts.length, 20); // 最大20個まで
  console.log(`🔍 [MENU_DEBUG] 作成予定メニュー数: ${maxItems}`)
  
  for (let index = 0; index < maxItems; index++) {
    const item = prompts[index];
    
    console.log(`🔍 [MENU_DEBUG] [${index+1}/${maxItems}] メニュー項目処理中:`, {
      title: item?.title || "無題",
      promptLength: item?.prompt?.length || 0,
      hasTitle: !!(item?.title),
      hasPrompt: !!(item?.prompt)
    });
    
    // アイテムのバリデーション
    if (!item || (!item.title && !item.prompt)) {
      console.warn(`🔍 [MENU_DEBUG] 無効なメニュー項目 at index ${index}:`, item);
      continue;
    }
    
    try {
      // シンプルな一意IDを使用
      const menuId = `prompt_${index}_${count}_${Date.now()}`;
      console.log(`🔍 [MENU_DEBUG] メニューID生成: ${menuId}`);
      
      await new Promise((resolve) => {
        const menuTitle = `${count}: ${(item.title || "無題").substring(0, 50)}`;
        console.log(`🔍 [MENU_DEBUG] メニュー作成試行: ${menuId} - "${menuTitle}"`);
        
        chrome.contextMenus.create(
          {
            parentId: parentId,
            id: menuId,
            title: menuTitle, // タイトル長制限
            contexts: ["editable"],
          },
          () => {
            if (chrome.runtime.lastError) {
              console.warn(`🔍 [MENU_DEBUG] メニュー作成失敗 ${count}:`, chrome.runtime.lastError.message);
            } else {
              console.log(`🔍 [MENU_DEBUG] メニュー作成成功: ${menuId}`);
              // プロンプトテキストとIDの対応を保存
              promptTabele.push({
                id: menuId,
                prompt: item.prompt || "",
              });
              console.log(`🔍 [MENU_DEBUG] promptTabele追加 (現在${promptTabele.length}件)`);
            }
            // エラーでも成功でも続行
            resolve();
          }
        );
      });
      count++;
      
      // 連続作成の間隔を調整
      if (index % 5 === 4) {
        console.log(`🔍 [MENU_DEBUG] 5件ごとの待機中 (${index+1}件完了)`);
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    } catch (error) {
      console.warn(`🔍 [MENU_DEBUG] メニュー項目処理エラー ${index}:`, error.message);
      // エラーでも次のアイテムの処理を続行
    }
  }
  
  console.log(`🔍 [MENU_DEBUG] === プロンプトメニュー作成完了 (親ID: ${parentId}) ===`);
  console.log(`🔍 [MENU_DEBUG] 最終promptTabele件数: ${promptTabele.length}`);
}

// DOM操作処理
function handleDOMOperation(args) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    console.log("DOM operation on:", tab.url);

    // セレクターベースの汎用的な処理
    const [
      service,
      method,
      value,
      positivePromptSelector,
      generateButtonSelector,
    ] = args;

    // セレクターが設定されているか確認
    if (!positivePromptSelector || !generateButtonSelector) {
      console.error("Selectors not configured");
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
  console.log("Generic DOM operation", args);

  const [
    service,
    method,
    value,
    positivePromptSelector,
    generateButtonSelector,
  ] = args;

  switch (method) {
    case "Generate":
      const positivePromptText = document.querySelector(positivePromptSelector);
      const generateButton = document.querySelector(generateButtonSelector);

      if (positivePromptText && generateButton) {
        console.log("Setting prompt to:", value);
        console.log("Element type:", positivePromptText.tagName);

        // Stable Diffusion WebUI用の改善された値設定
        if (positivePromptText.tagName === "TEXTAREA") {
          // 1. フォーカスを当てる
          positivePromptText.focus();

          // 2. 値を設定
          positivePromptText.value = value;

          // 3. 複数のイベントを発火
          positivePromptText.dispatchEvent(
            new Event("input", { bubbles: true })
          );
          positivePromptText.dispatchEvent(
            new Event("change", { bubbles: true })
          );

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
        console.log(`Waiting ${randomDelay}ms before clicking generate...`);

        setTimeout(() => {
          generateButton.click();
        }, randomDelay);
      } else {
        console.error("Elements not found:", {
          prompt: !!positivePromptText,
          button: !!generateButton,
          promptSelector: positivePromptSelector,
          buttonSelector: generateButtonSelector,
        });
      }
      break;
  }
}
// ショートカットキーのリスナーを修正
chrome.commands.onCommand.addListener(async (command) => {
  console.log("Command received:", command);

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
            const { generatePrompt } = await chrome.storage.local.get(
              "generatePrompt"
            );
            if (generatePrompt) {
              await saveToArchive(generatePrompt, tabs[0].id);
            } else {
              sendNotificationToTab(
                tabs[0].id,
                "保存するテキストを選択してください",
                "warning"
              );
            }
          } else {
            // 選択テキストを辞書に保存
            await saveToArchive(selectedText, tabs[0].id);
          }
        } catch (error) {
          console.error("Failed to get selection:", error);
          sendNotificationToTab(
            tabs[0].id,
            "このページでは使用できません",
            "error"
          );
        }
      });
      break;
  }
});

// プロンプト辞書に保存する関数
async function saveToArchive(text, tabId) {
  const { promptDictionaries, currentPromptDictionary } = await chrome.storage.local.get([
    "promptDictionaries", 
    "currentPromptDictionary"
  ]);
  
  let dictionaries = promptDictionaries || {
    main: { name: "メインリスト", prompts: [] }
  };
  const currentDictId = currentPromptDictionary || "main";
  const currentDict = dictionaries[currentDictId];
  
  if (!currentDict || !currentDict.prompts) {
    currentDict.prompts = [];
  }

  // 重複チェック
  const isDuplicate = currentDict.prompts.some((item) => item.prompt === text);

  if (isDuplicate) {
    sendNotificationToTab(
      tabId,
      "このテキストは既に保存されています",
      "warning"
    );
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
    console.log("Content script already injected or not injectable");
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
