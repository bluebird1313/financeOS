import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Parse CSV content
function parseCSV(content: string): string[][] {
  const lines = content.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// Better JSON extraction from AI response
function extractJSON(text: string): any {
  // First, try to parse as-is
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to other methods
  }
  
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue
  }
  
  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/); 
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Continue
    }
  }
  
  // Try to find JSON array in the text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return { transactions: JSON.parse(arrayMatch[0]) };
    } catch (e) {
      // Continue
    }
  }
  
  throw new Error('Could not extract valid JSON from response');
}

// Directly parse CSV into transactions without AI
function parseCSVToTransactions(content: string): any[] {
  const rows = parseCSV(content);
  if (rows.length < 2) return [];
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const transactions: any[] = [];
  
  // Find column indices - be flexible with column names
  const dateIdx = headers.findIndex(h => 
    h.includes('date') || h.includes('posted') || h.includes('time') || h === 'when'
  );
  
  const amountIdx = headers.findIndex(h => 
    h.includes('amount') || h.includes('debit') || h.includes('credit') || 
    h.includes('sum') || h.includes('total') || h.includes('price') || h.includes('cost')
  );
  
  const descIdx = headers.findIndex(h => 
    h.includes('description') || h.includes('memo') || h.includes('payee') || 
    h.includes('merchant') || h.includes('name') || h.includes('vendor') ||
    h.includes('details') || h.includes('note') || h.includes('item') || h.includes('expense')
  );
  
  const categoryIdx = headers.findIndex(h => 
    h.includes('category') || h.includes('type') || h.includes('class')
  );
  
  console.log(`CSV Headers: ${headers.join(', ')}`);
  console.log(`Column indices - date:${dateIdx}, amount:${amountIdx}, desc:${descIdx}, category:${categoryIdx}`);
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2 || row.every(cell => !cell.trim())) continue; // Skip empty rows
    
    let date = new Date().toISOString().split('T')[0];
    let amount = 0;
    let description = '';
    let category = '';
    
    // Extract date
    if (dateIdx >= 0 && row[dateIdx]) {
      const dateStr = row[dateIdx].trim();
      if (dateStr) {
        // Try various date formats
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().split('T')[0];
        } else {
          // Try MM/DD/YYYY or M/D/YY format
          const parts = dateStr.split(/[\/\-]/);
          if (parts.length === 3) {
            let [m, d, y] = parts;
            const year = y.length === 2 ? '20' + y : y;
            date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
      }
    } else {
      // Try to find a date in any column
      for (const cell of row) {
        if (cell && cell.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) {
          const parts = cell.split(/[\/\-]/);
          if (parts.length === 3) {
            let [m, d, y] = parts;
            const year = y.length === 2 ? '20' + y : y;
            date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            break;
          }
        }
      }
    }
    
    // Extract amount
    if (amountIdx >= 0 && row[amountIdx]) {
      const amountStr = row[amountIdx].replace(/[$,\s]/g, '').replace(/[()]/g, '-').replace(/^-+/, '-');
      amount = parseFloat(amountStr) || 0;
    } else {
      // Try to find any number in the row that looks like money
      for (let j = 0; j < row.length; j++) {
        if (j === dateIdx) continue; // Skip date column
        const cell = row[j];
        if (cell) {
          const numMatch = cell.match(/[-]?\$?[\d,]+\.\d{2}/); 
          if (numMatch) {
            const val = parseFloat(numMatch[0].replace(/[$,]/g, ''));
            if (Math.abs(val) > 0.01 && Math.abs(val) < 1000000) {
              amount = val;
              break;
            }
          }
        }
      }
    }
    
    // Extract description
    if (descIdx >= 0 && row[descIdx]) {
      description = row[descIdx].trim();
    }
    
    // If no description found, use the longest text field
    if (!description) {
      let longestText = '';
      for (let j = 0; j < row.length; j++) {
        const cell = row[j]?.trim();
        if (cell && cell.length > longestText.length) {
          // Skip if it looks like a number or date
          if (!cell.match(/^[-$\d,\.]+$/) && !cell.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
            longestText = cell;
          }
        }
      }
      description = longestText || `Transaction ${i}`;
    }
    
    // Extract category
    if (categoryIdx >= 0 && row[categoryIdx]) {
      category = row[categoryIdx].trim();
    }
    
    // Only add if we have meaningful data
    if (description || Math.abs(amount) > 0) {
      transactions.push({
        date,
        amount,
        description,
        suggested_category: category || null,
        item_type: 'transaction',
        ai_confidence: 0.7,
        ai_notes: `Parsed from CSV row ${i}${category ? `. Category: ${category}` : ''}`
      });
    }
  }
  
  console.log(`Parsed ${transactions.length} transactions from ${rows.length - 1} data rows`);
  return transactions;
}

