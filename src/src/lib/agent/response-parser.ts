import type { DiagnosisUpdate } from '@/types/diagnosis';
import { validateDiagnosisUpdate } from '@/schemas/diagnosis';

interface ParsedResponse {
  conversationalText: string;
  diagnosisUpdate: DiagnosisUpdate | null;
}

/**
 * Legacy parser: extracts diagnosis_update from old XML-tag format.
 * Only used for loading old messages from DB that were stored before the tool_use migration.
 */
export function parseLegacyResponse(fullText: string): ParsedResponse {
  const tagStart = '<diagnosis_update>';
  const tagEnd = '</diagnosis_update>';

  const startIdx = fullText.indexOf(tagStart);
  const endIdx = fullText.indexOf(tagEnd);

  if (startIdx === -1 || endIdx === -1) {
    return { conversationalText: fullText.trim(), diagnosisUpdate: null };
  }

  const conversationalText = fullText.substring(0, startIdx).trim();
  const jsonStr = fullText.substring(startIdx + tagStart.length, endIdx).trim();

  try {
    const rawJson = JSON.parse(jsonStr);
    const validation = validateDiagnosisUpdate(rawJson);
    if (validation.success) {
      return { conversationalText, diagnosisUpdate: validation.data as DiagnosisUpdate };
    }
    return { conversationalText, diagnosisUpdate: rawJson as DiagnosisUpdate };
  } catch {
    return { conversationalText, diagnosisUpdate: null };
  }
}
