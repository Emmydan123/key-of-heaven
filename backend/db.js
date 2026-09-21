const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "key_of_heaven",
    multipleStatements: true
});

db.connect((err) => {
    if (err) {
        console.error("❌ MySQL connection failed:");
        console.error(err.message);
        return;
    }

    console.log("✅ Connected to MySQL: key_of_heaven");

    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    db.query(schema, (schemaError) => {
        if (schemaError) {
            console.error("❌ MySQL schema initialization failed:");
            console.error(schemaError.message);
            return;
        }

        console.log("✅ MySQL schema is ready.");
    });
});

module.exports = db;