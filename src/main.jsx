
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Droplet,
  EyeOff,
  HeartPulse,
  Home,
  KeyRound,
  Lock,
  Moon,
  Pencil,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "4sara_entries_v4";
const SETTINGS_KEY = "4sara_settings_v4";

const starterEntries = [
  {
    id: 1,
    type: "period",
    startDate: "2026-04-28",
    endDate: "2026-05-02",
    flow: "Medium",
    mood: "Calm",
    symptoms: ["Cramps", "Fatigue"],
    notes: "Mild cramps on day one.",
  },
  {
    id: 2,
    type: "period",
    startDate: "2026-05-26",
    endDate: "2026-05-30",
    flow: "Light",
    mood: "Sensitive",
    symptoms: ["Bloating", "Back pain"],
    notes: "Started lighter than normal.",
  },
];

const defaultSettings = {
  pinEnabled: false,
  pin: "",
  remindersEnabled: true,
  reminderDaysBefore: 2,
  cycleLengthOverride: "",
  periodLengthOverride: "",
  onboardingComplete: false,
  customSymptoms: [],
  darkMode: false,
  profileName: "",
  profileAge: "",
};

const presetSymptoms = [
  "Cramps",
  "Headache",
  "Bloating",
  "Fatigue",
  "Acne",
  "Back pain",
  "Cravings",
  "Mood swings",
  "Nausea",
  "Tender breasts",
];

