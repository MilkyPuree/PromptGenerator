// ============================================
// ファイルハンドラークラス（画像メタデータ確認専用）
// ============================================
class FileHandler {
  constructor() {
    this.allowedTypes = {
      image: [MIME_TYPES.PNG],
    };
  }

  async handleFile(file) {
    let fileCategory = this.getFileCategory(file.type);

    // 画像ファイル以外は処理しない
    if (!fileCategory || fileCategory !== "image") {
      ErrorHandler.notify("画像ファイル（PNG）のみ対応しています");
      return;
    }

    const sizeValidation = Validators.validateFileSize(file, 10);
    if (!sizeValidation.isValid) {
      ErrorHandler.notify(sizeValidation.message);
      return;
    }

    await ErrorHandler.handleAsync(
      async () => {
        await this.readImageFile(file);
      },
      "画像メタデータの読み込み",
      { showLoading: true }
    );
  }

  getFileCategory(mimeType) {
    for (const [category, types] of Object.entries(this.allowedTypes)) {
      if (types.includes(mimeType)) {
        return category;
      }
    }
    return null;
  }

  async readImageFile(file) {
    const incluedText = document.getElementById(DOM_IDS.OTHER.INCLUDED_TEXT);
    const preview = document.getElementById(DOM_IDS.OTHER.PREVIEW);
    const pngInfo = document.getElementById(DOM_IDS.OTHER.PNG_INFO);

    // ローディング表示
    if (incluedText) {
      incluedText.textContent = "画像を読み込み中...";
    }
    if (pngInfo) {
      pngInfo.innerHTML = "";
    }

    try {
      // 画像プレビューを表示
      const imageUrl = URL.createObjectURL(file);
      if (preview) {
        preview.src = imageUrl;
        preview.classList.remove("hidden");
        preview.classList.add("show-block");
        preview.onload = () => URL.revokeObjectURL(imageUrl);
      }

      // PNGメタデータを読み取り
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const metadata = this.parsePNGMetadata(uint8Array);

      // メタデータを表示
      this.displayMetadata(metadata, file);

      // 完了メッセージ
      if (incluedText) {
        incluedText.textContent = "画像（PNG）をドラッグ＆ドロップまたはクリックして選択し、メタデータを確認";
      }
    } catch (error) {
      ErrorHandler.notify("画像のメタデータを読み取れませんでした");

      if (incluedText) {
        incluedText.textContent = "画像（PNG）をドラッグ＆ドロップまたはクリックして選択し、メタデータを確認";
      }
    }
  }

  parsePNGMetadata(uint8Array) {
    const metadata = {
      fileInfo: {},
      textChunks: {},
    };

    // PNG形式の基本チェック
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (uint8Array[i] !== pngSignature[i]) {
        throw new Error("有効なPNGファイルではありません");
      }
    }

    let offset = 8; // PNG署名をスキップ

