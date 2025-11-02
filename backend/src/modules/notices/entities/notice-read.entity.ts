import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Notice } from './notice.entity';
import { User } from '../../users/entities/user.entity';

@Entity('notice_reads')
@Unique('UQ_notice_reads_notice_user', ['noticeId', 'userId'])
export class NoticeRead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  noticeId!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @ManyToOne(() => Notice, { onDelete: 'CASCADE' })
  notice!: Notice;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @CreateDateColumn()
  readAt!: Date;
}
