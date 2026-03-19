'use strict';
/* ══════════════════════════════════════════════
   CareGlow — Patient App · app.js
   Features: AI Chat · Auto-Translate · Fun Facts
══════════════════════════════════════════════ */

// ── Utils ─────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k,d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
const qs   = (s,el=document) => el.querySelector(s);
const qsa  = (s,el=document) => [...el.querySelectorAll(s)];

function fmtDateShort(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return new Date(y, m-1, d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fmtTime(t) {
  if (!t) return '';
  const [h,min] = t.split(':').map(Number);
  return `${h > 12 ? h-12 : h===0 ? 12 : h}:${String(min).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function fmtDate(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function offsetISO(days) { const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

function urgencyClass(t, today) {
  const od = t.due && t.due < today;
  if (od && t.priority === 'high') return 'urg-critical';
  if (od || t.priority === 'high') return 'urg-high';
  if (t.due && t.due <= offsetISO(3))  return 'urg-soon';
  if (t.due && t.due <= offsetISO(7))  return 'urg-near';
  return '';
}
function apptUrgencyClass(a, today) {
  if (a.date === today)            return 'urg-critical';
  if (a.date <= offsetISO(2))      return 'urg-high';
  if (a.date <= offsetISO(5))      return 'urg-soon';
  if (a.date <= offsetISO(10))     return 'urg-near';
  return '';
}

// ── Auth storage keys ─────────────────────────
const ACCOUNTS_KEY = 'cg_accounts'; // { [email]: { pw, fname, lname, dob, insurance } }
const SESSION_KEY  = 'cg_session';  // { email } — only when "Remember me" was checked

function getAccounts() { return load(ACCOUNTS_KEY, {}); }
function getSession()  { return load(SESSION_KEY, null); }

// ── State ─────────────────────────────────────
const state = {
  appointments: load('cg_appts',[]),
  tasks:        load('cg_tasks',[]),
  providers:    load('cg_providers',[]),
  savedNames:   load('cg_saved_names', ['John Doe', 'Mary Smith']),
  streak: load('cg_streak', { count: 0, lastDate: '' }),
  calYear:  new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDay: null,
  slideIdx: 0,
  factIdx: 0,
  factCat: 'all',
  currentLang: load('cg_lang','en'),
};

// Seed demo data
if (!state.appointments.length) {
  state.appointments = [
    { id:uid(), provider:'PCP: Dr. Allison Brown', type:'Established patient office visit', date:offsetISO(6),  time:'11:00', notes:'Bring insurance card' },
    { id:uid(), provider:'UC: Eric Wu NP',         type:'Urgent care visit',               date:offsetISO(14), time:'09:30', notes:'' },
  ];
  save('cg_appts', state.appointments);
}
if (!state.tasks.length) {
  state.tasks = [
    { id:uid(), text:"Don't forget to bring the Daycare Forms to your 12/4/25 appointment", done:false, priority:'high',   due:offsetISO(6)  },
    { id:uid(), text:'Schedule your 3 month follow-up',                                      done:false, priority:'normal', due:offsetISO(20) },
    { id:uid(), text:'Pick up prescription from pharmacy',                                   done:false, priority:'high',   due:offsetISO(2)  },
    { id:uid(), text:'Update emergency contact information',                                  done:false, priority:'low',    due:''            },
  ];
  save('cg_tasks', state.tasks);
}
if (!state.providers.length) {
  state.providers = [
    { id:uid(), name:'PCP: Dr. Allison Brown', type:'Primary Care Physician', location:'Kaiser, 1336 Bridge Gate Dr\nDiamond Bar, CA 91765', lastVisit:'2025-11-12' },
    { id:uid(), name:'UC: Eric Wu NP',         type:'Urgent Care',            location:'Hoag UC, 16205 Sand Canyon Suite 100\nIrvine, CA 92618', lastVisit:'2024-01-01' },
    { id:uid(), name:'UC: Dr. Jane Peterson',  type:'Urgent Care',            location:'Accelerated UC, 4108 Edison Ave\nChino, CA 91710', lastVisit:'2024-10-01' },
  ];
  save('cg_providers', state.providers);
}

// ══════════════════════════════════════════════
// HEALTH FUN FACTS
// ══════════════════════════════════════════════
const FACTS = [
  { emoji:'🫀', text:'Your heart beats about 100,000 times per day, pumping roughly 2,000 gallons of blood.', cat:'heart' },
  { emoji:'💓', text:"A woman's heart beats slightly faster than a man's — about 78 bpm vs 70 bpm.", cat:'heart' },
  { emoji:'🩸', text:'Red blood cells complete a full circuit of your body in about 20 seconds.', cat:'heart' },
  { emoji:'🔴', text:'Your heart generates enough pressure to squirt blood about 30 feet.', cat:'heart' },
  { emoji:'❤️', text:'The heart has its own electrical system — it can beat even outside the body if it has oxygen.', cat:'heart' },
  { emoji:'🧠', text:'The brain is approximately 60% fat — making it the fattiest organ in the body.', cat:'brain' },
  { emoji:'⚡', text:'Your brain generates enough electricity to power a small LED light bulb.', cat:'brain' },
  { emoji:'🌙', text:'Some regions of the brain are MORE active during sleep than when you are awake.', cat:'brain' },
  { emoji:'🧬', text:'Neurons can transmit signals at speeds up to 268 mph (431 km/h).', cat:'brain' },
  { emoji:'😴', text:'During deep sleep the brain "detoxes" via the glymphatic system — a built-in waste flusher.', cat:'brain' },
  { emoji:'🦷', text:'Tooth enamel is the hardest substance produced by the human body — harder than bone.', cat:'body' },
  { emoji:'🦴', text:'Adult humans have 206 bones, but babies are born with about 270 — many fuse as we grow.', cat:'body' },
  { emoji:'👁️', text:'The human eye can distinguish approximately 10 million different colors.', cat:'body' },
  { emoji:'🫁', text:'The surface area of your lungs is roughly equal to a tennis court — about 70 square meters.', cat:'body' },
  { emoji:'🦠', text:'There are more bacterial cells in/on your body than human cells — 38 trillion vs 30 trillion.', cat:'body' },
  { emoji:'🌿', text:'Your small intestine is about 20 feet long, coiled tightly in your abdomen.', cat:'body' },
  { emoji:'🥦', text:'Broccoli contains more vitamin C per gram than oranges — 89mg per 100g vs 53mg.', cat:'nutrition' },
  { emoji:'🍵', text:'Green tea contains L-theanine — an amino acid that promotes calm alertness without jitters.', cat:'nutrition' },
  { emoji:'🍫', text:'Dark chocolate (70%+ cacao) contains flavonoids that can support heart health.', cat:'nutrition' },
  { emoji:'🧄', text:'Garlic has been used medicinally for over 5,000 years and has proven antibacterial properties.', cat:'nutrition' },
  { emoji:'🫐', text:'Blueberries are rich in pterostilbene, a compound that may slow cognitive decline.', cat:'nutrition' },
  { emoji:'🤧', text:'A single sneeze can propel droplets at up to 100 mph and travel up to 27 feet.', cat:'weird' },
  { emoji:'🦴', text:'The femur (thigh bone) is stronger than concrete — it can withstand about 1,700 lbs of pressure.', cat:'weird' },
  { emoji:'👃', text:'You can detect about 1 trillion different scents — the old estimate was just 10,000.', cat:'weird' },
  { emoji:'😂', text:'Laughter is contagious because mirror neurons automatically mimic others\' emotions.', cat:'weird' },
  { emoji:'💧', text:'Your body is about 60% water — the brain is 73%, the lungs are 83%.', cat:'weird' },
  { emoji:'🏺', text:'The first known surgical procedure was trepanation — drilling skull holes — around 6500 BCE.', cat:'history' },
  { emoji:'💊', text:'Aspirin was synthesized in 1897, but willow bark tea (its source) was used for centuries before.', cat:'history' },
  { emoji:'🩺', text:'The stethoscope was invented in 1816 using a rolled-up paper tube to hear heartbeats.', cat:'history' },
  { emoji:'💉', text:'The smallpox vaccine (1796) was the world\'s first vaccine, derived from cowpox by Edward Jenner.', cat:'history' },
];

const CAT_LABELS = { all:'All', heart:'❤️ Cardiology', brain:'🧠 Neurology', body:'🦴 Human Body', nutrition:'🥦 Nutrition', weird:'🤯 Weird Facts', history:'📜 History' };

function filteredFacts() {
  return state.factCat === 'all' ? FACTS : FACTS.filter(f => f.cat === state.factCat);
}

function renderFact() {
  const list = filteredFacts();
  if (!list.length) return;
  const f = list[state.factIdx % list.length];
  const emojiEl = qs('#fact-home-emoji');
  const textEl  = qs('#fact-home-text');
  // animate
  emojiEl.style.animation = 'none';
  void emojiEl.offsetWidth;
  emojiEl.style.animation = '';
  emojiEl.textContent = f.emoji;
  textEl.textContent  = f.text;
  qs('#fact-home-cat').textContent = CAT_LABELS[f.cat] || f.cat;
  qs('#fact-counter').textContent  = `${(state.factIdx % list.length) + 1} / ${list.length}`;
}

function initFacts() {
  state.factIdx = Math.floor(Math.random() * FACTS.length);
  renderFact();

  qs('#fact-next-btn').addEventListener('click', () => { state.factIdx++; renderFact(); });
  qs('#fact-prev-btn').addEventListener('click', () => { state.factIdx = Math.max(0, state.factIdx - 1); renderFact(); });
  qs('#fact-shuffle-btn').addEventListener('click', () => {
    const list = filteredFacts();
    state.factIdx = Math.floor(Math.random() * list.length);
    renderFact();
  });

  qsa('.fact-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.fact-cat-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.factCat = btn.dataset.cat;
      state.factIdx = 0;
      renderFact();
    });
  });
}

// ══════════════════════════════════════════════
// I18N — AUTO TRANSLATE
// ══════════════════════════════════════════════
const LANGS = {
  en: {
    welcome_sub:'Manage your health easily', btn_get_started:'Get Started', btn_language:'Language',
    nav_home:'Home', nav_calc:'Calculator', nav_tasks:'Tasks', nav_cal:'Calendar', nav_profile:'Profile',
    heading_home:'Welcome back,\nJohn!', heading_calc:'Calculate your\nNext Office Visit',
    heading_tasks:'All Tasks', heading_cal:'Hi John, ready\nto schedule?', heading_profile:'Profile',
    subtab_providers:'Saved Providers', subtab_account:'Account',
    heading_costs:'Office Visit Costs',
    label_notif:'Notifications', label_upcoming:'Upcoming Appointments', label_tasks:'Tasks',
    label_facts:'Health Fun Facts', label_agenda:"What's on your agenda?",
    label_service:'Service', label_provider:'Provider', label_insurance:'Insurance',
    label_deductible:'Deductible Remaining', label_coverage:'Insurance Coverage',
    label_copay:'Copay', label_breakdown:'Price Breakdown', label_est_total:'Estimated Total:',
    label_account:'Account Info', label_your_appts:'Your Upcoming Appointments',
    label_visit_type:'Visit Type', label_date:'Date', label_time:'Time', label_notes:'Notes',
    label_task_desc:'Task description', label_due:'Due date', label_priority:'Priority',
    label_prov_name:'Provider Name', label_specialty:'Specialty', label_location:'Location',
    label_last_visit:'Last Visited',
    btn_calculate:'Calculate', btn_schedule:'Schedule an Appointment', btn_reschedule:'Reschedule / Cancel',
    btn_recalculate:'← Recalculate', btn_view_all:'View all', btn_confirm:'Confirm Appointment',
    btn_cancel:'Cancel', btn_close:'Close', btn_add_task:'Add Task', btn_save:'Save Provider',
    title_schedule:'Schedule Appointment', title_your_appts:'Your Appointments',
    title_new_task:'New Task', title_add_provider:'Add Provider',
    key_name:'Name', key_dob:'DOB', key_insurance:'Insurance', key_member:'Member ID',
    key_pcp:'PCP', key_phone:'Phone',
  },
  es: {
    welcome_sub:'Gestiona tu salud fácilmente', btn_get_started:'Comenzar', btn_language:'Idioma',
    nav_home:'Inicio', nav_calc:'Calculadora', nav_tasks:'Tareas', nav_cal:'Calendario', nav_profile:'Perfil',
    heading_home:'Bienvenido,\n¡John!', heading_calc:'Calcule su\nPróxima Visita',
    heading_tasks:'Todas las Tareas', heading_cal:'Hola John, ¿listo\npara programar?', heading_profile:'Perfil',
    subtab_providers:'Proveedores Guardados', subtab_account:'Cuenta',
    heading_costs:'Costos de la Visita',
    label_notif:'Notificaciones', label_upcoming:'Próximas Citas', label_tasks:'Tareas',
    label_facts:'Datos de Salud', label_agenda:'¿Qué tienes pendiente?',
    label_service:'Servicio', label_provider:'Proveedor', label_insurance:'Seguro',
    label_deductible:'Deducible Restante', label_coverage:'Cobertura del Seguro',
    label_copay:'Copago', label_breakdown:'Desglose de Precios', label_est_total:'Total Estimado:',
    label_account:'Info de Cuenta', label_your_appts:'Sus Próximas Citas',
    label_visit_type:'Tipo de Visita', label_date:'Fecha', label_time:'Hora', label_notes:'Notas',
    label_task_desc:'Descripción de tarea', label_due:'Fecha límite', label_priority:'Prioridad',
    label_prov_name:'Nombre del Proveedor', label_specialty:'Especialidad', label_location:'Ubicación',
    label_last_visit:'Última Visita',
    btn_calculate:'Calcular', btn_schedule:'Programar una Cita', btn_reschedule:'Reprogramar / Cancelar',
    btn_recalculate:'← Recalcular', btn_view_all:'Ver todo', btn_confirm:'Confirmar Cita',
    btn_cancel:'Cancelar', btn_close:'Cerrar', btn_add_task:'Agregar Tarea', btn_save:'Guardar Proveedor',
    title_schedule:'Programar Cita', title_your_appts:'Sus Citas',
    title_new_task:'Nueva Tarea', title_add_provider:'Agregar Proveedor',
    key_name:'Nombre', key_dob:'Fecha de nac.', key_insurance:'Seguro', key_member:'ID de Miembro',
    key_pcp:'Médico Principal', key_phone:'Teléfono',
  },
  fr: {
    welcome_sub:'Gérez votre santé facilement', btn_get_started:'Commencer', btn_language:'Langue',
    nav_home:'Accueil', nav_calc:'Calculateur', nav_tasks:'Tâches', nav_cal:'Calendrier', nav_profile:'Profil',
    heading_home:'Bienvenue,\nJohn\u00a0!', heading_calc:'Calculez votre\nProchain Rendez-vous',
    heading_tasks:'Toutes les Tâches', heading_cal:'Salut John, prêt\nà planifier\u00a0?', heading_profile:'Profil',
    subtab_providers:'Prestataires Enregistrés', subtab_account:'Compte',
    heading_costs:'Coûts de la Visite',
    label_notif:'Notifications', label_upcoming:'Prochains Rendez-vous', label_tasks:'Tâches',
    label_facts:'Faits de Santé', label_agenda:"Qu'avez-vous à faire\u00a0?",
    label_service:'Service', label_provider:'Prestataire', label_insurance:'Assurance',
    label_deductible:'Franchise Restante', label_coverage:'Couverture Assurance',
    label_copay:'Copaiement', label_breakdown:'Décomposition des Prix', label_est_total:'Total Estimé\u00a0:',
    label_account:'Infos du Compte', label_your_appts:'Vos Prochains Rendez-vous',
    label_visit_type:'Type de Visite', label_date:'Date', label_time:'Heure', label_notes:'Notes',
    label_task_desc:'Description de la tâche', label_due:'Date limite', label_priority:'Priorité',
    label_prov_name:'Nom du Prestataire', label_specialty:'Spécialité', label_location:'Lieu',
    label_last_visit:'Dernière Visite',
    btn_calculate:'Calculer', btn_schedule:'Prendre un Rendez-vous', btn_reschedule:'Reprogrammer / Annuler',
    btn_recalculate:'← Recalculer', btn_view_all:'Tout voir', btn_confirm:'Confirmer le Rendez-vous',
    btn_cancel:'Annuler', btn_close:'Fermer', btn_add_task:'Ajouter Tâche', btn_save:'Enregistrer',
    title_schedule:'Planifier un Rendez-vous', title_your_appts:'Vos Rendez-vous',
    title_new_task:'Nouvelle Tâche', title_add_provider:'Ajouter Prestataire',
    key_name:'Nom', key_dob:'Date de naiss.', key_insurance:'Assurance', key_member:'N° Adhérent',
    key_pcp:'Médecin Traitant', key_phone:'Téléphone',
  },
  zh: {
    welcome_sub:'轻松管理您的健康', btn_get_started:'开始使用', btn_language:'语言',
    nav_home:'主页', nav_calc:'费用计算', nav_tasks:'任务', nav_cal:'日历', nav_profile:'个人资料',
    heading_home:'欢迎回来，\n约翰！', heading_calc:'计算您的\n下次门诊费用',
    heading_tasks:'所有任务', heading_cal:'嗨约翰，准备好\n预约了吗？', heading_profile:'个人资料',
    subtab_providers:'已保存医疗机构', subtab_account:'账户',
    heading_costs:'门诊费用',
    label_notif:'通知', label_upcoming:'即将到来的预约', label_tasks:'任务',
    label_facts:'健康趣闻', label_agenda:'您有哪些待办事项？',
    label_service:'服务', label_provider:'医疗机构', label_insurance:'保险',
    label_deductible:'剩余免赔额', label_coverage:'保险报销',
    label_copay:'自付金额', label_breakdown:'费用明细', label_est_total:'预估总计：',
    label_account:'账户信息', label_your_appts:'您的即将预约',
    label_visit_type:'就诊类型', label_date:'日期', label_time:'时间', label_notes:'备注',
    label_task_desc:'任务描述', label_due:'截止日期', label_priority:'优先级',
    label_prov_name:'医疗机构名称', label_specialty:'专科', label_location:'地址',
    label_last_visit:'最近就诊',
    btn_calculate:'计算', btn_schedule:'预约就诊', btn_reschedule:'改期 / 取消',
    btn_recalculate:'← 重新计算', btn_view_all:'查看全部', btn_confirm:'确认预约',
    btn_cancel:'取消', btn_close:'关闭', btn_add_task:'添加任务', btn_save:'保存',
    title_schedule:'预约就诊', title_your_appts:'您的预约',
    title_new_task:'新建任务', title_add_provider:'添加医疗机构',
    key_name:'姓名', key_dob:'出生日期', key_insurance:'保险', key_member:'会员编号',
    key_pcp:'主治医生', key_phone:'电话',
  },
  vi: {
    welcome_sub:'Quản lý sức khỏe dễ dàng', btn_get_started:'Bắt Đầu', btn_language:'Ngôn ngữ',
    nav_home:'Trang chủ', nav_calc:'Tính phí', nav_tasks:'Nhiệm vụ', nav_cal:'Lịch', nav_profile:'Hồ sơ',
    heading_home:'Chào mừng trở lại,\nJohn!', heading_calc:'Tính phí khám\nBệnh viện tiếp theo',
    heading_tasks:'Tất cả nhiệm vụ', heading_cal:'Xin chào John, sẵn\nsàng đặt lịch chưa?', heading_profile:'Hồ sơ',
    subtab_providers:'Nhà cung cấp đã lưu', subtab_account:'Tài khoản',
    heading_costs:'Chi phí khám bệnh',
    label_notif:'Thông báo', label_upcoming:'Cuộc hẹn sắp tới', label_tasks:'Nhiệm vụ',
    label_facts:'Sự thật thú vị về sức khỏe', label_agenda:'Bạn có việc gì cần làm?',
    label_service:'Dịch vụ', label_provider:'Nhà cung cấp', label_insurance:'Bảo hiểm',
    label_deductible:'Khấu trừ còn lại', label_coverage:'Bảo hiểm chi trả',
    label_copay:'Đồng thanh toán', label_breakdown:'Phân tích chi phí', label_est_total:'Tổng ước tính:',
    label_account:'Thông tin tài khoản', label_your_appts:'Cuộc hẹn sắp tới của bạn',
    label_visit_type:'Loại khám', label_date:'Ngày', label_time:'Giờ', label_notes:'Ghi chú',
    label_task_desc:'Mô tả nhiệm vụ', label_due:'Hạn chót', label_priority:'Ưu tiên',
    label_prov_name:'Tên nhà cung cấp', label_specialty:'Chuyên khoa', label_location:'Địa điểm',
    label_last_visit:'Lần khám gần nhất',
    btn_calculate:'Tính toán', btn_schedule:'Đặt lịch khám', btn_reschedule:'Đổi lịch / Hủy',
    btn_recalculate:'← Tính lại', btn_view_all:'Xem tất cả', btn_confirm:'Xác nhận lịch hẹn',
    btn_cancel:'Hủy', btn_close:'Đóng', btn_add_task:'Thêm nhiệm vụ', btn_save:'Lưu nhà cung cấp',
    title_schedule:'Đặt lịch khám', title_your_appts:'Lịch hẹn của bạn',
    title_new_task:'Nhiệm vụ mới', title_add_provider:'Thêm nhà cung cấp',
    key_name:'Tên', key_dob:'Ngày sinh', key_insurance:'Bảo hiểm', key_member:'Mã thành viên',
    key_pcp:'Bác sĩ chính', key_phone:'Điện thoại',
  },
  ko: {
    welcome_sub:'건강을 쉽게 관리하세요', btn_get_started:'시작하기', btn_language:'언어',
    nav_home:'홈', nav_calc:'비용 계산', nav_tasks:'할 일', nav_cal:'캘린더', nav_profile:'프로필',
    heading_home:'돌아오신 것을\n환영해요, John!', heading_calc:'다음 방문 비용을\n계산하세요',
    heading_tasks:'모든 할 일', heading_cal:'안녕하세요 John,\n예약하실 준비됐나요?', heading_profile:'프로필',
    subtab_providers:'저장된 의료진', subtab_account:'계정',
    heading_costs:'방문 비용',
    label_notif:'알림', label_upcoming:'예정된 예약', label_tasks:'할 일',
    label_facts:'건강 흥미로운 사실', label_agenda:'오늘 할 일이 무엇인가요?',
    label_service:'서비스', label_provider:'의료기관', label_insurance:'보험',
    label_deductible:'남은 공제액', label_coverage:'보험 적용',
    label_copay:'본인 부담금', label_breakdown:'비용 내역', label_est_total:'예상 총액:',
    label_account:'계정 정보', label_your_appts:'예정된 예약',
    label_visit_type:'방문 유형', label_date:'날짜', label_time:'시간', label_notes:'메모',
    label_task_desc:'할 일 설명', label_due:'마감일', label_priority:'우선순위',
    label_prov_name:'의료기관 이름', label_specialty:'전문 분야', label_location:'위치',
    label_last_visit:'최근 방문',
    btn_calculate:'계산하기', btn_schedule:'예약하기', btn_reschedule:'일정 변경 / 취소',
    btn_recalculate:'← 다시 계산', btn_view_all:'전체 보기', btn_confirm:'예약 확인',
    btn_cancel:'취소', btn_close:'닫기', btn_add_task:'할 일 추가', btn_save:'저장하기',
    title_schedule:'예약 일정', title_your_appts:'내 예약',
    title_new_task:'새 할 일', title_add_provider:'의료기관 추가',
    key_name:'이름', key_dob:'생년월일', key_insurance:'보험', key_member:'회원 ID',
    key_pcp:'주치의', key_phone:'전화',
  },
};

function applyLang(lang) {
  state.currentLang = lang;
  save('cg_lang', lang);
  const dict = LANGS[lang] || LANGS.en;
  qsa('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) {
      // Handle line breaks in headings
      if (el.tagName === 'H1' || el.tagName === 'H2') {
        el.innerHTML = dict[key].replace(/\n/g, '<br>');
      } else {
        el.textContent = dict[key];
      }
    }
  });
  // Update active lang button
  qsa('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  // Update html lang attr
  document.documentElement.lang = lang;
}

// ══════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════
const QUICK_REPLIES = [
  'My next appointment?', 'What\'s my deductible?', 'Show me a health tip',
  'What can you do?', 'Translate the app', 'Fun health fact',
];

const AI_RESPONSES = [
  {
    match: /\b(hello|hi|hey|good\s*(morning|afternoon|evening))\b/i,
    reply: () => `Hi John! 👋 I'm your CareGlow AI assistant. I can help you with appointments, costs, health tips, tasks, and even translate the app. What would you like to know?`,
    chips: ['My next appointment?', 'Health tip', 'Translate the app'],
  },
  {
    match: /\b(what can you|help|features|do)\b/i,
    reply: () => `I can help you with:\n\n• 📅 Check upcoming appointments\n• 💰 Explain cost estimates & insurance\n• ✅ Review your tasks\n• 🌍 Translate the entire app\n• 🧠 Share health fun facts\n• 💊 Answer general health questions\n\nWhat would you like?`,
    chips: ['Translate the app', 'Health tip', 'My next appointment?'],
  },
  {
    match: /\b(appointment|next\s+appt|scheduled|visit)\b/i,
    reply: () => {
      const today = todayISO();
      const next = state.appointments.filter(a => a.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0];
      if (!next) return `You have no upcoming appointments. Head to the Calendar tab to schedule one! 📅`;
      return `Your next appointment is:\n\n📅 **${fmtDate(next.date)}**\n🕐 ${fmtTime(next.time)}\n🏥 ${next.type}\n👩‍⚕️ ${next.provider}${next.notes ? '\n📝 ' + next.notes : ''}\n\nWould you like to schedule another one?`;
    },
    chips: ['Schedule appointment', 'Reschedule / Cancel', 'Health tip'],
  },
  {
    match: /\b(task|todo|agenda|reminder|pending)\b/i,
    reply: () => {
      const pending = state.tasks.filter(t => !t.done);
      if (!pending.length) return `You have no pending tasks — nice work! 🎉 Want to add a new one?`;
      return `You have **${pending.length} pending task${pending.length>1?'s':''}**:\n\n${pending.slice(0,3).map(t => `• ${t.text}${t.due ? ' (due '+fmtDateShort(t.due)+')' : ''}`).join('\n')}${pending.length>3?'\n...and more':''}`;
    },
    chips: ['Go to Tasks', 'Health tip', 'My next appointment?'],
  },
  {
    match: /\b(deductible|oop|out.of.pocket|cost|price|pay|copay|insurance)\b/i,
    reply: () => `💰 **Understanding Your Costs:**\n\n**Deductible** — the amount you pay before insurance kicks in.\n\n**Copay** — a fixed fee per visit (e.g. $15) regardless of deductible.\n\n**Out-of-Pocket Max** — once you hit this limit, insurance covers 100%.\n\nUse the **Calculator tab** to estimate your next visit cost! Want me to explain anything else?`,
    chips: ['Go to Calculator', 'What\'s covered?', 'Health tip'],
  },
  {
    match: /\b(translate|language|spanish|french|chinese|vietnamese|korean|español|中文|français)\b/i,
    reply: () => `🌍 I can translate the entire CareGlow app for you! Tap the 🌐 button above, then pick your language:`,
    chips: [],
    action: () => { qs('#lang-picker').classList.remove('hidden'); },
  },
  {
    match: /\b(tip|advice|recommendation|wellness)\b/i,
    reply: () => {
      const tips = [
        '💧 Drink at least 8 glasses of water daily — even mild dehydration can affect concentration.',
        '🚶 A 30-minute daily walk reduces heart disease risk by up to 35%.',
        '😴 Consistent 7–9 hours of sleep lowers diabetes and obesity risk significantly.',
        '🧘 5 minutes of deep breathing can lower cortisol (stress hormone) by up to 20%.',
        '🥦 Eating colorful vegetables provides diverse antioxidants that fight inflammation.',
        '☀️ Daily SPF 30+ sunscreen reduces skin cancer risk — even on cloudy days.',
      ];
      return `Here's a tip for you:\n\n${tips[Math.floor(Math.random()*tips.length)]}`;
    },
    chips: ['Another tip', 'Fun health fact', 'My next appointment?'],
  },
  {
    match: /\b(fact|fun fact|did you know|interesting|weird|cool)\b/i,
    reply: () => {
      const f = FACTS[Math.floor(Math.random()*FACTS.length)];
      return `${f.emoji} **Fun Health Fact!**\n\n${f.text}\n\nWant another? 😄`;
    },
    chips: ['Another fact', 'Health tip', 'My next appointment?'],
  },
  {
    match: /\b(headache|pain|fever|cold|flu|sick|symptom|hurt)\b/i,
    reply: () => `I hear you're not feeling well. 💙\n\nFor symptoms, I always recommend:\n\n1️⃣ If severe — go to **Urgent Care or ER**\n2️⃣ If mild — schedule with your **PCP Dr. Allison Brown**\n3️⃣ Use the **Calculator** to estimate costs before going\n\n⚠️ *I'm not a doctor — always seek professional care for medical concerns.*`,
    chips: ['Schedule appointment', 'Go to Calculator', 'Health tip'],
  },
  {
    match: /\b(another|more|next|again|different)\b/i,
    reply: () => {
      const f = FACTS[Math.floor(Math.random()*FACTS.length)];
      return `${f.emoji} ${f.text}`;
    },
    chips: ['Another fact', 'Health tip', 'My next appointment?'],
  },
  {
    match: /.*/,
    reply: (msg) => {
      const keywords = ['appointment', 'cost', 'insurance', 'task', 'health', 'medicine', 'doctor'];
      const matched = keywords.find(k => msg.toLowerCase().includes(k));
      if (matched) return `I'd be happy to help with **${matched}** questions! Could you be more specific? For example, you can ask about upcoming appointments, costs, your tasks, or get a health tip.`;
      return `I'm not sure I understood that completely, but I'm here to help! 😊 You can ask me about:\n• Your appointments\n• Healthcare costs & insurance\n• Your tasks\n• Health tips & facts\n• App translation`;
    },
    chips: ['My next appointment?', 'Health tip', 'Translate the app'],
  },
];

function findResponse(msg) {
  return AI_RESPONSES.find(r => r.match.test(msg)) || AI_RESPONSES[AI_RESPONSES.length - 1];
}

const chatHistory = [];

function renderMessages() {
  const container = qs('#ai-messages');
  container.innerHTML = chatHistory.map(m => {
    const isUser = m.role === 'user';
    return `<div class="ai-msg ${isUser ? 'user' : 'bot'}">
      ${!isUser ? '<div class="ai-msg-avatar">✨</div>' : ''}
      <div class="ai-bubble">${m.text.replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function setChips(chips) {
  const el = qs('#ai-chips');
  el.innerHTML = chips.map(c => `<button class="ai-chip">${c}</button>`).join('');
  qsa('.ai-chip', el).forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.textContent));
  });
}

function showTyping() {
  const container = qs('#ai-messages');
  const typing = document.createElement('div');
  typing.className = 'ai-msg bot'; typing.id = 'typing-bubble';
  typing.innerHTML = `<div class="ai-msg-avatar">✨</div><div class="ai-bubble typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}
function hideTyping() { qs('#typing-bubble')?.remove(); }

function sendMessage(text) {
  if (!text.trim()) return;
  qs('#ai-input').value = '';
  chatHistory.push({ role:'user', text });
  renderMessages();
  setChips([]);
  showTyping();

  const resp = findResponse(text);
  const delay = 700 + Math.random() * 600;

  setTimeout(() => {
    hideTyping();
    const replyText = resp.reply(text);
    chatHistory.push({ role:'bot', text: replyText });
    renderMessages();
    setChips(resp.chips || []);
    if (resp.action) resp.action();
  }, delay);
}

function initAIChat() {
  // Opening greeting
  chatHistory.push({ role:'bot', text:"👋 Hi John! I'm your **CareGlow AI** assistant.\n\nI can help with appointments, costs, health facts, tasks, and translate the app to your language. What can I help you with?" });
  renderMessages();
  setChips(QUICK_REPLIES.slice(0,4));

  // Open chat
  qs('#ai-btn').addEventListener('click', () => openModal('ai-chat-modal'));

  // Send message
  qs('#ai-send-btn').addEventListener('click', () => sendMessage(qs('#ai-input').value));
  qs('#ai-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(qs('#ai-input').value); });

  // Translate toggle
  qs('#ai-translate-toggle').addEventListener('click', () => {
    qs('#lang-picker').classList.toggle('hidden');
  });

  // Language selection
  qsa('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLang(btn.dataset.lang);
      const langNames = { en:'English',es:'Spanish',fr:'French',zh:'Chinese',vi:'Vietnamese',ko:'Korean' };
      chatHistory.push({ role:'bot', text:`✅ App translated to **${langNames[btn.dataset.lang]}**! The interface has been updated. Let me know if you need anything else.` });
      renderMessages();
      qs('#lang-picker').classList.add('hidden');
      toast('Language updated to ' + langNames[btn.dataset.lang]);
    });
  });

  // Welcome-screen language button
  qs('#lang-btn').addEventListener('click', () => {
    qs('#welcome-screen').style.display = 'none';
    qs('#app').classList.remove('hidden');
    renderHome();
    renderCalendar();
    renderTasks();
    renderProviders();
    initSlideshow();
    applyLang(state.currentLang);
    setTimeout(() => openModal('ai-chat-modal'), 400);
  });
}

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
const TAB_MAP   = { home:'panel-home', calc:'panel-calc', tasks:'panel-tasks', calendar:'panel-calendar', profile:'panel-profile' };
const TITLE_KEY = { home:'nav_home', calc:'nav_calc', tasks:'nav_tasks', calendar:'nav_cal', profile:'nav_profile' };

function switchTab(tab) {
  qsa('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  qsa('.panel').forEach(p => p.classList.remove('active'));
  qs(`#${TAB_MAP[tab]}`).classList.add('active');
  const dict = LANGS[state.currentLang] || LANGS.en;
  qs('#top-bar-title').textContent = dict[TITLE_KEY[tab]] || tab;
  if (tab === 'calendar') renderCalendar();
  if (tab === 'home')     renderHome();
  if (tab === 'tasks')    renderTasks();
  if (tab === 'profile')  renderProviders();
  if (tab === 'calc')     { syncCalcDeductible(); syncCalcInsurance(); }
}

qsa('.nav-tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
qsa('[data-goto]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.goto)));

// ── Profile sub-tab switching ─────────────────
function switchSubTab(name) {
  qsa('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === name));
  qs('#sub-providers').classList.toggle('hidden', name !== 'providers');
  qs('#sub-account').classList.toggle('hidden', name !== 'account');
}
qsa('.sub-tab').forEach(btn => btn.addEventListener('click', () => switchSubTab(btn.dataset.subtab)));

// ══════════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════════
function hideScreen(id) {
  const el = qs(`#${id}`);
  el.style.transition = 'opacity 0.35s ease';
  el.style.opacity = '0';
  setTimeout(() => { el.classList.add('hidden'); el.style.opacity = ''; el.style.transition = ''; }, 350);
}
function showScreen(id) {
  const el = qs(`#${id}`);
  el.classList.remove('hidden');
  el.style.opacity = '0';
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.35s ease';
    el.style.opacity = '1';
    setTimeout(() => { el.style.transition = ''; }, 380);
  });
}
function launchApp() {
  qs('#app').classList.remove('hidden');
  renderHome(); renderCalendar(); renderTasks(); renderProviders(); initSlideshow(); initFacts(); applyLang(state.currentLang);
  // Sync deductible and insurance after DOM is painted
  setTimeout(() => { syncCalcDeductible(); syncCalcInsurance(); renderInsurance(); }, 50);
  startInactivityTimer();
}

// ══════════════════════════════════════════════
// CONSENT / NPP
// ══════════════════════════════════════════════
const CONSENT_KEY = 'cg_consent'; // { agreed: true, timestamp, email }

function hasConsented(email) {
  const c = load(CONSENT_KEY, null);
  return c && c.agreed && c.email === email;
}

// Called instead of launchApp() directly after auth — gates on consent
function launchOrConsent(email) {
  if (hasConsented(email)) {
    launchApp();
  } else {
    // Store email so consent handler knows who is agreeing
    qs('#consent-screen').dataset.pendingEmail = email;
    showScreen('consent-screen');
  }
}

// Enable agree button only when all 3 boxes checked
qsa('#consent-npp, #consent-phi, #consent-rights').forEach(cb => {
  cb.addEventListener('change', () => {
    const allChecked = qs('#consent-npp').checked && qs('#consent-phi').checked && qs('#consent-rights').checked;
    qs('#consent-agree-btn').disabled = !allChecked;
  });
});

qs('#consent-agree-btn').addEventListener('click', () => {
  const email = qs('#consent-screen').dataset.pendingEmail || '';
  save(CONSENT_KEY, { agreed: true, timestamp: new Date().toISOString(), email });
  hideScreen('consent-screen');
  // Small delay so the hide animation plays before app appears
  setTimeout(launchApp, 400);
});

// ══════════════════════════════════════════════
// SESSION TIMEOUT — two-stage: warning → lock
// ══════════════════════════════════════════════
const TIMEOUT_MS  = 15 * 60 * 1000; // 15 min total
const WARNING_MS  =  2 * 60 * 1000; // warn 2 min before lock
let warningTimer    = null;
let lockTimer       = null;
let countdownInterval = null;

function resetInactivityTimer() {
  clearTimeout(warningTimer);
  clearTimeout(lockTimer);
  // If warning is visible, hide it
  if (!qs('#timeout-warning').classList.contains('hidden')) {
    qs('#timeout-warning').classList.add('hidden');
    clearInterval(countdownInterval);
  }
  warningTimer = setTimeout(showTimeoutWarning, TIMEOUT_MS - WARNING_MS);
  lockTimer    = setTimeout(lockSession, TIMEOUT_MS);
}

function startInactivityTimer() {
  ['click','keydown','touchstart','mousemove','scroll'].forEach(evt =>
    document.addEventListener(evt, resetInactivityTimer, { passive: true })
  );
  resetInactivityTimer();
}

function stopInactivityTimer() {
  clearTimeout(warningTimer);
  clearTimeout(lockTimer);
  clearInterval(countdownInterval);
  ['click','keydown','touchstart','mousemove','scroll'].forEach(evt =>
    document.removeEventListener(evt, resetInactivityTimer)
  );
}

// ── Timeout warning ───────────────────────────
function showTimeoutWarning() {
  let secondsLeft = Math.round(WARNING_MS / 1000);
  function fmt(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  qs('#tw-countdown').textContent = fmt(secondsLeft);
  qs('#timeout-warning').classList.remove('hidden');
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    secondsLeft--;
    qs('#tw-countdown').textContent = fmt(Math.max(0, secondsLeft));
    if (secondsLeft <= 0) { clearInterval(countdownInterval); }
  }, 1000);
}

qs('#tw-stay-btn').addEventListener('click', () => {
  resetInactivityTimer();
  toast('Session extended ✓');
});
qs('#tw-lock-btn').addEventListener('click', () => {
  clearTimeout(warningTimer);
  clearTimeout(lockTimer);
  clearInterval(countdownInterval);
  qs('#timeout-warning').classList.add('hidden');
  lockSession();
});

// ── Lock session ──────────────────────────────
function lockSession() {
  clearInterval(countdownInterval);
  qs('#timeout-warning').classList.add('hidden');
  const session = getSession();
  const email = session?.email && session.email !== 'google-user' ? session.email : '';
  qs('#lock-user-email').textContent = email || 'Your session';
  qs('#lock-password').value = '';
  resetPinEntry();
  switchLockTab('password');
  qs('#lock-screen').classList.remove('hidden');
  qs('#lock-password').focus();
}

function unlockSession() {
  qs('#lock-screen').classList.add('hidden');
  resetInactivityTimer();
  toast('Session unlocked ✓');
}

// ── Lock screen tabs ──────────────────────────
function switchLockTab(name) {
  qsa('.lock-tab').forEach(t => t.classList.toggle('active', t.dataset.lockTab === name));
  qsa('.lock-panel').forEach(p => p.classList.toggle('hidden', p.id !== `lock-panel-${name}`));
}
qsa('.lock-tab').forEach(btn => btn.addEventListener('click', () => {
  switchLockTab(btn.dataset.lockTab);
  if (btn.dataset.lockTab === 'password') qs('#lock-password').focus();
}));

// ── Unlock: Password ──────────────────────────
qs('#lock-pw-toggle').addEventListener('click', () => {
  const inp = qs('#lock-password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});
qs('#lock-unlock-btn').addEventListener('click', () => {
  const pw = qs('#lock-password').value;
  if (!pw) { toast('Enter your password to unlock', '⚠'); return; }
  const session = getSession();
  const user = session?.email ? getAccounts()[session.email] : null;
  if (user && user.pw !== pw) { toast('Incorrect password', '⚠'); return; }
  unlockSession();
});
qs('#lock-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') qs('#lock-unlock-btn').click();
});

// ── Unlock: PIN ───────────────────────────────
const PIN_KEY = 'cg_pin';
let pinEntry  = '';

function clearPinVisuals() {
  qsa('.pin-dot', qs('#lock-pin-dots')).forEach(d => d.classList.remove('filled', 'error'));
  const hint = qs('#lock-pin-hint');
  hint.textContent = load(PIN_KEY, null) ? 'Enter your 4-digit PIN' : 'No PIN set — go to Profile → Security to set one up';
  hint.classList.remove('error');
}

function resetPinEntry(errored = false) {
  pinEntry = '';
  if (errored) {
    // Keep error visuals visible for 600ms, then clear
    setTimeout(clearPinVisuals, 600);
  } else {
    clearPinVisuals();
  }
}

function updatePinDots() {
  qsa('.pin-dot', qs('#lock-pin-dots')).forEach((d, i) => {
    d.classList.toggle('filled', i < pinEntry.length);
  });
}

qsa('.pin-key').forEach(btn => btn.addEventListener('click', () => {
  const k = btn.dataset.k;
  const storedPin = load(PIN_KEY, null);
  if (!storedPin) { toast('Set up a PIN in Profile → Security first', '⚠'); return; }
  if (k === 'del') {
    pinEntry = pinEntry.slice(0, -1);
    updatePinDots();
    return;
  }
  if (pinEntry.length >= 4) return;
  pinEntry += k;
  updatePinDots();
  if (pinEntry.length === 4) {
    if (pinEntry === storedPin) {
      unlockSession();
      resetPinEntry();
    } else {
      qsa('.pin-dot', qs('#lock-pin-dots')).forEach(d => d.classList.add('error'));
      qs('#lock-pin-hint').textContent = 'Incorrect PIN';
      qs('#lock-pin-hint').classList.add('error');
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      resetPinEntry(true);
    }
  }
}));

// ── Unlock: Biometrics (WebAuthn) ─────────────
qs('#lock-biometric-btn').addEventListener('click', async () => {
  const hint = qs('#biometric-hint');
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
  if (!available) {
    hint.textContent = 'Biometrics not available on this device or browser.';
    return;
  }
  try {
    hint.textContent = 'Waiting for biometric prompt…';
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: { challenge, rpId: location.hostname || 'localhost', allowCredentials: [], userVerification: 'required', timeout: 30000 }
    });
    unlockSession();
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      hint.textContent = 'Biometric authentication was cancelled or failed.';
    } else if (err.name === 'InvalidStateError' || err.name === 'NotSupportedError') {
      hint.textContent = 'No registered biometric credentials. Use password or PIN to unlock.';
    } else {
      hint.textContent = 'Biometric authentication is not set up on this device yet.';
    }
  }
});

// ── PIN Setup (Profile → Security) ───────────
function renderPinStatus() {
  const el = qs('#pin-status-label');
  if (el) el.textContent = load(PIN_KEY, null) ? 'Enabled ✓' : 'Not set';
}
qs('#open-pin-setup-btn').addEventListener('click', () => {
  qs('#pin-new').value = '';
  qs('#pin-confirm').value = '';
  openModal('pin-setup-modal');
});
qs('#save-pin-btn').addEventListener('click', () => {
  const p1 = qs('#pin-new').value.trim();
  const p2 = qs('#pin-confirm').value.trim();
  if (!/^\d{4}$/.test(p1)) { toast('PIN must be exactly 4 digits', '⚠'); return; }
  if (p1 !== p2) { toast('PINs do not match', '⚠'); return; }
  save(PIN_KEY, p1);
  closeModal('pin-setup-modal');
  renderPinStatus();
  toast('PIN saved ✓');
});

// ── Sign Out from lock screen ─────────────────
qs('#lock-signout-btn').addEventListener('click', () => {
  stopInactivityTimer();
  localStorage.removeItem(SESSION_KEY);
  qs('#lock-screen').classList.add('hidden');
  qs('#app').classList.add('hidden');
  switchTab('home');
  switchSubTab('providers');
  showScreen('welcome-screen');
  toast("You've been signed out 👋");
});

// ── Password strength ─────────────────────────
function checkStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['','Weak','Fair','Good','Strong'];
  const colors = ['','#ef4444','#f97316','#eab308','#22c55e'];
  return { score, label: labels[score] || '', color: colors[score] || '' };
}
qs('#signup-password')?.addEventListener('input', function() {
  const { score, label, color } = checkStrength(this.value);
  qs('#pw-strength-fill').style.width = `${score * 25}%`;
  qs('#pw-strength-fill').style.background = color;
  qs('#pw-strength-label').textContent = label;
  qs('#pw-strength-label').style.color = color;
});

