"""Safe first-time setup. Existing database rows are preserved."""
from database import initialize_db, list_courses, add_course
from ml import train_model
from config import DB_PATH, MODEL_PATH


def main():
    initialize_db()
    if not list_courses():
        for name in ('Database Management Systems','Programming Fundamentals','Statistics'):
            add_course(name)
    count = train_model()
    print('Setup completed.')
    print(f'Database: {DB_PATH}')
    print(f'AI model: {MODEL_PATH} (trained on {count} demonstration sentences)')
    print('Next: run create_admin.py to make the first admin account.')


if __name__ == '__main__':
    main()
