import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

export enum UserRole {
  STUDENT = 'STUDENT',
  GATEMAN = 'GATEMAN',
  WARDEN = 'WARDEN',
  WARDEN_HEAD = 'WARDEN_HEAD',
  CHEF = 'CHEF',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ unique: true })
  hallticket!: string;

  @Column()
  password!: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  roomNumber?: string;

  @Column({ nullable: true })
  hostelBlock?: string;

  // Optional linkage to rooms module (string id to avoid tight coupling/migrations)
  @Column({ nullable: true })
  roomId?: string;

  // Optional bed label within the room (e.g., A/B/C/D)
  @Column({ nullable: true, length: 4 })
  bedLabel?: string;

  @Column({ nullable: true })
  profilePhoto?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  fcmToken?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
