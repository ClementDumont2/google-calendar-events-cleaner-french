(() => {
  const ADVANCED_MODE = false;

  const logger = {
    info: (message, data = null) => {
      const timestamp = new Date().toISOString();
      console.log(`[INFO ${timestamp}] ${message}`, data || '');
    },
    warn: (message, data = null) => {
      const timestamp = new Date().toISOString();
      console.warn(`[WARN ${timestamp}] ${message}`, data || '');
    },
    error: (message, error = null) => {
      const timestamp = new Date().toISOString();
      console.error(`[ERROR ${timestamp}] ${message}`, error || '');
    },
    success: (message, data = null) => {
      const timestamp = new Date().toISOString();
      console.log(`[SUCCESS ${timestamp}] ${message}`, data || '');
    }
  };

  const getAndValidateInput = (key, message, defaultValue, advancedMode) => {
    if (advancedMode !== true) return defaultValue;

    const result = prompt(message, defaultValue);

    if (!result) {
      alert(`No value for ${key}`);
      return null;
    }

    if (result.trim() === '') {
      alert(`Value for ${key} cannot be empty`);
      return null;
    }

    return result.trim();
  };

  const reoccurringDialogSelector = 'span.uW2Fw-k2Wrsb-fmcmS[jsname="MdSI6d"]';
  const reoccurringDialogOkButtonSelector = '[data-mdc-dialog-action="ok"]';

  let nextPageLabel, deleteEventButtonLabel, deleteTaskButtonLabel,
    deleteReoccurringEventLabel, deleteReoccurringTaskLabel, maxPages;

  const getUserInput = () => {
    try {
      nextPageLabel = getAndValidateInput('nextPageLabel', "Next page label", 'Semaine suivante', ADVANCED_MODE)
        || getAndValidateInput('nextPageLabel', "Next page label", 'Mois suivant', ADVANCED_MODE);

      deleteEventButtonLabel = getAndValidateInput('deleteEventButtonLabel', "", "Supprimer l'événement", ADVANCED_MODE);
      deleteTaskButtonLabel = getAndValidateInput('deleteTaskButtonLabel', "", 'Supprimer la tâche', ADVANCED_MODE);
      deleteReoccurringEventLabel = getAndValidateInput('deleteReoccurringEventLabel', "", "Supprimer l'événement périodique", ADVANCED_MODE);
      deleteReoccurringTaskLabel = getAndValidateInput('deleteReoccurringTaskLabel', "", "Supprimer la tâche récurrente", ADVANCED_MODE);
      maxPages = getAndValidateInput('maxPages', "", 12, true);

      const input = getAndValidateInput('searchTerms', "Entrer (séparer par des virgules)", "", true);
      if (!input) return null;

      const searchTerms = input
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      if (searchTerms.length === 0) return null;

      const confirmation = confirm(
        `Supprimer tous les événements contenant :\n\n${searchTerms.join('\n')}`
      );

      if (!confirmation) return null;

      return searchTerms;

    } catch (error) {
      logger.error('Input error', error);
      return null;
    }
  };

  const waitForElement = (selector, timeout = 5000, retryInterval = 100) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        if (Date.now() - start >= timeout) {
          return reject(new Error(`Element not found: ${selector}`));
        }

        setTimeout(check, retryInterval);
      };

      check();
    });
  };

  const findMatchingEvents = (searchTerms) => {
    try {
      const conditions = searchTerms
        .map(term => `contains(text(), '${term}')`)
        .join(' or ');

      const xpath = `//span[${conditions}]`;

      return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

    } catch (error) {
      logger.error('XPath error', error);
      throw error;
    }
  };

  const deleteEvent = async (eventElement) => {
    eventElement.click();

    const deleteButton = await waitForElement(
      `button[aria-label="${deleteEventButtonLabel}"], button[aria-label="${deleteTaskButtonLabel}"]`,
      3000
    );

    deleteButton.click();

    return new Promise(resolve => {
      setTimeout(async () => {
        try {
          const dialog = document.querySelector(reoccurringDialogSelector);

          if (dialog &&
            (dialog.textContent.includes(deleteReoccurringEventLabel) ||
             dialog.textContent.includes(deleteReoccurringTaskLabel))) {

            const ok = await waitForElement(reoccurringDialogOkButtonSelector, 2000);
            ok.click();
          }
        } catch {}

        resolve(true);
      }, 500);
    });
  };

  const navigateToNextPage = async () => {
    const nextButton = await waitForElement(
      `button[aria-label="${nextPageLabel}"]`,
      3000
    );

    nextButton.click();
    await new Promise(r => setTimeout(r, 2000));
  };

  const processCalendarDeletion = async (searchTerms) => {
    let currentPage = 1;
    let totalDeleted = 0;

    const processPage = async () => {
      if (currentPage > maxPages) {
        alert(`Terminé. Supprimé: ${totalDeleted}`);
        return;
      }

      const matches = findMatchingEvents(searchTerms);

      if (matches.snapshotLength > 0) {
        const el = matches.snapshotItem(0);
        await deleteEvent(el);
        totalDeleted++;

        setTimeout(processPage, 800);
      } else {
        if (currentPage < maxPages) {
          await navigateToNextPage();
          currentPage++;
          setTimeout(processPage, 2000);
        } else {
          alert(`Fini. Supprimé: ${totalDeleted}`);
        }
      }
    };

    processPage();
  };

  const main = async () => {
    if (!window.location.hostname.includes('calendar.google.com')) {
      if (!confirm("Pas sur Google Calendar, continuer ?")) return;
    }

    const searchTerms = getUserInput();
    if (!searchTerms) return;

    await processCalendarDeletion(searchTerms);
  };

  main();
})();
