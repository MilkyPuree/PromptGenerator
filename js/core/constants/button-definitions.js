/**
 * FlexibleListボタン定義
 * createFlexibleButton で使用するボタンタイプの静的定義
 */

const FLEXIBLE_BUTTON_DEFINITIONS = {
  add: {
    text: "➕",
    title: "プロンプト入力欄に追加",
    dataAction: "add",
  },
  copy: {
    text: "📋",
    title: "クリップボードにコピー",
    dataAction: "copy",
  },
  delete: {
    text: "🗑️",
    title: "アイテムを削除",
    dataAction: "delete",
  },
  load: {
    text: "⬆️",
    title: "プロンプトとして読み込み",
    dataAction: "load",
  },
  favorite: {
    text: "⭐️",
    title: "お気に入りに追加",
    dataAction: "favorite",
  },
  generate: {
    text: "⚡",
    title: "このプロンプトでテスト生成",
    dataAction: "generate",
  },
  register: {
    text: "💾",
    title: "辞書に新規登録",
    dataAction: "register",
    disabledTitle: "この項目は登録できません",
  },
  moveUp: {
    text: "↑",
    title: "上に移動",
    dataAction: "moveUp",
    disabledTitle: "これ以上上に移動できません",
  },
  moveDown: {
    text: "↓",
    title: "下に移動",
    dataAction: "moveDown",
    disabledTitle: "これ以上下に移動できません",
  },
};

// 変更不可にする
Object.freeze(FLEXIBLE_BUTTON_DEFINITIONS);
Object.keys(FLEXIBLE_BUTTON_DEFINITIONS).forEach((key) => {
  Object.freeze(FLEXIBLE_BUTTON_DEFINITIONS[key]);
});

/**
 * フィールドタイプ→セレクターのマッピング
 * updateFlexibleField で使用
 */
const FIELD_TYPE_SELECTORS = {
  prompt: ".flex-col-prompt",
  weight: ".flex-col-weight",
  category: ".flex-col-category:nth-of-type(1)",
  "category.0": ".flex-col-category:nth-of-type(1)",
  "category.1": ".flex-col-category:nth-of-type(2)",
  "category.2": ".flex-col-category:nth-of-type(3)",
  "data.0": 'input[data-field="data.0"]',
  "data.1": 'input[data-field="data.1"]',
  "data.2": 'input[data-field="data.2"]',
};
Object.freeze(FIELD_TYPE_SELECTORS);

/**
 * 空状態メッセージの定義
 * createEmptyState で使用
 */
const EMPTY_STATE_MESSAGES = {
  search: { message: "検索結果が見つかりませんでした", icon: "🔍" },
  edit: { message: "プロンプトを生成してから編集してください", icon: "✏️" },
  dictionary: { message: "辞書データがありません", icon: "📚" },
  slot: { message: "スロットが空です", icon: "🎰" },
  extraction: { message: "抽出モード中です - 編集はできません", icon: "🎲" },
  default: { message: "データがありません", icon: "📄" },
};
Object.freeze(EMPTY_STATE_MESSAGES);
Object.keys(EMPTY_STATE_MESSAGES).forEach((key) => {
  Object.freeze(EMPTY_STATE_MESSAGES[key]);
});

/**
 * フィールドツールチップの定義
 * createFlexibleItem で使用
 */
const FIELD_TOOLTIPS = {
  weight: "重み値(-10〜10)：値が大きいほど影響度が高い",
  prompt: "プロンプト：AI画像生成で使用される実際のキーワード",
  category: {
    "data.0": "大カテゴリ：人物・背景・モードなどの大分類",
    "data.1": "中カテゴリ：大カテゴリをさらに細かく分類",
    "data.2": "小カテゴリ：最も具体的な特徴や属性",
    title: "表示名：お気に入りの識別用タイトル",
  },
};
Object.freeze(FIELD_TOOLTIPS);
Object.freeze(FIELD_TOOLTIPS.category);

/**
 * カテゴリレベル定義
 * setupCustomDropdownChain で使用
 */
const CATEGORY_LEVELS = {
  BIG: { level: 0, name: "big", dataKey: "data.0", dataIndex: 0 },
  MIDDLE: { level: 1, name: "middle", dataKey: "data.1", dataIndex: 1 },
  SMALL: { level: 2, name: "small", dataKey: "data.2", dataIndex: 2 },
};
Object.freeze(CATEGORY_LEVELS);
Object.keys(CATEGORY_LEVELS).forEach((key) => {
  Object.freeze(CATEGORY_LEVELS[key]);
});
