import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  getAll(@Query('search') search: string, @Query('page') page: string) {
    return this.customersService.getAll(search, Number(page) || 1);
  }

  @Get('history/:conversationId')
  getHistory(@Param('conversationId') id: string) {
    return this.customersService.getHistory(id);
  }
}
