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
   * SD と NAIv45 はどちらも「直接乗算」の数値なので 1:1 マッピング。
   * NAI(旧括弧) ↔ NAIv45 は SD ↔ NAI と同じ式（1.05^n / log_1.05）。
   * @param {number} weight - 元の重み値
   * @param {string} fromFormat - 元の形式 ('SD' | 'NAI' | 'NAIv45')
   * @param {string} toFormat - 変換先の形式 ('SD' | 'NAI' | 'NAIv45')
   * @param {boolean} truncate - 小数第2位で切り捨てするか（NAI → 乗算系のみ）
   * @returns {number} 変換後の重み値
   */
  static convertWeight(weight, fromFormat, toFormat, truncate = false) {
    if (fromFormat === toFormat) return weight;

    const isMultiplier = (f) => f === "SD" || f === "NAIv45";

    if (isMultiplier(fromFormat) && isMultiplier(toFormat)) {
      return weight;
    }

    if (fromFormat === "NAI" && isMultiplier(toFormat)) {
      return this.convertNAIToSD(weight, truncate);
    }

    if (isMultiplier(fromFormat) && toFormat === "NAI") {
      return this.convertSDToNAI(weight);
    }

    return weight;
  }

  /**
   * 重み設定を取得
   * @param {string} shaping - shaping設定 ('SD' | 'NAI' | 'NAIv45' | 'None')
   * @returns {Object} { delta, min, max }
   */
  static getWeightConfig(shaping) {
    if (!shaping) {
      // AppStateが利用可能な場合はそれを使用
      if (typeof AppState !== "undefined" && AppState.userSettings?.optionData?.shaping) {
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
    } else if (shaping === "NAIv45") {
      return { delta: 0.1, min: -10, max: 10 };
    } else {
      return { delta: 0, min: -10, max: 10 };
    }
  }

  /**
   * プロンプトに重み記法を適用
   * @param {string} type - shaping形式 ('SD' | 'NAI' | 'NAIv45' | 'None')
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
        return brackets[0].repeat(absWeight) + str + brackets[1].repeat(absWeight);
      case "NAIv45":
        // V4.5 数値強調: 1.0 は記法不要、その他は `WEIGHT::TEXT::`
        if (weight === 1 || !isFinite(weight)) return str;
        return `${weight}::${str}::`;
      case "None":
        return str;
      default:
        return str;
    }
  }

  /**
   * プロンプト文字列内の記法を変換
   * @param {string} prompt - 変換元のプロンプト文字列
   * @param {string} fromFormat - 元の記法形式 ('SD' | 'NAI' | 'NAIv45' | 'None')
   * @param {string} toFormat - 変換先の記法形式 ('SD' | 'NAI' | 'NAIv45' | 'None')
   * @returns {string} 変換後のプロンプト文字列
   */
  static convertPromptNotation(prompt, fromFormat, toFormat) {
    if (!prompt || fromFormat === toFormat) return prompt;

    if (toFormat === "None") {
      return this.removeWeightNotation(prompt, fromFormat);
    }

    if (fromFormat === "None") {
      return prompt;
    }

    if (fromFormat === "SD" && toFormat === "NAI") return this.convertSDToNAINotation(prompt);
    if (fromFormat === "NAI" && toFormat === "SD") return this.convertNAIToSDNotation(prompt);

    if (fromFormat === "SD" && toFormat === "NAIv45") return this.convertSDToNAIv45Notation(prompt);
    if (fromFormat === "NAIv45" && toFormat === "SD") return this.convertNAIv45ToSDNotation(prompt);

    if (fromFormat === "NAI" && toFormat === "NAIv45") return this.convertNAIToNAIv45Notation(prompt);
    if (fromFormat === "NAIv45" && toFormat === "NAI") return this.convertNAIv45ToNAINotation(prompt);

    return prompt;
  }

  /**
   * SD記法を NAIv45 数値強調記法に変換（SD と NAIv45 は同じ「直接乗算」なので値はそのまま）
   * @param {string} prompt
   * @returns {string}
   */
  static convertSDToNAIv45Notation(prompt) {
    return prompt.replace(/\(([^:()]+):(-?[0-9.]+)\)/g, (match, text, weight) => {
      const w = parseFloat(weight);
      if (w === 1) return text;
      return `${w}::${text}::`;
    });
  }

  /**
   * NAIv45 数値強調記法を SD記法に変換
   * @param {string} prompt
   * @returns {string}
   */
  static convertNAIv45ToSDNotation(prompt) {
    return prompt.replace(/(-?\d+(?:\.\d+)?)::([\s\S]+?)::/g, (match, weight, text) => {
      const w = parseFloat(weight);
      if (w === 1) return text;
      return `(${text.trim()}:${w})`;
    });
  }

  /**
   * NAI(旧括弧)記法を NAIv45 数値強調記法に変換（1.05^n 変換でマルチプライヤ化）
   * @param {string} prompt
   * @returns {string}
   */
  static convertNAIToNAIv45Notation(prompt) {
    let result = prompt;

    result = result.replace(/(\{+)([^{}]+)(\}+)/g, (match, opens, text, closes) => {
      const naiWeight = Math.min(opens.length, closes.length);
      const multiplier = this.convertNAIToSD(naiWeight);
      if (multiplier === 1) return text;
      return `${multiplier}::${text}::`;
    });

    result = result.replace(/(\[+)([^\[\]]+)(\]+)/g, (match, opens, text, closes) => {
      const naiWeight = -Math.min(opens.length, closes.length);
      const multiplier = this.convertNAIToSD(naiWeight);
      if (multiplier === 1) return text;
      return `${multiplier}::${text}::`;
    });

    return result;
  }

  /**
   * NAIv45 数値強調記法を NAI(旧括弧)記法に変換（log_1.05 変換）
   * @param {string} prompt
   * @returns {string}
   */
  static convertNAIv45ToNAINotation(prompt) {
    return prompt.replace(/(-?\d+(?:\.\d+)?)::([\s\S]+?)::/g, (match, weight, text) => {
      const trimmedText = text.trim();
      const naiWeight = this.convertSDToNAI(parseFloat(weight));
      if (naiWeight === 0) return trimmedText;
      const brackets = naiWeight > 0 ? "{}" : "[]";
      const absWeight = Math.min(Math.abs(naiWeight), 10);
      return brackets[0].repeat(absWeight) + trimmedText + brackets[1].repeat(absWeight);
    });
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

      const brackets = naiWeight > 0 ? "{}" : "[]";
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
   * プロンプト文字列内の混在記法を、指定 shaping に統一する。
   * - SD記法 `(text:N)`、NAI括弧 `{text}`/`[text]`、NAIv45 `N::text::` を検出
   * - target と異なる記法は convertPromptNotation で target に変換
   * - target が `None` の場合や記法が無い場合は元の文字列を返す
   * @param {string} prompt - 入力プロンプト
   * @param {string} targetShaping - 'SD' | 'NAI' | 'NAIv45' | 'None'
   * @returns {string} 正規化済みプロンプト
   */
  static normalizePromptToShaping(prompt, targetShaping) {
    if (!prompt || typeof prompt !== "string") return prompt;
    if (!targetShaping || targetShaping === "None") return prompt;

    let result = prompt;

    if (targetShaping !== "SD" && /\([^():]+:(-?[0-9.]+)\)/.test(result)) {
      result = this.convertPromptNotation(result, "SD", targetShaping);
    }

    if (targetShaping !== "NAI" && (/\{[^{}]+\}/.test(result) || /\[[^\[\]]+\]/.test(result))) {
      result = this.convertPromptNotation(result, "NAI", targetShaping);
    }

    if (targetShaping !== "NAIv45" && /-?\d+(?:\.\d+)?::[^:]+?::/.test(result)) {
      result = this.convertPromptNotation(result, "NAIv45", targetShaping);
    }

    return result;
  }

  /**
   * 単一の重み付きトークン（例: {{girls}} / [[bad]] / (girls:1.5) / 1.5::girls::）を分解する。
   * 部分一致は受け付けず、トリム後に文字列全体が記法に一致した時だけ結果を返す。
   * @param {string} text - 解析対象の文字列
   * @returns {{bareText: string, weight: number, format: 'NAI' | 'SD' | 'NAIv45'} | null}
   */
  static parseFirstWeight(text) {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const buildResult = (rawText, weight, format) => {
      const bareText = rawText.trim();
      if (!bareText) return null;
      return { bareText, weight, format };
    };

    // V4.5 数値強調 `WEIGHT::TEXT::` は NAI括弧との衝突がないので先に判定
    const naiv45Match = trimmed.match(/^(-?\d+(?:\.\d+)?)::([\s\S]+?)::$/);
    if (naiv45Match) {
      return buildResult(naiv45Match[2], parseFloat(naiv45Match[1]), "NAIv45");
    }

    const naiPositive = trimmed.match(/^(\{+)([^{}]+)(\}+)$/);
    if (naiPositive) {
      const weight = Math.min(naiPositive[1].length, naiPositive[3].length);
      return buildResult(naiPositive[2], weight, "NAI");
    }

    const naiNegative = trimmed.match(/^(\[+)([^\[\]]+)(\]+)$/);
    if (naiNegative) {
      const weight = -Math.min(naiNegative[1].length, naiNegative[3].length);
      return buildResult(naiNegative[2], weight, "NAI");
    }

    const sdMatch = trimmed.match(/^\(([^:()]+):(-?[0-9]+(?:\.[0-9]+)?)\)$/);
    if (sdMatch) {
      return buildResult(sdMatch[1], parseFloat(sdMatch[2]), "SD");
    }

    return null;
  }

  /**
   * プロンプト文字列から重み記法を除去
   * @param {string} prompt - プロンプト文字列
   * @param {string} format - 記法形式 ('SD' | 'NAI' | 'NAIv45')
   * @returns {string} 重み記法が除去されたプロンプト
   */
  static removeWeightNotation(prompt, format) {
    let result = prompt;

    if (format === "SD") {
      result = result.replace(/\(([^:()]+):(-?[0-9.]+)\)/g, "$1");
    } else if (format === "NAI") {
      result = result.replace(/(\{+)([^{}]+)(\}+)/g, "$2");
      result = result.replace(/(\[+)([^\[\]]+)(\]+)/g, "$2");
    } else if (format === "NAIv45") {
      result = result.replace(/(-?\d+(?:\.\d+)?)::([\s\S]+?)::/g, (match, weight, text) => text.trim());
    }

    return result;
  }
}

// グローバルに公開
window.WeightConverter = WeightConverter;
