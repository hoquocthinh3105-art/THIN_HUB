import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import cron from "node-cron";
import * as XLSX from "xlsx";

import Stripe from "stripe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "thinhub-secret-key-2026";
const db = new Database("thinhub.db");

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT,
    full_name TEXT,
    role TEXT, -- 'teacher', 'officer', 'student'
    class_name TEXT,
    school_name TEXT,
    position TEXT, -- e.g., 'Lớp trưởng', 'Lớp phó'
    student_code TEXT,
    default_password TEXT,
    reset_code TEXT,
    reset_code_expires DATETIME,
    is_pro INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT,
    status TEXT, -- 'present', 'absent_permission', 'absent_no_permission', 'late'
    note TEXT,
    marked_by INTEGER,
    is_verified INTEGER DEFAULT 0,
    location_lat REAL,
    location_lng REAL,
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS discipline_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    week_start_date TEXT NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    type TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    subject TEXT,
    file_path TEXT,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    material_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, material_id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    deadline DATETIME,
    subject TEXT,
    file_path TEXT,
    teacher_id INTEGER,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    file_path TEXT,
    content TEXT,
    grade TEXT,
    feedback TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES assignments(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS showcase (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    image_path TEXT,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    content TEXT,
    is_private INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path TEXT,
    updated_by INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(updated_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS timetable_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER, -- 1 (Mon) to 7 (Sun)
    period INTEGER, -- 1 to 10
    subject TEXT,
    teacher_name TEXT,
    start_time TEXT, -- HH:mm
    end_time TEXT, -- HH:mm
    class_name TEXT
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    reason TEXT,
    period TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    stripe_session_id TEXT,
    amount INTEGER,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration to update users table schema and remove UNIQUE constraint
try {
  const tableInfo = db.prepare("PRAGMA table_info('users')").all() as any[];
  if (tableInfo.length > 0) {
    const existingColumns = tableInfo.map(c => c.name);
    const checkUnique = db.prepare("PRAGMA index_list('users')").all() as any[];
    const hasUnique = checkUnique.some(idx => idx.unique === 1);
    
    const requiredColumns = ['id', 'username', 'password', 'full_name', 'role', 'class_name', 'school_name', 'position'];
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c));
    
    if (hasUnique || missingColumns.length > 0) {
      console.log("Migrating users table... (hasUnique:", hasUnique, "missingColumns:", missingColumns, ")");
      db.transaction(() => {
        db.exec("PRAGMA foreign_keys=OFF;");
        db.exec(`
          CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            password TEXT,
            full_name TEXT,
            role TEXT,
            class_name TEXT,
            school_name TEXT,
            position TEXT,
            student_code TEXT,
            default_password TEXT,
            reset_code TEXT,
            reset_code_expires DATETIME,
            is_pro INTEGER DEFAULT 0
          );
        `);
        
        const commonColumns = requiredColumns.filter(c => existingColumns.includes(c));
        const columnsStr = commonColumns.join(', ');
        db.exec(`INSERT INTO users_new (${columnsStr}) SELECT ${columnsStr} FROM users;`);
        
        db.exec("DROP TABLE users;");
        db.exec("ALTER TABLE users_new RENAME TO users;");
        db.exec("PRAGMA foreign_keys=ON;");
      })();
      console.log("Migration successful.");
    }
  }

  // Migration for messages table to add receiver_id
  const messagesTableInfo = db.prepare("PRAGMA table_info('messages')").all() as any[];
  if (messagesTableInfo.length > 0) {
    const hasReceiverId = messagesTableInfo.some(c => c.name === 'receiver_id');
    if (!hasReceiverId) {
      console.log("Adding receiver_id to messages table...");
      db.exec("ALTER TABLE messages ADD COLUMN receiver_id INTEGER REFERENCES users(id);");
    }
  }

  // Migration for attendance table
  const attendanceTableInfo = db.prepare("PRAGMA table_info('attendance')").all() as any[];
  if (attendanceTableInfo.length > 0) {
    const hasIsVerified = attendanceTableInfo.some(c => c.name === 'is_verified');
    if (!hasIsVerified) {
      console.log("Adding new columns to attendance table...");
      db.exec("ALTER TABLE attendance ADD COLUMN is_verified INTEGER DEFAULT 0;");
      db.exec("ALTER TABLE attendance ADD COLUMN location_lat REAL;");
      db.exec("ALTER TABLE attendance ADD COLUMN location_lng REAL;");
    }
  }

  // Migration for users table to add student_code and default_password
  const usersTableInfo = db.prepare("PRAGMA table_info('users')").all() as any[];
  if (usersTableInfo.length > 0) {
    const hasStudentCode = usersTableInfo.some(c => c.name === 'student_code');
    if (!hasStudentCode) {
      console.log("Adding student_code to users table...");
      db.exec("ALTER TABLE users ADD COLUMN student_code TEXT;");
    }
    const hasDefaultPassword = usersTableInfo.some(c => c.name === 'default_password');
    if (!hasDefaultPassword) {
      console.log("Adding default_password to users table...");
      db.exec("ALTER TABLE users ADD COLUMN default_password TEXT;");
    }
    const hasIsPro = usersTableInfo.some(c => c.name === 'is_pro');
    if (!hasIsPro) {
      console.log("Adding is_pro to users table...");
      db.exec("ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0;");
    }
    const hasXp = usersTableInfo.some(c => c.name === 'xp');
    if (!hasXp) {
      console.log("Adding xp and level to users table...");
      db.exec("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;");
      db.exec("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1;");
    }
  }
} catch (e) {
  console.error("Migration error:", e);
}


// Seed default timetable slots if empty
const count = (db.prepare("SELECT COUNT(*) as count FROM timetable_slots").get() as any).count;
if (count === 0) {
  const slots = [
    { day: 1, p: 1, s: 'Toán học', t: 'Nguyễn Văn A', start: '07:30', end: '08:15' },
    { day: 1, p: 2, s: 'Toán học', t: 'Nguyễn Văn A', start: '08:20', end: '09:05' },
    { day: 1, p: 3, s: 'Vật lý', t: 'Trần Thị B', start: '09:15', end: '10:00' },
    { day: 1, p: 4, s: 'Hóa học', t: 'Lê Văn C', start: '10:10', end: '10:55' },
    { day: 1, p: 5, s: 'Sinh học', t: 'Phạm Thị D', start: '11:00', end: '11:45' },
    { day: 1, p: 6, s: 'Ngữ văn', t: 'Hoàng Văn E', start: '13:30', end: '14:15' },
    { day: 1, p: 7, s: 'Lịch sử', t: 'Đỗ Thị F', start: '14:20', end: '15:05' },
    { day: 1, p: 8, s: 'Địa lý', t: 'Bùi Văn G', start: '15:15', end: '16:00' },
    // Add for other days too
    { day: 2, p: 1, s: 'Tiếng Anh', t: 'Vũ Thị H', start: '07:30', end: '08:15' },
    { day: 3, p: 1, s: 'Tin học', t: 'Ngô Văn I', start: '07:30', end: '08:15' },
    { day: 4, p: 1, s: 'GDCD', t: 'Lý Thị K', start: '07:30', end: '08:15' },
    { day: 5, p: 1, s: 'Công nghệ', t: 'Trịnh Văn L', start: '07:30', end: '08:15' },
    { day: 6, p: 1, s: 'Thể dục', t: 'Mai Văn M', start: '07:30', end: '08:15' },
  ];
  const insert = db.prepare("INSERT INTO timetable_slots (day_of_week, period, subject, teacher_name, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)");
  slots.forEach(s => insert.run(s.day, s.p, s.s, s.t, s.start, s.end));
}

const app = express();
app.use(express.json());

// File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

interface AuthRequest extends express.Request {
  user?: any;
  file?: any;
}

// Auth Middleware
const authenticate = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Người dùng không tồn tại" });
    }
    req.user = user;
    next();
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" });
    }
    res.status(401).json({ error: "Token không hợp lệ" });
  }
};

