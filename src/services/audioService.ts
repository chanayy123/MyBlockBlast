import track1Url from '../assets/audio/track1.mp3';
import track2Url from '../assets/audio/track2.mp3';
import track3Url from '../assets/audio/track3.mp3';

export const BGM_TRACKS = [
  { id: 'dynamic', name: 'Lofi Beat', url: track1Url },
  { id: 'relaxing', name: 'Hero Quest Piano', url: track2Url },
  { id: 'ambient', name: 'Jungle Ambient', url: track3Url }
];

class AudioService {
  private audioCtx: AudioContext | null = null;
  private bgm: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private currentTrackIndex: number = 0;

  constructor() {
    this.initBGM();
  }

  private initBGM() {
    if (this.bgm) {
      this.bgm.pause();
    }
    this.bgm = new Audio(BGM_TRACKS[this.currentTrackIndex].url);
    this.bgm.loop = true;
    this.bgm.volume = 0.2;
  }

  setTrack(index: number) {
    const wasPlaying = this.bgm && !this.bgm.paused;
    this.currentTrackIndex = index % BGM_TRACKS.length;
    this.initBGM();
    if (wasPlaying && !this.isMuted) {
      this.bgm?.play().catch(e => console.log("BGM autoplay prevented", e));
    }
  }

  getCurrentTrackIndex() {
    return this.currentTrackIndex;
  }

  private initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  play(name: 'place' | 'clear' | 'combo' | 'gameOver' | 'click', rate: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (name === 'place') {
      // Short thud/pop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 * rate, t);
      osc.frequency.exponentialRampToValueAtTime(40 * rate, t + 0.1);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (name === 'clear') {
      // Pleasant chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600 * rate, t);
      osc.frequency.exponentialRampToValueAtTime(300 * rate, t + 0.4);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (name === 'combo') {
      // Higher chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 * rate, t);
      osc.frequency.exponentialRampToValueAtTime(400 * rate, t + 0.5);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    } else if (name === 'gameOver') {
      // Descending tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 1);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
      osc.start(t);
      osc.stop(t + 1);
    } else if (name === 'click') {
      // Tiny click
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  startBGM() {
    if (this.isMuted) return;
    this.bgm?.play().catch(e => console.log("BGM autoplay prevented", e));
  }

  stopBGM() {
    this.bgm?.pause();
    if (this.bgm) this.bgm.currentTime = 0;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.bgm?.pause();
    } else {
      this.bgm?.play().catch(e => console.log("BGM autoplay prevented", e));
    }
    return this.isMuted;
  }
}

export const audioService = new AudioService();
