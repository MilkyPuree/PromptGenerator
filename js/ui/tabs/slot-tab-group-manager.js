(function () {
  "use strict";

  class SlotTabGroupManager {
    constructor(slotTab) {
      this.slotTab = slotTab;
      this.groupManagementModal = null;
    }

    initModal() {
      this.groupManagementModal = BaseModal.create(
        "slot-group-management-modal",
        "📁 スロットグループ管理",
        `
          <div class="current-group-info">
            <h4>現在のグループ</h4>
            <div class="current-group-details">
              <strong id="current-group-name">-</strong>
              <p id="current-group-description">-</p>
            </div>
          </div>
          <div class="group-actions">
            <button id="slot-group-create-btn" title="新しいスロットグループを作成（最大20グループまで）">➕ 新しいグループを作成</button>
            <button id="slot-group-import-all-btn" title="JSONファイルから全グループデータをインポート（現在のデータは上書きされます）">📂 全体インポート</button>
            <button id="slot-group-export-all-btn" title="全グループのスロットデータをJSON形式でエクスポート（バックアップ・共有用）">📤 全体エクスポート</button>
          </div>
          <div class="all-groups-section">
            <h4>全グループ一覧</h4>
            <div id="all-groups-list" class="all-groups-container"></div>
          </div>
        `,
        {
          closeOnBackdrop: true,
          closeOnEsc: true,
          showCloseButton: true,
          showHeader: true,
          showFooter: false,
          headerActions: [],
        }
      );

      this.groupManagementModal.onShow(() => {
        this.updateModalCurrentGroupInfo();
        this.updateAllGroupsList();
      });
    }

    showGroupManagementModal() {
      this.groupManagementModal.show();
    }

    hideGroupManagementModal() {
      this.groupManagementModal.hide();
    }

    updateModalCurrentGroupInfo(group = null) {
      const currentGroup = group || this.slotTab.groupManager.getCurrentGroup();
      if (!currentGroup) return;

      const nameElement = document.getElementById("current-group-name");
      const descriptionElement = document.getElementById("current-group-description");

      if (nameElement) {
        nameElement.textContent = currentGroup.name;
      }
      if (descriptionElement) {
        descriptionElement.textContent = currentGroup.description || "説明なし";
      }
    }

    updateAllGroupsList() {
      if (this.slotTab.isGroupEditing) {
        return;
      }

      const listContainer = document.getElementById("all-groups-list");
      if (!listContainer) return;

      listContainer.innerHTML = "";
      const groups = this.slotTab.groupManager.getAllGroups();
      const currentGroup = this.slotTab.groupManager.getCurrentGroup();

      groups.forEach((group) => {
        const item = document.createElement("div");
        item.className = `group-list-item ${group.id === currentGroup?.id ? "current" : ""}`;

        item.innerHTML = `
            <div class="group-item-info">
              <div class="group-item-name-container">
                <div class="group-item-name" data-group-id="${group.id}" title="ダブルクリックで名前を編集">${group.name}</div>
                <input class="group-item-name-edit" data-group-id="${group.id}" value="${group.name}" style="display: none;">
              </div>
              <div class="group-item-description-container">
                <div class="group-item-description" data-group-id="${group.id}" title="ダブルクリックで説明を編集">${group.description || "説明なし"}</div>
                <input class="group-item-description-edit" data-group-id="${group.id}" value="${group.description || ""}" style="display: none;">
              </div>
            </div>
            <div class="group-item-actions">
              <button class="action-btn small-btn copy-btn" data-group-id="${group.id}" title="このグループをコピー">
                📋
              </button>
              <button class="action-btn small-btn delete-btn" data-group-id="${group.id}" title="このグループを削除">
                🗑️
              </button>
            </div>
          `;

        item.addEventListener("click", (e) => {
          if (
            e.target.closest(".group-item-actions") ||
            e.target.classList.contains("group-item-name-edit") ||
            e.target.classList.contains("group-item-description-edit")
          ) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          const groupId = group.id;
          this.switchToGroup(groupId);
        });

        const copyButton = item.querySelector(".copy-btn");
        copyButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const groupId = e.target.dataset.groupId;
          this.handleCopyGroup(groupId);
        });

        const deleteButton = item.querySelector(".delete-btn");
        deleteButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const groupId = e.target.dataset.groupId;
          this.handleDeleteGroup(groupId);
        });

        const nameDisplay = item.querySelector(".group-item-name");
        const nameEdit = item.querySelector(".group-item-name-edit");

        nameDisplay.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this.startGroupNameEdit(nameDisplay, nameEdit);
        });

        nameEdit.addEventListener("blur", async (e) => {
          await this.finishGroupNameEdit(group.id, nameDisplay, nameEdit);
        });

        nameEdit.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            await this.finishGroupNameEdit(group.id, nameDisplay, nameEdit);
          } else if (e.key === "Escape") {
            this.cancelGroupEdit(nameDisplay, nameEdit, group.name);
          }
        });

        const descDisplay = item.querySelector(".group-item-description");
        const descEdit = item.querySelector(".group-item-description-edit");

        descDisplay.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this.startGroupDescriptionEdit(descDisplay, descEdit);
        });

        descEdit.addEventListener("blur", async () => {
          await this.finishGroupDescriptionEdit(group.id, descDisplay, descEdit);
        });

        descEdit.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            await this.finishGroupDescriptionEdit(group.id, descDisplay, descEdit);
          } else if (e.key === "Escape") {
            this.cancelGroupEdit(descDisplay, descEdit, group.description || "");
          }
        });

        listContainer.appendChild(item);
      });
    }

    async switchToGroup(groupId) {
      if (this.slotTab.isGroupEditing) {
        return;
      }

      await this.slotTab.groupManager.switchToGroup(groupId);
      this.slotTab.updateDisplay();
      this.slotTab.updateGroupDisplay();
      this.updateAllGroupsList();
    }

    async handleCreateGroup() {
      const name = prompt("新しいグループの名前を入力してください:");
      if (!name || name.trim() === "") return;

      const description = prompt("グループの説明を入力してください（省略可能）:") || "";

      try {
        const groupId = await this.slotTab.groupManager.createGroup(name.trim(), description.trim());
        this.slotTab.updateGroupDisplay();

        UIHelpers.notifySuccess(`グループ「${name}」を作成しました`);
      } catch (error) {
        UIHelpers.notifyError("グループの作成に失敗しました");
      }
    }

    async handleCopyGroup(groupId = null) {
      const sourceGroup = groupId ? this.slotTab.groupManager.getGroup(groupId) : this.slotTab.groupManager.getCurrentGroup();
      if (!sourceGroup) return;

      const name = prompt(`「${sourceGroup.name}」のコピー名を入力してください:`, `${sourceGroup.name}のコピー`);
      if (!name || name.trim() === "") return;

      try {
        const newGroupId = await this.slotTab.groupManager.copyGroup(sourceGroup.id, name.trim());
        this.slotTab.updateGroupDisplay();
        this.updateAllGroupsList();

        UIHelpers.notifySuccess(`グループ「${name}」をコピーしました`);
      } catch (error) {
        UIHelpers.notifyError("グループのコピーに失敗しました");
      }
    }

    async handleEditGroup(groupId = null) {
      const targetGroup = groupId ? this.slotTab.groupManager.getGroup(groupId) : this.slotTab.groupManager.getCurrentGroup();
      if (!targetGroup) return;

      const name = prompt("グループ名を編集してください:", targetGroup.name);
      if (!name || name.trim() === "") return;

      const description = prompt("グループの説明を編集してください:", targetGroup.description || "");

      try {
        await this.slotTab.groupManager.updateGroup(targetGroup.id, {
          name: name.trim(),
          description: description?.trim() || "",
        });

        this.slotTab.updateGroupDisplay();
        this.updateAllGroupsList();

        UIHelpers.notifySuccess(`グループ「${name}」を更新しました`);
      } catch (error) {
        UIHelpers.notifyError("グループの編集に失敗しました");
      }
    }

    async handleDeleteGroup(groupId = null) {
      const targetGroup = groupId ? this.slotTab.groupManager.getGroup(groupId) : this.slotTab.groupManager.getCurrentGroup();
      if (!targetGroup) return;

      if (targetGroup.isDefault) {
        UIHelpers.notifyWarning("デフォルトグループは削除できません");
        return;
      }

      if (UIHelpers.confirmDelete(`グループ「${targetGroup.name}」を削除しますか？`)) {
        try {
          await this.slotTab.groupManager.deleteGroup(targetGroup.id);
          this.slotTab.updateDisplay();
          this.slotTab.updateGroupDisplay();
          this.updateAllGroupsList();

          UIHelpers.notifySuccess(`グループ「${targetGroup.name}」を削除しました`);
        } catch (error) {
          UIHelpers.notifyError("グループの削除に失敗しました");
        }
      }
    }

    startGroupNameEdit(displayElement, editElement) {
      this.slotTab.isGroupEditing = true;

      displayElement.classList.add("hidden");
      displayElement.classList.remove("show-block", "show-inline-block");
      editElement.classList.remove("hidden");
      editElement.classList.add("show-inline-block");
      setTimeout(() => {
        editElement.focus();
        editElement.select();
      }, 10);
    }

    startGroupDescriptionEdit(displayElement, editElement) {
      this.slotTab.isGroupEditing = true;

      displayElement.classList.add("hidden");
      displayElement.classList.remove("show-block", "show-inline-block");
      editElement.classList.remove("hidden");
      editElement.classList.add("show-inline-block");
      setTimeout(() => {
        editElement.focus();
        editElement.select();
      }, 10);
    }

    async finishGroupNameEdit(groupId, displayElement, editElement) {
      const newName = editElement.value.trim();

      if (!newName) {
        UIHelpers.notifyWarning("グループ名を入力してください");
        editElement.focus();
        return;
      }

      const groups = this.slotTab.groupManager.getAllGroups();
      const existingGroup = groups.find((g) => g.id !== groupId && g.name === newName);

      if (existingGroup) {
        UIHelpers.notifyWarning("同じ名前のグループが既に存在します");
        editElement.focus();
        return;
      }

      try {
        await this.slotTab.groupManager.updateGroup(groupId, { name: newName });

        displayElement.textContent = newName;
        displayElement.classList.remove("hidden", "show-inline-block");
        displayElement.classList.add("show-block");
        editElement.classList.remove("show-inline-block");
        editElement.classList.add("hidden");

        this.slotTab.isGroupEditing = false;

        this.slotTab.updateGroupDisplay();

        UIHelpers.notifySuccess("グループ名を更新しました");
      } catch (error) {
        UIHelpers.notifyError("グループ名の更新に失敗しました");
        this.cancelGroupEdit(displayElement, editElement, displayElement.textContent);
      }
    }

    async finishGroupDescriptionEdit(groupId, displayElement, editElement) {
      const newDescription = editElement.value.trim();

      try {
        await this.slotTab.groupManager.updateGroup(groupId, { description: newDescription });

        displayElement.textContent = newDescription || "説明なし";
        displayElement.classList.remove("hidden", "show-inline-block");
        displayElement.classList.add("show-block");
        editElement.classList.remove("show-inline-block");
        editElement.classList.add("hidden");

        this.slotTab.isGroupEditing = false;

        this.slotTab.updateGroupDisplay();

        UIHelpers.notifySuccess("グループ説明を更新しました");
      } catch (error) {
        UIHelpers.notifyError("グループ説明の更新に失敗しました");
        this.cancelGroupEdit(displayElement, editElement, displayElement.textContent);
      }
    }

    cancelGroupEdit(displayElement, editElement, originalValue) {
      editElement.value = originalValue;
      displayElement.classList.remove("hidden", "show-inline-block");
      displayElement.classList.add("show-block");
      editElement.classList.remove("show-inline-block");
      editElement.classList.add("hidden");

      this.slotTab.isGroupEditing = false;
    }

    addSlotImportExportButtons() {
      const currentGroup = this.slotTab.groupManager.getCurrentGroup();
      if (!currentGroup) return;

      const existingContainer = document.getElementById("slot-import-export-container");
      if (existingContainer) {
        existingContainer.remove();
      }

      const slotInfoBar = document.querySelector(".slot-info-bar");
      if (!slotInfoBar) return;

      const buttonContainer = document.createElement("div");
      buttonContainer.id = "slot-import-export-container";
      buttonContainer.className = "slot-import-export-container";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      fileInput.classList.add("hidden");
      fileInput.id = "slot-group-import-file";

      const exportBtn = document.createElement("button");
      exportBtn.className = "action-btn";
      exportBtn.textContent = "エクスポート";
      exportBtn.id = "slot-group-export-btn";
      exportBtn.title = "現在のスロットグループをJSON形式でエクスポート（設定・スロット内容を含む）";

      const importBtn = document.createElement("button");
      importBtn.className = "action-btn";
      importBtn.textContent = "インポート";
      importBtn.id = "slot-group-import-btn";
      importBtn.title = "JSONファイルからスロットグループをインポート（現在のグループに追加）";

      buttonContainer.appendChild(fileInput);
      buttonContainer.appendChild(exportBtn);
      buttonContainer.appendChild(importBtn);

      slotInfoBar.parentNode.insertBefore(buttonContainer, slotInfoBar.nextSibling);

      this.setupSlotImportExportEvents(exportBtn, importBtn, fileInput);
    }

    setupSlotImportExportEvents(exportBtn, importBtn, fileInput) {
      exportBtn.addEventListener("click", () => {
        this.handleCurrentGroupExport();
      });

      importBtn.addEventListener("click", () => {
        fileInput.click();
      });

      fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (file) {
          await this.handleCurrentGroupImport(file);
          event.target.value = "";
        }
      });
    }

    async handleCurrentGroupExport() {
      try {
        const currentGroup = this.slotTab.groupManager.getCurrentGroup();
        if (!currentGroup) {
          UIHelpers.notifyError("エクスポートするグループが見つかりません");
          return;
        }

        await this.slotTab.groupManager.saveCurrentGroupSlots();

        const exportData = {
          type: "singleSlotGroup",
          version: "1.0",
          exportDate: new Date().toISOString(),
          group: {
            id: currentGroup.id,
            name: currentGroup.name,
            description: currentGroup.description,
          },
          slots: currentGroup.slots.filter((slot) => slot.isUsed),
        };

        const filename = FileUtilities.generateTimestampedFilename(
          `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${currentGroup.name}`,
          "json"
        );

        await FileUtilities.downloadJSON(exportData, filename);

        UIHelpers.notifySuccess(`グループ「${currentGroup.name}」をエクスポートしました`);
      } catch (error) {
        UIHelpers.notifyError("グループのエクスポートに失敗しました");
      }
    }

    async handleCurrentGroupImport(file) {
      try {
        const currentGroup = this.slotTab.groupManager.getCurrentGroup();
        if (!currentGroup) {
          UIHelpers.notifyError("インポート先のグループが見つかりません");
          return;
        }

        const data = await FileUtilities.readJSONFile(file);

        if (!data || data.type !== "singleSlotGroup" || !data.slots) {
          throw new Error("Invalid import data format");
        }

        const importedSlotData = {
          version: "1.0",
          slots: data.slots.map((slot, index) => ({
            ...slot,
            id: index,
          })),
        };

        await this.slotTab.slotManager.importSlots(importedSlotData);

        if (data.group.name && data.group.description) {
          currentGroup.name = data.group.name;
          currentGroup.description = data.group.description;
          await this.slotTab.groupManager.saveToStorage();
        }

        this.slotTab.updateDisplay();
        this.slotTab.updateGroupDisplay();

        UIHelpers.notifySuccess(`グループ「${currentGroup.name}」にインポートしました`);
      } catch (error) {
        UIHelpers.notifyError("グループのインポートに失敗しました");
      }
    }

    async handleExportGroup() {
      const currentGroup = this.slotTab.groupManager.getCurrentGroup();
      if (!currentGroup) return;

      try {
        const exportData = this.slotTab.groupManager.exportGroup(currentGroup.id);
        const filename = FileUtilities.generateTimestampedFilename(
          `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${currentGroup.name}`,
          "json"
        );

        await FileUtilities.downloadJSON(exportData, filename);

        UIHelpers.notifySuccess(`グループ「${currentGroup.name}」をエクスポートしました`);
      } catch (error) {
        UIHelpers.notifyError("グループのエクスポートに失敗しました");
      }
    }

    async handleImportGroup() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const data = JSON.parse(text);

          const groupName = prompt(
            "インポートするグループの名前を入力してください:",
            data.group?.name || "インポートしたグループ"
          );
          if (!groupName || groupName.trim() === "") return;

          await this.slotTab.groupManager.importGroup(data, groupName.trim());
          this.slotTab.updateGroupDisplay();

          UIHelpers.notifySuccess(`グループ「${groupName}」をインポートしました`);
        } catch (error) {
          UIHelpers.notifyError("グループのインポートに失敗しました");
        }
      });

      input.click();
    }

    async handleImportToGroup(groupId) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const data = JSON.parse(text);

          const targetGroup = this.slotTab.groupManager.getGroup(groupId);
          if (!targetGroup) {
            UIHelpers.notifyError("指定されたグループが見つかりません");
            return;
          }

          if (
            !UIHelpers.confirmDelete(`グループ「${targetGroup.name}」にインポートしますか？\n現在のスロットデータは上書きされます。`)
          ) {
            return;
          }

          if (data.type === "singleSlotGroup" && data.group && data.slots) {
            await this.slotTab.groupManager.switchToGroup(groupId);

            await this.slotTab.slotManager.clearAllSlots();

            for (const slot of data.slots) {
              await this.slotTab.slotManager.setSlot(slot.id, slot.prompt, slot.elements);
            }

            if (data.group.name && data.group.description) {
              const group = this.slotTab.groupManager.groups.find((g) => g.id === groupId);
              if (group) {
                group.name = data.group.name;
                group.description = data.group.description;
                await this.slotTab.groupManager.saveToStorage();
              }
            }
          } else {
            throw new Error("Invalid import data format");
          }
          this.slotTab.updateDisplay();
          this.slotTab.updateGroupDisplay();
          this.updateAllGroupsList();

          UIHelpers.notifySuccess(`グループ「${targetGroup.name}」にインポートしました`);
        } catch (error) {
          UIHelpers.notifyError("グループのインポートに失敗しました");
        }
      });

      input.click();
    }

    async handleExportSpecificGroup(groupId) {
      const targetGroup = this.slotTab.groupManager.getGroup(groupId);
      if (!targetGroup) {
        UIHelpers.notifyError("指定されたグループが見つかりません");
        return;
      }

      try {
        const groupSlots = targetGroup.slots || [];

        const exportData = {
          type: "singleSlotGroup",
          version: "1.0",
          exportDate: new Date().toISOString(),
          group: {
            id: targetGroup.id,
            name: targetGroup.name,
            description: targetGroup.description,
          },
          slots: groupSlots.filter((slot) => slot.isUsed),
        };
        const filename = FileUtilities.generateTimestampedFilename(
          `${EXPORT_FILE_NAMES.SLOT_GROUP_PREFIX}_${targetGroup.name}`,
          "json"
        );

        await FileUtilities.downloadJSON(exportData, filename);

        UIHelpers.notifySuccess(`グループ「${targetGroup.name}」をエクスポートしました`);
      } catch (error) {
        UIHelpers.notifyError("グループのエクスポートに失敗しました");
      }
    }

    async handleImportAll() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const data = JSON.parse(text);

          if (!data || data.type !== "allSlotGroups") {
            throw new Error("無効なファイル形式です。全体エクスポートファイルを選択してください。");
          }

          if (
            !UIHelpers.confirmDelete("全グループをインポートしますか？\n現在のすべてのスロットデータは上書きされます。")
          ) {
            return;
          }

          if (data.type === "allSlotGroups" && data.groups) {
            if (!(this.slotTab.groupManager.groups instanceof Map)) {
              throw new Error("グループマネージャーが正しく初期化されていません");
            }

            const defaultGroup = Array.from(this.slotTab.groupManager.groups.values()).find((g) => g.isDefault);
            const newGroups = new Map();
            if (defaultGroup) {
              newGroups.set(defaultGroup.id, defaultGroup);
            }

            if (!Array.isArray(data.groups)) {
              throw new Error("グループデータは配列形式である必要があります");
            }

            for (const group of data.groups) {
              if (!group.isDefault && group.id) {
                newGroups.set(group.id, group);
              } else if (group.isDefault) {
                if (defaultGroup) {
                  defaultGroup.slots = group.slots;
                  defaultGroup.name = group.name;
                  defaultGroup.description = group.description;
                }
              }
            }

            this.slotTab.groupManager.groups = newGroups;

            if (data.currentGroupId) {
              this.slotTab.groupManager.currentGroupId = data.currentGroupId;
            }

            await this.slotTab.groupManager.saveToStorage();

            await this.slotTab.groupManager.loadGroupSlots(this.slotTab.groupManager.currentGroupId);
          } else {
            throw new Error("Invalid import data format");
          }
          this.slotTab.updateDisplay();
          this.slotTab.updateGroupDisplay();
          this.updateAllGroupsList();

          UIHelpers.notifySuccess("全グループをインポートしました");

          this.hideGroupManagementModal();
        } catch (error) {
          UIHelpers.notifyError(error.message || "全体インポートに失敗しました");
        }
      });

      input.click();
    }

    async handleExportAll() {
      try {
        const exportData = {
          type: "allSlotGroups",
          version: "1.0",
          exportDate: new Date().toISOString(),
          groups: Array.from(this.slotTab.groupManager.groups.values()),
          currentGroupId: this.slotTab.groupManager.currentGroupId,
        };
        const filename = FileUtilities.generateTimestampedFilename(EXPORT_FILE_NAMES.ALL_SLOT_GROUPS, "json");

        await FileUtilities.downloadJSON(exportData, filename);

        UIHelpers.notifySuccess("全グループをエクスポートしました");
      } catch (error) {
        UIHelpers.notifyError("全体エクスポートに失敗しました");
      }
    }
  }

  if (typeof window !== "undefined") {
    window.SlotTabGroupManager = SlotTabGroupManager;
  }
})();
