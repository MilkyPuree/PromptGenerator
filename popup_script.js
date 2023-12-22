const generateInput = $("#generatePrompt");
let mouseCursorValue = ""

// 初期化
init()

function init() {
  loadMasterPrompt()
  loadPrompt()
  categoryData.init()
  loadToolInfo()
  loadOptionData()
  // イベントの登録
  const tabs = $('.tab');
  tabs.on('click', tabSwitch);
  $('#editTab').on('click', () => {
    InitGenaretePrompt(generateInput.val())
    editInit()
  });
  $('#promptDicText').click(() => promptDicOpen());
  $('#elementDicText').click(() => elementDicOpen());
  $('#masterDicText').click(() => masterDicOpen());
  $('#search-cat0').on('change', function () {
    setChiledCategoryList("#search-cat1", 1, $(this).val())
    elementSearch()
  });

  $('#search-cat1').on('change', function () {
    elementSearch()
  });

  $("#search-cat-reset").click(() => {
    for (let i = 0; i < 2; i++) {
      $("#search-cat" + i).val("");
      if (i > 0) {
        $("#search-cat" + i).prop('disabled', true);
      }
    }
    if ($("#search").val()) {
      elementSearch()
    }
    searchCategory = [,]
    saveCategory()
  })

  const showPanelButton = document.getElementById('show-panel');
  const panel = document.getElementById('optionPanel');

  showPanelButton.addEventListener('click', () => {
    panel.classList.toggle('active');
  });

  var incluedZone = $('#inclued');
  incluedZone.on('dragover', handleDragOver);
  incluedZone.on('drop', handleEvent);
  incluedZone.click(function () {
    const input = $('<input type="file" style="display:none;">');
    $('body').append(input);
    input.click();
    input.on('change', handleEvent);
  });

  $("#isDeleteCheck").on('change', function () {
    const isChecked = $(this).prop('checked');
    optionData.isDeleteCheck = isChecked;
    saveOptionData()
  });

  $("input[name='UIType']").on('change', onChengeUIType);
  $("input[name='EditType']").on('change', onChengeEditType);
  $("#saveButton").on('click', archivesPrompt);
  $("#popup-image").on('click', closePopup);
  $("#resetButton").on('click', () => chrome.storage.local.clear());
  $("#localDicDownload").on('click', () => jsonDownload(localPromptList, "Elements"));
  $("#PromptDownload").on('click', () => jsonDownload(archivesList, "Prompts"));
  $("#MasterDownload").on('click', () => jsonDownload(masterPrompts, "Elements"));
  $("#copyButton").on('click', function () {
    let temp = editPrompt.prompt
    editPrompt.init(value)
    navigator.clipboard.writeText(editPrompt.prompt)
    editPrompt.init(temp)
  });

  $("#clearButton").on('click', function () {
    editPrompt.prompt = ""
    generateInput.val("");
    savePrompt();
  });

  $("#GeneratoButton").on('click', () => {
    Generate();
  });
  
  $("#resist").on('click', () => {
    const big = $("#big").val();
    const middle = $("#middle").val();
    const small = $("#small").val();
    const prompt = $("#prompt").val();
    Regist(big, middle, small, prompt);
    addInit()
  });

  $("#big").attr("list", "category");
  $("#big").on('change', function () {
    $("#middle").attr("list", "category" + $("#big").val())
  });

  inputClear($("#big"))
  inputClear($("#middle"))

  $("#addPromptList").sortable({
    revert: true,
    update: function (event, ui) {
      let baseIndex = 0;
      $('#addPromptList').sortable("toArray").forEach(function (index) {
        if (!index) {
          return
        }
        localPromptList[index].sort = baseIndex
        baseIndex++
      });
      saveLocalList();
    }
  });

  $("#editList").sortable({
    revert: true,
    update: function (event, ui) {
      let baseIndex = 0;
      $('#editList').sortable("toArray").forEach(function (index) {
        if (!index) {
          return
        }
        editPrompt.elements[index].sort = baseIndex
        baseIndex++
      });
      editPrompt.generate()
      UpdateGenaretePrompt()
    }
  });

  $('#DeeplAuth').on('change', function () {
    optionData.deeplAuthKey = $(this).val();
    saveOptionData()
  });

  generateInput.on("input", function () {
    editPrompt.init(generateInput.val())
    if (currentTab == 3) {
      editInit()
    }
  });

  generateInput.on("change", function () {
    editPrompt.init(generateInput.val())
    if (currentTab == 3) {
      editInit()
    }
  });

  generateInput.on("paste", function (e) {
    var pasted = undefined;
    if (window.clipboardData && window.clipboardData.getData) {
      pasted = window.clipboardData.getData('Text');
    } else if (e.originalEvent.clipboardData && e.originalEvent.clipboardData.getData) {
      pasted = e.originalEvent.clipboardData.getData('text/plain');
    }
    editPrompt.init(pasted)
    UpdateGenaretePrompt()
    if (currentTab == 3) {
      editInit()
    }
  });

  const elmSearch = $("#search");
  $("#searchButton").on('click', () => {
    elementSearch();
  });

  elmSearch.on('keypress', (e) => {
    const keyCodeReturn = 13;
    if (e.keyCode === keyCodeReturn) {
      elementSearch();
    }
  });

  // 読み込み
  loadLocalList()
  loadArchivesList()
  loadCategory()
}

