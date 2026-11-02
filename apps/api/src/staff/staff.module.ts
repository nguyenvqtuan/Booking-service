import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller.js';
import { StaffMembersService } from './staff.service.js';

@Module({
  controllers: [StaffController],
  providers: [StaffMembersService],
  exports: [StaffMembersService],
})
export class StaffModule {}
