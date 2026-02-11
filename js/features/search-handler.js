// ============================================
// 検索ハンドラークラス
// ============================================
class SearchHandler {
  constructor(app) {
    this.app = app; // PromptGeneratorAppインスタンスへの参照
  }

  /**
   * 検索を実行
   * @param {Object} options - 検索オプション
   */
  async performSearch(options = {}) {
    if (AppState.ui.isSearching) return;

    const keyword = document.getElementById(DOM_IDS.SEARCH.INPUT).value;
    const searchCat0 = document.getElementById(DOM_IDS.SEARCH.CATEGORY_BIG).value;
    const searchCat1 = document.getElementById(DOM_IDS.SEARCH.CATEGORY_MIDDLE).value;
    const categories = [searchCat0, searchCat1];

    AppState.data.searchCategory = categories;
    await saveCategory();

    // ローディング表示の制御（翻訳が必要な場合のみ表示）
    const needsTranslation = keyword && Search(keyword, categories).length === 0;
    const showLoading = options.showLoading !== false && needsTranslation;

    if (showLoading) {
      // ローディングが必要な場合のみErrorHandler.handleAsyncを使用
      await ErrorHandler.handleAsync(
        async () => {
          AppState.ui.isSearching = true;
          await this.doSearch(keyword, categories);
          AppState.ui.isSearching = false;
        },
        "検索処理",
        { showLoading: true }
      );
    } else {
      // ローディング不要な場合は直接実行
      AppState.ui.isSearching = true;
      await this.doSearch(keyword, categories);
      AppState.ui.isSearching = false;
    }
  }

  /**
   * 検索処理の実行
   * @param {string} keyword - 検索キーワード
   * @param {Array} categories - カテゴリーフィルター
   */
  async doSearch(keyword, categories) {
    ListBuilder.clearList(DOM_SELECTORS.BY_ID.PROMPT_LIST);

    // カテゴリと検索ワードが両方とも未入力の場合
    const hasKeyword = keyword && keyword.trim().length > 0;
    const hasCategory = categories && (categories[0] || categories[1]);

    if (!hasKeyword && !hasCategory) {
      // 入力促進メッセージを表示
      this.showSearchPrompt();
      return;
    }

    const results = Search(keyword, categories);

    if (results.length > 0) {
      // タブ側にリスト表示を依頼
      await this.app.tabs.search.displaySearchResults(results);
    } else if (keyword) {
      await this.handleNoSearchResults(keyword);
    } else {
      const isSearchElement = document.getElementById(DOM_IDS.SEARCH.RESULT_AREA);
      if (isSearchElement) {
        isSearchElement.innerHTML = "何も見つかりませんでした";
      }
    }
  }

  /**
   * 検索入力を促すメッセージを表示
   */
  showSearchPrompt() {
    const searchContainer = document.querySelector("#searchResultsSection");
    if (!searchContainer) {
      return;
    }

    // 既存のコンテンツをクリア
    searchContainer.innerHTML = "";

    // empty-state-contentを使用したメッセージを作成
    const emptyStateDiv = document.createElement("div");
    emptyStateDiv.className = "empty-state-message";

    emptyStateDiv.innerHTML = `
      <div class="empty-state-content">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">
          <h3>検索条件を入力してください</h3>
          <p>キーワードまたはカテゴリーを選択して検索を開始してください</p>
        </div>
        <div class="empty-state-actions">
          <div class="search-prompt-tips">
            <div class="tip-item">
              <span class="tip-icon">💡</span>
              <span class="tip-text">検索欄にキーワードを入力してEnterキーを押してください</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">🏷️</span>
              <span class="tip-text">カテゴリーを選択して絞り込み検索もできます</span>
            </div>
          </div>
        </div>
      </div>
    `;

    searchContainer.appendChild(emptyStateDiv);

    // 検索フィールドにフォーカス
    const searchInput = document.getElementById(DOM_IDS.SEARCH.INPUT);
    if (searchInput) {
      searchInput.focus();
    }
  }

  /**
   * 検索結果が0件の場合の処理
   * @param {string} keyword - 検索キーワード
   */
  async handleNoSearchResults(keyword) {
    SearchLogAPI(keyword);

    const isSearchElement = document.getElementById(DOM_IDS.SEARCH.RESULT_AREA);
    if (isSearchElement) {
      isSearchElement.innerHTML = "辞書内に存在しないため翻訳中";
    }

    const translationPromises = [];
    const results = [];

    const hasDeeplKey = AppState.userSettings.optionData?.deeplAuth || AppState.userSettings.optionData?.deeplAuthKey;

    if (hasDeeplKey) {
      // DeepL翻訳のみ実行
      translationPromises.push(
        this.translateWithService(keyword, "DeepL", translateDeepl).then((data) => results.push(data))
      );
    } else {
      // Google翻訳のみ実行
      translationPromises.push(
        this.translateWithService(keyword, "Google", translateGoogle).then((data) => results.push(data))
      );
    }

    await Promise.all(translationPromises);

    // タブ側に翻訳結果表示を依頼
    await this.app.tabs.search.displayTranslationResults(results);
  }

