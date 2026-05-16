// 3階層→2階層 データマイグレーション（mercury-studio promptImportExport.ts からの移植）
// 旧: SlotGroup → slots[] → elements[]（3階層）
// 新: SlotGroup → elements[]（2階層、modeが要素属性に）

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

  const buildDefaultWeights = () => ({
    SD: { weight: DEFAULT_WEIGHTS.SD.weight },
    NAI: { weight: DEFAULT_WEIGHTS.NAI.weight },
    NAIv45: { weight: DEFAULT_WEIGHTS.NAIv45.weight },
    None: { weight: DEFAULT_WEIGHTS.None.weight },
  });

  let _idCounter = 0;
  const generateId = () => {
    _idCounter += 1;
    return Date.now() + _idCounter;
  };

  const safeNumber = (value, fallback) => {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };

  const safeString = (value, fallback = "") => {
    return typeof value === "string" ? value : fallback;
  };

  const safeBoolean = (value, fallback = false) => {
    return typeof value === "boolean" ? value : fallback;
  };

  const cloneData = (data) => {
    if (!Array.isArray(data)) return ["", "", ""];
    return [safeString(data[0]), safeString(data[1]), safeString(data[2])];
  };

  const cloneCategory = (category) => {
    if (!category || typeof category !== "object") return { big: "", middle: "" };
    return {
      big: safeString(category.big),
      middle: safeString(category.middle),
    };
  };

  const normalizeWeights = (source) => {
    const result = buildDefaultWeights();
    if (!source || typeof source !== "object") return result;
    if (source.SD && typeof source.SD.weight === "number") result.SD.weight = source.SD.weight;
    if (source.NAI && typeof source.NAI.weight === "number") result.NAI.weight = source.NAI.weight;
    if (source.NAIv45 && typeof source.NAIv45.weight === "number") result.NAIv45.weight = source.NAIv45.weight;
    if (source.None && typeof source.None.weight === "number") result.None.weight = source.None.weight;
    return result;
  };

  const cloneElement = (el) => {
    if (!el || typeof el !== "object") {
      throw new Error("[PromptMigration] cloneElement: invalid element");
    }
    const weights = normalizeWeights(el);
    const cloned = {
      id: el.id ?? generateId(),
      sort: safeNumber(el.sort, 0),
      Value: safeString(el.Value),
      data: cloneData(el.data),
      SD: weights.SD,
      NAI: weights.NAI,
      NAIv45: weights.NAIv45,
      None: weights.None,
    };
    return cloned;
  };

  function detectSchemaVersion(slotGroup) {
    if (!slotGroup || typeof slotGroup !== "object") return 1;
    if (slotGroup.schemaVersion === 2) return 2;
    if (Array.isArray(slotGroup.elements)) return 2;
    if (Array.isArray(slotGroup.slots)) return 1;
    return 1;
  }

  function migrateSlotArrayToElements(slots) {
    if (!Array.isArray(slots)) return [];

    const result = [];

    slots.forEach((slot, slotIndex) => {
      if (!slot || typeof slot !== "object") return;

      const slotMode = safeString(slot.mode, "normal") || "normal";
      const slotMuted = safeBoolean(slot.muted, false);

      if (slotMode !== "normal") {
        // mode != normal のスロットは、スロット自体を1要素に変換
        // Value にスロットの prompt を格納し、mode 等の属性を要素フィールドとして保持
        const baseWeights = buildDefaultWeights();
        baseWeights.SD.weight = 1;
        const element = {
          id: slot.id ?? generateId(),
          sort: result.length,
          Value: safeString(slot.prompt),
          data: ["", "", ""],
          SD: baseWeights.SD,
          NAI: baseWeights.NAI,
          NAIv45: baseWeights.NAIv45,
          None: baseWeights.None,
          muted: slotMuted,
          mode: slotMode,
          category: cloneCategory(slot.category),
          sequentialIndex: safeNumber(slot.sequentialIndex, 0),
          currentExtraction: slot.currentExtraction ?? null,
        };
        result.push(element);
        return;
      }

      // mode == normal のスロットは、内部 elements[] を展開
      // スロットの muted は要素側に継承（個別 element.muted を優先）
      if (!Array.isArray(slot.elements)) return;
      slot.elements.forEach((el) => {
        if (!el || typeof el !== "object") return;
        const cloned = cloneElement(el);
        cloned.sort = result.length;
        cloned.muted = typeof el.muted === "boolean" ? el.muted : slotMuted;
        result.push(cloned);
      });
    });

    return result;
  }

  function migrateSlotGroup(oldGroup) {
    if (!oldGroup || typeof oldGroup !== "object") {
      throw new Error("[PromptMigration] migrateSlotGroup: invalid group");
    }

    const version = detectSchemaVersion(oldGroup);

    if (version === 2) {
      const elements = Array.isArray(oldGroup.elements)
        ? oldGroup.elements.map((el) => {
            const cloned = cloneElement(el);
            // mode等のoptionalフィールドは保持する
            if (typeof el.muted === "boolean") cloned.muted = el.muted;
            if (typeof el.mode === "string") cloned.mode = el.mode;
            if (el.category && typeof el.category === "object") cloned.category = cloneCategory(el.category);
            if (typeof el.sequentialIndex === "number") cloned.sequentialIndex = el.sequentialIndex;
            if ("currentExtraction" in el) cloned.currentExtraction = el.currentExtraction;
            return cloned;
          })
        : [];

      return {
        id: safeString(oldGroup.id) || `group_${Date.now()}`,
        name: safeString(oldGroup.name) || safeString(oldGroup.id) || "Unnamed",
        description: safeString(oldGroup.description),
        createdAt: safeNumber(oldGroup.createdAt, Date.now()),
        lastModified: safeNumber(oldGroup.lastModified, Date.now()),
        elements,
        isDefault: safeBoolean(oldGroup.isDefault, false),
        schemaVersion: 2,
      };
    }

    const elements = migrateSlotArrayToElements(oldGroup.slots || []);

    return {
      id: safeString(oldGroup.id) || `group_${Date.now()}`,
      name: safeString(oldGroup.name) || safeString(oldGroup.id) || "Unnamed",
      description: safeString(oldGroup.description),
      createdAt: safeNumber(oldGroup.createdAt, Date.now()),
      lastModified: safeNumber(oldGroup.lastModified, Date.now()),
      elements,
      isDefault: safeBoolean(oldGroup.isDefault, false),
      schemaVersion: 2,
    };
  }

  function migrateAllGroups(oldGroupsArray) {
    if (!Array.isArray(oldGroupsArray)) {
      throw new Error("[PromptMigration] migrateAllGroups: input must be an array");
    }
    return oldGroupsArray.map((group) => migrateSlotGroup(group));
  }

  function createBackup(slotGroupsData, additionalData) {
    // 拡張機能の現在バージョン取得（取得不可なら "unknown"）
    let appVersion = "unknown";
    try {
      if (typeof AppState !== "undefined" && AppState?.config?.toolVersion !== undefined) {
        appVersion = String(AppState.config.toolVersion);
      } else if (typeof chrome !== "undefined" && chrome?.runtime?.getManifest) {
        const manifest = chrome.runtime.getManifest();
        if (manifest?.version) appVersion = manifest.version;
      }
    } catch (_e) {
      appVersion = "unknown";
    }

    const backup = {
      schemaVersion: 1,
      backupDate: new Date().toISOString(),
      appVersion,
      data: {
        slotGroups: slotGroupsData ?? null,
        additionalData: additionalData ?? {},
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  function validateMigratedData(newData) {
    const errors = [];

    if (!Array.isArray(newData)) {
      errors.push("migrated data must be an array of SlotGroup");
      return { valid: false, errors };
    }

    newData.forEach((group, groupIndex) => {
      const tag = `groups[${groupIndex}]`;

      if (!group || typeof group !== "object") {
        errors.push(`${tag}: not an object`);
        return;
      }

      if (typeof group.id !== "string" || group.id.length === 0) {
        errors.push(`${tag}.id: must be non-empty string`);
      }
      if (typeof group.name !== "string") {
        errors.push(`${tag}.name: must be string`);
      }
      if (group.schemaVersion !== 2) {
        errors.push(`${tag}.schemaVersion: must be 2 (got ${group.schemaVersion})`);
      }
      if (!Array.isArray(group.elements)) {
        errors.push(`${tag}.elements: must be array`);
        return;
      }
      if ("slots" in group) {
        errors.push(`${tag}: legacy 'slots' field still present (must be removed)`);
      }

      group.elements.forEach((el, elIndex) => {
        const eTag = `${tag}.elements[${elIndex}]`;
        if (!el || typeof el !== "object") {
          errors.push(`${eTag}: not an object`);
          return;
        }
        if (typeof el.Value !== "string") {
          errors.push(`${eTag}.Value: must be string`);
        }
        if (!Array.isArray(el.data) || el.data.length !== 3) {
          errors.push(`${eTag}.data: must be 3-tuple array`);
        }
        // NAIv45記法のweight情報は必ず保持
        ["SD", "NAI", "NAIv45", "None"].forEach((fmt) => {
          if (!el[fmt] || typeof el[fmt].weight !== "number") {
            errors.push(`${eTag}.${fmt}.weight: must be number`);
          }
        });
        if ("mode" in el && typeof el.mode !== "string") {
          errors.push(`${eTag}.mode: must be string if present`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  window.PromptMigration = {
    detectSchemaVersion,
    migrateSlotArrayToElements,
    migrateSlotGroup,
    migrateAllGroups,
    createBackup,
    validateMigratedData,
  };
})();
