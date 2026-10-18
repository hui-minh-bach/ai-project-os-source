import {spawnSync} from "node:child_process";
const r=spawnSync(process.execPath,["--test","test/media-quick-edit.test.mjs"],{stdio:"inherit",env:{...process.env,AIOS_MEDIA_REAL_E2E:"1"},timeout:200000});
if(r.error)console.error(r.error.message);process.exit(r.status??1);