// API Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    let { username, password, full_name, role, class_name, school_name, position, student_code } = req.body;
    
    // Auto-generate student_code if not provided
    if (!student_code) {
      student_code = `HS${Math.floor(10000 + Math.random() * 90000)}`;
    }

    // Auto-generate password if not provided
    let generatedPassword = password;
    if (!generatedPassword) {
      generatedPassword = Math.random().toString(36).slice(-6); // 6 random chars
    }

    // Auto-generate username if not provided
    if (!username) {
      username = `user_${Math.random().toString(36).substr(2, 5)}`;
    }

    // Check if a user with same username AND same password already exists
    const existingUsers = db.prepare("SELECT password FROM users WHERE username = ?").all(username);
    for (const u of existingUsers as any[]) {
      if (bcrypt.compareSync(generatedPassword, u.password)) {
        return res.status(400).json({ error: "Tài khoản với tên đăng nhập và mật khẩu này đã tồn tại. Vui lòng chọn mật khẩu khác." });
      }
    }

    const hashedPassword = bcrypt.hashSync(generatedPassword, 10);
    const info = db.prepare("INSERT INTO users (username, password, full_name, role, class_name, school_name, position, student_code, default_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(username, hashedPassword, full_name, role, class_name, school_name, position, student_code, generatedPassword);
    res.json({ id: info.lastInsertRowid, username, password: generatedPassword, student_code });
  } catch (e: any) {
    console.error("Registration error:", e);
    res.status(400).json({ error: "Có lỗi xảy ra khi đăng ký: " + e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: "Tên đăng nhập là bắt buộc" });
    }

    const users = db.prepare("SELECT * FROM users WHERE username = ?").all(username);
    
    let foundUser = null;
    for (const user of users as any[]) {
      if (user.password === null) {
        if (!password) {
          foundUser = user;
          break;
        }
      } else if (password && bcrypt.compareSync(password, user.password)) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      if (!password) {
        return res.status(400).json({ error: "Tên đăng nhập và mật khẩu là bắt buộc" });
      }
      return res.status(400).json({ error: "Sai tên đăng nhập hoặc mật khẩu" });
    }
      const token = jwt.sign({ id: foundUser.id, role: foundUser.role, full_name: foundUser.full_name, is_pro: foundUser.is_pro }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ 
        token, 
        user: { 
          id: foundUser.id, 
          username: foundUser.username, 
          full_name: foundUser.full_name, 
          role: foundUser.role, 
          position: foundUser.position, 
          school_name: foundUser.school_name,
          class_name: foundUser.class_name,
          is_pro: foundUser.is_pro,
          xp: foundUser.xp,
          level: foundUser.level
        } 
      });
  } catch (e: any) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Có lỗi xảy ra khi đăng nhập: " + e.message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Tên đăng nhập là bắt buộc" });
    
    const user = db.prepare("SELECT * FROM users WHERE username = ? LIMIT 1").get(username) as any;
    if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins

    db.prepare("UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?").run(code, expires, user.id);

    res.json({ success: true, message: "Mã xác nhận đã được tạo.", demo_code: code });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/verify-reset-code", async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) return res.status(400).json({ error: "Thiếu thông tin" });

    const user = db.prepare("SELECT * FROM users WHERE username = ? AND reset_code = ? LIMIT 1").get(username, code) as any;
    if (!user) return res.status(400).json({ error: "Mã xác nhận không đúng" });

    if (new Date(user.reset_code_expires) < new Date()) {
      return res.status(400).json({ error: "Mã xác nhận đã hết hạn" });
    }

    db.prepare("UPDATE users SET reset_code = NULL, reset_code_expires = NULL WHERE id = ?").run(user.id);

    const token = jwt.sign({ id: user.id, role: user.role, full_name: user.full_name, is_pro: user.is_pro }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        class_name: user.class_name,
        school_name: user.school_name,
        position: user.position,
        is_pro: user.is_pro,
        xp: user.xp,
        level: user.level
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/change-password", authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: "Thiếu mật khẩu mới" });

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) as any;
    
    if (!user) {
      return res.status(400).json({ error: "Không tìm thấy người dùng" });
    }

    if (user.password === null) {
      if (currentPassword) {
        return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
      }
    } else {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
      }
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.user.id);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/users", authenticate, (req: AuthRequest, res: express.Response) => {
  const users = db.prepare("SELECT id, username, full_name, role, position, class_name, school_name, student_code, default_password, is_pro, xp, level FROM users").all();
  res.json(users);
});

