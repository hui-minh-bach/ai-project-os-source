#!/usr/bin/env python3
"""Atomic, file-backed project checkpoint; never executes commands or schedules work."""
from __future__ import annotations
import argparse, hashlib, json, os, sys, tempfile
from pathlib import Path
from datetime import datetime, timezone

STAGES = ('specify', 'build', 'demonstrate', 'integrate')
STATUSES = ('pending', 'in_progress', 'done', 'blocked', 'not_tested')

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(p: Path) -> str:
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024), b''):
            h.update(b)
    return h.hexdigest()

def atomic_write(p: Path, data: dict):
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='state-', suffix='.tmp', dir=p.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data,f,ensure_ascii=False,indent=2); f.write('\n');f.flush();os.fsync(f.fileno())
        os.replace(name,p)
    finally:
        if os.path.exists(name): os.unlink(name)

def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,required=True)
    sub=ap.add_subparsers(dest='cmd',required=True)
    init=sub.add_parser('init');init.add_argument('--goal',required=True)
    rec=sub.add_parser('record');rec.add_argument('--stage',choices=STAGES,required=True)
    rec.add_argument('--status',choices=STATUSES,required=True);rec.add_argument('--next',default='')
    rec.add_argument('--note',default='');rec.add_argument('--evidence',action='append',default=[])
    sub.add_parser('show');sub.add_parser('verify')
    a=ap.parse_args(argv);root=a.root.resolve();p=root/'.project-state/state.json'
    if a.cmd=='init':
        if p.exists(): raise ValueError('Checkpoint exists; use record. Refusing to reset progress.')
        data={'schema':1,'goal':a.goal,'created_at':now(),'stages':{s:{'status':'pending','evidence':[]} for s in STAGES},'next_action':'Specify the authorized work.','history':[]}
    else:
        data=json.loads(p.read_text(encoding='utf-8'))
    if a.cmd=='record':
        evidence=[]
        for name in a.evidence:
            f=(root/name).resolve()
            if not f.is_relative_to(root): raise ValueError('Evidence must remain inside project root.')
            if not f.is_file(): raise ValueError('Missing evidence file: '+name)
            evidence.append({'path':str(f.relative_to(root)), 'sha256':digest(f), 'bytes':f.stat().st_size})
        if a.status=='done' and not evidence: raise ValueError('A done stage requires at least one evidence file. This is not a quality certification.')
        data['stages'][a.stage]={'status':a.status,'note':a.note,'evidence':evidence,'at':now()}
        data['next_action']=a.next
        data['history'].append({'at':now(),'stage':a.stage,'status':a.status,'note':a.note})
    if a.cmd in ('init','record'): data['updated_at']=now();atomic_write(p,data)
    if a.cmd=='verify':
        issues=[]
        for s,v in data['stages'].items():
            for e in v.get('evidence',[]):
                f=(root/e['path']).resolve()
                if not f.is_relative_to(root) or not f.is_file() or digest(f)!=e['sha256']:
                    issues.append(s+': changed/missing evidence '+e['path'])
        print(json.dumps({'ok':not issues,'issues':issues,'note':'File identity only; not functional or visual certification.'},indent=2))
        return 1 if issues else 0
    print(json.dumps(data,ensure_ascii=False,indent=2));return 0
if __name__=='__main__':
    try: sys.exit(main())
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as e:
        print('ERROR: '+str(e),file=sys.stderr);sys.exit(2)
