/**
 * Idempotent: safe to run more than once. Creates the one admin account (only if the users
 * table is empty) and ~20 real entries across the four domains from the plan, so day one of
 * using the app starts from a populated vault instead of a blank slate.
 */
import argon2 from "argon2";
import { eq, sql } from "drizzle-orm";
import { db, client } from "./client.js";
import { categories, entries, entryTags, entryVersions, tags, users } from "./schema.js";

async function ensureAdmin(): Promise<string> {
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.log(`→ Cont existent: ${existing[0].email}`);
    return existing[0].id;
  }

  const email = process.env.ADMIN_EMAIL ?? "admin@commandvault.local";
  const password = process.env.ADMIN_PASSWORD ?? crypto.randomUUID().slice(0, 12);
  const passwordHash = await argon2.hash(password);

  const [user] = await db.insert(users).values({ email, passwordHash, displayName: "Admin" }).returning();

  console.log("\n  ┌─────────────────────────────────────────────┐");
  console.log("  │  Cont admin creat                            │");
  console.log(`  │  email:    ${email.padEnd(34)}│`);
  console.log(`  │  parolă:   ${password.padEnd(34)}│`);
  console.log("  │  (schimb-o din aplicație după primul login)  │");
  console.log("  └─────────────────────────────────────────────┘\n");

  return user.id;
}

async function ensureCategories() {
  const count = await db.select({ n: sql<number>`count(*)` }).from(categories);
  if (Number(count[0].n) > 0) {
    console.log("→ Categorii deja existente, sar peste.");
    return Object.fromEntries((await db.select().from(categories)).map((c) => [c.slug, c.id]));
  }

  const roots = [
    { name: "Windows", slug: "windows", icon: "monitor" },
    { name: "Active Directory / M365", slug: "ad-m365", icon: "users" },
    { name: "Linux", slug: "linux", icon: "terminal" },
    { name: "Rețea & Virtualizare", slug: "network-virt", icon: "network" },
  ];
  const rootRows = await db.insert(categories).values(roots.map((r, i) => ({ ...r, sortOrder: i }))).returning();
  const rootId = Object.fromEntries(rootRows.map((r) => [r.slug, r.id]));

  const children = [
    { name: "PowerShell", slug: "windows-powershell", parentId: rootId["windows"], sortOrder: 0 },
    { name: "Sistem Windows", slug: "windows-sistem", parentId: rootId["windows"], sortOrder: 1 },
    { name: "Utilizatori & Grupuri", slug: "ad-utilizatori", parentId: rootId["ad-m365"], sortOrder: 0 },
    { name: "Exchange / M365", slug: "ad-exchange", parentId: rootId["ad-m365"], sortOrder: 1 },
    { name: "Bash & Sistem", slug: "linux-bash", parentId: rootId["linux"], sortOrder: 0 },
    { name: "SSH & Rețea", slug: "linux-ssh", parentId: rootId["linux"], sortOrder: 1 },
    { name: "Cisco / MikroTik", slug: "net-devices", parentId: rootId["network-virt"], sortOrder: 0 },
    { name: "VMware / Hyper-V", slug: "net-virt", parentId: rootId["network-virt"], sortOrder: 1 },
  ];
  const childRows = await db.insert(categories).values(children).returning();

  return Object.fromEntries([...rootRows, ...childRows].map((c) => [c.slug, c.id]));
}

async function ensureTags() {
  const count = await db.select({ n: sql<number>`count(*)` }).from(tags);
  if (Number(count[0].n) > 0) {
    console.log("→ Taguri deja existente, sar peste.");
    return Object.fromEntries((await db.select().from(tags)).map((t) => [t.slug, t.id]));
  }
  const names = [
    "troubleshooting", "audit", "curatenie", "licentiere", "onboarding",
    "offboarding", "urgent", "backup", "performanta", "securitate", "retea", "printare",
  ];
  const rows = await db.insert(tags).values(names.map((n) => ({ name: n, slug: n }))).returning();
  return Object.fromEntries(rows.map((t) => [t.slug, t.id]));
}

