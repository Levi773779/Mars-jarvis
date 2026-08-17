/* ============================================================
   Mars Jarvis — commands.js
   Turns a raw transcript (post wake-word) into an action.
   Order of precedence:
     1. Structured commands (notes/tasks/events/weather) — EN & DE
     2. Code Studio commands ("programmier mir ...")
     3. Game launch commands ("mach mir snake" / "spiel pong")
     4. Free conversation via Gemini (JarvisAI), if configured
     5. Fallback message if nothing matched and no AI key is set
   ============================================================ */

const JarvisCommands = (() => {

  let onLaunchGame = null; // set by app.js: (gameKey) => void
  let onLaunchCode = null; // set by app.js: (description) => Promise<void>
  function setGameLauncher(fn) { onLaunchGame = fn; }
  function setCodeLauncher(fn) { onLaunchCode = fn; }

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

  function parseEventDateTime(raw) {
    let text = raw.trim();
    const now = new Date();
    let targetDate = new Date(now);
    let hour = null, minute = 0;

    if (/\bmorgen\b/i.test(text)) {
      targetDate.setDate(targetDate.getDate() + 1);
      text = text.replace(/\bmorgen\b/i, '').trim();
    } else if (/\bheute\b/i.test(text)) {
      text = text.replace(/\bheute\b/i, '').trim();
    }

    const timeMatch = text.match(/\bum\s+(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      text = text.replace(timeMatch[0], '').trim();
    }

    if (hour === null) return null;
    targetDate.setHours(hour, minute, 0, 0);

    text = text.replace(/^(am|an)\s+/i, '').trim();
    const title = text || 'Termin';
    return { when: targetDate.toISOString(), title };
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

    // ---- Weather ----
    if (/^(wie\s+wird\s+das\s+wetter|wetter(\s+heute)?)\b/i.test(lower)) {
      try {
        const weather = await JarvisWeather.getCurrent();
        return { reply: weather.text, kind: 'weather' };
      } catch (e) {
        return { reply: `Wetter konnte nicht abgerufen werden: ${e.message}`, kind: 'error' };
      }
    }

    // ---- Events / Tagesplaner ----
    if ((m = lower.match(/^termin\s+(.+)/i))) {
      const raw = text.slice(text.toLowerCase().indexOf(m[1])).trim();
      const parsed = parseEventDateTime(raw);
      if (!parsed) {
        return { reply: 'Sag mir bitte auch eine Uhrzeit, zum Beispiel "Termin Zahnarzt morgen um 9 Uhr".', kind: 'error' };
      }
      await JarvisMemory.addEvent(parsed.title, parsed.when);
      const when = new Date(parsed.when);
      const dateStr = when.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return { reply: `Termin "${parsed.title}" für ${dateStr} um ${timeStr} gespeichert.`, kind: 'event-added' };
    }

    if (/^(zeig|liste)\s+(mir\s+)?(meine\s+)?termine/i.test(lower)) {
      const upcoming = JarvisMemory.upcomingEvents();
      if (!upcoming.length) return { reply: 'Du hast keine anstehenden Termine.', kind: 'events-list' };
      const next = upcoming[0];
      const when = new Date(next.when);
      const timeStr = when.toLocaleString('de-DE', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
      return { reply: `Du hast ${upcoming.length} anstehende Termine. Als nächstes: ${next.title} am ${timeStr}.`, kind: 'events-list' };
    }

    // ---- Code Studio ----
    if ((m = lower.match(/^(?:programmier(?:e)?(?:\s+mir)?|code(?:\s+mir)?|schreib(?:e)?(?:\s+mir)?\s+(?:ein\s+)?programm)\s+(.+)/i))) {
      const description = text.slice(text.toLowerCase().indexOf(m[1])).trim();
      if (!JarvisCodeGen.isAvailable()) {
        return { reply: 'Dafür brauche ich einen Gemini-Schlüssel. Trage ihn in den Settings ein.', kind: 'error' };
      }
      if (onLaunchCode) onLaunchCode(description);
      return { reply: `Ich schreibe den Code für "${description}". Schau in Code Studio.`, kind: 'code-launched' };
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
        reply: 'Ich kann Notizen und Aufgaben verwalten, Termine merken, Wetter ansagen, kleine Spiele starten, kleine Apps programmieren — und du kannst mir einfach alles fragen.',
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

  return { process, setGameLauncher, setCodeLauncher };
})();