function sendBackground(survice,execType,value){
  chrome.runtime.sendMessage(
    { args: [survice,execType,value] },
    function (response) {
      console.log(response.text); 
    }
  );
}


function Generate(){
  sendBackground("DOM","Generate",generatePrompt.value);
}


function setSeachCategory(){
  let isSearch = false
  if(searchCategory[0]){
    $('#search-cat0').val(searchCategory[0])
    setChiledCategoryList("#search-cat1", 1, searchCategory[0])
    isSearch = true
  }
  if(searchCategory[1]){
    $('#search-cat1').val(searchCategory[1])
  }

  if(isSearch){
    elementSearch()
  }
}

function setCategoryList(id, category) {
  $(id + " option").remove()
  categoryData.data[category].forEach((item) => {
    $(id).append($('<option>', {
      value: item.value,
      text: item.value
    }));
  })
  $(id).prop('disabled', false);
  $(id).val("")
}

function setChiledCategoryList(id, category, parent) {
  $(id + " option").remove()
  categoryData.data[category].forEach((item) => {
    if (item.parent === parent) {
      $(id).append($('<option>', {
        value: item.value,
        text: item.value
      }));
    }
  })
  $(id).prop('disabled', false);
  $(id).val("")
}

let isSearch = false
let isSearchGoogle = false
let isSearchDeepl = false
function elementSearch() {
  if (isSearch) {
    return
  }
  const keyword = $("#search").val()
  const data = [$('#search-cat0').val(), $('#search-cat1').val()]
  searchCategory = data
  saveCategory()
  isSearch = true
  resetHtmlList("#promptList");
  const resultList = Search(keyword, data);
  const isHit = Object.keys(resultList).length > 0
  if (isHit) {
    isSearch = false
    createSearchList(resultList, "#promptList");
  } else {
    if (keyword === "") {
      $("#isSearch").html("何も見つかりませんでした");
      isSearch = false
    } else {
      SearchLogAPI(keyword)
      $("#isSearch").html("辞書内に存在しないため翻訳中");
      isSearchGoogle = true
      translateGoogle(keyword, (prompt) => {
        isSearchGoogle = false
        let data = { "prompt": prompt, "data": { 0: "", 1: "Google翻訳", 2: keyword } }
        const isAlphanumeric = /^[a-zA-Z0-9\s:]+$/.test(keyword);
        if (isAlphanumeric) {
          data = { "prompt": keyword, "data": { 0: "", 1: "Google翻訳", 2: prompt } }
        }
        resultList.push(data)
        isSearch = isSearchGoogle || isSearchDeepl
        if (!isSearch) {
          $("#isSearch").html("");
          createSearchList(resultList, "#promptList", true);
        }
      })

      if (optionData.deeplAuthKey) {
        isSearchDeepl = true
        translateDeepl(keyword, (prompt) => {
          isSearchDeepl = false
          let data = { "prompt": prompt, "data": { 0: "", 1: "Deepl翻訳", 2: keyword } }
          const isAlphanumeric = /^[a-zA-Z0-9\s:]+$/.test(keyword);
          if (isAlphanumeric) {
            data = { "prompt": keyword, "data": { 0: "", 1: "Deepl翻訳", 2: prompt } }
          }
          resultList.push(data)
          isSearch = isSearchGoogle || isSearchDeepl
          if (!isSearch) {
            $("#isSearch").html("");
            createSearchList(resultList, "#promptList", true);
          }
        })
      }
    }
  }
}

