import {commandExists,run} from './shell.mjs';
import {npmCliPath} from './managed-cli.mjs';
const fail=(code,message)=>Object.assign(new Error(message),{code});
export async function assertCodeExecution({mode,confirmHost=false},{exists=commandExists,execute=run,platform=process.platform,resolveNpm=npmCliPath}={}){
 if(!['docker','host'].includes(mode))throw fail('WORK_TEST_MODE','Chon Docker hoac Host co xac nhan. Safe mode khong chay duoc test nen khong the hoan tat san pham.');
 if(mode==='host'&&!confirmHost)throw fail('WORK_HOST_CONSENT','Host chay ma AI tao tren may that. Can dong y rieng cho quyen nay.');
 if(!(await exists('git')))throw fail('WORK_GIT_REQUIRED','Can Git de tach workspace va hop nhat ket qua. Chay INSTALL-CODE-TOOLS-WINDOWS.cmd.');
 if(mode==='docker'){
  if(!(await exists('docker')))throw fail('WORK_DOCKER_REQUIRED','Docker chua co. Cai/mo Docker Desktop hoac chu dong chon Host.');
  const d=await execute('docker',['info','--format','{{.ServerVersion}}'],{timeoutMs:5000,inheritEnv:false});
  if(d.code!==0)throw fail('WORK_DOCKER_REQUIRED','Docker daemon chua san sang.');
  const image=await execute('docker',['image','inspect','node:22-bookworm-slim'],{timeoutMs:5000,inheritEnv:false});
  if(image.code!==0)throw fail('WORK_DOCKER_IMAGE','Can nap truoc image node:22-bookworm-slim. App khong tu tai image khi chua duoc dong y.');
 }else if(platform==='win32')resolveNpm();
 else if(!(await exists('npm')))throw fail('WORK_NPM_REQUIRED','Can Node/npm de chay test.');
 return {mode,hostGranted:mode==='host',checkedAt:new Date().toISOString()};
}
