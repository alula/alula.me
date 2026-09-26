// How the hero looks at the sky panorama. Shared by the stage's sky (three/StageSky.ts)
// and scripts/makeSkies.mjs, which renders the same view as the still sky shown
// until the stage runs. No imports, so the script can load it as is.

/** The panorama's u straight ahead of the camera (-z) when the pan starts. */
export const FORWARD_U = 0.18;

/** The stage camera's vertical fov at rest. */
export const REST_FOV = 24;

/**
 * The sky is seen through a wider lens than the stage camera's: at her portrait's
 * 24° it'd be a blurry sliver. Camera turns still carry over, just damped, like a
 * far off backdrop, and a level camera still puts the horizon at eye level.
 */
export const LENS_WIDEN = 3;
