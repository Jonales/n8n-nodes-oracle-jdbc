const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function setupJava() {
  console.log('🔧 Setting up Java environment...');

  // Verificar se Java está instalado
  try {
    const javaVersion = execSync('java -version 2>&1', { encoding: 'utf8' });
    console.log('✅ Java found:', javaVersion.split('\n')[0]);
  } catch (error) {
    console.error('❌ Java not found. Please install Java 11 or later.');
    process.exit(1);
  }

  // Criar diretório lib se não existir
  const libDir = path.join(__dirname, '..', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
    console.log('📁 Created lib directory');
  }

  // Verificar se ojdbc11.jar existe
  const ojdbcPath = path.join(libDir, 'ojdbc11.jar');
  if (!fs.existsSync(ojdbcPath)) {
    console.log('⚠️  Oracle JDBC driver not found.');
    console.log('📥 Run "npm run download:jdbc" to download the Oracle JDBC driver.');
  } else {
    console.log('✅ Oracle JDBC driver found');
  }

  console.log('🎉 Java setup completed!');
}

setupJava();
