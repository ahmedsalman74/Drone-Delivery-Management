import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderStatus } from '../../common/enums';
import { Job } from '../../job/entities/job.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  submittedBy!: string;

  @Column({ type: 'float' })
  originLat!: number;

  @Column({ type: 'float' })
  originLng!: number;

  @Column({ type: 'float' })
  destLat!: number;

  @Column({ type: 'float' })
  destLng!: number;

  @Column({
    type: 'varchar',
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Job, (job) => job.order)
  jobs!: Job[];
}