interface SeedEntry {
  kind: "command" | "script";
  title: string;
  body: string;
  language: string;
  platform: string[];
  description: string;
  rollback?: string;
  risk: "safe" | "caution" | "destructive";
  requiresAdmin: boolean;
  params?: { name: string; label: string; example?: string; required: boolean }[];
  category: string;
  tags: string[];
}

async function ensureEntries(ownerId: string, cat: Record<string, string>, tag: Record<string, string>) {
  const count = await db.select({ n: sql<number>`count(*)` }).from(entries);
  if (Number(count[0].n) > 0) {
    console.log("→ Intrări deja existente, sar peste.");
    return;
  }

  const seedData: SeedEntry[] = [
    {
      kind: "command", title: "Golește cache-ul DNS local",
      body: "ipconfig /flushdns",
      language: "cmd", platform: ["windows"],
      description: "Șterge intrările DNS din cache-ul local Windows. Prima comandă de încercat când un site sau un server intern rezolvă greșit după o schimbare de IP.",
      risk: "safe", requiresAdmin: false, category: "windows-sistem", tags: ["troubleshooting", "retea"],
    },
    {
      kind: "command", title: "Reset stack TCP/IP (Winsock)",
      body: "netsh winsock reset\nnetsh int ip reset",
      language: "cmd", platform: ["windows"],
      description: "Resetează complet stiva de rețea Windows. Rezolvă probleme de conectivitate pe care flushdns nu le repară — pierderi de internet, adaptoare \"blocate\".",
      rollback: "Necesită restart. Dacă apar probleme după reset, verifică setările proxy/VPN care s-ar putea să se fi resetat la implicit.",
      risk: "caution", requiresAdmin: true, category: "windows-sistem", tags: ["troubleshooting", "retea"],
    },
    {
      kind: "command", title: "Conturi AD dezactivate cu licență M365 activă",
      body: "Get-ADUser -Filter 'Enabled -eq $false' -Properties LastLogonDate |\n  Where-Object { $_.LastLogonDate -lt (Get-Date).AddDays(-90) } |\n  Select-Object Name, SamAccountName, LastLogonDate |\n  Export-Csv \"{{cale_export}}\" -NoTypeInformation -Encoding UTF8",
      language: "powershell", platform: ["windows", "active-directory", "m365"],
      description: "Găsește conturi dezactivate de peste 90 de zile care încă ar putea consuma o licență M365. Rulează lunar pentru audit de licențiere.",
      risk: "safe", requiresAdmin: true, category: "ad-utilizatori",
      params: [{ name: "cale_export", label: "Cale fișier export CSV", example: "C:\\Rapoarte\\audit.csv", required: true }],
      tags: ["audit", "licentiere", "curatenie"],
    },
    {
      kind: "command", title: "Resetare parolă utilizator AD",
      body: "Set-ADAccountPassword -Identity \"{{samaccountname}}\" -Reset -NewPassword (ConvertTo-SecureString \"{{parola_noua}}\" -AsPlainText -Force)\nSet-ADUser -Identity \"{{samaccountname}}\" -ChangePasswordAtLogon $true",
      language: "powershell", platform: ["windows", "active-directory"],
      description: "Resetează parola unui cont AD și obligă schimbarea ei la următoarea autentificare. Folosește parametrul {{parola_noua}} — nu scrie niciodată parola direct în comandă.",
      risk: "caution", requiresAdmin: true, category: "ad-utilizatori",
      params: [
        { name: "samaccountname", label: "SamAccountName utilizator", example: "ion.popescu", required: true },
        { name: "parola_noua", label: "Parolă temporară nouă", example: "(generată la nevoie)", required: true },
      ],
      tags: ["onboarding", "urgent"],
    },
    {
      kind: "command", title: "Dezactivează cont la offboarding",
      body: "Disable-ADAccount -Identity \"{{samaccountname}}\"\nSet-ADUser -Identity \"{{samaccountname}}\" -Description \"Dezactivat {{data}} - offboarding\"\nGet-ADPrincipalGroupMembership \"{{samaccountname}}\" | Where-Object { $_.Name -ne \"Domain Users\" } | ForEach-Object { Remove-ADGroupMember -Identity $_ -Members \"{{samaccountname}}\" -Confirm:$false }",
      language: "powershell", platform: ["windows", "active-directory"],
      description: "Procedura standard de offboarding: dezactivează contul, marchează motivul și scoate userul din toate grupurile de securitate (păstrează Domain Users).",
      rollback: "Enable-ADAccount -Identity <user> readaugă accesul; grupurile trebuie readăugate manual dintr-un export făcut înainte.",
      risk: "destructive", requiresAdmin: true, category: "ad-utilizatori",
      params: [
        { name: "samaccountname", label: "SamAccountName utilizator", required: true },
        { name: "data", label: "Data offboarding", example: "2026-09-09", required: true },
      ],
      tags: ["offboarding", "securitate"],
    },
    {
      kind: "command", title: "Verifică starea replicării Active Directory",
      body: "repadmin /replsummary\nGet-ADReplicationFailure -Target (Get-ADDomainController -Filter *).Name",
      language: "powershell", platform: ["windows", "active-directory"],
      description: "Primul pas când suspectezi că domain controllerele nu se sincronizează — grupuri sau parole care par „vechi\" pe unele stații.",
      risk: "safe", requiresAdmin: true, category: "ad-utilizatori", tags: ["troubleshooting", "audit"],
    },
    {
      kind: "script", title: "Curăță profiluri Windows vechi",
      body: "Get-CimInstance -ClassName Win32_UserProfile |\n  Where-Object { -not $_.Special -and $_.LastUseTime -lt (Get-Date).AddDays(-{{zile}}) } |\n  ForEach-Object {\n    Write-Host \"Șterg profilul: $($_.LocalPath)\"\n    Remove-CimInstance -InputObject $_\n  }",
      language: "powershell", platform: ["windows"],
      description: "Eliberează spațiu pe stații eliminând profilurile de utilizator neatinse de peste N zile. Util înainte de un upgrade de Windows sau când discul e aproape plin.",
      rollback: "Profilurile șterse nu pot fi recuperate din script — verifică backup-ul de date al utilizatorului înainte de a rula pe o stație de producție.",
      risk: "destructive", requiresAdmin: true, category: "windows-sistem",
      params: [{ name: "zile", label: "Prag de inactivitate (zile)", example: "180", required: true }],
      tags: ["curatenie", "performanta"],
    },
    {
      kind: "command", title: "Restart spooler de printare",
      body: "net stop spooler\ndel /Q /F \"%systemroot%\\System32\\spool\\PRINTERS\\*.*\"\nnet start spooler",
      language: "cmd", platform: ["windows"],
      description: "Repară cozi de printare blocate: oprește serviciul, golește coada, repornește. Cel mai frecvent tichet de suport de birou.",
      risk: "caution", requiresAdmin: true, category: "windows-sistem", tags: ["troubleshooting", "printare", "urgent"],
    },
    {
      kind: "command", title: "Găsește procesele care consumă cel mai mult CPU",
      body: "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, Id, CPU, WorkingSet",
      language: "powershell", platform: ["windows"],
      description: "Top 10 procese după consum CPU cumulat. Punct de plecare rapid pentru o stație care „a înghețat\".",
      risk: "safe", requiresAdmin: false, category: "windows-powershell", tags: ["troubleshooting", "performanta"],
    },
    {
      kind: "command", title: "Verifică spațiul liber pe toate discurile",
      body: "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}}, @{N='UsedGB';E={[math]::Round($_.Used/1GB,1)}}",
      language: "powershell", platform: ["windows"],
      description: "Rezumat rapid de spațiu liber/folosit pe fiecare unitate montată local.",
      risk: "safe", requiresAdmin: false, category: "windows-powershell", tags: ["troubleshooting", "audit"],
    },
    {
      kind: "command", title: "Verifică integritatea fișierelor de sistem",
      body: "sfc /scannow\nDISM /Online /Cleanup-Image /RestoreHealth",
      language: "cmd", platform: ["windows"],
      description: "Combo standard pentru fișiere de sistem corupte: sfc repară din cache local, DISM repară imaginea din Windows Update dacă sfc nu poate.",
      risk: "caution", requiresAdmin: true, category: "windows-sistem", tags: ["troubleshooting"],
    },
    {
      kind: "command", title: "Utilizatori cu shell activ și ultima logare",
      body: "lastlog -b {{zile}}",
      language: "bash", platform: ["linux"],
      description: "Listează conturile de pe un server Linux care s-au logat în ultimele N zile — util la audit de acces înainte de o revizie de securitate.",
      risk: "safe", requiresAdmin: true, category: "linux-bash",
      params: [{ name: "zile", label: "Interval (zile)", example: "30", required: true }],
      tags: ["audit", "securitate"],
    },
    {
      kind: "command", title: "Cele mai mari 20 de fișiere/foldere dintr-o cale",
      body: "du -ah {{cale}} | sort -rh | head -n 20",
      language: "bash", platform: ["linux"],
      description: "Rapid de identificat ce ocupă spațiu pe un server care e aproape de a rămâne fără disc.",
      risk: "safe", requiresAdmin: false, category: "linux-bash",
      params: [{ name: "cale", label: "Director de scanat", example: "/var/log", required: true }],
      tags: ["troubleshooting", "performanta"],
    },
    {
      kind: "script", title: "Rotește și comprimă loguri vechi manual",
      body: "#!/bin/bash\nset -euo pipefail\nLOG_DIR=\"{{director_loguri}}\"\nDAYS=\"{{zile_pastrare}}\"\n\nfind \"$LOG_DIR\" -name '*.log' -mtime +\"$DAYS\" -exec gzip {} \\;\nfind \"$LOG_DIR\" -name '*.log.gz' -mtime +$((DAYS * 3)) -delete\n\necho \"Rotație terminată pentru $LOG_DIR\"",
      language: "bash", platform: ["linux"],
      description: "Comprimă logurile mai vechi de N zile și șterge arhivele mai vechi de 3N zile. Pentru servere fără logrotate configurat corect.",
      rollback: "Fișierele .gz șterse de pasul final nu pot fi recuperate — ajustează pragul de ștergere înainte de prima rulare pe un server nou.",
      risk: "destructive", requiresAdmin: true, category: "linux-bash",
      params: [
        { name: "director_loguri", label: "Director cu loguri", example: "/var/log/app", required: true },
        { name: "zile_pastrare", label: "Zile păstrare necomprimat", example: "7", required: true },
      ],
      tags: ["curatenie", "backup"],
    },
    {
      kind: "command", title: "Verifică porturile ascultate pe server",
      body: "ss -tulpn | grep LISTEN",
      language: "bash", platform: ["linux"],
      description: "Listează toate porturile TCP/UDP în ascultare și procesul asociat. Primul pas la un audit de securitate sau când un serviciu \"nu pornește\" pe portul așteptat.",
      risk: "safe", requiresAdmin: true, category: "linux-ssh", tags: ["troubleshooting", "securitate", "retea"],
    },
    {
      kind: "command", title: "Copiază o cheie SSH pe un server nou",
      body: "ssh-copy-id -i ~/.ssh/id_ed25519.pub {{utilizator}}@{{host}}",
      language: "bash", platform: ["linux"],
      description: "Instalează cheia publică locală în authorized_keys pe server, pentru autentificare fără parolă.",
      risk: "safe", requiresAdmin: false, category: "linux-ssh",
      params: [
        { name: "utilizator", label: "Utilizator SSH", example: "admin", required: true },
        { name: "host", label: "Host sau IP", example: "10.20.0.15", required: true },
      ],
      tags: ["onboarding", "securitate"],
    },
    {
      kind: "command", title: "Backup rapid al unei baze MySQL",
      body: "mysqldump -u {{utilizator}} -p {{baza}} | gzip > {{baza}}_$(date +%Y%m%d).sql.gz",
      language: "bash", platform: ["linux"],
      description: "Dump comprimat cu data în nume, gata de mutat pe stocare externă. Pentru un backup complet de instanță, folosește mysqldump --all-databases.",
      risk: "safe", requiresAdmin: false, category: "linux-bash",
      params: [
        { name: "utilizator", label: "Utilizator MySQL", example: "backup_user", required: true },
        { name: "baza", label: "Nume bază de date", example: "productie", required: true },
      ],
      tags: ["backup"],
    },
    {
      kind: "command", title: "Afișează configurația unei interfețe MikroTik",
      body: "/interface print detail\n/ip address print",
      language: "text", platform: ["mikrotik-ros", "network"],
      description: "Vizualizare rapidă a interfețelor și adreselor IP configurate pe un router MikroTik, pentru diagnostic inițial la conectare.",
      risk: "safe", requiresAdmin: false, category: "net-devices", tags: ["retea", "audit"],
    },
    {
      kind: "command", title: "Salvează configurația Cisco înainte de modificări",
      body: "copy running-config startup-config",
      language: "cisco", platform: ["cisco-ios", "network"],
      description: "Salvează configurația curentă ca fiind cea de la boot. Rulează întotdeauna înainte și după orice schimbare pe un switch/router Cisco de producție.",
      risk: "caution", requiresAdmin: true, category: "net-devices", tags: ["backup", "retea"],
    },
    {
      kind: "command", title: "Listează VM-urile oprite pe un host ESXi",
      body: "Get-VM | Where-Object { $_.PowerState -eq 'PoweredOff' } | Select-Object Name, PowerState, VMHost",
      language: "powershell", platform: ["esxi"],
      description: "Prin PowerCLI: identifică rapid mașinile virtuale oprite pe un host — utile de verificat înainte de un audit de licențiere sau capacitate.",
      risk: "safe", requiresAdmin: false, category: "net-virt", tags: ["audit"],
    },
    {
      kind: "command", title: "Export listă VM-uri Hyper-V cu resurse alocate",
      body: "Get-VM | Select-Object Name, State, ProcessorCount, @{N='MemoryGB';E={$_.MemoryStartup/1GB}} | Export-Csv \"{{cale_export}}\" -NoTypeInformation",
      language: "powershell", platform: ["hyper-v", "windows"],
      description: "Inventar rapid al VM-urilor de pe un host Hyper-V, cu CPU și RAM alocate — folosit pentru planificare de capacitate.",
      risk: "safe", requiresAdmin: true, category: "net-virt",
      params: [{ name: "cale_export", label: "Cale fișier CSV", example: "C:\\Rapoarte\\vms.csv", required: true }],
      tags: ["audit"],
    },
  ];

  for (const item of seedData) {
    const [inserted] = await db.insert(entries).values({
      ownerId,
      kind: item.kind,
      title: item.title,
      body: item.body,
      language: item.language,
      platform: item.platform,
      description: item.description,
      rollback: item.rollback ?? "",
      risk: item.risk,
      requiresAdmin: item.requiresAdmin,
      params: item.params ?? [],
      categoryId: cat[item.category] ?? null,
    }).returning();

    if (item.kind === "script") {
      await db.insert(entryVersions).values({ entryId: inserted.id, version: 1, body: item.body, note: "Versiune inițială" });
    }

    const tagIds = item.tags.map((t) => tag[t]).filter(Boolean);
    if (tagIds.length > 0) {
      await db.insert(entryTags).values(tagIds.map((tagId) => ({ entryId: inserted.id, tagId })));
    }
  }

  console.log(`→ ${seedData.length} intrări adăugate.`);
}

async function run() {
  const ownerId = await ensureAdmin();
  const cat = await ensureCategories();
  const tag = await ensureTags();
  await ensureEntries(ownerId, cat, tag);
  console.log("✓ Seed complet.");
  await client.end();
}

run().catch((err) => {
  console.error("✗ Seed-ul a eșuat:", err);
  process.exit(1);
});
