const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL || '';
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5
}) : null;
if (!databaseUrl) console.error('DATABASE_URL manquant : le site démarre en mode dégradé, ajoute la base PostgreSQL dans Render.');
if (pool) pool.on('error', (err) => console.error('Erreur inattendue du pool PostgreSQL:', err.message));
app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));
// Mode maintenance activable dans Render avec MAINTENANCE_MODE=true.
// La route de santé reste accessible pour permettre le contrôle du service.
app.use((req, res, next) => {
  const maintenance = String(process.env.MAINTENANCE_MODE || '').toLowerCase() === 'true';
  if (!maintenance || req.path === '/api/health') return next();
  res.status(503).set('Retry-After', '300').sendFile(path.join(__dirname, '404.html'));
});
app.use(express.static(path.join(__dirname), { index: false, setHeaders(res, filePath) { if (filePath.toLowerCase().endsWith('.pdf')) { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Cache-Control', 'public, max-age=300'); } } }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// Alias stables pour le guide : les liens fonctionnent même depuis une route interne.
const guidePath = path.join(__dirname, 'Guide_utilisateur_GS_SIGMA.pdf');
app.get(['/Guide_utilisateur_GS_SIGMA.pdf', '/guide-utilisateur.pdf', '/guide.pdf'], (_req, res) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', 'inline; filename="Guide_utilisateur_GS_SIGMA.pdf"');
  res.set('Cache-Control', 'no-store');
  res.type('application/pdf');
  res.sendFile(guidePath, (err) => {
    if (err && !res.headersSent) res.status(err.statusCode || 404).type('text').send('Guide PDF introuvable. Vérifiez que Guide_utilisateur_GS_SIGMA.pdf est à la racine du projet Render.');
  });
});


// Authentification TOTP (Google Authenticator, Microsoft Authenticator, etc.).
// Les secrets sont conservés côté serveur dans PostgreSQL, jamais dans la base partagée du navigateur.
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0, output = '';
  for (const byte of buffer) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]; return output;
}
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const out = [];
  for (const ch of String(input || '').toUpperCase().replace(/=+$/,'')) { const n = alphabet.indexOf(ch); if (n < 0) throw new Error('Secret TOTP invalide'); value = (value << 5) | n; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totpCode(secret, step = Math.floor(Date.now()/30000)) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length-1] & 15;
  const binary = ((digest[offset]&127)<<24)|((digest[offset+1]&255)<<16)|((digest[offset+2]&255)<<8)|(digest[offset+3]&255);
  return String(binary % 1000000).padStart(6,'0');
}
function verifyTotp(secret, code) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const now = Math.floor(Date.now()/30000);
  for (let drift=-1; drift<=1; drift++) {
    const expected = Buffer.from(totpCode(secret, now+drift)); const supplied = Buffer.from(String(code));
    if (expected.length===supplied.length && crypto.timingSafeEqual(expected,supplied)) return true;
  }
  return false;
}
const totpSetupPending = new Map();
async function validateAccount(login, password) {
  if (!pool) return null;
  const result = await pool.query('SELECT payload FROM sigma_shared_state WHERE id=1');
  const payload = result.rows[0] && result.rows[0].payload;
  const users = payload && Array.isArray(payload.users) ? payload.users : [];
  return users.find(u => String(u.login || '').trim() === String(login || '').trim() && String(u.pass) === String(password || '') && u.active !== false) || null;
}
app.post('/api/totp/status', async (req,res) => {
  try {
    const login=String(req.body && req.body.login || '').trim(), password=String(req.body && req.body.password || '');
    if (!login || !password) return res.status(400).json({error:'Saisis ton identifiant et ton mot de passe.'});
    const user=await validateAccount(login,password);
    if (!user) return res.status(401).json({error:'Identifiant ou mot de passe incorrect, ou compte en attente d’activation.'});
    const saved=await pool.query('SELECT secret FROM sigma_totp_secrets WHERE login=$1',[login]);
    if (saved.rows.length) return res.set('Cache-Control','no-store').json({ok:true,enrolled:true});
    let pending=totpSetupPending.get(login);
    if (!pending || pending.expiresAt < Date.now()) {
      const secret=base32Encode(crypto.randomBytes(20));
      const label=encodeURIComponent('GROUPE SCIENTIFIQUE SIGMA:'+login);
      const issuer=encodeURIComponent('GROUPE SCIENTIFIQUE SIGMA');
      const otpauth=`otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
      pending={secret,expiresAt:Date.now()+15*60*1000,attempts:0}; totpSetupPending.set(login,pending);
      return res.set('Cache-Control','no-store').json({ok:true,enrolled:false,secret,otpauth,expiresInMinutes:15});
    }
    const label=encodeURIComponent('GROUPE SCIENTIFIQUE SIGMA:'+login), issuer=encodeURIComponent('GROUPE SCIENTIFIQUE SIGMA');
    return res.set('Cache-Control','no-store').json({ok:true,enrolled:false,secret:pending.secret,otpauth:`otpauth://totp/${label}?secret=${pending.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,expiresInMinutes:Math.max(1,Math.ceil((pending.expiresAt-Date.now())/60000))});
  } catch(e) { console.error('TOTP status error:',e.message); return res.status(500).json({error:'Service OTP indisponible. Vérifie la connexion à PostgreSQL sur Render.'}); }
});
app.post('/api/totp/optional-verify', async (req,res) => {
  try {
    const login=String(req.body && req.body.login || '').trim();
    const password=String(req.body && req.body.password || '');
    const code=String(req.body && req.body.code || '').trim();
    if (!login || !password) return res.status(400).json({error:'Saisis ton identifiant et ton mot de passe.'});
    const user=await validateAccount(login,password);
    if (!user) return res.status(401).json({error:'Identifiant ou mot de passe incorrect, ou compte en attente d’activation.'});
    // OTP facultatif : sans code, l’identifiant et le mot de passe suffisent.
    if (!code) return res.set('Cache-Control','no-store').json({ok:true,verified:false,skipped:true});
    if (!/^\d{6}$/.test(code)) return res.status(400).json({error:'Le code OTP doit contenir exactement 6 chiffres.'});
    const saved=await pool.query('SELECT secret FROM sigma_totp_secrets WHERE login=$1',[login]);
    if (!saved.rows.length) return res.status(400).json({error:'Aucun OTP n’est configuré pour ce compte. Laisse le champ vide pour te connecter avec ton mot de passe.'});
    if (!verifyTotp(saved.rows[0].secret,code)) return res.status(400).json({error:'Code OTP incorrect ou expiré. Laisse le champ vide si tu souhaites te connecter sans OTP.'});
    return res.set('Cache-Control','no-store').json({ok:true,verified:true});
  } catch(e) { console.error('Optional OTP verification error:',e.message); return res.status(500).json({error:'Vérification OTP indisponible. Réessaie.'}); }
});

app.post('/api/totp/verify', async (req,res) => {
  try {
    const login=String(req.body && req.body.login || '').trim(), password=String(req.body && req.body.password || ''), code=String(req.body && req.body.code || '').trim();
    if (!login || !password || !/^\d{6}$/.test(code)) return res.status(400).json({error:'Saisis le code OTP à 6 chiffres.'});
    const user=await validateAccount(login,password);
    if (!user) return res.status(401).json({error:'Identifiants incorrects. Recommence la connexion.'});
    const saved=await pool.query('SELECT secret FROM sigma_totp_secrets WHERE login=$1',[login]);
    if (saved.rows.length) {
      if (!verifyTotp(saved.rows[0].secret,code)) return res.status(400).json({error:'Code OTP incorrect ou expiré. Vérifie l’application et réessaie.'});
    } else {
      const pending=totpSetupPending.get(login);
      if (!pending || pending.expiresAt<Date.now()) { totpSetupPending.delete(login); return res.status(400).json({error:'La configuration OTP a expiré. Recommence pour obtenir un nouveau secret.'}); }
      pending.attempts++;
      if (pending.attempts>8) { totpSetupPending.delete(login); return res.status(429).json({error:'Trop de tentatives. Recommence la configuration OTP.'}); }
      if (!verifyTotp(pending.secret,code)) return res.status(400).json({error:'Code OTP incorrect. Vérifie que le compte est bien ajouté dans ton application d’authentification.'});
      await pool.query('INSERT INTO sigma_totp_secrets(login,secret,created_at) VALUES($1,$2,NOW()) ON CONFLICT(login) DO NOTHING',[login,pending.secret]);
      totpSetupPending.delete(login);
    }
    res.set('Cache-Control','no-store').json({ok:true,verified:true});
  } catch(e) { console.error('TOTP verify error:',e.message); return res.status(500).json({error:'Vérification OTP impossible. Réessaie après vérification du serveur.'}); }
});
app.post('/api/totp/reset', async (req,res) => {
  // Reset de sécurité non exposé aux utilisateurs : exige le secret d’administration défini dans Render.
  const token=String(req.headers['x-sigma-admin-reset'] || '');
  if (!process.env.SIGMA_OTP_RESET_KEY || token !== process.env.SIGMA_OTP_RESET_KEY) return res.status(403).json({error:'Action non autorisée.'});
  const login=String(req.body && req.body.login || '').trim(); if (!login) return res.status(400).json({error:'Identifiant manquant.'});
  try { await pool.query('DELETE FROM sigma_totp_secrets WHERE login=$1',[login]); totpSetupPending.delete(login); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:'Réinitialisation OTP impossible.'}); }
});

