import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
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
import { OrderService } from './order.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser, JwtPayload } from '../common/decorators';
import { UserType } from '../common/enums';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

@ApiTags('Orders (Enduser)')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ENDUSER)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new delivery order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(user.name, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw an order (only if not yet picked up)' })
  @ApiResponse({ status: 200, description: 'Order withdrawn' })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be withdrawn (already picked up)',
  })
  async withdrawOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.orderService.withdrawOrder(id, user.name);
  }

  @Get()
  @ApiOperation({ summary: 'List your submitted orders' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  async getOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: OrderQueryDto,
  ) {
    return this.orderService.getOrders(user.name, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order details including progress, location, and ETA',
  })
  @ApiResponse({ status: 200, description: 'Order details with progress' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.orderService.getOrderDetail(id, user.name);
  }
}
