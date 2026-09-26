/*! @license
 * VMD to VRM retargeting and foot IK, adapted from vrm-dance-viewer
 * https://github.com/JLChnToZ/vrm-dance-viewer (src/worker/loaders/vmd2vrmanim*.ts,
 * src/worker/vrm-ik-handler.ts, src/utils/three-helpers.ts)
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2020-2021 Jeremy Lam (JLChnToZ).
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Changes from upstream: uses the local VMD parser in ./vmd.ts instead of mmd-parser,
// drops the rxjs/worker plumbing, merges the loader, binding and IK handler into one
// module, targets @pixiv/three-vrm 3.x, and converts into VRM 1.0's +Z facing space.

import {
	AnimationClip,
	Bone,
	Euler,
	KeyframeTrack,
	MathUtils,
	NumberKeyframeTrack,
	Object3D,
	Quaternion,
	QuaternionKeyframeTrack,
	Vector3,
	VectorKeyframeTrack,
} from "three";
import {
	VRM,
	VRMExpressionPresetName,
	VRMHumanBoneName,
} from "@pixiv/three-vrm";
import type { Vmd } from "./vmd";

type HumanBone = VRMHumanBoneName;
const H = VRMHumanBoneName;
const E = VRMExpressionPresetName;

const tempV3 = new Vector3();
const tempQ = new Quaternion();

const B = {
	Root: "全ての親",
	Center: "センター",
	Groove: "グルーブ",
	Waist: "腰",
	Hips: "下半身",
	Spine: "上半身",
	Spine1: "上半身1",
	Chest: "上半身2",
	Neck: "首",
	Head: "頭",
	LeftEye: "左目",
	LeftShoulder: "左肩",
	LeftUpperArm: "左腕",
	LeftLowerArm: "左ひじ",
	LeftHand: "左手首",
	LeftThumbProximal: "左親指０",
	LeftThumbIntermediate: "左親指１",
	LeftThumbDistal: "左親指２",
	LeftIndexProximal: "左人指１",
	LeftIndexIntermediate: "左人指２",
	LeftIndexDistal: "左人指３",
	LeftMiddleProximal: "左中指１",
	LeftMiddleIntermediate: "左中指２",
	LeftMiddleDistal: "左中指３",
	LeftRingProximal: "左薬指１",
	LeftRingIntermediate: "左薬指２",
	LeftRingDistal: "左薬指３",
	LeftLittleProximal: "左小指１",
	LeftLittleIntermediate: "左小指２",
	LeftLittleDistal: "左小指３",
	LeftUpperLeg: "左足",
	LeftLowerLeg: "左ひざ",
	LeftFoot: "左足首",
	LeftFootIK: "左足ＩＫ",
	LeftToes: "左つま先",
	LeftToeIK: "左つま先ＩＫ",
	RightEye: "右目",
	RightShoulder: "右肩",
	RightUpperArm: "右腕",
	RightLowerArm: "右ひじ",
	RightHand: "右手首",
	RightThumbProximal: "右親指０",
	RightThumbIntermediate: "右親指１",
	RightThumbDistal: "右親指２",
	RightIndexProximal: "右人指１",
	RightIndexIntermediate: "右人指２",
	RightIndexDistal: "右人指３",
	RightMiddleProximal: "右中指１",
	RightMiddleIntermediate: "右中指２",
	RightMiddleDistal: "右中指３",
	RightRingProximal: "右薬指１",
	RightRingIntermediate: "右薬指２",
	RightRingDistal: "右薬指３",
	RightLittleProximal: "右小指１",
	RightLittleIntermediate: "右小指２",
	RightLittleDistal: "右小指３",
	RightUpperLeg: "右足",
	RightLowerLeg: "右ひざ",
	RightFoot: "右足首",
	RightFootIK: "右足ＩＫ",
	RightToes: "右つま先",
	RightToeIK: "右つま先ＩＫ",
} as const;

const VMD_VRM_BONE_MAP = new Map<string, HumanBone>([
	[B.Hips, H.Hips],
	[B.Spine, H.Spine],
	[B.Chest, H.Chest],
	[B.Neck, H.Neck],
	[B.Head, H.Head],
	[B.LeftEye, H.LeftEye],
	[B.LeftShoulder, H.LeftShoulder],
	[B.LeftUpperArm, H.LeftUpperArm],
	[B.LeftLowerArm, H.LeftLowerArm],
	[B.LeftHand, H.LeftHand],
	[B.LeftThumbProximal, H.LeftThumbProximal],
	[B.LeftThumbIntermediate, H.LeftThumbMetacarpal],
	[B.LeftThumbDistal, H.LeftThumbDistal],
	[B.LeftIndexProximal, H.LeftIndexProximal],
	[B.LeftIndexIntermediate, H.LeftIndexIntermediate],
	[B.LeftIndexDistal, H.LeftIndexDistal],
	[B.LeftMiddleProximal, H.LeftMiddleProximal],
	[B.LeftMiddleIntermediate, H.LeftMiddleIntermediate],
	[B.LeftMiddleDistal, H.LeftMiddleDistal],
	[B.LeftRingProximal, H.LeftRingProximal],
	[B.LeftRingIntermediate, H.LeftRingIntermediate],
	[B.LeftRingDistal, H.LeftRingDistal],
	[B.LeftLittleProximal, H.LeftLittleProximal],
	[B.LeftLittleIntermediate, H.LeftLittleIntermediate],
	[B.LeftLittleDistal, H.LeftLittleDistal],
	[B.LeftUpperLeg, H.LeftUpperLeg],
	[B.LeftLowerLeg, H.LeftLowerLeg],
	[B.LeftFoot, H.LeftFoot],
	[B.LeftToes, H.LeftToes],
	[B.RightEye, H.RightEye],
	[B.RightShoulder, H.RightShoulder],
	[B.RightUpperArm, H.RightUpperArm],
	[B.RightLowerArm, H.RightLowerArm],
	[B.RightHand, H.RightHand],
	[B.RightThumbProximal, H.RightThumbProximal],
	[B.RightThumbIntermediate, H.RightThumbMetacarpal],
	[B.RightThumbDistal, H.RightThumbDistal],
	[B.RightIndexProximal, H.RightIndexProximal],
	[B.RightIndexIntermediate, H.RightIndexIntermediate],
	[B.RightIndexDistal, H.RightIndexDistal],
	[B.RightMiddleProximal, H.RightMiddleProximal],
	[B.RightMiddleIntermediate, H.RightMiddleIntermediate],
	[B.RightMiddleDistal, H.RightMiddleDistal],
	[B.RightRingProximal, H.RightRingProximal],
	[B.RightRingIntermediate, H.RightRingIntermediate],
	[B.RightRingDistal, H.RightRingDistal],
	[B.RightLittleProximal, H.RightLittleProximal],
	[B.RightLittleIntermediate, H.RightLittleIntermediate],
	[B.RightLittleDistal, H.RightLittleDistal],
	[B.RightUpperLeg, H.RightUpperLeg],
	[B.RightLowerLeg, H.RightLowerLeg],
	[B.RightFoot, H.RightFoot],
	[B.RightToes, H.RightToes],
]);

const VMD_VRM_IK_MAP = new Map<string, HumanBone>([
	[B.LeftFootIK, H.LeftFoot],
	[B.LeftToeIK, H.LeftToes],
	[B.RightFootIK, H.RightFoot],
	[B.RightToeIK, H.RightToes],
]);

const VMD_BONE_NAMES = new Set<string>([
	...VMD_VRM_BONE_MAP.keys(),
	...VMD_VRM_IK_MAP.keys(),
	B.Root,
	B.Center,
	B.Groove,
	B.Waist,
	B.Spine1,
]);

const VMD_VRM_MORPH_MAP = new Map<string, VRMExpressionPresetName>([
	["まばたき", E.Blink],
	["ウィンク右", E.BlinkLeft],
	["ウィンク", E.BlinkRight],
	["あ", E.Aa],
	["い", E.Ih],
	["う", E.Ou],
	["え", E.Ee],
	["お", E.Oh],
]);

interface IKOffsetInit {
	/** Default X */ x: number;
	/** Default Y */ y: number;
	/** Default Z */ z: number;
	/** Scale X */ sx?: number;
	/** Scale Y */ sy?: number;
	/** Scale Z */ sz?: number;
	/** Offset (All axis) */ o?: number;
	/** Offset X */ ox?: number;
	/** Offset Y */ oy?: number;
	/** Offset Z */ oz?: number;
	/** Force override X value? */ dx?: boolean;
	/** Force override Y value? */ dy?: boolean;
	/** Force override Z value? */ dz?: boolean;
}

