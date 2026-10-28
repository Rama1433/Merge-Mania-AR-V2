(() => {
  'use strict';

  const W = 400;
  const H = 548;
  const FLOOR = H - 10;
  const SIDE = 8;
  const DANGER_LINE = 85;
  const GRAVITY = 1650;
  const TIERS = [
    {value:2, radius:20, color:'#ff75c8', shade:'#ae3888', text:'#4b2154'},
    {value:4, radius:27, color:'#ffae72', shade:'#d96a66', text:'#653348'},
    {value:8, radius:34, color:'#ffe175', shade:'#dba354', text:'#5d4460'},
    {value:16, radius:42, color:'#a4f3a2', shade:'#48b88a', text:'#285a56'},
    {value:32, radius:50, color:'#66ebd8', shade:'#21a6af', text:'#215b6b'},
    {value:64, radius:60, color:'#71c7ff', shade:'#3779c8', text:'#173d6c'},
    {value:128, radius:71, color:'#a6a0ff', shade:'#675acc', text:'#34306d'},
    {value:256, radius:83, color:'#e9a0f7', shade:'#ab4cc7', text:'#513166'},
    {value:512, radius:96, color:'#ff84a7', shade:'#bf3575', text:'#6a2452'},
    {value:1024, radius:110, color:'#ffbc6c', shade:'#e0764d', text:'#75394c'},
    {value:2048, radius:123, color:'#fff18e', shade:'#ecae36', text:'#76531c'}
  ];
  const $ = id => document.getElementById(id);
  const POWER_CONFIG = {
    hammer:{cost:120, title:'Martillo'}, swap:{cost:170,title:'Cambio'},
    magnet:{cost:260,title:'Imán'}, bomb:{cost:390,title:'Bomba'}
  };
  const GOALS = [
    {tier:6,count:1,coins:100,gift:'hammer'},
    {tier:7,count:1,coins:150,gift:'swap'},
    {tier:8,count:1,coins:250,gift:'magnet'},
    {tier:9,count:1,coins:400,gift:'bomb'},
    {tier:10,count:1,coins:600,gift:'hammer'},
    {tier:6,count:3,coins:350,gift:null},
    {tier:7,count:2,coins:450,gift:'swap'},
    {tier:8,count:2,coins:600,gift:'magnet'}
  ];
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const scoreEl = $('scoreValue');
  const bestEl = $('bestValue');
  const comboEl = $('comboValue');
  const nextEl = $('nextValue');
  const nextIcon = $('nextIcon');
  const statusEl = $('statusLabel');
  const hintEl = $('statusHint');
  const toastEl = $('gameToast');
  const modal = $('gameModal');
  const modalTitle = $('modalTitle');
  const modalKicker = $('modalKicker');
  const modalIcon = $('modalIcon');
  const modalDescription = $('modalDescription');
  const modalPrimary = $('modalPrimary');
  const modalSecondary = $('modalSecondary');
  const finalBox = $('finalScoreBox');
  const finalScoreEl = $('finalScore');
  const soundButton = $('soundButton');
  const pauseButton = $('pauseButton');
  const fullscreenButton = $('fullscreenButton');
  const boardFrame = document.querySelector('.board-frame');
  const gameArea = $('gameArea');
  let dpr = 1;
  let balls = [];
  let particles = [];
  let floatLabels = [];
  let ringEffects = [];
  let ballId = 0;
  let currentTier = 0;
  let nextTier = 1;
  let aimX = W / 2;
  let score = 0;
  let best = getStoredNumber('merge_mania_best_v1');
  let totalDrops = 0;
  let combo = 0;
  let lastMergeTime = -1e9;
  let lastDropTime = -1e9;
  let dangerTimer = 0;
  let state = 'playing';
  let lastFrameTime = 0;
  let accumulator = 0;
  let time = 0;
  let soundEnabled = loadSoundPref();
  let audioContext;
  let toastTimeout;
  let touchId = null;
  let movedPointer = false;
  let recordBroken = false;
  let lastShownDanger = false;
  let coins = getStoredNumber('merge_mania_coins_v3');
  let inventory = loadInventory();
  let activePower = null;
  let goalIndex = 0;
  let goalProgress = 0;
  let highestTier = 0;
  let pendingPowerEffects = [];
  function loadInventory() {
    try {
      const raw = JSON.parse(localStorage.getItem('merge_mania_inventory_v3') || '{}');
      return Object.fromEntries(Object.keys(POWER_CONFIG).map(k => [k, Math.min(99, Math.max(0, Math.floor(Number(raw[k]) || 0)))]));
    } catch { return {hammer:0,swap:0,magnet:0,bomb:0}; }
  }
  function saveInventory() {
    try { localStorage.setItem('merge_mania_inventory_v3', JSON.stringify(inventory)); } catch {}
  }
  function currentGoal(){
    if(goalIndex < GOALS.length) return GOALS[goalIndex];
    const series = [{tier:6,count:4},{tier:7,count:3},{tier:8,count:2},{tier:9,count:1}];
    const stage = goalIndex-GOALS.length;
    const base = series[stage % series.length];
    return {...base, count:base.count + Math.min(3,Math.floor(stage/series.length)),coins:400 + Math.min(1100,stage*75),gift:null};
  }
  function goalText(goal){return goal.count===1?`Creá una esfera ${TIERS[goal.tier].value}`:`Fusioná ${goal.count} esferas ${TIERS[goal.tier].value}`;}
  function updateGoalHUD() {
    const goal=currentGoal();
    $('goalNumber').textContent='OBJETIVO '+(goalIndex+1);
    $('goalText').textContent=goalText(goal);
    $('goalReward').textContent='+'+goal.coins;
    $('goalCount').textContent=`${goalProgress} / ${goal.count}`;
    const advance=goal.count===1 ? Math.max(0,highestTier/goal.tier)*100 : goalProgress/goal.count*100;
    const p=clamp(advance,0,100);
    $('goalFill').style.width=p+'%';
    $('goalProgress').setAttribute('aria-valuenow',String(Math.round(p)));
    $('goalHint').textContent=goal.count===1 ? `Máxima creada: ${TIERS[highestTier].value} · seguí fusionando` : 'Cada fusión de ese valor suma 1';
  }
  function updatePowerHUD() {
    $('coinValue').textContent=coins.toLocaleString('es-AR');
    for(const key of Object.keys(POWER_CONFIG)){
      $(key+'Qty').textContent='×'+inventory[key];
      const cell=document.querySelector(`[data-power="${key}"]`);
      cell.classList.toggle('selected',activePower===key);
      cell.querySelector('.power-use').disabled=inventory[key]<=0 || state==='over' || state==='paused';
      cell.querySelector('.power-use').setAttribute('aria-pressed',String(activePower===key));
      const buy=cell.querySelector('.power-buy');
      buy.disabled=coins<POWER_CONFIG[key].cost || inventory[key]>=99;
    }
    $('powerMessage').textContent=activePower===null?'Tocá poder para usar · + comprar':
      activePower==='hammer'?'MARTILLO: tocá una esfera · cancelar: botón':
      activePower==='magnet'?'IMÁN: elegí una esfera con pareja':
      'BOMBA: elegí una zona del tablero';
    boardFrame.classList.toggle('power-targeting',activePower!==null);
  }
  function addPower(key,n=1){ inventory[key]=Math.min(99,inventory[key]+n);saveInventory(); }
  function spendPower(key){if(inventory[key]<1)return false;inventory[key]--;saveInventory();return true;}
  function earnGoalOnMerge(tier){
    highestTier=Math.max(highestTier,tier);
    const goal=currentGoal();
    if(tier===goal.tier){goalProgress++;}
    if(goalProgress>=goal.count){
      const completed=goalIndex+1;
      coins+=goal.coins;store('merge_mania_coins_v3',coins);
      if(goal.gift)addPower(goal.gift);
      goalIndex++;goalProgress=0;
      const reward=goal.gift ? `+${goal.coins} monedas · ${POWER_CONFIG[goal.gift].title} ×1` : `+${goal.coins} monedas`;
      showToast('¡OBJETIVO '+completed+'!',reward);
      tone(750,.12,'triangle',.04);tone(1020,.18,'sine',.045,.11);
      vibrate([22,45,55]);
    }
    updateGoalHUD();updatePowerHUD();
  }
  function buyPower(key){
    const info=POWER_CONFIG[key];
    if(!info || inventory[key]>=99)return;
    if(coins<info.cost){showToast('FALTAN MONEDAS',`${info.title}: ${info.cost}`);return;}
    coins-=info.cost;store('merge_mania_coins_v3',coins);
    addPower(key);updatePowerHUD();
    showToast('¡COMPRADO!',`${info.title} disponible`);
    tone(650,.1,'sine',.027);vibrate(10);
  }
  function cancelPower(){activePower=null;if(state==='targeting'){state='playing';lastFrameTime=performance.now();}updatePowerHUD();}
  function activatePower(key){
    if(state==='over'||state==='paused')return;
    if(activePower===key){cancelPower();return;}
    if(!inventory[key]){showToast('SIN CARGAS','Conseguí poderes completando objetivos');return;}
    if(key==='swap'){
      const old=currentTier;
      let chosen=chooseTier();let n=0;
      while(chosen===old&&n++<8)chosen=chooseTier();
      if(chosen===old)chosen=(old+1)%Math.min(4,TIERS.length);
      if(!spendPower('swap'))return;
      currentTier=chosen;updatePowerHUD();draw();
      showToast('¡ESFERA CAMBIADA!',`${TIERS[old].value} → ${TIERS[chosen].value}`);tone(560,.12);return;
    }
    activePower=key;state='targeting';updatePowerHUD();
  }
  function targetBall(x,y){
    let selected=null,dist=Infinity;
    for(const b of balls){const d=Math.hypot(b.x-x,b.y-y);if(d < b.r+6 && d<dist){selected=b;dist=d;}}
    return selected;
  }
  function useTargetedPower(x,y){
    if(state!=='targeting'||!activePower)return false;
    const key=activePower;
    if(key==='hammer'){
      const target=targetBall(x,y);
      if(!target){showToast('APUNTÁ A UNA ESFERA','No se gastó el poder');return true;}
      if(!spendPower(key))return true;
      balls.splice(balls.indexOf(target),1);
      spawnParticles(target.x,target.y,TIERS[target.tier].color,23,220);
      ringEffects.push({x:target.x,y:target.y,r:8,maxR:target.r*1.9,life:.4,maxLife:.4,color:'#ffe4a2'});
      showToast('¡MARTILLAZO!','Espacio liberado · sin puntos');
    } else if(key==='magnet'){
      const first=targetBall(x,y);
      if(!first || first.tier===TIERS.length-1){showToast('ELEGÍ UNA ESFERA','Necesitás otra igual · no se gastó');return true;}
      const partner=balls.filter(b=>b!==first&&b.tier===first.tier).sort((a,b)=>Math.hypot(a.x-first.x,a.y-first.y)-Math.hypot(b.x-first.x,b.y-first.y))[0];
      if(!partner){showToast('NO HAY PAREJA','Buscá dos números iguales');return true;}
      if(!spendPower(key))return true;
      pendingPowerEffects.push({x:partner.x,y:partner.y,ex:first.x,ey:first.y,life:.35,maxLife:.35,color:'#c69bff'});
      performMerge(first,partner,true);
      showToast('¡FUSIÓN MAGNÉTICA!','Cuenta para el objetivo · sin puntos');
    } else if(key==='bomb'){
      const radius=105;
      const affected=balls.map(b=>({b,d:Math.hypot(b.x-x,b.y-y)})).filter(o=>o.d<radius+o.b.r*.45).sort((a,b)=>a.d-b.d).slice(0,5);
      if(!affected.length){showToast('ELEGÍ OTRA ZONA','No se gastó el poder');return true;}
      if(!spendPower(key))return true;
      for(const {b} of affected){const i=balls.indexOf(b);if(i>=0){balls.splice(i,1);spawnParticles(b.x,b.y,TIERS[b.tier].color,12,195);}}
      ringEffects.push({x,y,r:14,maxR:110,life:.45,maxLife:.45,color:'#ff79b6'});
      showToast('¡BOMBA!',`${affected.length} esferas eliminadas · sin puntos`);
    }
    tone(key==='bomb'?240:500,.16,'triangle',.035);vibrate(key==='bomb'?[25,45,35]:20);
    dangerTimer=0;lastShownDanger=false;
    cancelPower();updateHUD();
    return true;
  }

  function getStoredNumber(key) {
    try { return Math.max(0, parseInt(localStorage.getItem(key), 10) || 0); }
    catch { return 0; }
  }
  function loadSoundPref() {
    try { return localStorage.getItem('merge_mania_sound_v1') !== 'off'; }
    catch { return true; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, String(value)); }
    catch { /* Private browsing may disallow storage. */ }
  }
  function vibrate(duration) {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(duration);
  }
  function tone(frequency, duration = 0.1, waveform = 'sine', volume = 0.027, delay = 0) {
    if (!soundEnabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioContext ||= new AC();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const start = audioContext.currentTime + delay;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = waveform;
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.22, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + duration + 0.025);
    } catch { /* Audio unavailable; gameplay still works. */ }
  }
  function updateSoundIcon() {
    $('soundOnIcon').classList.toggle('hidden', !soundEnabled);
    $('soundOffIcon').classList.toggle('hidden', soundEnabled);
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.title = soundEnabled ? 'Silenciar' : 'Activar sonido';
  }
  function resizeCanvas() {
    const value = Math.min(window.devicePixelRatio || 1, 2.5);
    if (value === dpr && canvas.width) return;
    dpr = value;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function fitBoard() {
    // Scale the rendered board uniformly; never change physics sizes or saved scores.
    const area = gameArea.getBoundingClientRect();
    if (area.width < 40 || area.height < 40) return;
    const maxWidth = Math.max(40, area.width - 2);
    const maxHeight = Math.max(40, area.height - 2);
    const width = Math.floor(Math.min(maxWidth, maxHeight * W / H));
    boardFrame.style.width = width + 'px';
    boardFrame.style.height = Math.floor(width * H / W) + 'px';
  }
  function updateFullscreenButton() {
    const active = Boolean(document.fullscreenElement) ||
      window.matchMedia('(display-mode: fullscreen)').matches;
    $('enterFullscreenIcon').classList.toggle('hidden', active);
    $('exitFullscreenIcon').classList.toggle('hidden', !active);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Activar pantalla completa');
    fullscreenButton.title = active ? 'Salir de pantalla completa' : 'Pantalla completa';
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } else if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches) {
        showToast('¡MODO APP!', 'Ya se abrió sin las barras del navegador');
      } else {
        showToast('INSTALÁ LA PWA', 'En iPhone: Compartir → Agregar a inicio');
      }
    } catch {
      showToast('PANTALLA COMPLETA', 'Abrilo desde el ícono instalado');
    }
    updateFullscreenButton();
    requestAnimationFrame(fitBoard);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(n, low, high) { return Math.min(high, Math.max(low, n)); }
  function chooseTier() {
    const r = Math.random();
    if (score < 150) return r < .48 ? 0 : r < .82 ? 1 : 2;
    return r < .37 ? 0 : r < .67 ? 1 : r < .9 ? 2 : 3;
  }
  function updateHUD() {
    scoreEl.textContent = score.toLocaleString('es-AR');
    bestEl.textContent = best.toLocaleString('es-AR');
    comboEl.textContent = combo > 1 ? 'x' + combo : '—';
    const cfg = TIERS[nextTier];
    nextEl.textContent = cfg.value;
    nextIcon.textContent = cfg.value;
    nextIcon.style.background = `radial-gradient(circle at 32% 24%, #ffffffaa, transparent 48%), ${cfg.color}`;
    nextIcon.style.color = cfg.text;
    updateGoalHUD();updatePowerHUD();
  }
  function resetGame() {
    balls = [];
    particles = [];
    floatLabels = [];
    ringEffects = [];
    ballId = 0;
    score = 0;
    goalIndex=0;goalProgress=0;highestTier=0;pendingPowerEffects=[];activePower=null;
    totalDrops = 0;
    combo = 0;
    lastMergeTime = -1e9;
    lastDropTime = -1e9;
    dangerTimer = 0;
    lastShownDanger = false;
    recordBroken = false;
    aimX = W / 2;
    currentTier = 0;
    nextTier = chooseTier();
    state = 'playing';
    boardFrame.classList.remove('power-targeting');
    accumulator = 0;
    time = 0;
    modal.classList.add('hidden');
    $('startingTip').classList.remove('hidden');
    toastEl.classList.remove('show');
    statusEl.textContent = '¡A fusionar!';
    hintEl.textContent = 'Uní dos pelotas iguales';
    updateHUD();
    canvas.focus({preventScroll:true});
  }
  function dropBall() {
    if (state !== 'playing' || time - lastDropTime < .36) return;
    lastDropTime = time;
    const cfg = TIERS[currentTier];
    const x = clamp(aimX, cfg.radius + SIDE + 1, W - cfg.radius - SIDE - 1);
    balls.push({id:++ballId, tier:currentTier, x, y:cfg.radius + 8, vx:0, vy:60, r:cfg.radius, bornAt:time, angle:rand(-.1,.1), shimmer:rand(0,Math.PI*2)});
    currentTier = nextTier;
    nextTier = chooseTier();
    totalDrops++;
    $('startingTip').classList.add('hidden');
    tone(210 + TIERS[currentTier].value * 4, .06, 'sine', .018);
    updateHUD();
  }
  function spawnParticles(x,y,color,count=15,power=200) {
    for (let i=0;i<count;i++) {
      const a = rand(0, Math.PI*2);
      const s = rand(power*.3,power);
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,color,life:rand(.38,.8),maxLife:.8,r:rand(2,5),shape:Math.random()>.7?1:0});
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }
  function showToast(main, sub='') {
    toastEl.innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 900);
  }
  function performMerge(one, two, fromPower=false) {
    if (!balls.includes(one) || !balls.includes(two)) return;
    const idx = Math.min(one.tier + 1, TIERS.length - 1);
    if (one.tier >= TIERS.length - 1) return;
    const nextCfg = TIERS[idx];
    const x = clamp((one.x + two.x) / 2, nextCfg.radius + SIDE, W - nextCfg.radius - SIDE);
    const y = clamp((one.y + two.y) / 2, nextCfg.radius + 2, FLOOR - nextCfg.radius);
    const vx = clamp((one.vx + two.vx)/2, -200, 200);
    const vy = Math.max(-310, (one.vy + two.vy)/2 - 135);
    balls.splice(balls.indexOf(one), 1);
    balls.splice(balls.indexOf(two), 1);
    balls.push({id:++ballId,tier:idx,x,y,vx,vy,r:nextCfg.radius,bornAt:time-.6,angle:0,shimmer:rand(0,7)});

    const currentTime = performance.now();
    if(!fromPower){
      combo = currentTime - lastMergeTime < 2200 ? combo + 1 : 1;
      lastMergeTime = currentTime;
    }
    const earned = fromPower ? 0 : nextCfg.value * Math.min(combo, 5);
    score += earned;
    if (score > best) {
      best = score;
      store('merge_mania_best_v1', best);
      if (!recordBroken && best > 16 && score > 16) {
        recordBroken = true;
      }
    }
    const count = Math.min(14 + idx * 3, 34);
    spawnParticles(x, y, nextCfg.color, count, 110 + idx * 18);
    ringEffects.push({x,y,r:12,maxR:nextCfg.radius * 1.8,life:.38,maxLife:.38,color:nextCfg.color});
    floatLabels.push({x, y:y-nextCfg.radius*.4, value:fromPower?'FUSIÓN':'+'+earned,life:.85,maxLife:.85});
    tone(Math.min(310+idx*73+Math.min(combo,5)*37,1100),.12,'sine',.036);
    if (idx >= 4) tone(Math.min(490+idx*62,1150),.18,'triangle',.024,.055);
    vibrate(combo >= 3 ? [22,30,35] : 14);
    if (!fromPower && combo >= 3) showToast(`¡COMBO x${combo}!`,`+${earned} PUNTOS`);
    else if (!fromPower && idx >= 6) showToast('¡INCREÍBLE!',`+${earned} PUNTOS`);
    else if (!fromPower && idx >= 4) showToast('¡GENIAL!',`+${earned} PUNTOS`);
    else if (!fromPower && combo === 2) showToast('¡DOBLE!',`+${earned} PUNTOS`);
    statusEl.textContent = fromPower ? '¡Fusión especial!' : combo > 1 ? `¡Racha x${combo}!` : '¡Buena fusión!';
    hintEl.textContent = `Creaste una pelota de ${nextCfg.value}`;
    earnGoalOnMerge(idx);
    updateHUD();
  }
  // Keep every physical circle inside the playable arena.  This must run
  // AFTER collision resolution as well as after integration: stacked spheres
  // can push the lower spheres through the floor during collision correction.
  function containBall(b) {
    const left = SIDE + b.r;
    const right = W - SIDE - b.r;
    const top = 1 + b.r;
    const bottom = FLOOR - b.r;
    if (b.x < left) {
      b.x = left;
      if (b.vx < 0) b.vx = -b.vx * .22;
    } else if (b.x > right) {
      b.x = right;
      if (b.vx > 0) b.vx = -b.vx * .22;
    }
    if (b.y > bottom) {
      b.y = bottom;
      if (b.vy > 0) {
        b.vy = b.vy < 68 ? 0 : -b.vy * .13;
        b.vx *= .965;
      }
    } else if (b.y < top) {
      b.y = top;
      if (b.vy < 0) b.vy = -b.vy * .12;
    }
  }
  function simulate(dt) {
    time += dt;
    const drag = Math.pow(.994, dt*60);
    for (const b of balls) {
      b.vy += GRAVITY * dt;
      b.vy = clamp(b.vy, -1100, 1600);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= drag;
      containBall(b);
    }

    const matched = new Set();
    const pending = [];
    for (let iteration=0; iteration<7; iteration++) {
      for (let i=0; i<balls.length; i++) {
        const a = balls[i];
        if (matched.has(a.id)) continue;
        for (let j=i+1; j<balls.length; j++) {
          const b = balls[j];
          if (matched.has(b.id)) continue;
          let dx = b.x-a.x, dy=b.y-a.y;
          const minDist = a.r+b.r;
          const d2 = dx*dx+dy*dy;
          if (d2 >= minDist*minDist) continue;
          let distance = Math.sqrt(d2);
          if (distance < .001) { dx=.0001;dy=1;distance=1; }
          const nx = dx/distance, ny=dy/distance;
          const overlap = minDist-distance;
          if (a.tier===b.tier && a.tier<TIERS.length-1 && iteration===0 && overlap>1) {
            matched.add(a.id);matched.add(b.id);
            pending.push([a,b]);
            break;
          }
          if (a.tier===b.tier && a.tier<TIERS.length-1) continue;
          const massA=a.r*a.r, massB=b.r*b.r;
          const invA=1/massA, invB=1/massB, invTotal=invA+invB;
          const push=(overlap+.25)*.9;
          a.x-=nx*push*invA/invTotal;b.x+=nx*push*invB/invTotal;
          a.y-=ny*push*invA/invTotal;b.y+=ny*push*invB/invTotal;
          const relativeVx=b.vx-a.vx,relativeVy=b.vy-a.vy;
          const speed=relativeVx*nx+relativeVy*ny;
          if(speed<0){
            const impulse=-(1+.1)*speed/invTotal;
            a.vx-=impulse*nx*invA;a.vy-=impulse*ny*invA;
            b.vx+=impulse*nx*invB;b.vy+=impulse*ny*invB;
          }
        }
      }
      // Collision impulses may move a ball outside the board after the first
      // boundary check. Re-apply rigid wall and floor constraints each pass.
      for (const b of balls) containBall(b);
    }
    for (const pair of pending.slice(0,8)) performMerge(pair[0],pair[1]);
    for (const b of balls) containBall(b);

    const danger = balls.some(b => time-b.bornAt > 1.6 && b.y-b.r<DANGER_LINE && Math.abs(b.vy)<125);
    if (danger) dangerTimer += dt;
    else dangerTimer = Math.max(0, dangerTimer-dt*1.7);
    if (dangerTimer > .25 && !lastShownDanger) {
      statusEl.textContent = '¡Cuidado arriba!';
      hintEl.textContent = 'Liberá espacio para seguir';
      lastShownDanger = true;
    } else if (!danger && lastShownDanger) {
      lastShownDanger=false;
      statusEl.textContent = '¡A fusionar!';
      hintEl.textContent = 'Uní dos pelotas iguales';
    }
    if (dangerTimer > 2.5 && state === 'playing') gameOver();
  }
  function advanceEffects(dt) {
    for (const p of particles) {
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=370*dt;p.vx*=.99;p.life-=dt;
    }
    particles=particles.filter(p=>p.life>0);
    for (const p of floatLabels) { p.y-=36*dt;p.life-=dt; }
    floatLabels=floatLabels.filter(p=>p.life>0);
    for (const r of ringEffects) {r.life-=dt;r.r=clamp(r.r+(r.maxR-r.r)*dt*12,0,r.maxR);}
    ringEffects=ringEffects.filter(r=>r.life>0);
    for (const p of pendingPowerEffects) p.life-=dt;
    pendingPowerEffects=pendingPowerEffects.filter(p=>p.life>0);
  }
  function drawRoundedLabel(x,y,text,fill,fg) {
    ctx.save();ctx.font='900 10px system-ui';
    const tw=ctx.measureText(text).width;
    const ww=tw+17;
    ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x-ww/2,y-11,ww,21,9);ctx.fill();
    ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
    ctx.restore();
  }
  function drawBall(x,y,tier,scale=1,opacity=1,angle=0) {
    const cfg=TIERS[tier];
    const r=cfg.radius*scale;
    if (r < 1) return;
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(x,y);ctx.rotate(angle);
    ctx.shadowColor=cfg.color;ctx.shadowBlur=tier>=5?17:9;
    const grad=ctx.createRadialGradient(-r*.32,-r*.4,r*.04,0,0,r*1.2);
    grad.addColorStop(0,'#ffffff');grad.addColorStop(.075,cfg.color);grad.addColorStop(.65,cfg.color);grad.addColorStop(1,cfg.shade);
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.lineWidth=Math.max(2,r*.068);
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.arc(0,0,r-ctx.lineWidth/2,Math.PI*1.04,Math.PI*1.83);ctx.stroke();
    ctx.strokeStyle='rgba(35,16,59,.13)';ctx.lineWidth=Math.max(2,r*.075);ctx.beginPath();ctx.arc(0,0,r-ctx.lineWidth/2,Math.PI*.09,Math.PI*.94);ctx.stroke();
    ctx.fillStyle='#ffffff8c';ctx.beginPath();ctx.ellipse(-r*.36,-r*.48,r*.18,r*.1,-.6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=cfg.text;
    const valueStr=String(cfg.value);
    const fontSize=(valueStr.length>=4? .38:valueStr.length===3?.45:.57)*r;
    ctx.font=`1000 ${Math.max(10,fontSize)}px ui-rounded,system-ui,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(valueStr,0,r*.04);
    if(tier>=6){
      ctx.fillStyle='#ffffffbb';ctx.font=`${Math.max(10,r*.16)}px sans-serif`;
      ctx.fillText('✦',0,-r*.54);
    }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    ctx.save();
    const flash=dangerTimer>.2? .26 + .2*Math.sin(performance.now()*.014):.18;
    ctx.strokeStyle=`rgba(255,128,154,${flash})`;
    ctx.setLineDash([7,8]);ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(SIDE+4,DANGER_LINE);ctx.lineTo(W-SIDE-4,DANGER_LINE);ctx.stroke();ctx.setLineDash([]);
    ctx.font='900 9px system-ui';ctx.textAlign='left';ctx.textBaseline='bottom';
    ctx.fillStyle=`rgba(255,163,178,${flash+ .28})`;ctx.fillText('LÍMITE',16,DANGER_LINE-6);
    ctx.restore();

    if (state === 'playing') {
      const r=TIERS[currentTier].radius;
      const x=clamp(aimX,r+SIDE+1,W-r-SIDE-1);
      let stop=FLOOR-r;
      for(const b of balls) {
        const dx=Math.abs(b.x-x);
        if(dx < b.r+r) {
          const vertical=Math.sqrt(Math.max(0,(b.r+r)**2-dx**2));
          stop=Math.min(stop,b.y-vertical);
        }
      }
      ctx.save();ctx.beginPath();ctx.setLineDash([4,9]);ctx.strokeStyle='#d3c2ff68';ctx.lineWidth=2;
      ctx.moveTo(x,r*2+14);ctx.lineTo(x,Math.max(r*2+14,stop-8));ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#e0d7ff28';ctx.beginPath();ctx.ellipse(x,Math.max(r,stop+4),Math.max(10,r*.8),5,0,0,Math.PI*2);ctx.fill();
      const breathe=1+Math.sin(performance.now()*.004)*.025;
      drawBall(x,r+8,currentTier,breathe,.93);
      ctx.restore();
    }

    for (const b of balls) {
      const age=time-b.bornAt;
      const scale= age < .16 ? .85 + .15 * Math.sin(Math.PI*.5*clamp(age/.16,0,1)):1;
      drawBall(b.x,b.y,b.tier,scale,1,b.angle);
    }
    for (const fx of pendingPowerEffects){
      ctx.save();ctx.globalAlpha=fx.life/fx.maxLife;
      ctx.strokeStyle=fx.color;ctx.lineWidth=5;ctx.shadowColor=fx.color;ctx.shadowBlur=15;
      ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(fx.x,fx.y);ctx.lineTo(fx.ex,fx.ey);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
    for(const ring of ringEffects){
      ctx.save();ctx.globalAlpha=(ring.life/ring.maxLife)*.65;
      ctx.strokeStyle=ring.color;ctx.lineWidth=4*(ring.life/ring.maxLife);
      ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    for (const p of particles) {
      ctx.save();ctx.globalAlpha=Math.min(1,p.life/.4);ctx.fillStyle=p.color;
      ctx.translate(p.x,p.y);ctx.rotate(p.life*6);
      if(p.shape)ctx.fillRect(-p.r/2,-p.r/2,p.r*1.4,p.r*1.4);
      else{ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
    for (const l of floatLabels) {
      ctx.save();ctx.globalAlpha=Math.min(1,l.life/.24);
      ctx.textAlign='center';ctx.font='1000 18px system-ui';ctx.lineWidth=3;
      ctx.strokeStyle='#231d45';ctx.strokeText(l.value,l.x,l.y);
      ctx.fillStyle='#fff4af';ctx.fillText(l.value,l.x,l.y);
      ctx.restore();
    }
    if(state==='targeting' && activePower){
      ctx.save();ctx.fillStyle='#11102542';ctx.fillRect(0,0,W,H);
      ctx.textAlign='center';ctx.textBaseline='top';ctx.font='950 14px system-ui';
      ctx.fillStyle='#ffe7b0';ctx.fillText(activePower==='bomb'?'ELEGÍ UNA ZONA':activePower==='magnet'?'ELEGÍ UNA PAREJA':'TOCÁ UNA ESFERA',W/2,14);
      ctx.restore();
    }
    if(dangerTimer>.15){
      ctx.save();ctx.globalAlpha=Math.min(.42,dangerTimer*.15);
      ctx.strokeStyle='#ff6989';ctx.lineWidth=8;
      ctx.strokeRect(4,4,W-8,H-8);ctx.restore();
    }
  }
  function gameOver() {
    activePower=null;state='over';updatePowerHUD();
    modalIcon.textContent='💥';
    modalKicker.textContent=score>=best&&score>0?'¡NUEVO RÉCORD!':'FIN DE LA PARTIDA';
    modalTitle.textContent=score>=best&&score>0?'¡Qué partidaza!':'¡Casi lo tenés!';
    modalDescription.textContent='El tablero se llenó. ¿Superás tu puntaje en la próxima?';
    finalScoreEl.textContent=score.toLocaleString('es-AR');
    finalBox.classList.remove('hidden');
    modalPrimary.innerHTML='JUGAR OTRA VEZ <span>↻</span>';
    modalSecondary.textContent='Ver mi tablero';
    modalSecondary.classList.remove('hidden');
    modal.classList.remove('hidden');
    tone(260,.25,'triangle',.03);tone(185,.33,'sine',.025,.15);
    vibrate([50,70,55]);
  }
  function togglePause() {
    if (state === 'over') return;
    if(state==='targeting')cancelPower();
    if(state==='paused') { state='playing';modal.classList.add('hidden');lastFrameTime=performance.now();updatePowerHUD();return; }
    state='paused';updatePowerHUD();
    modalIcon.textContent='⏸';
    modalKicker.textContent='PARTIDA EN PAUSA';
    modalTitle.textContent='Tomá un descanso';
    modalDescription.textContent='Tus pelotas te esperan. ¡La racha sigue!';
    finalBox.classList.add('hidden');
    modalPrimary.innerHTML='CONTINUAR <span>→</span>';
    modalSecondary.textContent='Empezar de nuevo';
    modalSecondary.classList.remove('hidden');
    modal.classList.remove('hidden');
  }
  function updateAim(clientX) {
    const rect=canvas.getBoundingClientRect();
    aimX=clamp((clientX-rect.left)/rect.width*W,28,W-28);
  }
  function powerPoint(e){const rect=canvas.getBoundingClientRect();return {x:(e.clientX-rect.left)/rect.width*W,y:(e.clientY-rect.top)/rect.height*H};}
  canvas.addEventListener('pointerdown',e=>{
    if(state==='targeting'){
      if(e.pointerType==='mouse'){const p=powerPoint(e);useTargetedPower(p.x,p.y);}
      else {touchId=e.pointerId;try{canvas.setPointerCapture(e.pointerId);}catch{}}
      e.preventDefault();return;
    }
    if(state!=='playing')return;
    updateAim(e.clientX);
    if(e.pointerType==='mouse'){dropBall();return;}
    touchId=e.pointerId;
    movedPointer=false;
    try{canvas.setPointerCapture(e.pointerId);}catch{}
    e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    if(state!=='playing')return;
    if(e.pointerType==='mouse'||e.pointerId===touchId) {
      updateAim(e.clientX);
      if(e.pointerId===touchId)movedPointer=true;
    }
  });
  canvas.addEventListener('pointerup',e=>{
    if(e.pointerId!==touchId)return;
    if(state==='targeting'){
      const p=powerPoint(e);touchId=null;useTargetedPower(p.x,p.y);e.preventDefault();return;
    }
    updateAim(e.clientX);
    touchId=null;
    dropBall();
    e.preventDefault();
  });
  canvas.addEventListener('pointercancel',()=>{touchId=null;});
  document.addEventListener('keydown', e => {
    const tag=document.activeElement?.tagName;
    if(tag==='BUTTON' && e.code==='Space')return;
    if(e.code==='ArrowLeft'||e.code==='ArrowRight'){
      e.preventDefault();aimX=clamp(aimX+(e.code==='ArrowLeft'?-22:22),32,W-32);
    } else if(e.code==='Space'){
      e.preventDefault();dropBall();
    } else if(e.code==='Escape' && state==='targeting')cancelPower();
    else if(e.code==='KeyP'||e.code==='Escape')togglePause();
    else if(e.code==='KeyR')resetGame();
    else if(e.code==='KeyM')soundButton.click();
    else if(e.code==='Digit1')activatePower('hammer');
    else if(e.code==='Digit2')activatePower('swap');
    else if(e.code==='Digit3')activatePower('magnet');
    else if(e.code==='Digit4')activatePower('bomb');
  });
  document.querySelectorAll('[data-use]').forEach(button=>button.addEventListener('click',()=>activatePower(button.dataset.use)));
  document.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>buyPower(button.dataset.buy)));
  soundButton.addEventListener('click',()=>{
    soundEnabled=!soundEnabled;
    store('merge_mania_sound_v1',soundEnabled?'on':'off');
    updateSoundIcon();
    if(soundEnabled)tone(500,.1);
  });
  pauseButton.addEventListener('click',togglePause);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange',()=>{
    updateFullscreenButton();
    requestAnimationFrame(fitBoard);
  });
  modalPrimary.addEventListener('click',()=>state==='over'?resetGame():togglePause());
  modalSecondary.addEventListener('click',()=>{
    if(state==='over'){modal.classList.add('hidden');modalSecondary.classList.add('hidden');}
    else resetGame();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&state==='playing'&&totalDrops>0)togglePause();
  });
  window.addEventListener('resize',()=>{resizeCanvas();fitBoard();});
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(fitBoard).observe(gameArea);
  }
  function frame(now) {
    if(!lastFrameTime)lastFrameTime=now;
    const realDelta=clamp((now-lastFrameTime)/1000,0,.05);
    lastFrameTime=now;
    if(state==='playing'){
      accumulator+=realDelta;
      let steps=0;
      while(accumulator>=1/60&&steps<4){simulate(1/60);accumulator-=1/60;steps++;}
      advanceEffects(realDelta);
      if(combo>0&&performance.now()-lastMergeTime>3100){combo=0;updateHUD();}
    }
    draw();
    window.requestAnimationFrame(frame);
  }
  resizeCanvas();
  fitBoard();
  updateFullscreenButton();
  updateSoundIcon();
  resetGame();
  window.requestAnimationFrame(frame);
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
})();
