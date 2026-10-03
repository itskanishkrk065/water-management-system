import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../common/enums';

@Injectable()
export class ApplicationClockService {
  private readonly logger = new Logger(ApplicationClockService.name);
  private isRollbackState = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Returns current application Date/time.
   */
  now(): Date {
    return new Date();
  }

  /**
   * Returns today at 00:00:00.000 local time.
   */
  today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Returns current billing period code formatted as YYYY-MM (e.g., '2026-10').
   */
  currentBillingPeriod(): string {
    return this.getBillingPeriod(this.now());
  }

  /**
   * Derives YYYY-MM period code for any given Date.
   */
  getBillingPeriod(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Returns period start and end boundaries for a YYYY-MM period code.
   */
  getBillingPeriodDates(periodCode: string): { periodStart: Date; periodEnd: Date } {
    const parts = periodCode.split('-');
    if (parts.length < 2) {
      throw new BadRequestException(`Invalid billing period code '${periodCode}'. Expected YYYY-MM.`);
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException(`Invalid billing period code '${periodCode}'. Expected YYYY-MM.`);
    }

    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    // Last millisecond of month: 0th day of next month UTC
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { periodStart, periodEnd };
  }

  /**
   * System Clock Rollback Protection (Part 7).
   * Offline financial integrity: compares last known recorded application timestamp against system clock.
   * If rollback detected: logs audit event and flags state.
   */
  async checkClockRollback(currentTime: Date = new Date(), actorUserId?: string, ipAddress?: string): Promise<{
    rollbackDetected: boolean;
    lastKnownTimestamp: Date;
    currentTimestamp: Date;
  }> {
    const clockState = await this.prisma.systemClockState.findFirst({
      orderBy: { updated_at: 'desc' },
    });

    if (!clockState) {
      // First initialization
      await this.prisma.systemClockState.create({
        data: {
          last_known_timestamp: currentTime,
          is_rollback_detected: false,
        },
      });
      return { rollbackDetected: false, lastKnownTimestamp: currentTime, currentTimestamp: currentTime };
    }

    const lastKnown = new Date(clockState.last_known_timestamp);
    // Allow up to 60 seconds tolerance for clock skew/drift
    const toleranceMs = 60 * 1000;

    if (currentTime.getTime() < lastKnown.getTime() - toleranceMs) {
      this.isRollbackState = true;
      this.logger.error(`[SECURITY ALERT] System clock rollback detected! Last known: ${lastKnown.toISOString()}, Current: ${currentTime.toISOString()}`);

      if (!clockState.is_rollback_detected) {
        await this.prisma.systemClockState.update({
          where: { state_id: clockState.state_id },
          data: {
            is_rollback_detected: true,
            rollback_detected_at: currentTime,
          },
        });

        await this.auditService.log({
          userId: actorUserId,
          action: AuditAction.SYSTEM_CLOCK_ROLLBACK,
          entityType: AuditEntityType.SYSTEM_CLOCK,
          entityId: clockState.state_id,
          oldValues: { last_known_timestamp: lastKnown.toISOString() },
          newValues: { current_timestamp: currentTime.toISOString(), rollback_detected: true },
          reason: `System clock rollback detected. Current system time (${currentTime.toISOString()}) is earlier than previous known time (${lastKnown.toISOString()}).`,
          ipAddress,
        });
      }

      return { rollbackDetected: true, lastKnownTimestamp: lastKnown, currentTimestamp: currentTime };
    }

    // Normal forward progression: advance last_known_timestamp
    if (currentTime > lastKnown) {
      await this.prisma.systemClockState.update({
        where: { state_id: clockState.state_id },
        data: {
          last_known_timestamp: currentTime,
          is_rollback_detected: false,
          rollback_detected_at: null,
        },
      });
    }

    this.isRollbackState = false;
    return { rollbackDetected: false, lastKnownTimestamp: currentTime, currentTimestamp: currentTime };
  }

  /**
   * Asserts clock is valid. Throws error if clock rollback is active.
   */
  async assertClockValid(actorUserId?: string, ipAddress?: string): Promise<void> {
    const { rollbackDetected, lastKnownTimestamp, currentTimestamp } = await this.checkClockRollback(new Date(), actorUserId, ipAddress);
    if (rollbackDetected) {
      throw new BadRequestException(
        `SYSTEM_CLOCK_ROLLBACK: Sensitive financial and billing operations are restricted because system date rollback was detected (Last known: ${lastKnownTimestamp.toISOString()}, Current: ${currentTimestamp.toISOString()}). Admin review required.`,
      );
    }
  }

  /**
   * Admin resolution to clear clock rollback flag after manual review.
   */
  async acknowledgeClockRollback(adminUserId: string, reason: string, ipAddress?: string): Promise<void> {
    const clockState = await this.prisma.systemClockState.findFirst({
      orderBy: { updated_at: 'desc' },
    });
    if (!clockState) return;

    await this.prisma.systemClockState.update({
      where: { state_id: clockState.state_id },
      data: {
        last_known_timestamp: this.now(),
        is_rollback_detected: false,
        rollback_detected_at: null,
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.SYSTEM_CLOCK,
      entityId: clockState.state_id,
      oldValues: { is_rollback_detected: true },
      newValues: { is_rollback_detected: false, acknowledged_at: this.now().toISOString() },
      reason: `Clock rollback acknowledged by admin: ${reason}`,
      ipAddress,
    });
    this.isRollbackState = false;
  }
}
