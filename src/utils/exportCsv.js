/**
 * Export array of rows to CSV and trigger browser download
 * Uses UTF-8 BOM so Lao, Thai, and Vietnamese characters open cleanly in Excel
 */
export function exportToCsv(filename, headers, rows) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(h => escapeCell(h.label)).join(',');
  const rowLines = rows.map(row =>
    headers.map(h => escapeCell(typeof h.accessor === 'function' ? h.accessor(row) : row[h.accessor])).join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
