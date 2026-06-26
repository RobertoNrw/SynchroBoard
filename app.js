'use strict';

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let draggedNodesForShare = null;

document.getElementById('toolbar').style.display='flex';
document.getElementById('statusbar').style.display='flex';
document.getElementById('minimap').style.display='block';

const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const mmC=document.getElementById('minimap-canvas'),mmX=mmC.getContext('2d');
const $spotlight=document.getElementById('spotlight');
const $tplPicker=document.getElementById('tpl-picker');
const $ctxMenu=document.getElementById('ctx-menu');
const $addDropdown=document.getElementById('add-dropdown');
const $toast=document.getElementById('toast');
const $statusbar = document.getElementById('statusbar');  // FIX 2: Corrected circular var
const $saveIndicator=document.getElementById('save-indicator');
const $lightbox=document.getElementById('lightbox');
const $lightboxImg=document.getElementById('lightbox-img');
const $tmPicker=document.getElementById('tm-picker');
const $tmList = document.getElementById('tm-list');  // FIX 2: Was $tmList=$tmList
const $toolbar=document.getElementById('toolbar');
const $minimap=document.getElementById('minimap');
const $zoomDisplay=document.getElementById('zoom-display');
const $clEditor=document.getElementById('cl-editor');
const $clTitleInput=document.getElementById('cl-title-input');
const $clItemsList=document.getElementById('cl-items-list');
const $connLabelEditor= document.getElementById('conn-label-editor');
const $connLabelInput=document.getElementById('conn-label-input');
const $tblEditor=document.getElementById('tbl-editor');
const $tblGrid=document.getElementById('tbl-grid');
const $spotlightInput=document.getElementById('spotlight-input');
const $spotlightResults= document.getElementById('spotlight-results');
const $nodeCount=document.getElementById('node-count');
const $connCount=document.getElementById('conn-count');
const $tmClose=document.getElementById('tm-close');
const $aiPicker=document.getElementById('ai-picker');
const $aiClose=document.getElementById('ai-close');
const $aiResults=document.getElementById('ai-results');
const $aiResultsList=document.getElementById('ai-results-list');
const $aiActions=document.getElementById('ai-actions');
// Interoperability Bridge DOM Elements
const $interopPicker=document.getElementById('interop-picker');
const $interopClose=document.getElementById('interop-close');
const $interopExport=document.getElementById('interop-export');
const $interopImport=document.getElementById('interop-import');
const $interopRefs=document.getElementById('interop-refs');
const $interopExportTab=document.getElementById('interop-export-tab');
const $interopImportTab=document.getElementById('interop-import-tab');
const $interopRefsTab=document.getElementById('interop-refs-tab');
const $interopResultsList=document.getElementById('interop-results-list');
const SNAP=20,GRID=20,GRID_MAJOR=100,MAXH=60,MNW=80,MNH=60;

// ===== STORAGE MANAGER (v0.17 Improvement) =====
// Fallback für Private Mode, localStorage voll, etc.
const StorageManager = {
    isAvailable: (() => {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage nicht verfügbar (Private Mode?)');
            return false;
        }
    })(),
    
    data: {},  // Fallback zu Memory
    
    set: function(key, value) {
        if (this.isAvailable) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.warn('localStorage full, using memory fallback');
                this.data[key] = value;
            }
        } else {
            this.data[key] = value;
        }
    },
    
    get: function(key) {
        if (this.isAvailable) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                return this.data[key];
            }
        }
        return this.data[key];
    },
    
    remove: function(key) {
        if (this.isAvailable) {
            try {
                localStorage.removeItem(key);
            } catch (e) { }
        }
        delete this.data[key];
    }
};
// ===== END STORAGE MANAGER =====

function getCanvasCssSize(){const dpr=window.devicePixelRatio||1;return{w:canvas.width/dpr,h:canvas.height/dpr};}
let currentCursor='default',mmTimer=0,lastMM=0,activePointerId=null;function setCursor(cur){if(currentCursor!==cur){currentCursor=cur;canvas.style.cursor=cur;}}function scheduleMM(){const now=performance.now();if(now-lastMM>100){lastMM=now;renderMM();return;}clearTimeout(mmTimer);mmTimer=setTimeout(()=>{lastMM=performance.now();renderMM();},100);}function getLocalPoint(e){const r=canvas.getBoundingClientRect();return{mx:e.clientX-r.left,my:e.clientY-r.top};}function canHandlePointer(e){return e.isPrimary!==false&&(activePointerId===null||activePointerId===e.pointerId);}function resetInteractionState(){isRz=false;isSB=false;isConn=false;isSel=false;isDrag=false;isND=false;isPan=false;dNode=null;rzN=null;rzH=null;sbN=null;cStart=null;cStartPt=null;moved=false;activePointerId=null;setCursor('default');sR();}
let isDark=!document.documentElement.classList.contains('light');
function D(){return isDark;}
function C(d,l){return isDark?d:l;}
const STICKY_C=[{bg:'#FFD60A',border:'#CCB000',textColor:'#1a1200',label:'Gelb'},{bg:'#30D158',border:'#1d7a5a',textColor:'#001a12',label:'Grün'},{bg:'#007AFF',border:'#0055cc',textColor:'#fff',label:'Blau'},{bg:'#FF375F',border:'#cc2040',textColor:'#fff',label:'Pink'},{bg:'#FF9F0A',border:'#cc7f00',textColor:'#1a0800',label:'Orange'},{bg:'#BF5AF2',border:'#9040c0',textColor:'#fff',label:'Lila'}];
const NT=[{type:'text',icon:'T',label:'Text'},{type:'sticky',icon:'S',label:'Sticky'},{type:'checklist',icon:'✓',label:'Liste'},{type:'group',icon:'□',label:'Gruppe'},{type:'table',icon:'⊞',label:'Tabelle'},{type:'link',icon:'🔗',label:'Link'},{type:'diamond',icon:'◇',label:'Raute'},{type:'ellipse',icon:'⬭',label:'Ellipse'},{type:'hexagon',icon:'⬡',label:'Hexagon'}];
let nodes=[],conns=[],nc=0,selN=[],selC=null,vx=0,vy=0,vs=1;
let isDrag=false,isPan=false,isND=false,isConn=false,isSel=false,isRz=false,isSB=false;
let dNode=null,dOX=0,dOY=0,lMX=0,lMY=0,moved=false,onCv=true;
let cStart=null,cStartPt=null,sStart={x:0,y:0},sRect=null,hNode=null,hCP=null;
let rzN=null,rzH=null,rzSX=0,rzSY=0,rzSW=0,rzSH=0,rzNX=0,rzNY=0;
let sbN=null,sbOff=0,clip=[],snap=false,hist=[],hIdx=-1,supH=false,rafP=false;
let showGrid=true;

const s2c=(sx,sy)=>({x:(sx-vx)/vs,y:(sy-vy)/vs});
const snV=v=>snap?Math.round(v/SNAP)*SNAP:v;
function sR(){if(!rafP){rafP=true;requestAnimationFrame(()=>{rafP=false;render();scheduleMM();});}}
function toast(m,ms=1800){$toast.textContent=m;$toast.classList.add('show');clearTimeout($toast._t);$toast._t=setTimeout(()=>$toast.classList.remove('show'),ms);}
function fmtSaveTime(ts){const d=new Date(ts),hh=String(d.getHours()).padStart(2,'0'),mm=String(d.getMinutes()).padStart(2,'0');return hh+':'+mm;}
function setSaveIndicator(msg,color='var(--text2)'){if($saveIndicator){$saveIndicator.textContent=msg;$saveIndicator.style.color=color;}}
function markSaved(ts=Date.now(),label='Lokal gespeichert'){StorageManager.set('ic_v3_saved_at',String(ts));setSaveIndicator(label+' · '+fmtSaveTime(ts),'#30D158');}
function refreshSavedBadge(){const ts=Number(StorageManager.get('ic_v3_saved_at')||0);if(ts)setSaveIndicator('Lokal gespeichert · '+fmtSaveTime(ts),'#30D158');}
const API_URL='api.php';
function getCanvasId(){let id=StorageManager.get('ic_canvas_id');if(!id){id='default';StorageManager.set('ic_canvas_id',id);}return id;}
async function apiGet(action,id){if(location.protocol==='file:')throw new Error('offline');const u=id?`${API_URL}?action=${action}&id=${encodeURIComponent(id)}`:`${API_URL}?action=${action}`;const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
async function apiPost(action,id,payload){if(location.protocol==='file:')throw new Error('offline');const u=id?`${API_URL}?action=${action}&id=${encodeURIComponent(id)}`:`${API_URL}?action=${action}`;const wk=StorageManager.get('ic_write_key')||'';const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json',...(wk?{'X-Write-Key':wk}:{})},body:JSON.stringify(payload||{})});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
async function loadFromBackend(){try{const res=await apiGet('load',getCanvasId());if(res&&res.ok&&res.exists&&res.data){impD(res.data);if(res.updatedAt){const ts=Date.parse(res.updatedAt)||Date.now();StorageManager.set('ic_v3_saved_at',String(ts));setSaveIndicator('Server geladen · '+fmtSaveTime(ts),'#30D158');}return true;}}catch(e){}return false;}
async function saveToBackend(){try{const res=await apiPost('save',getCanvasId(),{data:expD()});if(res&&res.ok){const ts=Date.parse(res.updatedAt)||Date.now();StorageManager.set('ic_v3_saved_at',String(ts));setSaveIndicator('Server gespeichert · '+fmtSaveTime(ts),'#30D158');return true;}}catch(e){setSaveIndicator('Nur lokal gespeichert','#FF9F0A');}return false;}
let _uSB_nc=-1,_uSB_cc=-1,_uSB_vs=-1;
function uSB(){
  const nl=nodes.length,cl=conns.length,zl=Math.round(vs*100);
  if(nl!==_uSB_nc){$nodeCount.textContent=nl;_uSB_nc=nl;}
  if(cl!==_uSB_cc){$connCount.textContent=cl;_uSB_cc=cl;}
  if(zl!==_uSB_vs){$zoomDisplay.textContent=zl+'%';_uSB_vs=zl;}
}

let _ast=null,_lastSaved='';
function aS(){
  const _curState=JSON.stringify({nc,nl:nodes.length,cl:conns.length});
  if(_curState===_lastSaved&&_lastSaved!==''){return;}
  setSaveIndicator('Speichert…','#FF9F0A');
  clearTimeout(_ast);
  _ast=setTimeout(async()=>{
    try{
      _lastSaved=JSON.stringify({nc,nl:nodes.length,cl:conns.length});
      StorageManager.set('ic_v3',JSON.stringify(expD()));
      markSaved(Date.now(),'Lokal gespeichert');
      await saveToBackend();
      // FIX S6: LiveRoom-Sync — wenn aktiv, State an Peers broadcasten
      if (typeof LiveRoom !== 'undefined' && LiveRoom.peer && LiveRoom.syncEnabled && (LiveRoom.isHost ? LiveRoom.peers.length > 0 : LiveRoom.conn)) {
        try { LiveRoom.send({ type: 'state-update', data: LiveRoom.getBoardState() }); } catch(_){}
      }
    }catch(e){setSaveIndicator('Speicherfehler','#FF453A');}
  },400);
}
function expD(){return{nodes:nodes.map(cN),edges:conns.map(c=>({id:c.id,fromNode:c.from,toNode:c.to,fromSide:c.fromSide,toSide:c.toSide,label:c.label||'',style:c.style||'solid',color:c.color||''}))};}
function impD(data){nodes=[];conns=[];nc=0;clrS();imgCache={};hIdx=-1;hist=[];
(data.nodes||[]).forEach(nd=>{const n={id:nd.id,type:nd.type||'text',text:nd.text||'Node',x:nd.x!=null?nd.x:100,y:nd.y!=null?nd.y:100,width:nd.width||250,height:nd.height||120,scrollY:0,isSelected:false,locked:nd.locked||false,bg:nd.bg||nd.backgroundColor||C('#2c2c2e','#fff'),textColor:nd.textColor||C('#f5f5f7','#1c1c1e'),border:nd.border||nd.borderColor||C('#48484a','#d1d1d6'),typeData:nd.typeData||(nd.type==='checklist'?{items:[]}:(nd.type==='table'?{headers:['Spalte 1','Spalte 2'],rows:[['','']]}:(nd.type==='link'?{url:'https://',icon:''}:{})))};const num=parseInt(n.id.replace(/\D/g,''));if(!isNaN(num)&&num>nc)nc=num;nodes.push(n);});
(data.edges||[]).forEach(e=>{conns.push({id:e.id,from:e.fromNode,to:e.toNode,fromSide:e.fromSide||'right',toSide:e.toSide||'left',label:e.label||'',style:e.style||'solid',color:e.color||''});});
pH();uSB();sR();}

function pH(){
  if(supH)return;
  const s=JSON.stringify({nodes:nodes.map(cN),conns});
  if(hist[hIdx]===s)return;  hist=hist.slice(0,hIdx+1);
  hist.push(s);
  if(hist.length>MAXH)hist.shift();
  hIdx=hist.length-1;
}
function aH(s){supH=true;const d=JSON.parse(s);nodes=d.nodes.map(n=>Object.assign(mN(n.type||'text',n.text,n.x,n.y),n));conns=d.conns;clrS();supH=false;aS();sR();uSB();}
function undo(){if(hIdx<=0){toast('—');return;}hIdx--;aH(hist[hIdx]);toast('↩ Undo');}
function redo(){if(hIdx>=hist.length-1){toast('—');return;}hIdx++;aH(hist[hIdx]);toast('↪ Redo');}

function mN(type,text,x,y){const id='n'+(++nc);const b={id,type:type||'text',text:text||'',x:x||100,y:y||100,scrollY:0,isSelected:false,locked:false};
switch(type){case'sticky':return{...b,text:text||'Notiz…',width:180,height:180,bg:'#FFD60A',textColor:'#1a1200',border:'#CCB000',typeData:{}};
case'checklist':return{...b,text:text||'Aufgaben',width:240,height:180,bg:C('#1e2a1e','#e8f5e9'),textColor:C('#d4f0d4','#1b5e20'),border:C('#2d5a2d','#81c784'),typeData:{items:[{text:'Erstes Element',checked:false}]}};
case'group':return{...b,text:text||'Bereich',width:380,height:280,bg:C('rgba(255,255,255,0.03)','rgba(0,0,0,0.03)'),textColor:C('rgba(255,255,255,0.5)','rgba(0,0,0,0.4)'),border:C('rgba(255,255,255,0.12)','rgba(0,0,0,0.1)'),typeData:{}};
case'table':return{...b,text:text||'Tabelle',width:300,height:200,bg:C('#2c2c2e','#fff'),textColor:C('#f5f5f7','#1c1c1e'),border:C('#48484a','#d1d1d6'),typeData:{headers:['Spalte 1','Spalte 2','Spalte 3'],rows:[['','',''],['','','']]}};
case'link':return{...b,text:text||'Link',width:120,height:120,bg:C('#1e2d3a','#e3f2fd'),textColor:C('#7ab8f5','#0055cc'),border:C('#2d5a8a','#64b5f6'),typeData:{url:'https://',icon:''}};
case'diamond':return{...b,text:text||'Entscheidung',width:180,height:140,bg:C('#3a2a1e','#fff3e0'),textColor:C('#ffb74d','#e65100'),border:C('#8a5a2d','#ffb74d'),typeData:{}};
case'ellipse':return{...b,text:text||'Prozess',width:200,height:120,bg:C('#1e2a3a','#e8eaf6'),textColor:C('#90caf9','#283593'),border:C('#2d4a7a','#7986cb'),typeData:{}};
case'hexagon':return{...b,text:text||'Modul',width:180,height:160,bg:C('#2a1e3a','#f3e5f5'),textColor:C('#ce93d8','#6a1b9a'),border:C('#6a3a8a','#ab47bc'),typeData:{}};
case'image':return{...b,text:text||'Bild',width:300,height:200,bg:'transparent',textColor:'transparent',border:C('rgba(255,255,255,0.2)','rgba(0,0,0,0.2)'),typeData:{src:'', url:''}};
default:return{...b,text:text||'New Node',width:250,height:120,bg:C('#2c2c2e','#fff'),textColor:C('#f5f5f7','#1c1c1e'),border:C('#48484a','#d1d1d6'),typeData:{}};}}
function cN(n){const{_rh,_sb,_ch,_ms,_ca,isEditing,...r}=n;return r;}
// FIX A6: Zentraler Event-Dispatcher für PredictiveWorkflow & LiveRoom-Hooks
function emit(name,detail){try{document.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(_){}}
function addN(type,x,y,text){const n=mN(type,text,snV(x!=null&&x!==''?+x:100),snV(y!=null&&y!==''?+y:100));nodes.push(n);pH();aS();uSB();sR();emit('nodeCreated',{type:n.type,id:n.id});return n;}
function delN(n){const id=n.id;nodes=nodes.filter(x=>x!==n);conns=conns.filter(c=>c.from!==n.id&&c.to!==n.id);selN=selN.filter(s=>s!==n);if(imgCache[n.id]) delete imgCache[n.id];
pH();aS();uSB();sR();emit('nodeDeleted',{id});}
function delC(c){const id=c.id;conns=conns.filter(x=>x!==c);if(selC===c)selC=null;pH();aS();uSB();sR();emit('connectionDeleted',{id});}

function clrS(){nodes.forEach(n=>n.isSelected=false);selN=[];selC=null;}
function selOne(n){clrS();n.isSelected=true;selN=[n];}
function addS(n){if(!n.isSelected){n.isSelected=true;selN.push(n);}}
function togS(n){n.isSelected?(n.isSelected=false,selN=selN.filter(s=>s!==n)):addS(n);}

function dupN(arr){if(!arr.length)return;clrS();arr.forEach(nd=>{const nn=addN(nd.type||'text',nd.x+30,nd.y+30,nd.text);nn.width=nd.width;nn.height=nd.height;nn.bg=nd.bg;nn.textColor=nd.textColor;nn.border=nd.border;if(nd.typeData)nn.typeData=JSON.parse(JSON.stringify(nd.typeData));addS(nn);});toast(arr.length+' dupliziert');}

function nAt(cx,cy){let g=null;for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(n.type==='link'){const dx=cx-(n.x+n.width/2),dy=cy-(n.y+n.height/2),r=Math.min(n.width,n.height)/2;if(dx*dx+dy*dy<=r*r)return n;continue;}if(cx>=n.x&&cx<=n.x+n.width&&cy>=n.y&&cy<=n.y+n.height){if(n.type==='group'){if(!g)g=n;}else return n;}}return g;}
function nInR(rx,ry,rw,rh){return nodes.filter(n=>!(n.x>rx+rw||n.x+n.width<rx||n.y>ry+rh||n.y+n.height<ry));}
function cPts(n){const cx=n.x+n.width/2,cy=n.y+n.height/2;
if(n.type==='link'){const r=Math.min(n.width,n.height)/2;return[{x:cx,y:cy-r,side:'top'},{x:cx+r,y:cy,side:'right'},{x:cx,y:cy+r,side:'bottom'},{x:cx-r,y:cy,side:'left'}];}
if(n.type==='ellipse'){const rx=n.width/2,ry=n.height/2;return[{x:cx,y:n.y,side:'top'},{x:n.x+n.width,y:cy,side:'right'},{x:cx,y:n.y+n.height,side:'bottom'},{x:n.x,y:cy,side:'left'}];}
if(n.type==='diamond')return[{x:cx,y:n.y,side:'top'},{x:n.x+n.width,y:cy,side:'right'},{x:cx,y:n.y+n.height,side:'bottom'},{x:n.x,y:cy,side:'left'}];
if(n.type==='hexagon'){const rx=n.width/2,ry=n.height/2;return[{x:cx,y:n.y,side:'top'},{x:n.x+n.width,y:cy,side:'right'},{x:cx,y:n.y+n.height,side:'bottom'},{x:n.x,y:cy,side:'left'}];}
return[{x:cx,y:n.y,side:'top'},{x:n.x+n.width,y:cy,side:'right'},{x:cx,y:n.y+n.height,side:'bottom'},{x:n.x,y:cy,side:'left'}];}
function cpAt(n,cx,cy){for(const p of cPts(n))if(Math.hypot(cx-p.x,cy-p.y)<=16)return p;return null;}
function dSeg(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;if(!l2)return Math.hypot(px-x1,py-y1);const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2));return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));}
function cAt(cx,cy){const hitR=Math.max(6,8/vs);for(const c of conns){const fn=nodes.find(n=>n.id===c.from),tn=nodes.find(n=>n.id===c.to);if(!fn||!tn)continue;const fp=cPts(fn).find(p=>p.side===c.fromSide)||cPts(fn)[1];const tp=cPts(tn).find(p=>p.side===c.toSide)||cPts(tn)[3];if(dSeg(cx,cy,fp.x,fp.y,tp.x,tp.y)<=hitR)return c;}return null;}
function bSides(fn,tn){const dx=(tn.x+tn.width/2)-(fn.x+fn.width/2),dy=(tn.y+tn.height/2)-(fn.y+fn.height/2);return{fromSide:Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'bottom':'top'),toSide:Math.abs(dx)>Math.abs(dy)?(dx>0?'left':'right'):(dy>0?'top':'bottom')};}
function chkAt(n,cx,cy){if(!n._ca)return-1;for(const h of n._ca)if(cy>=h.y1&&cy<=h.y2&&cx>=h.x1&&cx<=h.x2)return h.idx;return-1;}

function fitAll(){if(!nodes.length){vx=0;vy=0;vs=1;sR();return;}let mX=Infinity,mY=Infinity,MX=-Infinity,MY=-Infinity;nodes.forEach(n=>{mX=Math.min(mX,n.x);mY=Math.min(mY,n.y);MX=Math.max(MX,n.x+n.width);MY=Math.max(MY,n.y+n.height);});const p=80,bw=MX-mX+p*2,bh=MY-mY+p*2;vs=Math.max(0.1,Math.min(Math.min(canvas.width/bw,(canvas.height-30)/bh),2));vx=canvas.width/2-(mX+MX)/2*vs;vy=(canvas.height-30)/2-(mY+MY)/2*vs;sR();toast('Fit');}