app.put("/api/users/:id", authenticate, (req: AuthRequest, res: express.Response) => {
  const isSelf = req.user.id === parseInt(req.params.id);
  
  if (!isSelf && req.user.role !== 'teacher' && req.user.role !== 'officer') {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  // Check if officer is trying to edit a teacher or another officer (maybe allow officer to edit students only)
  const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  if (!isSelf && req.user.role === 'officer' && targetUser.role !== 'student') {
    return res.status(403).json({ error: "Officers can only edit students" });
  }

  const { full_name, role, position, class_name, school_name, username, password, student_code } = req.body;
  
  // If self and student, don't allow changing role or student_code
  let finalRole = role !== undefined ? role : targetUser.role;
  let finalStudentCode = student_code !== undefined ? student_code : targetUser.student_code;
  if (isSelf && req.user.role === 'student') {
    finalRole = 'student';
    finalStudentCode = targetUser.student_code;
  }

  let finalFullName = full_name !== undefined ? full_name : targetUser.full_name;
  let finalPosition = position !== undefined ? position : targetUser.position;
  let finalClassName = class_name !== undefined ? class_name : targetUser.class_name;
  let finalSchoolName = school_name !== undefined ? school_name : targetUser.school_name;
  let finalUsername = username !== undefined ? username : targetUser.username;

  let query = "UPDATE users SET full_name = ?, role = ?, position = ?, class_name = ?, school_name = ?, username = ?, student_code = ?";
  let params = [finalFullName, finalRole, finalPosition, finalClassName, finalSchoolName, finalUsername, finalStudentCode];

  if (password) {
    query += ", password = ?";
    params.push(bcrypt.hashSync(password, 10));
  }
  
  query += " WHERE id = ?";
  params.push(req.params.id);

  db.prepare(query).run(...params);
  res.json({ success: true });
});

app.post("/api/users/bulk", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'officer') return res.status(403).json({ error: "Forbidden" });
  const { students } = req.body;
  
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  }

  try {
    const insertStmt = db.prepare(`
      INSERT INTO users (username, password, full_name, role, class_name, school_name, position, student_code, default_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkUserStmt = db.prepare("SELECT id FROM users WHERE username = ?");
    const checkCodeStmt = db.prepare("SELECT id FROM users WHERE student_code = ?");

    const generateRandomString = (length: number) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const transaction = db.transaction((students) => {
      for (const student of students) {
        // Basic validation and default values
        let baseUsername = student.username || `student_${Math.random().toString(36).substr(2, 5)}`;
        // Clean up username (remove spaces, special chars)
        baseUsername = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        let finalUsername = baseUsername;
        let counter = 1;
        
        // Ensure username is unique
        while (checkUserStmt.get(finalUsername)) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        const fullName = student.full_name || "Chưa rõ tên";
        const className = student.class_name || "Chưa rõ lớp";
        const position = student.position || "Học sinh";
        const role = "student";
        const schoolName = req.user.school_name || "";
        
        let studentCode = student.student_code;
        if (!studentCode) {
          // Generate random 6-digit ID
          do {
            studentCode = Math.floor(100000 + Math.random() * 900000).toString();
          } while (checkCodeStmt.get(studentCode));
        }

        const randomPassword = generateRandomString(6);
        const hashedPassword = bcrypt.hashSync(randomPassword, 10);

        insertStmt.run(finalUsername, hashedPassword, fullName, role, className, schoolName, position, studentCode, randomPassword);
      }
    });

    transaction(students);
    res.json({ success: true, count: students.length });
  } catch (e: any) {
    console.error("Bulk import error:", e);
    res.status(500).json({ error: "Lỗi khi nhập dữ liệu: " + e.message });
  }
});

app.get("/api/discipline", authenticate, (req: AuthRequest, res: express.Response) => {
  const { week_start_date } = req.query;
  let query = `
    SELECT d.*, u.full_name as student_name, c.full_name as creator_name
    FROM discipline_records d
    JOIN users u ON d.student_id = u.id
    JOIN users c ON d.created_by = c.id
  `;
  const params: any[] = [];
  
  if (week_start_date) {
    query += " WHERE d.week_start_date = ?";
    params.push(week_start_date);
  }
  
  query += " ORDER BY d.created_at DESC";
  
  const records = db.prepare(query).all(...params);
  res.json(records);
});

app.post("/api/discipline", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'officer') return res.status(403).json({ error: "Forbidden" });
  const { student_id, week_start_date, points, reason } = req.body;
  
  db.prepare("INSERT INTO discipline_records (student_id, week_start_date, points, reason, created_by) VALUES (?, ?, ?, ?, ?)")
    .run(student_id, week_start_date, points, reason, req.user.id);
  res.json({ success: true });
});

app.delete("/api/discipline/:id", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'officer') return res.status(403).json({ error: "Forbidden" });
  db.prepare("DELETE FROM discipline_records WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/api/attendance", authenticate, (req: AuthRequest, res: express.Response) => {
  const attendance = db.prepare(`
    SELECT a.*, u.full_name as student_name 
    FROM attendance a 
    JOIN users u ON a.student_id = u.id
  `).all();
  res.json(attendance);
});

app.post("/api/attendance", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
  const { student_id, date, status, note } = req.body;
  db.prepare("INSERT INTO attendance (student_id, date, status, note, marked_by) VALUES (?, ?, ?, ?, ?)")
    .run(student_id, date, status, note, req.user.id);
  res.json({ success: true });
});

app.post("/api/attendance/self", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: "Only students can self-check-in" });
  const { status, note, location_lat, location_lng } = req.body;
  const date = new Date().toISOString().split('T')[0];
  
  // Check if already marked today
  const existing = db.prepare("SELECT * FROM attendance WHERE student_id = ? AND date = ?").get(req.user.id, date);
  if (existing) {
    return res.status(400).json({ error: "Bạn đã điểm danh hôm nay rồi" });
  }

  db.prepare("INSERT INTO attendance (student_id, date, status, note, marked_by, location_lat, location_lng) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(req.user.id, date, status, note, req.user.id, location_lat, location_lng);
  res.json({ success: true });
});

app.put("/api/attendance/verify", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'officer' && req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { date } = req.body;
  
  db.prepare("UPDATE attendance SET is_verified = 1 WHERE date = ?").run(date);

  // Generate Excel report
  try {
    const students = db.prepare("SELECT * FROM users WHERE role = 'student'").all() as any[];
    const attendanceRecords = db.prepare("SELECT * FROM attendance WHERE date = ?").all(date) as any[];
    
    const statusMap: Record<string, string> = { 
      present: 'Hiện diện', 
      absent_permission: 'Vắng có phép', 
      absent_no_permission: 'Vắng không phép', 
      late: 'Đi trễ' 
    };

    const rows = students.map(student => {
      const record = attendanceRecords.find(a => a.student_id === student.id);
      return {
        'Học sinh': student.full_name,
        'ID': student.id,
        'Trạng thái': record ? statusMap[record.status] || record.status : 'Chưa điểm danh',
        'Ghi chú': record?.note || '',
        'Ngày': date
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Điểm danh");
    
    const fileName = `DiemDanh_${date}_${Date.now()}.xlsx`;
    const filePath = path.join(uploadsDir, fileName);
    XLSX.writeFile(workbook, filePath);

    // Send notification to teachers
    const teachers = db.prepare("SELECT id FROM users WHERE role = 'teacher'").all() as any[];
    const stmt = db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)");
    
    db.transaction(() => {
      for (const teacher of teachers) {
        stmt.run(
          teacher.id, 
          'Báo cáo điểm danh mới', 
          `Lớp trưởng đã chốt điểm danh ngày ${date}. [Tải báo cáo](/uploads/${fileName})`, 
          'attendance_report'
        );
      }
    })();
  } catch (e) {
    console.error("Error generating report:", e);
  }

  res.json({ success: true });
});

app.get("/api/materials", authenticate, (req: AuthRequest, res: express.Response) => {
  const materials = db.prepare(`
    SELECT m.*, 
           CASE WHEN sm.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
    FROM materials m
    LEFT JOIN saved_materials sm ON m.id = sm.material_id AND sm.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.user.id);
  res.json(materials);
});

