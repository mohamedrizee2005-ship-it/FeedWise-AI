import sqlite3
import pytest
import database as db


def test_link_separation_and_hashed_owner_key(clean):
    public,private = db.create_session('  Database  lecture  ','Was the lesson clear?')
    assert public != private and len(public)>=40 and len(private)>=40
    assert db.student_session(public)['title']=='Database lecture'
    assert db.owner_session(private)['student_token']==public
    assert db.owner_session(public) is None
    assert db.student_session(private) is None
    assert 'review_hash' not in db.student_session(public).keys()
    with db.connection() as connection:
        assert connection.execute('SELECT review_hash FROM sessions').fetchone()[0]==db.token_hash(private)
    assert private.encode() not in clean.read_bytes()


@pytest.mark.parametrize('comment',['','short',' '*20,'x'*2001])
def test_invalid_comments(clean,comment):
    public,_ = db.create_session('AI lecture')
    with pytest.raises(ValueError):
        db.submit_feedback(public,comment)


def test_open_close_and_resubmit(clean):
    public,private = db.create_session('AI lecture')
    assert db.submit_feedback(public,'The explanations were useful.',5,'receipt-123456')
    assert not db.submit_feedback(public,'The explanations were useful.',5,'receipt-123456')
    assert len(db.owner_feedback(private))==1
    assert db.set_open(private,False)
    with pytest.raises(ValueError):
        db.submit_feedback(public,'Another helpful lecture comment.')
    assert len(db.owner_feedback(private))==1
    assert db.set_open(private,True)
    assert db.submit_feedback(public,'Another helpful lecture comment.')


def test_public_cannot_read_modify_or_review(clean):
    public,private = db.create_session('AI lecture')
    db.submit_feedback(public,'Useful practical examples.')
    feedback_id = db.owner_feedback(private)[0]['id']
    assert db.owner_feedback(public)==[]
    assert not db.set_open(public,False)
    assert not db.save_review(public,feedback_id,'negative')
    assert not db.save_prediction(public,feedback_id,'model','negative',.9)
    assert db.review_history(public,feedback_id)==[]
    assert db.prediction_cache(public,'model')=={}


def test_sessions_are_isolated_and_review_history_appends(clean):
    public,private = db.create_session('Lecture A')
    other_public,other_private = db.create_session('Lecture B')
    db.submit_feedback(public,'Useful practical examples.')
    db.submit_feedback(other_public,'The lecture needs more examples.')
    feedback_id = db.owner_feedback(private)[0]['id']
    assert not db.save_review(other_private,feedback_id,'positive')
    for label in ('negative','neutral','mixed'):
        assert db.save_review(private,feedback_id,label)
    assert db.owner_feedback(private)[0]['human_label']=='mixed'
    assert len(db.review_history(private,feedback_id))==3
    assert db.owner_feedback(other_private)[0]['human_label'] is None


def test_invalid_ratings_duplicate_replay_and_sql(clean):
    public,private = db.create_session("SQL'); DROP TABLE sessions; --")
    for rating in (0,6,True,1.5):
        with pytest.raises(ValueError):
            db.submit_feedback(public,'Useful practical examples.',rating)
    db.submit_feedback(public,'Useful practical examples.')
    with pytest.raises(ValueError,match='Identical'):
        db.submit_feedback(public,'Useful practical examples.')
    assert db.owner_session("' OR 1=1 --") is None
    assert db.owner_session(private)
    with pytest.raises(ValueError):
        db.save_review(private,1,'invalid-label')


def test_initialize_preserves_data_and_old_database(clean):
    public,private = db.create_session('Lecture A')
    db.submit_feedback(public,'Keep this historical comment.')
    db.initialize_db()
    assert len(db.owner_feedback(private))==1
    with db.connection() as connection:
        assert connection.execute("SELECT 1 FROM sqlite_master WHERE name='admins'").fetchone() is None
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute('INSERT INTO feedback(session_id,comment,submission_key) VALUES (999,?,?)',
                               ('A valid comment string','orphan-key-12345'))
