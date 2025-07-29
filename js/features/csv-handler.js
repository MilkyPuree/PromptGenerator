/**
 * csv-handler.js - CSV入出力機能モジュール（エクスポート専用）
 * Phase 7: データ連携強化
 */

class CSVHandler {
  constructor() {
    // Papa Parseはpopup.htmlで読み込み済み
    this.Papa = window.Papa || null;

    // Papa Parseが見つからない場合は簡易パーサーを使用
    if (!this.Papa) {
      console.warn("Papa Parse not found, using fallback CSV parser");
    }
  }

  /**
   * 辞書データをCSV/TSVにエクスポート
   * @param {Array} dataList - エクスポートするデータ
   * @param {string} format - 'csv' または 'tsv'
   * @param {string} dataType - 'elements' または 'prompts' または 'master'
   * @param {string} dictName - 辞書名（プロンプト辞書の場合のみ使用）
   */
  async exportToCSV(dataList, format = "csv", dataType = "elements", dictName = null) {
    try {
      // データが空の場合の確認とトースト通知
      if (!dataList || dataList.length === 0) {
        // 空データでもヘッダーのみでファイルを生成
        console.log("空データのエクスポート:", dataType, format);
        
        // 空データ用のトースト通知
        if (window.ErrorHandler) {
          window.ErrorHandler.showToast(
            `${format.toUpperCase()}ファイルをエクスポートしました（データが空のため、ヘッダーのみです）`,
            3000,
            'info'
          );
        }
      }

      // データタイプに応じてCSVデータを準備
      let csvData;

      if (dataType === "prompts") {
        // お気に入りの場合
        if (!dataList || dataList.length === 0) {
          // 空の場合はヘッダーのみのデータを作成
          csvData = [];
        } else {
          csvData = dataList.map((item) => ({
            [CSV_HEADERS.TITLE]: item.title || "",
            [CSV_HEADERS.PROMPT]: item.prompt || "",
          }));
        }
      } else if (dataType === "master") {
        // マスター辞書の場合
        if (!dataList || dataList.length === 0) {
          // 空の場合はヘッダーのみのデータを作成
          csvData = [];
        } else {
          csvData = dataList.map((item) => {
            // データ構造の確認（配列またはオブジェクト）
            const data0 = item.data?.[0] || item.data?.["0"] || "";
            const data1 = item.data?.[1] || item.data?.["1"] || "";
            const data2 = item.data?.[2] || item.data?.["2"] || "";

            return {
              [CSV_HEADERS.BIG_CATEGORY]: data0,
              [CSV_HEADERS.MIDDLE_CATEGORY]: data1,
              [CSV_HEADERS.SMALL_CATEGORY]: data2,
              [CSV_HEADERS.PROMPT]: item.prompt || "",
            };
          });
        }
      } else {
        // 要素辞書の場合（既存の処理）
        if (!dataList || dataList.length === 0) {
          // 空の場合はヘッダーのみのデータを作成
          csvData = [];
        } else {
          csvData = dataList.map((item) => {
            // データ構造の確認（配列またはオブジェクト）
            const data0 = item.data?.[0] || item.data?.["0"] || "";
            const data1 = item.data?.[1] || item.data?.["1"] || "";
            const data2 = item.data?.[2] || item.data?.["2"] || "";

            return {
              [CSV_HEADERS.BIG_CATEGORY]: data0,
              [CSV_HEADERS.MIDDLE_CATEGORY]: data1,
              [CSV_HEADERS.SMALL_CATEGORY]: data2,
              [CSV_HEADERS.PROMPT]: item.prompt || "",
            };
          });
        }
      }

      // 共通のファイル名生成ロジックを使用
      const filename = ExportFilenameGenerator.generateBaseName(dataType, dictName);

      // CSV/TSVに変換
      const delimiter = format === "tsv" ? "\t" : ",";
      const fileExtension = format === "tsv" ? "tsv" : "csv";

      let output;
      if (this.Papa) {
        // Papa Parseを使用
        output = this.Papa.unparse(csvData, {
          header: true,
          delimiter: delimiter,
          encoding: "utf-8",
        });
      } else {
        // フォールバックパーサーを使用
        output = this.unparseCSV(csvData, { delimiter });
      }

      // BOMを追加（Excelで文字化けを防ぐ）
      const bom = "\uFEFF";
      const outputWithBom = bom + output;

      // ダウンロード
      if (format === "tsv") {
        await this.downloadTSV(outputWithBom, filename);
      } else {
        await this.downloadCSV(outputWithBom, filename);
      }

      const formatName = format === "tsv" ? "TSV" : "CSV";
      const dataTypeName =
        dataType === "prompts" ? "お気に入りリスト" : "ユーザー辞書";
      ErrorHandler.notify(
        `${dataTypeName}を${formatName}でエクスポートしました`,
        {
          type: ErrorHandler.NotificationType.TOAST,
          messageType: "success",
          duration: 2000,
        }
      );
    } catch (error) {
      ErrorHandler.handleFileError(error, "export", `${dataType}.${format}`);
    }
  }

