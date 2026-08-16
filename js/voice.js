/* ============================================================
   Mars Jarvis — voice.js
   Web Speech API wrapper: continuous listening with wake-word
   ("jarvis") gating, push-to-talk, mute, and speech synthesis.
   ============================================================ */

const JarvisVoice = (() => {
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(SpeechRecognitionImpl) && Boolean(window.speechSynthesis);

  const WAKE_WORD = 'jarvis';

  let recognizer = null;
  let continuousMode = false;
  let pushToTalkActive = false;
  let muted = false;
  let listening = false;
  let restartTimer = null;

  let cachedVoice = null;
  let voicesReady = false;

  function pickBestVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Known male German voice names across platforms (iOS/macOS/Chrome/Android)
    const maleNameHints = ['markus', 'yannick', 'stefan', 'daniel', 'conrad', 'german male', 'male (de'];
    const femaleNameHints = ['anna', 'petra', 'helena', 'katja', 'female'];

    const germanVoices = voices.filter(v => v.lang?.toLowerCase().startsWith('de'));
    const pool = germanVoices.length ? germanVoices : voices;

    // 1) explicit male-name match within German voices
    let candidate = pool.find(v => maleNameHints.some(h => v.name.toLowerCase().includes(h)));
    // 2) any German voice NOT matching a known female name (best guess)
    if (!candidate) candidate = germanVoices.find(v => !femaleNameHints.some(h => v.name.toLowerCase().includes(h)));
    // 3) fall back to the first German voice, or the first voice available at all
    if (!candidate) candidate = germanVoices[0] || voices[0];

    return candidate || null;
  }

  function ensureVoicesLoaded() {
    if (!window.speechSynthesis) return;
    const attempt = () => {
      const v = pickBestVoice();
      if (v) { cachedVoice = v; voicesReady = true; }
    };
    attempt();
    if (!voicesReady) {
      window.speechSynthesis.onvoiceschanged = () => { attempt(); };
    }
  }

  let onHeard = () => {};      // fires with full transcript when a command should be processed
  let onStateChange = () => {}; // fires with 'idle' | 'listening' | 'speaking' | 'error'

  function setHandlers({ heard, state }) {
    if (heard) onHeard = heard;
    if (state) onStateChange = state;
  }

  function buildRecognizer() {
    if (!supported) return null;
    const r = new SpeechRecognitionImpl();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'de-DE';

    r.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalTranscript += res[0].transcript;
      }
      if (!finalTranscript) return;
      handleTranscript(finalTranscript.trim());
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      onStateChange('error');
    };

    r.onend = () => {
      listening = false;
      if (continuousMode && !pushToTalkActive) {
        restartTimer = setTimeout(() => startRecognizer(), 300);
      } else {
        onStateChange('idle');
      }
    };

    return r;
  }

  function handleTranscript(transcript) {
    const lower = transcript.toLowerCase();

    if (pushToTalkActive) {
      onHeard(transcript);
      return;
    }

    if (continuousMode) {
      const idx = lower.indexOf(WAKE_WORD);
      if (idx === -1) return;
      const command = transcript.slice(idx + WAKE_WORD.length).trim();
      onHeard(command || transcript);
    }
  }

  function startRecognizer() {
    if (!supported) return;
    if (!recognizer) recognizer = buildRecognizer();
    try {
      recognizer.start();
      listening = true;
      onStateChange('listening');
    } catch {
      // already started — ignore
    }
  }

  function stopRecognizer() {
    clearTimeout(restartTimer);
    if (recognizer && listening) {
      try { recognizer.stop(); } catch { /* noop */ }
    }
    listening = false;
  }

  function enableContinuousListening() {
    continuousMode = true;
    startRecognizer();
  }
  function disableContinuousListening() {
    continuousMode = false;
    stopRecognizer();
    onStateChange('idle');
  }
  function toggleContinuousListening() {
    continuousMode ? disableContinuousListening() : enableContinuousListening();
    return continuousMode;
  }

  function startPushToTalk() {
    pushToTalkActive = true;
    startRecognizer();
  }
  function stopPushToTalk() {
    pushToTalkActive = false;
    stopRecognizer();
    onStateChange(continuousMode ? 'listening' : 'idle');
  }

  function setMuted(val) { muted = val; }
  function isMuted() { return muted; }

  function speak(text) {
    if (muted || !window.speechSynthesis) return;
    if (!voicesReady) ensureVoicesLoaded();

    // Only cancel if something is actively speaking — cancelling an idle
    // queue is what causes the clipped, stuttery first syllable on iOS.
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'de-DE';
    if (cachedVoice) utter.voice = cachedVoice;
    utter.rate = 0.95;   // slightly slower — smoother, more deliberate delivery
    utter.pitch = 0.72;  // deeper, more masculine tone
    utter.volume = 1;
    utter.onstart = () => onStateChange('speaking');
    utter.onend = () => onStateChange(continuousMode || listening ? 'listening' : 'idle');
    // Small delay lets iOS Safari finish initializing the utterance queue
    // before speaking, which removes the stutter on the first word.
    setTimeout(() => window.speechSynthesis.speak(utter), 30);
  }

  if (supported) ensureVoicesLoaded();

  return {
    supported,
    WAKE_WORD,
    setHandlers,
    enableContinuousListening,
    disableContinuousListening,
    toggleContinuousListening,
    startPushToTalk,
    stopPushToTalk,
    setMuted,
    isMuted,
    speak,
    get continuousMode() { return continuousMode; }
  };
})();
