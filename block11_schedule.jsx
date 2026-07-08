import { useState, useEffect } from "react";

// Backend base URL for the resident database API (see backend/app.py). If it's
// unreachable (e.g. this build published standalone to Netlify, where the
// backend isn't deployed), the app falls back to the DEFAULT_* snapshots below
// so it always renders -- see the bootstrap fetch in App().
const API_BASE = "http://localhost:5000";

// "Jul 7" style label matching sched's date strings, computed from the real
// clock so this never goes stale (not hardcoded to Block 11's specific dates).
function todayDateLabel(){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const d=new Date();
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const DEFAULT_initialSchedule = [
  { date:"Jul 5",  greg:"05/07", hijri:"20 Muh", day:"Sun", type:"WD", SO:["H.Saif"],              NICU:["Dina"],                   PICU:["Z.Sairafi"],              PMW:["A.Darora"] },
  { date:"Jul 6",  greg:"06/07", hijri:"21 Muh", day:"Mon", type:"WD", SO:["A.Ibrahim"],           NICU:["A.Qassab"],               PICU:["F.Saffar"],               PMW:["Sajad"] },
  { date:"Jul 7",  greg:"07/07", hijri:"22 Muh", day:"Tue", type:"WD", SO:["H.Jalood"],            NICU:["Mustafa"],                PICU:["Yasir"],                  PMW:["Wasayif"] },
  { date:"Jul 8",  greg:"08/07", hijri:"23 Muh", day:"Wed", type:"WD", SO:["Reem"],                NICU:["Abdulla","A.Basarah"],    PICU:["A.Dayin","S.Zaidani"],    PMW:["Z.Aman","Z.Madeh","F.Ghanim"] },
  { date:"Jul 9",  greg:"09/07", hijri:"24 Muh", day:"Thu", type:"WE", SO:["H.Amrad"],             NICU:["Maab"],                   PICU:["A.Darora"],               PMW:["Sajidah"] },
  { date:"Jul 10", greg:"10/07", hijri:"25 Muh", day:"Fri", type:"WE", SO:["A.Ibrahim"],           NICU:["Z.Sairafi"],              PICU:["Qasim"],                  PMW:["M.Hajji"] },
  { date:"Jul 11", greg:"11/07", hijri:"26 Muh", day:"Sat", type:"WE", SO:["Sara"],                NICU:["A.Qassab"],               PICU:["A.Rashid"],               PMW:["F.Ghanim"] },
  { date:"Jul 12", greg:"12/07", hijri:"27 Muh", day:"Sun", type:"WD", SO:["H.Saif","H.Jalood"],   NICU:["M.Khadhrawi","Yasir"],    PICU:["Wasayif","A.Dayin"],      PMW:["Sajidah","Z.Madeh","Anwar"] },
  { date:"Jul 13", greg:"13/07", hijri:"28 Muh", day:"Mon", type:"WD", SO:["F.Saffar","Reem"],     NICU:["A.Musalllam","Sajad"],    PICU:["S.Zaidani"],              PMW:["A.Basarah"] },
  { date:"Jul 14", greg:"14/07", hijri:"29 Muh", day:"Tue", type:"WD", SO:["H.Amrad","A.Ibrahim"], NICU:["Qasim","Maab"],           PICU:["A.Darora"],               PMW:["M.Hajji"] },
  { date:"Jul 15", greg:"15/07", hijri:"30 Muh", day:"Wed", type:"WD", SO:["Sara"],                NICU:["Dina","Sajidah"],         PICU:["A.Rashid"],               PMW:["Anwar","F.Ghanim"] },
  { date:"Jul 16", greg:"16/07", hijri:"01 Saf", day:"Thu", type:"WE", SO:["H.Saif"],              NICU:["Yasir"],                  PICU:["A.Dayin"],                PMW:["Z.Alwan","Z.Madeh","S.Zaidani"] },
  { date:"Jul 17", greg:"17/07", hijri:"02 Saf", day:"Fri", type:"WE", SO:["F.Saffar"],            NICU:["M.Khadhrawi","Sajad"],    PICU:["Wasayif"],                PMW:["A.Basarah"] },
  { date:"Jul 18", greg:"18/07", hijri:"03 Saf", day:"Sat", type:"WE", SO:["H.Jalood"],            NICU:["Mustafa"],                PICU:["Qasim"],                  PMW:["Anwar"] },
  { date:"Jul 19", greg:"19/07", hijri:"04 Saf", day:"Sun", type:"WD", SO:["H.Amrad"],             NICU:["Maab"],                   PICU:["A.Darora","F.Ghanim"],    PMW:["M.Hajji","Z.Madan"] },
  { date:"Jul 20", greg:"20/07", hijri:"05 Saf", day:"Mon", type:"WD", SO:["Sara"],                NICU:["Z.Sairafi"],              PICU:["A.Rashid","A.Basarah"],   PMW:["S.Zaidani","A.Dayin"] },
  { date:"Jul 21", greg:"21/07", hijri:"06 Saf", day:"Tue", type:"WD", SO:["H.Saif","Safia"],      NICU:["M.Khadhrawi","Yasir"],    PICU:["Shahad"],                 PMW:["Sajidah"] },
  { date:"Jul 22", greg:"22/07", hijri:"07 Saf", day:"Wed", type:"WD", SO:["F.Saffar","Arwa"],     NICU:["Mustafa"],                PICU:["Anwar","M.Hajji"],        PMW:["Z.Abdulmohsen"] },
  { date:"Jul 23", greg:"23/07", hijri:"08 Saf", day:"Thu", type:"WE", SO:["Reem"],                NICU:["Sajad"],                  PICU:["Z.Madan"],                PMW:["A.Basarah"] },
  { date:"Jul 24", greg:"24/07", hijri:"09 Saf", day:"Fri", type:"WE", SO:["H.Amrad"],             NICU:["Maab","Sajidah"],         PICU:["A.Darora"],               PMW:["S.Zaidani"] },
  { date:"Jul 25", greg:"25/07", hijri:"10 Saf", day:"Sat", type:"WE", SO:["H.Jalood","Safia"],    NICU:["A.Musalllam"],            PICU:["A.Rashid"],               PMW:["F.Ghanim"] },
  { date:"Jul 26", greg:"26/07", hijri:"11 Saf", day:"Sun", type:"WD", SO:["Sara","Arwa"],         NICU:["Z.Sairafi"],              PICU:["Shahad","A.Basarah"],     PMW:["Z.Abdulmohsen","Z.Aman","Anwar"] },
  { date:"Jul 27", greg:"27/07", hijri:"12 Saf", day:"Mon", type:"WD", SO:["Reem"],                NICU:["Sajad","Qasim"],          PICU:["A.Dayin"],                PMW:["M.Hajji","Z.Madan"] },
  { date:"Jul 28", greg:"28/07", hijri:"13 Saf", day:"Tue", type:"WD", SO:["H.Amrad"],             NICU:["Maab"],                   PICU:["S.Zaidani"],              PMW:["Sajidah"] },
  { date:"Jul 29", greg:"29/07", hijri:"14 Saf", day:"Wed", type:"WD", SO:["H.Jalood","Safia"],    NICU:["A.Musalllam"],            PICU:["A.Rashid"],               PMW:["Z.Aman","F.Ghanim"] },
  { date:"Jul 30", greg:"30/07", hijri:"15 Saf", day:"Thu", type:"WE", SO:["F.Saffar"],            NICU:["Dina","Z.Sairafi"],       PICU:["M.Hajji"],                PMW:["Z.Abdulmohsen"] },
  { date:"Jul 31", greg:"31/07", hijri:"16 Saf", day:"Fri", type:"WE", SO:["H.Saif","Arwa"],       NICU:["Yasir"],                  PICU:["Shahad"],                 PMW:["A.Dayin"] },
  { date:"Aug 1",  greg:"01/08", hijri:"17 Saf", day:"Sat", type:"WE", SO:["Reem"],                NICU:["Sara"],                   PICU:["Anwar"],                  PMW:["Z.Aman"] },
];
// Mutable binding: reassigned in place if the backend bootstrap fetch succeeds
// (see App()), otherwise stays equal to the DEFAULT_* snapshot above.
let initialSchedule = DEFAULT_initialSchedule;

// ── Resident metadata ─────────────────────────────────────────────────────────
const DEFAULT_rotationMap = {
  "H.Amrad":"NICU","Z.Sairafi":"NICU","Sajad":"NICU","Yasir":"NICU","Sajidah":"NICU","A.Basarah":"NICU","M.Hajji":"NICU",
  "F.Saffar":"PICU","Shahad":"PICU","A.Darora":"PICU","A.Dayin":"PICU",
  "A.Qassab":"GP","Qasim":"GP","Abdulla":"GP","Sara":"GP","Z.Aman":"GP","Z.Madeh":"GP","Z.Madan":"GP","Anwar":"GP","F.Ghanim":"GP","S.Zaidani":"GP",
  "M.Khadhrawi":"OPD","A.Musalllam":"OPD","Wasayif":"OPD",
  "Dina":"ALL/IMM","Mustafa":"ALL/IMM","H.Saif":"CARDIO","Maab":"CARDIO",
  "H.Jalood":"ENDO","Arwa":"ENDO","Reem":"PULMO","Safia":"ID","A.Rashid":"HEMATO",
  "Z.Alwan":"ANEST","Z.Abdulmohsen":"ANEST","A.Ibrahim":"RESEARCH",
};
let rotationMap = DEFAULT_rotationMap;
const DEFAULT_levelMap = {
  "Dina":"R4","M.Khadhrawi":"R4","Mustafa":"R4","A.Musalllam":"R4","A.Qassab":"R4",
  "H.Saif":"R3","H.Jalood":"R3","H.Amrad":"R3","Reem":"R3","Safia":"R3","Z.Sairafi":"R3","F.Saffar":"R3","Sara":"R3","Arwa":"R3","A.Ibrahim":"R3",
  "Sajad":"R2","Yasir":"R2","Shahad":"R2","A.Darora":"R2","Wasayif":"R2","A.Rashid":"R2","Qasim":"R2","Maab":"R2","Abdulla":"R2",
  "Sajidah":"R1","A.Dayin":"R1","A.Basarah":"R1","M.Hajji":"R1","Z.Alwan":"R1","Z.Abdulmohsen":"R1","Z.Aman":"R1","Z.Madeh":"R1","Z.Madan":"R1","Anwar":"R1","F.Ghanim":"R1","S.Zaidani":"R1",
};
let levelMap = DEFAULT_levelMap;

// Filter groups (the R4/R3/R2/R1 subsets are derived from levelMap, so this is
// rebuilt via buildFilterGroups() after a successful bootstrap fetch too)
function buildFilterGroups(){
  return {
    "NICU Team": new Set(["H.Amrad","Z.Sairafi","Sajad","Yasir","Sajidah","A.Basarah","M.Hajji"]),
    "PICU Team": new Set(["F.Saffar","Shahad","A.Darora","A.Dayin"]),
    "R4": new Set(Object.keys(levelMap).filter(k=>levelMap[k]==="R4")),
    "R3": new Set(Object.keys(levelMap).filter(k=>levelMap[k]==="R3")),
    "R2": new Set(Object.keys(levelMap).filter(k=>levelMap[k]==="R2")),
    "R1": new Set(Object.keys(levelMap).filter(k=>levelMap[k]==="R1")),
    "GP Team": new Set(["A.Qassab","Qasim","Abdulla","Sara","Z.Aman","Z.Madeh","Z.Madan","Anwar","F.Ghanim","S.Zaidani"]),
  };
}
let filterGroups = buildFilterGroups();

const filterColors = {
  "NICU Team": { active:"#1d4ed8", light:"#dbeafe", text:"#1e3a8a" },
  "PICU Team": { active:"#9d174d", light:"#fce7f3", text:"#831843" },
  "R4":        { active:"#1e3a8a", light:"#dbeafe", text:"#1e3a8a" },
  "R3":        { active:"#166534", light:"#dcfce7", text:"#14532d" },
  "R2":        { active:"#92400e", light:"#fef3c7", text:"#78350f" },
  "R1":        { active:"#6b21a8", light:"#f3e8ff", text:"#581c87" },
  "GP Team":   { active:"#065f46", light:"#d1fae5", text:"#064e3b" },
};

// Constraint data
const noSaturdayRes  = new Set(["H.Amrad","Z.Sairafi","Sajad","Yasir","Sajidah","A.Basarah","M.Hajji","F.Saffar","Shahad","A.Darora","A.Dayin","H.Saif","Maab"]);
const noMondayRes    = new Set(["Dina","Mustafa","H.Saif","Maab"]);
const noSundayRes    = new Set(["Reem"]);
const r1Res          = new Set(["Sajidah","A.Dayin","A.Basarah","M.Hajji","Z.Alwan","Z.Abdulmohsen","Z.Aman","Z.Madeh","Z.Madan","Anwar","F.Ghanim","S.Zaidani"]);
const nicuUnit       = new Set(["H.Amrad","Z.Sairafi","Sajad","Yasir","Sajidah","A.Basarah","M.Hajji"]);
const picuUnit       = new Set(["F.Saffar","Shahad","A.Darora","A.Dayin"]);
const DEFAULT_unwantedDays = {"Dina":["Jul 31","Aug 1"],"Mustafa":["Jul 26","Aug 1"],"Yasir":["Jul 10","Jul 11"],"Shahad":["Jul 16","Jul 17","Jul 18","Jul 19","Jul 27","Jul 28","Jul 29"],"A.Rashid":["Jul 31","Aug 1"],"Z.Alwan":["Jul 12","Jul 13"],"Z.Madeh":["Jul 17","Jul 18"],"Z.Madan":["Jul 31","Aug 1"],"Anwar":["Jul 8","Jul 9"],"F.Ghanim":["Jul 7","Jul 30","Jul 31","Aug 1"],"S.Zaidani":["Jul 5","Jul 6"]};
let unwantedDays = DEFAULT_unwantedDays;
const DEFAULT_vacationWeeks = {"A.Qassab":["W2","W3","W4"],"Safia":["W1","W2"],"Arwa":["W1","W2"],"A.Ibrahim":["W3","W4"],"Shahad":["W1","W2"],"Wasayif":["W3","W4"],"Abdulla":["W2","W3","W4"],"Z.Alwan":["W1","W3","W4"],"Z.Abdulmohsen":["W1","W2"],"Z.Aman":["W2","W3"],"Z.Madeh":["W3","W4"],"Z.Madan":["W1","W2"]};
let vacationWeeks = DEFAULT_vacationWeeks;

function getWeek(d){if(["Jul 5","Jul 6","Jul 7","Jul 8","Jul 9","Jul 10","Jul 11"].includes(d))return"W1";if(["Jul 12","Jul 13","Jul 14","Jul 15","Jul 16","Jul 17","Jul 18"].includes(d))return"W2";if(["Jul 19","Jul 20","Jul 21","Jul 22","Jul 23","Jul 24","Jul 25"].includes(d))return"W3";return"W4";}

const slotMax   = {SO:2,NICU:2,PICU:2,PMW:3};
const slots     = ["SO","NICU","PICU","PMW"];
const slotLabel = {SO:"Senior Overall",NICU:"NICU",PICU:"PICU",PMW:"PMW"};
const slotHdrBg = {SO:"#1e3a5f",NICU:"#1d4ed8",PICU:"#9d174d",PMW:"#065f46"};

const rotColors = {
  NICU:{bg:"#dbeafe",bd:"#3b82f6",tx:"#1e3a8a"},PICU:{bg:"#fce7f3",bd:"#db2777",tx:"#831843"},
  GP:{bg:"#d1fae5",bd:"#10b981",tx:"#064e3b"},OPD:{bg:"#fff7ed",bd:"#f97316",tx:"#7c2d12"},
  "ALL/IMM":{bg:"#ede9fe",bd:"#7c3aed",tx:"#3b0764"},CARDIO:{bg:"#fef9c3",bd:"#ca8a04",tx:"#713f12"},
  ENDO:{bg:"#f0fdf4",bd:"#16a34a",tx:"#14532d"},PULMO:{bg:"#ecfeff",bd:"#0891b2",tx:"#164e63"},
  ID:{bg:"#fef2f2",bd:"#dc2626",tx:"#7f1d1d"},HEMATO:{bg:"#fdf4ff",bd:"#a21caf",tx:"#4a044e"},
  ANEST:{bg:"#f1f5f9",bd:"#64748b",tx:"#1e293b"},RESEARCH:{bg:"#f0fdfa",bd:"#0d9488",tx:"#134e4a"},
};

function deepClone(s){return s.map(r=>({...r,SO:[...r.SO],NICU:[...r.NICU],PICU:[...r.PICU],PMW:[...r.PMW]}));}

// Compute daytime availability for NICU / PICU / GP teams on a given day.
// Unavailable = on call yesterday (post-call) OR on vacation this week.
// Returns per-unit level breakdown for next-day availability.
// For each unit, groups members by R-level and computes avail/total (post-call or vacation = unavailable).
function getAvailability(sched,dayIdx){
  if(dayIdx===0)return null;
  const prev=sched[dayIdx-1];
  const postCall=new Set([...prev.SO,...prev.NICU,...prev.PICU,...prev.PMW]);
  const week=getWeek(sched[dayIdx].date);
  function unitBreakdown(team){
    const groups={};
    [...team].forEach(n=>{
      const lv=levelMap[n]||"?";
      if(!groups[lv])groups[lv]={avail:0,total:0,postCall:[],vacation:[]};
      groups[lv].total++;
      if(postCall.has(n))groups[lv].postCall.push(n);
      else if((vacationWeeks[n]||[]).includes(week))groups[lv].vacation.push(n);
      else groups[lv].avail++;
    });
    return groups;
  }
  function unitTotal(groups){
    let a=0,t=0;Object.values(groups).forEach(g=>{a+=g.avail;t+=g.total;});return{avail:a,total:t};
  }
  const nicu=unitBreakdown(nicuUnit),picu=unitBreakdown(picuUnit),gp=unitBreakdown(filterGroups["GP Team"]);
  return{nicu,picu,gp,nicuTot:unitTotal(nicu),picuTot:unitTotal(picu),gpTot:unitTotal(gp)};
}

function checkWarnings(newSched,name,toDate,toSlot){
  const warns=[];const idx={};newSched.forEach((r,i)=>{idx[r.date]=i;});
  const toRow=newSched.find(r=>r.date===toDate);const max=slotMax[toSlot]||2;
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

async function exportDocx(sched){
  // JSZip loaded as global via <script> tag in index.html
  const resp=await fetch("/block11_template.docx");
  if(!resp.ok){alert("Template not found. Make sure block11_template.docx is in the app folder.");return;}
  const buf=await resp.arrayBuffer();
  const zip=await JSZip.loadAsync(buf);
  let xml=await zip.file("word/document.xml").async("string");

  // Color per resident based on their DAYTIME rotation unit
  function resColor(name){
    const rot=rotationMap[name]||"";
    if(rot==="NICU")return"C2185B";   // pink
    if(rot==="PICU")return"1565C0";   // blue
    if(rot==="GP")  return"2E7D32";   // green
    return null; // black
  }
  // Build cell XML with one colored <w:r> run per resident name
  function fillCellNames(cellXml,names){
    if(!names||names.length===0)return cellXml;
    const runs=names.map((name,idx)=>{
      const color=resColor(name);
      const colorTag=color?`<w:color w:val="${color}"/>`:"";
      const text=name+(idx<names.length-1?", ":"");
      const escaped=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return`<w:r><w:rPr>${colorTag}<w:b/><w:bCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
    }).join("");
    return cellXml.replace("</w:pPr></w:p>",`</w:pPr>${runs}</w:p>`);
  }
  // Plain fill for non-resident cells (dates)
  function fillCell(cellXml,text){
    if(!text)return cellXml;
    const escaped=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return cellXml.replace("</w:pPr></w:p>",`</w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`);
  }

  const parts=xml.split("<w:tr ");
  for(let i=0;i<sched.length;i++){
    const row=sched[i];
    const pi=i+3;
    const cells=parts[pi].split("<w:tc>");
    cells[2]=fillCell(cells[2],row.greg);
    cells[3]=fillCell(cells[3],row.hijri);
    const isWE=row.type==="WE";
    if(!isWE){
      cells[6]=fillCellNames(cells[6],row.SO);
      cells[7]=fillCellNames(cells[7],row.NICU);
      cells[8]=fillCellNames(cells[8],row.PICU);
      cells[9]=fillCellNames(cells[9],row.PMW);
    }else{
      cells[5]=fillCellNames(cells[5],row.SO);
      cells[6]=fillCellNames(cells[6],row.NICU);
      cells[7]=fillCellNames(cells[7],row.PICU);
      if(i<sched.length-1)cells[8]=fillCellNames(cells[8],row.PMW);
    }
    parts[pi]=cells.join("<w:tc>");
  }

  zip.file("word/document.xml",parts.join("<w:tr "));
  const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="Block11_Schedule_Filled.docx";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}

// ── Resident Panel (shown on schedule page when a name badge is clicked) ──────
function ResidentPanel({ name, sched, selected, setSelected, onClose, onDelete }) {
  const profile = residentProfiles.find(r => r.name === name);
  const level   = levelMap[name] || "";
  const lc      = levelColors[level] || { hdr:"#1e293b", light:"#f8fafc", tx:"#334155" };

  const dateIdx = {};
  sched.forEach((r, i) => { dateIdx[r.date] = i; });

  const calls = sched.flatMap(row => {
    let slot = null;
    if (row.SO.includes(name))   slot = "SO";
    if (row.NICU.includes(name)) slot = "NICU";
    if (row.PICU.includes(name)) slot = "PICU";
    if (row.PMW.includes(name))  slot = "PMW";
    return slot ? [{ date: row.date, day: row.day, type: row.type, slot }] : [];
  });

  const wdCount = calls.filter(c => c.type === "WD").length;
  const weCount = calls.filter(c => c.type === "WE").length;

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ width:255, flexShrink:0, background:"#fff", borderRadius:8,
        border:`2px solid ${lc.hdr}`, boxShadow:"0 4px 16px rgba(0,0,0,0.14)",
        overflow:"hidden", position:"sticky", top:8, alignSelf:"flex-start" }}>

      {/* Header */}
      <div style={{ background:lc.hdr, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <span style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{name}</span>
          <span style={{ fontSize:10, color:"#94a3b8", marginLeft:6 }}>{level} · {rotationMap[name] || "—"}</span>
        </div>
        <button onClick={onClose}
          style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 2px" }}>×</button>
      </div>

      {/* Call count */}
      <div style={{ background:lc.light, padding:"4px 12px", fontSize:11, color:lc.tx, fontWeight:700,
        borderBottom:`1px solid ${lc.hdr}33` }}>
        {calls.length} call{calls.length !== 1 ? "s" : ""} · {wdCount} WD + {weCount} WE
      </div>

      {/* Profile tags */}
      {profile && (
        <div style={{ padding:"6px 10px", borderBottom:"1px solid #f1f5f9", display:"flex", flexWrap:"wrap", gap:4 }}>
          {profile.vacation !== "None" && (
            <span style={{ fontSize:10, background:"#fffbeb", border:"1px solid #fcd34d", color:"#92400e", borderRadius:3, padding:"1px 6px" }}>
              📅 {profile.vacation}
            </span>
          )}
          {profile.unwanted !== "None" && (
            <span style={{ fontSize:10, background:"#fef2f2", border:"1px solid #fca5a5", color:"#dc2626", borderRadius:3, padding:"1px 6px" }}>
              ⛔ {profile.unwanted}
            </span>
          )}
          {profile.constraints.map((c, i) => (
            <span key={i} style={{ fontSize:10, background:"#f0f9ff", border:"1px solid #bae6fd", color:"#0369a1", borderRadius:3, padding:"1px 6px" }}>
              ⚠ {c}
            </span>
          ))}
          {profile.notes && (
            <span style={{ fontSize:10, background:"#f8fafc", border:"1px solid #e2e8f0", color:"#475569", borderRadius:3, padding:"1px 6px" }}>
              📝 {profile.notes}
            </span>
          )}
        </div>
      )}

      {/* Call rows */}
      <div style={{ maxHeight:360, overflowY:"auto" }}>
        {calls.length === 0 ? (
          <div style={{ padding:"10px 12px", fontSize:11, color:"#9ca3af", fontStyle:"italic" }}>No calls assigned.</div>
        ) : calls.map((c, i) => {
          const isActive = selected?.name === name && selected?.fromDate === c.date && selected?.fromSlot === c.slot;
          const gapNum   = i === 0 ? null : (dateIdx[c.date] - dateIdx[calls[i-1].date]);
          const gapOk    = gapNum === null || gapNum >= 4;
          const gapWarn  = gapNum === 3;
          const stc      = slotTagColors[slotLabel[c.slot]] || { bg:"#f1f5f9", tx:"#374151" };

          return (
            <div key={i}
              onClick={() => setSelected({ name, fromDate:c.date, fromSlot:c.slot })}
              title="Click to select this call for moving"
              style={{
                padding:"5px 10px", cursor:"pointer",
                background: isActive ? "#fef9c3" : i % 2 === 0 ? "#fff" : "#f9fafb",
                borderLeft: isActive ? "3px solid #ca8a04" : "3px solid transparent",
                borderBottom:"1px solid #f1f5f9",
                display:"flex", alignItems:"center", gap:5,
                transition:"background 0.1s",
              }}>
              <span style={{ fontSize:9.5, color:"#9ca3af", width:14, textAlign:"center", fontWeight:700 }}>{i+1}</span>
              <span style={{ fontSize:11, fontWeight:700, color:"#1e293b", minWidth:38 }}>{c.date}</span>
              <span style={{ fontSize:10, color: c.type === "WE" ? "#0369a1" : "#6b7280",
                fontWeight: c.type === "WE" ? 700 : 400, minWidth:26 }}>{c.day}</span>
              <span style={{ fontSize:10, background:stc.bg, color:stc.tx, borderRadius:3,
                padding:"1px 5px", fontWeight:600, flex:1, textAlign:"center" }}>{slotLabel[c.slot]}</span>
              {gapNum !== null && (
                <span style={{ fontSize:9.5, fontWeight:700, minWidth:22, textAlign:"right",
                  color: gapOk ? "#166534" : gapWarn ? "#d97706" : "#dc2626" }}>
                  {gapNum}d {gapOk ? "" : gapWarn ? "⚠️" : "❌"}
                </span>
              )}
              {isActive && (
                <span style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0 }}>
                  <span style={{ fontSize:9, color:"#ca8a04", fontWeight:800 }}>✦</span>
                  <button
                    onClick={e=>{e.stopPropagation();onDelete(c.date,c.slot);}}
                    title="Remove this call"
                    style={{ fontSize:9, fontWeight:700, color:"#dc2626", background:"#fef2f2",
                      border:"1px solid #fca5a5", borderRadius:3, padding:"1px 5px",
                      cursor:"pointer", lineHeight:1.4 }}>
                    ✕ del
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{ padding:"4px 10px", background:"#f8fafc", borderTop:"1px solid #e2e8f0",
        fontSize:9.5, color:"#9ca3af", textAlign:"center" }}>
        Click a row to select it · then click a cell in the table to move
      </div>
    </div>
  );
}

// ── Resident profiles ─────────────────────────────────────────────────────────
const DEFAULT_residentProfiles = [
  {name:"Dina",        level:"R4",rotation:"ALL/IMM", vacation:"None",        unwanted:"Jul 31, Aug 1",          leaveBlock11:"None",constraints:["No Saturday","No Monday"],                                                       notes:"Reduced calls – leave Block 10"},
  {name:"M.Khadhrawi", level:"R4",rotation:"OPD",     vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Sun/Mon first 2 days of block"],                                             notes:""},
  {name:"Mustafa",     level:"R4",rotation:"ALL/IMM", vacation:"None",        unwanted:"Jul 26, Aug 1",          leaveBlock11:"None",constraints:["No Monday"],                                                                    notes:""},
  {name:"A.Musalllam", level:"R4",rotation:"OPD",     vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Sun/Mon first 2 days of block"],                                             notes:""},
  {name:"A.Qassab",    level:"R4",rotation:"GP",      vacation:"W2–W4",       unwanted:"None",                   leaveBlock11:"None",constraints:[],                                                                               notes:"Reduced to 2 calls (leave W2–W4)"},
  {name:"H.Saif",      level:"R3",rotation:"CARDIO",  vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No Monday","No same day as Maab (CARDIO)"],                       notes:""},
  {name:"H.Jalood",    level:"R3",rotation:"ENDO",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No same day as Arwa (ENDO)"],                                                   notes:""},
  {name:"H.Amrad",     level:"R3",rotation:"NICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No NICU slot same day as Z.Sairafi"],                            notes:"All 5 calls in Senior Overall (Option B)"},
  {name:"Reem",        level:"R3",rotation:"PULMO",   vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Sunday"],                                                                    notes:"Sat+Thu weekends (approved exception)"},
  {name:"Safia",       level:"R3",rotation:"ID",      vacation:"W1+W2",       unwanted:"None",                   leaveBlock11:"None",constraints:[],                                                                               notes:"Reduced to 3 calls – W3+W4 available"},
  {name:"Z.Sairafi",   level:"R3",rotation:"NICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No NICU slot same day as H.Amrad"],                              notes:"1 call PICU (Jul 5), 4 calls NICU"},
  {name:"F.Saffar",    level:"R3",rotation:"PICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No same weekday as PICU colleagues"],                            notes:"1 call PICU, 4 calls Senior Overall"},
  {name:"Sara",        level:"R3",rotation:"GP",      vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:[],                                                                               notes:"Last call Aug 1 in NICU"},
  {name:"Arwa",        level:"R3",rotation:"ENDO/V",  vacation:"W1+W2",       unwanted:"None",                   leaveBlock11:"None",constraints:["No same day as H.Jalood (ENDO)"],                                              notes:"Reduced to 3 calls – W3+W4 available"},
  {name:"A.Ibrahim",   level:"R3",rotation:"RESEARCH",vacation:"W3+W4",       unwanted:"None",                   leaveBlock11:"None",constraints:[],                                                                               notes:"Reduced to 3 calls – W1+W2 available"},
  {name:"Sajad",       level:"R2",rotation:"NICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No same day as H.Amrad or Z.Sairafi"],                           notes:""},
  {name:"Yasir",       level:"R2",rotation:"NICU",    vacation:"None",        unwanted:"Jul 10, Jul 11",         leaveBlock11:"None",constraints:["No Saturday","No same day as Sajad / H.Amrad / Z.Sairafi"],                   notes:"Jul 7 in PICU (avoids NICU conflict)"},
  {name:"Shahad",      level:"R2",rotation:"PICU",    vacation:"W1+W2",       unwanted:"Jul 16–19, Jul 27–29",   leaveBlock11:"None",constraints:["No Saturday","No same weekday as F.Saffar or A.Darora"],                      notes:"Reduced to 3 calls; Thu/Fri sharing allowed"},
  {name:"A.Darora",    level:"R2",rotation:"PICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No same weekday as Shahad or F.Saffar"],                        notes:"Jul 5 PMW (first-day priority); 4 PICU calls"},
  {name:"Wasayif",     level:"R2",rotation:"OPD",     vacation:"W3+W4",       unwanted:"None",                   leaveBlock11:"None",constraints:["No Wednesday (preferred)"],                                                    notes:"Reduced to 3 calls – W1+W2 available"},
  {name:"A.Rashid",    level:"R2",rotation:"HEMATO",  vacation:"None",        unwanted:"Jul 31, Aug 1",          leaveBlock11:"None",constraints:["No Jul 5, 6 (first 2 days)"],                                                 notes:""},
  {name:"Qasim",       level:"R2",rotation:"GP",      vacation:"None",        unwanted:"No last weekend",        leaveBlock11:"None",constraints:["No Jul 30/31/Aug 1","Avoid Sara's call days"],                                 notes:"Covers NICU"},
  {name:"Maab",        level:"R2",rotation:"CARDIO",  vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No Monday","No same day as H.Saif"],                             notes:"Jul 28 shifted to Tue"},
  {name:"Abdulla",     level:"R2",rotation:"GP",      vacation:"W2+W3+W4",    unwanted:"No Sunday, No Monday",   leaveBlock11:"None",constraints:["No Sunday","No Monday"],                                                       notes:"1 call only – W1 available"},
  {name:"Sajidah",     level:"R1",rotation:"NICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No first 3 days","No same weekday as A.Basarah or M.Hajji"],    notes:"6 calls; NICU+PMW mix"},
  {name:"A.Dayin",     level:"R1",rotation:"PICU",    vacation:"None",        unwanted:"Jul 10, Jul 17",         leaveBlock11:"None",constraints:["No Saturday","No first 3 days","PICU colleagues only on Thu/Fri"],             notes:"6 calls"},
  {name:"A.Basarah",   level:"R1",rotation:"NICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No first 3 days","No same weekday as Sajidah or M.Hajji"],      notes:"6 calls; 3-day exception Jul 13→16 approved"},
  {name:"M.Hajji",     level:"R1",rotation:"NICU",    vacation:"None",        unwanted:"None",                   leaveBlock11:"None",constraints:["No Saturday","No first 3 days","No same weekday as Sajidah or A.Basarah"],    notes:"6 calls; all PMW"},
  {name:"Z.Alwan",     level:"R1",rotation:"ANEST",   vacation:"W1+W3+W4",    unwanted:"Jul 12, Jul 13",         leaveBlock11:"None",constraints:["Outside rotation W3+W4"],                                                      notes:"1 call only – W2 available (Jul 16 Thu)"},
  {name:"Z.Abdulmohsen",level:"R1",rotation:"ANEST",  vacation:"W1+W2",       unwanted:"None",                   leaveBlock11:"None",constraints:["Outside rotation W1+W2"],                                                      notes:"3 calls – W3+W4 available"},
  {name:"Z.Aman",      level:"R1",rotation:"GP",      vacation:"W2+W3",       unwanted:"None",                   leaveBlock11:"None",constraints:[],                                                                               notes:"3 calls – W1+W4 available"},
  {name:"Z.Madeh",     level:"R1",rotation:"GP",      vacation:"W3+W4",       unwanted:"Jul 17, Jul 18",         leaveBlock11:"None",constraints:[],                                                                               notes:"3 calls – W1+W2 available"},
  {name:"Z.Madan",     level:"R1",rotation:"GP",      vacation:"W1+W2",       unwanted:"Jul 31, Aug 1",          leaveBlock11:"None",constraints:[],                                                                               notes:"3 calls – W3+W4 available"},
  {name:"Anwar",       level:"R1",rotation:"GP",      vacation:"None",        unwanted:"Jul 8, Jul 9",           leaveBlock11:"None",constraints:["No Jul 8, 9"],                                                                 notes:"6 calls; 1 three-day gap exception"},
  {name:"F.Ghanim",    level:"R1",rotation:"GP",      vacation:"None",        unwanted:"Jul 7, Jul 30/31/Aug 1", leaveBlock11:"None",constraints:["No last weekend"],                                                             notes:"6 calls; 1 three-day gap exception"},
  {name:"S.Zaidani",   level:"R1",rotation:"GP",      vacation:"None",        unwanted:"Jul 5, Jul 6",           leaveBlock11:"None",constraints:["No Jul 5, 6"],                                                                 notes:"6 calls; 1 three-day gap exception"},
];
let residentProfiles = DEFAULT_residentProfiles;

const levelColors={R4:{hdr:"#1e3a8a",light:"#dbeafe",tx:"#1e3a8a"},R3:{hdr:"#166534",light:"#dcfce7",tx:"#14532d"},R2:{hdr:"#92400e",light:"#fef3c7",tx:"#78350f"},R1:{hdr:"#6b21a8",light:"#f3e8ff",tx:"#581c87"}};
const slotTagColors={"Senior Overall":{bg:"#eff6ff",tx:"#1e3a5f"},NICU:{bg:"#dbeafe",tx:"#1d4ed8"},PICU:{bg:"#fce7f3",tx:"#9d174d"},PMW:{bg:"#d1fae5",tx:"#065f46"}};

// ── Target calls per resident (parsed from notes) ─────────────────────────────
function getTarget(name){
  const p=residentProfiles.find(r=>r.name===name);
  if(!p)return null;
  const m=(p.notes||"").match(/(\d+)\s*calls?/i);
  return m?parseInt(m[1]):null;
}

// ── Resident Tracker Sidebar ──────────────────────────────────────────────────
function ResidentTracker({sched,spotlight,setSpotlight,setSelected,setWarnings}){
  // Count current calls per resident across all slots
  const filled={};
  sched.forEach(row=>{
    [...row.SO,...row.NICU,...row.PICU,...row.PMW].forEach(name=>{
      filled[name]=(filled[name]||0)+1;
    });
  });

  return(
    <div onClick={e=>e.stopPropagation()} style={{
      width:186,flexShrink:0,background:"#fff",borderRadius:8,
      border:"1px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
      overflow:"hidden",alignSelf:"flex-start",
      display:"flex",flexDirection:"column",
      maxHeight:"calc(100vh - 150px)",position:"sticky",top:8,
    }}>
      <div style={{background:"#1e293b",color:"#94a3b8",fontSize:9.5,fontWeight:700,
        letterSpacing:"0.08em",textTransform:"uppercase",padding:"6px 10px",flexShrink:0}}>
        👥 Resident Call Tracker
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {["R4","R3","R2","R1"].map(lvl=>{
          const lc=levelColors[lvl];
          const group=residentProfiles.filter(r=>r.level===lvl);
          return(
            <div key={lvl}>
              <div style={{background:lc.light,padding:"3px 9px",fontSize:9,fontWeight:800,
                color:lc.hdr,borderTop:`1px solid ${lc.hdr}33`,borderBottom:`1px solid ${lc.hdr}33`,
                letterSpacing:"0.08em",textTransform:"uppercase",flexShrink:0}}>
                {lvl}
              </div>
              {group.map(res=>{
                const cur=filled[res.name]||0;
                const tgt=getTarget(res.name);
                const isLit=spotlight===res.name;
                const pct=tgt?Math.min(cur/tgt,1.05):null;
                const over=tgt&&cur>tgt;
                const done=tgt&&cur>=tgt;
                const barColor=over?"#ef4444":done?"#22c55e":lc.hdr;
                return(
                  <div key={res.name} onClick={()=>{
                    const next=isLit?null:res.name;
                    setSpotlight(next);setSelected(null);setWarnings([]);
                  }} style={{
                    padding:"5px 9px",cursor:"pointer",
                    borderBottom:"1px solid #f1f5f9",
                    background:isLit?lc.light:"transparent",
                    borderLeft:`3px solid ${isLit?lc.hdr:"transparent"}`,
                    transition:"all 0.1s",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:10.5,fontWeight:isLit?800:600,
                        color:isLit?lc.hdr:"#1e293b",lineHeight:1.2}}>{res.name}</span>
                      <span style={{fontSize:10,fontWeight:700,
                        color:over?"#dc2626":done?"#166534":"#64748b",
                        background:over?"#fef2f2":done?"#dcfce7":"#f8fafc",
                        border:`1px solid ${over?"#fca5a5":done?"#86efac":"#e2e8f0"}`,
                        borderRadius:3,padding:"0 4px",lineHeight:"16px"}}>
                        {cur}{tgt?`/${tgt}`:""}
                      </span>
                    </div>
                    {tgt&&(
                      <div style={{marginTop:3,height:3,borderRadius:2,background:"#f1f5f9",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:2,background:barColor,
                          width:`${Math.min(pct,1)*100}%`,transition:"width 0.25s"}}/>
                      </div>
                    )}
                    {isLit&&(
                      <div style={{marginTop:3,fontSize:9,color:lc.tx,opacity:0.8}}>
                        {res.rotation}{res.vacation!=="None"?` · 🏖 ${res.vacation}`:""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{padding:"5px 9px",borderTop:"1px solid #f1f5f9",background:"#f8fafc",
        fontSize:9,color:"#94a3b8",textAlign:"center",flexShrink:0}}>
        Click resident → view &amp; edit calls
      </div>
    </div>
  );
}

function ResidentsPage({sched}){
  const dateIdx={};sched.forEach((r,i)=>{dateIdx[r.date]=i;});

  function getCalls(name){
    return sched.flatMap(row=>{
      let slot=null;
      if(row.SO.includes(name))slot="Senior Overall";
      if(row.NICU.includes(name))slot="NICU";
      if(row.PICU.includes(name))slot="PICU";
      if(row.PMW.includes(name))slot="PMW";
      return slot?[{date:row.date,day:row.day,type:row.type,slot}]:[];
    });
  }

  const levels=["R4","R3","R2","R1"];

  return(
    <div style={{padding:"0 0 24px"}}>
      {levels.map(lvl=>{
        const group=residentProfiles.filter(r=>r.level===lvl);
        const lc=levelColors[lvl];
        return(
          <div key={lvl}>
            <div style={{margin:"20px 0 10px",paddingBottom:4,borderBottom:`3px solid ${lc.hdr}`,display:"flex",alignItems:"center",gap:8}}>
              <span style={{background:lc.hdr,color:"#fff",borderRadius:4,padding:"2px 10px",fontSize:13,fontWeight:800}}>{lvl}</span>
              <span style={{fontSize:13,fontWeight:700,color:lc.tx}}>Residents</span>
            </div>

            {group.map(res=>{
              const calls=getCalls(res.name);
              const wdCount=calls.filter(c=>c.type==="WD").length;
              const weCount=calls.filter(c=>c.type==="WE").length;

              return(
                <div key={res.name} style={{background:"#fff",borderRadius:8,border:`1px solid ${lc.light}`,marginBottom:10,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  {/* Resident header */}
                  <div style={{background:lc.light,padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:`1px solid ${lc.hdr}22`}}>
                    <span style={{fontSize:14,fontWeight:800,color:lc.hdr}}>{res.name}</span>
                    <span style={{fontSize:11,fontWeight:600,color:lc.tx,background:"#fff",borderRadius:3,padding:"1px 7px",border:`1px solid ${lc.hdr}44`}}>{res.level}</span>
                    <span style={{fontSize:11,fontWeight:600,color:lc.tx,background:"#fff",borderRadius:3,padding:"1px 7px",border:`1px solid ${lc.hdr}44`}}>{res.rotation}</span>
                    <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:lc.tx}}>{calls.length} call{calls.length!==1?"s":""} · {wdCount}WD + {weCount}WE</span>
                  </div>

                  <div style={{padding:"8px 14px"}}>
                    {/* Info tags */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                      {res.vacation!=="None"&&(
                        <span style={{fontSize:11,background:"#fffbeb",border:"1px solid #fcd34d",color:"#92400e",borderRadius:4,padding:"2px 8px"}}>📅 Vacation: {res.vacation}</span>
                      )}
                      {res.unwanted!=="None"&&(
                        <span style={{fontSize:11,background:"#fef2f2",border:"1px solid #fca5a5",color:"#dc2626",borderRadius:4,padding:"2px 8px"}}>⛔ Unwanted: {res.unwanted}</span>
                      )}
                      {res.leaveBlock11!=="None"&&(
                        <span style={{fontSize:11,background:"#fff7ed",border:"1px solid #fdba74",color:"#c2410c",borderRadius:4,padding:"2px 8px"}}>📋 Leave: {res.leaveBlock11}</span>
                      )}
                      {res.constraints.map((c,i)=>(
                        <span key={i} style={{fontSize:11,background:"#f0f9ff",border:"1px solid #bae6fd",color:"#0369a1",borderRadius:4,padding:"2px 8px"}}>⚠ {c}</span>
                      ))}
                      {res.notes&&(
                        <span style={{fontSize:11,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",borderRadius:4,padding:"2px 8px"}}>📝 {res.notes}</span>
                      )}
                    </div>

                    {/* Calls table */}
                    {calls.length===0?(
                      <div style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>No calls assigned in current schedule.</div>
                    ):(
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
                        <thead>
                          <tr style={{background:lc.hdr}}>
                            {["#","Date","Day","Type","Slot","Gap","Status"].map(h=>(
                              <th key={h} style={{padding:"4px 8px",color:"#fff",fontWeight:700,textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)",whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {calls.map((c,i)=>{
                            const gapNum=i===0?null:(dateIdx[c.date]-dateIdx[calls[i-1].date]);
                            const gapTxt=i===0?"—":`${gapNum}d`;
                            const gapOk=gapNum===null||gapNum>=4;
                            const gapWarn=gapNum===3;
                            const statusIcon=i===0?"—":gapOk?"✅":gapWarn?"⚠️ 3d":"❌";
                            const stc=slotTagColors[c.slot]||{bg:"#f1f5f9",tx:"#374151"};
                            return(
                              <tr key={i} style={{background:i%2===0?"#fff":"#f9fafb",borderBottom:"1px solid #e5e7eb"}}>
                                <td style={{padding:"3px 8px",color:"#6b7280",textAlign:"center"}}>{i+1}</td>
                                <td style={{padding:"3px 8px",fontWeight:700,color:"#1e293b"}}>{c.date}</td>
                                <td style={{padding:"3px 8px",color:"#374151"}}>{c.day}</td>
                                <td style={{padding:"3px 8px",color:c.type==="WE"?"#0369a1":"#374151",fontWeight:c.type==="WE"?600:400}}>{c.type==="WE"?"Weekend":"Weekday"}</td>
                                <td style={{padding:"3px 8px"}}><span style={{background:stc.bg,color:stc.tx,borderRadius:3,padding:"1px 6px",fontWeight:600,fontSize:11}}>{c.slot}</span></td>
                                <td style={{padding:"3px 8px",fontWeight:700,color:gapOk?"#166534":gapWarn?"#d97706":"#dc2626",textAlign:"center"}}>{gapTxt}</td>
                                <td style={{padding:"3px 8px",textAlign:"center"}}>{statusIcon}</td>
                              </tr>
                            );
                          })}
                          <tr style={{background:lc.light,borderTop:`2px solid ${lc.hdr}33`}}>
                            <td colSpan={2} style={{padding:"3px 8px",fontWeight:700,color:lc.tx}}>Total</td>
                            <td colSpan={2} style={{padding:"3px 8px",fontWeight:700,color:lc.tx,textAlign:"center"}}>{calls.length} call{calls.length!==1?"s":""}</td>
                            <td style={{padding:"3px 8px",fontWeight:600,color:lc.tx,textAlign:"center"}}>{wdCount}WD + {weCount}WE</td>
                            <td colSpan={2} style={{padding:"3px 8px",textAlign:"center"}}>{calls.length>0?"✅":""}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function AvailabilityPanel({sched}){
  const[expanded,setExpanded]=React.useState(null);
  const lvOrder=["R4","R3","R2","R1"];
  const lvColors={R4:{dot:"#1e3a8a"},R3:{dot:"#166534"},R2:{dot:"#92400e"},R1:{dot:"#6b21a8"}};
  const units=[
    {key:"nicu",label:"NICU",totKey:"nicuTot",hdr:"#1d4ed8",light:"#dbeafe"},
    {key:"picu",label:"PICU",totKey:"picuTot",hdr:"#9d174d",light:"#fce7f3"},
    {key:"gp",  label:"GP / PMW",totKey:"gpTot", hdr:"#065f46",light:"#d1fae5"},
  ];
  function chip(avail,total,postCall,vacation){
    const pct=total?avail/total:1;
    const sc=pct>=0.75?"#166534":pct>=0.5?"#b45309":"#991b1b";
    const sb=pct>=0.75?"#dcfce7":pct>=0.5?"#fef3c7":"#fef2f2";
    const parts=[];
    if(postCall.length)parts.push(`Post-call: ${postCall.join(", ")}`);
    if(vacation.length)parts.push(`Vacation: ${vacation.join(", ")}`);
    return{sc,sb,tip:parts.join(" | ")||"All available"};
  }
  return(
    <div onClick={e=>e.stopPropagation()} style={{
      width:210,flexShrink:0,background:"#fff",borderRadius:8,
      border:"1px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
      overflow:"hidden",alignSelf:"flex-start",display:"flex",flexDirection:"column",
      maxHeight:"calc(100vh - 140px)",position:"sticky",top:8
    }}>
      <div style={{background:"#1e293b",color:"#94a3b8",fontSize:9.5,fontWeight:700,
        letterSpacing:"0.08em",textTransform:"uppercase",padding:"6px 10px",flexShrink:0}}>
        📊 Next-Day Availability
      </div>
      <div style={{fontSize:9,color:"#94a3b8",padding:"4px 10px",background:"#f8fafc",
        borderBottom:"1px solid #e2e8f0",flexShrink:0}}>
        Click a day to see per-unit breakdown by level
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {sched.slice(0,-1).map((row,i)=>{
          const av=getAvailability(sched,i+1);
          if(!av)return null;
          const next=sched[i+1];
          const isOpen=expanded===i;
          // Summary chips for collapsed row
          return(
            <div key={row.date} style={{borderBottom:"1px solid #f1f5f9"}}>
              {/* ── Clickable day header ── */}
              <div onClick={()=>setExpanded(isOpen?null:i)} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"5px 8px",cursor:"pointer",
                background:isOpen?"#f0f9ff":"#fff",
                borderLeft:isOpen?"3px solid #0284c7":"3px solid transparent",
                transition:"background 0.1s"
              }}>
                <div style={{fontSize:9.5,fontWeight:700,color:isOpen?"#0369a1":"#1e293b"}}>
                  {row.date}<span style={{color:"#94a3b8",fontWeight:400,margin:"0 3px"}}>→</span>{next.date}
                </div>
                <div style={{display:"flex",gap:3,alignItems:"center"}}>
                  {units.map(u=>{
                    const t=av[u.totKey];
                    const pct=t.total?t.avail/t.total:1;
                    const sc=pct>=0.75?"#166534":pct>=0.5?"#b45309":"#991b1b";
                    const sb=pct>=0.75?"#dcfce7":pct>=0.5?"#fef3c7":"#fef2f2";
                    return(
                      <span key={u.key} style={{fontSize:8.5,fontWeight:700,color:sc,background:sb,
                        borderRadius:3,padding:"0 4px",border:`1px solid ${sc}44`,lineHeight:"16px"}}>
                        {t.avail}/{t.total}
                      </span>
                    );
                  })}
                  <span style={{fontSize:9,color:"#94a3b8",marginLeft:2}}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>
              {/* ── Expanded unit×level breakdown ── */}
              {isOpen&&(
                <div style={{background:"#f8fafc",padding:"6px 8px",display:"flex",flexDirection:"column",gap:6}}>
                  {units.map(u=>{
                    const groups=av[u.key];
                    const levels=lvOrder.filter(lv=>groups[lv]);
                    return(
                      <div key={u.key}>
                        <div style={{fontSize:9,fontWeight:700,color:"#fff",background:u.hdr,
                          borderRadius:3,padding:"1px 6px",marginBottom:3,display:"inline-block",
                          letterSpacing:"0.05em"}}>
                          {u.label}
                        </div>
                        {levels.length===0
                          ?<div style={{fontSize:9,color:"#94a3b8",paddingLeft:4}}>No residents</div>
                          :<div style={{display:"flex",flexDirection:"column",gap:2}}>
                            {levels.map(lv=>{
                              const g=groups[lv];
                              const {sc,sb,tip}=chip(g.avail,g.total,g.postCall,g.vacation);
                              return(
                                <div key={lv} title={tip} style={{
                                  display:"flex",alignItems:"center",gap:4,
                                  background:sb,borderRadius:3,padding:"2px 6px",
                                  border:`1px solid ${sc}33`,cursor:"default"
                                }}>
                                  <span style={{width:5,height:5,borderRadius:"50%",
                                    background:lvColors[lv].dot,flexShrink:0,display:"inline-block"}}/>
                                  <span style={{fontWeight:700,color:sc,minWidth:20,fontSize:9.5}}>{lv}</span>
                                  <span style={{color:sc,fontWeight:600,fontSize:9.5}}>{g.avail}/{g.total}</span>
                                  {(g.postCall.length>0||g.vacation.length>0)&&(
                                    <span style={{fontSize:8,color:"#94a3b8",marginLeft:"auto"}}>
                                      {g.postCall.length>0&&`${g.postCall.length}📵`}
                                      {g.vacation.length>0&&` ${g.vacation.length}🏖`}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App(){
  const[sched,setSched]     =useState(()=>{try{const s=localStorage.getItem('block11_sched');return s?JSON.parse(s):deepClone(initialSchedule);}catch{return deepClone(initialSchedule);}});
  const[history,setHistory] =useState([]);
  const[selected,setSelected]=useState(null);
  const[spotlight,setSpotlight]=useState(null); // name of resident whose panel is open
  const[colorMode,setColor] =useState("rotation");
  const[activeFilter,setFilter]=useState(null); // null = show all
  const[warnings,setWarnings]=useState([]);
  const[moveLog,setMoveLog] =useState([]);
  const[exporting,setExporting]=useState(false);
  const[exportErr,setExportErr]=useState("");
  const[page,setPage]       =useState("schedule"); // "schedule" | "residents"
  const[saveMsg,setSaveMsg] =useState("");
  const[addTarget,setAddTarget]=useState(null); // {date,slot} for the resident-picker dropdown
  const[addSearch,setAddSearch]=useState("");
  const[dataSource,setDataSource]=useState("loading"); // "loading" | "live" | "fallback"

  // Schedule tab is a single-day view (Prev/Next + date dropdown), defaulting
  // to today. sched is populated synchronously above, so this can compute
  // the index directly instead of needing a post-mount effect.
  const[dayIdx,setDayIdx]=useState(()=>{
    const idx=sched.findIndex(r=>r.date===todayDateLabel());
    return idx>=0?idx:0;
  });
  const[fullView,setFullView]=useState(false); // toggles the Schedule tab between single-day and the full 28-day grid

  // ── Fetch resident data from the backend on load; fall back to the
  // DEFAULT_* snapshots above if it's unreachable (e.g. published standalone
  // to Netlify, where the backend isn't deployed). Read-only: this hydrates
  // the app's initial data, it doesn't sync schedule edits back. ──
  useEffect(()=>{
    let cancelled=false;
    fetch(`${API_BASE}/api/block11/bootstrap`)
      .then(r=>{ if(!r.ok) throw new Error(`status ${r.status}`); return r.json(); })
      .then(data=>{
        if(cancelled) return;
        rotationMap=data.rotationMap;
        levelMap=data.levelMap;
        vacationWeeks=data.vacationWeeks;
        unwantedDays=data.unwantedDays;
        residentProfiles=data.residentProfiles;
        initialSchedule=data.initialSchedule;
        filterGroups=buildFilterGroups();
        // Only replace the schedule state if there's no in-progress local
        // edit already saved -- localStorage, when present, always wins.
        if(!localStorage.getItem('block11_sched')){
          setSched(deepClone(initialSchedule));
        }
        setDataSource("live");
      })
      .catch(()=>{ if(!cancelled) setDataSource("fallback"); });
    return ()=>{ cancelled=true; };
  },[]);

  // ── Is a resident highlighted by the active filter or spotlight? ──
  const isHighlighted = name => {
    if(spotlight && name!==spotlight) return false;
    return !activeFilter || filterGroups[activeFilter]?.has(name);
  };

  // ── Badge style ──
  const getBadgeStyle=(name,date,slot)=>{
    const isSel = selected?.name===name&&selected?.fromDate===date&&selected?.fromSlot===slot;
    const highlighted = isHighlighted(name);
    const rot = rotationMap[name]||"";
    let bg,bd,tx;
    if(isSel){
      bg="#fef08a"; bd="#ca8a04"; tx="#713f12";
    } else if(!highlighted){
      bg="#f1f5f9"; bd="#e2e8f0"; tx="#cbd5e1"; // faded
    } else if(colorMode==="rotation"){
      const c=rotColors[rot]||{bg:"#f1f5f9",bd:"#94a3b8",tx:"#334155"};
      bg=c.bg; bd=c.bd; tx=c.tx;
    } else {
      bg="#f1f5f9"; bd="#94a3b8"; tx="#334155";
    }
    return{
      display:"inline-flex",alignItems:"center",gap:2,
      background:bg,border:`1.5px solid ${bd}`,color:tx,
      borderRadius:4,padding:"2px 6px",fontSize:10.5,fontWeight:600,
      whiteSpace:"nowrap",margin:"1px 1px 2px",
      cursor:"pointer",userSelect:"none",
      opacity:highlighted||isSel?1:0.7,
      boxShadow:isSel?"0 0 0 3px rgba(202,138,4,0.3)":highlighted&&activeFilter?"0 0 0 2px "+filterColors[activeFilter]?.active+"55":"none",
      transform:isSel?"scale(1.05)":"scale(1)",
      transition:"all 0.13s",
    };
  };

  const getCellStyle=(isWE,date,slot)=>({
    padding:"5px 6px",verticalAlign:"top",minWidth:115,
    borderRight:"1px solid #d1d5db",
    // stronger bottom border = clear day separator
    borderBottom:"2px solid #94a3b8",
    background:selected&&!(selected.fromDate===date&&selected.fromSlot===slot)
      ?(isWE?"#ecfdf5":"#f0fdf4")
      :isWE?"#f0f9ff":"#fff",
    outline:selected&&!(selected.fromDate===date&&selected.fromSlot===slot)
      ?"2px dashed #22c55e":"none",
    outlineOffset:-2,
    cursor:selected?"pointer":"default",
    transition:"background 0.1s",
  });

  const handleBadgeClick=(e,name,date,slot)=>{
    e.stopPropagation();
    setSpotlight(name); // always open/refresh the panel for this resident
    if(selected?.name===name&&selected?.fromDate===date&&selected?.fromSlot===slot){setSelected(null);}
    else{setSelected({name,fromDate:date,fromSlot:slot});setWarnings([]);}
  };

  const handleCellClick=(toDate,toSlot)=>{
    if(!selected)return;
    const{name,fromDate,fromSlot}=selected;
    if(fromDate===toDate&&fromSlot===toSlot){setSelected(null);return;}
    setHistory(h=>[...h.slice(-29),deepClone(sched)]);
    const next=deepClone(sched);
    const fromRow=next.find(r=>r.date===fromDate);
    const toRow=next.find(r=>r.date===toDate);
    fromRow[fromSlot]=fromRow[fromSlot].filter(n=>n!==name);
    if(!toRow[toSlot].includes(name))toRow[toSlot]=[...toRow[toSlot],name];
    const warns=checkWarnings(next,name,toDate,toSlot);
    setSched(next);setSelected(null);setWarnings(warns);
    setMoveLog(log=>[{text:`${name}: ${fromDate} ${slotLabel[fromSlot]} → ${toDate} ${slotLabel[toSlot]}`,hasWarn:warns.length>0,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})},...log.slice(0,9)]);
  };

  const handleDelete=(name,fromDate,fromSlot)=>{
    setHistory(h=>[...h.slice(-29),deepClone(sched)]);
    const next=deepClone(sched);
    next.find(r=>r.date===fromDate)[fromSlot]=next.find(r=>r.date===fromDate)[fromSlot].filter(n=>n!==name);
    setSched(next);setSelected(null);setWarnings([]);
    setMoveLog(log=>[{text:`${name}: removed from ${fromDate} ${slotLabel[fromSlot]}`,hasWarn:false,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})},...log.slice(0,9)]);
  };
  const handleAddToSlot=(name,date,slot)=>{
    setHistory(h=>[...h.slice(-29),deepClone(sched)]);
    const next=deepClone(sched);
    const row=next.find(r=>r.date===date);
    if(!row[slot].includes(name))row[slot]=[...row[slot],name];
    const warns=checkWarnings(next,name,date,slot);
    setSched(next);setWarnings(warns);setAddTarget(null);setAddSearch("");
    setMoveLog(log=>[{text:`${name}: added to ${date} ${slotLabel[slot]}`,hasWarn:warns.length>0,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})},...log.slice(0,9)]);
  };
  const undo=()=>{if(!history.length)return;setSched(history[history.length-1]);setHistory(h=>h.slice(0,-1));setWarnings([]);setSelected(null);};
  const reset=()=>{setSched(deepClone(initialSchedule));setHistory([]);setWarnings([]);setSelected(null);setMoveLog([]);};
  const handleExport=async()=>{setExporting(true);setExportErr("");try{await exportDocx(sched);}catch(err){console.error(err);setExportErr("Export failed.");}finally{setExporting(false);}};
  const handleSave=()=>{localStorage.setItem('block11_sched',JSON.stringify(sched));setSaveMsg("Saved ✓");setTimeout(()=>setSaveMsg(""),2500);};

  const weeks=[
    {label:"W1",dates:"Jul 5–11",rows:sched.slice(0,7)},
    {label:"W2",dates:"Jul 12–18",rows:sched.slice(7,14)},
    {label:"W3",dates:"Jul 19–25",rows:sched.slice(14,21)},
    {label:"W4",dates:"Jul 26–Aug 1",rows:sched.slice(21,28)},
  ];

  // Renders one <tr> of the schedule table -- shared by the single-day view
  // (one call) and the full-grid view (one call per row in weeks.map).
  const renderScheduleRow=(row,bb)=>{
    const isWE=row.type==="WE";
    const isToday=row.date===todayDateLabel();
    return(
      <tr key={row.date} style={{borderBottom:bb}}>
          <td style={{padding:"5px 8px",fontWeight:700,fontSize:11,color:isToday?"#b45309":isWE?"#0369a1":"#1e293b",
            borderRight:"1px solid #d1d5db",borderBottom:bb,
            background:isToday?"#fef3c7":isWE?"#e0f2fe":"#f8fafc",position:"sticky",left:0,zIndex:1,whiteSpace:"nowrap"}}>
            {row.day}{isToday&&<div style={{fontSize:7.5,fontWeight:700,color:"#b45309",lineHeight:1}}>TODAY</div>}
            {!isToday&&isWE&&<div style={{fontSize:7.5,fontWeight:500,color:"#0284c7",lineHeight:1}}>WE</div>}
          </td>
          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:600,fontSize:11,color:"#374151",
            background:isWE?"#f0f9ff":"#fff",borderRight:"1px solid #d1d5db",borderBottom:bb,
            whiteSpace:"nowrap"}}>{row.greg}</td>
          <td style={{padding:"5px 6px",textAlign:"center",fontSize:10.5,color:"#6b7280",
            background:isWE?"#f0f9ff":"#fff",borderRight:"1px solid #d1d5db",borderBottom:bb,
            fontFamily:"serif",whiteSpace:"nowrap"}}>{row.hijri}</td>
          {slots.map(s=>{
            const isPickerOpen=addTarget?.date===row.date&&addTarget?.slot===s;
            const lvOrder=["R4","R3","R2","R1"];
            const allNames=lvOrder.flatMap(lv=>Object.keys(levelMap).filter(n=>levelMap[n]===lv&&!row[s].includes(n)));
            const filtered=addSearch?allNames.filter(n=>n.toLowerCase().includes(addSearch.toLowerCase())):allNames;
            return(
            <td key={s} onClick={e=>{e.stopPropagation();handleCellClick(row.date,s);}}
              style={{...getCellStyle(isWE,row.date,s),borderBottom:bb,position:"relative",verticalAlign:"top",paddingBottom:18}}>
              {row[s].length===0
                ?<span style={{color:"#d1d5db",fontSize:10}}>—</span>
                :<div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                  {row[s].map(name=>(
                    <span key={name} onClick={e=>handleBadgeClick(e,name,row.date,s)}
                      style={getBadgeStyle(name,row.date,s)} title={`${name} (${rotationMap[name]||""}) — click to select`}>
                      {name}
                      {levelMap[name]&&<span style={{fontSize:8.5,opacity:0.65,fontWeight:500}}>·{levelMap[name]}</span>}
                    </span>
                  ))}
                </div>}
              {/* ── Add-resident button ── */}
              <button
                onClick={e=>{e.stopPropagation();setAddTarget(isPickerOpen?null:{date:row.date,slot:s});setAddSearch("");}}
                title="Add resident to this slot"
                style={{position:"absolute",bottom:2,right:3,fontSize:11,lineHeight:1,fontWeight:700,
                  padding:"0 5px",borderRadius:3,border:"1px solid #94a3b8",
                  background:isPickerOpen?"#1e3a5f":"#f1f5f9",
                  color:isPickerOpen?"#fff":"#475569",cursor:"pointer",opacity:0.7}}>
                +
              </button>
              {/* ── Resident picker dropdown ── */}
              {isPickerOpen&&(
                <div onClick={e=>e.stopPropagation()}
                  style={{position:"absolute",bottom:"100%",right:0,zIndex:100,
                    background:"#fff",border:"1px solid #cbd5e1",borderRadius:6,
                    boxShadow:"0 6px 20px rgba(0,0,0,0.18)",width:175,
                    display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{padding:"5px 7px",borderBottom:"1px solid #e2e8f0",background:"#f8fafc",
                    fontSize:9.5,fontWeight:700,color:"#1e293b",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>Add to {slotLabel[s]}</span>
                    <button onClick={()=>setAddTarget(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:13,lineHeight:1}}>×</button>
                  </div>
                  <input
                    autoFocus
                    placeholder="Search…"
                    value={addSearch}
                    onChange={e=>setAddSearch(e.target.value)}
                    onClick={e=>e.stopPropagation()}
                    style={{padding:"4px 8px",fontSize:11,border:"none",borderBottom:"1px solid #e2e8f0",outline:"none"}}
                  />
                  <div style={{maxHeight:200,overflowY:"auto"}}>
                    {filtered.length===0&&<div style={{padding:"8px 10px",fontSize:10.5,color:"#94a3b8"}}>No match</div>}
                    {lvOrder.map(lv=>{
                      const lvNames=filtered.filter(n=>levelMap[n]===lv);
                      if(!lvNames.length)return null;
                      return(
                        <div key={lv}>
                          <div style={{padding:"3px 8px",fontSize:8.5,fontWeight:700,color:"#94a3b8",
                            background:"#f8fafc",textTransform:"uppercase",letterSpacing:"0.06em",
                            borderBottom:"1px solid #f1f5f9"}}>{lv}</div>
                          {lvNames.map(name=>(
                            <div key={name}
                              onClick={()=>handleAddToSlot(name,row.date,s)}
                              style={{padding:"5px 10px",fontSize:11,fontWeight:500,color:"#1e293b",
                                cursor:"pointer",borderBottom:"1px solid #f8fafc",display:"flex",
                                justifyContent:"space-between",alignItems:"center"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#f0f9ff"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <span>{name}</span>
                              <span style={{fontSize:9,color:"#94a3b8"}}>{rotationMap[name]||""}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </td>
            );
          })}
      </tr>
    );
  };

  return(
    <div onClick={()=>{if(selected)setSelected(null);if(addTarget)setAddTarget(null);}}
      style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#f8fafc",minHeight:"100vh",padding:12}}>

      {/* ── Header ── */}
      <div onClick={e=>e.stopPropagation()}
        style={{background:"#fff",borderRadius:8,padding:"10px 14px",marginBottom:8,
          boxShadow:"0 1px 4px rgba(0,0,0,0.08)",border:"1px solid #e2e8f0"}}>

        {/* ── Page tabs ── */}
        <div style={{display:"flex",gap:0,marginBottom:10,borderBottom:"2px solid #e2e8f0"}}>
          {[["schedule","📅 Schedule"],["residents","👤 Residents"]].map(([p,label])=>(
            <button key={p} onClick={()=>setPage(p)} style={{
              padding:"6px 18px",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",
              background:"none",borderBottom:`3px solid ${page===p?"#1e3a5f":"transparent"}`,
              color:page===p?"#1e3a5f":"#64748b",marginBottom:-2,transition:"all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#1e3a5f"}}>QHN — Duty Rota Block #11</div>
            <div style={{fontSize:11,color:"#475569",marginTop:1}}>05/07/2026 – 01/08/2026 · 20 Muharram – 17 Safar 1448</div>
            <div style={{fontSize:11,color:"#64748b"}}>Acting Chief Resident: <strong>Hassan AlSaif</strong></div>
            <div style={{fontSize:9.5,color:"#94a3b8",marginTop:2}}>
              {dataSource==="loading"&&"⏳ Loading resident data…"}
              {dataSource==="live"&&"🟢 Live data (backend)"}
              {dataSource==="fallback"&&"⚪ Offline snapshot (backend unreachable)"}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <span style={{fontSize:10,color:"#64748b",fontWeight:700,alignSelf:"center"}}>COLOR</span>
              {["rotation","none"].map(m=>(
                <button key={m} onClick={()=>setColor(m)} style={{padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",background:colorMode===m?"#1e293b":"#fff",color:colorMode===m?"#fff":"#475569",border:`1px solid ${colorMode===m?"#1e293b":"#cbd5e1"}`}}>{m==="rotation"?"By Rotation":"None"}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <button onClick={undo} disabled={!history.length} style={{padding:"2px 9px",borderRadius:4,fontSize:11,fontWeight:600,cursor:history.length?"pointer":"default",background:history.length?"#fffbeb":"#f9fafb",color:history.length?"#92400e":"#9ca3af",border:`1px solid ${history.length?"#fcd34d":"#e5e7eb"}`}}>↩ Undo{history.length?` (${history.length})`:""}</button>
              <button onClick={reset} style={{padding:"2px 9px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",background:"#fef2f2",color:"#991b1b",border:"1px solid #fca5a5"}}>↺ Reset</button>
              <button onClick={handleSave} style={{padding:"2px 12px",borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer",background:saveMsg?"#166534":"#065f46",color:"#fff",border:"1px solid transparent",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:4,transition:"background 0.3s"}}>
                <span>💾</span>{saveMsg||"Save"}
              </button>
              <button onClick={handleExport} disabled={exporting} style={{padding:"2px 12px",borderRadius:4,fontSize:11,fontWeight:700,cursor:exporting?"default":"pointer",background:exporting?"#94a3b8":"#1e3a5f",color:"#fff",border:"1px solid transparent",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:4}}>
                {exporting?<><span>⏳</span> Generating…</>:<><span>📄</span> Export DOCX</>}
              </button>
            </div>
            {exportErr&&<div style={{fontSize:10,color:"#dc2626"}}>{exportErr}</div>}
          </div>
        </div>

        {/* ── FILTER ROW (schedule page only) ── */}
        {page==="schedule"&&(
        <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid #f1f5f9"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#64748b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:5}}>
            Highlight Filter — click to isolate a group, click again to clear
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {Object.entries(filterGroups).map(([label,members])=>{
              const isActive=activeFilter===label;const fc=filterColors[label];
              return(
                <button key={label} onClick={()=>setFilter(isActive?null:label)} style={{padding:"4px 12px",borderRadius:20,fontSize:11.5,fontWeight:700,cursor:"pointer",background:isActive?fc.active:fc.light,color:isActive?"#fff":fc.text,border:`1.5px solid ${isActive?fc.active:fc.active+"55"}`,boxShadow:isActive?`0 0 0 3px ${fc.active}33`:"none",transition:"all 0.15s",display:"flex",alignItems:"center",gap:5}}>
                  {isActive&&<span style={{fontSize:10}}>✓</span>}{label}<span style={{fontSize:10,opacity:0.7,fontWeight:500}}>({members.size})</span>
                </button>
              );
            })}
            {activeFilter&&<button onClick={()=>setFilter(null)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",background:"#f1f5f9",color:"#64748b",border:"1px solid #cbd5e1"}}>✕ Clear filter</button>}
          </div>
          {activeFilter&&(
            <div style={{marginTop:5,fontSize:11,color:filterColors[activeFilter].text,background:filterColors[activeFilter].light,padding:"3px 10px",borderRadius:4,display:"inline-block"}}>
              Showing <strong>{activeFilter}</strong>: {[...filterGroups[activeFilter]].join(", ")}
            </div>
          )}
        </div>
        )}

        {/* Instruction */}
        <div style={{marginTop:6,padding:"5px 10px",background:"#f0f9ff",borderRadius:5,fontSize:11,color:"#0369a1",border:"1px solid #bae6fd"}}>
          {page==="residents"
            ?"👤 Individual resident schedules — vacation, unwanted days, constraints, and call details with gap analysis."
            :spotlight
              ?selected
                ?<span>✦ <strong>{selected.name}</strong> selected from <em>{selected.fromDate} {slotLabel[selected.fromSlot]}</em> — click any cell to move, or pick a different call in the side panel.</span>
                :<span>👁 Viewing <strong>{spotlight}</strong>'s schedule — click a row in the panel to select a call for moving.</span>
              :"✦ Click a badge to open its schedule panel · Click a cell to move · Use filters to highlight teams · 📄 Export saves current state"}
        </div>

        {/* Rotation legend (schedule page, no filter) */}
        {page==="schedule"&&colorMode==="rotation"&&!activeFilter&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:6,paddingTop:5,borderTop:"1px solid #f1f5f9"}}>
            {Object.entries(rotColors).map(([r,c])=>(
              <span key={r} style={{background:c.bg,border:`1px solid ${c.bd}`,color:c.tx,borderRadius:3,padding:"1px 6px",fontSize:9.5,fontWeight:600}}>{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Warnings (schedule page only) ── */}
      {page==="schedule"&&warnings.length>0&&(
        <div onClick={e=>e.stopPropagation()} style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:"#92400e"}}>⚠️ {warnings.length} constraint warning{warnings.length>1?"s":""} detected</span>
            <button onClick={()=>setWarnings([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#92400e"}}>×</button>
          </div>
          {warnings.map((w,i)=>(
            <div key={i} style={{fontSize:11.5,color:"#78350f",marginBottom:3,paddingLeft:6,borderLeft:"3px solid #fbbf24"}}>{w}</div>
          ))}
        </div>
      )}

      {/* ── PAGE 2: Residents ── */}
      {page==="residents"&&(
        <div onClick={e=>e.stopPropagation()}>
          <ResidentsPage sched={sched}/>
        </div>
      )}

      {/* ── PAGE 1: Schedule table + log ── */}
      {page==="schedule"&&(
      <React.Fragment>
      {/* View toggle: single-day (default) vs the full 28-day grid */}
      <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:6,marginBottom:8}}>
        <button onClick={()=>setFullView(false)}
          style={{padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
            border:`1px solid ${!fullView?"#1e3a5f":"#cbd5e1"}`,background:!fullView?"#1e3a5f":"#fff",color:!fullView?"#fff":"#475569"}}>
          📅 Day View
        </button>
        <button onClick={()=>setFullView(true)}
          style={{padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
            border:`1px solid ${fullView?"#1e3a5f":"#cbd5e1"}`,background:fullView?"#1e3a5f":"#fff",color:fullView?"#fff":"#475569"}}>
          📋 Full Schedule
        </button>
      </div>
      {/* Day navigator: Prev / current day + jump-to-date / Next -- one day at a time, defaulting to today */}
      {!fullView&&sched.length>0&&(()=>{
        const row=sched[dayIdx];
        const isWE=row.type==="WE";
        const isToday=row.date===todayDateLabel();
        return(
          <div onClick={e=>e.stopPropagation()} style={{background:isToday?"#b45309":isWE?"#0369a1":"#1e293b",borderRadius:10,
            padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8,color:"#fff"}}>
            <button onClick={()=>setDayIdx(i=>Math.max(0,i-1))} disabled={dayIdx===0} title="Previous day"
              style={{minWidth:44,minHeight:44,fontSize:20,fontWeight:800,borderRadius:8,border:"none",
                background:"rgba(255,255,255,0.15)",color:"#fff",cursor:dayIdx===0?"default":"pointer",opacity:dayIdx===0?0.4:1}}>
              ‹
            </button>
            <div style={{flex:1,textAlign:"center",minWidth:0}}>
              <div style={{fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:6,flexWrap:"wrap"}}>
                {row.day}, {row.date}
                {isToday&&<span style={{fontSize:10,background:"rgba(255,255,255,0.3)",borderRadius:3,padding:"1px 6px",fontWeight:800}}>TODAY</span>}
                {isWE&&!isToday&&<span style={{fontSize:10,background:"rgba(255,255,255,0.25)",borderRadius:3,padding:"1px 6px",fontWeight:700}}>WEEKEND</span>}
              </div>
              <div style={{fontSize:11,opacity:0.8,marginTop:2}}>{row.greg} · {row.hijri}</div>
            </div>
            <select value={row.date} onChange={e=>{const idx=sched.findIndex(r=>r.date===e.target.value); if(idx>=0)setDayIdx(idx);}}
              style={{fontSize:12.5,padding:"6px 8px",borderRadius:6,border:"none",cursor:"pointer",minHeight:36,maxWidth:160}}>
              {sched.map(r=><option key={r.date} value={r.date}>{r.day}, {r.date}</option>)}
            </select>
            <button onClick={()=>setDayIdx(i=>Math.min(sched.length-1,i+1))} disabled={dayIdx===sched.length-1} title="Next day"
              style={{minWidth:44,minHeight:44,fontSize:20,fontWeight:800,borderRadius:8,border:"none",
                background:"rgba(255,255,255,0.15)",color:"#fff",cursor:dayIdx===sched.length-1?"default":"pointer",opacity:dayIdx===sched.length-1?0.4:1}}>
              ›
            </button>
          </div>
        );
      })()}
      <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>

        {/* ── Resident Tracker — always visible left sidebar ── */}
        <ResidentTracker
          sched={sched}
          spotlight={spotlight}
          setSpotlight={setSpotlight}
          setSelected={setSelected}
          setWarnings={setWarnings}
        />

        {/* Resident schedule panel — shown when a badge or tracker row is clicked */}
        {spotlight&&(
          <ResidentPanel
            name={spotlight}
            sched={sched}
            selected={selected}
            setSelected={sel=>{setSelected(sel);setWarnings([]);}}
            onClose={()=>{setSpotlight(null);setSelected(null);}}
            onDelete={(fromDate,fromSlot)=>handleDelete(spotlight,fromDate,fromSlot)}
          />
        )}

        <div style={{flex:1,overflowX:"auto",borderRadius:8,boxShadow:"0 1px 4px rgba(0,0,0,0.1)",border:"1px solid #94a3b8"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
            <thead>
              <tr>
                <th style={{padding:"7px 8px",background:"#1e293b",color:"#fff",fontWeight:700,borderRight:"1px solid #334155",width:36,position:"sticky",left:0,zIndex:3}}>Day</th>
                <th style={{padding:"7px 8px",background:"#1e293b",color:"#fff",fontWeight:700,borderRight:"1px solid #334155",width:48}}>Greg</th>
                <th style={{padding:"7px 8px",background:"#1e293b",color:"#fff",fontWeight:700,borderRight:"1px solid #334155",width:58}}>Hijri</th>
                {slots.map(s=>(
                  <th key={s} style={{padding:"7px 10px",background:slotHdrBg[s],color:"#fff",fontWeight:700,borderRight:"1px solid rgba(255,255,255,0.15)",textAlign:"left",minWidth:120}}>{slotLabel[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fullView?(
                weeks.map(({label,dates,rows})=>(
                  <React.Fragment key={label}>
                    <tr>
                      <td colSpan={7} style={{background:"#334155",color:"#94a3b8",fontSize:9.5,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",padding:"4px 10px",borderBottom:"2px solid #94a3b8"}}>
                        {label} · {dates}
                      </td>
                    </tr>
                    {rows.map((row,ri)=>renderScheduleRow(row,ri===rows.length-1?"3px solid #64748b":"2px solid #94a3b8"))}
                  </React.Fragment>
                ))
              ):(
                sched.length>0&&renderScheduleRow(sched[dayIdx],"2px solid #94a3b8")
              )}
            </tbody>
          </table>
        </div>

        <AvailabilityPanel sched={sched}/>
      </div>
      </React.Fragment>
      )}

      {/* ── Move History (below schedule) ── */}
      {page==="schedule"&&moveLog.length>0&&(
        <div onClick={e=>e.stopPropagation()} style={{marginTop:8,background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"}}>
          <div style={{background:"#1e293b",color:"#94a3b8",fontSize:9.5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"5px 12px"}}>Move History</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
            {moveLog.map((m,i)=>(
              <div key={i} style={{padding:"5px 12px",borderRight:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",background:i===0?"#fffbeb":"#fff",minWidth:200,flex:"1 1 200px"}}>
                <div style={{fontSize:10.5,fontWeight:600,color:"#1e293b",lineHeight:1.3}}>
                  {m.hasWarn&&<span style={{color:"#d97706",marginRight:3}}>⚠️</span>}{m.text}
                </div>
                <div style={{fontSize:9.5,color:"#9ca3af",marginTop:1}}>{m.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{marginTop:6,fontSize:10,color:"#94a3b8",textAlign:"center"}}>
        ANY CHANGE IN DUTY IS NOT ALLOWED UNLESS APPROVED BY HEAD OF DEPARTMENT · Dr. Thuraya Alsaffar · Dr. Zaki Alnemer
      </div>
    </div>
  );
}
