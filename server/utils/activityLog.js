const db = require('../config/db');

async function logActivity(userId, action, targetTable, targetId) {
  await db.query(
    'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
    [userId, action, targetTable, targetId]
  );
}

module.exports = { logActivity };
