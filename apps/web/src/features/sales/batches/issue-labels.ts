import { translatedServerMessage } from '@/lib/api-error'

/**
 * One batch row issue as the preview and process endpoints return it. Codes are
 * the backend's stable contract; `message` is its English text.
 */
export type BatchIssue = { code: string; message: string }

/**
 * Turkish display text for one batch row issue. The shared server translator
 * knows every current message, so the text and its data come from the error
 * snapshot itself; unknown future text stays as sent.
 */
export function batchIssueLabel(issue: BatchIssue): string {
  return translatedServerMessage(issue.message, issue.code) ?? issue.message
}