function rR(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
const FB='Inter';
const MF={h1:`bold 18px ${FB}`,h2:`bold 16px ${FB}`,h3:`bold 14px ${FB}`,h4:`600 13px ${FB}`,bold:`600 13px ${FB}`,italic:`italic 13px ${FB}`,code:`13px SF Mono,Menlo,Consolas,monospace`,list:`13px ${FB}`,link:`13px ${FB}`,normal:`13px ${FB}`};
const ML={h1:26,h2:23,h3:21,h4:19,bold:19,italic:19,code:19,list:19,link:19,normal:19};
function pML(l){const t=l.trim();if(t.startsWith('####'))return{text:t.slice(4).trim(),style:'h4'};if(t.startsWith('###'))return{text:t.slice(3).trim(),style:'h3'};if(t.startsWith('##'))return{text:t.slice(2).trim(),style:'h2'};if(t.startsWith('#'))return{text:t.slice(1).trim(),style:'h1'};if(t.startsWith('**')&&t.endsWith('**')&&t.length>4)return{text:t.slice(2,-2),style:'bold'};if(t.startsWith('*')&&t.endsWith('*')&&t.length>2)return{text:t.slice(1,-1),style:'italic'};if(t.startsWith('`')&&t.endsWith('`')&&t.length>2)return{text:t.slice(1,-1),style:'code'};if(t.startsWith('- ')||t.startsWith('* '))return{text:'  •  '+t.slice(2),style:'list'};if(/^\d+\.\s/.test(t))return{text:'  '+t,style:'list'};if(/^https?:\/\//.test(t)||/^www\./.test(t))return{text:t,style:'link'};return{text:l,style:'normal'};}

function drawNode(n){if(n.isEditing)return;
if(n.type==='image'){drawImageNode(n);return;}if(n.type==='group'){drawGroup(n);return;}if(n.type==='link'){drawLink(n);return;}if(n.type==='diamond'){drawShape(n,'diamond');return;}if(n.type==='ellipse'){drawShape(n,'ellipse');return;}if(n.type==='hexagon'){drawShape(n,'hexagon');return;}
if(n.isSelected){ctx.shadowColor=C('rgba(0,122,255,0.3)','rgba(0,122,255,0.2)');ctx.shadowBlur=20;}
const _r=n.type==='sticky'?6:12;rR(n.x,n.y,n.width,n.height,_r);ctx.fillStyle=n.bg;ctx.fill();ctx.shadowBlur=0;ctx.shadowColor='transparent';ctx.strokeStyle=n.isSelected?'#007AFF':n.border;ctx.lineWidth=n.isSelected?2:1;ctx.stroke();
if(n.locked){ctx.font=`10px ${FB}`;ctx.fillStyle=C('rgba(255,255,255,0.3)','rgba(0,0,0,0.2)');ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('🔒',n.x+n.width-8,n.y+6);}
switch(n.type){case'sticky':drawSticky(n);break;case'checklist':drawCL(n);break;case'table':drawTbl(n);break;default:drawText(n);}
if(n._ms>0&&n.type!=='checklist')drawSB(n);
if(n.isSelected||(hNode===n&&hCP)||isConn)drawCPs(n);
if(n.isSelected&&!n.locked)drawRH(n);}

function drawText(n){if(n.scrollY===undefined)n.scrollY=0;ctx.save();rR(n.x+2,n.y+2,n.width-4,n.height-4,10);ctx.clip();
const p=12,lines=n.text.split('\n'),fmt=[],lhs=[];
lines.forEach(l=>{if(!l.trim()){fmt.push({text:'',style:'normal'});lhs.push(16);return;}const ls=pML(l);ctx.font=MF[ls.style]||MF.normal;const words=ls.text.split(' ');let cur=words[0]||'';for(let i=1;i<words.length;i++){const t=cur+' '+words[i];ctx.measureText(t).width<n.width-p*2-6?cur=t:(fmt.push({text:cur,style:ls.style}),lhs.push(ML[ls.style]||19),cur=words[i]);}fmt.push({text:cur,style:ls.style});lhs.push(ML[ls.style]||19);});
let tH=p;lhs.forEach(h=>tH+=h);tH+=p;n._ch=tH;n._ms=Math.max(0,tH-n.height);n.scrollY=Math.max(0,Math.min(n.scrollY,n._ms));
let cy=n.y+p-n.scrollY;const hC={h1:'#007AFF',h2:'#007AFF',h3:'#5AC8FA',h4:'#5AC8FA',code:C('#e5c07b','#d4760a'),link:'#5AC8FA'};
fmt.forEach((l,i)=>{const lh=lhs[i];if(cy+lh>=n.y&&cy<=n.y+n.height){ctx.font=MF[l.style]||MF.normal;ctx.fillStyle=hC[l.style]||n.textColor;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(l.text,n.x+p,cy);}cy+=lh;});ctx.restore();}

function drawSticky(n){const de=20;ctx.fillStyle='rgba(0,0,0,0.12)';ctx.beginPath();ctx.moveTo(n.x+n.width-de,n.y);ctx.lineTo(n.x+n.width,n.y+de);ctx.lineTo(n.x+n.width-de,n.y+de);ctx.closePath();ctx.fill();
ctx.save();rR(n.x+2,n.y+2,n.width-de-4,n.height-4,4);ctx.clip();const p=10,lh=20;ctx.font=`15px ${FB}`;ctx.fillStyle=n.textColor;ctx.textAlign='left';ctx.textBaseline='top';
const words=n.text.split(' ');let line='',cy=n.y+p;const mW=n.width-de-p*2;
words.forEach(w=>{const t=line?line+' '+w:w;if(ctx.measureText(t).width>mW&&line){if(cy+lh>n.y+n.height-4){return;}ctx.fillText(line,n.x+p,cy);cy+=lh;line=w;}else line=t;});
if(cy+lh<=n.y+n.height-4)ctx.fillText(line,n.x+p,cy);ctx.restore();n._ms=0;}

function drawCL(n){if(n.scrollY===undefined)n.scrollY=0;const items=(n.typeData&&n.typeData.items)||[];n._ca=[];
ctx.save();rR(n.x+2,n.y+2,n.width-4,n.height-4,10);ctx.clip();const p=10,rH=24,cS=16,tH=28;
ctx.fillStyle=C('rgba(255,255,255,0.05)','rgba(0,0,0,0.04)');ctx.fillRect(n.x,n.y,n.width,tH);
ctx.font=`600 12px ${FB}`;ctx.fillStyle=n.textColor;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(n.text||'Aufgaben',n.x+p,n.y+tH/2);
const done=items.filter(i=>i.checked).length;ctx.font=`11px ${FB}`;ctx.fillStyle=C('rgba(255,255,255,0.3)','rgba(0,0,0,0.3)');ctx.textAlign='right';ctx.fillText(`${done}/${items.length}`,n.x+n.width-p,n.y+tH/2);
const totH=tH+items.length*rH+p;n._ch=totH;n._ms=Math.max(0,totH-n.height);n.scrollY=Math.max(0,Math.min(n.scrollY||0,n._ms));
let iy=n.y+tH-n.scrollY;
items.forEach((item,idx)=>{const rowY=iy+idx*rH;if(rowY+rH<n.y+tH||rowY>n.y+n.height)return;
const cbX=n.x+p,cbY=rowY+(rH-cS)/2;ctx.beginPath();ctx.arc(cbX+cS/2,cbY+cS/2,cS/2,0,2*Math.PI);ctx.fillStyle=item.checked?'#30D158':'transparent';ctx.fill();ctx.strokeStyle=item.checked?'#30D158':C('rgba(255,255,255,0.2)','rgba(0,0,0,0.2)');ctx.lineWidth=1.5;ctx.stroke();
if(item.checked){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cbX+4,cbY+cS/2);ctx.lineTo(cbX+cS/2-1,cbY+cS-4);ctx.lineTo(cbX+cS-3,cbY+3);ctx.stroke();}
n._ca.push({idx,x1:cbX-2,x2:cbX+cS+4,y1:rowY,y2:rowY+rH});
ctx.font=`12px ${FB}`;ctx.fillStyle=item.checked?C('rgba(255,255,255,0.3)','rgba(0,0,0,0.25)'):n.textColor;ctx.textAlign='left';ctx.textBaseline='middle';
const tx=n.x+p+cS+8,ty=rowY+rH/2;ctx.fillText(item.text||'',tx,ty);
if(item.checked){const tw=ctx.measureText(item.text||'').width;ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx+tw,ty);ctx.stroke();}});
ctx.restore();if(n._ms>0)drawSB(n);}

function drawTbl(n){
if(n.scrollY===undefined)n.scrollY=0;
const td=n.typeData||{headers:[],rows:[]};const hds=td.headers||[];const rows=td.rows||[];
const p=10,titleH=26,hdrH=22,rowH=20,colW=Math.max(50,(n.width-p*2)/Math.max(1,hds.length));
ctx.save();rR(n.x+2,n.y+2,n.width-4,n.height-4,10);ctx.clip();
ctx.fillStyle=C('rgba(255,255,255,0.05)','rgba(0,0,0,0.04)');ctx.fillRect(n.x,n.y,n.width,titleH);
ctx.font=`600 12px ${FB}`;ctx.fillStyle=n.textColor;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText('⊞  '+(n.text||'Tabelle'),n.x+p,n.y+titleH/2);
ctx.font=`11px ${FB}`;ctx.fillStyle=C('rgba(255,255,255,0.3)','rgba(0,0,0,0.3)');ctx.textAlign='right';ctx.fillText(`${rows.length}×${hds.length}`,n.x+n.width-p,n.y+titleH/2);
const totH=titleH+hdrH+rows.length*rowH+p;n._ch=totH;n._ms=Math.max(0,totH-n.height);n.scrollY=Math.max(0,Math.min(n.scrollY||0,n._ms));
let cy=n.y+titleH-n.scrollY;
ctx.fillStyle=C('rgba(0,122,255,0.08)','rgba(0,122,255,0.06)');ctx.fillRect(n.x,cy,n.width,hdrH);
ctx.font=`600 11px ${FB}`;ctx.fillStyle=C('rgba(0,122,255,0.8)','rgba(0,122,255,0.7)');ctx.textAlign='left';ctx.textBaseline='middle';
hds.forEach((h,i)=>{const cx=n.x+p+i*colW;if(cx<n.x+n.width-p)ctx.fillText((h||'').slice(0,12),cx+4,cy+hdrH/2);});
ctx.strokeStyle=C('rgba(255,255,255,0.06)','rgba(0,0,0,0.06)');ctx.lineWidth=1;
for(let i=1;i<hds.length;i++){const lx=n.x+p+i*colW;ctx.beginPath();ctx.moveTo(lx,cy);ctx.lineTo(lx,cy+hdrH+rows.length*rowH);ctx.stroke();}
cy+=hdrH;
ctx.font=`12px ${FB}`;
rows.forEach((row,ri)=>{
if(cy+rowH>=n.y+titleH&&cy<=n.y+n.height){
ctx.strokeStyle=C('rgba(255,255,255,0.04)','rgba(0,0,0,0.04)');ctx.beginPath();ctx.moveTo(n.x+p,cy);ctx.lineTo(n.x+n.width-p,cy);ctx.stroke();
ctx.fillStyle=n.textColor;ctx.textAlign='left';ctx.textBaseline='middle';
(row||[]).forEach((cell,ci)=>{const cx=n.x+p+ci*colW;if(cx<n.x+n.width-p)ctx.fillText((cell||'').slice(0,14),cx+4,cy+rowH/2);});}
cy+=rowH;});
ctx.restore();if(n._ms>0)drawSB(n);n._ca=null;}

function drawGroup(n){if(n.isEditing)return;

ctx.fillStyle=n.bg;rR(n.x,n.y,n.width,n.height,16);ctx.fill();ctx.strokeStyle=n.isSelected?'#007AFF':n.border;ctx.lineWidth=n.isSelected?2:1.5;ctx.setLineDash([8,5]);rR(n.x,n.y,n.width,n.height,16);ctx.stroke();ctx.setLineDash([]);ctx.font=`600 12px ${FB}`;ctx.fillStyle=n.isSelected?'#007AFF':n.textColor;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(n.text||'Bereich',n.x+12,n.y+10);n._ms=0;
if(n.isSelected||(hNode===n&&hCP)||isConn)drawCPs(n);if(n.isSelected&&!n.locked)drawRH(n);}

function drawLink(n){
const cx=n.x+n.width/2,cy=n.y+n.height/2,r=Math.min(n.width,n.height)/2;
if(n.isSelected){ctx.shadowColor=C('rgba(0,122,255,0.35)','rgba(0,122,255,0.25)');ctx.shadowBlur=22;}
ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.fillStyle=n.bg;ctx.fill();
ctx.shadowBlur=0;ctx.shadowColor='transparent';
ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.strokeStyle=n.isSelected?'#007AFF':n.border;ctx.lineWidth=n.isSelected?2.5:1.5;ctx.stroke();
if(n.locked){ctx.font=`10px ${FB}`;ctx.fillStyle=C('rgba(255,255,255,0.3)','rgba(0,0,0,0.2)');ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('🔒',n.x+n.width-4,n.y+4);}
const url=(n.typeData&&n.typeData.url)||'';const iconUrl=(n.typeData&&n.typeData.icon)||'';
let hasIcon=false;
if(iconUrl||url&&url!=='https://'){
const src=iconUrl||(url!=='https://'?'https://www.google.com/s2/favicons?sz=64&domain='+url.replace(/^https?:\/\//,'').replace(/\/.*/,''):'');
if(src){const key='_ico_'+n.id;if(!n[key]){n[key]=new Image();n[key].crossOrigin='anonymous';n[key].src=src;n[key]._ok=false;n[key].onload=()=>{n[key]._ok=true;sR();};}
if(n[key]._ok){const is=r*0.7;try{ctx.save();ctx.beginPath();ctx.arc(cx,cy-r*0.08,is/2,0,2*Math.PI);ctx.clip();ctx.drawImage(n[key],cx-is/2,cy-r*0.08-is/2,is,is);ctx.restore();hasIcon=true;}catch(e){}}}}
if(!hasIcon){const ir=r*0.22;ctx.strokeStyle=n.textColor;ctx.lineWidth=2.5;ctx.lineCap='round';
ctx.beginPath();ctx.arc(cx-ir*0.6,cy-ir*0.6,ir,Math.PI*0.75,Math.PI*2.25);ctx.stroke();
ctx.beginPath();ctx.arc(cx+ir*0.6,cy+ir*0.6,ir,Math.PI*-0.25,Math.PI*1.25);ctx.stroke();}
const label=(n.text||'Link').slice(0,16);ctx.font=`500 11px ${FB}`;ctx.fillStyle=n.textColor;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,cx,cy+r*0.55);
if(url&&url!=='https://'){const domain=url.replace(/^https?:\/\//,'').replace(/\/.*/,'').slice(0,20);ctx.font=`10px ${FB}`;ctx.fillStyle=C('rgba(255,255,255,0.25)','rgba(0,0,0,0.2)');ctx.fillText(domain,cx,cy+r*0.78);}
n._ms=0;n._ca=null;
if(n.isSelected||(hNode===n&&hCP)||isConn)drawCPs(n);
if(n.isSelected&&!n.locked)drawRH(n);}

const _shapePaths={
diamond:(n)=>{const cx=n.x+n.width/2,cy=n.y+n.height/2;ctx.beginPath();ctx.moveTo(cx,n.y);ctx.lineTo(n.x+n.width,cy);ctx.lineTo(cx,n.y+n.height);ctx.lineTo(n.x,cy);ctx.closePath();},
ellipse:(n)=>{ctx.beginPath();ctx.ellipse(n.x+n.width/2,n.y+n.height/2,n.width/2,n.height/2,0,0,2*Math.PI);},
hexagon:(n)=>{const cx=n.x+n.width/2,cy=n.y+n.height/2,rx=n.width/2,ry=n.height/2;ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/2;ctx.lineTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a));}ctx.closePath();}
};
function drawShape(n,shape){
if(n.isEditing)return;

const pathFn=_shapePaths[shape];if(!pathFn)return;
if(n.isSelected){ctx.shadowColor=C('rgba(0,122,255,0.3)','rgba(0,122,255,0.2)');ctx.shadowBlur=20;}
pathFn(n);ctx.fillStyle=n.bg;ctx.fill();ctx.shadowBlur=0;ctx.shadowColor='transparent';
pathFn(n);ctx.strokeStyle=n.isSelected?'#007AFF':n.border;ctx.lineWidth=n.isSelected?2.5:1.5;ctx.stroke();
if(n.locked){ctx.font=`10px ${FB}`;ctx.fillStyle=C('rgba(255,255,255,0.3)','rgba(0,0,0,0.2)');ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('🔒',n.x+n.width-8,n.y+6);}
ctx.save();pathFn(n);ctx.clip();
const cx=n.x+n.width/2,cy=n.y+n.height/2;
const lines=(n.text||'').split('\n');
ctx.font=`500 13px ${FB}`;ctx.fillStyle=n.textColor;ctx.textAlign='center';ctx.textBaseline='middle';
if(lines.length===1){ctx.fillText(lines[0].slice(0,24),cx,cy);}
else{const lh=18;const startY=cy-((lines.length-1)*lh)/2;
lines.forEach((l,i)=>{if(i<6)ctx.fillText(l.slice(0,24),cx,startY+i*lh);});}
ctx.restore();
n._ms=0;n._ca=null;
if(n.isSelected||(hNode===n&&hCP)||isConn)drawCPs(n);
if(n.isSelected&&!n.locked)drawRH(n);}

function drawSB(n){const sw=4,sx=n.x+n.width-sw-3,sy=n.y+6,sh=n.height-12;ctx.fillStyle=C('rgba(255,255,255,0.04)','rgba(0,0,0,0.04)');ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,2);ctx.fill();
const r=Math.min(1,n.height/n._ch),th=Math.max(20,sh*r),mT=sh-th,ty=sy+(mT>0?(n.scrollY/n._ms)*mT:0);
ctx.fillStyle=n.isSelected?'rgba(0,122,255,0.5)':C('rgba(255,255,255,0.2)','rgba(0,0,0,0.15)');ctx.beginPath();ctx.roundRect(sx,ty,sw,th,2);ctx.fill();n._sb={x:sx,y:sy,w:sw+4,h:sh,tY:ty,tH:th};}

function drawRH(n){const s=7,defs=[{dx:0,dy:0,t:'nw',c:'nw-resize'},{dx:n.width,dy:0,t:'ne',c:'ne-resize'},{dx:0,dy:n.height,t:'sw',c:'sw-resize'},{dx:n.width,dy:n.height,t:'se',c:'se-resize'},{dx:n.width/2,dy:0,t:'n',c:'n-resize'},{dx:n.width/2,dy:n.height,t:'s',c:'s-resize'},{dx:0,dy:n.height/2,t:'w',c:'w-resize'},{dx:n.width,dy:n.height/2,t:'e',c:'e-resize'}];
n._rh=defs.map(d=>({x:n.x+d.dx-s/2,y:n.y+d.dy-s/2,w:s,h:s,type:d.t,cursor:d.c}));
defs.forEach(d=>{ctx.fillStyle='#007AFF';ctx.beginPath();ctx.arc(n.x+d.dx,n.y+d.dy,s/2,0,2*Math.PI);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();});}

function drawCPs(n){cPts(n).forEach(p=>{const h=hCP&&hCP.side===p.side&&hNode===n;const r=h?9:6;ctx.shadowColor='rgba(48,209,88,0.5)';ctx.shadowBlur=h?12:6;ctx.fillStyle=h?'#28c840':'#30D158';ctx.beginPath();ctx.arc(p.x,p.y,r,0,2*Math.PI);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,h?3:2,0,2*Math.PI);ctx.fill();});ctx.shadowColor='transparent';}

function sOff(pt,s,d){switch(s){case'right':return{x:pt.x+d,y:pt.y};case'left':return{x:pt.x-d,y:pt.y};case'bottom':return{x:pt.x,y:pt.y+d};case'top':return{x:pt.x,y:pt.y-d};default:return{x:pt.x+d,y:pt.y};}}

function drawConn(c,sel){const fn=nodes.find(n=>n.id===c.from),tn=nodes.find(n=>n.id===c.to);if(!fn||!tn)return;
const fp=cPts(fn).find(p=>p.side===c.fromSide)||cPts(fn)[1],tp=cPts(tn).find(p=>p.side===c.toSide)||cPts(tn)[3];
const dist=Math.max(60,Math.hypot(tp.x-fp.x,tp.y-fp.y)*0.45),fc=sOff(fp,c.fromSide,dist),tc=sOff(tp,c.toSide,dist);
const col=c.color||(sel?C('#60a5fa','#3b82f6'):C('#4a7fa0','#8ab4d4'));
ctx.strokeStyle=col;ctx.lineWidth=sel?2.5:1.8;
if(c.style==='dashed')ctx.setLineDash([8,4]);else if(c.style==='dotted')ctx.setLineDash([3,3]);else ctx.setLineDash(sel?[6,4]:[]);
ctx.beginPath();ctx.moveTo(fp.x,fp.y);ctx.bezierCurveTo(fc.x,fc.y,tc.x,tc.y,tp.x,tp.y);ctx.stroke();ctx.setLineDash([]);
const ang=Math.atan2(tp.y-tc.y,tp.x-tc.x),al=12,aa=Math.PI/6;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(tp.x,tp.y);ctx.lineTo(tp.x-al*Math.cos(ang-aa),tp.y-al*Math.sin(ang-aa));ctx.lineTo(tp.x-al*0.5*Math.cos(ang),tp.y-al*0.5*Math.sin(ang));ctx.lineTo(tp.x-al*Math.cos(ang+aa),tp.y-al*Math.sin(ang+aa));ctx.closePath();ctx.fill();
if(c.label){const mx=(fp.x+tp.x)/2,my=(fp.y+tp.y)/2;ctx.font=`500 11px ${FB}`;const tw=ctx.measureText(c.label).width;ctx.fillStyle=C('rgba(28,28,30,0.9)','rgba(255,255,255,0.9)');rR(mx-tw/2-6,my-8,tw+12,18,6);ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1;rR(mx-tw/2-6,my-8,tw+12,18,6);ctx.stroke();ctx.fillStyle=C('#f5f5f7','#1c1c1e');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.label,mx,my+1);}}

// FIX 5: Optimized drawGrid with performance guards
function drawGrid(){
  // Grid wird jetzt relativ zum aktuellen Viewport-Kontext gezeichnet
  // Der Kontext ist hier bereits durch render() transformiert (translate/scale)
  // ABER: drawGrid wird in render() VOR dem translate/scale aufgerufen? 
  // Nein, in Zeile 583: ctx.translate(vx,vy); ctx.scale(vs,vs); if(showGrid)drawGrid();
  // Also sind wir bereits im transformierten Raum. 
  
  const dpr = window.devicePixelRatio || 1;
  
  // Berechnung des sichtbaren Bereichs im WELT-Koordinatensystem (vor Transformation)
  // Da wir bereits transformiert sind, müssen wir rückwärts rechnen oder einfach die globalen Grenzen nutzen
  // Einfacher: Wir nutzen die Canvas-Größe und rechnen zurück
  
  // Aktuelle Viewport-Grenzen in Weltkoordinaten
  const worldLeft = -vx / vs;
  const worldTop = -vy / vs;
  const worldRight = worldLeft + (canvas.width / dpr) / vs;
  const worldBottom = worldTop + (canvas.height / dpr) / vs;
  
  const gridArea = (worldRight - worldLeft) * (worldBottom - worldTop);
  const skipMinorGrid = gridArea > 1000000;
  
  // Hilfsfunktion für scharfe Linien (Snap to Pixel im Viewport)
  const snapToPixel = (val) => Math.round(val * vs * dpr) / (vs * dpr);

  if (!skipMinorGrid) {
    ctx.strokeStyle = C('rgba(255,255,255,0.05)','rgba(0,0,0,0.07)');
    ctx.lineWidth = 1 / vs; // Damit bleibt die Linie immer 1px dick auf dem Screen
    ctx.beginPath();
    
    // Minor Grid Vertikal
    for(let x = Math.floor(worldLeft/GRID)*GRID; x <= worldRight; x += GRID) {
      if(x % GRID_MAJOR === 0) continue;
      const drawX = snapToPixel(x);
      ctx.moveTo(drawX, worldTop);
      ctx.lineTo(drawX, worldBottom);
    }
    // Minor Grid Horizontal
    for(let y = Math.floor(worldTop/GRID)*GRID; y <= worldBottom; y += GRID) {
      if(y % GRID_MAJOR === 0) continue;
      const drawY = snapToPixel(y);
      ctx.moveTo(worldLeft, drawY);
      ctx.lineTo(worldRight, drawY);
    }
    ctx.stroke();
  }
  
  // Major grid (immer zeichnen)
  ctx.strokeStyle = C('rgba(255,255,255,0.1)','rgba(0,0,0,0.12)');
  ctx.lineWidth = 1.5 / vs; // Etwas dicker für bessere Sichtbarkeit
  ctx.beginPath();
  
  for(let x = Math.floor(worldLeft/GRID_MAJOR)*GRID_MAJOR; x <= worldRight; x += GRID_MAJOR) {
    const drawX = snapToPixel(x);
    ctx.moveTo(drawX, worldTop);
    ctx.lineTo(drawX, worldBottom);
  }
  for(let y = Math.floor(worldTop/GRID_MAJOR)*GRID_MAJOR; y <= worldBottom; y += GRID_MAJOR) {
    const drawY = snapToPixel(y);
    ctx.moveTo(worldLeft, drawY);
    ctx.lineTo(worldRight, drawY);
  }
  ctx.stroke();
  
  // Dots nur bei vernünftigem Zoom und nicht zu viel Fläche
  if(vs > 0.3 && gridArea < 500000) {
    ctx.fillStyle = C('rgba(255,255,255,0.15)','rgba(0,0,0,0.15)');
    for(let x = Math.floor(worldLeft/GRID_MAJOR)*GRID_MAJOR; x <= worldRight; x += GRID_MAJOR) {
      for(let y = Math.floor(worldTop/GRID_MAJOR)*GRID_MAJOR; y <= worldBottom; y += GRID_MAJOR) {
        // Kein SnapToPixel für Dots, damit sie exakt auf der Koordinate bleiben
        ctx.beginPath();
        ctx.arc(x, y, 2 / vs, 0, 2*Math.PI); // Radius skalieren, damit er konstant wirkt
        ctx.fill();
      }
    }
  }
  
  // Origin marker (nur wenn sichtbar)
  if(worldLeft <= 0 && worldRight >= 0 && worldTop <= 0 && worldBottom >= 0) {
    ctx.fillStyle = C('rgba(0,122,255,0.25)','rgba(0,122,255,0.2)');
    ctx.beginPath();
    ctx.arc(0, 0, 4 / vs, 0, 2*Math.PI);
    ctx.fill();
  }
  
  // Snap dots (nur bei gutem Zoom)
  if(snap && vs > 0.15) {
    ctx.fillStyle = C('rgba(0,122,255,0.2)','rgba(0,122,255,0.15)');
    for(let x = Math.floor(worldLeft/SNAP)*SNAP; x <= worldRight; x += SNAP) {
      for(let y = Math.floor(worldTop/SNAP)*SNAP; y <= worldBottom; y += SNAP) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 / vs, 0, 2*Math.PI);
        ctx.fill();
      }
    }
  }
}

function render(){const dpr=window.devicePixelRatio||1,cssW=canvas.width/dpr,cssH=canvas.height/dpr;ctx.clearRect(0,0,cssW,cssH);ctx.fillStyle=C('#1c1c1e','#f2f2f7');ctx.fillRect(0,0,cssW,cssH);ctx.save();ctx.translate(vx,vy);ctx.scale(vs,vs);if(showGrid)drawGrid();
const margin=200,vl=-vx/vs-margin,vt=-vy/vs-margin,vr=vl+cssW/vs+margin*2,vb=vt+cssH/vs+margin*2;
const inVP=n=>n.x+n.width>vl&&n.x<vr&&n.y+n.height>vt&&n.y<vb;
nodes.filter(n=>n.type==='group'&&inVP(n)).forEach(n=>drawNode(n));conns.forEach(c=>drawConn(c,selC&&selC.id===c.id));nodes.filter(n=>n.type!=='group'&&inVP(n)).forEach(n=>drawNode(n));
if(isConn&&cStart){const cp=cStartPt||{x:cStart.x+cStart.width/2,y:cStart.y+cStart.height/2};const mx=(lMX-vx)/vs,my=(lMY-vy)/vs;ctx.strokeStyle='#30D158';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(cp.x,cp.y);ctx.lineTo(mx,my);ctx.stroke();ctx.setLineDash([]);}
if(isSel&&sRect){ctx.fillStyle=C('rgba(0,122,255,0.06)','rgba(0,122,255,0.08)');ctx.fillRect(sRect.x,sRect.y,sRect.w,sRect.h);ctx.strokeStyle='#007AFF';ctx.lineWidth=1/vs;ctx.setLineDash([4/vs,3/vs]);ctx.strokeRect(sRect.x,sRect.y,sRect.w,sRect.h);ctx.setLineDash([]);}
// FIX S7: Remote-Cursor zeichnen (in Welt-Koordinaten, im transformierten Context)
if(typeof LiveRoom!=='undefined'&&LiveRoom.remoteCursors){
  const cursors=Object.entries(LiveRoom.remoteCursors);
  if(cursors.length){
    const r=8/vs,labelOff=14/vs;
    ctx.font=`${Math.max(10,11/vs)}px ${FB}`;
    cursors.forEach(([id,c])=>{
      // Pfeil-Cursor (Dreieck)
      ctx.fillStyle=c.color;ctx.strokeStyle='#fff';ctx.lineWidth=1.5/vs;
      ctx.beginPath();
      ctx.moveTo(c.x,c.y);
      ctx.lineTo(c.x+r*1.6,c.y+r*0.8);
      ctx.lineTo(c.x+r*0.8,c.y+r*0.9);
      ctx.lineTo(c.x+r*0.5,c.y+r*1.7);
      ctx.closePath();ctx.fill();ctx.stroke();
      // Name-Label
      const txt=c.name||'peer';
      const padX=4/vs,padY=2/vs,tw=ctx.measureText(txt).width;
      ctx.fillStyle=c.color;
      rR(c.x+labelOff,c.y+labelOff,tw+padX*2,12/vs+padY*2,3/vs);ctx.fill();
      ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(txt,c.x+labelOff+padX,c.y+labelOff+(12/vs+padY*2)/2);
    });
  }
}
ctx.restore();uSB();}

