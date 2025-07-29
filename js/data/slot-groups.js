/**
 * slot-groups.js - スロットグループ管理モジュール
 * 複数のスロットセットをグループ化して管理
 */

class SlotGroupManager {
  constructor() {
    this.groups = new Map(); // グループID → グループデータ
    this.currentGroupId = 'default';
    this.nextGroupId = 1;
    this.defaultGroupName = 'デフォルトグループ';
    
    // グループデータの構造
    this.groupStructure = {
      id: 'string',
      name: 'string',
      description: 'string',
      createdAt: 'number',
      lastModified: 'number',
      slots: 'array', // スロットデータ配列
      isDefault: 'boolean'
    };
  }

  /**
   * 初期化処理
   */
  async initialize() {
    await this.loadFromStorage();
    
    // デフォルトグループが存在しない場合は作成
    if (!this.groups.has('default')) {
      await this.createDefaultGroup();
    }
  }

  /**
   * デフォルトグループを作成
   */
  async createDefaultGroup() {
    const defaultGroup = {
      id: 'default',
      name: this.defaultGroupName,
      description: '初期設定のスロットグループ',
      createdAt: Date.now(),
      lastModified: Date.now(),
      slots: [],
      isDefault: true
    };
    
    // 既存のスロットデータを移行
    await this.migrateExistingSlots(defaultGroup);
    
    this.groups.set('default', defaultGroup);
    await this.saveToStorage();
  }

  /**
   * 既存のスロットデータを移行
   */
  async migrateExistingSlots(targetGroup) {
    try {
      // AppStateから直接データを取得
      if (AppState?.data?.promptSlots?.slots) {
        console.log('Migrating existing slots from AppState:', AppState.data.promptSlots.slots);
        targetGroup.slots = this.cloneSlots(AppState.data.promptSlots.slots);
        return;
      }
      
      // ストレージから直接データを取得
      const result = await Storage.get('promptSlots');
      if (result.promptSlots?.slots) {
        console.log('Migrating existing slots from storage:', result.promptSlots.slots);
        targetGroup.slots = this.cloneSlots(result.promptSlots.slots);
        return;
      }
      
      // promptSlotManagerから取得
      if (window.promptSlotManager?.slots) {
        console.log('Migrating existing slots from manager:', window.promptSlotManager.slots);
        targetGroup.slots = this.cloneSlots(window.promptSlotManager.slots);
        return;
      }
      
      console.log('No existing slots found, creating default slots');
      // デフォルトスロットを作成
      targetGroup.slots = this.createDefaultSlots();
      
    } catch (error) {
      console.error('Error migrating existing slots:', error);
      // エラー時もデフォルトスロットを作成
      targetGroup.slots = this.createDefaultSlots();
    }
  }

