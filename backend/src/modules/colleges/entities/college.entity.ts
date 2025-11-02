import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('colleges')
export class College {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @ManyToOne(() => Tenant, (t) => (t as any).colleges, { eager: true })
  tenant!: Tenant;

  @Column({ nullable: true })
  address?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
