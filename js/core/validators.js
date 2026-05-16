const Validators = {
  _cache: new Map(),

  clearCache() {
    this._cache.clear();
  },

  required(value, fieldName = VALIDATION_MESSAGES.DEFAULT_FIELD) {
    const trimmedValue = value ? value.trim() : "";
    const isValid = trimmedValue.length > 0;

    return {
      isValid,
      message: isValid ? "" : VALIDATION_MESSAGES.REQUIRED.replace("{fieldName}", fieldName),
      value: trimmedValue, // トリムした値を返す
    };
  },

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

  maxLength(value, maxLength, fieldName = "フィールド") {
    const length = value ? value.length : 0;
    const isValid = length <= maxLength;

    return {
      isValid,
      message: isValid ? "" : `${fieldName}は${maxLength}文字以内で入力してください（現在${length}文字）`,
    };
  },

  range(value, min, max, fieldName = "値") {
    const numValue = parseFloat(value);
    const isValid = !isNaN(numValue) && numValue >= min && numValue <= max;

    return {
      isValid,
      message: isValid ? "" : `${fieldName}は${min}から${max}の範囲で入力してください`,
      numericValue: isValid ? numValue : null,
    };
  },

  pattern(value, pattern, message = "入力形式が正しくありません") {
    if (!value) {
      return { isValid: true, message: "" };
    }

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    const cacheKey = `pattern_${value}_${regex.toString()}`;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const isValid = regex.test(value);
    const result = {
      isValid,
      message: isValid ? "" : message,
      matches: isValid ? value.match(regex) : null,
    };

    this._cache.set(cacheKey, result);

    return result;
  },

  checkDuplicatePrompt(newItem, existingList) {
    if (!newItem || !existingList || existingList.length === 0) {
      return { isValid: true, message: "" };
    }

    const newKey = this._generatePromptKey(newItem);

    const existingKeys = new Set(existingList.map((item) => this._generatePromptKey(item)));

    const isDuplicate = existingKeys.has(newKey);

    return {
      isValid: !isDuplicate,
      message: isDuplicate ? "既に同じ要素が追加されています" : "",
      duplicate: isDuplicate ? existingList.find((item) => this._generatePromptKey(item) === newKey) : null,
    };
  },

  _generatePromptKey(item) {
    return `${item.prompt || ""}${item.data?.[0] || ""}${item.data?.[1] || ""}${item.data?.[2] || ""}`;
  },

  checkDuplicateFavorite(prompt, promptList) {
    if (!prompt || !promptList || promptList.length === 0) {
      return { isValid: true, message: "" };
    }

    const duplicate = promptList.find((item) => item.prompt === prompt);

    return {
      isValid: !duplicate,
      message: duplicate ? `既に同じプロンプトが追加されています。名前：${duplicate.title}` : "",
      duplicate,
    };
  },

  validateCategories(categories) {
    const errors = [];
    const maxLength = 50;

    const categoryNames = ["大カテゴリー", "中カテゴリー", "小カテゴリー"];
    const categoryKeys = ["big", "middle", "small"];

    categoryKeys.forEach((key, index) => {
      const value = categories[key];

      if (value) {
        if (value.length > maxLength) {
          errors.push({
            field: key,
            message: `${categoryNames[index]}は${maxLength}文字以内で入力してください`,
          });
        }

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

  validatePrompt(prompt) {
    const errors = [];

    const requiredCheck = this.required(prompt, "プロンプト");
    if (!requiredCheck.isValid) {
      errors.push({
        field: "prompt",
        message: requiredCheck.message,
      });
      return { isValid: false, errors };
    }

    const maxLengthCheck = this.maxLength(prompt, 500, "プロンプト");
    if (!maxLengthCheck.isValid) {
      errors.push({
        field: "prompt",
        message: maxLengthCheck.message,
      });
    }

    if (this._containsInvalidChars(prompt)) {
      errors.push({
        field: "prompt",
        message: "使用できない文字が含まれています",
      });
    }

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
        const expectedOpening = Object.keys(brackets).find((key) => brackets[key] === char);
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

    if (prompt.includes("  ")) {
      warnings.push("連続したスペースが含まれています");
    }

    if (prompt.startsWith(",") || prompt.endsWith(",")) {
      warnings.push("先頭または末尾のカンマは不要です");
    }

    return { isValid, message, warnings };
  },

  _containsInvalidChars(str) {
    const invalidChars = /[\x00-\x1F\x7F]/;
    return invalidChars.test(str);
  },

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

  validateApiKey(apiKey, keyType = "API") {
    if (!apiKey) {
      return { isValid: true }; // 任意項目
    }

    const patterns = {
      DeepL: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?::[a-z]{2})?$/i,
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

  validateFileType(file, allowedTypes) {
    const isValid = allowedTypes.includes(file.type);
    return {
      isValid,
      message: isValid ? "" : `対応していないファイル形式です。対応形式: ${allowedTypes.join(", ")}`,
      detectedType: file.type,
    };
  },

  validateFileSize(file, maxSizeMB) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const isValid = file.size <= maxSizeBytes;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    return {
      isValid,
      message: isValid ? "" : `ファイルサイズは${maxSizeMB}MB以下にしてください（現在${fileSizeMB}MB）`,
      size: file.size,
      sizeMB: parseFloat(fileSizeMB),
    };
  },

  validate(data, rules) {
    const errors = [];
    const warnings = [];
    const validatedData = {};

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
              result = this.range(value, rule.min, rule.max, rule.fieldName || field);
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

        if (rule.async) {
          validationPromises.push(Promise.resolve().then(validationTask));
        } else {
          validationTask();
        }
      });
    });

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

  formatErrors(errors) {
    if (!errors || errors.length === 0) {
      return "";
    }

    return errors.map((error) => `• ${error.message}`).join("\n");
  },
};

Validators.Rules = {
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

  settings: {
    deeplAuthKey: [
      {
        type: "custom",
        validator: (value) => Validators.validateApiKey(value, "DeepL"),
      },
    ],
  },

  category: {
    big: [{ type: "maxLength", max: 50, fieldName: "大カテゴリー" }],
    middle: [{ type: "maxLength", max: 50, fieldName: "中カテゴリー" }],
    small: [{ type: "maxLength", max: 50, fieldName: "小カテゴリー" }],
  },
};

Validators.Quick = {
  isValidPrompt(prompt) {
    return !!(prompt && prompt.trim());
  },

  allRequired(...values) {
    return values.every((value) => !!(value && value.toString().trim()));
  },

  hasValue(value) {
    return !!(value && value.toString().trim());
  },

  isValidName(name) {
    return !!(name && name.trim());
  },

  isValidCategoryPromptPair(category, prompt) {
    return !category && prompt && prompt.trim();
  },
};

Validators.Checked = {
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

Validators.Helpers = {
  sanitizeJapanese(input) {
    return input
      .replace(/[！-／：-＠［-｀｛-～]/g, (match) => {
        const code = match.charCodeAt(0);
        return String.fromCharCode(code - 0xfee0);
      })
      .trim();
  },

  normalizePrompt(prompt) {
    return prompt
      .replace(/\s+/g, " ") // 連続スペースを単一スペースに
      .replace(/,\s*,/g, ",") // 連続カンマを削除
      .replace(/^\s*,\s*/, "") // 先頭のカンマを削除
      .replace(/\s*,\s*$/, "") // 末尾のカンマを削除
      .trim();
  },
};

if (typeof window !== "undefined") {
  window.Validators = Validators;
}
