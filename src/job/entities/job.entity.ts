import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { JobStatus, JobType } from '../../common/enums';
import { Order } from '../../order/entities/order.entity';
import { Drone } from '../../drone/entities/drone.entity';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @Column({ nullable: true })
  droneId!: string | null;

  @Column({
    type: 'varchar',
    default: JobStatus.OPEN,
  })
  status!: JobStatus;

  @Column({
    type: 'varchar',
    default: JobType.DELIVERY,
  })
  type!: JobType;

  @Column({ type: 'float' })
  pickupLat!: number;

  @Column({ type: 'float' })
  pickupLng!: number;

  @Column({ type: 'float' })
  dropoffLat!: number;

  @Column({ type: 'float' })
  dropoffLng!: number;

  @VersionColumn()
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Order, (order) => order.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @ManyToOne(() => Drone, (drone) => drone.jobs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'droneId' })
  drone!: Drone | null;
}
