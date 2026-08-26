import { EEventStatus } from "core/global/entities/enums";
import { Event, NewEvent } from "./event.model";

export interface ICreateEventDTO {
  name: string;
  description?: string;
  venue?: string;
  address?: string;
  timezone?: string;
  startDate: string;
  endDate: string;
  capacity: number;
  ticketPrice: number;
  currency?: string;
}

export interface IUpdateEventDTO {
  name?: string;
  description?: string;
  venue?: string;
  address?: string;
  coverImage?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  ticketPrice?: number;
  status?: EEventStatus;
}

export interface IEventService {
  createEvent(createdBy: string, payload: ICreateEventDTO): Promise<Event>;
  getById(id: string): Promise<Event>;
  list(): Promise<Event[]>;
  updateEvent(id: string, requesterId: string, payload: IUpdateEventDTO): Promise<Event>;
  uploadCoverImage(id: string, requesterId: string, tempFilePath: string): Promise<Event>;
}

export interface IEventRepository {
  create(data: NewEvent): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  findBySlug(slug: string): Promise<Event | null>;
  list(): Promise<Event[]>;
  update(id: string, data: Partial<NewEvent>): Promise<Event | null>;
}
