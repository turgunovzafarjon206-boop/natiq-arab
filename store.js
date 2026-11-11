/* Maʼlumotlar ombori: saytdagi bilan bir xil Supabase bazasi (records jadvali).
   Bot server kalit (service role) bilan ishlaydi — u faqat Railway muhit oʻzgaruvchisida turadi.
   Sinov uchun xuddi shu interfeysli xotiradagi ombor ham bor (MemoryStore). */
const crypto = require('crypto');

const uid = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const PRIV_ST = ['phone', 'parentPhone', 'address', 'note', 'customMonthly', 'statusNote', 'reasonId'];

class SupabaseStore {
  constructor(url, serviceKey) {
    const { createClient } = require('@supabase/supabase-js');
    // Node 22 dan eski versiyalarda WebSocket yoʻq — «ws» kutubxonasi beriladi (aks holda bot ishga tushmaydi)
    let transport; try { transport = globalThis.WebSocket || require('ws'); } catch (e) { }
    this.url = url; this.key = serviceKey;
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, realtime: transport ? { transport } : undefined });
    this.cache = new Map();
  }
  _ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }
  async list(coll, { fresh = false, ttl = 20000 } = {}) {
    const c = this.cache.get(coll);
    if (!fresh && c && Date.now() - c.at < ttl) return c.rows;
    const out = []; let from = 0;
    for (;;) {
      const data = this._ok(await this.sb.from('records').select('id,data').eq('coll', coll).range(from, from + 999));
      out.push(...data); if (data.length < 1000) break; from += 1000;
    }
    const rows = out.map(r => Object.assign({}, r.data, { id: r.id }));
    this.cache.set(coll, { at: Date.now(), rows });
    return rows;
  }
  async find(coll, field, value) {
    const data = this._ok(await this.sb.from('records').select('id,data').eq('coll', coll).eq('data->>' + field, String(value)));
    return data.map(r => Object.assign({}, r.data, { id: r.id }));
  }
  async get(coll, id) {
    const data = this._ok(await this.sb.from('records').select('id,data').eq('coll', coll).eq('id', String(id)).maybeSingle());
    return data ? Object.assign({}, data.data, { id: data.id }) : null;
  }
  async put(coll, id, data) {
    const d = Object.assign({}, data); delete d.id;
    this._ok(await this.sb.from('records').upsert({ coll, id: String(id), data: d }));
    this.cache.delete(coll);
    return Object.assign({}, d, { id: String(id) });
  }
  async patch(coll, id, patch) {
    const cur = (await this.get(coll, id)) || {};
    return this.put(coll, id, Object.assign(cur, patch));
  }
  async del(coll, id) { this._ok(await this.sb.from('records').delete().eq('coll', coll).eq('id', String(id))); this.cache.delete(coll); }
  /* oʻquvchilar: ochiq qism + yopiq qism (telefon, manzil…) birlashtiriladi */
  async students() {
    const [pub, prv] = await Promise.all([this.list('students'), this.list('student_private')]);
    const pm = new Map(prv.map(p => [p.id, p]));
    return pub.map(s => Object.assign({}, s, pm.get(s.id) || {}, { id: s.id }));
  }
  async profiles() {
    const c = this.cache.get('#profiles');
    if (c && Date.now() - c.at < 20000) return c.rows;
    const rows = this._ok(await this.sb.from('profiles').select('id,name,phone,role'));
    this.cache.set('#profiles', { at: Date.now(), rows });
    return rows;
  }
  async upload(bucket, path, buffer, contentType) {
    this._ok(await this.sb.storage.from(bucket).upload(path, buffer, { contentType, upsert: true }));
    return path;
  }
  async download(bucket, path) {
    const blob = this._ok(await this.sb.storage.from(bucket).download(path));
    return Buffer.from(await blob.arrayBuffer());
  }
  publicUrl(bucket, path) { return this.url.replace(/\/+$/, '') + '/storage/v1/object/public/' + bucket + '/' + path; }
  async signedUrl(bucket, path, sec = 3600) {
    return this._ok(await this.sb.storage.from(bucket).createSignedUrl(path, sec)).signedUrl;
  }
  /* mini ilova: parolsiz kirish uchun bir martalik token (sayt verifyOtp bilan sessiya oladi) */
  /* saytdagi sessiya tokeni → foydalanuvchi ID (Supabase tekshiradi) */
  async userFromToken(token) { if (!token) return null; const { data, error } = await this.sb.auth.getUser(token); return error || !data || !data.user ? null : data.user.id; }
  async loginToken(userId) {
    const u = this._ok(await this.sb.auth.admin.getUserById(userId)).user;
    if (!u || !u.email) throw new Error('foydalanuvchi topilmadi');
    const d = this._ok(await this.sb.auth.admin.generateLink({ type: 'magiclink', email: u.email }));
    return { token_hash: d.properties.hashed_token, email: u.email };
  }
  /* parolni tekshirish (botda raqamni qoʻlda yozganda): toʻgʻri boʻlsa — true */
  async checkPassword(userId, password) {
    const r = await this.sb.auth.admin.getUserById(userId); const u = r.data && r.data.user; if (!u || !u.email) return false;
    const { createClient } = require('@supabase/supabase-js');
    const tmp = createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await tmp.auth.signInWithPassword({ email: u.email, password: String(password || '') });
    return !error && !!(data && data.user && data.user.id === userId);
  }
  /* yangi login (oʻquvchi): sayt bilan bir xil — telefon@natiq.uz va parol */
  async createLogin({ phone, name, role, password, email }) {
    let id;
    const r = await this.sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (r.error) {
      if (!/registered|exists|already/i.test(r.error.message)) throw new Error(r.error.message);
      let page = 1; for (; page < 50 && !id; page++) { const L = this._ok(await this.sb.auth.admin.listUsers({ page, perPage: 1000 })); const f = (L.users || []).find(u => u.email === email); if (f) id = f.id; if (!L.users || L.users.length < 1000) break; }
      if (!id) throw new Error('login topilmadi');
      this._ok(await this.sb.auth.admin.updateUserById(id, { password }));
    } else id = r.data.user.id;
    this._ok(await this.sb.from('profiles').upsert({ id, name, phone, role }));
    this.cache.delete('#profiles'); return id;
  }
  clear() { this.cache.clear(); }
}

