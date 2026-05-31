import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import {
  CalendarDays,
  HeartPulse,
  Lock,
  Plus,
  Droplet,
  Moon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Bell,
  Settings,
  Pencil,
  Save,
  X,
  ShieldCheck,
  KeyRound,
  EyeOff,
  Home,
  Sparkles,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "4sara_entries_v2";
const SETTINGS_KEY = "4sara_settings_v2";

const starterEntries = [
  {
    id: 1,
    startDate: "2026-04-28",
    endDate: "2026-05-02",
    flow: "Medium",
    mood: "Calm",
    symptoms: ["Cramps", "Fatigue"],
    notes: "Mild cramps on day one.",
  },
  {
    id: 2,
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
};

const symptomOptions = ["Cramps", "Headache", "Bloating", "Fatigue", "Acne", "Back pain", "Cravings", "Mood swings", "Nausea", "Tender breasts"];
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
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
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

function downloadBlob(filename, content, type) {
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
  downloadBlob("4sara-data.json", JSON.stringify(exportPayload, null, 2), "application/json");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(entries) {
  const headers = ["Start Date", "End Date", "Flow", "Mood", "Symptoms", "Notes"];
  const rows = entries.map((entry) => [
    entry.startDate,
    entry.endDate || "",
    entry.flow || "",
    entry.mood || "",
    (entry.symptoms || []).join("; "),
    entry.notes || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadBlob("4sara-cycle-history.csv", csv, "text/csv;charset=utf-8");
}

function safeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printReport(entries, stats) {
  const rows = entries
    .map((entry) => `
      <tr>
        <td>${safeHtml(entry.startDate)}</td>
        <td>${safeHtml(entry.endDate)}</td>
        <td>${safeHtml(entry.flow)}</td>
        <td>${safeHtml(entry.mood)}</td>
        <td>${safeHtml((entry.symptoms || []).join("; "))}</td>
        <td>${safeHtml(entry.notes)}</td>
      </tr>
    `)
    .join("");

  const symptoms = stats.mostCommonSymptoms.length
    ? stats.mostCommonSymptoms.map(([symptom, count]) => `${safeHtml(symptom)} (${count})`).join(", ")
    : "No symptoms logged yet";

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>4Sara Cycle Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; padding: 32px; }
          h1 { color: #be123c; margin-bottom: 4px; }
          h2 { margin-top: 28px; color: #374151; }
          .meta { color: #6b7280; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
          .card { border: 1px solid #fecdd3; border-radius: 14px; padding: 14px; background: #fff1f2; }
          .label { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
          .value { font-weight: 700; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: top; text-align: left; }
          th { background: #fff1f2; }
          .note { margin-top: 24px; color: #6b7280; font-size: 12px; line-height: 1.5; }
          @media print { button { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:white;margin-bottom:20px;cursor:pointer;">Print / Save as PDF</button>
        <h1>4Sara Cycle Report</h1>
        <div class="meta">Generated ${new Date().toLocaleString()}</div>
        <div class="grid">
          <div class="card"><div class="label">Average cycle length</div><div class="value">${stats.averageCycle} days</div></div>
          <div class="card"><div class="label">Average period length</div><div class="value">${stats.averagePeriod} days</div></div>
          <div class="card"><div class="label">Next predicted period</div><div class="value">${stats.nextPeriod ? formatDate(stats.nextPeriod) : "Not enough data"}</div></div>
          <div class="card"><div class="label">Fertile window estimate</div><div class="value">${stats.fertileStart ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "Not enough data"}</div></div>
          <div class="card"><div class="label">Estimated ovulation</div><div class="value">${stats.ovulationDay ? formatDate(stats.ovulationDay) : "Not enough data"}</div></div>
          <div class="card"><div class="label">Common symptoms</div><div class="value">${symptoms}</div></div>
        </div>
        <h2>Cycle History</h2>
        <table>
          <thead><tr><th>Start</th><th>End</th><th>Flow</th><th>Mood</th><th>Symptoms</th><th>Notes</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">No entries logged.</td></tr>`}</tbody>
        </table>
        <p class="note">This report is for personal tracking only. Predictions are estimates and are not medical advice.</p>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
}

function blankForm() {
  return {
    startDate: todayKey(),
    endDate: "",
    flow: "Medium",
    mood: "Calm",
    symptoms: [],
    notes: "",
  };
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (saved.pinEnabled && saved.pin) setLocked(true);
    } catch {
      setLocked(false);
    }
  }, []);

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)), [entries]);

  const stats = useMemo(() => {
    const chronological = [...entries].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
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
    const mostCommonSymptoms = Object.entries(
      entries.flatMap((entry) => entry.symptoms || []).reduce((acc, symptom) => {
        acc[symptom] = (acc[symptom] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return { last, averageCycle, averagePeriod, nextPeriod, predictedEnd, ovulationDay, fertileStart, fertileEnd, reminderDate, daysUntil, mostCommonSymptoms, totalEntries: entries.length };
  }, [entries, settings.cycleLengthOverride, settings.periodLengthOverride, settings.reminderDaysBefore]);

  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    const periodDays = new Map();
    entries.forEach((entry) => getDaysInRange(entry.startDate, entry.endDate).forEach((day) => periodDays.set(day, entry)));
    const predictedDays = new Set(getDaysInRange(stats.nextPeriod, stats.predictedEnd));
    const fertileDays = new Set(getDaysInRange(stats.fertileStart, stats.fertileEnd));

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startOffset + 1;
      if (dayNumber < 1 || dayNumber > lastDay.getDate()) return { empty: true, key: `empty-${index}` };
      const date = new Date(year, month, dayNumber);
      const key = toDateKey(date);
      return { empty: false, key, dayNumber, dateKey: key, isToday: key === todayKey(), entry: periodDays.get(key), isPredicted: predictedDays.has(key), isFertile: fertileDays.has(key), isOvulation: key === stats.ovulationDay };
    });
  }, [calendarDate, entries, stats.nextPeriod, stats.predictedEnd, stats.fertileStart, stats.fertileEnd, stats.ovulationDay]);

  const showMessage = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  };

  const toggleSymptom = (symptom) => {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom) ? current.symptoms.filter((item) => item !== symptom) : [...current.symptoms, symptom],
    }));
  };

  const validateForm = () => {
    if (!form.startDate) return "Start date is required.";
    if (form.endDate && daysBetween(form.startDate, form.endDate) < 0) return "End date cannot be before start date.";
    return "";
  };

  const saveEntry = () => {
    const error = validateForm();
    if (error) return showMessage(error);
    if (editingId) {
      setEntries((current) => current.map((entry) => (entry.id === editingId ? { ...entry, ...form } : entry)));
      showMessage("Entry updated.");
    } else {
      setEntries((current) => [...current, { id: Date.now(), ...form }]);
      showMessage("Entry saved.");
    }
    setCalendarDate(new Date(form.startDate + "T00:00:00"));
    setForm(blankForm());
    setEditingId(null);
  };

  const startEdit = (entry) => {
    setForm({ startDate: entry.startDate, endDate: entry.endDate || "", flow: entry.flow || "Medium", mood: entry.mood || "Calm", symptoms: entry.symptoms || [], notes: entry.notes || "" });
    setEditingId(entry.id);
    setActiveTab("log");
    showMessage("Editing entry.");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blankForm());
  };

  const deleteEntry = (id) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    showMessage("Entry deleted.");
  };

  const moveMonth = (direction) => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));

  const clearData = () => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
    showMessage("Local cycle data cleared.");
  };

  const resetDemo = () => {
    setEntries(starterEntries);
    showMessage("Demo data restored.");
  };

  const logToday = () => {
    setForm({ ...blankForm(), startDate: todayKey() });
    setEditingId(null);
    setActiveTab("log");
    showMessage("Ready to log today.");
  };

  const logCalendarDate = (dateKey) => {
    setSelectedCalendarDay(dateKey);
    setForm({ ...blankForm(), startDate: dateKey });
    setEditingId(null);
    setActiveTab("log");
    showMessage(`Ready to log ${formatDate(dateKey)}.`);
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
      const cleaned = importedEntries.filter((entry) => entry.startDate).map((entry, index) => ({ id: entry.id || Date.now() + index, startDate: entry.startDate, endDate: entry.endDate || "", flow: entry.flow || "Medium", mood: entry.mood || "Calm", symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [], notes: entry.notes || "" }));
      setEntries(cleaned);
      setImportText("");
      showMessage("Imported cycle data successfully.");
    } catch {
      showMessage("Import failed. Paste valid 4Sara JSON export data.");
    }
  };

  const exportCsv = () => {
    downloadCsv(sortedEntries);
    showMessage("CSV export downloaded.");
  };

  const openPrintReport = () => {
    const opened = printReport(sortedEntries, stats);
    showMessage(opened ? "Report opened. Use Print or Save as PDF." : "Pop-up blocked. Allow pop-ups to print the report.");
  };

  const tryUnlock = () => {
    if (pinAttempt === settings.pin) {
      setLocked(false);
      setPinAttempt("");
    } else {
      showMessage("Incorrect PIN.");
    }
  };

  const updateSettings = (patch) => setSettings((current) => ({ ...current, ...patch }));

  const navItems = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "log", label: "Log", icon: Plus },
    { id: "insights", label: "Insights", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (locked && settings.pinEnabled && settings.pin) {
    return (
      <div className="lock-page">
        <Card className="lock-card">
          <div className="lock-icon"><EyeOff size={28} /></div>
          <h1>4Sara is locked</h1>
          <p>Enter your PIN to open your tracker on this device.</p>
          <input type="password" value={pinAttempt} onChange={(event) => setPinAttempt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && tryUnlock()} placeholder="Enter PIN" className="text-input center" />
          <Button onClick={tryUnlock} className="full">Unlock</Button>
          {message && <p className="message center-text">{message}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="container">
        <header className="header">
          <div>
            <div className="badge"><ShieldCheck size={16} /> Private browser-based prototype</div>
            <h1>4Sara</h1>
            <p>Track periods, symptoms, moods, reminders, fertility estimates, and cycle history.</p>
          </div>
          <div className="header-actions">
            <Button onClick={() => downloadJson(entries, settings)} variant="outline"><Download size={20} /> JSON</Button>
            <Button onClick={exportCsv} variant="outline"><Download size={20} /> CSV</Button>
            <Button onClick={openPrintReport} variant="outline"><Download size={20} /> PDF/Print</Button>
            <Button onClick={logToday}><Plus size={20} /> Log Today</Button>
          </div>
        </header>

        {message && <div className="toast">{message}</div>}

        <nav className="nav-tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={activeTab === item.id ? "active" : ""}>
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "dashboard" && (
          <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="layout-3">
            <section className="span-2">
              <Card className="hero-card">
                <div className="hero">
                  <CalendarDays size={34} />
                  <div>
                    <p>Next predicted period</p>
                    <h2>{stats.nextPeriod ? formatDate(stats.nextPeriod) : "Add a cycle"}</h2>
                  </div>
                  {stats.nextPeriod && <strong>{stats.daysUntil > 0 ? `${stats.daysUntil} days away` : stats.daysUntil === 0 ? "Expected today" : `${Math.abs(stats.daysUntil)} days past prediction`}</strong>}
                </div>
                <div className="stats-grid">
                  <StatCard icon={Droplet} label="Avg. cycle" value={`${stats.averageCycle} days`} />
                  <StatCard icon={Moon} label="Avg. period" value={`${stats.averagePeriod} days`} />
                  <StatCard icon={HeartPulse} label="Last period" value={stats.last ? formatDate(stats.last.startDate) : "None yet"} />
                </div>
              </Card>

              <Card>
                <div className="section-header">
                  <h2>Upcoming</h2>
                  <div className="button-row"><Button onClick={jumpToNextPeriod} variant="outline">Show next period</Button><Button onClick={testReminder} variant="outline">Test reminder</Button></div>
                </div>
                <div className="info-grid">
                  <InfoTile title="Predicted period" value={stats.nextPeriod ? `${formatDate(stats.nextPeriod)} - ${formatDate(stats.predictedEnd)}` : "Not enough data"} />
                  <InfoTile title="Fertile window" value={stats.fertileStart ? `${formatDate(stats.fertileStart)} - ${formatDate(stats.fertileEnd)}` : "Not enough data"} />
                  <InfoTile title="Reminder" value={settings.remindersEnabled && stats.reminderDate ? formatDate(stats.reminderDate) : "Off"} />
                </div>
              </Card>
            </section>
            <aside className="side-stack">
              <Card><h2>Recent entries</h2><EntryList entries={sortedEntries.slice(0, 3)} onEdit={startEdit} onDelete={deleteEntry} compact /></Card>
              <PrivacyCard settings={settings} setLocked={setLocked} />
            </aside>
          </motion.main>
        )}

        {activeTab === "calendar" && <CalendarPanel calendarDate={calendarDate} calendarData={calendarData} moveMonth={moveMonth} onDayClick={logCalendarDate} selectedCalendarDay={selectedCalendarDay} />}

        {activeTab === "log" && (
          <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="layout-3">
            <section><LogForm form={form} setForm={setForm} toggleSymptom={toggleSymptom} saveEntry={saveEntry} editingId={editingId} cancelEdit={cancelEdit} /></section>
            <section className="span-2"><Card><h2>All cycle entries</h2><EntryList entries={sortedEntries} onEdit={startEdit} onDelete={deleteEntry} /></Card></section>
          </motion.main>
        )}

        {activeTab === "insights" && (
          <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="layout-3">
            <Card className="span-2">
              <h2><Sparkles size={21} /> Insights</h2>
              <div className="info-grid two">
                <InfoTile title="Total logged cycles" value={`${stats.totalEntries}`} />
                <InfoTile title="Average cycle length" value={`${stats.averageCycle} days`} />
                <InfoTile title="Average period length" value={`${stats.averagePeriod} days`} />
                <InfoTile title="Estimated ovulation" value={stats.ovulationDay ? formatDate(stats.ovulationDay) : "Not enough data"} />
              </div>
              <div className="soft-box">
                <h3>Most common symptoms</h3>
                {stats.mostCommonSymptoms.length ? <div className="pill-row">{stats.mostCommonSymptoms.map(([symptom, count]) => <span key={symptom} className="pill">{symptom}: {count}</span>)}</div> : <p>Add symptoms to see patterns.</p>}
              </div>
              <p className="small-note">Predictions are estimates only and should not be used as medical advice or as a primary pregnancy prevention method.</p>
            </Card>
            <PrivacyCard settings={settings} setLocked={setLocked} />
          </motion.main>
        )}

        {activeTab === "settings" && (
          <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="layout-2">
            <Card>
              <h2><Bell size={21} /> Reminders & predictions</h2>
              <label className="toggle-row"><span>Reminder enabled</span><input type="checkbox" checked={settings.remindersEnabled} onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })} /></label>
              <div className="field-grid three">
                <NumberField label="Days before" value={settings.reminderDaysBefore} onChange={(value) => updateSettings({ reminderDaysBefore: value })} min="0" max="14" />
                <NumberField label="Cycle override" value={settings.cycleLengthOverride} onChange={(value) => updateSettings({ cycleLengthOverride: value })} placeholder="Auto" min="15" max="60" />
                <NumberField label="Period override" value={settings.periodLengthOverride} onChange={(value) => updateSettings({ periodLengthOverride: value })} placeholder="Auto" min="1" max="15" />
              </div>
            </Card>
            <Card>
              <h2><KeyRound size={21} /> Privacy & PIN</h2>
              <label className="toggle-row"><span>Enable PIN lock</span><input type="checkbox" checked={settings.pinEnabled} onChange={(e) => updateSettings({ pinEnabled: e.target.checked })} /></label>
              <TextField label="PIN" type="password" value={settings.pin} onChange={(value) => updateSettings({ pin: value })} placeholder="Create a simple PIN" />
              <div className="button-grid"><Button onClick={() => settings.pinEnabled && settings.pin ? setLocked(true) : showMessage("Turn on PIN and enter a PIN first.")} variant="outline">Lock now</Button><Button onClick={clearData} variant="outline">Clear data</Button><Button onClick={resetDemo} variant="outline" className="wide">Restore demo data</Button></div>
            </Card>
            <Card className="wide">
              <h2><Download size={21} /> Import / Export data</h2>
              <p>Paste a previous 4Sara JSON export here to restore entries in this browser, or use the buttons below to download CSV or open a printable PDF-style report.</p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste exported JSON here..." className="text-area" />
              <div className="button-row"><Button onClick={importJson}>Import JSON</Button><Button onClick={exportCsv} variant="outline">Download CSV</Button><Button onClick={openPrintReport} variant="outline">Print / Save PDF</Button></div>
            </Card>
          </motion.main>
        )}
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "solid", className = "", ...props }) {
  return <button onClick={onClick} className={`btn ${variant === "outline" ? "btn-outline" : "btn-solid"} ${className}`} {...props}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function StatCard({ icon: Icon, label, value }) {
  return <div className="stat-card"><Icon size={25} /><p>{label}</p><strong>{value}</strong></div>;
}

function InfoTile({ title, value }) {
  return <div className="info-tile"><p>{title}</p><strong>{value}</strong></div>;
}

function TextField({ label, type = "text", value, onChange, placeholder }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function NumberField({ label, value, onChange, placeholder, min, max }) {
  return <label className="field"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function CalendarPanel({ calendarDate, calendarData, moveMonth, onDayClick, selectedCalendarDay }) {
  return (
    <Card>
      <div className="section-header"><h2>Calendar</h2><div className="calendar-controls"><button onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button><strong>{monthName(calendarDate)}</strong><button onClick={() => moveMonth(1)}><ChevronRight size={18} /></button></div></div>
      <div className="weekday-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}</div>
      <div className="calendar-grid">
        {calendarData.map((day) => (
          <button key={day.key} disabled={day.empty} onClick={() => !day.empty && onDayClick(day.dateKey)} className={`calendar-day ${day.empty ? "empty" : ""} ${day.entry ? "period" : ""} ${day.isPredicted ? "predicted" : ""} ${day.isFertile ? "fertile" : ""} ${day.isToday ? "today" : ""} ${selectedCalendarDay === day.dateKey ? "selected" : ""}`}>
            {!day.empty && <><strong>{day.dayNumber}</strong>{day.entry && <small>Period</small>}{!day.entry && day.isPredicted && <small>Predicted</small>}{!day.entry && !day.isPredicted && day.isOvulation && <small>Ovulation</small>}{!day.entry && !day.isPredicted && !day.isOvulation && day.isFertile && <small>Fertile</small>}</>}
          </button>
        ))}
      </div>
      <p className="small-note">Tap any calendar date to start logging an entry for that day.</p>
      <div className="legend"><span><i className="legend-period" /> Logged period</span><span><i className="legend-predicted" /> Predicted period</span><span><i className="legend-fertile" /> Fertile estimate</span><span><i className="legend-today" /> Today</span></div>
    </Card>
  );
}

function LogForm({ form, setForm, toggleSymptom, saveEntry, editingId, cancelEdit }) {
  return (
    <Card>
      <h2>{editingId ? <Pencil size={21} /> : <Plus size={21} />} {editingId ? "Edit cycle entry" : "Add cycle entry"}</h2>
      <TextField label="Start date" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
      <TextField label="End date" type="date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} />
      <label className="field"><span>Flow level</span><select value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })}><option>Light</option><option>Medium</option><option>Heavy</option><option>Spotting</option></select></label>
      <ChoiceGroup title="Mood" options={moodOptions} selected={[form.mood]} onSelect={(mood) => setForm({ ...form, mood })} single />
      <ChoiceGroup title="Symptoms" options={symptomOptions} selected={form.symptoms} onSelect={toggleSymptom} />
      <label className="field"><span>Notes</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add anything you noticed..." /></label>
      <Button onClick={saveEntry} className="full"><Save size={18} /> {editingId ? "Update entry" : "Save entry"}</Button>
      {editingId && <Button onClick={cancelEdit} variant="outline" className="full"><X size={18} /> Cancel edit</Button>}
    </Card>
  );
}

