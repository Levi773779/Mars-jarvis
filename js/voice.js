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

  let onHeard = () => {};
  let onStateChange = () => {};

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
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'de-DE';
    utter.rate = 1.02;
    utter.pitch = 0.9;
    utter.onstart = () => onStateChange('speaking');
    utter.onend = () => onStateChange(continuousMode || listening ? 'listening' : 'idle');
    window.speechSynthesis.speak(utter);
  }

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
