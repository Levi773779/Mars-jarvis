/* ============================================================
   Mars Jarvis — codegen.js
   Lets Jarvis write small, self-contained web apps on request,
   using the same Gemini key as the chat feature. Output is a
   single HTML document (inline CSS/JS) rendered in a sandboxed
   iframe — no external requests, nothing touches the real page.
   ============================================================ */

const JarvisCodeGen = (() => {
  const SYSTEM_PROMPT =
    'Du bist ein Code-Generator innerhalb von Mars Jarvis. Der Nutzer beschreibt eine kleine Web-App oder ein Tool. ' +
    'Antworte AUSSCHLIESSLICH mit einem vollständigen, eigenständigen HTML-Dokument: ' +
    '<!DOCTYPE html> mit allem CSS in einem <style>-Tag und allem JavaScript in einem <script>-Tag, ' +
    'keine externen Ressourcen, keine Erklärungen, keine Markdown-Codeblöcke, kein Text davor oder danach — ' +
    'nur das rohe HTML-Dokument. Halte das Design dunkel, modern und gut lesbar. ' +
    'Die App muss vollständig funktionieren, ohne Server oder externe Bibliotheken.';

  function extractHtml(raw) {
    let text = raw.trim();
    // strip markdown fences if the model added them anyway
    text = text.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
    return text;
  }

  function isAvailable() {
    return JarvisConfig.isAiConfigured();
  }

  async function build(description) {
    const creds = JarvisConfig.load();
    if (!creds.geminiApiKey) throw new Error('Kein Gemini API-Schlüssel hinterlegt. Trage ihn in den Settings ein.');

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `Baue: ${description}` }] }]
    };

    const res = await fetch(JarvisConfig.GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': creds.geminiApiKey },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Code-Generierung fehlgeschlagen (${res.status}). ${errText.slice(0, 140)}`);
    }

    const json = await res.json();
    const raw = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
    if (!raw) throw new Error('Jarvis hat keinen Code geliefert.');

    return extractHtml(raw);
  }

  return { build, isAvailable };
})();
