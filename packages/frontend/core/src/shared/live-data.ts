type Listener = () => void;

export class LiveData<T> {
  private listeners = new Set<Listener>();

  constructor(private current: T) {}

  get value() {
    return this.current;
  }

  set(value: T) {
    if (Object.is(this.current, value)) {
      return;
    }

    this.current = value;

    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  map<R>(mapper: (value: T) => R) {
    const mapped = new LiveData(mapper(this.value));

    this.subscribe(() => {
      mapped.set(mapper(this.value));
    });

    return mapped;
  }
}