const IK_OFFSET_INIT = new Map<string, IKOffsetInit>([
	[B.Center, { x: 0, y: 1, z: 0 }],
	[B.LeftFootIK, { x: 1, y: 1, z: 0, dx: true }],
	[B.RightFootIK, { x: -1, y: 1, z: 0, dx: true }],
	[B.LeftToeIK, { x: 0, y: -1, z: -1, oy: 2.5, dx: true, dz: true }],
	[B.RightToeIK, { x: 0, y: -1, z: -1, oy: 2.5, dx: true, dz: true }],
]);

const V3_ZERO = new Vector3();
const Q_IDENTITY = new Quaternion();
const Z_30_DEG_CW = new Quaternion().setFromAxisAngle(
	new Vector3(0, 0, 1),
	30 * MathUtils.DEG2RAD,
);
const Z_30_DEG_CCW = Z_30_DEG_CW.clone().invert();

const LEFT_ARM_CHAIN = new Set<string>([
	B.LeftLowerArm,
	B.LeftHand,
	B.LeftThumbProximal,
	B.LeftThumbIntermediate,
	B.LeftThumbDistal,
	B.LeftIndexProximal,
	B.LeftIndexIntermediate,
	B.LeftIndexDistal,
	B.LeftMiddleProximal,
	B.LeftMiddleIntermediate,
	B.LeftMiddleDistal,
	B.LeftRingProximal,
	B.LeftRingIntermediate,
	B.LeftRingDistal,
	B.LeftLittleProximal,
	B.LeftLittleIntermediate,
	B.LeftLittleDistal,
]);

