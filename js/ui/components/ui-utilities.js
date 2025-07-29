// ============================================
// UIユーティリティ
// ============================================
const UIUtilities = {
  /**
   * プロンプト画像のプレビューを表示
   * @param {Object} value - プレビューするアイテム
   */
  previewPromptImage(value) {
    const imageUrl = `https://ul.h3z.jp/${value.url}.jpg`;

    fetch(imageUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const arrayBuffer = reader.result;
          const binary = atob(arrayBuffer.split(",")[1]);

          // jQuery → Vanilla JS 置換 (Phase 8)
          const popupImage = document.querySelector(DOM_SELECTORS.BY_ID.POPUP_IMAGE);
          if (popupImage) {
            popupImage.src = `data:image/png;base64,${binary}`;
            popupImage.width = UI_DIMENSIONS.IMAGE.PREVIEW_SIZE;
            popupImage.height = UI_DIMENSIONS.IMAGE.PREVIEW_SIZE;
          }

          // jQuery → Vanilla JS 置換 (Phase 8)
          const previewElement = document.querySelector(DOM_SELECTORS.BY_ID.PREVIEW_ELEMENT);
          if (previewElement) {
            previewElement.textContent = `${value.data[0]}:${value.data[1]}:${value.data[2]}`;
          }
          
          const previewPrompt = document.querySelector(DOM_SELECTORS.BY_ID.PREVIEW_PROMPT);
          if (previewPrompt) {
            previewPrompt.value = value.prompt;
          }
          
          const popup = document.querySelector(DOM_SELECTORS.BY_ID.POPUP);
          if (popup) {
            popup.style.display = "flex";
            popup.style.visibility = "visible";
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.log("Preview image not available:", value.url);

        // デフォルト画像を表示するか、プレビューなしで表示
        // jQuery → Vanilla JS 置換 (Phase 8)
        const popupImage = document.querySelector(DOM_SELECTORS.BY_ID.POPUP_IMAGE);
        if (popupImage) {
          popupImage.src = "assets/icon/Icon128.png"; // デフォルト画像
          popupImage.width = UI_DIMENSIONS.IMAGE.PREVIEW_SIZE;
          popupImage.height = UI_DIMENSIONS.IMAGE.PREVIEW_SIZE;
        }

        // jQuery → Vanilla JS 置換 (Phase 8)
        const previewElement = document.querySelector(DOM_SELECTORS.BY_ID.PREVIEW_ELEMENT);
        if (previewElement) {
          previewElement.textContent = `${value.data[0]}:${value.data[1]}:${value.data[2]} (画像なし)`;
        }
        
        const previewPrompt = document.querySelector(DOM_SELECTORS.BY_ID.PREVIEW_PROMPT);
        if (previewPrompt) {
          previewPrompt.value = value.prompt;
        }
        
        const popup = document.querySelector(DOM_SELECTORS.BY_ID.POPUP);
        if (popup) {
          popup.style.display = "flex";
          popup.style.visibility = "visible";
        }
      });
  },

  /**
   * PNG情報を表示
   * @param {Object} data - PNG情報データ
   */
  createPngInfo(data) {
    // jQuery → Vanilla JS 置換 (Phase 8)
    const div = document.createElement('div');
    div.className = 'item';

    Object.entries(data).forEach(([key, value]) => {
      // jQuery → Vanilla JS 置換 (Phase 8)
      const label = document.createElement('label');
      label.textContent = `${key}: `;
      label.className = 'png-info-label';
      
      const span = document.createElement('span');
      span.textContent = value;
      
      const wrapper = document.createElement('div');
      wrapper.appendChild(label);
      wrapper.appendChild(span);
      
      div.appendChild(wrapper);
      label.className = 'png-info-label';
      const $input = $("<input>")
        .attr("type", "text")
        .val(value)
        .addClass("png-info-input");

      $div.append($label, $input, "<br>");
    });

    // jQuery → Vanilla JS 置換 (Phase 8)
    const pngInfo = document.getElementById('pngInfo');
    if (pngInfo) {
      pngInfo.innerHTML = '';
      pngInfo.appendChild(div);
    }
  },

  /**
   * PNGプレビューを作成
   * @param {string} url - 画像URL
   */
  createPngPreview(url) {
    const img = new Image();

    img.onload = function () {
      const canvas = UIFactory.createCanvas();
      const ctx = canvas.getContext("2d");
      const maxSize = 540;

      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > width && height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      canvas.width = maxSize;
      canvas.height = height;

      const x = (canvas.width - width) / 2;
      ctx.drawImage(img, x, 0, width, height);

      $("#preview").attr("src", canvas.toDataURL());
    };

    img.src = url;
  },

  /**
   * PNG情報を取得
   * @param {ArrayBuffer} arrayBuffer - PNGデータ
   * @returns {Object} PNG情報
   */
  getPngInfo(arrayBuffer) {
    const dataView = new DataView(arrayBuffer);
    const info = {
      width: dataView.getUint32(16, false),
      height: dataView.getUint32(20, false),
      bitDepth: dataView.getUint8(24),
      colorType: dataView.getUint8(25),
      compressionMethod: dataView.getUint8(26),
      filterMethod: dataView.getUint8(27),
      interlaceMethod: dataView.getUint8(28),
      textChunks: this.getTextChunk(arrayBuffer),
    };
    return info;
  },

  /**
   * テキストチャンクを取得
   * @param {ArrayBuffer} arrayBuffer - PNGデータ
   * @returns {Object} テキストチャンク
   */
  getTextChunk(arrayBuffer) {
    let data = {};
    let chunkOffset = 33;

    while (chunkOffset < arrayBuffer.byteLength) {
      const chunkLength = new DataView(arrayBuffer, chunkOffset, 4).getUint32(
        0,
        false
      );
      const chunkType = new TextDecoder().decode(
        new Uint8Array(arrayBuffer, chunkOffset + 4, 4)
      );

      if (chunkType === "tEXt") {
        const keywordEnd = new Uint8Array(arrayBuffer, chunkOffset + 8).indexOf(
          0
        );
        const keyword = new TextDecoder().decode(
          new Uint8Array(arrayBuffer, chunkOffset + 8, keywordEnd)
        );
        const textData = new TextDecoder().decode(
          new Uint8Array(
            arrayBuffer,
            chunkOffset + 8 + keywordEnd + 1,
            chunkLength - (keywordEnd + 1)
          )
        );

        if (keyword === "Comment") {
          data = JSON.parse(textData);
          data.metadata = textData;
        } else if (keyword === "parameters") {
          data = this.parseSDPng(`prompt: ${textData}`);
          data.metadata = `prompt: ${textData}`;
        }
      }

      chunkOffset += chunkLength + 12;
    }

    return data;
  },

  /**
   * StableDiffusion PNG情報を解析
   * @param {string} text - 解析するテキスト
   * @returns {Object} 解析結果
   */
  parseSDPng(text) {
    const data = {};

    // Extract steps and other parameters
    let matches = text.match(/(.*)(steps:.*)/i);
    if (matches) {
      const paramsMatch = [
        ...matches[0].matchAll(/([A-Za-z\s]+):\s*([^,\n]*)/g),
      ];
      for (const match of paramsMatch) {
        const key = match[1].trim();
        const value = match[2].trim();

        if (key !== "prompt" && key !== "Negative prompt") {
          data[key] = value;
        }
      }
    }

    // Extract prompt and negative prompt
    const allMatches = [
      ...text.matchAll(/([A-Za-z\s]+):\s*((?:[^,\n]+,)*[^,\n]+)/g),
    ];
    for (const match of allMatches) {
      const key = match[1].trim();
      const value = match[2].trim();

      if (key === "prompt" || key === "Negative prompt") {
        data[key] = value;
      }
    }

    return data;
  },
};

