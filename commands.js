/* ============================================================
   Mars Jarvis — commands.js
   Turns a raw transcript (post wake-word) into an action against
   JarvisMemory, and returns a spoken confirmation string.
   Phase 1 command surface:
     note / save note / remember <text>        -> add note
     show notes / read notes / search notes X   -> list/search notes
     delete note <text>                         -> delete matching note
     add task <text> [priority high|medium|low] -> add task
     complete task <text> / finish task <text>  -> toggle task done
     delete task <text>                         -> delete matching task
     what can you do / help                     -> capability summary
   ============================================================ */

const JarvisCommands = (() => {

  function stripLeadingFiller(text) {
    return text.replace(/^(please|can you|could you|hey|ok|okay)\s+/i, '').trim();
  }

  function extractPriority(text) {
    const m = text.match(/\bpriority\s+(high|medium|low)\b/i);
    if (m) return { priority: m[1].toLowerCase(), text: text.replace(m[0], '').trim() };
    const m2 = text.match(/\b(high|medium|low)\s+priority\b/i);
    if (m2) return { priority: m2[1].toLowerCase(), text: text.replace(m2[0], '').trim() };
    return { priority: 'medium', text };
  }

  function findBestMatch(list, fragment, textKey = 'text') {
    const q = fragment.trim().toLowerCase();
    if (!q) return null;
    let best = null, bestScore = -1;
    for (const item of list) {
      const t = item[textKey].toLowerCase();
      if (t === q) return item; // exact match short-circuits
      if (t.includes(q) || q.includes(t)) {
        const score = Math.min(t.length, q.length);
        if (score > bestScore) { best = item; bestScore = score; }
      }
    }
    return best;
  }

  async function process(rawText) {
    const text = stripLeadingFiller(rawText || '');
    const lower = text.toLowerCase();

    if (!text) {
      return { reply: "I'm listening. Go ahead.", kind: 'noop' };
    }

    // ---- Notes ----
    let m;
    if ((m = lower.match(/^(?:save\s+)?note\s+(.+)/i)) || (m = lower.match(/^remember\s+(.+)/i))) {
      const content = text.slice(text.toLowerCase().indexOf(m[1])).trim();
      await JarvisMemory.addNote(content);
      return { reply: 'I have saved your note.', kind: 'note-added' };
    }

    if (/^(show|read|list)\s+notes?/i.test(lower)) {
      const notes = JarvisMemory.getAll().notes;
      if (!notes.length) return { reply: "You don't have any notes yet.", kind: 'notes-list' };
      const preview = notes.slice(0, 3).map(n => n.text).join('. ');
      return { reply: `You have ${notes.length} note${notes.length === 1 ? '' : 's'}. Most recent: ${preview}`, kind: 'notes-list' };
    }

    if ((m = lower.match(/^search\s+notes?\s+(?:for\s+)?(.+)/i))) {
      const results = JarvisMemory.searchNotes(m[1]);
      return { reply: results.length ? `Found ${results.length} matching note${results.length === 1 ? '' : 's'}.` : 'No matching notes found.', kind: 'notes-search' };
    }

    if ((m = lower.match(/^delete\s+note\s+(.+)/i))) {
      const target = findBestMatch(JarvisMemory.getAll().notes, m[1]);
      if (!target) return { reply: "I couldn't find a note matching that.", kind: 'error' };
      await JarvisMemory.deleteNote(target.id);
      return { reply: 'Note deleted.', kind: 'note-deleted' };
    }

    // ---- Tasks ----
    if ((m = lower.match(/^add\s+task\s+(.+)/i))) {
      const raw = text.slice(text.toLowerCase().indexOf(m[1])).trim();
      const { priority, text: cleanText } = extractPriority(raw);
      await JarvisMemory.addTask(cleanText, priority);
      return { reply: `Task added with ${priority} priority.`, kind: 'task-added' };
    }

    if ((m = lower.match(/^(?:complete|finish|done with)\s+task\s+(.+)/i))) {
      const target = findBestMatch(JarvisMemory.getAll().tasks, m[1]);
      if (!target) return { reply: "I couldn't find that task.", kind: 'error' };
      await JarvisMemory.completeTask(target.id);
      return { reply: target.done ? 'Task marked complete.' : 'Task reopened.', kind: 'task-toggled' };
    }

    if ((m = lower.match(/^delete\s+task\s+(.+)/i))) {
      const target = findBestMatch(JarvisMemory.getAll().tasks, m[1]);
      if (!target) return { reply: "I couldn't find that task.", kind: 'error' };
      await JarvisMemory.deleteTask(target.id);
      return { reply: 'Task deleted.', kind: 'task-deleted' };
    }

    if (/^(show|list)\s+tasks?/i.test(lower)) {
      const open = JarvisMemory.getAll().tasks.filter(t => !t.done);
      return { reply: open.length ? `You have ${open.length} open task${open.length === 1 ? '' : 's'}.` : 'No open tasks. You are clear.', kind: 'tasks-list' };
    }

    // ---- Help ----
    if (/^(help|what can you do)/i.test(lower)) {
      return {
        reply: 'I can save and search notes, manage tasks with priority, and keep a running log of our conversation. Just start with "note", "add task", or ask me to show your notes or tasks.',
        kind: 'help'
      };
    }

    return { reply: `I heard: "${text}", but I don't have a command for that yet.`, kind: 'unrecognized' };
  }

  return { process };
})();
