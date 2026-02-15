import {
  Entity,
  ObjectIdColumn,
  ObjectId,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JobStatus, JobType } from '../../common/enums';

@Entity('jobs')
export class Job {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column({ unique: true })
  id!: string;

  @Column()
  orderId!: string;

  @Column({ nullable: true })
  droneId!: string | null;

  @Column({ default: JobStatus.OPEN })
  status!: JobStatus;

  @Column({ default: JobType.DELIVERY })
  type!: JobType;

  @Column()
  pickupLat!: number;

  @Column()
  pickupLng!: number;

  @Column()
  dropoffLat!: number;

  @Column()
  dropoffLng!: number;

  @Column({ default: 1 })
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Populated manually in services (not a DB relation in MongoDB)
  order?: import('../../order/entities/order.entity').Order;
  drone?: import('../../drone/entities/drone.entity').Drone | null;
}
