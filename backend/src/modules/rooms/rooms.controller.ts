import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException, UploadedFile, UseInterceptors, Res, HttpStatus } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from '../users/users.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly users: UsersService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN_HEAD','SUPER_ADMIN')
  @Post('upsert')
  @ApiOperation({ summary: 'Create or update a room by block and number' })
  async upsert(@Body() body: { block: string; number: string; floor?: string; capacity?: number }) {
    return this.rooms.upsertRoom(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get()
  @ApiOperation({ summary: 'List rooms with occupancy counts' })
  async list(@Query() query: { block?: string; search?: string }) {
    return this.rooms.listRooms(query);
  }

  // Place fixed export routes BEFORE parameterized ':id' route to avoid conflicts (e.g., '/rooms/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get('export')
  @ApiOperation({ summary: 'Export all rooms with occupancy summary as CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string', example: 'id,block,number,floor,capacity,occupants,available\n...' } })
  async exportAll(@Res() res: any) {
    const csv = await this.rooms.exportAllRoomsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rooms-occupancy.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get('occupants/export')
  @ApiOperation({ summary: 'Export all room occupants (denormalized roster) as CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string', example: 'roomId,block,number,floor,capacity,hallticket,firstName,lastName,bedLabel\\n...' } })
  async exportAllOccupants(@Res() res: any) {
    const csv = await this.rooms.exportAllOccupantsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rooms-occupants.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get(':id')
  @ApiOperation({ summary: 'Get a room with its occupants' })
  async get(@Param('id') id: string) {
    return this.rooms.getRoom(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get(':id/occupants/export')
  @ApiOperation({ summary: 'Export current occupants of a room as CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string', example: 'hallticket,firstName,lastName,bedLabel,hostelBlock,roomNumber\n...' } })
  async exportOccupants(@Param('id') id: string, @Res() res: any) {
    const csv = await this.rooms.exportRoomOccupantsCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="room-${id}-occupants.csv"`);
    res.status(HttpStatus.OK).send(csv);
  }


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign a student to a room (optional bed label)' })
  async assign(
    @Param('id') id: string,
    @Body() body: { hallticket: string; bedLabel?: string }
  ) {
    const { hallticket, bedLabel } = body || ({} as any);
    if (!hallticket) throw new BadRequestException('hallticket is required');
    const room = await this.rooms.getRoom(id).then(r => r as any as { id: string; block: string; number: string });
    const user = await this.users.findByHallticket(hallticket);
    if (!user) throw new BadRequestException('User not found');
    return this.rooms.assignUserToRoom({ user, room: room as any, bedLabel });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Post(':id/unassign')
  @ApiOperation({ summary: 'Unassign a student from a room' })
  async unassign(@Param('id') id: string, @Body() body: { hallticket: string }) {
    const { hallticket } = body || ({} as any);
    if (!hallticket) throw new BadRequestException('hallticket is required');
    const user = await this.users.findByHallticket(hallticket);
    if (!user) throw new BadRequestException('User not found');
    if (user.roomId !== id) throw new BadRequestException('User not in this room');
    return this.rooms.unassignUserFromRoom(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Post('bulk-assign')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk assign students to rooms via CSV (hallticket, block, number, bedLabel, floor?)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
    description: 'CSV file with columns: hallticket, block, number, bedLabel (optional), floor (optional)'
  })
  async bulkAssign(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { assigned: 0, failed: 0, errors: [{ error: 'No file uploaded' }] };
    return this.rooms.bulkAssignFromCsv(file.buffer);
  }
}
