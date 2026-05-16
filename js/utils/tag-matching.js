// 複数タグマッチング（mercury-studio tagMatching.ts からの移植）
// 辞書に "best quality, very aesthetic" のような複合タグがあった場合、
// プロンプト内で両方揃った時に1つのエントリとして認識する

(function () {
  "use strict";

  /**
   * @typedef {Object} DictionaryEntry
   * @property {number} id
   * @property {string} prompt
   * @property {[string, string, string]} data
   * @property {number} sort
   */

  /**
   * @typedef {Object} TranslatedTag
   * @property {string} original
   * @property {string|null} japanese
   * @property {[string, string, string]|null} category
   */

  /**
   * @typedef {Object} DictIndexEntry
   * @property {string} japanese
   * @property {[string, string, string]} category
   * @property {Set<string>} entryTags
   */

  function normalizeTag(raw) {
    if (raw == null) return "";
    return String(raw).replace(/[{}\[\]<>]/g, "").trim().toLowerCase();
  }

  function promptToTagSet(prompt) {
    const tags = new Set();
    if (prompt == null) return tags;
    for (const part of String(prompt).split(",")) {
      const normalized = normalizeTag(part);
      if (normalized) tags.add(normalized);
    }
    return tags;
  }

  function dictEntryToTagSet(entry) {
    return promptToTagSet(entry.prompt);
  }

  /**
   * @param {DictionaryEntry[]} entries
   * @returns {Map<string, DictIndexEntry[]>}
   */
  function buildDictIndex(entries) {
    /** @type {Map<string, DictIndexEntry[]>} */
    const index = new Map();
    if (!entries || !Array.isArray(entries)) return index;

    for (const entry of entries) {
      if (!entry) continue;
      const tags = dictEntryToTagSet(entry);
      const data = entry.data || ["", "", ""];
      const displayName = data[2] || data[1] || data[0];
      if (!displayName) continue;

      /** @type {DictIndexEntry} */
      const indexEntry = {
        japanese: displayName,
        category: data,
        entryTags: tags,
      };

      for (const tag of tags) {
        let list = index.get(tag);
        if (!list) {
          list = [];
          index.set(tag, list);
        }
        const isDup = list.some(
          (e) => e.japanese === indexEntry.japanese && e.entryTags.size === indexEntry.entryTags.size
        );
        if (!isDup) {
          list.push(indexEntry);
        }
      }
    }

    for (const [, list] of index) {
      list.sort((a, b) => b.entryTags.size - a.entryTags.size);
    }

    return index;
  }

  /**
   * @param {string} prompt
   * @param {Map<string, DictIndexEntry[]>} dictIndex
   * @returns {TranslatedTag[]}
   */
  function translatePromptWithDict(prompt, dictIndex) {
    /** @type {TranslatedTag[]} */
    const result = [];
    if (prompt == null) return result;

    const parts = String(prompt)
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const partsNormalized = parts.map((p) => normalizeTag(p));
    /** @type {Set<number>} */
    const consumed = new Set();

    const safeIndex = dictIndex instanceof Map ? dictIndex : new Map();

    for (let i = 0; i < parts.length; i++) {
      if (consumed.has(i)) continue;

      const normalized = partsNormalized[i];
      if (!normalized) {
        result.push({ original: parts[i], japanese: null, category: null });
        continue;
      }

      const candidates = safeIndex.get(normalized);
      if (!candidates || candidates.length === 0) {
        result.push({ original: parts[i], japanese: null, category: null });
        continue;
      }

      let matched = false;
      for (const candidate of candidates) {
        if (candidate.entryTags.size === 1) {
          result.push({
            original: parts[i],
            japanese: candidate.japanese,
            category: candidate.category,
          });
          matched = true;
          break;
        }

        /** @type {number[]} */
        const matchingIndices = [];
        let allFound = true;

        for (const requiredTag of candidate.entryTags) {
          const foundIdx = partsNormalized.findIndex(
            (tag, idx) =>
              tag === requiredTag && !consumed.has(idx) && !matchingIndices.includes(idx)
          );
          if (foundIdx !== -1) {
            matchingIndices.push(foundIdx);
          } else {
            allFound = false;
            break;
          }
        }

        if (allFound) {
          result.push({
            original: parts[i],
            japanese: candidate.japanese,
            category: candidate.category,
          });
          for (const idx of matchingIndices) {
            if (idx !== i) consumed.add(idx);
          }
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push({ original: parts[i], japanese: null, category: null });
      }
    }

    return result;
  }

  window.TagMatching = {
    buildDictIndex,
    translatePromptWithDict,
    normalizeTag,
    promptToTagSet,
    dictEntryToTagSet,
  };
})();
