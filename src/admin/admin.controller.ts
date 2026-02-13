import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { UserType } from '../common/enums';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import { UpdateOrderLocationDto } from './dto/update-order-location.dto';
import { UpdateDroneStatusDto } from './dto/update-drone-status.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Get orders in bulk (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated list of orders' })
  async getOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.getOrdersBulk(query);
  }

  @Patch('orders/:id/location')
  @ApiOperation({ summary: 'Change origin or destination of an order' })
  @ApiResponse({ status: 200, description: 'Order location updated' })
  @ApiResponse({
    status: 400,
    description: 'Cannot update delivered/withdrawn orders',
  })
  async updateOrderLocation(
    @Param('id') id: string,
    @Body() dto: UpdateOrderLocationDto,
  ) {
    return this.adminService.updateOrderLocation(id, dto);
  }

  @Get('drones')
  @ApiOperation({ summary: 'Get list of all drones' })
  @ApiResponse({ status: 200, description: 'List of drones' })
  async getDrones() {
    return this.adminService.getDrones();
  }

  @Patch('drones/:id/status')
  @ApiOperation({ summary: 'Mark a drone as broken or fixed' })
  @ApiResponse({ status: 200, description: 'Drone status updated' })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  async updateDroneStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDroneStatusDto,
  ) {
    return this.adminService.updateDroneStatus(id, dto.status);
  }
}
