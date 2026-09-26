// The dance's song, played with Web Audio because it's also the dance's clock. An
// <audio> element's currentTime moves in coarse steps and runs ahead of what's
// heard by the output latency (a lot, on Bluetooth), and looping it means seeking.
// Here the song loops sample-accurately and the clock is what the speakers play.
import { debugLog } from "../lib/debug";

const VOLUME = 0.6;
// scheduling slack, so the first samples aren't late
const START_LEAD = 0.05;

export class Music {
	#context = new AudioContext({ latencyHint: "interactive" });
	#gain = new GainNode(this.#context, { gain: VOLUME });
	#decoding: Promise<AudioBuffer | null>;
	#buffer: AudioBuffer | null = null;
	#source: AudioBufferSourceNode | null = null;
	#startAt = 0;
	#loopEnd = 0;

	/** Create inside the click that starts the dance, browsers only let it play then. */
	constructor(url: string) {
		this.#gain.connect(this.#context.destination);
		this.#decoding = fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
				return res.arrayBuffer();
			})
			.then((data) => this.#context.decodeAudioData(data))
			.then((buffer) => (this.#buffer = buffer))
			.catch((e) => {
				console.warn("Music didn't load, dancing without it", e);
				return null;
			});
	}

	/** Call inside every click that starts the dance, for browsers that suspend it. */
	unlock() {
		void this.#context.resume();
	}

	/** Whether the song decoded within `timeoutMs`. */
	ready(timeoutMs: number) {
		return Promise.race([
			this.#decoding.then((buffer) => !!buffer),
			new Promise<false>((resolve) =>
				setTimeout(() => resolve(false), timeoutMs),
			),
		]);
	}

	/**
	 * Plays from the top, looping back at `loopEnd` seconds (where the motion ends).
	 * @returns false when there's no song to play
	 */
	play(loopEnd: number) {
		const buffer = this.#buffer;
		if (!buffer) return false;
		this.stop();
		void this.#context.resume();
		const source = new AudioBufferSourceNode(this.#context, {
			buffer,
			loop: true,
			loopEnd: Math.min(loopEnd, buffer.duration),
		});
		source.connect(this.#gain);
		this.#startAt = this.#context.currentTime + START_LEAD;
		source.start(this.#startAt);
		this.#source = source;
		this.#loopEnd = source.loopEnd;
		debugLog?.("music", "start", {
			state: this.#context.state,
			loopEnd: this.#loopEnd,
			sampleRate: this.#context.sampleRate,
			baseLatency: this.#context.baseLatency,
			outputLatency: this.#context.outputLatency,
		});
		return true;
	}

	stop() {
		this.#source?.stop();
		this.#source?.disconnect();
		this.#source = null;
	}

	/**
	 * Where in the song the speakers are right now, in seconds, or null when it isn't
	 * playing. Holds at 0 until the first sample is heard.
	 */
	time() {
		if (!this.#source) return null;
		const context = this.#context;
		const { contextTime = 0, performanceTime = 0 } =
			context.getOutputTimestamp?.() ?? {};
		// The output timestamp pairs the context time leaving the speakers with when
		// it did; carried forward to now, it's smooth and includes output latency.
		// Until the device reports one, the render clock minus the latency it claims.
		const heard =
			performanceTime > 0
				? contextTime + (performance.now() - performanceTime) / 1000
				: context.currentTime -
					(context.outputLatency || context.baseLatency || 0);
		const elapsed = heard - this.#startAt;
		return elapsed > 0 ? elapsed % this.#loopEnd : 0;
	}

	dispose() {
		this.stop();
		void this.#context.close();
	}
}
