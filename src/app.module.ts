import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DroneModule } from './drone/drone.module';
import { OrderModule } from './order/order.module';
import { AdminModule } from './admin/admin.module';
import { JobModule } from './job/job.module';
import { Drone } from './drone/entities/drone.entity';
import { Order } from './order/entities/order.entity';
import { Job } from './job/entities/job.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'drone-delivery.db',
      entities: [Drone, Order, Job],
      synchronize: true,
    }),
    AuthModule,
    JobModule,
    DroneModule,
    OrderModule,
    AdminModule,
  ],
})
export class AppModule {}
