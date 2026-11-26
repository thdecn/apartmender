import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Separate from node --test: the recorder runs that full gate itself, so an
// integration test recursively invoking it must not be in its discovered suite.
const root=await mkdtemp(join(tmpdir(),'notation-evidence-check-'));
const source=dirname(fileURLToPath(import.meta.url));
const put=async(path,text,mode)=>{await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text,mode?{mode}:undefined);};
const env={...process.env,PATH:join(root,'bin')+':'+process.env.PATH};
const run=(args,extraEnv={})=>spawnSync(process.execPath,args,{cwd:root,env:{...env,...extraEnv},encoding:'utf8'});
const required=['catalog','notation-descriptor','public-practice','public-score','fingerings','student-fingerings','teacher-fingerings','score-pages','notation-pilot'];
const report=browser=>({config:{projects:[{name:browser}]},errors:[],stats:{expected:required.length,unexpected:0,flaky:0,skipped:0},
  suites:[{specs:required.map(name=>({id:browser+':'+name,file:'e2e/'+name+'.spec.js',ok:true,title:name}))}]});
try{
  await put('package.json','{"type":"module"}');await put('docs/index.html','<!doctype html>');await put('docs/vendor/verovio/manifest.json','{}');
  await put('bin/git',`#!/usr/bin/env node\nprocess.stdout.write('${'f'.repeat(40)}\\n');\n`,0o755);
  await put('node_modules/@playwright/test/cli.js',`const reports=${JSON.stringify({chromium:report('chromium'),webkit:report('webkit')})};\nconsole.log(JSON.stringify(reports[process.argv.find(x=>x.startsWith('--browser=')).slice(10)]));`);
  await put('chromium.json',JSON.stringify(report('chromium')));await put('webkit.json',JSON.stringify(report('webkit')));
  await put('test/core.test.js',`import test from 'node:test';test('core gate',()=>{});`);
  await put('test/auth.test.js',`import test from 'node:test';test('required auth gate',()=>{throw Error('omitted auth failure');});`);
  await put('test/local.test.js',`import test from 'node:test';test('authenticated Student records one assigned Session through local Sludge RPCs',{skip:process.env.APARTMENDER_LOCAL_SUPABASE!=='1'},()=>{throw Error('local opt-in must not run');});`);
  await mkdir(join(root,'tools'));await copyFile(join(source,'record-notation-evidence.mjs'),join(root,'tools/record-notation-evidence.mjs'));
  const subset=run(['--test','--test-reporter=tap','test/core.test.js']);assert.equal(subset.status,0);
  await put('partial.tap',subset.stdout);
  const supplied=run(['tools/record-notation-evidence.mjs','chromium.json','webkit.json','partial.tap','supplied.json']);
  assert.notEqual(supplied.status,0,'caller-supplied partial Node report must be rejected');
  const args=['tools/record-notation-evidence.mjs','chromium.json','webkit.json','evidence.json'];
  const failed=run(args);assert.notEqual(failed.status,0,'unfiltered Node execution must include failing auth suite');
  await assert.rejects(readFile(join(root,'evidence.json')));
  await put('test/auth.test.js',`import test from 'node:test';import assert from 'node:assert/strict';test('required auth gate',()=>{for(const key of ['NODE_OPTIONS','APARTMENDER_LOCAL_SUPABASE'])assert.equal(process.env[key],undefined);assert.notEqual(process.env.NODE_TEST_CONTEXT,'fixture-parent');});`);
  const passed=run(args,{NODE_OPTIONS:'--conditions=evidence-check',NODE_TEST_CONTEXT:'fixture-parent',APARTMENDER_LOCAL_SUPABASE:'1'});
  assert.equal(passed.status,0,passed.stderr);
  const evidence=JSON.parse(await readFile(join(root,'evidence.json'),'utf8'));
  assert.equal(evidence.node.passed,2);assert.equal(evidence.node.skipped,1);
  assert.deepEqual(evidence.node.command,['node','--test','--test-reporter=tap']);
  await rm(join(root,'evidence.json'));
  await put('test/ignored.test.js',`import test from 'node:test';test.skip('required persistence gate',()=>{});`);
  assert.notEqual(run(args).status,0,'an unrelated skipped suite must block evidence');
  await assert.rejects(readFile(join(root,'evidence.json')));
  await rm(join(root,'test/ignored.test.js'));
  await put('test/pending.test.js',`import test from 'node:test';test.todo('required persistence gate');`);
  assert.notEqual(run(args).status,0,'a pending required test must block evidence');
  console.log('PASS: supplied subset rejected; omitted failure executed; full gate recorded; only documented skip allowed; TODO rejected');
}finally{await rm(root,{recursive:true,force:true});}
