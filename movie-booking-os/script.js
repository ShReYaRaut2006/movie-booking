// ===== Textbook variables (Silberschatz bounded buffer) =====
const BUFFER_SIZE = 5;
const buffer = new Array(BUFFER_SIZE).fill(null); // shared bounded buffer
let inn = 0;      // "in"  : next free slot (producer writes here)
let out = 0;      // "out" : next full slot (consumer reads here)
let counter = 0;  // number of requests currently in the buffer
let paused = false, useLock = true, custNo = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===== Semaphore (counting) – wait()/signal() as in the textbook =====
class Semaphore{
  constructor(n){this.count=n;this.q=[]}
  async wait(){ if(this.count>0){this.count--;} else await new Promise(r=>this.q.push(r)); }
  signal(){ if(this.q.length) this.q.shift()(); else this.count++; }
}
const mutex = new Semaphore(1);            // mutual exclusion on buffer, in, out, counter
const empty = new Semaphore(BUFFER_SIZE);  // counts empty slots (producer waits when 0)
const full  = new Semaphore(0);            // counts full slots  (consumer waits when 0)
const seatMutex = new Semaphore(1);        // protects the shared seat table

// ===== Shared seat data =====
const SEATS = ['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','B6'];
const seatOwner = {}; // seat -> customer name, undefined = available
const conflict = {};

// ===== UI helpers =====
const $ = id => document.getElementById(id);
function log(t, cls){const d=document.createElement('div');d.className=cls||'';d.textContent=t;const l=$('log');l.appendChild(d);l.scrollTop=l.scrollHeight}
function render(){
  $('seats').innerHTML = SEATS.map(s=>{
    const c = conflict[s]?'conflict':seatOwner[s]?'booked':'';
    return `<div class="seat ${c}" id="s-${s}">${s}<small>${seatOwner[s]||'free'}</small></div>`}).join('');
  $('buf').innerHTML = buffer.map((r,i)=>`<div class="slot ${r?'full':''}"><b>slot ${i}</b>${r?`<div>${r.name}<br>${r.seat}</div>`:'<div>empty</div>'}
    <div class="ptr">${i===inn?'in ▲ ':''}${i===out?'out ▲':''}</div></div>`).join('');
  $('stats').innerHTML = `<div class="pill">in<span>${inn}</span></div><div class="pill">out<span>${out}</span></div><div class="pill">counter<span>${counter}</span></div>
   <div class="pill">empty<span>${empty.count}</span></div><div class="pill">full<span>${full.count}</span></div><div class="pill">mutex<span>${mutex.count}</span></div>`;
}
function flashDenied(seat){const e=$('s-'+seat);if(e){e.classList.add('denied');setTimeout(()=>e.classList.remove('denied'),1400)}}

// ===== PRODUCER: a customer creating a booking request =====
async function producer(name, seat){
  const item = {name, seat};
  log(`${name} generated booking request for seat ${seat}`, 'p');
  if(counter === BUFFER_SIZE) log(`Buffer FULL – ${name} (producer) is waiting`, 'w');
  await empty.wait();            // wait if no empty slot  (while counter == BUFFER_SIZE)
  await mutex.wait();            // ---- enter critical section (buffer) ----
  buffer[inn] = item;            // buffer[in] = nextProduced
  log(`Request from ${name} added to buffer slot ${inn}`, 'p');
  inn = (inn + 1) % BUFFER_SIZE; // in = (in + 1) % BUFFER_SIZE
  counter++;                     // counter++
  mutex.signal();                // ---- leave critical section ----
  full.signal();                 // one more full slot: wake a consumer
  render();
}

// ===== CONSUMER: ticket booking system =====
async function consumer(id){
  const me = 'Counter-' + id;
  let announced = false;
  while(true){
    if(paused){ await sleep(200); continue; }
    if(counter === 0 && !announced){ log(`Buffer EMPTY – ${me} (consumer) is waiting`, 'w'); announced = true; }
    await full.wait();           // wait if no full slot  (while counter == 0)
    if(paused){ full.signal(); await sleep(200); continue; }
    announced = false;
    await mutex.wait();          // ---- enter critical section (buffer) ----
    const item = buffer[out];    // nextConsumed = buffer[out]
    buffer[out] = null;
    out = (out + 1) % BUFFER_SIZE; // out = (out + 1) % BUFFER_SIZE
    counter--;                   // counter--
    mutex.signal();              // ---- leave critical section ----
    empty.signal();              // one more empty slot: wake a producer
    render();
    log(`${me} processing ${item.name}'s request for seat ${item.seat}`, 'c');
    await sleep(900);
    await bookSeat(item, me);
  }
}

// ===== Seat booking: the shared seat table is the 2nd critical section =====
async function bookSeat(item, me){
  if(useLock) await seatMutex.wait();   // ---- enter critical section (seat table) ----
  const free = !seatOwner[item.seat];   // CHECK
  await sleep(600);                     // pretend payment/db work: widens the race window
  if(free){                             // BOOK (without the mutex both counters can reach here!)
    if(seatOwner[item.seat]){ conflict[item.seat] = true;
      log(`RACE CONDITION: seat ${item.seat} booked twice (${seatOwner[item.seat]} and ${item.name})!`, 'no'); }
    seatOwner[item.seat] = item.name;
    if(!conflict[item.seat]) log(`Seat ${item.seat} successfully booked for ${item.name} (${me})`, 'ok');
  } else {
    log(`Seat ${item.seat} already booked – ${item.name}'s request rejected`, 'no');
    flashDenied(item.seat);
  }
  if(useLock) seatMutex.signal();       // ---- leave critical section ----
  render();
}

// ===== Buttons =====
const randSeat = () => SEATS[Math.floor(Math.random()*SEATS.length)];
function newCustomer(seat){ producer('Customer-' + (++custNo), seat || randSeat()); }
function burst(){ for(let i=0;i<8;i++) setTimeout(()=>newCustomer(),i*150); }
function race(){
  const free = SEATS.filter(s=>!seatOwner[s]); const s = free.length? free[Math.floor(Math.random()*free.length)] : 'A1';
  log(`--- Race: two customers try seat ${s} at the same time ---`, 'w');
  newCustomer(s); newCustomer(s);
}

render();
log('System started. 2 consumer threads (Counter-1, Counter-2) are ready.', 'c');
consumer(1); consumer(2);
