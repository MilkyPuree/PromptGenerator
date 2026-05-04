const Storage = {
  _handleCallback(resolve, reject, result, allowContextInvalidated = true) {
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError;
      if (allowContextInvalidated && error.message?.includes("context invalidated")) {
        resolve(result);
      } else {
        reject(new Error(error.message));
      }
    } else {
      resolve(result);
    }
  },

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
          Storage._handleCallback(resolve, reject, result, false);
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
          Storage._handleCallback(resolve, reject, undefined);
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
          Storage._handleCallback(resolve, reject, undefined);
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
          Storage._handleCallback(resolve, reject, undefined);
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
          Storage._handleCallback(resolve, reject, { bytesInUse: bytesInUse || 0 });
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
