import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type DevicePlatform = 'android' | 'ios' | 'webpush' | 'web';

@Entity({ name: 'device_tokens' })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  platform!: DevicePlatform;

  @Column({ type: 'text' })
  token!: string; // FCM token, or JSON string for Web Push subscription

  @Column({ type: 'varchar', length: 32, nullable: true })
  role?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  hostelId?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
