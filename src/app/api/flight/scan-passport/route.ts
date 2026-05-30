import { NextRequest, NextResponse } from 'next/server';

const PASSPORT_SCAN_URL =
  process.env.PASSPORT_SCAN_URL || 'http://localhost:8085/api/passport/scan';

interface ScanResponse {
  name: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  expiryDate: string;
  gender: string;
  ocrConfidence?: number;
  fieldConfidences?: Record<string, number>;
}

interface MRZData {
  passportNumber: string;
  surname: string;
  givenNames: string;
  nationality: string;
  issuingCountry: string;
  issuingCountryIso2: string;
  dateOfBirth: string;
  sex: string;
  expiryDate: string;
  issueDate: string;
  issuingAuthority: string;
  placeOfBirth: string;
}

/** Split "GIVEN MIDDLE SURNAME" → surname = last word, givenNames = rest */
function splitName(fullName: string): { surname: string; givenNames: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: '', givenNames: '' };
  if (parts.length === 1) return { surname: '', givenNames: parts[0] };
  return {
    surname: parts[parts.length - 1],
    givenNames: parts.slice(0, -1).join(' '),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    // Convert base64 → Buffer → Blob for multipart upload
    const buffer = Buffer.from(imageBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType });

    const formData = new FormData();
    const ext = mimeType.split('/')[1] || 'jpg';
    formData.append('file', blob, `passport.${ext}`);

    let scanRes: Response;
    try {
      scanRes = await fetch(PASSPORT_SCAN_URL, { method: 'POST', body: formData });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[scan-passport] Cannot reach local passport service:', msg);
      return NextResponse.json(
        { error: 'Passport scan service is unavailable. Make sure the local service is running on port 8085.' },
        { status: 503 },
      );
    }

    if (!scanRes.ok) {
      const errText = await scanRes.text().catch(() => '');
      console.error('[scan-passport] Service error:', scanRes.status, errText);
      return NextResponse.json(
        { error: `Passport scan service error (${scanRes.status})`, detail: errText },
        { status: scanRes.status },
      );
    }

    const raw: ScanResponse = await scanRes.json();

    const { surname, givenNames } = splitName(raw.name || '');

    const data: MRZData = {
      passportNumber: raw.passportNumber || '',
      surname,
      givenNames,
      nationality: raw.nationality || '',
      issuingCountry: '',
      issuingCountryIso2: '',
      dateOfBirth: raw.dateOfBirth || '',
      sex: raw.gender || '',
      expiryDate: raw.expiryDate || '',
      issueDate: '',
      issuingAuthority: '',
      placeOfBirth: '',
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[scan-passport] Exception:', msg);
    return NextResponse.json({ error: 'Passport scan failed', message: msg }, { status: 500 });
  }
}
