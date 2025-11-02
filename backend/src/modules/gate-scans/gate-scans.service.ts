import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GateScan, ScanType } from './entities/gate-scan.entity';
import { GatePass } from '../gate-passes/entities/gate-pass.entity';
import { UsersService } from '../users/users.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class GateScansService {
  constructor(
    @InjectRepository(GateScan)
    private readonly scansRepo: Repository<GateScan>,
    @InjectRepository(GatePass)
    private readonly passesRepo: Repository<GatePass>,
    private readonly usersService: UsersService,
    @Optional() private readonly eventsService?: EventsService
  ) {}

  async create(scannedById: string, dto: { gatePassId: string; scanType: ScanType; location?: string; notes?: string }) {
    const pass = await this.passesRepo.findOne({ where: { id: dto.gatePassId } });
    if (!pass) throw new NotFoundException('Gate pass not found');
    const user = await this.usersService.findById(scannedById);
    if (!user) throw new NotFoundException('Scanner user not found');

    // create scan
    const scan = this.scansRepo.create({ gatePass: pass, scannedBy: user as any, scanType: dto.scanType, location: dto.location, notes: dto.notes });
    const saved = await this.scansRepo.save(scan);

    // update lastActivityAt on pass
    pass.lastActivityAt = new Date();
    await this.passesRepo.save(pass);

    // emit via centralized EventsService if available
    try {
      if (this.eventsService) {
        const payload = { scan: saved, gatePass: pass };
        this.eventsService.emitToRoles(['GATEMAN','WARDEN','WARDEN_HEAD'], 'gate-pass:scanned', payload);
        if ((pass as any).student?.id) this.eventsService.emitToRoom(`user:${(pass as any).student.id}`, 'gate-pass:scanned', payload);
      }
    } catch {
      // ignore emit errors
    }

    return { ...saved, valid: true };
  }

  async list(query: any) {
    const qb = this.scansRepo.createQueryBuilder('s').leftJoinAndSelect('s.gatePass', 'p').leftJoinAndSelect('s.scannedBy', 'u');
    if (query.scanType) qb.where('s.scanType = :t', { t: query.scanType });
    if (query.date) qb.andWhere('DATE(s.scannedAt) = :d', { d: query.date });
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
