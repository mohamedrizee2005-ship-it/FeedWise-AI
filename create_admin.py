"""Local-only one-time administrator bootstrap (not exposed on web)."""
import getpass
from config import DB_PATH
from database import counts, create_initial_admin
from security import password_hash


def main():
    if not DB_PATH.exists():
        print('Run setup.py before creating an admin.')
        return
    if counts()['admins']:
        print('An admin already exists. This bootstrap is disabled.')
        return
    username = input('Admin username: ').strip()
    password = getpass.getpass('Admin password (12+ characters): ')
    confirm = getpass.getpass('Confirm password: ')
    if password != confirm:
        print('Passwords do not match.')
        return
    try:
        stored = password_hash(password)
        created = create_initial_admin(username, stored)
        print('Admin created successfully.' if created else 'Admin already exists.')
    except ValueError as e:
        print(f'Invalid input: {e}')


if __name__ == '__main__':
    main()