function renderMM(){const mw=180,mh=120;mmC.width=mw;mmC.height=mh;mmX.clearRect(0,0,mw,mh);mmX.fillStyle=C('rgba(28,28,30,0.95)','rgba(242,242,247,0.95)');mmX.fillRect(0,0,mw,mh);
if(!nodes.length)return;let mXn=Infinity,mYn=Infinity,MXn=-Infinity,MYn=-Infinity;nodes.forEach(n=>{mXn=Math.min(mXn,n.x);mYn=Math.min(mYn,n.y);MXn=Math.max(MXn,n.x+n.width);MYn=Math.max(MYn,n.y+n.height);});
const p=30,bw=MXn-mXn+p*2||1,bh=MYn-mYn+p*2||1,s=Math.min(mw/bw,mh/bh),ox=(mw-bw*s)/2-mXn*s+p*s,oy=(mh-bh*s)/2-mYn*s+p*s;
mmX.strokeStyle=C('rgba(74,127,160,0.4)','rgba(138,180,212,0.4)');mmX.lineWidth=1;
conns.forEach(c=>{const fn=nodes.find(n=>n.id===c.from),tn=nodes.find(n=>n.id===c.to);if(!fn||!tn)return;mmX.beginPath();mmX.moveTo(ox+(fn.x+fn.width/2)*s,oy+(fn.y+fn.height/2)*s);mmX.lineTo(ox+(tn.x+tn.width/2)*s,oy+(tn.y+tn.height/2)*s);mmX.stroke();});
nodes.forEach(n=>{const col=n.isSelected?'#007AFF':(n.type==='sticky'?'#FFD60A':n.type==='link'?'#5AC8FA':n.type==='group'?C('rgba(255,255,255,0.08)','rgba(0,0,0,0.06)'):C('rgba(120,120,128,0.5)','rgba(120,120,128,0.3)'));mmX.fillStyle=col;
if(n.type==='link'){const cr=Math.max(2,Math.min(n.width,n.height)*s/2);mmX.beginPath();mmX.arc(ox+(n.x+n.width/2)*s,oy+(n.y+n.height/2)*s,cr,0,2*Math.PI);mmX.fill();}
else mmX.fillRect(ox+n.x*s,oy+n.y*s,Math.max(2,n.width*s),Math.max(2,n.height*s));});
const {w:cssW,h:cssH}=getCanvasCssSize();const vl=-vx/vs,vt=-vy/vs;mmX.strokeStyle='#007AFF';mmX.lineWidth=1.5;mmX.strokeRect(ox+vl*s,oy+vt*s,cssW/vs*s,cssH/vs*s);}

$minimap.addEventListener('mousedown',e=>{if(!nodes.length)return;const r=e.target.closest('#minimap').getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;
let mXn=Infinity,mYn=Infinity,MXn=-Infinity,MYn=-Infinity;nodes.forEach(n=>{mXn=Math.min(mXn,n.x);mYn=Math.min(mYn,n.y);MXn=Math.max(MXn,n.x+n.width);MYn=Math.max(MYn,n.y+n.height);});
const p=30,bw=MXn-mXn+p*2||1,bh=MYn-mYn+p*2||1,s=Math.min(180/bw,120/bh),ox=(180-bw*s)/2-mXn*s+p*s,oy=(120-bh*s)/2-mYn*s+p*s;
const {w:cssW,h:cssH}=getCanvasCssSize();vx=cssW/2-((mx-ox)/s)*vs;vy=cssH/2-((my-oy)/s)*vs;sR();});

function expPNG(){
  if(!nodes.length){toast('Leer');return;}
  let mX=Infinity,mY=Infinity,MX=-Infinity,MY=-Infinity;
  nodes.forEach(n=>{
    mX=Math.min(mX,n.x); mY=Math.min(mY,n.y);
    MX=Math.max(MX,n.x+n.width); MY=Math.max(MY,n.y+n.height);
  });
  const pad=60, expW=MX-mX+pad*2, expH=MY-mY+pad*2, expScale=2;

  const _vx=vx,_vy=vy,_vs=vs,_sg=showGrid;
  rafP=true;

  canvas.width  = Math.round(expW * expScale);
  canvas.height = Math.round(expH * expScale);

  ctx.setTransform(1,0,0,1,0,0);

  vx = pad * expScale - mX * expScale;
  vy = pad * expScale - mY * expScale;
  vs = expScale;
  showGrid = false;

  ctx.fillStyle=C('#1c1c1e','#f2f2f7');
  ctx.fillRect(0,0,canvas.width,canvas.height);

  render();

  function _restoreCanvas(){vx=_vx;vy=_vy;vs=_vs;showGrid=_sg;rafP=false;resizeCV();}
  try{
    canvas.toBlob(blob=>{
      if(!blob){toast('❌ Export fehlgeschlagen');_restoreCanvas();return;}
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.download='canvas-'+Date.now()+'.png';
      a.href=url; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      toast('PNG ↓ (2×)');
      _restoreCanvas();
    },'image/png');
  }catch(e){
    toast('❌ PNG-Export Fehler: '+e.message);
    _restoreCanvas();
  }
}

// ===== SVG EXPORT (v0.24) =====
function expSVG(){
  if(!nodes.length){toast('Leer');return;}
  let mX=Infinity,mY=Infinity,MX=-Infinity,MY=-Infinity;
  nodes.forEach(n=>{mX=Math.min(mX,n.x);mY=Math.min(mY,n.y);MX=Math.max(MX,n.x+n.width);MY=Math.max(MY,n.y+n.height);});
  const pad=40,w=MX-mX+pad*2,h=MY-mY+pad*2;
  const bg=isDark?'#1c1c1e':'#f2f2f7';
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'&#10;');
  const parts=[`<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter,system-ui,sans-serif">`,
    `<rect width="100%" height="100%" fill="${bg}"/>`,
    `<g transform="translate(${pad-mX},${pad-mY})">`];
  // Connections first
  conns.forEach(c=>{
    const fn=nodes.find(n=>n.id===c.from),tn=nodes.find(n=>n.id===c.to);if(!fn||!tn)return;
    const fp=cPts(fn).find(p=>p.side===c.fromSide)||cPts(fn)[1];
    const tp=cPts(tn).find(p=>p.side===c.toSide)||cPts(tn)[3];
    const dist=Math.max(60,Math.hypot(tp.x-fp.x,tp.y-fp.y)*0.45);
    const fc=sOff(fp,c.fromSide,dist),tc=sOff(tp,c.toSide,dist);
    const col=c.color||(isDark?'#4a7fa0':'#8ab4d4');
    const dash=c.style==='dashed'?'8,4':(c.style==='dotted'?'3,3':'');
    parts.push(`<path d="M${fp.x},${fp.y} C${fc.x},${fc.y} ${tc.x},${tc.y} ${tp.x},${tp.y}" fill="none" stroke="${col}" stroke-width="1.8"${dash?` stroke-dasharray="${dash}"`:''}/>`);
    const ang=Math.atan2(tp.y-tc.y,tp.x-tc.x),al=12,aa=Math.PI/6;
    const ax1=tp.x-al*Math.cos(ang-aa),ay1=tp.y-al*Math.sin(ang-aa);
    const ax2=tp.x-al*Math.cos(ang+aa),ay2=tp.y-al*Math.sin(ang+aa);
    parts.push(`<polygon points="${tp.x},${tp.y} ${ax1},${ay1} ${ax2},${ay2}" fill="${col}"/>`);
    if(c.label){const mx=(fp.x+tp.x)/2,my=(fp.y+tp.y)/2;
      parts.push(`<rect x="${mx-c.label.length*3.5-6}" y="${my-8}" width="${c.label.length*7+12}" height="18" rx="6" fill="${isDark?'#1c1c1e':'#fff'}" stroke="${col}"/>`);
      parts.push(`<text x="${mx}" y="${my+4}" text-anchor="middle" font-size="11" fill="${isDark?'#f5f5f7':'#1c1c1e'}">${esc(c.label)}</text>`);}
  });
  // Nodes
  nodes.forEach(n=>{
    const tc=esc(n.textColor||'#fff'),bc=esc(n.border||'#48484a'),bg=esc(n.bg||'#2c2c2e');
    if(n.type==='link'){const r=Math.min(n.width,n.height)/2,cx=n.x+n.width/2,cy=n.y+n.height/2;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${bc}" stroke-width="1.5"/>`);
      parts.push(`<text x="${cx}" y="${cy+r*0.55}" text-anchor="middle" font-size="11" fill="${tc}">${esc((n.text||'').slice(0,16))}</text>`);
    } else if(n.type==='ellipse'){
      parts.push(`<ellipse cx="${n.x+n.width/2}" cy="${n.y+n.height/2}" rx="${n.width/2}" ry="${n.height/2}" fill="${bg}" stroke="${bc}" stroke-width="1.5"/>`);
      parts.push(`<text x="${n.x+n.width/2}" y="${n.y+n.height/2+4}" text-anchor="middle" font-size="13" fill="${tc}">${esc((n.text||'').split('\n')[0].slice(0,24))}</text>`);
    } else if(n.type==='diamond'){const cx=n.x+n.width/2,cy=n.y+n.height/2;
      parts.push(`<polygon points="${cx},${n.y} ${n.x+n.width},${cy} ${cx},${n.y+n.height} ${n.x},${cy}" fill="${bg}" stroke="${bc}" stroke-width="1.5"/>`);
      parts.push(`<text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="13" fill="${tc}">${esc((n.text||'').split('\n')[0].slice(0,24))}</text>`);
    } else if(n.type==='hexagon'){const cx=n.x+n.width/2,cy=n.y+n.height/2,rx=n.width/2,ry=n.height/2;
      let pts='';for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/2;pts+=`${cx+rx*Math.cos(a)},${cy+ry*Math.sin(a)} `;}
      parts.push(`<polygon points="${pts.trim()}" fill="${bg}" stroke="${bc}" stroke-width="1.5"/>`);
      parts.push(`<text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="13" fill="${tc}">${esc((n.text||'').split('\n')[0].slice(0,24))}</text>`);
    } else if(n.type==='group'){
      parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="16" fill="${bg}" stroke="${bc}" stroke-width="1.5" stroke-dasharray="8,5"/>`);
      parts.push(`<text x="${n.x+12}" y="${n.y+22}" font-size="12" font-weight="600" fill="${tc}">${esc(n.text||'Bereich')}</text>`);
    } else {
      const r=n.type==='sticky'?6:12;
      parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${r}" fill="${bg}" stroke="${bc}" stroke-width="1"/>`);
      const lines=(n.text||'').split('\n').slice(0,8);
      lines.forEach((l,i)=>{parts.push(`<text x="${n.x+12}" y="${n.y+24+i*18}" font-size="13" fill="${tc}">${esc(l.slice(0,40))}</text>`);});
    }
  });
  parts.push('</g></svg>');
  const blob=new Blob([parts.join('\n')],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.download='canvas-'+Date.now()+'.svg';a.href=url;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  toast('SVG ↓');
}

// ===== AUTO-GRID FOR SELECTION (v0.24) =====
function autoGrid(arr){
  if(!arr||arr.length<2)return;
  const sorted=arr.slice().sort((a,b)=>(a.y-b.y)||(a.x-b.x));
  const cols=Math.ceil(Math.sqrt(sorted.length));
  const gap=24;
  const maxW=Math.max(...sorted.map(n=>n.width));
  const maxH=Math.max(...sorted.map(n=>n.height));
  const startX=sorted[0].x,startY=sorted[0].y;
  sorted.forEach((n,i)=>{if(n.locked)return;const r=Math.floor(i/cols),c=i%cols;n.x=snV(startX+c*(maxW+gap));n.y=snV(startY+r*(maxH+gap));});
  pH();aS();sR();toast('📐 Auto-Grid ('+sorted.length+')');
}

// ===== FOCUS ON SELECTION (v0.24) =====
function focusOnSelection(){
  if(!selN.length)return;
  let mX=Infinity,mY=Infinity,MX=-Infinity,MY=-Infinity;
  selN.forEach(n=>{mX=Math.min(mX,n.x);mY=Math.min(mY,n.y);MX=Math.max(MX,n.x+n.width);MY=Math.max(MY,n.y+n.height);});
  const p=120,bw=MX-mX+p*2,bh=MY-mY+p*2;
  const{w,h}=getCanvasCssSize();
  vs=Math.max(0.2,Math.min(Math.min(w/bw,(h-30)/bh),2.5));
  vx=w/2-(mX+MX)/2*vs;vy=(h-30)/2-(mY+MY)/2*vs;
  sR();toast('🎯 Fokus');
}

// ===== HELP MODAL (v0.24) =====
function openHelp(){document.getElementById('help-modal').classList.add('open');}
function closeHelp(){document.getElementById('help-modal').classList.remove('open');}

function resizeCV(){
  const dpr=window.devicePixelRatio||1;
  const w=window.innerWidth,h=window.innerHeight;
  canvas.width=Math.round(w*dpr);
  canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';
  canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  sR();
}
window.addEventListener('resize',resizeCV);
window.addEventListener('blur',resetInteractionState);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInteractionState();});

function updateThemeBtn(){document.getElementById('btn-theme').textContent=isDark?'🌙':'☀️';}
function initCanvas(){resizeCV();refreshSavedBadge();updateThemeBtn();

canvas.addEventListener('contextmenu',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();const{x:cx,y:cy}=s2c(e.clientX-r.left,e.clientY-r.top);showCM(e.clientX,e.clientY,nAt(cx,cy));});

canvas.addEventListener('mousedown',e=>{if(window.PointerEvent)return;closeDD();closeCM();closeCLE();closeTblEd();
const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const{x:cx,y:cy}=s2c(mx,my);onCv=true;const node=nAt(cx,cy);
if(!node){const c=cAt(cx,cy);if(c){clrS();selC=c;sR();return;}}
if(node){
if(node.type==='checklist'&&!e.shiftKey){const idx=chkAt(node,cx,cy);if(idx>=0){node.typeData.items[idx].checked=!node.typeData.items[idx].checked;pH();aS();sR();return;}}
const cp=cpAt(node,cx,cy);if(e.shiftKey&&cp){isConn=true;cStart=node;cStartPt=cp;clrS();isDrag=false;lMX=mx;lMY=my;sR();return;}
if(!node.locked){const rh=node._rh?.find(h=>cx>=h.x&&cx<=h.x+h.w&&cy>=h.y&&cy<=h.y+h.h);if(rh&&!e.shiftKey){isRz=true;rzN=node;rzH=rh;rzSX=cx;rzSY=cy;rzSW=node.width;rzSH=node.height;rzNX=node.x;rzNY=node.y;isDrag=false;lMX=mx;lMY=my;return;}}
if(node._sb){const sb=node._sb;if(cx>=sb.x&&cx<=sb.x+sb.w&&cy>=sb.y&&cy<=sb.y+sb.h){isSB=true;sbN=node;sbOff=cy-sb.tY;isDrag=false;lMX=mx;lMY=my;return;}}
if(e.ctrlKey||e.metaKey)togS(node);else if(e.shiftKey&&selN.length>0)addS(node);else selOne(node);
if(node.isSelected&&!node.locked){isND=true;dNode=node;dOX=cx-node.x;dOY=cy-node.y;}
}else{
  // === FIX v0.18: Strg+LeftClick Panning ===
  if((e.ctrlKey||e.metaKey)&&(e.button===0||e.button===undefined)){isPan=true;clrS();isDrag=true;moved=false;canvas.style.cursor='grab';}
  else if(e.button===1||e.altKey){isPan=true;if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey)clrS();}
  else{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey)clrS();isSel=true;sStart={x:cx,y:cy};sRect=null;}
}
lMX=mx;lMY=my;isDrag=true;moved=false;sR();});

canvas.addEventListener('mousemove',e=>{if(window.PointerEvent)return;const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const{x:cx,y:cy}=s2c(mx,my);
hNode=nAt(cx,cy);hCP=hNode?cpAt(hNode,cx,cy):null;
if(isRz)setCursor(rzH.cursor);else if(isSB)setCursor('ns-resize');else if(isConn)setCursor('crosshair');else if(hCP&&e.shiftKey)setCursor('copy');else if(hNode){const rh=hNode._rh?.find(h=>cx>=h.x&&cx<=h.x+h.w&&cy>=h.y&&cy<=h.y+h.h);setCursor(rh?rh.cursor:(hNode.locked?'not-allowed':'grab'));}else setCursor('default');
const dx=mx-lMX,dy=my-lMY;if(Math.abs(dx)>1||Math.abs(dy)>1)moved=true;applyDrag(cx,cy,dx,dy);lMX=mx;lMY=my;sR();});

canvas.addEventListener('mouseleave',()=>{if(window.PointerEvent)return;onCv=false;hNode=null;hCP=null;setCursor('default');sR();});
document.addEventListener('mousemove',e=>{if(window.PointerEvent)return;if(onCv)return;const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const{x:cx,y:cy}=s2c(mx,my);const dx=mx-lMX,dy=my-lMY;if(Math.abs(dx)>1||Math.abs(dy)>1)moved=true;applyDrag(cx,cy,dx,dy);lMX=mx;lMY=my;sR();});

function applyDrag(cx,cy,dx,dy){
if(isRz&&rzN&&rzH){const ddx=cx-rzSX,ddy=cy-rzSY;let nx=rzNX,ny=rzNY,nw=rzSW,nh=rzSH;
switch(rzH.type){case'se':nw=Math.max(MNW,rzSW+ddx);nh=Math.max(MNH,rzSH+ddy);break;case'sw':nw=Math.max(MNW,rzSW-ddx);nh=Math.max(MNH,rzSH+ddy);nx=rzNX+rzSW-nw;break;case'ne':nw=Math.max(MNW,rzSW+ddx);nh=Math.max(MNH,rzSH-ddy);ny=rzNY+rzSH-nh;break;case'nw':nw=Math.max(MNW,rzSW-ddx);nh=Math.max(MNH,rzSH-ddy);nx=rzNX+rzSW-nw;ny=rzNY+rzSH-nh;break;case'e':nw=Math.max(MNW,rzSW+ddx);break;case'w':nw=Math.max(MNW,rzSW-ddx);nx=rzNX+rzSW-nw;break;case's':nh=Math.max(MNH,rzSH+ddy);break;case'n':nh=Math.max(MNH,rzSH-ddy);ny=rzNY+rzSH-nh;break;}
rzN.x=nx;rzN.y=ny;rzN.width=nw;rzN.height=nh;}
else if(isSB&&sbN){const sb=sbN._sb;if(sb){const rel=cy-sbOff-sb.y,mT=sb.h-sb.tH;sbN.scrollY=mT>0?(Math.max(0,Math.min(rel,mT))/mT)*sbN._ms:0;}}
else if(isDrag){if(isSel){const mX=Math.min(sStart.x,cx),mY=Math.min(sStart.y,cy);sRect={x:mX,y:mY,w:Math.abs(cx-sStart.x),h:Math.abs(cy-sStart.y)};}
else if(isND&&dNode){const ndx=(cx-dOX)-dNode.x,ndy=(cy-dOY)-dNode.y;const moveSet=new Set();selN.forEach(n=>{if(!n.locked)moveSet.add(n);});selN.forEach(n=>{if(n.type==='group'&&!n.locked){nodes.forEach(c=>{if(c!==n&&!c.locked&&!c.isSelected&&c.x>=n.x&&c.y>=n.y&&c.x+c.width<=n.x+n.width&&c.y+c.height<=n.y+n.height)moveSet.add(c);});}});moveSet.forEach(n=>{n.x=snV(n.x+ndx);n.y=snV(n.y+ndy);});}
// P2P Share: Drag-Daten für Share Dock vorbereiten
if (isND && dNode && selN.length > 0) {
  draggedNodesForShare = {
    nodes: selN.map(n => ({...cN(n)})),
    connections: conns.filter(c => selN.some(sn => sn.id === c.from || sn.id === c.to)).map(c => ({...c}))
  };
}
else if(isPan){vx+=dx;vy+=dy;}}}

document.addEventListener('mouseup',e=>{if(window.PointerEvent)return;
if(isRz){isRz=false;if(rzN){pH();aS();}rzN=null;rzH=null;sR();return;}
if(isSB){isSB=false;sbN=null;sR();return;}
if(isConn&&cStart){const r=canvas.getBoundingClientRect();const{x:cx,y:cy}=s2c(e.clientX-r.left,e.clientY-r.top);const target=nAt(cx,cy);
if(target&&target!==cStart){const tp=cpAt(target,cx,cy);const{fromSide,toSide}=bSides(cStart,target);conns.push({id:'c'+Date.now(),from:cStart.id,to:target.id,fromSide:cStartPt?.side||fromSide,toSide:tp?.side||toSide,label:'',style:'solid',color:''});pH();aS();uSB();emit('connectionCreated',{from:cStart.id,to:target.id});}
isConn=false;cStart=null;cStartPt=null;setCursor('default');}
if(isSel){if(sRect&&(sRect.w>4||sRect.h>4)){const sel=nInR(sRect.x,sRect.y,sRect.w,sRect.h);if(e.ctrlKey||e.metaKey||e.shiftKey)sel.forEach(n=>addS(n));else{clrS();sel.forEach(n=>addS(n));}}isSel=false;sRect=null;}
if(dNode&&!moved)selOne(dNode);if(isND&&moved){pH();aS();emit('nodeMoved',{count:selN.length});}
// P2P Share: Drag-Daten nach erfolgreichem Drag zurücksetzen
isDrag=false;isND=false;isPan=false;dNode=null;moved=false;sR();});

// P2P Share: HTML5 Drag & Drop für Node-Export
canvas.addEventListener('dragstart', e => {
  if (selN.length > 0 && draggedNodesForShare) {
    e.dataTransfer.setData('application/board-nodes', JSON.stringify(draggedNodesForShare));
    e.dataTransfer.effectAllowed = 'copy';
    toast(`📦 ${selN.length} Node(s) zum Teilen bereit`);
  }
});

// FIX 6: Improved wheel throttle (16ms = 60fps)
let lastWheelTS=0;
const WHEEL_THROTTLE_MS = 16;
canvas.addEventListener('wheel',e=>{e.preventDefault();const now=performance.now();if(now-lastWheelTS<WHEEL_THROTTLE_MS)return;lastWheelTS=now;const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const{x:cx,y:cy}=s2c(mx,my);const hn=nAt(cx,cy);
if(hn&&hn._ms>0&&!e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaX)<Math.abs(e.deltaY)){hn.scrollY=Math.max(0,Math.min(hn.scrollY+e.deltaY*0.35,hn._ms));sR();return;}
if(!e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaX)>0&&Math.abs(e.deltaX)<80&&Math.abs(e.deltaY)<80){vx-=e.deltaX;vy-=e.deltaY;sR();return;}
if(e.ctrlKey||e.metaKey||Math.abs(e.deltaY)>5){const f=e.deltaY>0?0.92:1.09;const ns=Math.max(0.08,Math.min(6,vs*f));vx-=(mx-vx)*(ns-vs)/vs;vy-=(my-vy)*(ns-vs)/vs;vs=ns;sR();}},{passive:false});

canvas.addEventListener('dblclick',e=>{const r=canvas.getBoundingClientRect();const{x:cx,y:cy}=s2c(e.clientX-r.left,e.clientY-r.top);const n=nAt(cx,cy);
if(!n){const c=cAt(cx,cy);if(c){openCLE(c,e.clientX,e.clientY);return;}}
if(n){if(n.type==='checklist')openCLEd(n);else if(n.type==='table')openTblEd(n);else if(n.type==='link')editLink(n);else if(n.type==='image')openImageAction(n);else editNT(n);}else addN('text',cx-125,cy-60);});

// Pointer Events
canvas.addEventListener('pointerdown',e=>{if(!window.PointerEvent||!canHandlePointer(e))return;activePointerId=e.pointerId;try{canvas.setPointerCapture(e.pointerId);}catch(_){ }closeDD();closeCM();closeCLE();closeTblEd();
const{mx,my}=getLocalPoint(e);const{x:cx,y:cy}=s2c(mx,my);onCv=true;const node=nAt(cx,cy);
if(!node){const c=cAt(cx,cy);if(c){clrS();selC=c;sR();return;}}
if(node){
if(node.type==='checklist'&&!e.shiftKey){const idx=chkAt(node,cx,cy);if(idx>=0){node.typeData.items[idx].checked=!node.typeData.items[idx].checked;pH();aS();sR();return;}}
const cp=cpAt(node,cx,cy);if(e.shiftKey&&cp){isConn=true;cStart=node;cStartPt=cp;clrS();isDrag=false;lMX=mx;lMY=my;sR();return;}
if(!node.locked){const rh=node._rh?.find(h=>cx>=h.x&&cx<=h.x+h.w&&cy>=h.y&&cy<=h.y+h.h);if(rh&&!e.shiftKey){isRz=true;rzN=node;rzH=rh;rzSX=cx;rzSY=cy;rzSW=node.width;rzSH=node.height;rzNX=node.x;rzNY=node.y;isDrag=false;lMX=mx;lMY=my;return;}}
if(node._sb){const sb=node._sb;if(cx>=sb.x&&cx<=sb.x+sb.w&&cy>=sb.y&&cy<=sb.y+sb.h){isSB=true;sbN=node;sbOff=cy-sb.tY;isDrag=false;lMX=mx;lMY=my;return;}}
if(e.ctrlKey||e.metaKey)togS(node);else if(e.shiftKey&&selN.length>0)addS(node);else selOne(node);
if(node.isSelected&&!node.locked){isND=true;dNode=node;dOX=cx-node.x;dOY=cy-node.y;}
}else{
  // === FIX v0.18: Strg+LeftClick Panning ===
  if((e.ctrlKey||e.metaKey)&&(e.button===0||e.button===undefined)){isPan=true;clrS();isDrag=true;moved=false;canvas.style.cursor='grab';}
  else if(e.button===1||e.altKey){isPan=true;if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey)clrS();}
  else{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey)clrS();isSel=true;sStart={x:cx,y:cy};sRect=null;}
}
lMX=mx;lMY=my;isDrag=true;moved=false;sR();});

