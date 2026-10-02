"""Generate the Chinese distribution and a Git-backed Codex marketplace."""
import json, pathlib, shutil
root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root/'package.json').read_text())['version']
primary = root/'plugins/agent-auto-ops'
def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
entries = []
for locale, name in [('en', 'agent-auto-ops'), ('zh-CN', 'agent-auto-ops-zh')]:
    dest = root/'plugins'/name
    if dest != primary:
        if dest.exists():
            assert dest.resolve().parent == (root/'plugins').resolve()
            shutil.rmtree(dest)
        shutil.copytree(primary, dest, ignore=shutil.ignore_patterns('__pycache__','*.pyc','*.log'))
    manifest = json.loads((root/'locales'/locale/'plugin.json').read_text())
    manifest.update(name=name, version=version, license='AGPL-3.0-or-later', author={'name':'jhckevin'})
    manifest['interface']['developerName']='jhckevin'
    manifest['interface']['websiteURL']='https://github.com/jhckevin/codex-agent-auto-ops'
    write(dest/'.codex-plugin/plugin.json', manifest)
    write(dest/'locale.json', {'locale':locale})
    spec=next(iter(json.loads((dest/'.mcp.json').read_text())['mcpServers'].values()))
    write(dest/'.mcp.json', {'mcpServers':{name:spec}})
    for notice in ['LICENSE','NOTICE']:
        shutil.copyfile(root/notice, dest/notice)
    shutil.copyfile(root/'locales'/locale/'README.md', dest/'README.md')
    if locale=='zh-CN':
        shutil.copyfile(root/'locales/zh-CN/SKILL.md', dest/'skills/external-computer-use/SKILL.md')
    page=dest/'web/index.html'
    import re
    page.write_text(re.sub(r'<html lang="[^"]+"', '<html lang="'+locale+'"', page.read_text()))
    entries.append({'name':name,'source':{'source':'local','path':'./plugins/'+name},'policy':{'installation':'AVAILABLE','authentication':'ON_INSTALL'},'category':'Productivity'})
write(root/'.agents/plugins/marketplace.json', {'name':'agent-auto-ops','interface':{'displayName':'Agent Auto Ops'},'plugins':entries})
print('Synchronized English default and Chinese packages')
