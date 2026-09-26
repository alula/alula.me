// Everything the dance needs, loaded on demand when she's first asked to dance.
import type { VRM } from "@pixiv/three-vrm";
import { AnimationMixer, Euler, Quaternion, Vector3 } from "three";
import { Ground } from "./Ground";
import { decodeLz4Frame, isLz4Frame } from "./lz4";
import { isVmd, parseVmd, VmdCameraFrame } from "./vmd";
import { mmdUnit, vmdToClip, VRMIKHandler } from "./vmd2vrm";

// MMD's default, for exporters that leave the field at 0
const DEFAULT_FOV = 30;
const FPS = 30;
// MMD camera angles vs three's: yaw keeps its sign (checked against where frame 0's
// camera has to look to see her), pitch and roll flip with the handedness.
const PITCH_SIGN = -1;
const ROLL_SIGN = -1;

export interface Dance {
	mixer: AnimationMixer;
	clip: ReturnType<typeof vmdToClip>;
	ik: VRMIKHandler;
	/** The motion's own camera work, when the file has any. */
	camera: DanceCamera | null;
	ground: Ground;
}

/** Samples a VMD camera track in three.js space, linearly between keys. */
export class DanceCamera {
	readonly duration: number;
	#frames: number[] = [];
	#positions: Vector3[] = [];
	#rotations: Quaternion[] = [];
	#fovs: number[] = [];
	#tmp = new Vector3();

	/** @param unit metres per MMD unit, the same the motion was fitted to her with */
	constructor(keys: VmdCameraFrame[], unit: number) {
		const euler = new Euler(0, 0, 0, "YXZ");
		for (const key of [...keys].sort((a, b) => a.frameNum - b.frameNum)) {
			const [rx, ry, rz] = key.rotation;
			const rotation = new Quaternion().setFromEuler(
				euler.set(PITCH_SIGN * rx, ry, ROLL_SIGN * rz),
			);
			// MMD is left-handed with the dancer facing -Z; mirroring Z gives three's
			// right-handed space with her facing +Z, like the retargeted motion.
			const [x, y, z] = key.position;
			const position = new Vector3(x, y, -z).multiplyScalar(unit);
			// the camera orbits `position` at `distance` (negative = in front of it)
			position.add(
				new Vector3(0, 0, -key.distance * unit).applyQuaternion(
					rotation,
				),
			);
			this.#frames.push(key.frameNum);
			this.#positions.push(position);
			this.#rotations.push(rotation);
			this.#fovs.push(key.fov || DEFAULT_FOV);
		}
		this.duration = (this.#frames[this.#frames.length - 1] ?? 0) / FPS;
	}

	/** Writes the camera at `time` seconds into `position`/`rotation`, returns its fov. */
	sample(time: number, position: Vector3, rotation: Quaternion) {
		const frame = time * FPS;
		const frames = this.#frames;
		// last key at or before `frame`
		let lo = 0;
		let hi = frames.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (frames[mid] <= frame) lo = mid;
			else hi = mid - 1;
		}
		const next = Math.min(lo + 1, frames.length - 1);
		const span = frames[next] - frames[lo];
		const t =
			span > 0
				? Math.min(Math.max((frame - frames[lo]) / span, 0), 1)
				: 0;

		position
			.copy(this.#positions[lo])
			.lerp(this.#tmp.copy(this.#positions[next]), t);
		rotation.copy(this.#rotations[lo]).slerp(this.#rotations[next], t);
		return this.#fovs[lo] + (this.#fovs[next] - this.#fovs[lo]) * t;
	}
}

/** Fetches a .vmd, optionally LZ4 framed. */
async function fetchVmd(url: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	let buffer = await res.arrayBuffer();
	if (isLz4Frame(buffer)) {
		const bytes = decodeLz4Frame(buffer);
		buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
	}
	// Dev servers answer unknown paths with index.html, so sniff the magic.
	if (!isVmd(buffer)) throw new Error(`${url}: not a VMD motion`);

	return parseVmd(buffer);
}

/** The motion and its camera work bound to the model, and the lawn she dances on. */
export async function loadDance(url: string, vrm: VRM): Promise<Dance> {
	const [vmd, ground] = await Promise.all([fetchVmd(url), Ground.load()]);
	const ik = new VRMIKHandler(vrm);
	// the camera work is framed for the same Miku-sized dancer, so it scales with her
	const unit = mmdUnit(vrm);
	return {
		mixer: new AnimationMixer(vrm.scene),
		clip: vmdToClip(vmd, vrm, ik, unit),
		ik,
		camera: vmd.cameras.length ? new DanceCamera(vmd.cameras, unit) : null,
		ground,
	};
}
