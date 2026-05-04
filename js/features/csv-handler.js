class CSVHandler {
  constructor() {
    this.Papa = window.Papa || null;
  }

  async exportToCSV(dataList, format = "csv", dataType = "elements", dictName = null) {
    try {
      if (!dataList || dataList.length === 0) {
        if (window.ErrorHandler) {
          UIHelpers.notifyInfo(
            `${format.toUpperCase()}ファイルをエクスポートしました（データが空のため、ヘッダーのみです）`,
            3000
          );
        }
      }

      let csvData;

      if (dataType === "prompts") {
        if (!dataList || dataList.length === 0) {
          csvData = [];
        } else {
          csvData = dataList.map((item) => ({
            [CSV_HEADERS.TITLE]: item.title || "",
            [CSV_HEADERS.PROMPT]: item.prompt || "",
          }));
        }
      } else {
        if (!dataList || dataList.length === 0) {
          csvData = [];
        } else {
          csvData = dataList.map((item) => {
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

      const filename = ExportFilenameGenerator.generateBaseName(dataType, dictName);

      const delimiter = format === "tsv" ? "\t" : ",";
      const fileExtension = format === "tsv" ? "tsv" : "csv";

      let output;
      if (this.Papa) {
        output = this.Papa.unparse(csvData, {
          header: true,
          delimiter: delimiter,
          encoding: "utf-8",
        });
      } else {
        output = this.unparseCSV(csvData, { delimiter });
      }

      const bom = "\uFEFF";
      const outputWithBom = bom + output;

      if (format === "tsv") {
        await this.downloadTSV(outputWithBom, filename);
      } else {
        await this.downloadCSV(outputWithBom, filename);
      }

      const formatName = format === "tsv" ? "TSV" : "CSV";
      const dataTypeName = dataType === "prompts" ? "お気に入りリスト" : "ユーザー辞書";
      UIHelpers.notifySuccess(`${dataTypeName}を${formatName}でエクスポートしました`, 2000);
    } catch (error) {
      ErrorHandler.handleFileError(error, "export", `${dataType}.${format}`);
    }
  }

  unparseCSV(data, options = {}) {
    if (data.length === 0) return "";

    const delimiter = options.delimiter || ",";

    const headers = Object.keys(data[0]);
    const csvLines = [headers.map((h) => this.escapeValue(h, delimiter)).join(delimiter)];

    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || "";
        return this.escapeValue(value, delimiter);
      });
      csvLines.push(values.join(delimiter));
    });

    return csvLines.join("\n");
  }

  escapeValue(value, delimiter = ",") {
    const strValue = value.toString();

    if (strValue.includes(delimiter) || strValue.includes("\n") || strValue.includes('"')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }

    return strValue;
  }

  escapeCSVValue(value) {
    return this.escapeValue(value, ",");
  }

  async downloadCSV(csvContent, filename) {
    const baseName = FileUtilities.getFileBaseName(filename);
    const sanitizedBaseName = FileUtilities.sanitizeFilename(baseName);
    const finalFilename = FileUtilities.generateTimestampedFilename(sanitizedBaseName, "csv");

    await FileUtilities.downloadCSV(csvContent, finalFilename);
  }

  async downloadTSV(tsvContent, filename) {
    const baseName = FileUtilities.getFileBaseName(filename);
    const sanitizedBaseName = FileUtilities.sanitizeFilename(baseName);
    const finalFilename = FileUtilities.generateTimestampedFilename(sanitizedBaseName, "tsv");

    await FileUtilities.downloadTSV(tsvContent, finalFilename);
  }
}

window.CSVHandler = CSVHandler;
window.csvHandler = new CSVHandler();

function setupCSVExportListener() {
  const csvExportBtn = document.getElementById(DOM_IDS.BUTTONS.CSV_EXPORT);
  if (csvExportBtn) {
    csvExportBtn.addEventListener("click", async () => {
      await csvHandler.exportToCSV(AppState.data.localPromptList, "csv", "elements");
    });
  }

  const tsvExportBtn = document.getElementById(DOM_IDS.BUTTONS.TSV_EXPORT);
  if (tsvExportBtn) {
    tsvExportBtn.addEventListener("click", async () => {
      await csvHandler.exportToCSV(AppState.data.localPromptList, "tsv", "elements");
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupCSVExportListener);
} else {
  setupCSVExportListener();
}