app.post("/api/materials/:id/save", authenticate, (req: AuthRequest, res: express.Response) => {
  const materialId = req.params.id;
  const userId = req.user.id;
  
  const existing = db.prepare("SELECT id FROM saved_materials WHERE user_id = ? AND material_id = ?").get(userId, materialId);
  
  if (existing) {
    db.prepare("DELETE FROM saved_materials WHERE user_id = ? AND material_id = ?").run(userId, materialId);
    res.json({ success: true, is_saved: false });
  } else {
    db.prepare("INSERT INTO saved_materials (user_id, material_id) VALUES (?, ?)").run(userId, materialId);
    res.json({ success: true, is_saved: true });
  }
});

app.post("/api/materials", authenticate, upload.single('file'), (req: AuthRequest, res: express.Response) => {
  const { title, subject } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare("INSERT INTO materials (title, subject, file_path, uploaded_by) VALUES (?, ?, ?, ?)")
    .run(title, subject, file_path, req.user.id);
  res.json({ success: true });
});

app.get("/api/assignments", authenticate, (req: AuthRequest, res: express.Response) => {
  const assignments = db.prepare(`
    SELECT a.*, u.full_name as teacher_name 
    FROM assignments a 
    JOIN users u ON a.teacher_id = u.id 
    ORDER BY deadline ASC
  `).all();
  res.json(assignments);
});