function onChengeUIType(event) {
  const selectedValue = event.target.value;
  optionData.shaping = selectedValue
  InitGenaretePrompt(generateInput.val())
  editInit()
  saveOptionData()
}

function onChengeEditType(event) {
  const selectedValue = event.target.value;
  optionData.editType = selectedValue
  saveOptionData()
  editInit()
}

// データ操作
function InitGenaretePrompt(str) {
  editPrompt.init(str)
  generateInput.val(editPrompt.prompt);  // value1
}

function UpdateGenaretePrompt() {
  generateInput.val(editPrompt.prompt)
  savePrompt()
}

function editInit() {
  resetHtmlList("#editList")
  if (optionData.editType == "SELECT") {
    createEditDropdownList(editPrompt.elements, "#editList")
  } else {
    createEditList(editPrompt.elements, "#editList")
  }
}

function archivesInit() {
  resetHtmlList("#archiveList")
  createArchiveList(archivesList, "#archiveList")
}

function addInit() {
  resetHtmlList("#addPromptList")
  createAddList(localPromptList, "#addPromptList");
}

function elementDicOpen() {
  if ($('#addPromptList').children().length > 0) {
    resetHtmlList("#addPromptList")
    $('#elementDicText').text("▶要素辞書(ローカル)　※ここをクリックで開閉")
  } else {
    localPromptList = localPromptList.sort(function (a, b) {
      return a.sort - b.sort;
    });
    resetHtmlList("#addPromptList")
    createAddList(localPromptList, "#addPromptList");
    $('#elementDicText').text("▼要素辞書(ローカル)　※ここをクリックで開閉")
  }
}

function masterDicOpen() {
  if ($('#masterDicList').children().length > 0) {
    resetHtmlList("#masterDicList")
    $('#masterDicText').text("▶要素辞書(マスタ)　※ここをクリックで開閉")
  } else {
    resetHtmlList("#masterDicList")
    createAddList(masterPrompts, "#masterDicList");
    $('#masterDicText').text("▼要素辞書(マスタ)　※ここをクリックで開閉")
  }
}

function promptDicOpen() {
  if ($('#archiveList').children().length > 0) {
    resetHtmlList("#archiveList")
    $('#promptDicText').text("▶プロンプト辞書　※ここをクリックで開閉")
  } else {
    resetHtmlList("#archiveList")
    createArchiveList(archivesList, "#archiveList")
    $('#promptDicText').text("▼プロンプト辞書　※ここをクリックで開閉")
  }
}

function archivesPrompt() {
  const archivePrompt = generateInput.val()
  const matchedIndex = archivesList.findIndex(obj => obj.prompt === archivePrompt);

  if (matchedIndex !== -1) {
    window.alert("既に同じプロンプトが追加されています。名前：" + archivesList[matchedIndex].title);
  } else {
    archivesList.push({ title: "", prompt: archivePrompt })
    saveArchivesList()
    archivesInit()
  }
}

function createDragableIcon(index, value) {
  let data = document.createTextNode(value);
  data.value = index;
  // data.
  return data;
}

function createHeaderData(value) {
  let data = $('<input>');
  data.attr('type', 'text');
  data.val(value);
  data.prop('readonly', true);
  data.addClass('promptData');
  data.css({
    backgroundColor: 'black',
    color: 'white'
  });
  return data;

}

function createInputData(value, index, event, blurEvent) {
  let data = $('<input>');
  data.attr('type', 'text');
  data.val(value);
  data.addClass('promptData');

  if (event) {
    data.on('input', () => event(data.val(), index));
  }

  if(blurEvent){
    data.blur(function() {
      blurEvent()
    });
  }

  return data;
}

function createMoveElementButton(index, title, value) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = title;
  button.onclick = () => {
    editPrompt.moveElement(index, value)
    UpdateGenaretePrompt()
    editInit()
  };
  return button;
}

function createRegistButton(inputData, prompt) {
  let button = $('<button>');
  button.attr('type', 'submit');
  button.html('N');
  inputData[0].attr("list", "category")
  inputData[0].on('change', function () {
    inputData[1].attr("list", "category" + inputData[0].val())
  });
  button.on('click', function () {
    $(this).removeAttr("autocomplete");
    Regist(inputData[0].val(), inputData[1].val(), inputData[2].val(), prompt);
    $(this).remove()
    addInit();
  });
  inputClear(inputData[0])
  inputClear(inputData[1])
  return button;
}

