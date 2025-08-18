declare module 'java-bridge' {
  export function addClasspath(path: string): void;
  export function addClasspaths(paths: string[]): void;
  export function classpath: string[];
  export function import<T = any>(className: string): T;
  export function newInstanceSync<T = any>(className: string, ...args: any[]): T;
  export function callStaticMethodSync<T = any>(className: string, methodName: string, ...args: any[]): T;
  export function ensureJvm(): Promise<void>;
}
