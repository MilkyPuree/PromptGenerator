(function () {
  "use strict";

  class DictionaryTabModalManager {
    constructor(dictTab) {
      this.dictTab = dictTab;
    }

    setupMultipleDictionaryManagement() {
      const dictionarySelector = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_SELECTOR);
      if (dictionarySelector) {
        this.dictTab.addEventListener(dictionarySelector, "change", async (e) => {
          await this.switchDictionary(e.target.value);
        });
      }

      const addDictionaryBtn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_ADD_BTN);
      if (addDictionaryBtn) {
        this.dictTab.addEventListener(addDictionaryBtn, "click", () => {
          this.showAddDictionaryForm();
        });
      }

      const manageDictionariesBtn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MANAGE_BTN);

      if (manageDictionariesBtn) {
        this.dictTab.addEventListener(manageDictionariesBtn, "click", () => {
          this.showDictionaryManagementModal();
        });
      } else {
        const directBtn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_MANAGE_BTN);
        if (directBtn) {
          this.dictTab.addEventListener(directBtn, "click", () => {
            this.showDictionaryManagementModal();
          });
        }
      }

      this.initModal();

      this.setupDictionaryManagementModal();

      this.updateDictionarySelector();
    }

    initModal() {
      this.dictTab.dictionaryManagementModal = BaseModal.create(
        "dictionary-management-modal",
        "📚 リスト管理",
        `
        <div class="dictionary-list-section">
          <h4>既存のリスト</h4>
          <div id="dictionary-list" class="dictionary-items-list"></div>
        </div>
        <div class="dictionary-add-section">
          <h4>新しいリストを作成</h4>
          <div class="dictionary-add-form">
            <input type="text" id="new-dictionary-name" placeholder="リスト名を入力" title="お気に入りリストの名前を入力してください" />
            <button id="create-dictionary" title="新しいお気に入りリストを作成します">作成</button>
          </div>
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

      this.dictTab.dictionaryManagementModal.onShow(() => {
        this.updateDictionaryList();
        setTimeout(() => {
          const nameInput = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME);
          if (nameInput) {
            nameInput.focus();
          }
        }, 100);
      });
    }

    setupDictionaryManagementModal() {
      const closeBtn = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_CLOSE_MANAGEMENT);
      if (closeBtn) {
        this.dictTab.addEventListener(closeBtn, "click", () => {
          this.hideDictionaryManagementModal();
        });
      }

      const createBtn = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_CREATE_BTN);
      if (createBtn) {
        this.dictTab.addEventListener(createBtn, "click", async () => {
          await this.createNewDictionary();
        });
      }

      const nameInput = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME);
      if (nameInput) {
        this.dictTab.addEventListener(nameInput, "keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            await this.createNewDictionary();
          }
        });
      }

      const modal = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_MANAGEMENT_MODAL);
      if (modal) {
        this.dictTab.addEventListener(modal, "click", (e) => {
          if (e.target === modal) {
            this.hideDictionaryManagementModal();
          }
        });
      }
    }

    updateDictionarySelector() {
      const selector = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_SELECTOR);
      if (!selector) return;

      const currentValue = selector.value;

      selector.innerHTML = "";

      const sortedDictIds = Object.keys(AppState.data.promptDictionaries).sort((a, b) => {
        if (a === "main") return -1;
        if (b === "main") return 1;

        const timestampA = a.startsWith("dict_") ? parseInt(a.replace("dict_", "")) : 0;
        const timestampB = b.startsWith("dict_") ? parseInt(b.replace("dict_", "")) : 0;
        return timestampA - timestampB;
      });

      sortedDictIds.forEach((dictId) => {
        const dict = AppState.data.promptDictionaries[dictId];
        const option = UIFactory.createOption({
          value: dictId,
          text: dict.name || dictId,
          selected: dictId === AppState.data.currentPromptDictionary,
        });
        selector.appendChild(option);
      });
    }

    async switchDictionary(dictionaryId) {
      if (!AppState.data.promptDictionaries[dictionaryId]) {
        return;
      }

      if (window.ensureLocalPromptIntegrity) {
        try {
          await window.ensureLocalPromptIntegrity(false);
        } catch (error) {}
      }

      AppState.data.currentPromptDictionary = dictionaryId;

      await savePromptDictionaries();

      if (this.dictTab.currentDictionary === "favorite") {
        await this.dictTab.listRenderer.refreshFavoriteList();
      } else {
        const listElement = document.querySelector(DOM_SELECTORS.BY_ID.FAVORITE_LIST);
        if (listElement) {
          listElement.innerHTML = "";
        }
      }

      this.dictTab.updateStats();
    }

    showAddDictionaryForm() {
      const name = prompt("新しいリストの名前を入力してください:", "");
      if (Validators.Quick.isValidName(name)) {
        this.createDictionary(name.trim());
      }
    }

    async createDictionary(name) {
      const dictId = `dict_${Date.now()}`;

      AppState.data.promptDictionaries[dictId] = {
        name: name,
        prompts: [],
      };

      await savePromptDictionaries();
      this.updateDictionarySelector();

      UIHelpers.notifySuccess(`辞書「${name}」を作成しました`, UI_DELAYS.LONG);
    }

    showDictionaryManagementModal() {
      this.dictTab.dictionaryManagementModal.show();
    }

    hideDictionaryManagementModal() {
      this.dictTab.dictionaryManagementModal.hide();
    }

    updateDictionaryList() {
      const container = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LIST);

      if (!container) {
        const directContainer = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_LIST);
        if (directContainer) {
          directContainer.innerHTML = "";
          this.populateDictionaryList(directContainer);
          return;
        } else {
          return;
        }
      }

      container.innerHTML = "";
      this.populateDictionaryList(container);
    }

    populateDictionaryList(container) {
      if (!AppState.data.promptDictionaries) {
        return;
      }

      const sortedDictIds = Object.keys(AppState.data.promptDictionaries).sort((a, b) => {
        if (a === "main") return -1;
        if (b === "main") return 1;

        const timestampA = a.startsWith("dict_") ? parseInt(a.replace("dict_", "")) : 0;
        const timestampB = b.startsWith("dict_") ? parseInt(b.replace("dict_", "")) : 0;
        return timestampA - timestampB;
      });

      sortedDictIds.forEach((dictId) => {
        const dict = AppState.data.promptDictionaries[dictId];
        const itemCount = dict.prompts ? dict.prompts.length : 0;

        const isCurrent = dictId === AppState.data.currentPromptDictionary;
        const item = UIFactory.createDiv({
          className: isCurrent ? "dictionary-item current-dictionary" : "dictionary-item",
        });

        item.innerHTML = `
          <div class="dictionary-info" data-dict-id="${dictId}" style="flex: 1; cursor: pointer;">
            <div class="dictionary-name-container">
              <strong class="dictionary-name" data-dict-id="${dictId}" title="ダブルクリックで名前を編集">${
                dict.name
              }</strong>
              <input class="dictionary-name-edit" data-dict-id="${dictId}" value="${
                dict.name
              }" style="display: none;">
            </div>
            ${isCurrent ? '<span class="current-indicator">(現在選択中)</span>' : ""}
            <div class="item-count">${itemCount}件のプロンプト</div>
          </div>
          <div class="dictionary-actions">
            ${dictId !== "main" ? `<button class="delete-dict-btn" data-dict-id="${dictId}">削除</button>` : ""}
          </div>
        `;

        const dictNameDisplay = item.querySelector(".dictionary-name");
        const dictNameEdit = item.querySelector(".dictionary-name-edit");

        if (dictNameDisplay && dictNameEdit) {
          dictNameDisplay.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.startDictionaryNameEdit(dictNameDisplay, dictNameEdit);
          });

          dictNameEdit.addEventListener("blur", async () => {
            await this.finishDictionaryNameEdit(dictId, dictNameDisplay, dictNameEdit);
          });

          dictNameEdit.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await this.finishDictionaryNameEdit(dictId, dictNameDisplay, dictNameEdit);
            } else if (e.key === "Escape") {
              this.cancelDictionaryNameEdit(dictNameDisplay, dictNameEdit);
            }
          });
        }

        item.addEventListener("click", async (e) => {
          if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
            return;
          }

          if (dictNameEdit && dictNameEdit.style.display !== "none") {
            return;
          }

          if (!isCurrent) {
            await this.switchDictionary(dictId);
            this.updateDictionaryList();
            this.updateDictionarySelector();
          }
        });

        const deleteBtn = item.querySelector(".delete-dict-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.deleteDictionary(dictId);
          });
        }

        container.appendChild(item);
      });
    }

    async createNewDictionary() {
      const nameInput = document.querySelector(DOM_SELECTORS.BY_ID.DICTIONARY_NEW_NAME);
      if (!nameInput) {
        return;
      }

      const name = nameInput.value.trim();
      if (!name) {
        UIHelpers.notifyWarning("辞書名を入力してください", UI_DELAYS.LONG);
        nameInput.focus();
        return;
      }

      const existingDict = Object.keys(AppState.data.promptDictionaries).find(
        (id) => AppState.data.promptDictionaries[id].name === name
      );

      if (existingDict) {
        UIHelpers.notifyWarning("同じ名前の辞書が既に存在します", UI_DELAYS.LONG);
        nameInput.focus();
        nameInput.select();
        return;
      }

      await this.createDictionary(name);
      nameInput.value = "";
      this.updateDictionaryList();

      setTimeout(() => {
        nameInput.focus();
      }, UI_DELAYS.FOCUS_RESTORE_DELAY);
    }

    async deleteDictionary(dictId) {
      if (dictId === "main") {
        UIHelpers.notifyWarning("メインリストは削除できません", UI_DELAYS.LONG);
        return;
      }

      const dict = AppState.data.promptDictionaries[dictId];
      if (!dict) return;

      const itemCount = dict.prompts ? dict.prompts.length : 0;
      if (!UIHelpers.confirmDelete(`辞書「${dict.name}」を削除しますか？\n(${itemCount}件のプロンプトが失われます)`)) return;

      delete AppState.data.promptDictionaries[dictId];

      if (AppState.data.currentPromptDictionary === dictId) {
        AppState.data.currentPromptDictionary = "main";
      }

      await savePromptDictionaries();
      this.updateDictionarySelector();
      this.updateDictionaryList();
      this.dictTab.updateStats();

      UIHelpers.notifySuccess(`辞書「${dict.name}」を削除しました`, UI_DELAYS.LONG);
    }

    startDictionaryNameEdit(displayElement, editElement) {
      displayElement.classList.add("hidden");
      displayElement.classList.remove("show-inline", "show-inline-block");
      editElement.classList.remove("hidden");
      editElement.classList.add("show-inline-block");
      editElement.focus();
      editElement.select();
    }

    async finishDictionaryNameEdit(dictId, displayElement, editElement) {
      const newName = editElement.value.trim();

      if (!newName) {
        UIHelpers.notifyWarning("辞書名を入力してください", UI_DELAYS.LONG);
        editElement.focus();
        return;
      }

      const existingDict = Object.keys(AppState.data.promptDictionaries).find(
        (id) => id !== dictId && AppState.data.promptDictionaries[id].name === newName
      );

      if (existingDict) {
        UIHelpers.notifyWarning("同じ名前の辞書が既に存在します", UI_DELAYS.LONG);
        editElement.focus();
        return;
      }

      try {
        AppState.data.promptDictionaries[dictId].name = newName;
        await savePromptDictionaries();

        displayElement.textContent = newName;
        displayElement.classList.remove("hidden", "show-inline-block");
        displayElement.classList.add("show-inline");
        editElement.classList.remove("show-inline-block");
        editElement.classList.add("hidden");

        this.updateDictionarySelector();

        UIHelpers.notifySuccess(`辞書名を「${newName}」に変更しました`, UI_DELAYS.LONG);
      } catch (error) {
        UIHelpers.notifyError("辞書名の変更に失敗しました", UI_DELAYS.LONG);
        this.cancelDictionaryNameEdit(displayElement, editElement);
      }
    }

    cancelDictionaryNameEdit(displayElement, editElement) {
      const dictId = editElement.dataset.dictId;
      const originalName = AppState.data.promptDictionaries[dictId]?.name || "";
      editElement.value = originalName;

      displayElement.classList.remove("hidden", "show-inline-block");
      displayElement.classList.add("show-inline");
      editElement.classList.remove("show-inline-block");
      editElement.classList.add("hidden");
    }

    setupDuplicateCheckButton() {
      const btn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DUPLICATE_CHECK);
      if (btn) {
        this.dictTab.addEventListener(btn, "click", () => {
          this.showDuplicateCheckModal();
        });
        this.updateDuplicateCheckButtonVisibility();
      }
    }

    updateDuplicateCheckButtonVisibility() {
      const btn = this.dictTab.getElement(DOM_SELECTORS.BY_ID.DICTIONARY_LOCAL_DUPLICATE_CHECK);
      if (!btn) return;

      const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];

      if (duplicates.length > 0) {
        btn.classList.remove("hidden");
        btn.title = `マスター辞書と重複している項目をチェック（${duplicates.length}件）`;
      } else {
        btn.classList.add("hidden");
      }
    }

    async showDuplicateCheckModal(isStartup = false) {
      const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];

      if (duplicates.length === 0) {
        if (!isStartup) {
          alert("重複している項目はありません");
        }
        return;
      }

      if (!this.duplicateCheckModal) {
        this.createDuplicateCheckModal();
      }

      await this.renderDuplicateList(duplicates);
      this.duplicateCheckModal.show();
    }

    createDuplicateCheckModal() {
      this.duplicateCheckModal = BaseModal.create(
        "duplicate-check-modal",
        "マスター辞書と重複している項目",
        `
        <div class="duplicate-check-content">
          <p class="duplicate-check-description">
            以下の項目はマスター辞書に採用されています。削除しても問題ありません。
          </p>
          <div id="duplicate-check-list" class="duplicate-check-list"></div>
        </div>
        `,
        {
          closeOnBackdrop: true,
          closeOnEsc: true,
          showCloseButton: true,
          showHeader: true,
          showFooter: true,
          footerActions: [
            {
              text: "一括削除",
              className: "danger",
              action: "bulk-delete",
            },
            {
              text: "閉じる",
              action: "close",
            },
            {
              text: "以降表示しない",
              action: "dismiss",
            },
          ],
        }
      );

      const modal = document.getElementById("duplicate-check-modal");
      if (modal) {
        const footer = modal.querySelector(".modal-footer");
        if (footer) {
          const note = document.createElement("span");
          note.className = "duplicate-check-footer-note";
          note.textContent = "※ 辞書タブの「重複チェック」ボタンからいつでも確認できます";
          footer.insertBefore(note, footer.firstChild);

          const bulkDeleteBtn = footer.querySelector('[data-action="bulk-delete"]');
          const closeBtn = footer.querySelector('[data-action="close"]');
          const dismissBtn = footer.querySelector('[data-action="dismiss"]');

          if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener("click", async () => {
              const duplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];
              if (duplicates.length === 0) return;

              const confirmed = confirm(
                `重複している${duplicates.length}件の項目を全て削除しますか？\nこの操作は取り消せません。`
              );
              if (!confirmed) return;

              const indicesToDelete = duplicates.map((d) => d.index).sort((a, b) => b - a);
              for (const index of indicesToDelete) {
                AppState.data.localPromptList.splice(index, 1);
              }

              if (window.saveLocalList) {
                await window.saveLocalList();
              }
              this.dictTab.updateStats();
              this.duplicateCheckModal.hide();
              alert(`${duplicates.length}件の重複項目を削除しました`);
            });
          }

          if (closeBtn) {
            closeBtn.addEventListener("click", () => {
              this.duplicateCheckModal.hide();
            });
          }

          if (dismissBtn) {
            dismissBtn.addEventListener("click", async () => {
              if (window.saveDuplicateCheckDismissed) {
                await window.saveDuplicateCheckDismissed(true);
              }
              this.duplicateCheckModal.hide();
            });
          }
        }
      }
    }

    async renderDuplicateList(duplicates) {
      const container = document.getElementById("duplicate-check-list");
      if (!container) return;

      await this.dictTab.app.listManager.createFlexibleList(
        duplicates.map((d) => d.item),
        "#duplicate-check-list",
        {
          ...LIST_TYPE_CONFIGS.duplicateCheck,
          header: FLEXIBLE_LIST_HEADERS.DICTIONARY.ELEMENT,
          onDelete: async (index, item) => {
            const localIndex = AppState.data.localPromptList.findIndex(
              (local) =>
                local.prompt === item.prompt &&
                local.data[0] === item.data[0] &&
                local.data[1] === item.data[1] &&
                local.data[2] === item.data[2]
            );
            if (localIndex !== -1) {
              AppState.data.localPromptList.splice(localIndex, 1);
              if (window.saveLocalList) {
                await window.saveLocalList();
              }
              this.dictTab.updateStats();
            }

            const newDuplicates = window.findDuplicatesWithMaster ? window.findDuplicatesWithMaster() : [];
            if (newDuplicates.length === 0) {
              this.duplicateCheckModal.hide();
              alert("すべての重複項目を削除しました");
            } else {
              await this.renderDuplicateList(newDuplicates);
            }
            return false;
          },
        }
      );
    }
  }

  if (typeof window !== "undefined") {
    window.DictionaryTabModalManager = DictionaryTabModalManager;
  }
})();