const RIGHT_ARM_CHAIN = new Set<string>([
	B.RightLowerArm,
	B.RightHand,
	B.RightThumbProximal,
	B.RightThumbIntermediate,
	B.RightThumbDistal,
	B.RightIndexProximal,
	B.RightIndexIntermediate,
	B.RightIndexDistal,
	B.RightMiddleProximal,
	B.RightMiddleIntermediate,
	B.RightMiddleDistal,
	B.RightRingProximal,
	B.RightRingIntermediate,
	B.RightRingDistal,
	B.RightLittleProximal,
	B.RightLittleIntermediate,
	B.RightLittleDistal,
]);

interface Keyframe {
	boneName: string;
	frameNum: number;
	position: Vector3;
	rotation: Quaternion;
}

interface LerpKeyframe extends Keyframe {
	isNew?: boolean;
}

interface Timeline {
	name: HumanBone | VRMExpressionPresetName;
	type: "morph" | "position" | "rotation";
	isIK?: boolean;
	times: number[];
	values: number[];
}

interface AnimationData {
	duration: number;
	timelines: Timeline[];
}

interface VRMOffsets {
	hipsOffset?: number[];
	leftFootOffset?: number[];
	rightFootOffset?: number[];
	leftToeOffset?: number[];
	rightToeOffset?: number[];
}

/**
 * Binds a parsed .vmd to `vrm`, enabling foot IK on `ik` where the motion uses it.
 * @param unit metres per MMD unit, by default fitted to the model's legs
 */
export function vmdToClip(
	vmd: Vmd,
	vrm: VRM,
	ik: VRMIKHandler,
	unit = mmdUnit(vrm),
) {
	const morphs = convertMorphs(vmd);
	const motions = convertMotions(vmd, toOffset(vrm), unit);
	return bindToVRM(
		{
			duration: Math.max(morphs.duration, motions.duration),
			timelines: [...morphs.timelines, ...motions.timelines],
		},
		vrm,
		ik,
	);
}

