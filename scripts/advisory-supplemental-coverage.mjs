#!/usr/bin/env node
/**
 * Read-only OSV export census against a pinned github/advisory-database checkout.
 * Requires Node.js, Python 3 (standard library only), and git.
 * No target scanning, dependency submission, application-data edits or publication.
 * --download refreshes all seven official exports; otherwise verify/reuse cached bytes.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const options = { from: '2022-11-01T00:00:00Z', through: '2026-10-08T02:00:00Z', cache: '.cache/advisory-supplemental', download: false, 'verify-github': false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--download') options.download = true;
  else if (args[i] === '--verify-github') options['verify-github'] = true;
  else if (args[i] === '--help') {
    console.log('node scripts/advisory-supplemental-coverage.mjs --github-snapshot /path/to/advisory-database --cache /path/to/cache [--download] [--verify-github] [--from ISO] [--through ISO] [--output report.json]');
    process.exit(0);
  } else if (['--github-snapshot', '--cache', '--from', '--through', '--output'].includes(args[i]) && args[i + 1]) {
    options[args[i].slice(2)] = args[++i];
  } else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
}
if (!options['github-snapshot']) throw new Error('--github-snapshot is required (pin and retain its commit)');
options.cache = resolve(options.cache);
options.output = resolve(options.output ?? `${options.cache}/coverage.json`);

// Python's standard-library ZIP reader validates CRCs without extracting archives.
// Keep full candidate ID inventories in the output rather than a hand-picked sample.
const python = String.raw`
import collections, datetime, hashlib, json, pathlib, subprocess, sys, urllib.request, urllib.parse, urllib.error, zipfile, xml.etree.ElementTree as ET
O=json.loads(sys.argv[1]); CACHE=pathlib.Path(O['cache']); CACHE.mkdir(parents=True,exist_ok=True)
ECOS=['npm','PyPI','RubyGems','Go','crates.io','Maven','NuGet']
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def date(v):
    if not isinstance(v,str) or not v: return None
    try: return datetime.datetime.fromisoformat(v.replace('Z','+00:00')).astimezone(datetime.timezone.utc)
    except ValueError: return None
START=date(O['from']); END=date(O['through'])
if START is None or END is None or START>END: raise ValueError('Invalid inclusive timestamp window')
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        while b:=f.read(1024*1024): h.update(b)
    return h.hexdigest()
def fetch(name,url):
    p=CACHE/name; m=CACHE/(name+'.meta.json')
    if O['download']:
        t=p.with_suffix(p.suffix+'.part')
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'cyber-incident-chronicle-source-census/1.0'}),timeout=120) as r, t.open('wb') as f:
            while b:=r.read(1024*1024): f.write(b)
            f.flush()
            meta={'file':name,'url':url,'bytes':t.stat().st_size,'sha256':sha(t),'lastModified':r.headers.get('Last-Modified'),'etag':r.headers.get('ETag'),'generation':r.headers.get('x-goog-generation'),'metageneration':r.headers.get('x-goog-metageneration'),'downloadedAt':now()}
        t.replace(p);m.write_text(json.dumps(meta,indent=2)+'\n')
    if not p.exists() or not m.exists(): raise ValueError('Missing source/cache manifest: '+name+'; use --download or supply the retained cache')
    meta=json.loads(m.read_text())
    if meta['url']!=url or meta['bytes']!=p.stat().st_size or meta['sha256']!=sha(p): raise ValueError('Cache identity/digest mismatch: '+name)
    return p,meta
def keys(r): return sorted(set(str(x).upper() for x in [r['id']]+r.get('aliases',[]) if isinstance(x,str) and x))
def reason(r):
    d=date(r.get('published'))
    if d is None:return 'missingOrInvalidPublished'
    if d<START:return 'beforeWindow'
    if d>END:return 'afterWindow'
    if not any(a.get('package',{}).get('ecosystem') in ECOS for a in r.get('affected',[])):return 'outsideSupportedEcosystems'
    return None
def compact(r):
    flags=sorted(set(v for v in [r.get('database_specific',{}).get('informational')]+[a.get('database_specific',{}).get('informational') for a in r.get('affected',[])] if isinstance(v,str)))
    extra={'informational':flags} if flags else {}
    return {**extra,'id':r['id'],'aliases':r.get('aliases',[]),'published':r.get('published'),'modified':r.get('modified'),'withdrawn':r.get('withdrawn'),'ecosystems':sorted(set(a.get('package',{}).get('ecosystem') for a in r.get('affected',[]) if a.get('package',{}).get('ecosystem') in ECOS)),'packages':sorted(set(a.get('package',{}).get('ecosystem','')+':'+a.get('package',{}).get('name','') for a in r.get('affected',[]) if a.get('package',{}).get('ecosystem') in ECOS))}
class DSU:
    def __init__(self):self.parent={}
    def find(self,x):
        self.parent.setdefault(x,x)
        root=x
        while self.parent[root]!=root:root=self.parent[root]
        while x!=root:prev=self.parent[x];self.parent[x]=root;x=prev
        return root
    def add(self,ks):
        root=self.find(ks[0])
        for k in ks[1:]:self.parent[self.find(k)]=root
DS=DSU();GITHUB={};GH_ELIGIBLE={};GH_REASONS=collections.Counter()
root=pathlib.Path(O['github-snapshot'])
commit=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
if subprocess.check_output(['git','-C',str(root),'status','--porcelain','--','advisories/github-reviewed'],text=True).strip():raise ValueError('Reviewed snapshot has uncommitted changes; use a clean pinned checkout')
files=sorted((root/'advisories/github-reviewed').rglob('*.json'))
if not files:raise ValueError('No github-reviewed JSON records found')
for p in files:
    r=json.loads(p.read_text()); k=r['id'].upper()
    if k in GITHUB:raise ValueError('Duplicate reviewed source ID: '+k)
    GITHUB[k]=compact(r);DS.add(keys(r));why=reason(r)
    if why:GH_REASONS[why]+=1
    else:GH_ELIGIBLE[k]=GITHUB[k]
print('GitHub reviewed: '+str(len(files))+'; eligible: '+str(len(GH_ELIGIBLE)),flush=True)
RECORDS={};CANONICAL_HASH={};SOURCES=[];DUPLICATES=0;VARIANTS=[];PER_ECO={}
for eco in ECOS:
    p,meta=fetch('osv-'+eco+'.zip','https://storage.googleapis.com/osv-vulnerabilities/'+urllib.parse.quote(eco,safe='')+'/all.zip')
    count=0;prefixes=collections.Counter()
    with zipfile.ZipFile(p) as z:
        for item in z.infolist():
            if item.is_dir():continue
            if not item.filename.endswith('.json'):raise ValueError('Unexpected export entry: '+item.filename)
            r=json.loads(z.read(item));k=r['id'].upper();count+=1;prefixes[r['id'].split('-')[0]]+=1
            digest=hashlib.sha256(json.dumps(r,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            c=compact(r);c['exclusionReason']=reason(r)
            if k in RECORDS:
                DUPLICATES+=1
                if digest!=CANONICAL_HASH[k]:
                    VARIANTS.append({'id':r['id'],'ecosystem':eco,'retainedModified':RECORDS[k]['modified'],'otherModified':c['modified']})
                    if (date(c.get('modified')) or START)>(date(RECORDS[k].get('modified')) or START):RECORDS[k]=c;CANONICAL_HASH[k]=digest
            else:RECORDS[k]=c;CANONICAL_HASH[k]=digest
    PER_ECO[eco]={'archiveRecords':count,'prefixes':dict(sorted(prefixes.items()))};meta['records']=count;SOURCES.append(meta)
    print(eco+': '+str(count)+' records',flush=True)
for r in RECORDS.values():DS.add(keys(r))
GH_ROOTS=collections.defaultdict(list);GH_ALL_ROOTS=collections.defaultdict(list)
for k,r in GITHUB.items():GH_ALL_ROOTS[DS.find(k)].append(k)
for k,r in GH_ELIGIBLE.items():GH_ROOTS[DS.find(k)].append(k)
OSV_ROOTS={DS.find(k) for k in RECORDS}
EXCLUDED=collections.Counter();OUTCOMES=collections.Counter();UNMATCHED=[];OUTSIDE=[];SCOPED={};PREFIX_COUNTS=collections.Counter();GROUPS=collections.defaultdict(list)
for k,r in sorted(RECORDS.items()):
    why=r['exclusionReason']
    if why:EXCLUDED[why]+=1;continue
    SCOPED[k]=r;prefix=r['id'].split('-')[0];PREFIX_COUNTS[prefix]+=1;rootid=DS.find(k)
    if rootid in GH_ROOTS: outcome='aliasMatchedEligibleReviewed'
    elif rootid in GH_ALL_ROOTS:outcome='aliasMatchedReviewedOutsideScope';OUTSIDE.append({**r,'matchedReviewedIds':sorted(GH_ALL_ROOTS[rootid])})
    else:outcome='noReviewedAliasMatch';UNMATCHED.append(r);GROUPS[rootid].append(r['id'])
    OUTCOMES[outcome]+=1
    for eco in r['ecosystems']:
        PER_ECO[eco]['scopedRecords']=PER_ECO[eco].get('scopedRecords',0)+1
        PER_ECO[eco][outcome]=PER_ECO[eco].get(outcome,0)+1
CANDIDATE_PREFIX=collections.Counter(r['id'].split('-')[0] for r in UNMATCHED)
MISSING_GH=sorted(k for k in GH_ELIGIBLE if DS.find(k) not in OSV_ROOTS)
NON_MAL=[r for r in UNMATCHED if not r['id'].startswith('MAL-')]
summary={'generatedAt':now(),'scope':{'fromInclusive':O['from'],'throughInclusive':O['through'],'ecosystems':ECOS,'withdrawn':'included','dateField':'each source record published, not maintainer disclosure date'},'github':{'repository':'https://github.com/github/advisory-database','commit':commit,'reviewedRecords':len(GITHUB),'eligibleRecords':len(GH_ELIGIBLE),'eligibleWithdrawn':sum(bool(r['withdrawn']) for r in GH_ELIGIBLE.values()),'exclusions':dict(GH_REASONS),'eligibleWithoutAnyOSVExportAliasMatch':len(MISSING_GH)},'osv':{'sources':SOURCES,'perEcosystem':PER_ECO,'archiveRecordSum':sum(x['records'] for x in SOURCES),'uniqueSourceIds':len(RECORDS),'duplicateIdsAcrossArchives':DUPLICATES,'crossArchiveVariants':VARIANTS,'scopedSourceRecords':len(SCOPED),'scopedWithdrawnRecords':sum(bool(r['withdrawn']) for r in SCOPED.values()),'scopedPrefixes':dict(PREFIX_COUNTS),'exclusions':dict(EXCLUDED),'outcomes':dict(OUTCOMES),'unmatchedPrefixes':dict(CANDIDATE_PREFIX),'unmatchedAliasGroups':len(GROUPS),'unmatchedNonMaliciousPrefixRecords':len(NON_MAL),'unmatchedWithdrawnRecords':sum(bool(r['withdrawn']) for r in UNMATCHED),'nonMaliciousPrefixWithdrawnRecords':sum(bool(r['withdrawn']) for r in NON_MAL),'nonMaliciousPrefixInformationalFlags':dict(collections.Counter(flag for r in NON_MAL for flag in r.get('informational',[])))},'limitations':['Full census of the retained seven ecosystem ZIP exports, not every vulnerability or a synchronized OSV database snapshot.','Exports are independently updated; snapshot checksums, Last-Modified and ETags are retained. Missing ecosystem records, including some withdrawn records in [EMPTY], are outside this census.','Only id/aliases define equivalence. related/upstream and matching names never merge records. Missing aliases or mistaken upstream aliases can affect matches.','A nonmatch is a source-level review candidate, not a confirmed additional distinct exploitable vulnerability.','MAL records are malicious-package reports. They are counted explicitly but do not meet a conventional library-bug-only scope automatically.','GitHub-reviewed status is not inferred for non-GHSA records; no candidate is automatically imported.','JVN is product/CPE oriented. An all-product total is not a denominator for the seven package ecosystems.']}
# A one-record API request gets the documented totalRes without pretending to fetch all pages.
params={'method':'getVulnOverviewList','feed':'hnd','startItem':'1','maxCountItem':'1','rangeDatePublic':'n','rangeDatePublished':'n','rangeDateFirstPublished':'n','lang':'ja'}
for label,d in [('Start',START),('End',END)]:
    for unit,value in [('Y',d.year),('M',d.month),('D',d.day)]:params['dateFirstPublished'+label+unit]=str(value)
u='https://jvndb.jvn.jp/myjvn?'+urllib.parse.urlencode(params)
try:
    if O['download']:
        p,meta=fetch('jvn-scope-first-page.xml',u)
    else:
        p=CACHE/'jvn-scope-first-page.xml'
        meta=json.loads((CACHE/'jvn-scope-first-page.xml.meta.json').read_text()) if (CACHE/'jvn-scope-first-page.xml.meta.json').exists() else None
    if not p.exists():raise ValueError('JVN API first-page response not available; not assessed')
    tree=ET.parse(p);status=next(e for e in tree.iter() if e.tag.endswith('}Status'))
    if status.get('retCd')!='0':raise ValueError('JVN API error: '+str(status.attrib))
    for k,v in params.items():
        if k not in ['lang'] and status.get(k)!=v:raise ValueError('JVN response query mismatch: '+k)
    summary['jvn']={'url':u,'responseSha256':sha(p),'metadata':meta,'apiStatus':dict(status.attrib),'declaredAllProductTotal':int(status.get('totalRes')),'retrievedItems':int(status.get('totalResRet')),'coverage':'denominator only; full records and package eligibility not assessed','dateCaveat':'MyJVN date parameters are calendar dates in service time, not an exact UTC timestamp filter.'}
except Exception as e:summary['jvn']={'coverage':'not assessed','error':str(e)}
ghids=sorted(r['id'] for r in UNMATCHED if r['id'].startswith('GHSA-'))
verification=CACHE/'unmatched-ghsa-verification.json'
if O['verify-github']:
    tree=subprocess.check_output(['git','-C',str(root),'ls-tree','-r','--name-only','HEAD'],text=True).splitlines();rows=[]
    for gid in ghids:
        url='https://api.github.com/advisories/'+gid
        try:
            try:
                with urllib.request.urlopen(urllib.request.Request(url,headers={'Accept':'application/vnd.github+json','User-Agent':'cyber-incident-chronicle-source-census/1.0','X-GitHub-Api-Version':'2022-11-28'}),timeout=45) as response: body=response.read();status=response.status
            except urllib.error.HTTPError as e:body=e.read();status=e.code
            (CACHE/(gid+'.github-api.json')).write_bytes(body);r=json.loads(body)
            rows.append({'id':gid,'url':url,'status':status,'checkedAt':now(),'responseSha256':hashlib.sha256(body).hexdigest(),'treePaths':[p for p in tree if gid in p],**{k:r.get(k) for k in ['ghsa_id','cve_id','type','summary','published_at','updated_at','withdrawn_at','github_reviewed_at','vulnerabilities','message']}})
        except Exception as e:rows.append({'id':gid,'url':url,'checkedAt':now(),'error':str(e)})
    verification.write_text(json.dumps(rows,indent=2)+'\n')
if verification.exists():
    rows=json.loads(verification.read_text())
    if sorted(r['id'] for r in rows)!=ghids:raise ValueError('Cached GitHub verification ID set no longer matches candidates; rerun --verify-github')
    for r in rows:
        if 'responseSha256' in r and sha(CACHE/(r['id']+'.github-api.json'))!=r['responseSha256']:raise ValueError('GitHub response digest mismatch: '+r['id'])
    summary['unmatchedGhsaVerification']=rows
summary['inventories']={'unmatchedRecords':UNMATCHED,'unmatchedAliasGroups':sorted(sorted(v) for v in GROUPS.values()),'matchedReviewedOutsideScope':OUTSIDE,'eligibleReviewedWithoutAnyOSVExportAliasMatch':MISSING_GH}
out=pathlib.Path(O['output']);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['inventories']},ensure_ascii=False,indent=2));print('Full inventory: '+str(out))
`;
const result = spawnSync('python3', ['-c', python, JSON.stringify(options)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
