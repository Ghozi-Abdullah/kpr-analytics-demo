var GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
var GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
var SHA256_DIGEST_INFO = '3031300d060960864801650304020105000420';

function AuthFail_(code, email) {
  var e = new Error(code);
  e.code = code;
  if (email) e.email = email;
  return e;
}

function unsignedHex_(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i += 1) hex += ((bytes[i] & 0xff) + 0x100).toString(16).slice(1);
  return hex;
}

function b64urlBytes_(s) {
  var t = String(s);
  while (t.length % 4) t += '=';
  return Utilities.base64DecodeWebSafe(t);
}

function b64urlJson_(s) {
  return JSON.parse(Utilities.newBlob(b64urlBytes_(s)).getDataAsString('UTF-8'));
}

function modPow_(base, exp, mod) {
  var result = BigInt(1);
  var b = base % mod;
  var e = exp;
  var zero = BigInt(0);
  var one = BigInt(1);
  var two = BigInt(2);
  while (e > zero) {
    if (e % two === one) result = (result * b) % mod;
    e = e / two;
    b = (b * b) % mod;
  }
  return result;
}

function rsaVerify_(signingInput, signatureB64, jwk) {
  var nHex = unsignedHex_(b64urlBytes_(jwk.n)).replace(/^(00)+/, '');
  var k = Math.ceil(nHex.length / 2);
  var n = BigInt('0x' + nHex);
  var e = BigInt('0x' + unsignedHex_(b64urlBytes_(jwk.e)));
  var sigHex = unsignedHex_(b64urlBytes_(signatureB64));
  if (sigHex.length / 2 !== k) return false;
  var s = BigInt('0x' + sigHex);
  if (s >= n) return false;
  var em = modPow_(s, e, n).toString(16);
  while (em.length < k * 2) em = '0' + em;
  var hash = unsignedHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, signingInput, Utilities.Charset.UTF_8));
  var padLen = k - 3 - (SHA256_DIGEST_INFO.length + hash.length) / 2;
  if (padLen < 8) return false;
  var expected = '0001' + new Array(padLen + 1).join('ff') + '00' + SHA256_DIGEST_INFO + hash;
  return em === expected;
}

function googleKeys_(forceRefresh) {
  var cache = CacheService.getScriptCache();
  var cached = forceRefresh ? null : cache.get('google_jwks');
  if (cached) return JSON.parse(cached);
  var res = UrlFetchApp.fetch(GOOGLE_CERTS_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Kunci publik Google tidak bisa diambil (' + res.getResponseCode() + ').');
  var keys = JSON.parse(res.getContentText()).keys || [];
  cache.put('google_jwks', JSON.stringify(keys), 21600);
  return keys;
}

function tokenInfo_(token) {
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw AuthFail_('AUTH');
  var c = JSON.parse(res.getContentText());
  c.exp = Number(c.exp);
  c.email_verified = c.email_verified === true || c.email_verified === 'true';
  return c;
}

function verifyIdToken_(token, clientId, now) {
  if (typeof token !== 'string' || token.length > 4096) throw AuthFail_('AUTH');
  var parts = token.split('.');
  if (parts.length !== 3) throw AuthFail_('AUTH');
  var t = now || Math.floor(Date.now() / 1000);
  var claims;
  if (typeof BigInt === 'function') {
    var header;
    try { header = b64urlJson_(parts[0]); claims = b64urlJson_(parts[1]); } catch (e) { throw AuthFail_('AUTH'); }
    if (header.alg !== 'RS256' || !header.kid) throw AuthFail_('AUTH');
    var keys = googleKeys_(false);
    var key = keys.filter(function (k) { return k.kid === header.kid; })[0];
    if (!key) {
      keys = googleKeys_(true);
      key = keys.filter(function (k) { return k.kid === header.kid; })[0];
    }
    if (!key || !rsaVerify_(parts[0] + '.' + parts[1], parts[2], key)) throw AuthFail_('AUTH');
  } else {
    claims = tokenInfo_(token);
  }
  if (GOOGLE_ISSUERS.indexOf(claims.iss) < 0) throw AuthFail_('AUTH');
  if (claims.aud !== clientId) throw AuthFail_('AUTH');
  if (!(Number(claims.exp) > t - 60)) throw AuthFail_('AUTH');
  if (claims.iat && Number(claims.iat) > t + 300) throw AuthFail_('AUTH');
  if (!(claims.email_verified === true || claims.email_verified === 'true') || !claims.email) throw AuthFail_('AUTH');
  return { email: String(claims.email).toLowerCase(), exp: Number(claims.exp) };
}
