const STORAGE_KEY = 'ludo-arena:sound';
const MUTED_VALUE = 'off';

let enabled = true;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

if (typeof window !== 'undefined') {
    try {
        enabled = window.localStorage.getItem(STORAGE_KEY) !== MUTED_VALUE;
    } catch {
        enabled = true;
    }
}

type ToneOptions = {
    start: number;
    duration: number;
    frequency: number;
    endFrequency?: number;
    type?: OscillatorType;
    gain?: number;
    attack?: number;
    wet?: number;
    detune?: number;
};

type NoiseOptions = {
    start: number;
    duration: number;
    gain?: number;
    attack?: number;
    filterType?: BiquadFilterType;
    frequency?: number;
    endFrequency?: number;
    q?: number;
    wet?: number;
};

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

/**
 * A small master bus with gentle compression and a synthetic room reverb.
 * Everything is generated in the browser, so no audio downloads are needed.
 */
function getGraph(context: AudioContext) {
    if (masterGain && reverbNode) {
        return { master: masterGain, reverb: reverbNode };
    }

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();

    master.gain.setValueAtTime(1.6, context.currentTime);
    compressor.threshold.setValueAtTime(-18, context.currentTime);
    compressor.knee.setValueAtTime(16, context.currentTime);
    compressor.ratio.setValueAtTime(4, context.currentTime);
    compressor.attack.setValueAtTime(0.004, context.currentTime);
    compressor.release.setValueAtTime(0.18, context.currentTime);

    master.connect(compressor);
    compressor.connect(context.destination);

    const reverb = context.createConvolver();
    const reverbGain = context.createGain();
    const length = Math.floor(context.sampleRate * 1.1);
    const impulse = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const data = impulse.getChannelData(channel);

        for (let index = 0; index < length; index += 1) {
            const decay = Math.pow(1 - index / length, 2.8);

            data[index] = (Math.random() * 2 - 1) * decay * 0.55;
        }
    }

    reverb.buffer = impulse;
    reverbGain.gain.setValueAtTime(0.22, context.currentTime);
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    masterGain = master;
    reverbNode = reverb;

    return { master, reverb };
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (noiseBuffer) {
        return noiseBuffer;
    }

    const buffer = context.createBuffer(
        1,
        context.sampleRate,
        context.sampleRate,
    );
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
    }

    noiseBuffer = buffer;

    return buffer;
}

function envelope(
    gain: GainNode,
    start: number,
    end: number,
    peak: number,
    attack: number,
) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
}

function connectWithReverb(
    context: AudioContext,
    source: AudioNode,
    wet: number,
) {
    const { master, reverb } = getGraph(context);

    source.connect(master);

    if (wet > 0) {
        const send = context.createGain();

        send.gain.setValueAtTime(wet, context.currentTime);
        source.connect(send);
        send.connect(reverb);
    }
}

function tone(context: AudioContext, options: ToneOptions) {
    const {
        start,
        duration,
        frequency,
        endFrequency,
        type = 'sine',
        gain = 0.05,
        attack = 0.008,
        wet = 0,
        detune = 0,
    } = options;

    const oscillator = context.createOscillator();
    const amplitude = context.createGain();

    oscillator.type = type;
    oscillator.detune.setValueAtTime(detune, start);
    oscillator.frequency.setValueAtTime(frequency, start);

    if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
            endFrequency,
            start + duration * 0.85,
        );
    }

    envelope(amplitude, start, start + duration, gain, attack);
    oscillator.connect(amplitude);
    connectWithReverb(context, amplitude, wet);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
}

function noise(context: AudioContext, options: NoiseOptions) {
    const {
        start,
        duration,
        gain = 0.04,
        attack = 0.004,
        filterType = 'bandpass',
        frequency = 1800,
        endFrequency,
        q = 0.8,
        wet = 0,
    } = options;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const amplitude = context.createGain();

    source.buffer = getNoiseBuffer(context);
    filter.type = filterType;
    filter.Q.setValueAtTime(q, start);
    filter.frequency.setValueAtTime(frequency, start);

    if (endFrequency) {
        filter.frequency.exponentialRampToValueAtTime(
            endFrequency,
            start + duration,
        );
    }

    envelope(amplitude, start, start + duration, gain, attack);
    source.connect(filter);
    filter.connect(amplitude);
    connectWithReverb(context, amplitude, wet);
    source.start(start, Math.random() * 0.4);
    source.stop(start + duration + 0.04);
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

/** Tiny, warm UI tick for setup and secondary buttons. */
export function playUiSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    tone(context, {
        start: now,
        duration: 0.055,
        frequency: 1150,
        endFrequency: 840,
        type: 'sine',
        gain: 0.022,
        attack: 0.004,
    });
    noise(context, {
        start: now,
        duration: 0.03,
        gain: 0.012,
        frequency: 3200,
        q: 1.2,
    });
}