  /**
   * 簡易CSV/TSV生成（Papa Parseが使えない場合のフォールバック）
   */
  unparseCSV(data, options = {}) {
    if (data.length === 0) return "";

    const delimiter = options.delimiter || ",";

    // ヘッダー行
    const headers = Object.keys(data[0]);
    const csvLines = [
      headers.map((h) => this.escapeValue(h, delimiter)).join(delimiter),
    ];

    // データ行
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || "";
        return this.escapeValue(value, delimiter);
      });
      csvLines.push(values.join(delimiter));
    });

    return csvLines.join("\n");
  }

  /**
   * CSV/TSV値をエスケープ
   */
  escapeValue(value, delimiter = ",") {
    const strValue = value.toString();

    // デリミタ、改行、引用符を含む場合はクォートで囲む
    if (
      strValue.includes(delimiter) ||
      strValue.includes("\n") ||
      strValue.includes('"')
    ) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }

    return strValue;
  }

  /**
   * CSV値をエスケープ（後方互換性）
   */
  escapeCSVValue(value) {
    return this.escapeValue(value, ",");
  }

  /**
   * CSVをダウンロード
   * @param {string} csvContent - CSV内容
   * @param {string} filename - ファイル名
   */
  async downloadCSV(csvContent, filename) {
    // ファイル名から拡張子を除去してベース名を取得
    const baseName = FileUtilities.getFileBaseName(filename);
    const sanitizedBaseName = FileUtilities.sanitizeFilename(baseName);
    const finalFilename = FileUtilities.generateTimestampedFilename(
      sanitizedBaseName,
      "csv"
    );

    // FileUtilitiesを使用してダウンロード
    await FileUtilities.downloadCSV(csvContent, finalFilename);
  }

  /**
   * TSVをダウンロード
   * @param {string} tsvContent - TSV内容
   * @param {string} filename - ファイル名
   */
  async downloadTSV(tsvContent, filename) {
    // ファイル名から拡張子を除去してベース名を取得
    const baseName = FileUtilities.getFileBaseName(filename);
    const sanitizedBaseName = FileUtilities.sanitizeFilename(baseName);
    const finalFilename = FileUtilities.generateTimestampedFilename(
      sanitizedBaseName,
      "tsv"
    );

    // FileUtilitiesを使用してダウンロード
    await FileUtilities.downloadTSV(tsvContent, finalFilename);
  }
}

// ============================================
// UIへの統合（オプションパネルに配置）
// ============================================

// グローバルに公開
window.CSVHandler = CSVHandler;
window.csvHandler = new CSVHandler();

// CSV/TSVエクスポートボタンのイベントリスナーを設定
function setupCSVExportListener() {
  const csvExportBtn = document.getElementById(DOM_IDS.BUTTONS.CSV_EXPORT);
  if (csvExportBtn) {
    csvExportBtn.addEventListener("click", async () => {
      await csvHandler.exportToCSV(
        AppState.data.localPromptList,
        "csv",
        "elements"
      );
    });
  }

  const tsvExportBtn = document.getElementById(DOM_IDS.BUTTONS.TSV_EXPORT);
  if (tsvExportBtn) {
    tsvExportBtn.addEventListener("click", async () => {
      await csvHandler.exportToCSV(
        AppState.data.localPromptList,
        "tsv",
        "elements"
      );
    });
  }
}

// DOMContentLoadedで実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupCSVExportListener);
} else {
  setupCSVExportListener();
}
