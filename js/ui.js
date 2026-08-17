/* ============================================================
   Mars Jarvis — ui.js
   Pure DOM rendering + navigation helpers. No business logic.
   ============================================================ */

const JarvisUI = (() => {

  function switchSection(name) {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.section === name);
    });
    document.querySelectorAll('[data-view]').forEach(sec => {
      sec.hidden = sec.id !== `view-${name}`;
    });
    document.querySelector('.sidebar')?.classList.remove('is-open');
  }

  function toast(message, isError = false) {
    const stack = document.getElementById('toast-stack');
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function setReactorState(state) {
    document.querySelectorAll('.reactor').forEach(r => r.dataset.state = state);
    const labelMap = {
      idle: 'STANDING BY',
      listening: 'LISTENING…',
      speaking: 'RESPONDING…',
      error: 'MIC ERROR'
    };
    const label = labelMap[state] || 'STANDING BY';
    const home = document.getElementById('reactor-state');
    const voice = document.getElementById('voice-state-label');
    if (home) home.textContent = label;
    if (voice) voice.textContent = label;
    const statusVoice = document.getElementById('status-voice');
    if (statusVoice) statusVoice.textContent = label.replace('…', '');
  }

  function setSyncState(connected, email) {
    const ind = document.getElementById('sync-indicator');
    const label = document.getElementById('sync-label');
    const statusDrive = document.getElementById('status-drive');
    const settingsAccount = document.getElementById('settings-account');
    const authBtn = document.getElementById('auth-btn');
    const settingsAuthBtn = document.getElementById('settings-auth-btn');

    ind.dataset.state = connected ? 'online' : 'offline';
    label.textContent = connected ? 'DRIVE: CONNECTED' : 'DRIVE: DISCONNECTED';
    if (statusDrive) statusDrive.textContent = connected ? 'Connected' : 'Disconnected';
    if (settingsAccount) settingsAccount.textContent = connected ? `Connected as ${email || 'your Google account'}` : 'Not connected.';
    if (authBtn) authBtn.textContent = connected ? 'Reconnect Drive' : 'Connect Google Drive';
    if (settingsAuthBtn) settingsAuthBtn.textContent = connected ? 'Reconnect Drive' : 'Connect Google Drive';
  }

  function renderClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false });
    const date = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const big = document.getElementById('big-clock');
    const bigDate = document.getElementById('big-date');
    const top = document.getElementById('topbar-clock');
    if (big) big.textContent = time;
    if (bigDate) bigDate.textContent = date;
    if (top) top.textContent = time;
  }

  function renderStats(data) {
    document.getElementById('stat-notes').textContent = data.notes.length;
    document.getElementById('stat-tasks').textContent = data.tasks.filter(t => !t.done).length;
    document.getElementById('stat-conv').textContent = data.conversations.length;
  }

  function renderActivity(data) {
    const list = document.getElementById('activity-list');
    const recent = data.conversations.slice(0, 8);
    if (!recent.length) {
      list.innerHTML = '<li class="muted">No activity yet. Connect Drive and speak to Jarvis to begin.</li>';
      return;
    }
    list.innerHTML = recent.map(c => `
      <li>
        <span class="item-text">${c.role === 'user' ? '🗣️' : '🤖'} ${escapeHtml(c.text)}</span>
        <span class="muted small">${new Date(c.at).toLocaleTimeString([], { hour12: false })}</span>
      </li>
    `).join('');
  }

  function renderNotes(notes) {
    const list = document.getElementById('notes-list');
    if (!notes.length) {
      list.innerHTML = '<li class="muted">No notes yet.</li>';
      return;
    }
    list.innerHTML = notes.map(n => `
      <li data-id="${n.id}">
        <span class="item-text">${escapeHtml(n.text)}</span>
        <span class="row-actions">
          <button class="icon-btn" data-action="edit-note" data-id="${n.id}">Edit</button>
          <button class="icon-btn danger" data-action="delete-note" data-id="${n.id}">Delete</button>
        </span>
      </li>
    `).join('');
  }

  function renderTasks(tasks) {
    const list = document.getElementById('tasks-list');
    if (!tasks.length) {
      list.innerHTML = '<li class="muted">No tasks yet.</li>';
      return;
    }
    list.innerHTML = tasks.map(t => `
      <li data-id="${t.id}" class="${t.done ? 'done' : ''}">
        <span class="item-text">${escapeHtml(t.text)}</span>
        <span class="tag ${t.priority}">${t.priority}</span>
        <span class="row-actions">
          <button class="icon-btn" data-action="toggle-task" data-id="${t.id}">${t.done ? 'Reopen' : 'Complete'}</button>
          <button class="icon-btn danger" data-action="delete-task" data-id="${t.id}">Delete</button>
        </span>
      </li>
    `).join('');
  }

  function renderCommandHistory(conversations) {
    const list = document.getElementById('command-history');
    if (!conversations.length) {
      list.innerHTML = '<li class="muted">No commands yet.</li>';
      return;
    }
    list.innerHTML = conversations.slice(0, 30).map(c => `
      <li>
        <span class="item-text">${c.role === 'user' ? '🗣️' : '🤖'} ${escapeHtml(c.text)}</span>
        <span class="muted small">${new Date(c.at).toLocaleTimeString([], { hour12: false })}</span>
      </li>
    `).join('');
  }

  function renderEvents(events) {
    const list = document.getElementById('events-list');
    if (!list) return;
    if (!events.length) {
      list.innerHTML = '<li class="muted">Keine Termine.</li>';
      return;
    }
    const sorted = [...events].sort((a, b) => new Date(a.when) - new Date(b.when));
    list.innerHTML = sorted.map(e => {
      const when = new Date(e.when);
      const label = when.toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `
        <li data-id="${e.id}">
          <span class="item-text">${escapeHtml(e.title)} — <span class="muted small">${label}</span></span>
          <span class="row-actions">
            <button class="icon-btn danger" data-action="delete-event" data-id="${e.id}">Delete</button>
          </span>
        </li>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    switchSection, toast, setReactorState, setSyncState,
    renderClock, renderStats, renderActivity, renderNotes, renderTasks, renderCommandHistory, renderEvents
  };
})();
