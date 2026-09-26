// The lawn she dances on, like the field in the original Ievan Polkka video. Part
// of the dance chunk, so the texture only loads once she's asked to dance.
import {
	CircleGeometry,
	Mesh,
	RepeatWrapping,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
} from "three";
import { MeshToonNodeMaterial } from "three/webgpu";
import { positionLocal, smoothstep } from "three/tsl";
import grassUrl from "../assets/grass.webp";

// big enough that the dance camera's wide shots, up to ~45m out, stay on it
const RADIUS = 150;
// where it starts fading into the sky
const FADE_FROM = 40;
// metres of lawn per texture tile
const TILE = 1.2;

export class Ground {
	readonly mesh: Mesh<CircleGeometry, MeshToonNodeMaterial>;

	static async load() {
		return new Ground(await new TextureLoader().loadAsync(grassUrl));
	}

	constructor(texture: Texture) {
		texture.colorSpace = SRGBColorSpace;
		texture.wrapS = texture.wrapT = RepeatWrapping;
		texture.repeat.setScalar((RADIUS * 2) / TILE);
		texture.anisotropy = 8;

		const material = new MeshToonNodeMaterial({
			map: texture,
			transparent: true,
			depthWrite: false,
		});
		material.opacityNode = smoothstep(
			FADE_FROM,
			RADIUS,
			positionLocal.xy.length(),
		).oneMinus();

		this.mesh = new Mesh(new CircleGeometry(RADIUS, 96), material);
		this.mesh.rotation.x = -Math.PI / 2;
		// drawn before the other see-through things, it's the floor under them
		this.mesh.renderOrder = -1;
		this.mesh.receiveShadow = true;
		this.mesh.visible = false;
	}

	dispose() {
		this.mesh.removeFromParent();
		this.mesh.geometry.dispose();
		this.mesh.material.map?.dispose();
		this.mesh.material.dispose();
	}
}
