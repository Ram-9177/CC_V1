import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealMenu, MealType } from './entities/meal-menu.entity';
import { MealIntent, MealIntentStatus } from './entities/meal-intent.entity';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SubmitIntentDto } from './dto/submit-intent.dto';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../notifications/notification.service';
import { Cron } from '@nestjs/schedule';
import { GatePass, GatePassStatus } from '../gate-passes/entities/gate-pass.entity';
import { EventsService } from '../events/events.service';

@Injectable()
export class MealsService {
  constructor(
    @InjectRepository(MealMenu) private readonly menuRepo: Repository<MealMenu>,
    @InjectRepository(MealIntent) private readonly intentRepo: Repository<MealIntent>,
    @InjectRepository(GatePass) private readonly gatePassRepo: Repository<GatePass>,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationService,
    private readonly events: EventsService
  ) {}

  async createMenu(chefId: string, dto: CreateMenuDto) {
  const chef = await this.usersService.findById(chefId);
  if (!chef) throw new Error('Chef not found');
    const entity = this.menuRepo.create({ ...dto, createdBy: chef as any });
    const saved = await this.menuRepo.save(entity);
    // emit event for dashboards (to CHEF and WARDEN_HEAD roles)
    this.events.emitToRoles(['CHEF', 'WARDEN_HEAD'], 'meals:menu-created', { id: saved.id, date: saved.date, mealType: saved.mealType });
    return saved;
  }

  async updateMenu(id: string, dto: UpdateMenuDto) {
    await this.menuRepo.update({ id }, dto as any);
    return this.menuRepo.findOne({ where: { id } });
  }

  async deleteMenu(id: string) {
    await this.menuRepo.delete({ id });
    return { deleted: true };
  }

  async findMenuByDate(date: string, mealType?: MealType) {
    const qb = this.menuRepo.createQueryBuilder('m').where('m.date = :date', { date });
    if (mealType) qb.andWhere('m.mealType = :mealType', { mealType });
    return qb.getMany();
  }

  async findMenuByDateAndType(date: string, mealType: MealType) {
    return this.menuRepo.findOne({ where: { date, mealType } as any });
  }

  async submitIntent(studentId: string, dto: SubmitIntentDto) {
  const student = await this.usersService.findById(studentId);
  if (!student) throw new Error('Student not found');
    const menu = await this.menuRepo.findOne({ where: { id: dto.menuId } });
    if (!menu) throw new Error('Menu not found');
  let intent = await this.intentRepo.findOne({ where: { menu: { id: menu.id } as any, student: { id: student.id } as any } });
  if (!intent) intent = this.intentRepo.create({ menu: menu as any, student: student as any, intent: dto.intent });
    else intent.intent = dto.intent;
    const saved = await this.intentRepo.save(intent);
    // emit event for dashboards/chef (to CHEF and WARDEN_HEAD roles) with refreshed summary
    const counts = await this.computeCountsForMenuType(menu.date, menu.mealType);
    this.events.emitToRoles(['CHEF', 'WARDEN_HEAD'], 'meals:intent-updated', {
      menuId: menu.id,
      studentId: student.id,
      intent: saved.intent,
      mealType: menu.mealType,
      ...counts,
    });
    return saved;
  }

  async intentSummary(date: string, mealType?: MealType) {
    const qb = this.intentRepo
      .createQueryBuilder('i')
      .leftJoin('i.menu', 'm')
      .where('m.date = :date', { date });
    if (mealType) qb.andWhere('m.mealType = :mealType', { mealType });
    const rows = await qb
      .select('i.intent', 'intent')
      .addSelect('COUNT(*)', 'count')
      .groupBy('i.intent')
      .getRawMany<{ intent: MealIntentStatus; count: string }>();
    const byIntent: Record<string, number> = {};
    rows.forEach((r) => (byIntent[r.intent] = Number(r.count)));
    return { byIntent };
  }

  // Returns per-meal breakdown to match frontend expectations
  async intentSummaryByMeal(date: string, mealType?: MealType) {
    const result: Record<MealType, { yes: number; same: number; no: number; outside: number }> = {
      BREAKFAST: { yes: 0, same: 0, no: 0, outside: 0 },
      LUNCH: { yes: 0, same: 0, no: 0, outside: 0 },
      DINNER: { yes: 0, same: 0, no: 0, outside: 0 },
    } as any;
    const menus = await this.findMenuByDate(date, mealType);
    const types = new Set<MealType>(menus.map((m) => m.mealType));
    for (const t of types) {
      result[t] = await this.computeCountsForMenuType(date, t);
    }
    return result;
  }

