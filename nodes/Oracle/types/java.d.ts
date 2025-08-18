declare module 'java' {
	export const classpath: string[];
	// Declara como uma propriedade de objeto exportado
	const _import: (className: string) => any;
	export { _import as import };
	export function newInstanceSync(className: string, ...args: any[]): any;
	export function callStaticMethodSync(className: string, methodName: string, ...args: any[]): any;
}
