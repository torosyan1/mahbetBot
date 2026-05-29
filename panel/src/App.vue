<script setup>
import { ref, computed } from 'vue'

/* ── Auth ─────────────────────────────────────────────────── */
const panelToken   = ref(sessionStorage.getItem('panelToken') || null)
const isLoggedIn   = computed(() => !!panelToken.value)
const loginUser    = ref('')
const loginPass    = ref('')
const loginError   = ref('')
const loginLoading = ref(false)

async function doLogin() {
  if (!loginUser.value.trim() || !loginPass.value) return
  loginLoading.value = true
  loginError.value   = ''
  try {
    const r = await fetch('/panel-login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: loginUser.value.trim(), password: loginPass.value })
    })
    if (r.ok) {
      const d = await r.json()
      panelToken.value = d.token
      sessionStorage.setItem('panelToken', d.token)
    } else {
      loginError.value = 'Incorrect username or password.'
    }
  } catch {
    loginError.value = 'Could not reach the server.'
  } finally {
    loginLoading.value = false
  }
}

function doLogout() {
  sessionStorage.removeItem('panelToken')
  panelToken.value = null
  loginUser.value  = ''
  loginPass.value  = ''
}

/* ── Toast ────────────────────────────────────────────────── */
const toastShow = ref(false)
const toastType = ref('ok')
const toastMsg  = ref('')
let   toastTimer = null

function showToast(msg, type = 'ok') {
  toastMsg.value  = msg
  toastType.value = type
  toastShow.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastShow.value = false }, 4000)
}

/* ── Clock ────────────────────────────────────────────────── */
const fmt = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const tgTime = ref(fmt())
setInterval(() => { tgTime.value = fmt() }, 30000)

/* ── Media ────────────────────────────────────────────────── */
const fileInput     = ref(null)
const previewSrc    = ref(null)
const previewType   = ref(null)       // 'image' | 'video'
const uploadedUrl   = ref(null)
const uploadedType  = ref(null)       // 'photo' | 'video'
const isDragging    = ref(false)
const uploadVisible = ref(false)
const uploadPct     = ref(0)
const uploadText    = ref('Uploading…')
const uploadIcon    = ref('⏳')

function onDrop(e) {
  isDragging.value = false
  const f = e.dataTransfer.files[0]
  if (f) handleFile(f)
}

function onFileChange(e) {
  const f = e.target.files[0]
  if (f) handleFile(f)
}

function handleFile(file) {
  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')
  if (!isVideo && !isImage)          { showToast('Only images or videos are allowed.', 'err'); return }
  if (file.size > 50 * 1024 * 1024) { showToast('File exceeds 50 MB limit.',           'err'); return }

  previewType.value = isImage ? 'image' : 'video'
  const reader = new FileReader()
  reader.onload = ev => { previewSrc.value = ev.target.result }
  reader.readAsDataURL(file)
  uploadFile(file, isImage ? 'photo' : 'video')
}

function removeMedia() {
  uploadedUrl.value   = null
  uploadedType.value  = null
  previewSrc.value    = null
  previewType.value   = null
  uploadVisible.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function uploadFile(file, type) {
  uploadVisible.value = true
  uploadPct.value     = 0
  uploadText.value    = 'Uploading…'
  uploadIcon.value    = '⏳'

  const fd = new FormData()
  fd.append('file', file)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/upload', true)
  xhr.setRequestHeader('x-panel-token', panelToken.value)

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) uploadPct.value = Math.round(e.loaded / e.total * 100)
  }
  xhr.onload = () => {
    if (xhr.status === 200) {
      const d = JSON.parse(xhr.responseText)
      uploadedUrl.value  = d.url
      uploadedType.value = type
      uploadPct.value    = 100
      uploadText.value   = 'Upload successful ✓'
      uploadIcon.value   = '✅'
      showToast('File uploaded successfully!')
    } else {
      uploadText.value = 'Upload failed'
      uploadIcon.value = '❌'
      showToast('Upload failed — please try again.', 'err')
    }
  }
  xhr.onerror = () => {
    uploadText.value = 'Connection error'
    uploadIcon.value = '❌'
    showToast('Could not reach the server.', 'err')
  }
  xhr.send(fd)
}

