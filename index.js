// 📁 backend/index.js
require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;
const SECRET = process.env.JWT_SECRET;

const path = require('path');

// Отдаём фронтенд из папки build
app.use(express.static(path.join(__dirname, 'task-manager-frontend/build')));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // если переменная не задана, разрешаем все
  credentials: true
}));

app.use(bodyParser.json());

const db = new sqlite3.Database('./database.db');

// Create tables
const initDB = () => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'не выполнено'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    user_id INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS completion_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    user_id INTEGER,
    requested_at TEXT,
    status TEXT DEFAULT 'ожидает подтверждения'
  )`);
};

initDB();

//  Функция проверки токена

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Регистрация нового пользователя (только админ)
app.post('/register', (req, res) => {
  const { name, username, password, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    [name, username, hash, role],
    function (err) {
      if (err) return res.status(400).json({ error: 'Имя пользователя занято' });
      res.json({ id: this.lastID });
    }
  );
});

// Авторизация
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Неверные данные' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
    res.json({ token, user: { name: user.name, role: user.role } });
  });
});

//добавление пользователя

app.post('/users', authenticateToken, async (req, res) => {
  const { name, username, password, role } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (!name || !username || !password || !role) {
    return res.status(400).json({ message: 'Missing fields' });
  }

	//новая часть
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, existingUser) => {
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists!' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    [name, username, hashedPassword, role],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({ message: 'User created successfully' });
    }
  );
  });
  
  // УДАЛИТЬ ПОЗЖЕ
});

// Создание новой задачи и назначение исполнителей
app.post('/tasks', authenticateToken, (req, res) => {
  const { title, description, due_date, assignees } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ message: 'Название задачи обязательно' });
  }

  if (!Array.isArray(assignees) || assignees.length === 0) {
    return res.status(400).json({ message: 'Необходимо выбрать хотя бы одного исполнителя' });
  }
  
  db.run(
    `INSERT INTO tasks (title, description, due_date) VALUES (?, ?, ?)`,
    [title, description, due_date],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error' });

      const taskId = this.lastID;

      // Назначаем пользователей на задачу
      const stmt = db.prepare(`INSERT INTO task_assignments (task_id, user_id) VALUES (?, ?)`);
      for (const userId of assignees) {
        stmt.run(taskId, userId);
      }
      stmt.finalize();

      res.json({ message: 'Задача создана и назначена' });
    }
  );
});

app.get('/all-users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  db.all(`SELECT id, name, username FROM users`, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows);
  });
});

// Получение всех задач с назначенными исполнителями и статусами
app.get('/tasks', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let sql = `
    SELECT tasks.id, tasks.title, tasks.description, tasks.due_date, tasks.status,
      GROUP_CONCAT(users.name, ', ') as executors
    FROM tasks
    LEFT JOIN task_assignments ON tasks.id = task_assignments.task_id
    LEFT JOIN users ON task_assignments.user_id = users.id
  `;

  if (userRole === 'worker') {
    sql += ` WHERE users.id = ? `;
  }

  sql += ` GROUP BY tasks.id`;

  const params = userRole === 'worker' ? [userId] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// Получить список всех пользователей (только для админа)
app.get('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  db.all(`SELECT id, name, username, role FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

// Удаление пользователя (только админ)
app.delete('/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const userId = req.params.id;

  db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
    if (err) return res.status(500).json({ message: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json({ message: 'Пользователь удалён' });
  });
});

// Удаление задачи (только для администратора)
app.delete('/tasks/:id', authenticateToken, (req, res) => {
  const taskId = req.params.id;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Сначала удаляем связанные назначения
  db.run(`DELETE FROM task_assignments WHERE task_id = ?`, [taskId], function (err) {
    if (err) return res.status(500).json({ message: 'Ошибка при удалении назначений' });

    // Затем удаляем саму задачу
    db.run(`DELETE FROM tasks WHERE id = ?`, [taskId], function (err) {
      if (err) return res.status(500).json({ message: 'Ошибка при удалении задачи' });

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Задача не найдена' });
      }

      res.json({ message: 'Задача успешно удалена' });
    });
  });
});

// Обновление пользователя
app.put('/users/:id', authenticateToken, (req, res) => {
  const userId = parseInt(req.params.id);
  const { name, username, role } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (!name || !username || !role) {
    return res.status(400).json({ message: 'Все поля обязательны' });
  }

  if (!['admin', 'worker'].includes(role)) {
    return res.status(400).json({ message: 'Недопустимая роль' });
  }

  // Проверка: логин уже занят другим пользователем
  db.get(`SELECT * FROM users WHERE username = ? AND id != ?`, [username, userId], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Ошибка базы данных' });

    if (existing) {
      return res.status(400).json({ message: 'Логин уже используется другим пользователем' });
    }

    db.run(
      `UPDATE users SET name = ?, username = ?, role = ? WHERE id = ?`,
      [name, username, role, userId],
      function (err) {
        if (err) return res.status(500).json({ message: 'Ошибка обновления' });

        if (this.changes === 0) {
          return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json({ message: 'Пользователь обновлён' });
      }
    );
  });
});


//Изменение статуса задачи
app.put('/tasks/:id/status', authenticateToken, (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;

  db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, taskId], function (err) {
    if (err) return res.status(500).json({ error: 'Ошибка обновления' });
    res.json({ message: 'Статус обновлён' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Для всех остальных маршрутов (которые не API) отдаём index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'task-manager-frontend/build', 'index.html'));
});

