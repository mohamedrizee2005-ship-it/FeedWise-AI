from pathlib import Path
import pytest
import config
import database as db
import ml


@pytest.fixture
def clean(tmp_path,monkeypatch):
    path,model = tmp_path/'links.db',tmp_path/'model.joblib'
    monkeypatch.setattr(config,'DB_PATH',path)
    monkeypatch.setattr(db,'DB_PATH',path)
    monkeypatch.setattr(config,'MODEL_PATH',model)
    monkeypatch.setattr(ml,'MODEL_PATH',model)
    db.initialize_db()
    return path


@pytest.fixture
def trained(clean):
    ml.train_model()
    return clean
