export type PartialRecord<K extends keyof never, T> = {
  [P in K]?: T;
};
