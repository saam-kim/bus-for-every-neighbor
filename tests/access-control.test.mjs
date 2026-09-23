import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules=JSON.parse(fs.readFileSync('firebase/database.rules.json','utf8'));
const classroom=fs.readFileSync('dist/classroom.js','utf8');
const main=fs.readFileSync('dist/main.js','utf8');

const klass=rules.rules.classes.$code;
assert.match(klass['.read'], /teacherUid/,
  'only the teacher may read a whole class record');
assert.match(klass['.write'], /!data\.exists\(\)/,
  'a class record may only be created, not overwritten at the root');
assert.match(klass.control['.read'], /auth != null/,
  'students may read only the shared class control state');
assert.match(klass.control['.write'], /teacherUid/,
  'only the teacher may update shared class control state');
assert.match(klass.teams.$teamId['.read'], /auth\.uid === \$teamId/,
  'a student may read their own team record');
assert.match(klass.teams.$teamId['.read'], /teacherUid/,
  'the teacher may read every team record');
assert.match(classroom, /export async function readStudentClass/);
assert.match(classroom, /export function watchStudentClass/);
assert.match(main, /readStudentClass\(code\)/);
assert.match(main, /watchStudentClass\(code,team\.uid/);
console.log('PASS Firebase access rules and student-only subscriptions are partitioned');
