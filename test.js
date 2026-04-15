const db = require('better-sqlite3')('database.sqlite');
console.log(db.prepare("PRAGMA table_info('timetable')").all());