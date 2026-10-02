"""Build reviewable release ZIPs from an explicit source allowlist."""
import argparse, pathlib, zipfile, json, hashlib, subprocess, re
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--firmware',action='store_true');args=p.parse_args()
subprocess.run(['python3',str(root/'tools/sync-plugins.py')],check=True)
subprocess.run(['node',str(root/'tools/render-locales.mjs')],check=True,cwd=root)
version=json.loads((root/'package.json').read_text())['version']
fwversion=re.search(r'PROJECT_VER "([^"]+)"',(root/'firmware/CMakeLists.txt').read_text()).group(1)
out=root/'artifacts'/('release-'+version);out.mkdir(parents=True,exist_ok=True)
def zipfiles(name, items):
    with zipfile.ZipFile(out/name,'w',zipfile.ZIP_DEFLATED) as z:
        for f,arc in sorted(items,key=lambda x:x[1]):
            if f.is_file() and '__pycache__' not in f.parts and f.suffix not in {'.pyc','.log','.exit'}:z.write(f,arc)
    return name
names=[]
for identifier in ['agent-auto-ops','agent-auto-ops-zh']:
    base=root/'plugins'/identifier
    names.append(zipfiles(identifier+'-'+version+'.zip',[(f,f.relative_to(base).as_posix()) for f in base.rglob('*')]))
market=[(root/'.agents/plugins/marketplace.json','.agents/plugins/marketplace.json')]
market += [(f,f.relative_to(root).as_posix()) for f in (root/'plugins').rglob('*')]
names.append(zipfiles('marketplace-'+version+'.zip',market))
allowed={'server','ui','tests','tools','plugins','locales','patches','docs','.github','.agents','firmware'}
top={'README.md','README.zh-CN.md','LICENSE','NOTICE','package.json','package-lock.json','.gitignore','.gitattributes','CONTRIBUTING.md','CONTRIBUTING.zh-CN.md','SECURITY.md','SECURITY.zh-CN.md','CHANGELOG.md'}
excluded={'node_modules','build','components','managed_components','__pycache__','artifacts','.git'}
source=[]
for f in root.rglob('*'):
    rel=f.relative_to(root)
    if not f.is_file() or any(x in excluded for x in rel.parts) or f.suffix in {'.log','.pyc','.exit'}:continue
    if f.name in {'sdkconfig','sdkconfig.old','config.local.json'}:continue
    if rel.parts[0] in allowed or rel.as_posix() in top:source.append((f,rel.as_posix()))
names.append(zipfiles('source-'+version+'.zip',source))
if args.firmware:
    build=root/'firmware/build'
    flasher=json.loads((build/'flasher_args.json').read_text())
    items=[(root/'LICENSE','LICENSE'),(root/'NOTICE','NOTICE'),(root/'firmware/THIRD_PARTY_NOTICES.txt','THIRD_PARTY_NOTICES.txt'),(build/'flash_args','flash_args'),(build/'flasher_args.json','flasher_args.json'),(root/'firmware/partitions.csv','partitions.csv'),
           (root/'docs/FIRMWARE.md','README.md'),(root/'docs/FIRMWARE.zh-CN.md','README.zh-CN.md')]
    for relative in flasher['flash_files'].values():
        f=build/relative
        assert f.resolve().is_relative_to(build.resolve())
        items.append((f,relative))
    names.append(zipfiles('firmware-'+fwversion+'.zip',items))
release={'version':version,'firmware_version':fwversion,'default_locale':'en','locales':['en','zh-CN'],'firmware_included':args.firmware,'files':{}}
for name in names:
    f=out/name;release['files'][name]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size}
(out/'RELEASE.json').write_text(json.dumps(release,indent=2)+'\n')
(out/'SHA256SUMS').write_text(''.join(v['sha256']+'  '+k+'\n' for k,v in release['files'].items()))
print(json.dumps(release,indent=2))
