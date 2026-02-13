import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DroneStatus } from '../../common/enums';
import { Job } from '../../job/entities/job.entity';

@Entity('drones')
export class Drone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({
    type: 'varchar',
    default: DroneStatus.IDLE,
  })
  status!: DroneStatus;

  @Column({ type: 'float', nullable: true })
  latitude!: number | null;

  @Column({ type: 'float', nullable: true })
  longitude!: number | null;

  @Column({ type: 'datetime', nullable: true })
  lastHeartbeat!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Job, (job) => job.drone)
  jobs!: Job[];
}