// ── Password visibility toggles ───────────────
[['#login-pw-toggle','#login-password'],['#signup-pw-toggle','#signup-password']].forEach(([btnId, inputId]) => {
  qs(btnId)?.addEventListener('click', () => {
    const inp = qs(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
});

// ══════════════════════════════════════════════
// WELCOME SCREEN
// ══════════════════════════════════════════════
qs('#get-started-btn').addEventListener('click', () => {
  // Pre-fill email if there's a known account (even without a live session)
  const accounts = getAccounts();
  const emails = Object.keys(accounts);
  if (emails.length === 1) {
    const inp = qs('#login-email');
    if (inp && !inp.value) inp.value = emails[0];
  }
  hideScreen('welcome-screen');
  showScreen('login-screen');
});

// ── Navigate between auth screens ─────────────
qs('#go-signup-btn').addEventListener('click', () => { hideScreen('login-screen'); showScreen('signup-screen'); });
qs('#go-login-btn').addEventListener('click',  () => {
  hideScreen('signup-screen');
  // Reset login to step 1 when coming back
  qs('#login-step1').classList.remove('hidden');
  qs('#login-step2').classList.add('hidden');
  showScreen('login-screen');
});

// ── Step 1: Continue with Email ───────────────
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

qs('#continue-email-btn').addEventListener('click', () => {
  const email = qs('#login-email').value.trim();
  if (!email || !isValidEmail(email)) { toast('Please enter a valid email address', '⚠'); return; }
  // Advance to step 2
  qs('#login-email-chip').textContent = email;
  qs('#login-step1').classList.add('hidden');
  qs('#login-step2').classList.remove('hidden');
  qs('#login-password').focus();
});

// ── Step 2: Back to step 1 ────────────────────
qs('#login-back-btn').addEventListener('click', () => {
  qs('#login-step2').classList.add('hidden');
  qs('#login-step1').classList.remove('hidden');
  qs('#login-password').value = '';
});

// ── Forgot password ───────────────────────────
qs('#forgot-pw-btn').addEventListener('click', () => {
  const email = qs('#login-email').value.trim() || 'your email';
  toast(`Reset link sent to ${email} 📧`);
});

// ── Google (demo) ─────────────────────────────
qs('#google-login-btn').addEventListener('click', () => {
  save(SESSION_KEY, { email: 'google-user' });
  hideScreen('login-screen');
  launchOrConsent('google-user');
  toast('Signed in with Google ✓');
});

// ── Login (step 2 sign in) ────────────────────
qs('#login-btn').addEventListener('click', () => {
  const email    = qs('#login-email').value.trim();
  const pw       = qs('#login-password').value;
  const remember = qs('#login-remember').checked;
  if (!pw) { toast('Please enter your password', '⚠'); return; }
  const accounts = getAccounts();
  const user = accounts[email];
  if (user && user.pw !== pw) { toast('Incorrect password', '⚠'); return; }
  // If account exists, validate; if not found, allow demo login
  if (remember) {
    save(SESSION_KEY, { email });
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  hideScreen('login-screen');
  launchOrConsent(email);
  const name = user?.fname ? `${user.fname}` : '';
  toast(name ? `Welcome back, ${name}! 👋` : 'Welcome back! 👋');
});

// ── Sign Up ───────────────────────────────────
qs('#signup-btn').addEventListener('click', () => {
  const fname   = qs('#signup-fname').value.trim();
  const lname   = qs('#signup-lname').value.trim();
  const email   = qs('#signup-email').value.trim();
  const pw      = qs('#signup-password').value;
  const confirm = qs('#signup-confirm').value;
  const terms   = qs('#signup-terms').checked;
  if (!fname || !lname) { toast('Please enter your name', '⚠'); return; }
  if (!email)           { toast('Please enter your email', '⚠'); return; }
  if (!isValidEmail(email)) { toast('Please enter a valid email address', '⚠'); return; }
  if (pw.length < 8)   { toast('Password must be at least 8 characters', '⚠'); return; }
  if (pw !== confirm)  { toast('Passwords do not match', '⚠'); return; }
  if (!terms)          { toast('Please agree to the Terms of Service', '⚠'); return; }
  // Save account credentials
  const accounts = getAccounts();
  if (accounts[email]) { toast('An account with this email already exists', '⚠'); return; }
  accounts[email] = { pw, fname, lname, dob: qs('#signup-dob').value, insurance: qs('#signup-insurance').value };
  save(ACCOUNTS_KEY, accounts);
  // Auto-remember new accounts
  save(SESSION_KEY, { email });
  hideScreen('signup-screen');
  launchOrConsent(email);
  toast(`Welcome to CareGlow, ${fname}! 🎉`);
});

// ══════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════
function toast(msg, icon='✓') {
  const wrap = qs('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function toastUndo(msg, onUndo, delay=5000) {
  const wrap = qs('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">🗑</span><span class="toast-msg">${msg}</span><button class="toast-undo-btn">Undo</button>`;
  wrap.appendChild(el);
  let undid = false;
  const timer = setTimeout(() => { el.remove(); }, delay);
  el.querySelector('.toast-undo-btn').addEventListener('click', () => {
    undid = true;
    clearTimeout(timer);
    el.remove();
    onUndo();
  });
  return { cancel: () => { if (!undid) clearTimeout(timer); el.remove(); } };
}

// ══════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════
function openModal(id) { qs(`#${id}`).classList.add('open'); }
function closeModal(id) { qs(`#${id}`).classList.remove('open'); }

document.addEventListener('click', e => {
  const close = e.target.closest('.modal-close');
  if (close) closeModal(close.dataset.modal);
  const overlay = e.target.closest('.modal-overlay');
  if (overlay && e.target === overlay) overlay.classList.remove('open');
});

// ══════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════
function renderHome() {
  const today = todayISO();
  const soon  = state.appointments.filter(a => a.date >= today).sort((a,b) => a.date.localeCompare(b.date));

  // Notifications (appointments + overdue + reminder tasks)
  const reminderTasks = state.tasks.filter(t => !t.done && t.reminder);
  const notifItems = [];
  if (soon.length) notifItems.push({ text:`Your next appointment is on ${fmtDateShort(soon[0].date)} at ${fmtTime(soon[0].time)}.`, reminder:false });
  const overdue = state.tasks.filter(t => !t.done && t.due && t.due < today);
  if (overdue.length) notifItems.push({ text:`You have ${overdue.length} overdue task${overdue.length>1?'s':''} — check your tasks!`, reminder:false });
  notifItems.push({ text:'You are due for your annual check-up. It\'s fully covered by insurance.', reminder:false });
  reminderTasks.forEach(t => notifItems.push({ text:`${t.text}${t.due ? ` · due ${fmtDateShort(t.due)}` : ''}`, reminder:true }));
  qs('#home-notifs').innerHTML = notifItems.map(n => `<div class="notif-item"><div class="notif-dot${n.reminder?' reminder':''}"></div><span>${n.text}</span></div>`).join('');

  // Upcoming appointments
  qs('#home-appts').innerHTML = !soon.length
    ? '<p class="empty-msg">No upcoming appointments</p>'
    : soon.slice(0,3).map(a => {
        const uc = apptUrgencyClass(a, today);
        return `<div class="home-appt-item${uc?' '+uc:''}"><div class="home-appt-time">${fmtDateShort(a.date)} · ${fmtTime(a.time)}</div><div class="home-appt-detail">${a.type}</div><div class="home-appt-time">${a.provider}</div></div>`;
      }).join('');

  // Combined tasks — high priority first, then oldest-due remaining
  const byDue = (a,b) => { if (a.due && b.due) return a.due.localeCompare(b.due); if (a.due) return -1; if (b.due) return 1; return 0; };
  const highPri = state.tasks.filter(t => !t.done && t.priority === 'high').sort(byDue);
  const highPriIds = new Set(highPri.map(t => t.id));
  const others  = state.tasks.filter(t => !t.done && !highPriIds.has(t.id)).sort(byDue);
  const combined = [...highPri, ...others].slice(0, 5);

  function taskRow(t) {
    const od = t.due && t.due < today;
    const isHigh = t.priority === 'high';
    const uc = urgencyClass(t, today);
    return `<div class="home-task-item${uc?' '+uc:''}">
      <div class="home-task-dot${isHigh?' high':''}"></div>
      <div style="flex:1;min-width:0">
        <div class="home-task-item-text">${t.text}</div>
        ${isHigh ? `<span class="task-priority high" style="font-size:0.7rem;padding:2px 7px;margin-top:3px;display:inline-block">high</span>` : ''}
        ${t.due ? `<div class="home-task-due${od?' overdue':''}" style="${isHigh?'':'margin-top:2px'}">${od?'⚠ ':''}${fmtDateShort(t.due)}</div>` : ''}
        ${t.attachments?.length ? `<span class="attach-badge" style="margin-top:4px;display:inline-flex">📎 ${t.attachments.length} file${t.attachments.length>1?'s':''}</span>` : ''}
      </div>
    </div>`;
  }

  qs('#home-tasks-list').innerHTML = !combined.length
    ? '<p class="empty-msg">All tasks complete 🎉</p>'
    : combined.map(taskRow).join('');
}

// ══════════════════════════════════════════════
// SLIDESHOW
// ══════════════════════════════════════════════
function initSlideshow() {
  const slides = qsa('.slide');
  const dotsEl = qs('#slide-dots');
  const counter = qs('#slide-counter');
  dotsEl.innerHTML = slides.map((_,i) => `<div class="slide-dot${i===0?' active':''}" data-i="${i}"></div>`).join('');
  const dots = qsa('.slide-dot', dotsEl);

  function goTo(idx) {
    slides[state.slideIdx].classList.remove('active');
    dots[state.slideIdx].classList.remove('active');
    state.slideIdx = (idx + slides.length) % slides.length;
    slides[state.slideIdx].classList.add('active');
    dots[state.slideIdx].classList.add('active');
    counter.textContent = `${state.slideIdx+1} / ${slides.length}`;
  }

  qs('#slide-prev').addEventListener('click', () => goTo(state.slideIdx - 1));
  qs('#slide-next').addEventListener('click', () => goTo(state.slideIdx + 1));
  dots.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.i))));
  setInterval(() => goTo(state.slideIdx + 1), 6000);
}

// ══════════════════════════════════════════════
// CALCULATOR
// ══════════════════════════════════════════════

// Coverage rate + copay derived from the patient's plan type
function insRates(planType) {
  const map = {
    'HMO':          { coverage: 0.80, copay: 15 },
    'PPO':          { coverage: 0.70, copay: 30 },
    'EPO':          { coverage: 0.75, copay: 25 },
    'HDHP':         { coverage: 0.80, copay: 0  },
    'POS':          { coverage: 0.70, copay: 20 },
    'Medicare':     { coverage: 0.80, copay: 0  },
    'Medicaid':     { coverage: 0.90, copay: 0  },
    'No Insurance': { coverage: 0,    copay: 0  },
  };
  return map[planType] || { coverage: 0.70, copay: 20 };
}

function syncCalcInsurance() {
  const ins = getInsurance();
  const nameEl = qs('#calc-ins-name');
  const metaEl = qs('#calc-ins-meta');
  if (nameEl) nameEl.textContent = ins.healthPlan || 'No plan on file';
  if (metaEl) metaEl.textContent = ins.planType   || '';
}

// Auto-fill copay when plan type changes in the modal
qs('#ins-inp-plan-type').addEventListener('change', () => {
  qs('#ins-inp-copay').value = insRates(qs('#ins-inp-plan-type').value).copay;
});

qs('#calc-ins-edit-btn').addEventListener('click', () => {
  switchTab('profile');
  switchSubTab('account');
  setTimeout(() => qs('#open-ins-modal')?.click(), 200);
});

qs('#calc-service').addEventListener('change', () => {
  const isPreventive = qs('#calc-service').value.startsWith('preventive');
  qs('#calc-annual-hint').classList.toggle('hidden', !isPreventive);
});

qs('#calc-btn').addEventListener('click', () => {
  const [serviceKey, baseCost] = qs('#calc-service').value.split('|');
  const serviceLabel = qs('#calc-service').options[qs('#calc-service').selectedIndex].text;
  const profileIns = getInsurance();
  const coverage   = insRates(profileIns.planType).coverage;
  const copay      = profileIns.copay;
  const deductible = Number(qs('#calc-deductible').value) || 0;
  const billed   = Number(baseCost);

  const isPreventive = serviceKey === 'preventive';
  const hasInsurance = coverage > 0;

  let oop, coverageMsg, deductibleMsg, copayDisplay;

  if (isPreventive && hasInsurance) {
    // ACA mandate: preventive/annual exams covered 100% — no deductible or copay
    oop = 0;
    deductibleMsg = 'Exempt — preventive care ✓';
    coverageMsg   = 'Covered 100% by your plan ✓';
    copayDisplay  = '$0.00';
  } else if (coverage === 0) {
    oop = billed; deductibleMsg = 'N/A — no insurance'; coverageMsg = 'Not covered';
    copayDisplay = `$${copay.toFixed(2)}`;
  } else if (deductible > 0) {
    oop = billed + copay;
    deductibleMsg = `Patient still owes $${deductible.toLocaleString()} toward deductible`;
    coverageMsg = "Insurance doesn't pay until deductible is met: $0";
    copayDisplay = `$${copay.toFixed(2)}`;
  } else {
    const ins = billed * coverage;
    oop = billed - ins + copay;
    deductibleMsg = 'Deductible met ✓';
    coverageMsg = `-$${Math.round(ins).toLocaleString()} covered`;
    copayDisplay = `$${copay.toFixed(2)}`;
  }

  qs('#res-service-label').textContent  = serviceLabel;
  qs('#res-billed').textContent         = `$${billed.toLocaleString()}`;
  qs('#res-deductible-msg').textContent = deductibleMsg;
  qs('#res-coverage-msg').textContent   = coverageMsg;
  qs('#res-copay').textContent          = copayDisplay;
  qs('#res-total').textContent          = `$${Math.round(oop).toLocaleString()}`;
  qs('#res-total').style.color          = (isPreventive && hasInsurance) ? '#22c55e' : '';

  qs('#res-preventive-note').classList.toggle('hidden', !(isPreventive && hasInsurance));

  qs('#calc-form-view').classList.add('hidden');
  qs('#calc-results-view').classList.remove('hidden');
});
qs('#calc-back-btn').addEventListener('click', () => {
  qs('#calc-form-view').classList.remove('hidden');
  qs('#calc-results-view').classList.add('hidden');
});
qs('#calc-schedule-btn').addEventListener('click', () => switchTab('calendar'));

// ══════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════
function renderTasks(filter='') {
  const list  = qs('#task-list');
  const today = todayISO();
  let tasks = state.tasks;
  if (filter) tasks = tasks.filter(t => t.text.toLowerCase().includes(filter.toLowerCase()));
  if (activeNameFilter) tasks = tasks.filter(t => t.assignedTo === activeNameFilter);

  if (!tasks.length) { list.innerHTML = '<p class="empty-msg">No tasks — tap + to add one</p>'; return; }

  list.innerHTML = tasks.map(t => {
    const overdue = t.due && t.due < today && !t.done;
    const uc = t.done ? '' : urgencyClass(t, today);
    return `<div class="task-item${uc?' '+uc:''}" data-id="${t.id}">
      <div class="task-top">
        <div class="task-checkbox${t.done?' checked':''}" data-check="${t.id}"></div>
        <span class="task-text${t.done?' done':''}">${t.text}</span>
        <button class="task-delete" data-del="${t.id}">✕</button>
      </div>
      <div class="task-meta">
        <span class="task-priority ${t.priority}">${t.priority}</span>
        ${t.due?`<span class="task-due${overdue?' overdue':''}">${overdue?'⚠ ':''}${fmtDateShort(t.due)}</span>`:''}
        ${t.assignedTo ? `<span class="task-assignee-badge">👤 ${t.assignedTo}</span>` : ''}
        ${t.attachments?.length ? `<span class="attach-badge" data-view-task="${t.id}">📎 ${t.attachments.length} file${t.attachments.length>1?'s':''}</span>` : ''}
      </div>
      <div class="task-actions">
        <button class="task-action-link" data-add-cal="${t.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Add to Calendar
        </button>
        <button class="task-action-link${t.reminder?' reminder-active':''}" data-reminder="${t.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${t.reminder?'currentColor':'none'}"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          ${t.reminder ? 'Reminder On' : 'Set Reminder'}
        </button>
      </div>
    </div>`;
  }).join('');

  qsa('[data-check]',list).forEach(el => el.addEventListener('click', () => {
    const t = state.tasks.find(t => t.id === el.dataset.check);
    if (!t) return;
    const wasUndone = !t.done;
    t.done = !t.done;
    save('cg_tasks', state.tasks);
    renderTasks(qs('#task-search-input').value);
    renderHome();
    if (wasUndone) {
      onTaskComplete();
      toastUndo('Task marked complete', () => {
        t.done = false;
        save('cg_tasks', state.tasks);
        renderTasks(qs('#task-search-input').value);
        renderHome();
      });
    }
  }));
  qsa('[data-del]',list).forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.del;
    const idx = state.tasks.findIndex(t => t.id === id);
    const removed = state.tasks[idx];
    state.tasks.splice(idx, 1);
    renderTasks(qs('#task-search-input').value);
    renderHome();
    toastUndo(`Task removed`, () => {
      state.tasks.splice(idx, 0, removed);
      save('cg_tasks', state.tasks);
      renderTasks(qs('#task-search-input').value);
      renderHome();
      toast('Task restored ✓');
    });
    setTimeout(() => save('cg_tasks', state.tasks), 5100);
  }));
  qsa('[data-add-cal]',list).forEach(el => el.addEventListener('click', () => {
    const t = state.tasks.find(t => t.id === el.dataset.addCal);
    if (t?.due) { state.appointments.push({id:uid(),provider:'Self',type:'Task reminder',date:t.due,time:'09:00',notes:t.text}); save('cg_appts',state.appointments); toast('Added to calendar 📅'); }
    else toast('Set a due date first','⚠');
  }));
  qsa('[data-reminder]',list).forEach(el => el.addEventListener('click', () => {
    const t = state.tasks.find(t => t.id === el.dataset.reminder);
    if (!t) return;
    t.reminder = !t.reminder;
    save('cg_tasks', state.tasks);
    if (t.reminder) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      toast('Reminder set 🔔');
    } else {
      toast('Reminder removed');
    }
    renderTasks(qs('#task-search-input').value);
    renderHome();
  }));
  qsa('[data-view-task]',list).forEach(btn => btn.addEventListener('click', () => {
    const t = state.tasks.find(t => t.id === btn.dataset.viewTask);
    if (t?.attachments?.length) openAttachmentViewer(t.attachments, t.text.slice(0,40));
  }));
  renderNameFilterChips();
}

