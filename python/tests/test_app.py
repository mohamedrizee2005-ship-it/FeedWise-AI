from pathlib import Path
from streamlit.testing.v1 import AppTest
import database as db
import ml

APP = str(Path(__file__).resolve().parents[1]/'app.py')


def app(**params):
    at=AppTest.from_file(APP,default_timeout=15)
    for k,v in params.items():
        at.query_params[k]=v
    at.run()
    assert not at.exception
    return at


def button(at,label):
    return next(x for x in at.button if x.label==label)


def test_create_share_submit_analyze_and_close(trained):
    teacher=app()
    assert not any('Password' in t.label or 'Username' in t.label for t in teacher.text_input)
    teacher.text_input[0].input('Database lecture')
    button(teacher,'Create feedback link').click().run()
    assert not teacher.exception
    private=teacher.query_params['r']
    if isinstance(private,list):
        private=private[0]
    session=db.owner_session(private)
    public=session['student_token']
    assert 's=' in teacher.code[0].value and private not in teacher.code[0].value
    student=app(s=public)
    student.text_area[0].input('The lecturer explains the concepts clearly')
    student.selectbox[0].select(5)
    button(student,'Submit feedback').click().run()
    assert student.success and not student.text_area and not student.exception
    teacher.run()
    assert next(m for m in teacher.metric if m.label=='Responses').value=='1'
    next(s for s in teacher.selectbox if s.label=='Correct sentiment').select('negative')
    button(teacher,'Save reviewed label').click().run()
    assert not teacher.exception
    assert any('1 negative' in i.value for i in teacher.info)
    assert len(db.review_history(private,db.owner_feedback(private)[0]['id']))==1
    button(teacher,'Close feedback').click().run()
    assert not teacher.exception
    closed=app(s=public)
    assert not closed.text_area and any('closed' in x.value for x in closed.info)
    assert len(db.owner_feedback(private))==1


def test_bad_links_cannot_render_owner_dashboard(clean):
    public,private=db.create_session('Lecture A')
    db.submit_feedback(public,'This feedback should remain private.')
    for params in ({'r':public},{'r':'wrong'},{'s':private},{'s':public,'r':private}):
        at=app(**params)
        assert at.error and not at.metric
        assert not any('This feedback should remain private.' in x.value for x in at.text)
    student=app(s=public)
    assert not student.metric and not student.download_button


def test_validation_no_model_and_manual_neutral(clean):
    public,private=db.create_session('Lecture A')
    at=app(s=public)
    at.text_area[0].input('short')
    button(at,'Submit feedback').click().run()
    assert at.warning and at.text_area[0].value=='short'
    at.text_area[0].input('Useful feedback without an AI model.')
    button(at,'Submit feedback').click().run()
    teacher=app(r=private)
    assert teacher.warning and teacher.text
    next(s for s in teacher.selectbox if s.label=='Correct sentiment').select('neutral')
    button(teacher,'Save reviewed label').click().run()
    assert not teacher.exception and any('1 neutral' in i.value for i in teacher.info)
