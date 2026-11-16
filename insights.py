"""Explainable rule-based issue tagging and template recommendations."""
from collections import Counter

ISSUE_RULES = {
    'Teaching clarity': ('unclear', 'confusing', 'complicated', 'hard to follow', 'explain', 'explanation'),
    'Teaching pace': ('fast', 'slow', 'pace', 'rushed', 'speed'),
    'Practical work': ('practical', 'lab', 'hands-on', 'demonstration'),
    'Assignment guidance': ('assignment', 'deadline', 'marking', 'criteria', 'workload'),
    'Learning resources': ('slide', 'note', 'material', 'resources', 'outdated'),
    'Communication': ('questions', 'feedback', 'respond', 'support', 'guidance')
}

RECOMMENDATIONS = {
    'Teaching clarity': 'Use smaller explanations and check comprehension with examples.',
    'Teaching pace': 'Pause regularly, summarize key ideas and invite questions.',
    'Practical work': 'Offer worked examples and guided practical or lab sessions.',
    'Assignment guidance': 'Provide clear rubrics, instructions and realistic deadlines.',
    'Learning resources': 'Improve slides, lecture notes and access to supporting materials.',
    'Communication': 'Create regular opportunities for student questions and feedback.',
    'Other feedback': 'Read comments manually before choosing an improvement action.'
}


def detect_issue(comment):
    lower = comment.lower()
    for category, terms in ISSUE_RULES.items():
        if any(term in lower for term in terms):
            return category
    return 'Other feedback'


def summarize(course_name, labels, issue_counts):
    counts = Counter(labels)
    total = len(labels)
    if not total:
        return f'No feedback has been submitted for {course_name}.'
    common = Counter(issue_counts).most_common(1)
    major = f' Most frequent tagged issue: {common[0][0]}.' if common else ''
    return (f'{course_name}: {total} review(s), {counts["positive"]} positive and '
            f'{counts["negative"]} negative (after human corrections).{major} '
            'This is a descriptive template, not a generative AI conclusion.')