qs('#open-task-modal').addEventListener('click', () => {
  qs('#task-date').value = offsetISO(1);
  taskPendingFiles = [];
  renderTaskAttachmentPreview();
  populateAssigneeDropdown();
  openModal('task-modal');
});
qs('#save-task-btn').addEventListener('click', () => {
  const text = qs('#task-text').value.trim();
  if (!text) { toast('Please enter a task description','⚠'); return; }
  const assignedTo = qs('#task-assignee').value || null;
  state.tasks.unshift({ id:uid(), text, done:false, priority:qs('#task-priority').value, due:qs('#task-date').value, assignedTo, attachments:[...taskPendingFiles] });
  save('cg_tasks',state.tasks);
  closeModal('task-modal');
  qs('#task-text').value = '';
  qs('#task-assignee').value = '';
  taskPendingFiles = [];
  renderTaskAttachmentPreview();
  renderTasks(); renderHome(); toast('Task added ✓');
});

// ── Name assignment helpers ─────────────────────────────────────────────────
function populateAssigneeDropdown(currentVal = '') {
  const sel = qs('#task-assignee');
  sel.innerHTML = '<option value="">Unassigned</option>';
  state.savedNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
  const editOpt = document.createElement('option');
  editOpt.value = '__edit__'; editOpt.textContent = '✏ Edit names…';
  sel.appendChild(editOpt);
  sel.value = currentVal;
}

