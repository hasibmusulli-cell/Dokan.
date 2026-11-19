const SUPABASE_URL = "https://rwkkimixctybzgicxnhi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iRtENk9FrUJLx5iQcPd5qQ_ha2DoTLE";
const EMAIL_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMQihRBlN5Csv_4omk8d1OZV6LMEKtPyY33f3KAM3QSk-3Z86Mp2UOtdGs1FtXaVMx/exec";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const today = new Date().toISOString().slice(0,10);
const bn = n => Number(n||0).toLocaleString("bn-BD") + " ৳";
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const show = id => ["loading","customerView","login","admin"].forEach(s => $(s).hidden = s !== id);
let toastT; function toast(t){const e=$("toast");e.textContent=t;e.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove("on"),2400)}
let CUST = [], DUE = {};

async function init(){
  const token = new URLSearchParams(location.search).get("c");
  if(token){
    const {data} = await db.rpc("get_due",{t:token});
    show("customerView");
    if(data && data[0]){
      $("cName").textContent = data[0].name;
      $("cDue").textContent = bn(data[0].due);
      $("cNote").textContent = Number(data[0].due) > 0 ? "" : "আপনার কোনো বাকি নেই। ধন্যবাদ।";
    } else { $("cDue").textContent = "—"; $("cNote").textContent = "লিংকটি সঠিক নয়। দোকানদারের কাছ থেকে নতুন লিংক নিন।"; }
    return;
  }
  const {data:{session}} = await db.auth.getSession();
  session ? loadAdmin() : show("login");
}

$("eye").onclick = ()=>{const p=$("pass");const h=p.type==="password";p.type=h?"text":"password";$("eye").textContent=h?"লুকান":"দেখুন"};
$("pass").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("loginBtn").onclick = async()=>{
  $("loginErr").textContent=""; $("loginBtn").disabled=true; $("loginBtn").textContent="অপেক্ষা করুন…";
  const {error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("pass").value});
  $("loginBtn").disabled=false; $("loginBtn").textContent="লগইন করুন";
  error ? $("loginErr").textContent="ইমেইল বা পাসওয়ার্ড ভুল হয়েছে। আবার চেষ্টা করুন।" : loadAdmin();
};
$("logout").onclick = async()=>{await db.auth.signOut();$("pass").value="";show("login")};

async function loadAdmin(){
  show("admin");
  $("todayLbl").textContent = new Date().toLocaleDateString("bn-BD",{weekday:"long",day:"numeric",month:"long"});
  const [c,l,d] = await Promise.all([
    db.from("customers").select("*").order("created_at",{ascending:false}),
    db.from("ledger").select("customer_id,amount"),
    db.from("daily").select("*").eq("day",today).maybeSingle()]);
  if(c.error){ toast("ডাটা আনতে সমস্যা হয়েছে"); return; }
  CUST = c.data||[]; DUE = {};
  (l.data||[]).forEach(x=>DUE[x.customer_id]=(DUE[x.customer_id]||0)+Number(x.amount));
  $("tDue").textContent = bn(Object.values(DUE).reduce((a,b)=>a+b,0));
  const dd = d.data;
  $("tSales").textContent = bn(dd?.sales);
  $("tProfit").textContent = bn(dd?.profit);
  $("tBuy").textContent = bn(dd?.purchase);
  if($("secProfit")) $("secProfit").textContent = bn(dd?.profit);
  if($("secBuy")) $("secBuy").textContent = bn(dd?.purchase);
  $("dSales").value = dd?.sales ?? ""; $("dProfit").value = dd?.profit ?? ""; $("dBuy").value = dd?.purchase ?? "";
  renderList();
}

