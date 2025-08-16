declare module 'java' {
  export const classpath: string[];
  export function import(className: string): any;
  export function newInstanceSync(className: string, ...args: any[]): any;
  export function callStaticMethodSync(className: string, methodName: string, ...args: any[]): any;
}
