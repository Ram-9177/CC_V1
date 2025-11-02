import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_rooms_block')
  @Column()
  block!: string; // e.g., 'Block A'

  @Index('idx_rooms_number')
  @Column()
  number!: string; // e.g., '101'

  @Column({ nullable: true })
  floor?: string; // optional

  @Column({ type: 'int', default: 4 })
  capacity!: number; // default 4 beds (A/B/C/D)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