class MemoryStore {
  constructor(seed = {}) {
    this.db = {}; this.files = {}; this.profilesList = seed.profiles || []; this.passwords = seed.passwords || {};
    Object.entries(seed).forEach(([c, rows]) => { if (c !== 'profiles' && c !== 'passwords') this.db[c] = new Map(rows.map(r => [String(r.id), JSON.parse(JSON.stringify(r))])); });
  }
  _c(coll) { return this.db[coll] || (this.db[coll] = new Map()); }
  async list(coll) { return [...this._c(coll).values()].map(r => JSON.parse(JSON.stringify(r))); }
  async find(coll, field, value) { return (await this.list(coll)).filter(r => String(r[field]) === String(value)); }
  async get(coll, id) { const r = this._c(coll).get(String(id)); return r ? JSON.parse(JSON.stringify(r)) : null; }
  async put(coll, id, data) { const d = Object.assign({}, JSON.parse(JSON.stringify(data)), { id: String(id) }); this._c(coll).set(String(id), d); return JSON.parse(JSON.stringify(d)); }
  async patch(coll, id, patch) { const cur = (await this.get(coll, id)) || {}; return this.put(coll, id, Object.assign(cur, patch)); }
  async del(coll, id) { this._c(coll).delete(String(id)); }
  async students() {
    const pub = await this.list('students'); const prv = await this.list('student_private');
    const pm = new Map(prv.map(p => [p.id, p]));
    return pub.map(s => Object.assign({}, s, pm.get(s.id) || {}, { id: s.id }));
  }
  async profiles() { return this.profilesList; }
  async upload(bucket, path, buffer) { this.files[bucket + '/' + path] = buffer; return path; }
  async download(bucket, path) { return this.files[bucket + '/' + path]; }
  async signedUrl(bucket, path) { return 'https://example.test/' + bucket + '/' + path; }
  publicUrl(bucket, path) { return 'https://example.test/public/' + bucket + '/' + path; }
  async loginToken(userId) { return { token_hash: 'hash-' + userId, email: 'x@natiq.uz' }; }
  async userFromToken(token) { const m = /^tok-(.+)$/.exec(token || ''); return m ? m[1] : null; }
  async checkPassword(userId, password) { return !!(this.passwords && this.passwords[userId] === password); }
  async createLogin({ phone, name, role }) { const id = 'u_' + Math.random().toString(36).slice(2, 8); this.profilesList.push({ id, name, phone, role }); return id; }
  clear() {}
}

module.exports = { SupabaseStore, MemoryStore, uid, PRIV_ST };
