export interface IPaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
  };
}

export interface IPaginationQuery {
  limit?: number;
  cursor?: string;
}
