// Pac-Run: simplified Pac-Man–style game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart');

const TILE = 20;
const COLS = canvas.width / TILE; // 28
const ROWS = canvas.height / TILE; // 31

let score = 0;
let lives = 3;
let map = [];
let pelletsLeft = 0;

const DIR = {NONE:[0,0], UP:[0,-1], DOWN:[0,1], LEFT:[-1,0], RIGHT:[1,0]};

function makeMap() {
  // simple map: border walls and repeated inner pattern
  map = new Array(ROWS).fill(0).map(()=>new Array(COLS).fill(0));
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (r===0||r===ROWS-1||c===0||c===COLS-1) map[r][c]=1; // wall
      else map[r][c]=2; // pellet
    }
  }
  // carve some corridors
  for (let r=2;r<ROWS-2;r+=4){
    for (let c=2;c<COLS-2;c++) map[r][c]=0;
  }
  for (let c=3;c<COLS-3;c+=6){
    for (let r=3;r<ROWS-3;r++) map[r][c]=1; // vertical walls
  }
  // add power pellets in corners
  map[1][1]=3; map[1][COLS-2]=3; map[ROWS-2][1]=3; map[ROWS-2][COLS-2]=3;
  // count pellets
  pelletsLeft=0;
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (map[r][c]===2||map[r][c]===3) pelletsLeft++;
}

let player = {x:14,y:23, dir:DIR.NONE, nextDir:DIR.NONE};
let ghosts = [];

function resetEntities(){
  player = {x:14,y:23, dir:DIR.NONE, nextDir:DIR.NONE, speed:1};
  ghosts = [
    {x:13,y:11,color:'#ff6666',mode:'chase'},
    {x:14,y:11,color:'#66ff66',mode:'chase'},
    {x:15,y:11,color:'#66b3ff',mode:'chase'}
  ];
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw map
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      const v = map[r][c];
      const x = c*TILE, y=r*TILE;
      if (v===1){ ctx.fillStyle='#071426'; ctx.fillRect(x,y,TILE,TILE); }
      if (v===2){ ctx.fillStyle='#e8f7ff'; ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,2.5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(232,247,255,0.08)'; ctx.fillRect(x+TILE/2-1,y+TILE/2-1,2,2); }
      if (v===3){ ctx.fillStyle='#fff8b0'; ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,6,0,Math.PI*2); ctx.fill(); ctx.shadowColor='rgba(255,200,80,0.6)'; ctx.shadowBlur=8; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.fill(); ctx.shadowBlur=0; }
    }
  }
  // draw player as spaceship
  const px = player.x*TILE+TILE/2, py = player.y*TILE+TILE/2;
  const angle = getPlayerAngle();
  ctx.save();
  ctx.translate(px,py);
  ctx.rotate(angle);
  // ship body
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath();
  ctx.moveTo(TILE*0.5,0);
  ctx.lineTo(-TILE*0.35,TILE*0.25);
  ctx.lineTo(-TILE*0.35,-TILE*0.25);
  ctx.closePath();
  ctx.fill();
  // thruster
  ctx.fillStyle = '#ff6a1a';
  ctx.beginPath(); ctx.moveTo(-TILE*0.35, -TILE*0.1); ctx.lineTo(-TILE*0.6,0); ctx.lineTo(-TILE*0.35, TILE*0.1); ctx.closePath(); ctx.fill();
  ctx.restore();
  // draw ghosts
  ghosts.forEach(g=>{
    const gx = g.x*TILE+TILE/2, gy = g.y*TILE+TILE/2;
    // UFO-style enemy
    ctx.save();
    ctx.translate(gx,gy);
    ctx.fillStyle = g.mode==='frightened' ? '#89a3ff' : g.color;
    ctx.beginPath(); ctx.ellipse(0,0,TILE*0.38,TILE*0.22,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(0,-TILE*0.06,TILE*0.18,TILE*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

function getPlayerAngle(){
  if (player.dir===DIR.LEFT) return Math.PI;
  if (player.dir===DIR.RIGHT) return 0;
  if (player.dir===DIR.UP) return -Math.PI/2;
  if (player.dir===DIR.DOWN) return Math.PI/2;
  return 0;
}

function canMove(x,y){
  if (x<0||x>=COLS||y<0||y>=ROWS) return false;
  return map[y][x]!==1;
}

function stepPlayer(){
  // try nextDir first
  const nx = player.x + player.nextDir[0];
  const ny = player.y + player.nextDir[1];
  if (canMove(nx,ny)) player.dir = player.nextDir;
  const tx = player.x + player.dir[0];
  const ty = player.y + player.dir[1];
  if (canMove(tx,ty)){
    player.x = tx; player.y = ty;
    eatPelletAt(player.x, player.y);
  }
}

function eatPelletAt(x,y){
  if (map[y][x]===2){ map[y][x]=0; score+=10; pelletsLeft--; }
  else if (map[y][x]===3){ map[y][x]=0; score+=50; pelletsLeft--; triggerPower(); }
}

function triggerPower(){
  ghosts.forEach(g=>g.mode='frightened');
  setTimeout(()=>ghosts.forEach(g=>g.mode='chase'),6000);
}

function stepGhosts(){
  ghosts.forEach(g=>{
    // simple AI: try to move toward player or random when frightened
    const directions = [DIR.UP,DIR.DOWN,DIR.LEFT,DIR.RIGHT];
    let best=null; let bestScore=1e9;
    for (const d of directions){
      const nx = g.x + d[0], ny = g.y + d[1];
      if (!canMove(nx,ny)) continue;
      const dist = Math.hypot(nx-player.x, ny-player.y);
      const scoreCandidate = (g.mode==='frightened') ? Math.random()*100 : dist;
      if (best==null || scoreCandidate<bestScore){ best=d; bestScore=scoreCandidate; }
    }
    if (best) { g.x += best[0]; g.y += best[1]; }
  });
}

function checkCollisions(){
  for (const g of ghosts){
    if (g.x===player.x && g.y===player.y){
      if (g.mode==='frightened'){ score+=200; // eat ghost: send home
        g.x=14; g.y=11; g.mode='chase';
      } else {
        // lose life
        lives--; updateHUD();
        if (lives<=0) gameOver(); else respawn();
      }
    }
  }
  if (pelletsLeft<=0) levelWin();
}

let tickId=null;
function gameTick(){
  stepPlayer();
  stepGhosts();
  checkCollisions();
  draw();
  updateHUD();
}

function updateHUD(){ scoreEl.textContent = score; livesEl.textContent = lives; }

function respawn(){ player.x=14; player.y=23; player.dir=DIR.NONE; player.nextDir=DIR.NONE; ghosts.forEach((g,i)=>{g.x=13+i; g.y=11; g.mode='chase'}); }

function levelWin(){ messageEl.textContent='You win! Press Restart.'; clearInterval(tickId); }
function gameOver(){ messageEl.textContent='Game Over. Press Restart.'; clearInterval(tickId); }

function startGame(){
  score=0; lives=3; messageEl.textContent=''; makeMap(); resetEntities(); updateHUD(); draw();
  if (tickId) clearInterval(tickId);
  tickId = setInterval(gameTick, 160);
}

// input
window.addEventListener('keydown', e=>{
  const key = e.key;
  if (key==='ArrowUp') player.nextDir = DIR.UP;
  if (key==='ArrowDown') player.nextDir = DIR.DOWN;
  if (key==='ArrowLeft') player.nextDir = DIR.LEFT;
  if (key==='ArrowRight') player.nextDir = DIR.RIGHT;
});

restartBtn.addEventListener('click', ()=>startGame());

// start
startGame();
