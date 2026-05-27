type Listener<T> = (value: T) => void;

export class LiveState<T> {
  private listeners = new Set<Listener<T>>();

  constructor(private current: T) {}

  get value() {
    return this.current;
  }

  set(value: T) {
    this.current = value;
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    listener(this.current);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
