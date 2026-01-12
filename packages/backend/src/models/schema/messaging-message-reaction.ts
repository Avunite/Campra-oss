export const packedMessagingMessageReactionSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		createdAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		userId: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		user: {
			type: 'object',
			ref: 'UserLite',
			optional: true, nullable: false,
		},
		messageId: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		message: {
			type: 'object',
			optional: true, nullable: true,
			ref: 'MessagingMessage',
		},
		reaction: {
			type: 'string',
			optional: false, nullable: false,
		},
	},
} as const;
