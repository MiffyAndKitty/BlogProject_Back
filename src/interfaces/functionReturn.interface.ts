export interface BasicReturnType {
  result: boolean;
  message: string;
}

export interface DataReturnType extends BasicReturnType {
  data: string;
}

export interface DatasReturnType<T> extends BasicReturnType {
  data: Array<T>;
}
