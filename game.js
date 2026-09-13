'use strict';
const $=id=>document.getElementById(id),R=BurgerRules,cv=$('scene'),ctx=cv.getContext('2d');
const ART={mayo:['assets/13-mayo.png',[76, 223, 1902, 668]],grilled:['assets/13-grilled-v2.png',[30, 146, 1744, 769]],crispy:['assets/13-crispy.png',[63, 276, 1490, 747]],bg:['assets/01-kitchen-background.png'],counter:['assets/02-wide-counter-v4.png'],paper:['assets/03-wrapper.png',[24,329,1649,747]],bottom:['assets/04-bottom-bun-v2.png',[34,513,1221,980]],patty:['assets/05-beef-patty.png',[67,447,1189,846]],cheese:['assets/06-cheese.png',[75,513,1179,793]],top:['assets/07-top-bun.png',[38,370,1216,927]],middle:['assets/08-middle-bun-v2.png',[28,467,1227,864]],lettuce:['assets/09-lettuce.png',[34,464,1220,818]],hold:['assets/10-hand-hold.png'],release:['assets/11-hand-release-v3.png'],idle:['assets/12-hand-idle-v3.png']};
const FOOD={crispy:{name:'麦辣鸡腿排',w:275,h:94,lift:48},grilled:{name:'板烧鸡腿排',w:280,h:85,lift:42},mayo:{name:'蛋黄酱',w:253,h:35,lift:13},patty:{name:'牛肉饼',w:256,h:77,lift:39},cheese:{name:'芝士',w:277,h:53,lift:17},lettuce:{name:'生菜',w:285,h:64,lift:29},middle:{name:'中层面包',w:260,h:70,lift:38},top:{name:'顶部面包',w:270,h:123,lift:60},bottom:{name:'底部面包',w:260,h:88,lift:47}};
let orderIndex=0,sessionScores=[],selectedDish=null,serveRequested=false;
const currentOrder=()=>R.ORDERS[orderIndex];
const score=()=>R.summarize(rows,elapsed,currentOrder().layers,selectedDish===currentOrder().id);
// Challenge tuning: smaller neutral zone and faster response, with light smoothing.
const deviceNav=window.navigator||{};
const MOBILE=!!deviceNav.userAgentData?.mobile||/Android|iPhone|iPad|iPod/i.test(deviceNav.userAgent||'')||(deviceNav.platform==='MacIntel'&&deviceNav.maxTouchPoints>1);
let sensorBusy=false,sensorWaitTimer,pendingSensorAction=null;
const GYRO={deadzone:.35,horizontalGain:27,verticalGain:18,response:30};
const choices=Object.keys(FOOD),imgs={},keys=new Set();let scale=1,ready=false,mode='intro',selection=null,elapsed=0,rows=[],stack=[],fall=null,settle=0,surface=690,previousX=800,hand={x:800,y:340},target={x:800,y:340},heldHeight=340,feedbackUntil=0,last=performance.now(),audioOn=true,audioCtx,gyroOn=false,lastSensor=null,neutral=null,sensorTime=0,dragging=false,toastTimer,feedback='';
function resize(){const width=document.documentElement?.clientWidth||innerWidth,height=document.documentElement?.clientHeight||innerHeight;scale=Math.min(width/1600,height/900);$('game').style.transform=`scale(${scale})`;$('game').style.left=(width-1600*scale)/2+'px';$('game').style.top=(height-900*scale)/2+'px';}
addEventListener('resize',resize);resize();
function art(c,type,x,y,w,h){const im=imgs[type];if(!im)return;const b=ART[type][1];if(b)c.drawImage(im,b[0],b[1],b[2]-b[0],b[3]-b[1],x-w/2,y,w,h);else c.drawImage(im,x-w/2,y,w,h);}
function toast(t){$('toast').textContent=t;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,3200);}
const bgm=typeof Audio!=='undefined'?new Audio('assets/audio/mcmc-kitchen-swing.wav'):null;
let duckTimer;
if(bgm){bgm.loop=true;bgm.preload='auto';bgm.volume=.48;}
function musicPlay(reset=false){if(!bgm)return;if(reset)bgm.currentTime=0;if(audioOn&&mode==='playing')bgm.play().catch(()=>{});}
function musicPause(){if(bgm)bgm.pause();}
function musicDuck(){if(!bgm)return;bgm.volume=.24;clearTimeout(duckTimer);duckTimer=setTimeout(()=>{bgm.volume=.48;},230);}
function beep(freq=620,duration=.09){if(!audioOn)return;musicDuck();try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioCtx.currentTime);g.gain.setValueAtTime(.065,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function recipeUI(){ $('orderName').textContent=currentOrder().name;$('orderProgress').textContent=`第 ${orderIndex+1} / 10 单`;$('speedTarget').textContent=`${currentOrder().layers.length*3} 秒内完成，速度满分`;$('queue').innerHTML=R.ORDERS.map((o,i)=>`<i class="${i<orderIndex?'done':i===orderIndex?'current':''}"></i>`).join('');$('recipe').innerHTML=currentOrder().layers.map((t,i)=>`<li class="${rows[i]?(rows[i].landed&&rows[i].type===t?'good':'bad'):i===rows.length?'current':''}"><span class="number">${i+1}</span>${FOOD[t].name}<em>${rows[i]?(rows[i].landed&&rows[i].type===t?'✓':'×'):i===rows.length?'下一层':''}</em></li>`).join('');}
function updateControls(){syncInputUI();const busy=mode!=='playing'||!!fall||settle>0||serveRequested||rows.length>=12; $('serve').disabled=mode!=='playing'||serveRequested;$('serveHint').textContent=serveRequested?'落稳后立即出餐':'随时提交本单';document.querySelectorAll('.dish-card').forEach(b=>{b.disabled=mode!=='playing'||serveRequested;b.classList.toggle('selected',b.dataset.dish===selectedDish);b.setAttribute('aria-pressed',String(b.dataset.dish===selectedDish));});$('dishLabel').textContent='菜品：'+(R.MENU.find(d=>d.id===selectedDish)?.name||'未选择');document.querySelectorAll('.ingredient').forEach(b=>{b.disabled=busy;b.classList.toggle('selected',b.dataset.type===selection);b.setAttribute('aria-pressed',String(b.dataset.type===selection));});$('drop').disabled=busy||!selection;$('dropHint').textContent=fall?'正在下落':settle>0?'食材落稳中':selection?FOOD[selection].name:'请先选食材';$('selectionLabel').textContent=selection?'手中：'+FOOD[selection].name:'先选料，再对准';}
function choose(t){if(mode!=='playing'||fall||settle>0||serveRequested||rows.length>=12)return;selection=t;const f=FOOD[t];target.y=R.clamp(target.y,170,surface-28);hand.y=R.clamp(hand.y,170,surface-28);beep(460,.045);updateControls();}
function start(){if(!ready)return;if(gateMobile(start))return;orderIndex=0;sessionScores=[];beginOrder();}
function beginOrder(){selectedDish=null;serveRequested=false;dragging=false;mode='playing';selection=null;elapsed=0;rows=[];stack=[];fall=null;settle=0;surface=690;previousX=800;hand={x:800,y:340};target={...hand};keys.clear();feedback='';$('overlay').hidden=true;$('resultOverlay').hidden=true;$('pauseOverlay').hidden=true;$('showResult').hidden=true;recipeUI();updateControls();musicPlay(true);beep();last=performance.now();}
function drop(){if(mode!=='playing'||!selection||fall||settle>0||serveRequested||rows.length>=12)return;const f=FOOD[selection],y=R.clamp(hand.y,170,surface-28);heldHeight=y;fall={type:selection,x:hand.x,from:y,y,age:0,target:surface,previousX,landed:Math.abs(hand.x-previousX)<=175};beep(390,.06);updateControls();}
function land(){const a=fall,f=FOOD[a.type],neat=a.landed?R.alignment(a.x,a.previousX):0;const correct=a.type===currentOrder().layers[rows.length];rows.push({type:a.type,landed:a.landed,alignment:neat,x:Math.round(a.x),height:Math.round(a.target-a.from),seconds:Math.round(elapsed*10)/10});if(a.landed){stack.push({type:a.type,x:a.x,y:surface-f.h*.72});surface-=f.lift;previousX=a.x;}
 feedback=!a.landed?'滑落了，这一层未落稳':!correct?'放错了！':neat>=95?'完美贴合！':neat>=75?'不错，继续出餐！':'有点歪啦，下层稳一点';feedbackUntil=elapsed+1.2;beep(!correct||!a.landed?220:neat>=95?950:650,.14);fall=null;selection=null;settle=.2;target.y=R.clamp(target.y,170,surface-28);recipeUI();updateControls();if(serveRequested)finish();else if(rows.length>=12)toast('操作台已满，请点击出餐');}
function serve(){if(mode!=='playing'||serveRequested)return;serveRequested=true;selection=null;if(fall){updateControls();return;}finish();}
function nextOrder(){if(mode!=='result')return;if(gateMobile(nextOrder))return;if(sessionScores.length===10){start();return;}orderIndex++;beginOrder();}
function finish(){if(mode!=='playing')return;mode='result';musicPause();keys.clear();fall=null;const s=score();sessionScores.push({...s,name:currentOrder().name});$('resultOverlay').hidden=false;$('total').textContent=s.total;$('resultTitle').textContent=s.landed<currentOrder().layers.length?'这单还差一点':s.total>=95?'金牌叠堡师！':s.total>=80?'漂亮出餐！':s.total>=60?'完成，再稳一点':'再练一单吧';$('resultMeta').textContent=`用时 ${elapsed.toFixed(1)} 秒，落稳 ${s.landed} / ${currentOrder().layers.length} 层，菜品：${R.MENU.find(d=>d.id===selectedDish)?.name||'未选择'}`;
 const done=sessionScores.length===10;
 const shown=done?Object.fromEntries(['total','accuracy','neat','speed'].map(k=>[k,Math.round(sessionScores.reduce((a,r)=>a+r[k],0)/10)])):s;
 $('total').textContent=shown.total;$('resultEyebrow').textContent=done?'十单挑战，全部完成':`第 ${orderIndex+1} / 10 单，已出餐`;
 if(done){$('resultTitle').textContent='十单出餐完成！';$('resultMeta').textContent=`总用时 ${sessionScores.reduce((a,r)=>a+r.seconds,0).toFixed(1)} 秒，以下为 10 单平均成绩`;}
 $('again').textContent=done?'再挑战 10 单':'下一单 → '+R.ORDERS[orderIndex+1].name;
 $('scoreDetails').innerHTML=[['出餐准确度',shown.accuracy,'40%','菜品选择＋食材种类、数量与顺序'],['形态规整度',shown.neat,'40%','层间对齐＋整体居中，漏层与滑落扣分'],['出餐速度',shown.speed,'20%','每层目标 3 秒；缺层降低速度得分']].map(([n,v,w,d])=>`<div class="score-row">${n}<b>${v}<small>权重 ${w}</small></b><small>${d}</small><div class="score-track"><i style="width:${v}%"></i></div></div>`).join('');
 $('roundLog').innerHTML=Array.from({length:Math.max(rows.length,currentOrder().layers.length)},(_,i)=>{const t=currentOrder().layers[i],r=rows[i];return `第 ${i+1} 层：应放 ${t?FOOD[t].name:'无（多放）'} → ${r?FOOD[r.type].name+'，'+(!r.landed?'滑落':r.type===t?'正确':'放错了！')+'，规整 '+r.alignment+' 分':'未放置'}`;}).join('<br>');
 $('sessionLog').innerHTML=sessionScores.map((r,i)=>`第 ${i+1} 单，${r.name}，${r.total} 分，${r.seconds.toFixed(1)} 秒`).join('<br>');
 const c=$('resultBurger').getContext('2d');c.clearRect(0,0,400,400);c.save();const topY=Math.min(643,...stack.map(a=>a.y)),leftX=Math.min(550,...stack.map(a=>a.x-160)),rightX=Math.max(1050,...stack.map(a=>a.x+160));const fit=Math.min(360/(rightX-leftX),350/(765-topY));c.translate(200-(leftX+rightX)/2*fit,375-765*fit);c.scale(fit,fit);art(c,'paper',800,682,460,115);art(c,'bottom',800,660,260,90);stack.forEach(a=>{const f=FOOD[a.type];art(c,a.type,a.x,a.y,f.w,f.h)});c.restore();updateControls();beep(1050,.25);}
function pause(){if(mode!=='playing')return;mode='paused';musicPause();keys.clear();$('pauseOverlay').hidden=false;updateControls();}
function resume(){if(mode!=='paused')return;if(gateMobile(resume))return;mode='playing';keys.clear();last=performance.now();$('pauseOverlay').hidden=true;musicPlay();updateControls();}
function syncInputUI(){
 $('controlHint').hidden=MOBILE||gyroOn||mode!=='playing';
 $('start').hidden=MOBILE;$('startGyro').textContent=MOBILE?'开启体感，开始挑战':'体感模式开始';
 $('inputHelp').textContent=MOBILE?'手机横屏，倾斜控制手的位置，点击选择食材和出餐':'电脑可拖动或使用方向键＋空格';
 $('gyro').textContent=MOBILE?(gyroOn?'体感已开启':'开启体感'):(gyroOn?'切换触控':'开启体感');
 $('game').classList.toggle('mobile-gyro',MOBILE);
}
function sensorFresh(){return gyroOn&&lastSensor&&performance.now()-sensorTime<3500;}
function gateMobile(action){if(!MOBILE||sensorFresh())return false;enableGyro(action);return true;}
function sensorFailure(message){
 clearTimeout(sensorWaitTimer);sensorBusy=false;gyroOn=false;lastSensor=null;
 if(MOBILE){if(mode==='playing'){pause();pendingSensorAction=resume;}$('sensorOverlay').hidden=false;$('sensorMessage').textContent=message;$('sensorRetry').disabled=false;syncInputUI();}
 else{pendingSensorAction=null;switchToTouch(message+'，可使用拖动操作');}
}
function switchToTouch(msg){if(MOBILE){sensorFailure('体感信号中断，请保持横屏后重新开启。');return;}gyroOn=false;$('inputName').textContent='拖动 / 方向键';syncInputUI();if(msg)toast(msg);}
function calibrate(){if(!lastSensor){if(MOBILE)enableGyro();else toast('还未收到体感数据，可先用拖动操作');return;}neutral={...lastSensor};target={x:800,y:R.clamp(surface-155,170,surface-28)};hand={...target};toast('已校准，轻轻倾斜即可移动');}
async function enableGyro(action=null){
 if(sensorBusy)return;
 if(action)pendingSensorAction=action;
 if(sensorFresh()){if(action){pendingSensorAction=null;action();}else if(MOBILE)calibrate();else switchToTouch('已切换为拖动操作');return;}
 if(!isSecureContext){sensorFailure('请使用 HTTPS 网址开启体感。');return;}
 if(!window.DeviceOrientationEvent){sensorFailure('此浏览器不支持体感，请用手机 Safari 或 Chrome 打开。');return;}
 sensorBusy=true;
 if(MOBILE){$('sensorOverlay').hidden=false;$('sensorMessage').textContent='请允许运动与方向权限，保持横屏握姿，正在连接体感…';$('sensorRetry').disabled=true;}
 try{
  if(typeof DeviceOrientationEvent.requestPermission==='function'){const permission=await DeviceOrientationEvent.requestPermission();if(permission!=='granted'){sensorFailure('未获得体感权限，请在浏览器设置中允许运动与方向访问后重试。');return;}}
  gyroOn=true;neutral=null;lastSensor=null;sensorTime=performance.now();syncInputUI();
  sensorWaitTimer=setTimeout(()=>{if(!lastSensor)sensorFailure('未收到体感数据，请检查浏览器权限后重试。');},4000);
 }catch{sensorFailure('无法开启体感，请检查浏览器权限后重试。');}
}
$('sensorRetry').onclick=()=>enableGyro(pendingSensorAction|| (mode==='paused'?resume:mode==='result'?nextOrder:start));
addEventListener('deviceorientation',e=>{if(!gyroOn||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;const angle=screen.orientation?.angle??window.orientation??0;lastSensor=R.tilt(e.beta,e.gamma,angle);sensorTime=performance.now();sensorBusy=false;clearTimeout(sensorWaitTimer);$('sensorOverlay').hidden=true;if(!neutral){neutral={...lastSensor};toast('校准完成，轻轻倾斜手机试试');}if(pendingSensorAction){const action=pendingSensorAction;pendingSensorAction=null;action();}if(mode!=='playing'||fall)return;const dead=n=>Math.abs(n)<=GYRO.deadzone?0:n-Math.sign(n)*GYRO.deadzone;target.x=R.clamp(800+dead(lastSensor.x-neutral.x)*GYRO.horizontalGain,410,1190);target.y=R.clamp(surface-155+dead(lastSensor.y-neutral.y)*GYRO.verticalGain,170,surface-28);});
screen.orientation?.addEventListener('change',()=>{if(gyroOn){neutral=null;pause();toast('横屏方向已改变，继续后将重新校准');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('blur',()=>{keys.clear();pause();});
function point(e){const b=cv.getBoundingClientRect();return {x:(e.clientX-b.left)/scale,y:(e.clientY-b.top)/scale};}
cv.addEventListener('pointerdown',e=>{if(MOBILE)return;if(mode!=='playing'||fall)return;if(gyroOn)switchToTouch();dragging=true;cv.setPointerCapture(e.pointerId);const p=point(e);target={x:R.clamp(p.x,410,1190),y:R.clamp(p.y,170,surface-28)};});cv.addEventListener('pointermove',e=>{if(MOBILE)return;if(!dragging||mode!=='playing'||fall)return;const p=point(e);target={x:R.clamp(p.x,410,1190),y:R.clamp(p.y,170,surface-28)};});cv.addEventListener('pointerup',()=>dragging=false);cv.addEventListener('pointercancel',()=>dragging=false);
addEventListener('keydown',e=>{if(MOBILE)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'){mode==='playing'?pause():resume();return;}if(mode!=='playing')return;if(e.key===' '&&!e.repeat)drop();if(e.key==='Enter'&&!e.repeat)serve();if(/^[1-9]$/.test(e.key))choose(choices[Number(e.key)-1]);keys.add(e.key);});addEventListener('keyup',e=>keys.delete(e.key));
function draw(){ctx.clearRect(0,0,1600,900);art(ctx,'bg',800,0,1600,900);art(ctx,'counter',800,490,1600,410);ctx.fillStyle='#63320a20';ctx.beginPath();ctx.ellipse(800,728,215,30,0,0,Math.PI*2);ctx.fill();art(ctx,'paper',800,643,500,112);art(ctx,'bottom',800,660,260,90);stack.forEach(a=>{const f=FOOD[a.type];art(ctx,a.type,a.x,a.y,f.w,f.h)});
 if(mode==='playing'||mode==='paused'||mode==='intro'){const x=fall?fall.x:hand.x,y=fall?heldHeight:hand.y;const f=FOOD[selection||fall?.type||'patty'];if(selection&&!fall){ctx.setLineDash([6,12]);ctx.strokeStyle='#96612477';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,surface);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#71492033';ctx.beginPath();ctx.ellipse(x,surface+9,65,11,0,0,Math.PI*2);ctx.fill();}
 // Keep the same full-canvas transform across hand poses; sleeve extends beyond the screen.
 art(ctx,fall?'release':selection?'hold':'idle',x-4,y-560,455,568);
 if(fall){const a=fall;art(ctx,a.type,a.x,a.y-FOOD[a.type].h*.72,FOOD[a.type].w,FOOD[a.type].h);}else if(selection)art(ctx,selection,x,y-f.h*.72,f.w,f.h);
 }
}
let hudTick=0;
function frame(now){const raw=Math.max(0,(now-last)/1000),dt=Math.min(raw,.05);last=now;if(mode==='playing'&&raw>1.5){pause();toast('画面中断，已自动暂停');}if(mode==='playing'){if(elapsed+raw>=60){elapsed=60;finish();draw();requestAnimationFrame(frame);return;}elapsed+=raw;if(gyroOn&&lastSensor&&now-sensorTime>3500){sensorFailure('体感信号中断，请保持横屏后重新开启。');if(MOBILE){draw();requestAnimationFrame(frame);return;}}if(!fall){const dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);target.x=R.clamp(target.x+dx*330*dt,410,1190);target.y=R.clamp(target.y+dy*260*dt,170,surface-28);const smooth=1-Math.exp(-dt*(gyroOn?GYRO.response:18));hand.x+=(target.x-hand.x)*smooth;hand.y+=(target.y-hand.y)*smooth;}
 if(fall){fall.age+=dt;fall.y=fall.from+.5*900*fall.age*fall.age;if(fall.y>=fall.target){if(fall.landed||fall.y>800){land();} }}
 if(settle>0){settle=Math.max(0,settle-dt);if(!settle)updateControls();}if(elapsed>=60&&mode==='playing'){elapsed=60;finish();}}
 if(now-hudTick>80){hudTick=now;$('time').innerHTML=elapsed.toFixed(1)+'<small> 秒</small>';$('timebar').style.width=100*(1-elapsed/60)+'%';$('layers').textContent=rows.length+' / '+currentOrder().layers.length;$('orderScore').textContent=score().accuracy+' 分';$('neatScore').textContent=rows.length?score().neat+' 分':'—';const gap=surface-hand.y;$('heightbar').style.width=R.clamp(gap/350*100,0,100)+'%';$('heightText').textContent=gap<75?'低位':gap<180?'中位':'高位';$('feedback').textContent=mode==='playing'&&elapsed<feedbackUntil?feedback:'';}
 if(ready)draw();requestAnimationFrame(frame);}
$('start').onclick=start;$('startGyro').onclick=()=>enableGyro(start);$('gyro').onclick=()=>enableGyro();$('calibrate').onclick=calibrate;$('drop').onclick=drop;$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=start;$('again').onclick=nextOrder;$('serve').onclick=serve;$('inspect').onclick=()=>{$('resultOverlay').hidden=true;$('showResult').hidden=false;};$('showResult').onclick=()=>{$('resultOverlay').hidden=false;$('showResult').hidden=true;};$('sound').onclick=()=>{audioOn=!audioOn;if(audioOn)musicPlay();else musicPause();$('sound').textContent='声音 '+(audioOn?'开':'关');$('sound').setAttribute('aria-label',audioOn?'关闭声音':'开启声音');};
Promise.all(Object.entries(ART).map(([k,[url]])=>new Promise((resolve,reject)=>{const im=new Image;im.onload=()=>{imgs[k]=im;resolve();};im.onerror=()=>reject(Error(url));im.src=url;}))).then(()=>{ready=true;$('loadStatus').textContent='食材准备就绪，共 10 单，每单最多 60 秒';$('start').disabled=false;$('startGyro').disabled=false;choices.forEach((t,i)=>{const b=document.createElement('button');b.className='ingredient';b.dataset.type=t;b.setAttribute('aria-label','选择'+FOOD[t].name);b.innerHTML=`<kbd>${i+1}</kbd><canvas width="190" height="92"></canvas><span>${FOOD[t].name}</span>`;b.onclick=()=>choose(t);$('ingredients').append(b);const c=b.querySelector('canvas').getContext('2d'),f=FOOD[t];art(c,t,95,(92-f.h*.55)/2,150,f.h*.55);});buildDishes();recipeUI();updateControls();}).catch(e=>{$('loadStatus').textContent='素材加载失败，请刷新重试：'+e.message;});requestAnimationFrame(frame);

function chooseDish(id){if(mode!=='playing'||serveRequested)return;selectedDish=id;updateControls();beep(520,.05);}
function trayTab(dishes){$('ingredients').hidden=dishes;$('dishes').hidden=!dishes;$('foodTab').classList.toggle('active',!dishes);$('dishTab').classList.toggle('active',dishes);}
$('foodTab').onclick=()=>trayTab(false);$('dishTab').onclick=()=>trayTab(true);
function buildDishes(){R.MENU.forEach(d=>{const b=document.createElement('button');b.className='dish-card';b.dataset.dish=d.id;b.innerHTML=`<canvas width="160" height="120"></canvas><span>${d.name}</span>`;b.onclick=()=>chooseDish(d.id);$('dishes').append(b);const c=b.querySelector('canvas').getContext('2d');let y=100;art(c,'bottom',80,95,100,30);d.layers.forEach(t=>{const f=FOOD[t];art(c,t,80,y-f.h*.28,f.w*.38,f.h*.38);y-=f.lift*.38;});});}

syncInputUI();
