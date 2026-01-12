import define from '../define.js';

export const meta = {
	tags: ['meta'],
	description: 'Get release notes from Campra',

	requireCredential: false,
	requireCredentialPrivateMode: false,
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async () => {
	let release;
	
	await fetch('https://re.campra.app/meta/release.json')
		.then((response) => response.json())
		.then((data) => {
			release = data;
		});
	return release;
});
