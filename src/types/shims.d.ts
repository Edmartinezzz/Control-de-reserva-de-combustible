// Temporary shims to satisfy TypeScript until dependencies are installed

declare module 'next' {
  export type Metadata = any;
}

declare module 'react' {
  const React: any;
  export default React;
  export = React;
}

declare module 'axios' {
  const axios: any;
  export default axios;
}

declare module '@prisma/client' {
  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// Node globals
declare const process: any;