/** Dice rattle, tumble, and a soft glassy settle. */
export function playDiceRollSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;
    const rattles = [
        0, 0.065, 0.13, 0.205, 0.285, 0.37, 0.46, 0.56, 0.665, 0.78,
    ];

    rattles.forEach((offset, index) => {
        const strength = 1 - index / (rattles.length + 2);

        noise(context, {
            start: now + offset,
            duration: 0.045 + Math.random() * 0.02,
            gain: 0.032 * strength,
            frequency: 2100 + Math.random() * 1700,
            q: 1.1,
            wet: 0.08,
        });
        tone(context, {
            start: now + offset,
            duration: 0.045,
            frequency: 190 + Math.random() * 90,
            endFrequency: 110,
            type: 'triangle',
            gain: 0.028 * strength,
            attack: 0.003,
        });
    });

    noise(context, {
        start: now + 0.04,
        duration: 0.82,
        gain: 0.018,
        attack: 0.08,
        filterType: 'lowpass',
        frequency: 950,
        endFrequency: 240,
        q: 0.5,
        wet: 0.12,
    });

    // The die lands right before the game reveals the result.
    tone(context, {
        start: now + 0.92,
        duration: 0.16,
        frequency: 170,
        endFrequency: 70,
        type: 'triangle',
        gain: 0.075,
        attack: 0.004,
    });
    [880, 1320].forEach((frequency, index) => {
        tone(context, {
            start: now + 0.94 + index * 0.035,
            duration: 0.28,
            frequency,
            type: 'sine',
            gain: 0.028,
            wet: 0.45,
        });
    });
}

/** Soft wooden plop plus a bright tick, one per board cell. */
export function playHopSound(step = 0): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;
    const base = 250 + (step % 6) * 14;

    tone(context, {
        start: now,
        duration: 0.105,
        frequency: base,
        endFrequency: base * 0.62,
        type: 'triangle',
        gain: 0.055,
        attack: 0.005,
    });
    tone(context, {
        start: now,
        duration: 0.05,
        frequency: 880 + (step % 6) * 45,
        type: 'sine',
        gain: 0.022,
        attack: 0.003,
        wet: 0.08,
    });
    noise(context, {
        start: now,
        duration: 0.025,
        gain: 0.012,
        frequency: 2600,
        q: 1.4,
    });
}

/** Sub impact, swoosh, and a small sparkle when a token is captured. */
export function playCaptureSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    tone(context, {
        start: now,
        duration: 0.34,
        frequency: 155,
        endFrequency: 44,
        type: 'sine',
        gain: 0.14,
        attack: 0.006,
    });
    tone(context, {
        start: now,
        duration: 0.28,
        frequency: 420,
        endFrequency: 82,
        type: 'sawtooth',
        gain: 0.045,
        attack: 0.004,
    });
    noise(context, {
        start: now,
        duration: 0.32,
        gain: 0.065,
        frequency: 2300,
        endFrequency: 260,
        q: 0.9,
        wet: 0.14,
    });
    [740, 1110].forEach((frequency, index) => {
        tone(context, {
            start: now + 0.2 + index * 0.045,
            duration: 0.22,
            frequency,
            type: 'sine',
            gain: 0.022,
            wet: 0.5,
        });
    });
}

/** Bell arpeggio when a token reaches the finish. */
export function playFinishSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.075,
            duration: 0.34,
            frequency,
            type: 'sine',
            gain: 0.045,
            wet: 0.5,
        });
        tone(context, {
            start: now + index * 0.075,
            duration: 0.22,
            frequency: frequency * 2,
            type: 'triangle',
            gain: 0.012,
            wet: 0.35,
        });
    });
}

/** Friendly rising chord when a new match starts. */
export function playStartSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.055,
            duration: 0.4,
            frequency,
            type: 'triangle',
            gain: 0.042,
            wet: 0.35,
        });
    });
    tone(context, {
        start: now,
        duration: 0.42,
        frequency: 130.81,
        endFrequency: 196,
        type: 'sine',
        gain: 0.05,
        wet: 0.2,
    });
}

/** Subtle turn cue; brighter for the local player. */
export function playTurnSound(localPlayer: boolean): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;
    const notes = localPlayer ? [660, 880] : [392, 330];

    notes.forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.07,
            duration: 0.16,
            frequency,
            type: 'sine',
            gain: 0.024,
            wet: 0.25,
        });
    });
}

/** Gentle descending cue when a roll has no legal move. */
export function playNoMoveSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    [392, 293.66].forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.09,
            duration: 0.2,
            frequency,
            type: 'triangle',
            gain: 0.03,
            wet: 0.15,
        });
    });
}

/** Full celebratory fanfare for a local win. */
export function playWinSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;
    const melody = [392, 523.25, 659.25, 783.99, 1046.5, 1318.51];

    melody.forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.085,
            duration: 0.48,
            frequency,
            type: 'triangle',
            gain: 0.05,
            wet: 0.45,
        });
        tone(context, {
            start: now + index * 0.085,
            duration: 0.34,
            frequency: frequency * 2,
            type: 'sine',
            gain: 0.016,
            wet: 0.5,
        });
    });

    [196, 261.63, 329.63].forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.17,
            duration: 0.5,
            frequency,
            type: 'sine',
            gain: 0.045,
            wet: 0.25,
        });
    });

    noise(context, {
        start: now + 0.34,
        duration: 0.55,
        gain: 0.016,
        attack: 0.08,
        filterType: 'highpass',
        frequency: 5200,
        q: 0.6,
        wet: 0.55,
    });
}

/** Soft, sympathetic cadence when the opponent wins. */
export function playDefeatSound(): void {
    const context = canPlay();

    if (!context) {
        return;
    }

    const now = context.currentTime;

    [392, 349.23, 293.66, 261.63].forEach((frequency, index) => {
        tone(context, {
            start: now + index * 0.12,
            duration: 0.34,
            frequency,
            type: 'triangle',
            gain: 0.032,
            wet: 0.35,
        });
    });
}
