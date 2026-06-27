/**
 * ZENITH NORTH — DEO Undertaking Generator
 *
 * SEC Rule 17a-4(f) and the 2022 amendments require that firms
 * using an electronic recordkeeping system have either:
 *   (a) A third-party provider file a written undertaking, OR
 *   (b) A Designated Executive Officer (DEO) of the firm execute
 *       the undertaking themselves
 *
 * Zenith North uses option (b). The firm's CCO becomes the DEO.
 * They sign this undertaking during onboarding, confirming they:
 *   1. Have access to all electronic records
 *   2. Can provide records to the SEC upon request
 *   3. Understand their obligations under Rule 204-2
 *
 * This is generated as a PDF-ready document that the CCO signs
 * digitally via the client portal during firm setup.
 *
 * This undertaking + the RLS-enforced immutability of our database
 * is what makes Zenith North a fully compliant recordkeeping system
 * without needing a third-party archiver like Smarsh or MyRepChat.
 */

export interface DEOUndertakingData {
  // Firm info
  firmName:        string
  firmCRD:         string         // SEC CRD number
  firmAddress:     string
  // DEO info (the CCO)
  deoName:         string
  deoTitle:        string
  deoEmail:        string
  // System info
  systemName:      string
  systemProvider:  string
  dataLocation:    string
  retentionYears:  number
  // Dates
  effectiveDate:   string
  signedDate?:     string
  signature?:      string
}

export function generateDEOUndertaking(data: DEOUndertakingData): string {
  return `
WRITTEN UNDERTAKING OF DESIGNATED EXECUTIVE OFFICER
Pursuant to SEC Investment Advisers Act Rule 204-2 and
Rule 17a-4(f) (as amended October 12, 2022)

FIRM INFORMATION
Firm Name:    ${data.firmName}
CRD Number:   ${data.firmCRD}
Address:      ${data.firmAddress}

DESIGNATED EXECUTIVE OFFICER
Name:         ${data.deoName}
Title:        ${data.deoTitle}
Email:        ${data.deoEmail}

ELECTRONIC RECORDKEEPING SYSTEM
System Name:  ${data.systemName}
Provider:     ${data.systemProvider}
Data Location: ${data.dataLocation}
Retention:    ${data.retentionYears} years

UNDERTAKING

I, ${data.deoName}, in my capacity as ${data.deoTitle} of ${data.firmName}
(the "Firm"), hereby execute this Written Undertaking pursuant to
Rule 17a-4(f)(3)(vii) of the Securities Exchange Act of 1934, as amended,
and the Investment Advisers Act Rule 204-2.

I hereby certify and undertake that:

1. ACCESS TO RECORDS
   I have the ability to access and download all electronic records
   maintained by the Firm on the ${data.systemName} electronic
   recordkeeping system operated by ${data.systemProvider}.

2. REGULATORY PRODUCTION
   I will promptly furnish to the Securities and Exchange Commission
   (the "Commission"), any representative or designee of the Commission,
   or any representative of a self-regulatory organization of which the
   Firm is a member, upon request, any electronic record required to be
   maintained and preserved under applicable securities laws and regulations.

3. AUDIT-TRAIL COMPLIANCE
   The ${data.systemName} system maintains records in accordance with the
   audit-trail alternative under amended Rule 17a-4(f), such that:
   (a) All records are preserved in a manner that permits recreation
       of the original record if it is modified or deleted;
   (b) An audit trail is maintained for every access, modification,
       or attempted deletion of any record;
   (c) Records cannot be modified or deleted by any user, including
       system administrators, due to database-level immutability
       controls enforced via row-level security policies.

4. ACCESSIBILITY
   All records from the preceding two (2) years are immediately
   accessible in a human-readable and reasonably usable format.
   Records from years three (3) through ${data.retentionYears} are
   accessible upon request within 24 hours.

5. RETENTION PERIOD
   The Firm retains all required records for a minimum of
   ${data.retentionYears} years, in compliance with Rule 204-2 of the
   Investment Advisers Act of 1940.

6. DUPLICATE COPIES
   The ${data.systemProvider} infrastructure maintains duplicate copies
   of all records across geographically separate data centers, ensuring
   records are protected against loss from any single site failure.

7. NOTIFICATION
   I understand my obligation to notify the Commission of any system
   failure, data loss, or other event that may impair the Firm's ability
   to produce records upon request.

ACKNOWLEDGMENT

By signing below, I acknowledge that I have read and understand this
Written Undertaking and agree to fulfill the obligations set forth herein.

Firm:           ${data.firmName}
DEO Name:       ${data.deoName}
DEO Title:      ${data.deoTitle}
Effective Date: ${data.effectiveDate}

${data.signedDate ? `Signed: ${data.signedDate}` : '[SIGNATURE REQUIRED]'}
${data.signature  ? `Signature: ${data.signature}` : ''}

─────────────────────────────────────────────────────────────────
This undertaking is maintained as part of the Firm's books and
records and is available to regulators upon request.
Generated by Zenith North — The RIA Operating System
─────────────────────────────────────────────────────────────────
`.trim()
}

/**
 * Check if a tenant has a valid, signed DEO undertaking.
 * Called during exam package generation.
 */
export function validateDEOUndertaking(config: Record<string, unknown>): {
  valid:    boolean
  issues:   string[]
} {
  const issues: string[] = []

  if (!config.deoName)       issues.push('DEO name not set')
  if (!config.deoTitle)      issues.push('DEO title not set')
  if (!config.deoEmail)      issues.push('DEO email not set')
  if (!config.deoSignedAt)   issues.push('DEO undertaking not signed')
  if (!config.firmCRD)       issues.push('Firm CRD number not set')

  return {
    valid:  issues.length === 0,
    issues,
  }
}
