import define from '../define.js';

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	requireCredentialPrivateMode: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async () => {
	let tag_name;
	await fetch('https://repo.Avunite.dev/api/v4/projects/1/releases')
		.then((response) => response.json())
		.then((data) => {
			tag_name = data[0].tag_name;
		});

	return {
		tag_name,
	};
});
