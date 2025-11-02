import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NoticePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

@Entity('notices')
export class Notice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  title!: string;

  @Column('text')
  content!: string;

  @Column({ type: 'enum', enum: NoticePriority, default: NoticePriority.NORMAL })
  priority!: NoticePriority;

  // Targeting
  @Column({ type: 'text', array: true, nullable: true })
  roles?: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  hostelIds?: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  blockIds?: string[] | null;

  @Column({ type: 'json', nullable: true })
  attachments?: string[] | null;

  @ManyToOne(() => User, { eager: true })
  author!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Index('IDX_notices_expiresAt')
  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;
}