qs('#task-assignee').addEventListener('change', e => {
  if (e.target.value === '__edit__') {
    e.target.value = '';
    closeModal('task-modal');
    openNamesModal();
  }
});

function openNamesModal() {
  renderNamesList();
  qs('#name-input').value = '';
  openModal('names-modal');
}

function renderNamesList() {
  const list = qs('#names-list');
  if (!state.savedNames.length) {
    list.innerHTML = '<p class="empty-msg" style="padding:8px 0 4px">No saved names yet</p>';
    return;
  }
  list.innerHTML = state.savedNames.map((name, i) => `
    <div class="names-list-item" data-idx="${i}">
      <span class="names-list-name" id="nl-name-${i}">${name}</span>
      <div class="names-list-btns">
        <button class="task-action-link" data-edit-name="${i}">Edit</button>
        <button class="task-action-link" data-del-name="${i}" style="color:#ff453a">Delete</button>
      </div>
    </div>`).join('');

  qsa('[data-edit-name]', list).forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.editName;
      const item = btn.closest('.names-list-item');
      const span = item.querySelector('.names-list-name');
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'field-input names-edit-input'; inp.value = state.savedNames[i];
      span.replaceWith(inp); inp.focus();
      btn.textContent = 'Cancel';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'task-action-link'; saveBtn.textContent = 'Save';
      btn.after(saveBtn);
      saveBtn.addEventListener('click', () => {
        const val = inp.value.trim();
        if (!val) { toast('Name cannot be empty', '⚠'); return; }
        state.savedNames[i] = val;
        save('cg_saved_names', state.savedNames);
        renderNamesList(); toast('Name updated ✓');
      });
      btn.addEventListener('click', () => renderNamesList(), { once: true });
    });
  });

  qsa('[data-del-name]', list).forEach(btn => {
    btn.addEventListener('click', () => {
      state.savedNames.splice(+btn.dataset.delName, 1);
      save('cg_saved_names', state.savedNames);
      renderNamesList(); toast('Name removed');
    });
  });
}

