// Prompt編集オブジェクト
let editPrompt = {
  prompt: "",
  elements: [],
  isOldSD: false,
  init: function (str) {
    this.isOldSD = /\(\(/.test(str)
    this.elements = []
    let tempList = str.split(',').map(item => item.trim().replace(/\s{2,}/g, ' ')).filter(item => item !== '');
    tempList.forEach((prompt, index) => {
      let temp = this.createElement(prompt)
      temp.sort = index
      this.elements.push(temp)
    });
    this.generate()
  },
  generate: function () {
    const sortedElements = []
    this.elements.forEach((value)=>{
      sortedElements.push(value)
    })
    sortedElements.sort((a,b)=>{
      if (a.sort < b.sort) {return -1;}
      if (a.sort > b.sort) {return 1;}
      return 0;
    });
    this.prompt = sortedElements.map(item => item[optionData.shaping].value).join(",")+",";
  },
  editingValue: function (value, index) {
    this.elements[index] = this.createElement(value)
    this.generate()
  },
  editingWeight: function (weight, index) {
    this.elements[index] = this.createElement(this.elements[index][optionData.shaping].value, weight)
    this.generate()
  },
  removeElement: function (index) {
    this.elements.splice(index, 1)
    this.generate()
  },
  moveInsertElement: function (index, newIndex) {
    const element = this.elements[index];
    this.elements.splice(index, 1);
    this.elements.splice(newIndex, 0, element);
    this.generate()
  },
  moveElement: function (index, value) {
    const temp = this.elements[index]
    this.elements[index] = this.elements[index + value]
    this.elements[index + value] = temp
    this.generate()
  },
  createElement: function (prompt, weight) {
    let element = {}
    if (weight) {
      switch (optionData.shaping) {
        case "SD":
        case "None":
          element.Weight = weight;
          break;
        case "NAI":
          element.Weight = this.convertSDWeight(weight);
          break;
      }
    } else {
      element.Weight = this.getWeight(prompt);
    }
    element.Value = this.getbaseValue(prompt)

    element["SD"] = {}
    element["SD"].weight = element.Weight;
    element["SD"].value = this.getValue("SD", element.Value, element.Weight)

    element["NAI"] = {}
    element["NAI"].weight = this.convertNAIWeight(element.Weight);
    element["NAI"].value = this.getValue("NAI", element.Value, element["NAI"].weight)

    element["None"] = {}
    element["None"].weight = null;
    element["None"].value = prompt
    return element;
  },
  getValue: function (type, str, weight) {
    switch (type) {
      case "SD":
        return weight != 1 ? `(${str}:${weight})` : str
      case "NAI":
        const brackets = weight > 0 ? "{}" : "[]";
        const absWeight = Math.abs(weight);
        const result = brackets[0].repeat(absWeight) + str + brackets[1].repeat(absWeight);
        return result;
      case "None":
        return str
    }
  },
  getWeight: function (str) {
    if (this.isSpecialPropmt(str)) {
      return 1;
    }
    const match = this.getSDTypeWight(str);
    if (match) {
      return parseFloat(match[2])
    } else {
      const splitChar = this.isOldSD ? "(" : "{"
      const aiWeight = this.isOldSD ? 1.1 : 1.05
      let weight = str.split(splitChar).length - 1
      if (weight == 0) {
        weight = (str.split("[").length - 1) * -1
      }
      return parseFloat((aiWeight ** weight).toFixed(2));
    }
  },
  getbaseValue: function (str) {
    if (this.isSpecialPropmt(str)) {
      return str;
    }
    if (this.isOldSD) {
      return str.replace(/[\(\)]/g, '');
    }
    const match = this.getSDTypeWight(str);
    if (match) {
      return match[1]
    } else {
      return str.replace(/[{}\[\]]/g, "")
    }
  },
  isSpecialPropmt: function (str) {
    const regex = /^\[.*:.*:.*\]$/;
    return regex.test(str);
  },
  convertNAIWeight: function (weight) {
    return (Math.log(weight) / Math.log(1.05)).toFixed(0);
  },
  convertSDWeight: function (weight) {
    return parseFloat((1.05 ** weight).toFixed(2));
  },
  getSDTypeWight: function (str) {
    return str.match(/\(([^:]+):([\d.]+)\)/);
  },
}