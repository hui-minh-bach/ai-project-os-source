import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalAccess} from '../src/lib/local-access.mjs';

test('local browser grant requires a single unpredictable ticket and creates a strict cookie',()=>{
  const token='d'.repeat(64);
  const access=createLocalAccess({port:55198,version:'0.7.0',launchToken:token});
  assert.equal(access.validTicket(token),true);
  assert.equal(access.validTicket(token),false,'A consumed browser ticket must never be reusable');
  assert.equal(access.validTicket('bad'),false);
  assert.equal(access.validSession({headers:{}}),false);
  let responseHeaders=null;
  const response={writeHead(code,headers){assert.equal(code,303);responseHeaders=headers;},end(){}};
  access.grant(response);
  assert.match(responseHeaders['set-cookie'],/HttpOnly; SameSite=Strict/);
  assert.equal(responseHeaders.location,'/');
  const cookie=responseHeaders['set-cookie'].split(';')[0];
  assert.equal(access.validSession({headers:{cookie}}),true);
  assert.equal(access.validSession({headers:{cookie:'aios_session=invalid'}}),false);
});