function convertMorphs({ morphs }: Vmd): AnimationData {
	sortFrames(morphs);
	const timelines = new Map<string, Timeline>();
	for (const { morphName, weight, frameNum } of morphs) {
		const name = VMD_VRM_MORPH_MAP.get(morphName);
		if (!name) continue;
		let timeline = timelines.get(name);
		if (!timeline) {
			timeline = { name, type: "morph", times: [], values: [] };
			timelines.set(name, timeline);
		}
		const { times, values } = timeline;
		const time = frameNum / 30;
		const timeIndex = times.findIndex((t) => t === time);
		if (timeIndex < 0) {
			times.push(time);
			values.push(weight);
		} else {
			values[timeIndex] = Math.max(values[timeIndex], weight);
		}
	}
	return {
		timelines: Array.from(timelines.values()),
		duration: getLastFrameNum(morphs) / 30,
	};
}

function convertMotions(
	{ motions }: Vmd,
	vrmOffset: VRMOffsets,
	unit: number,
): AnimationData {
	sortFrames(motions);
	const timelines: Timeline[] = [];
	const boneTlMap = new Map<string, Keyframe[]>();
	for (const name of VMD_BONE_NAMES) boneTlMap.set(name, []);
	for (const { boneName, frameNum, position, rotation } of motions)
		boneTlMap.get(boneName)?.push({
			boneName,
			frameNum,
			position: new Vector3().fromArray(position),
			rotation: new Quaternion().fromArray(rotation),
		});
	fixPositions(boneTlMap, vrmOffset, unit);
	for (const [boneName, timeline] of boneTlMap) {
		let name = VMD_VRM_BONE_MAP.get(boneName);
		let isIK = false;
		if (!name) {
			isIK = VMD_VRM_IK_MAP.has(boneName);
			name = VMD_VRM_IK_MAP.get(boneName);
		}
		if (!name) continue;

		const times: number[] = [];
		const positions: number[] = [];
		const rotations: number[] = [];
		for (const f of timeline) {
			const i = times.push(f.frameNum / 30) - 1;
			f.position.toArray(positions, i * 3);
			f.rotation.toArray(rotations, i * 4);
		}
		if (!times.length) continue;

		timelines.push({
			name,
			type: "rotation",
			isIK,
			times,
			values: rotations,
		});
		if (isIK || name === H.Hips)
			timelines.push({
				name,
				type: "position",
				isIK,
				times,
				values: positions,
			});
	}
	return { timelines, duration: getLastFrameNum(motions) / 30 };
}

