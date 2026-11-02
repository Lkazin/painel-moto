const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const REPOSITORY = 'Lkazin/painel-moto';
function readReleaseConfig(gradle) {
  const applicationId = gradle.match(/^\s*applicationId\s+["']([^"']+)["']/m)?.[1];
  const versionName = gradle.match(/^\s*versionName\s+["']([^"']+)["']/m)?.[1];
  const versionCode = Number(gradle.match(/^\s*versionCode\s+(\d+)\s*$/m)?.[1]);
  if (applicationId !== 'br.com.novaesweb.entregador' || !/^\d+\.\d+\.\d+$/.test(versionName || '') ||
    !Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('Identidade ou versão Android inválida no build.gradle.');
  }
  return { applicationId, versionName, versionCode, tag: `android-v${versionName}`,
    assetName: `NovaesWeb-Entregador-v${versionName}-code${versionCode}.apk` };
}
function validateBuiltMetadata(config, metadata) {
  const element = metadata?.elements?.[0];
  if (metadata?.artifactType?.type !== 'APK' || metadata.applicationId !== config.applicationId || metadata.variantName !== 'debug' ||
      !Array.isArray(metadata.elements) || metadata.elements.length !== 1 || element?.type !== 'SINGLE' ||
      !Array.isArray(element.filters) || element.filters.length !== 0 || element.versionName !== config.versionName || element.versionCode !== config.versionCode ||
      typeof element.outputFile !== 'string' || !/^[a-zA-Z0-9_.-]+\.apk$/.test(element.outputFile) || element.outputFile.startsWith('.')) {
    throw new Error('O APK compilado não corresponde à versão/identidade esperada. Execute npm run android:apk antes de preparar a distribuição.');
  }
  return element.outputFile;
}
function validateApkBadging(config, badging) {
  const built = badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
  if (!built || built[1] !== config.applicationId || Number(built[2]) !== config.versionCode || built[3] !== config.versionName) {
    throw new Error('A identidade/versão dentro do APK não corresponde ao Gradle. Não distribua um arquivo antigo com o nome da nova versão.');
  }
}
function inspectBuiltApk(root, apkPath, config) {
  const localProperties = path.join(root,'android/local.properties');
  const configuredSdk = fs.existsSync(localProperties) ? fs.readFileSync(localProperties,'utf8').match(/^sdk\.dir=(.+)$/m)?.[1]?.trim() : '';
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || configuredSdk || path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk');
  const toolsDirectory = path.join(sdk,'build-tools');
  if (!fs.existsSync(toolsDirectory)) throw new Error('Configure o Android SDK para verificar o manifesto real do APK com aapt.');
  const aapt = fs.readdirSync(toolsDirectory).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))
    .map(version=>path.join(toolsDirectory,version,process.platform==='win32'?'aapt.exe':'aapt')).find(file=>fs.existsSync(file));
  if (!aapt) throw new Error('A ferramenta aapt do Android SDK não foi encontrada.');
  const result = spawnSync(aapt,['dump','badging',apkPath],{encoding:'utf8'});
  if (result.error || result.status !== 0) throw new Error('Não foi possível verificar o manifesto real do APK.');
  validateApkBadging(config,result.stdout);
}
function prepareRelease(root = path.resolve(__dirname, '..')) {
  const config = readReleaseConfig(fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8'));
  const debugDirectory = path.join(root,'android/app/build/outputs/apk/debug');
  const metadata = JSON.parse(fs.readFileSync(path.join(debugDirectory,'output-metadata.json'),'utf8'));
  const outputFile = validateBuiltMetadata(config, metadata);
  const apkPath = path.join(debugDirectory,outputFile);
  inspectBuiltApk(root,apkPath,config);
  const apk = fs.readFileSync(apkPath);
  if (apk.length < 4 || apk.readUInt32LE(0) !== 0x04034b50) throw new Error('O arquivo compilado não tem formato APK/ZIP válido.');
  const sha256 = crypto.createHash('sha256').update(apk).digest('hex');
  const releaseDirectory = path.join(root,'.android-tools/releases',config.tag);
  fs.mkdirSync(releaseDirectory,{recursive:true});
  const target = path.join(releaseDirectory,config.assetName);
  fs.writeFileSync(target,apk);
  const notes = `# NovaesWeb Entregador ${config.versionName}

Versão Android: ${config.versionName} (versionCode ${config.versionCode}).
Aplicativo: ${config.applicationId}.
Repositório de distribuição: ${REPOSITORY}.
Tag da versão: ${config.tag}.
Arquivo: ${config.assetName}.
SHA256: ${sha256}

## Novidades

- Aviso no aplicativo quando houver uma versão Android mais recente publicada.
- Botão para baixar a atualização oficial, mediante ação do entregador.
- Mantém conta, pedidos, histórico e GPS existentes.

## Instalação

Esta é uma versão de teste assinada com a chave Android Debug deste computador. A atualização por cima da versão anterior exige o mesmo identificador e a mesma assinatura. Confira a assinatura com apksigner antes de distribuir; não troque a chave nem desinstale o aplicativo para forçar uma atualização.

Quem instalou a versão 1.0 precisa instalar esta versão manualmente uma vez, porque a versão 1.0 não contém o verificador de atualizações. As próximas notificações dependem de uma GitHub Release pública real, marcada como versão final, com tag e APK no padrão acima. Gerar estes arquivos localmente não publica a versão.

O download é iniciado pelo usuário e a instalação é confirmada pelo Android. Não há instalação silenciosa nem acesso a contatos, senhas ou dados de outros aplicativos.
`;
  fs.writeFileSync(path.join(releaseDirectory,'release-notes.md'),notes);
  fs.writeFileSync(path.join(releaseDirectory,config.assetName+'.sha256'),`${sha256}  ${config.assetName}\n`);
  return {...config,sha256,apkBytes:apk.length,target};
}
if (require.main === module) console.log(JSON.stringify(prepareRelease(),null,2));
module.exports = {readReleaseConfig,validateBuiltMetadata,validateApkBadging,prepareRelease};
