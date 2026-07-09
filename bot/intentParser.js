// intentParser.js — the Claude agent loop. Turns a resident's free-text
// WhatsApp message into tool calls against scheduleActions.js, then into a
// short reply. Read-only for now (Task 4); the chief write tools
// (assign/unassign/swap, gated on role:"chief") slot in at Task 5.
//
// Model: claude-haiku-4-5 -- this is fast, cheap Q&A over structured data,
// exactly Haiku's sweet spot, and the per the approved plan's model choice.
// The system prompt + tool definitions are marked cache_control so the stable
// prefix is reused across messages; the volatile bits (today's date, sender
// identity) go last, after the cached prefix.

const Anthropic = require('@anthropic-ai/sdk');
const sa = require('./scheduleActions');

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
const MAX_TURNS = 6; // safety bound on the tool-use loop

const READ_TOOLS = [
  {
    name: 'who_is_on_call',
    description:
      'List everyone on call for one specific day, by slot (SO/NICU/PICU/PMW night call, DC_PMW/DC_NICU day call). Use for questions like "who is on call today?" or "who has NICU on Jul 17?".',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description:
            'The day to look up. Accepts "today", "tomorrow", or an exact schedule date like "Jul 17" (short month, no leading zero, no year).',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_resident_calls',
    description:
      "List all of one resident's call assignments across the whole block, in date order. Use for \"what are my calls?\" or \"when is Dina on call?\".",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Resident short name, e.g. "H.Saif" or "Dina".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_next_call',
    description:
      "Get one resident's next upcoming call (on or after today). Use for \"when is my next call?\".",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Resident short name, e.g. "H.Saif".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'find_resident',
    description:
      'Look up residents by a partial name, full name, or level (e.g. "R2"). Use to resolve who the user means before calling the other tools, or to answer "who is Dr. X?". Returns every match so you can disambiguate if there is more than one.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A name fragment, full name, or level like "R3".' },
      },
      required: ['query'],
    },
  },
];

