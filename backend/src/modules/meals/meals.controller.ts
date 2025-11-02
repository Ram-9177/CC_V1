import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MealsService } from './meals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SubmitIntentDto } from './dto/submit-intent.dto';

@ApiTags('Meals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private readonly svc: MealsService) {}

  @UseGuards(RolesGuard)
  @Roles('CHEF','WARDEN_HEAD')
  @Post('menu')
  async createMenu(@Req() req: any, @Body() dto: CreateMenuDto) {
    return this.svc.createMenu(req.user.id, dto);
  }

  @Get('menu')
  async listMenu(@Query('date') date: string, @Query('mealType') mealType?: any) {
    return this.svc.findMenuByDate(date, mealType);
  }

  // Aliases to match frontend client
  @Get('menus')
  async listMenus(@Query('date') date: string, @Query('mealType') mealType?: any) {
    return this.svc.findMenuByDate(date, mealType);
  }

  @UseGuards(RolesGuard)
  @Roles('CHEF','WARDEN_HEAD')
  @Put('menu/:id')
  async updateMenu(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.svc.updateMenu(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('CHEF','WARDEN_HEAD')
  @Put('menus/:id')
  async updateMenuAlias(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.svc.updateMenu(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('CHEF','WARDEN_HEAD')
  @Delete('menu/:id')
  async deleteMenu(@Param('id') id: string) {
    return this.svc.deleteMenu(id);
  }

  @Post('intent')
  async submitIntent(@Req() req: any, @Body() dto: SubmitIntentDto) {
    return this.svc.submitIntent(req.user.id, dto);
  }

  // Accepts { date, mealType, choice } and maps to submitIntent
  @Post('intents')
  async submitIntentByMeal(
    @Req() req: any,
    @Body() body: { date: string; mealType: any; choice: 'YES' | 'NO' | 'SAME' }
  ) {
    const menu = await this.svc.findMenuByDateAndType(body.date, body.mealType);
    if (!menu) throw new Error('Menu not found');
    return this.svc.submitIntent(req.user.id, { menuId: menu.id, intent: body.choice } as any);
  }

  @UseGuards(RolesGuard)
  @Roles('CHEF','WARDEN_HEAD')
  @Get('intents/summary')
  async summary(@Query('date') date: string, @Query('mealType') mealType?: any) {
    return this.svc.intentSummaryByMeal(date, mealType);
  }

  @UseGuards(RolesGuard)
  @Roles('CHEF','WARDEN_HEAD')
  @Get('intents/export')
  async export(@Query('date') date: string, @Query('mealType') mealType?: any) {
    return this.svc.exportIntentCsv(date, mealType);
  }

  // Return the authenticated student's intents for a date keyed by meal type
  @Get('intents/my')
  async myIntents(@Req() req: any, @Query('date') date: string) {
    return this.svc.getIntentsForUserByDate(req.user.id, date);
  }
}
