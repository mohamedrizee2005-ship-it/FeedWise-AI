from pathlib import Path
import pytest
import database as db
import ml
from analysis import FeedbackAnalysis,export_csv
from insights import detect_topics
from links import make_link


def test_multiple_topics_with_word_boundaries():
    topics = detect_topics('The lecturer explains too fast and labs need more equipment.')
    assert {'Teaching clarity','Teaching pace','Practical work'}<=set(topics)
    assert detect_topics('The syllabus is difficult')==['Other feedback']


def test_links_never_carry_owner_query():
    assert make_link('https://example.org/app?r=private#anchor','s','public')=='https://example.org/app?s=public'
    assert 'private' not in make_link('https://example.org/?r=private','s','public')
    for base in ('javascript:alert(1)','ftp://example.org','https://user:pass@example.org'):
        with pytest.raises(ValueError):
            make_link(base,'s','public')


def test_cached_predictions_and_human_override(trained,monkeypatch):
    public,private = db.create_session('Lecture A')
    db.submit_feedback(public,'The lecturer explains the concepts clearly')
    analysis = FeedbackAnalysis(private)
    first = analysis.results()
    assert len(first)==1 and first[0]['ai'] in ('positive','negative')
    def unexpected(*args):
        raise AssertionError('Cached prediction should avoid another model inference.')
    monkeypatch.setattr(ml,'analyze',unexpected)
    second = FeedbackAnalysis(private).results()
    assert second[0]['ai']==first[0]['ai']
    db.save_review(private,first[0]['id'],'neutral')
    final = FeedbackAnalysis(private).results()
    assert final[0]['effective']=='neutral' and final[0]['ai']==first[0]['ai']
    assert '1 neutral' in analysis.summary('Lecture A',final)


def test_missing_and_corrupt_models_keep_manual_review(clean):
    public,private = db.create_session('Lecture A')
    db.submit_feedback(public,'The lecture needs more examples.')
    for data in (None,b'not-a-trusted-model'):
        if data is not None:
            Path(ml.MODEL_PATH).write_bytes(data)
        service=FeedbackAnalysis(private)
        result=service.results()
        assert service.model_error and result[0]['effective']=='unreviewed'
        db.save_review(private,result[0]['id'],'mixed')
        assert FeedbackAnalysis(private).results()[0]['effective']=='mixed'
        # Clear this human label to test the next unavailable-model case independently.
        with db.connection() as connection:
            connection.execute('DELETE FROM reviews')


def test_model_version_keeps_prior_prediction(trained):
    public,private = db.create_session('Lecture A')
    db.submit_feedback(public,'The lecture needs more examples.')
    feedback_id = db.owner_feedback(private)[0]['id']
    assert db.save_prediction(private,feedback_id,'old-version','negative',.7)
    service=FeedbackAnalysis(private)
    service.results()
    assert db.prediction_cache(private,'old-version')[feedback_id]==('negative',.7)
    assert db.prediction_cache(private,service.model_version)


def test_csv_safety_and_owner_scope(trained):
    public,private = db.create_session('Lecture A')
    db.submit_feedback(public,'=HYPERLINK("bad") dangerous formula')
    service=FeedbackAnalysis(private)
    exported=export_csv(service.results(),service.model_version).decode('utf-8-sig')
    assert "'=HYPERLINK" in exported
    assert public not in exported and private not in exported
    assert FeedbackAnalysis(public).results()==[]


def test_demo_model_evaluation_and_invalid_dataset(tmp_path,monkeypatch):
    result=ml.evaluate_model()
    assert result['samples']==40 and result['baseline_accuracy']==.5
    assert 0<=result['accuracy']<=1
    (tmp_path/'training_data.csv').write_text('text,label\nexample,unknown\n')
    monkeypatch.setattr(ml,'ROOT',tmp_path)
    with pytest.raises(ValueError):
        ml.training_rows()
