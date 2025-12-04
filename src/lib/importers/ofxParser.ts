// OFX/QBO/QFX Parser
// These formats follow the OFX (Open Financial Exchange) standard

import type { ParseResult, ParsedTransaction, ParseError, DetectedAccount } from './types'

interface OFXTransaction {
  TRNTYPE?: string
  DTPOSTED?: string
  DTUSER?: string
  TRNAMT?: string
  FITID?: string
  NAME?: string
  MEMO?: string
  CHECKNUM?: string
  REFNUM?: string
}

interface OFXAccount {
  ACCTID?: string
  ACCTTYPE?: string
  BANKID?: string
}

interface OFXStatement {
  CURDEF?: string
  BANKACCTFROM?: OFXAccount
  CCACCTFROM?: { ACCTID?: string }
  transactions: OFXTransaction[]
}

/**
 * Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
 */
function parseOFXDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  // Remove any timezone info [+/-X:XXX]
  const cleaned = dateStr.replace(/\[.*\]/, '').trim()
  
  // Handle YYYYMMDDHHMMSS or YYYYMMDD
  if (cleaned.length >= 8) {
    const year = cleaned.substring(0, 4)
    const month = cleaned.substring(4, 6)
    const day = cleaned.substring(6, 8)
    
    const date = new Date(`${year}-${month}-${day}`)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  
  return null
}

/**
 * Extract text content between OFX tags
 * Handles multiple OFX/QBO format variations including:
 * - Values on same line as tag
 * - Values on next line after tag (common in Intuit QBO exports)
 * - Extra whitespace/newlines
 */
function extractTagValue(content: string, tag: string): string | null {
  // OFX/QBO uses SGML-style tags: <TAG>value (no closing tag usually)
  // Some banks (like Buckholts State Bank) put value on same line
  // The key insight: value ends at the next < character
  
  const patterns = [
    // Value immediately after tag, ends at next tag or newline
    new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i'),
    // Value after tag with possible whitespace, capture until next <
    new RegExp(`<${tag}>\\s*([^<]+?)\\s*<`, 'i'),
    // Standard OFX format with closing tag
    new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'),
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      // Clean up the value - remove extra whitespace and newlines
      const value = match[1].replace(/[\r\n]+/g, ' ').trim()
      if (value) return value
    }
  }
  
  return null
}

/**
 * Extract all transactions from OFX content
 * Handles multiple format variations from different banks
 */
function extractTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = []
  
  // Normalize content - collapse multiple newlines into single, remove carriage returns
  let normalizedContent = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  
  // Find the BANKTRANLIST section first (contains all transactions)
  const tranListMatch = normalizedContent.match(/<BANKTRANLIST>([\s\S]*?)(?:<\/BANKTRANLIST>|<\/STMTRS>|$)/i)
  if (tranListMatch) {
    normalizedContent = tranListMatch[1]
  }
  
  // Split by <STMTTRN> tags to get individual transaction blocks
  // This is more reliable than regex for files with lots of whitespace
  const parts = normalizedContent.split(/<STMTTRN>/i)
  
  for (let i = 1; i < parts.length; i++) { // Start at 1 to skip content before first STMTTRN
    let block = parts[i]
    
    // Trim the block at the closing tag or next section
    const endMatch = block.match(/<\/STMTTRN>|<\/BANKTRANLIST>/i)
    if (endMatch && endMatch.index !== undefined) {
      block = block.substring(0, endMatch.index)
    }
    
    // Extract NAME - some banks use PAYEE instead
    let name = extractTagValue(block, 'NAME')
    if (!name) {
      // Try PAYEE tag (used by some Intuit QBO exports)
      name = extractTagValue(block, 'PAYEE')
    }
    if (!name) {
      // Some banks put description in MEMO only
      name = extractTagValue(block, 'MEMO')
    }
    
    const transaction: OFXTransaction = {
      TRNTYPE: extractTagValue(block, 'TRNTYPE') || undefined,
      DTPOSTED: extractTagValue(block, 'DTPOSTED') || undefined,
      DTUSER: extractTagValue(block, 'DTUSER') || undefined,
      TRNAMT: extractTagValue(block, 'TRNAMT') || undefined,
      FITID: extractTagValue(block, 'FITID') || undefined,
      NAME: name || undefined,
      MEMO: extractTagValue(block, 'MEMO') || undefined,
      CHECKNUM: extractTagValue(block, 'CHECKNUM') || extractTagValue(block, 'CHKNUM') || undefined,
      REFNUM: extractTagValue(block, 'REFNUM') || undefined,
    }
    
    // Only add if we have meaningful data (at least a date or amount)
    if (transaction.DTPOSTED || transaction.TRNAMT || transaction.NAME) {
      transactions.push(transaction)
    }
  }
  
  return transactions
}

/**
 * Extract account info from OFX content
 */
function extractAccountInfo(content: string): OFXAccount | null {
  // Try bank account first
  const bankAcctMatch = content.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i) ||
                        content.match(/<BANKACCTFROM>([\s\S]*?)(?=<BANKTRANLIST>)/i)
  
  if (bankAcctMatch) {
    return {
      ACCTID: extractTagValue(bankAcctMatch[1], 'ACCTID') || undefined,
      ACCTTYPE: extractTagValue(bankAcctMatch[1], 'ACCTTYPE') || undefined,
      BANKID: extractTagValue(bankAcctMatch[1], 'BANKID') || undefined,
    }
  }
  
  // Try credit card account
  const ccAcctMatch = content.match(/<CCACCTFROM>([\s\S]*?)<\/CCACCTFROM>/i) ||
                      content.match(/<CCACCTFROM>([\s\S]*?)(?=<BANKTRANLIST>|<CCSTMTTRNRS>)/i)
  
  if (ccAcctMatch) {
    return {
      ACCTID: extractTagValue(ccAcctMatch[1], 'ACCTID') || undefined,
      ACCTTYPE: 'CREDITCARD',
    }
  }
  
  return null
}

