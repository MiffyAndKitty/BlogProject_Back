export interface BasicResponse {
  result: boolean;
  message: string;
}

export interface SingleDataResponse extends BasicResponse {
  data: string;
}

export interface MultipleDataResponse<T> extends BasicResponse {
  data: Array<T>;
}
