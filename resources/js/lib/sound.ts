const STORAGE_KEY = 'ludo-arena:sound';
const MUTED_VALUE = 'off';

let enabled = true;
let audioContext: AudioContext | null = null;

if (typeof window !== 'undefined') {
    try {
        enabled = window.localStorage.getItem(STORAGE_KEY) !== MUTED_VALUE;
    } catch {
        enabled = true;
    }
}

function getContext(): AudioContext | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;

    if (!AudioContextClass) {
        return null;
    }

    if (!audioContext) {
        try {
            audioContext = new AudioContextClass();
        } catch {
            return null;
        }
    }

    return audioContext;
}

export function isSoundEnabled(): boolean {
    return enabled;
}

export function setSoundEnabled(value: boolean): void {
    enabled = value;

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                value ? 'on' : MUTED_VALUE,
            );
        } catch {
            // Storage can be unavailable in private mode; sound still works.
        }
    }

    if (value) {
        void unlockAudio();
    }
}

/**
 * Audio contexts have to be resumed from a user gesture. Call this from the
 * roll/token click handlers so later async animation sounds are allowed.
 */
export async function unlockAudio(): Promise<void> {
    if (!enabled) {
        return;
    }

    const context = getContext();

    if (context && context.state === 'suspended') {
        try {
            await context.resume();
        } catch {
            // Ignore and let the next gesture try again.
        }
    }
}

function canPlay(): AudioContext | null {
    if (!enabled) {
        return null;
    }

    const context = getContext();

    if (!context || context.state !== 'running') {
        return null;
    }

    return context;
}

/** Soft wooden hop, one per board cell. */
export function playHopSound(step = 0): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;
    const base = 430 + (step % 6) * 28;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(base, now);
    oscillator.frequency.exponentialRampToValueAtTime(base * 1.16, now + 0.055);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
}

/** Impact thump plus a short noise swoosh when a token is sent back. */
export function playCaptureSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    const thump = context.createOscillator();
    const thumpGain = context.createGain();

    thump.type = 'sawtooth';
    thump.frequency.setValueAtTime(230, now);
    thump.frequency.exponentialRampToValueAtTime(62, now + 0.26);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.11, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    thump.connect(thumpGain);
    thumpGain.connect(context.destination);
    thump.start(now);
    thump.stop(now + 0.34);

    const duration = 0.18;
    const buffer = context.createBuffer(
        1,
        Math.max(1, Math.floor(context.sampleRate * duration)),
        context.sampleRate,
    );
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
        const decay = 1 - index / data.length;

        data[index] = (Math.random() * 2 - 1) * decay * decay;
    }

    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();

    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);
    filter.Q.setValueAtTime(0.9, now);
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(now);
}
