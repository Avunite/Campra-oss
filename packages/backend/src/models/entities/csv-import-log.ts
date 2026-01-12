import { Entity, PrimaryColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';

@Entity('csv_import_logs')
export class CSVImportLog {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The school ID.',
	})
	public schoolId: string;

	@Column({
		...id(),
		comment: 'Admin who initiated import.',
	})
	public importedBy: string;

	@Column('integer', {
		comment: 'Total rows in CSV.',
	})
	public totalRows: number;

	@Column('integer', {
		comment: 'Successfully processed rows.',
	})
	public successfulRows: number;

	@Column('jsonb', {
		default: '[]',
		comment: 'Import errors and details.',
	})
	public errors: any[];

	@Index()
	@CreateDateColumn({
		comment: 'The created date of the import log.',
	})
	public createdAt: Date;

	constructor(data: Partial<CSVImportLog>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}