app.post("/api/assignments", authenticate, upload.single('file'), (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { title, description, deadline, subject } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare("INSERT INTO assignments (title, description, deadline, subject, file_path, teacher_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(title, description, deadline, subject, file_path, req.user.id);
  res.json({ success: true });
});

// Timetable API
app.get("/api/timetable", authenticate, (req: AuthRequest, res: express.Response) => {
  const timetable = db.prepare(`
    SELECT t.*, u.full_name as author_name 
    FROM timetable t 
    JOIN users u ON t.updated_by = u.id 
    ORDER BY updated_at DESC LIMIT 1
  `).get();
  res.json(timetable || null);
});

app.get("/api/test-schema", (req, res) => {
  const schema = db.prepare("PRAGMA table_info('timetable')").all();
  res.json(schema);
});

app.post("/api/timetable", authenticate, upload.single('image'), (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare("INSERT INTO timetable (image_path, updated_by) VALUES (?, ?)")
    .run(image_path, req.user.id);
  res.json({ success: true });
});

app.post("/api/submissions", authenticate, upload.single('file'), (req: AuthRequest, res: express.Response) => {
  const { assignment_id, content } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  
  // Check deadline
  const assignment: any = db.prepare("SELECT deadline FROM assignments WHERE id = ?").get(assignment_id);
  if (new Date() > new Date(assignment.deadline)) {
    return res.status(400).json({ error: "Deadline passed" });
  }

  db.prepare("INSERT INTO submissions (assignment_id, student_id, file_path, content) VALUES (?, ?, ?, ?)")
    .run(assignment_id, req.user.id, file_path, content);
  res.json({ success: true });
});

app.get("/api/submissions", authenticate, (req: AuthRequest, res: express.Response) => {
  let submissions;
  if (req.user.role === 'student') {
    submissions = db.prepare(`
      SELECT s.*, u.full_name as student_name 
      FROM submissions s 
      JOIN users u ON s.student_id = u.id
      WHERE s.student_id = ?
    `).all(req.user.id);
  } else {
    submissions = db.prepare(`
      SELECT s.*, u.full_name as student_name 
      FROM submissions s 
      JOIN users u ON s.student_id = u.id
    `).all();
  }
  res.json(submissions);
});

app.get("/api/submissions/:assignmentId", authenticate, (req: AuthRequest, res: express.Response) => {
  const submissions = db.prepare(`
    SELECT s.*, u.full_name as student_name 
    FROM submissions s 
    JOIN users u ON s.student_id = u.id
    WHERE s.assignment_id = ?
  `).all(req.params.assignmentId);
  res.json(submissions);
});

app.put("/api/submissions/:id/grade", authenticate, (req: AuthRequest, res: express.Response) => {
  // AI grading will be done on frontend and sent here, or teacher manual grade
  const { grade, feedback } = req.body;
  db.prepare("UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?")
    .run(grade, feedback, req.params.id);
  res.json({ success: true });
});

// Leave Requests API
app.get("/api/leave-requests", authenticate, (req: AuthRequest, res: express.Response) => {
  let query = `
    SELECT lr.*, u.full_name as student_name, t.full_name as teacher_name
    FROM leave_requests lr
    JOIN users u ON lr.student_id = u.id
    LEFT JOIN users t ON lr.approved_by = t.id
  `;
  let params: any[] = [];

  if (req.user.role === 'student') {
    query += " WHERE lr.student_id = ?";
    params.push(req.user.id);
  } else if (req.user.role === 'teacher') {
    // Teachers see all requests for their class (simplified here to all requests)
    query += " ORDER BY lr.created_at DESC";
  } else {
    query += " ORDER BY lr.created_at DESC";
  }

  const requests = db.prepare(query).all(...params);
  res.json(requests);
});

app.post("/api/leave-requests", authenticate, (req: AuthRequest, res: express.Response) => {
  const { reason, period } = req.body;
  db.prepare("INSERT INTO leave_requests (student_id, reason, period) VALUES (?, ?, ?)")
    .run(req.user.id, reason, period);
  res.json({ success: true });
});

app.put("/api/leave-requests/:id", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { status } = req.body;
  db.prepare("UPDATE leave_requests SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(status, req.user.id, req.params.id);
  res.json({ success: true });
});

// Timetable Slots API
app.get("/api/timetable-slots", authenticate, (req: AuthRequest, res: express.Response) => {
  const slots = db.prepare("SELECT * FROM timetable_slots ORDER BY day_of_week, period").all();
  res.json(slots);
});

app.post("/api/timetable-slots", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const slots = req.body; // Expecting an array of slots
  
  const deleteStmt = db.prepare("DELETE FROM timetable_slots");
  const insertStmt = db.prepare(`
    INSERT INTO timetable_slots (day_of_week, period, subject, teacher_name, start_time, end_time, class_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((slots) => {
    deleteStmt.run();
    for (const slot of slots) {
      insertStmt.run(slot.day_of_week, slot.period, slot.subject, slot.teacher_name, slot.start_time, slot.end_time, slot.class_name);
    }
  });

  transaction(slots);
  res.json({ success: true });
});

app.get("/api/announcements", authenticate, (req: AuthRequest, res: express.Response) => {
  const announcements = db.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
  res.json(announcements);
});

app.post("/api/announcements", authenticate, (req: AuthRequest, res: express.Response) => {
  if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
  const { title, content } = req.body;
  db.prepare("INSERT INTO announcements (title, content) VALUES (?, ?)")
    .run(title, content);
  res.json({ success: true });
});

// Showcase API
app.get("/api/showcase", authenticate, (req: AuthRequest, res: express.Response) => {
  const showcase = db.prepare(`
    SELECT s.*, u.full_name as author_name 
    FROM showcase s 
    JOIN users u ON s.uploaded_by = u.id 
    ORDER BY created_at DESC
  `).all();
  res.json(showcase);
});

app.post("/api/showcase", authenticate, upload.single('image'), (req: AuthRequest, res: express.Response) => {
  const { title, description } = req.body;
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare("INSERT INTO showcase (title, description, image_path, uploaded_by) VALUES (?, ?, ?, ?)")
    .run(title, description, image_path, req.user.id);
  res.json({ success: true });
});

// Messages API (Chat)
app.get("/api/messages", authenticate, (req: AuthRequest, res: express.Response) => {
  const { is_private, receiver_id } = req.query;
  const privateVal = is_private === 'true' ? 1 : 0;
  
  if (privateVal === 1) {
    if (!receiver_id) {
      return res.status(400).json({ error: "receiver_id is required for private messages" });
    }
    const messages = db.prepare(`
      SELECT m.*, u.full_name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_private = 1 AND (
        (m.sender_id = ? AND m.receiver_id = ?) OR 
        (m.sender_id = ? AND m.receiver_id = ?)
      )
      ORDER BY m.created_at ASC
    `).all(req.user.id, receiver_id, receiver_id, req.user.id);
    return res.json(messages);
  } else {
    const messages = db.prepare(`
      SELECT m.*, u.full_name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_private = 0
      ORDER BY m.created_at ASC
    `).all();
    return res.json(messages);
  }
});

app.post("/api/messages", authenticate, (req: AuthRequest, res: express.Response) => {
  const { content, is_private, receiver_id } = req.body;
  const privateVal = is_private ? 1 : 0;

  if (privateVal === 1) {
    if (!receiver_id) {
      return res.status(400).json({ error: "receiver_id is required for private messages" });
    }
    db.prepare("INSERT INTO messages (sender_id, receiver_id, content, is_private) VALUES (?, ?, ?, 1)")
      .run(req.user.id, receiver_id, content);
  } else {
    db.prepare("INSERT INTO messages (sender_id, content, is_private) VALUES (?, ?, 0)")
      .run(req.user.id, content);
  }
  res.json({ success: true });
});

// Notifications API
app.get("/api/notifications", authenticate, (req: AuthRequest, res: express.Response) => {
  const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(notifications);
});

app.put("/api/notifications/:id/read", authenticate, (req: AuthRequest, res: express.Response) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Cron Jobs for Attendance
// 6:45 AM (Monday - Friday): Send Push Notification to student accounts
cron.schedule('45 6 * * 1-5', () => {
  console.log('Running cron job: Send attendance notification to students');
  const students = db.prepare("SELECT id FROM users WHERE role = 'student'").all() as any[];
  const stmt = db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)");
  
  db.transaction(() => {
    for (const student of students) {
      stmt.run(student.id, 'Điểm danh đầu giờ', 'Vui lòng xác nhận điểm danh của bạn cho ngày hôm nay.', 'attendance_reminder');
    }
  })();
}, { timezone: 'Asia/Bangkok' });

// 7:00 AM: Auto-mark absent without permission for the previous day
cron.schedule('0 7 * * *', () => {
  console.log('Running cron job: Auto-mark absent without permission for yesterday');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = yesterday.toISOString().split('T')[0];
  
  // Get all students who haven't checked in for yesterday
  const studentsWithoutAttendance = db.prepare(`
    SELECT u.id FROM users u 
    WHERE u.role = 'student' AND u.id NOT IN (
      SELECT student_id FROM attendance WHERE date = ?
    )
  `).all(targetDate) as any[];

  const stmt = db.prepare("INSERT INTO attendance (student_id, date, status, note, marked_by) VALUES (?, ?, 'absent_no_permission', 'Hệ thống tự động đánh vắng', 0)");
  
  db.transaction(() => {
    for (const student of studentsWithoutAttendance) {
      stmt.run(student.id, targetDate);
    }
  })();
}, { timezone: 'Asia/Bangkok' });

// 6:55 AM (Monday - Friday): Send dashboard to class leader
cron.schedule('55 6 * * 1-5', () => {
  console.log('Running cron job: Send dashboard to class leader');
  const officers = db.prepare("SELECT id FROM users WHERE role = 'officer'").all() as any[];
  const stmt = db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)");
  
  db.transaction(() => {
    for (const officer of officers) {
      stmt.run(officer.id, 'Xác nhận điểm danh', 'Hệ thống đã tổng hợp điểm danh. Vui lòng kiểm tra và xác nhận.', 'attendance_verify');
    }
  })();
}, { timezone: 'Asia/Bangkok' });

// Serve uploads
app.use("/uploads", express.static(uploadsDir));

// Stripe Payment API
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

app.post("/api/create-checkout-session", authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    // Check if user is teacher or already pro
    const user = db.prepare("SELECT role, is_pro FROM users WHERE id = ?").get(req.user.id) as any;
    if (user.role === 'teacher' || user.is_pro) {
      return res.status(400).json({ error: "Tài khoản của bạn đã có quyền Pro, không cần thanh toán thêm." });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: 'THIN_HUB Pro (1 tháng)',
              description: 'Mở khóa toàn bộ tính năng AI và phân tích chuyên sâu.',
            },
            unit_amount: 49000,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/premium?success=true`,
      cancel_url: `${process.env.APP_URL}/premium?canceled=true`,
      client_reference_id: req.user.id.toString(),
    });

    if (session.id) {
      db.prepare("INSERT INTO payments (user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?)")
        .run(req.user.id, session.id, 49000, 'pending');
    }

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("Stripe error:", e);
    if (e.type === 'StripeAuthenticationError') {
      return res.status(500).json({ error: "API Key của Stripe không hợp lệ. Vui lòng kiểm tra lại STRIPE_SECRET_KEY trong Settings > Secrets." });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/webhook", express.raw({type: 'application/json'}), (req: express.Request, res: express.Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return res.status(400).send('Webhook secret not configured');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    
    if (userId) {
      // Update payment status
      db.prepare("UPDATE payments SET status = 'completed' WHERE stripe_session_id = ?")
        .run(session.id);
      
      // Update user role to pro (or add a pro flag)
      // For now, we just log it or we could add a 'is_pro' column to users table
      try {
        // Check if is_pro column exists
        const tableInfo = db.prepare("PRAGMA table_info('users')").all() as any[];
        const hasIsPro = tableInfo.some(c => c.name === 'is_pro');
        if (!hasIsPro) {
          db.exec("ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0;");
        }
        db.prepare("UPDATE users SET is_pro = 1 WHERE id = ?").run(userId);
      } catch (e) {
        console.error("Error updating user pro status:", e);
      }
    }
  }

  res.json({received: true});
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