// Chief-only tools. Gated server-side (only added to the tool list when
// sender.role === "chief") -- not merely by prompt -- so a non-chief can never
// invoke them even if the model is talked into trying.
const WRITE_TOOLS = [
  {
    name: 'propose_edit',
    description:
      'Stage a schedule change for the chief to confirm. Does NOT apply it yet. Express the change as an ordered list of ops; a swap is two removes + two adds. After calling this, tell the chief exactly what will change plus any warnings, and ask them to confirm. Only after they say yes do you call confirm_edit.',
    input_schema: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: 'Ordered operations applied atomically.',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['add', 'remove'], description: 'Add or remove a resident from a slot.' },
              name: { type: 'string', description: 'Resident short name, e.g. "H.Saif".' },
              date: { type: 'string', description: 'Exact schedule date like "Jul 17", or "today"/"tomorrow".' },
              slot: { type: 'string', enum: ['SO', 'NICU', 'PICU', 'PMW', 'DC_PMW', 'DC_NICU'] },
            },
            required: ['op', 'name', 'date', 'slot'],
          },
        },
        summary: { type: 'string', description: 'One-line human summary of the change, e.g. "Move Dina from NICU Jul 20 to PICU Jul 20".' },
      },
      required: ['ops', 'summary'],
    },
  },
  {
    name: 'confirm_edit',
    description:
      'Commit the currently pending edit to the live schedule. Only call this after the chief has explicitly confirmed the exact change you described. Warnings do not block the commit — the chief may proceed through them.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'discard_edit',
    description: 'Discard the currently pending edit without applying it (the chief declined or wants to change it).',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

function resolveDate(input) {
  const v = (input || '').trim().toLowerCase();
  if (v === 'today') return sa.todayScheduleDate();
  if (v === 'tomorrow') return sa.tomorrowScheduleDate();
  return input;
}

async function runTool(db, name, input, sender) {
  switch (name) {
    case 'who_is_on_call':
      return sa.whoIsOnCall(db, resolveDate(input.date));
    case 'get_resident_calls':
      return sa.getResidentCalls(db, input.name);
    case 'get_next_call':
      return sa.getNextCall(db, input.name);
    case 'find_resident':
      return sa.findResident(db, input.query);
    // Write tools -- defensive role check even though they're only offered to
    // chiefs; belt and suspenders against a spoofed/hallucinated call.
    case 'propose_edit': {
      if (sender?.role !== 'chief') return { error: 'Only chief residents can edit the schedule.' };
      const ops = (input.ops || []).map((o) => ({ ...o, date: resolveDate(o.date) }));
      return sa.proposeEdit(db, sender.name, ops, input.summary);
    }
    case 'confirm_edit':
      if (sender?.role !== 'chief') return { error: 'Only chief residents can edit the schedule.' };
      return sa.commitPending(db, sender.name);
    case 'discard_edit':
      if (sender?.role !== 'chief') return { error: 'Only chief residents can edit the schedule.' };
      return sa.discardPending(db, sender.name);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const BASE_RULES =
  'You are the QHN Pediatrics on-call schedule assistant, reached over WhatsApp. ' +
  'You answer questions about the Block 11 on-call schedule (Jul 5 – Aug 1, 2026) using the provided tools. ' +
  'Rules:\n' +
  '- Always use a tool to get real data; never guess names, dates, or assignments.\n' +
  '- Residents are referred to by short names like "H.Saif" or "Dina". If the user is vague or gives a full/partial name, use find_resident first to resolve it, and ask which one you mean if there are multiple matches.\n' +
  '- Keep replies short and WhatsApp-friendly: a sentence or two, plain text (no markdown tables). Slots are SO (Senior Overall), NICU, PICU, PMW (night call), and DC_PMW/DC_NICU (day call).\n' +
  '- If a tool returns an error (e.g. an invalid date), relay it plainly and suggest the valid range.';

const READ_ONLY_RULE =
  '\n- You are read-only for this user: answer questions but never change the schedule. If asked to make a change, say that schedule edits are handled by the chief residents.';

const CHIEF_RULES =
  '\n- This user is a CHIEF RESIDENT and may edit the schedule. To make a change: (1) use read tools to confirm the current state and resolve exact resident short-names, (2) call propose_edit with the ops and a one-line summary — this stages the change but does NOT apply it, (3) tell the chief exactly what will change and read out any warnings the tool returned, then ask them to confirm, (4) only once they explicitly confirm, call confirm_edit. If they decline or want to change it, call discard_edit.\n' +
  '- Warnings (gap too short, slot full, no-Saturday, vacation clash, etc.) are ADVISORY. Surface them clearly but let the chief proceed through them if they still confirm — do not refuse the edit yourself.\n' +
  '- A swap = two removes + two adds in one propose_edit call, so it is confirmed as a single unit.';

function systemPrompt(sender, pending) {
  let text = BASE_RULES + (sender?.role === 'chief' ? CHIEF_RULES : READ_ONLY_RULE);
  if (sender?.role === 'chief' && pending) {
    text +=
      `\n\nThere is already a PENDING edit this chief proposed and has not yet confirmed: "${pending.summary || '(no summary)'}"` +
      (pending.warnings?.length ? ` (warnings: ${pending.warnings.join(' | ')})` : ' (no warnings)') +
      '. If their message confirms it, call confirm_edit. If it declines or changes it, call discard_edit (and propose the new one if appropriate).';
  }
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

/**
 * @param {object} db - Firestore instance
 * @param {{name: string, role: string} | null} sender - identified resident, or null if unknown
 * @param {string} userText - the incoming WhatsApp message text
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<string>} reply text to send back over WhatsApp
 */
async function handleMessage(db, sender, userText, apiKey) {
  const client = new Anthropic({ apiKey });

  const isChief = sender?.role === 'chief';
  const tools = isChief ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
  const pending = isChief ? await sa.getPending(db, sender.name) : null;

  const who = sender
    ? `The person messaging you is ${sender.name} (role: ${sender.role}). When they say "me"/"my", they mean ${sender.name}.`
    : 'The person messaging you is not a recognized resident; answer general schedule questions but you cannot resolve "my"/"me" to anyone.';

  const messages = [
    {
      role: 'user',
      content: `Today is ${sa.todayScheduleDate()}. ${who}\n\nTheir message: ${userText}`,
    },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(sender, pending),
      tools,
      messages,
    });

    if (resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: resp.content });
      const toolResults = [];
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue;
        let result;
        try {
          result = await runTool(db, block.name, block.input || {}, sender);
        } catch (e) {
          result = { error: String(e.message || e) };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // end_turn (or anything else): return the assistant's text
    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || "Sorry, I couldn't work that out. Try rephrasing?";
  }

  return "That took too many steps to work out — try asking a simpler or more specific question.";
}

module.exports = { handleMessage, READ_TOOLS, WRITE_TOOLS, resolveDate, runTool };
