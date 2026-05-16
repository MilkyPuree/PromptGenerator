/**
 * 編集タブ
 *
 * 設計:
 * - 現在のスロットのelementsを直接参照・編集
 * - slot.elements = [{ id, sort, Value, SD, NAI, None, data }, ...]
 * - 表示: slot.elementsをソートしてFlexibleListに渡す
 * - 編集: slot.elementsを直接変更 → regenerateAndSaveSlot()で保存
 * - ウェイト変換はWeightConverterを使用
 *
 * リスト管理: EditTabListManager (edit-tab-list-manager.js)
 * スロット統合: EditTabSlotIntegration (edit-tab-slot-integration.js)
 */
(function () {
  "use strict";

  class EditTabState {
    constructor() {
      this.updateMode = "auto";
      this.operationStack = [];
    }

    canUpdateCategory() {
      return this.updateMode === "auto" && !this.hasOperation("category_change");
    }

    startOperation(operationType) {
      this.operationStack.push(operationType);
    }

    endOperation(operationType) {
      const index = this.operationStack.indexOf(operationType);
      if (index !== -1) {
        this.operationStack.splice(index, 1);
      }
    }

    hasOperation(operationType) {
      return this.operationStack.includes(operationType);
    }

    async executeProtected(operationType, callback) {
      this.startOperation(operationType);
      try {
        return await callback();
      } finally {
        this.endOperation(operationType);
      }
    }
  }

  function defineEditTab() {
    if (typeof TabManager === "undefined") {
      setTimeout(defineEditTab, ADDITIONAL_DELAYS.VERY_SHORT);
      return;
    }

    class EditTab extends TabManager {
      constructor(app) {
        super(app, {
          tabId: "editTabBody",
          tabButtonId: "editTab",
          tabIndex: 2, // CONSTANTS.TABS.EDIT
        });

        this.editHandler = null;

        this.currentEditMode = null;
        this.currentShapingMode = null;

        this.state = new EditTabState();

        this.extractionModeActive = false;

        this.hasBeenShown = false;

        this.editListManager = new EditTabListManager(this);
        this.slotIntegration = new EditTabSlotIntegration(this);
      }

      async onInit() {
        this.editHandler = this.app.editHandler;
        if (!this.editHandler) {
          throw new Error("EditHandler not found");
        }

        this.categoryUIManager = new CategoryUIManager();

        await this.waitForCategoryUIManagerReady();

        await this.setupEventListeners();

        this.updateCurrentModes();
      }

      findElementIndex(elementId) {
        const elements = SlotUtils.getSortedElements();
        return elements.findIndex((el) => el.id === elementId);
      }

      async onShow() {
        const isFirstShow = !this.hasBeenShown;
        if (isFirstShow) {
          this.hasBeenShown = true;
        }

        this.checkExtractionMode();

        this.updateSplitButtonVisibility();

        if (this.extractionModeActive) {
          this.showExtractionModeWithEmptyState();
        } else {
          const currentSlot = window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot];
          const elements = currentSlot?.elements || [];
          if (!this.editHandler.isInitialized || elements.length === 0) {
            this.editHandler.initializeEditMode();
          } else {
            await this.refreshEditList();
          }
          // 重み値を含めてプロンプトを再生成（初期表示時にも反映）
          if (elements.length > 0) {
            await SlotUtils.regenerateAndSaveSlot();
          }
        }

        this.updateCurrentModes();

        this.updateSlotIntegrationPanel();

        this.updateSlotWeightInputConfig();

        if (isFirstShow || this.shouldInitializeInitialValues()) {
          await this.initializeCurrentDataSource();
        }

        setTimeout(() => {
          this.updateIntegrationPanelVisibility();
        }, 100);

        if (isFirstShow && this.onFirstShow) {
          await this.onFirstShow();
        }

        this.updateSlotMuteButton();
      }

      async setupEventListeners() {
        this.setupUITypeHandlers();

        this.setupEditTypeHandlers();

        this.setupAddElementHandlers();

        this.setupSlotModeChangeListener();

        this.setupExtractionCompleteListener();

        this.setupSlotChangeListener();

        await this.setupSlotIntegrationHandlers();

        this.setupSlotMuteHandler();
      }

      async waitForCategoryUIManagerReady() {
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
          const categories = this.categoryUIManager.getCategoriesByLevel(0, null);
          if (categories.length >= 10) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, UI_DELAYS.STANDARD_UPDATE));
          attempts++;
        }
      }

      async waitForSlotManager(maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          if (this.app && this.app.tabs && this.app.tabs.slot && this.app.tabs.slot.slotManager) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, UI_DELAYS.QUICK_UPDATE));
        }
        return false;
      }

      getDefaultWeight() {
        const shaping = this.getCurrentShaping();
        switch (shaping) {
          case "SD":
            return 1.0;
          case "NAI":
            return 0.0;
          case "NAIv45":
            return 1.0;
          case "None":
          default:
            return 1.0;
        }
      }

      getCurrentShaping() {
        if (typeof AppState !== "undefined" && AppState.userSettings?.optionData?.shaping) {
          return AppState.userSettings.optionData.shaping;
        }
        return "SD";
      }

      debug() {
        super.debug();
      }

      // === EditTabListManager への委譲 ===

      async refreshEditList() {
        return this.editListManager.refreshEditList();
      }

      getWeightConfig() {
        return this.editListManager.getWeightConfig();
      }

      setupEditSpecialFeatures($li, inputs) {
        return this.editListManager.setupEditSpecialFeatures($li, inputs);
      }

      setupUITypeHandlers() {
        return this.editListManager.setupUITypeHandlers();
      }

      setupEditTypeHandlers() {
        return this.editListManager.setupEditTypeHandlers();
      }

      async handleUITypeChange(event) {
        return this.editListManager.handleUITypeChange(event);
      }

      async handleEditTypeChange(event) {
        return this.editListManager.handleEditTypeChange(event);
      }

      updateCurrentModes() {
        return this.editListManager.updateCurrentModes();
      }

      async handleUnifiedFieldChange(index, fieldKey, value, item, eventType) {
        return this.editListManager.handleUnifiedFieldChange(index, fieldKey, value, item, eventType);
      }

      async handlePromptCategoryUpdate(promptValue, index) {
        return this.editListManager.handlePromptCategoryUpdate(promptValue, index);
      }

      async handlePromptCategoryUpdateWithoutRefresh(promptValue, index, item) {
        return this.editListManager.handlePromptCategoryUpdateWithoutRefresh(promptValue, index, item);
      }

      async processSingleElementTranslation(promptValue, index, item) {
        return this.editListManager.processSingleElementTranslation(promptValue, index, item);
      }

      async processTranslationForElements() {
        return this.editListManager.processTranslationForElements();
      }

      async handleSmallCategoryChangeForPrompt(smallValue, bigValue, middleValue, item) {
        return this.editListManager.handleSmallCategoryChangeForPrompt(smallValue, bigValue, middleValue, item);
      }

      async handleSmallCategoryChange(value, item, actualElementIndex) {
        return this.editListManager.handleSmallCategoryChange(value, item, actualElementIndex);
      }

      updateSinglePromptField(index, promptValue) {
        return this.editListManager.updateSinglePromptField(index, promptValue);
      }

      updateSingleElementUI(index) {
        return this.editListManager.updateSingleElementUI(index);
      }

      setupAddElementHandlers() {
        return this.editListManager.setupAddElementHandlers();
      }

      async addEmptyElement(position) {
        return this.editListManager.addEmptyElement(position);
      }

      async handleEditDelete(index, item) {
        return this.editListManager.handleEditDelete(index, item);
      }

      async handleEditSort(sortedIds) {
        return this.editListManager.handleEditSort(sortedIds);
      }

      async handleEditMove(index, direction, item) {
        return this.editListManager.handleEditMove(index, direction, item);
      }

      updateSplitButtonVisibility() {
        return this.editListManager.updateSplitButtonVisibility();
      }

      async splitSinglePrompt() {
        return this.editListManager.splitSinglePrompt();
      }

      async handleWeightChange(index, value, item) {
        return this.editListManager.handleWeightChange(index, value, item);
      }

      handleWeightWheelChange(event) {
        return this.editListManager.handleWeightWheelChange(event);
      }

      async updateRegisterButtonStates() {
        return this.editListManager.updateRegisterButtonStates();
      }

      async handleRegistration(item, index) {
        return this.editListManager.handleRegistration(item, index);
      }

      handleRegisterClick(promptValue, element, elementIndex) {
        return this.editListManager.handleRegisterClick(promptValue, element, elementIndex);
      }

      // === EditTabSlotIntegration への委譲 ===

      async setupSlotIntegrationHandlers() {
        return this.slotIntegration.setupSlotIntegrationHandlers();
      }

      async initializeCurrentDataSource() {
        return this.slotIntegration.initializeCurrentDataSource();
      }

      async restoreSlotSelections(slot, dataSource) {
        return this.slotIntegration.restoreSlotSelections(slot, dataSource);
      }

      shouldInitializeInitialValues() {
        return this.slotIntegration.shouldInitializeInitialValues();
      }

      async handleSlotModeChange(event) {
        return this.slotIntegration.handleSlotModeChange(event);
      }

      async handleDataSourceChange(event) {
        return this.slotIntegration.handleDataSourceChange(event);
      }

      updateSlotIntegrationPanel() {
        return this.slotIntegration.updateSlotIntegrationPanel();
      }

      toggleDataSourceDetailsUI(dataSource) {
        return this.slotIntegration.toggleDataSourceDetailsUI(dataSource);
      }

      async initializeDataSourceDetails(dataSource) {
        return this.slotIntegration.initializeDataSourceDetails(dataSource);
      }

      async initializeDictionarySelectors() {
        return this.slotIntegration.initializeDictionarySelectors();
      }

      async initializeFavoritesSelector() {
        return this.slotIntegration.initializeFavoritesSelector();
      }

      async populateFavoritesSelect(selectElement) {
        return this.slotIntegration.populateFavoritesSelect(selectElement);
      }

      setupCategoryEventListeners() {
        return this.slotIntegration.setupCategoryEventListeners();
      }

      getCategoryOptions(type) {
        return this.slotIntegration.getCategoryOptions(type);
      }

      updateMiddleCategories(select, bigCategory) {
        return this.slotIntegration.updateMiddleCategories(select, bigCategory);
      }

      setupCategorySelectors() {
        return this.slotIntegration.setupCategorySelectors();
      }

      updateIntegrationPanelVisibility() {
        return this.slotIntegration.updateIntegrationPanelVisibility();
      }

      setupSlotWeightInputHandlers() {
        return this.slotIntegration.setupSlotWeightInputHandlers();
      }

      updateSlotWeightInputConfig() {
        return this.slotIntegration.updateSlotWeightInputConfig();
      }

      resetCurrentSlotWeightForNewShaping() {
        return this.slotIntegration.resetCurrentSlotWeightForNewShaping();
      }

      setupSlotMuteHandler() {
        return this.slotIntegration.setupSlotMuteHandler();
      }

      async toggleCurrentSlotMute() {
        return this.slotIntegration.toggleCurrentSlotMute();
      }

      updateSlotMuteButton() {
        return this.slotIntegration.updateSlotMuteButton();
      }

      checkExtractionMode() {
        return this.slotIntegration.checkExtractionMode();
      }

      updateAddButtonsState() {
        return this.slotIntegration.updateAddButtonsState();
      }

      showExtractionModeWithEmptyState() {
        return this.slotIntegration.showExtractionModeWithEmptyState();
      }

      showExtractionModeMessage() {
        return this.slotIntegration.showExtractionModeMessage();
      }

      restoreNormalMode() {
        return this.slotIntegration.restoreNormalMode();
      }

      setGeneratePromptExtractionMode() {
        return this.slotIntegration.setGeneratePromptExtractionMode();
      }

      setGeneratePromptNormalMode() {
        return this.slotIntegration.setGeneratePromptNormalMode();
      }

      setupSlotModeChangeListener() {
        return this.slotIntegration.setupSlotModeChangeListener();
      }

      setupExtractionCompleteListener() {
        return this.slotIntegration.setupExtractionCompleteListener();
      }

      setupSlotChangeListener() {
        return this.slotIntegration.setupSlotChangeListener();
      }

      async updateGeneratePromptOnSlotChange() {
        return this.slotIntegration.updateGeneratePromptOnSlotChange();
      }
    }

    if (typeof window !== "undefined") {
      window.EditTab = EditTab;
    }
  }

  defineEditTab();
})();
