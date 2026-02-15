import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobService } from './job.service';
import { Job } from './entities/job.entity';
import { Order } from '../order/entities/order.entity';
import { Drone } from '../drone/entities/drone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Job, Order, Drone])],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
