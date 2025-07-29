/**
 * file-utilities.js - ファイル操作ユーティリティクラス
 * Phase 6: ファイル操作処理の共通化
 * 
 * 全モジュールで重複していたファイル操作処理を統一
 */

class FileUtilities {
  /**
   * MIMEタイプ定数
   */
  static MIME_TYPES = {
    JSON: 'application/json',
    CSV: 'text/csv;charset=utf-8',
    TSV: 'text/tab-separated-values;charset=utf-8',
    TEXT: 'text/plain;charset=utf-8',
    PNG: 'image/png',
    JPEG: 'image/jpeg'
  };

  /**
   * ファイル拡張子とMIMEタイプのマッピング
   */
  static EXTENSION_MIME_MAP = {
    'json': FileUtilities.MIME_TYPES.JSON,
    'csv': FileUtilities.MIME_TYPES.CSV,
    'tsv': FileUtilities.MIME_TYPES.TSV,
    'txt': FileUtilities.MIME_TYPES.TEXT,
    'png': FileUtilities.MIME_TYPES.PNG,
    'jpg': FileUtilities.MIME_TYPES.JPEG,
    'jpeg': FileUtilities.MIME_TYPES.JPEG
  };

  /**
   * Blobオブジェクトを作成
   * @param {string|ArrayBuffer} content - ファイル内容
   * @param {string} mimeType - MIMEタイプ
   * @returns {Blob} 作成されたBlobオブジェクト
   */
  static createBlob(content, mimeType) {
    if (!content && content !== '') {
      throw new Error('Content is required for blob creation');
    }

    if (!mimeType) {
      throw new Error('MIME type is required for blob creation');
    }

    return new Blob([content], { type: mimeType });
  }

