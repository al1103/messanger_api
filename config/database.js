const sql = require("mssql");

const config = {
  server: "ZILONG\\SQLEXPRESS",
  database: "network_social",
  user: "sa",
  password: "12345678",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to MSSQL");
    return pool;
  })
  .catch((err) => console.log("Database Connection Failed! Bad Config: ", err));

module.exports = {
  sql,
  poolPromise,
};
