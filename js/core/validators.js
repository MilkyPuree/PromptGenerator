/**
 * バリデーションモジュール
 * 高性能で拡張可能なバリデーションシステム
 */
const Validators = {
  /**
   * バリデーション結果のキャッシュ（パフォーマンス最適化）
   */
  _cache: new Map(),

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this._cache.clear();
  },

  /**
   * 空文字チェック
   * @param {string} value - 検証する値
   * @param {string} [fieldName] - フィールド名
   * @returns {Object} 検証結果
   */
  required(value, fieldName = VALIDATION_MESSAGES.DEFAULT_FIELD) {
    const trimmedValue = value ? value.trim() : "";
    const isValid = trimmedValue.length > 0;

    return {
      isValid,
      message: isValid
        ? ""
        : VALIDATION_MESSAGES.REQUIRED.replace("{fieldName}", fieldName),
      value: trimmedValue, // トリムした値を返す
    };
  },

  /**
   * 最小長チェック
   * @param {string} value - 検証する値
   * @param {number} minLength - 最小長
   * @param {string} [fieldName] - フィールド名
   * @returns {Object} 検証結果
   */
  minLength(value, minLength, fieldName = VALIDATION_MESSAGES.DEFAULT_FIELD) {
    const length = value ? value.length : 0;
    const isValid = length >= minLength;

    return {
      isValid,
      message: isValid
        ? ""
        : VALIDATION_MESSAGES.MIN_LENGTH.replace("{fieldName}", fieldName)
            .replace("{minLength}", minLength)
            .replace("{length}", length),
    };
  },

  /**
   * 最大長チェック
   * @param {string} value - 検証する値
   * @param {number} maxLength - 最大長
   * @param {string} [fieldName] - フィールド名
   * @returns {Object} 検証結果
   */
  maxLength(value, maxLength, fieldName = "フィールド") {
    const length = value ? value.length : 0;
    const isValid = length <= maxLength;

    return {
      isValid,
      message: isValid
        ? ""
        : `${fieldName}は${maxLength}文字以内で入力してください（現在${length}文字）`,
    };
  },

  /**
   * 範囲チェック
   * @param {string} value - 検証する値
   * @param {number} min - 最小値
   * @param {number} max - 最大値
   * @param {string} [fieldName] - フィールド名
   * @returns {Object} 検証結果
   */
  range(value, min, max, fieldName = "値") {
    const numValue = parseFloat(value);
    const isValid = !isNaN(numValue) && numValue >= min && numValue <= max;

    return {
      isValid,
      message: isValid
        ? ""
        : `${fieldName}は${min}から${max}の範囲で入力してください`,
      numericValue: isValid ? numValue : null,
    };
  },

  /**
   * パターンマッチング
   * @param {string} value - 検証する値
   * @param {RegExp|string} pattern - 正規表現パターン
   * @param {string} [message] - エラーメッセージ
   * @returns {Object} 検証結果
   */
  pattern(value, pattern, message = "入力形式が正しくありません") {
    if (!value) {
      return { isValid: true, message: "" };
    }

    // パターンをRegExpオブジェクトに変換
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    // キャッシュキーを生成
    const cacheKey = `pattern_${value}_${regex.toString()}`;

    // キャッシュをチェック
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const isValid = regex.test(value);
    const result = {
      isValid,
      message: isValid ? "" : message,
      matches: isValid ? value.match(regex) : null,
    };

    // 結果をキャッシュ
    this._cache.set(cacheKey, result);

    return result;
  },

  /**
   * プロンプトの重複チェック
   * @param {Object} newItem - 新しいアイテム
   * @param {Array} existingList - 既存のリスト
   * @returns {Object} 検証結果
   */
  checkDuplicatePrompt(newItem, existingList) {
    if (!newItem || !existingList || existingList.length === 0) {
      return { isValid: true, message: "" };
    }

    // 比較用のキーを生成（パフォーマンス最適化）
    const newKey = this._generatePromptKey(newItem);

    // Set を使用して高速検索
    const existingKeys = new Set(
      existingList.map((item) => this._generatePromptKey(item))
    );

    const isDuplicate = existingKeys.has(newKey);

    return {
      isValid: !isDuplicate,
      message: isDuplicate ? "既に同じ要素が追加されています" : "",
      duplicate: isDuplicate
        ? existingList.find((item) => this._generatePromptKey(item) === newKey)
        : null,
    };
  },

  /**
   * プロンプトキーを生成（内部使用）
   * @private
   */
  _generatePromptKey(item) {
    return `${item.prompt || ""}${item.data?.[0] || ""}${item.data?.[1] || ""}${
      item.data?.[2] || ""
    }`;
  },

  /**
   * プロンプト辞書の重複チェック
   * @param {string} prompt - プロンプト
   * @param {Array} promptList - プロンプトリスト
   * @returns {Object} 検証結果
   */
  checkDuplicateFavorite(prompt, promptList) {
    if (!prompt || !promptList || promptList.length === 0) {
      return { isValid: true, message: "" };
    }

    const duplicate = promptList.find((item) => item.prompt === prompt);

    return {
      isValid: !duplicate,
      message: duplicate
        ? `既に同じプロンプトが追加されています。名前：${duplicate.title}`
        : "",
      duplicate,
    };
  },

  /**
   * カテゴリー入力の検証
   * @param {Object} categories - { big, middle, small }
   * @returns {Object} 検証結果
   */
  validateCategories(categories) {
    const errors = [];
    const maxLength = 50;

    // カテゴリー名の配列
    const categoryNames = ["大カテゴリー", "中カテゴリー", "小カテゴリー"];
    const categoryKeys = ["big", "middle", "small"];

    categoryKeys.forEach((key, index) => {
      const value = categories[key];

      if (value) {
        // 長さチェック
        if (value.length > maxLength) {
          errors.push({
            field: key,
            message: `${categoryNames[index]}は${maxLength}文字以内で入力してください`,
          });
        }

        // 不正な文字チェック
        if (this._containsInvalidChars(value)) {
          errors.push({
            field: key,
            message: `${categoryNames[index]}に使用できない文字が含まれています`,
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * プロンプト文字列の検証
   * @param {string} prompt - プロンプト
   * @returns {Object} 検証結果
   */
  validatePrompt(prompt) {
    const errors = [];

    // 必須チェック
    const requiredCheck = this.required(prompt, "プロンプト");
    if (!requiredCheck.isValid) {
      errors.push({
        field: "prompt",
        message: requiredCheck.message,
      });
      return { isValid: false, errors };
    }

    // 長さチェック
    const maxLengthCheck = this.maxLength(prompt, 500, "プロンプト");
    if (!maxLengthCheck.isValid) {
      errors.push({
        field: "prompt",
        message: maxLengthCheck.message,
      });
    }

    // 不正な文字のチェック
    if (this._containsInvalidChars(prompt)) {
      errors.push({
        field: "prompt",
        message: "使用できない文字が含まれています",
      });
    }

    // 特殊な構文チェック
    const syntaxCheck = this._validatePromptSyntax(prompt);
    if (!syntaxCheck.isValid) {
      errors.push({
        field: "prompt",
        message: syntaxCheck.message,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: syntaxCheck.warnings || [],
    };
  },

  /**
   * プロンプトの構文チェック
   * @private
   */
  _validatePromptSyntax(prompt) {
    const warnings = [];
    let isValid = true;
    let message = "";

    // 括弧の対応チェック
    const brackets = {
      "(": ")",
      "[": "]",
      "{": "}",
    };

    const stack = [];
    for (const char of prompt) {
      if (brackets[char]) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const expectedOpening = Object.keys(brackets).find(
          (key) => brackets[key] === char
        );
        const lastOpening = stack.pop();

        if (lastOpening !== expectedOpening) {
          isValid = false;
          message = "括弧の対応が正しくありません";
          break;
        }
      }
    }

    if (stack.length > 0 && isValid) {
      isValid = false;
      message = "閉じられていない括弧があります";
    }

    // 推奨事項のチェック
    if (prompt.includes("  ")) {
      warnings.push("連続したスペースが含まれています");
    }

    if (prompt.startsWith(",") || prompt.endsWith(",")) {
      warnings.push("先頭または末尾のカンマは不要です");
    }

    return { isValid, message, warnings };
  },

  /**
   * 不正な文字のチェック
   * @private
   */
  _containsInvalidChars(str) {
    // 制御文字をチェック
    const invalidChars = /[\x00-\x1F\x7F]/;
    return invalidChars.test(str);
  },

  /**
   * 重み値の検証
   * @param {string} weight - 重み値
   * @param {string} [mode='SD'] - モード（SD/NAI）
   * @returns {Object} 検証結果
   */
  validateWeight(weight, mode = "SD") {
    if (!weight) {
      return { isValid: true, numericValue: mode === "SD" ? 1 : 0 };
    }

    const numWeight = parseFloat(weight);

    if (isNaN(numWeight)) {
      return {
        isValid: false,
        message: "重みは数値で入力してください",
      };
    }

    // モード別の範囲チェック
    const ranges = {
      SD: { min: 0.1, max: 10 },
      NAI: { min: -10, max: 10 },
    };

    const range = ranges[mode] || ranges.SD;

    if (numWeight < range.min || numWeight > range.max) {
      return {
        isValid: false,
        message: `重みは${range.min}から${range.max}の範囲で入力してください`,
      };
    }

    return {
      isValid: true,
      numericValue: numWeight,
      normalized: Math.round(numWeight * 100) / 100, // 小数点2桁に正規化
    };
  },

  /**
   * APIキーの検証
   * @param {string} apiKey - APIキー
   * @param {string} [keyType='API'] - キーの種類
   * @returns {Object} 検証結果
   */
  validateApiKey(apiKey, keyType = "API") {
    if (!apiKey) {
      return { isValid: true }; // 任意項目
    }

    const patterns = {
      DeepL:
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?::[a-z]{2})?$/i,
      OpenAI: /^sk-[a-zA-Z0-9]{48}$/,
      Generic: /^[a-zA-Z0-9_-]{10,}$/,
    };

    const pattern = patterns[keyType] || patterns.Generic;

    if (!pattern.test(apiKey)) {
      return {
        isValid: false,
        message: `${keyType} APIキーの形式が正しくありません`,
      };
    }

    return { isValid: true };
  },

  /**
   * ファイルタイプの検証
   * @param {File} file - ファイルオブジェクト
   * @param {string[]} allowedTypes - 許可するMIMEタイプ
   * @returns {Object} 検証結果
   */
  validateFileType(file, allowedTypes) {
    const isValid = allowedTypes.includes(file.type);
    return {
      isValid,
      message: isValid
        ? ""
        : `対応していないファイル形式です。対応形式: ${allowedTypes.join(
            ", "
          )}`,
      detectedType: file.type,
    };
  },

  /**
   * ファイルサイズの検証
   * @param {File} file - ファイルオブジェクト
   * @param {number} maxSizeMB - 最大サイズ（MB）
   * @returns {Object} 検証結果
   */
  validateFileSize(file, maxSizeMB) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const isValid = file.size <= maxSizeBytes;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    return {
      isValid,
      message: isValid
        ? ""
        : `ファイルサイズは${maxSizeMB}MB以下にしてください（現在${fileSizeMB}MB）`,
      size: file.size,
      sizeMB: parseFloat(fileSizeMB),
    };
  },

  /**
   * 複合検証の実行
   * @param {Object} data - 検証データ
   * @param {Object} rules - 検証ルール
   * @returns {Object} 検証結果
   */
  validate(data, rules) {
    const errors = [];
    const warnings = [];
    const validatedData = {};

    // 並列処理可能な検証を特定
    const validationPromises = [];

    Object.entries(rules).forEach(([field, fieldRules]) => {
      const value = data[field];
      validatedData[field] = value;

      fieldRules.forEach((rule) => {
        const validationTask = () => {
          let result;

          switch (rule.type) {
            case "required":
              result = this.required(value, rule.fieldName || field);
              break;
            case "minLength":
              result = this.minLength(value, rule.min, rule.fieldName || field);
              break;
            case "maxLength":
              result = this.maxLength(value, rule.max, rule.fieldName || field);
              break;
            case "range":
              result = this.range(
                value,
                rule.min,
                rule.max,
                rule.fieldName || field
              );
              break;
            case "pattern":
              result = this.pattern(value, rule.pattern, rule.message);
              break;
            case "custom":
              result = rule.validator(value, data);
              break;
            default:
              result = { isValid: true };
          }

          // 検証後の値を保存
          if (result.value !== undefined) {
            validatedData[field] = result.value;
          } else if (result.numericValue !== undefined) {
            validatedData[field] = result.numericValue;
          }

          if (!result.isValid) {
            errors.push({
              field,
              message: result.message,
              type: rule.type,
            });
          }

          if (result.warnings) {
            warnings.push(
              ...result.warnings.map((w) => ({
                field,
                message: w,
              }))
            );
          }
        };

        // 非同期検証の場合
        if (rule.async) {
          validationPromises.push(Promise.resolve().then(validationTask));
        } else {
          validationTask();
        }
      });
    });

    // 非同期検証を待つ
    if (validationPromises.length > 0) {
      return Promise.all(validationPromises).then(() => ({
        isValid: errors.length === 0,
        errors,
        warnings,
        data: validatedData,
      }));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: validatedData,
    };
  },

  /**
   * エラーメッセージをフォーマット
   * @param {Array} errors - エラー配列
   * @returns {string} フォーマットされたメッセージ
   */
  formatErrors(errors) {
    if (!errors || errors.length === 0) {
      return "";
    }

    return errors.map((error) => `• ${error.message}`).join("\n");
  },
};

// 便利な検証ルールのプリセット
Validators.Rules = {
  /**
   * プロンプト要素の検証ルール
   */
  promptElement: {
    prompt: [
      { type: "required", fieldName: "プロンプト" },
      { type: "maxLength", max: 500, fieldName: "プロンプト" },
      {
        type: "custom",
        validator: (value) => {
          const result = Validators._validatePromptSyntax(value);
          return { isValid: result.isValid, message: result.message };
        },
      },
    ],
  },

  /**
   * プロンプト辞書の検証ルール
   */
  favorite: {
    title: [
      { type: "maxLength", max: 100, fieldName: "タイトル" },
      {
        type: "pattern",
        pattern: /^[^\\/:*?"<>|]*$/,
        message: "タイトルに使用できない文字が含まれています",
      },
    ],
    prompt: [
      { type: "required", fieldName: "プロンプト" },
      { type: "maxLength", max: 1000, fieldName: "プロンプト" },
    ],
  },

  /**
   * 設定の検証ルール
   */
  settings: {
    deeplAuthKey: [
      {
        type: "custom",
        validator: (value) => Validators.validateApiKey(value, "DeepL"),
      },
    ],
  },

  /**
   * カテゴリーの検証ルール
   */
  category: {
    big: [{ type: "maxLength", max: 50, fieldName: "大カテゴリー" }],
    middle: [{ type: "maxLength", max: 50, fieldName: "中カテゴリー" }],
    small: [{ type: "maxLength", max: 50, fieldName: "小カテゴリー" }],
  },
};

// 簡単なバリデーションヘルパー（よく使われるパターン）
Validators.Quick = {
  /**
   * プロンプトの空チェック（最頻出パターン）
   * @param {string} prompt - プロンプト文字列
   * @returns {boolean} 有効かどうか
   */
  isValidPrompt(prompt) {
    return !!(prompt && prompt.trim());
  },

  /**
   * 複数値の必須チェック（辞書タブでよく使用）
   * @param {...string} values - チェックする値
   * @returns {boolean} すべて有効かどうか
   */
  allRequired(...values) {
    return values.every((value) => !!(value && value.toString().trim()));
  },

  /**
   * 値の存在チェック（リスト管理でよく使用）
   * @param {any} value - チェックする値
   * @returns {boolean} 有効かどうか
   */
  hasValue(value) {
    return !!(value && value.toString().trim());
  },

  /**
   * 名前のチェック（作成処理でよく使用）
   * @param {string} name - 名前
   * @returns {boolean} 有効かどうか
   */
  isValidName(name) {
    return !!(name && name.trim());
  },

  /**
   * カテゴリと組み合わせのチェック
   * @param {string} category - カテゴリ
   * @param {string} prompt - プロンプト
   * @returns {boolean} 有効な組み合わせかどうか
   */
  isValidCategoryPromptPair(category, prompt) {
    return !category && prompt && prompt.trim();
  },
};

// バリデーション結果付きヘルパー（エラーメッセージも返す）
Validators.Checked = {
  /**
   * プロンプトの検証（結果付き）
   * @param {string} prompt - プロンプト文字列
   * @param {string} [fieldName='プロンプト'] - フィールド名
   * @returns {Object} {isValid, message, value}
   */
  prompt(prompt, fieldName = "プロンプト") {
    if (!prompt || !prompt.trim()) {
      return {
        isValid: false,
        message: `${fieldName}を入力してください`,
        value: "",
      };
    }
    return {
      isValid: true,
      message: "",
      value: prompt.trim(),
    };
  },

  /**
   * 複数値の必須検証（結果付き）
   * @param {Object} values - {fieldName: value} の形式
   * @returns {Object} {isValid, errors, validatedData}
   */
  multipleRequired(values) {
    const errors = [];
    const validatedData = {};

    Object.entries(values).forEach(([fieldName, value]) => {
      if (!value || !value.toString().trim()) {
        errors.push({
          field: fieldName,
          message: `${fieldName}を入力してください`,
        });
        validatedData[fieldName] = "";
      } else {
        validatedData[fieldName] = value.toString().trim();
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      validatedData,
    };
  },

  /**
   * 名前の検証（結果付き）
   * @param {string} name - 名前
   * @param {string} [fieldName='名前'] - フィールド名
   * @returns {Object} {isValid, message, value}
   */
  name(name, fieldName = "名前") {
    if (!name || !name.trim()) {
      return {
        isValid: false,
        message: `${fieldName}を入力してください`,
        value: "",
      };
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return {
        isValid: false,
        message: `${fieldName}は100文字以内で入力してください`,
        value: trimmedName,
      };
    }

    return {
      isValid: true,
      message: "",
      value: trimmedName,
    };
  },
};

// 便利なバリデーションヘルパー
Validators.Helpers = {
  /**
   * 日本語入力のサニタイズ
   * @param {string} input - 入力文字列
   * @returns {string} サニタイズ済み文字列
   */
  sanitizeJapanese(input) {
    return input
      .replace(/[！-／：-＠［-｀｛-～]/g, (match) => {
        // 全角記号を半角に変換
        const code = match.charCodeAt(0);
        return String.fromCharCode(code - 0xfee0);
      })
      .trim();
  },

  /**
   * プロンプトの正規化
   * @param {string} prompt - プロンプト文字列
   * @returns {string} 正規化済みプロンプト
   */
  normalizePrompt(prompt) {
    return prompt
      .replace(/\s+/g, " ") // 連続スペースを単一スペースに
      .replace(/,\s*,/g, ",") // 連続カンマを削除
      .replace(/^\s*,\s*/, "") // 先頭のカンマを削除
      .replace(/\s*,\s*$/, "") // 末尾のカンマを削除
      .trim();
  },
};

// グローバルに公開
if (typeof window !== "undefined") {
  window.Validators = Validators;
}
