
import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, Download, Droplet, EyeOff,
  HeartPulse, Home, KeyRound, Lock, Mail, Moon, Pencil, Plus, Save, Settings,
  ShieldCheck, Smile, Sparkles, Trash2, X
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "4sara_entries_final";
const SETTINGS_KEY = "4sara_settings_final";

const firebaseConfig = {
  apiKey: "AIzaSyDKzvyYKKGnj65WP-Yu24a_6NMypghFcU",
  authDomain: "sara-e6444.firebaseapp.com",
  projectId: "sara-e6444",
  storageBucket: "sara-e6444.firebasestorage.app",
  messagingSenderId: "906937325627",
  appId: "1:906937325627:web:12b1468db2d201912e241e"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);


const demoEntries = [
  { id: 1, type: "period", startDate: "2026-04-28", endDate: "2026-05-02", flow: "Medium", mood: "Calm", symptoms: ["Cramps", "Fatigue"], notes: "Mild cramps on day one." },
  { id: 2, type: "period", startDate: "2026-05-26", endDate: "2026-05-30", flow: "Light", mood: "Sensitive", symptoms: ["Bloating", "Back pain"], notes: "Started lighter than normal." }
];

const defaultSettings = {
  welcomeSeen: false,
  onboardingComplete: false,
  profileName: "",
  profileAge: "",
  darkMode: false,
  pinEnabled: false,
  pin: "",
  remindersEnabled: true,
  reminderDaysBefore: 2,
  cycleLengthOverride: "",
  periodLengthOverride: "",
  customSymptoms: []
};

const presetSymptoms = ["Cramps", "Headache", "Bloating", "Fatigue", "Acne", "Back pain", "Cravings", "Mood swings", "Nausea", "Tender breasts"];
const moods = ["N/A", "Calm", "Happy", "Sensitive", "Irritable", "Sad", "Anxious", "Energetic", "Tired"];

const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
const toDateKey = (d) => d.toISOString().slice(0, 10);
const monthName = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

function addDays(dateString, days) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  return Math.round((new Date(end + "T00:00:00") - new Date(start + "T00:00:00")) / 86400000);
}

function getDaysInRange(start, end) {
  if (!start) return [];
  const total = Math.max(0, daysBetween(start, end || start));
  return Array.from({ length: total + 1 }, (_, index) => addDays(start, index));
}

function inRange(day, start, end) {
  return day && start && end && daysBetween(start, day) >= 0 && daysBetween(day, end) >= 0;
}

function blankForm() {
  return { type: "period", startDate: todayKey(), endDate: "", flow: "N/A", mood: "N/A", moods: ["N/A"], symptoms: [], notes: "" };
}

function normalizeMoods(entry) {
  if (Array.isArray(entry.moods) && entry.moods.length) return entry.moods;
  if (entry.mood) return [entry.mood];
  return ["N/A"];
}

function moodLabel(entry) {
  return normalizeMoods(entry).filter((mood) => mood !== "N/A").join(", ") || "N/A";
}

function toggleMoodSelection(currentMoods, mood) {
  const list = Array.isArray(currentMoods) && currentMoods.length ? currentMoods : ["N/A"];

  if (mood === "N/A") return ["N/A"];

  const withoutNA = list.filter((item) => item !== "N/A");
  const next = withoutNA.includes(mood)
    ? withoutNA.filter((item) => item !== mood)
    : [...withoutNA, mood];

  return next.length ? next : ["N/A"];
}

function inferPhase(dateKey, periods, avgCycle, avgPeriod) {
  if (!dateKey || !periods.length) return "Unknown";
  const sorted = [...periods].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  let current = null;
  let next = null;

  for (let i = 0; i < sorted.length; i++) {
    if (daysBetween(sorted[i].startDate, dateKey) >= 0) {
      current = sorted[i];
      next = sorted[i + 1] || null;
    }
  }

  if (!current) return "Unknown";

  const menstruationStart = current.startDate;
  const menstruationEnd = current.endDate || addDays(menstruationStart, avgPeriod - 1);
  const nextStart = next ? next.startDate : addDays(menstruationStart, avgCycle);
  const ovulation = addDays(nextStart, -14);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);

  if (inRange(dateKey, menstruationStart, menstruationEnd)) return "Menstruation";
  if (dateKey === ovulation) return "Ovulation";
  if (inRange(dateKey, fertileStart, fertileEnd)) return "Fertile";
  if (inRange(dateKey, addDays(menstruationEnd, 1), addDays(fertileStart, -1))) return "Follicular";
  if (inRange(dateKey, addDays(fertileEnd, 1), addDays(nextStart, -1))) return "Luteal";
  return "Unknown";
}

function buildProjectedCycleMap(lastPeriodStart, avgCycle, avgPeriod, monthsAhead = 6) {
  const map = new Map();
  if (!lastPeriodStart) return map;

  const today = todayKey();
  const projectionEnd = addDays(today, monthsAhead * 31);
  let start = lastPeriodStart;

  while (daysBetween(start, projectionEnd) >= 0) {
    const menstruationEnd = addDays(start, avgPeriod - 1);
    const nextStart = addDays(start, avgCycle);
    const ovulation = addDays(nextStart, -14);
    const fertileStart = addDays(ovulation, -5);
    const fertileEnd = addDays(ovulation, 1);
    const follicularStart = addDays(menstruationEnd, 1);
    const follicularEnd = addDays(fertileStart, -1);
    const lutealStart = addDays(fertileEnd, 1);
    const lutealEnd = addDays(nextStart, -1);

    getDaysInRange(start, menstruationEnd).forEach((day) => {
      if (!map.has(day)) map.set(day, { phase: "Menstruation", predicted: daysBetween(today, day) >= 0 });
    });

    getDaysInRange(follicularStart, follicularEnd).forEach((day) => {
      if (!map.has(day)) map.set(day, { phase: "Follicular", predicted: true });
    });

    getDaysInRange(fertileStart, fertileEnd).forEach((day) => {
      if (!map.has(day)) map.set(day, { phase: day === ovulation ? "Ovulation" : "Fertile", predicted: true });
    });

    getDaysInRange(lutealStart, lutealEnd).forEach((day) => {
      if (!map.has(day)) map.set(day, { phase: "Luteal", predicted: true });
    });

    start = nextStart;
  }

  return map;
}

function phaseDescription(phase) {
  switch (phase) {
    case "Menstruation":
      return "Bleeding days are expected or logged.";
    case "Follicular":
      return "Your body may be preparing to release an egg.";
    case "Fertile":
      return "Pregnancy may be more likely during this estimated window.";
    case "Ovulation":
      return "This is the estimated egg-release day.";
    case "Luteal":
      return "This is the phase before menstruation, when PMS-type symptoms may appear.";
    default:
      return "Add more cycle data to estimate this day.";
  }
}

function getCycleDayForDate(dateKey, lastPeriodStart, avgCycle) {
  if (!dateKey || !lastPeriodStart || !avgCycle) return null;

  let start = lastPeriodStart;
  let guard = 0;

  while (daysBetween(start, dateKey) >= avgCycle && guard < 60) {
    start = addDays(start, avgCycle);
    guard += 1;
  }

  while (daysBetween(start, dateKey) < 0 && guard < 120) {
    start = addDays(start, -avgCycle);
    guard += 1;
  }

  const day = daysBetween(start, dateKey) + 1;
  return day > 0 && day <= avgCycle ? day : null;
}

function isFutureDate(dateKey) {
  return daysBetween(todayKey(), dateKey) > 0;
}

