"""Reproducible, CPU-friendly student-feedback training; raw public corpora stay untracked."""

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, re, unicodedata, urllib.parse, urllib.request, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix,
)
from sklearn.dummy import DummyClassifier

ROOT = Path(__file__).resolve().parents[1]
REVISION = "3aa628742261837ea5e9d5e658a7ddd9a6f4f317"
PARTS = [
    ("Annotator_1", "Annotated_part_1", "Final_Dataset_tsv"),
    (
        "Annotator_1",
        "Annotated_part_2",
        "ratemy_professor_data_from_sorted_list_shuffle_1",
    ),
    ("Annotator_2", "Annotated_part_3", "Final_Dataset_tsv"),
    (
        "Annotator_2",
        "Annotated_part_4",
        "ratemy_professor_data_from_sorted_list_shuffle_1",
    ),
    ("Annotator_2", "Annotated_part_5", "additional_100_of_rate_my_proffesor"),
    ("Annotator_3", "Annotated_part_6", "Final_Dataset_tsv"),
]


def normalize(text):
    text = unicodedata.normalize("NFKC", text).lower().replace("’", "'")
    text = re.sub(r"https?://\S+|[\w.+-]+@[\w.-]+", " ", text)
    return " ".join(text.split())


def download(url, path):
    if path.exists():
        return path
    request = urllib.request.Request(
        url, headers={"User-Agent": "FeedWise-Educational-Research/1.0"}
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        path.write_bytes(response.read())
    return path


def load_data(cache):
    cache.mkdir(parents=True, exist_ok=True)
    jobs = []
    for i, (annotator, part, name) in enumerate(PARTS):
        url = (
            "https://huggingface.co/datasets/NLPC-UOM/Student_feedback_analysis_dataset/resolve/"
            + REVISION
            + "/"
            + urllib.parse.quote(
                f"Annotated Student Feedback Data/{annotator}/{part}/{name}.xmi"
            )
        )
        jobs.append((url, cache / f"uom_{i}.xmi"))
    jobs.append(
        (
            "https://archive.ics.uci.edu/static/public/331/sentiment+labelled+sentences.zip",
            cache / "uci.zip",
        )
    )
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda job: download(*job), jobs))
    votes = defaultdict(Counter)
    for _, path in jobs[:-1]:
        root = ET.parse(path).getroot()
        sofa = next(
            el.attrib["sofaString"] for el in root if el.tag.endswith("}Sofa")
        ).encode("utf-16-le")
        for el in root:
            if not el.tag.endswith("}Document_levelopinion"):
                continue
            label = el.attrib.get("Document_levelopinion", "").strip().lower()
            if label not in ("positive", "negative", "neutral"):
                continue
            text = normalize(
                sofa[int(el.attrib["begin"]) * 2 : int(el.attrib["end"]) * 2].decode(
                    "utf-16-le"
                )
            )
            if len(text) >= 3:
                votes[text][label] += 1
    records = {}
    ambiguous = 0
    for text, count in votes.items():
        ordered = count.most_common()
        if len(ordered) > 1 and ordered[0][1] == ordered[1][1]:
            ambiguous += 1
            continue
        records[text] = {
            "text": text,
            "label": ordered[0][0],
            "source": "student_feedback",
        }
    uom = len(records)
    with zipfile.ZipFile(jobs[-1][1]) as archive:
        for name in archive.namelist():
            if (
                not name.endswith(
                    (
                        "amazon_cells_labelled.txt",
                        "imdb_labelled.txt",
                        "yelp_labelled.txt",
                    )
                )
                or "__MACOSX" in name
            ):
                continue
            for line in archive.read(name).decode("utf-8-sig").splitlines():
                if "\t" not in line:
                    continue
                text, label = line.rsplit("\t", 1)
                text = normalize(text)
                if text and label in ("0", "1") and text not in records:
                    records[text] = {
                        "text": text,
                        "label": "positive" if label == "1" else "negative",
                        "source": "uci_general",
                    }
    sources = {
        "uom_revision": REVISION,
        "unique_student_feedback": uom,
        "ambiguous_student_feedback_excluded": ambiguous,
        "total_unique": len(records),
        "sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for _, p in jobs},
    }
    return list(records.values()), sources


