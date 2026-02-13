import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { Job } from '../job/entities/job.entity';
import { JobService } from '../job/job.service';
import { OrderStatus, JobType, JobStatus } from '../common/enums';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { calculateETA } from '../common/utils';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly jobService: JobService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Submit a new order and create an initial DELIVERY job.
   * Wrapped in a transaction so both order and job succeed or both roll back.
   */
  async createOrder(submittedBy: string, dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        submittedBy,
        originLat: dto.originLat,
        originLng: dto.originLng,
        destLat: dto.destLat,
        destLng: dto.destLng,
        status: OrderStatus.PENDING,
      });

      const savedOrder = await manager.save(Order, order);

      // Create the initial delivery job inside the same transaction
      const job = manager.create(Job, {
        orderId: savedOrder.id,
        type: JobType.DELIVERY,
        status: JobStatus.OPEN,
        pickupLat: dto.originLat,
        pickupLng: dto.originLng,
        dropoffLat: dto.destLat,
        dropoffLng: dto.destLng,
      });
      await manager.save(Job, job);

      return savedOrder;
    });
  }

  /**
   * Withdraw an order — only allowed if status is PENDING.
   * Also cancels any associated OPEN jobs.
   * Wrapped in a transaction to prevent race conditions with drone reservation.
   */
  async withdrawOrder(orderId: string, userName: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.submittedBy !== userName) {
        throw new ForbiddenException('You can only withdraw your own orders');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          `Cannot withdraw order: order is "${order.status}". Only pending orders can be withdrawn.`,
        );
      }

      // Cancel all associated OPEN jobs within the same transaction
      const jobs = await manager.find(Job, {
        where: { orderId },
      });
      for (const job of jobs) {
        if (job.status === JobStatus.OPEN) {
          job.status = JobStatus.CANCELLED;
          await manager.save(Job, job);
        }
      }

      order.status = OrderStatus.WITHDRAWN;
      return manager.save(Order, order);
    });
  }

  /**
   * Get all orders submitted by a specific user.
   */
  async getOrders(userName: string, query: OrderQueryDto): Promise<Order[]> {
    const where: FindOptionsWhere<Order> = { submittedBy: userName };
    if (query.status) {
      where.status = query.status;
    }

    return this.orderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get detailed order info including progress, drone location, and ETA.
   */
  async getOrderDetail(orderId: string, userName: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.submittedBy !== userName) {
      throw new ForbiddenException('You can only view your own orders');
    }

    const jobs = await this.jobService.findJobsByOrderId(orderId);

    // Find active job with drone
    const activeJob = jobs.find(
      (j) =>
        j.status === JobStatus.RESERVED || j.status === JobStatus.IN_PROGRESS,
    );

    let droneLocation: { latitude: number; longitude: number } | null = null;
    let etaMinutes: number | null = null;

    if (activeJob?.drone) {
      if (
        activeJob.drone.latitude !== null &&
        activeJob.drone.longitude !== null
      ) {
        droneLocation = {
          latitude: activeJob.drone.latitude,
          longitude: activeJob.drone.longitude,
        };
        etaMinutes = calculateETA(
          activeJob.drone.latitude,
          activeJob.drone.longitude,
          order.destLat,
          order.destLng,
        );
      }
    }

    return {
      order,
      progress: {
        status: order.status,
        currentJob: activeJob
          ? {
              id: activeJob.id,
              status: activeJob.status,
              type: activeJob.type,
            }
          : null,
        droneLocation,
        etaMinutes,
      },
      jobHistory: jobs.map((j) => ({
        id: j.id,
        status: j.status,
        type: j.type,
        droneId: j.droneId,
        createdAt: j.createdAt,
      })),
    };
  }

  /**
   * Get order by ID (for admin).
   */
  async findById(id: string): Promise<Order | null> {
    return this.orderRepository.findOne({ where: { id } });
  }

  /**
   * Get all orders with optional filter (for admin).
   */
  async findAll(query?: { status?: OrderStatus }): Promise<Order[]> {
    const where: FindOptionsWhere<Order> = {};
    if (query?.status) {
      where.status = query.status;
    }
    return this.orderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Save an order entity.
   */
  async save(order: Order): Promise<Order> {
    return this.orderRepository.save(order);
  }
}
