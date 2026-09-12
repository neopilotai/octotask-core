declare module 'concurrent-couch-follower' {
  export default function follower(
    callback: (change: any, done: () => void) => void,
    options?: Record<string, any>,
  ): void;
}

declare module 'ioredis' {
  export default class Redis {
    constructor(url?: string);
    get(key: string): Promise<string>;
    set(key: string, value: string): Promise<string>;
    del(key: string): Promise<number>;
    sadd(key: string, value: string): Promise<number>;
    srem(key: string, value: string): Promise<number>;
    smembers(key: string): Promise<string[]>;
  }
}

declare module 'request-promise' {
  interface RequestPromiseOptions {
    url: string;
    json: boolean;
    method?: string;
  }
  function get(options: RequestPromiseOptions): Promise<any>;
}
