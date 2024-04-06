export {};

// 创建一个Route类，并声明路由所有属性为一个类型，
class A {
  name: string;
  path: string;
  type: string;

  constructor(name: string, path: string, type: string) {
    this.name = name;
    this.path = path;
    this.type = type;
  }

  toVueRoute() {
    return;
  }
}

class B extends A {
  constructor(name: string, path: string, type: string) {
    super(name, path, type);
  }

  toVueRoute() {
    // todo......
    return;
  }
}