function suggestionFor(symptom, phase = "your cycle") {
  const s = symptom.toLowerCase();
  const p = phase === "Unknown" || phase === "your cycle" ? "your cycle" : `the ${phase.toLowerCase()} phase`;

  if (s.includes("cramp")) return {
    title: `Cramps during ${p}`,
    food: "Consider warm drinks, balanced meals, and staying hydrated.",
    movement: "Gentle stretching, light walking, or yoga may help ease discomfort.",
    comfort: "Heat on the lower abdomen or back may help. If cramps are severe or unusual, consider talking with a healthcare professional."
  };

  if (s.includes("bloat")) return {
    title: `Bloating during ${p}`,
    food: "Try drinking water, eating smaller meals, and limiting very salty foods.",
    movement: "Light walking or gentle movement may help digestion and bloating.",
    comfort: "Track whether bloating repeats in this phase so 4Sara can spot the pattern better."
  };

  if (s.includes("fatigue") || s.includes("tired")) return {
    title: `Fatigue during ${p}`,
    food: "Consider iron-rich foods, protein, and steady meals. Ask a professional before starting iron supplements.",
    movement: "Keep movement gentle. A short walk or stretching may be better than intense workouts.",
    comfort: "Prioritize sleep and rest, especially if fatigue repeats around the same phase."
  };

  if (s.includes("headache")) return {
    title: `Headaches during ${p}`,
    food: "Hydration and regular meals may help. Track caffeine, salty foods, and skipped meals.",
    movement: "Keep activity light if a headache is active.",
    comfort: "Rest, dim lighting, and tracking timing may help identify recurring triggers."
  };

  if (s.includes("mood") || s.includes("anxious") || s.includes("sad") || s.includes("irritable")) return {
    title: `Mood changes during ${p}`,
    food: "Balanced meals and steady hydration may support energy and mood.",
    movement: "Walking, stretching, or breathing exercises may help with stress and tension.",
    comfort: "Journaling or daily check-ins can help confirm whether mood changes repeat in this phase."
  };

  if (s.includes("craving")) return {
    title: `Cravings during ${p}`,
    food: "Try balanced snacks with protein, fiber, and healthy fats to stay fuller longer.",
    movement: "A short walk may help reset cravings and stress eating.",
    comfort: "Track cravings by phase to see if they happen before menstruation."
  };

  if (s.includes("nausea")) return {
    title: `Nausea during ${p}`,
    food: "Small bland meals, crackers, or ginger tea may help some people.",
    movement: "Keep movement light until nausea improves.",
    comfort: "If nausea is severe, new, or recurring often, consider checking with a healthcare professional."
  };

  return {
    title: `${symptom} during ${p}`,
    food: "Track meals, hydration, and timing to see if a pattern develops.",
    movement: "Gentle movement may help, depending on how you feel.",
    comfort: "Use daily check-ins to see whether this symptom repeats in the same phase."
  };
}