    // チャンクを読み取り
    while (offset < uint8Array.length - 8) {
      // チャンク長を読み取り（4バイト、ビッグエンディアン）
      const length =
        (uint8Array[offset] << 24) |
        (uint8Array[offset + 1] << 16) |
        (uint8Array[offset + 2] << 8) |
        uint8Array[offset + 3];
      offset += 4;

      // チャンクタイプを読み取り（4バイト）
      const type = String.fromCharCode(
        uint8Array[offset],
        uint8Array[offset + 1],
        uint8Array[offset + 2],
        uint8Array[offset + 3]
      );
      offset += 4;

      // チャンクデータ
      const data = uint8Array.slice(offset, offset + length);
      offset += length;

      // CRC（4バイト）をスキップ
      offset += 4;

      // テキストチャンクを処理
      if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
        this.parseTextChunk(type, data, metadata.textChunks);
      } else if (type === "IHDR") {
        this.parseIHDRChunk(data, metadata.fileInfo);
      } else if (type === "IEND") {
        break; // 最後のチャンク
      }
    }

    return metadata;
  }

  parseTextChunk(type, data, textChunks) {
    try {
      let keywordEnd = 0;
      // null終端のキーワードを探す
      while (keywordEnd < data.length && data[keywordEnd] !== 0) {
        keywordEnd++;
      }

      const keyword = new TextDecoder("latin1").decode(data.slice(0, keywordEnd));
      const textData = data.slice(keywordEnd + 1);

      let text;
      if (type === "tEXt") {
        text = new TextDecoder("latin1").decode(textData);
      } else if (type === "iTXt") {
        // iTXtは複雑な構造だが、簡易的に処理
        text = new TextDecoder("utf8").decode(textData);
      } else if (type === "zTXt") {
        // zTXtは圧縮されているが、簡易的に処理
        text = new TextDecoder("latin1").decode(textData);
      }

      textChunks[keyword] = text;
    } catch (error) {
      // テキストチャンク解析エラー
    }
  }

  parseIHDRChunk(data, fileInfo) {
    if (data.length >= 13) {
      fileInfo.width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      fileInfo.height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
      fileInfo.bitDepth = data[8];
      fileInfo.colorType = data[9];
      fileInfo.compression = data[10];
      fileInfo.filter = data[11];
      fileInfo.interlace = data[12];
    }
  }

  /**
   * プロンプト情報を解析してポジティブ、ネガティブ、設定に分割
   * @param {string} promptText - 元のプロンプトテキスト
   * @returns {object} 分割されたプロンプト情報
   */
  parsePromptInfo(promptText) {
    const result = {
      positive: "",
      negative: "",
      settings: "",
    };

    try {
      // 改行で分割して処理
      const lines = promptText.split("\n");
      let currentSection = "positive";
      let positiveLines = [];
      let negativeLines = [];
      let settingsLines = [];

      for (const line of lines) {
        const trimmedLine = line.trim();

        // ネガティブプロンプトの開始を検出
        if (trimmedLine.toLowerCase().startsWith("negative prompt:")) {
          currentSection = "negative";
          // "Negative prompt:" 部分を除いた内容を取得
          const negativeContent = trimmedLine.substring(16).trim();
          if (negativeContent) {
            negativeLines.push(negativeContent);
          }
          continue;
        }

        // 設定情報の開始を検出（Steps, Sampler, CFG scale, Seed など）
        if (
          trimmedLine.match(
            /^(Steps|Sampler|CFG scale|Seed|Size|Model|VAE|Clip skip|Denoising strength|Hires|ControlNet|Lora|LyCORIS|Textual inversion|Version)[:：]/i
          )
        ) {
          currentSection = "settings";
          settingsLines.push(trimmedLine);
          continue;
        }

        // 空行はスキップ
        if (!trimmedLine) {
          continue;
        }

        // 現在のセクションに応じて分類
        if (currentSection === "positive") {
          positiveLines.push(trimmedLine);
        } else if (currentSection === "negative") {
          negativeLines.push(trimmedLine);
        } else if (currentSection === "settings") {
          settingsLines.push(trimmedLine);
        }
      }

      // 各セクションをテキストとして結合
      result.positive = positiveLines.join("\n").trim();
      result.negative = negativeLines.join("\n").trim();
      result.settings = settingsLines.join("\n").trim();
    } catch (error) {
      // 解析に失敗した場合は全文をポジティブに入れる
      result.positive = promptText;
    }

    return result;
  }

  displayMetadata(metadata, file) {
    const pngInfo = document.getElementById(DOM_IDS.OTHER.PNG_INFO);
    if (!pngInfo) return;

    let html = '<div style="margin-top: 15px;">';

    // ファイル基本情報
    html += "<h4>📄 ファイル情報</h4>";
    html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">';
    html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold;">ファイル名:</td><td style="padding: 5px; border: 1px solid #ddd;">${file.name}</td></tr>`;
    html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold;">ファイルサイズ:</td><td style="padding: 5px; border: 1px solid #ddd;">${(file.size / 1024).toFixed(2)} KB</td></tr>`;

    if (metadata.fileInfo.width && metadata.fileInfo.height) {
      html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold;">サイズ:</td><td style="padding: 5px; border: 1px solid #ddd;">${metadata.fileInfo.width} × ${metadata.fileInfo.height} px</td></tr>`;
      html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold;">ビット深度:</td><td style="padding: 5px; border: 1px solid #ddd;">${metadata.fileInfo.bitDepth}</td></tr>`;
      html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold;">カラータイプ:</td><td style="padding: 5px; border: 1px solid #ddd;">${metadata.fileInfo.colorType}</td></tr>`;
    }
    html += "</table>";

    // メタデータ情報
    if (Object.keys(metadata.textChunks).length > 0) {
      html += "<h4>🏷️ メタデータ</h4>";
      html += '<table style="width: 100%; border-collapse: collapse;">';

      for (const [key, value] of Object.entries(metadata.textChunks)) {
        // 省略せずに全文表示
        html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold; vertical-align: top; min-width: 120px;">${key}:</td><td style="padding: 5px; border: 1px solid #ddd; word-break: break-word; white-space: pre-wrap;">${value}</td></tr>`;
      }
      html += "</table>";

      // プロンプト情報があれば解析して分割表示
      if (metadata.textChunks.parameters || metadata.textChunks.prompt) {
        const promptText = metadata.textChunks.parameters || metadata.textChunks.prompt;
        const parsedPrompt = this.parsePromptInfo(promptText);

        html += "<h4>✨ プロンプト情報</h4>";
        html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">';

        // ポジティブプロンプト
        if (parsedPrompt.positive) {
          html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold; vertical-align: top; min-width: 120px;">ポジティブ:</td><td style="padding: 5px; border: 1px solid #ddd; word-break: break-word; white-space: pre-wrap;">${parsedPrompt.positive}</td></tr>`;
          html += `<tr><td style="padding: 5px; border: 1px solid #ddd;"></td><td style="padding: 5px; border: 1px solid #ddd;"><button onclick="navigator.clipboard.writeText('${parsedPrompt.positive.replace(/'/g, "\\'")}').then(() => alert('ポジティブプロンプトをコピーしました'))" style="padding: 3px 8px; font-size: 12px; cursor: pointer;">📋 ポジティブをコピー</button></td></tr>`;
        }

        // ネガティブプロンプト
        if (parsedPrompt.negative) {
          html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold; vertical-align: top;">ネガティブ:</td><td style="padding: 5px; border: 1px solid #ddd; word-break: break-word; white-space: pre-wrap;">${parsedPrompt.negative}</td></tr>`;
          html += `<tr><td style="padding: 5px; border: 1px solid #ddd;"></td><td style="padding: 5px; border: 1px solid #ddd;"><button onclick="navigator.clipboard.writeText('${parsedPrompt.negative.replace(/'/g, "\\'")}').then(() => alert('ネガティブプロンプトをコピーしました'))" style="padding: 3px 8px; font-size: 12px; cursor: pointer;">📋 ネガティブをコピー</button></td></tr>`;
        }

        // 設定情報
        if (parsedPrompt.settings) {
          html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold; vertical-align: top;">設定:</td><td style="padding: 5px; border: 1px solid #ddd; word-break: break-word; white-space: pre-wrap;">${parsedPrompt.settings}</td></tr>`;
          html += `<tr><td style="padding: 5px; border: 1px solid #ddd;"></td><td style="padding: 5px; border: 1px solid #ddd;"><button onclick="navigator.clipboard.writeText('${parsedPrompt.settings.replace(/'/g, "\\'")}').then(() => alert('設定をコピーしました'))" style="padding: 3px 8px; font-size: 12px; cursor: pointer;">📋 設定をコピー</button></td></tr>`;
        }

        // 全体コピー
        html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold; vertical-align: top;">全体:</td><td style="padding: 5px; border: 1px solid #ddd;"><button onclick="navigator.clipboard.writeText('${promptText.replace(/'/g, "\\'")}').then(() => alert('全体をコピーしました'))" style="padding: 3px 8px; font-size: 12px; cursor: pointer;">📋 全体をコピー</button></td></tr>`;

        html += "</table>";
      }
    } else {
      html += '<p style="color: #666; font-style: italic;">メタデータが見つかりませんでした</p>';
    }

    html += "</div>";
    pngInfo.innerHTML = html;
  }

  /**
   * ドラッグ&ドロップの設定
   * @param {HTMLElement} dropArea - ドロップエリアの要素
   */
  setupDragDrop(dropArea) {
    if (!dropArea) return;

    // ドラッグオーバー
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropArea.style.backgroundColor = "var(--bg-accent)";
      dropArea.style.borderColor = "var(--accent-primary)";
    });

    // ドラッグリーブ
    dropArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      if (!dropArea.contains(e.relatedTarget)) {
        dropArea.style.backgroundColor = "";
        dropArea.style.borderColor = "";
      }
    });

    // ドロップ
    dropArea.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropArea.style.backgroundColor = "";
      dropArea.style.borderColor = "";

      const files = Array.from(e.dataTransfer.files);

      if (files.length === 0) {
        ErrorHandler.notify("ファイルが選択されていません");
        return;
      }

      for (const file of files) {
        await this.handleFile(file);
      }
    });

    // クリックでファイル選択
    dropArea.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".png";
      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          await this.handleFile(file);
        }
      };
      input.click();
    });
  }
}

// インスタンス化（グローバル利用のため）
const fileHandler = new FileHandler();
