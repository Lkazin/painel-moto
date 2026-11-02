const DEFAULT_ANDROID_API = 'https://entregado001-oe6y.vercel.app/api/v1/logistics';
function androidApiUrl(value = DEFAULT_ANDROID_API) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('O aplicativo Android precisa do backend HTTPS público da loja.');
  }
  url.pathname = '/api/v1/logistics';
  url.search = ''; url.hash = '';
  return url.toString().replace(/\/$/, '');
}
module.exports = { DEFAULT_ANDROID_API, androidApiUrl };
