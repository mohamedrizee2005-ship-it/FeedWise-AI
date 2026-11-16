"""Student interface. No account/ID requested; anonymity NOT guaranteed."""
import sqlite3
import streamlit as st
from database import list_courses, submit_feedback
from config import DB_PATH

st.set_page_config(page_title='FeedWise AI | Student', page_icon='🎓', layout='centered')
st.title('🎓 FeedWise AI')
st.subheader('Student Feedback Portal')
st.info('Please do not include your name, student ID, email, phone number or other identifying details. This prototype cannot guarantee anonymity.')

if not DB_PATH.exists():
    st.error('System has not been set up yet. Ask the administrator to run setup.')
    st.stop()

try:
    courses = list_courses(active_only=True)
except sqlite3.Error:
    st.error('Unable to load courses.')
    st.stop()

if not courses:
    st.warning('No courses are currently accepting feedback.')
    st.stop()

names = {f'{c["course_name"]} (#{c["id"]})': c['id'] for c in courses}
with st.form('submit_feedback', clear_on_submit=True):
    course_label = st.selectbox('Select course', list(names))
    comment = st.text_area('Your feedback', max_chars=2000, height=170,
        placeholder='Describe what works well or what could improve.')
    submitted = st.form_submit_button('Submit feedback', use_container_width=True)

if submitted:
    try:
        submit_feedback(names[course_label], comment)
        st.success('Feedback submitted successfully!')
    except ValueError as exc:
        st.warning(str(exc))
    except sqlite3.Error:
        st.error('Unable to submit feedback. Please try again later.')

st.caption('Development prototype. No student account is collected; content may still identify the writer. Use test feedback only.')
