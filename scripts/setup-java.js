const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

class JavaEnvironmentSetup {
	constructor() {
		this.platform = process.platform;
		this.javaVersionRequired = '11';
		this.nodeJavaPath = path.join(__dirname, '..', 'java');
		this.libDir = path.join(__dirname, '..', 'lib');
		this.isDocker = this.detectDockerEnvironment();
		this.verbose = process.argv.includes('--verbose');
	}

	async setup() {
		console.log('🚀 Starting Java Environment Setup...');
		console.log(`📊 Platform: ${this.platform}`);
		console.log(`🐳 Docker Environment: ${this.isDocker ? 'Yes' : 'No'}`);

		try {
			// 1. Check existing Java installation
			const javaStatus = await this.checkJavaInstallation();

			if (!javaStatus.installed) {
				console.log('☕ Java not found. Installing...');
				await this.installJava();
			} else {
				console.log(`✅ Java ${javaStatus.version} is already installed`);
			}

			// 2. Setup Java environment variables
			await this.setupJavaEnvironment();

			// 3. Create lib directory
			this.createLibDirectory();

			// 4. Verify final setup
			await this.verifySetup();

			console.log('🎉 Java Environment Setup completed successfully!');
		} catch (error) {
			console.error('❌ Setup failed:', error.message);
			if (this.verbose) {
				console.error(error.stack);
			}
			process.exit(1);
		}
	}

	detectDockerEnvironment() {
		return (
			fs.existsSync('/.dockerenv') ||
			process.env.DOCKER_CONTAINER === 'true' ||
			process.env.container === 'docker'
		);
	}

	async checkJavaInstallation() {
		try {
			// Check system Java
			const systemJava = await this.execCommand('java -version 2>&1', { silent: true });
			if (systemJava) {
				const version = this.extractJavaVersion(systemJava);
				if (version && this.isVersionCompatible(version)) {
					return { installed: true, version, location: 'system' };
				}
			}
		} catch (error) {
			this.log('System Java not found or incompatible');
		}

		// Check local Node.js Java installation
		try {
			const localJavaPath = path.join(this.nodeJavaPath, 'bin', 'java');
			if (fs.existsSync(localJavaPath)) {
				const localJava = await this.execCommand(`${localJavaPath} -version 2>&1`, {
					silent: true,
				});
				const version = this.extractJavaVersion(localJava);
				if (version && this.isVersionCompatible(version)) {
					return { installed: true, version, location: 'local' };
				}
			}
		} catch (error) {
			this.log('Local Java not found');
		}

		return { installed: false };
	}