async function init() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sigma_totp_secrets (
      login TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sigma_shared_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
app.get('/api/health', async (_req, res) => {
  if (!pool) return res.status(503).set('Cache-Control', 'no-store').json({ ok: false, service: 'GS SIGMA', database: 'unconfigured', message: 'DATABASE_URL est absente dans les variables d’environnement Render.' });
  try {
    await pool.query('SELECT 1');
    res.set('Cache-Control', 'no-store').json({ ok: true, service: 'GS SIGMA', database: 'connected' });
  } catch (e) {
    console.error('Contrôle PostgreSQL échoué:', e.message);
    res.status(503).json({ ok: false, service: 'GS SIGMA', database: 'unavailable', message: 'Connexion PostgreSQL indisponible. Vérifiez DATABASE_URL et le statut de la base Render.' });
  }
});
app.get('/api/shared-db', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Base PostgreSQL non configurée : ajoute DATABASE_URL dans Render.' });
  try {
    const result = await pool.query('SELECT payload, updated_at FROM sigma_shared_state WHERE id=1');
    res.set('Cache-Control', 'no-store');
    res.json(result.rows.length ? result.rows[0].payload : null);
  } catch (e) { console.error('Lecture /api/shared-db échouée:', e.message); res.status(500).json({ error: 'Lecture PostgreSQL impossible. Vérifiez la base Render et DATABASE_URL.' }); }
});
app.put('/api/shared-db', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Base PostgreSQL non configurée : ajoute DATABASE_URL dans Render.' });
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Format de base invalide.' });
    }
    const raw = JSON.stringify(req.body);
    if (Buffer.byteLength(raw, 'utf8') > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'La base dépasse la taille autorisée (15 Mo).' });
    }
    await pool.query(
      `INSERT INTO sigma_shared_state(id,payload,updated_at) VALUES(1,$1::jsonb,NOW())
       ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()`,
      [raw]
    );
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) { console.error('Écriture /api/shared-db échouée:', e.message); res.status(500).json({ error: 'Enregistrement PostgreSQL impossible. Vérifiez la base Render et DATABASE_URL.' }); }
});
app.get('/404', (_req, res) => res.status(404).sendFile(path.join(__dirname, '404.html')));
app.get('*', (_req, res) => res.status(404).sendFile(path.join(__dirname, '404.html'), (err) => {
  if (err && !res.headersSent) res.status(404).type('text').send('Page introuvable (404).');
}));
init().catch(e => { console.error('Initialisation PostgreSQL impossible :', e.message); }).finally(() => {
  app.listen(port, () => console.log(`GS SIGMA prêt sur le port ${port}`));
});
