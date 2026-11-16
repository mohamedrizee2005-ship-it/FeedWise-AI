"""One app: create a lecture, share a student link, privately review its feedback."""
import os
import secrets
import sqlite3
import streamlit as st
import pandas as pd
import database as db
from analysis import FeedbackAnalysis, export_csv
from config import PAGE_SIZE, LABELS, REVIEW_THRESHOLD
from insights import RECOMMENDATIONS
from links import make_link


def base_url():
    """A hosted address or a LAN address can be configured without changing the code."""
    return os.environ.get('FEEDWISE_PUBLIC_URL') or st.context.url or 'http://localhost:8501/'


def home():
    st.title('FeedWise AI')
    st.write('Create a feedback link for your lecture. Students respond without signing in.')
    with st.form('create_session'):
        title = st.text_input('Lecture or class title',max_chars=100,placeholder='Database lecture - Normalization')
        prompt = st.text_area('What would you like feedback on? (optional)',max_chars=500,
                              placeholder='Was the explanation clear? What could improve?')
        create = st.form_submit_button('Create feedback link',width='stretch')
    if create:
        try:
            # Validate the deployment address before creating the persistent session.
            make_link(base_url(),'s','validation')
            _,review = db.create_session(title,prompt)
            st.query_params.clear()
            st.query_params['r'] = review
            st.rerun()
        except ValueError as exc:
            st.warning(str(exc))
    st.caption('Keep your private review link to return later. Each lecture has its own links.')


def student(token):
    session = db.student_session(token)
    if not session:
        st.error('This feedback link is invalid. Ask your lecturer for the correct link.')
        return
    st.title(session['title'])
    st.subheader('Share your feedback')
    if session['prompt']:
        st.write(session['prompt'])
    if not session['is_open']:
        st.info('Feedback collection has closed. Thank you for your interest.')
        return
    done_key,receipt_key = f'done_{token}',f'receipt_{token}'
    if st.session_state.get(done_key):
        st.success('Thank you! Your feedback has been received.')
        return
    if receipt_key not in st.session_state:
        st.session_state[receipt_key] = secrets.token_urlsafe(24)
    st.caption('No name or student ID is requested. Please leave identifying details out of your comment.')
    with st.form('student_feedback',clear_on_submit=False):
        rating = st.selectbox('Overall rating (optional)',[None,1,2,3,4,5],
                             format_func=lambda n:'Skip rating' if n is None else f'{n} / 5')
        comment = st.text_area('Your feedback',max_chars=2000,height=150,
                              placeholder='What worked well? What could be improved?')
        send = st.form_submit_button('Submit feedback',width='stretch')
    if send:
        try:
            db.submit_feedback(token,comment,rating,st.session_state[receipt_key])
            st.session_state[done_key] = True
            st.rerun()
        except ValueError as exc:
            st.warning(str(exc))


