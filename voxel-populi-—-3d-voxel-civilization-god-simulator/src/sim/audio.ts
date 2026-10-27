/**
 * Procedural Web Audio Spatial Sound Engine (Item 18)
 * - Zero external audio file dependencies: 100% Web Audio API synthesis
 * - Continuous spatial ambience: wind (altitude-responsive), coastal/river water waves,
 *   rain & distant thunder, daytime forest birds, nighttime crickets, and settlement bustle
 * - One-shot SFX: construction hammering, wood chopping, water splash, war horn, disaster rumble, UI click
 * - Calm adaptive pentatonic ambient music pads
 */

import { WeatherType } from './types';

export interface AudioSettings {
  muted: boolean;
  masterVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
}

export class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Continuous ambience nodes
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;

  private lastChirpTime = 0;
  private lastHammerTime = 0;
  private lastMusicChordTime = 0;
  private musicNoteIdx = 0;

  private settings: AudioSettings = {
    muted: false,
    masterVolume: 0.55,
    ambienceVolume: 0.65,
    sfxVolume: 0.6,
    musicVolume: 0.35,
  };

  constructor(initial?: Partial<AudioSettings>) {
    if (initial) {
      this.settings = { ...this.settings, ...initial };
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>): AudioSettings {
    this.settings = { ...this.settings, ...partial };
    this.applyGainLevels();
    return this.getSettings();
  }

  public ensureInitialized(): void {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.ambienceGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.musicGain = ctx.createGain();

      this.ambienceGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Create shared 3-second pink/white noise buffer for wind, water, and rain
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
      }

      // 1. Wind loop
      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 260;
      this.windFilter.Q.value = 1.8;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.08;
      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ambienceGain);
      windSource.start();

      // 2. Water / coastal waves loop
      const waterSource = ctx.createBufferSource();
      waterSource.buffer = noiseBuffer;
      waterSource.loop = true;
      this.waterFilter = ctx.createBiquadFilter();
      this.waterFilter.type = 'lowpass';
      this.waterFilter.frequency.value = 340;
      this.waterGain = ctx.createGain();
      this.waterGain.gain.value = 0.04;
      waterSource.connect(this.waterFilter);
      this.waterFilter.connect(this.waterGain);
      this.waterGain.connect(this.ambienceGain);
      waterSource.start(0.7);

      // 3. Rain / storm loop
      const rainSource = ctx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;
      this.rainFilter = ctx.createBiquadFilter();
      this.rainFilter.type = 'highpass';
      this.rainFilter.frequency.value = 950;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0.0;
      rainSource.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.ambienceGain);
      rainSource.start(1.4);

      this.isInitialized = true;
      this.applyGainLevels();
    } catch {
      // Ignore Web Audio autoplay restrictions until user interacts
    }
  }

  private applyGainLevels(): void {
    if (!this.ctx || !this.masterGain || !this.ambienceGain || !this.sfxGain || !this.musicGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.08);
    this.ambienceGain.gain.setTargetAtTime(this.settings.ambienceVolume, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.08);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.08);
  }

  /**
   * Called periodically (~4-10 Hz) with camera altitude, weather, time of day, and nearby activity
   */
  public updateSpatialState(params: {
    cameraHeight: number;
    timeOfDay: number; // 0..24
    weather: WeatherType;
    nearWaterFactor: number; // 0..1
    nearSettlementFactor: number; // 0..1
    isAtWar: boolean;
  }): void {
    if (!this.isInitialized || !this.ctx || this.settings.muted) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const altNorm = Math.max(0, Math.min(1, (params.cameraHeight - 18) / 140));
    const groundProximity = 1.0 - altNorm * 0.75;

    // 1. Wind: stronger at high camera altitude or during storms/blizzards/sandstorms
    const isWindyWeather =
      params.weather === 'Thunderstorm' ||
      params.weather === 'Blizzard' ||
      params.weather === 'Sandstorm';
    const windLevel = Math.min(
      0.42,
      0.04 + altNorm * 0.22 + (isWindyWeather ? 0.16 : 0)
    );
    if (this.windGain && this.windFilter) {
      this.windGain.gain.setTargetAtTime(windLevel, now, 0.25);
      this.windFilter.frequency.setTargetAtTime(
        210 + altNorm * 360 + Math.sin(now * 0.4) * 55,
        now,
        0.25
      );
    }

    // 2. Water waves: gentle rhythmic swell when near rivers/coast
    if (this.waterGain && this.waterFilter) {
      const wavePulse = 0.65 + 0.35 * Math.sin(now * 1.15);
      const waterLevel = params.nearWaterFactor * groundProximity * 0.18 * wavePulse;
      this.waterGain.gain.setTargetAtTime(waterLevel, now, 0.2);
      this.waterFilter.frequency.setTargetAtTime(260 + wavePulse * 180, now, 0.2);
    }

    // 3. Rain / storm patter
    if (this.rainGain) {
      const rainTarget =
        params.weather === 'Thunderstorm'
          ? 0.25
          : params.weather === 'Rain'
          ? 0.14
          : 0.0;
      this.rainGain.gain.setTargetAtTime(rainTarget, now, 0.35);
    }

    // 4. Daytime forest birds or nighttime crickets when zoomed near ground
    if (groundProximity > 0.35 && now - this.lastChirpTime > 3.6) {
      this.lastChirpTime = now + Math.random() * 2.5;
      const isNight = params.timeOfDay < 5.5 || params.timeOfDay > 19.5;
      if (isNight) {
        this.triggerCricketChirp(groundProximity * 0.08);
      } else if (params.weather === 'Clear') {
        this.triggerBirdChirp(groundProximity * 0.09);
      }
    }

    // 5. Settlement anvil/hammering chime when zoomed near a city during daytime
    if (
      params.nearSettlementFactor > 0.3 &&
      groundProximity > 0.45 &&
      params.timeOfDay >= 6.5 &&
      params.timeOfDay <= 19 &&
      now - this.lastHammerTime > 4.2
    ) {
      this.lastHammerTime = now + Math.random() * 3.0;
      this.playSfx('build', params.nearSettlementFactor * groundProximity * 0.45);
    }

    // 6. Calm procedural ambient music chord every ~8 seconds
    if (this.settings.musicVolume > 0.01 && now - this.lastMusicChordTime > 7.8) {
      this.lastMusicChordTime = now;
      this.triggerAmbientChord(params.isAtWar);
    }
  }

  private triggerBirdChirp(gainAmt: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 1850 + Math.random() * 650;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.16);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainAmt, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(g);
    g.connect(this.ambienceGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private triggerCricketChirp(gainAmt: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(3600 + Math.random() * 300, now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainAmt * 0.7, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(g);
    g.connect(this.ambienceGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private triggerAmbientChord(isAtWar: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    // Peaceful C-major pentatonic vs tense D-minor scale
    const peacefulNotes = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63];
    const warNotes = [110.0, 130.81, 146.83, 164.81, 174.61, 220.0];
    const scale = isAtWar ? warNotes : peacefulNotes;

    const root = scale[this.musicNoteIdx % scale.length];
    const fifth = scale[(this.musicNoteIdx + 2) % scale.length];
    this.musicNoteIdx = (this.musicNoteIdx + 1) % scale.length;

    for (const freq of [root, fifth]) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = isAtWar ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isAtWar ? 420 : 650, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.06, now + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 6.8);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 7.0);
    }
  }

  public playSfx(
    type: 'build' | 'chop' | 'splash' | 'thunder' | 'horn' | 'click' | 'fire',
    volumeMult = 1.0
  ): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const gain = Math.max(0.01, Math.min(0.35, 0.14 * volumeMult));

    if (type === 'build') {
      // Crisp wooden/stone mallet tap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'chop') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (type === 'thunder' || type === 'fire') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(type === 'thunder' ? 85 : 140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.75);
      g.gain.setValueAtTime(gain * 1.4, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.85);
    } else if (type === 'horn') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(146.83, now);
      osc.frequency.linearRampToValueAtTime(220.0, now + 0.35);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(gain * 1.2, now + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.95);
    } else {
      // Subtle UI click or splash
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'splash' ? 420 : 680, now);
      osc.frequency.exponentialRampToValueAtTime(type === 'splash' ? 180 : 420, now + 0.05);
      g.gain.setValueAtTime(gain * 0.6, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }
}
