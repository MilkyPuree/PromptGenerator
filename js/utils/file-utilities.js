class FileUtilities {
  static MIME_TYPES = {
    JSON: "application/json",
    CSV: "text/csv;charset=utf-8",
    TSV: "text/tab-separated-values;charset=utf-8",
    TEXT: "text/plain;charset=utf-8",
    PNG: "image/png",
    JPEG: "image/jpeg",
  };

  static EXTENSION_MIME_MAP = {
    json: FileUtilities.MIME_TYPES.JSON,
    csv: FileUtilities.MIME_TYPES.CSV,
    tsv: FileUtilities.MIME_TYPES.TSV,
    txt: FileUtilities.MIME_TYPES.TEXT,
    png: FileUtilities.MIME_TYPES.PNG,
    jpg: FileUtilities.MIME_TYPES.JPEG,
    jpeg: FileUtilities.MIME_TYPES.JPEG,
  };

  static createBlob(content, mimeType) {
    if (!content && content !== "") {
      throw new Error("Content is required for blob creation");
    }

    if (!mimeType) {
      throw new Error("MIME type is required for blob creation");
    }

    return new Blob([content], { type: mimeType });
  }

  static getMimeTypeFromFilename(filename) {
    if (!filename || typeof filename !== "string") {
      return FileUtilities.MIME_TYPES.TEXT;
    }

    const extension = filename.split(".").pop()?.toLowerCase();
    return FileUtilities.EXTENSION_MIME_MAP[extension] || FileUtilities.MIME_TYPES.TEXT;
  }

  static async downloadFile(content, filename, mimeType = null) {
    return ErrorHandler.wrapAsync(
      async () => {
        const finalMimeType = mimeType || FileUtilities.getMimeTypeFromFilename(filename);

        const blob = FileUtilities.createBlob(content, finalMimeType);

        const url = URL.createObjectURL(blob);

        try {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          anchor.style.display = "none";

          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);

          const fileType = filename.split(".").pop()?.toUpperCase() || "ファイル";
          UIHelpers.notifySuccess(`${fileType}ファイルをダウンロードしました`, UI_DELAYS.LONG);
        } finally {
          // メモリリークを防ぐために必ずURLを解放
          URL.revokeObjectURL(url);
        }
      },
      "ファイルダウンロード",
      {
        showToast: true,
        toastDuration: UI_DELAYS.LONG,
      }
    );
  }

  static async downloadJSON(data, filename) {
    return ErrorHandler.wrapAsync(async () => {
      if (!data) {
        throw new Error("JSON data is required");
      }

      const jsonFilename = filename.endsWith(".json") ? filename : `${filename}.json`;

      const jsonString = JSON.stringify(data, null, 2);

      await FileUtilities.downloadFile(jsonString, jsonFilename, FileUtilities.MIME_TYPES.JSON);
    }, "JSONダウンロード");
  }

  static async downloadCSV(csvContent, filename) {
    return ErrorHandler.wrapAsync(async () => {
      if (!csvContent && csvContent !== "") {
        throw new Error("CSV content is required");
      }

      const csvFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;

      await FileUtilities.downloadFile(csvContent, csvFilename, FileUtilities.MIME_TYPES.CSV);
    }, "CSVダウンロード");
  }

  static async downloadTSV(tsvContent, filename) {
    return ErrorHandler.wrapAsync(async () => {
      if (!tsvContent && tsvContent !== "") {
        throw new Error("TSV content is required");
      }

      const tsvFilename = filename.endsWith(".tsv") ? filename : `${filename}.tsv`;

      await FileUtilities.downloadFile(tsvContent, tsvFilename, FileUtilities.MIME_TYPES.TSV);
    }, "TSVダウンロード");
  }

  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error("Valid File object is required"));
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        resolve(event.target.result);
      };

      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };

      reader.onabort = () => {
        reject(new Error(`File reading was aborted: ${file.name}`));
      };

      try {
        reader.readAsText(file, "UTF-8");
      } catch (error) {
        reject(error);
      }
    });
  }

  static readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error("Valid File object is required"));
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        resolve(event.target.result);
      };

      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };

      reader.onabort = () => {
        reject(new Error(`File reading was aborted: ${file.name}`));
      };

      try {
        reader.readAsArrayBuffer(file);
      } catch (error) {
        reject(error);
      }
    });
  }

  static readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error("Valid File object is required"));
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        resolve(event.target.result);
      };

      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };

      reader.onabort = () => {
        reject(new Error(`File reading was aborted: ${file.name}`));
      };

      try {
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async readJSONFile(file) {
    return ErrorHandler.wrapAsync(async () => {
      if (!file || !(file instanceof File)) {
        throw new Error("Valid File object is required");
      }

      const text = await FileUtilities.readFileAsText(file);

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`Invalid JSON format in file: ${file.name}`);
      }
    }, "JSONファイル読み込み");
  }

  static async readMultipleFiles(files, readMethod = "text") {
    const fileArray = Array.from(files);

    const readMethods = {
      text: FileUtilities.readFileAsText,
      arrayBuffer: FileUtilities.readFileAsArrayBuffer,
      dataURL: FileUtilities.readFileAsDataURL,
    };

    const readFunction = readMethods[readMethod];
    if (!readFunction) {
      throw new Error(`Unsupported read method: ${readMethod}`);
    }

    return Promise.all(fileArray.map((file) => readFunction(file)));
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static getFileExtension(filename) {
    if (!filename || typeof filename !== "string") {
      return "";
    }

    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }

  static getFileBaseName(filename) {
    if (!filename || typeof filename !== "string") {
      return "";
    }

    const parts = filename.split(".");
    return parts.length > 1 ? parts.slice(0, -1).join(".") : filename;
  }

  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== "string") {
      return "untitled";
    }

    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // 不正文字を_に置換
      .replace(/\s+/g, "_") // 空白を_に置換
      .replace(/_{2,}/g, "_") // 連続する_を1つに
      .replace(/^_+|_+$/g, "") // 先頭・末尾の_を除去
      .substring(0, 255); // 255文字以内に制限
  }

  static generateTimestampedFilename(baseName, extension = "") {
    const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");

    const sanitizedBase = FileUtilities.sanitizeFilename(baseName);
    const finalExtension = extension.startsWith(".") ? extension : extension ? `.${extension}` : "";

    return `${sanitizedBase}_${timestamp}${finalExtension}`;
  }
}

if (typeof window !== "undefined") {
  window.FileUtilities = FileUtilities;
}
