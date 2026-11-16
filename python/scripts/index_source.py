"""Record every source line and its owning definition for the future PDF, without generating a PDF."""
import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    result = {}
    files = sorted(p for p in ROOT.rglob('*') if p.is_file() and p.suffix in ('.py','.bat','.yml','.ini'))
    for path in files:
        if any(part in ('.venv','__pycache__','.git') for part in path.relative_to(ROOT).parts):
            continue
        source = path.read_text(encoding='utf-8')
        definitions = []
        if path.suffix == '.py':
            for node in ast.walk(ast.parse(source)):
                if isinstance(node,(ast.FunctionDef,ast.ClassDef,ast.AsyncFunctionDef)):
                    definitions.append({'name':node.name,'start':node.lineno,'end':node.end_lineno,
                                        'explanation':ast.get_docstring(node)})
        lines = []
        for number,text in enumerate(source.splitlines(),1):
            parents = [d for d in definitions if d['start']<=number<=d['end']]
            owner = min(parents,key=lambda d:d['end']-d['start'])['name'] if parents else 'module/configuration'
            lines.append({'number':number,'source':text,'definition':owner})
        result[str(path.relative_to(ROOT))] = {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                                              'definitions':definitions,'lines':lines}
    (ROOT/'docs/LINE_INDEX.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'Indexed {len(result)} files for later line-by-line explanation.')


if __name__ == '__main__':
    main()
