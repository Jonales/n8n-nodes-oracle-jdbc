
# Oracle Database JDBC Enterprise Node for n8n

**Enterprise-grade Oracle integration for n8n workflows.**
Zero Oracle Client dependency. Universal, robust, secure, and ready for cloud and RAC environments.

***

## 🚀 Features

- **Pure JDBC**
Connects to Oracle databases using only official JDBC drivers (`ojdbc11.jar`, `ucp.jar`), no Oracle Client required.
- **Enterprise Connection Pooling**
    - Universal Connection Pool (UCP) with advanced configuration.
    - **RAC/ADG/FO**: Load balancing, failover, node priority, live pool refresh.
    - **OCI**: Oracle Cloud Infrastructure and Wallet integration.
    - **SSL/TLS**: Secure connections with certificate management.
    - **Statement Cache**: LRU/FIXED cache, performance optimized.
- **Transaction \& Batch Management**
    - Atomic DML/DDL operations.
    - Savepoints, rollbacks, commit chains.
    - Batch insert/update/delete with error handling and reporting.
- **Monitoring \& Management**
    - Pool statistics: connections, latency, borrowing, activity, health checks.
    - Connection labeling for session stateful operations.
    - Health validation: validation queries, labeling, custom test timeouts.
- **Security**
    - Parameterized queries, SQL injection protection.
    - IAM, wallet, truststore/keystore integration.
- **Cloud Ready**
    - Native integration with Oracle Cloud (OCI).
    - Ready for production and analytics workloads.

***

## 🗂️ Architecture

```
n8n-nodes-oracle-jdbc-advanced/
├── package.json
├── tsconfig.json
├── gulpfile.js
├── .gitignore
├── README.md
├── lib/
│   ├── ojdbc11.jar           # Oracle JDBC driver
│   └── ucp.jar               # Universal Connection Pool
├── nodes/
│   └── Oracle/
│       ├── OracleJdbcDatabase.node.ts
│       ├── OracleJdbcAdvanced.node.ts
│       ├── core/
│       │   ├── JdbcConnectionManager.ts
│       │   ├── AdvancedPoolConfig.ts
│       │   ├── EnterpriseConnectionPool.ts
│       │   ├── PoolManager.ts
│       │   ├── QueryExecutor.ts
│       │   ├── TransactionManager.ts
│       │   ├── StoredProcedureExecutor.ts
│       │   ├── BatchOperations.ts
│       │   └── ConnectionPool.ts
│       ├── types/
│       │   ├── JdbcTypes.ts
│       │   ├── OracleTypes.ts
│       │   └── ConfigTypes.ts
│       └── utils/
│           ├── SqlParser.ts
│           ├── ResultMapper.ts
│           ├── ErrorHandler.ts
│           └── ParameterBinder.ts
├── credentials/
│   └── OracleJdbc.credentials.ts
└── icons/
    └── oracle.svg
```


***

## ⚡ Installation

### 1. Install Node Package

```bash
npm install n8n-nodes-oracle-jdbc-advanced
```


### 2. Download Oracle JDBC \& UCP Drivers

- Get `ojdbc11.jar` \& `ucp.jar` from [Oracle JDBC Downloads](https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html).
- Place them inside the `lib/` folder.


### 3. Configure Java

- Requires Java 11+ installed and configured as `JAVA_HOME`.

```bash
export JAVA_HOME=/path/to/java11
```


***

## 🔌 Usage

### Basic Database Connection

- Add the credentials (`OracleJdbc`) for your Oracle server.
- Select connection method: Service, SID, or TNS.


### Advanced Pool Configuration

- Choose a pool preset or customize:
    - OLTP, Analytics, Oracle Cloud, RAC.
    - Set retry logic, failover, health checks, statement cache size, labeling, SSL, etc.


#### Example PoolConfig (Analytics):

```json
{
  "minPoolSize": 5,
  "maxPoolSize": 20,
  "enableConnectionHealthCheck": true,
  "connectionTestQuery": "SELECT 1 FROM dual",
  "fastConnectionFailoverEnabled": true,
  "maxStatements": 100,
  "statsIntervalSeconds": 60
}
```


### Node Operations

- **OracleJdbcDatabase**:
Simple queries, parameterized DML/DDL, basic batch.
- **OracleJdbcAdvanced**:
Transactions, stored procedures, batch operations, advanced pooling.

***

## 🧑💻 Example Workflow

**Select Query:**

```sql
SELECT name, price FROM products WHERE category_id = ?
```

**Parameters:**

```json
[ { "value": 128, "type": "number" } ]
```

**Advanced:**

- Create pool with labeling for user sessions, connection tests for analytics, and automatic retry for failover.

***

## 📚 Enterprise Use Cases

- **Corporate environments:** Finance, analytics, ERP, CRM over Oracle 19c/21c/23c, RAC clusters, on-prem or OCI.
- **Data warehousing:** Large pool for ETL workloads.
- **Cloud deployments:** Multi-region, failover, IAM, wallet, secure compliance.

***

## 🛡️ Security Best Practices

- Always use parameterized queries to avoid SQL injection.
- Use SSL (wallet, truststore, keystore) for all production environments.
- Enable statistics and health checks for mission-critical pools.

***

## 🆘 Troubleshooting

- **Driver issues:** Confirm `ojdbc11.jar`, `ucp.jar` in `lib/`.
- **Java:** Ensure Java 11+ available as `JAVA_HOME`.
- **Config errors:** Check service name, TNS, SID, user/pass, firewall.
- **Pool problems:** Validate timeouts, failover configs, health check queries.

***

## ✨ Contributing

1. Fork the repo.
2. Create a feature branch.
3. Document your changes.
4. Open a pull request.

***

## 📄 License

MIT

***

**Made for enterprise-ready, low-code, secure, Oracle data automation.**
**Contact/support**: jonatas.mei@outlook.com

***

**Quick Start for Production:**

```bash
npm install n8n-nodes-oracle-jdbc-advanced
# Download JDBC/UCP jars to ./lib
n8n # add Oracle node, configure pool, go!
```


***

## 📊 Example Pool Presets

| Preset | Typical Use | Description |
| :-- | :-- | :-- |
| OLTP | Payments, ERP | Failover, high-concurrency |
| Analytics | DW, BI, ETL | Large fetch size, timeout tuning |
| Oracle Cloud | OCI, Wallet | Secure cloud, IAM, wallet files |
| RAC Cluster | High Availability | Multi-node/disaster recovery |


***

**Total flexibility. Enterprise security. Oracle performance. Cloud-ready.**