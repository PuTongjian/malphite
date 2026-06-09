export type Constructor<T> = new (...args: never[]) => T;
export type Factory<T> = (provider: FrameworkProvider) => T;
export type EntityFactory<T, P> = (provider: FrameworkProvider, props: P) => T;

export class Framework {
  private factories = new Map<Constructor<unknown>, Factory<unknown>>();
  private entities = new Map<
    Constructor<unknown>,
    EntityFactory<unknown, unknown>
  >();

  service<T>(token: Constructor<T>, factory: Factory<T>) {
    this.factories.set(token, factory);
    return this;
  }

  entity<T, P>(token: Constructor<T>, factory: EntityFactory<T, P>) {
    this.entities.set(token, factory as EntityFactory<unknown, unknown>);
    return this;
  }

  provider(parent: FrameworkProvider | null = null) {
    return new FrameworkProvider(this, parent);
  }

  getServiceFactory<T>(token: Constructor<T>) {
    return this.factories.get(token) as Factory<T> | undefined;
  }

  getEntityFactory<T, P>(token: Constructor<T>) {
    return this.entities.get(token) as EntityFactory<T, P> | undefined;
  }
}

export class FrameworkProvider {
  private cache = new Map<Constructor<unknown>, unknown>();
  private disposables: Array<{ dispose?: () => void }> = [];

  constructor(
    private framework: Framework,
    private parent: FrameworkProvider | null = null,
  ) {}

  get<T>(token: Constructor<T>): T {
    if (this.cache.has(token)) return this.cache.get(token) as T;

    const factory = this.framework.getServiceFactory(token);
    if (!factory) {
      if (this.parent) return this.parent.get(token);
      throw new Error(`Service not found: ${token.name}`);
    }

    const instance = factory(this);
    this.cache.set(token, instance);
    this.disposables.push(instance as { dispose?: () => void });
    return instance;
  }

  createEntity<T, P = void>(token: Constructor<T>, props: P): T {
    const factory = this.framework.getEntityFactory<T, P>(token);

    if (!factory) {
      if (this.parent) return this.parent.createEntity(token, props);
      throw new Error(`Entity not found: ${token.name}`);
    }

    const instance = factory(this, props);
    this.disposables.push(instance as { dispose?: () => void });
    return instance;
  }

  createChild(configure: (framework: Framework) => void) {
    const childFramework = new Framework();
    configure(childFramework);

    return childFramework.provider(this);
  }

  dispose() {
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      this.disposables[i]?.dispose?.();
    }
    this.disposables = [];
    this.cache.clear();
  }
}
