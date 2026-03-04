import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("edu_platform.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role_id INTEGER,
    FOREIGN KEY(role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    min_score REAL DEFAULT 60.0,
    time_limit_minutes INTEGER,
    created_by INTEGER,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    type TEXT, -- 'multiple_choice', 'true_false', 'fill_blanks', 'open', 'matching', 'ordering', 'oral'
    content TEXT,
    multimedia_url TEXT,
    multimedia_type TEXT, -- 'image', 'audio', 'video'
    points REAL DEFAULT 1.0,
    FOREIGN KEY(exam_id) REFERENCES exams(id)
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER,
    content TEXT,
    is_correct INTEGER DEFAULT 0,
    sort_order INTEGER,
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    exam_id INTEGER,
    score REAL,
    passed INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(exam_id) REFERENCES exams(id)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER,
    question_id INTEGER,
    answer_text TEXT,
    option_id INTEGER,
    audio_url TEXT,
    is_correct INTEGER,
    points_earned REAL,
    FOREIGN KEY(attempt_id) REFERENCES attempts(id),
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS reinforcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    title TEXT,
    content TEXT,
    resource_url TEXT,
    resource_type TEXT, -- 'video', 'pdf', 'audio'
    FOREIGN KEY(exam_id) REFERENCES exams(id)
  );
`);

// Seed Roles and Admin
const seed = () => {
  const rolesCount = db.prepare("SELECT count(*) as count FROM roles").get() as { count: number };
  if (rolesCount.count === 0) {
    db.prepare("INSERT INTO roles (name) VALUES (?)").run("admin");
    db.prepare("INSERT INTO roles (name) VALUES (?)").run("student");
  }

  const usersCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
  if (usersCount.count === 0) {
    // Default admin: admin/admin
    db.prepare("INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)").run("admin", "admin", 1);
    // Default student: student/student
    db.prepare("INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)").run("student", "student", 2);
    // New student: estudiante1/password123
    db.prepare("INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)").run("estudiante1", "password123", 2);
  } else {
    // Check if estudiante1 exists, if not add it
    const userExists = db.prepare("SELECT id FROM users WHERE username = ?").get("estudiante1");
    if (!userExists) {
      db.prepare("INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)").run("estudiante1", "password123", 2);
    }
  }

  const examsCount = db.prepare("SELECT count(*) as count FROM exams").get() as { count: number };
  if (examsCount.count === 0) {
    // Seed a sample exam
    const examId = db.prepare("INSERT INTO exams (title, description, min_score, time_limit_minutes, created_by) VALUES (?, ?, ?, ?, ?)").run(
      "Introducción a la Biología", 
      "Examen básico sobre conceptos de biología celular.", 
      70, 
      15, 
      1
    ).lastInsertRowid;

    const q1 = db.prepare("INSERT INTO questions (exam_id, type, content, points) VALUES (?, ?, ?, ?)").run(
      examId, 'multiple_choice', '¿Cuál es la unidad básica de la vida?', 2.0
    ).lastInsertRowid;
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(q1, 'Átomo', 0);
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(q1, 'Célula', 1);
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(q1, 'Molécula', 0);

    const q2 = db.prepare("INSERT INTO questions (exam_id, type, content, points) VALUES (?, ?, ?, ?)").run(
      examId, 'true_false', 'Las plantas realizan fotosíntesis.', 1.0
    ).lastInsertRowid;
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(q2, 'Verdadero', 1);
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(q2, 'Falso', 0);

    const q3 = db.prepare("INSERT INTO questions (exam_id, type, content, points) VALUES (?, ?, ?, ?)").run(
      examId, 'oral', 'Explica brevemente el proceso de la mitosis.', 5.0
    ).lastInsertRowid;

    db.prepare("INSERT INTO reinforcements (exam_id, title, content, resource_url, resource_type) VALUES (?, ?, ?, ?, ?)").run(
      examId, 
      "Repaso de Biología Celular", 
      "Mira este video para reforzar tus conocimientos sobre la célula.", 
      "https://www.youtube.com/embed/dQw4w9WgXcQ", 
      "video"
    );
  }

  // Seed English Exam example
  const englishExamExists = db.prepare("SELECT id FROM exams WHERE title = ?").get("Examen de Inglés Básico");
  if (!englishExamExists) {
    const engExamId = db.prepare("INSERT INTO exams (title, description, min_score, time_limit_minutes, created_by) VALUES (?, ?, ?, ?, ?)").run(
      "Examen de Inglés Básico", 
      "Evaluación de verbos y vocabulario esencial.", 
      80, 
      10, 
      1
    ).lastInsertRowid;

    const eq1 = db.prepare("INSERT INTO questions (exam_id, type, content, points) VALUES (?, ?, ?, ?)").run(
      engExamId, 'multiple_choice', 'What is the past tense of "Go"?', 5.0
    ).lastInsertRowid;
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(eq1, 'Went', 1);
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(eq1, 'Gone', 0);
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(eq1, 'Goes', 0);

    const eq2 = db.prepare("INSERT INTO questions (exam_id, type, content, points) VALUES (?, ?, ?, ?)").run(
      engExamId, 'true_false', '"Apple" is a verb.', 5.0
    ).lastInsertRowid;
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(eq2, 'True', 0);
    db.prepare("INSERT INTO options (question_id, content, is_correct) VALUES (?, ?, ?)").run(eq2, 'False', 1);

    db.prepare("INSERT INTO reinforcements (exam_id, title, content, resource_url, resource_type) VALUES (?, ?, ?, ?, ?)").run(
      engExamId, 
      "Clase Grabada: Verbos Irregulares", 
      "En esta sesión grabada, el Prof. García explica los errores más comunes en el uso de verbos en pasado.", 
      "https://www.youtube.com/embed/L9A8kZ6M-vM", 
      "video"
    );

    db.prepare("INSERT INTO reinforcements (exam_id, title, content, resource_url, resource_type) VALUES (?, ?, ?, ?, ?)").run(
      engExamId, 
      "Clase Grabada: El Verbo 'To Be'", 
      "Repaso intensivo sobre el uso correcto del verbo ser/estar en presente y pasado.", 
      "https://www.youtube.com/embed/i-3kGN_9S9E", 
      "video"
    );

    db.prepare("INSERT INTO reinforcements (exam_id, title, content, resource_url, resource_type) VALUES (?, ?, ?, ?, ?)").run(
      engExamId, 
      "Clase Grabada: Vocabulario de la Vida Diaria", 
      "Sesión práctica sobre sustantivos y adjetivos comunes en contextos cotidianos.", 
      "https://www.youtube.com/embed/L9A8kZ6M-vM", 
      "video"
    );

    db.prepare("INSERT INTO reinforcements (exam_id, title, content, resource_url, resource_type) VALUES (?, ?, ?, ?, ?)").run(
      engExamId, 
      "Guía de Estudio: Vocabulario Básico", 
      "Documento PDF con el vocabulario esencial para este nivel.", 
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 
      "pdf"
    );

    // Create a failed attempt for estudiante1
    const student = db.prepare("SELECT id FROM users WHERE username = ?").get("estudiante1") as any;
    if (student) {
      const attemptId = db.prepare("INSERT INTO attempts (user_id, exam_id, score, passed, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)").run(
        student.id, engExamId, 50.0, 0
      ).lastInsertRowid;

      // Add one correct and one incorrect response
      db.prepare(`
        INSERT INTO responses (attempt_id, question_id, option_id, is_correct, points_earned)
        VALUES (?, ?, ?, ?, ?)
      `).run(attemptId, eq1, 0, 0, 0); // Incorrect for eq1 (Option index 0 is 'Went' but we didn't store IDs correctly in seed, let's assume it failed)
      
      db.prepare(`
        INSERT INTO responses (attempt_id, question_id, option_id, is_correct, points_earned)
        VALUES (?, ?, ?, ?, ?)
      `).run(attemptId, eq2, 0, 0, 0); // Incorrect for eq2
    }
  }
};
seed();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare(`
      SELECT u.*, r.name as role 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = ? AND u.password = ?
    `).get(username, password) as any;

    if (user) {
      res.json({ id: user.id, username: user.username, role: user.role });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  });

  app.post("/api/register", (req, res) => {
    const { username, password } = req.body;
    
    try {
      // Check if user exists
      const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (existing) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }

      // Insert new student (role_id = 2)
      const result = db.prepare("INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)").run(username, password, 2);
      const user = db.prepare(`
        SELECT u.*, r.name as role 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(result.lastInsertRowid) as any;

      res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      res.status(500).json({ error: "Error al crear la cuenta" });
    }
  });

  app.get("/api/exams", (req, res) => {
    const exams = db.prepare("SELECT * FROM exams").all();
    res.json(exams);
  });

  app.get("/api/exams/:id", (req, res) => {
    const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(req.params.id) as any;
    if (!exam) return res.status(404).json({ error: "Examen no encontrado" });

    const questions = db.prepare("SELECT * FROM questions WHERE exam_id = ?").all() as any[];
    for (const q of questions) {
      q.options = db.prepare("SELECT * FROM options WHERE question_id = ?").all();
    }
    exam.questions = questions;
    res.json(exam);
  });

  app.post("/api/exams/:id/submit", (req, res) => {
    const { userId, responses } = req.body;
    const examId = req.params.id;
    const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(examId) as any;
    
    let totalPoints = 0;
    let earnedPoints = 0;

    const attemptId = db.prepare("INSERT INTO attempts (user_id, exam_id, score, passed, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)").run(
      userId, examId, 0, 0
    ).lastInsertRowid;

    for (const resp of responses) {
      const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(resp.questionId) as any;
      totalPoints += question.points;

      let isCorrect = 0;
      let pointsEarned = 0;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const correctOption = db.prepare("SELECT id FROM options WHERE question_id = ? AND is_correct = 1").get(resp.questionId) as any;
        if (correctOption && correctOption.id === resp.optionId) {
          isCorrect = 1;
          pointsEarned = question.points;
        }
      } else if (question.type === 'oral') {
        // Oral questions need manual grading, but we store the audio
        isCorrect = 0; // Pending
        pointsEarned = 0;
      }

      earnedPoints += pointsEarned;

      db.prepare(`
        INSERT INTO responses (attempt_id, question_id, answer_text, option_id, audio_url, is_correct, points_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(attemptId, resp.questionId, resp.answerText || null, resp.optionId || null, resp.audioUrl || null, isCorrect, pointsEarned);
    }

    const finalScore = (earnedPoints / totalPoints) * 100;
    const passed = finalScore >= exam.min_score ? 1 : 0;

    db.prepare("UPDATE attempts SET score = ?, passed = ? WHERE id = ?").run(finalScore, passed, attemptId);

    res.json({ attemptId, score: finalScore, passed });
  });

  app.get("/api/users/:userId/attempts", (req, res) => {
    const attempts = db.prepare(`
      SELECT a.*, e.title as exam_title 
      FROM attempts a 
      JOIN exams e ON a.exam_id = e.id 
      WHERE a.user_id = ?
      ORDER BY a.completed_at DESC
    `).all(req.params.userId);
    res.json(attempts);
  });

  app.get("/api/exams/:id/reinforcements", (req, res) => {
    const reinforcements = db.prepare("SELECT * FROM reinforcements WHERE exam_id = ?").all(req.params.id);
    res.json(reinforcements);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
