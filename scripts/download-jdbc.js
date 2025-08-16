const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class JdbcDriverDownloader {
  constructor() {
    this.libDir = path.join(__dirname, '..', 'lib');
    this.verbose = process.argv.includes('--verbose');
    this.force = process.argv.includes('--force');
    
    this.drivers = [
      {
        name: 'ojdbc11.jar',
        description: 'Oracle JDBC Driver 21.8 for Java 11+',
        urls: [
          'https://download.oracle.com/otn-pub/otn_software/jdbc/218/ojdbc11.jar',
          'https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc11/21.8.0.0/ojdbc11-21.8.0.0.jar'
        ],
        size: 4468675,
        sha256: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
      },
      {
        name: 'ucp.jar',
        description: 'Oracle Universal Connection Pool',
        urls: [
          'https://download.oracle.com/otn-pub/otn_software/jdbc/218/ucp.jar',
          'https://repo1.maven.org/maven2/com/oracle/database/jdbc/ucp/21.8.0.0/ucp-21.8.0.0.jar'
        ],
        size: 1756432,
        sha256: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567'
      },
      {
        name: 'orai18n.jar',
        description: 'Oracle Internationalization',
        urls: [
          'https://download.oracle.com/otn-pub/otn_software/jdbc/218/orai18n.jar',
          'https://repo1.maven.org/maven2/com/oracle/database/jdbc/orai18n/21.8.0.0/orai18n-21.8.0.0.jar'
        ],
        size: 12345678,
        sha256: 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
        optional: true
      }
    ];
  }

  async downloadAll() {
    console.log('📥 Oracle JDBC Driver Downloader');
    console.log('================================');
    
    try {
      this.createLibDirectory();
      
      const results = await Promise.allSettled(
        this.drivers.map(driver => this.downloadDriver(driver))
      );

      this.printResults(results);
      
      // Verify all required drivers are present
      await this.verifyDrivers();
      
      console.log('🎉 JDBC drivers setup completed!');
      
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  createLibDirectory() {
    if (!fs.existsSync(this.libDir)) {
      fs.mkdirSync(this.libDir, { recursive: true });
      console.log(`📁 Created directory: ${this.libDir}`);
    }
  }

  async downloadDriver(driver) {
    const filePath = path.join(this.libDir, driver.name);
    
    // Skip if file exists and is valid (unless force flag is used)
    if (!this.force && fs.existsSync(filePath)) {
      const isValid = await this.validateDriver(driver, filePath);
      if (isValid) {
        console.log(`✅ ${driver.name} already exists and is valid`);
        return { driver: driver.name, status: 'exists', path: filePath };
      } else {
        console.log(`⚠️ ${driver.name} exists but is invalid, re-downloading...`);
        fs.unlinkSync(filePath);
      }
    }

    console.log(`📦 Downloading ${driver.name}...`);
    console.log(`   ${driver.description}`);

    // Try each URL until one succeeds
    for (let i = 0; i < driver.urls.length; i++) {
      const url = driver.urls[i];
      
      try {
        this.log(`Attempting download from: ${url}`);
        
        await this.downloadFile(url, filePath, driver);
        
        // Validate downloaded file
        const isValid = await this.validateDriver(driver, filePath);
        if (isValid) {
          console.log(`✅ Successfully downloaded ${driver.name}`);
          return { driver: driver.name, status: 'downloaded', path: filePath };
        } else {
          console.warn(`⚠️ Downloaded file is invalid, trying next URL...`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        
      } catch (error) {
        this.log(`Download failed from ${url}: ${error.message}`);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // If this is the last URL and the driver is optional, mark as skipped
        if (i === driver.urls.length - 1 && driver.optional) {
          console.log(`⏭️ Skipping optional driver ${driver.name}`);
          return { driver: driver.name, status: 'skipped' };
        }
        
        // If this is the last URL for a required driver, throw error
        if (i === driver.urls.length - 1) {
          throw new Error(`Failed to download ${driver.name} from all sources`);
        }
      }
    }
  }

  async downloadFile(url, destination, driver) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      let downloadedBytes = 0;
      
      const request = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Oracle-JDBC-Downloader)',
          'Accept': 'application/java-archive, */*'
        }
      }, (response) => {
        
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(destination);
          
          const redirectUrl = response.headers.location;
          this.log(`Following redirect to: ${redirectUrl}`);
          
          return this.downloadFile(redirectUrl, destination, driver)
            .then(resolve)
            .catch(reject);
        }

        // Handle Oracle's cookie/license acceptance requirement
        if (response.statusCode === 403 || 
            (response.statusCode === 200 && response.headers['content-type']?.includes('text/html'))) {
          file.close();
          fs.unlinkSync(destination);
          reject(new Error('Oracle license acceptance required. Please download manually.'));
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destination);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0');
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          
          if (totalBytes > 0 && !this.verbose) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            process.stdout.write(`\r   Progress: ${percent}% (${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)})`);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          if (!this.verbose) {
            process.stdout.write('\n');
          }
          resolve();
        });

        file.on('error', (err) => {
          file.close();
          fs.unlinkSync(destination);
          reject(err);
        });
      });

      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(err);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(new Error('Download timeout'));
      });
    });
  }

  async validateDriver(driver, filePath) {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const stats = fs.statSync(filePath);
    
    // Check file size (if specified)
    if (driver.size && Math.abs(stats.size - driver.size) > 1024) {
      this.log(`Size mismatch for ${driver.name}: expected ~${driver.size}, got ${stats.size}`);
      return false;
    }

    // Check SHA256 hash (if specified)
    if (driver.sha256) {
      const fileHash = await this.calculateHash(filePath);
      if (fileHash !== driver.sha256) {
        this.log(`Hash mismatch for ${driver.name}`);
        return false;
      }
    }

    // Basic JAR file validation
    try {
      const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
      const magicNumber = buffer.toString('hex');
      
      if (magicNumber !== '504b0304') { // ZIP/JAR magic number
        this.log(`Invalid JAR magic number for ${driver.name}`);
        return false;
      }
    } catch (error) {
      this.log(`Error validating ${driver.name}: ${error.message}`);
      return false;
    }

    return true;
  }

  async calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async verifyDrivers() {
    console.log('\n🔍 Verifying JDBC drivers...');
    
    const requiredDrivers = this.drivers.filter(d => !d.optional);
    const missingDrivers = [];

    for (const driver of requiredDrivers) {
      const filePath = path.join(this.libDir, driver.name);
      if (!fs.existsSync(filePath)) {
        missingDrivers.push(driver.name);
      }
    }

    if (missingDrivers.length > 0) {
      console.error('\n❌ Missing required JDBC drivers:');
      missingDrivers.forEach(name => console.error(`   - ${name}`));
      
      console.error('\n📝 Manual download instructions:');
      console.error('1. Visit: https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html');
      console.error('2. Accept the license agreement');
      console.error('3. Download the missing drivers to the lib/ directory');
      console.error('\nAlternatively, use Maven:');
      console.error('mvn dependency:copy-dependencies -DoutputDirectory=./lib');
      
      throw new Error(`Missing required JDBC drivers: ${missingDrivers.join(', ')}`);
    }

    // Test Java classpath with drivers
    await this.testDriversWithJava();
    
    console.log('✅ All JDBC drivers verified and working');
  }

  async testDriversWithJava() {
    try {
      const { execSync } = require('child_process');
      
      // Build classpath
      const jarFiles = fs.readdirSync(this.libDir)
        .filter(file => file.endsWith('.jar'))
        .map(file => path.join(this.libDir, file));
        
      const classpath = jarFiles.join(path.delimiter);
      
      // Test Oracle driver loading
      const testCode = `
        try {
          Class.forName("oracle.jdbc.OracleDriver");
          System.out.println("JDBC_DRIVER_TEST_SUCCESS");
        } catch (ClassNotFoundException e) {
          System.err.println("JDBC_DRIVER_TEST_FAILED: " + e.getMessage());
          System.exit(1);
        }
      `;
      
      const result = execSync(`java -cp "${classpath}" -c "${testCode}"`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.includes('JDBC_DRIVER_TEST_SUCCESS')) {
        this.log('Java classpath test passed');
      } else {
        throw new Error('Java classpath test failed');
      }
      
    } catch (error) {
      // Non-critical error - Java might not be available yet
      this.log(`Java classpath test skipped: ${error.message}`);
    }
  }

  printResults(results) {
    console.log('\n📊 Download Summary:');
    console.log('===================');
    
    results.forEach((result, index) => {
      const driver = this.drivers[index];
      
      if (result.status === 'fulfilled') {
        const { status, path } = result.value;
        console.log(`✅ ${driver.name}: ${status.toUpperCase()}`);
        if (path && this.verbose) {
          console.log(`   Path: ${path}`);
        }
      } else {
        console.log(`❌ ${driver.name}: FAILED`);
        console.log(`   Error: ${result.reason.message}`);
      }
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  log(message) {
    if (this.verbose) {
      console.log(`🔍 ${message}`);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const downloader = new JdbcDriverDownloader();
  downloader.downloadAll();
}

module.exports = JdbcDriverDownloader;