function createAddButton(name, value) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = "Set";
  button.onclick = () => {
  editPrompt.init(generateInput.val() + value)
  generateInput.val(editPrompt.prompt);
  savePrompt();
  };
  return button;
}

function createCopyButton(value) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = "Copy";
  button.onclick = () => {
    let temp = editPrompt.prompt
    editPrompt.init(value)
    navigator.clipboard.writeText(editPrompt.prompt)
    editPrompt.init(temp)
  };

  return button;
}

function getIconImage(iconName, alt) {
  let img = document.createElement('img');
  img.src = "icon/" + iconName;
  img.alt = alt;
  img.width = 10;
  img.height = 10;
  return img;
}

function createOpenImageButton(value) {
  let button = $('<button type="submit">P</button>');
  button.on('click', function () {
    previewPromptImage(value);
  });
  return button;
}

function previewPromptImage(value) {
  const imageUrl = "https://ul.h3z.jp/" + value.url + ".jpg";
  fetch(imageUrl)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const arrayBuffer = reader.result;
        var binary = atob(arrayBuffer.split(',')[1]);
        $('#popup-image').attr({
          src: "data:image/png;base64," + binary,
          width: '256',
          height: '256'
        });
        $(`#preview-element`).text(`${value.data[0]}:${value.data[1]}:${value.data[2]}`);
        $("#preview-prompt").val(value.prompt)
        $("#preview-positive-copy").click(() => navigator.clipboard.writeText(value.prompt));
        $("#preview-negative-copy").click(() => navigator.clipboard.writeText("disfigured.bad anatomy disfigured,jpeg artifacts,error,gross,shit,bad,bad proportions,bad shadow,bad anatomy disfigured,bad shoes,bad gloves,bad animal ears,anatomical nonsense,watermark,five fingers,worst quality,bad anatomy,ugly,cropped,simple background,normal quality,lowers,low quality,polar lowres,standard quality,poorly drawn hands,boken limb,missing limbs,malformed limbs,incorrect limb,fusion hand,bad finglegs,abnormal fingers,missing fingers,fewer digits,too many fingers,extra digit,lose finger,extra fingers,one hand with more than 5 digit,one hand with less than 5 digit,one hand with more than 5 fingers,one hand with less than 5 fingers,3d character,qr code,ui,artist name,signature,text error,text font ui,bar code,username,bad digit,liquid digit,missing digit,fewer digits,multiple digit,text,fused digit,extra digt,extra digits,extra digit,nsfw"));
        $('#popup').css({ "display": "flex" })
        $('#popup').show();
      };
      reader.readAsDataURL(blob);
    });
}

function Base64Png(file) {
  var reader = new FileReader();
  reader.onload = function (event) {
    var arrayBuffer = event.target.result;// base64テキスト
    var binary = atob(arrayBuffer.split(',')[1]);
    var url = "data:image/png;base64," + binary;
    createPngPreview(url)
  };
  reader.readAsDataURL(file);
}

function closePopup() {
  $('#popup').hide();
}

function createRemoveButton(item, li) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = "X";
  button.onclick = () => {
    if (!optionData.isDeleteCheck) {
      localPromptList.splice(getLocalElementIndex(item), 1)
      saveLocalList()
      li.remove();
    }
    else {
      const result = window.confirm("本当に削除しますか？");
      if (result) {
        localPromptList.splice(getLocalElementIndex(item), 1)
        saveLocalList()
        li.remove();
      }
    }
  };
  return button;
}

function createLoadButton(value) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = "↑";
  button.onclick = () => {
    editPrompt.init(value)
    UpdateGenaretePrompt()
    savePrompt()
  };
  return button;
}

function createDeleteButton(index) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = "X";
  button.onclick = () => {
    if (!optionData.isDeleteCheck) {
      archivesList.splice(index, 1)
      saveArchivesList()
      archivesInit()
    } else {
      const result = window.confirm("本当に削除しますか？");
      if (result) {
        archivesList.splice(index, 1)
        saveArchivesList()
        archivesInit()
      }
    }
  };
  return button;
}

