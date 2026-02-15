import {
  Entity,
  ObjectIdColumn,
  ObjectId,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DroneStatus } from '../../common/enums';

@Entity('drones')
export class Drone {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column({ unique: true })
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ default: DroneStatus.IDLE })
  status!: DroneStatus;

  @Column({ nullable: true })
  latitude!: number | null;

  @Column({ nullable: true })
  longitude!: number | null;

  @Column({ nullable: true })
  lastHeartbeat!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