function renderList(){
  const q = $("search").value.trim().toLowerCase();
  const rows = CUST.filter(c=>!q || (c.name+" "+(c.phone||"")).toLowerCase().includes(q));
  $("list").innerHTML = rows.length ? rows.map(c=>{
    const due = DUE[c.id]||0;
    return `<div class="cust"><div class="crow"><div><div class="cname">${esc(c.name)}</div><div class="muted">${esc(c.phone||c.email||"")}</div></div>
    <div class="cdue ${due<=0?"zero":""}">${bn(due)}</div></div>
    <div class="acts"><button class="b-add" data-a="add" data-id="${c.id}">+ বাকি</button>
    <button class="b-pay" data-a="pay" data-id="${c.id}">− জমা</button>
    <button class="b-wa" data-a="wa" data-id="${c.id}">WhatsApp</button>
    <button class="b-msg" data-a="msg" data-id="${c.id}">মেসেজ</button>
    <button class="b-mail" data-a="mail" data-id="${c.id}">ইমেইল</button>
    <button data-a="hist" data-id="${c.id}">ইতিহাস</button>
    <button class="ghost" data-a="link" data-id="${c.id}">লিংক</button>
    <button class="ghost" data-a="edit" data-id="${c.id}">এডিট</button>
    <button class="ghost" data-a="del" data-id="${c.id}" style="color:#ff6b6b">ডিলিট</button></div></div>`}).join("")
    : `<p class="empty">${CUST.length?"কাউকে পাওয়া যায়নি":"এখনো কোনো কাস্টমার নেই। উপরের বাটন চেপে প্রথম কাস্টমার যোগ করুন।"}</p>`;
}
$("search").oninput = renderList;
$("list").onclick = e=>{
  const b = e.target.closest("button"); if(!b) return;
  const c = CUST.find(x=>x.id===b.dataset.id); if(!c) return;
  ({
    add:()=>txSheet(c,1),
    pay:()=>txSheet(c,-1),
    wa:()=>sendWA(c),
    msg:()=>sendDirectMsg(c),
    mail:()=>sendDirectEmail(c),
    hist:()=>histSheet(c),
    link:()=>copyLink(c),
    edit:()=>editSheet(c),
    del:()=>deleteCustomer(c)
  })[b.dataset.a]();
};

function openSheet(title,html){ $("sheetTitle").textContent=title; $("sheetBody").innerHTML=html; $("sheet").hidden=false; }
function closeSheet(){ $("sheet").hidden=true; }
$("sheetClose").onclick = closeSheet;
$("sheet").onclick = e=>{ if(e.target===$("sheet")) closeSheet(); };

$("openAdd").onclick = ()=>{
  openSheet("নতুন কাস্টমার",`<label>নাম<input id="nName"></label>
    <label>ফোন (WhatsApp নম্বর)<input id="nPhone" type="tel" inputmode="tel"></label>
    <label>ইমেইল<input id="nEmail" type="email" inputmode="email"></label>
    <button class="primary" id="nSave">যোগ করুন</button>`);
  $("nSave").onclick = async()=>{
    const name = $("nName").value.trim(); if(!name) return toast("নাম লিখুন");
    $("nSave").disabled = true;
    const {error} = await db.from("customers").insert({name,phone:$("nPhone").value.trim(),email:$("nEmail").value.trim()});
    if(error){ $("nSave").disabled=false; return toast("যোগ করা যায়নি, আবার চেষ্টা করুন"); }
    closeSheet(); toast("কাস্টমার যোগ হয়েছে"); loadAdmin();
  };
};

function editSheet(c){
  openSheet("কাস্টমার তথ্য এডিট",`<label>নাম<input id="eName" value="${esc(c.name)}"></label>
    <label>ফোন (WhatsApp নম্বর)<input id="ePhone" type="tel" inputmode="tel" value="${esc(c.phone||"")}"></label>
    <label>ইমেইল<input id="eEmail" type="email" inputmode="email" value="${esc(c.email||"")}"></label>
    <button class="primary" id="eSave">আপডেট করুন</button>`);
  $("eSave").onclick = async()=>{
    const name = $("eName").value.trim(); if(!name) return toast("নাম লিখুন");
    $("eSave").disabled = true;
    const {error} = await db.from("customers").update({
      name,
      phone:$("ePhone").value.trim(),
      email:$("eEmail").value.trim()
    }).eq("id",c.id);
    if(error){ $("eSave").disabled=false; return toast("আপডেট হয়নি, আবার চেষ্টা করুন"); }
    closeSheet(); toast("তথ্য আপডেট হয়েছে"); loadAdmin();
  };
}

async function deleteCustomer(c){
  if(!confirm(`"${c.name}" এর প্রোফাইল ও হিসাব কি স্থায়ীভাবে ডিলিট করতে চান?`)) return;
  await db.from("ledger").delete().eq("customer_id",c.id);
  const {error} = await db.from("customers").delete().eq("id",c.id);
  if(error) return toast("ডিলিট করা যায়নি (Supabase Delete পলিসি চেক করুন)");
  toast("কাস্টমার ডিলিট হয়েছে");
  loadAdmin();
}

