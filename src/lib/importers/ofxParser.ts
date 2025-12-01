// OFX/QBO/QFX Parser
// These formats follow the OFX (Open Financial Exchange) standard

import type { ParseResult, ParsedTransaction, ParseError } from './types'

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
 */
function extractTagValue(content: string, tag: string): string | null {
  // OFX uses SGML-style tags: <TAG>value (no closing tag usually)
  // or sometimes <TAG>value</TAG>
  const patterns = [
    new RegExp(`<${tag}>([^<]+)(?:</${tag}>)?`, 'i'),
    new RegExp(`<${tag}>\\s*([^\\n<]+)`, 'i'),
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  return null
}

/**
 * Extract all transactions from OFX content
 */
function extractTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = []
  
  // Find all STMTTRN blocks
  const stmttrnPattern = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|$)/gi
  let match
  
  while ((match = stmttrnPattern.exec(content)) !== null) {
    const block = match[1]
    
    const transaction: OFXTransaction = {
      TRNTYPE: extractTagValue(block, 'TRNTYPE') || undefined,
      DTPOSTED: extractTagValue(block, 'DTPOSTED') || undefined,
      DTUSER: extractTagValue(block, 'DTUSER') || undefined,
      TRNAMT: extractTagValue(block, 'TRNAMT') || undefined,
      FITID: extractTagValue(block, 'FITID') || undefined,
      NAME: extractTagValue(block, 'NAME') || undefined,
      MEMO: extractTagValue(block, 'MEMO') || undefined,
      CHECKNUM: extractTagValue(block, 'CHECKNUM') || undefined,
      REFNUM: extractTagValue(block, 'REFNUM') || undefined,
    }
    
    // Only add if we have meaningful data
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
    
    return {
      success: true,
      transactions,
      fileType,
      errors,
      warnings,
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
 * Detect if content is OFX format
 */
export function isOFXFormat(content: string): boolean {
  // Check for OFX headers or tags
  const markers = [
    'OFXHEADER',
    '<OFX>',
    '<BANKMSGSRSV1>',
    '<CREDITCARDMSGSRSV1>',
    '<STMTTRN>',
    'ENCODING:',
  ]
  
  const upperContent = content.toUpperCase()
  return markers.some(marker => upperContent.includes(marker))
}

