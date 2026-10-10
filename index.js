/* Shining Road — Cloud Functions gửi thông báo đẩy.
   Sửa APP_URL thành link GitHub Pages của bạn trước khi deploy. */
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const S = require('./schedule');
admin.initializeApp();
const db = admin.firestore();

const APP_URL = 'https://TEN-GITHUB.github.io/shining-road/';
const REGION = 'asia-southeast1';
const TZ = 'Asia/Ho_Chi_Minh';

/* ---------- tiện ích ---------- */
const nowVN = () => new Date(new Date().toLocaleString('en-US', {timeZone: TZ}));
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const mondayOf = d => addD(d, -((d.getDay()+6)%7));
const nameOf = (h, uid) => (h.info && h.info[uid] && h.info[uid].name) || 'Ai đó';

async function send(uids, title, body) {
  uids = [...new Set(uids.filter(Boolean))];
  for (const uid of uids) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const tokens = (snap.exists && snap.data().tokens) || [];
    if (!tokens.length) continue;
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {title, body},
      webpush: {notification: {icon: APP_URL + 'icon-192.png'}, fcmOptions: {link: APP_URL}}
    });
    const dead = [];
    res.responses.forEach((r, i) => {
      const c = r.error && r.error.code;
      if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') dead.push(tokens[i]);
    });
    if (dead.length) await ref.update({tokens: admin.firestore.FieldValue.arrayRemove(...dead)});
  }
}

/* Danh sách quest của từng người trong một ngày, có tính lời nhờ đã nhận và task thêm riêng. */
function questsOn(h, key) {
  const N = h.members.length, slots = S.genDay(key, N), out = {};
  h.members.forEach(u => out[u] = []);
  slots.forEach((list, i) => list.forEach(q => {
    const st = (h.q || {})[q.id] || {};
    out[st.assignee || h.members[i]].push({...q, st: st.st});
  }));
  Object.values(h.custom || {}).filter(c => c.date === key && out[c.uid]).forEach(c => {
    const st = (h.q || {})[c.id] || {};
    out[st.assignee || c.uid].push({t: c.t, st: st.st});
  });
  return out;
}

/* ---------- thông báo theo sự kiện ---------- */
exports.onHomeChange = onDocumentUpdated({document: 'homes/{hid}', region: REGION}, async ev => {
  const b = ev.data.before.data() || {}, a = ev.data.after.data() || {};
  const bq = b.q || {}, aq = a.q || {}, jobs = [];
  for (const [id, s] of Object.entries(aq)) {
    const p = bq[id] || {};
    if (s.st === 'sos' && p.st !== 'sos' && s.sosTo)
      jobs.push(send([s.sosTo], 'Có lời nhờ cho bạn', `${nameOf(a, s.reqBy)} nhờ bạn làm "${s.t || 'một việc'}"`));
    if (p.st === 'sos' && s.st !== 'sos' && s.assignee && s.assignee === p.sosTo && s.reqBy)
      jobs.push(send([s.reqBy], 'Đã có người giúp', `${nameOf(a, s.assignee)} đã nhận "${s.t || 'việc của bạn'}"`));
    if (s.st === 'claimed' && p.st !== 'claimed' && (id.startsWith('wk-') || id.startsWith('mo-')))
      jobs.push(send(a.members.filter(u => u !== s.by), 'Boss đã gục!', `${nameOf(a, s.by)} vừa hạ ${s.t || 'boss'}`));
  }
  for (const [id, s] of Object.entries(aq)) {
    const p = bq[id] || {};
    if (s.pen && !p.pen && /^\d{4}-/.test(id) && s.penUid)
      jobs.push(send(a.members.filter(u => u !== s.penUid), 'Có Bounty mới', `${nameOf(a, s.penUid)} bỏ lỡ "${s.t || 'một việc'}". Làm thay để nhận thêm ${s.pen} vàng`));
  }
  const bc = b.custom || {}, ac = a.custom || {};
  for (const [id, c] of Object.entries(ac)) {
    if (bc[id] || !c.uid || c.uid === c.by) continue;
    const [y, m, d] = c.date.split('-');
    jobs.push(send([c.uid], 'Bạn được giao task mới', `${nameOf(a, c.by)} giao "${c.t}" cho ngày ${+d}/${+m}`));
  }
  await Promise.all(jobs);
});

/* ---------- thông báo theo lịch ---------- */
async function eachHome(fn) {
  const homes = await db.collection('homes').get();
  for (const doc of homes.docs) { try { await fn(doc.data()); } catch (e) { console.error(doc.id, e); } }
}

exports.morning = onSchedule({schedule: '30 7 * * *', timeZone: TZ, region: REGION}, () => eachHome(async h => {
  const per = questsOn(h, keyOf(nowVN()));
  for (const [uid, list] of Object.entries(per)) {
    const left = list.filter(q => q.st !== 'claimed').length;
    if (left) await send([uid], 'Chào buổi sáng!', `Hôm nay bạn có ${left} quest trên Shining Road`);
  }
}));

exports.evening = onSchedule({schedule: '0 20 * * *', timeZone: TZ, region: REGION}, () => eachHome(async h => {
  const key = keyOf(addD(nowVN(), 1)), m = (h.menu || {})[key];
  if (m && m.main) return;
  const per = questsOn(h, key);
  const cook = Object.entries(per).find(([, list]) => list.some(q => q.cook));
  if (cook) await send([cook[0]], 'Mai bạn nấu', 'Ghé trại nấu chốt món cho ngày mai nhé');
}));

exports.bossReminder = onSchedule({schedule: '0 19 * * *', timeZone: TZ, region: REGION}, () => eachHome(async h => {
  const now = nowVN(), N = h.members.length, q = h.q || {};
  if (now.getDay() === 6) {
    const mk = keyOf(mondayOf(now)), id = 'wk-' + mk, st = q[id] || {};
    if (st.st !== 'claimed') await send([st.assignee || h.members[S.weekOwner(mk, N)]], 'Quái Rêu còn sống!', 'Boss tuần hết hạn vào Chủ nhật');
  }
  const eom = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  if (eom - now.getDate() === 3) {
    const id = `mo-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`, st = q[id] || {};
    if (st.st !== 'claimed') await send([st.assignee || h.members[S.monthOwner(now.getFullYear(), now.getMonth(), N)]], 'Rồng Chăn sắp trốn mất', 'Còn 3 ngày để hạ boss tháng');
  }
}));
