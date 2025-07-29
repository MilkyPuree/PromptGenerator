/**
 * settings-manager.js - 設定のインポート/エクスポート管理
 * Phase 6: 基本機能強化
 */

class SettingsManager {
  constructor() {
    this.version = "1.1.0";
  }

  /**
   * 現在の設定をエクスポート
   * @returns {Object} エクスポートデータ
   */
  async exportSettings() {
    try {
      // AppStateから優先的にデータを取得、フォールバックでストレージから取得
      const allData = await Storage.get(null);

      const exportData = {
        version: this.version,
        exportDate: new Date().toISOString(),
        appVersion: AppState.config.toolVersion,
        settings: {
          optionData:
            AppState.userSettings?.optionData || allData.optionData || {},
          searchCategory:
            AppState.data?.searchCategory || allData.searchCategory || {},
        },
        data: {
          localPromptList:
            AppState.data?.localPromptList || allData.localPromptList || [],
          // promptDictionariesから現在の辞書のプロンプトを取得
          favoritesList: (() => {
            const dictionaries = AppState.data?.promptDictionaries || allData.promptDictionaries || {};
            const currentDict = AppState.data?.currentPromptDictionary || allData.currentPromptDictionary || "main";
            return dictionaries[currentDict]?.prompts || allData.favoritesList || [];
          })(),
          categoryData: allData.categoryData || [[], [], []],
          masterPrompts: allData.masterPrompts || [],
          masterVersion: allData.masterVersion || 0,
          // 複数辞書システムのデータもエクスポート
          promptDictionaries:
            AppState.data?.promptDictionaries ||
            allData.promptDictionaries ||
            {},
          currentPromptDictionary:
            AppState.data?.currentPromptDictionary ||
            allData.currentPromptDictionary ||
            "main",
          // スロット関連データを追加
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

  /**
   * 設定をインポート
   * @param {Object} importData - インポートするデータ
   * @param {Object} options - インポートオプション
   */
  async importSettings(importData, options = {}) {
    try {
      // バージョンチェック
      if (!this.isCompatibleVersion(importData.version)) {
        throw new Error(`互換性のないバージョンです: ${importData.version}`);
      }

      // インポートオプション
      const {
        includeSettings = true,
        includeLocalDict = true,
        includeFavorits = true,
        includeCategories = true,
        includeMaster = false,
        merge = false, // true: マージ, false: 上書き
      } = options;

      const dataToImport = {};

      // 設定
      if (includeSettings && importData.settings) {
        dataToImport.optionData = importData.settings.optionData;
        dataToImport.searchCategory = importData.settings.searchCategory;
      }

      // ローカル辞書
      if (includeLocalDict && importData.data?.localPromptList) {
        if (merge) {
          // マージモード：重複チェックして追加
          const currentList = AppState.data.localPromptList || [];
          const mergedList = this.mergePromptLists(
            currentList,
            importData.data.localPromptList
          );
          dataToImport.localPromptList = mergedList;
        } else {
          dataToImport.localPromptList = importData.data.localPromptList;
        }
      }

      // アーカイブ（新形式と旧形式の両方に対応）
      if (includeFavorits) {
        if (importData.data?.promptDictionaries) {
          // 新形式：promptDictionaries形式
          dataToImport.promptDictionaries = importData.data.promptDictionaries;
          dataToImport.currentPromptDictionary = importData.data.currentPromptDictionary || "main";
        } else if (importData.data?.favoritesList) {
          // 旧形式：favoritesList形式を新形式に変換
          if (merge) {
            const currentDict = getCurrentPromptDictionary();
            const currentFavorits = currentDict.prompts || [];
            const mergedFavorits = this.mergeFavoriteLists(
              currentFavorits,
              importData.data.favoritesList
            );
            // promptDictionaries形式で保存
            dataToImport.promptDictionaries = {
              main: {
                name: "メイン辞書",
                prompts: mergedFavorits
              }
            };
            dataToImport.currentPromptDictionary = "main";
          } else {
            // promptDictionaries形式で保存
            dataToImport.promptDictionaries = {
              main: {
                name: "メイン辞書", 
                prompts: importData.data.favoritesList
              }
            };
            dataToImport.currentPromptDictionary = "main";
          }
        }
      }

      // カテゴリーデータ
      if (includeCategories && importData.data?.categoryData) {
        dataToImport.categoryData = importData.data.categoryData;
      }

      // マスターデータ（オプション）
      if (includeMaster && importData.data?.masterPrompts) {
        dataToImport.masterPrompts = importData.data.masterPrompts;
        dataToImport.masterVersion = importData.data.masterVersion;
      }

      // スロット関連データ
      if (importData.data?.promptSlots) {
        dataToImport.promptSlots = importData.data.promptSlots;
      }
      if (importData.data?.slotGroups) {
        dataToImport.slotGroups = importData.data.slotGroups;
      }

      // 現在のプロンプト
      if (importData.ui?.currentPrompt) {
        dataToImport.generatePrompt = importData.ui.currentPrompt;
      }

      // ストレージに保存
      await Storage.set(dataToImport);

      // AppStateを更新
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

  /**
   * バージョン互換性チェック
   */
  isCompatibleVersion(version) {
    if (!version) return false;

    const [major] = version.split(".");
    const [currentMajor] = this.version.split(".");

    // メジャーバージョンが同じなら互換性あり
    return major === currentMajor;
  }

  /**
   * プロンプトリストをマージ
   */
  mergePromptLists(currentList, importList) {
    const merged = [...currentList];
    const existingKeys = new Set(
      currentList.map((item) => this.getPromptKey(item))
    );

    for (const item of importList) {
      const key = this.getPromptKey(item);
      if (!existingKeys.has(key)) {
        merged.push(item);
      }
    }

    return merged;
  }

  /**
   * アーカイブリストをマージ
   */
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

  /**
   * プロンプトのユニークキーを生成
   */
  getPromptKey(item) {
    return `${item.prompt}|${item.data?.[0]}|${item.data?.[1]}|${item.data?.[2]}`;
  }

  /**
   * インポートしたアイテム数をカウント
   */
  countImportedItems(data) {
    let count = 0;
    if (data.localPromptList) count += data.localPromptList.length;
    if (data.favoritesList) count += data.favoritesList.length;
    if (data.masterPrompts) count += data.masterPrompts.length;
    return count;
  }

  /**
   * AppStateをリロード
   */
  async reloadAppState() {
    await initializeDataManager();
    categoryData.update();

    // スロットグループマネージャーを再初期化
    if (window.slotGroupManager) {
      await window.slotGroupManager.initialize();
      // 現在のグループを読み込み
      await window.slotGroupManager.loadGroupSlots(window.slotGroupManager.currentGroupId);
    }

    // UIを更新
    if (window.app) {
      window.app.updateUIState();
      
      // 各タブのリストを更新
      if (window.app.tabs) {
        if (window.app.tabs.edit && typeof window.app.tabs.edit.refreshEditList === 'function') {
          await window.app.tabs.edit.refreshEditList();
        }
        if (window.app.tabs.dictionary) {
          if (typeof window.app.tabs.dictionary.refreshFavoriteList === 'function') {
            await window.app.tabs.dictionary.refreshFavoriteList();
          }
          if (typeof window.app.tabs.dictionary.refreshAddList === 'function') {
            await window.app.tabs.dictionary.refreshAddList();
          }
        }
        // スロットタブのリフレッシュも追加
        if (window.app.tabs.slot && typeof window.app.tabs.slot.refreshSlotGroupList === 'function') {
          await window.app.tabs.slot.refreshSlotGroupList();
        }
      }
    }

    // スロットマネージャーのUIを更新
    if (window.promptSlotManager) {
      window.promptSlotManager.updateUI();
    }
  }

  /**
   * エクスポートファイルをダウンロード
   */
  async downloadExport() {
    try {
      const exportData = await this.exportSettings();

      // FileUtilitiesを使用してダウンロード
      const filename = FileUtilities.generateTimestampedFilename(
        EXPORT_FILE_NAMES.SETTINGS,
        "json"
      );
      await FileUtilities.downloadJSON(exportData, filename);
    } catch (error) {
      ErrorHandler.showToast(
        "エクスポートに失敗しました",
        UI_DELAYS.LONG,
        "error"
      );
    }
  }

  /**
   * インポートファイルを選択して読み込み
   */
  async selectAndImport(options = {}) {
    // 重複呼び出し防止のガード
    if (this._isImporting) {
      if (AppState.config.debugMode) {
        console.warn("[SettingsManager] Import already in progress");
      }
      return;
    }

    this._isImporting = true;

    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.style.display = "none"; // 非表示にして確実にユーザーの意図したタイミングで表示

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

          // バリデーション
          if (!importData.version || !importData.exportDate) {
            throw new Error("無効な設定ファイルです");
          }

          // インポート実行
          const result = await this.importSettings(importData, options);

          ErrorHandler.notify(
            `設定をインポートしました (${result.itemCount}件)`,
            {
              type: ErrorHandler.NotificationType.TOAST,
              messageType: "success",
              duration: NOTIFICATION_DURATION.MEDIUM,
            }
          );

          // インポート後に拡張機能を安全に閉じる
          await this.performSafeReinitialization();
        } catch (error) {
          ErrorHandler.notify(`インポートに失敗しました: ${error.message}`, {
            type: ErrorHandler.NotificationType.TOAST,
            messageType: "error",
          });
        } finally {
          this._isImporting = false;
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        }
      };

      // イベントリスナーを一度だけ追加
      input.addEventListener("change", handleFileSelect, { once: true });

      // キャンセル時の処理
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
      
      // 短時間の遅延を入れてから実行
      setTimeout(() => {
        if (document.body.contains(input)) {
          input.click();
        }
      }, 10);

    } catch (error) {
      this._isImporting = false;
      ErrorHandler.notify("ファイル選択の準備に失敗しました", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "error",
      });
    }
  }

  /**
   * インポート後の安全な再初期化処理
   */
  async performSafeReinitialization() {
    try {
      if (AppState.config.debugMode) {
        if (AppState.config.debugMode) {
          console.log("[SettingsManager] Starting safe extension closure...");
        }
      }

      // 拡張機能を安全に閉じる（推奨・唯一の方法）
      await this.closeExtensionSafely();
    } catch (error) {
      console.error("[SettingsManager] Extension closure failed:", error);
      // フォールバック：強制終了
      window.close();
    }
  }

  /**
   * 拡張機能を安全に閉じる
   */
  async closeExtensionSafely() {
    if (AppState.config.debugMode) {
      if (AppState.config.debugMode) {
        console.log("[SettingsManager] Closing extension safely");
      }
    }

    try {
      // 通知を表示してから閉じる
      ErrorHandler.notify("設定インポート完了。拡張機能を再起動します", {
        type: ErrorHandler.NotificationType.TOAST,
        messageType: "info",
        duration: 2000,
      });

      // 2秒後に拡張機能を閉じる
      setTimeout(() => {
        // ポップアップウィンドウを閉じる
        if (window.close) {
          window.close();
        } else {
          // Chrome拡張機能のポップアップを閉じる別の方法を試行
          try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]) {
                window.close();
              }
            });
          } catch (chromeError) {
            if (AppState.config.debugMode) {
              console.warn("[SettingsManager] Chrome API unavailable, using window.close()");
            }
            window.close();
          }
        }
      }, 2000);

    } catch (error) {
      console.error("[SettingsManager] Failed to close extension safely:", error);
      // フォールバック：即座に閉じる
      window.close();
    }
  }
}

// グローバルに公開
if (typeof window !== "undefined") {
  window.SettingsManager = SettingsManager;
  window.settingsManager = new SettingsManager();
}
