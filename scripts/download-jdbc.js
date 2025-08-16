const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadJdbcDriver() {
  console.log('📥 Downloading Oracle JDBC driver...');

  const libDir = path.join(__dirname, '..', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  // URLs para download (Oracle requer aceitação de licença)
  const drivers = [
    {
      name: 'ojdbc11.jar',
      url: 'https://download.oracle.com/otn-pub/otn_software/jdbc/218/ojdbc11.jar',
      description: 'Oracle JDBC Driver 21.8 for Java 11+',
    },
    {
      name: 'ucp.jar',
      url: 'https://download.oracle.com/otn-pub/otn_software/jdbc/218/ucp.jar',
      description: 'Oracle Universal Connection Pool',
    },
  ];

  console.log('\n⚠️  IMPORTANT: Oracle JDBC drivers require license acceptance.');
  console.log('Please download manually from:');
  console.log('https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html');
  console.log('\nRequired files:');
  
  drivers.forEach(driver => {
    console.log(`- ${driver.name}: ${driver.description}`);
    console.log(`  Save to: ${path.join(libDir, driver.name)}`);
  });

  console.log('\n📋 Alternative: Use Maven to download:');
  console.log('mvn dependency:copy-dependencies -DoutputDirectory=./lib');
  
  console.log('\n✅ Once downloaded, run "npm run build" to continue.');
}

downloadJdbcDriver();