// FIX S7: Cursor-Broadcast (immer aktiv, unabhängig von Drag-State)
canvas.addEventListener('pointermove',e=>{
  if(typeof LiveRoom!=='undefined'&&LiveRoom.peer){
    const{mx,my}=getLocalPoint(e);
    const{x:cx,y:cy}=s2c(mx,my);
    LiveRoom.sendCursor(cx,cy);
  }
},{passive:true});

canvas.addEventListener('pointermove',e=>{if(!window.PointerEvent||activePointerId!==e.pointerId)return;const{mx,my}=getLocalPoint(e);const{x:cx,y:cy}=s2c(mx,my);
hNode=nAt(cx,cy);hCP=hNode?cpAt(hNode,cx,cy):null;
if(isRz)setCursor(rzH.cursor);else if(isSB)setCursor('ns-resize');else if(isConn)setCursor('crosshair');else if(hCP&&e.shiftKey)setCursor('copy');else if(hNode){const rh=hNode._rh?.find(h=>cx>=h.x&&cx<=h.x+h.w&&cy>=h.y&&cy<=h.y+h.h);setCursor(rh?rh.cursor:(hNode.locked?'not-allowed':'grab'));}else setCursor('default');
const dx=mx-lMX,dy=my-lMY;if(Math.abs(dx)>1||Math.abs(dy)>1)moved=true;applyDrag(cx,cy,dx,dy);lMX=mx;lMY=my;sR();});

canvas.addEventListener('pointerup',e=>{if(!window.PointerEvent||activePointerId!==e.pointerId)return;
if(isRz){isRz=false;if(rzN){pH();aS();}rzN=null;rzH=null;activePointerId=null;sR();return;}
if(isSB){isSB=false;sbN=null;activePointerId=null;sR();return;}
if(isConn&&cStart){const{mx,my}=getLocalPoint(e);const{x:cx,y:cy}=s2c(mx,my);const target=nAt(cx,cy);
if(target&&target!==cStart){const tp=cpAt(target,cx,cy);const{fromSide,toSide}=bSides(cStart,target);conns.push({id:'c'+Date.now(),from:cStart.id,to:target.id,fromSide:cStartPt?.side||fromSide,toSide:tp?.side||toSide,label:'',style:'solid',color:''});pH();aS();uSB();emit('connectionCreated',{from:cStart.id,to:target.id});}
isConn=false;cStart=null;cStartPt=null;setCursor('default');}
if(isSel){if(sRect&&(sRect.w>4||sRect.h>4)){const sel=nInR(sRect.x,sRect.y,sRect.w,sRect.h);if(e.ctrlKey||e.metaKey||e.shiftKey)sel.forEach(n=>addS(n));else{clrS();sel.forEach(n=>addS(n));}}isSel=false;sRect=null;}
if(dNode&&!moved)selOne(dNode);if(isND&&moved){pH();aS();emit('nodeMoved',{count:selN.length});}
isDrag=false;isND=false;isPan=false;dNode=null;moved=false;activePointerId=null;try{canvas.releasePointerCapture(e.pointerId);}catch(_){ }sR();});

canvas.addEventListener('pointercancel',resetInteractionState);
canvas.addEventListener('lostpointercapture',()=>{

  activePointerId=null;
  if(isDrag||isND||isPan||isRz||isSB||isConn){
    isDrag=false;isND=false;isPan=false;isRz=false;isSB=false;
    if(isConn){isConn=false;cStart=null;cStartPt=null;}
    dNode=null;rzN=null;rzH=null;sbN=null;moved=false;
    setCursor('default');sR();
  }
});

document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(tag==='TEXTAREA'||tag==='INPUT')return;
if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSP();return;}
if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){e.preventDefault();(async()=>{try{StorageManager.set('ic_v3',JSON.stringify(expD()));markSaved(Date.now(),'Lokal gespeichert');const ok=await saveToBackend();toast(ok?'💾 Gespeichert (Server + Lokal)':'💾 Lokal gespeichert');}catch(_){toast('❌ Speicherfehler');}})();return;}
if(e.key==='?'||(e.shiftKey&&e.key==='/')){e.preventDefault();openHelp();return;}
if(e.key==='Escape'){if(document.getElementById('help-modal').classList.contains('open')){closeHelp();e.preventDefault();return;}if($spotlight.classList.contains('open')){closeSP();e.preventDefault();return;}if($tplPicker.classList.contains('open')){closeTPL();e.preventDefault();return;}if(isConn){isConn=false;cStart=null;cStartPt=null;setCursor('default');sR();}closeCM();closeDD();closeCLE();closeTblEd();e.preventDefault();return;}
const step=e.shiftKey?10:1;
const _eCode=e.code||'';
switch(e.key){
case'Delete':case'Backspace':if(selC){delC(selC);e.preventDefault();return;}if(selN.length){[...selN].forEach(n=>delN(n));e.preventDefault();}break;
case'a':case'A':if(e.ctrlKey||e.metaKey){clrS();nodes.forEach(n=>addS(n));sR();e.preventDefault();}break;
case'z':case'Z':if(e.ctrlKey||e.metaKey){e.shiftKey?redo():undo();e.preventDefault();}break;
case'y':case'Y':if(e.ctrlKey||e.metaKey){redo();e.preventDefault();}break;
case'c':case'C':if((e.ctrlKey||e.metaKey)&&selN.length){clip=selN.map(n=>({...cN(n)}));toast(clip.length+' kopiert');e.preventDefault();}break;
case'v':case'V':if((e.ctrlKey||e.metaKey)&&clip.length){clrS();clip.forEach((nd,i)=>{const nn=addN(nd.type||'text',nd.x+40+i*30,nd.y+40+i*30,nd.text);nn.width=nd.width;nn.height=nd.height;nn.bg=nd.bg;nn.textColor=nd.textColor;nn.border=nd.border;if(nd.typeData)nn.typeData=JSON.parse(JSON.stringify(nd.typeData));addS(nn);});toast(clip.length+' eingefügt');e.preventDefault();}break;
case'd':case'D':if(_eCode==='KeyD'||e.key==='d'||e.key==='D'){if(selN.length){e.preventDefault();dupN(selN.map(n=>({...cN(n)})));}}break;
case'l':case'L':if(!e.ctrlKey&&!e.metaKey&&selN.length){selN.forEach(n=>n.locked=!n.locked);toast(selN[0].locked?'🔒':'🔓');pH();aS();sR();e.preventDefault();}break;
case'n':case'N':if(!e.ctrlKey&&!e.metaKey){const cx=(canvas.width/2-vx)/vs,cy=(canvas.height/2-vy)/vs;addN('text',cx-125,cy-60);e.preventDefault();}break;
case'1':if(!e.ctrlKey&&!e.metaKey){fitAll();e.preventDefault();}break;
case'g':case'G':if(!e.ctrlKey&&!e.metaKey&&selN.length>1){autoGrid(selN);e.preventDefault();}break;
case'f':case'F':if(!e.ctrlKey&&!e.metaKey&&selN.length){focusOnSelection();e.preventDefault();}break;
case's':case'S':if(!e.ctrlKey&&!e.metaKey){expSVG();e.preventDefault();}break;
case'h':case'H':if(!e.ctrlKey&&!e.metaKey){openHelp();e.preventDefault();}break;
case'ArrowLeft':if(selN.length){selN.forEach(n=>{if(!n.locked)n.x-=step;});pH();sR();e.preventDefault();}break;
case'ArrowRight':if(selN.length){selN.forEach(n=>{if(!n.locked)n.x+=step;});pH();sR();e.preventDefault();}break;
case'ArrowUp':if(selN.length){selN.forEach(n=>{if(!n.locked)n.y-=step;});pH();sR();e.preventDefault();}break;
case'ArrowDown':if(selN.length){selN.forEach(n=>{if(!n.locked)n.y+=step;});pH();sR();e.preventDefault();}break;
}});

function editNT(n){if(n.locked){toast('Gesperrt');return;}const r=canvas.getBoundingClientRect();const sx=r.left+n.x*vs+vx,sy=r.top+n.y*vs+vy,sw=n.width*vs,sh=n.height*vs;
const ta=document.createElement('textarea');ta.value=n.text;ta.style.cssText=`position:fixed;left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px;z-index:9999;background:${n.bg};color:${n.textColor};border:2px solid #007AFF;border-radius:${n.type==='sticky'?6:12}px;padding:10px;font-size:${Math.max(10,13*vs)}px;font-family:var(--font);line-height:1.5;resize:none;outline:none;box-shadow:0 4px 24px rgba(0,0,0,0.4);`;
document.body.appendChild(ta);ta.focus();ta.select();n.isEditing=true;sR();let done=false;
const fin=()=>{if(done||!document.body.contains(ta))return;done=true;n.text=ta.value||'Node';n.isEditing=false;document.body.removeChild(ta);pH();aS();sR();};
const can=()=>{if(done||!document.body.contains(ta))return;done=true;n.isEditing=false;document.body.removeChild(ta);sR();};
ta.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.ctrlKey){ev.preventDefault();ev.stopPropagation();fin();}else if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();can();}else if(ev.key==='Tab'){ev.preventDefault();ev.stopPropagation();const s=ta.selectionStart;ta.value=ta.value.slice(0,s)+'  '+ta.value.slice(ta.selectionEnd);ta.selectionStart=ta.selectionEnd=s+2;}else ev.stopPropagation();});
ta.addEventListener('blur',fin);}

let _clN=null;
function openCLEd(n){if(n.locked){toast('Gesperrt');return;}_clN=n;const el=$clEditor;$clTitleInput.value=n.text||'';rCLI(n.typeData.items||[]);
const r=canvas.getBoundingClientRect(),sx=r.left+n.x*vs+vx+n.width*vs+10,sy=r.top+n.y*vs+vy;el.style.display='block';el.style.left=Math.min(sx,window.innerWidth-290)+'px';el.style.top=Math.max(10,Math.min(sy,window.innerHeight-400))+'px';$clTitleInput.focus();}
function rCLI(items){const list=$clItemsList;list.innerHTML='';items.forEach((item,i)=>{const row=document.createElement('div');row.className='cl-row';const chk=document.createElement('div');chk.className='cl-check'+(item.checked?' done':'');chk.onclick=()=>{item.checked=!item.checked;rCLI(items);};
const inp=document.createElement('input');inp.className='cl-input'+(item.checked?' done-text':'');inp.value=item.text;inp.placeholder='…';inp.oninput=()=>{item.text=inp.value;};
inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();items.splice(i+1,0,{text:'',checked:false});rCLI(items);setTimeout(()=>{const r=list.querySelectorAll('.cl-input');if(r[i+1])r[i+1].focus();},0);}if(ev.key==='Backspace'&&inp.value===''&&items.length>1){ev.preventDefault();items.splice(i,1);rCLI(items);setTimeout(()=>{const r=list.querySelectorAll('.cl-input');if(r[i-1])r[i-1].focus();},0);}};
const del=document.createElement('button');del.className='cl-del';del.textContent='✕';del.onclick=()=>{if(items.length>1){items.splice(i,1);rCLI(items);}};row.appendChild(chk);row.appendChild(inp);row.appendChild(del);list.appendChild(row);});}
function closeCLEd(){$clEditor.style.display='none';_clN=null;}
document.getElementById('cl-add-btn').onclick=()=>{if(!_clN)return;_clN.typeData.items.push({text:'',checked:false});rCLI(_clN.typeData.items);setTimeout(()=>{const r=document.querySelectorAll('.cl-input');if(r.length)r[r.length-1].focus();},0);};
document.getElementById('cl-save').onclick=()=>{if(!_clN)return;_clN.text=$clTitleInput.value||'Aufgaben';pH();aS();sR();closeCLEd();toast('✓');};
document.getElementById('cl-cancel').onclick=closeCLEd;document.getElementById('cl-close').onclick=closeCLEd;

let _eC=null;
function openCLE(c,sx,sy){_eC=c;const el= document.getElementById('conn-label-editor'),inp=document.getElementById('conn-label-input');inp.value=c.label||'';el.style.display='block';el.style.left=Math.min(sx,window.innerWidth-220)+'px';el.style.top=Math.min(sy,window.innerHeight-80)+'px';inp.focus();el.querySelectorAll('.conn-style-btn').forEach(b=>b.classList.toggle('active',b.dataset.style===(c.style||'solid')));}
function closeCLE(){const el= document.getElementById('conn-label-editor');el.style.display='none';if(_eC){_eC.label=document.getElementById('conn-label-input').value;pH();aS();sR();}_eC=null;}
document.getElementById('conn-label-input').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();closeCLE();}e.stopPropagation();});
document.querySelectorAll('.conn-style-btn').forEach(b=>{b.onclick=()=>{if(!_eC)return;_eC.style=b.dataset.style;document.querySelectorAll('.conn-style-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');pH();aS();sR();};});

let _tblN=null;
function openTblEd(n){if(n.locked){toast('Gesperrt');return;}_tblN=n;const el=$tblEditor;el.style.display='block';
const r=canvas.getBoundingClientRect(),sx=r.left+n.x*vs+vx+n.width*vs+10,sy=r.top+n.y*vs+vy;
el.style.left=Math.min(sx,window.innerWidth-340)+'px';el.style.top=Math.max(10,Math.min(sy,window.innerHeight-400))+'px';
renderTblGrid();}
function renderTblGrid(){if(!_tblN)return;const td=_tblN.typeData;const g=$tblGrid;g.innerHTML='';
const tbl=document.createElement('table');const thead=document.createElement('thead');const tr=document.createElement('tr');
(td.headers||[]).forEach((h,i)=>{const th=document.createElement('th');const inp=document.createElement('input');inp.value=h||'';inp.placeholder='Header';inp.oninput=()=>{td.headers[i]=inp.value;sR();};th.appendChild(inp);tr.appendChild(th);});
thead.appendChild(tr);tbl.appendChild(thead);
const tbody=document.createElement('tbody');
(td.rows||[]).forEach((row,ri)=>{
    const rTr=document.createElement('tr');
    (td.headers||[]).forEach((_,ci)=>{
        const tdEl=document.createElement('td');
        const inp=document.createElement('input');
        inp.value=row[ci]||'';
        inp.oninput=()=>{td.rows[ri][ci]=inp.value;sR();};
        tdEl.appendChild(inp);rTr.appendChild(tdEl);
    });
    tbody.appendChild(rTr);
});
tbl.appendChild(tbody);g.appendChild(tbl);}
function closeTblEd(){$tblEditor.style.display='none';_tblN=null;setCursor('default');}
document.getElementById('tbl-close').onclick=closeTblEd;
document.getElementById('tbl-add-row').onclick=()=>{if(!_tblN)return;const td=_tblN.typeData;td.rows.push(new Array(td.headers.length).fill(''));renderTblGrid();sR();};
document.getElementById('tbl-add-col').onclick=()=>{if(!_tblN)return;const td=_tblN.typeData;td.headers.push('Neu');td.rows.forEach(r=>r.push(''));renderTblGrid();sR();};
document.getElementById('tbl-del-row').onclick=()=>{if(!_tblN||_tblN.typeData.rows.length<=1)return;_tblN.typeData.rows.pop();renderTblGrid();sR();};
document.getElementById('tbl-del-col').onclick=()=>{if(!_tblN||_tblN.typeData.headers.length<=1)return;_tblN.typeData.headers.pop();_tblN.typeData.rows.forEach(r=>r.pop());renderTblGrid();sR();};
document.getElementById('tbl-save').onclick=()=>{if(_tblN){pH();sR();} closeTblEd();toast('✓ Tabelle');}
;

function editLink(n){
if(n.locked){toast('Gesperrt');return;}
const url=n.typeData&&n.typeData.url||'https://';
const iconSrc=n.typeData&&n.typeData.icon||'';
const rect=canvas.getBoundingClientRect();
const sx=rect.left+n.x*vs+vx,sy=rect.top+(n.y+n.height)*vs+vy+6;
const wrap=document.createElement('div');
wrap.style.cssText=`position:fixed;left:${Math.max(4,sx-40)}px;top:${sy}px;z-index:9999;background:var(--glass);border:2px solid #007AFF;border-radius:12px;padding:10px;min-width:280px;box-shadow:0 4px 24px rgba(0,0,0,0.4);backdrop-filter:blur(40px) saturate(180%);display:flex;flex-direction:column;gap:6px;`;
const mkInp=(val,ph,extra)=>{const i=document.createElement('input');i.value=val;i.placeholder=ph;Object.assign(i.style,{background:'transparent',border:'1px solid var(--glass-border)',borderRadius:'6px',color:'var(--text)',fontSize:'12px',fontFamily:'var(--font)',padding:'6px 10px',outline:'none'});if(extra)Object.assign(i.style,extra);return i;};
const lbl=mkInp(n.text||'','Label…',{fontWeight:'600',fontSize:'13px'});
const urlIn=mkInp(url,'https://…',{color:'var(--accent)'});urlIn.type='url';
const icoIn=mkInp(iconSrc,'Icon-URL (optional)…',{color:'var(--text2)',fontSize:'11px'});
const hint=document.createElement('div');hint.style.cssText='font-size:10px;color:var(--text3);padding:0 2px;';
hint.textContent='Icon: URL zu PNG/SVG, oder leer = automatisches Favicon';
const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;justify-content:flex-end;';
const openBtn=document.createElement('button');openBtn.textContent='↗ Öffnen';openBtn.style.cssText=`padding:4px 10px;border-radius:6px;border:1px solid var(--glass-border);background:transparent;color:var(--text2);font-size:11px;font-family:var(--font);cursor:pointer;`;
openBtn.onclick=()=>{const u=urlIn.value;if(u&&u!=='https://')window.open(u,'_blank');};
const saveBtn=document.createElement('button');saveBtn.textContent='Speichern';saveBtn.style.cssText=`padding:4px 10px;border-radius:6px;border:1px solid #007AFF;background:#007AFF;color:#fff;font-size:11px;font-family:var(--font);cursor:pointer;`;
saveBtn.onclick=finish;
btns.appendChild(openBtn);btns.appendChild(saveBtn);
wrap.appendChild(lbl);wrap.appendChild(urlIn);wrap.appendChild(icoIn);wrap.appendChild(hint);wrap.appendChild(btns);
document.body.appendChild(wrap);lbl.focus();lbl.select();
let done=false;
function finish(){if(done)return;done=true;n.text=lbl.value||'Link';if(!n.typeData)n.typeData={};n.typeData.url=urlIn.value;n.typeData.icon=icoIn.value;delete n['_ico_'+n.id];document.body.removeChild(wrap);pH();aS();sR();}
function cancel(){if(done)return;done=true;document.body.removeChild(wrap);sR();}
[lbl,urlIn,icoIn].forEach(inp=>{inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();finish();}if(ev.key==='Escape'){ev.preventDefault();cancel();}ev.stopPropagation();};});
wrap.addEventListener('mousedown',e=>e.stopPropagation());}

const TEMPLATES=[
{name:'Brainstorm',icon:'💡',desc:'Zentrale Idee + Zweige',build:()=>{
const c=addN('sticky',-100,-100,'Zentrale Idee');c.width=200;c.height=120;c.bg='#FFD60A';c.textColor='#1a1200';c.border='#CCB000';
const ideas=['Idee A','Idee B','Idee C','Idee D'];
ideas.forEach((t,i)=>{const a=Math.PI*2/ideas.length*i-Math.PI/2;const n=addN('text',Math.cos(a)*280-125,Math.sin(a)*280-60,t);n.bg=C('#1e2d3a','#e3f2fd');n.border=C('#2d5a8a','#64b5f6');
conns.push({id:'ct'+Date.now()+i,from:c.id,to:n.id,fromSide:i<2?'right':'left',toSide:i<2?'left':'right',label:'',style:'solid',color:''});});}},
{name:'SWOT',icon:'📊',desc:'Stärken, Schwächen, Chancen, Risiken',build:()=>{
const g=addN('group',-200,-180,'SWOT-Analyse');g.width=680;g.height=460;
const q=[{t:'# Stärken\n\n- …',bg:C('#1e3a2f','#e8f5e9'),br:C('#2d6a4f','#81c784'),x:-180,y:-140},{t:'# Schwächen\n\n- …',bg:C('#3a1e2d','#fce4ec'),br:C('#7a2d5a','#f06292'),x:140,y:-140},{t:'# Chancen\n\n- …',bg:C('#1e2d3a','#e3f2fd'),br:C('#2d5a8a','#64b5f6'),x:-180,y:80},{t:'# Risiken\n\n- …',bg:C('#3a2a1e','#fff3e0'),br:C('#8a5a2d','#ffb74d'),x:140,y:80}];
q.forEach(s=>{const n=addN('text',s.x,s.y,s.t);n.width=300;n.height=200;n.bg=s.bg;n.border=s.br;});}},
{name:'Kanban',icon:'📋',desc:'To-Do / In Progress / Done',build:()=>{
const cols=['📥 To-Do','🔄 In Progress','✅ Done'];
cols.forEach((t,i)=>{const g=addN('group',i*320-320,-160,t);g.width=300;g.height=400;
for(let j=0;j<3;j++){const n=addN('sticky',g.x+20,g.y+50+j*110,'Aufgabe '+(i*3+j+1));n.width=260;n.height=90;}});}},
{name:'Pro / Contra',icon:'⚖️',desc:'Zwei Seiten vergleichen',build:()=>{
const t=addN('text',-120,-180,'# Entscheidung\n\nThema hier eingeben');t.width=260;t.height=100;t.bg=C('#1e2d3a','#e3f2fd');t.border=C('#2d5a8a','#64b5f6');
const pro=addN('text',-280,10,'# ✅ Pro\n\n- Argument 1\n- Argument 2\n- Argument 3');pro.width=250;pro.height=220;pro.bg=C('#1e3a2f','#e8f5e9');pro.border=C('#2d6a4f','#81c784');
const con=addN('text',40,10,'# ❌ Contra\n\n- Argument 1\n- Argument 2\n- Argument 3');con.width=250;con.height=220;con.bg=C('#3a1e2d','#fce4ec');con.border=C('#7a2d5a','#f06292');
conns.push({id:'cp1'+Date.now(),from:t.id,to:pro.id,fromSide:'bottom',toSide:'top',label:'Pro',style:'solid',color:''},{id:'cp2'+Date.now(),from:t.id,to:con.id,fromSide:'bottom',toSide:'top',label:'Contra',style:'solid',color:''});}},
{name:'Meeting Notes',icon:'📝',desc:'Agenda, Notizen, Aktionen',build:()=>{
const a=addN('text',-150,-120,'# 📋 Agenda\n\n1. Punkt 1\n2. Punkt 2\n3. Punkt 3');a.width=280;a.height=180;a.bg=C('#1e2d3a','#e3f2fd');a.border=C('#2d5a8a','#64b5f6');
const n=addN('text',180,-120,'# 📝 Notizen\n\n- …');n.width=280;n.height=180;
const c=addN('checklist',15,100,'Aktionen');c.width=260;c.height=160;c.typeData={items:[{text:'Follow-up an Team',checked:false},{text:'Dokument teilen',checked:false},{text:'Nächstes Meeting planen',checked:false}]};
conns.push({id:'cm1'+Date.now(),from:a.id,to:c.id,fromSide:'bottom',toSide:'top',label:'',style:'dashed',color:''},{id:'cm2'+Date.now(),from:n.id,to:c.id,fromSide:'bottom',toSide:'top',label:'',style:'dashed',color:''});}},
{name:'Daten-Tabelle',icon:'⊞',desc:'Leere Tabelle 4×4',build:()=>{
const t=addN('table',-150,-100,'Datentabelle');t.width=340;t.height=220;t.typeData={headers:['Name','Wert','Status','Notiz'],rows:[['','','',''],['','','',''],['','','',''],['','','','']]};}}
];

function openTPL(){const el=$tplPicker;el.classList.add('open');const g=document.getElementById('tpl-grid');g.innerHTML='';
TEMPLATES.forEach(t=>{const d=document.createElement('div');d.className='tpl-card';d.innerHTML=`<div class="tpl-icon">${t.icon}</div><div class="tpl-name">${t.name}</div><div class="tpl-desc">${t.desc}</div>`;
d.onclick=()=>{nodes=[];conns=[];clrS();nc=0;supH=true;t.build();supH=false;pH();aS();uSB();sR();closeTPL();fitAll();toast(t.name+' geladen');};g.appendChild(d);});}
function closeTPL(){$tplPicker.classList.remove('open');}
document.getElementById('tpl-close').onclick=closeTPL;
$tplPicker.addEventListener('mousedown',e=>{if(e.target===$tplPicker)closeTPL();});

let spI=-1;
function openSP(){$spotlight.classList.add('open');const inp=document.getElementById('spotlight-input');inp.value='';inp.focus();spI=-1;rSP('');}
function closeSP(){$spotlight.classList.remove('open');}
function rSP(q){const res= document.getElementById('spotlight-results');res.innerHTML='';spI=-1;const ql=q.toLowerCase().trim();
let typeFilter=null,textQuery=ql;const tm=ql.match(/^type:(\S+)\s*(.*)$/);if(tm){typeFilter=tm[1];textQuery=(tm[2]||'').trim();}
const m=(typeFilter||textQuery)?nodes.filter(n=>{if(typeFilter&&n.type!==typeFilter)return false;if(textQuery&&!(n.text||'').toLowerCase().includes(textQuery))return false;return true;}):nodes.slice(0,10);
if(!m.length){res.innerHTML='<div class="sp-hint">Keine Ergebnisse</div>';return;}
m.forEach((n,i)=>{const d=document.createElement('div');d.className='sp-item';const ico={text:'T',sticky:'S',checklist:'✓',group:'□'}[n.type]||'T';const pre=(n.text||'').slice(0,60)+(n.text.length>60?'…':'');
d.innerHTML=`<div class="sp-icon">${escapeHtml(ico)}</div><div class="sp-text"><div class="sp-title">${escapeHtml(pre)||'(leer)'}</div><div class="sp-sub">${escapeHtml(n.type)} · ${Math.round(n.x)},${Math.round(n.y)}</div></div>`;
d.onclick=()=>{clrS();selOne(n);vx=canvas.width/2-(n.x+n.width/2)*vs;vy=canvas.height/2-(n.y+n.height/2)*vs;sR();closeSP();};res.appendChild(d);});}
document.getElementById('spotlight-input').addEventListener('input',e=>rSP(e.target.value));
document.getElementById('spotlight-input').addEventListener('keydown',e=>{const items=document.querySelectorAll('.sp-item');
if(e.key==='ArrowDown'){e.preventDefault();spI=Math.min(spI+1,items.length-1);items.forEach((it,i)=>it.classList.toggle('active',i===spI));}
else if(e.key==='ArrowUp'){e.preventDefault();spI=Math.max(spI-1,0);items.forEach((it,i)=>it.classList.toggle('active',i===spI));}
else if(e.key==='Enter'&&spI>=0&&items[spI]){items[spI].click();}
else if(e.key==='Escape')closeSP();e.stopPropagation();});
$spotlight.addEventListener('mousedown',e=>{if(e.target===$spotlight)closeSP();});

