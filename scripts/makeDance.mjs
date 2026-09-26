import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [
	motionPath = "scratch/dance/ievan_polkka.vmd",
	cameraPath = "scratch/dance/CAM MMD Camera, 30fps - Camera.vmd",
] = process.argv.slice(2);
const OUT = "public/dance/ievan_polkka.vmd.lz4";

const HEADER = 30;
const BONE_FRAME = 111;
const MORPH_FRAME = 23;
const CAMERA_FRAME = 61;

/** Byte ranges of each section, counts included. */
function sections(buf) {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const magic = buf.subarray(0, HEADER).toString("latin1");
	let pos = HEADER + (magic.includes("0002") ? 20 : 10);
	const header = buf.subarray(0, pos);
	const take = (size) => {
		if (pos + 4 > buf.length) return Buffer.from([0, 0, 0, 0]);
		const count = view.getUint32(pos, true);
		const start = pos;
		pos += 4 + count * size;
		return buf.subarray(start, pos);
	};
	return {
		header,
		bones: take(BONE_FRAME),
		morphs: take(MORPH_FRAME),
		camera: take(CAMERA_FRAME),
	};
}

const motion = sections(readFileSync(motionPath));
const camera = sections(readFileSync(cameraPath));
const count = (s) => s.readUInt32LE(0);
if (count(motion.camera))
	console.warn("the motion already has camera keys, replacing them");

const empty = Buffer.alloc(4); // light, self shadow and IK sections: no keys
const merged = Buffer.concat([
	motion.header,
	motion.bones,
	motion.morphs,
	camera.camera,
	empty,
	empty,
	empty,
]);

const raw = join(tmpdir(), "ievan_polkka.merged.vmd");
writeFileSync(raw, merged);
try {
	execFileSync("lz4ultra", ["-c", raw, OUT], { stdio: "ignore" });
} catch {
	execFileSync("lz4", ["-9", "-f", "-q", raw, OUT]);
}
console.log(
	`${OUT}: ${count(motion.bones)} bone, ${count(motion.morphs)} morph and ${count(camera.camera)} camera keys`,
);