def owner(token):
    session = db.owner_session(token)
    if not session:
        st.error('This private review link is invalid. Use the review link saved when you created the lecture.')
        return
    st.title(session['title'])
    st.caption('Private lecturer review - no account required')
    try:
        student_link = make_link(base_url(),'s',session['student_token'])
        review_link = make_link(base_url(),'r',token)
    except ValueError as exc:
        st.error(str(exc))
        return
    st.subheader('Share this link with students')
    st.code(student_link,language=None)
    with st.expander('Save your private review link'):
        st.write('Bookmark this link. Anyone with it can read and manage this lecture feedback. Share only the student link above.')
        st.code(review_link,language=None)
    if student_link.startswith(('http://localhost','http://127.0.0.1')):
        st.info('This is a local link. To use student phones, run on a reachable network address or deploy the app. See README.')
    controls = st.columns(2)
    if controls[0].button('Refresh responses'):
        st.rerun()
    if controls[1].button('Close feedback' if session['is_open'] else 'Reopen feedback'):
        db.set_open(token,not session['is_open'])
        st.rerun()
    st.caption('Accepting responses' if session['is_open'] else 'Feedback closed - existing responses remain available')
    service = FeedbackAnalysis(token)
    results = service.results()
    counts = service.counts(results)
    rated = [r['rating'] for r in results if r['rating'] is not None]
    metrics = st.columns(3)
    metrics[0].metric('Responses',len(results))
    metrics[1].metric('Average rating',f'{sum(rated)/len(rated):.1f} / 5' if rated else 'Not rated')
    metrics[2].metric('Human reviewed',sum(r['human'] is not None for r in results))
    if not results:
        st.info('No feedback yet. Share the student link, then refresh this page.')
        return
    if service.model_error:
        st.warning(service.model_error)
    st.caption('AI suggestions are experimental: the 40-example English model scored 25% in demo cross-validation. '
               'Human labels override AI. Neutral and mixed labels are available for manual review.')
    overview,comments,review = st.tabs(['Overview','Feedback','Review labels'])
    with overview:
        data = pd.DataFrame({'Sentiment':[*LABELS,'unreviewed'],
                             'Responses':[counts[x] for x in (*LABELS,'unreviewed')]})
        st.bar_chart(data,x='Sentiment',y='Responses')
        st.info(service.summary(session['title'],results))
        st.subheader('Topics to review')
        topics = service.negative_topics(results)
        if not topics:
            st.write('No negative-labeled responses to group. Mixed comments may still contain useful concerns.')
        for topic,amount in topics.most_common():
            st.write(f'**{topic}** - {amount} negative-labeled response(s)')
            st.write(RECOMMENDATIONS[topic])
        st.caption('Topics and recommendations use keyword rules. One response can have multiple topics; read the comments before acting.')
    with comments:
        selected = st.radio('Show',['All',*LABELS,'unreviewed'],horizontal=True)
        shown = [r for r in results if selected=='All' or r['effective']==selected]
        pages = max(1,(len(shown)+PAGE_SIZE-1)//PAGE_SIZE)
        page = st.selectbox('Page',list(range(1,pages+1)),key=f'page_{selected}')
        for row in shown[(page-1)*PAGE_SIZE:page*PAGE_SIZE]:
            with st.container(border=True):
                st.text(row['comment'])
                st.caption(f"Label: {row['effective']} | Source: {'Human review' if row['human'] else 'AI suggestion' if row['ai'] else 'Not reviewed'}")
                st.caption('Topics: '+', '.join(row['topics']))
        if not shown:
            st.write('No responses in this group.')
        st.download_button('Download feedback CSV',export_csv(results,service.model_version),
                           file_name='lecture-feedback.csv',mime='text/csv')
    with review:
        choices = {r['id']:r for r in results}
        feedback_id = st.selectbox('Response to review',list(choices),
                                  format_func=lambda i:f"#{i}: {choices[i]['comment'][:60]}")
        row = choices[feedback_id]
        st.text(row['comment'])
        if row['probability'] is not None:
            st.caption(f"AI: {row['ai']} | Model probability: {row['probability']:.1%} (not measured accuracy)")
            if row['probability'] < REVIEW_THRESHOLD:
                st.caption('Low model probability: manual review is suggested.')
        default = row['human'] or row['ai'] or 'neutral'
        with st.form(f'review_{feedback_id}'):
            label = st.selectbox('Correct sentiment',LABELS,index=LABELS.index(default))
            save = st.form_submit_button('Save reviewed label')
        if save:
            if db.save_review(token,feedback_id,label):
                st.rerun()
            else:
                st.error('Unable to save this review. Check the private link.')
        with st.expander('Review history'):
            history = db.review_history(token,feedback_id)
            if history:
                st.dataframe([dict(r) for r in history],hide_index=True,width='stretch')
            else:
                st.write('No manual reviews yet.')


def main():
    st.set_page_config(page_title='FeedWise AI',page_icon='💬',layout='centered')
    try:
        db.initialize_db()
        # Fail closed for conflicting or duplicate routes instead of guessing authority.
        student_keys = st.query_params.get_all('s')
        review_keys = st.query_params.get_all('r')
        if (student_keys and review_keys) or len(student_keys)>1 or len(review_keys)>1:
            st.error('Use either a student link or a private review link.')
        elif review_keys:
            owner(review_keys[0])
        elif student_keys:
            student(student_keys[0])
        else:
            home()
    except sqlite3.Error:
        st.error('Feedback storage is temporarily unavailable. Please try again later.')


if __name__ == '__main__':
    main()