/* ── Caption ──────────────────────────────────────────────── */
const caption = ref('')

/* ── Inline Buttons ───────────────────────────────────────── */
let _id = 0
const mk = (text = '', url = '', urlType = 'url') => ({ id: ++_id, text, url, urlType })

const buttons = ref([
  mk('ارتباط با پشتیبانی آنلاین ماه بت', 'https://direct.lc.chat/14697702',                                                         'url'),
  mk('کانال تلگرامی ماه بت',              'https://t.me/Mahbet_official',                                                            'url'),
  mk('دانلود اپلیکیشن ماه بت',            'https://files.igmobile.io/storage/v1/object/public/Shared/MahBv1.0.2.apk',                'url'),
  mk('ورود به سایت 📌',                    'https://www.mahbet.com',                                                                  'web_app'),
])

function addButton()      { buttons.value.push(mk()) }
function removeButton(id) { buttons.value = buttons.value.filter(b => b.id !== id) }
const previewButtons = computed(() => buttons.value.filter(b => b.text.trim()))

/* ── Broadcast / SSE ──────────────────────────────────────── */
const sending        = ref(false)
const showProgress   = ref(false)
const progTitle      = ref('Sending in progress…')
const progBadgeClass = ref('running')
const progBadgeText  = ref('In Progress')
const progSent       = ref(0)
const progFailed     = ref(0)
const progTotal      = ref(0)
const progPct        = computed(() =>
  progTotal.value > 0 ? Math.round(progSent.value / progTotal.value * 100) : 0
)

async function sendBroadcast() {
  const cap = caption.value.trim()
  if (!uploadedUrl.value) { showToast('Please upload an image or video first.', 'err'); return }
  if (!cap)               { showToast('Please enter a caption.',                'err'); return }

  const btns = buttons.value
    .filter(b => b.text.trim() && b.url.trim())
    .map(b => ({ text: b.text.trim(), url: b.url.trim(), type: b.urlType }))

  sending.value        = true
  showProgress.value   = true
  progBadgeClass.value = 'running'
  progBadgeText.value  = 'In Progress'
  progTitle.value      = 'Sending in progress…'
  progSent.value       = 0
  progFailed.value     = 0
  progTotal.value      = 0

  try {
    const payload = { caption: cap, buttons: btns }
    payload[uploadedType.value] = uploadedUrl.value

    const r = await fetch('/trigger', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-panel-token': panelToken.value },
      body:    JSON.stringify(payload)
    })
    if (!r.ok) throw new Error((await r.text()) || 'Failed to start broadcast')

    const { jobId, total } = await r.json()
    progTotal.value = total

    const evtSrc = new EventSource(`/trigger-stream/${jobId}?token=${panelToken.value}`)
    evtSrc.onmessage = e => {
      const d = JSON.parse(e.data)
      progSent.value   = d.sent
      progFailed.value = d.failed
      progTotal.value  = d.total
      if (d.done) {
        evtSrc.close()
        progBadgeClass.value = 'done'
        progBadgeText.value  = 'Complete'
        progTitle.value      = `Done — ${d.sent.toLocaleString()} sent, ${d.failed.toLocaleString()} failed`
        sending.value        = false
        showToast(`Broadcast complete! ✅  Sent: ${d.sent.toLocaleString()}`)
      }
    }
    evtSrc.onerror = () => {
      evtSrc.close()
      progBadgeClass.value = 'error'
      progBadgeText.value  = 'Stream Error'
      sending.value        = false
    }

    sending.value = false
  } catch (err) {
    progBadgeClass.value = 'error'
    progBadgeText.value  = 'Error'
    progTitle.value      = err.message
    sending.value        = false
    showToast(err.message, 'err')
  }
}
</script>