function fixPositions(
	tls: Map<string, Keyframe[]>,
	vrmOffset: VRMOffsets,
	unit: number,
) {
	const offsetToTimeline = (boneName: string, rawPos?: number[]) =>
		offsetTimeline(boneName, rawPos, 1 / unit);
	const centerOffset = mergeTimelines(
		tls,
		B.Center,
		offsetToTimeline(B.Center, vrmOffset.hipsOffset),
	);
	// MMD hangs the body off センター through グルーブ and 腰, with the upper and
	// lower body as siblings below them. VRM's Spine is a child of Hips instead, so
	// it gets the upper body relative to the lower. (Upstream merged the lower body
	// for both and skipped グルーブ and 腰, which left Spine locked to the hips and
	// dropped every turn and sway keyed on those.)
	const body = [B.Root, centerOffset, B.Groove, B.Waist];
	const hipsTl = mergeTimelines(tls, ...body, B.Hips);
	tls.set(
		B.Spine,
		localizeTimeline(
			B.Spine,
			hipsTl,
			mergeTimelines(tls, ...body, B.Spine, B.Spine1),
		),
	);
	tls.set(B.Hips, hipsTl);
	tls.delete(B.Groove);
	tls.delete(B.Waist);
	tls.delete(B.Spine1);
	const leftFootOffset = offsetToTimeline(
		B.LeftFootIK,
		vrmOffset.leftFootOffset,
	);
	const rightFootOffset = offsetToTimeline(
		B.RightFootIK,
		vrmOffset.rightFootOffset,
	);
	if (tls.has(B.LeftToeIK))
		tls.set(
			B.LeftToeIK,
			mergeTimelines(
				tls,
				B.Root,
				leftFootOffset,
				B.LeftFootIK,
				offsetToTimeline(B.RightToeIK, vrmOffset.leftToeOffset),
				B.LeftToeIK,
			),
		);
	if (tls.has(B.RightToeIK))
		tls.set(
			B.RightToeIK,
			mergeTimelines(
				tls,
				B.Root,
				rightFootOffset,
				B.RightFootIK,
				offsetToTimeline(B.RightToeIK, vrmOffset.rightToeOffset),
				B.RightToeIK,
			),
		);
	if (tls.has(B.LeftFootIK))
		tls.set(
			B.LeftFootIK,
			mergeTimelines(tls, B.Root, leftFootOffset, B.LeftFootIK),
		);
	if (tls.has(B.RightFootIK))
		tls.set(
			B.RightFootIK,
			mergeTimelines(tls, B.Root, rightFootOffset, B.RightFootIK),
		);
	tls.delete(B.Center);
	tls.delete(B.Root);

	// MMD is left-handed with models facing -Z, VRM 1.0 is right-handed facing +Z,
	// so mirror across Z (upstream mirrors X, which leaves the model facing away with
	// its limbs swapped). MMD's A-pose rest also hangs the arms 30 degrees lower than
	// VRM's T-pose.
	for (const tl of tls.values())
		for (const f of tl) {
			f.position.z *= -1;
			f.rotation.x *= -1;
			f.rotation.y *= -1;
			if (f.boneName === B.LeftUpperArm)
				f.rotation.multiply(Z_30_DEG_CCW);
			else if (f.boneName === B.RightUpperArm)
				f.rotation.multiply(Z_30_DEG_CW);
			else if (LEFT_ARM_CHAIN.has(f.boneName))
				f.rotation.premultiply(Z_30_DEG_CW).multiply(Z_30_DEG_CCW);
			else if (RIGHT_ARM_CHAIN.has(f.boneName))
				f.rotation.premultiply(Z_30_DEG_CCW).multiply(Z_30_DEG_CW);
			f.position.multiplyScalar(unit);
		}
}

/** A bone's rest offset in MMD units, from the model's pose in metres where given. */
function offsetTimeline(
	boneName: string,
	rawPos: number[] | undefined,
	unitsPerMetre: number,
): Keyframe[] {
	const init = IK_OFFSET_INIT.get(boneName)!;
	const axis = (
		raw: number,
		fallback: number,
		force?: boolean,
		scale?: number,
		offset?: number,
	) =>
		force || isNaN(raw)
			? fallback
			: raw * (scale ?? 1) * unitsPerMetre +
				(offset ?? 0) +
				(init.o ?? 0);
	return [
		{
			boneName: `${boneName}Offset`,
			frameNum: 0,
			position: rawPos
				? new Vector3(
						axis(rawPos[0], init.x, init.dx, init.sx, init.ox),
						axis(rawPos[1], init.y, init.dy, init.sy, init.oy),
						axis(rawPos[2], init.z, init.dz, init.sz, init.oz),
					)
				: new Vector3(init.x, init.y, init.z),
			rotation: Q_IDENTITY,
		},
	];
}

function mergeTimelines(
	tlsMap: Map<string, Keyframe[]>,
	...tlsKey: (Keyframe[] | string)[]
) {
	const tls = tlsKey
		.map((key) => (Array.isArray(key) ? key : tlsMap.get(key)))
		.filter((tl): tl is Keyframe[] => !!tl);
	const last = tlsKey[tlsKey.length - 1];
	const boneName =
		typeof last === "string"
			? last
			: (tls[tls.length - 1][0]?.boneName ?? "");
	const results: Keyframe[] = [];
	for (const tl of tls)
		for (const f of tl) {
			const { frameNum } = f;
			if (frameNum < results.length && results[frameNum] != null)
				continue;
			const position = new Vector3();
			const rotation = new Quaternion();
			for (const otl of tls) {
				if (!otl.length) continue;
				const f2 =
					otl[0].boneName === f.boneName
						? f
						: lerpKeyframe(otl, frameNum);
				position.add(
					tempV3.copy(f2.position).applyQuaternion(rotation),
				);
				rotation.multiply(f2.rotation);
			}
			results[frameNum] = { boneName, frameNum, position, rotation };
		}
	return results.filter(Boolean);
}

