/* ============================================================
   Mars Jarvis — commands.js
   Turns a raw transcript (post wake-word) into an action.
   Order of precedence:
     1. Structured commands (notes/tasks) — English & German
     2. Game launch commands ("mach mir snake" / "spiel pong")
     3. Free conversation via Gemini (JarvisAI), if configured
     4. Fallback message if nothing matched and no AI key is set
   ============================================================ */

const JarvisCommands = (() => {

  let onLaunchGame = null; // set by app.js: (gameKey) => void
  function setGameLauncher(fn) { onLaunchGame = fn; }

  function stripLeadingFiller(text) {
    return text.replace(/^(please|can you|could you|hey|ok|okay|bitte|kannst du)\s+/i, '').trim();
  }

  function extractPriority(text) {
    const m = text.match(/\bpriority\s+(high|medium|low)\b/i) || text.match(/\bpriorit(?:ä|ae)t\s+(hoch|mittel|niedrig)\b/i);
    if (m) return { priority: normalizePriority(m[1]), text: text.replace(m[0], '').trim() };
    const m2 = text.match(/\b(high|medium|low)\s+priority\b/i);
    if (m2) return { priority: normalizePriority(m2[1]), text: text.replace(m2[0], '').trim() };
    return { priority: 'medium', text };
  }

  function normalizePriority(word) {
    const map = { hoch: 'high', mittel: 'medium', niedrig: 'low', high: 'high', medium: 'medium', low: 'low' };
    return map[word.toLowerCase()] || 'medium';
  }

  function findBestMatch(list, fragment, textKey = 'text') {
    const q = fragment.trim().toLowerCase();
    if (!q) return null;
    let best = null, bestScore = -1;
    for (const item of list) {
      const t = item[textKey].toLowerCase();
      if (t === q) return item;
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
      return { reply: 'Ich höre zu. Sag einfach, was du brauchst.', kind: 'noop' };
    }

    let m;

    // ---- Notes (EN + DE) ----
    if ((m = lower.match(/^(?:save\s+)?note\s+(.+)/i)) ||
        (m = lower.match(/^remember\s+(.+)/i)) ||
        (m = lower.match(/^(?:notiere|notiz)\s+(.+)/i)) ||
        (m = lower.match(/^merk\s+dir\s+(.+)/i))) {
      const content = text.slice(text.toLowerCase().indexOf(m[1])).trim();
      await JarvisMemory.addNote(content);
      return { reply: 'Ich habe deine Notiz gespeichert.', kind: 'note-added' };
    }

    if (/^(show|read|list)\s+notes?/i.test(lower) || /^(zeig|lies)\s+(mir\s+)?(meine\s+)?notizen/i.test(lower)) {
      const notes = JarvisMemory.getAll().notes;
      if (!notes.length) return { reply: 'Du hast noch keine Notizen.', kind: 'notes-list' };
      const preview = notes.slice(0, 3).map(n => n.text).join('. ');
      return { reply: `Du hast ${notes.length} Notiz${notes.length === 1 ? '' : 'en'}. Zuletzt: ${preview}`, kind: 'notes-list' };
    }

    if ((m = lower.match(/^search\s+notes?\s+(?:for\s+)?(.+)/i)) || (m = lower.match(/^(?:suche|durchsuche)\s+notizen\s+(?:nach\s+)?(.+)/i))) {
      const results = JarvisMemory.searchNotes(m[1]);
      return { reply: results.length ? `${results.length} passende Notiz${results.length === 1 ? '' : 'en'} gefunden.` : 'Keine passenden Notizen gefunden.', kind: 'notes-search' };
    }

    if ((m = lower.match(/^delete\s+note\s+(.+)/i)) || (m = lower.match(/^l(?:ö|oe)sche\s+notiz\s+(.+)/i))) {
      const target = findBestMatch(JarvisMemory.getAll().notes, m[1]);
      if (!target) return { reply: 'Ich konnte keine passende Notiz finden.', kind: 'error' };
      await JarvisMemory.deleteNote(target.id);
      return { reply: 'Notiz gelöscht.', kind: 'note-deleted' };
    }

    // ---- Tasks (EN + DE) ----
    if ((m = lower.match(/^add\s+task\s+(.+)/i)) || (m = lower.match(/^(?:f(?:ü|ue)ge\s+)?aufgabe\s+(.+?)\s+hinzu$/i)) || (m = lower.match(/^neue\s+aufgabe\s+(.+)/i))) {
      const raw = text.slice(text.toLowerCase().indexOf(m[1])).trim();
      const { priority, text: cleanText } = extractPriority(raw);
      await JarvisMemory.addTask(cleanText, priority);
      const priorityDe = { high: 'hoher', medium: 'mittlerer', low: 'niedriger' }[priority];
      return { reply: `Aufgabe mit ${priorityDe} Priorität hinzugefügt.`, kind: 'task-added' };
    }

    if ((m = lower.match(/^(?:complete|finish|done with)\s+task\s+(.+)/i)) || (m = lower.match(/^aufgabe\s+(.+)\s+erledigt$/i))) {
      const target = findBestMatch(JarvisMemory.getAll().tasks, m[1]);
      if (!target) return { reply: 'Ich konnte diese Aufgabe nicht finden.', kind: 'error' };
      await JarvisMemory.completeTask(target.id);
      return { reply: target.done ? 'Aufgabe als erledigt markiert.' : 'Aufgabe wieder geöffnet.', kind: 'task-toggled' };
    }

    if ((m = lower.match(/^delete\s+task\s+(.+)/i)) || (m = lower.match(/^l(?:ö|oe)sche\s+aufgabe\s+(.+)/i))) {
      const target = findBestMatch(JarvisMemory.getAll().tasks, m[1]);
      if (!target) return { reply: 'Ich konnte diese Aufgabe nicht finden.', kind: 'error' };
      await JarvisMemory.deleteTask(target.id);
      return { reply: 'Aufgabe gelöscht.', kind: 'task-deleted' };
    }

    if (/^(show|list)\s+tasks?/i.test(lower) || /^(zeig|liste)\s+(mir\s+)?(meine\s+)?aufgaben/i.test(lower)) {
      const open = JarvisMemory.getAll().tasks.filter(t => !t.done);
      return { reply: open.length ? `Du hast ${open.length} offene Aufgabe${open.length === 1 ? '' : 'n'}.` : 'Keine offenen Aufgaben. Alles erledigt.', kind: 'tasks-list' };
    }

    // ---- Games ----
    if ((m = lower.match(/^(?:mach(?:e)?\s+mir|baue(?:\s+mir)?|erstelle(?:\s+mir)?|spiel(?:e)?|starte)\s+(.+)/i))) {
      const gameKey = JarvisGames.findByPhrase(m[1]);
      if (gameKey) {
        if (onLaunchGame) onLaunchGame(gameKey);
        const name = JarvisGames.get(gameKey).name;
        return { reply: `Ich habe ${name} für dich gebaut. Viel Spaß!`, kind: 'game-launched' };
      }
    }

    // ---- Help ----
    if (/^(help|what can you do)/i.test(lower) || /^(hilfe|was kannst du)/i.test(lower)) {
      return {
        reply: 'Ich kann Notizen und Aufgaben verwalten, kleine Spiele wie Snake oder Pong für dich starten — und du kannst mir einfach alles fragen, ich unterhalte mich auch mit dir.',
        kind: 'help'
      };
    }

    // ---- Free conversation fallback (Gemini) ----
    if (JarvisAI.isAvailable()) {
      try {
        const reply = await JarvisAI.ask(text);
        return { reply, kind: 'ai-chat' };
      } catch (e) {
        return { reply: `KI-Antwort fehlgeschlagen: ${e.message}`, kind: 'error' };
      }
    }

    return { reply: `Ich habe verstanden: "${text}", aber dafür habe ich keinen Befehl. Trage einen Gemini-Schlüssel in den Settings ein, damit ich frei antworten kann.`, kind: 'unrecognized' };
  }

  return { process, setGameLauncher };
})();