<template>
  <!-- ══ LOGIN SCREEN ══════════════════════════════════════════ -->
  <div id="loginScreen" :class="{ hide: isLoggedIn }">
    <div class="login-box">
      <div class="login-logo">
        <div class="icon">🌙</div>
        <h2>MahBet Admin</h2>
        <p>Sign in to access the broadcast panel</p>
      </div>

      <div class="login-field">
        <label>Username</label>
        <input type="text" v-model="loginUser" placeholder="Enter username"
               autocomplete="username" @keydown.enter="doLogin" />
      </div>

      <div class="login-field">
        <label>Password</label>
        <input type="password" v-model="loginPass" placeholder="Enter password"
               autocomplete="current-password" @keydown.enter="doLogin" />
      </div>

      <div class="login-error" v-if="loginError">{{ loginError }}</div>

      <button class="login-btn" :disabled="loginLoading" @click="doLogin">
        <span v-if="loginLoading" class="spin"></span>
        <span>{{ loginLoading ? 'Signing in…' : 'Sign In' }}</span>
      </button>
    </div>
  </div>

  <!-- ══ MAIN APP ═══════════════════════════════════════════════ -->
  <div id="mainApp" v-if="isLoggedIn">

    <header>
      <div class="h-logo">🌙</div>
      <div>
        <h1>MahBet — Broadcast Panel</h1>
        <p>Send messages to all active Telegram users</p>
      </div>
      <div class="h-right">
        <span class="online-dot">● Online</span>
        <button class="logout-btn" @click="doLogout">Sign Out</button>
      </div>
    </header>

    <div class="layout">

      <!-- ── LEFT ───────────────────────────────────────────── -->
      <div>

        <!-- Media Upload -->
        <div class="card">
          <div class="card-title">Media Upload</div>
          <div class="drop-zone" :class="{ over: isDragging }"
               @dragenter.prevent="isDragging = true"
               @dragover.prevent="isDragging = true"
               @dragleave.prevent="isDragging = false"
               @drop.prevent="onDrop">
            <input type="file" accept="image/*,video/*" ref="fileInput" @change="onFileChange" />
            <div class="dz-icon">📂</div>
            <h3>Drop file here or click to browse</h3>
            <p>Max 50 MB — image or video</p>
            <div class="tags">
              <span class="tag">JPG</span><span class="tag">PNG</span>
              <span class="tag">MP4</span><span class="tag">MOV</span>
              <span class="tag">GIF</span><span class="tag">WEBP</span>
            </div>
          </div>

          <div class="media-preview-wrap" v-if="previewSrc">
            <img v-if="previewType === 'image'" :src="previewSrc" alt="preview" />
            <video v-else :src="previewSrc" controls muted></video>
            <button class="rm-btn" @click="removeMedia" title="Remove">✕</button>
          </div>

          <div class="upload-status" v-if="uploadVisible">
            <div class="up-row">
              <span>{{ uploadIcon }}</span>
              <span style="font-size:.82rem">{{ uploadText }}</span>
              <span class="up-pct">{{ uploadPct }}%</span>
            </div>
            <div class="pb-wrap">
              <div class="pb-fill" :style="{ width: uploadPct + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Caption -->
        <div class="card">
          <div class="card-title">Message Caption</div>
          <span class="flabel">Caption Text</span>
          <textarea v-model="caption" placeholder="Type your message here…"></textarea>
          <div class="cc">{{ caption.length }} characters</div>
        </div>

        <!-- Inline Buttons -->
        <div class="card">
          <div class="card-title">Inline Buttons</div>
          <div class="buttons-list">
            <div class="btn-row" v-for="btn in buttons" :key="btn.id">
              <input type="text" placeholder="Button label" v-model="btn.text" />
              <select v-model="btn.urlType">
                <option value="url">URL</option>
                <option value="web_app">WebApp</option>
              </select>
              <input type="url" placeholder="https://…" v-model="btn.url" dir="ltr" />
              <button class="del-row" @click="removeButton(btn.id)" title="Remove">✕</button>
            </div>
          </div>
          <button class="add-btn" @click="addButton">＋ Add Button</button>
        </div>

        <!-- Send -->
        <button class="send-btn" :disabled="sending" @click="sendBroadcast">
          <span v-if="sending" class="spin"></span>
          <span>{{ sending ? 'Sending…' : '🚀 Send to All Users' }}</span>
        </button>

        <!-- Progress Panel -->
        <div class="progress-panel" v-if="showProgress">
          <div class="prog-header">
            <span class="prog-title">{{ progTitle }}</span>
            <span class="prog-badge" :class="progBadgeClass">{{ progBadgeText }}</span>
          </div>
          <div class="prog-numbers">
            <div class="pn s">
              <div class="pn-val">{{ progSent.toLocaleString() }}</div>
              <div class="pn-lbl">Sent</div>
            </div>
            <div class="pn f">
              <div class="pn-val">{{ progFailed.toLocaleString() }}</div>
              <div class="pn-lbl">Failed</div>
            </div>
            <div class="pn t">
              <div class="pn-val">{{ progTotal.toLocaleString() }}</div>
              <div class="pn-lbl">Total</div>
            </div>
          </div>
          <div class="big-pb-wrap">
            <div class="big-pb-fill" :style="{ width: progPct + '%' }"></div>
          </div>
          <div class="prog-pct">{{ progPct }}%</div>
        </div>

      </div><!-- /left -->

      <!-- ── RIGHT — Live Preview ────────────────────────────── -->
      <div>
        <div class="card" style="position:sticky;top:24px">
          <div class="card-title">Live Preview</div>

          <div class="preview-phone">
            <div class="ph-bar">
              <div class="ph-av">🌙</div>
              <div>
                <div class="ph-name">MahBet</div>
                <div class="ph-sub">online</div>
              </div>
            </div>
            <div class="tg-chat">
              <div class="tg-bubble">
                <img   v-if="previewSrc && previewType === 'image'" :src="previewSrc" alt="" />
                <video v-if="previewSrc && previewType === 'video'" :src="previewSrc" muted loop></video>
                <div class="tb-body">
                  <div class="tg-caption">{{ caption.trim() || 'Your message will appear here…' }}</div>
                  <div class="tb-time">{{ tgTime }}</div>
                </div>
                <div class="tg-btns">
                  <div class="tg-btn" v-for="btn in previewButtons" :key="btn.id">{{ btn.text }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="hint-box">
            📌 Approximate preview only.<br>
            🖼️ Image / video shown above the caption.<br>
            🔘 Inline buttons appear below the bubble.<br>
            💬 Caption supports Unicode &amp; emoji.
          </div>
        </div>
      </div><!-- /right -->

    </div><!-- /layout -->
  </div><!-- /mainApp -->

  <!-- Toast -->
  <div id="toast" :class="[toastShow ? 'show' : '', toastType]">
    <span class="ti">{{ toastType === 'ok' ? '✅' : '❌' }}</span>
    <span class="tm">{{ toastMsg }}</span>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:      #0f1117;
  --surface: #1a1d27;
  --card:    #21253a;
  --border:  #2e3352;
  --accent:  #5c6ef8;
  --accent2: #7c3aed;
  --green:   #22c55e;
  --red:     #ef4444;
  --yellow:  #f59e0b;
  --text:    #e2e8f0;
  --muted:   #6b7280;
  --radius:  14px;
  --shadow:  0 8px 32px rgba(0,0,0,.5);
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ════════ LOGIN ════════════════════════════════════════════ */
#loginScreen {
  position: fixed; inset: 0; z-index: 100;
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  transition: opacity .4s ease;
}
#loginScreen.hide { opacity: 0; pointer-events: none; }