def pipeline():
    features = FeatureUnion(
        [
            (
                "word",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_features=22000,
                    lowercase=False,
                    token_pattern=r"(?u)\b\w\w+\b",
                ),
            ),
            (
                "char",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(3, 5),
                    min_df=2,
                    max_features=22000,
                    lowercase=False,
                ),
            ),
        ]
    )
    return Pipeline(
        [
            ("features", features),
            (
                "classifier",
                LogisticRegression(
                    C=3, max_iter=800, class_weight="balanced", random_state=42
                ),
            ),
        ]
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", default=str(ROOT / "training/cache"))
    args = parser.parse_args()
    records, sources = load_data(Path(args.cache))
    train, test = train_test_split(
        records,
        test_size=0.2,
        random_state=42,
        stratify=[r["source"] + ":" + r["label"] for r in records],
    )
    print(
        "Dataset:",
        sources["total_unique"],
        "unique; training:",
        len(train),
        "held-out:",
        len(test),
        flush=True,
    )
    model = pipeline()
    model.fit([r["text"] for r in train], [r["label"] for r in train])

    def metrics(rows):
        predicted = model.predict([r["text"] for r in rows])
        y = [r["label"] for r in rows]
        return {
            "samples": len(rows),
            "accuracy": float(accuracy_score(y, predicted)),
            "macro_f1": float(f1_score(y, predicted, average="macro")),
            "confusion_matrix": confusion_matrix(
                y, predicted, labels=model.classes_
            ).tolist(),
            "per_class": classification_report(
                y, predicted, output_dict=True, zero_division=0
            ),
        }

    report = {
        "sources": sources,
        "training_samples": len(train),
        "heldout_samples": len(test),
        "training_class_counts": dict(Counter(r["label"] for r in train)),
        "classes": model.classes_.tolist(),
        "heldout_combined": metrics(test),
        "heldout_student_feedback": metrics(
            [r for r in test if r["source"] == "student_feedback"]
        ),
        "heldout_general": metrics([r for r in test if r["source"] == "uci_general"]),
        "split": "Normalized unique comments; 80/20 stratified by source and label; seed 42. Held-out rows never fitted.",
        "limitations": "English baseline; neutral is learned; mixed uses a separate clause heuristic; new lecture/typo/grammar performance is not guaranteed.",
    }
    dummy = DummyClassifier(strategy="most_frequent").fit(
        [[0]] * len(train), [r["label"] for r in train]
    )
    report["majority_baseline_accuracy"] = float(
        accuracy_score([r["label"] for r in test], dummy.predict([[0]] * len(test)))
    )
    # Simulate one missing character on held-out comments only; never use these for training.
    perturbed = []
    for row in test:
        text = re.sub(
            r"\b([a-z]{3})([a-z])([a-z]{2,})\b",
            lambda m: m[1] + m[3],
            row["text"],
            count=1,
        )
        perturbed.append({**row, "text": text})
    report["heldout_single_deletion_test"] = metrics(perturbed)
    exported = {
        "classes": model.classes_.tolist(),
        "features": {},
        "weights": model.named_steps["classifier"].coef_.tolist(),
        "intercepts": model.named_steps["classifier"].intercept_.tolist(),
        "evaluation": report,
    }
    for name, vectorizer in model.named_steps["features"].transformer_list:
        exported["features"][name] = {
            "vocabulary": {k: int(v) for k, v in vectorizer.vocabulary_.items()},
            "idf": vectorizer.idf_.tolist(),
        }
    exported["version"] = hashlib.sha256(
        json.dumps(exported, sort_keys=True).encode()
    ).hexdigest()
    (ROOT / "server/model.json").write_text(
        json.dumps(exported, separators=(",", ":")) + "\n"
    )
    (ROOT / "training/evaluation.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    # Authored diagnostic strings verify runtime parity without republishing reviews.
    # These are not accuracy labels and never enter model.fit().
    cases = [
        f"{subject} {opinion}"
        for subject in ["The class", "The lecture", "The course", "The tutorial"]
        for opinion in [
            "was good.",
            "was bad.",
            "was helpful.",
            "was confusing.",
            "needs more examples.",
            "was excellent.",
            "was too fast.",
            "has useful notes.",
            "was not clear.",
            "started yesterday.",
        ]
    ] + [
        "very good",
        "verry good",
        "very goood",
        "very gud",
        "not good",
        "not bad",
        "The explanations were clear but the practical sessions were rushed.",
        "The lecturer explains clearly. The labs need more time.",
        "The timetable was published yesterday.",
        "இந்த வகுப்பு நல்லது",
        "Notes, notes, notes!",
        "",
    ]
    (ROOT / "tests/model-parity.json").write_text(
        json.dumps(
            [
                {
                    "text": t,
                    "label": str(model.predict([normalize(t)])[0]),
                    "probability": float(max(model.predict_proba([normalize(t)])[0])),
                }
                for t in cases
            ],
            ensure_ascii=False,
        )
        + "\n"
    )
    print(
        json.dumps(
            {
                k: report[k]
                for k in [
                    "training_samples",
                    "heldout_samples",
                    "heldout_combined",
                    "heldout_student_feedback",
                    "majority_baseline_accuracy",
                ]
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