function ChoiceGroup({ title, options, selected, onSelect }) {
  return <div className="choice-group"><span>{title}</span><div>{options.map((option) => <button key={option} onClick={() => onSelect(option)} className={selected.includes(option) ? "chosen" : ""}>{option}</button>)}</div></div>;
}

function EntryList({ entries, onEdit, onDelete, compact = false }) {
  if (!entries.length) return <p className="empty-state">No entries yet. Add a period start date to begin tracking.</p>;
  return (
    <div className="entry-list">
      {entries.map((entry) => (
        <div key={entry.id} className="entry-card">
          <div className="entry-top"><div><strong>{formatDate(entry.startDate)} {entry.endDate ? `- ${formatDate(entry.endDate)}` : ""}</strong><p>Flow: {entry.flow} • Mood: {entry.mood}</p></div><div><button onClick={() => onEdit(entry)}><Pencil size={16} /></button><button onClick={() => onDelete(entry.id)}><Trash2 size={16} /></button></div></div>
          {!compact && <div className="pill-row">{(entry.symptoms || []).map((symptom) => <span className="pill" key={symptom}>{symptom}</span>)}</div>}
          {!compact && entry.notes && <p className="entry-note">{entry.notes}</p>}
        </div>
      ))}
    </div>
  );
}

function PrivacyCard({ settings, setLocked }) {
  return <Card><h2><Lock size={21} /> Privacy</h2><p>This version stores data only in this browser. For a public app, add secure accounts, encrypted storage, clear delete/export tools, and a strong privacy policy.</p>{settings.pinEnabled && settings.pin && <Button onClick={() => setLocked(true)} variant="outline" className="full">Lock now</Button>}</Card>;
}

createRoot(document.getElementById("root")).render(<App />);
