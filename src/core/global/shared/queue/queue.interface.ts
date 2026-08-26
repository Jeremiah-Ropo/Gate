export interface IQueueJob<T = any> {
  type: string;
  data: T;
}
