// Client for the extract-receipt edge function: reads a local image, base64s
// it, and POSTs to the function which calls Claude vision server-side.
//
// Always resolves — on any failure it returns an empty, zero-confidence result
// so the capture flow falls back to manual entry instead of blocking.

import * as FileSystem from 'expo-file-system/legacy';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export type ExtractedItem = { name: string; price: number | null };

export type ExtractionResult = {
  merchant: string | null;
  purchaseDate: string | null; // ISO YYYY-MM-DD
  total: number | null;
  currency: string | null;
  category: string | null;
  items: ExtractedItem[];
  confidence: number; // 0..1
};

const EMPTY: ExtractionResult = {
  merchant: null, purchaseDate: null, total: null, currency: null,
  category: null, items: [], confidence: 0,
};

export async function extractReceipt(imageUri: string): Promise<ExtractionResult> {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mediaType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-receipt`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) throw new Error(`extract HTTP ${res.status}`);
    const data = (await res.json()) as Partial<ExtractionResult>;
    if (typeof data.confidence !== 'number') throw new Error('malformed result');

    return {
      merchant: data.merchant ?? null,
      purchaseDate: data.purchaseDate ?? null,
      total: typeof data.total === 'number' ? data.total : null,
      currency: data.currency ?? null,
      category: data.category ?? null,
      items: Array.isArray(data.items) ? data.items : [],
      confidence: data.confidence,
    };
  } catch (e) {
    console.warn('[receipt-vault] extraction failed, falling back to manual', e);
    return EMPTY;
  }
}
