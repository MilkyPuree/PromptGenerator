const SlotUtils = {
  getCurrentSlot() {
    return window.promptSlotManager?.slots?.[window.promptSlotManager?.currentSlot] || null;
  },

  getSortedElements() {
    const currentSlot = SlotUtils.getCurrentSlot();
    if (!currentSlot || !currentSlot.elements) {
      return [];
    }
    return currentSlot.elements
      .filter((el) => el != null)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  },

  findElement(elementId) {
    const currentSlot = SlotUtils.getCurrentSlot();
    return currentSlot?.elements?.find((el) => el.id === elementId) || null;
  },

  getCurrentShaping() {
    return AppState.userSettings?.optionData?.shaping || "SD";
  },

  async regenerateAndSaveSlot() {
    const currentSlot = SlotUtils.getCurrentSlot();
    if (!currentSlot) return;

    const shaping = SlotUtils.getCurrentShaping();
    const elements = SlotUtils.getSortedElements();
    currentSlot.prompt = elements
      .map((el) => {
        const value = el.Value || "";
        if (!value) return "";
        const weight = el[shaping]?.weight;
        if (weight !== undefined && weight !== null) {
          return WeightConverter.applyWeightToPrompt(shaping, value, weight);
        }
        return value;
      })
      .filter((v) => v)
      .join(",");

    SlotUtils.updateGeneratePromptField(currentSlot.prompt);

    await SlotUtils.saveWithTimestamp(currentSlot);
  },

  async saveWithTimestamp(slot) {
    if (!slot) return;
    slot.lastModified = Date.now();
    await window.promptSlotManager?.saveToStorage();
  },

  updateGeneratePromptField(value) {
    const field = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    if (field) {
      field.value = value;
    }
  },

  getGeneratePromptValue() {
    const field = document.getElementById(DOM_IDS.PROMPT.GENERATE);
    return field ? field.value : "";
  },
};
