"""Compatibility entrypoint: exports the current research-corpus web model.

The old 40-row binary exporter is intentionally retired: it would overwrite the
current artifact with an incompatible JSON schema. The Streamlit learning
prototype still trains its own separate artifact through python/setup.py.
"""

from train_feedback import main

if __name__ == "__main__":
    main()
