import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AuthSessionStatus = 'PENDING' | 'AUTHENTICATED' | 'CONSUMED';

@Entity({ name: 'auth_sessions' })
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  state!: string;

  @Column({ type: 'varchar', length: 128 })
  nonce!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: AuthSessionStatus;

  @Column({ type: 'varchar', nullable: true })
  oktaSub!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  // Stored as JSON string for sqlite compatibility.
  @Column({ type: 'text', default: '[]' })
  groupsJson!: string;

  // Your internal app JWT (short-lived)
  @Column({ type: 'text', nullable: true })
  appJwt!: string | null;

  @Column({ type: 'datetime', nullable: true })
  appJwtExpiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

