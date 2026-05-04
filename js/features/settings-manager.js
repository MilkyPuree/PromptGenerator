class SettingsManager {
  constructor() {
    this.version = "1.1.0";
  }

  async exportSettings() {
    try {
      const allData = await Storage.get(null);

      const exportData = {
        version: this.version,
        exportDate: new Date().toISOString(),
        appVersion: AppState.config.toolVersion,
        settings: {
          optionData: AppState.userSettings?.optionData || allData.optionData || {},
          searchCategory: AppState.data?.searchCategory || allData.searchCategory || {},
        },
        data: {
          localPromptList: AppState.data?.localPromptList || allData.localPromptList || [],
          favoritesList: (() => {
            const dictionaries = AppState.data?.promptDictionaries || allData.promptDictionaries || {};
            const currentDict = AppState.data?.currentPromptDictionary || allData.currentPromptDictionary || "main";
            return dictionaries[currentDict]?.prompts || allData.favoritesList || [];
          })(),
          categoryData: allData.categoryData || [[], [], []],
          masterPrompts: allData.masterPrompts || [],
          masterVersion: allData.masterVersion || 0,
          promptDictionaries: AppState.data?.promptDictionaries || allData.promptDictionaries || {},
          currentPromptDictionary: AppState.data?.currentPromptDictionary || allData.currentPromptDictionary || "main",
          promptSlots: AppState.data?.promptSlots || allData.promptSlots || {},
          slotGroups: AppState.data?.slotGroups || allData.slotGroups || {},
        },
        ui: {
          currentPrompt: allData.generatePrompt || "",
        },
      };

      return exportData;
    } catch (error) {
      ErrorHandler.log("Failed to export settings", error);
      throw error;
    }
  }

  async importSettings(importData, options = {}) {
    try {
      if (!this.isCompatibleVersion(importData.version)) {
        throw new Error(`互換性のないバージョンです: ${importData.version}`);
      }

      const {
        includeSettings = true,
        includeLocalDict = true,
        includeFavorits = true,
        includeCategories = true,
        includeMaster = false,
        merge = false, // true: マージ, false: 上書き
      } = options;

      const dataToImport = {};

      if (includeSettings && importData.settings) {
        dataToImport.optionData = importData.settings.optionData;
        dataToImport.searchCategory = importData.settings.searchCategory;
      }

      if (includeLocalDict && importData.data?.localPromptList) {
        if (merge) {
          const currentList = AppState.data.localPromptList || [];
          const mergedList = this.mergePromptLists(currentList, importData.data.localPromptList);
          dataToImport.localPromptList = mergedList;
        } else {
          dataToImport.localPromptList = importData.data.localPromptList;
        }
      }

      // アーカイブ（新形式と旧形式の両方に対応）
      if (includeFavorits) {
        if (importData.data?.promptDictionaries) {
          dataToImport.promptDictionaries = importData.data.promptDictionaries;
          dataToImport.currentPromptDictionary = importData.data.currentPromptDictionary || "main";
        } else if (importData.data?.favoritesList) {
          if (merge) {
            const currentDict = getCurrentPromptDictionary();
            const currentFavorits = currentDict.prompts || [];
            const mergedFavorits = this.mergeFavoriteLists(currentFavorits, importData.data.favoritesList);
            dataToImport.promptDictionaries = {
              main: {
                name: "メイン辞書",
                prompts: mergedFavorits,
              },
            };
            dataToImport.currentPromptDictionary = "main";
          } else {
            dataToImport.promptDictionaries = {
              main: {
                name: "メイン辞書",
                prompts: importData.data.favoritesList,
              },
            };
            dataToImport.currentPromptDictionary = "main";
          }
        }
      }

      if (includeCategories && importData.data?.categoryData) {
        dataToImport.categoryData = importData.data.categoryData;
      }

      if (includeMaster && importData.data?.masterPrompts) {
        dataToImport.masterPrompts = importData.data.masterPrompts;
        dataToImport.masterVersion = importData.data.masterVersion;
      }

      if (importData.data?.promptSlots) {
        dataToImport.promptSlots = importData.data.promptSlots;
      }
      if (importData.data?.slotGroups) {
        if (importData.data.slotGroups.groups) {
          const groupsArray = Array.isArray(importData.data.slotGroups.groups)
            ? importData.data.slotGroups.groups
            : Array.from(importData.data.slotGroups.groups);

          const defaultGroupData = groupsArray.find((g) => g[1]?.isDefault || (Array.isArray(g) && g[1]?.isDefault));

          if (defaultGroupData && importData.data.promptSlots?.slots) {
            const groupData = Array.isArray(defaultGroupData) ? defaultGroupData[1] : defaultGroupData;
            groupData.slots = importData.data.promptSlots.slots;

            dataToImport.promptSlots = {
              slots: importData.data.promptSlots.slots,
              nextId: importData.data.promptSlots.nextId || importData.data.promptSlots.slots.length,
            };
          }
        }

        dataToImport.slotGroups = importData.data.slotGroups;
      }

      if (importData.ui?.currentPrompt) {
        dataToImport.generatePrompt = importData.ui.currentPrompt;
      }

      await Storage.set(dataToImport);

      await this.reloadAppState();

      return {
        success: true,
        imported: Object.keys(dataToImport),
        itemCount: this.countImportedItems(dataToImport),
      };
    } catch (error) {
      ErrorHandler.log("Failed to import settings", error);
      throw error;
    }
  }

  isCompatibleVersion(version) {
    if (!version) return false;

    const [major] = version.split(".");
    const [currentMajor] = this.version.split(".");

    // メジャーバージョンが同じなら互換性あり
    return major === currentMajor;
  }

  mergePromptLists(currentList, importList) {
    const merged = [...currentList];
    const existingKeys = new Set(currentList.map((item) => this.getPromptKey(item)));

    for (const item of importList) {
      const key = this.getPromptKey(item);
      if (!existingKeys.has(key)) {
        merged.push(item);
      }
    }

    return merged;
  }

  mergeFavoriteLists(currentList, importList) {
    const merged = [...currentList];
    const existingPrompts = new Set(currentList.map((item) => item.prompt));

    for (const item of importList) {
      if (!existingPrompts.has(item.prompt)) {
        merged.push(item);
      }
    }

    return merged;
  }

  getPromptKey(item) {
    return `${item.prompt}|${item.data?.[0]}|${item.data?.[1]}|${item.data?.[2]}`;
  }

  countImportedItems(data) {
    let count = 0;
    if (data.localPromptList) count += data.localPromptList.length;
    if (data.favoritesList) count += data.favoritesList.length;
    if (data.masterPrompts) count += data.masterPrompts.length;
    return count;
  }

  async reloadAppState() {
    const storageData = await Storage.get(["slotGroups", "promptSlots"]);

    if (storageData.slotGroups?.groups) {
      const defaultGroupData = storageData.slotGroups.groups.find((g) => g[0] === "default" || g[1]?.isDefault);

      if (defaultGroupData && defaultGroupData[1]?.slots) {
        const correctSlots = defaultGroupData[1].slots;
        const currentSlots = storageData.promptSlots?.slots || [];

        if (correctSlots.length !== currentSlots.length || correctSlots.length > 3) {
          const syncedSlotData = {
            slots: [...correctSlots],
            nextId: Math.max(...correctSlots.map((s) => s.id)) + 1,
          };

          if (!AppState.data) {
            AppState.data = {};
          }
          AppState.data.promptSlots = syncedSlotData;

          await Storage.set({
            promptSlots: syncedSlotData,
          });

          if (window.promptSlotManager) {
            window.promptSlotManager.slots = [...correctSlots];
            window.promptSlotManager._nextId = syncedSlotData.nextId;
          }
        }
      }
    }

    await initializeDataManager();
    categoryData.update();

    if (window.slotGroupManager) {
      await window.slotGroupManager.initialize();

      const currentGroup = window.slotGroupManager.getCurrentGroup();
      if (currentGroup && AppState.data?.promptSlots?.slots) {
        const correctSlots = AppState.data.promptSlots.slots;
        if (correctSlots.length > 3 && currentGroup.slots.length <= 3) {
          currentGroup.slots = [...correctSlots];
          await window.slotGroupManager.saveToStorage();
        }
      }

      await window.slotGroupManager.loadGroupSlots(window.slotGroupManager.currentGroupId);
    }

    if (window.app) {
      window.app.updateUIState();

      if (window.app.tabs) {
        if (window.app.tabs.edit && typeof window.app.tabs.edit.refreshEditList === "function") {
          await window.app.tabs.edit.refreshEditList();
        }
        if (window.app.tabs.dictionary) {
          if (typeof window.app.tabs.dictionary.refreshFavoriteList === "function") {
            await window.app.tabs.dictionary.refreshFavoriteList();
          }
          if (typeof window.app.tabs.dictionary.refreshAddList === "function") {
            await window.app.tabs.dictionary.refreshAddList();
          }
        }
        if (window.app.tabs.slot && typeof window.app.tabs.slot.refreshSlotGroupList === "function") {
          await window.app.tabs.slot.refreshSlotGroupList();
        }
      }
    }

    if (window.promptSlotManager) {
      window.promptSlotManager.updateUI();
    }
  }

  async downloadExport() {
    try {
      const exportData = await this.exportSettings();

      const filename = FileUtilities.generateTimestampedFilename(EXPORT_FILE_NAMES.SETTINGS, "json");
      await FileUtilities.downloadJSON(exportData, filename);
    } catch (error) {
      UIHelpers.notifyError("エクスポートに失敗しました", UI_DELAYS.LONG);
    }
  }

  async selectAndImport(options = {}) {
    if (this._isImporting) {
      return;
    }

    this._isImporting = true;

    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.classList.add("hidden"); // 非表示にして確実にユーザーの意図したタイミングで表示

      const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          this._isImporting = false;
          document.body.removeChild(input);
          return;
        }

        try {
          const text = await FileUtilities.readFileAsText(file);
          const importData = JSON.parse(text);

          if (!importData.version || !importData.exportDate) {
            throw new Error("無効な設定ファイルです");
          }

          const result = await this.importSettings(importData, options);

          UIHelpers.notifySuccess(`設定をインポートしました (${result.itemCount}件)`, NOTIFICATION_DURATION.MEDIUM);

          await this.performSafeReinitialization();
        } catch (error) {
          UIHelpers.notifyError(`インポートに失敗しました: ${error.message}`);
        } finally {
          this._isImporting = false;
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        }
      };

      input.addEventListener("change", handleFileSelect, { once: true });

      const handleCancel = () => {
        setTimeout(() => {
          if (this._isImporting && document.body.contains(input)) {
            this._isImporting = false;
            document.body.removeChild(input);
          }
        }, 1000); // 1秒後にクリーンアップ
      };

      window.addEventListener("focus", handleCancel, { once: true });

      document.body.appendChild(input);

      setTimeout(() => {
        if (document.body.contains(input)) {
          input.click();
        }
      }, 10);
    } catch (error) {
      this._isImporting = false;
      UIHelpers.notifyError("ファイル選択の準備に失敗しました");
    }
  }

  async performSafeReinitialization() {
    try {
      await this.closeExtensionSafely();
    } catch (error) {
      window.close();
    }
  }

  async closeExtensionSafely() {
    try {
      UIHelpers.notifyInfo("設定インポート完了。拡張機能を再起動します", 2000);

      setTimeout(() => {
        if (window.close) {
          window.close();
        } else {
          try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]) {
                window.close();
              }
            });
          } catch (chromeError) {
            window.close();
          }
        }
      }, 2000);
    } catch (error) {
      window.close();
    }
  }
}

if (typeof window !== "undefined") {
  window.SettingsManager = SettingsManager;
  window.settingsManager = new SettingsManager();
}
