const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readReleaseConfig,validateBuiltMetadata,validateApkBadging} = require('./prepare-android-release.cjs');
const gradle=`android { defaultConfig {
 applicationId "br.com.novaesweb.entregador"
 versionCode 2
 versionName "1.1.0"
} }`;
const config=readReleaseConfig(gradle);
function built(patch={}) { return {artifactType:{type:'APK'},applicationId:config.applicationId,variantName:'debug',elements:[{type:'SINGLE',filters:[],versionName:'1.1.0',versionCode:2,outputFile:'app-debug.apk'}],...patch}; }
test('Gradle is the single source for version, tag and official APK asset name',()=>{
 assert.equal(config.tag,'android-v1.1.0');assert.equal(config.assetName,'NovaesWeb-Entregador-v1.1.0-code2.apk');
 const next=readReleaseConfig(gradle.replace('versionCode 2','versionCode 3').replace('versionName "1.1.0"','versionName "1.2.0"'));
 assert.equal(next.assetName,'NovaesWeb-Entregador-v1.2.0-code3.apk');
});
test('release preparation accepts only the current universal debug APK metadata',()=>{
 assert.equal(validateBuiltMetadata(config,built()),'app-debug.apk');
 for(const patch of [{applicationId:'other.app'},{variantName:'release'},{artifactType:{type:'AAB'}},{elements:[]},{elements:[built().elements[0],built().elements[0]]}]) assert.throws(()=>validateBuiltMetadata(config,built(patch)));
});
test('stale version code, stale version name and split APKs stop preparation',()=>{
 for(const patch of [{versionCode:1},{versionName:'1.0'},{filters:[{filterType:'ABI',value:'arm64-v8a'}]}]) {
  assert.throws(()=>validateBuiltMetadata(config,built({elements:[{...built().elements[0],...patch}]})));
 }
});
test('metadata cannot copy a path outside the built artifact directory',()=>{
 for(const outputFile of ['../private.apk','C:/other.apk','/tmp/other.apk','..\\private.apk','.private.apk','not-an-apk.zip']) {
  assert.throws(()=>validateBuiltMetadata(config,built({elements:[{...built().elements[0],outputFile}]})));
 }
});
test('malformed versions or another app identifier cannot produce official release names',()=>{
 for(const source of [gradle.replace('versionCode 2','versionCode -1'),gradle.replace('1.1.0','../unsafe'),gradle.replace('1.1.0','1.1.0-beta'),gradle.replace('br.com.novaesweb.entregador','other.app')]) assert.throws(()=>readReleaseConfig(source));
});
test('real APK manifest must match even if its adjacent JSON metadata claims the new version',()=>{
 const good="package: name='br.com.novaesweb.entregador' versionCode='2' versionName='1.1.0' platformBuildVersionName='16'";
 assert.doesNotThrow(()=>validateApkBadging(config,good));
 for(const badging of [good.replace("versionCode='2'","versionCode='1'"),good.replace("versionName='1.1.0'","versionName='1.0'"),good.replace('br.com.novaesweb.entregador','other.app'),'']) assert.throws(()=>validateApkBadging(config,badging));
});
