// checkWarnings.js — shared scheduling-constraint logic for QHN Block 11.
//
// Loaded as a plain classic <script> before the Babel-transpiled app script in
// app/index.html (browser), and required directly by the WhatsApp bot's Cloud
// Function (Node, see bot/). Kept dependency-free and framework-free so both
// sides enforce the exact same rules with zero risk of drifting out of sync.
//
// checkWarnings takes the resident-derived maps (rotationMap, vacationWeeks,
// unwantedDays) as an explicit `meta` parameter rather than closing over
// mutable module-level state — the browser app reassigns these from a live
// Firestore listener, while the bot reads them fresh per-request via the
// Admin SDK. Passing them in keeps this a pure function of its inputs in
// both environments.

const slotMax     = {SO:2,NICU:2,PICU:2,PMW:3};
const slots       = ["SO","NICU","PICU","PMW"];
const slotLabel   = {SO:"Senior Overall",NICU:"NICU",PICU:"PICU",PMW:"PMW"};
const dcSlots     = ["DC_PMW","DC_NICU"];
const dcSlotLabel = {DC_PMW:"Ward (Day)",DC_NICU:"NICU (Day)"};
const dcSlotMax   = {DC_PMW:2,DC_NICU:1}; // DC_PMW holds 1 senior + 1 junior

const noSaturdayRes = new Set(["H.Amrad","Z.Sairafi","Sajad","Yasir","Sajidah","A.Basarah","M.Hajji","F.Saffar","Shahad","A.Darora","A.Dayin","H.Saif"]);
const noMondayRes   = new Set(["Dina","Mustafa","H.Saif"]);
const noSundayRes   = new Set(["Reem"]);
const r1Res         = new Set(["Sajidah","A.Dayin","A.Basarah","M.Hajji","Z.Alwan","Z.Abdulmohsen","Z.Aman","Z.Madeh","Z.Madan","Anwar","F.Ghanim","S.Zaidani"]);
const nicuUnit      = new Set(["H.Amrad","Z.Sairafi","Sajad","Yasir","Sajidah","A.Basarah","M.Hajji"]);
const picuUnit      = new Set(["F.Saffar","Shahad","A.Darora","A.Dayin"]);

function getWeek(d){
  if(["Jul 5","Jul 6","Jul 7","Jul 8","Jul 9","Jul 10","Jul 11"].includes(d))return"W1";
  if(["Jul 12","Jul 13","Jul 14","Jul 15","Jul 16","Jul 17","Jul 18"].includes(d))return"W2";
  if(["Jul 19","Jul 20","Jul 21","Jul 22","Jul 23","Jul 24","Jul 25"].includes(d))return"W3";
  return"W4";
}

// meta: { rotationMap, vacationWeeks, unwantedDays } — the live resident-derived
// maps, supplied by the caller (browser: module-level `let` bindings kept in
// sync with Firestore; bot: a fresh read of the `residents` collection).
function checkWarnings(newSched,name,toDate,toSlot,meta){
  const {rotationMap,vacationWeeks,unwantedDays}=meta||{};
  const warns=[];const idx={};newSched.forEach((r,i)=>{idx[r.date]=i;});
  const toRow=newSched.find(r=>r.date===toDate);
  // Day-call slots: only check max capacity and vacation
  if(dcSlots.includes(toSlot)){
    const max=dcSlotMax[toSlot]||1;
    if((toRow[toSlot]||[]).length>max)warns.push(`Day call capacity: ${dcSlotLabel[toSlot]} on ${toDate} already has ${toRow[toSlot].length} resident(s) (max ${max}).`);
    const week=getWeek(toDate);if((vacationWeeks[name]||[]).includes(week))warns.push(`Vacation: ${name} is on vacation during ${week} (${toDate}).`);
    return warns;
  }
  const max=slotMax[toSlot]||2;
  if(toRow[toSlot].length>max)warns.push(`Slot capacity: ${slotLabel[toSlot]} on ${toDate} has ${toRow[toSlot].length} residents (max ${max}).`);
  if((unwantedDays[name]||[]).includes(toDate))warns.push(`Unwanted day: ${name} marked ${toDate} as unwanted.`);
  if(r1Res.has(name)&&["Jul 5","Jul 6","Jul 7"].includes(toDate))warns.push(`R1 rule: ${name} should not cover the first 3 days.`);
  if(noSaturdayRes.has(name)&&toRow?.day==="Sat")warns.push(`No Saturday: ${name} (${rotationMap[name]}) should not cover Saturday.`);
  if(noMondayRes.has(name)&&toRow?.day==="Mon")warns.push(`No Monday: ${name} (${rotationMap[name]}) should not cover Monday.`);
  if(noSundayRes.has(name)&&toRow?.day==="Sun")warns.push(`No Sunday: ${name} (${rotationMap[name]}) should not cover Sunday.`);
  const week=getWeek(toDate);if((vacationWeeks[name]||[]).includes(week))warns.push(`Vacation: ${name} is on vacation during ${week} (${toDate}).`);
  if(toSlot==="NICU"&&nicuUnit.has(name)){const o=(toRow.NICU||[]).filter(n=>n!==name&&nicuUnit.has(n));if(o.length)warns.push(`Same NICU unit: ${name} and ${o.join(", ")} are both NICU daytime in NICU slot on ${toDate}.`);}
  if(toSlot==="PICU"&&picuUnit.has(name)){const o=(toRow.PICU||[]).filter(n=>n!==name&&picuUnit.has(n));if(o.length&&toRow.day!=="Thu"&&toRow.day!=="Fri")warns.push(`Same PICU unit: ${name} and ${o.join(", ")} are both PICU daytime in PICU slot on ${toDate} (weekday).`);}
  const allCalls=newSched.flatMap(r=>{const f=slots.find(s=>r[s].includes(name));return f?[idx[r.date]]:[];}).sort((a,b)=>a-b);
  for(let i=1;i<allCalls.length;i++){const gap=allCalls[i]-allCalls[i-1];if(gap<4){warns.push(`Gap: ${name} only ${gap} day(s) between ${newSched[allCalls[i-1]].date} and ${newSched[allCalls[i]].date} (min 4).`);}}
  return warns;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    checkWarnings, getWeek,
    slotMax, slots, slotLabel, dcSlots, dcSlotLabel, dcSlotMax,
    noSaturdayRes, noMondayRes, noSundayRes, r1Res, nicuUnit, picuUnit,
  };
} else {
  window.checkWarnings = checkWarnings;
  window.getWeek = getWeek;
  window.slotMax = slotMax; window.slots = slots; window.slotLabel = slotLabel;
  window.dcSlots = dcSlots; window.dcSlotLabel = dcSlotLabel; window.dcSlotMax = dcSlotMax;
  window.noSaturdayRes = noSaturdayRes; window.noMondayRes = noMondayRes; window.noSundayRes = noSundayRes;
  window.r1Res = r1Res; window.nicuUnit = nicuUnit; window.picuUnit = picuUnit;
}
