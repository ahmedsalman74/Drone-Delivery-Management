import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DroneModule } from './drone/drone.module';
import { OrderModule } from './order/order.module';
import { AdminModule } from './admin/admin.module';
import { JobModule } from './job/job.module';
import { Drone } from './drone/entities/drone.entity';
import { Order } from './order/entities/order.entity';
import { Job } from './job/entities/job.entity';
import { User } from './auth/entities/user.entity';
import { TokenBlacklist } from './auth/entities/token-blacklist.entity';

@Module({
  imports: [
    // Load .env file and make config available globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB Atlas configuration via environment variables
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mongodb' as const,
        url: configService.get<string>('MONGODB_URI'),
        database: configService.get<string>(
          'MONGODB_DATABASE',
          'drone-delivery',
        ),
        entities: [Drone, Order, Job, User, TokenBlacklist],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    JobModule,
    DroneModule,
    OrderModule,
    AdminModule,
  ],
})
export class AppModule {}
