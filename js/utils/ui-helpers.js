const UIHelpers = {
  notifySuccess(message, duration = NOTIFICATION_DURATION.SHORT) {
    ErrorHandler.notify(message, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "success",
      duration,
    });
  },

  notifyError(message, duration = NOTIFICATION_DURATION.MEDIUM) {
    ErrorHandler.notify(message, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "error",
      duration,
    });
  },

  notifyWarning(message, duration = NOTIFICATION_DURATION.MEDIUM) {
    ErrorHandler.notify(message, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "warning",
      duration,
    });
  },

  notifyInfo(message, duration = NOTIFICATION_DURATION.SHORT) {
    ErrorHandler.notify(message, {
      type: ErrorHandler.NotificationType.TOAST,
      messageType: "info",
      duration,
    });
  },

  confirmDelete(message = "削除しますか？") {
    const shouldConfirm = AppState.userSettings.optionData?.isDeleteCheck !== false;
    return !shouldConfirm || confirm(message);
  },

  createFileInputDialog(accept, onFileSelected) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        await onFileSelected(file);
      }
    });
    input.click();
  },

  switchToEditMode(displayEl, editEl) {
    if (!displayEl || !editEl) return;
    displayEl.classList.add("hidden");
    displayEl.classList.remove("show-block", "show-inline-block");
    editEl.classList.remove("hidden");
    editEl.classList.add("show-inline-block");
    setTimeout(() => {
      editEl.focus();
      editEl.select();
    }, 10);
  },

  switchToDisplayMode(displayEl, editEl, displayClass = "show-block") {
    if (!displayEl || !editEl) return;
    editEl.classList.remove("show-inline-block");
    editEl.classList.add("hidden");
    displayEl.classList.remove("hidden", "show-inline-block");
    displayEl.classList.add(displayClass);
  },

  getCurrentDictId() {
    return AppState.data.currentPromptDictionary || DEFAULT_DICTIONARY_ID;
  },

  getCurrentDictionary() {
    const dictId = UIHelpers.getCurrentDictId();
    return AppState.data.promptDictionaries?.[dictId] || null;
  },
};
