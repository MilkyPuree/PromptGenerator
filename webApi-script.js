const toolInfoAPI = "https://script.google.com/macros/s/AKfycbz620nLVd7jBJBdpZNy-ge13tBZQR_tCq2VIqIJfH3dZFJ6fZlwvXnRmJh5jSXZkXTR/exec"
function loadMessage() {
  fetch(toolInfoAPI)
    .then(response => response.json())
    .then(json => {
      $("#notice").text("")
      jsonLoop(json, (item, index) => {
        switch (item.title) {
          case "latestToolVer":
            if (toolVersion < item.value) {
              $('#noticeTab').addClass('is-alert');
              $("#notice").text("最新のバージョンがあります");
            }
            break;
          case "isAlert":
            if (item.value) {
              $('#noticeTab').addClass('is-alert');
            }
            break;
          case "notice":
            $("#notice").text(item.value);
            break;
          case "latestDicUrl":
            masterDicDownload(item.value);
            break;
        }
        toolInfo[item.title]=item.value
      })
      saveToolInfo()
    });
}

function SearchLogAPI(search) {
  let url = toolInfo.searchAPI + "?search=" + encodeURI(search);
  fetch(url, { method: "Get", mode: "cors" })
}

function RegistAPI(big, middle, small, prompt) {
  let url = toolInfo.registAPI;
  url += "?big=" + encodeURI(big);
  url += "&middle=" + encodeURI(middle);
  url += "&small=" + encodeURI(small);
  url += "&prompt=" + encodeURI(prompt);
  fetch(url, { method: "Get", mode: "cors" })
}

function translateGoogle(keyword, translateEvent) {
  let url = toolInfo.translateAPI + "?search=" + encodeURI(keyword);
  fetch(url)
    .then(response => response.json())
    .then(json => {
      if (translateEvent) {
        translateEvent(json)
      }
    });
}

function translateDeepl(keyword, translateEvent) {
  let url = toolInfo.translateDeeplAPI + "?search=" + encodeURI(keyword) + "&authKey=" + encodeURI(optionData.deeplAuthKey);
  fetch(url)
    .then(response => response.json())
    .then(json => {
      if (translateEvent) {
        translateEvent(json)
      }
    });
}

function masterDicDownload(jsonURL) {
  if(optionData.masterUrl == jsonURL){
    return
  }
  const xhr = new XMLHttpRequest();
  xhr.open("GET", jsonURL, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const jsonData = JSON.parse(xhr.responseText);
      masterPrompts = []
      jsonLoop(jsonData, (data) => {
        masterPrompts.push({ "prompt": data[3], "data": { 0: data[0], 1: data[1], 2: data[2] }, "url": data[4] })
      })
      saveMasterPrompt()
      categoryData.update()
      optionData.masterUrl = jsonURL
      saveOptionData()
    }
  };
  xhr.send();
};

