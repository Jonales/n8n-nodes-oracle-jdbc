# oracle-jdbc-advanced-n8n

![Oracle JDBC Advanced N8N](image/README/oracle-n8n.png)

[![npm version](https://img.shields.io/npm/v/oracle-jdbc-advanced-n8n.svg)](https://www.npmjs.com/package/oracle-jdbc-advanced-n8n)  
[![npm downloads](https://img.shields.io/npm/dt/oracle-jdbc-advanced-n8n.svg)](https://www.npmjs.com/package/oracle-jdbc-advanced-n8n)

Advanced node for **n8n** that integrates Oracle Database via **native JDBC**, with enterprise features, smart pooling, advanced transaction management, and full support for critical Oracle workloads.

---

## 📋 About

Enterprise-grade solution for integrating n8n with Oracle databases using official JDBC technology (ojdbc, UCP), Java Bridge, focusing on high performance, security, and scalability.

**Author:** Jônatas Meireles Sousa Vieira  
**Email:** [jonatas.mei@outlook.com](mailto:jonatas.mei@outlook.com)  
**GitHub:** [@jonales](https://github.com/jonales)

---

## ⭐ Main Features

- **Oracle Enterprise JDBC:** Thin, UCP pooling, failover, Oracle RAC and ADG  
- **Advanced Pooling:** Configurable, monitorable, and intelligent pools  
- **Batch Operations:** Massive inserts/updates (bulk), optimized processing  
- **Transaction Management:** ACID block with savepoint, partial rollback, isolation  
- **Full PL/SQL Support:** Procedures, functions, packages, complete IN/OUT control  
- **Cloud Support:** OCI, Oracle Wallet, IAM integration  
- **Connection Labeling:** Fine-grained auditing and session traceability  
- **Security:** SSL/TLS, Wallet, protected logs  
- **Monitoring:** Pool statistics, health checks, detailed logging  

---

## ⚙️ Installation

```bash
npm install oracle-jdbc-advanced-n8n
```

> Requires Java 11+ and Oracle JDBC drivers (ojdbc11.jar, ucp.jar) inside `/lib`.  
> Use `npm run setup:java` to prepare the environment and check the instructions to download the drivers.

---

## 🔑 Credential Configuration

In n8n, create credentials with the following parameters:

| Field             | Example                           |
| ----------------- | --------------------------------- |
| Host              | `oracle-srv.example.com`          |
| Port              | `1521`                            |
| Connection Type   | `service` / `sid` / `tns`         |
| Service Name      | `ORCL`, `PROD`, `XEPDB1`          |
| Username          | `app_user`                        |
| Password          | `**********`                      |
| Connection Options| Timeout, SSL, wallet, schema, ... |

#### Connection String Examples

- Service: `oracle1.company.com:1521/PROD`  
- TNS: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=dbhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=MYDB)))`

---

## 🚀 Usage Examples

### **Full Transaction**
```sql
INSERT INTO orders (customer_id, amount) VALUES (:cust_id, :amount);
UPDATE stock SET qty = qty - :qty WHERE product_id = :prod_id;
SAVEPOINT sp1;
DELETE FROM cart WHERE customer_id = :cust_id;
```

### **Optimized Bulk Insert**
Define operation type as "batch", target table, and data batch:
```json
{
  "operationType": "batch",
  "tableName": "customers",
  "batchSize": 1000
}
```

### **Procedure Execution**
```json
{
  "operationType": "procedure",
  "procedureName": "update_price",
  "parameters": [
    { "name": "p_product_id", "type": "IN", "dataType": "NUMBER", "value": 123 },
    { "name": "p_new_price", "type": "IN", "dataType": "NUMBER", "value": 72.5 }
  ]
}
```

### **Enterprise Pooling**
```ts
import { PoolConfigurationPresets } from './core/AdvancedPoolConfig';

const poolConfig = PoolConfigurationPresets.getHighVolumeOLTP();
```

---

## 🏢 Intelligent Connection Pools

| Type        | Min/Max | Timeout | Use Case                 |
|-------------|---------|---------|--------------------------|
| Standard    | 5/20    | 30s     | General workloads         |
| High OLTP   | 10/50   | 5s      | Very high transaction volume |
| Analytics   | 5/20    | 300s    | Reports and queries       |
| Cloud       | 5/25    | 60s     | Integrated with OCI/Wallet|
| RAC/ADG     | 8/40    | 10s     | High availability setups  |

---

## 📊 Monitoring and Performance

- Batch tested with **hundreds of thousands of records**  
- RAC/ADG failover supported via `EnterpriseConnectionPool`  
- Pool manager with statistics: connections, borrowed, available, peak, failed  
- Configurable statement cache, customizable health-check  

---

## 🛡️ Security

- Native support for **SSL/TLS**, Wallet, CA, client certs, etc.  
- **Connection Labeling** for session-state auditing  
- Mandatory bind parameters (SQL Injection proof)  
- Detailed logs and stack traces for enterprise troubleshooting  

---

## 🧪 Project Structure

```text
oracle-jdbc-advanced-n8n/
├── core/
│   ├── AdvancedPoolConfig.ts
│   ├── BatchOperations.ts
│   ├── ConnectionPool.ts
│   ├── EnterpriseConnectionPool.ts
│   ├── PoolManager.ts
│   ├── JdbcConnectionManager.ts
│   ├── OracleJdbcDriver.ts
│   ├── TransactionManager.ts
│   ├── QueryExecutor.ts
│   ├── StoredProcedureExecutor.ts
├── types/
│   ├── JdbcTypes.ts
│   ├── OracleTypes.ts
│   ├── ConfigTypes.ts
├── utils/
│   ├── ErrorHandler.ts
│   ├── ParameterBinder.ts
│   ├── ResultMapper.ts
│   ├── SqlParser.ts
├── scripts/
│   ├── download-jdbc.js
│   ├── setup-java.js
├── nodes/
│   └── OracleJdbcDatabase.node.ts
├── credentials/
│   └── OracleJdbc.credentials.ts
├── lib/
│   ├── ojdbc11.jar
│   ├── ucp.jar
│   └── orai18n.jar
```

---

## 🔧 Scripts and Development

```bash
npm run setup:java        # Prepare Java environment
npm run download:jdbc     # Download JDBC drivers
npm run build             # Build Typescript + assets
npm run dev               # Hot reload / dev environment
npm run lint              # ESLint + Prettier
npm run test              # Automated tests
npm run validate          # Pre-release checks
npm run clean             # Cleanup dist folder
```

---

## 🤝 Contributing

Contributions are **welcome**!  
Follow this flow:

1. Fork  
2. Feature branch: `feature/new-feature`  
3. Commit and push  
4. Submit a descriptive pull request  

Suggestions: bug fixes, examples, optimizations, new features, docs, tests.

---

## 💰 Support This Project

If this project helps you, consider supporting it!

<div align="center">

### PIX:
<img src="image/README/qrcode-pix-jonatas.mei@outlook.com.png" alt="QR Code PIX" width="150" />  

**PIX Key:** jonatas.mei@outlook.com  

### Cryptocurrency Donation

<table style="width:100%; border:none;">
  <tr style="border:none;">
    <td style="text-align:center; padding:10px; border:none;">
      <h4>Bitcoin (BTC)</h4>
      <img src="image/README/btc.jpeg" alt="QR Code BTC" width="150" />
      <br>
      <code>bc1qdq9rj7565c4fvr7t3xut6z0tjd65p4mudrc0ll</code>
      <br>
      <a href="https://link.trustwallet.com/send?asset=c0&address=bc1qdq9rj7565c4fvr7t3xut6z0tjd65p4mudrc0ll">Pay with Trust Wallet</a>
    </td>
    <td style="text-align:center; padding:10px; border:none;">
      <h4>Ethereum (ETH)</h4>
      <img src="image/README/eth.jpeg" alt="QR Code ETH" width="150" />
      <br>
      <code>0xA35A984401Ae9c81ca2d742977E603421df45419</code>
      <br>
      <a href="https://link.trustwallet.com/send?address=0xA35A984401Ae9c81ca2d742977E603421df45419&asset=c60">Pay with Trust Wallet</a>
    </td>
  </tr>
  <tr style="border:none;">
    <td style="text-align:center; padding:10px; border:none;">
      <h4>BNB</h4>
      <img src="image/README/bnb.jpeg" alt="QR Code BNB" width="150" />
      <br>
      <code>0xA35A984401Ae9c81ca2d742977E603421df45419</code>
      <br>
      <a href="https://link.trustwallet.com/send?address=0xA35A984401Ae9c81ca2d742977E603421df45419&asset=c20000714">Pay with Trust Wallet</a>
    </td>
    <td style="text-align:center; padding:10px; border:none;">
      <h4>Polygon (POL)</h4>
      <img src="image/README/pol.jpeg" alt="QR Code POL" width="150" />
      <br>
      <code>0xA35A984401Ae9c81ca2d742977E603421df45419</code>
      <br>
      <a href="https://link.trustwallet.com/send?asset=c966&address=0xA35A984401Ae9c81ca2d742977E603421df45419">Pay with Trust Wallet</a>
    </td>
  </tr>
</table>


---

## 📄 License

This project is licensed under the **MIT License** – see [LICENSE.md](LICENSE.md) for details.

---

## 👨‍💻 Author

**Jônatas Meireles Sousa Vieira**  
📧 [jonatas.mei@outlook.com](mailto:jonatas.mei@outlook.com)  
🔗 [github.com/jonales](https://github.com/jonales)  
🌐 [LinkedIn](https://www.linkedin.com/in/jonatasmeireles/)

---

## 📚 Links

- [Oracle Database Documentation](https://docs.oracle.com/en/database/oracle/oracle-database/)  
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)  
- [Report Issues](https://github.com/jonales/oracle-jdbc-advanced-n8n/issues)  
- [Discussions](https://github.com/jonales/oracle-jdbc-advanced-n8n/discussions)  

---

<div align="center">

**⭐ Star if you like it!**  

[![GitHub stars](https://img.shields.io/github/stars/jonales/oracle-jdbc-advanced-n8n.svg?style=social&label=Star)](https://github.com/jonales/oracle-jdbc-advanced-n8n)  
[![GitHub forks](https://img.shields.io/github/forks/jonales/oracle-jdbc-advanced-n8n.svg?style=social&label=Fork)](https://github.com/jonales/oracle-jdbc-advanced-n8n/fork)  

Made with ❤️ 100% original, no third-party forks!  

</div>
