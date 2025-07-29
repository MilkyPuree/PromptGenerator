/**
 * プロンプト編集クラス
 * Phase 3: クラスベースの実装
 */
class PromptEditor {
  constructor() {
    this.prompt = "";
    this.elements = [];
    this.isOldSD = false;
    this._elementIdCounter = 0; // 一意のID用カウンター（動的に調整される）

    // イベントリスナー管理
    this._listeners = {
      change: [],
      elementAdded: [],
      elementRemoved: [],
      elementUpdated: [],
    };
  }

  /**
   * プロンプトを初期化
   * @param {string} str - プロンプト文字列
   */
  init(str) {
    this.isOldSD = /\(\(/.test(str);
    this.elements = [];
    this._elementIdCounter = 0; // 一意のID用カウンター

    const tempList = str
      .split(",")
      .map((item) => item.trim().replace(/\s{2,}/g, " "))
      .filter((item) => item !== "");

    tempList.forEach((prompt, index) => {
      const element = this.createElement(prompt);
      element.sort = index;
      element.id = this._elementIdCounter++; // 一意のIDを付与
      this.elements.push(element);
    });

    // 初期化完了時にID整合性を確保
    this.ensureElementIds();
    this.generate();
  }
  /**
   * プロンプトを生成
   */
  generate() {
    const sortedElements = [...this.elements].sort((a, b) => a.sort - b.sort);

    const shaping = this._getShaping();
    
    // スロットモードに応じて区切り文字を決定
    const currentSlot = window.promptSlotManager?.slots[window.promptSlotManager?.currentSlot];
    const separator = (currentSlot?.mode === "single") ? " " : ",";
    const suffix = (separator === ",") ? "," : "";
    
    this.prompt = sortedElements.map((item) => item[shaping].value).join(separator) + suffix;

    // 変更イベントを発火
    this._emit("change", { prompt: this.prompt, elements: this.elements });
  }

  /**
   * 要素の値を編集
   * @param {string} value - 新しい値
   * @param {number} index - 要素のインデックス
   */
  editingValue(value, index) {
    if (index >= 0 && index < this.elements.length) {
      const oldSort = this.elements[index].sort;
      const oldId = this.elements[index].id; // IDを保持
      
      // 既存の重み値を保持
      const oldWeight = this.elements[index].Weight;
      const oldSDWeight = this.elements[index].SD ? this.elements[index].SD.weight : undefined;
      const oldNAIWeight = this.elements[index].NAI ? this.elements[index].NAI.weight : undefined;
      
      // 重み値を指定して要素を再作成
      this.elements[index] = this.createElement(value, oldWeight);
      this.elements[index].sort = oldSort;
      this.elements[index].id = oldId; // IDを復元
      
      // SD/NAI形式の重み値も明示的に復元
      if (oldSDWeight !== undefined && this.elements[index].SD) {
        this.elements[index].SD.weight = oldSDWeight;
        // SD形式の値を再生成
        this.elements[index].SD.value = this.getValue("SD", this.elements[index].Value, oldSDWeight);
      }
      if (oldNAIWeight !== undefined && this.elements[index].NAI) {
        this.elements[index].NAI.weight = oldNAIWeight;
        // NAI形式の値を再生成
        this.elements[index].NAI.value = this.getValue("NAI", this.elements[index].Value, oldNAIWeight);
      }
      
      this.generate();
      this._emit("elementUpdated", { index, element: this.elements[index] });
    }
  }

  /**
   * 要素の重みを編集
   * @param {string} weight - 新しい重み
   * @param {number} index - 要素のインデックス
   */
  editingWeight(weight, index) {
    if (index >= 0 && index < this.elements.length) {
      const shaping = this._getShaping();
      const oldSort = this.elements[index].sort;
      const oldId = this.elements[index].id; // IDを保持
      this.elements[index] = this.createElement(
        this.elements[index][shaping].value,
        weight
      );
      this.elements[index].sort = oldSort;
      this.elements[index].id = oldId !== undefined ? oldId : this._elementIdCounter++; // IDを復元または新規付与
      console.log(`[PROMPT_EDITOR] Updated weight for element ${index} with ID ${this.elements[index].id}:`, weight);
      this.generate();
      this._emit("elementUpdated", { index, element: this.elements[index] });
    }
  }

  /**
   * 要素に重みを追加
   * @param {number} deltaMultiplier - 増減の倍数（1 で基本単位、-1 で逆方向）
   * @param {number} index - 要素のインデックス
   */
  addWeight(deltaMultiplier, index) {
    if (index >= 0 && index < this.elements.length) {
      const shaping = this._getShaping();
      const weightConfig = WeightConverter.getWeightConfig(shaping);
      
      // スロットタブと同じロジック：適切なdelta値を使用
      const currentWeight = parseFloat(this.elements[index][shaping].weight) || 0;
      const delta = weightConfig.delta * deltaMultiplier;
      let newWeight = currentWeight + delta;

      // 浮動小数点の精度問題を修正
      newWeight = Math.round(newWeight * 100) / 100;

      // 範囲内に制限
      newWeight = Math.max(weightConfig.min, Math.min(weightConfig.max, newWeight));
      
      console.log(`[PromptEditor] addWeight: deltaMultiplier=${deltaMultiplier}, delta=${delta}, shaping=${shaping}, currentWeight=${currentWeight}, newWeight=${newWeight}`);

      const oldSort = this.elements[index].sort;
      const oldId = this.elements[index].id;
      this.elements[index] = this.createElement(
        this.elements[index][shaping].value,
        newWeight
      );
      this.elements[index].sort = oldSort;
      this.elements[index].id = oldId !== undefined ? oldId : this._elementIdCounter++;
      console.log(`[PROMPT_EDITOR] Added weight to element ${index} with ID ${this.elements[index].id}:`, newWeight);
      this.generate();
      this._emit("elementUpdated", { index, element: this.elements[index] });
    }
  }

  /**
   * 要素を削除
   * @param {number} index - 削除する要素のインデックス
   */
  removeElement(index) {
    if (index >= 0 && index < this.elements.length) {
      const removed = this.elements.splice(index, 1)[0];
      // 要素削除後にID整合性を確保
      this.ensureElementIds();
      this.generate();
      this._emit("elementRemoved", { index, element: removed });
    }
  }

  /**
   * 要素を移動
   * @param {number} index - 移動元のインデックス
   * @param {number} offset - 移動量
   */
  moveElement(index, offset) {
    const newIndex = index + offset;
    if (
      index >= 0 &&
      index < this.elements.length &&
      newIndex >= 0 &&
      newIndex < this.elements.length
    ) {
      const temp = this.elements[index];
      this.elements[index] = this.elements[newIndex];
      this.elements[newIndex] = temp;
      console.log(`[PROMPT_EDITOR] Moved element from ${index} to ${newIndex}`);
      this.generate();
    }
  }

  /**
   * 要素を挿入位置に移動
   * @param {number} index - 移動元のインデックス
   * @param {number} newIndex - 移動先のインデックス
   */
  moveInsertElement(index, newIndex) {
    if (
      index >= 0 &&
      index < this.elements.length &&
      newIndex >= 0 &&
      newIndex <= this.elements.length
    ) {
      const element = this.elements[index];
      this.elements.splice(index, 1);
      this.elements.splice(newIndex, 0, element);
      this.generate();
    }
  }

  /**
   * 空の未設定要素を追加
   * @param {string} position - 追加位置 ('top' | 'bottom')
   * @param {string} value - 初期値（デフォルト: 空文字）
   * @returns {number} 追加された要素のインデックス
   */
  addElement(position = 'bottom', value = '', idOffset = 0) {
    const newElement = this.createElement(value || '');
    
    // IDオフセットを考慮してIDを生成
    if (idOffset > 0) {
      // 編集タブなど、特定のオフセット範囲でIDを生成
      const maxId = Math.max(...this.elements.map(el => el.id || 0));
      newElement.id = Math.max(maxId + 1, idOffset + this.elements.length);
    } else {
      // 従来の通常ID生成
      newElement.id = this._elementIdCounter++;
    }
    
    // デバッグ：新しく作成された要素の重み値を確認
    console.log('[PromptEditor] New element created:', {
      id: newElement.id,
      Weight: newElement.Weight,
      'SD.weight': newElement.SD?.weight,
      'NAI.weight': newElement.NAI?.weight,
      shaping: this._getShaping(),
      idOffset: idOffset
    });
    
    let insertIndex;
    if (position === 'top') {
      // 先頭に追加
      insertIndex = 0;
      // 既存要素のsort値を1つずつ増やす
      this.elements.forEach(element => {
        element.sort = (element.sort || 0) + 1;
      });
      newElement.sort = 0;
      this.elements.unshift(newElement);
    } else {
      // 末尾に追加（デフォルト）
      insertIndex = this.elements.length;
      newElement.sort = this.elements.length;
      this.elements.push(newElement);
    }
    
    // 要素追加後にsort値の整合性を確保
    this.ensureSortIntegrity();
    
    this.generate();
    this._emit("elementAdded", { 
      index: insertIndex, 
      element: newElement, 
      position: position 
    });
    
    console.log(`[PROMPT_EDITOR] Added empty element at ${position}, index: ${insertIndex}, id: ${newElement.id}`);
    return newElement.id;
  }

  /**
   * プロンプト要素を作成
   * @param {string} prompt - プロンプト文字列
   * @param {number} [weight] - 重み（オプション）
   * @returns {Object} 作成された要素
   */
  createElement(prompt, weight) {
    const element = {};
    const shaping = this._getShaping();

    // 重みの設定
    if (weight === undefined) {
      element.Weight = this.getWeight(prompt);
    } else {
      switch (shaping) {
        case "SD":
        case "None":
          element.Weight = weight;
          break;
        case "NAI":
          element.Weight = this.convertSDWeight(weight);
          break;
      }
    }

    element.Value = this.getbaseValue(prompt);

    // 各形式用の値を設定
    // createElement メソッド内の修正
    element["SD"] = {
      weight: element.Weight || 0, // 0の場合も明示的に0を設定
      value: this.getValue("SD", element.Value, element.Weight),
    };

    element["NAI"] = {
      weight: this.convertNAIWeight(element.Weight),
      value: this.getValue(
        "NAI",
        element.Value,
        this.convertNAIWeight(element.Weight)
      ),
    };

    element["None"] = {
      weight: null,
      value: prompt,
    };

    // カテゴリーデータを初期化（編集タブで必要）
    element.data = ["", "", ""];
    
    return element;
  }

  /**
   * 全要素のID整合性を確保
   * DOM更新エラーを防ぐために、すべての要素に一意のIDが付与されていることを保証
   * @param {number} idOffset - IDオフセット（編集タブ用など）
   */
  ensureElementIds(idOffset = 0) {
    let maxId = idOffset;
    
    // 既存のIDの最大値を取得
    this.elements.forEach(element => {
      if (element.id !== undefined && element.id > maxId) {
        maxId = element.id;
      }
    });
    
    // IDが欠けている要素に新しいIDを付与
    let needsReassignment = false;
    this.elements.forEach((element, index) => {
      if (element.id === undefined || element.id === null || 
          (idOffset > 0 && element.id < idOffset)) {
        element.id = idOffset > 0 ? idOffset + index : ++maxId;
        needsReassignment = true;
        console.log(`[PROMPT_EDITOR] Assigned new ID ${element.id} to element:`, element.Value?.substring(0, 30));
      }
    });
    
    // カウンターを更新
    this._elementIdCounter = Math.max(this._elementIdCounter, maxId + 1);
    
    if (needsReassignment) {
      console.log(`[PROMPT_EDITOR] ID reassignment completed. Next ID: ${this._elementIdCounter}`);
    }
  }

  /**
   * 配列の整合性を確保
   * スパース配列や不正な要素を除去
   */
  ensureArrayIntegrity() {
    // 有効な要素のみを抽出して配列を再構築
    const validElements = this.elements.filter(el => el !== undefined && el !== null);
    const originalLength = this.elements.length;
    const validLength = validElements.length;
    
    if (originalLength !== validLength) {
      this.elements = validElements;
    }
    
    return originalLength !== validLength;
  }

  /**
   * sort値の整合性を確保
   * 重複や欠損を防ぐために、すべての要素に正しいsort値を付与
   */
  ensureSortIntegrity() {
    
    // sort値が重複または未設定の場合は配列インデックスで再設定
    let needsReassignment = false;
    const sortValues = this.elements.map(el => el.sort);
    const hasDuplicates = sortValues.length !== new Set(sortValues).size;
    const hasUndefined = sortValues.some(sort => sort === undefined || sort === null);
    
    if (hasDuplicates || hasUndefined) {
      needsReassignment = true;
      
      // 配列の順序に基づいてsort値を再設定
      this.elements.forEach((element, index) => {
        element.sort = index;
      });
    }
    
    return needsReassignment;
  }

  /**
   * 形式に応じた値を取得
   * @param {string} type - 形式（SD/NAI/None）
   * @param {string} str - 基本文字列
   * @param {number} weight - 重み
   * @returns {string} フォーマットされた値
   */
  getValue(type, str, weight) {
    switch (type) {
      case "SD":
        if (weight <= 0 || weight === 1) return str;
        return `(${str}:${weight})`;
      case "NAI":
        if (weight === 0 || !isFinite(weight)) return str; // 無限大チェックを追加
        const brackets = weight > 0 ? "{}" : "[]";
        const absWeight = Math.min(Math.abs(weight), 10); // 最大10に制限
        return (
          brackets[0].repeat(absWeight) + str + brackets[1].repeat(absWeight)
        );
      case "None":
        return str;
      default:
        return str;
    }
  }

  /**
   * プロンプトから重みを取得
   * @param {string} str - プロンプト文字列
   * @returns {number} 重み
   */
  getWeight(str) {
    if (this.isSpecialPrompt(str)) {
      return 1;
    }

    // 空文字列の場合は記法に応じた適切な初期重み値を返す
    if (!str || str.trim() === '') {
      const shaping = this._getShaping();
      switch (shaping) {
        case "NAI":
          return 1.0; // NAI記法では1.0（convertNAIWeightで0に変換され、{{}}なしの普通の状態）
        case "SD":
          return 1.0; // SD記法では1.0（普通の状態）
        default:
          return 1.0; // その他の場合は1.0
      }
    }

    const match = this.getSDTypeWeight(str);
    if (match) {
      return parseFloat(match[2]);
    } else {
      const splitChar = this.isOldSD ? "(" : "{";
      const aiWeight = this.isOldSD ? 1.1 : 1.05;
      let weight = str.split(splitChar).length - 1;
      if (weight === 0) {
        weight = (str.split("[").length - 1) * -1;
      }
      return parseFloat((aiWeight ** weight).toFixed(2));
    }
  }

  /**
   * プロンプトから基本値を取得
   * @param {string} str - プロンプト文字列
   * @returns {string} 基本値
   */
  getbaseValue(str) {
    if (this.isSpecialPrompt(str)) {
      return str;
    }

    if (this.isOldSD) {
      return str.replace(/[\(\)]/g, "");
    }

    const match = this.getSDTypeWeight(str);
    if (match) {
      return match[1].trim(); // 基本値を返す（trimで余分な空白を除去）
    } else {
      return str.replace(/[{}\[\]]/g, "");
    }
  }

  /**
   * 特殊なプロンプトかチェック
   * @param {string} str - プロンプト文字列
   * @returns {boolean}
   */
  isSpecialPrompt(str) {
    const regex = /^\[.*:.*:.*\]$/;
    return regex.test(str);
  }

  /**
   * NAI形式の重みに変換
   * @param {number} weight - SD形式の重み
   * @returns {number} NAI形式の重み
   */
  convertNAIWeight(weight) {
    // 重みが0または1の場合は特別処理
    if (weight === 0 || weight === 1) {
      return 0;
    }

    // 重みが0に非常に近い場合も0として扱う
    if (Math.abs(weight) < 0.01) {
      return 0;
    }

    // 通常の変換
    return Math.round(Math.log(weight) / Math.log(1.05));
  }

  /**
   * SD形式の重みに変換
   * @param {number} weight - NAI形式の重み
   * @returns {number} SD形式の重み
   */
  convertSDWeight(weight) {
    return parseFloat((1.05 ** weight).toFixed(2));
  }

  /**
   * SD形式の重みを取得
   * @param {string} str - プロンプト文字列
   * @returns {Array|null} マッチ結果
   */
  getSDTypeWeight(str) {
    // まず括弧ありの形式をチェック: (text:weight)
    let match = str.match(/\(([^:]+):([\d.]+)\)/);
    if (match) return match;

    // 括弧なしの形式をチェック: text:weight
    match = str.match(/^([^:]+):([\d.]+)$/);
    return match;
  }

  /**
   * 現在の整形タイプを取得
   * @returns {string} 整形タイプ
   * @private
   */
  _getShaping() {
    // AppStateが利用可能な場合はそれを使用
    if (
      typeof AppState !== "undefined" &&
      AppState.userSettings?.optionData?.shaping
    ) {
      return AppState.userSettings.optionData.shaping;
    }
    // レガシー互換性
    if (typeof optionData !== "undefined" && optionData?.shaping) {
      return optionData.shaping;
    }
    return "None";
  }

  /**
   * 重み値設定を取得（静的メソッド）
   * @param {string} [shaping] - 整形モード（省略時は現在の設定を使用）
   * @returns {Object} { delta, min, max }
   */
  static getWeightConfig(shaping) {
    if (!shaping) {
      // AppStateが利用可能な場合はそれを使用
      if (
        typeof AppState !== "undefined" &&
        AppState.userSettings?.optionData?.shaping
      ) {
        shaping = AppState.userSettings.optionData.shaping;
      } else if (typeof optionData !== "undefined" && optionData?.shaping) {
        shaping = optionData.shaping;
      } else {
        shaping = "None";
      }
    }

    if (shaping === "SD") {
      return { delta: 0.1, min: 0.1, max: 10 };
    } else if (shaping === "NAI") {
      return { delta: 1, min: -10, max: 10 };
    } else {
      return { delta: 0, min: -10, max: 10 };
    }
  }

  /**
   * インスタンスメソッド版
   * @returns {Object} { delta, min, max }
   */
  getWeightConfig() {
    return PromptEditor.getWeightConfig(this._getShaping());
  }

  // ============================================
  // イベントシステム
  // ============================================

  /**
   * イベントリスナーを追加
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  on(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].push(callback);
    }
  }

  /**
   * イベントリスナーを削除
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(
        (cb) => cb !== callback
      );
    }
  }

  /**
   * イベントを発火
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   * @private
   */
  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

// ============================================
// グローバル互換性レイヤー（段階的移行用）
// ============================================

// デフォルトのインスタンスを作成
const promptEditor = new PromptEditor();

// レガシーコードとの互換性のため、editPromptとして公開
// 段階的に promptEditor への参照に置き換えていく
let editPrompt = {
  get prompt() {
    return promptEditor.prompt;
  },
  set prompt(value) {
    promptEditor.prompt = value;
  },
  get elements() {
    return promptEditor.elements;
  },
  set elements(value) {
    promptEditor.elements = value;
  },
  get isOldSD() {
    return promptEditor.isOldSD;
  },
  set isOldSD(value) {
    promptEditor.isOldSD = value;
  },

  // メソッドをプロキシ
  init: (str) => promptEditor.init(str),
  generate: () => promptEditor.generate(),
  editingValue: (value, index) => promptEditor.editingValue(value, index),
  editingWeight: (weight, index) => promptEditor.editingWeight(weight, index),
  addWeight: (weight, index) => promptEditor.addWeight(weight, index),
  removeElement: (index) => promptEditor.removeElement(index),
  moveElement: (index, offset) => promptEditor.moveElement(index, offset),
  moveInsertElement: (index, newIndex) =>
    promptEditor.moveInsertElement(index, newIndex),
  addElement: (position, value, idOffset) => promptEditor.addElement(position, value, idOffset),
  createElement: (prompt, weight) => promptEditor.createElement(prompt, weight),
  getValue: (type, str, weight) => promptEditor.getValue(type, str, weight),
  getWeight: (str) => promptEditor.getWeight(str),
  getbaseValue: (str) => promptEditor.getbaseValue(str),
  isSpecialPrompt: (str) => promptEditor.isSpecialPrompt(str),
  convertNAIWeight: (weight) => promptEditor.convertNAIWeight(weight),
  convertSDWeight: (weight) => promptEditor.convertSDWeight(weight),
  getSDTypeWeight: (str) => promptEditor.getSDTypeWeight(str),
  ensureElementIds: (idOffset) => promptEditor.ensureElementIds(idOffset),
  ensureArrayIntegrity: () => promptEditor.ensureArrayIntegrity(),
  ensureSortIntegrity: () => promptEditor.ensureSortIntegrity(),
};

// グローバルに公開
if (typeof window !== "undefined") {
  window.PromptEditor = PromptEditor;
  window.promptEditor = promptEditor;
  window.editPrompt = editPrompt;
}