function createRemovePromptButton(index) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = "X";
  button.onclick = () => {
    if (!optionData.isDeleteCheck) {
      editPrompt.removeElement(index)
      UpdateGenaretePrompt()
      editInit()
    } else {
      const result = window.confirm("本当に削除しますか？");
      if (result) {
        editPrompt.removeElement(index)
        UpdateGenaretePrompt()
        editInit()
      }
    }
  };
  return button;
}

function createWeightPromptButton(index,text,value) {
  let button = document.createElement('button');
  button.type = "submit";
  button.innerHTML = text;
  button.onclick = () => {
    editPrompt.addWeight(value, index)
    UpdateGenaretePrompt()
    editInit()
  };
  return button;
}

function resetHtmlList(listId) {
  let targetList = $(listId).get(0);
  targetList.innerHTML = "";
}

function createHeaders(listId, ...headers) {
  let li = $('<ui>');
  for (let i = 0; i < headers.length; i++) {
    li.append(createHeaderData(headers[i]));
  }
  $(listId).eq(0).append(li);
}

function createSearchList(json, listId, isSave) {
  createHeaders(listId, "大項目", "中項目", "小項目", "Prompt")
  json.forEach((item, index) => {
    let li = $('<li>');
    let inputData = []
    for (let i = 0; i < 3; i++) {
      inputData.push(createInputData(item.data[i]))
    }
    li.append(...inputData);
    li.append(createInputData(item.prompt));
    li.append(createAddButton("Set", item.prompt + ","));
    li.append(createCopyButton(item.prompt));

    if (isSave) {
      li.append(createRegistButton(inputData, item.prompt));
    }

    if (item.url) {
      li.append(createOpenImageButton(item));
    }

    $(listId).append(li);

  })
}

function createAddList(json, listId) {
  createHeaders(listId, "大項目", "中項目", "小項目", "Prompt");
  json.forEach(function (item, index) {
    let li = $('<li>');
    li.append(createInputData(item.data[0], index, function (value, index) {
      localPromptList[index].data[0] = value;
    },function(){
      saveLocalList()
    }));
    li.append(createInputData(item.data[1], index, function (value, index) {
      localPromptList[index].data[1] = value;
    },function(){
      saveLocalList()
    }));
    li.append(createInputData(item.data[2], index, function (value, index) {
      localPromptList[index].data[2] = value;
    },function(){
      saveLocalList()
    }));
    li.append(createInputData(item.prompt, index, function (value, index) {
      localPromptList[index].prompt = value;
    },function(){
      saveLocalList()
    }));
    li.append(createAddButton("Set", item.prompt + ","));
    li.append(createCopyButton(item.prompt));
    if (item.url) {
      li.append(createOpenImageButton(item));
    }
    if (listId === "#addPromptList") {
      li.append(createRemoveButton(item, li));
      localPromptList[index].sort = index;
      li.attr('id', parseInt(index));
      li.addClass('ui-sortable-handle');
      li.append(createDragableIcon(index, "◆"));
    }
    $(listId).eq(0).append(li);
  });
}

function createArchiveList(json, listId) {
  createHeaders(listId, "名前", "Prompt");
  jsonLoop(json, function (item, index) {
    let li = $('<li>');
    li.append(createInputData(item.title, index, function (value, index) {
      archivesList[index].title = value;
      saveArchivesList();
    }));
    li.append(createInputData(item.prompt, index, function (value, index) {
      archivesList[index].prompt = value;
      saveArchivesList();
    }));
    li.append(createLoadButton(item.prompt));
    li.append(createCopyButton(item.prompt));
    li.append(createDeleteButton(index));

    $(listId).eq(0).append(li);
  });
  setColumnWidth(listId, 1, "150px");
}