qs('#add-name-btn').addEventListener('click', () => {
  const val = qs('#name-input').value.trim();
  if (!val) { toast('Enter a name first', '⚠'); return; }
  if (state.savedNames.includes(val)) { toast('Name already exists', '⚠'); return; }
  state.savedNames.push(val);
  save('cg_saved_names', state.savedNames);
  qs('#name-input').value = '';
  renderNamesList(); toast('Name added ✓');
});
qs('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') qs('#add-name-btn').click(); });

// ── Name filter chips ───────────────────────────────────────────────────────
function renderNameFilterChips() {
  const wrap = qs('#name-filter-chips');
  if (!wrap) return;
  const names = [...new Set(state.tasks.filter(t => t.assignedTo).map(t => t.assignedTo))];
  if (!names.length) { wrap.innerHTML = ''; wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  wrap.innerHTML = [
    `<button class="name-chip${activeNameFilter === '' ? ' active' : ''}" data-name-filter="">All</button>`,
    ...names.map(n => `<button class="name-chip${activeNameFilter === n ? ' active' : ''}" data-name-filter="${n}">👤 ${n}</button>`)
  ].join('');
  qsa('[data-name-filter]', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      activeNameFilter = btn.dataset.nameFilter;
      renderTasks(qs('#task-search-input').value);
    });
  });
}

