import { Body, Controller, Get, Param, Post, Query, Put, Delete, UploadedFile, UseInterceptors, Res, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from './entities/user.entity';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  async create(@Req() req: any, @Body() dto: CreateUserDto) {
    const actorRole: UserRole = req.user?.role as UserRole;
    const targetRole: UserRole = (dto.role as any) || UserRole.STUDENT;
    this.usersService.ensureCreationAllowed(actorRole, targetRole);
    const user = await this.usersService.create({ ...dto, role: targetRole } as any);
    return { id: user.id, hallticket: user.hallticket };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  async list(@Query() query: QueryUsersDto) {
    return this.usersService.listUsers(query as any);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string', example: 'hallticket,firstName,lastName,role,email,phone,hostelBlock,roomNumber,bedLabel\\n...' } })
  async export(@Query() query: QueryUsersDto, @Res() res: Response) {
    const csv = await this.usersService.exportUsers(query as any);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  async search(@Query('query') query: string, @Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 10;
    return this.usersService.searchLite({ q: query, limit: l });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async get(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto as any);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Post('bulk-import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
    description: 'CSV file with columns: hallticket, firstName, lastName, role (optional), email (optional), phone (optional), hostelBlock (optional), roomNumber (optional), bedLabel (optional)'
  })
  async bulkImport(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) return { imported: 0, failed: 0, errors: [{ error: 'No file uploaded' }] };
    const actorRole: UserRole = req.user?.role as UserRole;
    return this.usersService.bulkImportFromCsv(file.buffer, actorRole);
  }
}
