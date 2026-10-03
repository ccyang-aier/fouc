declare module 'redis-parser' {
  export default class RedisParser {
    constructor(options: {
      returnBuffers: boolean;
      stringNumbers: boolean;
      returnReply: (reply: unknown) => void;
      returnError: (error: Error) => void;
      returnFatalError: (error: Error) => void;
    });
    execute(data: Buffer): void;
  }
}