const moodOptions = ["Calm", "Happy", "Sensitive", "Irritable", "Sad", "Anxious", "Energetic", "Tired"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function addDays(dateString, days) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function getDaysInRange(start, end) {
  if (!start) return [];
  const safeEnd = end || start;
  const total = Math.max(0, daysBetween(start, safeEnd));
  return Array.from({ length: total + 1 }, (_, index) => addDays(start, index));
}

function monthName(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function blankForm() {
  return {
    type: "period",
    startDate: todayKey(),
    endDate: "",
    flow: "Medium",
    mood: "Calm",
    symptoms: [],
    notes: "",
  };
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadJson(entries, settings) {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    entries,
    settings: { ...settings, pin: settings.pin ? "[hidden]" : "" },
  };
  downloadFile("4sara-data.json", JSON.stringify(exportPayload, null, 2), "application/json");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(entries) {
  const headers = ["Start Date", "End Date", "Type", "Flow", "Mood", "Symptoms", "Notes"];
  const rows = entries.map((entry) => [
    entry.startDate,
    entry.endDate || "",
    entry.type || "period",
    entry.flow || "",
    entry.mood || "",
    (entry.symptoms || []).join("; "),
    entry.notes || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile("4sara-cycle-history.csv", csv, "text/csv;charset=utf-8");
}

function printReport(entries, stats) {
  const periodEntries = entries.filter((entry) => (entry.type || "period") === "period");
  const checkIns = entries.filter((entry) => (entry.type || "period") === "checkin");

  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.startDate || ""}</td>
        <td>${(entry.type || "period") === "checkin" ? "Daily check-in" : "Period"}</td>
        <td>${entry.endDate || ""}</td>
        <td>${entry.flow || ""}</td>
        <td>${entry.mood || ""}</td>
        <td>${(entry.symptoms || []).join("; ")}</td>
        <td>${entry.notes || ""}</td>
      </tr>`
    )
    .join("");

  const symptomCounts = entries.flatMap((entry) => entry.symptoms || []).reduce((acc, symptom) => {
    acc[symptom] = (acc[symptom] || 0) + 1;
    return acc;
  }, {});

  const symptoms =
    Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symptom, count]) => `${symptom} (${count})`)
      .join(", ") || "No symptoms logged yet";

  const noteRows = entries
    .filter((entry) => entry.notes)
    .slice(0, 12)
    .map((entry) => `<li><strong>${entry.startDate}</strong> — ${entry.notes}</li>`)
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <title>4Sara Doctor Summary Report</title>
  <style>
    body{font-family:Arial,sans-serif;color:#1f2937;padding:32px;line-height:1.45}
    h1{color:#be123c;margin:0 0 4px} h2{margin-top:28px;color:#374151}
    .meta{color:#6b7280;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}
    .card{border:1px solid #fecdd3;border-radius:14px;padding:14px;background:#fff1f2}.card.alt{background:#faf5ff;border-color:#e9d5ff}
    .label{color:#6b7280;font-size:12px}.value{font-weight:700;font-size:16px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:top;text-align:left}th{background:#fff1f2}
    .disclaimer{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px;font-size:12px;color:#78350f;margin-top:22px}
    ul{padding-left:20px}button{padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:white;margin-bottom:20px;cursor:pointer;font-weight:700}
    @media print{button{display:none}body{padding:0}.card{break-inside:avoid}table{font-size:10px}}
  </style>
</head>
<body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>4Sara Doctor Summary Report</h1>
  <div class="meta">Generated ${new Date().toLocaleString()}</div>

  <h2>Cycle Summary</h2>
  <div class="grid">
    <div class="card"><div class="label">Logged periods</div><div class="value">${periodEntries.length}</div></div>
    <div class="card"><div class="label">Daily check-ins</div><div class="value">${checkIns.length}</div></div>
    <div class="card"><div class="label">Average cycle length</div><div class="value">${stats.averageCycle} days</div></div>
    <div class="card"><div class="label">Average period length</div><div class="value">${stats.averagePeriod} days</div></div>
    <div class="card alt"><div class="label">Next predicted period</div><div class="value">${stats.nextPeriod ? formatDate(stats.nextPeriod) : "Not enough data"}</div></div>
    <div class="card alt"><div class="label">Fertile window estimate</div><div class="value">${stats.fertileStart ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "Not enough data"}</div></div>
  </div>

  <h2>Symptom Summary</h2>
  <div class="card"><div class="label">Most logged symptoms</div><div class="value">${symptoms}</div></div>

  <h2>Notes Summary</h2>
  ${noteRows ? `<ul>${noteRows}</ul>` : `<p>No notes logged yet.</p>`}

  <h2>Full Entry History</h2>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>End Date</th><th>Flow</th><th>Mood</th><th>Symptoms</th><th>Notes</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7">No entries logged.</td></tr>`}</tbody>
  </table>

  <div class="disclaimer">This report is for personal tracking and discussion with a healthcare professional. Predictions are estimates and are not medical advice.</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=950,height=750");
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
}

function Button({ children, onClick, variant = "primary", className = "", disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`btn ${variant === "secondary" ? "btn-secondary" : ""} ${className}`}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function App() {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : starterEntries;
    } catch {
      return starterEntries;
    }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
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
  const [customSymptomInput, setCustomSymptomInput] = useState("");
  const [onboarding, setOnboarding] = useState({
    profileName: "",
    profileAge: "",
    lastPeriodStart: todayKey(),
    averageCycleLength: "28",
    averagePeriodLength: "5",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.pinEnabled && settings.pin) setLocked(true);
  }, []);

  const showMessage = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  };

  const updateSettings = (patch) => setSettings((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const hasPeriodEntry = entries.some((entry) => (entry.type || "period") === "period");
    if (settings.onboardingComplete && !hasPeriodEntry) {
      updateSettings({ onboardingComplete: false });
    }
  }, [entries, settings.onboardingComplete]);

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)), [entries]);

  const allSymptoms = useMemo(() => {
    const custom = Array.isArray(settings.customSymptoms) ? settings.customSymptoms : [];
    return [...new Set([...presetSymptoms, ...custom])];
  }, [settings.customSymptoms]);

  const stats = useMemo(() => {
    const periodEntries = entries.filter((entry) => (entry.type || "period") === "period");
    const chronological = [...periodEntries].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const last = chronological[chronological.length - 1];

    const cycleLengths = [];
    for (let i = 1; i < chronological.length; i++) {
      cycleLengths.push(daysBetween(chronological[i - 1].startDate, chronological[i].startDate));
    }

    const calculatedCycle = cycleLengths.length ? Math.round(cycleLengths.reduce((sum, n) => sum + n, 0) / cycleLengths.length) : 28;

    const periodLengths = chronological.filter((entry) => entry.endDate).map((entry) => daysBetween(entry.startDate, entry.endDate) + 1);
    const calculatedPeriod = periodLengths.length ? Math.round(periodLengths.reduce((sum, n) => sum + n, 0) / periodLengths.length) : 5;

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

    const currentCycleDay = last ? Math.max(1, daysBetween(last.startDate, todayKey()) + 1) : null;
    const minCycle = cycleLengths.length ? Math.min(...cycleLengths) : null;
    const maxCycle = cycleLengths.length ? Math.max(...cycleLengths) : null;
    const dataConfidence = periodEntries.length >= 6 ? "Strong" : periodEntries.length >= 3 ? "Good" : periodEntries.length >= 1 ? "Limited" : "No data";
    const confidenceNote =
      periodEntries.length >= 6
        ? "Predictions are stronger because several cycles are logged."
        : periodEntries.length >= 3
        ? "Predictions are improving as more cycles are logged."
        : periodEntries.length >= 1
        ? "Add at least 3 cycles for better predictions."
        : "Add a period entry to start seeing insights.";

    return {
      last,
      averageCycle,
      averagePeriod,
      nextPeriod,
      predictedEnd,
      ovulationDay,
      fertileStart,
      fertileEnd,
      reminderDate,
      daysUntil,
      currentCycleDay,
      minCycle,
      maxCycle,
      dataConfidence,
      confidenceNote,
      mostCommonSymptoms: symptomStats.slice(0, 3),
      symptomStats,
      totalEntries: periodEntries.length,
    };
  }, [entries, settings]);

  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    const periodDays = new Map();
    const checkInDays = new Map();

    entries
      .filter((entry) => (entry.type || "period") === "period")
      .forEach((entry) => getDaysInRange(entry.startDate, entry.endDate).forEach((day) => periodDays.set(day, entry)));

    entries
      .filter((entry) => (entry.type || "period") === "checkin")
      .forEach((entry) => {
        if (!checkInDays.has(entry.startDate)) checkInDays.set(entry.startDate, []);
        checkInDays.get(entry.startDate).push(entry);
      });

    const predictedDays = new Set(getDaysInRange(stats.nextPeriod, stats.predictedEnd));
    const fertileDays = new Set(getDaysInRange(stats.fertileStart, stats.fertileEnd));

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startOffset + 1;
      if (dayNumber < 1 || dayNumber > lastDay.getDate()) return { empty: true, key: `empty-${index}` };

      const date = new Date(year, month, dayNumber);
      const key = toDateKey(date);

      return {
        empty: false,
        key,
        dayNumber,
        dateKey: key,
        isToday: key === todayKey(),
        entry: periodDays.get(key),
        checkIns: checkInDays.get(key) || [],
        isPredicted: predictedDays.has(key),
        isFertile: fertileDays.has(key),
        isOvulation: key === stats.ovulationDay,
      };
    });
  }, [calendarDate, entries, stats]);

  const completeOnboarding = () => {
    if (!onboarding.profileName.trim()) return showMessage("Enter a name first.");
    if (!onboarding.profileAge) return showMessage("Enter an age first.");
    if (!onboarding.lastPeriodStart) return showMessage("Enter the last period start date first.");

    const cycleLength = Number(onboarding.averageCycleLength) || 28;
    const periodLength = Number(onboarding.averagePeriodLength) || 5;

    const firstEntry = {
      id: Date.now(),
      type: "period",
      startDate: onboarding.lastPeriodStart,
      endDate: addDays(onboarding.lastPeriodStart, periodLength - 1),
      flow: "Medium",
      mood: "Calm",
      symptoms: [],
      notes: "Created during first-time setup.",
    };

    setEntries([firstEntry]);

    updateSettings({
      cycleLengthOverride: String(cycleLength),
      periodLengthOverride: String(periodLength),
      onboardingComplete: true,
      profileName: onboarding.profileName.trim(),
      profileAge: onboarding.profileAge,
    });

    setCalendarDate(new Date(onboarding.lastPeriodStart + "T00:00:00"));
    setActiveTab("dashboard");
    showMessage("Setup complete. Your first prediction is ready.");
  };

  const skipOnboarding = () => {
    updateSettings({ onboardingComplete: true });
    showMessage("Setup skipped. You can still log a cycle anytime.");
  };

  const toggleSymptom = (symptom) => {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom) ? current.symptoms.filter((item) => item !== symptom) : [...current.symptoms, symptom],
    }));
  };

  const addCustomSymptom = () => {
    const cleaned = customSymptomInput.trim();
    if (!cleaned) return showMessage("Type a symptom first.");
    const exists = allSymptoms.some((symptom) => symptom.toLowerCase() === cleaned.toLowerCase());
    if (exists) return showMessage("That symptom already exists.");
    updateSettings({ customSymptoms: [...(settings.customSymptoms || []), cleaned] });
    setCustomSymptomInput("");
    showMessage("Custom symptom added.");
  };

  const removeCustomSymptom = (symptomToRemove) => {
    updateSettings({ customSymptoms: (settings.customSymptoms || []).filter((symptom) => symptom !== symptomToRemove) });
    setForm((current) => ({ ...current, symptoms: current.symptoms.filter((symptom) => symptom !== symptomToRemove) }));
    showMessage("Custom symptom removed.");
  };

  const saveEntry = () => {
    if (!form.startDate) return showMessage("Start date is required.");
    if (form.type === "period" && form.endDate && daysBetween(form.startDate, form.endDate) < 0) return showMessage("End date cannot be before start date.");

    const cleanForm = {
      ...form,
      endDate: form.type === "checkin" ? "" : form.endDate,
      flow: form.type === "checkin" ? "" : form.flow,
    };

    if (editingId) {
      setEntries((current) => current.map((entry) => (entry.id === editingId ? { ...entry, ...cleanForm } : entry)));
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
      mood: entry.mood || "Calm",
      symptoms: entry.symptoms || [],
      notes: entry.notes || "",
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
    showMessage(type === "checkin" ? "Ready to add today's check-in." : "Ready to log today.");
  };

  const selectCalendarDate = (dateKey) => {
    setSelectedCalendarDay(dateKey);
    showMessage(`Selected ${formatDate(dateKey)}.`);
  };

  const startLogForSelectedDate = (dateKey = selectedCalendarDay, type = "period") => {
    if (!dateKey) return showMessage("Select a calendar date first.");
    setForm({ ...blankForm(), type, startDate: dateKey, endDate: "" });
    setEditingId(null);
    setActiveTab("log");
    showMessage(type === "checkin" ? `Ready to add a check-in for ${formatDate(dateKey)}.` : `Ready to log ${formatDate(dateKey)}.`);
  };

  const jumpToNextPeriod = () => {
    if (!stats.nextPeriod) return showMessage("Add a cycle first so 4Sara can predict the next period.");
    setCalendarDate(new Date(stats.nextPeriod + "T00:00:00"));
    setActiveTab("calendar");
    showMessage("Showing the predicted period on the calendar.");
  };

  const testReminder = () => {
    if (!settings.remindersEnabled) return showMessage("Reminders are turned off. Turn them on in Settings first.");
    if (!stats.reminderDate) return showMessage("Add a cycle first so 4Sara can calculate a reminder date.");
    showMessage(`Preview reminder: your period may start around ${formatDate(stats.nextPeriod)}.`);
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText);
      const importedEntries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(importedEntries)) throw new Error("Missing entries array");

      const cleaned = importedEntries
        .filter((entry) => entry.startDate)
        .map((entry, index) => ({
          id: entry.id || Date.now() + index,
          type: entry.type || "period",
          startDate: entry.startDate,
          endDate: entry.endDate || "",
          flow: entry.flow || "Medium",
          mood: entry.mood || "Calm",
          symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
          notes: entry.notes || "",
        }));

      setEntries(cleaned);
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
    { id: "mobile", label: "Mobile", icon: Home },
  ];

  if (!settings.onboardingComplete) {
    return (
      <div className={settings.darkMode ? "app dark" : "app"}>
        <OnboardingScreen onboarding={onboarding} setOnboarding={setOnboarding} completeOnboarding={completeOnboarding} skipOnboarding={skipOnboarding} message={message} />
      </div>
    );
  }

  if (locked && settings.pinEnabled && settings.pin) {
    return (
      <div className={settings.darkMode ? "app dark" : "app"}>
        <div className="screen-center">
          <Card className="lock-card">
            <EyeOff className="big-icon" />
            <h1>4Sara is locked</h1>
            <p className="muted">Enter your PIN to open your tracker on this device.</p>
            <input className="input center-input" type="password" value={pinAttempt} onChange={(event) => setPinAttempt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && tryUnlock()} placeholder="Enter PIN" />
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
            <div className="pill">
              <ShieldCheck size={16} /> Private browser-based prototype
            </div>
            <h1>{settings.profileName ? `Welcome back, ${settings.profileName}` : "4Sara"}</h1>
            <p className="muted">Track periods, symptoms, moods, reminders, fertility estimates, and cycle history.</p>
          </div>
          <div className="actions">
            <Button onClick={() => logToday("period")}>
              <Plus size={16} /> Log Today
            </Button>
          </div>
        </header>

        {message && <div className="message">{message}</div>}

        <nav className="tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`tab ${activeTab === item.id ? "active" : ""}`}>
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {activeTab === "dashboard" && (
              <Dashboard stats={stats} settings={settings} sortedEntries={sortedEntries} startEdit={startEdit} deleteEntry={deleteEntry} jumpToNextPeriod={jumpToNextPeriod} testReminder={testReminder} setLocked={setLocked} />
            )}

            {activeTab === "calendar" && (
              <CalendarPanel
                calendarDate={calendarDate}
                calendarData={calendarData}
                moveMonth={(direction) => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))}
                onDayClick={selectCalendarDate}
                selectedCalendarDay={selectedCalendarDay}
                onLogSelectedDate={startLogForSelectedDate}
              />
            )}

            {activeTab === "log" && (
              <LogTab
                form={form}
                setForm={setForm}
                toggleSymptom={toggleSymptom}
                saveEntry={saveEntry}
                editingId={editingId}
                cancelEdit={() => {
                  setEditingId(null);
                  setForm(blankForm());
                }}
                entries={sortedEntries}
                startEdit={startEdit}
                deleteEntry={deleteEntry}
                allSymptoms={allSymptoms}
                customSymptoms={settings.customSymptoms || []}
                customSymptomInput={customSymptomInput}
                setCustomSymptomInput={setCustomSymptomInput}
                addCustomSymptom={addCustomSymptom}
                removeCustomSymptom={removeCustomSymptom}
              />
            )}

            {activeTab === "insights" && <Insights stats={stats} settings={settings} setLocked={setLocked} />}

            {activeTab === "settings" && (
              <SettingsTab
                settings={settings}
                updateSettings={updateSettings}
                setLocked={setLocked}
                showMessage={showMessage}
                clearData={clearAllData}
                resetDemo={() => {
                  setEntries(starterEntries);
                  updateSettings({ onboardingComplete: true });
                  showMessage("Demo data restored.");
                }}
                importText={importText}
                setImportText={setImportText}
                importJson={importJson}
                sortedEntries={sortedEntries}
                stats={stats}
              />
            )}

            {activeTab === "privacy" && (
              <PrivacyPage
                settings={settings}
                setLocked={setLocked}
                clearData={clearAllData}
                exportJson={() => {
                  downloadJson(entries, settings);
                  showMessage("Backup downloaded.");
                }}
                exportCsv={() => {
                  downloadCsv(sortedEntries);
                  showMessage("Spreadsheet export downloaded.");
                }}
              />
            )}

            {activeTab === "mobile" && <MobileSetupPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function OnboardingScreen({ onboarding, setOnboarding, completeOnboarding, skipOnboarding, message }) {
  return (
    <div className="screen-center">
      <Card className="onboarding-card">
        <div className="pill">
          <Sparkles size={16} /> First-time setup
        </div>
        <h1>Welcome to 4Sara</h1>
        <p className="muted">Answer a few quick questions so 4Sara can personalize the app and create a starting prediction. You can change these later in Settings.</p>
        {message && <div className="message">{message}</div>}

        <div className="form">
          <label>
            <span>Name</span>
            <input type="text" value={onboarding.profileName} onChange={(e) => setOnboarding({ ...onboarding, profileName: e.target.value })} placeholder="Enter name" />
          </label>
          <label>
            <span>Age</span>
            <input type="number" min="1" max="120" value={onboarding.profileAge} onChange={(e) => setOnboarding({ ...onboarding, profileAge: e.target.value })} placeholder="Enter age" />
          </label>
          <label>
            <span>When did the last period start?</span>
            <input type="date" value={onboarding.lastPeriodStart} onChange={(e) => setOnboarding({ ...onboarding, lastPeriodStart: e.target.value })} />
          </label>
          <label>
            <span>Average cycle length</span>
            <input type="number" min="15" max="60" value={onboarding.averageCycleLength} onChange={(e) => setOnboarding({ ...onboarding, averageCycleLength: e.target.value })} />
            <small>Most people start with 28 days if they are unsure.</small>
          </label>
          <label>
            <span>Average period length</span>
            <input type="number" min="1" max="15" value={onboarding.averagePeriodLength} onChange={(e) => setOnboarding({ ...onboarding, averagePeriodLength: e.target.value })} />
            <small>Most people start with 5 days if they are unsure.</small>
          </label>
        </div>

        <div className="two-actions">
          <Button onClick={completeOnboarding}>
            <Save size={16} /> Finish setup
          </Button>
          <Button onClick={skipOnboarding} variant="secondary">
            Skip for now
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Dashboard({ stats, settings, sortedEntries, startEdit, deleteEntry, jumpToNextPeriod, testReminder, setLocked }) {
  return (
    <main className="layout">
      <section className="main-col">
        <Card className="hero-card">
          <div className="hero">
            <div className="hero-row">
              <CalendarDays size={34} />
              <div>
                <p>Next predicted period</p>
                <h2>{stats.nextPeriod ? formatDate(stats.nextPeriod) : "Add a cycle"}</h2>
              </div>
            </div>
            {stats.nextPeriod && <p className="hero-sub">{stats.daysUntil > 0 ? `${stats.daysUntil} days away` : stats.daysUntil === 0 ? "Expected today" : `${Math.abs(stats.daysUntil)} days past prediction`}</p>}
          </div>
          <div className="stats">
            <StatCard icon={Droplet} label="Avg. cycle" value={`${stats.averageCycle} days`} />
            <StatCard icon={Moon} label="Avg. period" value={`${stats.averagePeriod} days`} />
            <StatCard icon={HeartPulse} label="Last period" value={stats.last ? formatDate(stats.last.startDate) : "None yet"} />
          </div>
        </Card>

        <Card className="pad">
          <div className="card-head">
            <h2>Upcoming</h2>
            <div className="actions">
              <Button onClick={jumpToNextPeriod} variant="secondary">
                Show next period
              </Button>
              <Button onClick={testReminder} variant="secondary">
                Test reminder
              </Button>
            </div>
          </div>
          <div className="tiles">
            <InfoTile title="Predicted period" value={stats.nextPeriod ? `${formatDate(stats.nextPeriod)} - ${formatDate(stats.predictedEnd)}` : "Not enough data"} />
            <InfoTile title="Fertile window" value={stats.fertileStart ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "Not enough data"} />
            <InfoTile title="Reminder" value={settings.remindersEnabled && stats.reminderDate ? formatDate(stats.reminderDate) : "Off"} />
          </div>
        </Card>
      </section>

      <aside className="side-col">
        <Card className="pad">
          <h2>Recent entries</h2>
          <EntryList entries={sortedEntries.slice(0, 3)} onEdit={startEdit} onDelete={deleteEntry} compact />
        </Card>
        <PrivacyCard settings={settings} setLocked={setLocked} />
      </aside>
    </main>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <Icon size={24} />
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function InfoTile({ title, value }) {
  return (
    <div className="tile">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function CalendarPanel({ calendarDate, calendarData, moveMonth, onDayClick, selectedCalendarDay, onLogSelectedDate }) {
  const selectedDay = calendarData.find((day) => day.dateKey === selectedCalendarDay);

  return (
    <main>
      <Card className="pad">
        <div className="card-head">
          <div>
            <h2>Calendar</h2>
            <p className="muted">Tap a date to view details, then choose whether to log it.</p>
          </div>
          <div className="month-controls">
            <button onClick={() => moveMonth(-1)} className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <strong>{monthName(calendarDate)}</strong>
            <button onClick={() => moveMonth(1)} className="icon-btn">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="legend">
          <span><i className="dot rose" /> Logged period</span>
          <span><i className="dot purple" /> Predicted period</span>
          <span><i className="dot green" /> Fertile estimate</span>
          <span><i className="dot blue" /> Daily check-in</span>
          <span><i className="dot today" /> Today</span>
        </div>

        <div className="weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}</div>

        <div className="calendar-grid">
          {calendarData.map((day) => (
            <button
              key={day.key}
              disabled={day.empty}
              onClick={() => !day.empty && onDayClick(day.dateKey)}
              className={`day ${day.empty ? "empty" : ""} ${day.entry ? "period" : ""} ${!day.entry && day.isPredicted ? "predicted" : ""} ${!day.entry && !day.isPredicted && day.isFertile ? "fertile" : ""} ${day.isToday ? "today-outline" : ""} ${selectedCalendarDay === day.dateKey ? "selected" : ""}`}
            >
              {!day.empty && (
                <>
                  <b>{day.dayNumber}</b>
                  {day.entry && <small>Period</small>}
                  {!day.entry && day.isPredicted && <small>Predicted</small>}
                  {!day.entry && !day.isPredicted && day.isOvulation && <small>Ovulation</small>}
                  {!day.entry && !day.isPredicted && !day.isOvulation && day.isFertile && <small>Fertile</small>}
                  {day.checkIns && day.checkIns.length > 0 && <small>Check-in</small>}
                </>
              )}
            </button>
          ))}
        </div>

        {selectedDay && !selectedDay.empty && (
          <div className="selected-card">
            <div>
              <p className="muted">Selected date</p>
              <h3>{formatDate(selectedCalendarDay)}</h3>
              <div className="chips">
                {selectedDay.entry && <span className="chip rose-chip">Logged period day</span>}
                {!selectedDay.entry && selectedDay.isPredicted && <span className="chip purple-chip">Predicted period</span>}
                {!selectedDay.entry && selectedDay.isFertile && <span className="chip green-chip">Fertile estimate</span>}
                {selectedDay.isOvulation && <span className="chip green-chip">Estimated ovulation</span>}
                {selectedDay.checkIns && selectedDay.checkIns.length > 0 && <span className="chip blue-chip">Daily check-in saved</span>}
                {selectedDay.isToday && <span className="chip gray-chip">Today</span>}
                {!selectedDay.entry && !selectedDay.isPredicted && !selectedDay.isFertile && !selectedDay.isOvulation && !selectedDay.isToday && (!selectedDay.checkIns || selectedDay.checkIns.length === 0) && <span className="chip gray-chip">No details yet</span>}
              </div>
            </div>
            <div className="actions">
              <Button onClick={() => onLogSelectedDate(selectedCalendarDay, "period")}>
                <Plus size={16} /> Log period
              </Button>
              <Button onClick={() => onLogSelectedDate(selectedCalendarDay, "checkin")} variant="secondary">
                <Smile size={16} /> Daily check-in
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}

function LogTab(props) {
  return (
    <main className="layout">
      <section className="side-col">
        <LogForm {...props} />
      </section>
      <section className="main-col">
        <Card className="pad">
          <h2>All entries</h2>
          <EntryList entries={props.entries} onEdit={props.startEdit} onDelete={props.deleteEntry} />
        </Card>
      </section>
    </main>
  );
}

function LogForm({ form, setForm, toggleSymptom, saveEntry, editingId, cancelEdit, allSymptoms, customSymptoms, customSymptomInput, setCustomSymptomInput, addCustomSymptom, removeCustomSymptom }) {
  return (
    <Card className="pad">
      <h2>{editingId ? "Edit entry" : form.type === "checkin" ? "Add daily check-in" : "Add cycle entry"}</h2>

      <div className="form">
        <div>
          <span className="label">Entry type</span>
          <div className="two-actions">
            <button onClick={() => setForm({ ...form, type: "period" })} className={`choice ${form.type !== "checkin" ? "active" : ""}`}>
              Period
            </button>
            <button onClick={() => setForm({ ...form, type: "checkin", endDate: "" })} className={`choice ${form.type === "checkin" ? "active" : ""}`}>
              Daily check-in
            </button>
          </div>
        </div>

        <label>
          <span>Date</span>
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </label>

        {form.type !== "checkin" && (
          <label>
            <span>End date</span>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
        )}

        {form.type !== "checkin" && (
          <label>
            <span>Flow level</span>
            <select value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })}>
              <option>Light</option>
              <option>Medium</option>
              <option>Heavy</option>
              <option>Spotting</option>
            </select>
          </label>
        )}

        <div>
          <span className="label">Mood</span>
          <div className="choice-grid">
            {moodOptions.map((mood) => (
              <button key={mood} onClick={() => setForm({ ...form, mood })} className={`choice ${form.mood === mood ? "active" : ""}`}>
                {mood}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Symptoms</span>
          <div className="symptom-grid">
            {allSymptoms.map((symptom) => (
              <button key={symptom} onClick={() => toggleSymptom(symptom)} className={`symptom ${form.symptoms.includes(symptom) ? "active" : ""}`}>
                {symptom}
              </button>
            ))}
          </div>

          <div className="custom-symptom">
            <input value={customSymptomInput} onChange={(e) => setCustomSymptomInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomSymptom()} placeholder="Add custom symptom" />
            <Button onClick={addCustomSymptom} variant="secondary">
              Add
            </Button>
          </div>

          {customSymptoms.length > 0 && (
            <div className="custom-list">
              <p>Custom symptoms</p>
              <div className="chips">
                {customSymptoms.map((symptom) => (
                  <button key={symptom} onClick={() => removeCustomSymptom(symptom)} className="chip rose-chip">
                    {symptom} ×
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <label>
          <span>Notes</span>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add anything you noticed..." />
        </label>

        <Button onClick={saveEntry} className="full">
          <Save size={16} /> {editingId ? "Update entry" : "Save entry"}
        </Button>

        {editingId && (
          <Button onClick={cancelEdit} variant="secondary" className="full">
            <X size={16} /> Cancel edit
          </Button>
        )}
      </div>
    </Card>
  );
}

function EntryList({ entries, onEdit, onDelete, compact = false }) {
  if (!entries.length) return <p className="empty">No entries yet. Add a period start date to begin tracking.</p>;

  return (
    <div className="entries">
      {entries.map((entry) => (
        <div key={entry.id} className="entry">
          <div className="entry-head">
            <div>
              <strong>{formatDate(entry.startDate)} {entry.endDate && (entry.type || "period") !== "checkin" ? `- ${formatDate(entry.endDate)}` : ""}</strong>
              <p className="muted">{(entry.type || "period") === "checkin" ? "Daily check-in" : `Flow: ${entry.flow}`} • Mood: {entry.mood}</p>
            </div>
            <div>
              <button onClick={() => onEdit(entry)} className="icon-btn"><Pencil size={16} /></button>
              <button onClick={() => onDelete(entry.id)} className="icon-btn"><Trash2 size={16} /></button>
            </div>
          </div>

          {!compact && entry.symptoms?.length > 0 && (
            <div className="chips">
              {entry.symptoms.map((symptom) => <span key={symptom} className="chip rose-chip">{symptom}</span>)}
            </div>
          )}

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
          <div>
            <p className="muted">Data confidence</p>
            <h3>{stats.dataConfidence}</h3>
          </div>
          <span>{stats.totalEntries} logged {stats.totalEntries === 1 ? "cycle" : "cycles"}</span>
          <p>{stats.confidenceNote}</p>
        </div>

        <div className="tiles">
          <InfoTile title="Current cycle day" value={stats.currentCycleDay ? `Day ${stats.currentCycleDay}` : "Not enough data"} />
          <InfoTile title="Total logged cycles" value={`${stats.totalEntries}`} />
          <InfoTile title="Average cycle length" value={`${stats.averageCycle} days`} />
          <InfoTile title="Average period length" value={`${stats.averagePeriod} days`} />
          <InfoTile title="Cycle range" value={stats.minCycle ? `${stats.minCycle} - ${stats.maxCycle} days` : "Log 2+ cycles"} />
          <InfoTile title="Estimated ovulation" value={stats.ovulationDay ? formatDate(stats.ovulationDay) : "Not enough data"} />
        </div>

        <div className="summary-box">
          <h3>Symptom counts</h3>
          {stats.symptomStats.length ? (
            <div className="count-grid">
              {stats.symptomStats.slice(0, 8).map(([symptom, count]) => (
                <div key={symptom} className="count-row">
                  <span>{symptom}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Add symptoms to see patterns.</p>
          )}
        </div>

        <p className="disclaimer">Predictions are estimates only and should not be used as medical advice or as a primary pregnancy prevention method.</p>
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
          <label>
            <span>Name</span>
            <input type="text" value={settings.profileName || ""} onChange={(e) => updateSettings({ profileName: e.target.value })} />
          </label>
          <label>
            <span>Age</span>
            <input type="number" min="1" max="120" value={settings.profileAge || ""} onChange={(e) => updateSettings({ profileAge: e.target.value })} />
          </label>
        </div>

        <h3>Reminders & predictions</h3>

        <label className="setting-row">
          <span>Dark mode</span>
          <input type="checkbox" checked={settings.darkMode} onChange={(e) => updateSettings({ darkMode: e.target.checked })} />
        </label>

        <label className="setting-row">
          <span>Reminder enabled</span>
          <input type="checkbox" checked={settings.remindersEnabled} onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })} />
        </label>

        <div className="three-fields">
          <NumberField label="Days before" value={settings.reminderDaysBefore} onChange={(value) => updateSettings({ reminderDaysBefore: value })} min="0" max="14" />
          <NumberField label="Cycle override" value={settings.cycleLengthOverride} onChange={(value) => updateSettings({ cycleLengthOverride: value })} placeholder="Auto" min="15" max="60" />
          <NumberField label="Period override" value={settings.periodLengthOverride} onChange={(value) => updateSettings({ periodLengthOverride: value })} placeholder="Auto" min="1" max="15" />
        </div>
      </Card>

      <Card className="pad">
        <h2><KeyRound size={20} /> Privacy & PIN</h2>

        <label className="setting-row">
          <span>Enable PIN lock</span>
          <input type="checkbox" checked={settings.pinEnabled} onChange={(e) => updateSettings({ pinEnabled: e.target.checked })} />
        </label>

        <label className="form single">
          <span>PIN</span>
          <input type="password" value={settings.pin} onChange={(e) => updateSettings({ pin: e.target.value })} placeholder="Create a simple PIN" />
        </label>

        <div className="two-actions">
          <Button onClick={() => (settings.pinEnabled && settings.pin ? setLocked(true) : showMessage("Turn on PIN and enter a PIN first."))} variant="secondary">Lock now</Button>
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
  return (
    <label className="form single">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function PrivacyPage({ settings, setLocked, clearData, exportJson, exportCsv }) {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Lock size={20} /> Privacy</h2>

        <div className="info-box rose-box">
          <h3>What 4Sara stores right now</h3>
          <p>This prototype stores period entries, check-ins, symptoms, moods, notes, settings, custom symptoms, name, age, and PIN settings in this browser only using local storage.</p>
        </div>

        <div className="info-box purple-box">
          <h3>What 4Sara does not do yet</h3>
          <p>This version does not have online accounts, cloud syncing, a shared database, app-store push notifications, or server-side storage.</p>
        </div>

        <div className="info-box">
          <h3>Privacy controls</h3>
          <div className="actions">
            <Button onClick={exportJson} variant="secondary"><Download size={16} /> Backup data</Button>
            <Button onClick={exportCsv} variant="secondary"><Download size={16} /> Spreadsheet export</Button>
            <Button onClick={clearData} variant="secondary"><Trash2 size={16} /> Clear data</Button>
          </div>
        </div>

        <div className="info-box amber-box">
          <h3>Before making this public</h3>
          <p>A production version should add a real Privacy Policy, Terms of Use, secure account login, encrypted database storage, account deletion, and legal review because period data is sensitive health-related information.</p>
        </div>
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

function MobileSetupPage() {
  return (
    <main className="layout">
      <Card className="pad main-col">
        <h2><Home size={20} /> Add 4Sara to your phone</h2>
        <p className="muted">4Sara is a website right now, but you can save it to your phone home screen so it opens like an app.</p>

        <div className="two-panels">
          <div className="info-box rose-box">
            <h3>iPhone / Safari</h3>
            <ol>
              <li>Open the 4Sara website in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Tap Add to Home Screen.</li>
              <li>Tap Add.</li>
            </ol>
          </div>

          <div className="info-box purple-box">
            <h3>Android / Chrome</h3>
            <ol>
              <li>Open the 4Sara website in Chrome.</li>
              <li>Tap the three-dot menu.</li>
              <li>Tap Add to Home screen or Install app.</li>
              <li>Tap Add or Install.</li>
            </ol>
          </div>
        </div>

        <div className="info-box">
          <h3>What this does</h3>
          <p>This creates a 4Sara icon on the phone home screen. The app still uses browser storage, so data stays on that device unless exported.</p>
        </div>
      </Card>

      <Card className="pad side-col">
        <h3>Future mobile upgrade</h3>
        <p className="muted">The next step would be adding a real app icon, web manifest, and offline support so 4Sara behaves even more like an installed mobile app.</p>
      </Card>
    </main>
  );
}

function PrivacyCard({ settings, setLocked }) {
  return (
    <Card className="pad">
      <h2><Lock size={20} /> Privacy</h2>
      <p className="muted">This prototype stores data only in this browser. For a public app, use encrypted storage, secure accounts, clear delete/export tools, and strict privacy terms.</p>
      {settings.pinEnabled && settings.pin && <Button onClick={() => setLocked(true)} variant="secondary" className="full">Lock now</Button>}
    </Card>
  );
}

createRoot(document.getElementById("root")).render(<App />);
