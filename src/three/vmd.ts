// Minimal parser for MikuMikuDance motion files (.vmd): bones, morphs and camera.
// Values are returned in MMD's own (left-handed) space, conversion happens in vmd2vrm.ts
// and dance.ts.

export interface VmdBoneFrame {
	boneName: string;
	frameNum: number;
	position: [number, number, number];
	rotation: [number, number, number, number];
}

export interface VmdMorphFrame {
	morphName: string;
	frameNum: number;
	weight: number;
}

export interface VmdCameraFrame {
	frameNum: number;
	/** Orbit distance from `position`; 0 means the camera sits right at it. */
	distance: number;
	position: [number, number, number];
	/** Euler angles in radians, MMD's own convention. */
	rotation: [number, number, number];
	/** Degrees; some exporters leave it 0. */
	fov: number;
}

export interface Vmd {
	motions: VmdBoneFrame[];
	morphs: VmdMorphFrame[];
	cameras: VmdCameraFrame[];
}

const MAGIC = "Vocaloid Motion Data";
const HEADER_SIZE = 30;
const BONE_FRAME_SIZE = 111;
const MORPH_FRAME_SIZE = 23;
const CAMERA_FRAME_SIZE = 61;
const NAME_SIZE = 15;

const ascii = new TextDecoder("ascii");

export function isVmd(buffer: ArrayBuffer) {
	return (
		buffer.byteLength >= HEADER_SIZE &&
		ascii.decode(new Uint8Array(buffer, 0, MAGIC.length)) === MAGIC
	);
}

export function parseVmd(buffer: ArrayBuffer): Vmd {
	if (!isVmd(buffer)) throw new Error("Not a VMD file");

	const view = new DataView(buffer);
	const sjis = new TextDecoder("shift_jis");
	const readName = (offset: number) => {
		const bytes = new Uint8Array(buffer, offset, NAME_SIZE);
		const end = bytes.indexOf(0);
		return sjis.decode(end < 0 ? bytes : bytes.subarray(0, end));
	};

	// "Vocaloid Motion Data 0002" has a 20 byte model name, the ancient "file" variant 10.
	const header = ascii.decode(new Uint8Array(buffer, 0, HEADER_SIZE));
	let offset = HEADER_SIZE + (header.includes("0002") ? 20 : 10);

	const motions: VmdBoneFrame[] = [];
	const motionCount = view.getUint32(offset, true);
	offset += 4;
	for (let i = 0; i < motionCount; i++, offset += BONE_FRAME_SIZE) {
		const f = (n: number) =>
			view.getFloat32(offset + NAME_SIZE + 4 + n * 4, true);
		motions.push({
			boneName: readName(offset),
			frameNum: view.getUint32(offset + NAME_SIZE, true),
			position: [f(0), f(1), f(2)],
			rotation: [f(3), f(4), f(5), f(6)],
		});
	}

	const morphs: VmdMorphFrame[] = [];
	// Some exporters end the file right after the bone section.
	if (offset + 4 <= buffer.byteLength) {
		const morphCount = view.getUint32(offset, true);
		offset += 4;
		for (let i = 0; i < morphCount; i++, offset += MORPH_FRAME_SIZE) {
			morphs.push({
				morphName: readName(offset),
				frameNum: view.getUint32(offset + NAME_SIZE, true),
				weight: view.getFloat32(offset + NAME_SIZE + 4, true),
			});
		}
	}

	const cameras: VmdCameraFrame[] = [];
	if (offset + 4 <= buffer.byteLength) {
		const cameraCount = view.getUint32(offset, true);
		offset += 4;
		for (let i = 0; i < cameraCount; i++, offset += CAMERA_FRAME_SIZE) {
			const f = (n: number) => view.getFloat32(offset + 4 + n * 4, true);
			cameras.push({
				frameNum: view.getUint32(offset, true),
				distance: f(0),
				position: [f(1), f(2), f(3)],
				rotation: [f(4), f(5), f(6)],
				// after 24 bytes of interpolation curves
				fov: view.getUint32(offset + 57, true),
			});
		}
	}

	return { motions, morphs, cameras };
}
