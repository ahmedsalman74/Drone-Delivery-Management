import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drone } from './entities/drone.entity';
import { JobService } from '../job/job.service';
import { DroneStatus, JobStatus, JobType, OrderStatus } from '../common/enums';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { CompletionResult } from './dto/complete-job.dto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Job } from '../job/entities/job.entity';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class DroneService {
  private readonly logger = new Logger(DroneService.name);

  constructor(
    @InjectRepository(Drone)
    private readonly droneRepository: Repository<Drone>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jobService: JobService,
  ) {}

  /**
   * Find or create a drone by name (auto-registration).
   */
  async findOrCreateByName(name: string): Promise<Drone> {
    let drone = await this.droneRepository.findOne({ where: { name } });
    if (!drone) {
      drone = this.droneRepository.create({ name, status: DroneStatus.IDLE });
      drone = await this.droneRepository.save(drone);
      this.logger.log(`Auto-registered new drone: ${name}`);
    }
    return drone;
  }

  /**
   * Reserve the first available open job.
   * Uses a transaction to ensure atomicity and optimistic locking.
   */
  async reserveJob(droneName: string): Promise<Job> {
    const drone = await this.findOrCreateByName(droneName);

    if (drone.status === DroneStatus.BROKEN) {
      throw new BadRequestException('Drone is broken and cannot reserve jobs');
    }

    // Check if drone already has an active job
    const activeJob = await this.jobService.findActiveJobByDroneId(drone.id);
    if (activeJob) {
      throw new ConflictException('Drone already has an active job');
    }

    return this.dataSource.transaction(async (manager) => {
      // Find the first open job
      const openJob = await manager.findOne(Job, {
        where: { status: JobStatus.OPEN },
        order: { createdAt: 'ASC' },
        relations: ['order'],
      });

      if (!openJob) {
        throw new NotFoundException('No open jobs available');
      }

      // Optimistic lock — if version changed, save will throw
      openJob.droneId = drone.id;
      openJob.status = JobStatus.RESERVED;

      // Mark drone as busy
      drone.status = DroneStatus.BUSY;
      await manager.save(Drone, drone);

      const savedJob = await manager.save(Job, openJob);
      savedJob.drone = drone;
      return savedJob;
    });
  }

  /**
   * Grab an order — drone physically picks it up from origin or broken drone location.
   */
  async grabOrder(droneName: string, jobId: string): Promise<Job> {
    const drone = await this.findOrCreateByName(droneName);
    const job = await this.jobService.findById(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.droneId !== drone.id) {
      throw new BadRequestException('This job is not assigned to your drone');
    }

    if (job.status !== JobStatus.RESERVED) {
      throw new BadRequestException(
        `Cannot grab order: job is in "${job.status}" status, expected "reserved"`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      job.status = JobStatus.IN_PROGRESS;

      // Update order status
      const order = await manager.findOne(Order, { where: { id: job.orderId } });
      if (order) {
        order.status = OrderStatus.IN_PROGRESS;
        await manager.save(Order, order);
      }

      return manager.save(Job, job);
    });
  }

  /**
   * Complete a job — mark as delivered or failed.
   */
  async completeJob(
    droneName: string,
    jobId: string,
    result: CompletionResult,
  ): Promise<Job> {
    const drone = await this.findOrCreateByName(droneName);
    const job = await this.jobService.findById(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.droneId !== drone.id) {
      throw new BadRequestException('This job is not assigned to your drone');
    }

    if (job.status !== JobStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete job: job is in "${job.status}" status, expected "in_progress"`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      if (result === CompletionResult.DELIVERED) {
        job.status = JobStatus.COMPLETED;
        const order = await manager.findOne(Order, { where: { id: job.orderId } });
        if (order) {
          order.status = OrderStatus.DELIVERED;
          await manager.save(Order, order);
        }
      } else {
        job.status = JobStatus.FAILED;
        const order = await manager.findOne(Order, { where: { id: job.orderId } });
        if (order) {
          order.status = OrderStatus.FAILED;
          await manager.save(Order, order);
        }
      }

      // Drone becomes idle
      drone.status = DroneStatus.IDLE;
      await manager.save(Drone, drone);

      return manager.save(Job, job);
    });
  }

  /**
   * Mark drone as broken — creates handoff job for current order.
   */
  async markBroken(droneName: string): Promise<{ drone: Drone; handoffJob?: Job }> {
    const drone = await this.findOrCreateByName(droneName);

    if (drone.status === DroneStatus.BROKEN) {
      throw new BadRequestException('Drone is already marked as broken');
    }

    return this.dataSource.transaction(async (manager) => {
      drone.status = DroneStatus.BROKEN;
      await manager.save(Drone, drone);

      // Find active job for this drone
      const activeJob = await manager.findOne(Job, {
        where: [
          { droneId: drone.id, status: JobStatus.RESERVED },
          { droneId: drone.id, status: JobStatus.IN_PROGRESS },
        ],
        relations: ['order'],
      });

      let handoffJob: Job | undefined;

      if (activeJob) {
        // Mark current job as failed
        activeJob.status = JobStatus.FAILED;
        await manager.save(Job, activeJob);

        // Mark order as pending handoff
        const order = await manager.findOne(Order, { where: { id: activeJob.orderId } });
        if (order) {
          order.status = OrderStatus.PENDING_HANDOFF;
          await manager.save(Order, order);

          // Create handoff job — pickup is at the broken drone's location
          handoffJob = manager.create(Job, {
            orderId: order.id,
            type: JobType.HANDOFF,
            status: JobStatus.OPEN,
            pickupLat: drone.latitude ?? order.originLat,
            pickupLng: drone.longitude ?? order.originLng,
            dropoffLat: order.destLat,
            dropoffLng: order.destLng,
          });
          handoffJob = await manager.save(Job, handoffJob);
        }
      }

      return { drone, handoffJob };
    });
  }

  /**
   * Heartbeat — update drone location and return status.
   */
  async heartbeat(
    droneName: string,
    dto: HeartbeatDto,
  ): Promise<{
    droneId: string;
    status: DroneStatus;
    latitude: number;
    longitude: number;
    lastHeartbeat: Date;
    activeJob: Job | null;
  }> {
    const drone = await this.findOrCreateByName(droneName);

    drone.latitude = dto.latitude;
    drone.longitude = dto.longitude;
    drone.lastHeartbeat = new Date();
    await this.droneRepository.save(drone);

    const activeJob = await this.jobService.findActiveJobByDroneId(drone.id);

    return {
      droneId: drone.id,
      status: drone.status,
      latitude: drone.latitude,
      longitude: drone.longitude,
      lastHeartbeat: drone.lastHeartbeat,
      activeJob,
    };
  }

  /**
   * Get the order currently assigned to the drone.
   */
  async getCurrentOrder(droneName: string) {
    const drone = await this.findOrCreateByName(droneName);
    const activeJob = await this.jobService.findActiveJobByDroneId(drone.id);

    if (!activeJob || !activeJob.order) {
      throw new NotFoundException('No active order assigned to this drone');
    }

    return {
      order: activeJob.order,
      job: {
        id: activeJob.id,
        status: activeJob.status,
        type: activeJob.type,
        pickupLat: activeJob.pickupLat,
        pickupLng: activeJob.pickupLng,
        dropoffLat: activeJob.dropoffLat,
        dropoffLng: activeJob.dropoffLng,
      },
      drone: {
        id: drone.id,
        name: drone.name,
        latitude: drone.latitude,
        longitude: drone.longitude,
      },
    };
  }

  /**
   * Get all drones (for admin).
   */
  async findAll(): Promise<Drone[]> {
    return this.droneRepository.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Find drone by ID.
   */
  async findById(id: string): Promise<Drone | null> {
    return this.droneRepository.findOne({ where: { id } });
  }

  /**
   * Save a drone entity.
   */
  async save(drone: Drone): Promise<Drone> {
    return this.droneRepository.save(drone);
  }
}
