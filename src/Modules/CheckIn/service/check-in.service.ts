import { Service } from "typedi";

import { ECheckInStatus, ETicketStatus } from "core/global/entities/enums";
import logger from "core/global/utils/logger";
import NotificationPublisher from "core/global/shared/queue/publisher/notification.publisher";
import eventRepository from "Modules/Event/repository/event.repository";
import ticketRepository from "Modules/Ticket/repository/ticket.repository";
import checkInRepository from "../repository/check-in.repository";
import { ICheckInResult, ICheckInService, IOfflineScanDTO, ISyncCheckInDTO } from "../entity/check-in.interface";
import { CheckIn } from "../entity/check-in.model";

@Service()
class CheckInService implements ICheckInService {
  private static instance: ICheckInService;
  private readonly repository = checkInRepository;
  private readonly tickets = ticketRepository;
  private readonly events = eventRepository;

  public static getInstance(): ICheckInService {
    if (!this.instance) {
      this.instance = new CheckInService();
    }
    return this.instance;
  }

  private async processScan(deviceId: string, eventId: string, scan: IOfflineScanDTO): Promise<ICheckInResult> {
    // Idempotent replay: a batch retried after a dropped connection should not be reprocessed.
    const existing = await this.repository.findByClientScanId(scan.clientScanId);
    if (existing) {
      return {
        clientScanId: scan.clientScanId,
        status: existing.status as ECheckInStatus,
        message: "Already synced",
        ticketId: existing.ticketId,
      };
    }

    const ticket = await this.tickets.findByCode(scan.ticketCode);
    const scannedAt = new Date(scan.scannedAt);

    if (!ticket) {
      await this.repository.create({
        ticketId: null,
        scannedCode: scan.ticketCode,
        deviceId,
        status: ECheckInStatus.INVALID,
        scannedAt,
        isOfflineSync: true,
        clientScanId: scan.clientScanId,
      });
      return {
        clientScanId: scan.clientScanId,
        status: ECheckInStatus.INVALID,
        message: "Unknown ticket code",
        ticketId: null,
      };
    }

    if (ticket.eventId !== eventId) {
      await this.repository.create({
        ticketId: ticket.id,
        scannedCode: scan.ticketCode,
        deviceId,
        status: ECheckInStatus.DENIED,
        scannedAt,
        isOfflineSync: true,
        clientScanId: scan.clientScanId,
      });
      return {
        clientScanId: scan.clientScanId,
        status: ECheckInStatus.DENIED,
        message: "Ticket belongs to a different event",
        ticketId: ticket.id,
      };
    }

    if (ticket.status === ETicketStatus.CHECKED_IN) {
      await this.repository.create({
        ticketId: ticket.id,
        scannedCode: scan.ticketCode,
        deviceId,
        status: ECheckInStatus.DUPLICATE,
        scannedAt,
        isOfflineSync: true,
        clientScanId: scan.clientScanId,
      });
      return {
        clientScanId: scan.clientScanId,
        status: ECheckInStatus.DUPLICATE,
        message: "Ticket already checked in",
        ticketId: ticket.id,
      };
    }

    if (ticket.status !== ETicketStatus.VALID) {
      await this.repository.create({
        ticketId: ticket.id,
        scannedCode: scan.ticketCode,
        deviceId,
        status: ECheckInStatus.DENIED,
        scannedAt,
        isOfflineSync: true,
        clientScanId: scan.clientScanId,
      });
      return {
        clientScanId: scan.clientScanId,
        status: ECheckInStatus.DENIED,
        message: `Ticket is ${ticket.status}`,
        ticketId: ticket.id,
      };
    }

    await this.tickets.update(ticket.id, { status: ETicketStatus.CHECKED_IN });
    await this.repository.create({
      ticketId: ticket.id,
      scannedCode: scan.ticketCode,
      deviceId,
      status: ECheckInStatus.SUCCESS,
      scannedAt,
      isOfflineSync: true,
      clientScanId: scan.clientScanId,
    });

    const event = await this.events.findById(ticket.eventId);
    new NotificationPublisher()
      .publish({
        type: "check-in-alert",
        data: {
          email: ticket.ownerEmail,
          name: ticket.ownerName,
          eventName: event?.name ?? "your event",
          scannedAt: scannedAt.toISOString(),
        },
      })
      .catch((err) => logger.error(`[CheckIn] Failed to publish check-in alert: ${err}`));

    return {
      clientScanId: scan.clientScanId,
      status: ECheckInStatus.SUCCESS,
      message: "Checked in",
      ticketId: ticket.id,
    };
  }

  async sync(deviceId: string, eventId: string, payload: ISyncCheckInDTO): Promise<ICheckInResult[]> {
    const results: ICheckInResult[] = [];
    // Sequential on purpose: scans on the same ticket code within one batch must be
    // resolved in submission order so the second one correctly lands as a duplicate.
    for (const scan of payload.scans) {
      results.push(await this.processScan(deviceId, eventId, scan));
    }
    return results;
  }

  async listByTicket(ticketId: string): Promise<CheckIn[]> {
    return this.repository.listByTicket(ticketId);
  }
}

export default CheckInService.getInstance();
