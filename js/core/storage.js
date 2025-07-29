/**
 * Chrome Storage APIのラッパーモジュール
 * 非同期処理を統一し、エラーハンドリングを一元化
 */
const Storage = {
  /**
   * コンテキストが有効かチェック
   */
  isContextValid() {
    try {
      // chrome.runtime.idが取得できればコンテキストは有効
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  },

  /**
   * ストレージから値を取得
   * @param {string|string[]} keys - 取得するキー（文字列または配列）
   * @returns {Promise<Object>} - 取得した値のオブジェクト
   */
  async get(keys) {
    // コンテキストチェック
    if (!this.isContextValid()) {
      console.warn("Extension context is invalid. Returning empty result.");
      return {};
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // コンテキストが無効化された場合
        console.warn("Storage.get failed:", error);
        resolve({});
      }
    });
  },

  /**
   * ストレージに値を保存
   * @param {Object} items - 保存するキーと値のオブジェクト
   * @returns {Promise<void>}
   */
  async set(items) {
    // コンテキストチェック
    if (!this.isContextValid()) {
      console.warn("Extension context is invalid. Skipping storage.set.");
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            // コンテキスト無効化エラーの場合は警告のみ
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              console.warn(
                "Context invalidated during storage.set:",
                error.message
              );
              resolve(); // エラーではなく正常終了として扱う
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        // コンテキストが無効化された場合
        console.warn("Storage.set failed:", error);
        resolve(); // エラーではなく正常終了として扱う
      }
    });
  },

  /**
   * ストレージから値を削除
   * @param {string|string[]} keys - 削除するキー（文字列または配列）
   * @returns {Promise<void>}
   */
  async remove(keys) {
    if (!this.isContextValid()) {
      console.warn("Extension context is invalid. Skipping storage.remove.");
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              console.warn(
                "Context invalidated during storage.remove:",
                error.message
              );
              resolve();
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.warn("Storage.remove failed:", error);
        resolve();
      }
    });
  },

  /**
   * ストレージをクリア
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.isContextValid()) {
      console.warn("Extension context is invalid. Skipping storage.clear.");
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              console.warn(
                "Context invalidated during storage.clear:",
                error.message
              );
              resolve();
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.warn("Storage.clear failed:", error);
        resolve();
      }
    });
  },

  /**
   * 特定のキーが存在するかチェック
   * @param {string} key - チェックするキー
   * @returns {Promise<boolean>}
   */
  async has(key) {
    try {
      const result = await this.get(key);
      return result.hasOwnProperty(key);
    } catch (error) {
      return false;
    }
  },

  /**
   * ストレージの使用量を取得
   * @returns {Promise<{bytesInUse: number}>}
   */
  async getBytesInUse(keys = null) {
    if (!this.isContextValid()) {
      console.warn("Extension context is invalid. Returning 0 bytes.");
      return { bytesInUse: 0 };
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.getBytesInUse(keys, (bytesInUse) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              console.warn(
                "Context invalidated during getBytesInUse:",
                error.message
              );
              resolve({ bytesInUse: 0 });
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve({ bytesInUse });
          }
        });
      } catch (error) {
        console.warn("Storage.getBytesInUse failed:", error);
        resolve({ bytesInUse: 0 });
      }
    });
  },
};

// エクスポート（ES6モジュールをサポートしない環境用）
if (typeof module !== "undefined" && module.exports) {
  module.exports = Storage;
}
