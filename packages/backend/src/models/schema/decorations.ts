export const packedDecorationsSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		aliases: {
			type: 'array',
			optional: false, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
		name: {
			type: 'string',
			optional: false, nullable: false,
		},
		credit: {
			type: 'string',
			optional: true, nullable: true,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		category: {
			type: 'string',
			optional: false, nullable: true,
		},
		host: {
			type: 'string',
			optional: false, nullable: true,
			description: 'The local host is represented with `null`.',
		},
		url: {
			type: 'string',
			optional: false, nullable: false,
		},
		isPlus: {
			type: 'boolean',
			optional: false, nullable: false,
		},
		isMPlus: {
			type: 'boolean',
			optional: false, nullable: false,
		},
	},
} as const;
