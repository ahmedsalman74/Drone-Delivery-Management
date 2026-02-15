import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drone } from './entities/drone.entity';
import { Job } from '../job/entities/job.entity';
import { Order } from '../order/entities/order.entity';
import { DroneController } from './drone.controller';
import { DroneService } from './drone.service';
import { JobModule } from '../job/job.module';

@Module({
  imports: [TypeOrmModule.forFeature([Drone, Job, Order]), JobModule],
  controllers: [DroneController],
  providers: [DroneService],
  exports: [DroneService],
})
export class DroneModule {}
