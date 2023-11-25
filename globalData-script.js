const toolVersion = 1
let localPromptList = []
let archivesList = []
let masterPrompts = []
let optionData = {}
let toolInfo = {}
let searchCategory = {}

// データ保存
function savePrompt() {
    console.log(editPrompt.prompt)
    chrome.storage.local.set({ 'generatePrompt': editPrompt.prompt });
}

function loadPrompt() {
  chrome.storage.local.get(["generatePrompt"], function (items) {
    if (items.generatePrompt != null)
      console.log(items.generatePrompt)
      InitGenaretePrompt(items.generatePrompt)
  });
}

function saveCategory() {
  chrome.storage.local.set({ 'searchCategory': searchCategory });
  console.log(searchCategory)
}

function loadCategory() {
chrome.storage.local.get(["searchCategory"], function (items) {
  if (items.searchCategory != null)
    searchCategory = items.searchCategory
    setSeachCategory()
  });
}

function saveMasterPrompt() {
  chrome.storage.local.set({ 'masterPrompts': masterPrompts });
}

function loadMasterPrompt() {
  chrome.storage.local.get(["masterPrompts"], function (items) {
    if (items.masterPrompts != null)
      masterPrompts = items.masterPrompts
  });
}

function saveToolInfo() {
  chrome.storage.local.set({ 'toolInfo': toolInfo });
}

function loadToolInfo() {
  chrome.storage.local.get(["toolInfo"], function (items) {
    if (items.toolInfo != null)
      toolInfo = items.toolInfo
    loadMessage()
  });
}

function saveLocalList() {
  chrome.storage.local.set({ 'localPromptList': localPromptList });
  categoryData.update()
}

function loadLocalList() {
  chrome.storage.local.get(["localPromptList"], function (items) {
    if (items.localPromptList != null)
      localPromptList = items.localPromptList;  // value1
  });
}

function loadArchivesList() {
  chrome.storage.local.get(["archivesList"], function (items) {
    if (items.archivesList != null)
      archivesList = items.archivesList;  // value1
  });
}

function saveArchivesList() {
  chrome.storage.local.set({ 'archivesList': archivesList }, () => {
    UpdatePromptList();
  });
}

function saveOptionData() {
  chrome.storage.local.set({ 'optionData': optionData });
}

function loadOptionData() {
  chrome.storage.local.get(["optionData"], function (items) {
    if (items.optionData) {
      optionData = items.optionData;  // value1
      $('#isDeleteCheck').prop('checked', optionData.isDeleteCheck);
      $('#DeeplAuth').val(optionData.deeplAuthKey)
    } else {
      optionData = {
        shaping: "SD"
        , editType: "SELECT"
        , isDeleteCheck: true
        , optionData: ""
      }
    }
    console.log(optionData)

    const uiTypeButtons = $('[name="UIType"]');

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var currentUrl = tabs[0].url;
      if(currentUrl == "http://127.0.0.1:7860/"){
        optionData.shaping = "SD"
        editPrompt.generate()
        UpdateGenaretePrompt()
      }else if(currentUrl == "https://novelai.net/image"){
        optionData.shaping = "NAI"
        editPrompt.generate()
        UpdateGenaretePrompt()
      }
      console.log(currentUrl);

      switch (optionData.shaping) {
        case "SD":
          uiTypeButtons.eq(0).prop('checked', true);
          break;
        case "NAI":
          uiTypeButtons.eq(1).prop('checked', true);
          break;
        case "None":
          uiTypeButtons.eq(2).prop('checked', true);
          break;
      }
    });
    
    const editTypeButtons = $('[name="EditType"]');
    switch (optionData.editType) {
      case "SELECT":
        editTypeButtons.eq(0).prop('checked', true);
        break;
      case "TEXT":
        editTypeButtons.eq(1).prop('checked', true);
        break;
    }
  });
}

function addLocalList() {
  chrome.storage.local.set({ 'localPromptList': localPromptList });
}

function addArchivesList() {
  chrome.storage.local.set({ 'archivesList': archivesList });
}

function jsonDownload(json, fileName) {
  let outJson = {}
  outJson.dicType = fileName;
  outJson.data = json;

  const jsonString = JSON.stringify(outJson);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = fileName + '.json';
  link.click();
}

function UpdatePromptList() {
  sendBackground("UpdatePromptList", null);
}

function sendBackground(execType, value) {
  chrome.runtime.sendMessage({ args: [execType, value] }, function (response) {
    console.log(response.text);
  });
}

function Regist(big, middle, small, prompt, url) {
  const inputData = prompt + big + middle + small;
  const isDuplicate = localPromptList.some(item => {
    const itemData = item.prompt + item.data[0] + item.data[1] + item.data[2];
    return inputData === itemData;
  });

  if (isDuplicate) {
    window.alert("既に同じ要素が追加されています。");
    return
  }

  if (url) {
    localPromptList.push({ "prompt": prompt, "data": { 0: big, 1: middle, 2: small }, "url": url })
  } else {
    localPromptList.push({ "prompt": prompt, "data": { 0: big, 1: middle, 2: small } })
  }
  saveLocalList()
  RegistAPI(big, middle, small, prompt)
}

function RegistDic(item) {
  const inputData = item.prompt + item.data[0] + item.data[1] + item.data[2];
  const isDuplicate = localPromptList.some(listItem => {
    const listItemData = listItem.prompt + listItem.data[0] + listItem.data[1] + listItem.data[2];
    return inputData === listItemData;
  });

  if (!isDuplicate) {
    const newItem = { "prompt": item.prompt, "data": item.data };
    if (item.url) {
      newItem.url = item.url;
    }
    localPromptList.push(newItem);
    saveLocalList();
    return true
  } else {
    return false
  }
}

function Search(search, data) {
  let searchResults = [];
  let prompts = localPromptList.concat(masterPrompts);
  if (data[0] !== "") {
    data.filter(value => value !== null).forEach((value, index) => {
      prompts = prompts.filter(item => item.data[index] === value)
    })
  }
  searchResults = prompts.filter(item => (item.data[0] + item.data[1] + item.data[2] + item.prompt).includes(search))
  return searchResults;
}

function getLocalElementIndex(searchItem) {
  const searchData = searchItem.prompt + searchItem.data[0] + searchItem.data[1] + searchItem.data[2];

  for (let i = 0; i < localPromptList.length; i++) {
    const item = localPromptList[i];
    const eachData = item.prompt + item.data[0] + item.data[1] + item.data[2];
    if (searchData == eachData) {
      return i;
    }
  }
  return -1;
}