function buildSuggestions(stats) {
  const output = [];

  if (stats.totalEntries < 3) {
    output.push({
      title: "Build stronger predictions",
      food: "No food pattern is clear yet because there is limited cycle history.",
      movement: "Add daily check-ins across different phases to improve pattern detection.",
      comfort: "Track at least 3 cycles for stronger insights and more personalized suggestions."
    });
  }

  if (!stats.symptomStats.length) {
    output.push({
      title: "Start tracking symptoms",
      food: "Food suggestions will become more useful once symptoms are logged.",
      movement: "Daily check-ins can show whether symptoms happen before, during, or after menstruation.",
      comfort: "Add symptoms like cramps, bloating, fatigue, headaches, or mood changes when they happen."
    });
    return output;
  }

  const phaseMap = new Map();
  stats.phaseInsights.forEach((item) => {
    item.topSymptoms.forEach(([symptom]) => {
      if (!phaseMap.has(symptom)) phaseMap.set(symptom, item.phase);
    });
  });

  stats.symptomStats.slice(0, 4).forEach(([symptom]) => {
    output.push(suggestionFor(symptom, phaseMap.get(symptom) || "your cycle"));
  });

  if (stats.minCycle && stats.maxCycle && stats.maxCycle - stats.minCycle >= 8) {
    output.push({
      title: "Cycle timing varies",
      food: "Keep logging meals, hydration, stress, and sleep notes if your cycle timing changes often.",
      movement: "Daily check-ins can help show if stress, travel, illness, or workouts line up with changes.",
      comfort: "Predictions may be less reliable when cycle length varies a lot."
    });
  }

  return output.slice(0, 5);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(entries, settings) {
  downloadFile("4sara-data.json", JSON.stringify({ exportedAt: new Date().toISOString(), entries, settings: { ...settings, pin: settings.pin ? "[hidden]" : "" } }, null, 2), "application/json");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(entries) {
  const headers = ["Start Date", "End Date", "Type", "Flow", "Mood", "Symptoms", "Notes"];
  const rows = entries.map((entry) => [
    entry.startDate,
    entry.endDate || "",
    entry.type || "period",
    entry.flow || "",
    moodLabel(entry),
    (entry.symptoms || []).join("; "),
    entry.notes || ""
  ]);
  downloadFile("4sara-cycle-history.csv", [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function printReport(entries, stats) {
  const menstruationEntries = entries.filter((entry) => (entry.type || "period") === "period");
  const checkIns = entries.filter((entry) => (entry.type || "period") === "checkin");

  const symptomCounts = entries.flatMap((entry) => entry.symptoms || []).reduce((acc, symptom) => {
    acc[symptom] = (acc[symptom] || 0) + 1;
    return acc;
  }, {});

  const symptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([symptom, count]) => `${symptom} (${count})`).join(", ") || "No symptoms logged yet";

  const phaseRows = (stats.phaseInsights || []).map((item) => `
    <tr>
      <td>${item.phase}</td>
      <td>${item.topSymptoms.length ? item.topSymptoms.map(([symptom, count]) => `${symptom} (${count})`).join(", ") : "No symptom pattern yet"}</td>
      <td>${item.topMood ? item.topMood[0] : "No mood pattern yet"}</td>
    </tr>
  `).join("");

  const suggestionRows = (stats.dynamicSuggestions || []).map((suggestion) => `
    <div class="suggestion">
      <h3>${suggestion.title}</h3>
      <p><strong>Food:</strong> ${suggestion.food}</p>
      <p><strong>Movement:</strong> ${suggestion.movement}</p>
      <p><strong>Comfort:</strong> ${suggestion.comfort}</p>
    </div>
  `).join("");

  const entryRows = entries.map((entry) => `
    <tr>
      <td>${entry.startDate}</td>
      <td>${(entry.type || "period") === "checkin" ? "Daily check-in" : "Menstruation"}</td>
      <td>${entry.endDate || ""}</td>
      <td>${entry.flow || ""}</td>
      <td>${moodLabel(entry)}</td>
      <td>${(entry.symptoms || []).join("; ")}</td>
      <td>${entry.notes || ""}</td>
    </tr>
  `).join("");

  const notes = entries.filter((entry) => entry.notes).slice(0, 12).map((entry) => `<li><strong>${entry.startDate}</strong> — ${entry.notes}</li>`).join("");

  const html = `<!doctype html>
  <html>
    <head>
      <title>4Sara Doctor Summary Report</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1f2937;padding:32px;line-height:1.45}
        h1{color:#be123c}
        h2{margin-top:28px;color:#374151}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .card,.suggestion{border:1px solid #fecdd3;border-radius:14px;padding:14px;background:#fff1f2;margin-bottom:10px}
        .alt{background:#faf5ff;border-color:#e9d5ff}
        .label{color:#6b7280;font-size:12px}
        .value{font-weight:700;font-size:16px}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
        th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:top;text-align:left}
        th{background:#fff1f2}
        .disclaimer{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px;font-size:12px;color:#78350f;margin-top:22px}
        button{padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:white;margin-bottom:20px;font-weight:700}
        @media print{button{display:none}body{padding:0}.card,.suggestion{break-inside:avoid}}
      </style>
    </head>
    <body>
      <button onclick="window.print()">Print / Save as PDF</button>
      <h1>4Sara Doctor Summary Report</h1>
      <p>Generated ${new Date().toLocaleString()}</p>

      <h2>Cycle Summary</h2>
      <div class="grid">
        <div class="card"><div class="label">Logged menstruation cycles</div><div class="value">${menstruationEntries.length}</div></div>
        <div class="card"><div class="label">Daily check-ins</div><div class="value">${checkIns.length}</div></div>
        <div class="card"><div class="label">Average cycle length</div><div class="value">${stats.averageCycle} days</div></div>
        <div class="card"><div class="label">Average menstruation length</div><div class="value">${stats.averagePeriod} days</div></div>
        <div class="card alt"><div class="label">Next predicted menstruation</div><div class="value">${stats.nextPeriod ? formatDate(stats.nextPeriod) : "Not enough data"}</div></div>
        <div class="card alt"><div class="label">Fertile window estimate</div><div class="value">${stats.fertileStart ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "Not enough data"}</div></div>
      </div>

      <h2>Symptom Summary</h2>
      <div class="card"><div class="label">Most logged symptoms</div><div class="value">${symptoms}</div></div>

      <h2>Phase Patterns</h2>
      <table>
        <thead><tr><th>Phase</th><th>Top symptoms</th><th>Common mood</th></tr></thead>
        <tbody>${phaseRows || `<tr><td colspan="3">No phase patterns yet.</td></tr>`}</tbody>
      </table>

      <h2>4Sara Suggestions</h2>
      ${suggestionRows || "<p>No suggestions yet. Add symptoms and daily check-ins to unlock suggestions.</p>"}

      <h2>Notes Summary</h2>
      ${notes ? `<ul>${notes}</ul>` : "<p>No notes logged yet.</p>"}

      <h2>Full Entry History</h2>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>End Date</th><th>Flow</th><th>Mood</th><th>Symptoms</th><th>Notes</th></tr></thead>
        <tbody>${entryRows || `<tr><td colspan="7">No entries logged.</td></tr>`}</tbody>
      </table>

      <div class="disclaimer">This report is for personal tracking and discussion with a healthcare professional. Phase labels, fertile window, ovulation, and menstruation predictions are estimates. Suggestions are general wellness ideas, not medical advice.</div>
    </body>
  </html>`;

  const win = window.open("", "_blank", "width=950,height=750");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}

function Button({ children, onClick, variant = "primary", className = "", disabled = false }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`btn ${variant === "secondary" ? "btn-secondary" : ""} ${className}`}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function App() {
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || demoEntries; }
    catch { return demoEntries; }
  });

  const [settings, setSettings] = useState(() => {
    try { return { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }; }
    catch { return defaultSettings; }
  });

  const [activeTab, setActiveTab] = useState("dashboard");
  const [form, setForm] = useState(blankForm());
  const [editingId, setEditingId] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [message, setMessage] = useState("");
  const [locked, setLocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [importText, setImportText] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [customSymptomInput, setCustomSymptomInput] = useState("");
  const [onboarding, setOnboarding] = useState({ profileName: "", profileAge: "", lastPeriodStart: todayKey(), averageCycleLength: "28", averagePeriodLength: "5", firstFlow: "N/A", firstMood: "N/A" });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => { if (settings.pinEnabled && settings.pin) setLocked(true); }, []);

  const updateSettings = (patch) => setSettings((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const hasPeriodEntry = entries.some((entry) => (entry.type || "period") === "period");
    if (settings.onboardingComplete && !hasPeriodEntry) updateSettings({ onboardingComplete: false });
  }, [entries, settings.onboardingComplete]);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2600);
  };

  const handleAuthSubmit = async () => {
    setAuthError("");

    if (!authEmail.trim()) {
      setAuthError("Enter an email address.");
      return;
    }

    if (!authPassword || authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        showMessage("Account created. Cloud sync will be added in the next phase.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        showMessage("Signed in. Cloud sync will be added in the next phase.");
      }

      setAuthPassword("");
    } catch (error) {
      setAuthError(error.message?.replace("Firebase: ", "") || "Authentication failed.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showMessage("Signed out.");
  };

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)), [entries]);
  const allSymptoms = useMemo(() => [...new Set([...presetSymptoms, ...(settings.customSymptoms || [])])], [settings.customSymptoms]);

  const stats = useMemo(() => {
    const periodEntries = entries.filter((entry) => (entry.type || "period") === "period");
    const chronological = [...periodEntries].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const last = chronological[chronological.length - 1];

    const cycleLengths = [];
    for (let i = 1; i < chronological.length; i++) {
      cycleLengths.push(daysBetween(chronological[i - 1].startDate, chronological[i].startDate));
    }

    const calculatedCycle = cycleLengths.length ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) : 28;
    const periodLengths = chronological.filter((entry) => entry.endDate).map((entry) => daysBetween(entry.startDate, entry.endDate) + 1);
    const calculatedPeriod = periodLengths.length ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length) : 5;

    const averageCycle = Number(settings.cycleLengthOverride) || calculatedCycle;
    const averagePeriod = Number(settings.periodLengthOverride) || calculatedPeriod;
    const nextPeriod = last ? addDays(last.startDate, averageCycle) : "";
    const predictedEnd = nextPeriod ? addDays(nextPeriod, averagePeriod - 1) : "";
    const ovulationDay = nextPeriod ? addDays(nextPeriod, -14) : "";
    const fertileStart = ovulationDay ? addDays(ovulationDay, -5) : "";
    const fertileEnd = ovulationDay ? addDays(ovulationDay, 1) : "";
    const reminderDate = nextPeriod ? addDays(nextPeriod, -Number(settings.reminderDaysBefore || 0)) : "";
    const daysUntil = nextPeriod ? daysBetween(todayKey(), nextPeriod) : null;

    const symptomStats = Object.entries(entries.flatMap((entry) => entry.symptoms || []).reduce((acc, symptom) => {
      acc[symptom] = (acc[symptom] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]);

    const phaseSymptoms = {};
    const phaseMoods = {};

    entries.forEach((entry) => {
      const phase = inferPhase(entry.startDate, chronological, averageCycle, averagePeriod);
      phaseSymptoms[phase] ||= {};
      phaseMoods[phase] ||= {};

      (entry.symptoms || []).forEach((symptom) => {
        phaseSymptoms[phase][symptom] = (phaseSymptoms[phase][symptom] || 0) + 1;
      });

      normalizeMoods(entry).forEach((mood) => {
        if (mood !== "N/A") phaseMoods[phase][mood] = (phaseMoods[phase][mood] || 0) + 1;
      });
    });

    const phaseInsights = Object.entries(phaseSymptoms)
      .filter(([phase]) => phase !== "Unknown")
      .map(([phase, symptoms]) => ({
        phase,
        topSymptoms: Object.entries(symptoms).sort((a, b) => b[1] - a[1]).slice(0, 3),
        topMood: Object.entries(phaseMoods[phase] || {}).sort((a, b) => b[1] - a[1])[0]
      }))
      .filter((item) => item.topSymptoms.length || item.topMood);

    const checkInPhaseData = {};

    entries
      .filter((entry) => (entry.type || "period") === "checkin")
      .forEach((entry) => {
        const phase = inferPhase(entry.startDate, chronological, averageCycle, averagePeriod);
        const key = phase === "Unknown" ? "Unassigned" : phase;

        checkInPhaseData[key] ||= {
          phase: key,
          count: 0,
          symptoms: {},
          moods: {}
        };

        checkInPhaseData[key].count += 1;

        (entry.symptoms || []).forEach((symptom) => {
          checkInPhaseData[key].symptoms[symptom] = (checkInPhaseData[key].symptoms[symptom] || 0) + 1;
        });

        normalizeMoods(entry).forEach((mood) => {
          if (mood !== "N/A") {
            checkInPhaseData[key].moods[mood] = (checkInPhaseData[key].moods[mood] || 0) + 1;
          }
        });
      });

    const checkInPhaseInsights = Object.values(checkInPhaseData)
      .map((item) => ({
        ...item,
        topSymptoms: Object.entries(item.symptoms).sort((a, b) => b[1] - a[1]).slice(0, 3),
        topMood: Object.entries(item.moods).sort((a, b) => b[1] - a[1])[0]
      }))
      .sort((a, b) => {
        const order = ["Menstruation", "Follicular", "Fertile", "Ovulation", "Luteal", "Unassigned"];
        return order.indexOf(a.phase) - order.indexOf(b.phase);
      });

    const currentCycleDay = last ? Math.max(1, daysBetween(last.startDate, todayKey()) + 1) : null;
    const minCycle = cycleLengths.length ? Math.min(...cycleLengths) : null;
    const maxCycle = cycleLengths.length ? Math.max(...cycleLengths) : null;
    const dataConfidence = periodEntries.length >= 6 ? "Strong" : periodEntries.length >= 3 ? "Good" : periodEntries.length >= 1 ? "Limited" : "No data";
    const confidenceNote = periodEntries.length >= 6
      ? "Predictions are stronger because several cycles are logged."
      : periodEntries.length >= 3
      ? "Predictions are improving as more cycles are logged."
      : periodEntries.length >= 1
      ? "Add at least 3 cycles for better predictions."
      : "Add a menstruation entry to start seeing insights.";

    const baseStats = { last, averageCycle, averagePeriod, nextPeriod, predictedEnd, ovulationDay, fertileStart, fertileEnd, reminderDate, daysUntil, currentCycleDay, minCycle, maxCycle, dataConfidence, confidenceNote, symptomStats, phaseInsights, checkInPhaseInsights, totalEntries: periodEntries.length };

    return { ...baseStats, dynamicSuggestions: buildSuggestions(baseStats) };
  }, [entries, settings]);

  const projectedPhaseMap = useMemo(() => {
    return buildProjectedCycleMap(stats.last?.startDate, stats.averageCycle, stats.averagePeriod, 6);
  }, [stats.last?.startDate, stats.averageCycle, stats.averagePeriod]);

  const selectedPhase = useMemo(() => {
    if (!form.startDate) return { phase: "Unknown" };
    return projectedPhaseMap.get(form.startDate) || { phase: inferPhase(form.startDate, entries.filter((entry) => (entry.type || "period") === "period"), stats.averageCycle, stats.averagePeriod) };
  }, [form.startDate, projectedPhaseMap, entries, stats.averageCycle, stats.averagePeriod]);

  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const offset = first.getDay();
    const cells = Math.ceil((offset + last.getDate()) / 7) * 7;

    const periodDays = new Map();
    const checkInDays = new Map();

    entries.filter((entry) => (entry.type || "period") === "period").forEach((entry) => {
      getDaysInRange(entry.startDate, entry.endDate).forEach((day) => periodDays.set(day, entry));
    });

    entries.filter((entry) => (entry.type || "period") === "checkin").forEach((entry) => {
      if (!checkInDays.has(entry.startDate)) checkInDays.set(entry.startDate, []);
      checkInDays.get(entry.startDate).push(entry);
    });

    return Array.from({ length: cells }, (_, index) => {
      const dayNumber = index - offset + 1;
      if (dayNumber < 1 || dayNumber > last.getDate()) return { empty: true, key: `empty-${index}` };

      const key = toDateKey(new Date(year, month, dayNumber));
      const entry = periodDays.get(key);
      const projection = projectedPhaseMap.get(key);
      const phase = entry ? "Menstruation" : projection?.phase || "";
      const isPredicted = !entry && phase === "Menstruation";
      const isFertile = phase === "Fertile";
      const isOvulation = phase === "Ovulation";
      const isFollicular = phase === "Follicular";
      const isLuteal = phase === "Luteal";

      return {
        empty: false,
        key,
        dayNumber,
        dateKey: key,
        isToday: key === todayKey(),
        entry,
        checkIns: checkInDays.get(key) || [],
        isPredicted,
        isFertile,
        isOvulation,
        isFollicular,
        isLuteal,
        phaseLabel: phase,
        phaseDescription: phaseDescription(phase),
        cycleDay: getCycleDayForDate(key, stats.last?.startDate, stats.averageCycle),
        isFuture: isFutureDate(key),
        statusLabel: entry ? "Logged" : isFutureDate(key) ? "Predicted" : "Not logged"
      };
    });
  }, [calendarDate, entries, projectedPhaseMap]);

  const completeOnboarding = () => {
    if (!onboarding.profileName.trim()) return showMessage("Enter a name first.");
    if (!onboarding.profileAge) return showMessage("Enter an age first.");
    if (!onboarding.lastPeriodStart) return showMessage("Enter the last menstruation start date first.");

    const cycleLength = Number(onboarding.averageCycleLength) || 28;
    const periodLength = Number(onboarding.averagePeriodLength) || 5;

    setEntries([{
      id: Date.now(),
      type: "period",
      startDate: onboarding.lastPeriodStart,
      endDate: addDays(onboarding.lastPeriodStart, periodLength - 1),
      flow: onboarding.firstFlow || "N/A",
      mood: onboarding.firstMood || "N/A",
      moods: onboarding.firstMood && onboarding.firstMood !== "N/A" ? [onboarding.firstMood] : ["N/A"],
      symptoms: [],
      notes: "Created during first-time setup."
    }]);

    updateSettings({
      cycleLengthOverride: String(cycleLength),
      periodLengthOverride: String(periodLength),
      onboardingComplete: true,
      profileName: onboarding.profileName.trim(),
      profileAge: onboarding.profileAge
    });

    setCalendarDate(new Date(onboarding.lastPeriodStart + "T00:00:00"));
    setActiveTab("dashboard");
    showMessage("Setup complete. Your first prediction is ready.");
  };

  const skipOnboarding = () => {
    updateSettings({ onboardingComplete: true });
    showMessage("Setup skipped. You can still log menstruation anytime.");
  };

  const toggleSymptom = (symptom) => {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom]
    }));
  };

  const addCustomSymptom = () => {
    const cleaned = customSymptomInput.trim();
    if (!cleaned) return showMessage("Type a symptom first.");
    if (allSymptoms.some((symptom) => symptom.toLowerCase() === cleaned.toLowerCase())) return showMessage("That symptom already exists.");

    updateSettings({ customSymptoms: [...(settings.customSymptoms || []), cleaned] });
    setCustomSymptomInput("");
    showMessage("Custom symptom added.");
  };

  const removeCustomSymptom = (symptom) => {
    updateSettings({ customSymptoms: (settings.customSymptoms || []).filter((item) => item !== symptom) });
    setForm((current) => ({ ...current, symptoms: current.symptoms.filter((item) => item !== symptom) }));
    showMessage("Custom symptom removed.");
  };

  const saveEntry = () => {
    if (!form.startDate) return showMessage("Start date is required.");
    if (isFutureDate(form.startDate)) return showMessage("Future dates are prediction-only. Choose today or a past date to log.");
    if (form.type === "period" && form.endDate && daysBetween(form.startDate, form.endDate) < 0) return showMessage("End date cannot be before start date.");

    const selectedMoods = Array.isArray(form.moods) && form.moods.length ? form.moods : normalizeMoods(form);
    const cleanForm = {
      ...form,
      moods: selectedMoods,
      mood: selectedMoods.filter((item) => item !== "N/A").join(", ") || "N/A",
      endDate: form.type === "checkin" ? "" : form.endDate,
      flow: form.type === "checkin" ? "N/A" : (form.flow || "N/A")
    };

    if (editingId) {
      setEntries((current) => current.map((entry) => entry.id === editingId ? { ...entry, ...cleanForm } : entry));
      showMessage("Entry updated.");
    } else {
      setEntries((current) => [...current, { id: Date.now(), ...cleanForm }]);
      showMessage("Entry saved.");
    }

    setCalendarDate(new Date(form.startDate + "T00:00:00"));
    setForm(blankForm());
    setEditingId(null);
  };

  const startEdit = (entry) => {
    setForm({
      type: entry.type || "period",
      startDate: entry.startDate,
      endDate: entry.endDate || "",
      flow: entry.flow || "Medium",
      mood: entry.mood || "N/A",
      moods: normalizeMoods(entry),
      symptoms: entry.symptoms || [],
      notes: entry.notes || ""
    });
    setEditingId(entry.id);
    setActiveTab("log");
    showMessage("Editing entry.");
  };

  const deleteEntry = (id) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    showMessage("Entry deleted.");
  };

  const clearAllData = () => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
    updateSettings({ onboardingComplete: false });
    showMessage("Local cycle data cleared.");
  };

  const logToday = (type = "period") => {
    setForm({ ...blankForm(), type, startDate: todayKey() });
    setEditingId(null);
    setActiveTab("log");
    showMessage(type === "checkin" ? "Ready to add today's check-in." : "Ready to log menstruation today.");
  };

  const startLogForSelectedDate = (dateKey = selectedCalendarDay, type = "period") => {
    if (!dateKey) return showMessage("Select a calendar date first.");
    if (isFutureDate(dateKey)) return showMessage("Future dates are prediction-only. You can log this date once it arrives.");
    setForm({ ...blankForm(), type, startDate: dateKey, endDate: "" });
    setEditingId(null);
    setActiveTab("log");
    showMessage(type === "checkin" ? `Ready to add a check-in for ${formatDate(dateKey)}.` : `Ready to log menstruation for ${formatDate(dateKey)}.`);
  };

  const jumpToNextPeriod = () => {
    if (!stats.nextPeriod) return showMessage("Add a cycle first so 4Sara can predict the next menstruation.");
    setCalendarDate(new Date(stats.nextPeriod + "T00:00:00"));
    setActiveTab("calendar");
    showMessage("Showing the predicted menstruation on the calendar.");
  };

  const previewReminder = () => {
    if (!settings.remindersEnabled) return showMessage("Reminders are turned off. Turn them on in Settings first.");
    if (!stats.reminderDate) return showMessage("Add a cycle first so 4Sara can calculate a reminder date.");
    showMessage(`Preview reminder: menstruation may start around ${formatDate(stats.nextPeriod)}.`);
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText);
      const importedEntries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(importedEntries)) throw new Error();

      setEntries(importedEntries.filter((entry) => entry.startDate).map((entry, index) => ({
        id: entry.id || Date.now() + index,
        type: entry.type || "period",
        startDate: entry.startDate,
        endDate: entry.endDate || "",
        flow: entry.flow || "Medium",
        mood: entry.mood || "N/A",
        moods: Array.isArray(entry.moods) && entry.moods.length ? entry.moods : (entry.mood ? [entry.mood] : ["N/A"]),
        symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
        notes: entry.notes || ""
      })));

      setImportText("");
      showMessage("Imported cycle data successfully.");
    } catch {
      showMessage("Import failed. Paste valid 4Sara JSON export data.");
    }
  };

  const tryUnlock = () => {
    if (pinAttempt === settings.pin) {
      setLocked(false);
      setPinAttempt("");
    } else {
      showMessage("Incorrect PIN.");
    }
  };

  const navItems = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "log", label: "Log", icon: Plus },
    { id: "insights", label: "Insights", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "privacy", label: "Privacy", icon: Lock },
    { id: "account", label: "Account", icon: Mail },
    { id: "mobile", label: "Mobile", icon: Home }
  ];

  if (!settings.welcomeSeen) {
    return <div className={settings.darkMode ? "app dark" : "app"}><WelcomeScreen onStart={() => updateSettings({ welcomeSeen: true })} onReturn={() => updateSettings({ welcomeSeen: true, onboardingComplete: true })} /></div>;
  }

  if (!settings.onboardingComplete) {
    return <div className={settings.darkMode ? "app dark" : "app"}><OnboardingScreen onboarding={onboarding} setOnboarding={setOnboarding} completeOnboarding={completeOnboarding} skipOnboarding={skipOnboarding} message={message} /></div>;
  }

  if (locked && settings.pinEnabled && settings.pin) {
    return (
      <div className={settings.darkMode ? "app dark" : "app"}>
        <div className="screen-center">
          <Card className="lock-card">
            <EyeOff className="big-icon" />
            <h1>4Sara is locked</h1>
            <p className="muted">Enter your PIN to open your tracker on this device.</p>
            <input className="center-input" type="password" value={pinAttempt} onChange={(event) => setPinAttempt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && tryUnlock()} placeholder="Enter PIN" />
            <Button onClick={tryUnlock} className="full">Unlock</Button>
            {message && <p className="message small-message">{message}</p>}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={settings.darkMode ? "app dark" : "app"}>
      <div className="container">
        <header className="header">
          <div>
            <div className="brand-row">
              <button className="brand-home-btn" onClick={() => updateSettings({ welcomeSeen: false })} aria-label="Return to welcome screen">
                <span className="brand-mini-logo" aria-hidden="true">
                  <img src="/icons/icon-192.png" alt="" />
                </span>
                <span>4Sara</span>
              </button>
              <div className="pill"><ShieldCheck size={16} /> Private cycle tracker</div>
            </div>
            <h1>{settings.profileName ? `Welcome back, ${settings.profileName}` : "4Sara"}</h1>
            <p className="muted">Track menstruation, symptoms, moods, reminders, fertility estimates, and cycle history.</p>
          </div>
          <div className="actions"><Button onClick={() => logToday("period")}><Plus size={16} /> Log Today</Button></div>
        </header>

        {message && <div className="message">{message}</div>}

        <nav className="tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => setActiveTab(item.id)} className={`tab ${activeTab === item.id ? "active" : ""}`}><Icon size={16} />{item.label}</button>;
          })}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.25, ease: "easeOut" }}>
            {activeTab === "dashboard" && <Dashboard stats={stats} settings={settings} sortedEntries={sortedEntries} startEdit={startEdit} deleteEntry={deleteEntry} jumpToNextPeriod={jumpToNextPeriod} previewReminder={previewReminder} setLocked={setLocked} />}
            {activeTab === "calendar" && <CalendarPanel calendarDate={calendarDate} calendarData={calendarData} moveMonth={(direction) => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))} onDayClick={(day) => { setSelectedCalendarDay(day); showMessage(`Selected ${formatDate(day)}.`); }} selectedCalendarDay={selectedCalendarDay} onLogSelectedDate={startLogForSelectedDate} />}
            {activeTab === "log" && <LogTab form={form} setForm={setForm} toggleSymptom={toggleSymptom} saveEntry={saveEntry} editingId={editingId} cancelEdit={() => { setEditingId(null); setForm(blankForm()); }} entries={sortedEntries} startEdit={startEdit} deleteEntry={deleteEntry} allSymptoms={allSymptoms} customSymptoms={settings.customSymptoms || []} customSymptomInput={customSymptomInput} setCustomSymptomInput={setCustomSymptomInput} addCustomSymptom={addCustomSymptom} removeCustomSymptom={removeCustomSymptom} selectedPhase={selectedPhase} />}
            {activeTab === "insights" && <Insights stats={stats} settings={settings} setLocked={setLocked} />}
            {activeTab === "settings" && <SettingsTab settings={settings} updateSettings={updateSettings} setLocked={setLocked} showMessage={showMessage} clearData={clearAllData} resetDemo={() => { setEntries(demoEntries); updateSettings({ onboardingComplete: true }); showMessage("Demo data restored."); }} importText={importText} setImportText={setImportText} importJson={importJson} sortedEntries={sortedEntries} stats={stats} />}
            {activeTab === "privacy" && <PrivacyPage settings={settings} setLocked={setLocked} clearData={clearAllData} exportJson={() => { downloadJson(entries, settings); showMessage("Backup downloaded."); }} exportCsv={() => { downloadCsv(sortedEntries); showMessage("Spreadsheet export downloaded."); }} />}
            {activeTab === "account" && <AccountPage authUser={authUser} authLoading={authLoading} authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} authError={authError} handleAuthSubmit={handleAuthSubmit} handleSignOut={handleSignOut} />}
            {activeTab === "mobile" && <MobileSetupPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}