/** `child` relative to `parent`, both given in the same (model) space. */
function localizeTimeline(
	boneName: string,
	parent: Keyframe[],
	child: Keyframe[],
): Keyframe[] {
	const tls = [parent, child];
	const results: Keyframe[] = [];
	let isChild = false;
	for (const tl of tls) {
		for (const f of tl) {
			const { frameNum } = f;
			if (frameNum < results.length && results[frameNum] != null)
				continue;
			const fp: LerpKeyframe = isChild
				? lerpKeyframe(parent, frameNum)
				: f;
			const fc: LerpKeyframe = isChild
				? f
				: lerpKeyframe(child, frameNum);
			const inverse = tempQ.copy(fp.rotation).invert();
			results[frameNum] = {
				boneName,
				frameNum,
				position: fc.position
					.clone()
					.sub(fp.position)
					.applyQuaternion(inverse),
				// parent⁻¹ · child; upstream had it the other way round
				rotation: inverse.clone().multiply(fc.rotation),
			};
		}
		isChild = true;
	}
	return results.filter(Boolean);
}

function lerpKeyframe(tl: Keyframe[], frameNum: number): LerpKeyframe {
	if (!tl)
		return {
			boneName: "",
			frameNum,
			position: V3_ZERO,
			rotation: Q_IDENTITY,
		};
	const nextIndex = tl.findIndex((keyframe) => frameNum < keyframe.frameNum);
	switch (nextIndex) {
		case 0:
			return tl[0];
		case -1:
			return tl[tl.length - 1];
		case frameNum:
			return tl[frameNum];
	}
	const prevFrame = tl[nextIndex - 1];
	const nextFrame = tl[nextIndex];
	const v =
		(frameNum - prevFrame.frameNum) /
		(nextFrame.frameNum - prevFrame.frameNum);
	return {
		boneName: tl[0].boneName,
		frameNum,
		position: prevFrame.position.clone().lerp(nextFrame.position, v),
		rotation: prevFrame.rotation.clone().slerp(nextFrame.rotation, v),
		isNew: true,
	};
}

function sortFrames<T extends { frameNum: number }>(frames: T[]) {
	return frames.sort((a, b) => a.frameNum - b.frameNum);
}

function getLastFrameNum(frames: { frameNum: number }[]) {
	return frames.length ? frames[frames.length - 1].frameNum : 0;
}

// Leg length (hip to ankle) of the Miku-sized models MMD motions are made for, in
// MMD units: about 9.8, i.e. the usual 8cm per unit for 78cm legs. Her steps and
// hops are scaled by how her legs compare, so the foot IK targets stay in reach.
// (Upstream used 10cm per unit for every model, which overshot the reach of her
// legs on a fifth of the frames, by up to 17%.)
const MMD_LEG_LENGTH = 9.8;

/** Metres per MMD unit for this model. */
export function mmdUnit(vrm: VRM) {
	const { humanoid } = vrm;
	const pose = humanoid.getNormalizedPose();
	humanoid.resetNormalizedPose();
	vrm.scene.updateMatrixWorld(true);
	const at = (bone: HumanBone) =>
		humanoid.getNormalizedBoneNode(bone)?.getWorldPosition(new Vector3());
	const hip = at(H.LeftUpperLeg);
	const knee = at(H.LeftLowerLeg);
	const ankle = at(H.LeftFoot);
	humanoid.setNormalizedPose(pose);
	if (!hip || !knee || !ankle) return 0.08;
	return (hip.distanceTo(knee) + knee.distanceTo(ankle)) / MMD_LEG_LENGTH;
}

