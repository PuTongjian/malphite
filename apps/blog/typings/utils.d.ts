declare type WithoutMethods<T> = Pick<
  T,
  { [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K }[keyof T]
>

declare type Lazy<T> = () => Promise<T>;
