const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32') throw new Error('Este comando prepara APK no Windows; em outros sistemas use o Gradle no Android Studio.');
function subdirectories(parent) {
  if (!fs.existsSync(parent)) return [];
  return fs.readdirSync(parent, {withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>path.join(parent,entry.name));
}
const candidates = [process.env.ANDROID_JAVA_HOME, process.env.JAVA_HOME, ...subdirectories(path.join(root,'.android-tools')),
  ...subdirectories(path.join(process.env.USERPROFILE || root,'.jdks')),
  'C:/Program Files/Android/Android Studio/jbr'].filter(Boolean);
const javaHome = candidates.find(directory => {
  const java = path.join(directory,'bin/java.exe');
  if (!fs.existsSync(java)) return false;
  const result = spawnSync(java, ['-version'], {encoding:'utf8'});
  return result.status === 0 && /version "21\./.test(result.stderr + result.stdout);
});
if (!javaHome) throw new Error('Configure JAVA_HOME para um JDK 21. O Java 25 do Android Studio não é compatível com o Gradle deste projeto.');
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk');
if (!fs.existsSync(sdk)) throw new Error('Configure o Android SDK no Android Studio ou informe ANDROID_HOME.');
const env = {...process.env, JAVA_HOME:javaHome, ANDROID_HOME:sdk};
const localProperties = path.join(root,'android/local.properties');
if (!fs.existsSync(localProperties)) fs.writeFileSync(localProperties,'sdk.dir='+sdk.replaceAll('\\','/')+'\n');
function run(command,args,cwd=root) {
  const result=spawnSync(command,args,{cwd,env,stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Usando Java 21 para preparar o APK de teste.');
run(process.execPath,[path.join(__dirname,'prepare-android.cjs')]);
run('cmd.exe',['/d','/s','/c','gradlew.bat :app:assembleDebug --console=plain'],path.join(root,'android'));