function txSheet(c,sign){
  openSheet(`${c.name} — ${sign>0?"বাকি লিখুন":"জমা নিন"}`,`<label>কত টাকা<input id="tAmt" type="number" inputmode="decimal" min="1"></label>
    <label>নোট (ঐচ্ছিক)<input id="tNote" placeholder="যেমন: চাল, ডাল"></label>
    <button class="primary" id="tSave">${sign>0?"বাকি সেভ করুন":"জমা সেভ করুন"}</button>`);
  setTimeout(()=>$("tAmt").focus(),50);
  $("tSave").onclick = async()=>{
    const v = Number($("tAmt").value); if(!v||v<=0) return toast("সঠিক টাকার অঙ্ক লিখুন");
    $("tSave").disabled = true;
    const {error} = await db.from("ledger").insert({customer_id:c.id,amount:sign*v,note:$("tNote").value.trim()||null});
    if(error){ $("tSave").disabled=false; return toast("সেভ হয়নি, আবার চেষ্টা করুন"); }
    closeSheet(); toast(sign>0?"বাকি সেভ হয়েছে":"জমা সেভ হয়েছে"); sendEmail(c.id); loadAdmin();
  };
}

async function histSheet(c){
  openSheet(c.name+" — ইতিহাস","<p class='muted'>লোড হচ্ছে…</p>");
  const {data} = await db.from("ledger").select("amount,note,created_at").eq("customer_id",c.id).order("created_at",{ascending:false}).limit(50);
  $("sheetBody").innerHTML = (data&&data.length) ? data.map(x=>{
    const p = x.amount>0;
    return `<div class="hist"><div>${p?"বাকি":"জমা"}${x.note?" · "+esc(x.note):""}<small>${new Date(x.created_at).toLocaleDateString("bn-BD",{day:"numeric",month:"short",year:"numeric"})}</small></div><div class="${p?"plus":"minus"}">${p?"+":"−"} ${bn(Math.abs(x.amount))}</div></div>`}).join("")
    : "<p class='empty'>এখনো কোনো লেনদেন নেই।</p>";
}

/* WhatsApp, ডাইরেক্ট মেসেজ (SMS), ইমেইল ও লিংক */
const linkFor = c => location.origin+location.pathname+"?c="+c.token;
const dueMsg = c => `আসসালামু আলাইকুম ${c.name}, আপনার নিকট আমার পাওনা ${Number(DUE[c.id]||0)} টাকা। বিস্তারিত দেখুন: ${linkFor(c)}`;

function sendWA(c){
  let p = (c.phone||"").replace(/\D/g,""); if(p.startsWith("0")) p = "88"+p;
  if(!p) return toast("এই কাস্টমারের ফোন নম্বর নেই");
  window.open("https://wa.me/"+p+"?text="+encodeURIComponent(dueMsg(c)),"_blank");
}

function sendDirectMsg(c){
  const p = (c.phone||"").replace(/\D/g,"");
  const text = dueMsg(c);
  if(navigator.share){
    navigator.share({title:"বাকির হিসাব",text,url:linkFor(c)}).catch(()=>{});
    return;
  }
  if(!p) return toast("এই কাস্টমারের ফোন নম্বর নেই");
  window.location.href = "sms:"+p+"?body="+encodeURIComponent(text);
}

function sendDirectEmail(c){
  if(!c.email) return toast("এই কাস্টমারের ইমেইল নেই");
  const sub = encodeURIComponent("আপনার বাকির হিসাব");
  const body = encodeURIComponent(dueMsg(c));
  window.location.href = `mailto:${encodeURIComponent(c.email)}?subject=${sub}&body=${body}`;
}

function copyLink(c){
  const url = linkFor(c);
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast("লিংক কপি হয়েছে")).catch(()=>prompt("লিংকটি কপি করুন:",url));
}
async function sendEmail(id){
  if(!EMAIL_SCRIPT_URL) return;
  try{
    const {data:{session}} = await db.auth.getSession();
    await fetch(EMAIL_SCRIPT_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain"},
      body:JSON.stringify({jwt:session.access_token,customer_id:id,site:location.origin+location.pathname})});
  }catch(e){}
}

$("saveDaily").onclick = async()=>{
  const {error} = await db.from("daily").upsert({day:today,sales:+$("dSales").value||0,profit:+$("dProfit").value||0,purchase:+$("dBuy").value||0});
  if(error) return toast("সেভ হয়নি, আবার চেষ্টা করুন");
  toast("আজকের হিসাব সেভ হয়েছে"); document.querySelector(".panel").open=false; loadAdmin();
};

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

init();
