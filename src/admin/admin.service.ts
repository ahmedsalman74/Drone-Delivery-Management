import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Order } from '../order/entities/order.entity';
import { Drone } from '../drone/entities/drone.entity';
import { Job } from '../job/entities/job.entity';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import { UpdateOrderLocationDto } from './dto/update-order-location.dto';
import { DroneStatusUpdate } from './dto/update-drone-status.dto';
import { OrderStatus, DroneStatus, JobStatus, JobType } from '../common/enums';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: MongoRepository<Order>,
    @InjectRepository(Drone)
    private readonly droneRepository: MongoRepository<Drone>,
    @InjectRepository(Job)
    private readonly jobRepository: MongoRepository<Job>,
  ) {}

  /**
   * Get orders in bulk with pagination and optional status filter.
   */
  async getOrdersBulk(query: AdminOrderQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order origin or destination.
   * Not allowed for DELIVERED or WITHDRAWN orders.
   */
  async updateOrderLocation(
    orderId: string,
    dto: UpdateOrderLocationDto,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.WITHDRAWN
    ) {
      throw new BadRequestException(
        `Cannot update location for "${order.status}" orders`,
      );
    }

    if (dto.originLat !== undefined) order.originLat = dto.originLat;
    if (dto.originLng !== undefined) order.originLng = dto.originLng;
    if (dto.destLat !== undefined) order.destLat = dto.destLat;
    if (dto.destLng !== undefined) order.destLng = dto.destLng;

    return this.orderRepository.save(order);
  }

  /**
   * Get all drones.
   */
  async getDrones(): Promise<Drone[]> {
    return this.droneRepository.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Mark a drone as broken or fixed.
   *
   * Broken: marks the drone's active job as FAILED, sets the order to
   * PENDING_HANDOFF, and creates a new HANDOFF job at the drone's last
   * known position so another drone can pick up the goods.
   *
   * Fixed: sets the drone back to IDLE. Per the spec, any existing OPEN
   * handoff job is NOT cancelled — once a handoff has been requested, its
   * lifecycle continues independently to avoid leaving an order stranded.
   */
  async updateDroneStatus(
    droneId: string,
    status: DroneStatusUpdate,
  ): Promise<{ drone: Drone; handoffJob: Job | undefined }> {
    const drone = await this.droneRepository.findOne({
      where: { id: droneId },
    });

    if (!drone) {
      throw new NotFoundException('Drone not found');
    }

    if (status === DroneStatusUpdate.BROKEN) {
      if (drone.status === DroneStatus.BROKEN) {
        throw new BadRequestException('Drone is already broken');
      }

      drone.status = DroneStatus.BROKEN;
      await this.droneRepository.save(drone);

      // Find active job — check RESERVED first, then IN_PROGRESS
      let activeJob = await this.jobRepository.findOne({
        where: { droneId: drone.id, status: JobStatus.RESERVED },
      });
      if (!activeJob) {
        activeJob = await this.jobRepository.findOne({
          where: { droneId: drone.id, status: JobStatus.IN_PROGRESS },
        });
      }

      let handoffJob: Job | undefined;

      if (activeJob) {
        activeJob.status = JobStatus.FAILED;
        await this.jobRepository.save(activeJob);

        const order = await this.orderRepository.findOne({
          where: { id: activeJob.orderId },
        });

        if (!order) {
          throw new NotFoundException(
            `Order ${activeJob.orderId} not found for active job ${activeJob.id}`,
          );
        }

        if (drone.latitude == null || drone.longitude == null) {
          throw new BadRequestException(
            'Drone position is unknown; cannot create handoff job',
          );
        }

        order.status = OrderStatus.PENDING_HANDOFF;
        await this.orderRepository.save(order);

        const newJob = this.jobRepository.create({
          id: randomUUID(),
          orderId: order.id,
          type: JobType.HANDOFF,
          status: JobStatus.OPEN,
          pickupLat: drone.latitude,
          pickupLng: drone.longitude,
          dropoffLat: order.destLat,
          dropoffLng: order.destLng,
          version: 1,
        });
        handoffJob = await this.jobRepository.save(newJob);
      }

      return { drone, handoffJob };
    } else {
      // FIXED — set to IDLE, handoff job stays open (see JSDoc above)
      if (drone.status !== DroneStatus.BROKEN) {
        throw new BadRequestException(
          'Only broken drones can be marked as fixed',
        );
      }

      drone.status = DroneStatus.IDLE;
      await this.droneRepository.save(drone);
      return { drone, handoffJob: undefined };
    }
  }
}
