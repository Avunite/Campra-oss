import define from '../../define.js';
import { SchoolBillings } from '@/models/index.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get school invoice history (school admin or super admin)',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				invoiceNumber: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				date: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				amount: {
					type: 'number',
					optional: false,
					nullable: false,
				},
				status: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				period: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				studentCount: {
					type: 'integer',
					optional: false,
					nullable: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		schoolId: { type: 'string', format: 'campra:id' }, // Optional for admins
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
		offset: { type: 'integer', minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let schoolId: string;

	// Check access permissions
	if (user.isAdmin) {
		// Super admin can view any school's invoices if schoolId is provided
		if (!ps.schoolId) {
			throw new Error('Super admin must specify schoolId parameter');
		}
		schoolId = ps.schoolId;
	} else if (user.isSchoolAdmin && user.adminForSchoolId) {
		// School admin can only view their own school's invoices
		if (ps.schoolId && ps.schoolId !== user.adminForSchoolId) {
			throw new Error('School admin can only view their own school invoices');
		}
		schoolId = user.adminForSchoolId;
	} else {
		throw new Error('Access denied: School admin or super admin access required');
	}

	// Get billing records for this school
	const billingRecords = await SchoolBillings.createQueryBuilder('billing')
		.where('billing.schoolId = :schoolId', { schoolId })
		.andWhere('billing.lastPaymentDate IS NOT NULL') // Only show paid invoices
		.orderBy('billing.lastPaymentDate', 'DESC')
		.skip(ps.offset)
		.take(ps.limit)
		.getMany();

	return billingRecords.map((billing, index) => {
		const invoiceDate = billing.lastPaymentDate || billing.createdAt;
		const year = invoiceDate.getFullYear();
		const invoiceNumber = `INV-${year}-${String(index + 1).padStart(3, '0')}`;
		
		return {
			id: billing.id,
			invoiceNumber,
			date: invoiceDate.toISOString().split('T')[0],
			amount: billing.totalAmount || 0,
			status: billing.status === 'active' ? 'Paid' : 'Pending',
			period: 'Annual',
			studentCount: billing.studentCount || 0,
		};
	});
});
