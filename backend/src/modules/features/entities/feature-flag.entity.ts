import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type FeatureScope = 'TENANT' | 'COLLEGE';

@Entity('feature_flags')
@Index(['scope', 'scopeId', 'key'], { unique: true })
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  scope!: FeatureScope; // TENANT | COLLEGE

  @Column({ type: 'uuid' })
  scopeId!: string; // tenantId or collegeId

  @Column({ type: 'text' })
  key!: string; // e.g., 'gatePass', 'attendance', 'meals', 'notices', 'rooms'

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column('jsonb', { nullable: true })
  config?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
