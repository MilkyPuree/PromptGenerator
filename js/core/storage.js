const Storage = {
  isContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  },

  async get(keys) {
    if (!this.isContextValid()) {
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
        resolve({});
      }
    });
  },

  async set(items) {
    if (!this.isContextValid()) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              resolve(); // エラーではなく正常終了として扱う
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        resolve(); // エラーではなく正常終了として扱う
      }
    });
  },

  async remove(keys) {
    if (!this.isContextValid()) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              resolve();
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        resolve();
      }
    });
  },

  async clear() {
    if (!this.isContextValid()) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              resolve();
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        resolve();
      }
    });
  },

  async has(key) {
    try {
      const result = await this.get(key);
      return result.hasOwnProperty(key);
    } catch (error) {
      return false;
    }
  },

  async getBytesInUse(keys = null) {
    if (!this.isContextValid()) {
      return { bytesInUse: 0 };
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.getBytesInUse(keys, (bytesInUse) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message.includes("context invalidated")) {
              resolve({ bytesInUse: 0 });
            } else {
              reject(new Error(error.message));
            }
          } else {
            resolve({ bytesInUse });
          }
        });
      } catch (error) {
        resolve({ bytesInUse: 0 });
      }
    });
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Storage;
}
