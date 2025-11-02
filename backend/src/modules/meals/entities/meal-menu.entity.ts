import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MealIntent } from './meal-intent.entity';

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACKS = 'SNACKS'
}

@Entity('meal_menus')
export class MealMenu {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'date' })
  date!: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 16 })
  mealType!: MealType;

  @Column({ type: 'json' })
  items!: string[];

  @Column({ type: 'boolean', default: false })
  closed!: boolean;

  @ManyToOne(() => User, { eager: true })
  createdBy!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => MealIntent as any, (i: any) => i.menu)
  intents!: MealIntent[];
}
