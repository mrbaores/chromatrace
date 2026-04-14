// ========================================================
// CHROMATRACE - Gestionnaire Audio
// ========================================================

const SoundManager = (() => {
  let audioContext = null;
  let ambientOscillator = null;
  let masterGain = null;

  /**
   * Initialise le contexte audio Web Audio API
   */
  function initAudio() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.2; // 20% volume pour ne pas être agressif
    masterGain.connect(audioContext.destination);
  }

  /**
   * Génère un son ambient synthétique (basse fréquence de fond)
   */
  function playAmbient() {
    initAudio();

    if (ambientOscillator) {
      ambientOscillator.stop();
    }

    try {
      // Crée une oscillation basse pour l'ambiance
      ambientOscillator = audioContext.createOscillator();
      ambientOscillator.type = 'sine';
      ambientOscillator.frequency.value = 55; // Basse fréquence (modulation légère)

      const lfo = audioContext.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5; // LFO lent (variation toutes les 2 secondes)

      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 20; // Variation de ±20 Hz

      lfo.connect(lfoGain);
      lfoGain.connect(ambientOscillator.frequency);

      // Volume ambiance
      const ambientGain = audioContext.createGain();
      ambientGain.gain.value = 0.15;

      ambientOscillator.connect(ambientGain);
      ambientGain.connect(masterGain);

      ambientOscillator.start();
      lfo.start();
    } catch (e) {
      console.warn('⚠ Audio Web API non disponible:', e.message);
    }
  }

  /**
   * Joue un son de pickup d'item (bref beep)
   */
  function playPickup() {
    initAudio();

    try {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);

      const envelope = audioContext.createGain();
      envelope.gain.setValueAtTime(0.05, now);
      envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(envelope);
      envelope.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn('⚠ Erreur son pickup:', e.message);
    }
  }

  /**
   * Joue un son de mort (down beep)
   */
  function playDeath() {
    initAudio();

    try {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);

      const envelope = audioContext.createGain();
      envelope.gain.setValueAtTime(0.08, now);
      envelope.gain.exponentialRampToValueAtTime(0, now + 0.3);

      osc.connect(envelope);
      envelope.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('⚠ Erreur son mort:', e.message);
    }
  }

  /**
   * Joue un son de victoire (montée)
   */
  function playWin() {
    initAudio();

    try {
      const now = audioContext.currentTime;
      const notes = [523, 659, 784, 1047]; // DO, MI, SOL, DO (gamme majeure)

      notes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const envelope = audioContext.createGain();
        envelope.gain.setValueAtTime(0.03, now + index * 0.15);
        envelope.gain.exponentialRampToValueAtTime(0, now + (index + 1) * 0.15);

        osc.connect(envelope);
        envelope.connect(masterGain);

        osc.start(now + index * 0.15);
        osc.stop(now + (index + 1) * 0.15);
      });
    } catch (e) {
      console.warn('⚠ Erreur son victoire:', e.message);
    }
  }

  /**
   * Arrête la musique ambiance
   */
  function stopAmbient() {
    if (ambientOscillator) {
      try {
        ambientOscillator.stop();
      } catch (e) {
        // Silence les erreurs
      }
      ambientOscillator = null;
    }
  }

  /**
   * Change le volume master (0.0 à 1.0)
   */
  function setVolume(value) {
    if (masterGain) {
      masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * Retourne volume actuel
   */
  function getVolume() {
    return masterGain ? masterGain.gain.value : 0;
  }

  // ========================================================
  // 📦 API PUBLIQUE
  // ========================================================

  return {
    playAmbient,
    playPickup,
    playDeath,
    playWin,
    stopAmbient,
    setVolume,
    getVolume
  };
})();
