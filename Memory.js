/* ============================================================
   Mars Jarvis — memory.js
   The "brain": an in-memory mirror of jarvis-data.json, plus
   save/load/edit/delete operations for notes, tasks, and
   conversation history. Every mutation persists to Drive.
   ============================================================ */

const JarvisMemory = (() => {
  let data = JarvisDrive.defaultData();
  let loaded = false;
  let onChange = () => {};

  function setChangeListener(fn) { onChange = fn; }
  function isLoaded() { return loaded; }
  function getAll() { return data; }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function loadMemory() {
    data = await JarvisDrive.readData();
    loaded = true;
    onChange(data);
    return data;
  }

  async function persist() {
    await JarvisDrive.writeData(data);
    onChange(data);
  }

  /* ---------- Notes ---------- */
  async function addNote(text) {
    const note = { id: uid(), text, createdAt: new Date().toISOString() };
    data.notes.unshift(note);
    await persist();
    return note;
  }
  async function editNote(id, text) {
    const note = data.notes.find(n => n.id === id);
    if (!note) throw new Error('Note not found.');
    note.text = text;
    note.updatedAt = new Date().toISOString();
    await persist();
    return note;
  }
  async function deleteNote(id) {
    data.notes = data.notes.filter(n => n.id !== id);
    await persist();
  }
  function searchNotes(query) {
    const q = query.trim().toLowerCase();
    if (!q) return data.notes;
    return data.notes.filter(n => n.text.toLowerCase().includes(q));
  }

  /* ---------- Tasks ---------- */
  async function addTask(text, priority = 'medium') {
    const task = { id: uid(), text, priority, done: false, createdAt: new Date().toISOString() };
    data.tasks.unshift(task);
    await persist();
    return task;
  }
  async function completeTask(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) throw new Error('Task not found.');
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : null;
    await persist();
    return task;
  }
  async function deleteTask(id) {
    data.tasks = data.tasks.filter(t => t.id !== id);
    await persist();
  }
  async function setPriority(id, priority) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) throw new Error('Task not found.');
    task.priority = priority;
    await persist();
    return task;
  }

  /* ---------- Conversations ---------- */
  async function logConversation(role, text) {
    data.conversations.unshift({ id: uid(), role, text, at: new Date().toISOString() });
    // keep the log from growing unbounded inside the single JSON file
    if (data.conversations.length > 300) data.conversations.length = 300;
    await persist();
  }

  /* ---------- Settings ---------- */
  async function updateSettings(patch) {
    data.settings = { ...data.settings, ...patch };
    await persist();
    return data.settings;
  }

  /* ---------- Generic edit/delete-by-path (spec requirement) ---------- */
  async function editMemory(section, id, patch) {
    if (!Array.isArray(data[section])) throw new Error(`Unknown memory section: ${section}`);
    const item = data[section].find(i => i.id === id);
    if (!item) throw new Error('Item not found.');
    Object.assign(item, patch);
    await persist();
    return item;
  }
  async function deleteMemory(section, id) {
    if (!Array.isArray(data[section])) throw new Error(`Unknown memory section: ${section}`);
    data[section] = data[section].filter(i => i.id !== id);
    await persist();
  }

  return {
    loadMemory, persist, getAll, isLoaded, setChangeListener,
    addNote, editNote, deleteNote, searchNotes,
    addTask, completeTask, deleteTask, setPriority,
    logConversation, updateSettings,
    editMemory, deleteMemory
  };
})();
