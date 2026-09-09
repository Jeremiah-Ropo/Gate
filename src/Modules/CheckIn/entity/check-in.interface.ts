import { ECheckInStatus } from "core/global/entities/enums";
import type { DbTransaction } from "core/db/postgres";
import { CheckIn, NewCheckIn } from "./check-in.model";

export interface IOfflineScanDTO {
  clientScanId: string;
  ticketCode: string;
  scannedAt: string;
}

export interface ISyncCheckInDTO {
  scans: IOfflineScanDTO[];
}

export interface ICheckInResult {
  clientScanId: string;
  status: ECheckInStatus;
  message: string;
  ticketId: string | null;
}

/**
 * What a door downloads when it starts a shift, and the only server contact it needs before
 * it can admit anyone. Deliberately carries exceptions rather than the guest list: a valid
 * signature for this event is itself proof of admissibility, so the manifest only has to name
 * the tickets that are genuine but must not get in. That keeps it O(voids + scans) instead of
 * O(attendees), and leaves the device holding nothing that could forge a ticket.
 */
export interface ICheckInSessionManifest {
  eventId: string;
  eventName: string;
  // Base64-encoded PEM. Verifies signatures, cannot produce them.
  publicKey: string;
  issuedAt: string;
  // Grows through the night. Refetching is how a door learns what other doors admitted.
  checkedInTicketIds: string[];
  blockedTicketIds: string[];
}

export interface ICheckInService {
  sync(scannedBy: string, eventId: string, payload: ISyncCheckInDTO): Promise<ICheckInResult[]>;
  getSessionManifest(eventId: string): Promise<ICheckInSessionManifest>;
  listByTicket(ticketId: string): Promise<CheckIn[]>;
}

export interface ICheckInRepository {
  withTx(tx: DbTransaction): ICheckInRepository;
  findByClientScanId(clientScanId: string): Promise<CheckIn | null>;
  findSuccessByTicket(ticketId: string): Promise<CheckIn | null>;
  listSuccessTicketIdsByEvent(eventId: string): Promise<string[]>;
  create(data: NewCheckIn): Promise<CheckIn>;
  listByTicket(ticketId: string): Promise<CheckIn[]>;
}
