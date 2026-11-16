"""Lecturer portal: authentication and per-course SQL authorization."""
from collections import Counter
import sqlite3
import pandas as pd
import streamlit as st
from config import DB_PATH, MODEL_PATH, REVIEW_THRESHOLD
from security import verify_password
from database import (auth_user, valid_user, lecturer_courses, lecturer_total,
                      authorized_feedback, save_correction)
from insights import detect_issue, RECOMMENDATIONS, summarize
from ml import analyze

st.set_page_config(page_title='FeedWise AI | Lecturer', page_icon='📊', layout='wide')
st.title('📊 FeedWise AI — Lecturer')

if not DB_PATH.exists():
    st.error('Database not initialized. Run setup.py first.')
    st.stop()

if 'lecturer_id' not in st.session_state:
    st.subheader('Lecturer Login')
    with st.form('lecturer_login'):
        username = st.text_input('Username')
        password = st.text_input('Password', type='password')
        login = st.form_submit_button('Login')
    if login:
        try:
            user = auth_user('lecturers', username)
            if user and verify_password(password, user['password_hash']):
                st.session_state['lecturer_id'] = user['id']
                st.rerun()
            else:
                st.error('Invalid username or password.')
        except sqlite3.Error:
            st.error('Login service unavailable.')
    st.stop()

lecturer_id = st.session_state['lecturer_id']
try:
    user = valid_user('lecturers', lecturer_id)
    if not user:
        st.session_state.pop('lecturer_id', None)
        st.error('Session expired or account disabled. Please sign in again.')
        st.stop()
    available = lecturer_courses(lecturer_id)
    total = lecturer_total(lecturer_id)
except sqlite3.Error:
    st.error('Unable to verify your access.')
    st.stop()

with st.sidebar:
    st.write(f'Signed in as **{user["username"]}**')
    if st.button('Logout'):
        st.session_state.pop('lecturer_id', None)
        st.rerun()

st.metric('Feedback in assigned courses', total)
if not available:
    st.info('No courses have been assigned. Contact the administrator.')
    st.stop()

labels = {f'{c["course_name"]} (#{c["id"]})': c['id'] for c in available}
selected_label = st.selectbox('Your course', list(labels))
course_id = labels[selected_label]
course_name = selected_label.rsplit(' (#', 1)[0]
try:
    rows = authorized_feedback(lecturer_id, course_id)
except sqlite3.Error:
    st.error('Unable to load authorized feedback.')
    st.stop()

st.metric('Reviews for this course', len(rows))
if not rows:
    st.info('No feedback submitted for this course.')
    st.stop()
if not MODEL_PATH.exists():
    st.error('Model not found. Run setup.py first.')
    st.stop()
try:
    predictions = analyze([r['comment'] for r in rows])
except Exception:
    st.error('Unable to analyze comments. Use only a trusted locally trained model.')
    st.stop()

results = []
for row, (predicted, confidence) in zip(rows, predictions):
    corrected = row['corrected_sentiment']
    effective = corrected if corrected in ('positive', 'negative') else predicted
    results.append({'id': row['id'], 'comment': row['comment'], 'ai': predicted,
                    'confidence': confidence, 'human': corrected, 'effective': effective})

positive = sum(r['effective'] == 'positive' for r in results)
negative = sum(r['effective'] == 'negative' for r in results)
col1, col2 = st.columns(2)
col1.metric('Positive', positive)
col2.metric('Negative', negative)
st.caption('Human corrections override AI predictions. Model probabilities are not calibrated accuracy.')

st.subheader('Sentiment chart')
st.bar_chart(pd.DataFrame({'Sentiment':['Positive','Negative'], 'Count':[positive,negative]}),
             x='Sentiment', y='Count')

st.subheader('Classified reviews')
kind = st.radio('Show', ['All','Positive','Negative'], horizontal=True)
shown = [r for r in results if kind == 'All' or r['effective'] == kind.lower()]
for r in shown:
    with st.container(border=True):
        st.write(r['comment'])
        st.caption(f'Final: {r["effective"]} | AI: {r["ai"]} | Human: {r["human"] or "not reviewed"}')
if not shown:
    st.info('No reviews in this group.')

negatives = [r['comment'] for r in results if r['effective'] == 'negative']
issues = Counter(detect_issue(comment) for comment in negatives)
st.subheader('Issue analysis and recommendations')
if issues:
    for issue, amount in issues.most_common():
        st.write(f'**{issue}** — {amount} negative review(s)')
        st.write(RECOMMENDATIONS.get(issue, RECOMMENDATIONS['Other feedback']))
else:
    st.info('No negative reviews to categorize.')
st.subheader('Course summary')
st.info(summarize(course_name, [r['effective'] for r in results], issues))

st.divider()
st.subheader('Human sentiment correction')
st.caption(f'Low-confidence demonstration flag: below {REVIEW_THRESHOLD:.0%}. You can review any result.')
for r in results:
    with st.expander(f'Feedback #{r["id"]} — {r["effective"]} (AI max probability {r["confidence"]:.1%})'):
        st.write(r['comment'])
        if r['confidence'] < REVIEW_THRESHOLD:
            st.warning('Low model probability: consider reviewing.')
        default = r['human'] or r['ai']
        with st.form(f'correct_{r["id"]}'):
            chosen = st.selectbox('Correct sentiment', ['positive','negative'],
                                  index=0 if default=='positive' else 1)
            save = st.form_submit_button('Save human correction')
        if save:
            try:
                if save_correction(lecturer_id, r['id'], chosen):
                    st.rerun()
                else:
                    st.error('Access denied. Your course assignment may have changed.')
            except sqlite3.Error:
                st.error('Could not save correction.')

st.caption('Prototype only: raw text can contain identifying information. Do not use with real student feedback until privacy, access and deployment security have been reviewed.')