	extractJavaVersion(versionString) {
		const versionMatch = versionString.match(/version "([^"]+)"/);
		if (versionMatch) {
			const version = versionMatch[1];
			// Handle both old format (1.8.0_xxx) and new format (11.0.x)
			if (version.startsWith('1.')) {
				return version.split('.')[1]; // Extract 8 from 1.8.0_xxx
			} else {
				return version.split('.'); // Extract 11 from 11.0.x
			}
		}
		return null;
	}

	isVersionCompatible(version) {
		const versionNum = parseInt(version);
		const requiredNum = parseInt(this.javaVersionRequired);
		return versionNum >= requiredNum;
	}

	async installJava() {
		console.log(`📦 Installing Java ${this.javaVersionRequired} for ${this.platform}...`);

		if (this.platform === 'linux') {
			await this.installJavaLinux();
		} else if (this.platform === 'darwin') {
			await this.installJavaMacOS();
		} else if (this.platform === 'win32') {
			await this.installJavaWindows();
		} else {
			throw new Error(`Unsupported platform: ${this.platform}`);
		}
	}

	async installJavaLinux() {
		try {
			// Try system package manager first
			if (this.hasCommand('apt-get')) {
				console.log('🔄 Using APT package manager...');
				await this.execCommand('apt-get update');
				await this.execCommand(`apt-get install -y openjdk-${this.javaVersionRequired}-jdk`);
				return;
			}

			if (this.hasCommand('yum')) {
				console.log('🔄 Using YUM package manager...');
				await this.execCommand(`yum install -y java-${this.javaVersionRequired}-openjdk-devel`);
				return;
			}

			if (this.hasCommand('dnf')) {
				console.log('🔄 Using DNF package manager...');
				await this.execCommand(`dnf install -y java-${this.javaVersionRequired}-openjdk-devel`);
				return;
			}

			// Fallback: Download and install locally
			await this.downloadAndInstallJavaLocal();
		} catch (error) {
			console.warn(`⚠️ System installation failed: ${error.message}`);
			console.log('📦 Falling back to local installation...');
			await this.downloadAndInstallJavaLocal();
		}
	}

	async installJavaMacOS() {
		try {
			if (this.hasCommand('brew')) {
				console.log('🔄 Using Homebrew...');
				await this.execCommand(`brew install openjdk@${this.javaVersionRequired}`);

				// Create symlink for system-wide access
				const brewJavaPath = `/usr/local/opt/openjdk@${this.javaVersionRequired}`;
				if (fs.existsSync(brewJavaPath)) {
					await this.execCommand(
						`ln -sfn ${brewJavaPath}/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-${this.javaVersionRequired}.jdk`,
					);
				}
				return;
			}

			// Fallback: Download and install locally
			await this.downloadAndInstallJavaLocal();
		} catch (error) {
			console.warn(`⚠️ Homebrew installation failed: ${error.message}`);
			console.log('📦 Falling back to local installation...');
			await this.downloadAndInstallJavaLocal();
		}
	}

	async installJavaWindows() {
		console.log('📦 Installing Java on Windows...');
		await this.downloadAndInstallJavaLocal();
	}

	async downloadAndInstallJavaLocal() {
		console.log(`📥 Downloading OpenJDK ${this.javaVersionRequired} to local directory...`);

		const javaUrl = this.getOpenJDKDownloadUrl();
		const tempFile = path.join(__dirname, `openjdk-${this.javaVersionRequired}.tar.gz`);

		try {
			await this.downloadFile(javaUrl, tempFile);
			await this.extractJava(tempFile, this.nodeJavaPath);
			fs.unlinkSync(tempFile);

			console.log(`✅ Java installed locally at: ${this.nodeJavaPath}`);
		} catch (error) {
			throw new Error(`Failed to download/install Java: ${error.message}`);
		}
	}

	getOpenJDKDownloadUrl() {
		const baseUrl = 'https://github.com/adoptium/temurin';
		const arch = process.arch === 'x64' ? 'x64' : process.arch;

		const urlMap = {
			linux: `${baseUrl}${this.javaVersionRequired}-binaries/releases/download/jdk-${this.javaVersionRequired}.0.21%2B9/OpenJDK${this.javaVersionRequired}U-jdk_${arch}_linux_hotspot_${this.javaVersionRequired}.0.21_9.tar.gz`,
			darwin: `${baseUrl}${this.javaVersionRequired}-binaries/releases/download/jdk-${this.javaVersionRequired}.0.21%2B9/OpenJDK${this.javaVersionRequired}U-jdk_${arch}_mac_hotspot_${this.javaVersionRequired}.0.21_9.tar.gz`,
			win32: `${baseUrl}${this.javaVersionRequired}-binaries/releases/download/jdk-${this.javaVersionRequired}.0.21%2B9/OpenJDK${this.javaVersionRequired}U-jdk_${arch}_windows_hotspot_${this.javaVersionRequired}.0.21_9.zip`,
		};

		return urlMap[this.platform] || urlMap['linux'];
	}

	async downloadFile(url, destination) {
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(destination);

			https
				.get(url, response => {
					if (response.statusCode === 302 || response.statusCode === 301) {
						// Follow redirect
						return this.downloadFile(response.headers.location, destination)
							.then(resolve)
							.catch(reject);
					}

					if (response.statusCode !== 200) {
						reject(new Error(`Failed to download: ${response.statusCode}`));
						return;
					}

					response.pipe(file);
					file.on('finish', () => file.close(resolve));
				})
				.on('error', reject);
		});
	}

	async extractJava(archivePath, targetPath) {
		if (!fs.existsSync(targetPath)) {
			fs.mkdirSync(targetPath, { recursive: true });
		}

		if (archivePath.endsWith('.tar.gz')) {
			await this.execCommand(`tar -xzf "${archivePath}" -C "${targetPath}" --strip-components=1`);
		} else if (archivePath.endsWith('.zip')) {
			await this.execCommand(`unzip -q "${archivePath}" -d "${targetPath}"`);
		}
	}

	async setupJavaEnvironment() {
		console.log('🔧 Setting up Java environment variables...');

		let javaHome = process.env.JAVA_HOME;

		if (!javaHome || !fs.existsSync(javaHome)) {
			// Try to find Java home
			javaHome = await this.findJavaHome();
		}

		if (javaHome) {
			// Set environment variables for current process
			process.env.JAVA_HOME = javaHome;
			const javaBin = path.join(javaHome, 'bin');

			if (!process.env.PATH.includes(javaBin)) {
				process.env.PATH = javaBin + path.delimiter + process.env.PATH;
			}

			// Create/update environment configuration file
			await this.createEnvironmentConfig(javaHome);

			console.log(`✅ JAVA_HOME set to: ${javaHome}`);
		} else {
			throw new Error('Could not determine JAVA_HOME');
		}
	}

	async findJavaHome() {
		// Check local installation first
		if (fs.existsSync(this.nodeJavaPath)) {
			return this.nodeJavaPath;
		}

		// Platform-specific JAVA_HOME detection
		try {
			if (this.platform === 'darwin') {
				const javaHome = await this.execCommand('/usr/libexec/java_home', { silent: true });
				if (javaHome && fs.existsSync(javaHome.trim())) {
					return javaHome.trim();
				}
			} else if (this.platform === 'linux') {
				const alternatives = [
					'/usr/lib/jvm/java-11-openjdk-amd64',
					'/usr/lib/jvm/java-11-openjdk',
					`/usr/lib/jvm/java-${this.javaVersionRequired}-openjdk-amd64`,
					`/usr/lib/jvm/java-${this.javaVersionRequired}-openjdk`,
				];

				for (const alt of alternatives) {
					if (fs.existsSync(alt)) {
						return alt;
					}
				}
			}
		} catch (error) {
			this.log('Failed to detect JAVA_HOME automatically');
		}

		return null;
	}

	async createEnvironmentConfig(javaHome) {
		const configFile = path.join(__dirname, '..', '.env.java');
		const config = [
			`# Java Environment Configuration`,
			`# Generated by setup-java.js on ${new Date().toISOString()}`,
			`JAVA_HOME=${javaHome}`,
			`PATH=${path.join(javaHome, 'bin')}${path.delimiter}\${PATH}`,
		].join('\n');

		fs.writeFileSync(configFile, config, 'utf8');
		console.log(`📝 Environment config saved to: ${configFile}`);
	}

	createLibDirectory() {
		if (!fs.existsSync(this.libDir)) {
			fs.mkdirSync(this.libDir, { recursive: true });
			console.log(`📁 Created lib directory: ${this.libDir}`);
		} else {
			console.log(`✅ Lib directory exists: ${this.libDir}`);
		}
	}

	async verifySetup() {
		console.log('🔍 Verifying Java installation...');

		try {
			const javaVersion = await this.execCommand('java -version 2>&1');
			const javacVersion = await this.execCommand('javac -version 2>&1');

			console.log('✅ Java Runtime:', this.extractJavaVersion(javaVersion));
			console.log('✅ Java Compiler:', javacVersion.trim());

			// Test simple Java compilation
			await this.testJavaCompilation();
		} catch (error) {
			throw new Error(`Verification failed: ${error.message}`);
		}
	}

	async testJavaCompilation() {
		const testDir = path.join(__dirname, 'java-test');
		const testJavaFile = path.join(testDir, 'Test.java');

		try {
			if (!fs.existsSync(testDir)) {
				fs.mkdirSync(testDir, { recursive: true });
			}

			const testCode = `
public class Test {
    public static void main(String[] args) {
        System.out.println("Java setup verification successful!");
    }
}`;

			fs.writeFileSync(testJavaFile, testCode, 'utf8');

			// Compile
			await this.execCommand(`javac "${testJavaFile}"`);

			// Run
			const output = await this.execCommand(`java -cp "${testDir}" Test`);

			if (output.includes('successful')) {
				console.log('✅ Java compilation test passed');
			} else {
				throw new Error('Java compilation test failed');
			}

			// Cleanup
			fs.rmSync(testDir, { recursive: true, force: true });
		} catch (error) {
			throw new Error(`Java compilation test failed: ${error.message}`);
		}
	}

	hasCommand(command) {
		try {
			execSync(`which ${command}`, { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	}

	async execCommand(command, options = {}) {
		return new Promise((resolve, reject) => {
			if (!options.silent && this.verbose) {
				console.log(`🔧 Executing: ${command}`);
			}

			const child = spawn(command, [], {
				shell: true,
				stdio: options.silent ? 'pipe' : 'inherit',
			});

			let stdout = '';
			let stderr = '';

			if (options.silent) {
				child.stdout?.on('data', data => (stdout += data.toString()));
				child.stderr?.on('data', data => (stderr += data.toString()));
			}

			child.on('close', code => {
				if (code === 0) {
					resolve(stdout || stderr || true);
				} else {
					reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
				}
			});

			child.on('error', reject);
		});
	}

	log(message) {
		if (this.verbose) {
			console.log(`🔍 ${message}`);
		}
	}
}

// Execute if run directly
if (require.main === module) {
	const setup = new JavaEnvironmentSetup();
	setup.setup();
}

module.exports = JavaEnvironmentSetup;
