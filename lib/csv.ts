/**
 * Escapa um valor para CSV.
 *
 * Além do escape estrutural (aspas, vírgulas, quebras de linha), neutraliza CSV
 * formula injection: Excel e Google Sheets executam células iniciadas por
 * `= + - @` (ou tab/CR) como fórmula. Como nomes de lead, metadados de evento e
 * mensagens de erro vêm de payloads de webhook externos, o valor recebe uma
 * aspa simples na frente para ser sempre lido como texto.
 *
 * Envolver a célula em aspas NÃO resolve — o Excel remove as aspas do CSV e
 * ainda assim avalia o conteúdo como fórmula.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  // Números nunca são interpretados como fórmula — preserva o formato numérico
  if (typeof value === 'number') return String(value)

  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Monta uma linha de CSV, escapando cada campo. */
export function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvValue).join(',')
}

/** Monta um CSV completo a partir de uma matriz de linhas. */
export function toCsv(rows: unknown[][]): string {
  return rows.map(toCsvRow).join('\n')
}
