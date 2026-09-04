import { ECheckInStatus } from "core/global/entities/enums";
import type { DbExecutor } from "core/db/postgres";
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

export interface ICheckInService {
  sync(deviceId: string, eventId: string, payload: ISyncCheckInDTO): Promise<ICheckInResult[]>;
  listByTicket(ticketId: string): Promise<CheckIn[]>;
}

export interface ICheckInRepository {
  withExecutor(executor: DbExecutor): ICheckInRepository;
  findByClientScanId(clientScanId: string): Promise<CheckIn | null>;
  create(data: NewCheckIn): Promise<CheckIn>;
  listByTicket(ticketId: string): Promise<CheckIn[]>;
}
