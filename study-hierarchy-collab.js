(() => {
  "use strict";
  if (window.__MEDORA_STUDY_HIERARCHY_COLLAB__) return;
  window.__MEDORA_STUDY_HIERARCHY_COLLAB__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = v => String(v||"").trim().toLowerCase();

  const FIELDS = {
    "Medicine": [
      "Cardiology","Internal Medicine","Pulmonology","Gastroenterology & Hepatology","Nephrology","Endocrinology & Diabetes","Rheumatology","Hematology","Medical Oncology","Infectious Diseases","Allergy & Immunology","Geriatric Medicine","Neurology","Psychiatry","Dermatology","Pediatrics","Neonatology","Obstetrics & Gynecology","General Surgery","Orthopedic Surgery","Neurosurgery","Cardiothoracic Surgery","Vascular Surgery","Urology","ENT / Otolaryngology","Ophthalmology","Anesthesiology","Emergency Medicine","Critical Care Medicine","Family Medicine","Radiology","Nuclear Medicine","Pathology","Clinical Pharmacology","Physical & Rehabilitation Medicine","Sports Medicine","Palliative Medicine","Preventive Medicine"
    ],
    "Dentistry": ["Oral & Maxillofacial Surgery","Orthodontics","Endodontics","Periodontics","Prosthodontics","Restorative Dentistry","Pediatric Dentistry","Oral Medicine","Oral Pathology","Dental Radiology","Community Dentistry"],
    "Pharmacy": ["Clinical Pharmacy","Pharmacology","Pharmaceutics","Medicinal Chemistry","Pharmacognosy","Toxicology","Pharmacokinetics","Hospital Pharmacy","Industrial Pharmacy","Regulatory Affairs"],
    "Nursing": ["Medical-Surgical Nursing","Critical Care Nursing","Emergency Nursing","Pediatric Nursing","Neonatal Nursing","Obstetric Nursing","Mental Health Nursing","Community Nursing","Operating Room Nursing","Cardiac Nursing"],
    "Biomedical Sciences": ["Anatomy","Physiology","Biochemistry","Microbiology","Immunology","Pathology","Pharmacology","Genetics","Histology","Molecular Biology","Cell Biology","Biostatistics"],
    "Public Health": ["Epidemiology","Biostatistics","Occupational Health","Environmental Health","Global Health","Health Policy","Health Economics","Preventive Medicine","Community Medicine","Research Methods"],
    "Other": ["Custom"]
  };

  const GENERIC_TOPICS = ["Core concepts","Anatomy / physiology","Clinical presentation","Diagnosis","Investigations","Management","Emergencies","Guidelines / evidence","Clinical cases","Questions / exam prep","Custom topic"];

  const CARDIO = {
    "Acute coronary syndromes": ["STEMI","NSTEMI / unstable angina","Initial antithrombotic therapy","P2Y12 selection","Primary PCI timing","Thrombus management","No-reflow","Mechanical complications","Cardiogenic shock","Post-MI secondary prevention"],
    "Chronic coronary syndromes": ["Diagnosis and pre-test probability","Functional testing","Coronary CT","Antianginal therapy","Revascularization decisions","Left main disease","Multivessel disease","Diabetes and CAD","Secondary prevention"],
    "PCI / Interventional cardiology": ["Access and closure","Guide catheter selection","Workhorse wires","Lesion preparation","Stent sizing","Bifurcation PCI","Left main PCI","Calcified lesions","CTO PCI","Complications","Ultra-low contrast PCI"],
    "Coronary physiology & intravascular imaging": ["FFR","iFR / NHPR","IVUS acquisition","IVUS optimization","OCT acquisition","OCT optimization","Co-registration","Stent failure mechanisms"],
    "Heart failure": ["HFrEF","HFmrEF","HFpEF","Acute heart failure","Diuretics","Four-pillar GDMT","Iron deficiency","Advanced heart failure","MCS / LVAD","Transplantation","Device therapy","Cardiorenal syndrome"],
    "Valvular heart disease": ["Aortic stenosis","Aortic regurgitation","Mitral stenosis","Primary MR","Secondary MR","Tricuspid regurgitation","Pulmonary valve disease","Prosthetic valves","Endocarditis-related valve disease","Multivalvular disease"],
    "Atrial fibrillation": ["Diagnosis","Rate control","Rhythm control","Cardioversion","Anticoagulation","DOAC selection","AF ablation","LAA closure","AF in heart failure","AF after surgery","Screening / subclinical AF"],
    "Arrhythmias & electrophysiology": ["SVT","AVNRT","AVRT / accessory pathways","Atrial tachycardia","Atrial flutter","EP study basics","Mapping","Ablation complications"],
    "Ventricular arrhythmias & sudden death": ["PVCs","Monomorphic VT","Polymorphic VT","Torsades","VF","Electrical storm","Scar VT ablation","Inherited arrhythmia syndromes","SCD risk stratification"],
    "Bradycardia & pacing": ["Sinus node dysfunction","AV block","Temporary pacing","Permanent pacing indications","Lead positioning","Physiologic pacing","Pacemaker troubleshooting","Pacemaker complications"],
    "ICD / CRT / CIEDs": ["Primary prevention ICD","Secondary prevention ICD","CRT indications","CRT optimization","Device infection","Lead extraction","ICD shocks","Remote monitoring"],
    "Echocardiography": ["TTE basics","LV systolic function","Diastolic function","RV assessment","Aortic valve","Mitral valve","Tricuspid valve","TEE","Stress echo","Strain imaging","3D echo","Pericardium","Congenital echo"],
    "Cardiac MRI": ["Sequences and basics","LV / RV function","LGE","Myocarditis","Cardiomyopathies","Viability","Stress perfusion","Iron overload","Congenital CMR"],
    "Cardiac CT": ["Calcium score","CT coronary angiography","Plaque assessment","FFR-CT concepts","TAVI planning","LAA / pulmonary vein CT","Aortic CT","Congenital CT"],
    "Nuclear cardiology": ["SPECT perfusion","PET perfusion","Viability","Amyloidosis scintigraphy","Infection imaging","Radiation concepts"],
    "Cardiomyopathies": ["Dilated cardiomyopathy","Hypertrophic cardiomyopathy","Arrhythmogenic cardiomyopathy","Restrictive cardiomyopathy","Amyloidosis","Fabry disease","LV noncompaction","Genetic testing"],
    "Myocarditis": ["Clinical presentation","CMR diagnosis","Biopsy indications","Fulminant myocarditis","Immune checkpoint myocarditis","Exercise restriction","Follow-up"],
    "Pericardial disease": ["Acute pericarditis","Recurrent pericarditis","Pericardial effusion","Tamponade","Constrictive pericarditis","Pericardiocentesis"],
    "Adult congenital heart disease": ["ASD","VSD","PDA","Tetralogy of Fallot","Coarctation","Transposition","Fontan circulation","Eisenmenger syndrome","Pregnancy in ACHD"],
    "Pulmonary hypertension": ["Classification","Right-heart catheterization","PAH therapy","CTEPH","PH due to left heart disease","RV failure","Risk stratification"],
    "Hypertension": ["Diagnosis","Ambulatory BP","Secondary hypertension","Drug therapy","Resistant hypertension","Hypertensive emergency","Pregnancy hypertension"],
    "Dyslipidemia & prevention": ["Risk assessment","LDL targets","Statins","Ezetimibe","PCSK9 therapy","Triglycerides","Lp(a)","Lifestyle","Primary prevention","Secondary prevention"],
    "Aortic disease": ["Aortic aneurysm","Acute aortic syndrome","Aortic dissection","Intramural hematoma","Bicuspid aortopathy","Genetic aortopathy","Surveillance","Surgery thresholds"],
    "Structural heart interventions": ["TAVI","TEER / MitraClip","Transcatheter tricuspid intervention","LAA closure","ASD closure","PFO closure","Balloon mitral valvotomy","Paravalvular leak closure"],
    "Cardiogenic shock & mechanical support": ["Shock phenotypes","Hemodynamic assessment","Inotropes / vasopressors","IABP","Impella","VA-ECMO","Shock teams","Revascularization strategy"],
    "Infective endocarditis": ["Diagnosis","Blood cultures","Echo","Antibiotics","Surgery indications","Prosthetic valve endocarditis","Device infection","Embolic complications"],
    "Cardio-oncology": ["Baseline risk","Anthracyclines","HER2 therapy","Immune checkpoint inhibitors","VEGF inhibitors","Radiotherapy","CTRCD management","Thrombosis","Long-term surveillance"],
    "Pregnancy & heart disease": ["Risk assessment","Valvular disease","Cardiomyopathy","Arrhythmias","Anticoagulation","Hypertension","Aortopathy","Delivery planning"],
    "Non-cardiac surgery": ["Pre-op risk assessment","Functional capacity","Biomarkers","Stress testing","Medication management","Antiplatelet management","Perioperative MI","Post-op surveillance"],
    "Sports cardiology": ["Pre-participation screening","Athlete's heart","HCM and sport","Arrhythmias and sport","CAD and sport","Myocarditis return-to-play","Valvular disease and sport"],
    "Cardiac rehabilitation": ["Exercise prescription","Post-ACS rehab","Heart failure rehab","Risk factor control","Smoking cessation","Psychosocial care"],
    "Syncope": ["Initial evaluation","Orthostatic syncope","Reflex syncope","Cardiac syncope","Tilt testing","Loop recorder","Driving / risk"],
    "Genetic & inherited cardiovascular disease": ["Family history","Genetic counseling","HCM genetics","DCM genetics","Channelopathies","Aortopathy genetics","Cascade screening"]
  };

  const STEPS = [
    {key:"start", q:"When will you start studying this topic?", hint:"Example: tomorrow at 7 PM"},
    {key:"due", q:"What is the due date and time?", hint:"Example: 30/08/2026 at 11 PM"},
    {key:"hours", q:"How many total study hours will each of you commit to this topic?", hint:"Example: 8 hours each"},
    {key:"sessions", q:"How many study sessions per week will you do together?", hint:"Example: 3 sessions/week"},
    {key:"length", q:"How long should one session be?", hint:"Example: 60 minutes"},
    {key:"times", q:"Which days and times work for both of you?", hint:"Example: Sun, Tue, Thu at 8 PM"},
    {key:"method", q:"How will you study together?", hint:"Example: 30 min review + 20 MCQs + teach-back"},
    {key:"done", q:"What exactly counts as finishing this topic?", hint:"Example: guideline reviewed + 100 MCQs + 80% score"},
    {key:"check", q:"How will you check each other at the end?", hint:"Example: 20-question quiz and 10-minute oral discussion"}
  ];

  const state = {user:null, profiles:[], connections:[], sessions:[], presence:null, active:null, messages:[], answers:[], decisions:[], channel:null, poll:null, refreshing:false};

  function fieldSpecialties(field){ return FIELDS[field] || []; }
  function topics(field, specialty){ return field === "Medicine" && specialty === "Cardiology" ? Object.keys(CARDIO) : GENERIC_TOPICS; }
  function subtopics(field, specialty, topic){ return field === "Medicine" && specialty === "Cardiology" ? (CARDIO[topic] || []) : []; }
  function pathFromUI(){
    const field=$("#mhField")?.value||"";
    const specialty=$("#mhSpecialty")?.value||"";
    const topic=$("#mhTopic")?.value||"";
    const subtopic=$("#mhSubtopic")?.value||"";
    const custom=$("#mhCustomTopic")?.value?.trim()||"";
    return {field,specialty,topic:topic==="Custom topic"&&custom?custom:topic,subtopic};
  }
  function pathLabel(s){ return [s.field,s.specialty,s.topic,s.subtopic].filter(Boolean).join(" › "); }
  function personName(id){
    if(id===state.user?.id) return "You";
    const p=state.profiles.find(x=>x.user_id===id);
    return p?.display_name || p?.username || "Study partner";
  }
  function otherId(session){ return session.created_by===state.user?.id ? session.colleague_id : session.created_by; }
  function connectedIds(){
    const u=state.user?.id;
    return state.connections.filter(c=>c.status==="accepted").map(c=>c.requester_id===u?c.addressee_id:c.requester_id).filter(Boolean);
  }

  function addStyles(){
    if($("#mhStudyStyle")) return;
    const s=document.createElement("style"); s.id="mhStudyStyle"; s.textContent=`
      .sh-root.ss-simple.ss-mode-today>.sh-hero{display:none!important}
      .sh-root.ss-simple.ss-mode-today #shpPanel>.ss-today-label{display:none!important}
      .sh-root.ss-simple.ss-mode-today #shpPanel .shp-live>.shp-box:first-child{display:none!important}
      .mh-study-card{padding:20px;border:1px solid #dde5ef;border-radius:20px;background:linear-gradient(145deg,#fff,#fbfcff);box-shadow:0 10px 30px #1e2c5010}
      .mh-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mh-head h2{margin:3px 0 4px;font-size:23px;letter-spacing:-.035em}.mh-head p{margin:0;color:#7d8799;font-size:10px}.mh-kicker{font-size:9px;font-weight:900;letter-spacing:.12em;color:#6575de}.mh-path{margin-top:10px;display:flex;gap:5px;flex-wrap:wrap}.mh-path span{padding:5px 8px;border-radius:999px;background:#f1f4f8;color:#67738a;font-size:8px;font-weight:850}
      .mh-cascade{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}.mh-step{display:none;gap:6px;animation:mhIn .18s ease}.mh-step.show{display:grid}.mh-step label{font-size:9px;font-weight:850;color:#606b7e}.mh-step select,.mh-step input{width:100%;min-height:44px;padding:0 11px;border:1px solid #dce3ed;border-radius:12px;background:#fff;color:#263349;font:inherit}.mh-step input{padding:10px 11px}.mh-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}.mh-primary,.mh-secondary{min-height:42px;padding:0 14px;border:0;border-radius:11px;font-size:10px;font-weight:900;cursor:pointer}.mh-primary{color:#fff;background:linear-gradient(115deg,#18b7aa,#657ff1 55%,#8758e9)}.mh-secondary{color:#5268d5;background:#eef1ff}.mh-secondary:disabled,.mh-primary:disabled{opacity:.45;cursor:not-allowed}.mh-privacy{margin-left:auto;color:#8992a3;font-size:9px}.mh-active{display:none;margin-top:12px;padding:10px 12px;border-radius:12px;background:#ebf8f3;color:#276654;font-size:9px}.mh-active.show{display:flex;align-items:center;justify-content:space-between;gap:8px}.mh-active button{border:0;background:transparent;color:#a33f54;font-weight:850;cursor:pointer}
      .mh-shared{margin-top:10px;display:none}.mh-shared.show{display:block}.mh-shared-head{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:7px}.mh-shared-head strong{font-size:12px}.mh-shared-head small{color:#8a93a3;font-size:8px}.mh-session-list{display:grid;gap:6px}.mh-session{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px 11px;border:1px solid #e4e8ef;border-radius:12px;background:#fff;cursor:pointer}.mh-session:hover{background:#f9fbff}.mh-session strong,.mh-session small{display:block}.mh-session small{margin-top:3px;color:#8690a1;font-size:8px}.mh-status{padding:5px 8px;border-radius:999px;background:#eef1ff;color:#586ed4;font-size:8px;font-weight:900}.mh-status.ready{background:#e9f8f1;color:#167653}
      .mh-dialog-bg{position:fixed;z-index:900;inset:0;display:grid;place-items:center;padding:18px;background:#0c152888;backdrop-filter:blur(6px)}.mh-dialog{width:min(980px,100%);max-height:92vh;overflow:auto;border-radius:23px;background:#fff;box-shadow:0 30px 100px #0c153744}.mh-dialog-head{display:flex;justify-content:space-between;gap:12px;padding:19px 21px;border-bottom:1px solid #edf0f5}.mh-dialog-head h2{margin:3px 0 4px;font-size:22px}.mh-dialog-head p{margin:0;color:#80899a;font-size:9px}.mh-x{width:37px;height:37px;border:0;border-radius:50%;background:#f0f3f7;font-size:20px;cursor:pointer}.mh-choose{padding:20px}.mh-choose-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}.mh-person{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e2e7ef;border-radius:13px;background:#fff;cursor:pointer;text-align:left}.mh-person:hover{background:#f8faff}.mh-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#e8faf5,#efecff);color:#5a6780;font-weight:900}.mh-person b,.mh-person small{display:block}.mh-person small{margin-top:2px;color:#8a93a3;font-size:8px}
      .mh-room{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);min-height:600px}.mh-chat{display:grid;grid-template-rows:auto minmax(300px,1fr) auto;border-right:1px solid #edf0f5;min-width:0}.mh-chat-title{padding:14px 17px;border-bottom:1px solid #edf0f5}.mh-chat-title strong,.mh-chat-title small{display:block}.mh-chat-title small{margin-top:3px;color:#8992a2;font-size:8px}.mh-messages{display:flex;flex-direction:column;gap:7px;padding:16px;overflow:auto;max-height:510px;background:#fbfcfe}.mh-msg{max-width:76%;padding:9px 11px;border-radius:13px 13px 13px 4px;background:#fff;border:1px solid #e7ebf1}.mh-msg.mine{align-self:flex-end;border-radius:13px 13px 4px 13px;background:#eaf0ff;border-color:#dce5ff}.mh-msg b{display:block;font-size:8px;color:#68738a}.mh-msg p{margin:3px 0 0;font-size:10px;line-height:1.45;white-space:pre-wrap}.mh-msg time{display:block;margin-top:4px;color:#9aa2af;font-size:7px}.mh-chat-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:12px;border-top:1px solid #edf0f5}.mh-chat-form textarea{resize:none;min-height:44px;max-height:110px;padding:10px 11px;border:1px solid #dfe5ed;border-radius:11px;font:inherit}.mh-chat-form button{min-width:68px;border:0;border-radius:11px;background:#17233e;color:#fff;font-weight:900;cursor:pointer}
      .mh-facilitator{padding:17px;overflow:auto;background:linear-gradient(155deg,#fffdf9,#fbf9ff)}.mh-fac-badge{display:flex;align-items:center;gap:8px;color:#6a5bcf;font-size:9px;font-weight:900;letter-spacing:.08em}.mh-orb{width:29px;height:29px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(135deg,#22b9ad,#7b5dea);color:#fff;font-size:15px}.mh-question{margin-top:12px;padding:14px;border:1px solid #e7e0f4;border-radius:15px;background:#fff}.mh-step-no{color:#8d79d0;font-size:8px;font-weight:900}.mh-question h3{margin:5px 0 4px;font-size:17px;line-height:1.25}.mh-question p{margin:0;color:#8a92a0;font-size:8px}.mh-answer-zone{display:grid;gap:8px;margin-top:11px}.mh-answer-zone label{font-size:8px;font-weight:850;color:#677186}.mh-answer-zone textarea,.mh-final{width:100%;min-height:66px;padding:10px;border:1px solid #dfe4ed;border-radius:11px;resize:vertical;font:inherit}.mh-answer-actions{display:flex;gap:6px;flex-wrap:wrap}.mh-mini{min-height:34px;padding:0 10px;border:0;border-radius:9px;background:#eef1ff;color:#5369d4;font-size:8px;font-weight:900;cursor:pointer}.mh-peer-answer{padding:9px 10px;border-radius:11px;background:#f5f7fa;color:#596477;font-size:9px}.mh-peer-answer b{display:block;margin-bottom:3px}.mh-agree{margin-top:12px;padding-top:12px;border-top:1px solid #ece8f2}.mh-agree label{display:block;margin-bottom:5px;color:#6f788a;font-size:8px;font-weight:850}.mh-next{width:100%;min-height:42px;margin-top:7px;border:0;border-radius:11px;color:#fff;background:linear-gradient(115deg,#18b7aa,#657ff1 55%,#8758e9);font-weight:900;cursor:pointer}.mh-next:disabled{opacity:.45;cursor:not-allowed}.mh-progress{height:5px;margin-top:11px;border-radius:999px;background:#eceff5;overflow:hidden}.mh-progress span{display:block;height:100%;background:linear-gradient(90deg,#1bb8ab,#7b5ee8)}
      .mh-ready{display:grid;gap:8px;margin-top:12px}.mh-ready-item{padding:10px 11px;border-radius:11px;background:#fff;border:1px solid #ece8f2}.mh-ready-item small,.mh-ready-item strong{display:block}.mh-ready-item small{color:#8a92a0;font-size:7px;text-transform:uppercase;letter-spacing:.08em}.mh-ready-item strong{margin-top:3px;font-size:10px}.mh-ready-note{margin-top:10px;padding:10px 11px;border-radius:11px;background:#eaf8f2;color:#2d6756;font-size:9px}
      @keyframes mhIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
      @media(max-width:900px){.mh-cascade{grid-template-columns:1fr 1fr}.mh-room{grid-template-columns:1fr}.mh-chat{border-right:0;border-bottom:1px solid #edf0f5}.mh-messages{max-height:360px}}@media(max-width:620px){.mh-cascade{grid-template-columns:1fr}.mh-choose-grid{grid-template-columns:1fr}.mh-dialog-bg{padding:7px}.mh-dialog{max-height:96vh;border-radius:17px}.mh-dialog-head{padding:14px}.mh-room{min-height:0}.mh-facilitator{padding:13px}.mh-privacy{width:100%;margin-left:0}}
    `; document.head.appendChild(s);
  }

  async function loadUserData(){
    const {data:{user}}=await db.auth.getUser(); if(!user)return false; state.user=user;
    const [p,c,s,pres]=await Promise.all([
      db.from("public_profiles").select("user_id,display_name,username,is_visible"),
      db.from("connections").select("requester_id,addressee_id,status").eq("status","accepted"),
      db.from("study_collab_sessions").select("*").order("updated_at",{ascending:false}).limit(30),
      db.from("study_presence").select("*").eq("user_id",user.id).maybeSingle()
    ]);
    if(p.error) console.warn("Study hierarchy profiles",p.error);
    if(c.error) console.warn("Study hierarchy connections",c.error);
    if(s.error) console.warn("Study collaboration sessions",s.error);
    state.profiles=p.data||[]; state.connections=c.data||[]; state.sessions=s.data||[]; state.presence=pres.data||null;
    return true;
  }

  function options(arr, placeholder){ return `<option value="">${esc(placeholder)}</option>` + arr.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(""); }

  function renderHierarchy(){
    const p=$("#shpPanel"); if(!p)return;
    let card=$("#mhStudyCard");
    if(!card){
      card=document.createElement("section"); card.id="mhStudyCard"; card.className="mh-study-card";
      const live=p.querySelector(".shp-live"); if(live)p.insertBefore(card,live); else p.prepend(card);
      card.innerHTML=`
        <div class="mh-head"><div><span class="mh-kicker">STUDY NOW</span><h2>What are you studying?</h2><p>Choose step by step. Medora only opens the next level when you need it.</p></div></div>
        <div id="mhPath" class="mh-path"></div>
        <div class="mh-cascade">
          <div class="mh-step show"><label>1 · Field</label><select id="mhField">${options(Object.keys(FIELDS),"Choose field")}</select></div>
          <div class="mh-step" id="mhSpecialtyStep"><label>2 · Specialty</label><select id="mhSpecialty"></select></div>
          <div class="mh-step" id="mhTopicStep"><label>3 · Topic</label><select id="mhTopic"></select><input id="mhCustomTopic" hidden placeholder="Type your topic" maxlength="140" /></div>
          <div class="mh-step" id="mhSubtopicStep"><label>4 · Focus</label><select id="mhSubtopic"></select></div>
        </div>
        <div class="mh-actions">
          <button id="mhStart" class="mh-primary" type="button" disabled>Start studying</button>
          <button id="mhPlanTogether" class="mh-secondary" type="button" disabled>Plan with a colleague</button>
          <span class="mh-privacy">Visible to your connections while studying</span>
        </div>
        <div id="mhActive" class="mh-active"></div>
        <div id="mhShared" class="mh-shared"></div>
      `;
      $("#mhField").addEventListener("change",cascadeField);
      $("#mhSpecialty").addEventListener("change",cascadeSpecialty);
      $("#mhTopic").addEventListener("change",cascadeTopic);
      $("#mhSubtopic").addEventListener("change",refreshPath);
      $("#mhCustomTopic").addEventListener("input",refreshPath);
      $("#mhStart").addEventListener("click",startStudying);
      $("#mhPlanTogether").addEventListener("click",chooseColleague);
    }
    renderActive(); renderSessions(); refreshPath();
  }

  function cascadeField(){
    const field=$("#mhField").value; const st=$("#mhSpecialtyStep"), sp=$("#mhSpecialty"), tt=$("#mhTopicStep"), sub=$("#mhSubtopicStep");
    tt.classList.remove("show");sub.classList.remove("show");$("#mhCustomTopic").hidden=true;
    if(!field){st.classList.remove("show");sp.innerHTML="";refreshPath();return}
    sp.innerHTML=options(fieldSpecialties(field),"Choose specialty");st.classList.add("show");refreshPath();
  }
  function cascadeSpecialty(){
    const {field,specialty}=pathFromUI(); const t=$("#mhTopic"), step=$("#mhTopicStep"), sub=$("#mhSubtopicStep");
    sub.classList.remove("show");$("#mhCustomTopic").hidden=true;
    if(!specialty){step.classList.remove("show");t.innerHTML="";refreshPath();return}
    t.innerHTML=options(topics(field,specialty),"Choose topic");step.classList.add("show");refreshPath();
  }
  function cascadeTopic(){
    const raw=$("#mhTopic").value; const p=pathFromUI(); const custom=$("#mhCustomTopic"), subStep=$("#mhSubtopicStep"), sub=$("#mhSubtopic");
    custom.hidden=raw!=="Custom topic";
    const list=subtopics(p.field,p.specialty,raw);
    if(list.length){sub.innerHTML=options(list,"Choose a focus (optional)");subStep.classList.add("show")}else{subStep.classList.remove("show");sub.innerHTML=""}
    refreshPath();
  }
  function refreshPath(){
    const p=pathFromUI(); const parts=[p.field,p.specialty,p.topic,p.subtopic].filter(Boolean); const wrap=$("#mhPath"); if(wrap)wrap.innerHTML=parts.map(x=>`<span>${esc(x)}</span>`).join("");
    const ready=!!(p.field&&p.specialty&&p.topic); if($("#mhStart"))$("#mhStart").disabled=!ready;if($("#mhPlanTogether"))$("#mhPlanTogether").disabled=!ready;
  }

  async function startStudying(){
    const p=pathFromUI(); if(!(p.field&&p.specialty&&p.topic))return;
    const topic=p.subtopic || p.topic;
    const row={user_id:state.user.id,room_id:null,subject:p.specialty,topic,status:"studying",visibility:"connections",started_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),note:pathLabel(p),updated_at:new Date().toISOString()};
    const {error}=await db.from("study_presence").upsert(row,{onConflict:"user_id"});
    if(error){alert("Could not start this study session.");console.warn(error);return}
    state.presence=row; renderActive();
  }
  async function stopStudying(){
    if(!state.user)return;
    const {error}=await db.from("study_presence").update({status:"away",last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("user_id",state.user.id);
    if(!error){state.presence={...(state.presence||{}),status:"away"};renderActive()}
  }
  function renderActive(){
    const a=$("#mhActive"); if(!a)return;
    if(state.presence?.status!=="studying"){a.classList.remove("show");a.innerHTML="";return}
    a.innerHTML=`<span><b>Studying now:</b> ${esc(state.presence.note||state.presence.topic||"")}</span><button type="button">Stop</button>`;a.classList.add("show");a.querySelector("button").onclick=stopStudying;
  }

  function renderSessions(){
    const wrap=$("#mhShared"); if(!wrap)return;
    const rows=state.sessions.filter(s=>s.status!=="cancelled").slice(0,5);
    if(!rows.length){wrap.classList.remove("show");wrap.innerHTML="";return}
    wrap.classList.add("show");wrap.innerHTML=`<div class="mh-shared-head"><strong>Shared study plans</strong><small>Your private planning rooms</small></div><div class="mh-session-list">${rows.map(s=>`<button class="mh-session" type="button" data-session="${s.id}"><span><strong>${esc(personName(otherId(s)))} · ${esc(s.subtopic||s.topic||s.specialty)}</strong><small>${esc(pathLabel(s))}</small></span><span class="mh-status ${s.status==='ready'?'ready':''}">${s.status==='ready'?'Ready':`Question ${Math.min(s.current_step+1,STEPS.length)}/${STEPS.length}`}</span></button>`).join("")}</div>`;
    $$('[data-session]',wrap).forEach(b=>b.onclick=()=>openSession(b.dataset.session));
  }

  function chooseColleague(){
    const ids=connectedIds(); const people=ids.map(id=>({id,name:personName(id)})).sort((a,b)=>a.name.localeCompare(b.name));
    const bg=document.createElement("div");bg.className="mh-dialog-bg";bg.id="mhChooseColleague";
    bg.innerHTML=`<section class="mh-dialog" role="dialog" aria-modal="true"><div class="mh-dialog-head"><div><span class="mh-kicker">PLAN TOGETHER</span><h2>Choose a colleague</h2><p>${esc(pathLabel(pathFromUI()))}</p></div><button class="mh-x" type="button">×</button></div><div class="mh-choose">${people.length?`<div class="mh-choose-grid">${people.map(p=>`<button class="mh-person" type="button" data-person="${p.id}"><span class="mh-avatar">${esc(p.name.slice(0,2).toUpperCase())}</span><span><b>${esc(p.name)}</b><small>Open a private shared planning room</small></span></button>`).join("")}</div>`:`<div style="padding:30px;text-align:center;color:#7e8798">Connect with a colleague in People first, then you can plan together here.</div>`}</div></section>`;
    document.body.appendChild(bg);bg.querySelector(".mh-x").onclick=()=>bg.remove();bg.addEventListener("click",e=>{if(e.target===bg)bg.remove()});
    $$('[data-person]',bg).forEach(b=>b.onclick=()=>createSession(b.dataset.person));
  }

  async function createSession(colleague){
    const p=pathFromUI();
    const {data,error}=await db.from("study_collab_sessions").insert({created_by:state.user.id,colleague_id:colleague,field:p.field,specialty:p.specialty,topic:p.topic,subtopic:p.subtopic,status:"planning",current_step:0}).select().single();
    if(error){alert("Could not create the shared study plan.");console.warn(error);return}
    $("#mhChooseColleague")?.remove();state.sessions.unshift(data);renderSessions();openSession(data.id);
  }

  async function fetchSessionData(id){
    if(state.refreshing)return;state.refreshing=true;
    const [s,m,a,d]=await Promise.all([
      db.from("study_collab_sessions").select("*").eq("id",id).single(),
      db.from("study_collab_messages").select("*").eq("session_id",id).order("created_at"),
      db.from("study_collab_answers").select("*").eq("session_id",id),
      db.from("study_collab_decisions").select("*").eq("session_id",id).order("decided_at")
    ]); state.refreshing=false;
    if(s.error)return;
    state.active=s.data;state.messages=m.data||[];state.answers=a.data||[];state.decisions=d.data||[];
    const i=state.sessions.findIndex(x=>x.id===id);if(i>=0)state.sessions[i]=s.data;else state.sessions.unshift(s.data);
    renderRoom();renderSessions();
  }

  function subscribe(id){
    if(state.channel){db.removeChannel(state.channel);state.channel=null} if(state.poll){clearInterval(state.poll);state.poll=null}
    const refresh=()=>fetchSessionData(id);
    state.channel=db.channel(`medora-study-plan-${id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_collab_messages",filter:`session_id=eq.${id}`},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_collab_answers",filter:`session_id=eq.${id}`},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_collab_decisions",filter:`session_id=eq.${id}`},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_collab_sessions",filter:`id=eq.${id}`},refresh)
      .subscribe();
    state.poll=setInterval(()=>{if($("#mhCollabRoom"))refresh()},3000);
  }

  async function openSession(id){
    let bg=$("#mhCollabRoom"); if(!bg){bg=document.createElement("div");bg.id="mhCollabRoom";bg.className="mh-dialog-bg";document.body.appendChild(bg)}
    bg.innerHTML=`<section class="mh-dialog"><div class="mh-dialog-head"><div><span class="mh-kicker">SHARED STUDY PLAN</span><h2>Opening planning room…</h2></div><button class="mh-x" type="button">×</button></div></section>`;
    bg.querySelector(".mh-x").onclick=closeRoom;await fetchSessionData(id);subscribe(id);
  }
  function closeRoom(){
    if(state.channel){db.removeChannel(state.channel);state.channel=null}if(state.poll){clearInterval(state.poll);state.poll=null}state.active=null;$("#mhCollabRoom")?.remove();
  }

  function ownAnswer(stepKey){return state.answers.find(a=>a.step_key===stepKey&&a.user_id===state.user.id)?.answer_text||""}
  function peerAnswer(stepKey){return state.answers.find(a=>a.step_key===stepKey&&a.user_id===otherId(state.active))?.answer_text||""}
  function decision(stepKey){return state.decisions.find(d=>d.step_key===stepKey)?.final_answer||""}

  function renderRoom(){
    const bg=$("#mhCollabRoom"), s=state.active;if(!bg||!s)return;
    const other=personName(otherId(s)); const ready=s.status==="ready"||s.current_step>=STEPS.length; const step=STEPS[Math.min(s.current_step,STEPS.length-1)];
    bg.innerHTML=`<section class="mh-dialog" role="dialog" aria-modal="true">
      <div class="mh-dialog-head"><div><span class="mh-kicker">YOU + ${esc(other).toUpperCase()} + MEDORA</span><h2>${esc(s.subtopic||s.topic||s.specialty)}</h2><p>${esc(pathLabel(s))}</p></div><button class="mh-x" type="button">×</button></div>
      <div class="mh-room">
        <section class="mh-chat"><div class="mh-chat-title"><strong>Discussion</strong><small>Messages update automatically for both of you.</small></div><div id="mhMessages" class="mh-messages">${state.messages.length?state.messages.map(m=>`<div class="mh-msg ${m.user_id===state.user.id?'mine':''}"><b>${esc(personName(m.user_id))}</b><p>${esc(m.body)}</p><time>${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div>`).join(""):`<div style="margin:auto;color:#9199a7;font-size:10px">Start discussing the plan here.</div>`}</div><form id="mhChatForm" class="mh-chat-form"><textarea id="mhChatText" maxlength="3000" placeholder="Message ${esc(other)}…"></textarea><button type="submit">Send</button></form></section>
        <aside class="mh-facilitator">${ready?renderReady(s):renderQuestion(s,step,other)}</aside>
      </div>
    </section>`;
    bg.querySelector(".mh-x").onclick=closeRoom;
    const list=$("#mhMessages");if(list)list.scrollTop=list.scrollHeight;
    $("#mhChatForm")?.addEventListener("submit",sendMessage);
    if(!ready){
      $("#mhSaveAnswer")?.addEventListener("click",saveAnswer);
      $("#mhNextQuestion")?.addEventListener("click",nextQuestion);
      const final=$("#mhFinalAnswer");if(final){final.addEventListener("input",()=>$("#mhNextQuestion").disabled=!final.value.trim())}
    }
  }

  function renderQuestion(s,step,other){
    const mine=ownAnswer(step.key), peer=peerAnswer(step.key), agreed=decision(step.key);
    return `<div class="mh-fac-badge"><span class="mh-orb">✦</span><span>MEDORA FACILITATOR</span></div><div class="mh-progress"><span style="width:${Math.round((s.current_step/STEPS.length)*100)}%"></span></div><section class="mh-question"><span class="mh-step-no">QUESTION ${s.current_step+1} OF ${STEPS.length}</span><h3>${esc(step.q)}</h3><p>${esc(step.hint)}</p></section><div class="mh-answer-zone"><label>My answer</label><textarea id="mhMyAnswer" placeholder="Your answer…">${esc(mine)}</textarea><div class="mh-answer-actions"><button id="mhSaveAnswer" class="mh-mini" type="button">Save my answer</button></div>${peer?`<div class="mh-peer-answer"><b>${esc(other)} answered</b>${esc(peer)}</div>`:`<div class="mh-peer-answer"><b>${esc(other)}</b>Waiting for their answer…</div>`}</div><div class="mh-agree"><label>Agreed final answer</label><textarea id="mhFinalAnswer" class="mh-final" placeholder="After you discuss it, write the point you both agree on…">${esc(agreed || (mine&&peer&&norm(mine)===norm(peer)?mine:""))}</textarea><button id="mhNextQuestion" class="mh-next" type="button" ${agreed||(mine&&peer&&norm(mine)===norm(peer))?'':'disabled'}>${s.current_step===STEPS.length-1?'Finish shared plan':'Agree & next →'}</button></div>`;
  }
  function renderReady(s){
    const vals=STEPS.map(st=>({st,val:decision(st.key)})).filter(x=>x.val);
    return `<div class="mh-fac-badge"><span class="mh-orb">✓</span><span>SHARED PLAN READY</span></div><div class="mh-ready-note">You both finalized this plan. Keep chatting here whenever the plan needs adjustment.</div><div class="mh-ready">${vals.map(x=>`<div class="mh-ready-item"><small>${esc(x.st.q)}</small><strong>${esc(x.val)}</strong></div>`).join("")}</div>`;
  }

  async function sendMessage(e){
    e.preventDefault();const t=$("#mhChatText");const body=t?.value.trim();if(!body||!state.active)return;
    t.value="";const {error}=await db.from("study_collab_messages").insert({session_id:state.active.id,user_id:state.user.id,body});if(error){console.warn(error);t.value=body}else fetchSessionData(state.active.id);
  }
  async function saveAnswer(){
    const step=STEPS[state.active.current_step],text=$("#mhMyAnswer")?.value.trim();if(!text)return;
    const {error}=await db.from("study_collab_answers").upsert({session_id:state.active.id,step_key:step.key,user_id:state.user.id,answer_text:text,updated_at:new Date().toISOString()},{onConflict:"session_id,step_key,user_id"});if(error)console.warn(error);else fetchSessionData(state.active.id);
  }
  async function nextQuestion(){
    const s=state.active,step=STEPS[s.current_step],final=$("#mhFinalAnswer")?.value.trim();if(!final)return;
    const {error:dErr}=await db.from("study_collab_decisions").upsert({session_id:s.id,step_key:step.key,question:step.q,final_answer:final,decided_by:state.user.id,decided_at:new Date().toISOString()},{onConflict:"session_id,step_key"});if(dErr){console.warn(dErr);return}
    const next=s.current_step+1;
    if(next>=STEPS.length){
      const all=[...state.decisions.filter(d=>d.step_key!==step.key),{step_key:step.key,question:step.q,final_answer:final}];
      const finalPlan={path:pathLabel(s),answers:Object.fromEntries(all.map(d=>[d.step_key,d.final_answer]))};
      await db.from("study_collab_sessions").update({current_step:STEPS.length,status:"ready",final_plan:finalPlan,updated_at:new Date().toISOString()}).eq("id",s.id);
    }else{
      await db.from("study_collab_sessions").update({current_step:next,updated_at:new Date().toISOString()}).eq("id",s.id);
    }
    fetchSessionData(s.id);
  }

  function bindEsc(){document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("#mhCollabRoom"))closeRoom();else $("#mhChooseColleague")?.remove()}})}

  async function apply(){
    if(!document.querySelector('[data-study-link].active'))return;
    const root=$(".sh-root"),panel=$("#shpPanel");if(!root||!panel)return;
    addStyles();
    if(!state.user)await loadUserData();
    renderHierarchy();
  }

  function init(){
    addStyles();bindEsc();
    const obs=new MutationObserver(()=>{clearTimeout(obs._t);obs._t=setTimeout(apply,60)});obs.observe(document.body,{childList:true,subtree:true,classList:true});
    document.addEventListener("click",e=>{if(e.target.closest('[data-study-link]'))setTimeout(apply,100)},true);
    [300,700,1200,1800].forEach(ms=>setTimeout(apply,ms));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();