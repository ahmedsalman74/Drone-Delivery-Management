import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DroneService } from './drone.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser, JwtPayload } from '../common/decorators';
import { UserType } from '../common/enums';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { CompleteJobDto } from './dto/complete-job.dto';

@ApiTags('Drones')
@ApiBearerAuth()
@Controller('drones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.DRONE)
export class DroneController {
  constructor(private readonly droneService: DroneService) {}

  @Post('jobs/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reserve an open job' })
  @ApiResponse({ status: 200, description: 'Job reserved successfully' })
  @ApiResponse({ status: 404, description: 'No open jobs available' })
  @ApiResponse({ status: 409, description: 'Drone already has an active job' })
  async reserveJob(@CurrentUser() user: JwtPayload) {
    return this.droneService.reserveJob(user.name);
  }

  @Post('jobs/:jobId/grab')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grab an order from a location (origin or broken drone)',
  })
  @ApiResponse({ status: 200, description: 'Order grabbed successfully' })
  @ApiResponse({ status: 400, description: 'Job not in reserved status' })
  async grabOrder(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
  ) {
    return this.droneService.grabOrder(user.name, jobId);
  }

  @Patch('jobs/:jobId/complete')
  @ApiOperation({ summary: 'Mark an order as delivered or failed' })
  @ApiResponse({ status: 200, description: 'Job completed' })
  @ApiResponse({ status: 400, description: 'Job not in progress' })
  async completeJob(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
    @Body() dto: CompleteJobDto,
  ) {
    return this.droneService.completeJob(user.name, jobId, dto.result);
  }

  @Patch('status/broken')
  @ApiOperation({ summary: 'Mark drone as broken (triggers order handoff)' })
  @ApiResponse({
    status: 200,
    description:
      'Drone marked broken. Handoff job created if order was active.',
  })
  async markBroken(@CurrentUser() user: JwtPayload) {
    return this.droneService.markBroken(user.name);
  }

  @Patch('heartbeat')
  @ApiOperation({
    summary: 'Update drone location and receive status heartbeat',
  })
  @ApiResponse({ status: 200, description: 'Heartbeat recorded' })
  async heartbeat(@CurrentUser() user: JwtPayload, @Body() dto: HeartbeatDto) {
    return this.droneService.heartbeat(user.name, dto);
  }

  @Get('current-order')
  @ApiOperation({ summary: 'Get details on the currently assigned order' })
  @ApiResponse({ status: 200, description: 'Current order details' })
  @ApiResponse({ status: 404, description: 'No active order' })
  async getCurrentOrder(@CurrentUser() user: JwtPayload) {
    return this.droneService.getCurrentOrder(user.name);
  }
}
