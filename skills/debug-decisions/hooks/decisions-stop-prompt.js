#!/usr/bin/env node
// Stop hook: inject a retrospective reminder to Claude at session end if signals
// suggest an architectural decision was made and none was registered.
//
// Never writes decision files. Never blocks session close. Idempotent per session.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULT_CONFIG = {
  stop_prompt: true,
  min_turns: 5,
  min_files_edited: 3,
  keywords: ['choose', 'decid', 'approach', 'alternativ', 'trade-off'],
};

function slugFromCwd(cwd) {
  return (cwd || '').replace(/\//g, '-');
}

function isTmpSlug(slug) {
  return /(-T$|-tmp-|-private-var-folders-)/.test(slug);
}

function loadConfig() {
  const p = path.join(os.homedir(), '.claude', 'skills', 'debug-decisions', '.config.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function shouldPrompt(ctx) {
  const cfg = ctx.config;
  if (!cfg.stop_prompt) return { prompt: false, reason: 'disabled by config' };
  if (!ctx.slug) return { prompt: false, reason: 'no slug' };
  if (isTmpSlug(ctx.slug)) return { prompt: false, reason: 'tmp cwd' };
  if (ctx.userTurns < cfg.min_turns) return { prompt: false, reason: 'session too short' };
  if (typeof ctx.lastUserMessage === 'string' && ctx.lastUserMessage.includes('/decision')) {
    return { prompt: false, reason: 'already registered' };
  }

  const signals = [];
  if (ctx.planModeUsed) signals.push('plan-mode');
  if ((ctx.filesEdited?.length || 0) >= cfg.min_files_edited) signals.push('files-edited');
  if (Array.isArray(ctx.skillsInvoked) &&
      ctx.skillsInvoked.some(s => /^(superpowers:(brainstorming|feature-dev|writing-plans)|feature-dev:.*)$/.test(s))) {
    signals.push('design-skill');
  }
  const messages = Array.isArray(ctx.allUserMessages) ? ctx.allUserMessages : [ctx.lastUserMessage || ''];
  const haystack = messages.join('\n').toLowerCase();
  if (cfg.keywords.some(k => haystack.includes(k.toLowerCase()))) signals.push('keyword');

  if (signals.length === 0) return { prompt: false, reason: 'no decision signals' };
  return { prompt: true, reason: signals.join(',') };
}

function buildReminder(ctx) {
  return `[debug-decisions] Session ended with ${ctx.userTurns} turns and architectural-decision signals.
If during this session you made choices between alternatives or approaches, register them now:
  /decision <short description>
Skip if not applicable. Do not reply to this reminder if you have no decisions to register.`;
}

function stateFilePath(sessionId) {
  return path.join(os.homedir(), '.claude', 'debug-decisions', '.state', `${sessionId}.json`);
}

function alreadyPrompted(sessionId) {
  if (!sessionId) return false;
  try {
    const data = JSON.parse(fs.readFileSync(stateFilePath(sessionId), 'utf8'));
    return data?.prompted === true;
  } catch {
    return false;
  }
}

function markPrompted(sessionId) {
  if (!sessionId) return;
  const dir = path.dirname(stateFilePath(sessionId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFilePath(sessionId), JSON.stringify({ prompted: true, ts: Date.now() }));
}

function cleanupOldState() {
  try {
    const dir = path.join(os.homedir(), '.claude', 'debug-decisions', '.state');
    if (!fs.existsSync(dir)) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(dir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {}
    }
  } catch {}
}

function parseTranscript(transcriptPath) {
  const result = {
    userTurns: 0,
    lastUserMessage: '',
    allUserMessages: [],
    filesEdited: new Set(),
    planModeUsed: false,
    skillsInvoked: [],
  };
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    result.filesEdited = Array.from(result.filesEdited);
    return result;
  }

  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    let evt;
    try { evt = JSON.parse(line); } catch { continue; }

    if (evt?.type === 'user' && typeof evt?.message?.content === 'string') {
      result.userTurns += 1;
      result.allUserMessages.push(evt.message.content);
      result.lastUserMessage = evt.message.content;
    } else if (evt?.type === 'user' && Array.isArray(evt?.message?.content)) {
      const text = evt.message.content
        .filter(b => b?.type === 'text' && typeof b.text === 'string')
        .map(b => b.text).join('\n');
      if (text) {
        result.userTurns += 1;
        result.allUserMessages.push(text);
        result.lastUserMessage = text;
      }
    }

    const toolUses = (evt?.message?.content || []).filter?.(b => b?.type === 'tool_use') || [];
    for (const tu of toolUses) {
      if (tu.name === 'Edit' || tu.name === 'Write') {
        const p = tu.input?.file_path;
        if (p) result.filesEdited.add(p);
      } else if (tu.name === 'EnterPlanMode') {
        result.planModeUsed = true;
      } else if (tu.name === 'Skill') {
        const s = tu.input?.skill;
        if (s) result.skillsInvoked.push(s);
      }
    }
  }
  result.filesEdited = Array.from(result.filesEdited);
  return result;
}

function logError(err) {
  try {
    const dir = path.join(os.homedir(), '.claude', 'debug-decisions', '.state');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'errors.log'),
      `${new Date().toISOString()} ${err?.stack || err}\n`
    );
  } catch {}
}

async function main() {
  let payload = '';
  for await (const chunk of process.stdin) payload += chunk;

  let input;
  try {
    input = payload ? JSON.parse(payload) : {};
  } catch {
    input = {};
  }

  const sessionId = input.session_id || '';
  const cwd = input.cwd || process.cwd();
  const transcriptPath = input.transcript_path || '';

  if (alreadyPrompted(sessionId)) {
    process.exit(0);
  }

  const config = loadConfig();
  const slug = slugFromCwd(cwd);
  const parsed = parseTranscript(transcriptPath);

  const decision = shouldPrompt({ ...parsed, slug, config });

  if (decision.prompt) {
    const reminder = buildReminder({ userTurns: parsed.userTurns });
    const out = {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: reminder,
      },
    };
    process.stdout.write(JSON.stringify(out));
    markPrompted(sessionId);
  }

  cleanupOldState();
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => { logError(err); process.exit(0); });
}

module.exports = { shouldPrompt, buildReminder, slugFromCwd, isTmpSlug };
