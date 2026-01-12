import { db } from '@/db/postgre.js';
import { School } from '@/models/entities/school.js';
import { awaitAll } from '@/prelude/await-all.js';

export const SchoolRepository = db.getRepository(School).extend({
	async pack(
		src: School['id'] | School,
	) {
		const school = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll({
			id: school.id,
			name: school.name,
			logoUrl: school.logoUrl,
			isDemo: school.isDemo,
		});
	},

	packMany(
		schools: any[],
	) {
		return Promise.all(schools.map(x => this.pack(x)));
	},
});
