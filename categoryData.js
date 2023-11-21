let categoryData = {
  data: [[], [], []],
  init:function(){
    chrome.storage.local.get(["categoryData"], function (items) {
      if (items.categoryData != null){
        categoryData.data = items.categoryData;  // value1
        categoryData.createDatatlist()
      }
    });
  },
  update: function () {
    this.data= [[], [], []]
    let addedValues = { 0: new Set(), 1: new Set(), 2: new Set() };
    localPromptList.forEach(item => this.addItem(item, addedValues));
    masterPrompts.forEach(item => this.addItem(item, addedValues));
    chrome.storage.local.set({ 'categoryData': this.data });
    this.createDatatlist()
  },
  addItem: function (item, addedValues) {
    for (let i = 0; i < 3; i++) {
      const hasValue = addedValues[i].has(item.data[i]);
      let isAdd = !hasValue || !this.data[i].some(check => check.value === item.data[i] && check.parent === item.data[i - 1]);
      if (isAdd) {
        addedValues[i].add(item.data[i]);
        const pushData = { value: item.data[i] };
        if (i > 0) {
          pushData.parent = ""
          for (let j = 0; j < i; j++) {
            pushData.parent += item.data[j].replace(/[!\/]/g, "");
          }
        }
        this.data[i].push(pushData);
      }
    }
  },
  createDatatlist:function(){
    const bigCategory = $("#category");
    const middleCategory = {};
    const smallCategory = {};
    const dataListContainer = $('body');
    bigCategory.empty();

    this.data[0].forEach((item) => {
      const option = $('<option>', {
        value: item.value,
        text: item.value
      });
      bigCategory.append(option);
      middleCategory[item.value] = $('<datalist>', {
        id: "category" + item.value
      }).appendTo(dataListContainer);
    });

    this.data[1].forEach((item) => {
      const parentDataList = middleCategory[item.parent];
      if (parentDataList) {
        const option = $('<option>', {
          value: item.value,
          text: item.value
        });
        parentDataList.append(option);
      smallCategory[item.parent + item.value] = $('<datalist>', {
          id: "category" + item.parent + item.value
        }).appendTo(dataListContainer);
      }
    });

    this.data[2].forEach((item) => {
      const parentDataList = $("#category" + item.parent);
      if (parentDataList.length > 0) {
        const option = $('<option>', {
          value: item.value,
          text: item.value
        });
        parentDataList.append(option);
      }
    });

    setCategoryList("#search-cat0", 0);
  }
};
