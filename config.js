/* ============================================================
   Mars Jarvis — config.js
   Holds runtime configuration (Google OAuth Client ID + API Key).
   Credentials are supplied by the user via Settings and persisted
   only in localStorage — Phase 1 has no backend of any kind.
   ============================================================ */

const JarvisConfig = (() => {
  const STORAGE_KEY = 'mars-jarvis-credentials';
  const DATA_FILE_NAME = 'jarvis-data.json';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { clientId: '', apiKey: '' };
    } catch {
      return { clientId: '', apiKey: '' };
    }
  }

  function save({ clientId, apiKey }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, apiKey }));
  }

  function isConfigured() {
    const c = load();
    return Boolean(c.clientId && c.apiKey);
  }

  return {
    DATA_FILE_NAME,
    DRIVE_SCOPE,
    DISCOVERY_DOC,
    load,
    save,
    isConfigured
  };
})();