function createEditList(json, listId) {
  createHeaders(listId, "Prompt", "重み");
  jsonLoop(json, function (item, index) {
    let li = $('<li>');

    let weight = item[optionData.shaping].weight;
    let prompt = item[optionData.shaping].value;

    let valueInput = createInputData(prompt, index, function (value, index) {
      editPrompt.editingValue(value, index);
      weightInput.val(editPrompt.elements[index][optionData.shaping].weight);
      UpdateGenaretePrompt();
    });
    let weightInput = createInputData(weight, index, function (value, index) {
      let weight = value.replace(/[^-0-9.]/g, '');
      editPrompt.editingWeight(weight, index);
      valueInput.val(editPrompt.elements[index][optionData.shaping].value);
      UpdateGenaretePrompt();
    });

    li.append(valueInput);
    if (weight) {
      li.append(weightInput);
    }
    li.append(createRemovePromptButton(index));
    li.attr('id', parseInt(index));
    li.addClass('ui-sortable-handle');
    li.append(createDragableIcon(index, "◆"));

    $(listId).eq(0).append(li);
  });
  setColumnWidth(listId, 1, "400px");
  setColumnWidth(listId, 2, "30px");

}
function createEditDropdownList(json, listId) {
  createHeaders(listId, "大項目", "中項目", "小項目", "Prompt", "重み");
  let translateList = []
  let inputList = []

  jsonLoop(json, function (item, index) {
    let li = $('<li>');
    let weight = item[optionData.shaping].weight;
    let prompt = item.Value.toLowerCase().trim();

    let category = null;
    const findCategory = (dataList, prompt) => {
      return dataList.find(dicData => dicData.prompt === prompt)?.data || null;
    };
    category = findCategory(masterPrompts, prompt);
    if (category == null) {
      category = findCategory(localPromptList, prompt);
    }
    let inputData = []
    for (let i = 0; i < 3; i++) {
      inputData[i] = createInputData(category ? category[i] : "翻訳中")
      if (!category) {
        inputData[i].prop('disabled', true);
      }else{
        inputClear(inputData[i])
      }
      li.append(inputData[i]);
    }

    let valueInput = createInputData(prompt, index, function (value, index) {
      editPrompt.editingValue(value, index);
      weightInput.val(editPrompt.elements[index][optionData.shaping].weight);
      UpdateGenaretePrompt();
    });
    let weightInput = createInputData(weight, index, function (value, index) {
      let weight = value.replace(/[^-0-9.]/g, '');
      editPrompt.editingWeight(weight, index);
      UpdateGenaretePrompt();
    });

    li.append(valueInput);
    if (weight) {
      li.append(weightInput);
    }

    let addValue = 0;
    let canWeighting = true;
    switch(optionData.shaping){
      case "SD":
        addValue = 0.1;
        break;
      case "NAI":
        addValue = 1;
        break;
      case "None":
        canWeighting = false;
        break;
    }
    if(canWeighting){
      li.append(createWeightPromptButton(index,"+",addValue));
      li.append(createWeightPromptButton(index,"-",-addValue));
    }
    li.append(createRemovePromptButton(index));
    
    let extraButton = null
    if (category == null) {
      extraButton = createRegistButton(inputData, prompt)
      li.append(extraButton);
      inputList.push(inputData)
      translateList.push({
        keyword: prompt,
      })
    } else {
      let element = masterPrompts.find(value => value.prompt === prompt)
      if (element && element.url) {
        extraButton = createOpenImageButton(element)
        li.append(extraButton);
      } else {
        extraButton = $('<button>');
        extraButton.hide()
      }
    }

    // 初期値の設定
    let categoryValue = inputData[0].val();
    inputData[0].attr("list", "category");
    inputData[1].attr("list", "category" + categoryValue);
    inputData[2].attr("list", "category" + categoryValue + inputData[1].val());

    inputData[0].on('change', function () {
      categoryValue = $(this).val();
      inputData[1].attr("list", "category" + categoryValue);
      inputData[2].attr("list", "category" + categoryValue + inputData[1].val());
    });

    inputData[1].on('change', function () {
      if (category) {
        inputData[2].attr("list", "category" + categoryValue + $(this).val());
      }
    });

    inputData[2].on('change', function () {
      const inputValue = $(this).val();
      const prompt = masterPrompts.find(value => value.data[2] === inputValue)?.prompt || valueInput.val();
      let element = masterPrompts.find(value => value.prompt === prompt)
      if (element && element.url) {
        extraButton.off('click').on('click', () => {
          previewPromptImage(element)
        });
        extraButton.show()
      } else {
        extraButton.hide()
      }

      valueInput.val(prompt);
      editPrompt.editingValue(editPrompt.getValue(optionData.shaping, prompt, weightInput.val()), index);
      UpdateGenaretePrompt();
    });

    li.attr('id', parseInt(index));
    li.addClass('ui-sortable-handle');
    li.append(createDragableIcon(index, "◆"));

    $(listId).eq(0).append(li);
  });

  let postData = ""
  translateList.forEach(item => {
    postData += item.keyword + ","
  })

  const isDeepl = false
  const useMethod = isDeepl ? translateDeepl : translateGoogle

  useMethod(postData, (translateData) => {
    translateData.forEach((keyword, index) => {
      inputList[index].forEach(item => {
        item.prop('disabled', false);
      })
      inputList[index][0].val("")
      inputList[index][1].val(isDeepl ? "Deepl翻訳" : "Google翻訳")
      inputList[index][2].val(keyword)
    })
  })

  const inputWidth = "80px"
  setColumnWidth(listId, 1, inputWidth);
  setColumnWidth(listId, 2, inputWidth);
  setColumnWidth(listId, 3, inputWidth);
  setColumnWidth(listId, 4, "130px");
  setColumnWidth(listId, 5, "30px");

}

