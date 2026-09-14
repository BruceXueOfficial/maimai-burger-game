'use strict';
const $=id=>document.getElementById(id),R=BurgerRules,cv=$('scene'),ctx=cv.getContext('2d'),handCv=$('handScene'),handCtx=handCv.getContext('2d');
const CUSTOMERS=[
 {id:'courier',name:'骑手大哥',image:'assets/customers/courier.png'},
 {id:'student',name:'学生小哥',image:'assets/customers/student.png'},
 {id:'woman',name:'职场女士',image:'assets/customers/woman.png'},
 {id:'office',name:'上班族小哥',image:'assets/customers/office.png'},
 {id:'traveler',name:'金发旅人',image:'assets/customers/traveler.png'}
];
function customerMood(total){return total>=80?'happy':total>=60?'neutral':'angry';}
function assignCustomer(total){return {customerIndex:Math.floor(Math.random()*CUSTOMERS.length),mood:customerMood(total)};}
const MOOD_LABEL={happy:'开心',neutral:'普通',angry:'愤怒'};
function portraitStyle(r){return `background-image:url('${CUSTOMERS[r.customerIndex].image}');background-position:${r.mood==='happy'?0:r.mood==='neutral'?50:100}% 50%`;}
function selectCustomerReview(index){
 const r=sessionScores[index];if(!r)return;
 const customer=CUSTOMERS[r.customerIndex],portrait=$('customerPortrait');
 portrait.style.backgroundImage=`url('${customer.image}')`;
 portrait.style.backgroundPosition=`${r.mood==='happy'?0:r.mood==='neutral'?50:100}% 50%`;
 portrait.setAttribute('aria-label',`${customer.name}，${MOOD_LABEL[r.mood]}`);
 $('customerMood').textContent=MOOD_LABEL[r.mood];
 $('customerReview').textContent=`第 ${index+1} 单 ${customer.name}，${r.total} 分`;
 $('customerQuote').textContent=r.incident?'这份食材不新鲜，请认真检查！':r.mood==='happy'?'做得漂亮，下次还来！':r.mood==='neutral'?'还不错，再快一点就更好了。':'这份汉堡还需要好好改进。';
 $('customerStage').dataset.mood=r.mood;
 Array.from($('sessionLog').children).forEach((el,i)=>{el.classList.toggle('active',i===index);el.setAttribute('aria-pressed',String(i===index));});
}
const ART={mayo:['assets/13-mayo.png',[76, 223, 1902, 668]],grilled:['assets/13-grilled-v2.png',[30, 146, 1744, 769]],crispy:['assets/13-crispy.png',[63, 276, 1490, 747]],bg:['assets/01-kitchen-background.png'],counter:['assets/02-wide-counter-v4.png'],paper:['assets/03-wrapper.png',[24,329,1649,747]],bottom:['assets/04-bottom-bun-v2.png',[34,513,1221,980]],patty:['assets/05-beef-patty.png',[67,447,1189,846]],cheese:['assets/06-cheese.png',[75,513,1179,793]],top:['assets/07-top-bun.png',[38,370,1216,927]],middle:['assets/08-middle-bun-v2.png',[28,467,1227,864]],lettuce:['assets/09-lettuce.png',[34,464,1220,818]],hold:['assets/10-hand-hold.png'],release:['assets/11-hand-release-v3.png'],idle:['assets/12-hand-idle-v3.png']};
ART.spoiledGrilled=['assets/14-spoiled-grilled.png',[20,230,1516,790]];ART.spoiledCrispy=['assets/14-spoiled-crispy.png',[20,230,1516,790]];ART.spoiledMayo=['assets/14-spoiled-mayo.png',[20,300,1516,720]];
const FOOD={crispy:{name:'麦辣鸡腿排',w:275,h:94,lift:48},grilled:{name:'板烧鸡腿排',w:280,h:85,lift:42},mayo:{name:'蛋黄酱',w:253,h:35,lift:13},patty:{name:'牛肉饼',w:256,h:77,lift:39},cheese:{name:'芝士',w:277,h:53,lift:17},lettuce:{name:'生菜',w:285,h:64,lift:29},middle:{name:'中层面包',w:260,h:70,lift:38},top:{name:'顶部面包',w:270,h:123,lift:60},bottom:{name:'底部面包',w:260,h:88,lift:47}};
for(const [type,base] of [['spoiledGrilled','grilled'],['spoiledCrispy','crispy'],['spoiledMayo','mayo']])FOOD[type]={...FOOD[base],base,spoiled:true};
// Difficulty knobs: normal recipe ingredients always remain available.
const CHALLENGE={badChance:.65,twoBadChance:.25,pickupBand:18,pickupWidth:.38,workHalfWidth:175};
let discarded=0,orderReadyAt=0;
let orderIndex=0,sessionScores=[],serveRequested=false,hoveredIngredient=null,ingredientZones=[];
const currentOrder=()=>R.ORDERS[orderIndex];
const score=()=>R.summarize(rows.map(r=>({...r,type:FOOD[r.type].base||r.type,spoiled:!!FOOD[r.type].spoiled})),elapsed,currentOrder().layers);
// Challenge tuning: smaller neutral zone and faster response, with light smoothing.
const deviceNav=window.navigator||{};
const MOBILE=!!deviceNav.userAgentData?.mobile||/Android|iPhone|iPad|iPod/i.test(deviceNav.userAgent||'')||(deviceNav.platform==='MacIntel'&&deviceNav.maxTouchPoints>1);
let sensorBusy=false,sensorWaitTimer,pendingSensorAction=null;
const GYRO={deadzone:.15,horizontalGain:48,verticalGain:32,spring:110,damping:8,maxSpeed:1200};
let gyroVelocity={x:0,y:0};
function resetInertia(){gyroVelocity={x:0,y:0};}
// Substeps keep the underdamped response consistent across screen refresh rates.
function moveGyro(dt){const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;for(let i=0;i<steps;i++){for(const axis of ['x','y']){gyroVelocity[axis]=R.clamp(gyroVelocity[axis]+((target[axis]-hand[axis])*GYRO.spring-gyroVelocity[axis]*GYRO.damping)*h,-GYRO.maxSpeed,GYRO.maxSpeed);hand[axis]+=gyroVelocity[axis]*h;const lo=axis==='x'?handLimits().left:170,hi=axis==='x'?handLimits().right:860,bounded=R.clamp(hand[axis],lo,hi);if(bounded!==hand[axis]){hand[axis]=bounded;gyroVelocity[axis]=0;}}}}
const choices=Object.keys(FOOD).filter(t=>!FOOD[t].spoiled),imgs={},keys=new Set();let scale=1,stageWidth=1600,ready=false,mode='intro',selection=null,elapsed=0,rows=[],stack=[],fall=null,settle=0,surface=690,previousX=800,hand={x:800,y:340},target={x:800,y:340},heldHeight=340,feedbackUntil=0,last=performance.now(),audioOn=true,audioCtx,gyroOn=false,lastSensor=null,neutral=null,sensorTime=0,dragging=false,toastTimer,feedback='';
function resize(){const viewport=window.visualViewport;const width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;scale=Math.min(width/1600,height/900);stageWidth=Math.max(1600,width/scale);cv.width=Math.round(stageWidth);handCv.width=Math.round(stageWidth);$('game').style.width=stageWidth+'px';$('game').style.transform=`scale(${scale})`;$('game').style.left=(viewport?.offsetLeft||0)+'px';$('game').style.top=((viewport?.offsetTop||0)+(height-900*scale)/2)+'px';refreshIngredientZones();}
addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);addEventListener('orientationchange',()=>{resize();setTimeout(resize,250);setTimeout(resize,700);});resize();
function art(c,type,x,y,w,h){const im=imgs[type];if(!im)return;const b=ART[type][1];if(b)c.drawImage(im,b[0],b[1],b[2]-b[0],b[3]-b[1],x-w/2,y,w,h);else c.drawImage(im,x-w/2,y,w,h);}
function toast(t){$('toast').textContent=t;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,3200);}
const bgm=typeof Audio!=='undefined'?new Audio('assets/audio/mcmc-kitchen-swing.wav'):null;
let duckTimer;
if(bgm){bgm.loop=true;bgm.preload='auto';bgm.volume=.48;}
function musicPlay(reset=false){if(!bgm)return;if(reset)bgm.currentTime=0;if(audioOn&&mode==='playing')bgm.play().catch(()=>{});}
function musicPause(){if(bgm)bgm.pause();}
function musicDuck(){if(!bgm)return;bgm.volume=.24;clearTimeout(duckTimer);duckTimer=setTimeout(()=>{bgm.volume=.48;},230);}
function beep(freq=620,duration=.09){if(!audioOn)return;musicDuck();try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioCtx.currentTime);g.gain.setValueAtTime(.065,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function recipeUI(){ $('orderName').textContent=currentOrder().name;$('orderProgress').textContent=`第 ${orderIndex+1} / 10 单`;$('speedTarget').textContent=`${currentOrder().layers.length*3} 秒内速度满分`;$('queue').innerHTML=R.ORDERS.map((o,i)=>`<i class="${i<orderIndex?'done':i===orderIndex?'current':''}"></i>`).join('');$('recipe').innerHTML=currentOrder().layers.map((t,i)=>`<li><span class="number">${i+1}</span>${FOOD[t].name}</li>`).join('');}
function handLimits(){const offset=(stageWidth-1600)/2;return {left:30-offset,right:stageWidth-30-offset};}
function refreshIngredientZones(){const bounds=cv.getBoundingClientRect(),offset=(stageWidth-1600)/2;ingredientZones=Array.from(document.querySelectorAll('.ingredient')).map(b=>{const r=b.getBoundingClientRect();return {type:b.dataset.type,left:(r.left-bounds.left)/scale-offset,right:(r.left+r.width-bounds.left)/scale-offset,top:(r.top-bounds.top)/scale,bottom:(r.top+r.height-bounds.top)/scale};});}
function ingredientAtHand(){return ingredientZones.find(z=>hand.x>=z.left&&hand.x<=z.right&&hand.y>=z.top&&hand.y<=z.bottom)?.type||null;}
function topAtHand(){
 if(selection||fall||!stack.length||mode!=='playing'||settle>0||serveRequested)return null;
 const top=stack[stack.length-1],f=FOOD[top.type];
 return Math.abs(hand.x-top.x)<=f.w*CHALLENGE.pickupWidth&&hand.y>=top.y-7&&hand.y<=top.y+Math.min(CHALLENGE.pickupBand,f.h*.28)?top:null;
}
function outsideWorkArea(){return Math.abs(hand.x-800)>CHALLENGE.workHalfWidth||hand.y>735;}
function updateControls(){syncInputUI();hoveredIngredient=mode==='playing'&&!fall&&!selection?ingredientAtHand():null;
 const busy=mode!=='playing'||performance.now()<orderReadyAt||!!fall||settle>0||serveRequested,top=topAtHand();
 $('serve').disabled=mode!=='playing'||performance.now()<orderReadyAt||serveRequested;$('serveHint').textContent=serveRequested?'落稳后立即出餐':'随时出餐';
 document.querySelectorAll('.ingredient').forEach(b=>{b.classList.toggle('hovered',!busy&&b.dataset.type===hoveredIngredient);b.classList.toggle('selected',b.dataset.type===selection);});
 const grabbing=!!hoveredIngredient&&!selection,canDrop=!!selection&&(outsideWorkArea()||hand.y<=surface-28)&&stack.length<12;
 $('drop').disabled=busy||(!top&&!grabbing&&!canDrop);$('drop').classList.toggle('grabbing',grabbing);$('drop').classList.toggle('picking-up',!!top);$('drop').classList.toggle('discarding',!!selection&&outsideWorkArea());$('dropLabel').textContent=top?'拿起':grabbing?'抓取':'放下';
 $('dropHint').textContent=fall?'正在下落':settle>0?'食材落稳中':top?'最上层食材':grabbing?FOOD[hoveredIngredient].name:selection?(outsideWorkArea()?'松手扔掉':canDrop?FOOD[selection].name:'移到汉堡上方'):'先移到原料上';
 $('selectionLabel').textContent='';
}
function grabOrDrop(){
 if(mode!=='playing'||performance.now()<orderReadyAt||fall||settle>0||serveRequested)return;
 if(selection){drop();return;}
 const top=topAtHand();
 if(top){stack.pop();rows.pop();surface=top.surfaceBefore;previousX=stack.length?stack[stack.length-1].x:800;selection=top.type;resetInertia();beep(520,.08);updateControls();return;}
 const over=ingredientAtHand();if(over&&stack.length<12){selection=over;resetInertia();beep(460,.08);updateControls();}
}
function randomizeTray(){
 let list=[...choices];const bad=['spoiledGrilled','spoiledCrispy','spoiledMayo'].sort(()=>Math.random()-.5);
 if(Math.random()<CHALLENGE.badChance){list[list.indexOf('bottom')]=bad[0];if(Math.random()<CHALLENGE.twoBadChance)list[list.indexOf('middle')]=bad[1];}
 for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
 const old=Array.from(document.querySelectorAll('.ingredient')).map(b=>b.dataset.type).join(',');if(list.join(',')===old)list.push(list.shift());
 $('ingredients').innerHTML='';
 list.forEach(t=>{const b=document.createElement('div');b.className='ingredient';b.dataset.type=t;b.setAttribute('role','img');b.setAttribute('aria-label',FOOD[t].name+(FOOD[t].spoiled?'，有变质迹象':''));b.innerHTML=`<canvas width="190" height="92"></canvas><span>${FOOD[t].name}</span>`;$('ingredients').append(b);const c=b.querySelector('canvas').getContext('2d'),f=FOOD[t];art(c,t,95,(92-f.h*.55)/2,150,f.h*.55);});
 refreshIngredientZones();
}
const storyEmbedded=!!window.location && new URLSearchParams(window.location.search).get('embedded')==='1' && window.parent!==window;
let rewardPending=false;
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='burger-reward-saved'){rewardPending=false;$('again').disabled=false;}});
function start(){if(rewardPending)return;if(!ready)return;if(gateMobile(start))return;if(storyEmbedded)window.parent.postMessage({type:'burger-start'},location.origin);orderIndex=0;sessionScores=[];beginOrder();}
function beginOrder(){orderReadyAt=performance.now()+(orderIndex?400:0);resetInertia();discarded=0;hoveredIngredient=null;serveRequested=false;dragging=false;mode='playing';selection=null;elapsed=0;rows=[];stack=[];fall=null;settle=0;surface=690;previousX=800;hand={x:800,y:340};target={...hand};keys.clear();feedback='';$('overlay').hidden=true;$('resultOverlay').hidden=true;$('pauseOverlay').hidden=true;$('showResult').hidden=true;recipeUI();randomizeTray();updateControls();musicPlay(orderIndex===0);beep();last=performance.now();}
function drop(){
 if(mode!=='playing'||!selection||fall||settle>0||serveRequested||stack.length>=12)return;
 const outside=outsideWorkArea();if(!outside&&hand.y>surface-28)return;
 const landed=!outside&&Math.abs(hand.x-previousX)<=175,y=hand.y;heldHeight=y;resetInertia();
 fall={type:selection,x:hand.x,from:y,y,age:0,target:landed?surface:1000,previousX,landed};beep(390,.06);updateControls();
}
function land(){const a=fall,f=FOOD[a.type];
 if(a.landed){rows.push({type:a.type,landed:true,alignment:R.alignment(a.x,a.previousX),x:Math.round(a.x),height:Math.round(a.target-a.from),seconds:Math.round(elapsed*10)/10});stack.push({type:a.type,x:a.x,y:surface-f.h*.72,surfaceBefore:surface});surface-=f.lift;previousX=a.x;}else discarded++;
 feedback='';feedbackUntil=0;beep(650,.14);fall=null;selection=null;settle=.2;randomizeTray();updateControls();if(serveRequested)finish();else if(stack.length>=12)toast('操作台已满，可拿起返工或出餐');}
