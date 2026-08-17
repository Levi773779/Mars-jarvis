/* ============================================================
   Mars Jarvis — drive.js
   Locates (or creates) jarvis-data.json in the user's Drive and
   provides low-level read/write. This is the ONLY persistence
   layer in Phase 1 — there is no database and no server.
   ============================================================ */

const JarvisDrive = (() => {
  let fileId = null;

  function defaultData() {
    return {
      notes: [],
      tasks: [],
      research: [],
      events: [],
      settings: { speak: true, wakeWord: false },
      conversations: []
    };
  }

  async function findFile() {
    const res = await gapi.client.drive.files.list({
      q: `name='${JarvisConfig.DATA_FILE_NAME}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)'
    });
    const files = res.result.files || [];
    return files.length ? files[0].id : null;
  }

  async function createFile(data) {
    const boundary = 'jarvis_boundary_' + Date.now();
    const metadata = { name: JarvisConfig.DATA_FILE_NAME, mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(data) +
      `\r\n--${boundary}--`;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${JarvisAuth.getToken()}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });
    if (!res.ok) throw new Error('Failed to create jarvis-data.json on Drive.');
    const json = await res.json();
    return json.id;
  }

  async function ensureFile() {
    fileId = await findFile();
    if (!fileId) {
      fileId = await createFile(defaultData());
    }
    return fileId;
  }

  async function readData() {
    if (!fileId) await ensureFile();
    const res = await gapi.client.drive.files.get({ fileId, alt: 'media' });
    let parsed;
    try {
      parsed = typeof res.result === 'object' ? res.result : JSON.parse(res.body);
    } catch {
      parsed = defaultData();
    }
    return { ...defaultData(), ...parsed };
  }

  async function writeData(data) {
    if (!fileId) await ensureFile();
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${JarvisAuth.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save data to Drive.');
    return true;
  }

  function reset() { fileId = null; }

  return { ensureFile, readData, writeData, defaultData, reset };
})();