  /**
   * ファイル拡張子からMIMEタイプを取得
   * @param {string} filename - ファイル名
   * @returns {string} MIMEタイプ
   */
  static getMimeTypeFromFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return FileUtilities.MIME_TYPES.TEXT;
    }

    const extension = filename.split('.').pop()?.toLowerCase();
    return FileUtilities.EXTENSION_MIME_MAP[extension] || FileUtilities.MIME_TYPES.TEXT;
  }

  /**
   * ファイルをダウンロード
   * @param {string|ArrayBuffer} content - ファイル内容
   * @param {string} filename - ファイル名
   * @param {string} [mimeType] - MIMEタイプ（指定しない場合は拡張子から自動判定）
   * @returns {Promise<void>}
   */
  static async downloadFile(content, filename, mimeType = null) {
    return ErrorHandler.wrapAsync(async () => {
      // MIMEタイプを自動判定または検証
      const finalMimeType = mimeType || FileUtilities.getMimeTypeFromFilename(filename);
      
      // Blobを作成
      const blob = FileUtilities.createBlob(content, finalMimeType);
      
      // Object URLを作成
      const url = URL.createObjectURL(blob);
      
      try {
        // ダウンロード実行
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        
        // DOM に一時的に追加してクリック
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        
        // 成功メッセージ表示
        const fileType = filename.split('.').pop()?.toUpperCase() || 'ファイル';
        ErrorHandler.showToast(
          `${fileType}ファイルをダウンロードしました`, 
          UI_DELAYS.LONG, 
          "success"
        );
        
      } finally {
        // メモリリークを防ぐために必ずURLを解放
        URL.revokeObjectURL(url);
      }
    }, 'ファイルダウンロード', {
      showToast: true,
      toastDuration: UI_DELAYS.LONG
    });
  }

  /**
   * JSONファイルをダウンロード
   * @param {Object|Array} data - JSONデータ
   * @param {string} filename - ファイル名（.json拡張子は自動追加）
   * @returns {Promise<void>}
   */
  static async downloadJSON(data, filename) {
    return ErrorHandler.wrapAsync(async () => {
      if (!data) {
        throw new Error('JSON data is required');
      }

      // ファイル名に.json拡張子を追加（まだない場合）
      const jsonFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
      
      // JSONを整形して文字列化
      const jsonString = JSON.stringify(data, null, 2);
      
      await FileUtilities.downloadFile(jsonString, jsonFilename, FileUtilities.MIME_TYPES.JSON);
    }, 'JSONダウンロード');
  }

  /**
   * CSVファイルをダウンロード
   * @param {string} csvContent - CSV文字列
   * @param {string} filename - ファイル名（.csv拡張子は自動追加）
   * @returns {Promise<void>}
   */
  static async downloadCSV(csvContent, filename) {
    return ErrorHandler.wrapAsync(async () => {
      if (!csvContent && csvContent !== '') {
        throw new Error('CSV content is required');
      }

      // ファイル名に.csv拡張子を追加（まだない場合）
      const csvFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
      
      await FileUtilities.downloadFile(csvContent, csvFilename, FileUtilities.MIME_TYPES.CSV);
    }, 'CSVダウンロード');
  }

  /**
   * TSVファイルをダウンロード
   * @param {string} tsvContent - TSV文字列
   * @param {string} filename - ファイル名（.tsv拡張子は自動追加）
   * @returns {Promise<void>}
   */
  static async downloadTSV(tsvContent, filename) {
    return ErrorHandler.wrapAsync(async () => {
      if (!tsvContent && tsvContent !== '') {
        throw new Error('TSV content is required');
      }

      // ファイル名に.tsv拡張子を追加（まだない場合）
      const tsvFilename = filename.endsWith('.tsv') ? filename : `${filename}.tsv`;
      
      await FileUtilities.downloadFile(tsvContent, tsvFilename, FileUtilities.MIME_TYPES.TSV);
    }, 'TSVダウンロード');
  }

  /**
   * ファイルをテキストとして読み込み
   * @param {File} file - 読み込むファイルオブジェクト
   * @returns {Promise<string>} ファイル内容
   */
  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error('Valid File object is required'));
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
        reader.readAsText(file, 'UTF-8');
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * ファイルをArrayBufferとして読み込み
   * @param {File} file - 読み込むファイルオブジェクト
   * @returns {Promise<ArrayBuffer>} ファイル内容
   */
  static readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error('Valid File object is required'));
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

  /**
   * ファイルをData URLとして読み込み（プレビュー用）
   * @param {File} file - 読み込むファイルオブジェクト
   * @returns {Promise<string>} Data URL
   */
  static readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error('Valid File object is required'));
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

  /**
   * JSONファイルを読み込んでパース
   * @param {File} file - 読み込むJSONファイル
   * @returns {Promise<Object|Array>} パースされたJSONデータ
   */
  static async readJSONFile(file) {
    return ErrorHandler.wrapAsync(async () => {
      if (!file || !(file instanceof File)) {
        throw new Error('Valid File object is required');
      }

      const text = await FileUtilities.readFileAsText(file);
      
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`Invalid JSON format in file: ${file.name}`);
      }
    }, 'JSONファイル読み込み');
  }

  /**
   * 複数ファイルを並列で読み込み
   * @param {FileList|File[]} files - 読み込むファイルリスト
   * @param {string} [readMethod='text'] - 読み込みメソッド（'text', 'arrayBuffer', 'dataURL'）
   * @returns {Promise<Array>} ファイル内容の配列
   */
  static async readMultipleFiles(files, readMethod = 'text') {
    const fileArray = Array.from(files);
    
    const readMethods = {
      text: FileUtilities.readFileAsText,
      arrayBuffer: FileUtilities.readFileAsArrayBuffer,
      dataURL: FileUtilities.readFileAsDataURL
    };
    
    const readFunction = readMethods[readMethod];
    if (!readFunction) {
      throw new Error(`Unsupported read method: ${readMethod}`);
    }
    
    return Promise.all(fileArray.map(file => readFunction(file)));
  }

  /**
   * ファイルサイズを人間が読みやすい形式に変換
   * @param {number} bytes - バイト数
   * @returns {string} フォーマットされたサイズ
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * ファイル拡張子を取得
   * @param {string} filename - ファイル名
   * @returns {string} 拡張子（ドットなし、小文字）
   */
  static getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
      return '';
    }
    
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  /**
   * ファイル名から拡張子を除いたベース名を取得
   * @param {string} filename - ファイル名
   * @returns {string} ベース名（拡張子なし）
   */
  static getFileBaseName(filename) {
    if (!filename || typeof filename !== 'string') {
      return '';
    }
    
    const parts = filename.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : filename;
  }

  /**
   * 安全なファイル名を生成（不正文字を除去）
   * @param {string} filename - 元のファイル名
   * @returns {string} 安全なファイル名
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'untitled';
    }
    
    // Windows/Mac/Linuxで使用できない文字を除去
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 不正文字を_に置換
      .replace(/\s+/g, '_')                     // 空白を_に置換
      .replace(/_{2,}/g, '_')                   // 連続する_を1つに
      .replace(/^_+|_+$/g, '')                  // 先頭・末尾の_を除去
      .substring(0, 255);                       // 255文字以内に制限
  }

  /**
   * タイムスタンプ付きファイル名を生成
   * @param {string} baseName - ベースファイル名
   * @param {string} [extension] - 拡張子
   * @returns {string} タイムスタンプ付きファイル名
   */
  static generateTimestampedFilename(baseName, extension = '') {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    
    const sanitizedBase = FileUtilities.sanitizeFilename(baseName);
    const finalExtension = extension.startsWith('.') ? extension : (extension ? `.${extension}` : '');
    
    return `${sanitizedBase}_${timestamp}${finalExtension}`;
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.FileUtilities = FileUtilities;
}