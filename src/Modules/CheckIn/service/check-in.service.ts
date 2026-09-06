import { Service } from "typedi";

import { ECheckInStatus, ETicketStatus } from "core/global/entities/enums";
import ticketRepository from "Modules/Ticket/repository/ticket.repository";
import checkInRepository from "../repository/check-in.repository";
import { ITicketRepository } from "Modules/Ticket/entity/ticket.interface";
import {
  ICheckInRepository,
  ICheckInResult,
  ICheckInService,
  IOfflineScanDTO,
  ISyncCheckInDTO,
} from "../entity/check-in.interface";
import { CheckIn } from "../entity/check-in.model";

// Postgres unique-violation code, and the name of the partial index that enforces one
// admission per ticket. Both are checked: any other unique violation is a real fault and
// must not be quietly reported to a door as a duplicate.
const PG_UNIQUE_VIOLATION = "23505";
const ONE_SUCCESS_PER_TICKET = "check_ins_one_success_per_ticket";

function isOneSuccessPerTicketViolation(error: unknown): boolean {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === PG_UNIQUE_VIOLATION && pgError?.constraint === ONE_SUCCESS_PER_TICKET;
}

@Service()
export class CheckInService implements ICheckInService {
  private static instance: ICheckInService;

  // Defaults to the module singletons, so getInstance() and every caller are unchanged.
  // Arguments exist so the constraint-conflict path can be exercised without a database.
  constructor(
    private readonly repository: ICheckInRepository = checkInRepository,
    private readonly tickets: ITicketRepository = ticketRepository,
  ) {}

  public static getInstance(): ICheckInService {
    if (!this.instance) {
      this.instance = new CheckInService();
    }
    return this.instance;
  }

  private async processScan(scannedBy: string, eventId: string, scan: IOfflineScanDTO): Promise<ICheckInResult> {
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
        eventId,
        scannedCode: scan.ticketCode,
        scannedBy,
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
        eventId,
        scannedCode: scan.ticketCode,
        scannedBy,
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

    // Sourced from the scan log rather than tickets.status, which no longer carries
    // admission state. Same behaviour, different authority.
    const alreadyAdmitted = await this.repository.findSuccessByTicket(ticket.id);
    if (alreadyAdmitted) {
      await this.repository.create({
        ticketId: ticket.id,
        eventId,
        scannedCode: scan.ticketCode,
        scannedBy,
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
        eventId,
        scannedCode: scan.ticketCode,
        scannedBy,
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

    // The success row is the admission. Nothing is written back to the ticket.
    //
    // findSuccessByTicket above is a check-then-act, so two doors syncing at the same
    // moment can both pass it and both attempt this insert. The partial unique index is
    // what actually decides; losing that race is a duplicate, not a failure, so it is
    // recorded as one rather than surfacing as a 500 and losing the scan from the log.
    try {
      await this.repository.create({
        ticketId: ticket.id,
        eventId,
        scannedCode: scan.ticketCode,
        scannedBy,
        status: ECheckInStatus.SUCCESS,
        scannedAt,
        isOfflineSync: true,
        clientScanId: scan.clientScanId,
      });
    } catch (error) {
      if (!isOneSuccessPerTicketViolation(error)) {
        throw error;
      }

      await this.repository.create({
        ticketId: ticket.id,
        eventId,
        scannedCode: scan.ticketCode,
        scannedBy,
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

    // TODO: restore the check-in alert. Tickets no longer carry owner name/email, so the
    // recipient has to be resolved through ticket.ownerId once the notification payload
    // is reworked.

    return {
      clientScanId: scan.clientScanId,
      status: ECheckInStatus.SUCCESS,
      message: "Checked in",
      ticketId: ticket.id,
    };
  }

  async sync(scannedBy: string, eventId: string, payload: ISyncCheckInDTO): Promise<ICheckInResult[]> {
    const results: ICheckInResult[] = [];
    // Sequential on purpose: scans on the same ticket code within one batch must be
    // resolved in submission order so the second one correctly lands as a duplicate.
    for (const scan of payload.scans) {
      results.push(await this.processScan(scannedBy, eventId, scan));
    }
    return results;
  }

  async listByTicket(ticketId: string): Promise<CheckIn[]> {
    return this.repository.listByTicket(ticketId);
  }
}

export default CheckInService.getInstance();
