import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Drone } from './entities/drone.entity';
import { Job } from '../job/entities/job.entity';
import { Order } from '../order/entities/order.entity';
import { JobService } from '../job/job.service';
import { DroneStatus, JobStatus, JobType, OrderStatus } from '../common/enums';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { CompletionResult } from './dto/complete-job.dto';

@Injectable()
export class DroneService {
  private readonly logger = new Logger(DroneService.name);

  constructor(
    @InjectRepository(Drone)
    private readonly droneRepository: MongoRepository<Drone>,
    @InjectRepository(Job)
    private readonly jobRepository: MongoRepository<Job>,
    @InjectRepository(Order)
    private readonly orderRepository: MongoRepository<Order>,
    private readonly jobService: JobService,
  ) {}

  /**
   * Find or create a drone by name (auto-registration).
   */
  async findOrCreateByName(name: string): Promise<Drone> {
    let drone = await this.droneRepository.findOne({ where: { name } });
    if (!drone) {
      drone = this.droneRepository.create({
        id: randomUUID(),
        name,
        status: DroneStatus.IDLE,
      });
      drone = await this.droneRepository.save(drone);
      this.logger.log(`Auto-registered new drone: ${name}`);
    }
    return drone;
  }

  /**
   * Reserve the first available open job.
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

    // Find the first open job
    const openJob = await this.jobRepository.findOne({
      where: { status: JobStatus.OPEN },
      order: { createdAt: 'ASC' },
    });

    if (!openJob) {
      throw new NotFoundException('No open jobs available');
    }

    // Reserve the job
    openJob.droneId = drone.id;
    openJob.status = JobStatus.RESERVED;
    openJob.version = (openJob.version || 1) + 1;

    // Mark drone as busy
    drone.status = DroneStatus.BUSY;
    await this.droneRepository.save(drone);

    const savedJob = await this.jobRepository.save(openJob);
    savedJob.drone = drone;
    return savedJob;
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

    job.status = JobStatus.IN_PROGRESS;

    // Update order status
    const order = await this.orderRepository.findOne({
      where: { id: job.orderId },
    });
    if (order) {
      order.status = OrderStatus.IN_PROGRESS;
      await this.orderRepository.save(order);
    }

    return this.jobRepository.save(job);
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

    if (result === CompletionResult.DELIVERED) {
      job.status = JobStatus.COMPLETED;
      const order = await this.orderRepository.findOne({
        where: { id: job.orderId },
      });
      if (order) {
        order.status = OrderStatus.DELIVERED;
        await this.orderRepository.save(order);
      }
    } else {
      job.status = JobStatus.FAILED;
      const order = await this.orderRepository.findOne({
        where: { id: job.orderId },
      });
      if (order) {
        order.status = OrderStatus.FAILED;
        await this.orderRepository.save(order);
      }
    }

    // Drone becomes idle
    drone.status = DroneStatus.IDLE;
    await this.droneRepository.save(drone);

    return this.jobRepository.save(job);
  }

  /**
   * Mark drone as broken — creates handoff job for current order.
   */
  async markBroken(
    droneName: string,
  ): Promise<{ drone: Drone; handoffJob?: Job }> {
    const drone = await this.findOrCreateByName(droneName);

    if (drone.status === DroneStatus.BROKEN) {
      throw new BadRequestException('Drone is already marked as broken');
    }

    drone.status = DroneStatus.BROKEN;
    await this.droneRepository.save(drone);

    // Find active job for this drone
    const activeJob = await this.jobService.findActiveJobByDroneId(drone.id);

    let handoffJob: Job | undefined;

    if (activeJob) {
      // Mark current job as failed
      activeJob.status = JobStatus.FAILED;
      await this.jobRepository.save(activeJob);

      // Mark order as pending handoff
      const order = await this.orderRepository.findOne({
        where: { id: activeJob.orderId },
      });
      if (order) {
        order.status = OrderStatus.PENDING_HANDOFF;
        await this.orderRepository.save(order);

        // Create handoff job — pickup is at the broken drone's location
        const newJob = this.jobRepository.create({
          id: randomUUID(),
          orderId: order.id,
          type: JobType.HANDOFF,
          status: JobStatus.OPEN,
          pickupLat: drone.latitude ?? order.originLat,
          pickupLng: drone.longitude ?? order.originLng,
          dropoffLat: order.destLat,
          dropoffLng: order.destLng,
          version: 1,
        });
        handoffJob = await this.jobRepository.save(newJob);
      }
    }

    return { drone, handoffJob };
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