.login-box {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 20px; padding: 40px 36px; width: 100%; max-width: 380px;
  box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 20px;
}
.login-logo { text-align: center; margin-bottom: 4px; }
.login-logo .icon {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border-radius: 16px; display: inline-grid; place-items: center;
  font-size: 26px; margin-bottom: 12px;
}
.login-logo h2 { font-size: 1.25rem; font-weight: 700; }
.login-logo p  { font-size: .8rem; color: var(--muted); margin-top: 4px; }

.login-field { display: flex; flex-direction: column; gap: 7px; }
.login-field label {
  font-size: .75rem; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: .7px;
}
.login-field input {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); padding: 12px 14px; font-size: .92rem; font-family: inherit;
  outline: none; transition: border-color .2s, box-shadow .2s; width: 100%;
}
.login-field input:focus {
  border-color: var(--accent); box-shadow: 0 0 0 3px rgba(92,110,248,.15);
}
.login-error {
  font-size: .8rem; color: var(--red); background: rgba(239,68,68,.08);
  border: 1px solid rgba(239,68,68,.2); border-radius: 8px; padding: 8px 12px;
}
.login-btn {
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border: none; border-radius: 12px; color: #fff;
  font-size: .95rem; font-weight: 700; cursor: pointer;
  transition: opacity .2s, transform .15s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 4px 20px rgba(92,110,248,.35);
}
.login-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
.login-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ════════ MAIN APP ═════════════════════════════════════════ */
#mainApp { display: flex; flex-direction: column; flex: 1; }