function setColumnWidth(listId, inputIndex, width) {
  $(listId).find('li input:nth-of-type(' + inputIndex + ')').css('width', width);
  $(listId).find('ui input:nth-of-type(' + inputIndex + ')').css('width', width);
}

function jsonLoop(json, callback) {
  if (!json) {
    return
  }
  const num = Object.keys(json).length
  for (let i = 0; i < num; i++) {
    callback(json[i], i)
  }
}

let currentTab = 0
function tabSwitch() {
  document.getElementsByClassName('is-active')[0].classList.remove('is-active');
  this.classList.add('is-active');
  document.getElementsByClassName('is-show')[0].classList.remove('is-show');
  const arrayTabs = Array.prototype.slice.call($('.tab'));
  currentTab = arrayTabs.indexOf(this);
  document.getElementsByClassName('panel')[currentTab].classList.add('is-show');
  closePopup()
};

function inputClear(input) {
  input.mouseenter(function () {
    mouseCursorValue = $(this).val()
    $(this).val('');
    $(this).mouseleave(function () {
      if ($(this).val() === '') {
        $(this).val(mouseCursorValue);
      }
    });
  });
}

function handleDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  event.originalEvent.dataTransfer.dropEffect = 'copy';
}

function handleEvent(event) {
  event.stopPropagation();
  event.preventDefault();
  var file = null;
  if (event.type === 'drop') {
    file = event.originalEvent.dataTransfer.files[0];
  } else if (event.type === 'change') {
    file = event.target.files[0];
  }

  switch (file.type) {
    case "application/json":
    case "text/plain":
      readDicFile(file);
      break;
    case "image/png":
      readPngFile(file);
      break;
    default:
      break;
  }
}

function readDicFile(file) {
  $('#incluedText').text("読み込み中")
  var reader = new FileReader();
  reader.onload = function (event) {
    const content = JSON.parse(event.target.result); // 読み込んだファイルをJSON形式のデータとして解析する
    console.log(event.target.result); // 読み込んだJSONデータをコンソールに表示する
    let addCount = 0
    switch (content.dicType) {
      case "Elements":
        content.data.forEach(item => {
          if (RegistDic(item)) {
            addCount++;
          }
        });
        if (addCount > 0) {
          window.alert(addCount.toString() + "件の要素辞書の読み込みが完了しました");
        }
        break;
      case "Prompts":
        content.data.forEach(item => {
          if (addPromptDic(item)) {
            addCount++;
          }
        });
        if (addCount > 0) {
          saveArchivesList()
          archivesInit()
          window.alert(addCount.toString() + "件のプロンプト辞書の読み込みが完了しました");
        }
        break;
      case "Master":
        console.log("Master"); // 読み込んだJSONデータをコンソールに表示する
        masterPrompts = []
        jsonLoop(content.data, (data) => {
          masterPrompts.push({ "prompt": data[3], "data": { 0: data[0], 1: data[1], 2: data[2] }, "url": data[4] })
        })
        saveMasterPrompt()
        categoryData.update()
        break;
      default:
        break;
    }
    console.log(content); // 読み込んだJSONデータをコンソールに表示する
    $('#incluedText').text("辞書か画像を読みこむ (クリックして選択かドラッグドロップ)")
  };
  reader.readAsText(file);
}

function addPromptDic(item) {
  const matchedIndex = archivesList.findIndex(obj => obj.prompt === item.prompt);
  if (matchedIndex !== -1) {
    return false
  } else {
    archivesList.push(item)
    return true
  }
}

