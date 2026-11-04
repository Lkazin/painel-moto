const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const update = fs.readFileSync('src/components/AppUpdateNotice.tsx', 'utf8');
const service = fs.readFileSync('src/services/appUpdates.ts', 'utf8');
const settings = fs.readFileSync('src/components/DriverSecuritySettings.tsx', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');

test('Never reintroduce the old browser installation button or modal in driver dashboard', () => {
  assert.doesNotMatch(app, /install-pwa-pill|PWAInstallModal|isInstallModalOpen|setIsInstallModalOpen/);
  assert.doesNotMatch(app, /(?:Baixar Aplicativo|Instalar aplicativo no Android ou iPhone)/i);
});
test('Keep official Android version update notice available', () => {
  assert.match(main, /<AppUpdateNotice\s*\/>/);
  assert.match(update, /Nova versão disponível/);
  assert.match(update, /Baixar e atualizar/);
  assert.match(update, /appUpdates\.openDownload/);
  assert.match(service, /currentBuild|selectAndroidRelease/);
  assert.match(service, /build\s*<=\s*currentBuild/);
});
test('Keep optional biometric and protected session flow unchanged', () => {
  assert.match(settings, /configureBiometric\(!state\.enabled\)/);
  assert.match(app, /biometricLocked/);
  assert.match(app, /unlockBiometric/);
});

test('Login never offers the obsolete browser PWA installer', () => {
  const auth = fs.readFileSync('src/components/ScreenAuthDriver.tsx', 'utf8');
  assert.doesNotMatch(auth, /nwl-install-app-btn|PWAInstallModal|showInstallModal|Instalar no celular/);
});
test('Sound options are user-selectable and previewable while keeping authentication protected', () => {
  const audio = fs.readFileSync('src/utils/audioAlert.ts', 'utf8');
  const sound = fs.readFileSync('src/components/OfferSoundSettings.tsx', 'utf8');
  const experience = fs.readFileSync('src/components/ExperienceSettings.tsx', 'utf8');
  const settings = fs.readFileSync('src/components/ModalSessionAndStore.tsx', 'utf8');
  assert.match(audio, /getOfferSound/);
  assert.match(audio, /setOfferSound/);
  assert.match(audio, /testOfferSound/);
  assert.match(sound, /3\. Tecnológico/);
  assert.match(sound, /Testar som/);
  assert.match(experience, /<OfferSoundSettings/);
  assert.match(settings, /<OfferSoundSettings/);
  assert.match(experience, /DriverSecuritySettings/);
});