// ── Streak & micro-feedback ─────────────────────────────────────────────────
const STREAK_TIERS = [
  { min: 30, emoji: '👑', label: msg => `${msg}  ·  30-day streak!` },
  { min: 14, emoji: '🌈', label: msg => `${msg}  ·  14-day streak!` },
  { min: 7,  emoji: '🏆', label: msg => `${msg}  ·  Week streak!`   },
  { min: 3,  emoji: '🔥', label: msg => `${msg}  ·  ${state.streak.count}-day streak!` },
];
const COMPLETE_MSGS = [
  'Great work! 💪', 'You nailed it! ⚡', 'Keep going! 🌟',
  'Task crushed! ✨', 'On a roll! 🚀', 'Nice one! 🎯',
  'Health goals unlocked! 💚', 'You\'re doing amazing! 🌸',
];

function onTaskComplete() {
  const today = todayISO();
  const s = state.streak;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0,10);
  if (s.lastDate === today) {
    // already got streak credit today — just show encouragement
  } else if (s.lastDate === yesterday) {
    s.count++;
    s.lastDate = today;
  } else {
    s.count = 1;
    s.lastDate = today;
  }
  save('cg_streak', s);
  showCompletionFeedback();
}

function showCompletionFeedback() {
  const s = state.streak;
  const msg = COMPLETE_MSGS[Math.floor(Math.random() * COMPLETE_MSGS.length)];
  const tier = [...STREAK_TIERS].find(t => s.count >= t.min);
  if (tier) {
    showStreakBurst(tier.emoji, `${s.count}-day streak!`, msg);
  } else {
    toast(msg);
  }
}

function showStreakBurst(emoji, countLabel, msg) {
  const burst = qs('#streak-burst');
  if (!burst) return;
  qs('#streak-fire-emoji').textContent = emoji;
  qs('#streak-count-val').textContent  = countLabel;
  qs('#streak-msg-val').textContent    = msg;
  burst.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 120]);
  setTimeout(() => {
    burst.classList.add('burst-fade');
    setTimeout(() => { burst.classList.add('hidden'); burst.classList.remove('burst-fade'); }, 400);
  }, 2200);
}

qs('#task-search-toggle').addEventListener('click', () => { qs('#task-search-bar').classList.toggle('hidden'); if (!qs('#task-search-bar').classList.contains('hidden')) qs('#task-search-input').focus(); });
qs('#task-search-input').addEventListener('input', e => renderTasks(e.target.value));
let sortAsc = true;
let activeNameFilter = '';
qs('#task-sort-btn').addEventListener('click', () => {
  sortAsc = !sortAsc;
  state.tasks.sort((a,b) => sortAsc ? (a.due||'z').localeCompare(b.due||'z') : (b.due||'').localeCompare(a.due||''));
  save('cg_tasks',state.tasks); renderTasks(); toast(`Sorted ${sortAsc?'↑':'↓'}`);
});

// ══════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════
function renderCalendar() { renderMiniCal(); renderCalUpcoming(); }

