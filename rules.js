(function(root){
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Game recipes: simplified assembly challenges, not restaurant operating specifications.
const MENU=[
{id:'double',name:'双层芝士堡',layers:['patty','cheese','lettuce','patty','cheese','top']},
{id:'spicy',name:'麦辣鸡腿堡',layers:['crispy','lettuce','mayo','top']},
{id:'grilled',name:'板烧鸡腿堡',layers:['grilled','lettuce','mayo','top']},
{id:'classic',name:'经典芝士堡',layers:['patty','cheese','mayo','top']},
{id:'chickencheese',name:'双重芝士鸡腿堡',layers:['crispy','cheese','lettuce','cheese','top']}];
const ORDERS=['classic','spicy','grilled','double','chickencheese','spicy','double','grilled','chickencheese','classic'].map(id=>MENU.find(x=>x.id===id));
const RECIPE=MENU[0].layers;
function alignment(x,previous,base=800,width=260){return Math.round(100*(.7*clamp(1-Math.abs(x-previous)/width/.4,0,1)+.3*clamp(1-Math.abs(x-base)/width/.5,0,1)));}
function distance(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
function summarize(rows,seconds,recipe=RECIPE){
 const n=recipe.length,den=Math.max(n,rows.length),landed=rows.filter(r=>r.landed).length;
 const match=clamp(1-distance(rows.map(r=>r.landed?r.type:'_miss'),recipe)/den,0,1);
 const coverage=Math.min(landed/n,1),accuracy=100*match*coverage;
 const neat=rows.reduce((a,r)=>a+(r.landed?r.alignment:0),0)/den;
 const target=n*3,speed=100*clamp((60-seconds)/(60-target),0,1)*coverage;
 const incident=rows.some(r=>r.landed&&r.spoiled);
 return {incident,order:Math.round(accuracy),accuracy:Math.round(accuracy),neat:Math.round(neat),speed:Math.round(speed),total:incident?0:Math.round(.4*accuracy+.4*neat+.2*speed),landed,seconds};
}
function tilt(beta,gamma,angle){const a=angle*Math.PI/180;return {x:gamma*Math.cos(a)+beta*Math.sin(a),y:beta*Math.cos(a)-gamma*Math.sin(a)};}
const api={clamp,MENU,ORDERS,RECIPE,alignment,summarize,tilt,distance};if(typeof module!=='undefined')module.exports=api;else root.BurgerRules=api;
})(typeof window!=='undefined'?window:globalThis);
