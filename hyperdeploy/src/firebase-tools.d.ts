// Type declarations for firebase-tools
declare module 'firebase-tools' {
  export interface DeployOptions {
    project: string;
    token: string;
    cwd: string;
    [key: string]: any;
  }

  export function deploy(options: DeployOptions): Promise<void>;

  // Add other firebase-tools exports as needed
  const firebaseTools: {
    deploy: typeof deploy;
    [key: string]: any;
  };

  export = firebaseTools;
}
