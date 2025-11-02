import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Column, Index } from 'typeorm';
import { AttendanceSession } from './attendance-session.entity';
import { User } from '../../users/entities/user.entity';

@Entity('attendance_records')
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_attendance_records_session_id')
  @ManyToOne(() => AttendanceSession, (s) => (s as any).records, { eager: true })
  session!: AttendanceSession;

  @Index('idx_attendance_records_student_id')
  @ManyToOne(() => User, { eager: true })
  student!: User;

  @Index('idx_attendance_records_marked_at')
  @CreateDateColumn()
  markedAt!: Date;

  @Index('idx_attendance_records_status')
  @Column({ type: 'varchar', length: 16, default: 'PRESENT' })
  status!: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  @ManyToOne(() => User, { eager: true, nullable: true })
  markedBy?: User; // nullable for QR self-mark

  @Column({ type: 'varchar', length: 10, nullable: true })
  method?: 'QR' | 'MANUAL' | 'AUTO';

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
