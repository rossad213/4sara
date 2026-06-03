
import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
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
const CLOUD_CHOICE_KEY = "4sara_cloud_choice_by_user";

const firebaseConfig = {
  apiKey: "AIzaSyDkzvywYKkGnj65WP-Yu24a_6NMypghFcU",
  authDomain: "sara-e6444.firebaseapp.com",
  projectId: "sara-e6444",
  storageBucket: "sara-e6444.firebasestorage.app",
  messagingSenderId: "906937325627",
  appId: "1:906937325627:web:12b1468db2d201912e241e"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


const demoEntries = [
  { id: 1, type: "period", startDate: "2026-04-28", endDate: "2026-05-02", flow: "Medium", mood: "Calm", symptoms: ["Cramps", "Fatigue"], notes: "Mild cramps on day one." },
  { id: 2, type: "period", startDate: "2026-05-26", endDate: "2026-05-30", flow: "Light", mood: "Sensitive", symptoms: ["Bloating", "Back pain"], notes: "Started lighter than normal." }
];

const defaultSettings = {
  welcomeSeen: false,
  accountPromptSeen: false,
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

function validateStrongPassword(password) {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  return {
    valid: hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialCharacter,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialCharacter
  };
}

function passwordRequirementMessage() {
  return "Password must be at least 8 characters and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.";
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

  const displayMoods = (entry) => {
    const moods = Array.isArray(entry.moods) && entry.moods.length ? entry.moods : (entry.mood ? [entry.mood] : ["N/A"]);
    return moods.filter((mood) => mood && mood !== "N/A").join(", ") || "N/A";
  };

  const displaySymptoms = (entry) => {
    const symptoms = Array.isArray(entry.symptoms) ? entry.symptoms : [];
    return symptoms.length ? symptoms.join(", ") : "None listed";
  };

  const phaseRows = (stats.checkInPhaseInsights || []).map((item) => `
    <tr>
      <td>${item.phase}</td>
      <td>${item.count}</td>
      <td>${item.topSymptoms?.length ? item.topSymptoms.map(([symptom, count]) => `${symptom} (${count})`).join(", ") : "None listed"}</td>
      <td>${item.topMood ? item.topMood[0] : "None listed"}</td>
    </tr>
  `).join("");

  const symptomRows = (stats.symptomStats || []).slice(0, 10).map(([symptom, count]) => `
    <tr>
      <td>${symptom}</td>
      <td>${count}</td>
    </tr>
  `).join("");

  const recentRows = [...entries]
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
    .slice(0, 25)
    .map((entry) => `
      <tr>
        <td>${formatDate(entry.startDate)}${entry.endDate ? ` - ${formatDate(entry.endDate)}` : ""}</td>
        <td>${(entry.type || "period") === "checkin" ? "Daily check-in" : "Menstruation"}</td>
        <td>${(entry.type || "period") === "checkin" ? "N/A" : (entry.flow || "N/A")}</td>
        <td>${displayMoods(entry)}</td>
        <td>${displaySymptoms(entry)}</td>
        <td>${entry.notes || ""}</td>
      </tr>
    `).join("");

  const html = `<!doctype html>
  <html>
    <head>
      <title>4Sara Doctor Summary Report</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1f2937;padding:32px;line-height:1.45}
        h1{color:#be123c;margin-bottom:4px}
        h2{margin-top:26px;color:#9f1239}
        .muted{color:#6b7280}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0 20px}
        .card{border:1px solid #fecdd3;border-radius:14px;background:#fff1f2;padding:12px}
        .label{font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .value{font-size:18px;font-weight:800;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top}
        th{background:#fff1f2;color:#9f1239}
        .disclaimer{border:1px solid #fde68a;background:#fffbeb;border-radius:14px;padding:14px;margin-top:24px;font-size:13px}
        button{border:1px solid #ddd;border-radius:999px;background:white;padding:10px 14px;margin-bottom:20px;font-weight:700}
        @media print{button{display:none}body{padding:0}.card{break-inside:avoid}}
      </style>
    </head>
    <body>
      <button onclick="window.print()">Print / Save as PDF</button>
      <h1>4Sara Doctor Summary Report</h1>
      <p class="muted">Generated ${new Date().toLocaleString()}</p>

      <h2>Cycle Summary</h2>
      <div class="grid">
        <div class="card"><div class="label">Average cycle length</div><div class="value">${stats.averageCycle || "N/A"} days</div></div>
        <div class="card"><div class="label">Average menstruation length</div><div class="value">${stats.averagePeriod || "N/A"} days</div></div>
        <div class="card"><div class="label">Last menstruation</div><div class="value">${stats.last?.startDate ? formatDate(stats.last.startDate) : "N/A"}</div></div>
        <div class="card"><div class="label">Next predicted menstruation</div><div class="value">${stats.nextPeriod ? formatDate(stats.nextPeriod) : "N/A"}</div></div>
        <div class="card"><div class="label">Estimated fertile window</div><div class="value">${stats.fertileStart && stats.fertileEnd ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "N/A"}</div></div>
        <div class="card"><div class="label">Estimated ovulation</div><div class="value">${stats.ovulationDay ? formatDate(stats.ovulationDay) : "N/A"}</div></div>
        <div class="card"><div class="label">Menstruation entries</div><div class="value">${menstruationEntries.length}</div></div>
        <div class="card"><div class="label">Daily check-ins</div><div class="value">${checkIns.length}</div></div>
      </div>

      <h2>Common Symptoms</h2>
      ${symptomRows ? `<table><thead><tr><th>Symptom</th><th>Times logged</th></tr></thead><tbody>${symptomRows}</tbody></table>` : `<p class="muted">No symptom patterns recorded yet.</p>`}

      <h2>Daily Check-ins by Estimated Phase</h2>
      ${phaseRows ? `<table><thead><tr><th>Estimated phase</th><th>Check-ins</th><th>Common symptoms</th><th>Common mood</th></tr></thead><tbody>${phaseRows}</tbody></table>` : `<p class="muted">No phase-based check-in patterns recorded yet.</p>`}

      <h2>Recent Entries</h2>
      ${recentRows ? `<table><thead><tr><th>Date</th><th>Type</th><th>Flow</th><th>Mood(s)</th><th>Symptoms</th><th>Notes</th></tr></thead><tbody>${recentRows}</tbody></table>` : `<p class="muted">No entries recorded yet.</p>`}

      <div class="disclaimer">
        <strong>Important disclaimer:</strong>
        This report is for personal tracking and discussion with a healthcare professional. 4Sara is not medical advice, not a medical device, and should not be used as birth control. Cycle phases, fertile windows, ovulation dates, and menstruation predictions are estimates only.
      </div>
    </body>
  </html>`;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  return true;
}

function Button({ children, onClick, variant = "primary", className = "", disabled = false }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`btn ${variant === "secondary" ? "btn-secondary" : ""} ${className}`}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}


class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Something went wrong." };
  }

  componentDidCatch(error) {
    console.error("4Sara screen error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="container">
            <Card className="pad">
              <h2>4Sara had trouble loading this screen</h2>
              <p className="muted">Refresh the page. If this keeps happening, clear site data and reopen 4Sara.</p>
              <p className="auth-error">{this.state.message}</p>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}




function getOwnDisplayName(settings, authUser) {
  return settings?.profileName?.trim() || authUser?.email || "My 4Sara";
}


function getCurrentProjectedPhase(stats, entries) {
  const projectedMap = buildProjectedCycleMap(stats?.last?.startDate, stats?.averageCycle || 28, stats?.averagePeriod || 5, 6);
  const todayProjection = projectedMap.get(todayKey());
  if (todayProjection?.phase) return todayProjection.phase;

  return inferPhase(
    todayKey(),
    (entries || []).filter((entry) => (entry.type || "period") === "period"),
    stats?.averageCycle || 28,
    stats?.averagePeriod || 5
  );
}

function getSharedDisplayName(ownerSettings, ownerDoc, fallbackProfile) {
  return ownerSettings?.profileName?.trim()
    || ownerDoc?.data?.settings?.profileName?.trim()
    || fallbackProfile?.displayName
    || fallbackProfile?.ownerEmail
    || "Shared 4Sara";
}

function daysUntilDate(dateString) {
  if (!dateString) return null;
  return Math.ceil((new Date(dateString) - new Date()) / 86400000);
}

function friendlyPermissionMessage(message) {
  const text = String(message || "");
  if (text.toLowerCase().includes("permission") || text.toLowerCase().includes("insufficient")) {
    return "You may not have access to this shared view anymore. Ask the owner to send a new invite.";
  }
  return text || "Something went wrong. Please try again.";
}


function getCloudChoiceMap() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_CHOICE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getCloudChoice(userId) {
  if (!userId) return null;
  return getCloudChoiceMap()[userId] || null;
}

function rememberCloudChoice(userId, choice) {
  if (!userId || !choice) return;
  const current = getCloudChoiceMap();
  current[userId] = {
    choice,
    rememberedAt: new Date().toISOString()
  };
  localStorage.setItem(CLOUD_CHOICE_KEY, JSON.stringify(current));
}

function clearCloudChoice(userId) {
  if (!userId) return;
  const current = getCloudChoiceMap();
  delete current[userId];
  localStorage.setItem(CLOUD_CHOICE_KEY, JSON.stringify(current));
}

async function rememberCloudChoiceForAccount(user, choice) {
  if (!user || !choice) return;

  rememberCloudChoice(user.uid, choice);

  await setDoc(doc(db, "users", user.uid), {
    email: user.email || "",
    cloudPreference: {
      choice,
      updatedAt: new Date().toISOString()
    }
  }, { merge: true });
}

async function clearCloudChoiceForAccount(user) {
  if (!user) return;

  clearCloudChoice(user.uid);

  await setDoc(doc(db, "users", user.uid), {
    cloudPreference: {
      choice: "",
      clearedAt: new Date().toISOString()
    }
  }, { merge: true });
}

function calculateStatsForEntries(sourceEntries, sourceSettings) {
  const safeEntries = Array.isArray(sourceEntries) ? sourceEntries : [];
  const safeSettings = { ...defaultSettings, ...(sourceSettings || {}) };

  const periodEntries = safeEntries.filter((entry) => (entry.type || "period") === "period");
  const chronological = [...periodEntries].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const last = chronological[chronological.length - 1];

  const cycleLengths = [];
  for (let i = 1; i < chronological.length; i++) {
    cycleLengths.push(daysBetween(chronological[i - 1].startDate, chronological[i].startDate));
  }

  const calculatedCycle = cycleLengths.length ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) : 28;
  const periodLengths = chronological.filter((entry) => entry.endDate).map((entry) => daysBetween(entry.startDate, entry.endDate) + 1);
  const calculatedPeriod = periodLengths.length ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length) : 5;

  const averageCycle = Number(safeSettings.cycleLengthOverride) || calculatedCycle;
  const averagePeriod = Number(safeSettings.periodLengthOverride) || calculatedPeriod;
  const nextPeriod = last ? addDays(last.startDate, averageCycle) : "";
  const predictedEnd = nextPeriod ? addDays(nextPeriod, averagePeriod - 1) : "";
  const ovulationDay = nextPeriod ? addDays(nextPeriod, -14) : "";
  const fertileStart = ovulationDay ? addDays(ovulationDay, -5) : "";
  const fertileEnd = ovulationDay ? addDays(ovulationDay, 1) : "";
  const reminderDate = nextPeriod ? addDays(nextPeriod, -Number(safeSettings.reminderDaysBefore || 0)) : "";
  const daysUntil = nextPeriod ? daysBetween(todayKey(), nextPeriod) : null;

  const symptomStats = Object.entries(safeEntries.flatMap((entry) => entry.symptoms || []).reduce((acc, symptom) => {
    acc[symptom] = (acc[symptom] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const phaseSymptoms = {};
  const phaseMoods = {};

  safeEntries.forEach((entry) => {
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

  safeEntries
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
  const [viewMode, setViewMode] = useState("owner");
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
  const [authNotice, setAuthNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState("Cloud sync is ready.");
  const [syncBusy, setSyncBusy] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastCloudSave, setLastCloudSave] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudCheckedForAccount, setCloudCheckedForAccount] = useState(false);
  const [cloudSyncAllowed, setCloudSyncAllowed] = useState(false);
  const [accountDataChecked, setAccountDataChecked] = useState(false);
  const [cloudHasData, setCloudHasData] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState("");
  const [confirmDeleteCloud, setConfirmDeleteCloud] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [pendingInvite, setPendingInvite] = useState(null);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [sharedProfiles, setSharedProfiles] = useState({});
  const [supportViewers, setSupportViewers] = useState({});
  const [confirmRevokeViewerId, setConfirmRevokeViewerId] = useState("");
  const [confirmRemoveSharedOwnerId, setConfirmRemoveSharedOwnerId] = useState("");
  const [selectedSharedOwnerId, setSelectedSharedOwnerId] = useState("");
  const [sharedSupportData, setSharedSupportData] = useState(null);
  const [sharedSupportStatus, setSharedSupportStatus] = useState("");
  const [customSymptomInput, setCustomSymptomInput] = useState("");
  const [onboarding, setOnboarding] = useState({ profileName: "", profileAge: "", lastPeriodStart: todayKey(), averageCycleLength: "28", averagePeriodLength: "5", firstFlow: "N/A", firstMood: "N/A", consentAccepted: false });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      setCloudReady(Boolean(user));
      setCloudCheckedForAccount(false);
      setAccountDataChecked(false);
      setExistingAccountLoaded(false);
      setCloudSyncAllowed(false);
      setCloudHasData(false);
      setSupportViewers({});
      setConfirmRevokeViewerId("");
      setConfirmRemoveSharedOwnerId("");
      setSelectedSharedOwnerId("");
      setSharedSupportData(null);
      setCloudUpdatedAt("");
      setConfirmDeleteAccount(false);
      setSyncStatus(user ? "Signed in. Cloud sync is ready." : "Signed out. Data is saved locally on this device.");
    });

    return unsubscribe;
  }, []);

  useEffect(() => { if (settings.pinEnabled && settings.pin) setLocked(true); }, []);

  useEffect(() => {
    const readInviteFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get("invite");

      if (!token && window.location.hash) {
        const hashQuery = window.location.hash.includes("?")
          ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
          : window.location.hash.replace("#", "");
        const hashParams = new URLSearchParams(hashQuery);
        token = hashParams.get("invite");
      }

      if (token) {
        setInviteToken(token);
        setActiveTab("account");
        setInviteStatus("Support invite found. Log in or create an account to accept it.");
        showMessage("Support invite found.");
      }
    };

    readInviteFromUrl();
    window.addEventListener("popstate", readInviteFromUrl);
    window.addEventListener("focus", readInviteFromUrl);

    return () => {
      window.removeEventListener("popstate", readInviteFromUrl);
      window.removeEventListener("focus", readInviteFromUrl);
    };
  }, []);


  useEffect(() => {
    if (!authUser || cloudCheckedForAccount) return;
    checkCloudDataForAccount(authUser);
  }, [authUser, cloudCheckedForAccount]);

  useEffect(() => {
    if (!authUser && !authLoading) {
      setAccountDataChecked(true);
    }
  }, [authUser, authLoading]);


  useEffect(() => {
    if (!inviteToken) return;
    checkSupportInvite(inviteToken);
  }, [inviteToken]);

  useEffect(() => {
    if (viewMode !== "support") {
      setSharedSupportData(null);
      setSharedSupportStatus("");
      return;
    }

    if (!selectedSharedOwnerId) {
      setSharedSupportData(null);
      setSharedSupportStatus("My Support View preview is using your own data in read-only mode.");
      return;
    }

    loadSharedSupportData(selectedSharedOwnerId);
  }, [viewMode, selectedSharedOwnerId, sharedProfiles]);



  useEffect(() => {
    if (!authUser || !autoSyncEnabled || !cloudReady || !cloudCheckedForAccount || !cloudSyncAllowed) return;

    const timer = setTimeout(() => {
      saveToCloudSilent().catch((error) => {
        setSyncStatus(error.message || "Auto-sync failed.");
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [entries, settings, authUser, autoSyncEnabled, cloudReady, cloudCheckedForAccount, cloudSyncAllowed]);


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
    setAuthNotice("");

    if (!authEmail.trim()) {
      setAuthError("Enter an email address.");
      return;
    }

    if (authMode === "signup") {
      const passwordCheck = validateStrongPassword(authPassword || "");
      if (!passwordCheck.valid) {
        setAuthError(passwordRequirementMessage());
        return;
      }
    } else if (!authPassword) {
      setAuthError("Enter your password.");
      return;
    }

    try {
      if (authMode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        await sendEmailVerification(credential.user);
        setAuthNotice("Account created. A verification email was sent. Please check your inbox.");
        showMessage("Account created. Verification email sent.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        setAuthNotice("Signed in successfully.");
        showMessage("Signed in.");
      }

      setAuthPassword("");
    } catch (error) {
      setAuthError(error.message?.replace("Firebase: ", "") || "Authentication failed.");
    }
  };

  const handlePasswordReset = async () => {
    setAuthError("");
    setAuthNotice("");

    if (!authEmail.trim()) {
      setAuthError("Enter your email address first, then click Forgot password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, authEmail.trim());
      setAuthNotice("Password reset email sent. Check your inbox.");
      showMessage("Password reset email sent.");
    } catch (error) {
      setAuthError(error.message?.replace("Firebase: ", "") || "Could not send password reset email.");
    }
  };

  const handleResendVerification = async () => {
    setAuthError("");
    setAuthNotice("");

    if (!auth.currentUser) {
      setAuthError("Log in first to resend verification.");
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser);
      setAuthNotice("Verification email sent again. Check your inbox.");
      showMessage("Verification email sent.");
    } catch (error) {
      setAuthError(error.message?.replace("Firebase: ", "") || "Could not send verification email.");
    }
  };

  const loadSharedSupportData = async (ownerUserId) => {
    if (!ownerUserId) {
      setSharedSupportData(null);
      setSharedSupportStatus("");
      return;
    }

    setSharedSupportStatus("Loading shared Support View...");

    try {
      const snapshot = await getDoc(doc(db, "users", ownerUserId));

      if (!snapshot.exists()) {
        setSharedSupportData(null);
        setSharedSupportStatus("Shared profile data was not found.");
        return;
      }

      const ownerDoc = snapshot.data();
      const ownerData = ownerDoc.data || {};
      const ownerEntries = Array.isArray(ownerData.entries) ? ownerData.entries : [];
      const ownerSettings = ownerData.settings || {};
      const profile = sharedProfiles?.[ownerUserId] || {};

      const resolvedDisplayName = getSharedDisplayName(ownerSettings, ownerDoc, profile);

      setSharedSupportData({
        ownerUserId,
        displayName: resolvedDisplayName,
        entries: ownerEntries,
        settings: {
          ...defaultSettings,
          ...ownerSettings
        },
        permissions: profile.permissions || {},
        updatedAt: ownerData.updatedAt || ownerDoc.updatedAt || ""
      });

      setSharedProfiles((current) => {
        const existing = current?.[ownerUserId] || {};
        if (existing.displayName === resolvedDisplayName) return current;
        return {
          ...(current || {}),
          [ownerUserId]: {
            ...existing,
            ownerUserId,
            displayName: resolvedDisplayName
          }
        };
      });

      setSharedSupportStatus(`Shared Support View loaded for ${resolvedDisplayName}.`);
    } catch (error) {
      setSharedSupportData(null);
      setSharedSupportStatus(friendlyPermissionMessage(error.message));
    }
  };

  const removeSharedSupportView = async (ownerUserId) => {
    if (!authUser || !ownerUserId) {
      showMessage("No shared Support View selected.");
      return;
    }

    if (confirmRemoveSharedOwnerId !== ownerUserId) {
      setConfirmRemoveSharedOwnerId(ownerUserId);
      setInviteStatus("Click Remove from my account again to confirm.");
      return;
    }

    setInviteBusy(true);
    setInviteStatus("Removing shared Support View...");

    try {
      await updateDoc(doc(db, "users", authUser.uid), {
        [`sharedProfiles.${ownerUserId}`]: deleteField()
      });

      setSharedProfiles((current) => {
        const next = { ...(current || {}) };
        delete next[ownerUserId];
        return next;
      });

      if (selectedSharedOwnerId === ownerUserId) {
        setSelectedSharedOwnerId("");
        setSharedSupportData(null);
        setViewMode("owner");
        setActiveTab("dashboard");
      }

      setConfirmRemoveSharedOwnerId("");
      setInviteStatus("Shared Support View removed from your account.");
      showMessage("Shared Support View removed.");
    } catch (error) {
      const friendly = friendlyPermissionMessage(error.message);
      setInviteStatus(friendly);
      showMessage(friendly);
    } finally {
      setInviteBusy(false);
    }
  };

  const chooseSharedSupportView = (ownerUserId) => {
    setSelectedSharedOwnerId(ownerUserId);
    setViewMode("support");
    setActiveTab("calendar");
  };

  const revokeSupportViewer = async (viewerUserId) => {
    if (!authUser || !viewerUserId) {
      showMessage("No support viewer selected.");
      return;
    }

    if (confirmRevokeViewerId !== viewerUserId) {
      setConfirmRevokeViewerId(viewerUserId);
      setInviteStatus("Click Revoke access again to confirm removing this supporter.");
      return;
    }

    setInviteBusy(true);
    setInviteStatus("Revoking support access...");

    try {
      await updateDoc(doc(db, "users", authUser.uid), {
        [`supportViewers.${viewerUserId}`]: deleteField()
      });

      setSupportViewers((current) => {
        const next = { ...(current || {}) };
        delete next[viewerUserId];
        return next;
      });

      setConfirmRevokeViewerId("");
      setInviteStatus("Support access revoked. That viewer can no longer load your shared data.");
      showMessage("Support access revoked.");
    } catch (error) {
      const friendly = friendlyPermissionMessage(error.message);
      setInviteStatus(friendly);
      showMessage(friendly);
    } finally {
      setInviteBusy(false);
    }
  };

  const makeInviteToken = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  };

  const createSupportInvite = async () => {
    if (!authUser) {
      showMessage("Log in first to create a support invite.");
      return;
    }

    setInviteBusy(true);
    setInviteStatus("Creating invite...");

    try {
      const token = makeInviteToken();
      const ownerDisplayName = getOwnDisplayName(settings, authUser);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await setDoc(doc(db, "supportInvites", token), {
        token,
        ownerUserId: authUser.uid,
        ownerEmail: authUser.email,
        ownerDisplayName,
        status: "pending",
        permissions: {
          calendar: true,
          insights: true,
          howToHelp: true,
          moods: true,
          symptoms: true,
          notes: false
        },
        createdAt: new Date().toISOString(),
        expiresAt
      });

      const link = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
      setLastInviteLink(link);
      setInviteStatus("Invite link created. Copy and send it to the person you want to invite.");
      showMessage("Support invite created.");
    } catch (error) {
      const friendly = friendlyPermissionMessage(error.message || "Could not create support invite.");
      setInviteStatus(friendly);
      showMessage(friendly);
    } finally {
      setInviteBusy(false);
    }
  };

  const copyInviteLink = async () => {
    if (!lastInviteLink) {
      showMessage("Create an invite link first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(lastInviteLink);
      showMessage("Invite link copied.");
    } catch {
      setInviteStatus("Copy failed. Select and copy the invite link manually.");
    }
  };

  const checkSupportInvite = async (token = inviteToken) => {
    if (!token) return null;

    setInviteBusy(true);
    setInviteStatus("Checking invite...");

    try {
      const snapshot = await getDoc(doc(db, "supportInvites", token));

      if (!snapshot.exists()) {
        setPendingInvite(null);
        setInviteStatus("Invite not found or already removed.");
        return null;
      }

      const invite = snapshot.data();
      setPendingInvite(invite);

      if (invite.status !== "pending") {
        setInviteStatus("This invite has already been used or is no longer active.");
      } else if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        setInviteStatus("This invite has expired. Ask the owner to create a new one.");
      } else {
        setInviteStatus(`Invite from ${invite.ownerDisplayName || "4Sara user"} found. Accept it to add Support View to your account.`);
      }

      return invite;
    } catch (error) {
      setInviteStatus(friendlyPermissionMessage(error.message || "Could not check invite."));
      return null;
    } finally {
      setInviteBusy(false);
    }
  };

  const acceptSupportInvite = async () => {
    if (!authUser) {
      setInviteStatus("Log in or create an account before accepting the invite.");
      setActiveTab("account");
      return;
    }

    const token = inviteToken || pendingInvite?.token;
    if (!token) {
      setInviteStatus("No invite link found.");
      return;
    }

    setInviteBusy(true);
    setInviteStatus("Accepting invite...");

    try {
      const invite = pendingInvite || await checkSupportInvite(token);

      if (!invite) return;

      if (invite.status !== "pending") {
        setInviteStatus("This invite is no longer active.");
        return;
      }

      if (invite.ownerUserId === authUser.uid) {
        setInviteStatus("This invite belongs to the account you are currently logged into. To test it, open the link in incognito or another browser and log in with a different account.");
        showMessage("Use a different account to accept this invite.");
        return;
      }

      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        setInviteStatus("This invite has expired. Ask the owner to create a new one.");
        return;
      }

      const acceptedAt = new Date().toISOString();
      const sharedProfile = {
        ownerUserId: invite.ownerUserId,
        displayName: invite.ownerDisplayName || invite.ownerEmail || "Shared 4Sara",
        role: "viewer",
        permissions: invite.permissions || {},
        acceptedAt
      };

      await setDoc(doc(db, "users", authUser.uid), {
        sharedProfiles: {
          [invite.ownerUserId]: sharedProfile
        }
      }, { merge: true });

      await setDoc(doc(db, "users", invite.ownerUserId), {
        supportViewers: {
          [authUser.uid]: {
            viewerUserId: authUser.uid,
            viewerEmail: authUser.email,
            role: "viewer",
            permissions: invite.permissions || {},
            acceptedAt
          }
        }
      }, { merge: true });

      await setDoc(doc(db, "supportInvites", token), {
        status: "accepted",
        acceptedBy: authUser.uid,
        acceptedByEmail: authUser.email,
        acceptedAt
      }, { merge: true });

      setSharedProfiles((current) => ({ ...current, [invite.ownerUserId]: sharedProfile }));
      setPendingInvite(null);
      setInviteToken("");
      setInviteStatus("Invite accepted. Support View has been added to this account.");
      showMessage("Support invite accepted.");

      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
      const friendly = friendlyPermissionMessage(error.message || "Could not accept invite.");
      setInviteStatus(friendly);
      showMessage(friendly);
    } finally {
      setInviteBusy(false);
    }
  };

  const deleteCloudData = async () => {
    if (!authUser) {
      showMessage("Log in first to delete cloud data.");
      return;
    }

    if (!confirmDeleteCloud) {
      setConfirmDeleteCloud(true);
      setSyncStatus("Click Delete cloud data again to confirm.");
      return;
    }

    setSyncBusy(true);
    setSyncStatus("Deleting cloud data...");

    try {
      await deleteDoc(doc(db, "users", authUser.uid));
      await clearCloudChoiceForAccount(authUser);
      setCloudHasData(false);
      setCloudUpdatedAt("");
      setCloudSyncAllowed(false);
      setAutoSyncEnabled(false);
      setConfirmDeleteCloud(false);
      setSyncStatus("Cloud data deleted. Auto-sync was turned off so the cloud copy is not recreated automatically. Local data on this device was not deleted.");
      showMessage("Cloud data deleted.");
    } catch (error) {
      setSyncStatus("Cloud delete failed.");
      showMessage(error.message || "Cloud delete failed.");
    } finally {
      setSyncBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!authUser || !auth.currentUser) {
      showMessage("Log in first to delete your account.");
      return;
    }

    if (!confirmDeleteAccount) {
      setConfirmDeleteAccount(true);
      setSyncStatus("Click Delete account again to confirm.");
      return;
    }

    setSyncBusy(true);
    setSyncStatus("Deleting account...");

    try {
      clearCloudChoice(authUser.uid);
      await deleteDoc(doc(db, "users", authUser.uid));
      await deleteUser(auth.currentUser);

      setCloudHasData(false);
      setCloudUpdatedAt("");
      setCloudSyncAllowed(false);
      setAutoSyncEnabled(false);
      setConfirmDeleteCloud(false);
      setConfirmDeleteAccount(false);
      setSyncStatus("Account deleted. Local data on this device was not deleted.");
      showMessage("Account deleted.");
    } catch (error) {
      const message = error.message || "Account deletion failed.";

      if (message.includes("requires-recent-login")) {
        setSyncStatus("For security, log out, log back in, then delete the account again.");
        showMessage("Log in again before deleting account.");
      } else {
        setSyncStatus("Account deletion failed.");
        showMessage(message);
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSyncStatus("Signed out. Data is saved locally on this device.");
    showMessage("Signed out.");
  };

  const buildCloudPayload = () => ({
    entries,
    settings: {
      ...settings,
      pin: ""
    },
    updatedAt: new Date().toISOString()
  });

  const checkCloudDataForAccount = async (user = auth.currentUser) => {
    if (!user) return;

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));

      if (snapshot.exists()) {
        const cloudData = snapshot.data()?.data || {};
        const cloudEntries = Array.isArray(cloudData.entries) ? cloudData.entries : [];
        const cloudSettings = cloudData.settings || {};
        const hasCloudEntries = cloudEntries.length > 0;
        const hasLocalEntries = entries.length > 0;

        setCloudHasData(hasCloudEntries);
        setCloudUpdatedAt(cloudData.updatedAt || "");
        setSharedProfiles(snapshot.data()?.sharedProfiles || {});
        setSupportViewers(snapshot.data()?.supportViewers || {});

        const accountChoice = snapshot.data()?.cloudPreference?.choice;
        const rememberedChoice = accountChoice || getCloudChoice(user.uid)?.choice;

        if (hasCloudEntries && !hasLocalEntries) {
          setEntries(cloudEntries);
          setSettings((current) => ({
            ...current,
            ...cloudSettings,
            welcomeSeen: true,
            accountPromptSeen: true,
            onboardingComplete: true,
            pin: current.pin,
            pinEnabled: current.pinEnabled
          }));
          await rememberCloudChoiceForAccount(user, "load-cloud");
          setCloudSyncAllowed(true);
          setSyncStatus("Cloud data loaded automatically because this device had no local data.");
          showMessage("Cloud data loaded.");
        } else if (hasCloudEntries && hasLocalEntries && rememberedChoice === "save-device") {
          setCloudSyncAllowed(true);
          setSyncStatus("Cloud sync is allowed because this account previously chose to save device data to cloud.");
        } else if (hasCloudEntries && hasLocalEntries && rememberedChoice === "load-cloud") {
          setEntries(cloudEntries);
          setSettings((current) => ({
            ...current,
            ...cloudSettings,
            welcomeSeen: true,
            accountPromptSeen: true,
            onboardingComplete: true,
            pin: current.pin,
            pinEnabled: current.pinEnabled
          }));
          setActiveTab("dashboard");
          setExistingAccountLoaded(true);
          setCloudSyncAllowed(true);
          setSyncStatus("Cloud data loaded. You are signed in and ready to use 4Sara.");
        } else if (hasCloudEntries && hasLocalEntries) {
          setSettings((current) => ({
            ...current,
            welcomeSeen: true,
            accountPromptSeen: true,
            onboardingComplete: true
          }));
          setActiveTab("dashboard");
          setExistingAccountLoaded(true);
          setCloudSyncAllowed(false);
          setSyncStatus("Cloud data found. Auto-sync is paused until you choose whether to load cloud data or save this device’s data.");
        } else {
          await rememberCloudChoiceForAccount(user, "save-device");
          setCloudSyncAllowed(true);
          setSyncStatus("No cloud data found yet. This device can save data to cloud.");
        }
      } else {
        setCloudHasData(false);
        setCloudUpdatedAt("");
        setSharedProfiles({});
        setSupportViewers({});
        await rememberCloudChoiceForAccount(user, "save-device");
        setExistingAccountLoaded(false);
        setCloudSyncAllowed(true);
        setSyncStatus("No cloud data found yet. This account can save data to cloud.");
      }

      setCloudCheckedForAccount(true);
      setAccountDataChecked(true);
    } catch (error) {
      setSyncStatus(error.message || "Could not check cloud data.");
      setCloudCheckedForAccount(true);
      setAccountDataChecked(true);
      setCloudSyncAllowed(false);
    }
  };

  const saveToCloudSilent = async () => {
    if (!auth.currentUser) return;

    await setDoc(doc(db, "users", auth.currentUser.uid), {
      email: auth.currentUser.email,
      data: {
        entries,
        settings: {
          ...settings,
          pin: ""
        },
        updatedAt: new Date().toISOString()
      },
      cloudPreference: {
        choice: "save-device",
        updatedAt: new Date().toISOString()
      },
      updatedAt: serverTimestamp()
    }, { merge: true });

    rememberCloudChoice(authUser.uid, "save-device");
    const savedTime = new Date().toLocaleTimeString();
    setLastCloudSave(savedTime);
    setCloudHasData(true);
    setSyncStatus(`Auto-saved to cloud at ${savedTime}.`);
  };

  const saveToCloud = async () => {
    if (!authUser) {
      showMessage("Log in first to save data to cloud.");
      return;
    }

    setSyncBusy(true);
    setSyncStatus("Saving to cloud...");

    try {
      await setDoc(doc(db, "users", authUser.uid), {
        email: authUser.email,
        data: buildCloudPayload(),
        cloudPreference: {
          choice: "save-device",
          updatedAt: new Date().toISOString()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      rememberCloudChoice(authUser.uid, "save-device");
      const savedTime = new Date().toLocaleTimeString();
      setLastCloudSave(savedTime);
      setCloudCheckedForAccount(true);
      setCloudSyncAllowed(true);
      setCloudHasData(true);
      setSyncStatus(`Saved to cloud at ${savedTime}. This device will keep using Save to cloud after refresh.`);
      showMessage("Saved to cloud.");
    } catch (error) {
      setSyncStatus("Cloud save failed.");
      showMessage(error.message || "Cloud save failed.");
    } finally {
      setSyncBusy(false);
    }
  };

  const loadFromCloud = async () => {
    if (!authUser) {
      showMessage("Log in first to load cloud data.");
      return;
    }

    setSyncBusy(true);
    setSyncStatus("Loading from cloud...");

    try {
      const snapshot = await getDoc(doc(db, "users", authUser.uid));

      if (!snapshot.exists()) {
        setSyncStatus("No cloud data found for this account yet.");
        showMessage("No cloud data found yet.");
        return;
      }

      const cloudData = snapshot.data()?.data || {};
      const cloudEntries = Array.isArray(cloudData.entries) ? cloudData.entries : [];
      const cloudSettings = cloudData.settings || {};

      setEntries(cloudEntries);
      setSettings((current) => ({
        ...current,
        ...cloudSettings,
        pin: current.pin,
        pinEnabled: current.pinEnabled
      }));

      await rememberCloudChoiceForAccount(authUser, "load-cloud");
      setCloudCheckedForAccount(true);
      setCloudSyncAllowed(true);
      setCloudHasData(true);
      setSyncStatus(`Loaded cloud data at ${new Date().toLocaleTimeString()}. This device will keep using cloud data after refresh.`);
      showMessage("Loaded cloud data.");
    } catch (error) {
      setSyncStatus("Cloud load failed.");
      showMessage(error.message || "Cloud load failed.");
    } finally {
      setSyncBusy(false);
    }
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


  const supportEntries = selectedSharedOwnerId && sharedSupportData ? sharedSupportData.entries : entries;
  const supportSettings = selectedSharedOwnerId && sharedSupportData ? sharedSupportData.settings : settings;
  const supportStats = useMemo(() => calculateStatsForEntries(supportEntries, supportSettings), [supportEntries, supportSettings]);
  const supportCalendarDate = calendarDate;
  const supportProjectedPhaseMap = useMemo(() => {
    return buildProjectedCycleMap(supportStats.last?.startDate, supportStats.averageCycle, supportStats.averagePeriod, 6);
  }, [supportStats.last?.startDate, supportStats.averageCycle, supportStats.averagePeriod]);

  const supportCalendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const offset = first.getDay();
    const cells = Math.ceil((offset + last.getDate()) / 7) * 7;

    const periodDays = new Map();
    const checkInDays = new Map();

    supportEntries.filter((entry) => (entry.type || "period") === "period").forEach((entry) => {
      getDaysInRange(entry.startDate, entry.endDate).forEach((day) => periodDays.set(day, entry));
    });

    supportEntries.filter((entry) => (entry.type || "period") === "checkin").forEach((entry) => {
      if (!checkInDays.has(entry.startDate)) checkInDays.set(entry.startDate, []);
      checkInDays.get(entry.startDate).push(entry);
    });

    return Array.from({ length: cells }, (_, index) => {
      const dayNumber = index - offset + 1;
      if (dayNumber < 1 || dayNumber > last.getDate()) return { empty: true, key: `support-empty-${index}` };

      const key = toDateKey(new Date(year, month, dayNumber));
      const entry = periodDays.get(key);
      const projection = supportProjectedPhaseMap.get(key);
      const phase = entry ? "Menstruation" : projection?.phase || inferPhase(key, supportEntries.filter((item) => (item.type || "period") === "period"), supportStats.averageCycle, supportStats.averagePeriod);
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
        cycleDay: getCycleDayForDate(key, supportStats.last?.startDate, supportStats.averageCycle),
        isFuture: isFutureDate(key),
        statusLabel: entry ? "Logged" : isFutureDate(key) ? "Predicted" : "Not logged"
      };
    });
  }, [calendarDate, supportEntries, supportProjectedPhaseMap, supportStats.averageCycle, supportStats.averagePeriod, supportStats.last?.startDate]);

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
    if (!onboarding.consentAccepted) return showMessage("Please accept the privacy and wellness tracking acknowledgment before continuing.");

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

  const startLogForSelectedDate = (dateKey, type = "period") => {
    if (viewMode === "support") {
      showMessage("Support View is read-only. Logging is not available.");
      return;
    }

    if (isFutureDate(dateKey)) {
      showMessage("Future dates show predictions only. You can log once the date arrives.");
      return;
    }

    setForm({ ...blankForm(), type, startDate: dateKey });
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

  const ownerNavItems = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "log", label: "Log", icon: Plus },
    { id: "insights", label: "Insights", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "privacy", label: "Privacy", icon: Lock },
    { id: "account", label: "Account", icon: Mail },
    { id: "mobile", label: "Mobile", icon: Home }
  ];

  const supportNavItems = [
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "insights", label: "Insights", icon: Sparkles },
    { id: "howtohelp", label: "How to Help", icon: HeartPulse }
  ];

  const navItems = viewMode === "support" ? supportNavItems : ownerNavItems;

  useEffect(() => {
    const allowedTabs = navItems.map((item) => item.id);
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(viewMode === "support" ? "calendar" : "dashboard");
    }
  }, [viewMode, activeTab]);

  if (!settings.welcomeSeen) {
    return <div className={settings.darkMode ? "app dark" : "app"}><WelcomeScreen onStart={() => updateSettings({ welcomeSeen: true })} onReturn={() => updateSettings({ welcomeSeen: true, accountPromptSeen: true, onboardingComplete: true })} /></div>;
  }

  if (!settings.accountPromptSeen) {
    return (
      <div className={settings.darkMode ? "app dark" : "app"}>
        <AccountPromptScreen
          authUser={authUser}
          authLoading={authLoading}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authError={authError}
          authNotice={authNotice}
          handleAuthSubmit={handleAuthSubmit}
          handlePasswordReset={handlePasswordReset}
          onContinue={() => updateSettings({ accountPromptSeen: true })}
        />
      </div>
    );
  }

  if (authUser && (!accountDataChecked || !cloudCheckedForAccount)) {
    return (
      <div className="app">
        <div className="container">
          <Card className="pad">
            <h2>Loading your 4Sara account...</h2>
            <p className="muted">Checking for your saved account data before setup continues.</p>
          </Card>
        </div>
      </div>
    );
  }

  if (authUser && existingAccountLoaded) {
    // Existing signed-in accounts with cloud data should never be sent back through onboarding on any device or browser.
  } else if (!settings.onboardingComplete) {
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
              <button className="brand-home-btn" onClick={() => updateSettings({ welcomeSeen: false, accountPromptSeen: false })} aria-label="Return to welcome screen">
                <span className="brand-mini-logo" aria-hidden="true">
                  <img src="/icons/icon-192.png" alt="" />
                </span>
                <span>4Sara</span>
              </button>
              <div className="pill"><ShieldCheck size={16} /> Private cycle tracker</div>
              <CloudStatusBadge authUser={authUser} autoSyncEnabled={autoSyncEnabled} cloudCheckedForAccount={cloudCheckedForAccount} cloudSyncAllowed={cloudSyncAllowed} syncBusy={syncBusy} lastCloudSave={lastCloudSave} />
              <ViewModeSwitcher viewMode={viewMode} setViewMode={setViewMode} setActiveTab={setActiveTab} sharedProfiles={sharedProfiles} selectedSharedOwnerId={selectedSharedOwnerId} setSelectedSharedOwnerId={setSelectedSharedOwnerId} chooseSharedSupportView={chooseSharedSupportView} />
            </div>
            <h1>{settings.profileName ? `Welcome back, ${settings.profileName}` : "4Sara"}</h1>
            <p className="muted">Track menstruation, symptoms, moods, reminders, fertility estimates, and cycle history.</p>
          </div>
          <div className="actions">{viewMode === "owner" && <Button onClick={() => logToday("period")}><Plus size={16} /> Log Today</Button>}</div>
        </header>

        {message && <div className="message">{message}</div>}
        {viewMode === "support" && (
          <div className="support-mode-banner">
            <strong>{sharedSupportData ? `${sharedSupportData.displayName}'s Support View` : "Support View preview"}</strong>
            <span>{sharedSupportStatus || (selectedSharedOwnerId ? "Read-only access is active. Logging, editing, settings, privacy, and account controls are hidden." : "This is your own read-only Support View preview. It shows what supporters can see without allowing edits.")}</span>
          </div>
        )}

        {inviteToken && (
          <div className="invite-found-banner">
            <div>
              <strong>Support invite opened</strong>
              <span>{authUser ? "Go to Account to accept this support invite." : "Log in or create an account to accept this support invite."}</span>
            </div>
            <Button onClick={() => setActiveTab("account")} variant="secondary">Open Account</Button>
          </div>
        )}

        <nav className="tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => setActiveTab(item.id)} className={`tab ${activeTab === item.id ? "active" : ""}`}><Icon size={16} />{item.label}</button>;
          })}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.25, ease: "easeOut" }}>
            {activeTab === "dashboard" && <Dashboard stats={stats} settings={settings} sortedEntries={sortedEntries} startEdit={startEdit} deleteEntry={deleteEntry} jumpToNextPeriod={jumpToNextPeriod} previewReminder={previewReminder} setLocked={setLocked} />}
            {activeTab === "calendar" && (
              <CalendarPanel
                calendarDate={calendarDate}
                calendarData={viewMode === "support" ? supportCalendarData : calendarData}
                moveMonth={(direction) => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))}
                onDayClick={(day) => {
                  if (!day) {
                    setSelectedCalendarDay("");
                    return;
                  }
                  setSelectedCalendarDay(day);
                  showMessage(`Selected ${formatDate(day)}.`);
                }}
                selectedCalendarDay={selectedCalendarDay}
                onLogSelectedDate={startLogForSelectedDate}
                stats={viewMode === "support" ? supportStats : stats}
                readOnly={viewMode === "support"}
              />
            )}
            {activeTab === "log" && <LogTab form={form} setForm={setForm} toggleSymptom={toggleSymptom} saveEntry={saveEntry} editingId={editingId} cancelEdit={() => { setEditingId(null); setForm(blankForm()); }} entries={sortedEntries} startEdit={startEdit} deleteEntry={deleteEntry} allSymptoms={allSymptoms} customSymptoms={settings.customSymptoms || []} customSymptomInput={customSymptomInput} setCustomSymptomInput={setCustomSymptomInput} addCustomSymptom={addCustomSymptom} removeCustomSymptom={removeCustomSymptom} selectedPhase={selectedPhase} />}
            {activeTab === "insights" && <Insights stats={viewMode === "support" ? supportStats : stats} settings={viewMode === "support" ? supportSettings : settings} setLocked={setLocked} readOnly={viewMode === "support"} />}
            {activeTab === "settings" && <SettingsTab settings={settings} updateSettings={updateSettings} setLocked={setLocked} showMessage={showMessage} clearData={clearAllData} resetDemo={() => { setEntries(demoEntries); updateSettings({ onboardingComplete: true }); showMessage("Demo data restored."); }} importText={importText} setImportText={setImportText} importJson={importJson} sortedEntries={sortedEntries} stats={stats} />}
            {activeTab === "privacy" && <PrivacyPage settings={settings} authUser={authUser} syncStatus={syncStatus} cloudHasData={cloudHasData} syncBusy={syncBusy} deleteCloudData={deleteCloudData} confirmDeleteCloud={confirmDeleteCloud} setConfirmDeleteCloud={setConfirmDeleteCloud} deleteAccount={deleteAccount} confirmDeleteAccount={confirmDeleteAccount} setConfirmDeleteAccount={setConfirmDeleteAccount} setLocked={setLocked} clearData={clearAllData} exportJson={() => { downloadJson(entries, settings); showMessage("Backup downloaded."); }} exportCsv={() => { downloadCsv(sortedEntries); showMessage("Spreadsheet export downloaded."); }} />}
            {activeTab === "account" && <AccountPage authUser={authUser} authLoading={authLoading} authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} authError={authError} authNotice={authNotice} handleAuthSubmit={handleAuthSubmit} handlePasswordReset={handlePasswordReset} handleResendVerification={handleResendVerification} handleSignOut={handleSignOut} syncStatus={syncStatus} syncBusy={syncBusy} saveToCloud={saveToCloud} loadFromCloud={loadFromCloud} autoSyncEnabled={autoSyncEnabled} setAutoSyncEnabled={setAutoSyncEnabled} lastCloudSave={lastCloudSave} cloudCheckedForAccount={cloudCheckedForAccount} cloudSyncAllowed={cloudSyncAllowed} cloudHasData={cloudHasData} cloudUpdatedAt={cloudUpdatedAt} deleteCloudData={deleteCloudData} confirmDeleteCloud={confirmDeleteCloud} setConfirmDeleteCloud={setConfirmDeleteCloud} deleteAccount={deleteAccount} confirmDeleteAccount={confirmDeleteAccount} setConfirmDeleteAccount={setConfirmDeleteAccount} createSupportInvite={createSupportInvite} copyInviteLink={copyInviteLink} lastInviteLink={lastInviteLink} inviteToken={inviteToken} pendingInvite={pendingInvite} inviteStatus={inviteStatus} inviteBusy={inviteBusy} acceptSupportInvite={acceptSupportInvite} checkSupportInvite={checkSupportInvite} sharedProfiles={sharedProfiles} supportViewers={supportViewers} confirmRevokeViewerId={confirmRevokeViewerId} setConfirmRevokeViewerId={setConfirmRevokeViewerId} confirmRemoveSharedOwnerId={confirmRemoveSharedOwnerId} setConfirmRemoveSharedOwnerId={setConfirmRemoveSharedOwnerId} revokeSupportViewer={revokeSupportViewer} chooseSharedSupportView={chooseSharedSupportView} removeSharedSupportView={removeSharedSupportView} />}
            {activeTab === "mobile" && viewMode === "owner" && <MobileSetupPage />}
            {activeTab === "howtohelp" && viewMode === "support" && (
              <HowToHelpPage
                stats={supportStats}
                settings={supportSettings}
                entries={supportEntries}
                calendarData={supportCalendarData}
                sharedSupportData={sharedSupportData}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}



function AccountPage({ authUser, authLoading, authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword, authError, authNotice, handleAuthSubmit, handlePasswordReset, handleResendVerification, handleSignOut, syncStatus, syncBusy, saveToCloud, loadFromCloud, autoSyncEnabled, setAutoSyncEnabled, lastCloudSave, cloudCheckedForAccount, cloudSyncAllowed, cloudHasData, cloudUpdatedAt, deleteCloudData, confirmDeleteCloud, setConfirmDeleteCloud, deleteAccount, confirmDeleteAccount, setConfirmDeleteAccount, createSupportInvite, copyInviteLink, lastInviteLink, inviteToken, pendingInvite, inviteStatus, inviteBusy, acceptSupportInvite, checkSupportInvite, sharedProfiles, supportViewers, confirmRevokeViewerId, setConfirmRevokeViewerId, confirmRemoveSharedOwnerId, setConfirmRemoveSharedOwnerId, revokeSupportViewer, chooseSharedSupportView, removeSharedSupportView }) {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Mail size={20} /> Account</h2>

        {authLoading ? (
          <p className="muted">Checking account status...</p>
        ) : authUser ? (
          <div className="account-signed-in account-only-view">
            <div className="account-status-card">
              <div>
                <p className="account-eyebrow">Signed in</p>
                <h3>{authUser.email}</h3>
                <p>Your account is active. Cloud sync is available for this account.</p>
                <span className={authUser.emailVerified ? "verify-badge verified" : "verify-badge unverified"}>
                  {authUser.emailVerified ? "Email verified" : "Email not verified"}
                </span>
              </div>
            </div>

            {!authUser.emailVerified && (
              <div className="email-verification-card">
                <h3>Confirm your email</h3>
                <p>Please verify your email address so the account is confirmed.</p>
                <Button onClick={handleResendVerification} variant="secondary">Resend verification email</Button>
                {authNotice && <p className="auth-notice">{authNotice}</p>}
                {authError && <p className="auth-error">{authError}</p>}
              </div>
            )}

            <div className="cloud-migration-card">
              <h3>Cloud data check</h3>
              {!cloudCheckedForAccount ? (
                <p>Checking for existing cloud data...</p>
              ) : cloudHasData ? (
                <>
                  <p>Cloud data was found for this account{cloudUpdatedAt ? `, last updated ${new Date(cloudUpdatedAt).toLocaleString()}` : ""}.</p>
                  <div className="migration-actions">
                    <Button onClick={loadFromCloud} variant="secondary" disabled={syncBusy}>Load cloud data to this device</Button>
                    <Button onClick={saveToCloud} disabled={syncBusy}>Save this device’s data to cloud</Button>
                  </div>
                </>
              ) : (
                <>
                  <p>No cloud data was found yet. You can save this device’s current 4Sara data to your account.</p>
                  <div className="migration-actions">
                    <Button onClick={saveToCloud} disabled={syncBusy}>Save this device’s data to cloud</Button>
                  </div>
                </>
              )}
            </div>

            <div className="support-sharing-card">
              <h3>Support sharing</h3>
              <p>Create a read-only support invite. The invited person must log in or create an account before accepting.</p>

              {inviteStatus && <p className="invite-status">{inviteStatus}</p>}

              {inviteToken && (
                <div className="mini-card invite-accept-card">
                  <strong>Pending support invite</strong>
                  {pendingInvite ? (
                    <>
                      <p>From: {pendingInvite.ownerDisplayName || "4Sara user"}</p>
                      {pendingInvite.expiresAt && <p>Expires in about {Math.max(0, daysUntilDate(pendingInvite.expiresAt))} day{Math.max(0, daysUntilDate(pendingInvite.expiresAt)) === 1 ? "" : "s"}.</p>}
                      <Button onClick={acceptSupportInvite} disabled={inviteBusy}>Accept support invite</Button>
                    </>
                  ) : (
                    <>
                      <p>Invite token detected. Check the invite, then accept it.</p>
                      <Button onClick={() => checkSupportInvite(inviteToken)} disabled={inviteBusy} variant="secondary">Check invite</Button>
                    </>
                  )}
                </div>
              )}

              <div className="account-actions">
                <Button onClick={createSupportInvite} disabled={inviteBusy}>Create support invite</Button>
                {lastInviteLink && <Button onClick={copyInviteLink} variant="secondary">Copy invite link</Button>}
              </div>

              {lastInviteLink && (
                <>
                  <input className="invite-link-input" value={lastInviteLink} readOnly onFocus={(event) => event.target.select()} />
                  <p className="invite-expiry-note">This invite expires in 7 days and should only be sent to someone you trust.</p>
                </>
              )}

              {Object.keys(sharedProfiles || {}).length > 0 && (
                <div className="shared-profile-list">
                  <h4>Shared Support Views on this account</h4>
                  {Object.values(sharedProfiles).map((profile) => (
                    <div className="mini-card" key={profile.ownerUserId}>
                      <strong>{profile.displayName || "Shared 4Sara"}</strong>
                      <p>Role: read-only supporter</p>
                      {confirmRemoveSharedOwnerId === profile.ownerUserId && (
                        <p className="danger-confirm">Click Remove from my account again to confirm, or cancel below.</p>
                      )}
                      <div className="account-actions">
                        <Button onClick={() => chooseSharedSupportView(profile.ownerUserId)} variant="secondary">Open Support View</Button>
                        <Button onClick={() => removeSharedSupportView(profile.ownerUserId)} variant="secondary" disabled={inviteBusy}>
                          {confirmRemoveSharedOwnerId === profile.ownerUserId ? "Confirm remove" : "Remove from my account"}
                        </Button>
                        {confirmRemoveSharedOwnerId === profile.ownerUserId && (
                          <Button onClick={() => setConfirmRemoveSharedOwnerId("")} variant="secondary">Cancel</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="auth-note">Use My Support View to preview what supporters can see. Shared Support View names come from the owner’s profile name, and you can remove shared views from your account anytime.</p>
            </div>

            <div className="support-sharing-card">
              <h3>Support viewers</h3>
              <p>These people have read-only Support View access to your shared calendar, insights, and How to Help view.</p>

              {Object.keys(supportViewers || {}).length > 0 ? (
                <div className="shared-profile-list">
                  {Object.entries(supportViewers).map(([viewerUserId, viewer]) => (
                    <div className="mini-card support-viewer-card" key={viewerUserId}>
                      <strong>{viewer.viewerEmail || "Support viewer"}</strong>
                      <p>Role: read-only supporter</p>
                      {viewer.acceptedAt && <p>Accepted: {new Date(viewer.acceptedAt).toLocaleString()}</p>}
                      {confirmRevokeViewerId === viewerUserId && <p className="danger-confirm">Click Revoke access again to confirm, or cancel below.</p>}
                      <div className="account-actions">
                        <Button onClick={() => revokeSupportViewer(viewerUserId)} variant="secondary" disabled={inviteBusy}>
                          {confirmRevokeViewerId === viewerUserId ? "Confirm revoke access" : "Revoke access"}
                        </Button>
                        {confirmRevokeViewerId === viewerUserId && <Button onClick={() => setConfirmRevokeViewerId("")} variant="secondary">Cancel</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No active support viewers yet.</p>
              )}
            </div>

            <div className="info-box amber-box">
              <h3>Cloud sync</h3>
              <p>{syncStatus}</p>
              {lastCloudSave && <p className="sync-small">Last cloud save: {lastCloudSave}</p>}
              <p className="sync-small">Existing accounts with cloud data open directly into the tracker on any device or browser.</p>
            </div>

            <label className="setting-row autosync-row">
              <span>Auto-save changes to cloud</span>
              <input type="checkbox" checked={autoSyncEnabled} onChange={(event) => setAutoSyncEnabled(event.target.checked)} />
            </label>
            {authUser && cloudCheckedForAccount && !cloudSyncAllowed && (
              <p className="sync-paused-note">Auto-sync is paused to protect existing data. Choose Load cloud data or Save this device’s data to cloud to continue syncing.</p>
            )}

            <div className="account-actions">
              <Button onClick={saveToCloud} disabled={syncBusy}>Save to cloud</Button>
              <Button onClick={loadFromCloud} variant="secondary" disabled={syncBusy}>Load from cloud</Button>
              <Button onClick={handleSignOut} variant="secondary">Sign out</Button>
            </div>

            <div className="danger-zone">
              <h3>Cloud data controls</h3>
              <p>Delete the cloud copy of your 4Sara data from this account. This does not delete the local data saved on this device.</p>
              {confirmDeleteCloud && (
                <p className="danger-confirm">Confirm delete: click the button again to permanently remove the cloud copy.</p>
              )}
              <div className="account-actions">
                <Button onClick={deleteCloudData} variant="secondary" disabled={syncBusy}>
                  {confirmDeleteCloud ? "Confirm delete cloud data" : "Delete cloud data"}
                </Button>
                {confirmDeleteCloud && <Button onClick={() => setConfirmDeleteCloud(false)} variant="secondary">Cancel</Button>}
              </div>
            </div>

            <div className="danger-zone account-delete-zone">
              <h3>Delete account</h3>
              <p>This deletes your Firebase account and the cloud copy of your 4Sara data. Local data on this device is not deleted unless you clear it separately in Privacy.</p>
              {confirmDeleteAccount && (
                <p className="danger-confirm">Confirm delete: click the button again to permanently delete this account. You may need to log in again first.</p>
              )}
              <div className="account-actions">
                <Button onClick={deleteAccount} variant="secondary" disabled={syncBusy}>
                  {confirmDeleteAccount ? "Confirm delete account" : "Delete account"}
                </Button>
                {confirmDeleteAccount && <Button onClick={() => setConfirmDeleteAccount(false)} variant="secondary">Cancel</Button>}
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-panel">
            {inviteToken && (
              <div className="support-sharing-card">
                <h3>Support invite found</h3>
                <p>{inviteStatus || "Log in or create an account to accept this Support View invite."}</p>
                {pendingInvite && <p>Invite from: <strong>{pendingInvite.ownerDisplayName || "4Sara user"}</strong></p>}
              </div>
            )}
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
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="8+ chars, uppercase, lowercase, number, special character" />
              </label>

              {authMode === "signup" && <PasswordRequirements password={authPassword} />}
              {authError && <p className="auth-error">{authError}</p>}
              {authNotice && <p className="auth-notice">{authNotice}</p>}

              {authMode === "signin" && (
                <button type="button" className="link-button" onClick={handlePasswordReset}>Forgot password?</button>
              )}

              <Button onClick={handleAuthSubmit} className="full">
                {authMode === "signup" ? "Create account" : "Log in"}
              </Button>
            </div>

            <p className="auth-note">Create an account or log in here. Cloud syncing for entries and settings is available after login.</p>
          </div>
        )}
      </Card>

      <Card className="pad side-col">
        {authUser ? (
          <>
            <h3>Account status</h3>
            <div className="mini-card"><strong>Logged in</strong><p>Your account is connected as {authUser.email}.</p></div>
            <div className="mini-card"><strong>Smart cloud loading</strong><p>If this device has no local data, cloud data loads automatically after login.</p></div>
            <div className="mini-card"><strong>Auto-save available</strong><p>When enabled, changes save to cloud automatically after a short delay.</p></div>
            <div className="mini-card"><strong>Manual controls remain</strong><p>You can still use Save to cloud or Load from cloud when needed.</p></div>
            <div className="mini-card"><strong>Local backup still active</strong><p>Your browser still keeps a local copy for faster access.</p></div>
            <div className="mini-card"><strong>Account deletion</strong><p>Deleting an account removes the Firebase account and cloud document, but local device data is separate.</p></div>
            <div className="mini-card"><strong>Support sharing tip</strong><p>Only invite trusted people. You can revoke access from the Support viewers section.</p></div>
          </>
        ) : (
          <>
            <h3>What accounts unlock</h3>
            <div className="mini-card"><strong>Device sync</strong><p>Use 4Sara on a phone, laptop, or new browser.</p></div>
            <div className="mini-card"><strong>Safer backup</strong><p>Reduce the risk of losing data if browser storage is cleared.</p></div>
            <div className="mini-card"><strong>Cloud controls</strong><p>Export, delete cloud data, and manage account privacy.</p></div>
          </>
        )}
      </Card>
    </main>
  );
}


function CloudStatusBadge({ authUser, autoSyncEnabled, cloudCheckedForAccount, cloudSyncAllowed, syncBusy, lastCloudSave }) {
  let label = "Local only";
  let className = "local";

  if (authUser && syncBusy) {
    label = "Saving...";
    className = "saving";
  } else if (authUser && cloudCheckedForAccount && !cloudSyncAllowed) {
    label = "Auto-sync paused";
    className = "paused";
  } else if (authUser && autoSyncEnabled && lastCloudSave) {
    label = `Synced ${lastCloudSave}`;
    className = "synced";
  } else if (authUser && autoSyncEnabled) {
    label = "Cloud connected";
    className = "connected";
  } else if (authUser) {
    label = "Cloud connected, auto-sync off";
    className = "paused";
  }

  return <span className={`cloud-status-badge ${className}`}>{label}</span>;
}


function ViewModeSwitcher({ viewMode, setViewMode, setActiveTab, sharedProfiles, selectedSharedOwnerId, setSelectedSharedOwnerId, chooseSharedSupportView }) {
  const profiles = Object.values(sharedProfiles || {});

  const switchToOwner = () => {
    setViewMode("owner");
    setSelectedSharedOwnerId("");
    setActiveTab("dashboard");
  };

  const switchToMySupportPreview = () => {
    setViewMode("support");
    setSelectedSharedOwnerId("");
    setActiveTab("calendar");
  };

  return (
    <div className="view-mode-switcher" aria-label="Choose viewing mode">
      <button className={viewMode === "owner" ? "active" : ""} onClick={switchToOwner}>My 4Sara</button>
      <button className={viewMode === "support" && !selectedSharedOwnerId ? "active" : ""} onClick={switchToMySupportPreview}>My Support View</button>

      {profiles.length > 0 && (
        <select
          value={viewMode === "support" && selectedSharedOwnerId ? selectedSharedOwnerId : ""}
          onChange={(event) => {
            if (event.target.value) chooseSharedSupportView(event.target.value);
          }}
          aria-label="Choose a shared Support View"
        >
          <option value="">Shared Support Views</option>
          {profiles.map((profile) => (
            <option key={profile.ownerUserId} value={profile.ownerUserId}>
              {profile.displayName || "Shared 4Sara"}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function HowToHelpPage({ stats, entries, calendarData, sharedSupportData }) {
  const todayCalendarDay = (calendarData || []).find((day) => !day.empty && (day.dateKey || day.key) === todayKey());
  const phase = todayCalendarDay?.phaseLabel
    || getCurrentProjectedPhase(stats, entries)
    || "Unknown";
  const phaseText = phaseDescription(phase);
  const topSymptoms = (stats.symptomStats || []).slice(0, 5);
  const phasePatterns = stats.checkInPhaseInsights || [];

  const supportTips = {
    Menstruation: [
      "Offer comfort, rest, water, a heating pad, or help with small tasks.",
      "Be patient if energy is lower or cramps are present.",
      "Avoid minimizing pain or symptoms."
    ],
    Follicular: [
      "Encourage gentle planning, movement, or routines if energy is improving.",
      "This may be a good time for positive motivation and shared plans.",
      "Keep support flexible because energy can still vary."
    ],
    Fertile: [
      "Be supportive and attentive to mood, energy, and body changes.",
      "Respect privacy and boundaries around fertility information.",
      "Remember the fertile window is only an estimate."
    ],
    Ovulation: [
      "Support comfort if there is bloating, one-sided pain, or sensitivity.",
      "Respect privacy and boundaries around ovulation information.",
      "Remember ovulation timing is estimated and can shift."
    ],
    Luteal: [
      "Be extra patient with mood changes, cravings, fatigue, or irritability.",
      "Offer help before stress builds up, such as errands, meals, or quiet time.",
      "Avoid unnecessary conflict and do not dismiss symptoms."
    ],
    Unknown: [
      "Ask what kind of support would be helpful today.",
      "Be patient, listen first, and avoid assumptions.",
      "Encourage rest or medical care if symptoms feel concerning."
    ]
  };

  const tips = supportTips[phase] || supportTips.Unknown;

  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><HeartPulse size={20} /> How to Help{sharedSupportData?.displayName ? ` ${sharedSupportData.displayName}` : ""}</h2>
        <p className="muted">This read-only support guide uses the same phase shown for today on the Calendar tab, plus logged patterns, to suggest simple ways to be helpful.</p>

        <div className="help-current-card">
          <p className="account-eyebrow">Estimated current phase for {formatDate(todayKey())}</p>
          <h3>{phase}</h3>
          <p>{phaseText}</p>
        </div>

        <div className="help-tip-list">
          {tips.map((tip) => (
            <div className="mini-card" key={tip}>
              <strong>Support idea</strong>
              <p>{tip}</p>
            </div>
          ))}
        </div>

        <div className="privacy-section legal-section">
          <h3>Support reminder</h3>
          <p>This view is not medical advice. It is meant to help supporters be more thoughtful, patient, and aware. The current phase shown here matches today’s phase on the Calendar tab. Always respect privacy, consent, and boundaries.</p>
        </div>
      </Card>

      <Card className="pad side-col">
        <h3>Recent patterns</h3>
        {topSymptoms.length ? topSymptoms.map(([symptom, count]) => (
          <div className="mini-card" key={symptom}><strong>{symptom}</strong><p>Logged {count} time{count === 1 ? "" : "s"}.</p></div>
        )) : <p className="muted">No symptom patterns yet.</p>}

        <h3>Check-ins by phase</h3>
        {phasePatterns.length ? phasePatterns.slice(0, 5).map((item) => (
          <div className="mini-card" key={item.phase}>
            <strong>{item.phase}</strong>
            <p>{item.count} check-in{item.count === 1 ? "" : "s"} logged.</p>
            {item.topMood && <p>Common mood: {item.topMood[0]}</p>}
          </div>
        )) : <p className="muted">No phase check-in patterns yet.</p>}
      </Card>
    </main>
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



function PasswordRequirements({ password }) {
  const result = validateStrongPassword(password || "");

  return (
    <div className="password-rules">
      <p>Password requirements:</p>
      <ul>
        <li className={result.hasMinLength ? "met" : ""}>At least 8 characters</li>
        <li className={result.hasUppercase ? "met" : ""}>At least 1 uppercase letter</li>
        <li className={result.hasLowercase ? "met" : ""}>At least 1 lowercase letter</li>
        <li className={result.hasNumber ? "met" : ""}>At least 1 number</li>
        <li className={result.hasSpecialCharacter ? "met" : ""}>At least 1 special character</li>
      </ul>
    </div>
  );
}

function AccountPromptScreen({ authUser, authLoading, authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword, authError, authNotice, handleAuthSubmit, handlePasswordReset, onContinue }) {
  useEffect(() => {
    if (authUser) {
      const timer = setTimeout(() => onContinue(), 900);
      return () => clearTimeout(timer);
    }
  }, [authUser, onContinue]);

  return (
    <div className="welcome-screen">
      <div className="welcome-shell account-prompt-shell">
        <div className="welcome-logo" aria-hidden="true">
          <img src="/icons/icon-192.png" alt="" />
        </div>

        <div className="pill"><Mail size={16} /> Optional account setup</div>

        <h1>Save 4Sara for later</h1>

        <p className="welcome-lead">
          Create an account now so 4Sara can support cloud syncing in the next step. You can also continue without an account and keep your data on this device.
        </p>

        {authLoading ? (
          <p className="muted">Checking account status...</p>
        ) : authUser ? (
          <div className="account-created-card">
            <strong>Signed in as {authUser.email}</strong>
            <p>Taking you to setup...</p>
          </div>
        ) : (
          <div className="auth-panel account-prompt-panel">
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
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="8+ chars, uppercase, lowercase, number, special character" />
              </label>

              {authMode === "signup" && <PasswordRequirements password={authPassword} />}

              {authError && <p className="auth-error">{authError}</p>}
              {authNotice && <p className="auth-notice">{authNotice}</p>}

              {authMode === "signin" && (
                <button type="button" className="link-button" onClick={handlePasswordReset}>Forgot password?</button>
              )}

              <div className="welcome-actions">
                <Button onClick={handleAuthSubmit}>
                  {authMode === "signup" ? "Create account" : "Log in"}
                </Button>
                <Button onClick={onContinue} variant="secondary">Continue without account</Button>
              </div>
            </div>

            <p className="auth-note">
              This step is optional. Cloud sync will be added next; for now, your tracking data still saves locally on this device.
            </p>
          </div>
        )}
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
        <div className="consent-card">
          <label className="consent-row">
            <input
              type="checkbox"
              checked={Boolean(onboarding.consentAccepted)}
              onChange={(e) => setOnboarding({ ...onboarding, consentAccepted: e.target.checked })}
            />
            <span>
              I understand 4Sara is for wellness tracking only. Predictions are estimates and should not be used as medical advice or birth control. I understand my data may be stored locally and, if I log in, synced to cloud storage.
            </span>
          </label>
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

function CalendarPanel({ calendarDate, calendarData, moveMonth, onDayClick, selectedCalendarDay, onLogSelectedDate, readOnly = false }) {
  const isReadOnly = Boolean(readOnly);
  const selectedDay = calendarData.find((day) => day.dateKey === selectedCalendarDay || day.key === selectedCalendarDay) || null;

  const handleDayClick = (day) => {
    if (!day || day.empty) return;

    if (day.isFuture) {
      onDayClick("");
      return;
    }

    onDayClick(day.dateKey || day.key);
  };

  const renderEntryDetails = (entry, title = "Logged menstruation") => {
    if (!entry) return null;

    return (
      <div className="calendar-log-card">
        <strong>{title}</strong>
        <p><span>Date:</span> {formatDate(entry.startDate)}{entry.endDate ? ` - ${formatDate(entry.endDate)}` : ""}</p>
        {entry.flow && entry.flow !== "N/A" && <p><span>Flow:</span> {entry.flow}</p>}
        {moodLabel(entry) !== "N/A" && <p><span>Mood(s):</span> {moodLabel(entry)}</p>}
        {(entry.symptoms || []).length > 0 && <p><span>Symptoms:</span> {(entry.symptoms || []).join(", ")}</p>}
        {entry.notes && <p><span>Notes:</span> {entry.notes}</p>}
      </div>
    );
  };

  return (
    <main>
      <Card className="pad">
        <div className="card-head">
          <div>
            <h2>Calendar</h2>
            <p className="muted">
              {isReadOnly ? "Tap a past date to view shared details. Future dates stay hidden." : "Tap a past or current date to view logs or add a new entry."}
            </p>
          </div>
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
            <button
              key={day.key}
              disabled={day.empty}
              onClick={() => handleDayClick(day)}
              className={`day ${day.empty ? "empty" : ""} ${day.isFuture ? "future-disabled" : ""} ${day.entry ? "period" : ""} ${!day.entry && day.isPredicted ? "predicted" : ""} ${!day.entry && !day.isPredicted && (day.isFertile || day.isOvulation) ? "fertile" : ""} ${day.isFollicular ? "follicular" : ""} ${day.isLuteal ? "luteal" : ""} ${day.isToday ? "today-outline" : ""} ${selectedCalendarDay === (day.dateKey || day.key) ? "selected" : ""}`}
              title={day.isFuture ? "Future dates are prediction-only and do not open details." : "View date details"}
            >
              {!day.empty && <>
                <b>{day.dayNumber}</b>
                {day.entry && <small>Menstruation</small>}
                {!day.entry && day.isPredicted && <small>Predicted</small>}
                {!day.entry && !day.isPredicted && day.isOvulation && <small>Ovulation</small>}
                {!day.entry && !day.isPredicted && !day.isOvulation && day.isFertile && <small>Fertile</small>}
                {!day.entry && !day.isPredicted && !day.isOvulation && !day.isFertile && day.isFollicular && <small>Follicular</small>}
                {!day.entry && !day.isPredicted && !day.isOvulation && !day.isFertile && day.isLuteal && <small>Luteal</small>}
                {(day.checkIns || []).length > 0 && <small>Check-in</small>}
              </>}
            </button>
          ))}
        </div>

        {selectedDay && !selectedDay.empty && !selectedDay.isFuture && (
          <div className="selected-card selected-card-enhanced">
            <div className="selected-main">
              <p className="muted">Selected date</p>
              <h3>{formatDate(selectedDay.dateKey || selectedDay.key || selectedCalendarDay)}</h3>

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
                {(selectedDay.checkIns || []).length > 0 && <span className="chip blue-chip">Daily check-in saved</span>}
                {selectedDay.isToday && <span className="chip gray-chip">Today</span>}
                {!selectedDay.entry && !(selectedDay.checkIns || []).length && <span className="chip gray-chip">No logs for this date</span>}
              </div>

              <div className="calendar-log-section">
                {selectedDay.entry && renderEntryDetails(selectedDay.entry)}
                {(selectedDay.checkIns || []).map((entry, index) => (
                  <div className="calendar-log-card" key={entry.id || `${entry.startDate}-${index}`}>
                    <strong>Daily check-in</strong>
                    {moodLabel(entry) !== "N/A" && <p><span>Mood(s):</span> {moodLabel(entry)}</p>}
                    {(entry.symptoms || []).length > 0 && <p><span>Symptoms:</span> {(entry.symptoms || []).join(", ")}</p>}
                    {entry.notes && <p><span>Notes:</span> {entry.notes}</p>}
                  </div>
                ))}
              </div>

              <p className="phase-tip">Phase labels are estimates based on the last menstruation date, average cycle length, and predicted ovulation. Timing can shift.</p>
            </div>

            <div className="actions selected-actions">
              {isReadOnly ? (
                <p className="future-note">Support View is read-only. Previous logs can be viewed, but logging is not available.</p>
              ) : (
                <>
                  <Button onClick={() => onLogSelectedDate(selectedDay.dateKey || selectedDay.key || selectedCalendarDay, "period")}><Plus size={16} /> Log menstruation</Button>
                  <Button onClick={() => onLogSelectedDate(selectedDay.dateKey || selectedDay.key || selectedCalendarDay, "checkin")} variant="secondary"><Smile size={16} /> Daily check-in</Button>
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

function PrivacyPage({ settings, authUser, syncStatus, cloudHasData, syncBusy, deleteCloudData, confirmDeleteCloud, setConfirmDeleteCloud, deleteAccount, confirmDeleteAccount, setConfirmDeleteAccount, setLocked, clearData, exportJson, exportCsv }) {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Lock size={20} /> Privacy & data</h2>
        <p className="muted">
          4Sara can use both local device storage and optional cloud storage. This page explains where your data is stored and how to control it.
        </p>

        <div className="privacy-grid">
          <div className="privacy-info-card">
            <h3>Local data</h3>
            <p>Your logs, check-ins, settings, and symptoms are saved in this browser/device so the app can work quickly.</p>
            <strong>Stored on this device</strong>
          </div>

          <div className="privacy-info-card">
            <h3>Cloud data</h3>
            <p>If you are logged in and cloud sync is enabled, 4Sara can save a copy of your data to your account so it can be used on another device.</p>
            <strong>{authUser ? `Signed in as ${authUser.email}` : "Not signed in"}</strong>
          </div>
        </div>

        <div className="privacy-section">
          <h3>Export your data</h3>
          <p>Download a backup before clearing or deleting anything.</p>
          <div className="actions">
            <Button onClick={exportJson} variant="secondary"><Download size={16} /> Export backup JSON</Button>
            <Button onClick={exportCsv} variant="secondary"><Download size={16} /> Export spreadsheet CSV</Button>
          </div>
        </div>

        <div className="privacy-section">
          <h3>Cloud storage status</h3>
          <p>{authUser ? syncStatus : "You are not logged in. Your data is currently local to this device."}</p>
          <div className="privacy-status-row">
            <span className={authUser ? "status-pill online" : "status-pill local"}>{authUser ? "Account connected" : "Local only"}</span>
            {authUser && <span className={cloudHasData ? "status-pill online" : "status-pill local"}>{cloudHasData ? "Cloud data found" : "No cloud data found yet"}</span>}
          </div>
        </div>

        {authUser && (
          <div className="privacy-section danger-zone">
            <h3>Delete cloud data</h3>
            <p>This deletes the cloud copy of your 4Sara data from your account. It does not delete the local data saved on this device.</p>
            {confirmDeleteCloud && <p className="danger-confirm">Confirm delete: click the button again to permanently remove the cloud copy.</p>}
            <div className="actions">
              <Button onClick={deleteCloudData} variant="secondary" disabled={syncBusy}>
                {confirmDeleteCloud ? "Confirm delete cloud data" : "Delete cloud data"}
              </Button>
              {confirmDeleteCloud && <Button onClick={() => setConfirmDeleteCloud(false)} variant="secondary">Cancel</Button>}
            </div>
          </div>
        )}


        {authUser && (
          <div className="privacy-section danger-zone account-delete-zone">
            <h3>Delete account</h3>
            <p>This deletes your account and cloud data. It does not delete the local data saved on this device.</p>
            {confirmDeleteAccount && <p className="danger-confirm">Confirm delete: click the button again to permanently delete this account.</p>}
            <div className="actions">
              <Button onClick={deleteAccount} variant="secondary" disabled={syncBusy}>
                {confirmDeleteAccount ? "Confirm delete account" : "Delete account"}
              </Button>
              {confirmDeleteAccount && <Button onClick={() => setConfirmDeleteAccount(false)} variant="secondary">Cancel</Button>}
            </div>
          </div>
        )}

        <div className="privacy-section legal-section">
          <h3>Privacy Policy</h3>
          <p>
            4Sara is designed to help users privately track menstruation, symptoms, moods, cycle phases, and related wellness notes.
          </p>
          <ul>
            <li><strong>Local data:</strong> Your entries, check-ins, symptoms, moods, and settings may be saved on this device/browser.</li>
            <li><strong>Cloud data:</strong> If you create an account and use cloud sync, a copy of your 4Sara data may be saved to your account so it can be used across devices.</li>
            <li><strong>Export:</strong> You can export your data as a backup file or spreadsheet.</li>
            <li><strong>Delete:</strong> You can clear local data from this device and delete cloud data from your account.</li>
            <li><strong>Account email:</strong> If you create an account, your email address is used for login, password reset, and account verification.</li>
          </ul>
          <p className="legal-note">
            Do not enter information you do not want stored locally or synced to your account. If you are sharing a device, use your device lock and 4Sara PIN options carefully.
          </p>
        </div>

        <div className="privacy-section legal-section">
          <h3>Terms & Disclaimer</h3>
          <p>
            4Sara is a wellness tracking tool. It is not a medical device, medical provider, or emergency service.
          </p>
          <ul>
            <li>Cycle phases, fertile windows, ovulation dates, and menstruation predictions are estimates only.</li>
            <li>4Sara should not be used as birth control or as a substitute for medical advice.</li>
            <li>Predictions may be wrong if cycles are irregular, data is missing, health changes occur, medication changes occur, pregnancy occurs, or other factors affect the cycle.</li>
            <li>For medical concerns, severe pain, unusually heavy bleeding, pregnancy questions, or urgent symptoms, contact a qualified healthcare professional.</li>
            <li>By using 4Sara, users are responsible for reviewing their own data and understanding that the app provides tracking and estimated insights only.</li>
          </ul>
          <p className="legal-note">
            If something feels medically urgent, do not wait on the app. Seek appropriate medical care.
          </p>
        </div>

        <div className="privacy-section danger-zone">
          <h3>Clear local data</h3>
          <p>This removes 4Sara data from this browser/device. It does not delete cloud data from your account.</p>
          <Button onClick={clearData} variant="secondary">Clear local data on this device</Button>
        </div>
      </Card>

      <Card className="pad side-col">
        <h3>Quick guide</h3>
        <div className="mini-card"><strong>Local data</strong><p>Saved in this browser/device.</p></div>
        <div className="mini-card"><strong>Cloud data</strong><p>Saved to your signed-in account when cloud sync is used.</p></div>
        <div className="mini-card"><strong>Export first</strong><p>Download a backup before deleting data.</p></div>
        <div className="mini-card"><strong>PIN lock</strong><p>Your PIN can lock this device’s app view, but it is not a substitute for your phone or account password.</p></div>
      </Card>

      {settings.pinEnabled && (
        <Card className="pad main-col">
          <h3><KeyRound size={18} /> PIN lock</h3>
          <p className="muted">Lock the app view on this device.</p>
          <Button onClick={() => setLocked(true)} variant="secondary">Lock now</Button>
        </Card>
      )}
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

createRoot(document.getElementById("root")).render(<AppErrorBoundary><App /></AppErrorBoundary>);
