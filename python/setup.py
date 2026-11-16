"""Prepare the single app; no admin bootstrap or account creation."""
from database import initialize_db
from ml import train_model


def main():
    initialize_db()
    count = train_model()
    print(f'FeedWise AI ready. Demo model trained on {count} examples.')
    print('Run: python -m streamlit run app.py')


if __name__ == '__main__':
    main()
