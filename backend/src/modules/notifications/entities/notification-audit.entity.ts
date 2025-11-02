import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type NotificationStatus = 'pending' | 'success' | 'failed';

@Entity({ name: 'notification_audit' })
export class NotificationAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  recipient?: string; // device token

  @Column({ nullable: true })
  topic?: string;

  @Column({ type: 'json', nullable: true })
  payload?: any;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: NotificationStatus;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
