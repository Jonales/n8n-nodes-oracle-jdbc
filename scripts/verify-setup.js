const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SetupVerifier {
	constructor() {
		this.libDir = path.join(__dirname, '..', 'lib');
		this.javaDir = path.join(__dirname, '..', 'java');
		this.requiredJars = ['ojdbc11.jar', 'ucp.jar'];
	}

	async verify() {
		console.log('🔍 Verifying Oracle JDBC Setup');
		console.log('==============================');

		let allGood = true;

		// 1. Check Java installation
		allGood &= await this.checkJava();

		// 2. Check JDBC drivers
		allGood &= this.checkJdbcDrivers();

		// 3. Test Oracle driver loading
		allGood &= await this.testOracleDriverLoading();

		// 4. Generate setup report
		this.generateReport();

		if (allGood) {
			console.log('\n🎉 All checks passed! Oracle JDBC setup is ready.');
			process.exit(0);
		} else {
			console.log('\n❌ Some checks failed. Please run setup scripts again.');
			process.exit(1);
		}
	}

	async checkJava() {
		try {
			const version = execSync('java -version 2>&1', { encoding: 'utf8' });
			console.log('✅ Java Runtime available');

			const compiler = execSync('javac -version 2>&1', { encoding: 'utf8' });
			console.log('✅ Java Compiler available');

			return true;
		} catch (error) {
			console.log('❌ Java not available');
			console.log('   Run: npm run setup:java');
			return false;
		}
	}

	checkJdbcDrivers() {
		let allPresent = true;

		console.log('\n📦 Checking JDBC drivers:');

		for (const jar of this.requiredJars) {
			const jarPath = path.join(this.libDir, jar);
			if (fs.existsSync(jarPath)) {
				const stats = fs.statSync(jarPath);
				console.log(`✅ ${jar} (${this.formatBytes(stats.size)})`);
			} else {
				console.log(`❌ ${jar} missing`);
				allPresent = false;
			}
		}

		if (!allPresent) {
			console.log('   Run: npm run download:jdbc');
		}

		return allPresent;
	}

	async testOracleDriverLoading() {
		try {
			const jarFiles = fs
				.readdirSync(this.libDir)
				.filter(file => file.endsWith('.jar'))
				.map(file => path.join(this.libDir, file));

			const classpath = jarFiles.join(path.delimiter);

			const testJava = `
public class DriverTest {
  public static void main(String[] args) {
    try {
      Class.forName("oracle.jdbc.OracleDriver");
      System.out.println("SUCCESS");
    } catch (Exception e) {
      System.out.println("FAILED: " + e.getMessage());
      System.exit(1);
    }
  }
}`;

			const testDir = path.join(__dirname, 'verification-test');
			if (!fs.existsSync(testDir)) {
				fs.mkdirSync(testDir);
			}

			const javaFile = path.join(testDir, 'DriverTest.java');
			fs.writeFileSync(javaFile, testJava);

			execSync(`javac -cp "${classpath}" "${javaFile}"`, { stdio: 'pipe' });
			const fullClasspath = `${classpath}${path.delimiter}${testDir}`;
			const result = execSync(`java -cp "${fullClasspath}" DriverTest`, {
				encoding: 'utf8',
				stdio: 'pipe',
			});

			if (result.trim() === 'SUCCESS') {
				console.log('\n✅ Oracle JDBC driver loads successfully');
				return true;
			} else {
				console.log('\n❌ Oracle JDBC driver failed to load');
				return false;
			}
		} catch (error) {
			console.log('\n❌ Oracle JDBC driver test failed:', error.message);
			return false;
		} finally {
			// Cleanup
			const testDir = path.join(__dirname, 'verification-test');
			if (fs.existsSync(testDir)) {
				fs.rmSync(testDir, { recursive: true, force: true });
			}
		}
	}

	generateReport() {
		const report = {
			timestamp: new Date().toISOString(),
			java: {
				runtime: this.getJavaVersion(),
				home: process.env.JAVA_HOME,
				path: process.env.PATH,
			},
			drivers: this.getDriverInfo(),
			platform: process.platform,
			node: process.version,
		};

		const reportPath = path.join(__dirname, '..', 'setup-report.json');
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
		console.log(`\n📊 Setup report saved to: ${reportPath}`);
	}

	getJavaVersion() {
		try {
			return execSync('java -version 2>&1', { encoding: 'utf8' });
		} catch {
			return 'Not available';
		}
	}

	getDriverInfo() {
		const drivers = {};

		if (fs.existsSync(this.libDir)) {
			fs.readdirSync(this.libDir)
				.filter(file => file.endsWith('.jar'))
				.forEach(jar => {
					const jarPath = path.join(this.libDir, jar);
					const stats = fs.statSync(jarPath);
					drivers[jar] = {
						size: stats.size,
						modified: stats.mtime,
						path: jarPath,
					};
				});
		}

		return drivers;
	}

	formatBytes(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
}

if (require.main === module) {
	const verifier = new SetupVerifier();
	verifier.verify();
}

module.exports = SetupVerifier;
