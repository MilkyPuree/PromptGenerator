/**
 * テーマ管理クラス
 * 
 * ダークテーマ・ライトテーマの切り替え機能を提供します
 * 設定の保存・読み込み・適用を統合管理します
 */
class ThemeManager {
  constructor() {
    this.themes = {
      dark: 'dark',
      light: 'light',
      novelai: 'novelai',
      stablediffusion: 'stablediffusion',
      'automatic1111-dark': 'automatic1111-dark',
      comfyui: 'comfyui',
      'spring-sakura': 'spring-sakura',
      'summer-ocean': 'summer-ocean',
      'autumn-leaves': 'autumn-leaves',
      'winter-snow': 'winter-snow'
    };
    this.defaultTheme = 'dark';
    this.currentTheme = this.defaultTheme;
    this.storageKey = 'theme';
    
    this.init();
  }

  /**
   * テーママネージャーの初期化
   */
  async init() {
    try {
      // 保存されたテーマ設定を読み込み
      await this.loadTheme();
      
      // 初期テーマを適用
      this.applyTheme(this.currentTheme);
      
      console.log(`[ThemeManager] 初期化完了: ${this.currentTheme}テーマ`);
    } catch (error) {
      console.error('[ThemeManager] 初期化エラー:', error);
      // エラー時はデフォルトテーマを適用
      this.applyTheme(this.defaultTheme);
    }
  }

  /**
   * テーマを適用
   * @param {string} theme - テーマ名 ('dark' または 'light')
   */
  applyTheme(theme) {
    if (!this.isValidTheme(theme)) {
      console.warn(`[ThemeManager] 無効なテーマ: ${theme}, デフォルトテーマを使用`);
      theme = this.defaultTheme;
    }

    try {
      // HTMLのdata-theme属性を設定
      document.documentElement.setAttribute('data-theme', theme);
      
      // 現在のテーマを更新
      this.currentTheme = theme;
      
      // テーマ変更イベントを発火
      this.dispatchThemeChangeEvent(theme);
      
      console.log(`[ThemeManager] テーマ適用完了: ${theme}`);
    } catch (error) {
      console.error('[ThemeManager] テーマ適用エラー:', error);
    }
  }

  /**
   * テーマを切り替え
   * @param {string} theme - 切り替え先のテーマ名
   */
  async switchTheme(theme) {
    if (!this.isValidTheme(theme)) {
      console.warn(`[ThemeManager] 無効なテーマ: ${theme}`);
      return false;
    }

    try {
      // テーマを適用
      this.applyTheme(theme);
      
      // 設定を保存
      await this.saveTheme(theme);
      
      console.log(`[ThemeManager] テーマ切り替え完了: ${theme}`);
      return true;
    } catch (error) {
      console.error('[ThemeManager] テーマ切り替えエラー:', error);
      return false;
    }
  }

  /**
   * 現在のテーマを取得
   * @returns {string} 現在のテーマ名
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * 利用可能なテーマ一覧を取得
   * @returns {Object} テーマ一覧
   */
  getAvailableThemes() {
    return {
      dark: 'ダークテーマ',
      light: 'ライトテーマ',
      novelai: 'NovelAIテーマ',
      stablediffusion: 'AUTOMATIC1111 (ライト)',
      'automatic1111-dark': 'AUTOMATIC1111 (ダーク)',
      comfyui: 'ComfyUI (ダーク)',
      'spring-sakura': '🌸 春の桜',
      'summer-ocean': '🌊 夏の海',
      'autumn-leaves': '🍁 秋の紅葉',
      'winter-snow': '❄️ 冬の雪原'
    };
  }

  /**
   * テーマが有効かどうかチェック
   * @param {string} theme - テーマ名
   * @returns {boolean} 有効な場合true
   */
  isValidTheme(theme) {
    return Object.keys(this.themes).includes(theme);
  }

  /**
   * テーマをトグル（ダーク⇔ライト⇔NovelAI）
   */
  async toggleTheme() {
    const themeOrder = ['dark', 'light', 'novelai', 'stablediffusion', 'automatic1111-dark', 'comfyui', 'spring-sakura', 'summer-ocean', 'autumn-leaves', 'winter-snow'];
    const currentIndex = themeOrder.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    const newTheme = themeOrder[nextIndex];
    return await this.switchTheme(newTheme);
  }

  /**
   * テーマ設定を保存
   * @param {string} theme - 保存するテーマ名
   */
  async saveTheme(theme) {
    try {
      // AppStateのoptionDataに保存
      if (typeof AppState !== 'undefined' && AppState.userSettings) {
        AppState.userSettings.optionData = AppState.userSettings.optionData || {};
        AppState.userSettings.optionData.theme = theme;
        
        // Chrome Storage APIに保存
        if (typeof saveOptionData === 'function') {
          await saveOptionData();
        }
      }
      
      console.log(`[ThemeManager] テーマ保存完了: ${theme}`);
    } catch (error) {
      console.error('[ThemeManager] テーマ保存エラー:', error);
    }
  }

  /**
   * テーマ設定を読み込み
   */
  async loadTheme() {
    try {
      // AppStateから読み込み
      if (typeof AppState !== 'undefined' && AppState.userSettings) {
        const savedTheme = AppState.userSettings.optionData?.theme;
        
        if (savedTheme && this.isValidTheme(savedTheme)) {
          this.currentTheme = savedTheme;
          console.log(`[ThemeManager] テーマ読み込み完了: ${savedTheme}`);
        } else {
          console.log(`[ThemeManager] 保存されたテーマなし、デフォルトテーマを使用: ${this.defaultTheme}`);
        }
      }
    } catch (error) {
      console.error('[ThemeManager] テーマ読み込みエラー:', error);
    }
  }

  /**
   * テーマ変更イベントを発火
   * @param {string} theme - 変更されたテーマ名
   */
  dispatchThemeChangeEvent(theme) {
    try {
      const event = new CustomEvent('theme-changed', {
        detail: { theme }
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('[ThemeManager] イベント発火エラー:', error);
    }
  }

  /**
   * テーマ変更イベントリスナーを追加
   * @param {Function} callback - コールバック関数
   */
  onThemeChange(callback) {
    document.addEventListener('theme-changed', (event) => {
      callback(event.detail.theme);
    });
  }

  /**
   * デバッグ情報を取得
   * @returns {Object} デバッグ情報
   */
  getDebugInfo() {
    return {
      currentTheme: this.currentTheme,
      defaultTheme: this.defaultTheme,
      availableThemes: this.getAvailableThemes(),
      htmlAttribute: document.documentElement.getAttribute('data-theme')
    };
  }
}

// グローバル変数として公開
window.ThemeManager = ThemeManager;
window.themeManager = new ThemeManager();