header {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 16px 32px; display: flex; align-items: center; gap: 14px;
  box-shadow: var(--shadow);
}
.h-logo {
  width: 40px; height: 40px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border-radius: 12px; display: grid; place-items: center; font-size: 18px;
}
header h1 { font-size: 1.1rem; font-weight: 700; }
header p  { font-size: .76rem; color: var(--muted); margin-top: 2px; }
.h-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.online-dot {
  background: rgba(34,197,94,.15); color: var(--green);
  border: 1px solid rgba(34,197,94,.3); border-radius: 20px;
  padding: 3px 12px; font-size: .74rem; font-weight: 600;
}
.logout-btn {
  background: rgba(239,68,68,.1); color: var(--red);
  border: 1px solid rgba(239,68,68,.2); border-radius: 8px;
  padding: 5px 14px; font-size: .78rem; font-weight: 600;
  cursor: pointer; transition: background .2s;
}
.logout-btn:hover { background: rgba(239,68,68,.22); }

.layout {
  display: grid; grid-template-columns: 1fr 370px; gap: 24px;
  max-width: 1160px; margin: 28px auto; padding: 0 24px; width: 100%;
}
@media (max-width: 880px) { .layout { grid-template-columns: 1fr; } }

.card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 22px; box-shadow: var(--shadow);
}
.card + .card { margin-top: 18px; }
.card-title {
  font-size: .72rem; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 18px;
  display: flex; align-items: center; gap: 8px;
}
.card-title::before {
  content: ''; display: block; width: 3px; height: 15px;
  background: linear-gradient(to bottom, var(--accent), var(--accent2)); border-radius: 4px;
}

/* Drop zone */
.drop-zone {
  border: 2px dashed var(--border); border-radius: var(--radius);
  padding: 36px 18px; text-align: center; cursor: pointer;
  transition: border-color .2s, background .2s; position: relative;
}
.drop-zone:hover, .drop-zone.over {
  border-color: var(--accent); background: rgba(92,110,248,.05);
}
.drop-zone input[type="file"] {
  position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
}
.dz-icon { font-size: 2rem; margin-bottom: 8px; }
.drop-zone h3 { font-size: .9rem; font-weight: 600; margin-bottom: 4px; }
.drop-zone p  { font-size: .78rem; color: var(--muted); }
.tags { display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; margin-top: 10px; }
.tag {
  background: rgba(92,110,248,.1); color: var(--accent);
  border: 1px solid rgba(92,110,248,.22); border-radius: 5px;
  padding: 2px 8px; font-size: .68rem; font-weight: 700; letter-spacing: .4px;
}

