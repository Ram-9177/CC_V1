import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GateScan } from '../../gate-scans/entities/gate-scan.entity';

export enum GatePassStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED'
}

@Entity('gate_passes')
export class GatePass {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ unique: true })
  passNumber!: string;

  @ManyToOne(() => User, (u) => (u as any).gatePasses, { eager: true })
  student!: User;

  @Column({ type: 'text' })
  reason!: string;

  @Column()
  destination!: string;

  @Column()
  fromDate!: Date;

  @Column()
  toDate!: Date;

  @Column({ type: 'simple-enum', enum: GatePassStatus, default: GatePassStatus.PENDING })
  status!: GatePassStatus;

  @ManyToOne(() => User, { nullable: true, eager: true })
  approvedBy?: User;

  @Column({ nullable: true })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  rejectedReason?: string;

  @Column({ type: 'text', nullable: true })
  qrCode?: string;

  @Column({ nullable: true })
  adWatchedAt?: Date;

  @Column({ nullable: true })
  lastActivityAt?: Date;

  @Column({ nullable: true })
  autoRevokedAt?: Date;

  @Column({ default: false })
  isEmergency!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => GateScan as any, (s: any) => s.gatePass)
  scans!: GateScan[];
}
