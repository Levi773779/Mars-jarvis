/* ============================================================
   Mars Jarvis — ai.js
   Free-form conversation via Google Gemini (free tier, same
   Google account as Drive). Used as a fallback whenever a
   transcript doesn't match a structured note/task command.
   ============================================================ */

const JarvisAI = (() => {
  const SYSTEM_PROMPT =
    'Du bist Jarvis, der persönliche KI-Assistent von Mars Jarvis, inspiriert von Tony Starks Jarvis. ' +
    'Antworte auf Deutsch, knapp, hilfreich und mit einer Prise trockenem, souveränem Witz. ' +
    'Antworten werden laut vorgelesen — halte sie deshalb kurz (max. 2-3 Sätze), ' +
    'außer der Nutzer bittet ausdrücklich um mehr Details.';

  let history = []; // { role: 'user'|'model', text }

  function isAvailable() {
    return JarvisConfig.isAiConfigured();
  }

  function resetHistory() { history = []; }

  async function ask(userText) {
    const creds = JarvisConfig.load();
    if (!creds.geminiApiKey) {
      throw new Error('Kein Gemini API-Schlüssel hinterlegt. Trage ihn in den Settings ein.');
    }

    history.push({ role: 'user', text: userText });
    // keep the request small — last 10 turns is plenty of context for voice chat
    const recent = history.slice(-10);

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: recent.map(turn => ({
        role: turn.role,
        parts: [{ text: turn.text }]
      }))
    };

    const res = await fetch(JarvisConfig.GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': creds.geminiApiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini-Anfrage fehlgeschlagen (${res.status}). ${errText.slice(0, 140)}`);
    }

    const json = await res.json();
    const reply = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
    if (!reply) throw new Error('Gemini hat keine Antwort geliefert.');

    history.push({ role: 'model', text: reply });
    return reply;
  }

  return { ask, isAvailable, resetHistory };
})();