  /**
   * 翻訳サービスを使用した翻訳
   * @param {string} keyword - 翻訳するキーワード
   * @param {string} serviceName - サービス名
   * @param {Function} translateFunc - 翻訳関数
   * @returns {Promise<Object>} 翻訳結果
   */
  async translateWithService(keyword, serviceName, translateFunc) {
    // キーワードの安全性チェック
    let safeKeyword = keyword;
    if (typeof keyword !== "string") {
      if (Array.isArray(keyword) && keyword.length > 0) {
        safeKeyword = String(keyword[0] || "");
      } else if (typeof keyword === "object" && keyword !== null) {
        if (keyword.text) {
          safeKeyword = String(keyword.text);
        } else if (keyword.value) {
          safeKeyword = String(keyword.value);
        } else {
          safeKeyword = String(keyword);
        }
      } else {
        safeKeyword = String(keyword || "");
      }
    }

    return new Promise((resolve) => {
      translateFunc(safeKeyword, (translatedText) => {
        // 翻訳結果が文字列でない場合の安全性チェック
        let safeTranslatedText;
        if (typeof translatedText === "string") {
          safeTranslatedText = translatedText;
        } else if (Array.isArray(translatedText) && translatedText.length > 0) {
          // Google翻訳APIは配列で返すことがある
          safeTranslatedText = String(translatedText[0] || "");
        } else if (typeof translatedText === "object" && translatedText !== null) {
          // オブジェクトの場合、適切なプロパティから文字列を抽出
          if (translatedText.text) {
            safeTranslatedText = String(translatedText.text);
          } else if (translatedText.value) {
            safeTranslatedText = String(translatedText.value);
          } else if (translatedText.toString && typeof translatedText.toString === "function") {
            safeTranslatedText = translatedText.toString();
          } else {
            safeTranslatedText = String(translatedText);
          }
        } else {
          safeTranslatedText = String(translatedText || "");
        }

        const isAlphanumeric = /^[a-zA-Z0-9\s:]+$/.test(safeKeyword);

        // data配列の各要素も文字列であることを保証
        const ensureString = (value) => {
          if (typeof value === "string") return value;
          if (Array.isArray(value) && value.length > 0) return String(value[0] || "");
          if (typeof value === "object" && value !== null) {
            if (value.text) return String(value.text);
            if (value.value) return String(value.value);
            return String(value);
          }
          return String(value || "");
        };

        const data = isAlphanumeric
          ? {
              id: `translate-${serviceName}-${Date.now()}`,
              prompt: ensureString(safeKeyword),
              data: ["翻訳完了", `${serviceName}翻訳`, ensureString(safeTranslatedText)],
            }
          : {
              id: `translate-${serviceName}-${Date.now()}`,
              prompt: ensureString(safeTranslatedText),
              data: ["翻訳完了", `${serviceName}翻訳`, ensureString(safeKeyword)],
            };
        resolve(data);
      });
    });
  }

  /**
   * カテゴリー検索をリセット
   */
  resetCategorySearch() {
    const searchCat0 = document.getElementById("search-cat0");
    const searchCat1 = document.getElementById("search-cat1");

    if (searchCat0) {
      searchCat0.value = "";
      // changeイベントを手動で発火
      searchCat0.dispatchEvent(new Event("change"));
    }

    if (searchCat1) {
      searchCat1.value = "";
      searchCat1.disabled = true;
    }

    AppState.data.searchCategory = [,];
    saveCategory();

    const searchInput = document.getElementById(DOM_IDS.SEARCH.INPUT);
    if (searchInput && searchInput.value) {
      // リセット時はローディングを表示しない
      this.performSearch({ showLoading: false });
    }
  }

  /**
   * カテゴリードロップダウンを更新
   * @param {string} targetId - 対象要素のID
   * @param {number} categoryLevel - カテゴリーレベル
   * @param {string} parentValue - 親カテゴリーの値
   */
  updateCategoryDropdown(targetId, categoryLevel, parentValue) {
    // targetIdがセレクタ形式（#で始まる）の場合は、IDのみを抽出
    const elementId = targetId.startsWith("#") ? targetId.substring(1) : targetId;
    const selectElement = document.getElementById(elementId);

    if (!selectElement) return;

    // 既存のオプションをクリア
    selectElement.innerHTML = "";

    const categoryItems = categoryData.data[categoryLevel].filter((item) => item.parent === parentValue);

    categoryItems.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.value;
      selectElement.appendChild(option);
    });

    selectElement.disabled = false;
    selectElement.value = "";
  }
}

// グローバルに公開
if (typeof window !== "undefined") {
  window.SearchHandler = SearchHandler;
}