function serve(){if(mode!=='playing'||performance.now()<orderReadyAt||serveRequested)return;serveRequested=true;selection=null;if(fall){updateControls();return;}finish();}
function nextOrder(){if(mode!=='result')return;if(gateMobile(nextOrder))return;if(sessionScores.length===10){start();return;}orderIndex++;beginOrder();}
function finish(){
 if(mode!=='playing')return;
 const s=score(),number=orderIndex+1;sessionScores.push({...s,...assignCustomer(s.total),name:currentOrder().name,discarded});keys.clear();fall=null;selection=null;
 if(sessionScores.length<10){
  orderIndex++;beginOrder();
  if(s.incident){$('toast').classList.add('incident-toast');toast(`顾客生气了！第 ${number} 单含变质食材，食品安全事故，本单 0 分`);}else{$('toast').classList.remove('incident-toast');toast(`第 ${number} 单已出餐，${s.total} 分`);}
  return;
 }
 mode='result';musicPause();clearTimeout(toastTimer);$('toast').style.opacity=0;$('resultOverlay').hidden=false;
 if(storyEmbedded){rewardPending=true;$('again').disabled=true;window.parent.postMessage({type:'burger-complete',scores:sessionScores.map(r=>r.total)},location.origin);}
 const shown=Object.fromEntries(['total','accuracy','neat','speed'].map(k=>[k,Math.round(sessionScores.reduce((a,r)=>a+r[k],0)/10)])),incidents=sessionScores.filter(r=>r.incident).length;
 $('total').textContent=shown.total;$('resultEyebrow').textContent='十单挑战，全部完成';$('resultTitle').textContent=incidents?'食品安全事故！':'十单出餐完成！';
 $('resultOverlay').classList.toggle('food-incident',incidents>0);
 $('safetyReport').hidden=!incidents;$('safetyReport').innerHTML=incidents?`<span class="angry-customer" aria-label="生气的顾客">😠</span><div><strong>顾客很生气！</strong><p>${incidents} 单送出了变质食材，相关订单记 0 分。</p></div>`:'';
 $('resultMeta').textContent=`总用时 ${sessionScores.reduce((a,r)=>a+r.seconds,0).toFixed(1)} 秒，平均 ${shown.total} 分`;
 $('again').textContent='再挑战 10 单';
 $('scoreDetails').innerHTML=[['出餐准确度',shown.accuracy,'40%'],['形态规整度',shown.neat,'40%'],['出餐速度',shown.speed,'20%']].map(([n,v,w])=>`<div class="score-row">${n}<b>${v}<small>权重 ${w}</small></b><div class="score-track"><i style="width:${v}%"></i></div></div>`).join('');
 $('roundLog').innerHTML='';
 $('sessionLog').innerHTML=sessionScores.map((r,i)=>`<button type="button" data-review="${i}" class="order-result${r.incident?' unsafe':''}" aria-pressed="false"><span class="customer-thumb" style="${portraitStyle(r)}" aria-hidden="true"></span><span class="order-result-copy"><span>第 ${i+1} 单 ${CUSTOMERS[r.customerIndex].name}</span><strong>${r.name}</strong><small>${r.incident?'食品安全事故':r.seconds.toFixed(1)+' 秒'}，${MOOD_LABEL[r.mood]}</small></span><b>${r.total} 分</b></button>`).join('');
 selectCustomerReview(0);

 const c=$('resultBurger').getContext('2d');c.clearRect(0,0,400,400);c.save();const topY=Math.min(643,...stack.map(a=>a.y)),leftX=Math.min(550,...stack.map(a=>a.x-160)),rightX=Math.max(1050,...stack.map(a=>a.x+160));const fit=Math.min(360/(rightX-leftX),350/(765-topY));c.translate(200-(leftX+rightX)/2*fit,375-765*fit);c.scale(fit,fit);art(c,'paper',800,682,460,115);art(c,'bottom',800,660,260,90);stack.forEach(a=>{const f=FOOD[a.type];art(c,a.type,a.x,a.y,f.w,f.h)});c.restore();updateControls();beep(incidents?180:1050,.25);
}
function pause(){if(mode!=='playing')return;mode='paused';resetInertia();musicPause();keys.clear();$('pauseOverlay').hidden=false;updateControls();}
function resume(){if(mode!=='paused')return;if(gateMobile(resume))return;mode='playing';keys.clear();last=performance.now();$('pauseOverlay').hidden=true;musicPlay();updateControls();}
function syncInputUI(){
 $('controlHint').hidden=true;$('gyro').hidden=MOBILE;$('calibrate').hidden=MOBILE;
 $('start').hidden=MOBILE;$('startGyro').textContent=MOBILE?'开启体感，开始挑战':'体感模式开始';
 $('inputHelp').textContent=MOBILE?'手机横屏，倾斜移动手，点击抓取、放下和出餐':'电脑拖动或方向键移动手，空格抓取或放下';
 $('gyro').textContent=MOBILE?(gyroOn?'体感已开启':'开启体感'):(gyroOn?'切换触控':'开启体感');
 $('game').classList.toggle('mobile-gyro',MOBILE);
}
function sensorFresh(){return gyroOn&&lastSensor&&performance.now()-sensorTime<3500;}
function gateMobile(action){if(!MOBILE||sensorFresh())return false;enableGyro(action);return true;}
function sensorFailure(message){resetInertia();
 clearTimeout(sensorWaitTimer);sensorBusy=false;gyroOn=false;lastSensor=null;
 if(MOBILE){if(mode==='playing'){pause();pendingSensorAction=resume;}$('sensorOverlay').hidden=false;$('sensorMessage').textContent=message;$('sensorRetry').disabled=false;syncInputUI();}
 else{pendingSensorAction=null;switchToTouch(message+'，可使用拖动操作');}
}
function switchToTouch(msg){if(MOBILE){sensorFailure('体感信号中断，请保持横屏后重新开启。');return;}gyroOn=false;resetInertia();$('inputName').textContent='拖动 / 方向键';syncInputUI();if(msg)toast(msg);}
function calibrate(){if(!lastSensor){if(MOBILE)enableGyro();else toast('还未收到体感数据，可先用拖动操作');return;}resetInertia();neutral={...lastSensor};target={x:800,y:R.clamp(surface-155,170,surface-28)};hand={...target};toast('已校准，轻轻倾斜即可移动');}
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
addEventListener('deviceorientation',e=>{if(!gyroOn||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;const angle=screen.orientation?.angle??window.orientation??0;lastSensor=R.tilt(e.beta,e.gamma,angle);sensorTime=performance.now();sensorBusy=false;clearTimeout(sensorWaitTimer);$('sensorOverlay').hidden=true;if(!neutral){neutral={...lastSensor};}if(pendingSensorAction){const action=pendingSensorAction;pendingSensorAction=null;action();}if(mode!=='playing'||fall)return;const dead=n=>Math.abs(n)<=GYRO.deadzone?0:n-Math.sign(n)*GYRO.deadzone;target.x=R.clamp(800+dead(lastSensor.x-neutral.x)*GYRO.horizontalGain,handLimits().left,handLimits().right);target.y=R.clamp(surface-155+dead(lastSensor.y-neutral.y)*GYRO.verticalGain,170,860);});
screen.orientation?.addEventListener('change',()=>{if(gyroOn){neutral=null;pause();toast('横屏方向已改变，继续后将重新校准');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('blur',()=>{keys.clear();pause();});
function point(e){const b=cv.getBoundingClientRect();return {x:(e.clientX-b.left)/scale-(stageWidth-1600)/2,y:(e.clientY-b.top)/scale};}
cv.addEventListener('pointerdown',e=>{if(MOBILE)return;if(mode!=='playing'||fall)return;if(gyroOn)switchToTouch();dragging=true;cv.setPointerCapture(e.pointerId);const p=point(e);target={x:R.clamp(p.x,handLimits().left,handLimits().right),y:R.clamp(p.y,170,860)};});cv.addEventListener('pointermove',e=>{if(MOBILE)return;if(!dragging||mode!=='playing'||fall)return;const p=point(e);target={x:R.clamp(p.x,handLimits().left,handLimits().right),y:R.clamp(p.y,170,860)};});cv.addEventListener('pointerup',()=>dragging=false);cv.addEventListener('pointercancel',()=>dragging=false);
addEventListener('keydown',e=>{if(MOBILE)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'){mode==='playing'?pause():resume();return;}if(mode!=='playing')return;if(e.key===' '&&!e.repeat)grabOrDrop();if(e.key==='Enter'&&!e.repeat)serve();keys.add(e.key);});addEventListener('keyup',e=>keys.delete(e.key));
function draw(){ctx.clearRect(0,0,stageWidth,900);art(ctx,'bg',stageWidth/2,0,stageWidth,900);art(ctx,'counter',stageWidth/2,490,stageWidth,410);ctx.save();ctx.translate((stageWidth-1600)/2,0);ctx.fillStyle='#63320a20';ctx.beginPath();ctx.ellipse(800,728,215,30,0,0,Math.PI*2);ctx.fill();art(ctx,'paper',800,643,500,112);art(ctx,'bottom',800,660,260,90);stack.forEach(a=>{const f=FOOD[a.type];art(ctx,a.type,a.x,a.y,f.w,f.h)});
 handCtx.clearRect(0,0,stageWidth,900);handCtx.save();handCtx.translate((stageWidth-1600)/2,0);
 if(mode==='playing'||mode==='paused'||mode==='intro'){const x=fall?fall.x:hand.x,y=fall?heldHeight:hand.y;const f=FOOD[selection||fall?.type||'patty'];if(selection&&!fall&&hand.y<=surface-28){handCtx.setLineDash([6,12]);handCtx.strokeStyle='#96612477';handCtx.lineWidth=3;handCtx.beginPath();handCtx.moveTo(x,y);handCtx.lineTo(x,surface);handCtx.stroke();handCtx.setLineDash([]);handCtx.fillStyle='#71492033';handCtx.beginPath();handCtx.ellipse(x,surface+9,65,11,0,0,Math.PI*2);handCtx.fill();}
 // Keep the same full-canvas transform across hand poses; sleeve extends beyond the screen.
 art(handCtx,fall?'release':selection?'hold':'idle',x-4,y-(selection||fall?560:520),455,568);
 if(fall){const a=fall;art(handCtx,a.type,a.x,a.y-FOOD[a.type].h*.72,FOOD[a.type].w,FOOD[a.type].h);}else if(selection)art(handCtx,selection,x,y-f.h*.72,f.w,f.h);
 }
const pickup=topAtHand();if(pickup){handCtx.strokeStyle='#43b77d';handCtx.lineWidth=5;handCtx.beginPath();handCtx.ellipse(pickup.x,pickup.y+8,FOOD[pickup.type].w*.42,12,0,0,Math.PI*2);handCtx.stroke();}handCtx.restore();ctx.restore();}
let hudTick=0;
function frame(now){const raw=Math.max(0,(now-last)/1000),dt=Math.min(raw,.05);last=now;if(mode==='playing'&&raw>1.5){pause();toast('画面中断，已自动暂停');}if(mode==='playing'){if(elapsed+raw>=60){elapsed=60;finish();draw();requestAnimationFrame(frame);return;}elapsed+=raw;if(gyroOn&&lastSensor&&now-sensorTime>3500){sensorFailure('体感信号中断，请保持横屏后重新开启。');if(MOBILE){draw();requestAnimationFrame(frame);return;}}if(!fall){const dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);target.x=R.clamp(target.x+dx*330*dt,handLimits().left,handLimits().right);target.y=R.clamp(target.y+dy*260*dt,170,860);if(gyroOn){moveGyro(dt);}else{const smooth=1-Math.exp(-dt*18);hand.x+=(target.x-hand.x)*smooth;hand.y+=(target.y-hand.y)*smooth;}}
 if(fall){fall.age+=dt;fall.y=fall.from+.5*900*fall.age*fall.age;if(fall.y>=fall.target){land(); }}
 if(settle>0){settle=Math.max(0,settle-dt);if(!settle)updateControls();}if(elapsed>=60&&mode==='playing'){elapsed=60;finish();}}
 updateControls();
 if(now-hudTick>80){hudTick=now;$('time').innerHTML=elapsed.toFixed(1)+'<small> 秒</small>';$('timebar').style.width=100*(1-elapsed/60)+'%';$('layers').textContent=rows.length+' / '+currentOrder().layers.length;$('orderScore').textContent=score().accuracy+' 分';$('neatScore').textContent=rows.length?score().neat+' 分':'—';const gap=surface-hand.y;$('heightbar').style.width=R.clamp(gap/350*100,0,100)+'%';$('heightText').textContent=gap<75?'低位':gap<180?'中位':'高位';$('feedback').textContent=mode==='playing'&&elapsed<feedbackUntil?feedback:'';}
 if(ready)draw();requestAnimationFrame(frame);}
$('start').onclick=start;$('startGyro').onclick=()=>enableGyro(start);$('gyro').onclick=()=>enableGyro();$('calibrate').onclick=calibrate;$('drop').onclick=grabOrDrop;$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=start;$('again').onclick=nextOrder;$('serve').onclick=serve;$('inspect').onclick=()=>{$('resultOverlay').hidden=true;$('showResult').hidden=false;};$('showResult').onclick=()=>{$('resultOverlay').hidden=false;$('showResult').hidden=true;};$('sound').onclick=()=>{audioOn=!audioOn;if(audioOn)musicPlay();else musicPause();$('sound').textContent='声音 '+(audioOn?'开':'关');$('sound').setAttribute('aria-label',audioOn?'关闭声音':'开启声音');};
Promise.all(Object.entries(ART).map(([k,[url]])=>new Promise((resolve,reject)=>{const im=new Image;im.onload=()=>{imgs[k]=im;resolve();};im.onerror=()=>reject(Error(url));im.src=url;}))).then(()=>{ready=true;$('loadStatus').textContent='食材准备就绪，共 10 单，每单最多 60 秒';$('start').disabled=false;$('startGyro').disabled=false;randomizeTray();recipeUI();updateControls();}).catch(e=>{$('loadStatus').textContent='素材加载失败，请刷新重试：'+e.message;});requestAnimationFrame(frame);

syncInputUI();

$('sessionLog').onclick=event=>{const button=event.target.closest('[data-review]');if(button)selectCustomerReview(Number(button.dataset.review));};

$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.fullscreenEnabled&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else alert('请在浏览器分享或菜单中选择“添加到主屏幕”，再从桌面图标打开游戏。');}catch{alert('浏览器未允许全屏，请从主屏幕打开游戏。');}};
if(storyEmbedded)$('fullscreen').hidden=true;
document.addEventListener?.('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏';resize();});

$('introFullscreen').onclick=$('fullscreen').onclick;
if(storyEmbedded)$('introFullscreen').hidden=true;
document.addEventListener?.('fullscreenchange',()=>{$('introFullscreen').textContent=document.fullscreenElement?'退出全屏':'进入全屏';});
