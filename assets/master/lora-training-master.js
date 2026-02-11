let loraTrainingMaster = {
  data: [
    // ==========================================
    // 顔アップ（12枚）
    // ==========================================
    { prompt: "face close up, front view, happy smile, looking at viewer, white background", data: ["LoRA:顔アップ", "正面", "笑顔・正面・白背景"] },
    { prompt: "face close up, three quarter view, serious expression, simple background", data: ["LoRA:顔アップ", "斜め", "真剣・斜め"] },
    { prompt: "face close up, looking up, hopeful expression, soft lighting", data: ["LoRA:顔アップ", "見上げ", "希望・見上げ"] },
    { prompt: "face close up, looking down, sad expression, tears in eyes", data: ["LoRA:顔アップ", "見下ろし", "悲しみ・涙目"] },
    { prompt: "face close up, surprised expression, open mouth, wide eyes", data: ["LoRA:顔アップ", "正面", "驚き"] },
    { prompt: "face close up, angry expression, furrowed brows, sharp eyes", data: ["LoRA:顔アップ", "正面", "怒り"] },
    { prompt: "face close up, eyes closed, peaceful smile, wind blowing hair", data: ["LoRA:顔アップ", "正面", "穏やか・目閉じ"] },
    { prompt: "face close up, wink, playful expression, one eye closed", data: ["LoRA:顔アップ", "正面", "ウインク"] },
    { prompt: "face close up, embarrassed, blushing, looking away", data: ["LoRA:顔アップ", "視線外し", "照れ・赤面"] },
    { prompt: "face close up, determined expression, glowing light, dramatic lighting", data: ["LoRA:顔アップ", "正面", "決意・ドラマチック"] },
    { prompt: "face close up, from side, profile, blue sky background", data: ["LoRA:顔アップ", "横顔", "横顔・青空"] },
    { prompt: "face close up, slightly from below, confident smirk", data: ["LoRA:顔アップ", "煽り", "自信・煽り気味"] },

    // ==========================================
    // 上半身（10枚）
    // ==========================================
    { prompt: "upper body, front view, arms crossed, confident pose, outdoor", data: ["LoRA:上半身", "正面", "腕組み・自信"] },
    { prompt: "upper body, from side, profile, wind blowing hair, blue sky", data: ["LoRA:上半身", "横", "横顔・風"] },
    { prompt: "upper body, three quarter view, hand on chest, emotional expression, sunset", data: ["LoRA:上半身", "斜め", "胸に手・感動"] },
    { prompt: "upper body, looking back over shoulder, smile, indoor", data: ["LoRA:上半身", "振り返り", "振り返り笑顔"] },
    { prompt: "upper body, reading book, gentle expression, library background", data: ["LoRA:上半身", "小物", "読書・図書館"] },
    { prompt: "upper body, holding teacup, elegant pose, table, indoor", data: ["LoRA:上半身", "小物", "ティータイム"] },
    { prompt: "upper body, reaching hand forward, toward viewer, dramatic lighting", data: ["LoRA:上半身", "アクション", "手を伸ばす"] },
    { prompt: "upper body, hands clasped together, eyes closed, praying, soft light", data: ["LoRA:上半身", "ポーズ", "祈り"] },
    { prompt: "upper body, leaning forward, curious expression, tilted head", data: ["LoRA:上半身", "ポーズ", "前傾・好奇心"] },
    { prompt: "upper body, stretching arms up, yawning, morning, window light", data: ["LoRA:上半身", "ポーズ", "伸び・朝"] },

    // ==========================================
    // 全身（12枚）
    // ==========================================
    { prompt: "full body, standing, arms at sides, neutral expression, white background", data: ["LoRA:全身", "立ち", "素立ち・白背景"] },
    { prompt: "full body, walking, looking to the side, outdoor, garden path", data: ["LoRA:全身", "立ち", "歩き・庭"] },
    { prompt: "full body, sitting on chair, hands on lap, gentle smile, indoor, window", data: ["LoRA:全身", "座り", "椅子座り・窓辺"] },
    { prompt: "full body, sitting on ground, hugging knees, outdoor, grass", data: ["LoRA:全身", "座り", "体育座り・草原"] },
    { prompt: "full body, running, dynamic pose, outdoor, wind", data: ["LoRA:全身", "アクション", "走り"] },
    { prompt: "full body, twirling, dress flowing, happy, sparkles", data: ["LoRA:全身", "アクション", "回転・ドレスなびき"] },
    { prompt: "full body, hand on hip, confident pose, castle interior", data: ["LoRA:全身", "立ち", "腰に手・城内"] },
    { prompt: "full body, leaning against wall, casual, looking away, alley", data: ["LoRA:全身", "立ち", "壁にもたれ"] },
    { prompt: "full body, kneeling on ground, looking up, dramatic lighting", data: ["LoRA:全身", "膝つき", "跪き・見上げ"] },
    { prompt: "full body, jumping, arms raised, cheerful, blue sky", data: ["LoRA:全身", "アクション", "ジャンプ"] },
    { prompt: "full body, standing in water, barefoot, river, nature", data: ["LoRA:全身", "立ち", "水辺・裸足"] },
    { prompt: "full body, back to back with shadow, mysterious, moonlight", data: ["LoRA:全身", "立ち", "月光・ミステリアス"] },

    // ==========================================
    // 背面（5枚）
    // ==========================================
    { prompt: "from behind, looking back, smile, outdoor, sunset", data: ["LoRA:背面", "振り返り", "振り返り・夕焼け"] },
    { prompt: "from behind, full body, walking away, long path, trees", data: ["LoRA:背面", "歩き", "歩き去る・並木道"] },
    { prompt: "from behind, upper body, wind blowing hair, dramatic sky", data: ["LoRA:背面", "上半身", "風・空"] },
    { prompt: "from behind, standing, looking up at sky, night, stars", data: ["LoRA:背面", "立ち", "星空・見上げ"] },
    { prompt: "from behind, sitting, hugging pillow, bed, indoor, soft lighting", data: ["LoRA:背面", "座り", "ベッド・枕"] },

    // ==========================================
    // シーン・アクション（9枚）
    // ==========================================
    { prompt: "battle pose, holding weapon forward, determined expression, dramatic lighting, dark background", data: ["LoRA:シーン", "バトル", "戦闘構え"] },
    { prompt: "casting magic, glowing hands, magical circle, concentrated expression", data: ["LoRA:シーン", "バトル", "魔法詠唱"] },
    { prompt: "dancing, elegant pose, ballroom, chandelier, motion blur", data: ["LoRA:シーン", "イベント", "ダンス・舞踏会"] },
    { prompt: "sleeping, lying in bed, peaceful expression, soft blanket, night", data: ["LoRA:シーン", "日常", "睡眠"] },
    { prompt: "rain, wet hair, melancholy expression, holding umbrella, city street", data: ["LoRA:シーン", "天候", "雨・傘"] },
    { prompt: "snow, winter scenery, scarf, cold breath, holding hands together", data: ["LoRA:シーン", "天候", "雪・冬"] },
    { prompt: "cherry blossoms, spring, petals falling, smiling, park", data: ["LoRA:シーン", "天候", "桜・春"] },
    { prompt: "stage, spotlight, singing, microphone, performance, audience", data: ["LoRA:シーン", "イベント", "歌・ステージ"] },
    { prompt: "throne, sitting, regal pose, crown, majestic, castle", data: ["LoRA:シーン", "イベント", "玉座・威厳"] }
  ]
};

// CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = loraTrainingMaster;
}

// Browser
if (typeof window !== "undefined") {
  window.loraTrainingMasterData = loraTrainingMaster.data;
}

// Freeze
loraTrainingMaster.data.forEach((item) => {
  Object.freeze(item.data);
  Object.freeze(item);
});
Object.freeze(loraTrainingMaster.data);
Object.freeze(loraTrainingMaster);