function toOffset(vrm: VRM): VRMOffsets {
	const { humanoid } = vrm;
	const currentPose = humanoid.getNormalizedPose();
	humanoid.resetNormalizedPose();
	const hips = humanoid.getNormalizedBoneNode(H.Hips);
	const leftFoot = humanoid.getNormalizedBoneNode(H.LeftFoot);
	const leftToe = humanoid.getNormalizedBoneNode(H.LeftToes);
	const rightFoot = humanoid.getNormalizedBoneNode(H.RightFoot);
	const rightToe = humanoid.getNormalizedBoneNode(H.RightToes);
	humanoid.setNormalizedPose(currentPose);
	return {
		hipsOffset: calculatePosition(hips, hips),
		leftFootOffset: calculatePosition(hips, leftFoot),
		leftToeOffset: calculatePosition(leftFoot, leftToe),
		rightFootOffset: calculatePosition(hips, rightFoot),
		rightToeOffset: calculatePosition(rightFoot, rightToe),
	};
}

function calculatePosition(from?: Object3D | null, to?: Object3D | null) {
	if (!from || !to) return;
	let current: Object3D = to;
	const chain: Object3D[] = [to];
	while (current.parent && current !== from) {
		chain.push(current.parent);
		current = current.parent;
	}
	const position = new Vector3();
	for (const node of chain) position.add(node.position);
	return position.toArray();
}

function bindToVRM(data: AnimationData, vrm: VRM, ik: VRMIKHandler) {
	const tracks: KeyframeTrack[] = [];
	for (const { type, name, isIK, times, values } of data.timelines) {
		let srcName: string | null | undefined;
		if (type === "morph") {
			srcName = vrm.expressionManager?.getExpressionTrackName(name);
		} else if (isIK) {
			srcName = ik.getAndEnableIK(name as HumanBone)?.name;
		} else {
			srcName = vrm.humanoid.getNormalizedBoneNode(
				name as HumanBone,
			)?.name;
		}
		if (!srcName) continue;

		if (type === "morph")
			tracks.push(new NumberKeyframeTrack(srcName, times, values));
		else if (type === "position")
			tracks.push(
				new VectorKeyframeTrack(`${srcName}.position`, times, values),
			);
		else
			tracks.push(
				new QuaternionKeyframeTrack(
					`${srcName}.quaternion`,
					times,
					values,
				),
			);
	}
	return new AnimationClip("dance", data.duration, tracks);
}

// --- CCD foot IK -----------------------------------------------------------

const IK_BONES: HumanBone[] = [
	H.Hips,
	H.LeftUpperLeg,
	H.LeftLowerLeg,
	H.LeftFoot,
	H.LeftToes,
	H.RightUpperLeg,
	H.RightLowerLeg,
	H.RightFoot,
	H.RightToes,
];

interface IKChain {
	effector: HumanBone;
	iteration: number;
	maxAngle?: number;
	minAngle?: number;
	links: {
		enabled: boolean;
		bone: HumanBone;
		rotationMin?: Vector3;
		rotationMax?: Vector3;
	}[];
}

// Knees only fold backwards. Upstream allows -180..0 because its motion faces -Z;
// in VRM 1.0's +Z facing space a real knee bend is a positive X rotation.
const KNEE_MIN = new Vector3(0, 0, 0);
const KNEE_MAX = new Vector3(180, 0, 0).multiplyScalar(MathUtils.DEG2RAD);

const ikQuaternion = new Quaternion();
const targetPos = new Vector3();
const targetVec = new Vector3();
const effectorPos = new Vector3();
const effectorVec = new Vector3();
const linkPos = new Vector3();
const linkScale = new Vector3();
const axis = new Vector3();

export class VRMIKHandler {
	#targets = new Map<HumanBone, Object3D>();
	#chains = new Map<HumanBone, IKChain>();
	#bones = new Map<HumanBone, Bone>();
	#root: Object3D;