/**
 * Convert OFX account type to our account type
 */
function mapOFXAccountType(ofxType: string | undefined): 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other' {
  if (!ofxType) return 'other'
  
  const type = ofxType.toUpperCase()
  
  switch (type) {
    case 'CHECKING':
      return 'checking'
    case 'SAVINGS':
      return 'savings'
    case 'CREDITCARD':
    case 'CREDITLINE':
      return 'credit'
    case 'MONEYMRKT':
    case 'CD':
      return 'savings'
    case 'INVESTMENT':
      return 'investment'
    default:
      return 'other'
  }
}

/**
 * Convert OFX transaction type to our type
 */
function mapTransactionType(ofxType: string | undefined): 'debit' | 'credit' | 'check' | 'transfer' {
  if (!ofxType) return 'debit'
  
  const type = ofxType.toUpperCase()
  
  switch (type) {
    case 'CREDIT':
    case 'DEP':
    case 'DIRECTDEP':
    case 'INT':
    case 'DIV':
      return 'credit'
    case 'CHECK':
      return 'check'
    case 'XFER':
      return 'transfer'
    case 'DEBIT':
    case 'ATM':
    case 'POS':
    case 'FEE':
    case 'SRVCHG':
    case 'PAYMENT':
    default:
      return 'debit'
  }
}

/**
 * Parse OFX/QBO/QFX file content
 */
export function parseOFX(content: string): ParseResult {
  const errors: ParseError[] = []
  const warnings: string[] = []
  
  try {
    // Detect file type from content
    let fileType: 'qbo' | 'qfx' | 'ofx' = 'ofx'
    if (content.includes('INTUIT') || content.includes('INTU.BID')) {
      fileType = 'qbo'
    } else if (content.includes('QUICKEN')) {
      fileType = 'qfx'
    }
    
    // Extract account info
    const accountInfo = extractAccountInfo(content)
    if (accountInfo) {
      warnings.push(`Detected account: ${accountInfo.ACCTTYPE || 'Unknown'} ending in ...${accountInfo.ACCTID?.slice(-4) || '????'}`)
    }
    
    // Extract currency
    const currency = extractTagValue(content, 'CURDEF') || 'USD'
    
    // Extract all transactions
    const ofxTransactions = extractTransactions(content)
    
    if (ofxTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        fileType,
        errors: [{ message: 'No transactions found in file', severity: 'error' }],
        warnings,
      }
    }
    
    // Convert to our format
    const transactions: ParsedTransaction[] = ofxTransactions.map((ofxTxn, index) => {
      const date = parseOFXDate(ofxTxn.DTPOSTED || ofxTxn.DTUSER || '')
      const amount = ofxTxn.TRNAMT ? parseFloat(ofxTxn.TRNAMT) : null
      
      if (!date) {
        errors.push({
          row: index + 1,
          message: `Could not parse date for transaction: ${ofxTxn.NAME || 'Unknown'}`,
          severity: 'warning',
        })
      }
      
      // Build description from NAME and MEMO
      let description = ofxTxn.NAME || ''
      if (ofxTxn.MEMO && ofxTxn.MEMO !== ofxTxn.NAME) {
        description += description ? ` - ${ofxTxn.MEMO}` : ofxTxn.MEMO
      }
      
      return {
        date,
        amount,
        description: description || 'Unknown Transaction',
        memo: ofxTxn.MEMO,
        checkNumber: ofxTxn.CHECKNUM,
        referenceId: ofxTxn.FITID, // This is the Financial Institution Transaction ID - great for dedup!
        type: ofxTxn.CHECKNUM ? 'check' : mapTransactionType(ofxTxn.TRNTYPE),
        rawData: {
          ...ofxTxn,
          _currency: currency,
          _accountId: accountInfo?.ACCTID,
          _accountType: accountInfo?.ACCTTYPE,
        },
        rowNumber: index + 1,
      }
    })
    
    // Build detected account info
    const detectedAccount: DetectedAccount | undefined = accountInfo ? {
      accountId: accountInfo.ACCTID,
      mask: accountInfo.ACCTID?.slice(-4),
      accountType: mapOFXAccountType(accountInfo.ACCTTYPE),
      bankId: accountInfo.BANKID,
    } : undefined
    
    return {
      success: true,
      transactions,
      fileType,
      errors,
      warnings,
      detectedAccount,
      detectedFormat: {
        hasHeaderRow: false, // OFX doesn't have headers like CSV
        amountStyle: 'single',
        confidence: 1.0, // OFX is a standard format
        dateFormat: 'YYYYMMDD',
      },
    }
    
  } catch (error) {
    return {
      success: false,
      transactions: [],
      fileType: 'ofx',
      errors: [{
        message: `Failed to parse OFX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      }],
      warnings: [],
    }
  }
}

/**
 * Detect if content is OFX/QBO/QFX format
 */
export function isOFXFormat(content: string): boolean {
  // Check for OFX/QBO/QFX headers or tags
  const markers = [
    'OFXHEADER',
    '<OFX>',
    '<BANKMSGSRSV1>',
    '<CREDITCARDMSGSRSV1>',
    '<STMTTRN>',
    '<BANKTRANLIST>',
    'ENCODING:',
    'DATA:OFXSGML',
    'INTU.BID',  // Intuit Bank ID (QBO specific)
    'INTUIT',
    '<SONRS>',   // Signon response
    '<STMTRS>',  // Statement response
  ]
  
  const upperContent = content.toUpperCase()
  return markers.some(marker => upperContent.includes(marker))
}



