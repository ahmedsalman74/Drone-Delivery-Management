import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Job } from '../job/entities/job.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { JobModule } from '../job/job.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Job]), JobModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
