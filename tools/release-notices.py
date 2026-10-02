"""Collect licenses for dependencies incorporated by esbuild."""
import pathlib,json
root=pathlib.Path(__file__).resolve().parents[1]
notices=[]
for p in sorted((root/'node_modules').rglob('package.json')):
    try: meta=json.loads(p.read_text())
    except (ValueError,UnicodeError):continue
    for f in sorted(p.parent.iterdir()):
        if f.is_file() and f.name.lower() in {'license','license.md','license.txt','copying'}:
            notices.append(meta.get('name','unknown')+' '+meta.get('version','')+'\n'+'\n'.join(line.rstrip() for line in f.read_text(errors='replace').splitlines()))
assert notices, 'Install dependencies before collecting notices'
(root/'plugins/agent-auto-ops/THIRD_PARTY_LICENSES.txt').write_text('\n\n'.join(notices))
