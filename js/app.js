/* ============================================================
   Mars Jarvis — app.js
   Entry point. Wires every module to the DOM.
   ============================================================ */

(function () {
  const boot = document.getElementById('boot-screen');
  const shell = document.getElementById('app-shell');
  let activeGame = null; // { key, controller }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    setTimeout(() => { boot.hidden = true; shell.hidden = false; }, 1700);

    prefillCredentialFields();
    wireNav();
    wireAuthButtons();
    wireNotes();
    wireTasks();
    wireVoiceControls();
    wireChatForm();
    wireGames();
    wireEvents();
    wireWeather();
    wireCodeStudio();
    wireSettings();
    startClock();
    startEventReminderLoop();

    JarvisCommands.setGameLauncher((gameKey) => {
      JarvisUI.switchSection('games');
      launchGame(gameKey);
    });
    JarvisCommands.setCodeLauncher(async (description) => {
      JarvisUI.switchSection('code');
      await runCodeGen(description);
    });

    JarvisVoice.setHandlers({
      heard: handleHeardCommand,
      state: (state) => JarvisUI.setReactorState(state)
    });

    JarvisAuth.setStateListener(async ({ signedIn, profile }) => {
      JarvisUI.setSyncState(signedIn, profile?.email);
      if (signedIn) {
        try {
          await JarvisMemory.loadMemory();
          JarvisUI.toast('Connected to Google Drive.');
        } catch (e) {
          JarvisUI.toast('Connected, but failed to load memory: ' + e.message, true);
        }
      }
    });

    JarvisMemory.setChangeListener((data) => {
      JarvisUI.renderStats(data);
      JarvisUI.renderActivity(data);
      JarvisUI.renderNotes(data.notes);
      JarvisUI.renderTasks(data.tasks);
      JarvisUI.renderCommandHistory(data.conversations);
      JarvisUI.renderEvents(data.events || []);
    });

    if (!JarvisVoice.supported) {
      const note = document.getElementById('voice-support-note');
      if (note) note.textContent = 'Your browser does not support the Web Speech API. Try Chrome or Edge.';
    }

    if (JarvisConfig.isConfigured()) {
      try { await JarvisAuth.init(); }
      catch (e) { JarvisUI.toast('Google auth failed to initialize: ' + e.message, true); }
    }
  }

  /* ---------- Navigation ---------- */
  function wireNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => JarvisUI.switchSection(btn.dataset.section));
    });
    document.getElementById('hamburger')?.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('is-open');
    });
  }

  /* ---------- Auth ---------- */
  function wireAuthButtons() {
    const handler = async () => {
      if (!JarvisConfig.isConfigured()) {
        JarvisUI.toast('Add your Google OAuth Client ID and API Key in Settings first.', true);
        JarvisUI.switchSection('settings');
        return;
      }
      try {
        if (!JarvisAuth.gisReady) await JarvisAuth.init();
        await JarvisAuth.signIn();
      } catch (e) {
        JarvisUI.toast('Sign-in failed: ' + e.message, true);
      }
    };
    document.getElementById('auth-btn')?.addEventListener('click', handler);
    document.getElementById('settings-auth-btn')?.addEventListener('click', handler);
    document.getElementById('settings-signout-btn')?.addEventListener('click', () => {
      JarvisAuth.signOut();
      JarvisUI.toast('Signed out.');
    });
  }

  /* ---------- Notes ---------- */
  function wireNotes() {
    const form = document.getElementById('note-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('note-input');
      const text = input.value.trim();
      if (!text) return;
      await guarded(async () => {
        await JarvisMemory.addNote(text);
        input.value = '';
        JarvisUI.toast('Note saved.');
      });
    });

    document.getElementById('note-search')?.addEventListener('input', (e) => {
      const results = JarvisMemory.searchNotes(e.target.value);
      JarvisUI.renderNotes(results);
    });

    document.getElementById('notes-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'delete-note') {
        await guarded(() => JarvisMemory.deleteNote(id));
      } else if (btn.dataset.action === 'edit-note') {
        const current = JarvisMemory.getAll().notes.find(n => n.id === id);
        const next = prompt('Edit note:', current?.text || '');
        if (next !== null && next.trim()) await guarded(() => JarvisMemory.editNote(id, next.trim()));
      }
    });
  }

  /* ---------- Tasks ---------- */
  function wireTasks() {
    const form = document.getElementById('task-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('task-input');
      const priority = document.getElementById('task-priority').value;
      const text = input.value.trim();
      if (!text) return;
      await guarded(async () => {
        await JarvisMemory.addTask(text, priority);
        input.value = '';
        JarvisUI.toast('Task added.');
      });
    });

    document.getElementById('tasks-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'toggle-task') await guarded(() => JarvisMemory.completeTask(id));
      if (btn.dataset.action === 'delete-task') await guarded(() => JarvisMemory.deleteTask(id));
    });
  }

  /* ---------- Voice ---------- */
  function wireVoiceControls() {
    const listenBtn = document.getElementById('listen-toggle-btn');
    const pttBtn = document.getElementById('ptt-btn');
    const muteBtn = document.getElementById('mute-btn');

    listenBtn?.addEventListener('click', () => {
      if (!JarvisVoice.supported) return JarvisUI.toast('Speech recognition is not supported in this browser.', true);
      const active = JarvisVoice.toggleContinuousListening();
      listenBtn.textContent = active ? 'Disable Continuous Listening' : 'Enable Continuous Listening';
      listenBtn.classList.toggle('is-active', active);
    });

    const startPTT = () => {
      if (!JarvisVoice.supported) return;
      JarvisVoice.startPushToTalk();
      pttBtn.classList.add('is-active');
    };
    const stopPTT = () => {
      if (!JarvisVoice.supported) return;
      JarvisVoice.stopPushToTalk();
      pttBtn.classList.remove('is-active');
    };
    pttBtn?.addEventListener('mousedown', startPTT);
    pttBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); startPTT(); });
    pttBtn?.addEventListener('mouseup', stopPTT);
    pttBtn?.addEventListener('mouseleave', stopPTT);
    pttBtn?.addEventListener('touchend', stopPTT);

    muteBtn?.addEventListener('click', () => {
      const muted = !JarvisVoice.isMuted();
      JarvisVoice.setMuted(muted);
      muteBtn.textContent = muted ? 'Unmute Responses' : 'Mute Responses';
      muteBtn.classList.toggle('is-active', muted);
    });
  }

  /* ---------- Typed chat (works even without a microphone) ---------- */
  function wireChatForm() {
    const form = document.getElementById('chat-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await handleHeardCommand(text);
    });
  }

  async function handleHeardCommand(transcript) {
    if (!transcript) return;
    if (JarvisAuth.isSignedIn()) await guarded(() => JarvisMemory.logConversation('user', transcript));
    const result = await JarvisCommands.process(transcript);
    if (JarvisAuth.isSignedIn()) await guarded(() => JarvisMemory.logConversation('assistant', result.reply));
    JarvisVoice.speak(result.reply);
    JarvisUI.toast(result.reply, result.kind === 'error');
  }

  /* ---------- Events / Tagesplaner ---------- */
  function wireEvents() {
    const form = document.getElementById('event-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('event-title');
      const dtInput = document.getElementById('event-datetime');
      const title = titleInput.value.trim();
      const when = dtInput.value;
      if (!title || !when) return;
      await guarded(async () => {
        await JarvisMemory.addEvent(title, new Date(when).toISOString());
        titleInput.value = '';
        dtInput.value = '';
        JarvisUI.toast('Termin gespeichert.');
      });
    });

    document.getElementById('events-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action="delete-event"]');
      if (!btn) return;
      await guarded(() => JarvisMemory.deleteEvent(btn.dataset.id));
    });
  }

  function startEventReminderLoop() {
    setInterval(async () => {
      if (!JarvisMemory.isLoaded()) return;
      const now = Date.now();
      const data = JarvisMemory.getAll();
      for (const ev of data.events || []) {
        const t = new Date(ev.when).getTime();
        if (!ev.notified && t <= now && t > now - 60000) {
          JarvisUI.toast(`Termin jetzt: ${ev.title}`);
          JarvisVoice.speak(`Erinnerung: ${ev.title} steht jetzt an.`);
          await guarded(() => JarvisMemory.markEventNotified(ev.id));
        }
      }
    }, 20000);
  }

  /* ---------- Weather ---------- */
  function wireWeather() {
    document.getElementById('weather-refresh-btn')?.addEventListener('click', async () => {
      const el = document.getElementById('weather-text');
      el.textContent = 'Lade Wetterdaten…';
      try {
        const weather = await JarvisWeather.getCurrent();
        el.textContent = weather.text;
      } catch (e) {
        el.textContent = 'Fehler: ' + e.message;
      }
    });
  }

  /* ---------- Code Studio ---------- */
  function wireCodeStudio() {
    const form = document.getElementById('code-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('code-input');
      const description = input.value.trim();
      if (!description) return;
      await runCodeGen(description);
    });

    document.getElementById('code-toggle-source-btn')?.addEventListener('click', () => {
      const pre = document.getElementById('code-source');
      pre.hidden = !pre.hidden;
    });
  }

  async function runCodeGen(description) {
    const status = document.getElementById('code-status');
    const frame = document.getElementById('code-frame');
    const sourceBtn = document.getElementById('code-toggle-source-btn');
    const sourcePre = document.getElementById('code-source');
    status.textContent = 'Jarvis schreibt den Code…';
    try {
      const html = await JarvisCodeGen.build(description);
      frame.srcdoc = html;
      sourcePre.textContent = html;
      sourceBtn.hidden = false;
      status.textContent = `Fertig: "${description}"`;
    } catch (e) {
      status.textContent = 'Fehler: ' + e.message;
      JarvisUI.toast(e.message, true);
    }
  }

  /* ---------- Games ---------- */
  function wireGames() {
    const picker = document.getElementById('game-picker');
    if (!picker) return;
    picker.innerHTML = JarvisGames.list().map(g => `<button data-key="${g.key}">${g.name}</button>`).join('');
    picker.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-key]');
      if (!btn) return;
      launchGame(btn.dataset.key);
    });

    document.getElementById('game-restart-btn')?.addEventListener('click', () => {
      activeGame?.controller?.restart?.();
    });
  }

  function launchGame(key) {
    const def = JarvisGames.get(key);
    if (!def) return;
    if (activeGame) activeGame.controller.stop();

    document.querySelectorAll('#game-picker button').forEach(b => b.classList.toggle('is-active', b.dataset.key === key));
    const canvas = document.getElementById('game-canvas');
    const status = document.getElementById('game-status');
    const restartBtn = document.getElementById('game-restart-btn');
    restartBtn.hidden = false;

    const controller = def.start(canvas, status);
    activeGame = { key, controller };
  }

  /* ---------- Settings ---------- */
  function prefillCredentialFields() {
    const creds = JarvisConfig.load();
    const clientIdField = document.getElementById('cred-client-id');
    const apiKeyField = document.getElementById('cred-api-key');
    const geminiField = document.getElementById('cred-gemini-key');
    if (clientIdField) clientIdField.value = creds.clientId || '';
    if (apiKeyField) apiKeyField.value = creds.apiKey || '';
    if (geminiField) geminiField.value = creds.geminiApiKey || '';
  }

  function wireSettings() {
    document.getElementById('credentials-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientId = document.getElementById('cred-client-id').value.trim();
      const apiKey = document.getElementById('cred-api-key').value.trim();
      const geminiApiKey = document.getElementById('cred-gemini-key').value.trim();
      if (!clientId || !apiKey) return JarvisUI.toast('Client ID und API Key sind Pflichtfelder.', true);
      JarvisConfig.save({ clientId, apiKey, geminiApiKey });
      JarvisUI.toast('Credentials saved. Initializing Google auth…');
      try {
        await JarvisAuth.init();
        JarvisUI.toast('Ready. Click "Connect Google Drive" to sign in.');
      } catch (e2) {
        JarvisUI.toast('Init failed: ' + e2.message, true);
      }
    });

    document.getElementById('setting-speak')?.addEventListener('change', async (e) => {
      JarvisVoice.setMuted(!e.target.checked);
      if (JarvisAuth.isSignedIn()) await guarded(() => JarvisMemory.updateSettings({ speak: e.target.checked }));
    });

    document.getElementById('setting-wake')?.addEventListener('change', async (e) => {
      e.target.checked ? JarvisVoice.enableContinuousListening() : JarvisVoice.disableContinuousListening();
      if (JarvisAuth.isSignedIn()) await guarded(() => JarvisMemory.updateSettings({ wakeWord: e.target.checked }));
    });
  }

  /* ---------- Clock ---------- */
  function startClock() {
    JarvisUI.renderClock();
    setInterval(JarvisUI.renderClock, 1000);
  }

  /* ---------- Helpers ---------- */
  async function guarded(fn) {
    try {
      return await fn();
    } catch (e) {
      JarvisUI.toast(e.message || 'Something went wrong.', true);
    }
  }
})();