function showCM(sx,sy,node){const menu=$ctxMenu;menu.innerHTML='';menu.setAttribute('aria-label', node ? 'Node Menü' : 'Canvas Menü');
if(node){selOne(node);
const tl=document.createElement('div');tl.className='ctx-label';tl.textContent='Typ';tl.setAttribute('role', 'presentation');menu.appendChild(tl);
const tr=document.createElement('div');tr.className='type-row';NT.forEach(t=>{const d=document.createElement('div');d.className='type-dot'+(node.type===t.type?' active':'');d.textContent=t.icon;d.title=t.label;d.setAttribute('role', 'menuitem');d.setAttribute('aria-label', t.label);d.onclick=()=>{if(node.type===t.type){closeCM();return;}const f=mN(t.type,node.text,node.x,node.y);Object.assign(node,{type:f.type,width:f.width,height:f.height,bg:f.bg,textColor:f.textColor,border:f.border,typeData:f.typeData,scrollY:0});pH();aS();closeCM();sR();toast('→ '+t.label);};tr.appendChild(d);});menu.appendChild(tr);
if(node.type!=='group'){menu.appendChild(Object.assign(document.createElement('div'),{className:'ctx-sep'}));
const cl=document.createElement('div');cl.className='ctx-label';cl.textContent='Farbe';cl.setAttribute('role', 'presentation');menu.appendChild(cl);
const cr=document.createElement('div');cr.className='color-row';
(node.type==='sticky'?STICKY_C:[{bg:C('#2c2c2e','#fff'),border:C('#48484a','#d1d1d6'),label:'Std'},{bg:C('#1e3a2f','#e8f5e9'),border:C('#2d6a4f','#81c784'),label:'Grün'},{bg:C('#1e2d3a','#e3f2fd'),border:C('#2d5a8a','#64b5f6'),label:'Blau'},{bg:C('#3a1e2d','#fce4ec'),border:C('#7a2d5a','#f06292'),label:'Pink'},{bg:C('#3a2a1e','#fff3e0'),border:C('#8a5a2d','#ffb74d'),label:'Orange'},{bg:C('#2a1e1e','#ffebee'),border:C('#7a3a3a','#ef5350'),label:'Rot'}]).forEach(c=>{const d=document.createElement('div');d.className='color-dot';d.style.background=c.bg;d.style.borderColor=c.border;d.title=c.label;d.setAttribute('role', 'menuitem');d.setAttribute('aria-label', c.label);d.onclick=()=>{node.bg=c.bg;node.border=c.border;if(c.textColor)node.textColor=c.textColor;pH();aS();closeCM();sR();};cr.appendChild(d);});menu.appendChild(cr);}
const cpRow=document.createElement('div');cpRow.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 10px 6px';
const cpLbl=document.createElement('span');cpLbl.style.cssText='font-size:10px;color:var(--text3);flex-shrink:0';cpLbl.textContent='Custom:';
const cpInp=document.createElement('input');cpInp.type='color';cpInp.value=node.bg.startsWith('#')?node.bg:'#2c2c2e';
cpInp.style.cssText='width:28px;height:22px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none;flex-shrink:0';
cpInp.title='Eigene Farbe wählen';
cpInp.oninput=()=>{node.bg=cpInp.value;const rgb=parseInt(cpInp.value.slice(1),16);const lum=(((rgb>>16)&0xff)*299+((rgb>>8)&0xff)*587+(rgb&0xff)*114)/1000;node.textColor=lum>128?'#1c1c1e':'#f5f5f7';node.border=cpInp.value+'bb';pH();aS();sR();};
cpRow.appendChild(cpLbl);cpRow.appendChild(cpInp);menu.appendChild(cpRow);
menu.appendChild(Object.assign(document.createElement('div'),{className:'ctx-sep'}));
[{i:'✏️',l:'Bearbeiten',s:'Dblclick',a:()=>{closeCM();node.type==='checklist'?openCLEd(node):(node.type==='table'?openTblEd(node):(node.type==='link'?editLink(node):editNT(node)));}},{i:'⊕',l:'Duplizieren',s:'D',a:()=>{dupN([{...cN(node)}]);closeCM();}},
].concat(node.type==='link'?[{i:'↗',l:'URL öffnen',a:()=>{const u=node.typeData&&node.typeData.url;if(u&&u!=='https://')window.open(u,'_blank');closeCM();}}]:[]).concat([{i:node.locked?'🔓':'🔒',l:node.locked?'Entsperren':'Sperren',s:'L',a:()=>{node.locked=!node.locked;pH();aS();sR();closeCM();}},{i:'🔼',l:'Vorne',a:()=>{const i=nodes.indexOf(node);if(i<nodes.length-1){nodes.splice(i,1);nodes.push(node);pH();sR();}closeCM();}},{i:'🔽',l:'Hinten',a:()=>{const i=nodes.indexOf(node);if(i>0){nodes.splice(i,1);nodes.unshift(node);pH();sR();}closeCM();}}])
.forEach(it=>{const d=document.createElement('div');d.className='ctx-item';d.setAttribute('role', 'menuitem');d.innerHTML=`<span>${it.i}</span><span>${it.l}</span>${it.s?`<span class="shortcut">${it.s}</span>`:''}`;d.onclick=it.a;menu.appendChild(d);});
menu.appendChild(Object.assign(document.createElement('div'),{className:'ctx-sep'}));
const del=document.createElement('div');del.className='ctx-item danger';del.setAttribute('role', 'menuitem');del.innerHTML='<span>🗑</span><span>Löschen</span><span class="shortcut">Del</span>';del.onclick=()=>{delN(node);closeCM();};menu.appendChild(del);
}else{[{i:'+',l:'Text-Node',a:()=>{const{x,y}=cvPos(sx,sy);addN('text',x-125,y-60);closeCM();}},{i:'S',l:'Sticky',a:()=>{const{x,y}=cvPos(sx,sy);addN('sticky',x-90,y-90);closeCM();}},{i:'✓',l:'Checkliste',a:()=>{const{x,y}=cvPos(sx,sy);addN('checklist',x-120,y-90);closeCM();}},{i:'□',l:'Gruppe',a:()=>{const{x,y}=cvPos(sx,sy);addN('group',x-190,y-140);closeCM();}},{i:'⊞',l:'Tabelle',a:()=>{const{x,y}=cvPos(sx,sy);addN('table',x-150,y-100);closeCM();}},{i:'🔗',l:'Link-Bubble',a:()=>{const{x,y}=cvPos(sx,sy);addN('link',x-60,y-60);closeCM();}},{i:'◇',l:'Raute',a:()=>{const{x,y}=cvPos(sx,sy);addN('diamond',x-90,y-70);closeCM();}},{i:'⬭',l:'Ellipse',a:()=>{const{x,y}=cvPos(sx,sy);addN('ellipse',x-100,y-60);closeCM();}},{i:'⬡',l:'Hexagon',a:()=>{const{x,y}=cvPos(sx,sy);addN('hexagon',x-90,y-80);closeCM();}},{i:'📋',l:'Einfügen',a:()=>{if(!clip.length){toast('Leer');return;}clrS();clip.forEach((nd,i)=>{const nn=addN(nd.type||'text',nd.x+40+i*30,nd.y+40+i*30,nd.text);nn.width=nd.width;nn.height=nd.height;nn.bg=nd.bg;nn.textColor=nd.textColor;nn.border=nd.border;if(nd.typeData)nn.typeData=JSON.parse(JSON.stringify(nd.typeData));addS(nn);});closeCM();}}
].forEach(it=>{const d=document.createElement('div');d.className='ctx-item';d.setAttribute('role', 'menuitem');d.innerHTML=`<span>${it.i}</span><span>${it.l}</span>`;d.onclick=it.a;menu.appendChild(d);});}
menu.style.display='block';const mw=menu.offsetWidth,mh=menu.offsetHeight;let mx=sx+4,my=sy+4;if(mx+mw>window.innerWidth)mx=sx-mw-4;if(my+mh>window.innerHeight-28)my=sy-mh-4;menu.style.left=mx+'px';menu.style.top=my+'px';sR();}
function cvPos(sx,sy){const r=canvas.getBoundingClientRect();return s2c(sx-r.left,sy-r.top);}
function closeCM(){$ctxMenu.style.display='none';}
document.addEventListener('mousedown',e=>{if(!$ctxMenu.contains(e.target))closeCM();if(!$addDropdown.contains(e.target)&&!document.getElementById('btn-add').contains(e.target))closeDD();});

function closeDD(){$addDropdown.classList.remove('open');document.getElementById('btn-add').setAttribute('aria-expanded','false');}
document.getElementById('btn-add').addEventListener('click',e=>{
  e.stopPropagation();
  const isOpen=$addDropdown.classList.toggle('open');
  document.getElementById('btn-add').setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if(isOpen){
    const r=document.getElementById('btn-add').getBoundingClientRect();
    $addDropdown.style.top=(r.bottom+6)+'px';
    $addDropdown.style.left=Math.min(r.left, window.innerWidth-190)+'px';
  }
});
document.querySelectorAll('#add-dropdown .dd-item').forEach(item=>{item.addEventListener('click',e=>{e.stopPropagation();const t=item.dataset.type;const cx=(canvas.width/2-vx)/vs,cy=(canvas.height/2-vy)/vs;let x=cx-125,y=cy-60;if(t==='sticky'){x=cx-90;y=cy-90;}if(t==='checklist'){x=cx-120;y=cy-90;}if(t==='group'){x=cx-190;y=cy-140;}if(t==='table'){x=cx-150;y=cy-100;}if(t==='link'){x=cx-60;y=cy-60;}if(t==='diamond'){x=cx-90;y=cy-70;}if(t==='ellipse'){x=cx-100;y=cy-60;}if(t==='hexagon'){x=cx-90;y=cy-80;}addN(t,x,y);closeDD();toast(t+' ✓');});});
document.getElementById('btn-undo').onclick=undo;document.getElementById('btn-redo').onclick=redo;
document.getElementById('btn-snap').onclick=()=>{snap=!snap;document.getElementById('btn-snap').classList.toggle('active',snap);toast(snap?'Snap ⊞':'Snap aus');sR();};
document.getElementById('btn-fit').onclick=fitAll;document.getElementById('btn-search').onclick=openSP;document.getElementById('btn-tpl').onclick=openTPL;document.getElementById('btn-png').onclick=expPNG;
{const _svg=document.getElementById('btn-svg');if(_svg)_svg.onclick=expSVG;}
{const _help=document.getElementById('btn-help');if(_help)_help.onclick=openHelp;}
{const _mac=document.getElementById('btn-macros');if(_mac)_mac.onclick=()=>{if(typeof PredictiveWorkflow!=='undefined')PredictiveWorkflow.openMacroPanel();};}
{const _hc=document.getElementById('help-close');if(_hc)_hc.onclick=closeHelp;}
{const _hm=document.getElementById('help-modal');if(_hm)_hm.addEventListener('mousedown',e=>{if(e.target===_hm)closeHelp();});}
document.getElementById('btn-export').onclick=()=>{const b=new Blob([JSON.stringify(expD(),null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='canvas-'+Date.now()+'.json';a.click();URL.revokeObjectURL(u);toast('JSON ↓');};
document.getElementById('btn-import').onclick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept='.json,.canvas';inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{impD(JSON.parse(ev.target.result));aS();toast('↑ OK');}catch(er){toast('❌');}};r.readAsText(f);};inp.click();};
document.getElementById('btn-clear').onclick=()=>{if(confirm('Canvas leeren?')){nodes=[];conns=[];clrS();nc=0;pH();aS();uSB();sR();toast('🗑');}};
document.getElementById('btn-theme').onclick=()=>{document.documentElement.classList.toggle('light');isDark=!document.documentElement.classList.contains('light');updateThemeBtn();toast(isDark?'🌙 Dark':'☀️ Light');sR();};
$zoomDisplay.onclick=()=>{vx=0;vy=0;vs=1;sR();};
document.getElementById('zoom-in').onclick=()=>{const ns=Math.min(6,vs*1.2),cx=canvas.width/2,cy=canvas.height/2;vx-=(cx-vx)*(ns-vs)/vs;vy-=(cy-vy)*(ns-vs)/vs;vs=ns;sR();};
document.getElementById('zoom-out').onclick=()=>{const ns=Math.max(0.08,vs/1.2),cx=canvas.width/2,cy=canvas.height/2;vx-=(cx-vx)*(ns-vs)/vs;vy-=(cy-vy)*(ns-vs)/vs;vs=ns;sR();};


try{const saved=StorageManager.get('ic_v3');if(saved){try{impD(JSON.parse(saved));}catch(parseErr){console.warn('Canvas-Daten korrumpiert, starte neu.',parseErr);StorageManager.remove('ic_v3');}} else {supH=true;
const n1=addN('text','','','');n1.x=80;n1.y=120;n1.width=280;n1.height=170;n1.bg=C('#1e2d3a','#e3f2fd');n1.border=C('#2d5a8a','#64b5f6');n1.textColor=C('#f5f5f7','#1c1c1e');n1.text='# Willkommen\n\nDoppelklick = Node\nShift+Drag = verbinden\n⌘K = Suche\nD = Duplizieren\n1 = Fit to Screen';
const s1=addN('sticky','','','');s1.x=420;s1.y=100;s1.width=170;s1.height=170;s1.text='v0.18 AI ist da! 🤖\n\nNeu: Pattern Recognition, Auto-Layout, Cluster Detection';
const c1=addN('checklist','','','');c1.x=420;c1.y=310;c1.width=220;c1.height=180;c1.text='Features';c1.typeData={items:[{text:'Imgcache Cleanup',checked:true},{text:'StorageManager',checked:true},{text:'Grid Optimization',checked:true},{text:'Wheel Throttle',checked:true},{text:'Lock Nodes',checked:true},{text:'Duplizieren',checked:true},{text:'AI Organizer v0.18',checked:true}]};
const g1=addN('group','','','');g1.x=60;g1.y=330;g1.width=330;g1.height=200;g1.text='Quick Wins';
const n2=addN('text','','','');n2.x=90;n2.y=380;n2.width=260;n2.height=110;n2.bg=C('#1e3a2f','#e8f5e9');n2.border=C('#2d6a4f','#81c784');n2.textColor=C('#f5f5f7','#1c1c1e');n2.text='# Shortcuts\n\nL = Lock · D = Dup\n1 = Fit · ⌘K = Suche\nDblclick Conn = Label';
conns.push({id:'c1',from:n1.id,to:s1.id,fromSide:'right',toSide:'left',label:'neu',style:'solid',color:''},{id:'c2',from:n1.id,to:c1.id,fromSide:'right',toSide:'top',label:'',style:'dashed',color:''},{id:'c3',from:n2.id,to:c1.id,fromSide:'right',toSide:'left',label:'',style:'solid',color:''});
supH=false;pH();aS();uSB();}
loadFromBackend().catch(()=>{});
}catch(e){sR();}
} // end initCanvas

const imgCache = {};
function drawImageNode(n) {
    if (!n.typeData.src) return;
    if (!imgCache[n.id]) {
        const img = new Image();
        img.onload = () => { img._ok = true; sR(); };
        img.onerror = () => { img._err = true; img._ok = false; sR(); };
        img.src = n.typeData.src;
        imgCache[n.id] = img;
    }
    const img = imgCache[n.id];
    if (n.isSelected) {
        ctx.shadowColor = C('rgba(0,122,255,0.3)','rgba(0,122,255,0.2)');
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#007AFF';
        ctx.lineWidth = 2;
        rR(n.x, n.y, n.width, n.height, 8);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (img._err) {
        rR(n.x, n.y, n.width, n.height, 8);
        ctx.fillStyle = C('#2c2c2e','#f2f2f7');
        ctx.fill();
        ctx.strokeStyle = C('#48484a','#d1d1d6');
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `14px ${FB}`;
        ctx.fillStyle = C('rgba(255,255,255,0.3)','rgba(0,0,0,0.3)');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️ Bild konnte nicht geladen werden', n.x + n.width/2, n.y + n.height/2);
        if (n.isSelected || (hNode===n&&hCP) || isConn) drawCPs(n);
        if (n.isSelected && !n.locked) drawRH(n);
        return;
    }
    if (img.complete && img._ok) {
        ctx.save();
        rR(n.x, n.y, n.width, n.height, 8);
        ctx.clip();
        ctx.drawImage(img, n.x, n.y, n.width, n.height);
        ctx.restore();

        if (n.typeData.url) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.arc(n.x + n.width - 20, n.y + 20, 12, 0, 2*Math.PI);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔗', n.x + n.width - 20, n.y + 20);
        }
    }
    if (n.isSelected || (hNode===n&&hCP) || isConn) drawCPs(n);
    if (n.isSelected && !n.locked) drawRH(n);
}

function handleImageFile(file, cx, cy) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const src = e.target.result;
        const img = new Image();
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const maxW = 400;
            if (w > maxW) { h = h * (maxW / w); w = maxW; }
            const n = addN('image', cx - w/2, cy - h/2, 'Bild');
            n.width = w;
            n.height = h;
            n.typeData = { src, url: '' };
            sR();
        };
        img.src = src;
    };
    reader.readAsDataURL(file);
}

window.addEventListener('paste', e => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
            const cx = (canvas.width/2 - vx)/vs;
            const cy = (canvas.height/2 - vy)/vs;
            handleImageFile(items[i].getAsFile(), cx, cy);
        }
    }
});

canvas.addEventListener('dragover', e => e.preventDefault());
canvas.addEventListener('drop', e => {
    e.preventDefault();
    const lp = getLocalPoint(e);
    const cx = (lp.mx - vx)/vs;
    const cy = (lp.my - vy)/vs;
    if (e.dataTransfer.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
            if (e.dataTransfer.items[i].kind === 'file') {
                handleImageFile(e.dataTransfer.items[i].getAsFile(), cx, cy);
            }
        }
    }
});

$lightbox.addEventListener('click', (e) => {
    if(e.target.id === 'lightbox' || e.target.id === 'lightbox-close') {
        $lightbox.classList.remove('open');
        setTimeout(() => $lightboxImg.src = '', 300);
    }
});

function openImageAction(n) {
    if (n.typeData.url) {
        window.open(n.typeData.url, '_blank');
    } else {
        $lightboxImg.src = n.typeData.src;
        $lightbox.classList.add('open');
    }
}

document.addEventListener('contextmenu', (e) => {
    setTimeout(() => {
        if (selN.length === 1 && selN[0].type === 'image') {
            const ctxMenu = $ctxMenu;
            if (ctxMenu && ctxMenu.style.display === 'block') {
                if (!document.getElementById('ctx-img-url')) {
                    const sep = document.createElement('div');
                    sep.className = 'ctx-sep';
                    const btn = document.createElement('div');
                    btn.id = 'ctx-img-url';
                    btn.className = 'ctx-item';
                    btn.innerHTML = '🔗 Link hinterlegen';
                    btn.onclick = () => {
                        ctxMenu.style.display = 'none';
                        const currentUrl = selN[0].typeData.url || '';
                        const url = prompt('Hyperlink für dieses Bild eingeben (leer lassen zum Entfernen):', currentUrl);
                        if (url !== null) {
                            selN[0].typeData.url = url;
                            pH(); sR();
                        }
                    };
                    ctxMenu.insertBefore(sep, ctxMenu.firstChild);
                    ctxMenu.insertBefore(btn, ctxMenu.firstChild);
                }
            }
        }
    }, 10);
});

document.getElementById('btn-tm').onclick = async () => {
    const picker = $tmPicker;
    picker.classList.add('open');
    const list = $tmList;
    list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px;">Lade Backups vom Server... ⏳</div>';
    try {
        const res = await apiGet('revisions', getCanvasId());
        if(res && res.ok && res.items) {
            if(res.items.length === 0) {
                list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px;">Noch keine Backups vorhanden. Speichere zuerst dein Canvas.</div>';
                return;
            }
            list.innerHTML = '';
            res.items.forEach((rev, index) => {
                const d = new Date(rev.updatedAt);
                const dateStr = d.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}) + ' ' + d.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
                const sizeStr = (rev.bytes / 1024).toFixed(1) + ' KB';
                const isLatest = index === 0 ? '<span style="color:var(--green); font-size:10px; margin-left:6px; font-weight:bold;">(Neuestes)</span>' : '';

                const item = document.createElement('div');
                item.className = 'tm-item';
                item.innerHTML = `<div><div class="tm-date">${dateStr}${isLatest}</div><div class="tm-size">${sizeStr}</div></div><button class="tm-btn">Wiederherstellen</button>`;
                item.onclick = async () => {
                    if(confirm(`Möchtest du das Backup vom ${dateStr} wirklich wiederherstellen?\n\nDein aktueller Stand geht dabei NICHT verloren, sondern wird automatisch als neues Backup gesichert.`)) {
                        item.style.opacity = '0.5';
                        const btn = item.querySelector('.tm-btn');
                        btn.textContent = 'Lädt...';
                        try {
                            const rRes = await apiPost('restore', getCanvasId(), {revisionFile: rev.file});
                            if(rRes && rRes.ok) {
                                toast('Backup erfolgreich wiederhergestellt! ✅');
                                picker.classList.remove('open');
                                await loadFromBackend();
                            } else {
                                toast('Fehler beim Wiederherstellen ❌');
                            }
                        } catch(e) { toast('Verbindungsfehler zur API'); }
                        item.style.opacity = '1';
                        btn.textContent = 'Wiederherstellen';
                    }
                };
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--red);font-size:13px;">Fehler beim Laden der Backups. Ist die api.php erreichbar?</div>';
        }
    } catch(e) {
        list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--red);font-size:13px;">Verbindungsfehler. Offline-Modus aktiv?</div>';
    }
};
$tmClose.onclick = () => $tmPicker.classList.remove('open');

// ===== AI ORGANIZER MODULE (v0.18) =====
// Pattern Recognition & Auto-Refactoring für intelligente Board-Organisation

