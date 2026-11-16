"""SQLite persistence. Explicit course IDs and SQL authorization guards."""
import sqlite3
from contextlib import contextmanager
from config import DB_PATH, COMMENT_LIMIT, MIN_COMMENT_LENGTH, COURSE_NAME_LIMIT


@contextmanager
def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=10000')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_db():
    with connection() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY,
                course_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
            );
            CREATE TABLE IF NOT EXISTS lecturers (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
            );
            CREATE TABLE IF NOT EXISTS lecturer_courses (
                lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id),
                PRIMARY KEY (lecturer_id, course_id)
            );
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id),
                comment TEXT NOT NULL CHECK(length(comment) BETWEEN 10 AND 2000),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS feedback_reviews (
                id INTEGER PRIMARY KEY,
                feedback_id INTEGER NOT NULL UNIQUE REFERENCES feedback(id) ON DELETE CASCADE,
                lecturer_id INTEGER NOT NULL REFERENCES lecturers(id),
                corrected_sentiment TEXT NOT NULL CHECK(corrected_sentiment IN ('positive','negative')),
                reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_feedback_course ON feedback(course_id);
            CREATE INDEX IF NOT EXISTS idx_assignments_lecturer ON lecturer_courses(lecturer_id);
        ''')


def create_initial_admin(username, stored_hash):
    username = username.strip()
    if not username or len(username) > 50:
        raise ValueError('Invalid username')
    with connection() as db:
        # Bootstrap can only create a first administrator.
        cursor = db.execute('''INSERT INTO admins(username,password_hash)
            SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM admins)''', (username, stored_hash))
        return cursor.rowcount == 1


def auth_user(role, username):
    if role not in ('admins', 'lecturers'):
        raise ValueError('Unknown user role')
    suffix = ' AND active=1' if role == 'lecturers' else ''
    with connection() as db:
        return db.execute(
            f'SELECT id, username, password_hash FROM {role} WHERE username=?{suffix}',
            (username.strip(),)
        ).fetchone()


def valid_user(role, user_id):
    if role not in ('admins', 'lecturers'):
        return None
    suffix = ' AND active=1' if role == 'lecturers' else ''
    with connection() as db:
        return db.execute(f'SELECT id,username FROM {role} WHERE id=?{suffix}', (user_id,)).fetchone()


def list_courses(active_only=False):
    with connection() as db:
        return db.execute('SELECT id,course_name,active FROM courses' +
                          (' WHERE active=1' if active_only else '') +
                          ' ORDER BY course_name').fetchall()


def add_course(name):
    name = ' '.join(name.split())
    if not name or len(name) > COURSE_NAME_LIMIT:
        raise ValueError('Course name must be 1-100 characters.')
    with connection() as db:
        db.execute('INSERT INTO courses(course_name) VALUES (?)', (name,))


def set_course_active(course_id, active):
    with connection() as db:
        db.execute('UPDATE courses SET active=? WHERE id=?', (int(bool(active)), course_id))


def submit_feedback(course_id, comment):
    comment = comment.strip()
    if not MIN_COMMENT_LENGTH <= len(comment) <= COMMENT_LIMIT:
        raise ValueError(f'Feedback must be {MIN_COMMENT_LENGTH}-{COMMENT_LIMIT} characters.')
    with connection() as db:
        cursor = db.execute('''INSERT INTO feedback(course_id,comment)
            SELECT id, ? FROM courses WHERE id=? AND active=1''', (comment, course_id))
        if cursor.rowcount != 1:
            raise ValueError('Course not available.')


def add_lecturer(username, stored_hash):
    username = username.strip()
    if not username or len(username) > 50:
        raise ValueError('Username must be 1-50 characters.')
    with connection() as db:
        db.execute('INSERT INTO lecturers(username,password_hash) VALUES (?,?)', (username, stored_hash))


def list_lecturers():
    with connection() as db:
        return db.execute('SELECT id,username,active FROM lecturers ORDER BY username').fetchall()


def set_lecturer_active(lecturer_id, active):
    with connection() as db:
        db.execute('UPDATE lecturers SET active=? WHERE id=?', (int(bool(active)), lecturer_id))


def assign_course(lecturer_id, course_id):
    with connection() as db:
        lecturer = db.execute('SELECT 1 FROM lecturers WHERE id=? AND active=1', (lecturer_id,)).fetchone()
        course = db.execute('SELECT 1 FROM courses WHERE id=? AND active=1', (course_id,)).fetchone()
        if not lecturer or not course:
            raise ValueError('Active lecturer and course required.')
        return db.execute('INSERT OR IGNORE INTO lecturer_courses(lecturer_id,course_id) VALUES (?,?)',
                          (lecturer_id,course_id)).rowcount == 1


def revoke_course(lecturer_id, course_id):
    with connection() as db:
        return db.execute('DELETE FROM lecturer_courses WHERE lecturer_id=? AND course_id=?',
                          (lecturer_id,course_id)).rowcount == 1


def all_assignments():
    with connection() as db:
        return db.execute('''SELECT lc.lecturer_id,lc.course_id,l.username,c.course_name
           FROM lecturer_courses lc JOIN lecturers l ON lc.lecturer_id=l.id
           JOIN courses c ON lc.course_id=c.id ORDER BY l.username,c.course_name''').fetchall()


def lecturer_courses(lecturer_id):
    with connection() as db:
        return db.execute('''SELECT c.id,c.course_name,c.active
            FROM lecturer_courses lc JOIN courses c ON c.id=lc.course_id
            JOIN lecturers l ON l.id=lc.lecturer_id
            WHERE lc.lecturer_id=? AND l.active=1 ORDER BY c.course_name''', (lecturer_id,)).fetchall()


def lecturer_total(lecturer_id):
    with connection() as db:
        return db.execute('''SELECT COUNT(*) FROM feedback f
          JOIN lecturer_courses lc ON lc.course_id=f.course_id
          JOIN lecturers l ON l.id=lc.lecturer_id
          WHERE lc.lecturer_id=? AND l.active=1''', (lecturer_id,)).fetchone()[0]


def authorized_feedback(lecturer_id, course_id):
    with connection() as db:
        return db.execute('''SELECT f.id,f.comment,fr.corrected_sentiment,fr.reviewed_at
          FROM feedback f
          JOIN lecturer_courses lc ON lc.course_id=f.course_id
          JOIN lecturers l ON l.id=lc.lecturer_id AND l.active=1
          LEFT JOIN feedback_reviews fr ON fr.feedback_id=f.id
          WHERE lc.lecturer_id=? AND f.course_id=? ORDER BY f.id DESC''',
          (lecturer_id,course_id)).fetchall()


def save_correction(lecturer_id, feedback_id, sentiment):
    if sentiment not in ('positive','negative'):
        raise ValueError('Invalid sentiment.')
    with connection() as db:
        # Both insert and update are conditioned on current course permission.
        cursor = db.execute('''INSERT INTO feedback_reviews(feedback_id,lecturer_id,corrected_sentiment)
          SELECT f.id, ?, ? FROM feedback f
          JOIN lecturer_courses lc ON lc.course_id=f.course_id AND lc.lecturer_id=?
          JOIN lecturers l ON l.id=lc.lecturer_id AND l.active=1
          WHERE f.id=?
          ON CONFLICT(feedback_id) DO UPDATE SET
            lecturer_id=excluded.lecturer_id,
            corrected_sentiment=excluded.corrected_sentiment,
            reviewed_at=CURRENT_TIMESTAMP''',
          (lecturer_id,sentiment,lecturer_id,feedback_id))
        return cursor.rowcount > 0


def counts():
    with connection() as db:
        return {table:db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                for table in ('admins','courses','lecturers','feedback','lecturer_courses')}