/* Media preview */
.media-preview-wrap {
  margin-top: 14px; border-radius: var(--radius); overflow: hidden; position: relative;
}
.media-preview-wrap img, .media-preview-wrap video {
  width: 100%; max-height: 210px; object-fit: cover;
  border-radius: var(--radius); display: block;
}
.rm-btn {
  position: absolute; top: 8px; right: 8px;
  background: rgba(0,0,0,.65); border: none; color: #fff;
  border-radius: 50%; width: 26px; height: 26px; cursor: pointer;
  display: grid; place-items: center; font-size: .8rem; transition: background .2s;
}
.rm-btn:hover { background: var(--red); }

/* Upload status */
.upload-status {
  margin-top: 12px; background: rgba(92,110,248,.07);
  border: 1px solid rgba(92,110,248,.18); border-radius: 10px; padding: 11px 14px;
}
.up-row { display: flex; align-items: center; gap: 9px; }
.up-pct { margin-left: auto; font-size: .75rem; color: var(--accent); font-weight: 700; }
.pb-wrap { background: var(--border); border-radius: 99px; height: 4px; margin-top: 7px; overflow: hidden; }
.pb-fill  { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; transition: width .3s; }

/* Form */
.flabel {
  display: block; font-size: .72rem; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: .6px; margin: 16px 0 7px;
}
textarea, input[type="text"], input[type="url"] {
  width: 100%; background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text); padding: 11px 13px;
  font-size: .88rem; font-family: inherit; resize: vertical;
  transition: border-color .2s, box-shadow .2s; outline: none;
}
textarea:focus, input[type="text"]:focus, input[type="url"]:focus {
  border-color: var(--accent); box-shadow: 0 0 0 3px rgba(92,110,248,.13);
}
textarea { min-height: 128px; }
.cc { font-size: .7rem; color: var(--muted); text-align: right; margin-top: 4px; }

/* Buttons builder */
.buttons-list { display: flex; flex-direction: column; gap: 9px; }
.btn-row {
  display: grid; grid-template-columns: 1fr 88px 1fr 30px;
  gap: 7px; align-items: center;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 9px 11px; animation: slideIn .18s ease;
}
@keyframes slideIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
.btn-row input { margin: 0; background: var(--card); font-size: .8rem; padding: 8px 10px; }
.btn-row select {
  background: var(--card); border: 1px solid var(--border); border-radius: 7px;
  color: var(--text); padding: 8px 5px; font-size: .76rem; outline: none; cursor: pointer; width: 100%;
}
.del-row {
  background: rgba(239,68,68,.09); border: 1px solid rgba(239,68,68,.18); color: var(--red);
  border-radius: 7px; width: 30px; height: 30px; cursor: pointer;
  display: grid; place-items: center; font-size: .78rem; transition: background .18s;
}
.del-row:hover { background: rgba(239,68,68,.22); }
.add-btn {
  width: 100%; margin-top: 9px; padding: 9px;
  background: rgba(92,110,248,.06); border: 1px dashed rgba(92,110,248,.32);
  border-radius: 9px; color: var(--accent); font-size: .82rem; font-weight: 600;
  cursor: pointer; transition: background .2s, border-color .2s;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.add-btn:hover { background: rgba(92,110,248,.13); border-color: var(--accent); }

/* Send button */
.send-btn {
  width: 100%; margin-top: 24px; padding: 15px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border: none; border-radius: var(--radius); color: #fff;
  font-size: .97rem; font-weight: 700; cursor: pointer; letter-spacing: .4px;
  transition: opacity .2s, transform .15s;
  display: flex; align-items: center; justify-content: center; gap: 9px;
  box-shadow: 0 4px 22px rgba(92,110,248,.35);
}
.send-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
.send-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.spin {
  width: 17px; height: 17px;
  border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
  border-radius: 50%; animation: rot .7s linear infinite;
}
@keyframes rot { to { transform: rotate(360deg); } }

/* Progress panel */
.progress-panel {
  margin-top: 16px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px 22px;
}
.prog-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.prog-title { font-size: .82rem; font-weight: 700; }
.prog-badge {
  font-size: .72rem; font-weight: 700; border-radius: 20px; padding: 3px 11px; border: 1px solid;
}
.prog-badge.running { color: var(--yellow); border-color: rgba(245,158,11,.35); background: rgba(245,158,11,.1); }
.prog-badge.done    { color: var(--green);  border-color: rgba(34,197,94,.35);  background: rgba(34,197,94,.1); }
.prog-badge.error   { color: var(--red);    border-color: rgba(239,68,68,.35);  background: rgba(239,68,68,.1); }
.prog-numbers { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 14px; }
.pn {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px; text-align: center;
}
.pn-val { font-size: 1.4rem; font-weight: 800; line-height: 1; }
.pn-lbl { font-size: .68rem; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: .6px; }
.pn.s .pn-val { color: var(--green);  }
.pn.f .pn-val { color: var(--red);    }
.pn.t .pn-val { color: var(--accent); }
.big-pb-wrap { background: var(--border); border-radius: 99px; height: 8px; overflow: hidden; margin-bottom: 8px; }
.big-pb-fill {
  height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2));
  border-radius: 99px; transition: width .4s ease;
}
.prog-pct { font-size: .75rem; color: var(--muted); text-align: right; }

