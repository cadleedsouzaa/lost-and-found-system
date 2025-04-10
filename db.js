// db.js
const mysql = require('mysql2');


const pool = mysql.createPool({
  host: 'localhost',           
  user: 'root',                
  password: 'cadlee',          
  database: 'lost_and_found_db',
  waitForConnections: true,
  connectionLimit: 10,         
  queueLimit: 0
});


pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error connecting to MySQL database pool:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('-> Check MySQL username and password in db.js');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
        console.error(`-> Database '${pool.config.database}' not found. Did you create it?`);
    }
    
    return;
  }
  if (connection) {
    console.log('✅ Successfully connected to the database pool.');
    connection.release(); 
  }
});


module.exports = pool.promise();