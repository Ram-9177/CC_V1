import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { MealMenu } from './meal-menu.entity';
import { User } from '../../users/entities/user.entity';

export enum MealIntentStatus {
  YES = 'YES',
  NO = 'NO',
  SAME = 'SAME',
  NO_RESPONSE = 'NO_RESPONSE'
}

@Entity('meal_intents')
export class MealIntent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MealMenu, (m) => (m as any).intents, { eager: true })
  menu!: MealMenu;

  @ManyToOne(() => User, { eager: true })
  student!: User;

  @Column({ type: 'varchar', length: 16 })
  intent!: MealIntentStatus;

  @CreateDateColumn()
  respondedAt!: Date;

  @Column({ type: 'boolean', default: false })
  autoExcluded!: boolean;

  @Column({ type: 'boolean', nullable: true })
  actualAttended?: boolean;
}
