import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const args=process.argv.slice(2),[chromiumPath,webkitPath,output]=args;
if(args.length!==3)throw Error('Usage: node tools/record-notation-evidence.mjs chromium.json webkit.json output.json (Node gate runs here)');
const required=['catalog','notation-descriptor','public-practice','public-score','fingerings','student-fingerings',
  'teacher-fingerings','score-pages','notation-pilot'].map(name=>`e2e/${name}.spec.js`);
async function browserReport(path,browser){
  const text=await readFile(path,'utf8'),report=JSON.parse(text.slice(text.indexOf('{')));
  const files=new Set(),ids=new Set();
  function visit(suite){for(const spec of suite.specs??[]){files.add(spec.file.replaceAll('\\','/'));
    ids.add(spec.id);if(!spec.ok)throw Error(`Failed browser case: ${spec.title}`);}for(const child of suite.suites??[])visit(child);}
  for(const suite of report.suites??[])visit(suite);
  if(report.errors?.length||report.stats.unexpected||report.stats.flaky||report.stats.skipped
    ||required.some(file=>![...files].some(found=>found.endsWith(file)||found===file.slice(4))))throw Error(`Incomplete or failing ${browser} gate`);
  const projects=report.config.projects;
  if(projects.length!==1||projects[0].name!==browser)throw Error(`Wrong browser report: ${browser}`);
  const listed=JSON.parse(execFileSync(process.execPath,['node_modules/@playwright/test/cli.js','test',
    '--config=playwright.notation.config.mjs','--list','--reporter=json',`--browser=${browser}`],{encoding:'utf8'}));
  const expected=new Set();
  function collect(suite){for(const spec of suite.specs??[])expected.add(spec.id);for(const child of suite.suites??[])collect(child);}
  for(const suite of listed.suites)collect(suite);
  if(ids.size!==expected.size||[...expected].some(id=>!ids.has(id))||report.stats.expected!==expected.size)
    throw Error(`Filtered or stale ${browser} test inventory`);
  return {browser,passed:report.stats.expected,failed:0,skipped:0,startedAt:report.stats.startTime,durationMs:report.stats.duration,files:required};
}
const browserChecks=await Promise.all([browserReport(chromiumPath,'chromium'),browserReport(webkitPath,'webkit')]);
// Never trust a caller-supplied subset or inherit test filters/hosted opt-ins.
const nodeEnvironment={...process.env};
for(const key of ['NODE_OPTIONS','NODE_TEST_CONTEXT','APARTMENDER_LOCAL_SUPABASE'])delete nodeEnvironment[key];
const nodeArgs=['--test','--test-reporter=tap'];
const tap=execFileSync(process.execPath,nodeArgs,{encoding:'utf8',env:nodeEnvironment,maxBuffer:16*1024*1024});
const total=name=>Number(tap.match(new RegExp(`^# ${name} (\\d+)$`,'m'))?.[1]??NaN);
const skipped=[...tap.matchAll(/^\s*ok \d+ - (.+) # SKIP(?: .*)?$/gm)].map(match=>match[1]);
const localSkip='authenticated Student records one assigned Session through local Sludge RPCs';
if(total('fail')!==0||total('cancelled')!==0||total('todo')!==0||!total('pass')
  ||total('tests')!==total('pass')+total('skipped')||skipped.length!==total('skipped')
  ||skipped.length>1||skipped.some(name=>name!==localSkip))throw Error('Incomplete, failing or unexpectedly skipped Node gate');
const files=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=`${directory}/${entry.name}`;
  if(entry.isDirectory()){if(directory==='docs'&&!['login','notation'].includes(entry.name))continue;await walk(path);}
  else if(/\.(?:js|css|html)$/.test(path)||['docs/pieces.json','docs/general-practice-collection.json'].includes(path)
    ||path.startsWith('docs/notation/editions/')&&path.endsWith('.json'))files.push(path);
}}
await walk('docs');files.push('docs/vendor/verovio/manifest.json');files.sort();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs=await Promise.all(files.map(async path=>({path,sha256:sha(await readFile(path))})));
const sourceBaseCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const evidence={contractVersion:1,issue:'https://github.com/thdecn/apartmender/issues/66',bead:'sludge-s16.19',
  generatedAt:new Date().toISOString(),sourceBaseCommit,sourceNote:'Runtime fingerprint includes working-tree code under test; PR merge SHA must also be recorded for manual evidence.',
  runtimeFingerprint:sha(inputs.map(row=>`${row.path}:${row.sha256}\n`).join('')),runtimeInputs:inputs,
  node:{command:['node',...nodeArgs],version:process.version,passed:total('pass'),failed:0,skipped:total('skipped'),allowedSkip:skipped[0]??null},browserChecks,
  manualPlatforms:['macOS Safari','iPhone Safari','iPad Firefox'].map(platform=>({platform,status:'pending',device:null,browserVersion:null,buildCommit:null,observations:null})),
  ownerUsabilityAccepted:false,releaseAuthorized:false,knownDiagnosticFollowup:'sludge-lgi remains open; the historical iPad failed sample has no established cause.'};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({output,runtimeFingerprint:evidence.runtimeFingerprint,browserChecks:browserChecks.map(({browser,passed})=>({browser,passed})),node:evidence.node,manual:'pending'}));
