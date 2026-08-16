/* ============================================================
   Mars Jarvis — config.js
   Holds runtime configuration (Google OAuth Client ID + API Key,
   plus the optional Gemini key for free conversation).
   Credentials are supplied by the user via Settings and persisted
   only in localStorage — Phase 1 has no backend of any kind.
   ============================================================ */

const JarvisConfig = (() => {
  const STORAGE_KEY = 'mars-jarvis-credentials';
  const DATA_FILE_NAME = 'jarvis-data.json';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const GEMINI_MODEL = 'gemini-3.6-flash';

  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { clientId: '', apiKey: '', geminiApiKey: '', ...JSON.parse(raw) } : { clientId: '', apiKey: '', geminiApiKey: '' };
    } catch {
      return { clientId: '', apiKey: '', geminiApiKey: '' };
    }
  }

  function save(patch) {
    const current = load();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  }

  function isConfigured() {
    const c = load();
    return Boolean(c.clientId && c.apiKey);
  }

  function isAiConfigured() {
    return Boolean(load().geminiApiKey);
  }

  return {
    DATA_FILE_NAME,
    DRIVE_SCOPE,
    DISCOVERY_DOC,
    GEMINI_MODEL,
    GEMINI_ENDPOINT,
    load,
    save,
    isConfigured,
    isAiConfigured
  };
})();