	constructor(vrm: VRM) {
		for (const name of IK_BONES) {
			const node = vrm.humanoid.getNormalizedBoneNode(name);
			if (node) this.#bones.set(name, node as Bone);
		}
		this.#root = this.#bones.get(H.Hips)?.parent ?? vrm.scene;

		const leg = (
			foot: HumanBone,
			lower: HumanBone,
			upper: HumanBone,
		): IKChain => ({
			effector: foot,
			iteration: 40,
			maxAngle: 0.5,
			links: [
				{
					enabled: false,
					bone: lower,
					rotationMin: KNEE_MIN,
					rotationMax: KNEE_MAX,
				},
				{ enabled: false, bone: upper },
			],
		});
		const toe = (toes: HumanBone, foot: HumanBone): IKChain => ({
			effector: toes,
			iteration: 3,
			maxAngle: 1,
			links: [{ enabled: false, bone: foot }],
		});

		this.#chains.set(
			H.LeftFoot,
			leg(H.LeftFoot, H.LeftLowerLeg, H.LeftUpperLeg),
		);
		this.#chains.set(
			H.RightFoot,
			leg(H.RightFoot, H.RightLowerLeg, H.RightUpperLeg),
		);
		this.#chains.set(H.LeftToes, toe(H.LeftToes, H.LeftFoot));
		this.#chains.set(H.RightToes, toe(H.RightToes, H.RightFoot));
	}

	getAndEnableIK(boneName: HumanBone) {
		const chain = this.#chains.get(boneName);
		if (!chain) return;
		for (const link of chain.links) link.enabled = true;
		let target = this.#targets.get(boneName);
		if (!target) {
			target = new Object3D();
			target.name = `${boneName}IK`;
			this.#root.add(target);
			this.#targets.set(boneName, target);
		}
		return target;
	}

	disableAll() {
		for (const { links } of this.#chains.values())
			for (const link of links) link.enabled = false;
	}

	update() {
		for (const [targetName, chain] of this.#chains) {
			const effector = this.#bones.get(chain.effector);
			const target = this.#targets.get(targetName);
			if (!effector || !target) continue;
			targetPos.setFromMatrixPosition(target.matrixWorld);
			for (let j = 0; j < chain.iteration; j++) {
				let rotated = false;
				for (const {
					enabled,
					bone,
					rotationMin,
					rotationMax,
				} of chain.links) {
					if (!enabled) break;
					const link = this.#bones.get(bone);
					if (!link) break;
					link.matrixWorld.decompose(
						linkPos,
						ikQuaternion,
						linkScale,
					);
					ikQuaternion.invert();
					effectorPos.setFromMatrixPosition(effector.matrixWorld);
					effectorVec
						.subVectors(effectorPos, linkPos)
						.applyQuaternion(ikQuaternion)
						.normalize();
					targetVec
						.subVectors(targetPos, linkPos)
						.applyQuaternion(ikQuaternion)
						.normalize();
					let angle = Math.acos(
						MathUtils.clamp(targetVec.dot(effectorVec), -1, 1),
					);
					if (angle < 1e-5) continue;
					if (chain.minAngle != null && angle < chain.minAngle)
						angle = chain.minAngle;
					if (chain.maxAngle != null && angle > chain.maxAngle)
						angle = chain.maxAngle;
					axis.crossVectors(effectorVec, targetVec).normalize();
					link.quaternion.multiply(
						ikQuaternion.setFromAxisAngle(axis, angle),
					);
					clampEulerByRadian(link.rotation, rotationMin, rotationMax);
					link.updateMatrixWorld(true);
					rotated = true;
				}
				if (!rotated) break;
			}
		}
	}
}

function clampEulerByRadian(v: Euler, min?: Vector3, max?: Vector3) {
	return v.set(
		clampByRadian(v.x, min?.x, max?.x),
		clampByRadian(v.y, min?.y, max?.y),
		clampByRadian(v.z, min?.z, max?.z),
	);
}

// Upstream clamps in 0..2π, which sends an angle just past a 0 limit (say -0.1)
// to ~6.18 and then snaps it to the far limit. Working in -π..π picks the near one.
function clampByRadian(
	v: number,
	min = Number.NEGATIVE_INFINITY,
	max = Number.POSITIVE_INFINITY,
) {
	return MathUtils.clamp(Math.atan2(Math.sin(v), Math.cos(v)), min, max);
}
