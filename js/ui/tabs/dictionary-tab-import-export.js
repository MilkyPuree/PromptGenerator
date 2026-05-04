(function () {
  "use strict";

  class DictionaryTabImportExport {
    constructor(dictTab) {
      this.dictTab = dictTab;
    }

    setupDownloadButtons() {
      const promptDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_DOWNLOAD);
      if (promptDownload) {
        this.dictTab.addEventListener(promptDownload, "click", () => {
          const currentDictId = UIHelpers.getCurrentDictId();
          const currentDict = AppState.data.promptDictionaries?.[currentDictId];
          const prompts = currentDict?.prompts || [];
          this.jsonDownload(prompts, EXPORT_FILE_NAMES.PROMPT_DICTIONARY);
        });
      }

      const localDicDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DOWNLOAD);
      if (localDicDownload) {
        this.dictTab.addEventListener(localDicDownload, "click", () => {
          this.jsonDownload(AppState.data.localPromptList, EXPORT_FILE_NAMES.USER_DICTIONARY);
        });
      }

      this.setupAccordionDownloadButtons();
    }

    setupAccordionDownloadButtons() {
      const promptDictDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_DICT_DOWNLOAD);
      if (promptDictDownload) {
        this.dictTab.addEventListener(promptDictDownload, "click", () => {
          const currentDictId = UIHelpers.getCurrentDictId();
          const currentDict = AppState.data.promptDictionaries?.[currentDictId];
          const currentData = currentDict?.prompts || [];
          const currentDictName = currentDict?.name || "メインリスト";

          this.jsonDownload(currentData, EXPORT_FILE_NAMES.PROMPT_DICTIONARY, currentDictName);
        });
      }

      const localDictJsonDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_JSON_DOWNLOAD);
      if (localDictJsonDownload) {
        this.dictTab.addEventListener(localDictJsonDownload, "click", () => {
          this.jsonDownload(AppState.data.localPromptList, EXPORT_FILE_NAMES.USER_DICTIONARY);
        });
      }

      const localDictCsvDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_CSV_DOWNLOAD);
      if (localDictCsvDownload) {
        this.dictTab.addEventListener(localDictCsvDownload, "click", async () => {
          if (window.csvHandler) {
            await window.csvHandler.exportToCSV(AppState.data.localPromptList, "csv", "elements");
          }
        });
      }

      const localDictTsvDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_TSV_DOWNLOAD);
      if (localDictTsvDownload) {
        this.dictTab.addEventListener(localDictTsvDownload, "click", async () => {
          if (window.csvHandler) {
            await window.csvHandler.exportToCSV(AppState.data.localPromptList, "tsv", "elements");
          }
        });
      }

      const promptDictCsvDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_CSV_DOWNLOAD);
      if (promptDictCsvDownload) {
        this.dictTab.addEventListener(promptDictCsvDownload, "click", async () => {
          if (window.csvHandler) {
            const currentDictId = UIHelpers.getCurrentDictId();
            const currentDict = AppState.data.promptDictionaries?.[currentDictId];
            const prompts = currentDict?.prompts || [];
            const currentDictName = currentDict?.name || "メインリスト";
            await window.csvHandler.exportToCSV(prompts, "csv", "prompts", currentDictName);
          }
        });
      }

      const promptDictTsvDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_TSV_DOWNLOAD);
      if (promptDictTsvDownload) {
        this.dictTab.addEventListener(promptDictTsvDownload, "click", async () => {
          if (window.csvHandler) {
            const currentDictId = UIHelpers.getCurrentDictId();
            const currentDict = AppState.data.promptDictionaries?.[currentDictId];
            const prompts = currentDict?.prompts || [];
            const currentDictName = currentDict?.name || "メインリスト";
            await window.csvHandler.exportToCSV(prompts, "tsv", "prompts", currentDictName);
          }
        });
      }

      const masterDictCsvDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_CSV_DOWNLOAD);
      if (masterDictCsvDownload) {
        this.dictTab.addEventListener(masterDictCsvDownload, "click", async () => {
          if (window.csvHandler) {
            await window.csvHandler.exportToCSV(getMasterPrompts(), "csv", "master");
          }
        });
      }

      const masterDictTsvDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_TSV_DOWNLOAD);
      if (masterDictTsvDownload) {
        this.dictTab.addEventListener(masterDictTsvDownload, "click", async () => {
          if (window.csvHandler) {
            await window.csvHandler.exportToCSV(getMasterPrompts(), "tsv", "master");
          }
        });
      }

      const masterDictDownload = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MASTER_DICT_DOWNLOAD);
      if (masterDictDownload) {
        this.dictTab.addEventListener(masterDictDownload, "click", () => {
          this.jsonDownload(getMasterPrompts(), EXPORT_FILE_NAMES.MASTER_DICTIONARY);
        });
      }
    }

    async jsonDownload(data, filename, dictName = null) {
      if (!data || data.length === 0) {
        if (window.ErrorHandler) {
          UIHelpers.notifyInfo(
            "JSONファイルをエクスポートしました（データが空のため、ヘッダー情報のみです）",
            3000
          );
        }
      }

      let dicType;
      if (filename === EXPORT_FILE_NAMES.PROMPT_DICTIONARY) {
        dicType = DATA_TYPES.PROMPTS;
      } else if (filename === EXPORT_FILE_NAMES.MASTER_DICTIONARY) {
        dicType = "Master";
      } else {
        dicType = DATA_TYPES.ELEMENTS;
      }
      const formattedData = {
        dicType: dicType,
        data: data,
        version: AppState.config.toolVersion || 5,
        exportDate: new Date().toISOString(),
        dictionaryName: dictName || filename,
      };

      let dataType;
      if (dicType === DATA_TYPES.PROMPTS) {
        dataType = "prompts";
      } else if (dicType === "Master") {
        dataType = "master";
      } else {
        dataType = "elements";
      }
      const baseName = ExportFilenameGenerator.generateBaseName(dataType, dictName);

      const downloadFilename = FileUtilities.generateTimestampedFilename(baseName, "json");

      await FileUtilities.downloadJSON(formattedData, downloadFilename);
    }

    setupImportButtons() {
      const promptDictImportBtn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_IMPORT_BTN);
      const promptDictImport = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_PROMPT_IMPORT);

      if (promptDictImportBtn && promptDictImport) {
        this.dictTab.addEventListener(promptDictImportBtn, "click", () => {
          promptDictImport.click();
        });

        this.dictTab.addEventListener(promptDictImport, "change", async (event) => {
          const file = event.target.files[0];
          if (file) {
            await this.handleImportFile(file, "prompts");
            event.target.value = "";
          }
        });
      }

      const localDictImportBtn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_IMPORT_BTN);
      const localDictImport = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_IMPORT);

      if (localDictImportBtn && localDictImport) {
        this.dictTab.addEventListener(localDictImportBtn, "click", () => {
          localDictImport.click();
        });

        this.dictTab.addEventListener(localDictImport, "change", async (event) => {
          const file = event.target.files[0];
          if (file) {
            await this.handleImportFile(file, "elements");
            event.target.value = "";
          }
        });
      }
    }

    async handleImportFile(file, dictType) {
      try {
        const sizeValidation = Validators.validateFileSize(file, 10);
        if (!sizeValidation.isValid) {
          ErrorHandler.notify(sizeValidation.message);
          return;
        }

        const fileName = file.name.toLowerCase();
        let fileType = "json";
        if (fileName.endsWith(".csv")) {
          fileType = "csv";
        } else if (fileName.endsWith(".tsv")) {
          fileType = "tsv";
        }

        let data;
        if (fileType === "json") {
          const content = await this.readFileAsText(file);
          data = JSON.parse(content);
          await this.processDictionaryData(data, dictType);
        } else {
          const content = await this.readFileAsText(file);
          const delimiter = fileType === "tsv" ? "\t" : ",";
          data = this.parseCSVContent(content, delimiter);
          await this.processCSVData(data, dictType);
        }

        if (dictType === "prompts") {
          setTimeout(async () => {
            await this.dictTab.listRenderer.refreshFavoriteList();
            this.dictTab.modalManager.updateDictionarySelector();
          }, UI_DELAYS.STANDARD_UPDATE);
        } else if (dictType === "elements") {
          setTimeout(async () => {
            await this.dictTab.listRenderer.refreshAddList();
          }, UI_DELAYS.STANDARD_UPDATE);
        }

        this.dictTab.updateStats();
      } catch (error) {
        UIHelpers.notifyError(`インポートに失敗しました: ${error.message}`, UI_DELAYS.LONG);
      }
    }

    async readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("ファイルの読み込みに失敗しました"));
        reader.readAsText(file, "UTF-8");
      });
    }

    parseCSVContent(content, delimiter = ",") {
      const cleanContent = content.replace(/^\uFEFF/, "");
      const lines = cleanContent.split("\n").filter((line) => line.trim());
      const result = [];

      for (let i = 0; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i], delimiter);
        if (values.length > 0) {
          result.push(values);
        }
      }

      return result;
    }

    parseCSVLine(line, delimiter = ",") {
      const values = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      values.push(current.trim());
      return values;
    }

    async processDictionaryData(data, dictType) {
      let addCount = 0;

      if (!data.dicType) {
        if (Array.isArray(data)) {
          data = { dicType: "Elements", data: data };
        } else if (data.data && Array.isArray(data.data)) {
          const firstItem = data.data[0];
          if (firstItem && firstItem.title && firstItem.prompt) {
            data.dicType = DATA_TYPES.PROMPTS;
          } else {
            data.dicType = DATA_TYPES.ELEMENTS;
          }
        } else {
          throw new Error("不正なファイル形式です");
        }
      }

      switch (data.dicType) {
        case "Elements":
          for (let i = 0; i < data.data.length; i++) {
            const item = data.data[i];
            try {
              if (registerDictionary(item, true)) {
                addCount++;
              }
            } catch (error) {}
          }

          if (addCount > 0) {
            await saveLocalList();
            UIHelpers.notifySuccess(`${addCount}件の要素辞書を読み込みました`, 3000);
          } else {
            UIHelpers.notifyInfo("追加できる新しい要素がありませんでした", 3000);
          }
          break;

        case DATA_TYPES.PROMPTS:
          const currentDictId = UIHelpers.getCurrentDictId();
          for (let i = 0; i < data.data.length; i++) {
            const item = data.data[i];
            try {
              if (this.addPromptDic(item, currentDictId)) {
                addCount++;
              }
            } catch (error) {}
          }

          if (addCount > 0) {
            await savePromptDictionaries();
            UIHelpers.notifySuccess(`${addCount}件のお気に入りリストを読み込みました`, 3000);
          } else {
            UIHelpers.notifyInfo("追加できる新しいプロンプトがありませんでした", 3000);
          }
          break;

        default:
          throw new Error(`不明な辞書タイプです: ${data.dicType}`);
      }
    }

    addPromptDic(item, dictId = null) {
      try {
        const currentDictId = dictId || UIHelpers.getCurrentDictId();

        if (!AppState.data.promptDictionaries[currentDictId]) {
          AppState.data.promptDictionaries[currentDictId] = {
            id: currentDictId,
            name: currentDictId === "main" ? "メインリスト" : currentDictId,
            prompts: [],
          };
        }

        const existingPrompts = AppState.data.promptDictionaries[currentDictId].prompts;
        const isDuplicate = existingPrompts.some(
          (existingItem) => existingItem.title === item.title && existingItem.prompt === item.prompt
        );

        if (isDuplicate) {
          return false;
        }

        const newItem = {
          title: item.title || "",
          prompt: item.prompt || "",
          id: Date.now() + Math.random(),
          sort: existingPrompts.length,
        };

        AppState.data.promptDictionaries[currentDictId].prompts.push(newItem);
        return true;
      } catch (error) {
        return false;
      }
    }

    async processCSVData(csvData, dictType) {
      let addCount = 0;

      if (dictType === "elements") {
        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];

          if (i === 0) {
            const firstCell = (row[0] || "").replace(/^\uFEFF/, "");
            if (
              (firstCell === "大項目" && row[1] === "中項目") ||
              (firstCell.includes("大項目") && firstCell.includes("中項目"))
            ) {
              continue;
            }
          }

          if (row.length >= 4) {
            const item = {
              data: [row[0] || "", row[1] || "", row[2] || ""],
              prompt: row[3] || "",
            };
            try {
              if (registerDictionary(item, true)) {
                addCount++;
              }
            } catch (error) {}
          }
        }

        if (addCount > 0) {
          await saveLocalList();
          UIHelpers.notifySuccess(`${addCount}件の要素辞書を読み込みました`, 3000);
        } else {
          UIHelpers.notifyInfo("追加できる新しい要素がありませんでした", 3000);
        }
      } else if (dictType === "prompts") {
        const currentDictId = UIHelpers.getCurrentDictId();
        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          if (row.length >= 2) {
            const item = {
              title: row[0] || "",
              prompt: row[1] || "",
            };
            try {
              if (this.addPromptDic(item, currentDictId)) {
                addCount++;
              }
            } catch (error) {}
          }
        }

        if (addCount > 0) {
          await savePromptDictionaries();
          UIHelpers.notifySuccess(`${addCount}件のお気に入りリストを読み込みました`, 3000);
        } else {
          UIHelpers.notifyInfo("追加できる新しいプロンプトがありませんでした", 3000);
        }
      }
    }
  }

  if (typeof window !== "undefined") {
    window.DictionaryTabImportExport = DictionaryTabImportExport;
  }
})();
