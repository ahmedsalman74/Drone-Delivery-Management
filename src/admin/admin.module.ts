import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Order } from '../order/entities/order.entity';
import { Drone } from '../drone/entities/drone.entity';
import { Job } from '../job/entities/job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Drone, Job])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