  /**
   * デフォルトスロットを作成
   */
  createDefaultSlots() {
    const defaultSlots = [];
    const defaultSlotCount = 3;
    
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
        absoluteWeight: 1.0,
        weight: 1.0,
      });
    }
    
    return defaultSlots;
  }

  /**
   * 新しいグループを作成
   */
  async createGroup(name, description = '') {
    const id = `group_${this.nextGroupId++}`;
    const group = {
      id,
      name,
      description,
      createdAt: Date.now(),
      lastModified: Date.now(),
      slots: [],
      isDefault: false
    };
    
    this.groups.set(id, group);
    await this.saveToStorage();
    return id;
  }

  /**
   * グループを削除
   */
  async deleteGroup(groupId) {
    if (groupId === 'default') {
      throw new Error('デフォルトグループは削除できません');
    }
    
    if (!this.groups.has(groupId)) {
      throw new Error('グループが見つかりません');
    }
    
    // 現在のグループを削除する場合はデフォルトに切り替え
    if (this.currentGroupId === groupId) {
      await this.switchToGroup('default');
    }
    
    this.groups.delete(groupId);
    await this.saveToStorage();
  }

  /**
   * グループ情報を更新
   */
  async updateGroup(groupId, updates) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('グループが見つかりません');
    }
    
    // 更新可能なフィールドのみ更新
    const allowedUpdates = ['name', 'description'];
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

  /**
   * グループに切り替え
   */
  async switchToGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('グループが見つかりません');
    }
    
    // 同じグループの場合は何もしない
    if (this.currentGroupId === groupId) {
      return;
    }
    
    // 現在のスロットデータを現在のグループに保存（切り替え先ではない！）
    await this.saveCurrentGroupSlots();
    
    // 新しいグループのスロットデータを読み込み
    this.currentGroupId = groupId;
    await this.loadGroupSlots(groupId);
    
    // スロットマネージャーのUIを更新
    if (window.promptSlotManager) {
      window.promptSlotManager.updateUI();
    }
    
    // グループ切り替えイベントを発火
    window.dispatchEvent(new CustomEvent('slotGroupChanged', {
      detail: { groupId, groupName: group.name }
    }));
    
    await this.saveToStorage();
  }

  /**
   * 現在のグループのスロットデータを保存
   */
  async saveCurrentGroupSlots() {
    if (!window.promptSlotManager) {
      return;
    }
    
    const currentGroup = this.groups.get(this.currentGroupId);
    if (!currentGroup) {
      return;
    }
    
    // インポート直後で、現在のグループのスロット数が大幅に少ない場合は保存をスキップ
    // （promptSlotManagerが正しく初期化されていない可能性があるため）
    const currentSlotCount = window.promptSlotManager.slots.length;
    const groupSlotCount = currentGroup.slots ? currentGroup.slots.length : 0;
    
    if (groupSlotCount > 5 && currentSlotCount <= 3) {
      if (AppState.config.debugMode) {
        console.log('[SlotGroupManager] スロット数の不整合を検出 - 保存をスキップ');
        console.log(`  グループ内: ${groupSlotCount}個, promptSlotManager: ${currentSlotCount}個`);
      }
      return;
    }
    
    // 現在のスロットデータを保存
    await window.promptSlotManager.saveCurrentSlot();
    currentGroup.slots = this.cloneSlots(window.promptSlotManager.slots);
    currentGroup.lastModified = Date.now();
  }

  /**
   * 指定されたグループのスロットデータを読み込み
   */
  async loadGroupSlots(groupId) {
    const group = this.groups.get(groupId);
    
    if (!group || !window.promptSlotManager) {
      return;
    }
    
    if (group.slots && group.slots.length > 0) {
      // グループのスロットデータを復元
      const clonedSlots = this.cloneSlots(group.slots);
      window.promptSlotManager.slots = clonedSlots;
      window.promptSlotManager.currentSlot = 0;
      window.promptSlotManager._nextId = Math.max(...group.slots.map(s => s.id)) + 1;
      
      // スロットマネージャーのstorageにも反映
      await window.promptSlotManager.saveToStorage();
    } else {
      // スロットがない場合は初期状態にリセット
      window.promptSlotManager.initializeSlots();
    }
  }

  /**
   * スロットデータを深いコピーで複製
   */
  cloneSlots(slots) {
    return slots.map(slot => ({
      ...slot,
      elements: [...(slot.elements || [])],
      category: { ...(slot.category || {}) }
    }));
  }

  /**
   * グループをコピー
   */
  async copyGroup(sourceGroupId, newName) {
    const sourceGroup = this.groups.get(sourceGroupId);
    if (!sourceGroup) {
      throw new Error('コピー元のグループが見つかりません');
    }
    
    const newGroupId = await this.createGroup(newName, `${sourceGroup.name}のコピー`);
    const newGroup = this.groups.get(newGroupId);
    
    // スロットデータをコピー
    newGroup.slots = this.cloneSlots(sourceGroup.slots);
    newGroup.lastModified = Date.now();
    
    await this.saveToStorage();
    return newGroupId;
  }

  /**
   * グループ一覧を取得
   */
  getAllGroups() {
    return Array.from(this.groups.values()).map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      lastModified: group.lastModified,
      slotCount: group.slots.length,
      isDefault: group.isDefault,
      isCurrent: group.id === this.currentGroupId
    }));
  }

  /**
   * グループ情報を取得
   */
  getGroup(groupId) {
    return this.groups.get(groupId);
  }

  /**
   * 現在のグループ情報を取得
   */
  getCurrentGroup() {
    return this.groups.get(this.currentGroupId);
  }

  /**
   * グループをエクスポート
   */
  exportGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('グループが見つかりません');
    }
    
    return {
      version: '1.0',
      type: 'slotGroup',
      exportDate: new Date().toISOString(),
      group: {
        name: group.name,
        description: group.description,
        slots: group.slots.map(slot => ({
          ...slot,
          id: undefined // IDは除外（インポート時に再割り当て）
        }))
      }
    };
  }

  /**
   * グループをインポート
   */
  async importGroup(data, groupName) {
    if (!this.validateImportData(data)) {
      throw new Error('無効なインポートデータです');
    }
    
    const newGroupId = await this.createGroup(
      groupName || data.group.name,
      data.group.description
    );
    
    const newGroup = this.groups.get(newGroupId);
    
    // スロットデータをインポート（IDを再割り当て）
    let nextId = 0;
    newGroup.slots = data.group.slots.map(slot => ({
      ...slot,
      id: nextId++
    }));
    
    await this.saveToStorage();
    return newGroupId;
  }

  /**
   * インポートデータの検証
   */
  validateImportData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.type !== 'slotGroup') return false;
    if (!data.group || !Array.isArray(data.group.slots)) return false;
    
    return true;
  }

  /**
   * 全グループをエクスポート
   */
  exportAllGroups() {
    return {
      version: '1.0',
      type: 'allSlotGroups',
      exportDate: new Date().toISOString(),
      currentGroupId: this.currentGroupId,
      groups: Array.from(this.groups.values()).map(group => ({
        ...group,
        slots: group.slots.map(slot => ({
          ...slot,
          id: undefined
        }))
      }))
    };
  }

  /**
   * 全グループをインポート
   */
  async importAllGroups(data) {
    if (!data || data.type !== 'allSlotGroups') {
      throw new Error('無効なインポートデータです');
    }
    
    // 現在のデータをバックアップ
    const backup = this.exportAllGroups();
    
    try {
      // 新しいデータで初期化
      this.groups.clear();
      this.nextGroupId = 1;
      
      // グループを復元
      for (const groupData of data.groups) {
        const group = {
          ...groupData,
          id: groupData.isDefault ? 'default' : `group_${this.nextGroupId++}`
        };
        
        // スロットIDを再割り当て
        let nextId = 0;
        group.slots = groupData.slots.map(slot => ({
          ...slot,
          id: nextId++
        }));
        
        this.groups.set(group.id, group);
      }
      
      // 現在のグループを設定
      this.currentGroupId = this.groups.has('default') ? 'default' : 
                           Array.from(this.groups.keys())[0];
      
      await this.saveToStorage();
      
      // 現在のグループを読み込み
      await this.loadGroupSlots(this.currentGroupId);
      
    } catch (error) {
      // エラー時はバックアップを復元
      await this.importAllGroups(backup);
      throw error;
    }
  }

  /**
   * ストレージに保存
   */
  async saveToStorage() {
    
    try {
      // saveToStorage処理開始
      
      const groupEntries = Array.from(this.groups.entries());
      
      // グループデータを保存します
      
      const dataToSave = {
        slotGroups: {
          groups: groupEntries,
          currentGroupId: this.currentGroupId,
          nextGroupId: this.nextGroupId
        }
      };
      
      // データ保存準備完了
      
      if (AppState?.data) {
        AppState.data.slotGroups = dataToSave.slotGroups;
      }
      
      await Storage.set(dataToSave);
      console.log('Slot groups saved successfully');
    } catch (error) {
      console.error('Failed to save slot groups:', error);
      throw error;
    }
  }

  /**
   * ストレージから読み込み
   */
  async loadFromStorage() {
    try {
      let result;
      
      if (AppState?.data?.slotGroups) {
        result = { slotGroups: AppState.data.slotGroups };
      } else {
        result = await Storage.get('slotGroups');
        if (result.slotGroups && AppState?.data) {
          AppState.data.slotGroups = result.slotGroups;
        }
      }
      
      if (result.slotGroups) {
        // グループデータを復元
        this.groups.clear();
        if (result.slotGroups.groups) {
          for (const [id, group] of result.slotGroups.groups) {
            this.groups.set(id, group);
          }
        }
        
        this.currentGroupId = result.slotGroups.currentGroupId || 'default';
        this.nextGroupId = result.slotGroups.nextGroupId || 1;
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to load slot groups:', error);
      return false;
    }
  }

  /**
   * デバッグ情報を出力
   */
  debug() {
    console.log('=== Slot Group Manager Debug ===');
    console.log('Current Group ID:', this.currentGroupId);
    console.log('Next Group ID:', this.nextGroupId);
    console.log('Groups:', Array.from(this.groups.entries()));
    console.log('Current Group:', this.getCurrentGroup());
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.SlotGroupManager = SlotGroupManager;
  window.slotGroupManager = new SlotGroupManager();
}