// プロンプト文字列⇔要素配列の純粋関数（mercury-studio elementSync.ts からの移植）
// WeightConverter（既存）と連携、NAIv45記法も保持

(function () {
  "use strict";

  // 拡張機能の要素スキーマに合わせたデフォルト weight
  // NAIv45 は直接乗算なので 1.0 が無重み（他フォーマットは 0 が無重み）
  const DEFAULT_WEIGHTS = Object.freeze({
    SD: { weight: 0 },
    NAI: { weight: 0 },
    NAIv45: { weight: 1 },
    None: { weight: 0 },
  });

  let _idCounter = 0;
  const generateId = () => {
    _idCounter += 1;
    return Date.now() + Math.random() + _idCounter;
  };

  const buildDefaultWeights = () => ({
    SD: { weight: DEFAULT_WEIGHTS.SD.weight },
    NAI: { weight: DEFAULT_WEIGHTS.NAI.weight },
    NAIv45: { weight: DEFAULT_WEIGHTS.NAIv45.weight },
    None: { weight: DEFAULT_WEIGHTS.None.weight },
  });

  const cloneElement = (el) => {
    const cloned = {
      id: el.id,
      sort: el.sort,
      Value: el.Value,
      data: Array.isArray(el.data) ? [el.data[0] || "", el.data[1] || "", el.data[2] || ""] : ["", "", ""],
      SD: { weight: el.SD?.weight ?? DEFAULT_WEIGHTS.SD.weight },
      NAI: { weight: el.NAI?.weight ?? DEFAULT_WEIGHTS.NAI.weight },
      NAIv45: { weight: el.NAIv45?.weight ?? DEFAULT_WEIGHTS.NAIv45.weight },
      None: { weight: el.None?.weight ?? DEFAULT_WEIGHTS.None.weight },
    };
    for (const key of Object.keys(el)) {
      if (!(key in cloned)) cloned[key] = el[key];
    }
    return cloned;
  };

  const parsePromptValues = (prompt) => {
    if (typeof prompt !== "string") return [];
    return prompt
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  };

  const lookupData = (value, promptMap) => {
    if (!promptMap || typeof promptMap.get !== "function") return ["", "", ""];
    const entry = promptMap.get(value);
    if (!entry) return ["", "", ""];
    return [entry[0] || "", entry[1] || "", entry[2] || ""];
  };

  const buildPromptMap = (dictionaryEntries) => {
    const map = new Map();
    if (!Array.isArray(dictionaryEntries)) return map;
    for (const entry of dictionaryEntries) {
      if (!entry || typeof entry.prompt !== "string") continue;
      const key = entry.prompt;
      if (!key || map.has(key)) continue;
      const data = Array.isArray(entry.data)
        ? [entry.data[0] || "", entry.data[1] || "", entry.data[2] || ""]
        : ["", "", ""];
      map.set(key, data);
    }
    return map;
  };

  const parseWeightFromValue = (rawValue, shapingFormat) => {
    if (typeof WeightConverter === "undefined" || typeof WeightConverter.parseFirstWeight !== "function") {
      return { value: typeof rawValue === "string" ? rawValue.trim() : "", weight: null, format: null };
    }
    const info = WeightConverter.parseFirstWeight(rawValue);
    if (!info) {
      return { value: typeof rawValue === "string" ? rawValue.trim() : "", weight: null, format: null };
    }
    return { value: info.bareText, weight: info.weight, format: info.format };
  };

  // 抽出した重みを現在の shaping にマッピングする。
  // フォーマットが一致しない場合は WeightConverter.convertWeight で換算（SD/NAIv45 は乗算系で 1:1）
  const resolveWeightForShaping = (weight, fromFormat, shaping) => {
    if (weight === null || weight === undefined) return null;
    if (shaping === "None") return null;
    if (!fromFormat || fromFormat === shaping) return weight;
    if (typeof WeightConverter === "undefined" || typeof WeightConverter.convertWeight !== "function") {
      return weight;
    }
    return WeightConverter.convertWeight(weight, fromFormat, shaping);
  };

  const hasData = (data) => Array.isArray(data) && (data[0] || data[1] || data[2]);

  const smartSyncElements = (prompt, existingElements, promptMap, shapingFormat) => {
    const rawValues = parsePromptValues(prompt);
    if (rawValues.length === 0) return [];

    const safeExisting = Array.isArray(existingElements) ? existingElements : [];
    const normalElements = safeExisting.filter((el) => el && (!el.mode || el.mode === "normal"));

    const existingByValue = new Map();
    for (const el of normalElements) {
      if (!el || typeof el.Value !== "string") continue;
      const key = el.Value;
      const list = existingByValue.get(key) || [];
      list.push(el);
      existingByValue.set(key, list);
    }

    const matchedIds = new Set();

    const syncedElements = rawValues.map((rawValue, index) => {
      const parsed = parseWeightFromValue(rawValue, shapingFormat);
      const value = parsed.value;
      const resolvedWeight = resolveWeightForShaping(parsed.weight, parsed.format, shapingFormat);

      const matches = existingByValue.get(value);
      if (matches && matches.length > 0) {
        const existing = matches.shift();
        matchedIds.add(existing.id);
        const result = cloneElement(existing);
        result.Value = value;
        result.sort = index;
        if (!hasData(result.data)) {
          result.data = lookupData(value, promptMap);
        }
        if (resolvedWeight !== null && shapingFormat && shapingFormat !== "None") {
          result[shapingFormat] = { ...(result[shapingFormat] || { weight: 0 }), weight: resolvedWeight };
        }
        return result;
      }

      const newEl = {
        id: generateId(),
        sort: index,
        Value: value,
        data: lookupData(value, promptMap),
        ...buildDefaultWeights(),
      };
      if (resolvedWeight !== null && shapingFormat && shapingFormat !== "None") {
        newEl[shapingFormat] = { weight: resolvedWeight };
      }
      return newEl;
    });

    const orphaned = normalElements
      .filter((el) => el && !matchedIds.has(el.id) && !el.Value && hasData(el.data))
      .map((el) => cloneElement(el));

    return [...syncedElements, ...orphaned];
  };

  const autoRepairElements = (elements, allPrompts) => {
    let hasChanges = false;
    const safeElements = Array.isArray(elements) ? elements : [];
    const safePrompts = Array.isArray(allPrompts) ? allPrompts : [];

    const repaired = safeElements.map((el) => {
      if (!el) return el;
      const value = typeof el.Value === "string" ? el.Value : "";
      if (value || !hasData(el.data)) return el;

      const [big, middle, small] = el.data;
      let match = safePrompts.find(
        (p) => p && p.data && p.data[0] === big && p.data[1] === middle && p.data[2] === small
      );
      if (!match && small) {
        match = safePrompts.find((p) => p && p.data && p.data[2] === small);
      }
      if (!match && middle) {
        match = safePrompts.find((p) => p && p.data && p.data[1] === middle);
      }

      if (match && match.prompt) {
        hasChanges = true;
        const cloned = cloneElement(el);
        cloned.Value = match.prompt;
        cloned.data = Array.isArray(match.data)
          ? [match.data[0] || "", match.data[1] || "", match.data[2] || ""]
          : ["", "", ""];
        return cloned;
      }
      return el;
    });

    return { repaired, hasChanges };
  };

  window.ElementSync = {
    parsePromptValues,
    lookupData,
    smartSyncElements,
    autoRepairElements,
    buildPromptMap,
  };
})();
