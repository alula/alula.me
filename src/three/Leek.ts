import { type VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { Color, CylinderGeometry, Group, Mesh, Vector3 } from "three";
import { MeshToonNodeMaterial } from "three/webgpu";

const H = VRMHumanBoneName;

// The motion has no prop bone, and which hand holds it in the original is a guess.
const HAND = H.LeftHand;
const FINGER = H.LeftMiddleProximal;

const LENGTH = 0.7;
const RADIUS = 0.024;
// the white stalk, as a share of the length; she holds it at the middle of it
const STALK = 0.45;

/**
 * Her Ievan Polkka leek, a placeholder until there's a model: a white stalk and a
 * green top, held in her fist while she dances.
 */
export class Leek {
	readonly group = new Group();
	#geometries: CylinderGeometry[] = [];
	#materials: MeshToonNodeMaterial[] = [];

	constructor() {
		const part = (color: string, length: number, y: number) => {
			const geometry = new CylinderGeometry(RADIUS, RADIUS, length, 12);
			const material = new MeshToonNodeMaterial({
				color: new Color(color),
			});
			const mesh = new Mesh(geometry, material);
			mesh.castShadow = true;
			mesh.position.y = y;
			this.#geometries.push(geometry);
			this.#materials.push(material);
			this.group.add(mesh);
		};
		// along +y from the grip
		const stalk = LENGTH * STALK;
		part("#f3f0dc", stalk, 0);
		part("#5fae3e", LENGTH - stalk, LENGTH / 2);
		this.group.visible = false;
	}

	/**
	 * Puts it in her hand. Call while she's still in her loaded T-pose, where a fist
	 * (palm down, thumb forward) holds things pointing forward along +z.
	 */
	attach(vrm: VRM) {
		const hand = vrm.humanoid.getRawBoneNode(HAND);
		const finger = vrm.humanoid.getRawBoneNode(FINGER);
		if (!hand || !finger) return;
		vrm.scene.updateMatrixWorld(true);
		const palm = hand.getWorldPosition(new Vector3());
		const knuckle = finger.getWorldPosition(new Vector3());
		const handLength = palm.distanceTo(knuckle);
		// between the wrist and knuckles, just under the palm where the fingers close
		this.group.position
			.copy(palm)
			.lerp(knuckle, 0.6)
			.add(new Vector3(0, -handLength * 0.35, 0));
		this.group.rotation.set(Math.PI / 2, 0, 0);
		hand.attach(this.group);
	}

	dispose() {
		this.group.removeFromParent();
		for (const geometry of this.#geometries) geometry.dispose();
		for (const material of this.#materials) material.dispose();
	}
}