function readPngFile(file) {

  // FileReaderオブジェクトを作成する
  const reader = new FileReader();
  reader.onload = function (event) {
    const arrayBuffer = event.target.result;
    let pngInfo = getPngInfo(arrayBuffer);
    let outPut = pngInfo.textChunks;
    outPut["width"] = pngInfo.width
    outPut["height"] = pngInfo.height
    createPngInfo(outPut);
    createPngPreview(URL.createObjectURL(file))
  };
  reader.readAsArrayBuffer(file);
}

function createPngPreview(file) {
  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fixSize = 540;
    let width = img.width;
    let height = img.height;

    if (width >= height && width > fixSize) {
      height *= fixSize / width;
      width = fixSize;
    } else if (height >= width && height > fixSize) {
      width *= fixSize / height;
      height = fixSize;
    }

    canvas.width = fixSize;
    canvas.height = height;

    // 画像を描画する
    const x = (canvas.width - width) / 2; // 左右中央揃えのためのx座標
    ctx.drawImage(img, x, 0, width, height);

    $('#preview').attr('src', canvas.toDataURL());
  };
  img.src = file;
}

function getPngInfo(arrayBuffer) {
  let info = {};
  const dataView = new DataView(arrayBuffer);
  info.width = dataView.getUint32(16, false);
  info.height = dataView.getUint32(20, false);
  info.bitDepth = dataView.getUint8(24);
  info.colorType = dataView.getUint8(25);
  info.compressionMethod = dataView.getUint8(26);
  info.filterMethod = dataView.getUint8(27);
  info.interlaceMethod = dataView.getUint8(28);
  info.textChunks = getTextChunk(arrayBuffer);
  return info;
}

function getTextChunk(arrayBuffer) {
  let data = {};
  let metadata = {};
  // tEXtチャンクを検索する
  let chunkOffset = 33; // 最初のIDATチャンクの直後から探索を開始する
  while (chunkOffset < arrayBuffer.byteLength) {
    const chunkLength = new DataView(arrayBuffer, chunkOffset, 4).getUint32(0, false);
    const chunkType = new TextDecoder().decode(new Uint8Array(arrayBuffer, chunkOffset + 4, 4));
    if (chunkType === 'tEXt') {
      // tEXtチャンクを発見した場合は、キーワードとテキストデータを抽出する
      let keywordEnd = new Uint8Array(arrayBuffer, chunkOffset + 8).indexOf(0);
      const keywordArray = new Uint8Array(arrayBuffer, chunkOffset + 8, keywordEnd);
      const keyword = new TextDecoder().decode(keywordArray);
      const textDataArray = new Uint8Array(arrayBuffer, chunkOffset + 8 + keywordEnd + 1, chunkLength - (keywordEnd + 1));
      const textData = new TextDecoder().decode(textDataArray);
      if (keyword === "Comment") {
        metadata = textData
        data = JSON.parse(metadata);
        data.metadata = metadata;
      } else if (keyword === "parameters") {
        metadata = `prompt: ${textData}`
        data = parseSDPng(metadata);
        data.metadata = metadata;
      }
    }
    chunkOffset += chunkLength + 12; // 次のチャンクに移動する
  }
  ;
  return data;
}

function createPngInfo(data) {
  const div = $('<div>').addClass('item');
  $.each(data, function (key, value) {
    const label = $('<label>').text(key + ': ').css({
      display: 'inline-block',
      width: '200px',
      margin: '5px 10px 5px 0'
    });
    const element = $('<input>').attr({
      type: 'text',
      value: value,
      readonly: true
    }).css({
      display: 'inline-block',
      width: '200px'
    });
    div.append(label, element, '<br>');
  });

  $('#pngInfo').empty();
  $('#pngInfo').append(div);
}

function parseSDPng(text) {
  const data = {};
  let matches = text.match(/(.*)(steps:.*)/i);
  if (matches) {
    matches = [...matches[0].matchAll(/([A-Za-z\s]+):\s*([^,\n]*)/g)];
    for (const match of matches) {
      const key = match[1].trim();
      const value = match[2].trim();

      if (key !== "prompt" && key !== "Negative prompt") {
        data[key] = value;
      }
    }
  }

  matches = [...text.matchAll(/([A-Za-z\s]+):\s*((?:[^,\n]+,)*[^,\n]+)/g)];
  for (const match of matches) {
    const key = match[1].trim();
    const value = match[2].trim();

    if (key === "prompt" || key === "Negative prompt") {
      data[key] = value;
    }
  }

  return data;
}