const AIOrganizer = {
  // Cluster-Erkennung: Findet zusammenhängende Node-Gruppen basierend auf Connections
  findClusters() {
    const clusters = [];
    const visited = new Set();
    
    // Adjazenzliste aus Connections erstellen
    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    conns.forEach(c => {
      if (adj[c.from]) adj[c.from].push(c.to);
      if (adj[c.to]) adj[c.to].push(c.from);
    });
    
    // DFS für jede unbesuchte Node
    nodes.forEach(startNode => {
      if (visited.has(startNode.id)) return;
      
      const cluster = [];
      const stack = [startNode.id];
      
      while (stack.length > 0) {
        const currentId = stack.pop();
        if (visited.has(currentId)) continue;
        
        visited.add(currentId);
        const node = nodes.find(n => n.id === currentId);
        if (node) cluster.push(node);
        
        // Nachbarn hinzufügen
        (adj[currentId] || []).forEach(neighborId => {
          if (!visited.has(neighborId)) stack.push(neighborId);
        });
      }
      
      if (cluster.length > 0) clusters.push(cluster);
    });
    
    return clusters.filter(c => c.length > 1); // Nur Gruppen mit >1 Node
  },
  
  // Orphan-Detector: Findet Nodes ohne Connections
  findOrphans() {
    const connectedIds = new Set();
    conns.forEach(c => {
      connectedIds.add(c.from);
      connectedIds.add(c.to);
    });
    return nodes.filter(n => !connectedIds.has(n.id));
  },
  
  // FIX A3: Duplicate Detection mit Fuzzy-Matching (Levenshtein-basiert)
  findDuplicates() {
    // Schritt 1: Normalisierung (Umlaute, Whitespace, Punktuation)
    const norm = s => (s || '').toLowerCase()
      .replace(/[äÄ]/g,'a').replace(/[öÖ]/g,'o').replace(/[üÜ]/g,'u').replace(/[ß]/g,'ss')
      .replace(/[^\p{L}\p{N}\s]/gu,' ')
      .replace(/\s+/g,' ').trim();

    // Schritt 2: Exakte Duplikate sammeln
    const exactMap = new Map();
    const candidates = [];
    nodes.forEach(n => {
      const key = norm(n.text);
      if (!key || key.length < 4) return;
      candidates.push({ node: n, key });
      if (!exactMap.has(key)) exactMap.set(key, []);
      exactMap.get(key).push(n);
    });

    const duplicates = [];
    const usedIds = new Set();
    exactMap.forEach((arr, text) => {
      if (arr.length > 1) {
        duplicates.push({ text, nodes: arr, similarity: 1.0 });
        arr.forEach(n => usedIds.add(n.id));
      }
    });

    // Schritt 3: Fuzzy-Pairs für Nodes, die noch nicht in exakter Gruppe sind
    const remaining = candidates.filter(c => !usedIds.has(c.node.id));
    const THRESHOLD = 0.82; // 82% Ähnlichkeit

    // Levenshtein-Distanz (klassische DP, früh abbrechen bei großen Strings)
    const lev = (a, b) => {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      // Performance-Schutz: zu unterschiedlich → skip
      if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.5) return Math.max(a.length, b.length);
      let prev = Array(b.length + 1);
      for (let j = 0; j <= b.length; j++) prev[j] = j;
      for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
          const cost = a.charCodeAt(i-1) === b.charCodeAt(j-1) ? 0 : 1;
          cur[j] = Math.min(cur[j-1] + 1, prev[j] + 1, prev[j-1] + cost);
        }
        prev = cur;
      }
      return prev[b.length];
    };
    const similarity = (a, b) => {
      const d = lev(a, b);
      return 1 - d / Math.max(a.length, b.length, 1);
    };

    // Schritt 4: Union-Find für fuzzy Gruppen
    const parent = {};
    remaining.forEach(c => parent[c.node.id] = c.node.id);
    const find = id => parent[id] === id ? id : (parent[id] = find(parent[id]));
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const sim = similarity(remaining[i].key, remaining[j].key);
        if (sim >= THRESHOLD) union(remaining[i].node.id, remaining[j].node.id);
      }
    }

    // Schritt 5: Cluster nach Root sammeln
    const fuzzyClusters = {};
    remaining.forEach(c => {
      const r = find(c.node.id);
      if (!fuzzyClusters[r]) fuzzyClusters[r] = [];
      fuzzyClusters[r].push(c);
    });

    Object.values(fuzzyClusters).forEach(group => {
      if (group.length > 1) {
        const repr = group.reduce((a, b) => a.key.length <= b.key.length ? a : b);
        duplicates.push({
          text: '≈ ' + repr.node.text,
          nodes: group.map(g => g.node),
          similarity: Math.round(group.reduce((s, g) => s + similarity(repr.key, g.key), 0) / group.length * 100) / 100
        });
      }
    });

    return duplicates;
  },
  
  // FIX A2: Echtes Force-Directed Layout (Fruchterman-Reingold-light)
  // Repulsive Kraft zwischen allen Nodes + attraktive Kraft entlang Connections
  calculateAutoLayout() {
    if (!nodes.length) return {};
    const positions = {};
    const N = nodes.length;

    // Start: aktuelle Positionen übernehmen (kleine Jitter, falls überlappend)
    nodes.forEach(n => {
      positions[n.id] = {
        x: n.x + (Math.random() - 0.5) * 2,
        y: n.y + (Math.random() - 0.5) * 2,
        w: n.width || 200,
        h: n.height || 120
      };
    });

    // Parameter: skaliert mit Anzahl Nodes
    const area = Math.max(800 * 600, N * 250 * 200);
    const k = Math.sqrt(area / N);          // ideale Kantenlänge
    const repulseK = k * k * 1.4;            // Repulsions-Stärke
    const attractK = 1 / k;                  // Attraktions-Faktor
    const iterations = Math.min(200, 60 + N * 2);
    let temperature = k * 0.6;               // anfängliche Bewegungs-Obergrenze
    const cooling = temperature / iterations;

    // Adjazenz (für Connections)
    const edges = conns.map(c => [c.from, c.to]).filter(([a,b]) => positions[a] && positions[b]);

    for (let iter = 0; iter < iterations; iter++) {
      // Verschiebungen pro Node sammeln
      const disp = {};
      nodes.forEach(n => disp[n.id] = { x: 0, y: 0 });

      // Repulsion: alle Paare abstoßen, abhängig vom Abstand der Mittelpunkte
      for (let i = 0; i < N; i++) {
        const a = nodes[i], pa = positions[a.id];
        const ax = pa.x + pa.w / 2, ay = pa.y + pa.h / 2;
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j], pb = positions[b.id];
          const bx = pb.x + pb.w / 2, by = pb.y + pb.h / 2;
          let dx = ax - bx, dy = ay - by;
          let dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = 0.5; }
          // Minimum-Abstand basierend auf Boxgrößen (verhindert Überlappung)
          const minDist = (Math.max(pa.w, pb.w) + Math.max(pa.h, pb.h)) / 2 + 40;
          const effectiveDist = Math.max(dist, minDist * 0.3);
          const force = repulseK / effectiveDist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          disp[a.id].x += fx; disp[a.id].y += fy;
          disp[b.id].x -= fx; disp[b.id].y -= fy;
        }
      }

      // Attraktion entlang Kanten
      edges.forEach(([fromId, toId]) => {
        const pa = positions[fromId], pb = positions[toId];
        const ax = pa.x + pa.w / 2, ay = pa.y + pa.h / 2;
        const bx = pb.x + pb.w / 2, by = pb.y + pb.h / 2;
        const dx = ax - bx, dy = ay - by;
        const dist = Math.max(0.01, Math.sqrt(dx*dx + dy*dy));
        const force = (dist * dist) * attractK;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        disp[fromId].x -= fx; disp[fromId].y -= fy;
        disp[toId].x   += fx; disp[toId].y   += fy;
      });

      // Anwenden mit Temperature-Limit
      nodes.forEach(n => {
        if (n.locked) return;
        const d = disp[n.id];
        const dispLen = Math.sqrt(d.x*d.x + d.y*d.y) || 0.01;
        const limited = Math.min(dispLen, temperature);
        positions[n.id].x += (d.x / dispLen) * limited;
        positions[n.id].y += (d.y / dispLen) * limited;
      });

      temperature = Math.max(0.1, temperature - cooling);
    }

    // Resultat aufräumen — Center auf Viewport-Mitte verschieben
    let mX = Infinity, mY = Infinity, MX = -Infinity, MY = -Infinity;
    nodes.forEach(n => {
      const p = positions[n.id];
      mX = Math.min(mX, p.x); mY = Math.min(mY, p.y);
      MX = Math.max(MX, p.x + p.w); MY = Math.max(MY, p.y + p.h);
    });
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);
    const targetCX = (cssW / 2 - vx) / vs;
    const targetCY = (cssH / 2 - vy) / vs;
    const shiftX = targetCX - (mX + MX) / 2;
    const shiftY = targetCY - (mY + MY) / 2;

    const out = {};
    nodes.forEach(n => { out[n.id] = { x: positions[n.id].x + shiftX, y: positions[n.id].y + shiftY }; });
    return out;
  },
  
  // UI Renderer für Ergebnisse
  renderResults(action, results) {
    $aiResultsList.innerHTML = '';
    $aiActions.innerHTML = '';
    
    if (action === 'clusters') {
      const clusters = results;
      if (clusters.length === 0) {
        $aiResultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Keine Cluster gefunden. Alle Nodes sind isoliert.</div>';
        return;
      }
      
      // XSS-Schutz + Per-Cluster Auswählen
      clusters.forEach((cluster, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:12px;margin-bottom:8px;border-radius:8px;background:var(--accent-soft);border:1px solid var(--glass-border);';
        const preview = cluster.slice(0, 5).map(n => escapeHtml((n.text||'').substring(0, 30))).join(' · ');
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-weight:600;font-size:12px;color:var(--text);">Cluster ${idx + 1} (${cluster.length} Nodes)</div>
            <button class="cluster-select-btn" data-idx="${idx}" style="padding:4px 10px;border-radius:4px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;cursor:pointer;font-family:var(--font);">Auswählen</button>
          </div>
          <div style="font-size:11px;color:var(--text3);">${preview}${cluster.length > 5 ? ' …' : ''}</div>
        `;
        $aiResultsList.appendChild(item);
      });

      setTimeout(() => {
        document.querySelectorAll('.cluster-select-btn').forEach(btn => {
          btn.onclick = () => {
            const cluster = clusters[parseInt(btn.dataset.idx, 10)];
            if (!cluster) return;
            clrS();
            cluster.forEach(n => addS(n));
            sR();
            toast(`✓ ${cluster.length} Nodes selektiert`);
            $aiPicker.style.display = 'none';
          };
        });
      }, 0);

      const btn = document.createElement('button');
      btn.textContent = 'Cluster als Gruppen organisieren';
      btn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-weight:600;font-size:12px;cursor:pointer;font-family:var(--font);';
      btn.onclick = () => this.applyClustering(clusters);
      $aiActions.appendChild(btn);
      
    } else if (action === 'orphans') {
      const orphans = results;
      if (orphans.length === 0) {
        $aiResultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--green);font-size:13px;">Perfekt! Alle Nodes sind verbunden.</div>';
        return;
      }
      
      orphans.forEach(node => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:10px;margin-bottom:6px;border-radius:6px;background:var(--accent-soft);display:flex;justify-content:space-between;align-items:center;';
        const safeText = escapeHtml((node.text || '').substring(0, 40));
        item.innerHTML = `
          <span style="font-size:12px;color:var(--text);">${safeText}${(node.text||'').length > 40 ? '…' : ''}</span>
          <button class="ai-highlight-btn" data-id="${escapeHtml(node.id)}" style="padding:4px 10px;border-radius:4px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;cursor:pointer;font-family:var(--font);">Highlight</button>
        `;
        $aiResultsList.appendChild(item);
      });
      
      // Highlight-Funktionalität
      setTimeout(() => {
        document.querySelectorAll('.ai-highlight-btn').forEach(btn => {
          btn.onclick = () => {
            const nodeId = btn.dataset.id;
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
              vx = -(node.x + node.width/2 - window.innerWidth/2);
              vy = -(node.y + node.height/2 - window.innerHeight/2);
              vs = 1.2;
              sR();
              toast('Node hervorgehoben 🔍');
            }
          };
        });
      }, 0);
      
    } else if (action === 'duplicates') {
      const duplicates = results;
      if (duplicates.length === 0) {
        $aiResultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--green);font-size:13px;">Keine Duplikate gefunden!</div>';
        return;
      }

      // FIX A3: Similarity-Anzeige + Aktions-Buttons (Auswählen, Erstes behalten)
      duplicates.forEach((dup, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:12px;margin-bottom:8px;border-radius:8px;background:var(--accent-soft);border:1px solid var(--glass-border);';
        const simPct = Math.round((dup.similarity || 1) * 100);
        const isFuzzy = simPct < 100;
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
            <div style="font-weight:600;font-size:12px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">"${escapeHtml(dup.text.substring(0, 50))}${dup.text.length > 50 ? '…' : ''}"</div>
            <div style="font-size:10px;color:${isFuzzy ? 'var(--text3)' : 'var(--green)'};font-weight:600;white-space:nowrap;">${dup.nodes.length}× · ${simPct}%</div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Positionen: ${dup.nodes.map(n => `(${Math.round(n.x)},${Math.round(n.y)})`).join(' · ')}</div>
          <div style="display:flex;gap:6px;">
            <button class="dup-select-btn" data-idx="${idx}" style="flex:1;padding:5px 8px;border-radius:5px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;cursor:pointer;font-family:var(--font);font-weight:500;">Auswählen</button>
            <button class="dup-keepfirst-btn" data-idx="${idx}" style="flex:1;padding:5px 8px;border-radius:5px;border:1px solid var(--red);background:transparent;color:var(--red);font-size:10px;cursor:pointer;font-family:var(--font);font-weight:500;">Erstes behalten</button>
          </div>
        `;
        $aiResultsList.appendChild(item);
      });

      // Handler nach DOM-Insertion verkabeln
      setTimeout(() => {
        document.querySelectorAll('.dup-select-btn').forEach(btn => {
          btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const group = duplicates[idx];
            if (!group) return;
            clrS();
            group.nodes.forEach(n => addS(n));
            sR();
            toast(`✓ ${group.nodes.length} Nodes selektiert`);
            $aiPicker.style.display = 'none';
          };
        });
        document.querySelectorAll('.dup-keepfirst-btn').forEach(btn => {
          btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const group = duplicates[idx];
            if (!group || group.nodes.length < 2) return;
            if (!confirm(`${group.nodes.length - 1} Duplikat(e) löschen, erstes behalten?`)) return;
            const toDelete = group.nodes.slice(1);
            toDelete.forEach(n => delN(n));
            toast(`🗑 ${toDelete.length} Duplikat(e) gelöscht`);
            // Liste neu rendern, ohne das ganze Modal zu schließen
            const fresh = AIOrganizer.findDuplicates();
            AIOrganizer.renderResults('duplicates', fresh);
          };
        });
      }, 0);

    } else if (action === 'layout') {
      const positions = results;
      $aiResultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Bereite Auto-Layout vor...<br><br>Dies wird alle Nodes neu positionieren, um Kreuzungen zu minimieren und die Lesbarkeit zu verbessern.</div>';
      
      const btnApply = document.createElement('button');
      btnApply.textContent = 'Auto-Layout anwenden';
      btnApply.style.cssText = 'padding:10px 20px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-weight:600;font-size:12px;cursor:pointer;font-family:var(--font);margin-right:8px;';
      btnApply.onclick = () => this.applyAutoLayout(positions);
      
      const btnPreview = document.createElement('button');
      btnPreview.textContent = 'Vorschau';
      btnPreview.style.cssText = 'padding:10px 20px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-weight:600;font-size:12px;cursor:pointer;font-family:var(--font);';
      btnPreview.onclick = () => this.previewAutoLayout(positions);
      
      $aiActions.appendChild(btnApply);
      $aiActions.appendChild(btnPreview);
    }
  },
  
  // FIX A1: Cluster werden räumlich gruppiert + optional in Group-Container verpackt
  applyClustering(clusters) {
    if (!clusters || !clusters.length) { toast('Keine Cluster'); return; }
    pH();
    const pad = 60, gap = 24, clusterGap = 180;
    // Aktuelle Position des "globalen Schwerpunkts" als Startpunkt
    let sx = nodes.reduce((s,n)=>s+n.x,0)/Math.max(1,nodes.length);
    let sy = nodes.reduce((s,n)=>s+n.y,0)/Math.max(1,nodes.length);
    let cursorX = sx - 600, cursorY = sy - 400;
    let rowMaxH = 0;

    clusters.forEach((cluster, ci) => {
      // Nodes nach Verbindungsgrad sortieren (zentrale Nodes oben links)
      const deg = {};
      cluster.forEach(n => { deg[n.id] = conns.filter(c => c.from === n.id || c.to === n.id).length; });
      const sorted = cluster.slice().sort((a,b) => (deg[b.id]||0) - (deg[a.id]||0));

      const cols = Math.ceil(Math.sqrt(sorted.length));
      const maxW = Math.max(...sorted.map(n => n.width));
      const maxH = Math.max(...sorted.map(n => n.height));
      const cellW = maxW + gap, cellH = maxH + gap;
      const rows = Math.ceil(sorted.length / cols);
      const blockW = cols * cellW + pad * 2;
      const blockH = rows * cellH + pad * 2;

      // Zeilenumbruch wenn nicht mehr in den "Streifen" passt
      if (cursorX + blockW > sx + 1200) {
        cursorX = sx - 600;
        cursorY += rowMaxH + clusterGap;
        rowMaxH = 0;
      }

      // Nodes neu positionieren
      sorted.forEach((n, i) => {
        if (n.locked) return;
        const col = i % cols, row = Math.floor(i / cols);
        n.x = snV(cursorX + pad + col * cellW);
        n.y = snV(cursorY + pad + row * cellH);
      });

      // Group-Container um Cluster legen
      const groupId = 'n' + (++nc);
      nodes.unshift({
        id: groupId,
        type: 'group',
        text: `Cluster ${ci + 1}`,
        x: snV(cursorX),
        y: snV(cursorY),
        width: blockW,
        height: blockH,
        scrollY: 0,
        isSelected: false,
        locked: false,
        bg: C('rgba(0,122,255,0.04)','rgba(0,122,255,0.04)'),
        textColor: C('rgba(0,122,255,0.85)','rgba(0,85,204,0.85)'),
        border: C('rgba(0,122,255,0.35)','rgba(0,122,255,0.35)'),
        typeData: {}
      });

      cursorX += blockW + clusterGap;
      rowMaxH = Math.max(rowMaxH, blockH);
    });

    aS(); uSB(); sR();
    toast(`📦 ${clusters.length} Cluster organisiert`);
    $aiPicker.style.display = 'none';
  },
  
  applyAutoLayout(positions) {
    pH(); // History Punkt
    Object.entries(positions).forEach(([id, pos]) => {
      const node = nodes.find(n => n.id === id);
      if (node) {
        node.x = snV(pos.x);
        node.y = snV(pos.y);
      }
    });
    toast('📐 Auto-Layout angewendet');
    $aiPicker.style.display = 'none';
    sR();
    aS();
  },
  
  previewAutoLayout(positions) {
    // Temporäre Vorschau ohne History
    Object.entries(positions).forEach(([id, pos]) => {
      const node = nodes.find(n => n.id === id);
      if (node) {
        node.x = snV(pos.x);
        node.y = snV(pos.y);
      }
    });
    sR();
    toast('Vorschau aktiv - Klick "Anwenden" zum Speichern oder Undo zum Zurücksetzen');
  }
};

// AI Button Handler
document.getElementById('btn-ai').onclick = () => {
  $aiPicker.style.display = 'flex';
  $aiResults.style.display = 'none';
};

$aiClose.onclick = () => {
  $aiPicker.style.display = 'none';
};

// Option Buttons Handler
document.querySelectorAll('.ai-option-btn').forEach(btn => {
  btn.onclick = async () => {
    const action = btn.dataset.action;
    
    // Loading State
    const origHTML = btn.innerHTML;
    btn.style.opacity = '0.6';
    btn.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>Analysiere...</div>';
    
    // Kurze Verzögerung für UX
    await new Promise(resolve => setTimeout(resolve, 600));
    
    let results;
    if (action === 'clusters') results = AIOrganizer.findClusters();
    else if (action === 'orphans') results = AIOrganizer.findOrphans();
    else if (action === 'duplicates') results = AIOrganizer.findDuplicates();
    else if (action === 'layout') results = AIOrganizer.calculateAutoLayout();
    
    $aiResults.style.display = 'block';
    AIOrganizer.renderResults(action, results);
    
    // Reset Button
    btn.style.opacity = '1';
    btn.innerHTML = origHTML;
  };
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $aiPicker.style.display === 'flex') {
    $aiPicker.style.display = 'none';
  }
});


// ===== END AI ORGANIZER =====

// ===== SMART INTEROPERABILITY BRIDGE v0.19 =====
// Externe Integrationen, API-Generierung & Cross-Tool Kommunikation

const InteropBridge = {
  // Konfiguration für externe Dienste
  integrations: {
    notion: { enabled: false, apiKey: '', databaseId: '' },
    trello: { enabled: false, apiKey: '', token: '' },
    github: { enabled: false, token: '', repo: '' },
    slack: { enabled: false, webhookUrl: '' },
    obsidian: { enabled: false, vaultPath: '' }
  },
  
  // Generiert eine REST API für das Board (lokal)
  generateLocalAPI() {
    const apiEndpoint = 'board-api://localhost';
    const swaggerSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Infinite Canvas Board API',
        version: '0.19',
        description: 'Automatisch generierte API für Board-Daten'
      },
      servers: [{ url: apiEndpoint }],
      paths: {
        '/nodes': {
          get: { summary: 'Alle Nodes abrufen', responses: { '200': { description: 'Erfolgreich' } } },
          post: { summary: 'Neuen Node erstellen', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } } }
        },
        '/connections': {
          get: { summary: 'Alle Connections abrufen' },
          post: { summary: 'Neue Connection erstellen' }
        },
        '/export': {
          get: { summary: 'Komplettes Board exportieren' }
        },
        '/import': {
          post: { summary: 'Board-Daten importieren' }
        }
      }
    };
    
    return { endpoint: apiEndpoint, spec: swaggerSpec };
  },
  
  // Exportiert Board-Daten in verschiedene Formate
  exportToFormat(format) {
    const data = {
      nodes: nodes.map(n => ({ id: n.id, text: n.text, x: n.x, y: n.y, type: n.type, color: n.color })),
      connections: conns.map(c => ({ from: c.from, to: c.to, label: c.label })),
      metadata: { exportedAt: new Date().toISOString(), version: '0.19' }
    };
    
    switch(format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'markdown':
        let md = '# Board Export\n\n';
        md += '## Nodes\n\n';
        data.nodes.forEach((n, i) => {
          md += `${i + 1}. **${n.text}** (${n.type}) - Position: (${Math.round(n.x)}, ${Math.round(n.y)})\n`;
        });
        md += '\n## Connections\n\n';
        data.connections.forEach(c => {
          const fromNode = data.nodes.find(n => n.id === c.from);
          const toNode = data.nodes.find(n => n.id === c.to);
          if (fromNode && toNode) {
            md += `- ${fromNode.text} → ${toNode.text}${c.label ? ` (${c.label})` : ''}\n`;
          }
        });
        return md;
      
      case 'csv':
        let csv = 'ID,Text,Type,X,Y,Color\n';
        data.nodes.forEach(n => {
          csv += `"${n.id}","${n.text.replace(/"/g, '""')}","${n.type}",${n.x},${n.y},"${n.color}"\n`;
        });
        return csv;
      
      case 'mermaid':
        let mermaid = 'graph TD\n';
        data.nodes.forEach(n => {
          const nodeId = `N${n.id.replace(/-/g, '')}`;
          mermaid += `  ${nodeId}[${n.text}]:::${n.type}\n`;
        });
        data.connections.forEach(c => {
          const fromId = `N${c.from.replace(/-/g, '')}`;
          const toId = `N${c.to.replace(/-/g, '')}`;
          mermaid += `  ${fromId} -->|${c.label || ''}| ${toId}\n`;
        });
        mermaid += '\nclassDef idea fill:#f9f,stroke:#333;\nclassDef task fill:#bbf,stroke:#333;\nclassDef note fill:#bfb,stroke:#333;\n';
        return mermaid;
      
      default:
        return JSON.stringify(data);
    }
  },
  
  // Importiert Daten aus externen Quellen
  async importFromFormat(format, inputData) {
    try {
      let importedData;
      
      if (format === 'json') {
        importedData = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
      } else if (format === 'markdown') {
        // Einfacher Markdown Parser
        importedData = { nodes: [], connections: [] };
        const lines = inputData.split('\n');
        let nodeIndex = 0;
        
        lines.forEach(line => {
          const nodeMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s+\((.+?)\)/);
          if (nodeMatch) {
            importedData.nodes.push({
              id: `imp-${Date.now()}-${nodeIndex++}`,
              text: nodeMatch[1],
              type: nodeMatch[2].toLowerCase(),
              x: Math.random() * 800,
              y: Math.random() * 600,
              color: '#ffffff'
            });
          }
        });
      } else if (format === 'mermaid') {
        // FIX B3: Robusterer Mermaid-Parser mit Shape-Erkennung & Labels
        importedData = { nodes: [], connections: [] };
        const nodeMap = {};
        let nodeIndex = 0;
        // Shape-Klammern → Node-Typ mapping
        // [text]=text, (text)=ellipse, {text}=diamond, [[text]]=hexagon, ((text))=link
        // ID darf Buchstaben/Ziffern/Underscore/Bindestrich enthalten
        const shapePatterns = [
          { rx: /\b([A-Za-z0-9_-]+)\(\(([^)]+)\)\)/g, type: 'link' },
          { rx: /\b([A-Za-z0-9_-]+)\[\[([^\]]+)\]\]/g, type: 'hexagon' },
          { rx: /\b([A-Za-z0-9_-]+)\{([^}]+)\}/g,     type: 'diamond' },
          { rx: /\b([A-Za-z0-9_-]+)\(([^)]+)\)/g,     type: 'ellipse' },
          { rx: /\b([A-Za-z0-9_-]+)\[([^\]]+)\]/g,    type: 'text' },
        ];
        const addNodeIfNew = (origId, text, type) => {
          if (nodeMap[origId]) return;
          const newId = `imp-${Date.now()}-${nodeIndex++}`;
          nodeMap[origId] = newId;
          importedData.nodes.push({ id: newId, text: text.trim(), type });
        };
        shapePatterns.forEach(({rx, type}) => {
          let m;
          while ((m = rx.exec(inputData)) !== null) {
            addNodeIfNew(m[1], m[2], type);
          }
        });

        // Connections: A --> B, A -->|label| B, A --- B, A -.-> B, A ==> B
        // Erlaubt auch IDs mit Shape-Suffix: A[Foo] --> B[Bar] — Shapes wurden oben schon erfasst
        const connRx = /([A-Za-z0-9_-]+)(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\}|\[\[[^\]]+\]\]|\(\([^)]+\)\))?\s*(?:--|==|-\.|-\.-)+>?\s*(?:\|([^|]+)\|)?\s*([A-Za-z0-9_-]+)/g;
        let cm;
        while ((cm = connRx.exec(inputData)) !== null) {
          const from = cm[1], label = (cm[2] || '').trim(), to = cm[3];
          // Wenn IDs in keinem Shape-Block auftauchten, als 'text' anlegen
          if (!nodeMap[from]) addNodeIfNew(from, from, 'text');
          if (!nodeMap[to])   addNodeIfNew(to,   to,   'text');
          importedData.connections.push({
            from: nodeMap[from],
            to: nodeMap[to],
            label: label
          });
        }
      } else if (format === 'csv') {
        // FIX B4-light: einfacher CSV-Import (Header-Zeile: ID,Text,Type,X,Y)
        importedData = { nodes: [], connections: [] };
        const lines = inputData.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV zu kurz (Header + Daten erwartet)');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''));
        const idx = { id: headers.indexOf('id'), text: headers.indexOf('text'), type: headers.indexOf('type'), x: headers.indexOf('x'), y: headers.indexOf('y') };
        for (let i = 1; i < lines.length; i++) {
          // Sehr einfacher CSV-Parser (unterstützt "..."-Quoting)
          const cells = lines[i].match(/("([^"]|"")*"|[^,]+)/g) || [];
          const clean = cells.map(c => c.replace(/^"|"$/g,'').replace(/""/g,'"'));
          importedData.nodes.push({
            id: idx.id   >= 0 ? clean[idx.id]   : `csv-${i}`,
            text: idx.text >= 0 ? clean[idx.text] : '',
            type: idx.type >= 0 ? clean[idx.type] : 'text',
            x: idx.x !== -1 ? parseFloat(clean[idx.x]) : undefined,
            y: idx.y !== -1 ? parseFloat(clean[idx.y]) : undefined,
          });
        }
      }
      
      if (importedData && importedData.nodes) {
        pH(); // History Punkt

        // FIX B1: Valide Node-Typen + ID-Mapping für Connections
        const validTypes = new Set(['text','sticky','checklist','group','table','link','diamond','ellipse','hexagon','image']);
        const typeAlias = { note:'text', idea:'text', task:'checklist', card:'text', '': 'text' };
        const idMap = {};

        // Viewport-Zentrum (falls keine Positionen vorhanden)
        const cssW = canvas.width / (window.devicePixelRatio || 1);
        const cssH = canvas.height / (window.devicePixelRatio || 1);
        const vcx = (cssW / 2 - vx) / vs;
        const vcy = (cssH / 2 - vy) / vs;
        let posCounter = 0;

        importedData.nodes.forEach((n, idx) => {
          let t = (n.type || '').toLowerCase();
          if (typeAlias[t]) t = typeAlias[t];
          if (!validTypes.has(t)) t = 'text';

          // Position: nutze gegebene, sonst Spiral um Viewport-Mitte
          let nx, ny;
          if (typeof n.x === 'number' && typeof n.y === 'number') {
            nx = n.x; ny = n.y;
          } else {
            const a = posCounter++ * 0.6, r = 60 + posCounter * 30;
            nx = vcx + Math.cos(a) * r; ny = vcy + Math.sin(a) * r;
          }

          // Basis-Node über mN() für korrekte Defaults (bg, textColor, border, typeData)
          const base = mN(t, n.text || 'Importierter Node', snV(nx), snV(ny));
          if (n.width)  base.width  = n.width;
          if (n.height) base.height = n.height;
          if (n.bg)        base.bg = n.bg;
          if (n.textColor) base.textColor = n.textColor;
          if (n.border)    base.border = n.border;
          if (n.typeData)  base.typeData = n.typeData;
          else if (n.items && t === 'checklist') base.typeData = { items: n.items };
          if (typeof n.locked === 'boolean') base.locked = n.locked;

          if (n.id) idMap[n.id] = base.id;
          nodes.push(base);
        });

        const importedConns = importedData.connections || importedData.conns || importedData.edges || [];
        importedConns.forEach(c => {
          const fromId = idMap[c.from || c.fromNode] || c.from;
          const toId   = idMap[c.to   || c.toNode]   || c.to;
          // Nur Connections übernehmen, deren Endpunkte existieren
          if (fromId && toId && nodes.find(n=>n.id===fromId) && nodes.find(n=>n.id===toId)) {
            conns.push({
              id: 'c' + Date.now() + Math.random().toString(36).slice(2,6),
              from: fromId,
              to: toId,
              fromSide: c.fromSide || 'right',
              toSide: c.toSide || 'left',
              label: c.label || '',
              style: c.style || 'solid',
              color: c.color || ''
            });
          }
        });

        uSB();
        sR();
        aS();
        toast(`✅ ${importedData.nodes.length} Nodes importiert`);
        return { success: true, count: importedData.nodes.length };
      }
      
      return { success: false, error: 'Keine gültigen Daten gefunden' };
      
    } catch (error) {
      console.error('Import Fehler:', error);
      toast('❌ Import fehlgeschlagen: ' + error.message);
      return { success: false, error: error.message };
    }
  },
  
  // Semantische Verbindungen zu externen Tools herstellen
  detectExternalReferences() {
    const references = {
      urls: [],
      emails: [],
      files: [],
      mentions: [],
      tags: []
    };
    
    nodes.forEach(node => {
      const text = node.text || '';
      
      // URLs finden
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
      const urls = text.match(urlRegex) || [];
      urls.forEach(url => {
        references.urls.push({ nodeId: node.id, url, domain: new URL(url).hostname });
      });
      
      // Emails finden
      const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = text.match(emailRegex) || [];
      emails.forEach(email => {
        references.emails.push({ nodeId: node.id, email });
      });
      
      // @Mentions finden
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      const mentions = text.match(mentionRegex) || [];
      mentions.forEach(mention => {
        references.mentions.push({ nodeId: node.id, user: mention.substring(1) });
      });
      
      // #Tags finden
      const tagRegex = /#([a-zA-Z0-9_-]+)/g;
      const tags = text.match(tagRegex) || [];
      tags.forEach(tag => {
        references.tags.push({ nodeId: node.id, tag: tag.substring(1) });
      });
    });
    
    return references;
  },
  
  // Zeigt gefundene Referenzen im UI an
  renderReferences(references) {
    $interopResultsList.innerHTML = '';
    
    let hasContent = false;
    
    if (references.urls.length > 0) {
      hasContent = true;
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:20px;';
      section.innerHTML = `<div style="font-weight:600;font-size:12px;color:var(--text);margin-bottom:8px;">🔗 Gefundene Links (${references.urls.length})</div>`;
      
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      
      references.urls.slice(0, 10).forEach(ref => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:8px;border-radius:6px;background:var(--accent-soft);display:flex;justify-content:space-between;align-items:center;';
        item.innerHTML = `
          <div style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">
            <span style="color:var(--text3);">${ref.domain}</span>
          </div>
          <button class="ref-goto-btn" data-node-id="${ref.nodeId}" style="padding:4px 8px;border-radius:4px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;cursor:pointer;font-family:var(--font);">Go To</button>
        `;
        list.appendChild(item);
      });
      
      section.appendChild(list);
      $interopResultsList.appendChild(section);
    }
    
    if (references.mentions.length > 0) {
      hasContent = true;
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:20px;';
      section.innerHTML = `<div style="font-weight:600;font-size:12px;color:var(--text);margin-bottom:8px;">👥 Erwähnungen (${references.mentions.length})</div>`;
      
      const users = [...new Set(references.mentions.map(m => m.user))];
      const userCloud = document.createElement('div');
      userCloud.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      
      users.forEach(user => {
        const count = references.mentions.filter(m => m.user === user).length;
        const badge = document.createElement('div');
        badge.style.cssText = 'padding:6px 12px;border-radius:16px;background:var(--accent-soft);border:1px solid var(--glass-border);font-size:11px;color:var(--text);';
        badge.innerHTML = `@${user} <span style="color:var(--text3);">(${count}x)</span>`;
        userCloud.appendChild(badge);
      });
      
      section.appendChild(userCloud);
      $interopResultsList.appendChild(section);
    }
    
    if (references.tags.length > 0) {
      hasContent = true;
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:20px;';
      section.innerHTML = `<div style="font-weight:600;font-size:12px;color:var(--text);margin-bottom:8px;">🏷️ Tags (${references.tags.length})</div>`;
      
      const tags = [...new Set(references.tags.map(t => t.tag))];
      const tagCloud = document.createElement('div');
      tagCloud.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      
      tags.forEach(tag => {
        const count = references.tags.filter(t => t.tag === tag).length;
        const badge = document.createElement('div');
        badge.style.cssText = 'padding:6px 12px;border-radius:16px;background:rgba(48,209,88,0.15);border:1px solid rgba(48,209,88,0.3);font-size:11px;color:var(--text);';
        badge.innerHTML = `#${tag} <span style="color:var(--text3);">(${count}x)</span>`;
        tagCloud.appendChild(badge);
      });
      
      section.appendChild(tagCloud);
      $interopResultsList.appendChild(section);
    }
    
    if (!hasContent) {
      $interopResultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Keine externen Referenzen gefunden.</div>';
    }
    
    // GoTo Buttons funktional machen
    setTimeout(() => {
      document.querySelectorAll('.ref-goto-btn').forEach(btn => {
        btn.onclick = () => {
          const nodeId = btn.dataset.nodeId;
          const node = nodes.find(n => n.id === nodeId);
          if (node) {
            vx = -(node.x + node.width/2 - window.innerWidth/2);
            vy = -(node.y + node.height/2 - window.innerHeight/2);
            vs = 1.2;
            sR();
            $interopPicker.style.display = 'none';
            toast('Node hervorgehoben 🔍');
          }
        };
      });
    }, 0);
  },
  
  // Webhook Sender für externe Dienste
  async sendWebhook(url, payload) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        toast('✅ Webhook erfolgreich gesendet');
        return { success: true };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      toast('❌ Webhook Fehler: ' + error.message);
      return { success: false, error: error.message };
    }
  }
};