  private async computeCountsForMenuType(date: string, mealType: MealType) {
    const qb = this.intentRepo
      .createQueryBuilder('i')
      .leftJoin('i.menu', 'm')
      .where('m.date = :date', { date })
      .andWhere('m.mealType = :mealType', { mealType });
    const rows = await qb
      .select('i.intent', 'intent')
      .addSelect('COUNT(*)', 'count')
      .groupBy('i.intent')
      .getRawMany<{ intent: MealIntentStatus; count: string }>();
    const outside = await this.intentRepo
      .createQueryBuilder('i')
      .leftJoin('i.menu', 'm')
      .where('m.date = :date', { date })
      .andWhere('m.mealType = :mealType', { mealType })
      .andWhere('i.autoExcluded = :auto', { auto: true })
      .getCount();
    const map: any = { YES: 0, SAME: 0, NO: 0, NO_RESPONSE: 0 };
    rows.forEach((r) => (map[r.intent] = Number(r.count)));
    return {
      yes: map.YES || 0,
      same: map.SAME || 0,
      no: map.NO || 0,
      outside,
    };
  }

  async exportIntentCsv(date: string, mealType?: MealType) {
    const summary = await this.intentSummary(date, mealType);
    const header = 'intent,count\n';
    const intents = ['YES','NO','SAME','NO_RESPONSE'];
    const rows = intents.map((k) => `${k},${summary.byIntent[k] || 0}`).join('\n');
    return header + rows + '\n';
  }

  async getIntentsForUserByDate(userId: string, date: string) {
    const intents = await this.intentRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.menu', 'm')
      .leftJoin('i.student', 's')
      .where('s.id = :userId', { userId })
      .andWhere('m.date = :date', { date })
      .getMany();
    const result: Partial<Record<MealType, MealIntentStatus>> = {};
    intents.forEach((i) => {
      result[(i.menu as any).mealType as MealType] = i.intent;
    });
    return result;
  }

  // Daily reminder at 6 PM (server time)
  // Note: In real usage, prefer timezones or cron TZ env var.
  // Here we broadcast a topic reminder to students to submit intents.
  @Cron('0 18 * * *')
  async handleDailyReminderCron() {
    // Only send reminders when there are menus (i.e., not a holiday) and exclude students who are on outpass
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

    // Check menus for tomorrow (skip if none → likely holiday)
    const menus = await this.findMenuByDate(dateStr);
    if (!menus?.length) return; // treat as holiday → do not notify
    // If any menu is marked as closed, suppress notifications for students
    if (menus.some((m: any) => !!m.closed)) return;

    // Build exclusion set: students with ACTIVE gate pass overlapping tomorrow
    const start = new Date(dateStr + 'T00:00:00.000Z');
    const end = new Date(dateStr + 'T23:59:59.999Z');
    const activePasses = await this.gatePassRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.student', 'student')
      .where('p.status = :status', { status: GatePassStatus.ACTIVE })
      .andWhere('p.fromDate <= :end', { end })
      .andWhere('p.toDate >= :start', { start })
      .getMany();
    const excludedIds = new Set(activePasses.map((p) => (p as any).student?.id).filter(Boolean));

    // Notify only active students with device tokens and not excluded
    const students = await this.usersService.listActiveStudentsWithFcmTokens();
    const uiBase = process.env.FRONTEND_URL || '';
    for (const s of students) {
      if (!s.fcmToken) continue;
      if (excludedIds.has(s.id)) continue; // outpass → no notification
      // Send one actionable notification per menu to allow quick reply outside the app
      for (const menu of menus) {
        try {
          await this.notifications.sendToDevice(s.fcmToken, {
            title: `${menu.mealType} intent for ${dateStr}`,
            body: 'Tap Yes/No below or open to review the menu.',
            data: {
              type: 'MEAL_INTENT_REQUEST',
              date: dateStr,
              mealType: menu.mealType,
              menuId: menu.id,
              // Optional UI deep-link for when user opens the notification
              url: uiBase ? `${uiBase.replace(/\/$/, '')}/student/meals?date=${dateStr}` : '/student/meals?date=' + dateStr,
            }
          } as any);
        } catch {
          // errors are logged/audited inside NotificationService
        }
      }
    }
  }

  // Auto-exclude students outside hostel (active gate pass covering the meal date)
  @Cron('0 21 * * *')
  async handleAutoExcludeCron() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    await this.autoExcludeForDate(dateStr);
  }

  async autoExcludeForDate(date: string, mealType?: MealType) {
    // Find menus for the date (optionally filter by mealType)
    const menus = await this.findMenuByDate(date, mealType);
    if (!menus.length) return { processed: 0 };

    // Find students with ACTIVE passes that overlap the date
    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');
    const active = await this.gatePassRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: GatePassStatus.ACTIVE })
      .andWhere('p.fromDate <= :end', { end })
      .andWhere('p.toDate >= :start', { start })
      .leftJoinAndSelect('p.student', 'student')
      .getMany();

    let processed = 0;
    for (const menu of menus) {
      for (const p of active) {
        // Upsert intent as NO with autoExcluded=true
        let intent = await this.intentRepo.findOne({ where: { menu: { id: menu.id } as any, student: { id: p.student.id } as any } });
        if (!intent) intent = this.intentRepo.create({ menu: menu as any, student: p.student as any, intent: MealIntentStatus.NO, autoExcluded: true });
        else {
          intent.intent = MealIntentStatus.NO;
          intent.autoExcluded = true;
        }
        await this.intentRepo.save(intent);
        processed++;
      }
    }
    return { processed };
  }
}
