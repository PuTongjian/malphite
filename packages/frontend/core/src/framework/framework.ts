type Constructor<T> = new (...args: never[]) => T;

export class Framework {
  private instances = new Map<Constructor<unknown>, unknown>();

  service<T>(token: Constructor<T>, instance: T) {
    this.instances.set(token, instance);
    return this;
  }

  get<T>(token: Constructor<T>): T {
    const instance = this.instances.get(token);
    if (!instance) {
      throw new Error(`Service not found: ${token.name}`);
    }
    return instance as T;
  }
}
