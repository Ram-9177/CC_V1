import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AttendanceRecord } from './attendance-record.entity';

@Entity('attendance_sessions')
export class AttendanceSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_attendance_sessions_title')
  @Column()
  title!: string;

  @Column({ nullable: true })
  sessionType?: string; // e.g., ASSEMBLY, MEAL, NIGHT_CHECK

  @Index('idx_attendance_sessions_scheduled_at')
  @Column({ nullable: true })
  scheduledAt?: Date;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  endedAt?: Date;

  @Index('idx_attendance_sessions_status')
  @Column({ type: 'varchar', length: 16, default: 'SCHEDULED' })
  status!: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

  @Column({ type: 'varchar', length: 8, default: 'QR' })
  mode!: 'QR' | 'MANUAL' | 'MIXED';

  @Column({ type: 'int', default: 0 })
  totalExpected!: number;

  @Column({ type: 'int', default: 0 })
  totalPresent!: number;

  @Column({ type: 'int', default: 0 })
  totalAbsent!: number;

  @Column({ type: 'json', nullable: true })
  metadata?: any; // for blueprints, etc.

  @ManyToOne(() => User, { eager: true })
  createdBy!: User;

  @Column({ type: 'text', nullable: true })
  qrCode?: string;

  @Index('idx_attendance_sessions_created_at')
  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => AttendanceRecord as any, (r: any) => r.session)
  records!: AttendanceRecord[];
}
