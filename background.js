// background.js

let promptTabele = []
chrome.contextMenus.create({
    id: "PromptArchive",
    title: "プロンプトを記録する",
    contexts: ["selection"],
});

chrome.contextMenus.create({
    id: "LoadPrompt",
    title: "記録済みプロンプト",
    contexts: ["editable"]
});

CreateArchiveList();

function UpdatePromptList(){
    promptTabele.forEach(element => {
        chrome.contextMenus.remove(element, function() {});
    })
    promptTabele = []
    CreateArchiveList();
}

function CreateArchiveList(){
    chrome.storage.local.get(["archivesList"], function(items) {
        if (items.archivesList) {
            let count = 1
            items.archivesList.forEach(item=>{
                if(promptTabele.includes(item.prompt)){
                    return   
                }
                let context = chrome.contextMenus.create({
                    parentId: "LoadPrompt",
                    id: item.prompt,
                    title: count.toString()+":"+item.title,
                    contexts: ["all"],
                });
                promptTabele.push(context)
                count++
            })
        }
    });
}

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    console.log(info);
    switch (info.menuItemId) {
        case "LoadPrompt":
            // 読み込みプロンプトの親なだけなので特に処理はしない
            break
        case "PromptArchive":
            let archivesList = [];
            const selectedText = info.selectionText;

            chrome.storage.local.get(["archivesList"], function(items) {
                if (items.archivesList) {
                    archivesList = items.archivesList;
                }
                const matchedIndex = archivesList.findIndex(obj => obj.prompt === selectedText);
            
                if (matchedIndex !== -1) {
                    chrome.windows.create({
                        url: "error.html",
                        type: "popup",
                        width: 300,
                        height: 50,
                    });
                }else{
                    chrome.windows.create({
                        url: "prompt.html",
                        type: "popup",
                        width: 300,
                        height: 50,
                    }, (popupWindow) => {
                            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                            if (message.type === "promptResponse" && message.text) {
                                let pushData = {title: message.text, prompt: selectedText};
                                if (items.archivesList) {
                                    archivesList.push(pushData);
                                } else {
                                    archivesList = [pushData];
                                }                            
                                chrome.storage.local.set({archivesList: archivesList}, function() {
                                    UpdatePromptList()
                                });
                            }
                        });
                    });
                }
            });
            break
        default:
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: (text) => {
                document.execCommand("insertText", false, text);
              },
              args: [info.menuItemId],
            });
            break;
    }
  }
);

// 拡張機能からの呼び出し
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log(request.args);
    switch(request.args[0]){
        case "UpdatePromptList":
            UpdatePromptList()
            break;
        default:
            break;
    }
    sendResponse({ text: "バックグラウンド処理の終了" });
});