function renderMiniCal() {
  const {calYear:y,calMonth:m} = state;
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const firstDay = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrev  = new Date(y,m,0).getDate();
  const today = todayISO();
  const apptDates = new Set(state.appointments.map(a => a.date));
  const total = Math.ceil((firstDay+daysInMonth)/7)*7;
  const WD = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let html = `<div style="grid-column:span 7">
    <div class="cal-mini-nav">
      <button class="cal-mini-arrow" id="cal-prev">&#8249;</button>
      <span class="cal-mini-month">${MONTHS[m]} ${y}</span>
      <button class="cal-mini-arrow" id="cal-next">&#8250;</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px">${WD.map(d=>`<div class="cal-weekday">${d}</div>`).join('')}</div>
  </div>`;

  for (let i = 0; i < total; i++) {
    let num, dateStr, other = false;
    if (i < firstDay) { num = daysInPrev-firstDay+i+1; const pm=m===0?12:m,py=m===0?y-1:y; dateStr=`${py}-${String(pm).padStart(2,'0')}-${String(num).padStart(2,'0')}`; other=true; }
    else if (i >= firstDay+daysInMonth) { num=i-firstDay-daysInMonth+1; const nm=m===11?1:m+2,ny=m===11?y+1:y; dateStr=`${ny}-${String(nm).padStart(2,'0')}-${String(num).padStart(2,'0')}`; other=true; }
    else { num=i-firstDay+1; dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(num).padStart(2,'0')}`; }
    const cls = ['cal-day', other?'other-m':'', dateStr===today?'today':'', dateStr===state.selectedDay?'selected':'', apptDates.has(dateStr)?'has-appt':''].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-date="${dateStr}">${num}</div>`;
  }

  const grid = qs('#cal-mini-grid');
  grid.innerHTML = html;
  qs('#cal-prev',grid).addEventListener('click', () => { state.calMonth--; if(state.calMonth<0){state.calMonth=11;state.calYear--;} renderMiniCal(); });
  qs('#cal-next',grid).addEventListener('click', () => { state.calMonth++; if(state.calMonth>11){state.calMonth=0;state.calYear++;} renderMiniCal(); });
  qsa('.cal-day[data-date]',grid).forEach(cell => cell.addEventListener('click', () => { state.selectedDay=cell.dataset.date; renderMiniCal(); renderDayDetail(cell.dataset.date); }));
}

function renderDayDetail(date) {
  const appts = state.appointments.filter(a=>a.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  qs('#cal-day-title').textContent = fmtDate(date);
  const el = qs('#cal-day-appts');
  qs('#cal-day-section').classList.remove('hidden');
  el.innerHTML = !appts.length ? '<p class="empty-msg">No appointments this day</p>'
    : appts.map(a=>`<div class="cal-appt-item"><span class="cal-appt-time">${fmtTime(a.time)}</span><div class="cal-appt-body"><span class="cal-appt-info">${a.type}</span><span class="cal-appt-provider">${a.provider}${a.notes?' · '+a.notes:''}</span>${a.attachments&&a.attachments.length?`<span class="attach-badge" data-view="${a.id}">📎 ${a.attachments.length} file${a.attachments.length>1?'s':''}</span>`:''}</div><button class="cal-cancel-btn" data-cancel="${a.id}">Cancel</button></div>`).join('');
  qsa('[data-cancel]',el).forEach(btn => btn.addEventListener('click', () => {
    state.appointments = state.appointments.filter(a=>a.id!==btn.dataset.cancel);
    save('cg_appts',state.appointments); renderCalendar(); renderDayDetail(date); renderHome(); toast('Appointment cancelled');
  }));
  qsa('[data-view]',el).forEach(btn => btn.addEventListener('click', () => {
    const appt = state.appointments.find(a=>a.id===btn.dataset.view);
    if (appt) openAttachmentViewer(appt.attachments, `${appt.type} · ${fmtTime(appt.time)}`);
  }));
}

function renderCalUpcoming() {
  const today = todayISO();
  const list = state.appointments.filter(a=>a.date>=today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const upEl = qs('#cal-upcoming-list');
  upEl.innerHTML = !list.length ? '<p class="empty-msg">No upcoming appointments</p>'
    : list.map(a=>`<div class="cal-up-item"><div class="cal-up-date">${fmtDateShort(a.date)} · ${fmtTime(a.time)}</div><div class="cal-up-detail">${a.type}</div><div class="cal-up-provider">${a.provider}</div>${a.attachments&&a.attachments.length?`<span class="attach-badge" data-view="${a.id}">📎 ${a.attachments.length} file${a.attachments.length>1?'s':''}</span>`:''}</div>`).join('');
  qsa('[data-view]',upEl).forEach(btn => btn.addEventListener('click', () => {
    const appt = state.appointments.find(a=>a.id===btn.dataset.view);
    if (appt) openAttachmentViewer(appt.attachments, `${appt.type} · ${fmtDateShort(appt.date)} ${fmtTime(appt.time)}`);
  }));
}

qs('#open-appt-modal').addEventListener('click', () => { qs('#appt-date').value=state.selectedDay||offsetISO(1); openModal('appt-modal'); });
qs('#save-appt-btn').addEventListener('click', () => {
  const date=qs('#appt-date').value, time=qs('#appt-time').value;
  if (!date||!time) { toast('Please select a date and time','⚠'); return; }
  const appt = {
    id:uid(), provider:qs('#appt-provider').value, type:qs('#appt-type').value,
    date, time, notes:qs('#appt-notes').value.trim(),
    attachments: [...pendingFiles],
  };
  state.appointments.push(appt);
  save('cg_appts',state.appointments);
  closeModal('appt-modal');
  qs('#appt-notes').value=''; qs('#appt-time').value='';
  resetUploadZone();
  renderCalendar(); renderHome();
  const msg = appt.attachments.length ? `Appointment scheduled with ${appt.attachments.length} attachment${appt.attachments.length>1?'s':''} 📎` : 'Appointment scheduled 📅';
  toast(msg);
});

// Reset upload zone when modal is closed without saving
qs('#appt-modal').addEventListener('click', e => {
  if (e.target === qs('#appt-modal')) resetUploadZone();
});
document.querySelectorAll('#appt-modal .modal-close').forEach(btn => {
  btn.addEventListener('click', resetUploadZone, { capture: true });
});
qs('#open-reschedule').addEventListener('click', () => {
  const today=todayISO();
  const list=state.appointments.filter(a=>a.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const el=qs('#reschedule-list');
  el.innerHTML = !list.length ? '<p class="empty-msg">No upcoming appointments</p>'
    : list.map(a=>`<div class="reschedule-item"><div class="reschedule-info"><div class="reschedule-name">${a.type}</div><div class="reschedule-date">${fmtDateShort(a.date)} · ${fmtTime(a.time)} · ${a.provider}</div></div><button class="reschedule-cancel" data-rid="${a.id}">Cancel</button></div>`).join('');
  qsa('[data-rid]',el).forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.rid;
    const idx = state.appointments.findIndex(a => a.id === id);
    const removed = state.appointments[idx];
    state.appointments.splice(idx, 1);
    save('cg_appts', state.appointments);
    closeModal('reschedule-modal');
    renderCalendar(); renderHome();
    toastUndo(`Appointment cancelled`, () => {
      state.appointments.splice(idx, 0, removed);
      save('cg_appts', state.appointments);
      renderCalendar(); renderHome();
      toast('Appointment restored ✓');
    });
    setTimeout(() => save('cg_appts', state.appointments), 5100);
  }));
  openModal('reschedule-modal');
});

// ══════════════════════════════════════════════
// PROVIDERS
// ══════════════════════════════════════════════
function renderProviders() {
  const list = qs('#provider-list');
  if (!state.providers.length) { list.innerHTML='<p class="empty-msg">No saved providers — tap + to add one</p>'; return; }
  list.innerHTML = state.providers.map((p,i) => `
    <div class="provider-card${i===0?' active-border':''}">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div class="provider-avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
        <div class="provider-info">
          <div class="provider-name">${p.name}</div>
          <div class="provider-meta"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2"/></svg> Last visited: ${p.lastVisit?fmtDateShort(p.lastVisit):'Unknown'}</div>
          <div class="provider-row" style="margin-top:6px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:2px"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.8"/></svg><span>${p.location}</span></div>
        </div>
        <button class="provider-delete" data-del-prov="${p.id}">✕</button>
      </div>
      <button class="btn-primary full-w" style="margin-top:10px;font-size:0.85rem;padding:10px" data-sched-prov="${p.id}">Schedule an Appointment</button>
    </div>`).join('');

  qsa('[data-del-prov]',list).forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.delProv;
    const idx = state.providers.findIndex(p => p.id === id);
    const removed = state.providers[idx];
    // Optimistically remove from state + UI
    state.providers.splice(idx, 1);
    renderProviders();
    // Show undo toast — only commit to localStorage if not undone
    toastUndo(`"${removed.name}" removed`, () => {
      state.providers.splice(idx, 0, removed);
      save('cg_providers', state.providers);
      renderProviders();
      toast('Provider restored ✓');
    });
    // Commit deletion after toast expires
    setTimeout(() => save('cg_providers', state.providers), 5100);
  }));
  qsa('[data-sched-prov]',list).forEach(btn => btn.addEventListener('click', () => {
    qs('#appt-date').value=offsetISO(1); switchTab('calendar'); setTimeout(()=>openModal('appt-modal'),300);
  }));
}

qs('#open-provider-modal').addEventListener('click', () => openModal('provider-modal'));
qs('#save-provider-btn').addEventListener('click', () => {
  const name=qs('#prov-name').value.trim();
  if (!name) { toast('Provider name is required','⚠'); return; }
  state.providers.push({id:uid(),name,type:qs('#prov-type').value.trim(),location:qs('#prov-location').value.trim(),lastVisit:qs('#prov-last-visit').value});
  save('cg_providers',state.providers); closeModal('provider-modal');
  ['#prov-name','#prov-type','#prov-location','#prov-last-visit'].forEach(s=>qs(s).value='');
  renderProviders(); toast('Provider saved ✓');
});

// ══════════════════════════════════════════════
// FILE ATTACHMENTS
// ══════════════════════════════════════════════
let pendingFiles = []; // { name, type, size, dataUrl }

const DOC_ICONS = {
  pdf: '📄', doc: '📝', docx: '📝', txt: '🗒️', csv: '📊', default: '📎'
};
function docIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  return DOC_ICONS[ext] || DOC_ICONS.default;
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}
function isImage(type) { return type.startsWith('image/'); }

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) { reject(new Error(`${file.name} exceeds 5 MB limit`)); return; }
    const reader = new FileReader();
    reader.onload = e => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: e.target.result });
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function addFiles(fileList) {
  const remaining = 6 - pendingFiles.length;
  if (remaining <= 0) { toast('Max 6 attachments per appointment', '⚠'); return; }
  const toAdd = Array.from(fileList).slice(0, remaining);
  for (const file of toAdd) {
    try {
      const f = await readFile(file);
      if (pendingFiles.find(p => p.name === f.name && p.size === f.size)) continue; // skip dupe
      pendingFiles.push(f);
    } catch (err) { toast(err.message, '⚠'); }
  }
  renderAttachmentPreview();
}

function renderAttachmentPreview() {
  const list = qs('#attachment-preview');
  if (!pendingFiles.length) { list.innerHTML = ''; return; }
  list.innerHTML = pendingFiles.map((f, i) => `
    <div class="attach-item" data-idx="${i}">
      ${isImage(f.type)
        ? `<img class="attach-thumb" src="${f.dataUrl}" alt="${f.name}" />`
        : `<div class="attach-doc-icon">${docIcon(f.name)}</div>`}
      <div class="attach-info">
        <div class="attach-name" title="${f.name}">${f.name}</div>
        <div class="attach-meta">${fmtSize(f.size)}</div>
      </div>
      <button class="attach-remove" data-rm="${i}" title="Remove">✕</button>
    </div>`).join('');

  qsa('[data-rm]', list).forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingFiles.splice(Number(btn.dataset.rm), 1);
      renderAttachmentPreview();
    });
  });
}

function initUploadZone() {
  const zone  = qs('#upload-zone');
  const input = qs('#file-input');

  // Click to browse
  zone.addEventListener('click', () => input.click());
  qs('#upload-browse-link').addEventListener('click', e => { e.stopPropagation(); input.click(); });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

  // Drag & drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });
}

function resetUploadZone() {
  pendingFiles = [];
  qs('#attachment-preview').innerHTML = '';
  qs('#file-input').value = '';
}

// ── Task Upload Zone ───────────────────────────
let taskPendingFiles = [];