// UI für Interoperability Bridge
document.getElementById('btn-interop').onclick = () => {
  $interopPicker.style.display = 'flex';
  $interopExport.style.display = 'block';
  $interopImport.style.display = 'none';
  $interopRefs.style.display = 'none';
};

$interopClose.onclick = () => {
  $interopPicker.style.display = 'none';
};

// Tab Switching
$interopExportTab.onclick = () => {
  $interopExport.style.display = 'block';
  $interopImport.style.display = 'none';
  $interopRefs.style.display = 'none';
  $interopExportTab.classList.add('active');
  $interopImportTab.classList.remove('active');
  $interopRefsTab.classList.remove('active');
};

$interopImportTab.onclick = () => {
  $interopExport.style.display = 'none';
  $interopImport.style.display = 'block';
  $interopRefs.style.display = 'none';
  $interopExportTab.classList.remove('active');
  $interopImportTab.classList.add('active');
  $interopRefsTab.classList.remove('active');
};

$interopRefsTab.onclick = () => {
  $interopExport.style.display = 'none';
  $interopImport.style.display = 'none';
  $interopRefs.style.display = 'block';
  $interopExportTab.classList.remove('active');
  $interopImportTab.classList.remove('active');
  $interopRefsTab.classList.add('active');
  
  // Referenzen analysieren
  const refs = InteropBridge.detectExternalReferences();
  InteropBridge.renderReferences(refs);
};

// Export Format Selection
document.querySelectorAll('.export-format-btn').forEach(btn => {
  btn.onclick = () => {
    const format = btn.dataset.format;
    const data = InteropBridge.exportToFormat(format);
    
    // Download auslösen
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `board-export-${new Date().toISOString().split('T')[0]}.${format === 'mermaid' ? 'md' : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast(`📥 Export als ${format.toUpperCase()} gestartet`);
  };
});

// Copy to Clipboard
document.getElementById('btn-copy-json').onclick = () => {
  const data = InteropBridge.exportToFormat('json');
  navigator.clipboard.writeText(data).then(() => {
    toast('📋 JSON in Zwischenablage kopiert');
  }).catch(err => {
    toast('❌ Kopieren fehlgeschlagen');
  });
};

// Import Handler
document.getElementById('btn-import-file').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.md,.txt';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      let format = 'json';
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        format = content.trim().toLowerCase().startsWith('graph ') ? 'mermaid' : 'markdown';
      } else if (file.name.endsWith('.mmd') || content.trim().toLowerCase().startsWith('graph ')) {
        format = 'mermaid';
      } else if (file.name.endsWith('.csv')) {
        format = 'csv';
      }

      const result = await InteropBridge.importFromFormat(format, content);
      if (result.success) {
        $interopPicker.style.display = 'none';
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
};

// Paste from Clipboard
document.getElementById('btn-import-clipboard').onclick = async () => {
  try {
    const content = await navigator.clipboard.readText();
    
    // Format automatisch erkennen
    let format = 'json';
    const trimmed = content.trim();
    if (/^graph\s+(TD|TB|BT|LR|RL)/i.test(trimmed) || /^flowchart\s+/i.test(trimmed)) {
      format = 'mermaid';
    } else if (/^id\s*,/i.test(trimmed) || /^"?id"?\s*,/i.test(trimmed)) {
      format = 'csv';
    } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      format = 'json';
    } else if (content.includes('#') && content.includes('##')) {
      format = 'markdown';
    }

    const result = await InteropBridge.importFromFormat(format, content);
    if (result.success) {
      $interopPicker.style.display = 'none';
    }
  } catch (error) {
    toast('❌ Zugriff auf Zwischenablage nicht möglich');
  }
};

// FIX B5: Webhook-UI verkabeln (URL speichern, testen)
(function setupWebhookUI(){
  const $url = document.getElementById('webhook-url-input');
  const $save = document.getElementById('webhook-save-btn');
  const $test = document.getElementById('webhook-test-btn');
  const $status = document.getElementById('webhook-status');
  if (!$url || !$save || !$test) return;

  // Vorherigen Wert aus Storage laden
  $url.value = StorageManager.get('ic_webhook_url') || '';

  const showStatus = (msg, color) => {
    $status.style.display = 'block';
    $status.textContent = msg;
    $status.style.color = color || 'var(--text3)';
  };

  $save.onclick = () => {
    const url = $url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      showStatus('❌ URL muss mit http(s):// beginnen', 'var(--red)');
      return;
    }
    StorageManager.set('ic_webhook_url', url);
    showStatus(url ? '✅ Webhook gespeichert' : 'Webhook entfernt', 'var(--green)');
    toast(url ? '💾 Webhook gespeichert' : '🗑 Webhook entfernt');
  };

  $test.onclick = async () => {
    const url = $url.value.trim();
    if (!url) { showStatus('❌ URL eingeben', 'var(--red)'); return; }
    if (!/^https?:\/\//i.test(url)) { showStatus('❌ URL muss mit http(s):// beginnen', 'var(--red)'); return; }
    showStatus('⏳ Sende…', 'var(--text2)');
    const payload = {
      event: 'board.test',
      timestamp: new Date().toISOString(),
      source: 'Infinite Canvas v0.24',
      data: InteropBridge.exportToFormat ? JSON.parse(InteropBridge.exportToFormat('json')) : expD()
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors'
      });
      if (res.ok) {
        showStatus(`✅ Erfolgreich (HTTP ${res.status})`, 'var(--green)');
        toast('🚀 Webhook gesendet');
      } else {
        showStatus(`⚠️ HTTP ${res.status} – Endpunkt erreicht, aber Antwort ist Fehler`, '#FF9F0A');
      }
    } catch (e) {
      // CORS-Fehler oder kein Netz
      showStatus(`❌ ${e.message} (oft CORS-blockiert)`, 'var(--red)');
    }
  };
})();

// API Generator
document.getElementById('btn-generate-api').onclick = () => {
  const api = InteropBridge.generateLocalAPI();
  
  const swaggerJson = JSON.stringify(api.spec, null, 2);
  const blob = new Blob([swaggerJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'board-api-spec.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast('🔌 API Spec heruntergeladen');
};

// ===== END INTEROP MODULE =====

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $interopPicker.style.display === 'flex') {
    $interopPicker.style.display = 'none';
  }
  if (e.key === 'Escape' && document.getElementById('share-dock').classList.contains('open')) {
    P2PShare.close();
  }
});

// ===== P2P SHARE MODULE v0.20 =====
// Lokaler Datenaustausch per Drag & Drop, Clipboard oder WebRTC

const P2PShare = {
  currentData: null,
  shareId: null,
  
  // Generiert eine eindeutige Share-ID
  generateShareId() {
    return 'share-' + Math.random().toString(36).substr(2, 9);
  },
  
  // Öffnet das Share Dock
  open() {
    const dock = document.getElementById('share-dock');
    dock.classList.add('open');
    this.updateStatus('Bereit zum Teilen', false);
  },
  
  // Schließt das Share Dock
  close() {
    const dock = document.getElementById('share-dock');
    dock.classList.remove('open');
    this.currentData = null;
    this.shareId = null;
    document.getElementById('share-code-display').style.display = 'none';
    document.getElementById('share-status').style.display = 'none';
  },
  
  // Aktualisiert den Status-Text
  updateStatus(message, isError = false) {
    const statusEl = document.getElementById('share-status');
    statusEl.textContent = message;
    statusEl.style.background = isError ? 'rgba(255,69,58,0.15)' : 'var(--accent-soft)';
    statusEl.style.color = isError ? 'var(--red)' : 'var(--text2)';
    statusEl.style.display = 'block';
  },
  
  // Verarbeitet gedraggte Nodes
  handleDrop(data) {
    if (!data || !data.nodes) {
      this.updateStatus('❌ Ungültige Daten', true);
      return;
    }
    
    this.currentData = data;
    this.shareId = this.generateShareId();
    
    const code = JSON.stringify({
      type: 'board-share',
      id: this.shareId,
      timestamp: Date.now(),
      data: data
    });
    
    document.getElementById('share-code-display').textContent = code;
    document.getElementById('share-code-display').style.display = 'block';
    this.updateStatus(`✅ ${data.nodes.length} Node(s) bereit zum Teilen`);
    
    toast(`📦 ${data.nodes.length} Node(s) im Share Dock`);
  },
  
  // Erstellt einen Share-Link mit Größen-Check
  generateLink() {
    if (!this.currentData) {
      this.updateStatus('❌ Zuerst Nodes ablegen', true);
      return;
    }

    const code = document.getElementById('share-code-display').textContent;
    const encoded = btoa(encodeURIComponent(code));
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}?share=${encoded}`;

    // FIX S3: URL-Limit-Check (sicher 2000, viele Mailer kürzen bei 1800)
    const URL_LIMIT = 1800;
    if (shareUrl.length > URL_LIMIT) {
      const sizeKB = Math.round(shareUrl.length / 1024 * 10) / 10;
      this.updateStatus(`⚠️ Zu groß für URL (${sizeKB} KB > ${URL_LIMIT/1024} KB). Kopiere Code stattdessen.`, true);
      // Fallback: Code in Zwischenablage statt URL
      navigator.clipboard.writeText(code).then(() => {
        toast(`📋 Code kopiert (${sizeKB} KB) — Empfänger fügt ihn im Share-Dock ein`);
      }).catch(() => {
        toast('❌ Auch Code-Kopieren fehlgeschlagen — Strg+C auf dem angezeigten Code');
      });
      return;
    }

    navigator.clipboard.writeText(shareUrl).then(() => {
      const sizeKB = Math.round(shareUrl.length / 1024 * 10) / 10;
      this.updateStatus(`🔗 Link kopiert (${sizeKB} KB)`);
      toast('📋 Share-Link kopiert!');
    }).catch(err => {
      this.updateStatus('❌ Link-Erstellung fehlgeschlagen', true);
    });
  },
  
  // Kopiert den Share-Code
  copyCode() {
    if (!this.currentData) {
      this.updateStatus('❌ Zuerst Nodes ablegen', true);
      return;
    }
    
    const code = document.getElementById('share-code-display').textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.updateStatus('📋 Code kopiert!');
      toast('📋 Share-Code kopiert!');
    }).catch(err => {
      this.updateStatus('❌ Kopieren fehlgeschlagen', true);
    });
  },
  
  // Importiert geteilte Daten
  importSharedData(encodedData) {
    try {
      const decoded = decodeURIComponent(atob(encodedData));
      const parsed = JSON.parse(decoded);

      if (parsed.type !== 'board-share' || !parsed.data) {
        throw new Error('Ungültiges Share-Format');
      }

      const sharedData = parsed.data;
      if (!sharedData.nodes || !sharedData.nodes.length) {
        throw new Error('Keine Nodes im Share');
      }

      // Viewport-Zentrum in Welt-Koordinaten
      const cssW = canvas.width / (window.devicePixelRatio || 1);
      const cssH = canvas.height / (window.devicePixelRatio || 1);
      const viewportCenter = {
        x: (cssW / 2 - vx) / vs,
        y: (cssH / 2 - vy) / vs
      };

      // Bounding-Box der geteilten Nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      sharedData.nodes.forEach(n => {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + (n.width || 0));
        maxY = Math.max(maxY, n.y + (n.height || 0));
      });
      const offsetX = viewportCenter.x - (minX + maxX) / 2;
      const offsetY = viewportCenter.y - (minY + maxY) / 2;

      pH();
      // FIX S2: ID-Mapping aufbauen, damit Connections nicht verloren gehen
      const idMap = {};
      sharedData.nodes.forEach(n => {
        const newId = 'n' + (++nc);
        idMap[n.id] = newId;
        // Vollständigen Node bauen — Defaults via mN() für ungültige Felder
        const base = mN(n.type || 'text', n.text || '', (n.x || 0) + offsetX, (n.y || 0) + offsetY);
        const merged = Object.assign(base, n, {
          id: newId,
          x: (n.x || 0) + offsetX,
          y: (n.y || 0) + offsetY,
          isSelected: false
        });
        nodes.push(merged);
      });

      // Connections mit gemappten IDs übernehmen
      const sharedConns = sharedData.connections || sharedData.conns || sharedData.edges || [];
      sharedConns.forEach(c => {
        const fromId = idMap[c.from || c.fromNode];
        const toId = idMap[c.to || c.toNode];
        if (fromId && toId) {
          conns.push({
            id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
            from: fromId,
            to: toId,
            fromSide: c.fromSide || 'right',
            toSide: c.toSide || 'left',
            label: c.label || '',
            style: c.style || 'solid',
            color: c.color || ''
          });
        }
      });

      // FIX S1: korrekte Funktionsnamen statt saveState/renderMinimap/updateCounts
      aS();
      uSB();
      sR();

      toast(`✅ ${sharedData.nodes.length} Node(s) importiert!`);
      return true;
    } catch (error) {
      console.error('Share Import Error:', error);
      toast('❌ Import fehlgeschlagen: ' + error.message);
      return false;
    }
  }
};

// Share Dock Event Listener
document.getElementById('btn-share').onclick = () => {
  P2PShare.open();
};

document.getElementById('share-dock-close').onclick = () => {
  P2PShare.close();
};

document.getElementById('share-generate-link').onclick = () => {
  P2PShare.generateLink();
};

document.getElementById('share-copy-code').onclick = () => {
  P2PShare.copyCode();
};

// Drag & Drop Handler für Share Zone
const dropZone = document.getElementById('share-drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  // Prüfen ob es sich um Board-Daten handelt
  try {
    const data = e.dataTransfer.getData('application/board-nodes');
    if (data) {
      const nodesData = JSON.parse(data);
      P2PShare.handleDrop(nodesData);
      return;
    }
  } catch (err) {
    // Kein Board-Daten Format
  }
  
  // Fallback: Text/JSON aus Clipboard versuchen
  const textData = e.dataTransfer.getData('text/plain');
  if (textData) {
    try {
      const parsed = JSON.parse(textData);
      if (parsed.nodes) {
        P2PShare.handleDrop(parsed);
      } else {
        P2PShare.updateStatus('❌ Keine Node-Daten erkannt', true);
      }
    } catch (err) {
      P2PShare.updateStatus('❌ Ungültiges Format', true);
    }
  }
});

// Keyboard Shortcut für Paste (Strg+V) im Drop Zone
dropZone.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    navigator.clipboard.readText().then(text => {
      try {
        const parsed = JSON.parse(text);
        if (parsed.nodes || parsed.type === 'board-share') {
          const data = parsed.type === 'board-share' ? parsed.data : parsed;
          P2PShare.handleDrop(data);
        } else {
          P2PShare.updateStatus('❌ Keine Node-Daten erkannt', true);
        }
      } catch (err) {
        P2PShare.updateStatus('❌ Ungültiges Format im Clipboard', true);
      }
    }).catch(err => {
      P2PShare.updateStatus('❌ Clipboard-Zugriff verweigert', true);
    });
  }
});

// Check for share parameter on page load
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const shareParam = urlParams.get('share');
  
  if (shareParam) {
    setTimeout(() => {
      const imported = P2PShare.importSharedData(shareParam);
      if (imported) {
        // Remove share param from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        toast('✅ Geteilte Nodes importiert!');
      }
    }, 500);
  }
});

// ===== TOFEESHARE LIVE ROOM MODULE v0.21 =====
// WebRTC-basierte Echtzeit-Synchronisation mit PeerJS

