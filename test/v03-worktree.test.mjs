import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { workspaceDir } from '../src/lib/workspace.mjs';
import { ensureBaseline, createTaskWorktree, commitTask, mergeTask, cleanupTaskWorktree } from '../src/lib/task-git.mjs';

test('task worktree merges reviewed branch without editing main early', async()=>{
  const id='test-wt-'+Date.now();const main=workspaceDir(id);fs.writeFileSync(path.join(main,'a.txt'),'base\n');await ensureBaseline(id);
  const wt=await createTaskWorktree(id,'T1');fs.writeFileSync(path.join(wt.dir,'a.txt'),'changed\n');await commitTask(wt,'change');
  assert.equal(fs.readFileSync(path.join(main,'a.txt'),'utf8'),'base\n');
  const merged=await mergeTask(id,wt);assert.equal(merged.ok,true);assert.equal(fs.readFileSync(path.join(main,'a.txt'),'utf8'),'changed\n');
  await cleanupTaskWorktree(id,wt,{deleteBranch:true});
});