function initTaskUploadZone() {
  const zone  = qs('#task-upload-zone');
  const input = qs('#task-file-input');
  zone.addEventListener('click', e => { if (!e.target.closest('.attachment-remove')) input.click(); });
  qs('#task-upload-browse-link').addEventListener('click', e => { e.stopPropagation(); input.click(); });
  input.addEventListener('change', () => { addTaskFiles(input.files); input.value = ''; });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); addTaskFiles(e.dataTransfer.files); });
}

async function addTaskFiles(fileList) {
  const remaining = 6 - taskPendingFiles.length;
  if (!remaining) { toast('Max 6 files allowed','⚠'); return; }
  for (const f of [...fileList].slice(0, remaining)) {
    if (f.size > 5*1024*1024) { toast(`${f.name} is over 5 MB`,'⚠'); continue; }
    if (taskPendingFiles.find(p => p.name === f.name && p.size === f.size)) continue;
    const dataUrl = await new Promise(res => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(f); });
    taskPendingFiles.push({ name:f.name, type:f.type, size:f.size, dataUrl });
  }
  renderTaskAttachmentPreview();
}

function renderTaskAttachmentPreview() {
  const list = qs('#task-attachment-preview');
  if (!list) return;
  if (!taskPendingFiles.length) { list.innerHTML = ''; return; }
  list.innerHTML = taskPendingFiles.map((f, i) => `
    <div class="attachment-item">
      ${f.type.startsWith('image/') ? `<img src="${f.dataUrl}" class="attachment-thumb" alt="${f.name}"/>` : `<div class="attachment-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.8"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>`}
      <div class="attachment-info"><p class="attachment-name">${f.name}</p><p class="attachment-size">${(f.size/1024).toFixed(0)} KB</p></div>
      <button class="attachment-remove" data-rm="${i}">✕</button>
    </div>`).join('');
  qsa('[data-rm]',list).forEach(btn => btn.addEventListener('click', () => {
    taskPendingFiles.splice(Number(btn.dataset.rm), 1);
    renderTaskAttachmentPreview();
  }));
}

// Attachment viewer modal
function openAttachmentViewer(attachments, apptLabel) {
  qs('#viewer-appt-title').textContent = `Attachments — ${apptLabel}`;
  const grid = qs('#viewer-grid');

  if (!attachments || !attachments.length) {
    grid.innerHTML = '<p class="empty-msg" style="grid-column:span 2">No attachments for this appointment.</p>';
    openModal('attachment-viewer-modal');
    return;
  }

  grid.innerHTML = attachments.map((f, i) => `
    <div class="viewer-item">
      ${isImage(f.type)
        ? `<img class="viewer-img" src="${f.dataUrl}" alt="${f.name}" data-fullview="${i}" />`
        : `<div class="viewer-doc-card"><div class="viewer-doc-icon">${docIcon(f.name)}</div><div class="viewer-doc-name">${f.name}</div><div class="viewer-doc-size">${fmtSize(f.size)}</div></div>`}
      <button class="viewer-dl-btn" data-dl="${i}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download
      </button>
    </div>`).join('');

  // Download handler
  qsa('[data-dl]', grid).forEach(btn => {
    btn.addEventListener('click', () => {
      const f = attachments[Number(btn.dataset.dl)];
      const a = document.createElement('a');
      a.href = f.dataUrl; a.download = f.name; a.click();
    });
  });

  // Full-view image on click
  qsa('[data-fullview]', grid).forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const w = window.open('', '_blank');
      w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${img.src}" style="max-width:100%;max-height:100vh;object-fit:contain" /></body></html>`);
    });
  });

  openModal('attachment-viewer-modal');
}

// ══════════════════════════════════════════════
// LOGO — go home
// ══════════════════════════════════════════════
qs('#logo-btn')?.addEventListener('click', () => switchTab('home'));

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
qs('#appt-date').value = offsetISO(1);
qs('#task-date').value = offsetISO(1);
initUploadZone();
initTaskUploadZone();
initAIChat();

// ══════════════════════════════════════════════
// INSURANCE INFO
// ══════════════════════════════════════════════
const INS_KEY = 'cg_insurance';
const INS_DEFAULTS = {
  healthPlan:    'Kaiser Permanente',
  medicalGroup:  '',
  planType:      'HMO',
  copay:         15,   // patient's actual copay — verify with insurance card
  memberId:      'KP-20384719',
  phone:         '',
  pcp:           'Dr. Allison Brown',
  pcpPhone:      '',
  effective:     '',
};

function getInsurance() { return { ...INS_DEFAULTS, ...load(INS_KEY, {}) }; }

function setPhone(id, num) {
  const el = qs(`#${id}`);
  if (!el) return;
  if (num) {
    el.textContent = num;
    el.href = `tel:${num.replace(/\D/g,'')}`;
    el.removeAttribute('style');
  } else {
    el.textContent = '—';
    el.href = '#';
  }
}

function renderInsurance() {
  const ins = getInsurance();
  const set = (id, val) => { const el = qs(`#${id}`); if (el) el.textContent = val || '—'; };
  set('ins-health-plan',   ins.healthPlan);
  set('ins-medical-group', ins.medicalGroup);
  set('ins-plan-type',     ins.planType);
  set('ins-member-id',     ins.memberId);
  set('ins-pcp',           ins.pcp);
  set('ins-effective',     ins.effective ? fmtDateShort(ins.effective) : '—');
  setPhone('ins-phone',     ins.phone);
  setPhone('ins-pcp-phone', ins.pcpPhone);
  const copayEl = qs('#ins-copay');
  if (copayEl) copayEl.textContent = ins.planType === 'No Insurance' ? 'Not covered' : `$${ins.copay}`;
}

// Open insurance modal — prefill current values
qs('#open-ins-modal').addEventListener('click', () => {
  const ins = getInsurance();
  qs('#ins-inp-health-plan').value   = ins.healthPlan;
  qs('#ins-inp-medical-group').value = ins.medicalGroup;
  qs('#ins-inp-plan-type').value     = ins.planType;
  qs('#ins-inp-copay').value         = ins.copay;
  qs('#ins-inp-member-id').value     = ins.memberId;
  qs('#ins-inp-phone').value         = ins.phone;
  qs('#ins-inp-pcp').value           = ins.pcp;
  qs('#ins-inp-pcp-phone').value     = ins.pcpPhone;
  qs('#ins-inp-effective').value     = ins.effective;
  openModal('ins-modal');
});

// Save insurance
qs('#save-ins-btn').addEventListener('click', () => {
  const healthPlan   = qs('#ins-inp-health-plan').value.trim();
  const medicalGroup = qs('#ins-inp-medical-group').value.trim();
  const planType     = qs('#ins-inp-plan-type').value;
  const copay    = Math.max(0, parseInt(qs('#ins-inp-copay').value) || 0);
  const memberId = qs('#ins-inp-member-id').value.trim();
  const phone        = qs('#ins-inp-phone').value.trim();
  const pcp          = qs('#ins-inp-pcp').value.trim();
  const pcpPhone     = qs('#ins-inp-pcp-phone').value.trim();
  const effective    = qs('#ins-inp-effective').value;
  if (!healthPlan) { toast('Please enter your Health Plan', '⚠'); return; }
  if (!memberId)   { toast('Please enter your Member ID', '⚠'); return; }
  save(INS_KEY, { healthPlan, medicalGroup, planType, copay, memberId, phone, pcp, pcpPhone, effective });
  renderInsurance();
  syncCalcInsurance();
  closeModal('ins-modal');
  toast('Insurance updated ✓');
});

// ── Deductible Bar ───────────────────────────
const DED_KEY = 'cg_deductible';
let dedState = load(DED_KEY, { met: 500, max: 1500 });

function syncCalcDeductible() {
  const remaining = Math.max(0, dedState.max - dedState.met);
  const inp = qs('#calc-deductible');
  if (inp) {
    inp.value = remaining;
    setCalcDedLocked(true);
  }
}

function setCalcDedLocked(locked) {
  const inp   = qs('#calc-deductible');
  const btn   = qs('#ded-calc-edit-btn');
  const badge = qs('#ded-sync-badge');
  if (!inp || !btn) return;
  inp.readOnly = locked;
  btn.classList.toggle('reset-mode', !locked);
  btn.innerHTML = locked
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Edit`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Reset to profile`;
  if (badge) badge.style.opacity = locked ? '1' : '0.4';
}

qs('#ded-calc-edit-btn').addEventListener('click', () => {
  const inp = qs('#calc-deductible');
  if (inp.readOnly) {
    setCalcDedLocked(false);
    inp.focus();
    inp.select();
  } else {
    syncCalcDeductible();
  }
});

function renderDeductible() {
  const { met, max } = dedState;
  const pct = max > 0 ? Math.min(100, Math.round((met / max) * 100)) : 0;
  const remaining = Math.max(0, max - met);

  qs('#ded-met').textContent      = `$${met.toLocaleString()}`;
  qs('#ded-total').textContent    = `of $${max.toLocaleString()} met`;
  qs('#ded-remaining').textContent = `$${remaining.toLocaleString()}`;
  qs('#ded-bar-label').textContent = `${pct}%`;
  qs('#ded-met-input').value      = met;
  qs('#ded-max-input').value      = max;

  // Animate bar (small delay lets the panel paint first)
  setTimeout(() => {
    const fill = qs('#ded-bar-fill');
    fill.style.width = `${pct}%`;
    // Hide the thumb dot when at 0%
    fill.style.visibility = pct === 0 ? 'hidden' : 'visible';
    // Color shift: green → yellow → pink based on pct
    if (pct >= 80)      fill.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
    else if (pct >= 50) fill.style.background = 'linear-gradient(90deg,var(--teal),var(--blue-mid))';
    else                fill.style.background = 'linear-gradient(90deg,var(--blue-mid),var(--teal))';
  }, 80);
}

qs('#ded-update-btn').addEventListener('click', () => {
  const met = Math.max(0, parseInt(qs('#ded-met-input').value) || 0);
  const max = Math.max(1, parseInt(qs('#ded-max-input').value) || 1500);
  dedState = { met, max };
  save(DED_KEY, dedState);
  renderDeductible();
  syncCalcDeductible();
  toast('Deductible updated ✓');
});

// Re-render whenever Account sub-tab is opened
qsa('.sub-tab').forEach(btn => {
  if (btn.dataset.subtab === 'account') {
    btn.addEventListener('click', () => setTimeout(() => { renderDeductible(); renderInsurance(); renderPinStatus(); }, 50));
  }
});

// ── Logout ───────────────────────────────────
qs('#logout-btn').addEventListener('click', () => {
  stopInactivityTimer();
  localStorage.removeItem(SESSION_KEY);
  qs('#app').classList.add('hidden');
  switchTab('home');
  switchSubTab('providers');
  showScreen('welcome-screen');
  toast("You've been logged out 👋");
});

// ── Auto-login on page load ───────────────────
// If a remembered session exists and no ?screen= override, skip auth
(function () {
  const session = getSession();
  if (!session) return;
  if (new URLSearchParams(window.location.search).get('screen')) return; // let URL param handler run
  // Pre-fill email in case they navigate to login later
  const emailInp = qs('#login-email');
  if (emailInp) emailInp.value = session.email !== 'google-user' ? session.email : '';
  qs('#welcome-screen').classList.add('hidden');
  launchOrConsent(session.email);
})();

// URL param screen jump (used for Figma capture / preview links)
// e.g. ?screen=home  ?screen=calc  ?screen=tasks  ?screen=calendar
//      ?screen=providers  ?screen=account  ?screen=ai
(function () {
  const p = new URLSearchParams(window.location.search).get('screen');
  if (!p) return;
  // Auth screens
  if (p === 'login')  { qs('#welcome-screen').classList.add('hidden'); showScreen('login-screen');  return; }
  if (p === 'signup') { qs('#welcome-screen').classList.add('hidden'); showScreen('signup-screen'); return; }
  // App screens
  qs('#welcome-screen').classList.add('hidden');
  launchApp();
  const tabMap2 = { home:'home', calc:'calc', tasks:'tasks', calendar:'calendar', providers:'profile', account:'profile', ai:'home' };
  switchTab(tabMap2[p] || 'home');
  if (p === 'account') { switchSubTab('account'); setTimeout(() => { renderDeductible(); renderPinStatus(); }, 100); }
  if (p === 'ai') setTimeout(() => openModal('ai-chat-modal'), 300);
})();
