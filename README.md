# oracle-jdbc-advanced-n8n

![Oracle JDBC Advanced N8N](image/README/oracle-n8n.png)

[![npm version](https://img.shields.io/npm/v/oracle-jdbc-advanced-n8n.svg)](https://www.npmjs.com/package/oracle-jdbc-advanced-n8n)
[![npm downloads](https://img.shields.io/npm/dt/oracle-jdbc-advanced-n8n.svg)](https://www.npmjs.com/package/oracle-jdbc-advanced-n8n)

Node avançado para **n8n** que integra Oracle Database via **JDBC nativo**, com recursos empresariais, pooling inteligente, gestão avançada de transações e suporte completo a workloads Oracle críticos.

---

## 📋 Sobre

Solução empresarial para integração entre n8n e bancos Oracle usando tecnologia JDBC oficial (ojdbc, UCP), Java Bridge e foco em alta performance, segurança e escalabilidade.

**Autor:** Jônatas Meireles Sousa Vieira  
**Email:** [jonatas.mei@outlook.com](mailto:jonatas.mei@outlook.com)  
**GitHub:** [@jonales](https://github.com/jonales)

---

## ⭐ Principais Recursos

- **JDBC Oracle Enterprise:** Thin, pooling UCP, failover, Oracle RAC e ADG
- **Pooling Avançado:** Pools configuráveis, monitoráveis e inteligentes
- **Batch Operations:** Inserts/updates massivos (bulk), processamento otimizado
- **Gestão de Transações:** Block ACID com savepoint, rollback parcial, isolamento
- **PL/SQL Completo:** Procedures, functions, packages, controle total de IN/OUT
- **Suporte Cloud:** Suporte OCI, Oracle Wallet, IAM integration
- **Connection Labeling:** Auditoria fina e rastreabilidade de sessões
- **Segurança:** SSL/TLS, Wallet, logs protegidos
- **Monitoração:** Estatísticas de pool, healthcheck, logging detalhado

---

## ⚙️ Instalação

```

npm install oracle-jdbc-advanced-n8n

```

> É necessário Java 11+ e os drivers Oracle JDBC (ojdbc11.jar, ucp.jar) no diretório `/lib`.  
> Use `npm run setup:java` para preparar o ambiente e veja orientações para baixar os drivers.

---

## 🔑 Configuração de Credenciais

No n8n, crie credenciais com os parâmetros:

| Campo             | Exemplo                           |
| ----------------- | --------------------------------- |
| Host              | `oracle-srv.exemplo.com`          |
| Port              | `1521`                            |
| Connection Type   | `service`/`sid`/`tns`             |
| Service Name      | `ORCL`, `PROD`, `XEPDB1`          |
| Username          | `app_user`                        |
| Password          | `**********`                      |
| Connection Options| Timeout, SSL, wallet, schema, ... |

#### Exemplos de Connection String

- Service: `oracle1.empresa.com:1521/PROD`
- TNS: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=dbhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=MYDB)))`

---

## 🚀 Exemplos de Uso

### **Transação Completa**
```

INSERT INTO pedidos (cliente_id, valor) VALUES (:cli_id, :valor);
UPDATE estoque SET qtd = qtd - :qtd WHERE produto_id = :prod_id;
SAVEPOINT sp1;
DELETE FROM carrinho WHERE cliente_id = :cli_id;

```

### **Bulk Insert Otimizado**
Defina operação "batch", tabela de destino e lote de dados:
```

{
"operationType": "batch",
"tableName": "clientes",
"batchSize": 1000
}

```

### **Execução de Procedure**
```

{
"operationType": "procedure",
"procedureName": "atualiza_preco",
"parameters": [
{ "name": "p_produto_id", "type": "IN", "dataType": "NUMBER", "value": 123 },
{ "name": "p_novo_preco", "type": "IN", "dataType": "NUMBER", "value": 72.5 }
]
}

```

### **Pooling Empresarial**
```

import { PoolConfigurationPresets } from './core/AdvancedPoolConfig';

const poolConfig = PoolConfigurationPresets.getHighVolumeOLTP();

```

---

## 🏢 Pools de Conexão Inteligentes

| Tipo        | Min/Max | Timeout | Uso                       |
|-------------|---------|---------|---------------------------|
| Standard    | 5/20    | 30s     | Workloads gerais          |
| High OLTP   | 10/50   | 5s      | Altíssimo volume          |
| Analytics   | 5/20    | 300s    | Relatórios e consultas    |
| Cloud       | 5/25    | 60s     | Integrado ao OCI/Wallet   |
| RAC/ADG     | 8/40    | 10s     | Alta disponibilidade real |

---

## 📊 Monitoramento e Performance

- Batch testado para **centenas de milhares de registros**
- RAC/ADG failover suportado via `EnterpriseConnectionPool`
- Pool manager com estatísticas: conexões, borrow, available, peak, failed
- Statement cache configurável, health-check customizável

---

## 🛡️ Segurança

- Suporte nativo a **SSL/TLS**, Wallet, CA, client cert, etc.
- **Connection Labeling** para auditoria session-state
- Parâmetros bind obrigatórios (sem SQL Injection)
- Logs detalhados e stacktraces orientados para troubleshooting corporativo

---

## 🧪 Estrutura do Projeto

```

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

## 🔧 Scripts e Desenvolvimento

```

npm run setup:java        \# Prepara ambiente Java
npm run download:jdbc     \# Orienta download dos drivers
npm run build             \# Build Typescript + assets
npm run dev               \# Hot reload / ambiente dev
npm run lint              \# ESLint + Prettier
npm run test              \# Testes automatizados
npm run validate          \# Checagem geral pré-release
npm run clean             \# Limpeza do dist

```

---

## 🤝 Contribuindo

Contribuições são **bem-vindas**!  
Siga o fluxo:

1. Fork
2. Branch de feature: `feature/nova-funcionalidade`
3. Commit e push
4. Pull-request explicativo  
Sugestões: correções, exemplos, otimizações, novos recursos, documentações, testes.

---

## 💰 Apoie este projeto

Se o projeto te ajuda, considere apoiar!

<div align="center">

### PIX:  
![QR Code PIX](image/README/qrcode-pix-jonatas.mei@outlook.com.png)

**Chave PIX:** [jonatas.mei@outlook.com](mailto:jonatas.mei@outlook.com)

</div>

---

## 📄 Licença

MIT License  
Copyright (c) 2025  
Jônatas Meireles Sousa Vieira

---

## 👨‍💻 Autor

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

**⭐ Dê uma estrela se gostou!**

[![GitHub stars](https://img.shields.io/github/stars/jonales/oracle-jdbc-advanced-n8n.svg?style=social&label=Star)](https://github.com/jonales/oracle-jdbc-advanced-n8n)
[![GitHub forks](https://img.shields.io/github/forks/jonales/oracle-jdbc-advanced-n8n.svg?style=social&label=Fork)](https://github.com/jonales/oracle-jdbc-advanced-n8n/fork)

Made with ❤️ 100% autoral, sem forks de terceiros!

</div>