// ui-utilities.js に追加
const CategoryAutocomplete = {
  // 入力補完の改善
  enhanceInput(inputElement, categoryLevel) {
    let currentFocus = -1;

    inputElement.addEventListener("input", function (e) {
      const value = this.value;
      if (!value) return;

      // カスタムドロップダウンはCustomDropdownクラスで実装済み
      // この機能は現在非活性化
    });

    // 矢印キーでの選択サポート（現在非活性化）
    inputElement.addEventListener("keydown", function (e) {
      if (e.keyCode === 40) {
        // 下矢印
        currentFocus++;
        // カスタムドロップダウンで処理
      } else if (e.keyCode === 38) {
        // 上矢印
        currentFocus--;
      } else if (e.keyCode === 13) {
        // Enter
        e.preventDefault();
        // 選択を確定
      }
    });
  },
};

// グローバルに公開（互換性のため関数も個別に公開）
if (typeof window !== "undefined") {
  window.UIUtilities = UIUtilities;

  // 後方互換性のため、個別の関数としても公開
  window.previewPromptImage = UIUtilities.previewPromptImage.bind(UIUtilities);
  window.createPngInfo = UIUtilities.createPngInfo.bind(UIUtilities);
  window.createPngPreview = UIUtilities.createPngPreview.bind(UIUtilities);
  window.getPngInfo = UIUtilities.getPngInfo.bind(UIUtilities);
  window.getTextChunk = UIUtilities.getTextChunk.bind(UIUtilities);
  window.parseSDPng = UIUtilities.parseSDPng.bind(UIUtilities);
}
