declare module "virtual:webring" {
	interface WebringEntry {
		name: string;
		url: string;
		imageFile?: string;
	}

	const webring: WebringEntry[];
	export default webring;
}
