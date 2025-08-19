/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */

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
