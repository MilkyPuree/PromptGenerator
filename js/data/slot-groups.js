class SlotGroupManager {
  constructor() {
    this.groups = new Map(); // グループID → グループデータ
    this.currentGroupId = "default";
    this.nextGroupId = 1;
    this.defaultGroupName = "デフォルトグループ";

    this.groupStructure = {
      id: "string",
      name: "string",
      description: "string",
      createdAt: "number",
      lastModified: "number",
      slots: "array", // スロットデータ配列
      isDefault: "boolean",
    };
  }

  async initialize() {
    await this.loadFromStorage();

    if (!this.groups.has("default")) {
      await this.createDefaultGroup();
    }
  }

  async createDefaultGroup() {
    const defaultGroup = {
      id: "default",
      name: this.defaultGroupName,
      description: "初期設定のスロットグループ",
      createdAt: Date.now(),
      lastModified: Date.now(),
      slots: [],
      isDefault: true,
    };

    await this.migrateExistingSlots(defaultGroup);

    this.groups.set("default", defaultGroup);
    await this.saveToStorage();
  }

  async migrateExistingSlots(targetGroup) {
    try {
      const result = await Storage.get("promptSlots");
      if (result.promptSlots?.slots) {
        targetGroup.slots = this.cloneSlots(result.promptSlots.slots);
        return;
      }

      if (window.promptSlotManager?.slots) {
        targetGroup.slots = this.cloneSlots(window.promptSlotManager.slots);
        return;
      }

      targetGroup.slots = this.createDefaultSlots();
    } catch (error) {
      targetGroup.slots = this.createDefaultSlots();
    }
  }

  createDefaultSlots() {
    const defaultSlots = [];
    const defaultSlotCount = 3;

    const getDefaultWeight = () => {
      const shaping = AppState?.userSettings?.optionData?.shaping || "SD";
      switch (shaping) {
        case "SD":
          return 1.0;
        case "NAI":
          return 0.0;
        default:
          return 1.0;
      }
    };

    const defaultWeight = getDefaultWeight();

    for (let i = 0; i < defaultSlotCount; i++) {
      defaultSlots.push({
        id: i,
        name: "",
        prompt: "",
        elements: [],
        isUsed: false,
        lastModified: null,
        mode: "normal",
        category: { big: "", middle: "" },
        sequentialIndex: 0,
        currentExtraction: null,
        lastExtractionTime: null,
        absoluteWeight: defaultWeight,
        weight: defaultWeight,
        muted: false, // 追加：ミュート状態
        dataSource: "dictionary", // 追加：データソース
        favoriteDictionaryId: "", // 追加：お気に入り辞書ID
      });
    }

    return defaultSlots;
  }

  async createGroup(name, description = "") {
    const id = `group_${this.nextGroupId++}`;
    const group = {
      id,
      name,
      description,
      createdAt: Date.now(),
      lastModified: Date.now(),
      slots: [],
      isDefault: false,
    };

    this.groups.set(id, group);
    await this.saveToStorage();
    return id;
  }

  async deleteGroup(groupId) {
    if (groupId === "default") {
      throw new Error("デフォルトグループは削除できません");
    }

    if (!this.groups.has(groupId)) {
      throw new Error("グループが見つかりません");
    }

    if (this.currentGroupId === groupId) {
      await this.switchToGroup("default");
    }

    this.groups.delete(groupId);
    await this.saveToStorage();
  }

  async updateGroup(groupId, updates) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error("グループが見つかりません");
    }

    const allowedUpdates = ["name", "description"];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates.hasOwnProperty(key)) {
        filteredUpdates[key] = updates[key];
      }
    }

    Object.assign(group, filteredUpdates);
    group.lastModified = Date.now();

    await this.saveToStorage();
  }

  async switchToGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error("グループが見つかりません");
    }

    if (this.currentGroupId === groupId) {
      return;
    }

    await this.saveCurrentGroupSlots();

    this.currentGroupId = groupId;
    await this.loadGroupSlots(groupId);

    if (window.promptSlotManager) {
      window.promptSlotManager.updateUI();
    }

    window.dispatchEvent(
      new CustomEvent("slotGroupChanged", {
        detail: { groupId, groupName: group.name },
      })
    );

    await this.saveToStorage();
  }

  async saveCurrentGroupSlots() {
    if (!window.promptSlotManager) {
      return;
    }

    const currentGroup = this.groups.get(this.currentGroupId);
    if (!currentGroup) {
      return;
    }

    // （promptSlotManagerが正しく初期化されていない可能性があるため）
    const currentSlotCount = window.promptSlotManager.slots.length;
    const groupSlotCount = currentGroup.slots ? currentGroup.slots.length : 0;

    if (groupSlotCount > 5 && currentSlotCount <= 3) {
      return;
    }

    await window.promptSlotManager.saveCurrentSlot();
    currentGroup.slots = this.cloneSlots(window.promptSlotManager.slots);
    currentGroup.lastModified = Date.now();
  }

  async loadGroupSlots(groupId) {
    const group = this.groups.get(groupId);

    if (!group || !window.promptSlotManager) {
      return;
    }

    if (group.slots && group.slots.length > 0) {
      const clonedSlots = this.cloneSlots(group.slots);
      window.promptSlotManager.slots = clonedSlots;
      window.promptSlotManager.currentSlot = 0;
      window.promptSlotManager._nextId = Math.max(...group.slots.map((s) => s.id)) + 1;

      await window.promptSlotManager.saveToStorage();

      // GeneratePromptフィールドを更新
      const slot = clonedSlots[0];
      const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      if (generatePrompt && slot) {
        const displayValue = window.promptSlotManager.getSlotDisplayValue(slot);
        if (displayValue) {
          generatePrompt.value = displayValue;
        } else {
          generatePrompt.value =
            slot.mode === "random" || slot.mode === "sequential" || slot.mode === "single"
              ? "[抽出待機中 - Generateボタンを押して抽出]"
              : "";
        }
        generatePrompt.readOnly = slot.mode === "random" || slot.mode === "sequential";
        if (slot.mode === "single") {
          generatePrompt.title = "単一モード：内部はカンマ区切り、表示はスペース区切り（編集可能）";
        } else {
          generatePrompt.title = generatePrompt.readOnly ? "抽出モードで生成されたプロンプト（読み取り専用）" : "";
        }
      }
    } else {
      window.promptSlotManager.initializeSlots();

      // 空のグループの場合もGeneratePromptをクリア
      const generatePrompt = document.getElementById(DOM_IDS.PROMPT.GENERATE);
      if (generatePrompt) {
        generatePrompt.value = "";
        generatePrompt.readOnly = false;
        generatePrompt.title = "";
      }
    }
  }

  cloneSlots(slots) {
    return slots.map((slot) => ({
      ...slot,
      elements: [...(slot.elements || [])],
      category: { ...(slot.category || {}) },
    }));
  }

  async copyGroup(sourceGroupId, newName) {
    const sourceGroup = this.groups.get(sourceGroupId);
    if (!sourceGroup) {
      throw new Error("コピー元のグループが見つかりません");
    }

    const newGroupId = await this.createGroup(newName, `${sourceGroup.name}のコピー`);
    const newGroup = this.groups.get(newGroupId);

    newGroup.slots = this.cloneSlots(sourceGroup.slots);
    newGroup.lastModified = Date.now();

    await this.saveToStorage();
    return newGroupId;
  }

  getAllGroups() {
    return Array.from(this.groups.values()).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      lastModified: group.lastModified,
      slotCount: group.slots.length,
      isDefault: group.isDefault,
      isCurrent: group.id === this.currentGroupId,
    }));
  }

  getGroup(groupId) {
    return this.groups.get(groupId);
  }

  getCurrentGroup() {
    return this.groups.get(this.currentGroupId);
  }

  exportGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error("グループが見つかりません");
    }

    return {
      version: "1.0",
      type: "slotGroup",
      exportDate: new Date().toISOString(),
      group: {
        name: group.name,
        description: group.description,
        slots: group.slots.map((slot) => ({
          ...slot,
          id: undefined, // IDは除外（インポート時に再割り当て）
        })),
      },
    };
  }

  async importGroup(data, groupName) {
    if (!this.validateImportData(data)) {
      throw new Error("無効なインポートデータです");
    }

    const newGroupId = await this.createGroup(groupName || data.group.name, data.group.description);

    const newGroup = this.groups.get(newGroupId);

    let nextId = 0;
    newGroup.slots = data.group.slots.map((slot) => ({
      ...slot,
      id: nextId++,
    }));

    await this.saveToStorage();
    return newGroupId;
  }

  validateImportData(data) {
    if (!data || typeof data !== "object") return false;
    if (data.type !== "slotGroup") return false;
    if (!data.group || !Array.isArray(data.group.slots)) return false;

    return true;
  }

  exportAllGroups() {
    return {
      version: "1.0",
      type: "allSlotGroups",
      exportDate: new Date().toISOString(),
      currentGroupId: this.currentGroupId,
      groups: Array.from(this.groups.values()).map((group) => ({
        ...group,
        slots: group.slots.map((slot) => ({
          ...slot,
          id: undefined,
        })),
      })),
    };
  }

  async importAllGroups(data) {
    if (!data || data.type !== "allSlotGroups") {
      throw new Error("無効なインポートデータです");
    }

    const backup = this.exportAllGroups();

    try {
      this.groups.clear();
      this.nextGroupId = 1;

      for (const groupData of data.groups) {
        const group = {
          ...groupData,
          id: groupData.isDefault ? "default" : `group_${this.nextGroupId++}`,
        };

        let nextId = 0;
        group.slots = groupData.slots.map((slot) => ({
          ...slot,
          id: nextId++,
        }));

        this.groups.set(group.id, group);
      }

      this.currentGroupId = this.groups.has("default") ? "default" : Array.from(this.groups.keys())[0];

      await this.saveToStorage();

      await this.loadGroupSlots(this.currentGroupId);
    } catch (error) {
      await this.importAllGroups(backup);
      throw error;
    }
  }

  async saveToStorage() {
    try {
      const groupEntries = Array.from(this.groups.entries());

      const dataToSave = {
        slotGroups: {
          groups: groupEntries,
          currentGroupId: this.currentGroupId,
          nextGroupId: this.nextGroupId,
        },
      };

      if (AppState?.data) {
        AppState.data.slotGroups = dataToSave.slotGroups;
      }

      await Storage.set(dataToSave);
    } catch (error) {
      throw error;
    }
  }

  async loadFromStorage() {
    try {
      let result;

      if (AppState?.data?.slotGroups) {
        result = { slotGroups: AppState.data.slotGroups };
      } else {
        result = await Storage.get("slotGroups");
        if (result.slotGroups && AppState?.data) {
          AppState.data.slotGroups = result.slotGroups;
        }
      }

      if (result.slotGroups) {
        this.groups.clear();
        if (result.slotGroups.groups) {
          for (const [id, group] of result.slotGroups.groups) {
            this.groups.set(id, group);
          }
        }

        this.currentGroupId = result.slotGroups.currentGroupId || "default";
        this.nextGroupId = result.slotGroups.nextGroupId || 1;

        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}

if (typeof window !== "undefined") {
  window.SlotGroupManager = SlotGroupManager;
  window.slotGroupManager = new SlotGroupManager();
}
