import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Column headers — create these in row 1 of your sheet manually
// A: Timestamp | B: Session ID | C: Page URL | D: User Message | E: Agent Response | F: Provider | G: Model

let sheetsInitialized = false;
let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('Google Sheets credentials not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)');
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: SCOPES,
  });
}

function getSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  }
  return sheetsClient;
}

export async function ensureHeaders(): Promise<void> {
  if (sheetsInitialized) return;

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:G1',
    });

    const firstRow = res.data.values?.[0];
    if (!firstRow || firstRow[0] !== 'Timestamp') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Sheet1!A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Timestamp', 'Session ID', 'Page URL', 'User Message', 'Agent Response', 'Provider', 'Model']],
        },
      });
    }

    sheetsInitialized = true;
  } catch (err) {
    console.error('[sheets] Failed to ensure headers:', err);
  }
}

export async function logConversation(params: {
  sessionId: string;
  pageUrl: string;
  userMessage: string;
  agentResponse: string;
}): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  try {
    await ensureHeaders();

    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            params.sessionId,
            params.pageUrl,
            params.userMessage,
            params.agentResponse,
            process.env.LLM_PROVIDER ?? 'unknown',
            process.env.LLM_MODEL ?? 'unknown',
          ],
        ],
      },
    });
  } catch (err) {
    // Never fail a request because of Sheets logging
    console.error('[sheets] Failed to log conversation:', err);
  }
}
