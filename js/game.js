// ============================================================
// ゲームの しくみ（縦スクロール版。ふだんは さわらなくて大丈夫）
//   座標は すべて Figma と同じ px（画面 1194×834、マップ 1194×3336）
// ============================================================
(() => {
  const W = 1194, H = 834;
  const MAP = STORY.map;
  const FOLLOW_Y = 692;            // 主人公の足もとを 画面の このくらいの高さに（Figma の位置）

  const $ = id => document.getElementById(id);
  const screenEl = $('screen');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const ui = {
    fade: $('fade'), dialog: $('dialog'), speaker: $('speaker'), face: $('face'),
    text: $('text'), choices: $('choices'), nextMark: $('nextMark'),
    title: $('title'), ending: $('ending'), endText: $('endText'), toast: $('toast'),
  };

  // ---------- 画像 ----------
  function load(src) { const i = new Image(); i.src = src; return i; }
  const IMG = {
    map: load(MAP.image),
    player: load('assets/player.png'),
    monsterFull: load('assets/monster_full.png'),
    monsterAlone: load('assets/monster_alone.png'),
    watch: load('assets/watch.png'),
    exclaim: load('assets/exclaim.png'),
  };
  const FACES = {
    hero: 'assets/face_hero.png',
    heroSleepy: 'assets/face_hero_sleepy.png',
    captive: 'assets/face_captive.png',
    monster: 'assets/face_monster.png',
  };
  // 絵の中の「足もと」の位置（切りぬいた画像の中での px）
  const PLAYER_FOOT = { x: 64, y: 190 };
  const MONSTER_FOOT = { x: 110, y: 200 };

  // ---------- 状態 ----------
  window.flags = {};
  let mode = 'title';              // title / play / event / end
  let player, camY, followCam, monsterState, monsterDX, shown, done, eyelid;
  const keys = { left: false, right: false, up: false, down: false };
  let timeScale = 1;               // オート中は STORY.autoSpeed ばい速

  function reset() {
    for (const k in flags) delete flags[k];
    resetPlayer();
    camY = MAP.height - H;
    followCam = true;
    monsterState = 'full';
    monsterDX = 0;
    shown = {};
    done = {};
    eyelid = 0;
    ui.fade.style.transition = 'none';
    ui.fade.style.opacity = 0;
    ui.dialog.classList.add('hidden');
  }

  function resetPlayer() {
    player = { x: STORY.playerStart.x, y: STORY.playerStart.y, moving: false, t: 0 };
  }

  // ---------- 少しずつ 変化させる ----------
  function tween(ms, fn) {
    ms /= timeScale;
    return new Promise(resolve => {
      if (ms <= 0) { fn(1); resolve(); return; }
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / ms);
        fn(p);
        if (p < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

  // ============================================================
  // story.js から 使う 命令
  // ============================================================
  window.wait = ms => new Promise(r => setTimeout(r, ms / timeScale));

  // ---- 会話 ----
  let advanceResolve = null, typeTimer = null, typing = false, fullText = '';

  window.say = (speaker, text, opt = {}) => new Promise(resolve => {
    openDialog(speaker, opt);
    ui.dialog.classList.remove('choosing');
    if (opt.face && FACES[opt.face]) {
      ui.face.src = FACES[opt.face];
      ui.face.classList.remove('hidden');
    } else {
      ui.face.classList.add('hidden');
    }
    typeText(text);
    advanceResolve = () => { advanceResolve = null; closeDialog(); resolve(); };
  });

  window.choose = (options, opt = {}) => new Promise(resolve => {
    openDialog(opt.speaker || '', opt);
    ui.dialog.classList.add('choosing');
    ui.choices.innerHTML = '';
    ui.choices.classList.toggle('three', options.length >= 3);
    options.forEach(label => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = label;
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        chooseResolve = null;
        ui.choices.innerHTML = '';
        closeDialog();
        resolve(label);
      });
      ui.choices.appendChild(b);
    });
    chooseResolve = i => { const b = ui.choices.children[i]; if (b) b.click(); };
  });
  let chooseResolve = null;

  function openDialog(speaker, opt) {
    ui.speaker.textContent = speaker;
    ui.speaker.classList.toggle('hidden', !speaker);
    ui.dialog.classList.toggle('bottom', opt.box === 'bottom');
    ui.dialog.classList.remove('hidden');
  }
  function closeDialog() {
    ui.dialog.classList.add('hidden');
  }

  function typeText(text) {
    clearInterval(typeTimer);
    const chars = Array.from(text);
    let n = 0;
    fullText = text;
    typing = true;
    ui.text.textContent = '';
    ui.nextMark.classList.add('hidden');
    typeTimer = setInterval(() => {
      n++;
      ui.text.textContent = chars.slice(0, n).join('');
      if (n >= chars.length) finishTyping();
    }, 40 / timeScale);
  }
  function finishTyping() {
    clearInterval(typeTimer);
    typing = false;
    ui.text.textContent = fullText;
    ui.nextMark.classList.remove('hidden');
  }
  function advance() {
    if (ui.dialog.classList.contains('hidden') || ui.dialog.classList.contains('choosing')) return;
    if (typing) { finishTyping(); return; }
    if (advanceResolve) advanceResolve();
  }

  // ---- 暗転 ----
  window.fadeOut = (color = 'black', ms = 600) => {
    ui.fade.style.background = color === 'white' ? '#ffffff' : '#151f10';
    ui.fade.style.transition = `opacity ${ms / timeScale}ms`;
    void ui.fade.offsetWidth;
    ui.fade.style.opacity = 1;
    return wait(ms);
  };
  window.fadeIn = (ms = 600) => {
    ui.fade.style.transition = `opacity ${ms / timeScale}ms`;
    ui.fade.style.opacity = 0;
    return wait(ms);
  };

  // まぶたが ひらく（一人称の動画の かわり）
  window.blink = async () => {
    eyelid = 1;
    ui.fade.style.transition = 'none';
    ui.fade.style.opacity = 0;
    await tween(900, p => { eyelid = 1 - ease(p) * 0.55; });
    await tween(250, p => { eyelid = 0.45 + p * 0.55; });
    await wait(200);
    await tween(700, p => { eyelid = 1 - ease(p) * 0.8; });
    await tween(200, p => { eyelid = 0.2 + p * 0.8; });
    await tween(600, p => { eyelid = 1 - ease(p); });
    eyelid = 0;
  };

  // ---- 絵 ----
  window.show = name => { shown[name] = true; };
  window.hide = name => { delete shown[name]; };
  window.monster = state => { monsterState = state; monsterDX = 0; };
  window.monsterWalk = (dx, ms) => {
    const from = monsterDX;
    return tween(ms, p => { monsterDX = from + dx * p; });
  };

  // ---- カメラ・主人公 ----
  window.camera = (y, ms = 800) => {
    followCam = false;
    const from = camY;
    return tween(ms, p => { camY = from + (y - from) * ease(p); });
  };
  window.follow = () => { followCam = true; };
  window.walkTo = (y, ms = 800) => {
    const from = player.y;
    player.moving = true;
    return tween(ms, p => { player.y = from + (y - from) * p; player.t += 0.016; })
      .then(() => { player.moving = false; });
  };
  window.resetPlayer = resetPlayer;

  // ---- そのほか ----
  let toastTimer = null;
  window.note = text => {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3500);
  };

  window.end = text => {
    mode = 'end';
    ui.endText.textContent = text;
    ui.ending.classList.remove('hidden');
  };

  // ============================================================
  // ながれ
  // ============================================================
  async function runEvent(fn) {
    mode = 'event';
    player.moving = false;
    try { await fn(); } catch (e) { console.error(e); }
    if (mode === 'event') mode = 'play';
  }

  async function startGame() {
    reset();
    ui.title.classList.add('hidden');
    await runEvent(STORY.opening);
  }

  function backToTitle() {
    reset();
    mode = 'title';
    ui.ending.classList.add('hidden');
    ui.title.classList.remove('hidden');
  }

  function checkTriggers() {
    for (const t of STORY.triggers) {
      const key = t.id + ':' + (flags.loop || 0);
      if (done[key]) continue;
      if (t.if && !t.if()) continue;
      if (player.y <= t.y) {
        done[key] = true;
        runEvent(t.run);
        return;
      }
    }
  }

  // ---------- 入力 ----------
  const KEYMAP = {
    ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
    ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  };
  window.addEventListener('keydown', e => {
    const k = KEYMAP[e.key];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) { advance(); e.preventDefault(); }
    if (chooseResolve && /^[1-9]$/.test(e.key)) chooseResolve(Number(e.key) - 1);
  });
  window.addEventListener('keyup', e => {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; touch = null; });

  // ---------- タッチ（iPad）：ゆびで なぞった 向きに あるく ----------
  //   ゆびを 置いた所から 動かした 向きへ あるく。はなすと 止まる。
  //   動かさずに はなす（タップ）と セリフが すすむ。
  const TOUCH_DEAD = 12;           // これより 小さい 動きは「タップ」と みなす（px）
  let touch = null;                // { id, x0, y0, vx, vy, moved }

  canvas.addEventListener('pointerdown', e => {
    if (touch) return;
    touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, vx: 0, vy: 0, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* なくても 動く */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.x0, dy = e.clientY - touch.y0;
    const d = Math.hypot(dx, dy);
    if (d < TOUCH_DEAD) { touch.vx = 0; touch.vy = 0; return; }
    touch.moved = true;
    touch.vx = dx / d;
    touch.vy = dy / d;
  });
  function touchEnd(e) {
    if (!touch || e.pointerId !== touch.id) return;
    const tapped = !touch.moved && e.type === 'pointerup';
    touch = null;
    if (tapped) advance();
  }
  canvas.addEventListener('pointerup', touchEnd);
  canvas.addEventListener('pointercancel', touchEnd);

  ui.dialog.addEventListener('click', advance);
  $('startBtn').addEventListener('click', startGame);
  $('settingBtn').addEventListener('click', () => note('セッティングは まだ じゅんびちゅう です'));
  $('againBtn').addEventListener('click', backToTitle);
  $('autoBtn').addEventListener('click', startAuto);

  // ============================================================
  // オートモード：カーソルが うごいて、ひとりでに すすむ
  //   えらぶ 選択肢は story.js の autoChoices。
  //   ほんものの キー・クリック・タッチが あったら やめる。
  // ============================================================
  const cursorEl = $('cursor'), ringEl = $('cursorRing'), badgeEl = $('autoBadge');
  const AUTO_DOOR_X = 606;         // まんなかの 入口の 中心（ここを めざして あるく）
  let auto = false, autoMove = null, autoChoiceIdx = 0;
  const cur = { x: W / 2, y: H / 2 }; // カーソルの 位置（Figma の px）

  function placeCursor() {
    cursorEl.style.left = (cur.x / W * 100) + '%';
    cursorEl.style.top = (cur.y / H * 100) + '%';
  }
  function cursorTo(x, y) {
    const fx = cur.x, fy = cur.y;
    const ms = Math.min(900, 250 + Math.hypot(x - fx, y - fy) * 0.9);
    return tween(ms, p => {
      const e = ease(p);
      cur.x = fx + (x - fx) * e;
      cur.y = fy + (y - fy) * e;
      placeCursor();
    });
  }
  // 画面の 部品の まんなか（Figma の px）
  function centerOf(el) {
    const s = screenEl.getBoundingClientRect(), r = el.getBoundingClientRect();
    return {
      x: (r.left + r.width / 2 - s.left) / s.width * W,
      y: (r.top + r.height / 2 - s.top) / s.height * H,
    };
  }
  async function clickFx() {
    cursorEl.classList.add('pressed');
    await wait(110);
    cursorEl.classList.remove('pressed');
    ringEl.classList.remove('pop');
    void ringEl.offsetWidth;
    ringEl.classList.add('pop');
    await wait(120);
  }
  // ボタンの 上に カーソルを もっていって クリックする
  async function autoClick(btn) {
    const c = centerOf(btn);
    await cursorTo(c.x, c.y);
    if (!auto) return false;
    btn.classList.add('hover');
    await wait(350);
    await clickFx();
    btn.classList.remove('hover');
    if (!auto || !btn.isConnected) return false;
    btn.click();
    return true;
  }

  async function startAuto() {
    if (auto) return;
    auto = true;
    timeScale = STORY.autoSpeed || 1;
    autoChoiceIdx = 0;
    screenEl.classList.add('auto');
    badgeEl.classList.remove('hidden');
    cursorEl.classList.remove('hidden');
    const c = centerOf($('autoBtn'));
    cur.x = c.x; cur.y = c.y;
    placeCursor();
    await wait(400);
    if (await autoClick($('startBtn'))) autopilot();
  }

  function stopAuto() {
    auto = false;
    timeScale = 1;
    autoMove = null;
    screenEl.classList.remove('auto');
    badgeEl.classList.add('hidden');
    cursorEl.classList.add('hidden');
    cursorEl.classList.remove('pressed');
  }

  async function autopilot() {
    while (auto) {
      const d = ui.dialog;
      const open = !d.classList.contains('hidden');
      if (open && d.classList.contains('choosing')) {
        await wait(800);
        if (!auto) break;
        const btns = [...ui.choices.children];
        if (!btns.length) continue;
        const want = (STORY.autoChoices || [])[autoChoiceIdx];
        const same = b => want !== undefined && b.textContent.replace(/\n/g, '') === want.replace(/\n/g, '');
        let b = btns.find(same);
        if (b) autoChoiceIdx++;
        await autoClick(b || btns[0]);
      } else if (open) {
        while (auto && typing) await wait(50);
        await wait(900 + Math.min(1200, fullText.length * 25));   // 読む時間
        if (!auto || d.classList.contains('hidden') || d.classList.contains('choosing')) continue;
        const c = centerOf(ui.nextMark);
        await cursorTo(c.x, c.y);
        if (!auto) break;
        await clickFx();
        if (!auto) break;
        advance();
        await wait(150);
      } else if (mode === 'play') {
        await autoWalk();
      } else if (mode === 'end') {
        await wait(2500);
        if (!auto) break;
        if (await autoClick($('againBtn'))) stopAuto();
      } else {
        await wait(100);
      }
    }
  }

  // ゆびで なぞる操作の まね：主人公の 横を おして、上へ ひっぱる
  async function autoWalk() {
    const anchor = () => ({ x: player.x + 170, y: player.y - camY - 60 });
    let a = anchor();
    await cursorTo(a.x, a.y);
    if (!auto || mode !== 'play') return;
    cursorEl.classList.add('pressed');
    await wait(200);
    const t0 = performance.now();
    while (auto && mode === 'play') {
      let vx = Math.max(-1, Math.min(1, (AUTO_DOOR_X - player.x) / 80)) * 0.6, vy = -1;
      const n = Math.hypot(vx, vy);
      vx /= n; vy /= n;
      autoMove = { vx, vy };
      a = anchor();
      const k = Math.min(1, (performance.now() - t0) / 250);
      cur.x = a.x + vx * 90 * k;
      cur.y = a.y + vy * 90 * k;
      placeCursor();
      await wait(16);
    }
    autoMove = null;
    cursorEl.classList.remove('pressed');
  }

  // ほんものの 操作が あったら オートを やめる
  window.addEventListener('keydown', e => { if (auto && e.isTrusted) stopAuto(); }, true);
  window.addEventListener('pointerdown', e => { if (auto && e.isTrusted) stopAuto(); }, true);

  // ---------- 画面サイズ（1194:834 に あわせる） ----------
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    screenEl.style.width = W * s + 'px';
    screenEl.style.height = H * s + 'px';
    screenEl.style.fontSize = (W * s / 119.4) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- 更新 ----------
  const HALF_W = 34;               // 主人公の からだの はば（半分）

  function blocked(x, y) {
    if (x - HALF_W < MAP.floorLeft || x + HALF_W > MAP.floorRight) return true;
    if (y > MAP.floorBottom) return true;
    return MAP.walls.some(w => x + HALF_W > w.x1 && x - HALF_W < w.x2 && y > w.y1 && y - 20 < w.y2);
  }

  function update(dt) {
    if (mode === 'play') {
      let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      let vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
      if (!vx && !vy && touch) { vx = touch.vx; vy = touch.vy; }
      if (!vx && !vy && autoMove) { vx = autoMove.vx; vy = autoMove.vy; }
      const sp = STORY.walkSpeed * dt * timeScale;
      const nx = player.x + vx * sp, ny = player.y + vy * sp;
      if (!blocked(nx, player.y)) player.x = nx;
      if (!blocked(player.x, ny)) player.y = ny;
      player.moving = vx !== 0 || vy !== 0;
      if (player.moving) player.t += dt;
      checkTriggers();
    }
    if (followCam) {
      camY = Math.max(0, Math.min(MAP.height - H, player.y - FOLLOW_Y));
    }
  }

  // ---------- 描画 ----------
  function ready(img) { return img.complete && img.naturalWidth > 0; }

  // 時計（show('ring') の あいだは「ピピピピッ」に あわせて ぴょんぴょん はねる）
  const RING_CYCLE = 1000;         // 「ピピピピッ」1回分（ミリ秒）
  const RING_HOPS = 4;             // 1回で はねる 数
  const RING_HOP_MS = 110;         // 1回 はねる 時間
  const RING_HEIGHT = 16;          // はねる 高さ（px）
  const RING_TILT = 0.14;          // かたむき（ラジアン）
  function drawWatch(x, y) {
    const img = IMG.watch;
    let dy = 0, tilt = 0;
    if (shown.ring) {
      const t = performance.now() % RING_CYCLE;
      const hop = Math.floor(t / RING_HOP_MS);
      if (hop < RING_HOPS) {
        const p = (t % RING_HOP_MS) / RING_HOP_MS;
        dy = -Math.sin(p * Math.PI) * RING_HEIGHT;
        tilt = (hop % 2 ? -1 : 1) * Math.sin(p * Math.PI) * RING_TILT;
      }
    }
    const cx = x + img.width / 2, cyw = y + img.height;   // 下のはしを 中心に かたむける
    ctx.save();
    ctx.translate(cx, cyw + dy);
    ctx.rotate(tilt);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#eaf2d7';
    ctx.fillRect(0, 0, W, H);
    const cy = Math.round(camY);
    if (ready(IMG.map)) ctx.drawImage(IMG.map, 0, -cy);

    // バケモノ
    if (monsterState !== 'none') {
      const img = monsterState === 'full' ? IMG.monsterFull : IMG.monsterAlone;
      const walking = monsterDX !== 0;
      const bob = walking ? Math.abs(Math.sin(monsterDX / 40)) * -10 : 0;
      if (ready(img)) {
        ctx.drawImage(img,
          Math.round(STORY.monsterPos.x - MONSTER_FOOT.x + monsterDX),
          Math.round(STORY.monsterPos.y - MONSTER_FOOT.y - cy + bob));
      }
    }

    // 主人公（あるくと 少し ゆれる）
    const bob = player.moving ? Math.round(Math.abs(Math.sin(player.t * 11)) * -6) : 0;
    const px = Math.round(player.x - PLAYER_FOOT.x);
    const py = Math.round(player.y - PLAYER_FOOT.y - cy + bob);
    if (ready(IMG.player)) ctx.drawImage(IMG.player, px, py);
    if (shown.watch && ready(IMG.watch)) drawWatch(px + 112, py - 52);
    if (shown.exclaim && ready(IMG.exclaim)) ctx.drawImage(IMG.exclaim, px + 108, py - 20);

    // まぶた
    if (eyelid > 0) {
      const h = (H / 2) * eyelid;
      ctx.fillStyle = '#151f10';
      ctx.fillRect(0, 0, W, h);
      ctx.fillRect(0, H - h, W, h);
    }
  }

  // ---------- メインループ ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();
