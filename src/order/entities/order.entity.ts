import {
  Entity,
  ObjectIdColumn,
  ObjectId,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../../common/enums';

@Entity('orders')
export class Order {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column({ unique: true })
  id!: string;

  @Column()
  submittedBy!: string;

  @Column()
  originLat!: number;

  @Column()
  originLng!: number;

  @Column()
  destLat!: number;

  @Column()
  destLng!: number;

  @Column({ default: OrderStatus.PENDING })
  status!: OrderStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