function WelcomeScreen({ onStart, onReturn }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-shell">
        <div className="welcome-logo" aria-hidden="true">
          <img src="/icons/icon-192.png" alt="" />
        </div>

        <div className="pill"><ShieldCheck size={16} /> Private cycle tracker</div>

        <h1>Welcome to 4Sara</h1>

        <p className="welcome-lead">
          Your private cycle companion for tracking menstruation, symptoms, moods, phases, and patterns — all in one simple place.
        </p>

        <div className="welcome-highlights">
          <div>
            <Lock size={20} />
            <strong>Private by design</strong>
            <p>Your data stays on this device unless you choose to export it.</p>
          </div>
          <div>
            <CalendarDays size={20} />
            <strong>Track every phase</strong>
            <p>See menstruation, follicular, fertile, ovulation, and luteal estimates.</p>
          </div>
          <div>
            <Sparkles size={20} />
            <strong>Understand patterns</strong>
            <p>Use check-ins to uncover symptoms, moods, and helpful suggestions.</p>
          </div>
        </div>

        <div className="welcome-actions">
          <Button onClick={onStart}><Plus size={16} /> Get Started</Button>
          <Button onClick={onReturn} variant="secondary">I already use 4Sara</Button>
        </div>

        <p className="welcome-note">
          4Sara provides estimates and wellness tracking only. It should not be used as birth control or medical advice.
        </p>
      </div>
    </div>
  );
}

