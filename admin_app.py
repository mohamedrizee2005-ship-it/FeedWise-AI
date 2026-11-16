
"""Admin-only web UI for course, lecturer and assignment management."""

import sqlite3
import streamlit as st

from config import DB_PATH
from security import verify_password, password_hash
from database import (
    auth_user,
    valid_user,
    counts,
    list_courses,
    add_course,
    set_course_active,
    list_lecturers,
    add_lecturer,
    set_lecturer_active,
    assign_course,
    revoke_course,
    all_assignments,
)

st.set_page_config(
    page_title="FeedWise AI | Admin",
    page_icon="🛡️",
    layout="wide",
)

st.title("🛡️ FeedWise AI — Administrator")

# Check database
if not DB_PATH.exists():
    st.error("First run setup.py, then create_admin.py locally.")
    st.stop()


# ------------------------------
# ADMIN LOGIN
# ------------------------------

if "admin_id" not in st.session_state:
    st.subheader("Administrator Login")

    with st.form("admin_login"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        login = st.form_submit_button("Login")

    if login:
        try:
            user = auth_user("admins", username)

            if user and verify_password(
                password, user["password_hash"]
            ):
                st.session_state["admin_id"] = user["id"]
                st.rerun()
            else:
                st.error("Invalid username or password.")

        except sqlite3.Error:
            st.error("Login service unavailable.")

    st.stop()


# Verify logged-in administrator
try:
    admin = valid_user(
        "admins",
        st.session_state["admin_id"],
    )
except sqlite3.Error:
    st.error("Admin session could not be verified.")
    st.stop()

if not admin:
    st.session_state.pop("admin_id", None)
    st.error("Admin session invalid. Please log in again.")
    st.stop()


# ------------------------------
# SIDEBAR
# ------------------------------

with st.sidebar:
    st.write(f'Admin: **{admin["username"]}**')

    if st.button("Logout"):
        st.session_state.pop("admin_id", None)
        st.rerun()


# ------------------------------
# DASHBOARD METRICS
# ------------------------------

try:
    totals = counts()
except sqlite3.Error:
    st.error("Database unavailable.")
    st.stop()

cols = st.columns(4)

for col, label, key in zip(
    cols,
    (
        "Courses",
        "Lecturers",
        "Feedback",
        "Course assignments",
    ),
    (
        "courses",
        "lecturers",
        "feedback",
        "lecturer_courses",
    ),
):
    col.metric(label, totals[key])


# ------------------------------
# COURSE MANAGEMENT
# ------------------------------

st.divider()
st.header("📚 Course management")

with st.form("new_course", clear_on_submit=True):
    course_name = st.text_input(
        "New course name",
        max_chars=100,
    )

    add = st.form_submit_button("Add course")

if add:
    try:
        add_course(course_name)
        st.success("Course added.")
        st.rerun()

    except ValueError as exc:
        st.warning(str(exc))

    except sqlite3.IntegrityError:
        st.warning("A course with that name already exists.")

    except sqlite3.Error:
        st.error("Could not add course.")


# Load courses and convert sqlite3.Row to dict
try:
    courses = [dict(c) for c in list_courses()]
except sqlite3.Error:
    st.error("Cannot load courses.")
    st.stop()

st.dataframe(
    [
        {
            "ID": c["id"],
            "Course": c["course_name"],
            "Status": (
                "Active" if c["active"] else "Archived"
            ),
        }
        for c in courses
    ],
    hide_index=True,
    use_container_width=True,
)

if courses:
    st.subheader("Archive or reactivate a course")

    st.caption(
        "Archiving prevents NEW student submissions; "
        "existing feedback and assignments are preserved."
    )

    chosen_course = st.selectbox(
        "Course to change",
        courses,
        format_func=lambda c: (
            f'{c["course_name"]} (#{c["id"]})'
        ),
        key="course_status_choice",
    )

    desired = st.radio(
        "Status",
        ("Active", "Archived"),
        horizontal=True,
    )

    if st.button("Update course status"):
        try:
            set_course_active(
                chosen_course["id"],
                desired == "Active",
            )
            st.rerun()

        except sqlite3.Error:
            st.error("Unable to update course.")


# ------------------------------
# LECTURER MANAGEMENT
# ------------------------------

st.divider()
st.header("👨‍🏫 Lecturer management")

with st.form("add_lecturer", clear_on_submit=True):
    lecturer_username = st.text_input(
        "New lecturer username",
        max_chars=50,
    )

    temporary_password = st.text_input(
        "Initial password (12+ characters)",
        type="password",
    )

    confirm = st.text_input(
        "Confirm password",
        type="password",
    )

    make = st.form_submit_button("Create lecturer")

if make:
    if temporary_password != confirm:
        st.warning("Passwords do not match.")

    else:
        try:
            add_lecturer(
                lecturer_username,
                password_hash(temporary_password),
            )

            st.success(
                "Lecturer created. "
                "Assign at least one course below."
            )
            st.rerun()

        except ValueError as exc:
            st.warning(str(exc))

        except sqlite3.IntegrityError:
            st.warning("Lecturer username already exists.")

        except sqlite3.Error:
            st.error("Unable to create lecturer.")


# Load lecturers and convert sqlite3.Row to dict
try:
    lecturers = [dict(l) for l in list_lecturers()]
except sqlite3.Error:
    st.error("Cannot load lecturers.")
    st.stop()

st.dataframe(
    [
        {
            "ID": l["id"],
            "Username": l["username"],
            "Status": (
                "Active" if l["active"] else "Disabled"
            ),
        }
        for l in lecturers
    ],
    use_container_width=True,
    hide_index=True,
)

if lecturers:
    st.subheader("Enable or disable a lecturer")

    selected_lecturer = st.selectbox(
        "Lecturer account",
        lecturers,
        format_func=lambda l: (
            f'{l["username"]} (#{l["id"]})'
        ),
        key="lecturer_status_choice",
    )

    desired_lecturer = st.radio(
        "Account status",
        ("Enabled", "Disabled"),
        horizontal=True,
    )

    if st.button("Update lecturer status"):
        try:
            set_lecturer_active(
                selected_lecturer["id"],
                desired_lecturer == "Enabled",
            )
            st.rerun()

        except sqlite3.Error:
            st.error("Unable to update lecturer.")


# ------------------------------
# LECTURER COURSE ASSIGNMENTS
# ------------------------------

st.divider()
st.header("📖 Lecturer course assignments")

active_lecturers = [
    l for l in lecturers if l["active"]
]

active_courses = [
    c for c in courses if c["active"]
]

if active_lecturers and active_courses:
    with st.form("assign_course"):
        lecturer = st.selectbox(
            "Lecturer",
            active_lecturers,
            format_func=lambda l: l["username"],
        )

        course = st.selectbox(
            "Course",
            active_courses,
            format_func=lambda c: c["course_name"],
        )

        clicked = st.form_submit_button("Assign course")

    if clicked:
        try:
            if assign_course(
                lecturer["id"],
                course["id"],
            ):
                st.success("Course assigned.")
                st.rerun()
            else:
                st.info(
                    "Course already assigned to this lecturer."
                )

        except ValueError as exc:
            st.warning(str(exc))

        except sqlite3.Error:
            st.error("Cannot assign course.")

else:
    st.info(
        "Enable a lecturer and course "
        "to create assignments."
    )


# ------------------------------
# CURRENT ASSIGNMENTS
# ------------------------------

try:
    assignments = [
        dict(a) for a in all_assignments()
    ]
except sqlite3.Error:
    st.error("Cannot load course assignments.")
    st.stop()

st.subheader("Current assignments")

st.dataframe(
    [
        {
            "Lecturer": a["username"],
            "Course": a["course_name"],
        }
        for a in assignments
    ],
    hide_index=True,
    use_container_width=True,
)

if assignments:
    with st.form("remove_assignment"):
        remove = st.selectbox(
            "Select assignment to remove",
            assignments,
            format_func=lambda a: (
                f'{a["username"]} — {a["course_name"]}'
            ),
        )

        confirmed = st.checkbox(
            "I confirm removal of this assignment"
        )

        remove_clicked = st.form_submit_button(
            "Remove assignment"
        )

    if remove_clicked:
        if not confirmed:
            st.warning("Confirm before removing access.")

        else:
            try:
                revoke_course(
                    remove["lecturer_id"],
                    remove["course_id"],
                )

                st.success("Course access removed.")
                st.rerun()

            except sqlite3.Error:
                st.error("Unable to remove assignment.")


# ------------------------------
# FOOTER
# ------------------------------

st.divider()

st.caption(
    "Local prototype: no public deployment. "
    "Real student feedback requires privacy review "
    "and security hardening. "
    "No admin self-registration is provided."
)
