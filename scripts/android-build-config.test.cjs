const assert = require('node:assert/strict');
const { test } = require('node:test');
const { androidApiUrl, DEFAULT_ANDROID_API } = require('./android-build-config.cjs');
test('Android defaults to real HTTPS backend independently from local Vite development env',()=>{
 assert.equal(androidApiUrl(), DEFAULT_ANDROID_API);
 assert.equal(androidApiUrl('https://store.example/other?token=discard#hash'),'https://store.example/api/v1/logistics');
});
test('Android rejects local HTTP, HTTPS loopback and URL credentials',()=>{
 for (const url of ['http://localhost:3000','http://store.example','https://localhost','https://127.0.0.1','https://[::1]','https://user:secret@store.example']) assert.throws(()=>androidApiUrl(url));
});