function OnboardingScreen({ onboarding, setOnboarding, completeOnboarding, skipOnboarding, message }) {
  return (
    <div className="screen-center">
      <Card className="onboarding-card">
        <div className="pill"><Sparkles size={16} /> First-time setup</div>
        <h1>Welcome to 4Sara</h1>
        <p className="muted">Answer a few quick questions so 4Sara can personalize your tracker and create a starting prediction. You can change these later in Settings.</p>
        {message && <div className="message">{message}</div>}
        <div className="form">
          <label><span>Name</span><input value={onboarding.profileName} onChange={(e) => setOnboarding({ ...onboarding, profileName: e.target.value })} placeholder="Enter name" /></label>
          <label><span>Age</span><input type="number" min="1" max="120" value={onboarding.profileAge} onChange={(e) => setOnboarding({ ...onboarding, profileAge: e.target.value })} placeholder="Enter age" /></label>
          <label><span>When did the last menstruation start?</span><input type="date" value={onboarding.lastPeriodStart} onChange={(e) => setOnboarding({ ...onboarding, lastPeriodStart: e.target.value })} /></label>
          <label><span>Average cycle length</span><input type="number" min="15" max="60" value={onboarding.averageCycleLength} onChange={(e) => setOnboarding({ ...onboarding, averageCycleLength: e.target.value })} /><small>Most people start with 28 days if they are unsure.</small></label>
          <label><span>Average menstruation length</span><input type="number" min="1" max="15" value={onboarding.averagePeriodLength} onChange={(e) => setOnboarding({ ...onboarding, averagePeriodLength: e.target.value })} /><small>Most people start with 5 days if they are unsure.</small></label>

          <div className="onboarding-optional">
            <p>Optional first-entry details</p>
            <small>You can choose N/A if you do not want to add these now.</small>
          </div>

          <label><span>Flow level</span><select value={onboarding.firstFlow} onChange={(e) => setOnboarding({ ...onboarding, firstFlow: e.target.value })}><option>N/A</option><option>N/A</option><option>Light</option><option>Medium</option><option>Heavy</option><option>Spotting</option></select></label>
          <label><span>Mood</span><select value={onboarding.firstMood} onChange={(e) => setOnboarding({ ...onboarding, firstMood: e.target.value })}>{moods.map((mood) => <option key={mood}>{mood}</option>)}</select></label>
        </div>
        <div className="two-actions">
          <Button onClick={completeOnboarding}><Save size={16} /> Create my tracker</Button>
          <Button onClick={skipOnboarding} variant="secondary">Skip setup</Button>
        </div>
      </Card>
    </div>
  );
}

