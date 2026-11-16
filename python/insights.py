"""Transparent multi-topic keyword tags; these are rules, separate from the sentiment model."""
import re
from collections import Counter

ISSUE_RULES = {
    'Teaching clarity': ('unclear','confusing','complicated','hard to follow','explain','explanation'),
    'Teaching pace': ('fast','slow','pace','rushed','speed','time'),
    'Practical work': ('practical','lab','hands-on','demonstration'),
    'Assignment guidance': ('assignment','deadline','marking','criteria','workload'),
    'Learning resources': ('slide','note','material','resource','outdated'),
    'Communication': ('question','feedback','respond','support','guidance')
}
RECOMMENDATIONS = {
    'Teaching clarity': 'Use smaller explanations and check understanding with examples.',
    'Teaching pace': 'Review pacing and allow time for questions and practice.',
    'Practical work': 'Add guided practical examples and review lab time or resources.',
    'Assignment guidance': 'Clarify instructions, rubrics and deadlines.',
    'Learning resources': 'Review slides, notes and access to learning materials.',
    'Communication': 'Provide a clear way for students to ask questions and get feedback.',
    'Other feedback': 'Read the comments before deciding on an improvement.'
}


def detect_topics(comment):
    lower = comment.casefold()
    topics = [topic for topic,terms in ISSUE_RULES.items()
              if any(re.search(r'\b'+re.escape(term)+r'(?:s|ed|ing)?\b',lower) for term in terms)]
    return topics or ['Other feedback']


def summarize(title, labels):
    counts = Counter(labels)
    return (f'{title}: {len(labels)} response(s); '+', '.join(
        f'{counts[label]} {label}' for label in ('positive','negative','neutral','mixed','unreviewed'))+
        '. Human-reviewed labels take precedence over AI suggestions.')
