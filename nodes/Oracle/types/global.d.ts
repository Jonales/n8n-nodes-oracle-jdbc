declare global {
	const java: any;
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: 'development' | 'production' | 'test';
			ORACLE_HOME?: string;
			TNS_ADMIN?: string;
		}
	}
}

export {};