// Parse OFX/QFX content
function parseOFX(content: string): any[] {
  const transactions: any[] = [];
  
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    
    const getTag = (tag: string) => {
      const regex = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
      const m = block.match(regex);
      return m ? m[1].trim() : '';
    };
    
    const dateStr = getTag('DTPOSTED');
    const amount = parseFloat(getTag('TRNAMT')) || 0;
    const name = getTag('NAME') || getTag('MEMO') || 'Unknown';
    const checkNum = getTag('CHECKNUM');
    const memo = getTag('MEMO');
    
    let date = new Date().toISOString().split('T')[0];
    if (dateStr && dateStr.length >= 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      date = `${year}-${month}-${day}`;
    }
    
    transactions.push({
      date,
      amount,
      description: name,
      check_number: checkNum || undefined,
      memo: memo || undefined,
      item_type: checkNum ? 'check' : 'transaction',
      ai_confidence: 0.9,
      ai_notes: 'Parsed from OFX'
    });
  }
  
  return transactions;
}

// Use OpenAI to enhance/categorize transactions
async function enhanceWithAI(transactions: any[], categoryNames: string[]): Promise<any[]> {
  if (!OPENAI_API_KEY || transactions.length === 0) {
    return transactions;
  }
  
  const prompt = `Categorize these financial transactions. Available categories: ${categoryNames.join(', ')}

Transactions:
${JSON.stringify(transactions.slice(0, 30), null, 2)}

For each transaction, determine:
1. suggested_category: best matching category from the list above
2. is_business_expense: true/false
3. merchant_name: cleaned merchant name if identifiable
4. ai_confidence: 0.0-1.0

Return ONLY a JSON array with the enhanced transactions. No markdown, no explanation:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a JSON generator. Output ONLY valid JSON arrays. Never include markdown formatting or explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      console.log('AI enhancement failed:', await response.text());
      return transactions;
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';
    
    console.log('AI response preview:', content.substring(0, 300));
    
    try {
      const enhanced = extractJSON(content);
      const enhancedArray = Array.isArray(enhanced) ? enhanced : (enhanced.transactions || enhanced);
      if (Array.isArray(enhancedArray) && enhancedArray.length > 0) {
        console.log(`AI enhanced ${enhancedArray.length} transactions`);
        return enhancedArray;
      }
    } catch (e) {
      console.log('Could not parse AI enhancement:', e);
    }
    
    return transactions;
  } catch (e) {
    console.log('AI enhancement error:', e);
    return transactions;
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize Supabase clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Verify user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get request body
    const { content, file_type, file_name, document_import_id } = await req.json();
    
    if (!content || !file_type) {
      return new Response(JSON.stringify({ error: 'Missing content or file_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Processing ${file_type} file: ${file_name}`);
    console.log(`Content length: ${content.length} chars`);
    console.log(`First 500 chars: ${content.substring(0, 500)}`);
    
    // Get user's existing categories for context
    const { data: categories } = await supabase
      .from('categories')
      .select('name')
      .or(`user_id.eq.${user.id},is_system.eq.true`);
    
    const categoryNames = (categories || []).map((c: any) => c.name);
    console.log(`Found ${categoryNames.length} categories`);
    
    let transactions: any[] = [];
    let summary = '';
    let sourceType = 'unknown';
    
    // Process based on file type
    if (file_type === 'ofx' || file_type === 'qfx') {
      transactions = parseOFX(content);
      summary = `Parsed ${transactions.length} transactions from OFX file`;
      sourceType = 'transaction_export';
      
      if (transactions.length > 0 && categoryNames.length > 0) {
        transactions = await enhanceWithAI(transactions, categoryNames);
      }
    } else if (file_type === 'csv') {
      transactions = parseCSVToTransactions(content);
      summary = `Parsed ${transactions.length} transactions from CSV`;
      sourceType = 'transaction_export';
      
      if (transactions.length > 0 && categoryNames.length > 0) {
        transactions = await enhanceWithAI(transactions, categoryNames);
      }
    } else {
      summary = `File type ${file_type} requires CSV export or manual entry`;
      sourceType = 'unknown';
    }
    
    console.log(`Total transactions to insert: ${transactions.length}`);
    
    // Store pending import items in database
    let insertedCount = 0;
    if (transactions.length > 0) {
      const pendingItems = transactions.map(t => ({
        user_id: user.id,
        document_import_id: document_import_id || null,
        item_type: t.item_type || 'transaction',
        date: t.date || new Date().toISOString().split('T')[0],
        amount: parseFloat(String(t.amount)) || 0,
        description: String(t.description || 'Unknown').substring(0, 500),
        merchant_name: t.merchant_name || null,
        is_business_expense: t.is_business_expense || false,
        check_number: t.check_number || null,
        payee: t.payee || null,
        memo: t.memo || null,
        ai_confidence: parseFloat(String(t.ai_confidence || t.confidence)) || 0.5,
        ai_notes: String(t.ai_notes || t.suggested_category || t.notes || '').substring(0, 1000),
        needs_review_reason: (t.ai_confidence || t.confidence || 0.5) < 0.7 ? 'Low confidence - please verify' : null,
        status: 'pending'
      }));
      
      console.log('Sample item to insert:', JSON.stringify(pendingItems[0]));
      
      const { data: insertedItems, error: insertError } = await supabase
        .from('pending_import_items')
        .insert(pendingItems)
        .select();
      
      if (insertError) {
        console.error('Insert error:', JSON.stringify(insertError));
      } else {
        insertedCount = insertedItems?.length || 0;
        console.log(`Successfully inserted ${insertedCount} pending items`);
      }
    }
    
    // Update document import record
    if (document_import_id) {
      const needsReview = transactions.filter(t => (t.ai_confidence || t.confidence || 0) < 0.7).length;
      
      const { error: updateError } = await supabase
        .from('document_imports')
        .update({
          status: insertedCount > 0 ? (needsReview > 0 ? 'needs_review' : 'completed') : 'failed',
          transactions_found: insertedCount,
          transactions_pending_review: needsReview,
          ai_summary: summary,
          source_type: sourceType,
          processed_at: new Date().toISOString(),
          error_message: insertedCount === 0 ? 'No transactions could be parsed from file' : null
        })
        .eq('id', document_import_id);
        
      if (updateError) {
        console.error('Update error:', JSON.stringify(updateError));
      } else {
        console.log('Document import record updated');
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      transactions_found: insertedCount,
      summary,
      source_type: sourceType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error processing document:', error);
    
    // Try to update the document import status
    try {
      const body = await req.clone().json();
      if (body.document_import_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('document_imports')
          .update({ status: 'failed', error_message: String(error.message || error).substring(0, 500) })
          .eq('id', body.document_import_id);
      }
    } catch (e) {
      console.log('Could not update document import status');
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: String(error.message || error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});



