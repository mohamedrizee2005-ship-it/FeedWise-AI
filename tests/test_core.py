import sqlite3
import pytest
import database
import config
from security import password_hash, verify_password
from insights import detect_issue, summarize


@pytest.fixture
def clean_db(tmp_path, monkeypatch):
    path = tmp_path / 'test.db'
    monkeypatch.setattr(database, 'DB_PATH', path)
    database.initialize_db()
    return path


def test_password_hash():
    hashed = password_hash('safe-long-test-password!')
    assert 'safe-long-test-password!' not in hashed
    assert verify_password('safe-long-test-password!', hashed)
    assert not verify_password('wrong', hashed)
    assert not verify_password('wrong', 'invalid-format')


def test_course_and_feedback(clean_db):
    database.add_course('AI Fundamentals')
    course = database.list_courses()[0]
    database.submit_feedback(course['id'], 'The explanations are very useful.')
    assert database.counts()['feedback'] == 1
    with pytest.raises(sqlite3.IntegrityError):
        database.add_course('ai fundamentals')
    database.set_course_active(course['id'], False)
    with pytest.raises(ValueError):
        database.submit_feedback(course['id'], 'Another useful feedback example.')


def test_authorization_and_correction(clean_db):
    database.add_course('Course A')
    database.add_course('Course B')
    courses = {c['course_name']:c['id'] for c in database.list_courses()}
    database.add_lecturer('teacher_a',password_hash('teacher-a-secure-pass'))
    database.add_lecturer('teacher_b',password_hash('teacher-b-secure-pass'))
    users = {l['username']:l['id'] for l in database.list_lecturers()}
    database.assign_course(users['teacher_a'],courses['Course A'])
    database.submit_feedback(courses['Course A'],'The lecturer was very helpful.')
    database.submit_feedback(courses['Course B'],'The lecture was confusing today.')
    feedback_a = database.authorized_feedback(users['teacher_a'],courses['Course A'])
    assert len(feedback_a) == 1
    assert database.authorized_feedback(users['teacher_a'],courses['Course B']) == []
    assert not database.save_correction(users['teacher_b'],feedback_a[0]['id'],'negative')
    assert database.save_correction(users['teacher_a'],feedback_a[0]['id'],'negative')
    assert database.authorized_feedback(users['teacher_a'],courses['Course A'])[0]['corrected_sentiment']=='negative'
    database.revoke_course(users['teacher_a'],courses['Course A'])
    assert not database.save_correction(users['teacher_a'],feedback_a[0]['id'],'positive')


def test_admin_bootstrap(clean_db):
    assert database.create_initial_admin('admin',password_hash('initial-secret-pass'))
    assert not database.create_initial_admin('other',password_hash('another-secret-pass'))


def test_insights():
    assert detect_issue('Lecturer explains too fast') == 'Teaching clarity' or detect_issue('Lecturer explains too fast') == 'Teaching pace'
    assert '1 positive' in summarize('AI', ['positive'], {})
