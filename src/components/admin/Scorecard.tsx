import { useRef } from 'react';

export function Scorecard() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Crokinole Match Scorecards</title>
          <style>
            @page {
              size: landscape;
              margin: 0.25in;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Arial', sans-serif;
              background: white;
              color: black;
            }

            .page {
              width: 100%;
              height: 100vh;
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: 1fr 1fr;
              gap: 8px;
              padding: 8px;
              page-break-after: always;
            }

            .page:last-child {
              page-break-after: avoid;
            }

            .scorecard {
              border: 2px solid #333;
              padding: 6px;
              background: white;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }

            .header {
              text-align: center;
              border-bottom: 1px solid #333;
              padding-bottom: 3px;
              margin-bottom: 4px;
            }

            .header h1 {
              font-size: 11px;
              font-weight: bold;
            }

            .teams-section {
              display: flex;
              gap: 6px;
              margin-bottom: 4px;
            }

            .team-box {
              flex: 1;
              border: 1px solid #999;
              padding: 3px 5px;
            }

            .team-box label {
              font-size: 7px;
              font-weight: bold;
              text-transform: uppercase;
              color: #666;
              display: block;
            }

            .team-box .write-line {
              border-bottom: 1px solid #333;
              height: 12px;
            }

            .board-box {
              border: 1px solid #999;
              padding: 3px 5px;
              text-align: center;
              width: 45px;
            }

            .board-box label {
              font-size: 7px;
              font-weight: bold;
              text-transform: uppercase;
              color: #666;
              display: block;
            }

            .board-box .write-line {
              border-bottom: 1px solid #333;
              height: 12px;
            }

            .scoring-guide {
              background: #f0f0f0;
              border: 1px solid #ccc;
              padding: 2px 4px;
              margin-bottom: 4px;
              font-size: 7px;
              text-align: center;
            }

            .rounds-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 4px;
              flex: 1;
            }

            .rounds-table th,
            .rounds-table td {
              border: 1px solid #333;
              padding: 2px;
              text-align: center;
              font-size: 8px;
            }

            .rounds-table th {
              background: #333;
              color: white;
              font-size: 7px;
              font-weight: bold;
            }

            .rounds-table td {
              height: 16px;
            }

            .rounds-table .team-header {
              background: #555;
              color: white;
              text-align: left;
              padding-left: 4px;
              font-weight: bold;
              font-size: 8px;
              height: 14px;
            }

            .rounds-table .row-label {
              text-align: left;
              padding-left: 4px;
              font-weight: bold;
              font-size: 7px;
              background: #f5f5f5;
              width: 25%;
            }

            .rounds-table .row-label.twenties-label {
              background: #fff3cd;
            }

            .rounds-table .total-col {
              background: #e0e0e0;
              font-weight: bold;
            }

            .rounds-table .twenties-row td {
              background: #fffbe6;
            }

            .rounds-table .twenties-row .total-col {
              background: #ffe066;
            }

            .rounds-table .spacer-row td {
              height: 4px;
              background: white;
              border-left: none;
              border-right: none;
            }

            .totals-check {
              display: flex;
              justify-content: center;
              gap: 10px;
              padding: 3px;
              background: #e8e8e8;
              border: 1px solid #999;
              margin-bottom: 3px;
              font-size: 7px;
            }

            .footer {
              display: flex;
              justify-content: space-between;
              font-size: 7px;
              color: #666;
              padding-top: 2px;
              border-top: 1px solid #ddd;
            }

            .signature-line {
              border-bottom: 1px solid #333;
              width: 70px;
              display: inline-block;
              margin-left: 3px;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${generatePages(8)}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div>
      <button
        onClick={handlePrint}
        className="btn btn-secondary flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
        </svg>
        Print Scorecards
      </button>

      <div ref={printRef} style={{ display: 'none' }} />
    </div>
  );
}

function generatePages(totalCards: number): string {
  const cardsPerPage = 4;
  const numPages = Math.ceil(totalCards / cardsPerPage);
  let html = '';

  for (let page = 0; page < numPages; page++) {
    html += '<div class="page">';
    for (let i = 0; i < cardsPerPage; i++) {
      const cardNum = page * cardsPerPage + i;
      if (cardNum < totalCards) {
        html += generateScorecard();
      }
    }
    html += '</div>';
  }

  return html;
}

function generateScorecard(): string {
  return `
    <div class="scorecard">
      <div class="header">
        <h1>CROKINOLE MATCH SCORECARD</h1>
      </div>

      <div class="teams-section">
        <div class="team-box">
          <label>Team A</label>
          <div class="write-line"></div>
          <div class="write-line"></div>
        </div>
        <div class="board-box">
          <label>Board</label>
          <div class="write-line"></div>
        </div>
        <div class="team-box">
          <label>Team B</label>
          <div class="write-line"></div>
          <div class="write-line"></div>
        </div>
      </div>

      <div class="scoring-guide">
        <strong>Win = 2</strong> | <strong>Tie = 1</strong> | <strong>Loss = 0</strong> | 4 rounds = 8 total pts
      </div>

      <table class="rounds-table">
        <thead>
          <tr>
            <th></th>
            <th>R1</th>
            <th>R2</th>
            <th>R3</th>
            <th>R4</th>
            <th class="total-col">TOT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="team-header" colspan="6">TEAM A</td>
          </tr>
          <tr>
            <td class="row-label">Points</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="total-col"></td>
          </tr>
          <tr class="twenties-row">
            <td class="row-label twenties-label">20s</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="total-col"></td>
          </tr>
          <tr class="spacer-row"><td colspan="6"></td></tr>
          <tr>
            <td class="team-header" colspan="6">TEAM B</td>
          </tr>
          <tr>
            <td class="row-label">Points</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="total-col"></td>
          </tr>
          <tr class="twenties-row">
            <td class="row-label twenties-label">20s</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="total-col"></td>
          </tr>
        </tbody>
      </table>

      <div class="totals-check">
        <span>Point totals must = <strong>8</strong></span>
        <span>|</span>
        <span>Circle winner or <strong>TIE</strong></span>
      </div>

      <div class="footer">
        <span>Submitted: <span class="signature-line"></span></span>
        <span>Verified: <span class="signature-line"></span></span>
      </div>
    </div>
  `;
}
