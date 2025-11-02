import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { GatePass } from '../../gate-passes/entities/gate-pass.entity';
import { User } from '../../users/entities/user.entity';

export enum ScanType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT'
}

@Entity('gate_scans')
export class GateScan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => GatePass, (p) => (p as any).scans, { eager: true })
  gatePass!: GatePass;

  @ManyToOne(() => User, { eager: true })
  scannedBy!: User;

  @Column({ type: 'simple-enum', enum: ScanType })
  scanType!: ScanType;

  @CreateDateColumn()
  scannedAt!: Date;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true, type: 'text' })
  notes?: string;
}
