// Claim Helper — turns a deadline into an action. Drafts a return / warranty
// email + checklist for a receipt. Tries the Claude edge function; if that's
// unavailable (no key, offline), falls back to a solid local template so the
// feature always works.

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { derive, fmtDY, money, type Receipt } from './data';

export type ClaimKind = 'return' | 'warranty';

export type Claim = {
  inWindow: boolean;
  subject: string;
  body: string;
  checklist: string[];
  note: string | null;
  source: 'ai' | 'template';
};

export async function generateClaim(r: Receipt, kind: ClaimKind): Promise<Claim> {
  const fallback = localClaim(r, kind);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/claim-helper`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(buildPayload(r, kind)),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) throw new Error(`claim HTTP ${res.status}`);
    const d = await res.json();
    if (typeof d.subject !== 'string' || typeof d.body !== 'string' || !Array.isArray(d.checklist)) {
      throw new Error('malformed claim');
    }
    return {
      inWindow: !!d.inWindow,
      subject: d.subject,
      body: d.body,
      checklist: d.checklist,
      note: d.note ?? null,
      source: 'ai',
    };
  } catch (e) {
    console.warn('[receipt-vault] claim AI unavailable, using template', e);
    return fallback;
  }
}

function buildPayload(r: Receipt, kind: ClaimKind) {
  const v = derive(r);
  const deadline =
    kind === 'return'
      ? v.retBy
        ? `Return by ${fmtDY(v.retBy)}`
        : 'return window unknown'
      : v.warTo
        ? `Warranty until ${fmtDY(v.warTo)}`
        : 'warranty end unknown';
  return {
    kind,
    merchant: r.merchant,
    purchaseDate: fmtDY(r.date),
    total: r.total,
    currency: 'USD',
    payment: r.pay,
    items: r.items,
    deadline,
    daysLeft: kind === 'return' ? v.retLeft : v.warLeft,
  };
}

function localClaim(r: Receipt, kind: ClaimKind): Claim {
  const v = derive(r);
  const total = money(r.total);
  const date = fmtDY(r.date);

  if (kind === 'return') {
    const by = v.retBy ? fmtDY(v.retBy) : 'soon';
    return {
      inWindow: v.retLeft >= 0,
      subject: `Return request — ${r.merchant} purchase on ${date}`,
      body:
        `Hello,\n\n` +
        `I'd like to return an item from my purchase at ${r.merchant} on ${date} (total ${total}). ` +
        `[Order number: ______]\n\n` +
        `Reason for return: [describe]\n\n` +
        `This is within the return window (by ${by}). Please let me know how to proceed and where ` +
        `to send the item.\n\n` +
        `Thank you,\n[Your name]`,
      checklist: [
        'Proof of purchase (your receipt photo is saved in Receipt Vault)',
        'Order or transaction number',
        'Item in original condition and packaging',
        `Send the request before ${by}`,
      ],
      note: v.retLeft >= 0 && v.retLeft <= 5 ? `Only ${v.retLeft} day(s) left — send this today.` : null,
      source: 'template',
    };
  }

  const until = v.warTo ? fmtDY(v.warTo) : 'the warranty period';
  return {
    inWindow: v.warLeft >= 0,
    subject: `Warranty claim — ${r.merchant} (${date})`,
    body:
      `Hello,\n\n` +
      `I'm filing a warranty claim for an item purchased at ${r.merchant} on ${date} (total ${total}). ` +
      `[Order/serial number: ______]\n\n` +
      `Issue: [describe the problem]\n\n` +
      `The item is still under warranty (until ${until}). Please advise on the next steps for repair ` +
      `or replacement.\n\n` +
      `Thank you,\n[Your name]`,
    checklist: [
      'Proof of purchase (saved in Receipt Vault)',
      'Product serial or model number',
      'A clear description of the defect',
      'Photos or a short video of the issue',
      `Warranty valid until ${until}`,
    ],
    note: null,
    source: 'template',
  };
}
