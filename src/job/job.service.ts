import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Job } from './entities/job.entity';
import { Order } from '../order/entities/order.entity';
import { Drone } from '../drone/entities/drone.entity';
import { JobStatus, JobType } from '../common/enums';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: MongoRepository<Job>,
    @InjectRepository(Order)
    private readonly orderRepository: MongoRepository<Order>,
    @InjectRepository(Drone)
    private readonly droneRepository: MongoRepository<Drone>,
  ) {}

  /**
   * Create a new job.
   */
  async createJob(data: {
    orderId: string;
    type: JobType;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }): Promise<Job> {
    const job = this.jobRepository.create({
      id: randomUUID(),
      ...data,
      status: JobStatus.OPEN,
      version: 1,
    });
    return this.jobRepository.save(job);
  }

  /**
   * Find all open jobs, sorted by creation date (ascending).
   * Manually populates the order relation.
   */
  async findOpenJobs(): Promise<Job[]> {
    const jobs = await this.jobRepository.find({
      where: { status: JobStatus.OPEN },
      order: { createdAt: 'ASC' },
    });

    // Populate orders
    for (const job of jobs) {
      const order = await this.orderRepository.findOne({
        where: { id: job.orderId },
      });
      if (order) job.order = order;
    }

    return jobs;
  }

  /**
   * Find a job by its UUID, populating order and drone.
   */
  async findById(id: string): Promise<Job | null> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) return null;

    // Populate order
    const order = await this.orderRepository.findOne({
      where: { id: job.orderId },
    });
    if (order) job.order = order;

    // Populate drone
    if (job.droneId) {
      const drone = await this.droneRepository.findOne({
        where: { id: job.droneId },
      });
      if (drone) job.drone = drone;
    }

    return job;
  }

  /**
   * Find the active job (reserved or in_progress) for a drone.
   */
  async findActiveJobByDroneId(droneId: string): Promise<Job | null> {
    // Try RESERVED first
    let job = await this.jobRepository.findOne({
      where: { droneId, status: JobStatus.RESERVED },
    });

    // Try IN_PROGRESS
    if (!job) {
      job = await this.jobRepository.findOne({
        where: { droneId, status: JobStatus.IN_PROGRESS },
      });
    }

    if (!job) return null;

    // Populate order
    const order = await this.orderRepository.findOne({
      where: { id: job.orderId },
    });
    if (order) job.order = order;

    // Populate drone
    if (job.droneId) {
      const drone = await this.droneRepository.findOne({
        where: { id: job.droneId },
      });
      if (drone) job.drone = drone;
    }

    return job;
  }

  /**
   * Save a job entity.
   */
  async save(job: Job): Promise<Job> {
    return this.jobRepository.save(job);
  }

  /**
   * Find all jobs for an order, populating drones.
   */
  async findJobsByOrderId(orderId: string): Promise<Job[]> {
    const jobs = await this.jobRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    // Populate drones
    for (const job of jobs) {
      if (job.droneId) {
        const drone = await this.droneRepository.findOne({
          where: { id: job.droneId },
        });
        if (drone) job.drone = drone;
      }
    }

    return jobs;
  }
}