const LiveRoom = {
  peer: null,
  conn: null,
  roomId: null,
  isHost: false,
  peers: [],
  syncEnabled: true,
  // FIX S7: Remote-Cursor-Tracking
  remoteCursors: {},        // peerId → { x, y, color, name, t }
  myColor: null,
  myName: null,
  _cursorSendT: 0,
  _cursorThrottleMs: 60,    // ~16 Hz
  
  // Initialisiert PeerJS
  init() {
    try {
      this.peer = new Peer(null, {
        debug: 2,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      
      this.peer.on('open', (id) => {
        console.log('LiveRoom: Meine Peer-ID:', id);
        this.updateRoomStatus('connected', 'Verbunden mit PeerJS-Server');
      });
      
      this.peer.on('connection', (conn) => {
        // Eingehende Verbindung (als Host)
        this.handleConnection(conn);
      });
      
      this.peer.on('error', (err) => {
        console.error('LiveRoom Error:', err);
        this.updateRoomStatus('error', 'Verbindungsfehler: ' + err.type);
      });
      
      this.peer.on('disconnected', () => {
        console.log('LiveRoom: Von Server getrennt');
        this.updateRoomStatus('disconnected', 'Vom Server getrennt');
      });
    } catch (err) {
      console.error('LiveRoom Init Error:', err);
      this.updateRoomStatus('error', 'Initialisierung fehlgeschlagen');
    }
  },
  
  // Erstellt einen neuen Raum
  createRoom() {
    if (!this.peer || !this.peer.id) {
      this.updateRoomStatus('error', 'Peer nicht verbunden');
      return;
    }
    
    this.roomId = this.peer.id;
    this.isHost = true;
    this.peers = [];
    
    document.getElementById('room-current-id').textContent = this.roomId;
    document.getElementById('room-info').style.display = 'block';
    document.getElementById('room-status').style.display = 'block';
    document.getElementById('room-id-input').value = this.roomId;
    
    this.updateRoomStatus('connected', `Raum "${this.roomId}" erstellt. Warte auf Teilnehmer...`);
    this.updatePeerCount();
    
    toast(`📡 Raum erstellt: ${this.roomId}`);
  },
  
  // Tritt einem Raum bei
  joinRoom(roomId) {
    if (!roomId || !this.peer || !this.peer.id) {
      this.updateRoomStatus('error', 'Ungültige Raum-ID oder nicht verbunden');
      return;
    }
    
    this.roomId = roomId;
    this.isHost = false;
    
    try {
      const conn = this.peer.connect(roomId, {
        metadata: { type: 'client' }
      });
      
      conn.on('open', () => {
        console.log('LiveRoom: Verbunden mit Raum:', roomId);
        this.conn = conn;
        
        document.getElementById('room-current-id').textContent = roomId;
        document.getElementById('room-info').style.display = 'block';
        document.getElementById('room-status').style.display = 'block';
        
        this.updateRoomStatus('connected', `Verbunden mit Raum "${roomId}"`);
        this.updatePeerCount(1);
        
        // Board-State vom Host anfordern
        this.send({ type: 'request-state' });
        
        toast(`📡 Raum beigetreten: ${roomId}`);
      });
      
      conn.on('error', (err) => {
        console.error('LiveRoom Connection Error:', err);
        this.updateRoomStatus('error', 'Verbindung fehlgeschlagen');
      });
      
      conn.on('close', () => {
        console.log('LiveRoom: Verbindung geschlossen');
        this.disconnect();
      });
      
      conn.on('data', (data) => {
        this.handleData(data, conn);
      });

    } catch (err) {
      console.error('LiveRoom Join Error:', err);
      this.updateRoomStatus('error', 'Beitritt fehlgeschlagen');
    }
  },
  
  // Verarbeitet eingehende Verbindung
  handleConnection(conn) {
    this.peers.push(conn);
    
    conn.on('open', () => {
      console.log('LiveRoom: Neuer Peer verbunden');
      this.updatePeerCount(this.peers.length);
      
      // Aktuellen Board-State senden
      this.sendToPeer(conn, {
        type: 'state-update',
        data: this.getBoardState()
      });
    });
    
    conn.on('data', (data) => {
      // FIX S4: conn-Referenz mitgeben, damit Host gezielt antworten kann
      this.handleData(data, conn);
    });

    conn.on('close', () => {
      this.peers = this.peers.filter(p => p !== conn);
      this.updatePeerCount(this.peers.length);
    });
  },

  // Verarbeitet eingehende Daten
  handleData(data, conn) {
    console.log('LiveRoom: Daten erhalten:', data.type);

    switch(data.type) {
      case 'state-update':
        // Board-State empfangen und anwenden
        if (data.data) {
          this.applyBoardState(data.data);
        }
        break;
        
      case 'node-add':
        // Neue Node empfangen
        if (data.node) {
          nodes.push(data.node);
          aS();
          render();
          scheduleMM();
          uSB();
        }
        break;

      case 'node-update':
        // Node-Update empfangen
        if (data.node && data.node.id) {
          const idx = nodes.findIndex(n => n.id === data.node.id);
          if (idx !== -1) {
            nodes[idx] = { ...nodes[idx], ...data.node };
            aS();
            render();
          }
        }
        break;

      case 'node-delete':
        // Node-Löschung empfangen
        if (data.nodeId) {
          nodes = nodes.filter(n => n.id !== data.nodeId);
          conns = conns.filter(c => c.from !== data.nodeId && c.to !== data.nodeId);
          aS();
          render();
          scheduleMM();
          uSB();
        }
        break;

      case 'conn-add':
        // Neue Connection empfangen
        if (data.conn) {
          conns.push(data.conn);
          aS();
          render();
          scheduleMM();
        }
        break;

      case 'conn-delete':
        // Connection-Löschung empfangen
        if (data.connIndex !== undefined) {
          conns.splice(data.connIndex, 1);
          aS();
          render();
          scheduleMM();
        }
        break;
        
      case 'request-state':
        // FIX S4: Antwort gezielt an anfragenden Client (conn aus handleData-Parameter)
        if (this.isHost && conn) {
          this.sendToPeer(conn, {
            type: 'state-update',
            data: this.getBoardState()
          });
        }
        break;

      // FIX S7: Cursor-Position empfangen + an andere Peers weiterleiten (Host = Relay)
      case 'cursor':
        if (data.peerId && typeof data.x === 'number' && typeof data.y === 'number') {
          this.remoteCursors[data.peerId] = {
            x: data.x, y: data.y,
            color: data.color || '#007AFF',
            name: data.name || data.peerId.slice(0, 6),
            t: performance.now()
          };
          // Host leitet an alle anderen Peers weiter
          if (this.isHost && conn) {
            this.peers.forEach(p => { if (p !== conn && p.open) p.send(data); });
          }
          sR();
        }
        break;

      case 'cursor-leave':
        if (data.peerId) {
          delete this.remoteCursors[data.peerId];
          if (this.isHost && conn) {
            this.peers.forEach(p => { if (p !== conn && p.open) p.send(data); });
          }
          sR();
        }
        break;
    }
  },

  // FIX S7: Eigene Cursor-Position senden (throttled)
  sendCursor(worldX, worldY) {
    if (!this.peer || !this.peer.id) return;
    if (!this.isHost && !this.conn) return;
    if (this.isHost && this.peers.length === 0) return;
    const now = performance.now();
    if (now - this._cursorSendT < this._cursorThrottleMs) return;
    this._cursorSendT = now;
    if (!this.myColor) this.myColor = `hsl(${Math.floor(Math.random()*360)}, 70%, 55%)`;
    if (!this.myName)  this.myName  = (this.peer.id || 'me').slice(0, 6);
    this.send({
      type: 'cursor',
      peerId: this.peer.id,
      x: worldX, y: worldY,
      color: this.myColor,
      name: this.myName
    });
  },

  // Aufräumen stale Cursor (> 5 s ohne Update)
  cleanupCursors() {
    const now = performance.now();
    let changed = false;
    Object.keys(this.remoteCursors).forEach(id => {
      if (now - this.remoteCursors[id].t > 5000) {
        delete this.remoteCursors[id];
        changed = true;
      }
    });
    if (changed) sR();
  },
  
  // Sendet Daten an alle Peers
  send(data) {
    if (this.isHost) {
      // Als Host an alle Clients senden
      this.peers.forEach(conn => {
        if (conn.open) {
          conn.send(data);
        }
      });
    } else if (this.conn && this.conn.open) {
      // Als Client zum Host senden
      this.conn.send(data);
    }
  },
  
  // Sendet Daten an spezifischen Peer
  sendToPeer(conn, data) {
    if (conn && conn.open) {
      conn.send(data);
    }
  },
  
  // Ruft aktuellen Board-State ab
  getBoardState() {
    return {
      nodes: nodes.map(n => ({ ...n })),
      conns: conns.map(c => ({ ...c })),
      vx, vy, vs
    };
  },
  
  // Wendet Board-State an (ohne Echo zurück an Peers)
  applyBoardState(state) {
    if (!state || !state.nodes) return;

    nodes = state.nodes.map(n => ({ ...n }));
    conns = state.conns ? state.conns.map(c => ({ ...c })) : [];
    // viewport NICHT überschreiben — jeder Peer hat seinen eigenen Zoom/Pan
    // (vx/vy/vs nur beim initialen Join sinnvoll, aber das stört aktive Nutzer)

    // FIX S6: Echo-Loop verhindern — kurzzeitig syncEnabled aus, lokal speichern, wieder an
    const wasSyncEnabled = this.syncEnabled;
    this.syncEnabled = false;
    try {
      StorageManager.set('ic_v3', JSON.stringify(expD()));
      markSaved(Date.now(), 'Sync empfangen');
    } catch(_){}
    sR();
    scheduleMM();
    uSB();
    this.syncEnabled = wasSyncEnabled;

    toast('📡 Board-State synchronisiert');
  },
  
  // Verlässt den Raum
  leaveRoom() {
    // FIX S7: anderen Peers signalisieren, dass mein Cursor weg ist
    try { this.send({ type: 'cursor-leave', peerId: this.peer && this.peer.id }); } catch(_){}
    this.remoteCursors = {};
    this.disconnect();
    document.getElementById('room-info').style.display = 'none';
    document.getElementById('room-status').style.display = 'none';
    document.getElementById('room-id-input').value = '';
    this.roomId = null;
    this.isHost = false;
    sR();
    toast('🚪 Raum verlassen');
  },
  
  // Trennt alle Verbindungen
  disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peers) {
      this.peers.forEach(p => p.close());
      this.peers = [];
    }
    this.updatePeerCount(0);
    this.updateRoomStatus('disconnected', 'Verbindung getrennt');
  },
  
  // Aktualisiert Room-Status UI
  updateRoomStatus(status, message) {
    const statusEl = document.getElementById('room-status');
    const titleEl = document.getElementById('room-status-title');
    const textEl = document.getElementById('room-status-text');
    
    statusEl.style.display = 'block';
    
    switch(status) {
      case 'connected':
        statusEl.style.background = 'rgba(48,209,88,0.15)';
        titleEl.style.color = 'var(--green)';
        titleEl.textContent = '● Verbunden';
        break;
      case 'connecting':
        statusEl.style.background = 'var(--accent-soft)';
        titleEl.style.color = 'var(--accent)';
        titleEl.textContent = '◍ Verbinde...';
        break;
      case 'disconnected':
        statusEl.style.background = 'rgba(255,69,58,0.15)';
        titleEl.style.color = 'var(--red)';
        titleEl.textContent = '○ Getrennt';
        break;
      case 'error':
        statusEl.style.background = 'rgba(255,69,58,0.15)';
        titleEl.style.color = 'var(--red)';
        titleEl.textContent = '✕ Fehler';
        break;
    }
    
    textEl.textContent = message;
  },
  
  // Aktualisiert Peer-Anzeige
  updatePeerCount(count) {
    const el = document.getElementById('room-peer-count');
    if (el) {
      el.textContent = count !== undefined ? count : this.peers.length;
    }
  },
  
  // Kopiert Raum-ID
  copyRoomId() {
    if (this.roomId) {
      navigator.clipboard.writeText(this.roomId).then(() => {
        toast('📋 Raum-ID kopiert');
      });
    }
  }
};

// Tab-Wechsel im Share Dock
document.getElementById('tab-share').onclick = () => {
  document.getElementById('share-tab-content').style.display = 'block';
  document.getElementById('room-tab-content').style.display = 'none';
  document.getElementById('tab-share').classList.add('primary');
  document.getElementById('tab-room').classList.remove('primary');
};

document.getElementById('tab-room').onclick = () => {
  document.getElementById('share-tab-content').style.display = 'none';
  document.getElementById('room-tab-content').style.display = 'block';
  document.getElementById('tab-room').classList.add('primary');
  document.getElementById('tab-share').classList.remove('primary');
  
  // LiveRoom initialisieren beim ersten Öffnen
  if (!LiveRoom.peer) {
    LiveRoom.init();
    LiveRoom.updateRoomStatus('connecting', 'Initialisiere PeerJS...');
  }
};

// Room Event Listener
document.getElementById('room-create-btn').onclick = () => {
  if (!LiveRoom.peer) {
    LiveRoom.init();
  }
  setTimeout(() => LiveRoom.createRoom(), 100);
};

document.getElementById('room-join-btn').onclick = () => {
  const roomId = document.getElementById('room-id-input').value.trim();
  if (roomId) {
    if (!LiveRoom.peer) {
      LiveRoom.init();
    }
    setTimeout(() => LiveRoom.joinRoom(roomId), 100);
  } else {
    LiveRoom.updateRoomStatus('error', 'Bitte Raum-ID eingeben');
  }
};

document.getElementById('room-leave-btn').onclick = () => {
  LiveRoom.leaveRoom();
};

document.getElementById('room-copy-id').onclick = () => {
  LiveRoom.copyRoomId();
};

// FIX S8: QR-Code anzeigen für Mobile-Beitritt
document.getElementById('room-show-qr').onclick = () => {
  const container = document.getElementById('room-qr-container');
  const target = document.getElementById('room-qr-canvas');
  if (!LiveRoom.roomId) { toast('Erst Raum erstellen'); return; }
  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }
  if (typeof qrcode === 'undefined') {
    toast('QR-Code-Bibliothek nicht geladen');
    return;
  }
  try {
    // URL mit Auto-Join-Hash, sodass Scan direkt verbindet
    const joinUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(LiveRoom.roomId)}`;
    const qr = qrcode(0, 'M'); // Type 0 = auto, Error correction Medium
    qr.addData(joinUrl);
    qr.make();
    // 4px cell size, 2 module margin
    target.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    const svg = target.querySelector('svg');
    if (svg) { svg.style.maxWidth = '180px'; svg.style.width = '100%'; svg.style.height = 'auto'; }
    container.style.display = 'block';
  } catch (e) {
    console.error('QR-Code-Generierung fehlgeschlagen', e);
    toast('❌ QR-Code-Fehler');
  }
};

// Auto-Join via Hash beim Page-Load (vom QR-Scan)
window.addEventListener('load', () => {
  const m = (window.location.hash || '').match(/^#room=(.+)$/);
  if (!m) return;
  const roomId = decodeURIComponent(m[1]);
  setTimeout(() => {
    // Share-Dock + Room-Tab öffnen
    P2PShare.open();
    document.getElementById('tab-room').click();
    if (!LiveRoom.peer) LiveRoom.init();
    setTimeout(() => {
      document.getElementById('room-id-input').value = roomId;
      LiveRoom.joinRoom(roomId);
      // Hash entfernen (verhindert Re-Join bei Refresh)
      history.replaceState({}, document.title, window.location.pathname);
    }, 400);
  }, 800);
});

// ===== END TOFEESHARE LIVE ROOM MODULE =====

// ===== PREDICTIVE WORKFLOW MODULE v0.23 =====
const PredictiveWorkflow = {
  enabled: true,
  actionHistory: [],
  maxHistory: 50,
  patterns: {},
  macros: [],
  lastActions: [],
  suggestionTimeout: null,
  
  init() {
    this.loadFromStorage();
    this.setupListeners();
    console.log('🧠 Predictive Workflow v0.23 initialized');
  },
  
  setupListeners() {
    // Track node creation
    document.addEventListener('nodeCreated', (e) => {
      this.recordAction('createNode', { type: e.detail?.type || 'default' });
    });
    
    // Track connections
    document.addEventListener('connectionCreated', (e) => {
      this.recordAction('connectNodes', {});
    });
    
    // Track deletions
    document.addEventListener('nodeDeleted', () => {
      this.recordAction('deleteNode', {});
    });
    
    // Track moves
    let moveDebounce;
    document.addEventListener('nodeMoved', (e) => {
      clearTimeout(moveDebounce);
      moveDebounce = setTimeout(() => {
        this.recordAction('moveNode', {});
      }, 500);
    });
  },
  
  recordAction(type, data) {
    if (!this.enabled) return;
    
    const action = { type, data, timestamp: Date.now() };
    this.actionHistory.push(action);
    this.lastActions.push(type);
    
    // Keep history limited
    if (this.actionHistory.length > this.maxHistory) {
      this.actionHistory.shift();
    }
    if (this.lastActions.length > 10) {
      this.lastActions.shift();
    }
    
    // Analyze patterns after each action
    this.analyzePatterns();
    
    // Save to storage
    this.saveToStorage();
  },
  
  analyzePatterns() {
    if (this.lastActions.length < 3) return;
    
    // Look for repeating sequences of 3 actions
    const sequence = this.lastActions.slice(-3).join('->');
    
    if (!this.patterns[sequence]) {
      this.patterns[sequence] = { count: 1, lastSeen: Date.now() };
    } else {
      this.patterns[sequence].count++;
      this.patterns[sequence].lastSeen = Date.now();
      
      // If pattern repeated 3+ times, suggest macro
      if (this.patterns[sequence].count >= 3) {
        this.suggestMacro(sequence);
      }
    }
  },
  
  suggestMacro(pattern) {
    if (this.suggestionTimeout) clearTimeout(this.suggestionTimeout);
    
    this.suggestionTimeout = setTimeout(() => {
      this.showSuggestion(`Muster erkannt: ${pattern}. Als Macro speichern?`, () => {
        this.saveMacro(pattern);
      });
    }, 1000);
  },
  
  showSuggestion(message, onAccept) {
    // Remove existing suggestions
    const existing = document.querySelector('.pw-suggestion');
    if (existing) existing.remove();
    
    const suggestion = document.createElement('div');
    suggestion.className = 'pw-suggestion';
    suggestion.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: var(--glass);
      border: 1px solid var(--accent);
      border-radius: 12px;
      padding: 12px 16px;
      backdrop-filter: blur(20px);
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: pwSlideIn 0.3s ease;
    `;
    
    suggestion.innerHTML = `
      <div style="font-size: 13px; font-weight: 500; color: var(--text);">${message}</div>
      <div style="display: flex; gap: 8px;">
        <button id="pw-accept" style="flex:1; padding: 6px 12px; background: var(--accent); color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Ja</button>
        <button id="pw-dismiss" style="flex:1; padding: 6px 12px; background: transparent; color: var(--text2); border: 1px solid var(--glass-border); border-radius: 6px; font-size: 12px; cursor: pointer;">Nein</button>
      </div>
    `;
    
    document.body.appendChild(suggestion);
    
    document.getElementById('pw-accept').onclick = () => {
      onAccept();
      suggestion.remove();
    };
    
    document.getElementById('pw-dismiss').onclick = () => {
      suggestion.remove();
    };
    
    // Auto dismiss after 10 seconds
    setTimeout(() => {
      if (suggestion.parentNode) suggestion.remove();
    }, 10000);
  },
  
  saveMacro(pattern) {
    // FIX A7: Konkretes Recipe statt nur Pattern-String — basierend auf letzten 3 Actions
    const recent = this.actionHistory.slice(-3);
    const recipe = recent.map(a => ({
      type: a.type,
      data: a.data || {}
    }));
    // Default-Name aus dem Pattern
    const niceName = pattern.replace(/createNode/g, 'Node').replace(/connectNodes/g, '→').replace(/->/g, ' ');
    const macro = {
      id: `macro_${Date.now()}`,
      pattern,
      name: niceName,
      recipe,
      created: Date.now(),
      uses: 0
    };
    this.macros.push(macro);
    this.saveToStorage();
    this.showSuggestion(`✅ Macro „${niceName}" gespeichert. Über die Toolbar (🧠) ausführbar.`, () => {});
  },

  // FIX A7: Macro ausführen — interpretiert das Recipe
  executeMacro(macroId) {
    const macro = this.macros.find(m => m.id === macroId);
    if (!macro || !macro.recipe || !macro.recipe.length) {
      toast('⚠️ Macro hat kein Recipe');
      return;
    }
    // Auto-Save & History während der Replay-Phase nicht hetzen
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);
    const baseX = (cssW / 2 - vx) / vs - 60;
    const baseY = (cssH / 2 - vy) / vs - 40;
    const created = [];
    let cx = baseX, cy = baseY;

    macro.recipe.forEach((step, i) => {
      if (step.type === 'createNode') {
        const t = (step.data && step.data.type) || 'text';
        const n = addN(t, cx, cy);
        created.push(n);
        cx += 280; // nächster Slot daneben
      } else if (step.type === 'connectNodes' && created.length >= 2) {
        const a = created[created.length - 2], b = created[created.length - 1];
        const { fromSide, toSide } = bSides(a, b);
        conns.push({
          id: 'c' + Date.now() + i,
          from: a.id, to: b.id,
          fromSide, toSide,
          label: '', style: 'solid', color: ''
        });
        pH(); aS(); uSB(); sR();
        emit('connectionCreated', { from: a.id, to: b.id });
      } else if (step.type === 'deleteNode' && created.length) {
        const target = created.pop();
        if (target) delN(target);
      }
    });

    macro.uses = (macro.uses || 0) + 1;
    this.saveToStorage();
    toast(`🧠 Macro „${macro.name || macro.pattern}" ausgeführt`);
    if (created.length) {
      clrS();
      created.forEach(n => addS(n));
      sR();
    }
  },

  // FIX A7: UI-Panel für Macros
  openMacroPanel() {
    let panel = document.getElementById('macro-panel');
    if (panel) { panel.remove(); return; }
    panel = document.createElement('div');
    panel.id = 'macro-panel';
    panel.style.cssText = `
      position: fixed; top: 60px; right: 16px; z-index: 9960;
      width: min(360px, 92vw); max-height: 70vh; overflow-y: auto;
      background: var(--glass); border: 1px solid var(--glass-border);
      border-radius: 12px; box-shadow: var(--shadow-lg);
      backdrop-filter: blur(40px) saturate(180%);
      padding: 14px;
    `;
    const stats = this.getStats();
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:600;font-size:13px;color:var(--text);">🧠 Macros</div>
        <button id="macro-close" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 6px;">✕</button>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:12px;">${stats.totalActions} Aktionen · ${stats.patternsDetected} Muster · ${stats.macrosSaved} Macros</div>
    `;
    if (!this.macros.length) {
      html += `<div style="text-align:center;padding:24px 12px;color:var(--text3);font-size:12px;line-height:1.6;">
        Noch keine Macros.<br>
        Wiederhole eine Aktionsfolge (z.B. Node + Node + Connect) 3× —<br>
        ich schlage sie dir dann als Macro vor.
      </div>`;
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px;">';
      this.macros.forEach((m, idx) => {
        const name = escapeHtml(m.name || m.pattern || `Macro ${idx+1}`);
        html += `
          <div style="padding:10px;border-radius:8px;background:var(--accent-soft);border:1px solid var(--glass-border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-weight:600;font-size:12px;color:var(--text);">${name}</div>
              <div style="font-size:9px;color:var(--text3);">${m.uses || 0}× genutzt</div>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-bottom:8px;font-family:'SF Mono',Menlo,monospace;">${escapeHtml(m.pattern || '')}</div>
            <div style="display:flex;gap:6px;">
              <button class="macro-run-btn" data-id="${m.id}" style="flex:1;padding:6px;border-radius:5px;border:none;background:var(--accent);color:#fff;font-size:11px;cursor:pointer;font-family:var(--font);font-weight:500;">▶ Ausführen</button>
              <button class="macro-del-btn" data-id="${m.id}" style="padding:6px 10px;border-radius:5px;border:1px solid var(--red);background:transparent;color:var(--red);font-size:11px;cursor:pointer;font-family:var(--font);">🗑</button>
            </div>
          </div>`;
      });
      html += '</div>';
    }
    panel.innerHTML = html;
    document.body.appendChild(panel);

    panel.querySelector('#macro-close').onclick = () => panel.remove();
    panel.querySelectorAll('.macro-run-btn').forEach(btn => {
      btn.onclick = () => { this.executeMacro(btn.dataset.id); };
    });
    panel.querySelectorAll('.macro-del-btn').forEach(btn => {
      btn.onclick = () => {
        if (!confirm('Macro wirklich löschen?')) return;
        this.macros = this.macros.filter(m => m.id !== btn.dataset.id);
        this.saveToStorage();
        panel.remove();
        this.openMacroPanel();
      };
    });
  },
  
  saveToStorage() {
    try {
      localStorage.setItem('predictive_workflow', JSON.stringify({
        patterns: this.patterns,
        macros: this.macros,
        actionHistory: this.actionHistory.slice(-20) // Nur letzte 20 speichern
      }));
    } catch (e) {
      console.warn('Could not save predictive workflow data');
    }
  },
  
  loadFromStorage() {
    try {
      const data = localStorage.getItem('predictive_workflow');
      if (data) {
        const parsed = JSON.parse(data);
        this.patterns = parsed.patterns || {};
        this.macros = parsed.macros || [];
        this.actionHistory = parsed.actionHistory || [];
      }
    } catch (e) {
      console.warn('Could not load predictive workflow data');
    }
  },
  
  getStats() {
    return {
      totalActions: this.actionHistory.length,
      patternsDetected: Object.keys(this.patterns).length,
      macrosSaved: this.macros.length
    };
  }
};

// Initialize Predictive Workflow
setTimeout(() => {
  PredictiveWorkflow.init();
}, 1000);

// FIX S7: Stale-Cursor-Cleanup für LiveRoom (alle 2 s)
setInterval(() => {
  if (typeof LiveRoom !== 'undefined' && LiveRoom.cleanupCursors) LiveRoom.cleanupCursors();
}, 2000);

// Add button to toolbar for macro access (optional)
// This would be added to the toolbar HTML in a real implementation

console.log('🧠 Predictive Workflow Module v0.23 loaded');
// ===== END PREDICTIVE WORKFLOW MODULE =====

// ===== END P2P SHARE MODULE =====

initCanvas();


// ===== SETTINGS MODAL =====
(function(){
  const $sm = document.getElementById('settings-modal');
  const $btn = document.getElementById('btn-settings');
  const $close = document.getElementById('settings-close');
  const $closeBtn = document.getElementById('settings-close-btn');
  const $wkInput = document.getElementById('settings-writekey-input');
  const $wkSave = document.getElementById('settings-writekey-save');
  const $wkStatus = document.getElementById('settings-writekey-status');
  const $cidInput = document.getElementById('settings-canvasid-input');
  const $cidSave = document.getElementById('settings-canvasid-save');
  const $cidStatus = document.getElementById('settings-canvasid-status');

  function openSettings(){
    const stored = StorageManager.get('ic_write_key') || '';
    $wkInput.value = stored ? '••••••••' : '';
    $cidInput.value = getCanvasId();
    $wkStatus.textContent = stored ? '✓ Key gespeichert' : 'Noch kein Key gespeichert';
    $wkStatus.style.color = stored ? '#30D158' : 'var(--text3)';
    $sm.style.display = 'flex';
  }
  function closeSettings(){ $sm.style.display = 'none'; }

  if ($btn)      $btn.onclick = openSettings;
  if ($close)    $close.onclick = closeSettings;
  if ($closeBtn) $closeBtn.onclick = closeSettings;
  $sm.addEventListener('mousedown', e => { if (e.target === $sm) closeSettings(); });

  if ($wkSave) $wkSave.onclick = () => {
    const val = $wkInput.value.trim();
    if (!val || val === '••••••••') { $wkStatus.textContent = 'Kein Wert eingegeben'; return; }
    StorageManager.set('ic_write_key', val);
    $wkInput.value = '••••••••';
    $wkStatus.textContent = '✓ Key gespeichert';
    $wkStatus.style.color = '#30D158';
    toast('🔑 Write-Key gespeichert');
  };

  if ($cidSave) $cidSave.onclick = () => {
    const val = $cidInput.value.trim();
    if (!val || !/^[A-Za-z0-9_\-]{1,80}$/.test(val)) {
      $cidStatus.textContent = '⚠ Nur Buchstaben, Zahlen, _ und - erlaubt (max. 80)';
      $cidStatus.style.color = '#FF453A';
      return;
    }
    StorageManager.set('ic_canvas_id', val);
    $cidStatus.textContent = '✓ Wechsle zu "' + val + '" …';
    $cidStatus.style.color = '#30D158';
    setTimeout(() => { closeSettings(); loadFromBackend().catch(()=>{}); }, 800);
    toast('📂 Canvas: ' + val);
  };
})();
// ===== END SETTINGS MODAL =====
