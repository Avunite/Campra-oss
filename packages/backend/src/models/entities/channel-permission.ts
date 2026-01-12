import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from '../id.js';

@Entity()
@Index(['roleId', 'permission'], { unique: true })
export class ChannelPermission {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The role ID.',
	})
	public roleId: string;

	@ManyToOne('ChannelRole', 'permissions', {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public role: any;

	@Column('varchar', {
		length: 64,
		comment: 'The permission name (e.g., VIEW_CHANNEL, POST_NOTES, etc.).',
	})
	public permission: string;

	@Column('boolean', {
		comment: 'Whether this permission is allowed (true) or denied (false).',
	})
	public allow: boolean;

	@Column('timestamp with time zone', {
		comment: 'The created date of the ChannelPermission.',
	})
	public createdAt: Date;
}