/* Toast */
#toast {
  position: fixed; bottom: 26px; right: 26px;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 13px 18px;
  display: flex; align-items: center; gap: 11px; box-shadow: var(--shadow);
  transform: translateY(100px); opacity: 0;
  transition: transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s;
  z-index: 200; min-width: 240px; max-width: 340px;
}
#toast.show { transform: translateY(0); opacity: 1; }
.ti { font-size: 1.2rem; }
.tm { font-size: .83rem; line-height: 1.5; }
#toast.ok  { border-color: rgba(34,197,94,.4); }
#toast.err { border-color: rgba(239,68,68,.4); }

/* Telegram preview */
.preview-phone {
  background: var(--surface); border: 2px solid var(--border);
  border-radius: 22px; overflow: hidden; box-shadow: var(--shadow);
}
.ph-bar {
  background: #1e2230; padding: 9px 14px;
  display: flex; align-items: center; gap: 9px; border-bottom: 1px solid var(--border);
}
.ph-av {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, #5c6ef8, #7c3aed);
  border-radius: 50%; display: grid; place-items: center; font-size: .84rem; flex-shrink: 0;
}
.ph-name { font-size: .86rem; font-weight: 600; }
.ph-sub  { font-size: .68rem; color: var(--green); }
.tg-chat { background: #17212b; padding: 14px; min-height: 260px; }
.tg-bubble {
  background: #182533; border-radius: 11px 11px 11px 2px; max-width: 280px; overflow: hidden;
}
.tg-bubble img   { width: 100%; max-height: 155px; object-fit: cover; display: block; }
.tg-bubble video { width: 100%; max-height: 155px; display: block; }
.tb-body { padding: 9px 12px 5px; }
.tg-caption {
  font-size: .78rem; color: #c3d2e0; white-space: pre-wrap;
  word-break: break-word; line-height: 1.55; min-height: 18px;
}
.tb-time { font-size: .64rem; color: var(--muted); text-align: right; margin-top: 4px; }
.tg-btns { padding: 0 7px 7px; display: flex; flex-direction: column; gap: 4px; }
.tg-btn {
  background: rgba(92,110,248,.16); border: 1px solid rgba(92,110,248,.26);
  border-radius: 7px; padding: 7px 10px; font-size: .74rem; color: #91b7e8; text-align: center;
}
.hint-box {
  margin-top: 13px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 11px 13px; font-size: .72rem; color: var(--muted); line-height: 1.8;
}
</style>
