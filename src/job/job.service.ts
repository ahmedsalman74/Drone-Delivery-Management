import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobStatus, JobType } from '../common/enums';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  async createJob(data: {
    orderId: string;
    type: JobType;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }): Promise<Job> {
    const job = this.jobRepository.create({
      ...data,
      status: JobStatus.OPEN,
    });
    return this.jobRepository.save(job);
  }

  async findOpenJobs(): Promise<Job[]> {
    return this.jobRepository.find({
      where: { status: JobStatus.OPEN },
      order: { createdAt: 'ASC' },
      relations: ['order'],
    });
  }

  async findById(id: string): Promise<Job | null> {
    return this.jobRepository.findOne({
      where: { id },
      relations: ['order', 'drone'],
    });
  }

  async findActiveJobByDroneId(droneId: string): Promise<Job | null> {
    return this.jobRepository.findOne({
      where: [
        { droneId, status: JobStatus.RESERVED },
        { droneId, status: JobStatus.IN_PROGRESS },
      ],
      relations: ['order', 'drone'],
    });
  }

  async save(job: Job): Promise<Job> {
    return this.jobRepository.save(job);
  }

  async findJobsByOrderId(orderId: string): Promise<Job[]> {
    return this.jobRepository.find({
      where: { orderId },
      relations: ['drone'],
      order: { createdAt: 'DESC' },
    });
  }
}