function Dashboard({ stats, settings, sortedEntries, startEdit, deleteEntry, jumpToNextPeriod, previewReminder, setLocked }) {
  return (
    <main className="layout">
      <section className="main-col">
        <Card className="hero-card">
          <div className="hero">
            <div className="hero-row">
              <CalendarDays size={34} />
              <div><p>Next predicted menstruation</p><h2>{stats.nextPeriod ? formatDate(stats.nextPeriod) : "Add a cycle"}</h2></div>
            </div>
            {stats.nextPeriod && <p className="hero-sub">{stats.daysUntil > 0 ? `${stats.daysUntil} days away` : stats.daysUntil === 0 ? "Expected today" : `${Math.abs(stats.daysUntil)} days past prediction`}</p>}
          </div>
          <div className="stats">
            <StatCard icon={Droplet} label="Avg. cycle" value={`${stats.averageCycle} days`} />
            <StatCard icon={Moon} label="Avg. menstruation" value={`${stats.averagePeriod} days`} />
            <StatCard icon={HeartPulse} label="Last menstruation" value={stats.last ? formatDate(stats.last.startDate) : "None yet"} />
          </div>
        </Card>

        <Card className="pad">
          <div className="card-head">
            <h2>Upcoming</h2>
            <div className="actions">
              <Button onClick={jumpToNextPeriod} variant="secondary">Show next menstruation</Button>
              <Button onClick={previewReminder} variant="secondary">Preview reminder</Button>
            </div>
          </div>
          <div className="tiles">
            <InfoTile title="Predicted menstruation" value={stats.nextPeriod ? `${formatDate(stats.nextPeriod)} - ${formatDate(stats.predictedEnd)}` : "Not enough data"} />
            <InfoTile title="Fertile window" value={stats.fertileStart ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "Not enough data"} />
            <InfoTile title="Reminder" value={settings.remindersEnabled && stats.reminderDate ? formatDate(stats.reminderDate) : "Off"} />
          </div>
        </Card>
      </section>

      <aside className="side-col">
        <Card className="pad"><h2>Recent entries</h2><EntryList entries={sortedEntries.slice(0, 3)} onEdit={startEdit} onDelete={deleteEntry} compact /></Card>
        <PrivacyCard settings={settings} setLocked={setLocked} />
      </aside>
    </main>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return <div className="stat-card"><Icon size={24} /><p>{label}</p><strong>{value}</strong></div>;
}

function InfoTile({ title, value }) {
  return <div className="tile"><p>{title}</p><strong>{value}</strong></div>;
}

function CalendarPanel({ calendarDate, calendarData, moveMonth, onDayClick, selectedCalendarDay, onLogSelectedDate }) {
  const selectedDay = calendarData.find((day) => day.dateKey === selectedCalendarDay);

  return (
    <main>
      <Card className="pad">
        <div className="card-head">
          <div><h2>Calendar</h2><p className="muted">Tap a date to view details, then choose whether to log it.</p></div>
          <div className="month-controls">
            <button onClick={() => moveMonth(-1)} className="icon-btn"><ChevronLeft size={18} /></button>
            <strong>{monthName(calendarDate)}</strong>
            <button onClick={() => moveMonth(1)} className="icon-btn"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="phase-cards">
          <PhaseCard kind="rose" title="Menstruation" text="This is when bleeding happens and menstruation days are logged." />
          <PhaseCard kind="sky" title="Follicular" text="Your body is getting ready to release an egg, and energy may start to shift." />
          <PhaseCard kind="green" title="Fertile/Ovulation" text="These are the days pregnancy may be more likely; ovulation is the estimated egg-release day." />
          <PhaseCard kind="amber" title="Luteal" text="This is the phase before menstruation, when PMS-type symptoms may show up." />
          <PhaseCard kind="purple" title="Predicted" text="Estimated upcoming menstruation based on cycle history." />
          <PhaseCard kind="blue" title="Check-in" text="Saved mood, symptom, or note." />
        </div>

        <p className="calendar-note">Cycle phases and fertile timing are estimated up to 6 months ahead and should not be used as birth control or medical advice.</p>

        <div className="weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}</div>

        <div className="calendar-grid">
          {calendarData.map((day) => (
            <button key={day.key} disabled={day.empty} onClick={() => !day.empty && onDayClick(day.dateKey)} className={`day ${day.empty ? "empty" : ""} ${day.entry ? "period" : ""} ${!day.entry && day.isPredicted ? "predicted" : ""} ${!day.entry && !day.isPredicted && (day.isFertile || day.isOvulation) ? "fertile" : ""} ${day.isFollicular ? "follicular" : ""} ${day.isLuteal ? "luteal" : ""} ${day.isToday ? "today-outline" : ""} ${selectedCalendarDay === day.dateKey ? "selected" : ""}`}>
              {!day.empty && <>
                <b>{day.dayNumber}</b>
                {day.entry && <small>Menstruation</small>}
                {!day.entry && day.isPredicted && <small>Predicted</small>}
                {!day.entry && !day.isPredicted && day.isOvulation && <small>Ovulation</small>}
                {!day.entry && !day.isPredicted && !day.isOvulation && day.isFertile && <small>Fertile</small>}
                {!day.entry && !day.isPredicted && !day.isOvulation && !day.isFertile && day.isFollicular && <small>Follicular</small>}
                {!day.entry && !day.isPredicted && !day.isOvulation && !day.isFertile && day.isLuteal && <small>Luteal</small>}
                {day.checkIns?.length > 0 && <small>Check-in</small>}
              </>}
            </button>
          ))}
        </div>

        {selectedDay && !selectedDay.empty && (
          <div className="selected-card selected-card-enhanced">
            <div className="selected-main">
              <p className="muted">Selected date</p>
              <h3>{formatDate(selectedCalendarDay)}</h3>

              <div className="selected-detail-grid">
                <div>
                  <span>Estimated phase</span>
                  <strong>{selectedDay.phaseLabel || "Unknown"}</strong>
                </div>
                <div>
                  <span>Cycle day</span>
                  <strong>{selectedDay.cycleDay ? `Day ${selectedDay.cycleDay}` : "Not enough data"}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{selectedDay.statusLabel}</strong>
                </div>
              </div>

              <p className="phase-meaning">{selectedDay.phaseDescription || "Add more cycle data to estimate this day."}</p>

              <div className="chips">
                {selectedDay.entry && <span className="chip rose-chip">Menstruation day</span>}
                {!selectedDay.entry && selectedDay.isPredicted && <span className="chip purple-chip">Predicted menstruation</span>}
                {!selectedDay.entry && selectedDay.isFertile && <span className="chip green-chip">Fertile estimate</span>}
                {selectedDay.isFollicular && <span className="chip sky-chip">Follicular phase</span>}
                {selectedDay.isLuteal && <span className="chip amber-chip">Luteal phase</span>}
                {selectedDay.isOvulation && <span className="chip green-chip">Estimated ovulation</span>}
                {selectedDay.checkIns?.length > 0 && <span className="chip blue-chip">Daily check-in saved</span>}
                {selectedDay.isToday && <span className="chip gray-chip">Today</span>}
                {selectedDay.isFuture && <span className="chip gray-chip">Future date</span>}
                {!selectedDay.phaseLabel && !selectedDay.isToday && (!selectedDay.checkIns || !selectedDay.checkIns.length) && <span className="chip gray-chip">No details yet</span>}
              </div>

              <p className="phase-tip">Phase labels are estimates based on the last menstruation date, average cycle length, and predicted ovulation. Timing can shift.</p>
            </div>

            <div className="actions selected-actions">
              {selectedDay.isFuture ? (
                <p className="future-note">Future dates show predictions only. You can log menstruation or daily check-ins once the date arrives.</p>
              ) : (
                <>
                  <Button onClick={() => onLogSelectedDate(selectedCalendarDay, "period")}><Plus size={16} /> Log menstruation</Button>
                  <Button onClick={() => onLogSelectedDate(selectedCalendarDay, "checkin")} variant="secondary"><Smile size={16} /> Daily check-in</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}

function PhaseCard({ kind, title, text }) {
  return <div className={`phase-card ${kind}`}><div className="phase-title"><span className={`dot ${kind}`} /><strong>{title}</strong></div><p>{text}</p></div>;
}

function LogTab(props) {
  return <main className="layout"><section className="side-col"><LogForm {...props} /></section><section className="main-col"><Card className="pad"><h2>All entries</h2><EntryList entries={props.entries} onEdit={props.startEdit} onDelete={props.deleteEntry} /></Card></section></main>;
}

function LogForm({ form, setForm, toggleSymptom, saveEntry, editingId, cancelEdit, allSymptoms, customSymptoms, customSymptomInput, setCustomSymptomInput, addCustomSymptom, removeCustomSymptom, selectedPhase }) {
  return (
    <Card className="pad">
      <h2>{editingId ? "Edit entry" : form.type === "checkin" ? "Add daily check-in" : "Add menstruation entry"}</h2>
      <div className="form">
        <div>
          <span className="label">Entry type</span>
          <div className="two-actions">
            <button onClick={() => setForm({ ...form, type: "period" })} className={`choice ${form.type !== "checkin" ? "active" : ""}`}>Menstruation</button>
            <button onClick={() => setForm({ ...form, type: "checkin", endDate: "" })} className={`choice ${form.type === "checkin" ? "active" : ""}`}>Daily check-in</button>
          </div>
        </div>

        <label><span>Date</span><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        {form.type === "checkin" && selectedPhase?.phase && (
          <div className={`phase-preview ${selectedPhase.phase.toLowerCase()}`}>
            <strong>Estimated phase: {selectedPhase.phase}</strong>
            <p>{phaseDescription(selectedPhase.phase)}</p>
          </div>
        )}
        {form.type !== "checkin" && <label><span>End date</span><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>}
        {form.type !== "checkin" && <label><span>Flow level</span><select value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })}><option>N/A</option><option>Light</option><option>Medium</option><option>Heavy</option><option>Spotting</option></select></label>}

        <div>
          <span className="label">Mood</span>
          <div className="choice-grid">
            {moods.map((mood) => (
              <button
                key={mood}
                onClick={() => {
                  const nextMoods = toggleMoodSelection(form.moods, mood);
                  setForm({ ...form, moods: nextMoods, mood: nextMoods.filter((item) => item !== "N/A").join(", ") || "N/A" });
                }}
                className={`choice ${normalizeMoods(form).includes(mood) ? "active" : ""}`}
              >
                {mood}
              </button>
            ))}
          </div>
          <small className="field-help">Select one or more moods. Choose N/A if you do not want to track mood today.</small>
        </div>

        <div>
          <span className="label">Symptoms</span>
          <div className="symptom-grid">{allSymptoms.map((symptom) => <button key={symptom} onClick={() => toggleSymptom(symptom)} className={`symptom ${form.symptoms.includes(symptom) ? "active" : ""}`}>{symptom}</button>)}</div>
          <div className="custom-symptom"><input value={customSymptomInput} onChange={(e) => setCustomSymptomInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomSymptom()} placeholder="Add custom symptom" /><Button onClick={addCustomSymptom} variant="secondary">Add</Button></div>
          {customSymptoms.length > 0 && <div className="custom-list"><p>Custom symptoms</p><div className="chips">{customSymptoms.map((symptom) => <button key={symptom} onClick={() => removeCustomSymptom(symptom)} className="chip rose-chip">{symptom} ×</button>)}</div></div>}
        </div>

        <label><span>Notes</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add anything you noticed..." /></label>
        <Button onClick={saveEntry} className="full"><Save size={16} /> {editingId ? "Update entry" : "Save entry"}</Button>
        {editingId && <Button onClick={cancelEdit} variant="secondary" className="full"><X size={16} /> Cancel edit</Button>}
      </div>
    </Card>
  );
}

function EntryList({ entries, onEdit, onDelete, compact = false }) {
  if (!entries.length) return <p className="empty">No entries yet. Add a menstruation start date to begin tracking.</p>;

  return (
    <div className="entries">
      {entries.map((entry) => (
        <div key={entry.id} className="entry">
          <div className="entry-head">
            <div>
              <strong>{formatDate(entry.startDate)} {entry.endDate && (entry.type || "period") !== "checkin" ? `- ${formatDate(entry.endDate)}` : ""}</strong>
              <p className="muted">{(entry.type || "period") === "checkin" ? "Daily check-in" : `Flow: ${entry.flow || "N/A"}`} • Mood: {moodLabel(entry)}</p>
            </div>
            <div>
              <button onClick={() => onEdit(entry)} className="icon-btn"><Pencil size={16} /></button>
              <button onClick={() => onDelete(entry.id)} className="icon-btn"><Trash2 size={16} /></button>
            </div>
          </div>
          {!compact && entry.symptoms?.length > 0 && <div className="chips">{entry.symptoms.map((symptom) => <span key={symptom} className="chip rose-chip">{symptom}</span>)}</div>}
          {!compact && entry.notes && <p>{entry.notes}</p>}
        </div>
      ))}
    </div>
  );
}

function Insights({ stats, settings, setLocked }) {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Sparkles size={20} /> Insights</h2>

        <div className="confidence">
          <div><p className="muted">Data confidence</p><h3>{stats.dataConfidence}</h3></div>
          <span>{stats.totalEntries} logged {stats.totalEntries === 1 ? "cycle" : "cycles"}</span>
          <p>{stats.confidenceNote}</p>
        </div>

        <div className="tiles">
          <InfoTile title="Current cycle day" value={stats.currentCycleDay ? `Day ${stats.currentCycleDay}` : "Not enough data"} />
          <InfoTile title="Logged cycles" value={`${stats.totalEntries}`} />
          <InfoTile title="Average cycle" value={`${stats.averageCycle} days`} />
          <InfoTile title="Average menstruation" value={`${stats.averagePeriod} days`} />
          <InfoTile title="Cycle range" value={stats.minCycle ? `${stats.minCycle} - ${stats.maxCycle} days` : "Log 2+ cycles"} />
          <InfoTile title="Estimated ovulation" value={stats.ovulationDay ? formatDate(stats.ovulationDay) : "Not enough data"} />
        </div>

        <div className="summary-box purple-box">
          <h3>Phase patterns</h3>
          {stats.phaseInsights?.length ? <div className="phase-insights">{stats.phaseInsights.map((item) => <div key={item.phase} className="mini-card"><strong>{item.phase}</strong>{item.topSymptoms.length > 0 && <p>Top symptoms: {item.topSymptoms.map(([symptom, count]) => `${symptom} (${count})`).join(", ")}</p>}{item.topMood && <p>Common mood: {item.topMood[0]}</p>}</div>)}</div> : <p className="muted">Add daily check-ins and symptoms to see phase patterns.</p>}
        </div>

        <div className="summary-box blue-box">
          <h3>Daily check-ins by phase</h3>
          <p className="muted">4Sara keeps the daily check-in simple, then automatically groups each check-in by the phase estimated for that calendar day.</p>
          {stats.checkInPhaseInsights?.length ? (
            <div className="phase-insights">
              {stats.checkInPhaseInsights.map((item) => (
                <div key={item.phase} className="mini-card">
                  <strong>{item.phase}</strong>
                  <p>{item.count} daily {item.count === 1 ? "check-in" : "check-ins"}</p>
                  {item.topSymptoms.length > 0 && <p>Common symptoms: {item.topSymptoms.map(([symptom, count]) => `${symptom} (${count})`).join(", ")}</p>}
                  {item.topMood && <p>Common mood: {item.topMood[0]}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Add daily check-ins to see them separated by phase.</p>
          )}
        </div>

        <div className="summary-box green-box">
          <h3>4Sara Suggestions</h3>
          {stats.dynamicSuggestions?.length ? <div className="suggestions">{stats.dynamicSuggestions.map((suggestion, index) => <div key={`${suggestion.title}-${index}`} className="mini-card"><strong>{suggestion.title}</strong><ul><li><b>Food:</b> {suggestion.food}</li><li><b>Movement:</b> {suggestion.movement}</li><li><b>Comfort:</b> {suggestion.comfort}</li></ul></div>)}</div> : <p className="muted">Add more symptoms and check-ins to unlock personalized suggestions.</p>}
          <p className="disclaimer">Suggestions are general wellness ideas, not medical advice. Ask a healthcare professional before starting supplements or if symptoms are severe, unusual, or persistent.</p>
        </div>

        <div className="summary-box">
          <h3>Symptom counts</h3>
          {stats.symptomStats.length ? <div className="count-grid">{stats.symptomStats.slice(0, 8).map(([symptom, count]) => <div key={symptom} className="count-row"><span>{symptom}</span><strong>{count}</strong></div>)}</div> : <p className="muted">Add symptoms to see patterns.</p>}
        </div>
      </Card>

      <PrivacyCard settings={settings} setLocked={setLocked} />
    </main>
  );
}

function SettingsTab({ settings, updateSettings, setLocked, showMessage, clearData, resetDemo, importText, setImportText, importJson, sortedEntries, stats }) {
  return (
    <main className="settings-grid">
      <Card className="pad">
        <h2><Bell size={20} /> Profile & settings</h2>
        <div className="two-fields">
          <label><span>Name</span><input value={settings.profileName || ""} onChange={(e) => updateSettings({ profileName: e.target.value })} /></label>
          <label><span>Age</span><input type="number" min="1" max="120" value={settings.profileAge || ""} onChange={(e) => updateSettings({ profileAge: e.target.value })} /></label>
        </div>

        <h3>Reminders & predictions</h3>

        <label className="setting-row"><span>Dark mode</span><input type="checkbox" checked={settings.darkMode} onChange={(e) => updateSettings({ darkMode: e.target.checked })} /></label>
        <label className="setting-row"><span>Reminder enabled</span><input type="checkbox" checked={settings.remindersEnabled} onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })} /></label>

        <div className="three-fields">
          <NumberField label="Days before" value={settings.reminderDaysBefore} onChange={(value) => updateSettings({ reminderDaysBefore: value })} min="0" max="14" />
          <NumberField label="Cycle override" value={settings.cycleLengthOverride} onChange={(value) => updateSettings({ cycleLengthOverride: value })} placeholder="Auto" min="15" max="60" />
          <NumberField label="Menstruation override" value={settings.periodLengthOverride} onChange={(value) => updateSettings({ periodLengthOverride: value })} placeholder="Auto" min="1" max="15" />
        </div>
      </Card>

      <Card className="pad">
        <h2><KeyRound size={20} /> Privacy & PIN</h2>
        <label className="setting-row"><span>Enable PIN lock</span><input type="checkbox" checked={settings.pinEnabled} onChange={(e) => updateSettings({ pinEnabled: e.target.checked })} /></label>
        <label className="form single"><span>PIN</span><input type="password" value={settings.pin} onChange={(e) => updateSettings({ pin: e.target.value })} placeholder="Create a simple PIN" /></label>
        <div className="two-actions">
          <Button onClick={() => settings.pinEnabled && settings.pin ? setLocked(true) : showMessage("Turn on PIN and enter a PIN first.")} variant="secondary">Lock now</Button>
          <Button onClick={clearData} variant="secondary">Clear data</Button>
          <Button onClick={resetDemo} variant="secondary" className="full">Restore demo data</Button>
        </div>
      </Card>

      <Card className="pad wide">
        <h2><Download size={20} /> Data tools</h2>
        <p className="muted">Backup, restore, export to spreadsheet, or open a printable doctor summary report.</p>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste exported JSON here..." />
        <div className="actions">
          <Button onClick={() => { downloadJson(sortedEntries, settings); showMessage("Backup downloaded."); }} variant="secondary">Backup JSON</Button>
          <Button onClick={importJson}>Restore JSON</Button>
          <Button onClick={() => { downloadCsv(sortedEntries); showMessage("Spreadsheet export downloaded."); }} variant="secondary">Spreadsheet CSV</Button>
          <Button onClick={() => showMessage(printReport(sortedEntries, stats) ? "Report opened. Use Print or Save as PDF." : "Pop-up blocked. Allow pop-ups to print the report.")} variant="secondary">Doctor report</Button>
        </div>
      </Card>
    </main>
  );
}

function NumberField({ label, value, onChange, placeholder, min, max }) {
  return <label className="form single"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function PrivacyPage({ settings, setLocked, clearData, exportJson, exportCsv }) {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Lock size={20} /> Privacy</h2>
        <div className="info-box rose-box"><h3>What 4Sara stores right now</h3><p>This prototype stores menstruation entries, check-ins, symptoms, moods, notes, settings, custom symptoms, name, age, and PIN settings in this browser only using local storage.</p></div>
        <div className="info-box purple-box"><h3>What 4Sara does not do yet</h3><p>This version does not have online accounts, cloud syncing, a shared database, app-store push notifications, or server-side storage.</p></div>
        <div className="info-box"><h3>Privacy controls</h3><div className="actions"><Button onClick={exportJson} variant="secondary"><Download size={16} /> Backup data</Button><Button onClick={exportCsv} variant="secondary"><Download size={16} /> Spreadsheet export</Button><Button onClick={clearData} variant="secondary"><Trash2 size={16} /> Clear data</Button></div></div>
        <div className="info-box amber-box"><h3>Before making this public</h3><p>A production version should add a real Privacy Policy, Terms of Use, secure account login, encrypted database storage, account deletion, and legal review because menstrual-cycle data is sensitive health-related information.</p></div>
      </Card>

      <Card className="pad side-col">
        <h3>Quick status</h3>
        <InfoTile title="Profile" value={settings.profileName ? `${settings.profileName}${settings.profileAge ? `, ${settings.profileAge}` : ""}` : "Not set"} />
        <InfoTile title="Storage" value="This browser only" />
        <InfoTile title="Cloud account" value="Not active" />
        <InfoTile title="PIN lock" value={settings.pinEnabled && settings.pin ? "Available" : "Off"} />
        {settings.pinEnabled && settings.pin && <Button onClick={() => setLocked(true)} variant="secondary" className="full">Lock now</Button>}
      </Card>
    </main>
  );
}


function AccountPage({ authUser, authLoading, authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword, authError, handleAuthSubmit, handleSignOut }) {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Mail size={20} /> Account</h2>

        {authLoading ? (
          <p className="muted">Checking account status...</p>
        ) : authUser ? (
          <div className="account-signed-in">
            <div className="info-box green-box">
              <h3>Signed in</h3>
              <p>You are signed in as:</p>
              <strong>{authUser.email}</strong>
            </div>

            <div className="info-box amber-box">
              <h3>Cloud sync is coming next</h3>
              <p>This phase adds login only. Your 4Sara data is still saved on this device until cloud sync is added in the next update.</p>
            </div>

            <Button onClick={handleSignOut} variant="secondary">Sign out</Button>
          </div>
        ) : (
          <div className="auth-panel">
            <div className="auth-mode-tabs">
              <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Log in</button>
              <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Create account</button>
            </div>

            <div className="form">
              <label>
                <span>Email</span>
                <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
              </label>

              <label>
                <span>Password</span>
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" />
              </label>

              {authError && <p className="auth-error">{authError}</p>}

              <Button onClick={handleAuthSubmit} className="full">
                {authMode === "signup" ? "Create account" : "Log in"}
              </Button>
            </div>

            <p className="auth-note">This first phase only adds account access. Cloud syncing for entries and settings will be added after login is tested.</p>
          </div>
        )}
      </Card>

      <Card className="pad side-col">
        <h3>What accounts will unlock</h3>
        <div className="mini-card"><strong>Device sync</strong><p>Use 4Sara on a phone, laptop, or new browser.</p></div>
        <div className="mini-card"><strong>Safer backup</strong><p>Reduce the risk of losing data if browser storage is cleared.</p></div>
        <div className="mini-card"><strong>Cloud controls</strong><p>Next steps should include export, delete data, and privacy controls.</p></div>
      </Card>
    </main>
  );
}

function MobileSetupPage() {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Home size={20} /> Add 4Sara to your phone</h2>
        <p className="muted">4Sara is a website right now, but you can save it to your phone home screen so it opens like an app.</p>
        <div className="two-panels">
          <div className="info-box rose-box"><h3>iPhone / Safari</h3><ol><li>Open the 4Sara website in Safari.</li><li>Tap the Share button.</li><li>Tap Add to Home Screen.</li><li>Tap Add.</li></ol></div>
          <div className="info-box purple-box"><h3>Android / Chrome</h3><ol><li>Open the 4Sara website in Chrome.</li><li>Tap the three-dot menu.</li><li>Tap Add to Home screen or Install app.</li><li>Tap Add or Install.</li></ol></div>
        </div>
        <div className="info-box"><h3>What this does</h3><p>This creates a 4Sara icon on the phone home screen. The app still uses browser storage, so data stays on that device unless exported.</p></div>
      </Card>
      <Card className="pad side-col"><h3>Future mobile upgrade</h3><p className="muted">The next step would be adding a real app icon, web manifest, and offline support so 4Sara behaves even more like an installed mobile app.</p></Card>
    </main>
  );
}

function PrivacyCard({ settings, setLocked }) {
  return <Card className="pad"><h2><Lock size={20} /> Privacy</h2><p className="muted">This prototype stores data only in this browser. For a public app, use encrypted storage, secure accounts, clear delete/export tools, and strict privacy terms.</p>{settings.pinEnabled && settings.pin && <Button onClick={() => setLocked(true)} variant="secondary" className="full">Lock now</Button>}</Card>;
}

createRoot(document.getElementById("root")).render(<App />);
