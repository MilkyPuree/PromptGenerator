/**
 * 重み変換ユーティリティクラス
 * SD形式とNAI形式の重み値を相互変換する
 */
class WeightConverter {
  /**
   * SD形式の重みをNAI形式に変換
   * @param {number} weight - SD形式の重み
   * @returns {number} NAI形式の重み
   */
  static convertSDToNAI(weight) {
    // 重みが0または1の場合は特別処理
    if (weight === 0 || weight === 1) {
      return 0;
    }

    // 重みが0に非常に近い場合も0として扱う
    if (Math.abs(weight) < WEIGHT_CONVERSION.MIN_THRESHOLD) {
      return 0;
    }

    // 通常の変換
    return Math.round(Math.log(weight) / Math.log(WEIGHT_CONVERSION.NAI_BASE));
  }

  /**
   * NAI形式の重みをSD形式に変換
   * @param {number} weight - NAI形式の重み
   * @param {boolean} truncate - 小数第2位で切り捨てするか（デフォルト: false）
   * @returns {number} SD形式の重み
   */
  static convertNAIToSD(weight, truncate = false) {
    const result = Math.pow(WEIGHT_CONVERSION.NAI_BASE, weight);
    
    if (truncate) {
      // 小数第2位で切り捨て
      return Math.floor(result * WEIGHT_CONVERSION.DECIMAL_PRECISION) / WEIGHT_CONVERSION.DECIMAL_PRECISION;
    }
    
    // 従来の処理（小数第2位で四捨五入）
    return parseFloat(result.toFixed(2));
  }

  /**
   * 重み値を指定された形式に変換
   * @param {number} weight - 元の重み値
   * @param {string} fromFormat - 元の形式 ('SD' | 'NAI')
   * @param {string} toFormat - 変換先の形式 ('SD' | 'NAI')
   * @param {boolean} truncate - NAI→SD変換時に小数第2位で切り捨てするか
   * @returns {number} 変換後の重み値
   */
  static convertWeight(weight, fromFormat, toFormat, truncate = false) {
    if (fromFormat === toFormat) return weight;
    
    if (fromFormat === 'SD' && toFormat === 'NAI') {
      return this.convertSDToNAI(weight);
    } else if (fromFormat === 'NAI' && toFormat === 'SD') {
      return this.convertNAIToSD(weight, truncate);
    }
    
    return weight;
  }

  /**
   * 重み設定を取得
   * @param {string} shaping - shaping設定 ('SD' | 'NAI' | 'None')
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
   * プロンプトに重み記法を適用
   * @param {string} type - shaping形式 ('SD' | 'NAI' | 'None')
   * @param {string} str - プロンプト文字列
   * @param {number} weight - 重み値
   * @returns {string} 重み記法が適用されたプロンプト
   */
  static applyWeightToPrompt(type, str, weight) {
    switch (type) {
      case "SD":
        if (weight <= 0 || weight === 1) return str;
        return `(${str}:${weight})`;
      case "NAI":
        if (weight === 0 || !isFinite(weight)) return str;
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
   * プロンプト文字列内の記法を変換
   * @param {string} prompt - 変換元のプロンプト文字列
   * @param {string} fromFormat - 元の記法形式 ('SD' | 'NAI' | 'None')
   * @param {string} toFormat - 変換先の記法形式 ('SD' | 'NAI' | 'None')
   * @returns {string} 変換後のプロンプト文字列
   */
  static convertPromptNotation(prompt, fromFormat, toFormat) {
    if (!prompt || fromFormat === toFormat) return prompt;
    
    // None形式への変換は記法を除去
    if (toFormat === 'None') {
      return this.removeWeightNotation(prompt, fromFormat);
    }
    
    // None形式からの変換は記法が存在しないので元のプロンプトをそのまま返す
    if (fromFormat === 'None') {
      return prompt;
    }
    
    // SD → NAI変換
    if (fromFormat === 'SD' && toFormat === 'NAI') {
      return this.convertSDToNAINotation(prompt);
    }
    
    // NAI → SD変換
    if (fromFormat === 'NAI' && toFormat === 'SD') {
      return this.convertNAIToSDNotation(prompt);
    }
    
    return prompt;
  }

  /**
   * SD記法をNAI記法に変換
   * @param {string} prompt - SD記法のプロンプト
   * @returns {string} NAI記法に変換されたプロンプト
   */
  static convertSDToNAINotation(prompt) {
    // SD記法のパターン: (text:weight)
    return prompt.replace(/\(([^:()]+):([0-9.]+)\)/g, (match, text, weight) => {
      const sdWeight = parseFloat(weight);
      const naiWeight = this.convertSDToNAI(sdWeight);
      
      if (naiWeight === 0) {
        return text; // 重み0の場合は記法を除去
      }
      
      const brackets = naiWeight > 0 ? '{}' : '[]';
      const absWeight = Math.min(Math.abs(naiWeight), 10);
      return brackets[0].repeat(absWeight) + text + brackets[1].repeat(absWeight);
    });
  }

  /**
   * NAI記法をSD記法に変換
   * @param {string} prompt - NAI記法のプロンプト
   * @returns {string} SD記法に変換されたプロンプト
   */
  static convertNAIToSDNotation(prompt) {
    let result = prompt;
    
    // 正のNAI記法のパターン: {{{text}}}
    result = result.replace(/(\{+)([^{}]+)(\}+)/g, (match, openBrackets, text, closeBrackets) => {
      const weight = Math.min(openBrackets.length, closeBrackets.length);
      const sdWeight = this.convertNAIToSD(weight);
      
      if (sdWeight === 1) {
        return text; // 重み1の場合は記法を除去
      }
      
      return `(${text}:${sdWeight})`;
    });
    
    // 負のNAI記法のパターン: [[[text]]]
    result = result.replace(/(\[+)([^\[\]]+)(\]+)/g, (match, openBrackets, text, closeBrackets) => {
      const weight = Math.min(openBrackets.length, closeBrackets.length);
      const sdWeight = this.convertNAIToSD(-weight);
      
      if (sdWeight === 1) {
        return text; // 重み1の場合は記法を除去
      }
      
      return `(${text}:${sdWeight})`;
    });
    
    return result;
  }

  /**
   * プロンプト文字列から重み記法を除去
   * @param {string} prompt - プロンプト文字列
   * @param {string} format - 記法形式 ('SD' | 'NAI')
   * @returns {string} 重み記法が除去されたプロンプト
   */
  static removeWeightNotation(prompt, format) {
    let result = prompt;
    
    if (format === 'SD') {
      // SD記法を除去: (text:weight) → text
      result = result.replace(/\(([^:()]+):([0-9.]+)\)/g, '$1');
    } else if (format === 'NAI') {
      // NAI記法を除去: {{{text}}} → text, [[[text]]] → text
      result = result.replace(/(\{+)([^{}]+)(\}+)/g, '$2');
      result = result.replace(/(\[+)([^\[\]]+)(\]+)/g, '$2');
    }
    
    return result;
  }
}

// グローバルに公開
window.WeightConverter = WeightConverter;