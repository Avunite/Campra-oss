import Koa from 'koa';
import { Users, UserPendings, UserProfiles } from '@/models/index.js';
import { signup } from '../common/signup.js';
import signin from '../common/signin.js';
import { SchoolService } from '@/services/school-service.js';

export default async (ctx: Koa.Context) => {
	const body = ctx.request.body;

	const code = body['code'];

	try {
		const pendingUser = await UserPendings.findOneByOrFail({ code });

		const { account, secret } = await signup({
			username: pendingUser.username,
			passwordHash: pendingUser.password,
		});

		UserPendings.delete({
			id: pendingUser.id,
		});

		const profile = await UserProfiles.findOneByOrFail({ userId: account.id });

		await UserProfiles.update({ userId: profile.userId }, {
			email: pendingUser.email,
			emailVerified: true,
			emailVerifyCode: null,
		});

		// CAMPRA PHASE 2: Assign user to school if applicable
		let schoolId: string | null = null;
		
		if (pendingUser.email && !SchoolService.isStaffEmail(pendingUser.email)) {
			const school = await SchoolService.findSchoolByEmailDomain(pendingUser.email);
			if (school) {
				schoolId = school.id;
				
				// Assign user to school
				await Users.update({ id: account.id }, { 
					schoolId,
					enrollmentStatus: 'active',
				});
				
				// Update school student count and billing
				await SchoolService.updateStudentCountAndBilling(schoolId);
			}
		}

		signin(ctx, account as any);
	} catch (e) {
		ctx.throw(400, e);
	}
};
