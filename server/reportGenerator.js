const PDFDocument = require('pdfkit');

/**
 * Generates a Daily Warehouse Summary PDF buffer.
 * Includes Warehouse Stock Summary followed by individual 3-page Landscape Challan Reports for every active site!
 * @param {Object} params
 * @param {string} params.date - The date of the report (YYYY-MM-DD)
 * @param {Object} params.models - The DB models dictionary
 */
async function generateDailyWarehouseSummary({ date, models }) {
  const Material   = models.Material;
  const Incoming   = models.Incoming;
  const Outgoing   = models.Outgoing;
  const SiteReturns = models.SiteReturns;
  const RentalSite = models.RentalSite;
  const Site       = models.Site;
  const Labour     = models.Labour;
  const LabourLog  = models.LabourLog;
  const SeparateBilling = models.SeparateBilling;
  const SiteExpenses = models.SiteExpenses;
  const SitePayments = models.SitePayments;

  // 1. Fetch data
  const materials   = await Material.find({ status: { $ne: 'Archived' } });
  const sites       = await Site.find({ status: { $ne: 'Archived' } });
  const allIncoming = await Incoming.find({});
  const allOutgoing = await Outgoing.find({});
  const allReturns  = await SiteReturns.find({});
  const allRentals  = await RentalSite.find({});

  const materialsMap = {};
  materials.forEach(m => { materialsMap[String(m._id || m.id)] = m; });
  const sitesMap = {};
  sites.forEach(s => { sitesMap[String(s._id || s.id)] = s; });

  // ── Pre-fetch Expenses, Payments, Labour & SeparateBilling ──────────
  let allExpenses = [];
  if (SiteExpenses) {
    try { allExpenses = await SiteExpenses.find({}); } catch (e) {}
  }
  let allPayments = [];
  if (SitePayments) {
    try { allPayments = await SitePayments.find({}); } catch (e) {}
  }

  let dayLogs = [];
  let allLabourLogs = [];
  let allLabours = [];
  const laboursMap = {};
  if (LabourLog) {
    try {
      allLabourLogs = await LabourLog.find({});
      dayLogs = allLabourLogs.filter(l => l.date === date);
      if (Labour) {
        allLabours = await Labour.find({ status: { $ne: 'Archived' } });
        allLabours.forEach(l => { laboursMap[String(l._id || l.id)] = l; });
      }
    } catch (e) {}
  }

  let allBills = [];
  if (SeparateBilling) {
    try {
      allBills = await SeparateBilling.find({});
    } catch (e) {}
  }

  // ── Calculate current warehouse stock ──────────────────────────────
  const currentStockMap = {};
  materials.forEach(m => {
    const mId = String(m._id || m.id);
    let purchased = 0, returned = 0, sent = 0, rented = 0;

    allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          const qty = parseFloat(i.quantity) || 0;
          if (r.supplier && r.supplier.toLowerCase().includes('return')) returned += qty;
          else purchased += qty;
        }
      });
    });
    allReturns.forEach(r => {
      if (String(r.materialId) === mId) returned += parseFloat(r.quantity) || 0;
    });
    allOutgoing.forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0;
      });
    });
    allRentals.filter(r => r.status === 'Active').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) rented += parseFloat(i.quantity) || 0;
      });
    });
    currentStockMap[mId] = (purchased + returned) - sent - rented;
  });

  // ── Low stock rows ─────────────────────────────────────────────────
  const lowStockRows = materials.map(m => {
    const mId = String(m._id || m.id);
    const stock = currentStockMap[mId] || 0;
    const reorder = m.reorderLevel || 50;
    if (stock < reorder) {
      return { name: m.name, stock, reorder, deficit: reorder - stock, unit: m.unit || 'Nos', price: m.unitPrice || 0 };
    }
    return null;
  }).filter(Boolean);

  // ── Movements for report date ───────────────────────────────────────
  let totalIn = 0, totalOut = 0;
  const incomingMovements = [];
  const outgoingMovements = [];

  allIncoming.filter(r => r.destinationType === 'warehouse' && r.date === date).forEach(r => {
    (r.items || []).forEach(i => {
      const qty = parseFloat(i.quantity) || 0;
      totalIn += qty;
      const mat = materialsMap[String(i.materialId)];
      incomingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        quantity: qty,
        unit: mat ? mat.unit || 'Nos' : 'Nos',
        source: r.supplier || 'Purchase'
      });
    });
  });

  allReturns.filter(r => r.date === date).forEach(r => {
    const qty = parseFloat(r.quantity) || 0;
    totalIn += qty;
    const mat  = materialsMap[String(r.materialId)];
    const site = sitesMap[String(r.siteId)];
    incomingMovements.push({
      materialName: mat ? mat.name : 'Unknown',
      quantity: qty,
      unit: mat ? mat.unit || 'Nos' : 'Nos',
      source: site ? `Return - ${site.name}` : 'Site Return'
    });
  });

  allOutgoing.filter(r => r.date === date).forEach(r => {
    (r.items || []).forEach(i => {
      const qty = parseFloat(i.quantity) || 0;
      totalOut += qty;
      const mat  = materialsMap[String(i.materialId)];
      const site = sitesMap[String(r.siteId)];
      outgoingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        quantity: qty,
        unit: mat ? mat.unit || 'Nos' : 'Nos',
        destination: site ? site.name : 'Site Dispatch',
        challan: r.referenceNo || r.ticketNo || '-'
      });
    });
  });

  // ── Material Utilization Rows ─────────────────────────────────────
  const utilizationRows = materials.map(m => {
    const mId = String(m._id || m.id);
    let totalSent = 0, totalRet = 0;

    allOutgoing.forEach(r => {
      (r.items || []).forEach(i => { if (String(i.materialId) === mId) totalSent += parseFloat(i.quantity) || 0; });
    });
    allIncoming.filter(r => r.destinationType === 'site').forEach(r => {
      (r.items || []).forEach(i => { if (String(i.materialId) === mId) totalSent += parseFloat(i.quantity) || 0; });
    });
    allReturns.forEach(r => {
      if (String(r.materialId) === mId) totalRet += parseFloat(r.quantity) || 0;
    });

    const activeBalance = totalSent - totalRet;
    if (totalSent > 0 || totalRet > 0) {
      return { name: m.name, unit: m.unit || 'Nos', sent: totalSent, returned: totalRet, active: activeBalance };
    }
    return null;
  }).filter(Boolean);

  const warehouseRows = materials.map(m => {
    const mId = String(m._id || m.id);
    return { name: m.name, qty: currentStockMap[mId] || 0, unit: m.unit || 'Nos' };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ── Format date ────────────────────────────────────────────────────
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateFormatted = new Date(yr, mo - 1, dy).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const fmtDate = d => {
    if (!d) return '-';
    const parts = String(d).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ═══════════════════════════════════════════════════════════════════
  // PDF Generation — Master Document
  // ═══════════════════════════════════════════════════════════════════
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── COLORS ──────────────────────────────────────────────────────
    const C_DARK    = '#0f172a';
    const C_BLUE    = '#0f3c7a';
    const C_ACCENT  = '#2563eb';
    const C_GREEN   = '#15803d';
    const C_RED     = '#b91c1c';
    const C_PURPLE  = '#6b21a8';
    const C_GRAY    = '#64748b';
    const C_LIGHT   = '#f8fafc';
    const C_WHITE   = '#ffffff';
    const C_BORDER  = '#cbd5e1';

    const PW = 535; // usable portrait width

    // ── HELPERS ─────────────────────────────────────────────────────
    let y = 30;
    function checkSpace(neededHeight) {
      if (y + neededHeight > 760) {
        doc.addPage();
        y = 30;
      }
    }

    function sectionTitle(text, color = C_BLUE) {
      checkSpace(40);
      doc.fillColor(color).rect(30, y, PW, 28).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(12);
      doc.text(text, 40, y + 7, { width: PW - 20 });
      y += 28;
    }

    function bigCard(x, yPos, w, h, label, value, bg, valColor) {
      doc.fillColor(bg).rect(x, yPos, w, h).fill();
      doc.strokeColor(C_BORDER).lineWidth(1).rect(x, yPos, w, h).stroke();
      doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(8);
      doc.text(label.toUpperCase(), x + 6, yPos + 6, { width: w - 12 });
      doc.fillColor(valColor).font('Helvetica-Bold').fontSize(16);
      doc.text(value, x + 6, yPos + 20, { width: w - 12 });
    }

    // ── PAGE 1: WAREHOUSE STOCK SUMMARY ──────────────────────────────
    // Brand strip
    doc.fillColor(C_BLUE).rect(30, y, PW, 46).fill();
    doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(18);
    doc.text('KSS Construction Materials', 42, y + 6, { width: PW - 20 });
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(10);
    doc.text('Daily Warehouse Summary & Operations Backup', 42, y + 27, { width: PW - 20 });
    y += 50;

    // Date banner
    doc.fillColor(C_LIGHT).rect(30, y, PW, 24).fill();
    doc.strokeColor(C_BORDER).lineWidth(1).rect(30, y, PW, 24).stroke();
    doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(12);
    doc.text(dateFormatted, 40, y + 6, { width: PW - 20 });
    y += 30;

    // Summary cards
    const cardW = Math.floor(PW / 3) - 4;
    const cardH = 46;
    const cardGap = 6;

    bigCard(30,                  y, cardW, cardH, 'Today Received', `+${totalIn}`,  '#f0fdf4', C_GREEN);
    bigCard(30 + cardW + cardGap, y, cardW, cardH, 'Today Dispatched', `-${totalOut}`, '#fef2f2', C_RED);
    bigCard(30 + (cardW + cardGap) * 2, y, cardW, cardH, 'Net Stock Change', `${totalIn - totalOut >= 0 ? '+' : ''}${totalIn - totalOut}`, '#f0f9ff', C_ACCENT);
    y += cardH + 12;

    // Warehouse Stock Table
    sectionTitle('🏢  Current Warehouse Stock Summary', C_BLUE);
    y += 4;

    if (warehouseRows.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No stock currently in warehouse.', 40, y + 4);
      y += 24;
    } else {
      doc.fillColor(C_DARK).rect(30, y, PW, 22).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(10);
      doc.text('Material Name', 40, y + 6, { width: 280 });
      doc.text('Unit', 320, y + 6, { width: 70, align: 'center' });
      doc.text('Qty in Stock', 390, y + 6, { width: 165, align: 'right' });
      y += 22;

      warehouseRows.forEach((row, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : C_LIGHT;
        doc.fillColor(bg).rect(30, y, PW, 22).fill();

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(11);
        doc.text(row.name, 40, y + 5, { width: 278, lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(10);
        doc.text(row.unit, 320, y + 6, { width: 68, align: 'center', lineBreak: false });

        const qtyColor = row.qty <= 0 ? C_RED : (row.qty < 10 ? '#d97706' : C_GREEN);
        doc.fillColor(qtyColor).font('Helvetica-Bold').fontSize(12);
        doc.text(row.qty.toLocaleString('en-IN'), 390, y + 4, { width: 165, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 22).lineTo(565, y + 22).stroke();
        y += 22;
      });
    }

    if (lowStockRows.length > 0) {
      y += 12;
      sectionTitle('⚠️  Low Stock Alert Items', C_RED);
      y += 4;
      doc.fillColor(C_RED).rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('Material Name', 40, y + 5, { width: 250 });
      doc.text('Current Stock', 290, y + 5, { width: 90, align: 'right' });
      doc.text('Reorder Level', 390, y + 5, { width: 85, align: 'right' });
      doc.text('Deficit', 480, y + 5, { width: 75, align: 'right' });
      y += 20;

      lowStockRows.forEach((row, idx) => {
        checkSpace(22);
        const bg = idx % 2 === 0 ? C_WHITE : '#fef2f2';
        doc.fillColor(bg).rect(30, y, PW, 22).fill();
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10).text(row.name, 40, y + 5, { width: 248, lineBreak: false });
        doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(10).text(`${row.stock} ${row.unit}`, 290, y + 5, { width: 90, align: 'right', lineBreak: false });
        doc.fillColor(C_GRAY).font('Helvetica').fontSize(10).text(`${row.reorder} ${row.unit}`, 390, y + 5, { width: 85, align: 'right', lineBreak: false });
        doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(10).text(`-${row.deficit} ${row.unit}`, 480, y + 5, { width: 75, align: 'right', lineBreak: false });
        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 22).lineTo(565, y + 22).stroke();
        y += 22;
      });
    }

    // ── Calculate Active Rentals Data ─────────────────────────────────
    const activeRentalsData = [];
    allRentals.filter(r => r.status === 'Active').forEach(r => {
      const rentalItems = [];
      (r.items || []).forEach(i => {
        const qty = parseFloat(i.quantity) || 0;
        if (qty > 0) {
          const mat = materialsMap[String(i.materialId)];
          if (mat) {
            rentalItems.push({ name: mat.name, qty, unit: mat.unit || 'Nos' });
          }
        }
      });
      if (rentalItems.length > 0) {
        activeRentalsData.push({ name: r.siteName, customer: r.customerName, goingDate: r.goingDate, items: rentalItems });
      }
    });

    y += 12;

    // ── Active Rental Sites & Materials Section ───────────────────────
    sectionTitle('🔑  Active Rental Sites & Materials', C_BLUE);
    y += 4;

    if (activeRentalsData.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No active rentals currently deployed.', 40, y + 4);
      y += 24;
    } else {
      activeRentalsData.forEach(rental => {
        checkSpace(40);
        const custStr = rental.customer ? ` (${rental.customer})` : '';
        const dateStr = rental.goingDate ? ` — Rented: ${fmtDate(rental.goingDate)}` : '';
        doc.fillColor('#f5f3ff').rect(30, y, PW, 20).fill();
        doc.strokeColor('#ddd6fe').lineWidth(0.5).rect(30, y, PW, 20).stroke();
        doc.fillColor('#6d28d9').font('Helvetica-Bold').fontSize(10);
        doc.text(`${rental.name}${custStr}${dateStr}`, 36, y + 5, { width: PW - 12 });
        y += 20;

        rental.items.forEach((item, idx) => {
          checkSpace(22);
          const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
          doc.fillColor(bg).rect(30, y, PW, 22).fill();

          doc.fillColor(C_DARK).font('Helvetica').fontSize(10);
          doc.text(item.name, 40, y + 5, { width: 300 });

          doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(11);
          doc.text(`${item.qty.toLocaleString('en-IN')} ${item.unit}`, 390, y + 5, { width: 165, align: 'right' });

          doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 22).lineTo(565, y + 22).stroke();
          y += 22;
        });
        y += 6;
      });
    }

    y += 12;

    // ── Stock Movement Section (Today's Transactions) ───────────────
    sectionTitle('🔄  Stock Movement Report (Today\'s Transactions)', C_GREEN);
    y += 4;

    if (incomingMovements.length === 0 && outgoingMovements.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No stock movements recorded for this date.', 40, y + 4);
      y += 24;
    } else {
      // Received
      if (incomingMovements.length > 0) {
        checkSpace(30);
        doc.fillColor('#f0fdf4').rect(30, y, PW, 18).fill();
        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(9);
        doc.text('📥 INCOMING STOCK MOVEMENTS', 36, y + 4);
        y += 18;

        incomingMovements.forEach((row, idx) => {
          checkSpace(22);
          const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
          doc.fillColor(bg).rect(30, y, PW, 22).fill();
          doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10).text(row.materialName, 40, y + 5, { width: 220 });
          doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10).text(`+${row.quantity} ${row.unit}`, 270, y + 5, { width: 90, align: 'right' });
          doc.fillColor(C_GRAY).font('Helvetica').fontSize(9).text(row.source, 370, y + 5, { width: 185 });
          doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 22).lineTo(565, y + 22).stroke();
          y += 22;
        });
      }

      // Dispatched
      if (outgoingMovements.length > 0) {
        checkSpace(30);
        doc.fillColor('#fef2f2').rect(30, y, PW, 18).fill();
        doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(9);
        doc.text('📤 OUTGOING STOCK MOVEMENTS', 36, y + 4);
        y += 18;

        outgoingMovements.forEach((row, idx) => {
          checkSpace(22);
          const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
          doc.fillColor(bg).rect(30, y, PW, 22).fill();
          doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10).text(row.materialName, 40, y + 5, { width: 220 });
          doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(10).text(`-${row.quantity} ${row.unit}`, 270, y + 5, { width: 90, align: 'right' });
          doc.fillColor(C_GRAY).font('Helvetica').fontSize(9).text(`${row.destination}${row.challan !== '-' ? ' (Challan: ' + row.challan + ')' : ''}`, 370, y + 5, { width: 185 });
          doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 22).lineTo(565, y + 22).stroke();
          y += 22;
        });
      }
    }

    y += 12;

    // ── Material Utilization & Deployed Stock Section ────────────────
    sectionTitle('📊  Material Utilization & Site Deployments', '#0284c7');
    y += 4;

    if (utilizationRows.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No material deployments recorded across sites.', 40, y + 4);
      y += 24;
    } else {
      doc.fillColor('#0284c7').rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('Material Name', 40, y + 5, { width: 200 });
      doc.text('Total Sent', 240, y + 5, { width: 90, align: 'right' });
      doc.text('Total Returned', 330, y + 5, { width: 95, align: 'right' });
      doc.text('Active at Sites', 425, y + 5, { width: 130, align: 'right' });
      y += 20;

      utilizationRows.forEach((row, idx) => {
        checkSpace(22);
        const bg = idx % 2 === 0 ? C_WHITE : '#f0f9ff';
        doc.fillColor(bg).rect(30, y, PW, 22).fill();
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10).text(row.name, 40, y + 5, { width: 198, lineBreak: false });
        doc.fillColor(C_DARK).font('Helvetica').fontSize(10).text(`${row.sent.toLocaleString('en-IN')} ${row.unit}`, 240, y + 5, { width: 90, align: 'right', lineBreak: false });
        doc.fillColor(row.returned > 0 ? C_RED : C_GRAY).font('Helvetica').fontSize(10).text(`${row.returned.toLocaleString('en-IN')} ${row.unit}`, 330, y + 5, { width: 95, align: 'right', lineBreak: false });
        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10).text(`${row.active.toLocaleString('en-IN')} ${row.unit}`, 425, y + 5, { width: 130, align: 'right', lineBreak: false });
        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 22).lineTo(565, y + 22).stroke();
        y += 22;
      });
    }

    // ── Detailed Labour Payroll Logs Section ─────────────────────────
    sectionTitle('👷  Labour Attendance & Payroll Log', C_PURPLE);
    y += 4;

    if (dayLogs.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No labour attendance logged for today.', 40, y + 4);
      y += 24;
    } else {
      let presentCount = 0, halfCount = 0, absentCount = 0;
      let totalOtHours = 0, totalOtPay = 0, totalMoneyGiven = 0;

      dayLogs.forEach(l => {
        if (l.attendance === 'Present') presentCount++;
        else if (l.attendance === 'Half Day') halfCount++;
        else if (l.attendance === 'Absent') absentCount++;

        const otH = parseFloat(l.overtimeHours) || 0;
        const dw  = parseFloat(l.dailyWage) || 0;
        totalOtHours += otH;
        totalOtPay += otH > 0 ? (dw / 8) * otH : (parseFloat(l.overtime) || 0);
        totalMoneyGiven += parseFloat(l.moneyGiven) || 0;
      });

      // Overview banner
      doc.fillColor('#f3e8ff').rect(30, y, PW, 22).fill();
      doc.fillColor(C_PURPLE).font('Helvetica-Bold').fontSize(10);
      doc.text(`Present: ${presentCount} | Half Day: ${halfCount} | Absent: ${absentCount} | OT: ${totalOtHours}h (Rs. ${Math.round(totalOtPay)}) | Money Paid: Rs. ${Math.round(totalMoneyGiven)}`, 36, y + 5, { width: PW - 12 });
      y += 22;

      // Table Header
      doc.fillColor(C_PURPLE).rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('Worker Name', 40, y + 5, { width: 140 });
      doc.text('Status', 180, y + 5, { width: 65, align: 'center' });
      doc.text('Wage', 245, y + 5, { width: 55, align: 'right' });
      doc.text('Overtime (Slot)', 305, y + 5, { width: 115 });
      doc.text('OT Pay', 420, y + 5, { width: 55, align: 'right' });
      doc.text('Money Paid', 480, y + 5, { width: 75, align: 'right' });
      y += 20;

      dayLogs.forEach((l, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : '#faf5ff';
        doc.fillColor(bg).rect(30, y, PW, 24).fill();

        const lab = laboursMap[String(l.labourId)] || {};
        const wName = lab.name || 'Worker';
        const nick  = lab.nickname ? ` (${lab.nickname})` : '';
        const dw    = parseFloat(l.dailyWage) || parseFloat(lab.defaultWage) || 0;
        const otH   = parseFloat(l.overtimeHours) || 0;
        const otTime = l.overtimeTime ? ` (${l.overtimeTime})` : '';
        const otStr  = otH > 0 ? `${otH}h${otTime}` : '-';
        const otPay  = otH > 0 ? (dw / 8) * otH : (parseFloat(l.overtime) || 0);
        const mg     = parseFloat(l.moneyGiven) || 0;
        const mgNote = l.notes ? ` (${l.notes})` : '';

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(`${wName}${nick}`, 40, y + 6, { width: 138, lineBreak: false });

        const statusColor = l.attendance === 'Present' ? C_GREEN : (l.attendance === 'Half Day' ? '#d97706' : C_RED);
        doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(9);
        doc.text(l.attendance || 'Present', 180, y + 6, { width: 65, align: 'center', lineBreak: false });

        doc.fillColor(C_DARK).font('Helvetica').fontSize(10);
        doc.text(`Rs.${Math.round(dw)}`, 245, y + 6, { width: 55, align: 'right', lineBreak: false });

        doc.fillColor(C_PURPLE).font('Helvetica').fontSize(9);
        doc.text(otStr, 305, y + 6, { width: 113, lineBreak: false });

        doc.fillColor(C_PURPLE).font('Helvetica-Bold').fontSize(10);
        doc.text(otPay > 0 ? `Rs.${Math.round(otPay)}` : '-', 420, y + 6, { width: 55, align: 'right', lineBreak: false });

        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10);
        doc.text(mg > 0 ? `Rs.${Math.round(mg)}${mgNote}` : '-', 480, y + 6, { width: 75, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 24).lineTo(565, y + 24).stroke();
        y += 24;
      });
    }

    y += 12;

    // ── Master Workforce Payroll Ledger ──────────────────────────────
    sectionTitle('📋  Master Workforce Payroll Ledger', C_PURPLE);
    y += 4;

    if (allLabours.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No workers registered in Labour Master.', 40, y + 4);
      y += 24;
    } else {
      let grandEarned = 0, grandPaid = 0;
      const workerRows = allLabours.map(lab => {
        const id = String(lab._id || lab.id);
        const wLogs = allLabourLogs.filter(l => String(l.labourId) === id);
        let pDays = 0, hDays = 0, gross = 0, otP = 0, paid = 0;

        wLogs.forEach(l => {
          const att = l.attendance === 'Present' ? 1 : (l.attendance === 'Half Day' ? 0.5 : 0);
          if (l.attendance === 'Present') pDays++;
          else if (l.attendance === 'Half Day') hDays++;
          const dw = parseFloat(l.dailyWage) || parseFloat(lab.defaultWage) || 0;
          gross += dw * att;

          const oH = parseFloat(l.overtimeHours) || 0;
          otP += oH > 0 ? (dw / 8) * oH : (parseFloat(l.overtime) || 0);
          paid += parseFloat(l.moneyGiven) || 0;
        });

        const earned = gross + otP;
        const bal = earned - paid;
        grandEarned += earned;
        grandPaid += paid;

        return {
          name: lab.name,
          nickname: lab.nickname ? ` (${lab.nickname})` : '',
          wage: lab.defaultWage || 500,
          daysStr: `${pDays}P ${hDays > 0 ? hDays + 'H' : ''}`,
          earned,
          paid,
          bal
        };
      });

      // Overview banner
      doc.fillColor('#f3e8ff').rect(30, y, PW, 22).fill();
      doc.fillColor(C_PURPLE).font('Helvetica-Bold').fontSize(10);
      doc.text(`Total Workers: ${allLabours.length} | Total Cumulative Earnings: Rs. ${Math.round(grandEarned)} | Total Money Paid: Rs. ${Math.round(grandPaid)} | Net Balance: Rs. ${Math.round(grandEarned - grandPaid)}`, 36, y + 5, { width: PW - 12 });
      y += 22;

      // Table Header
      doc.fillColor(C_PURPLE).rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('Worker Name', 40, y + 5, { width: 160 });
      doc.text('Wage Rate', 200, y + 5, { width: 65, align: 'right' });
      doc.text('Days Worked', 270, y + 5, { width: 75, align: 'center' });
      doc.text('Total Earned', 350, y + 5, { width: 75, align: 'right' });
      doc.text('Money Paid', 430, y + 5, { width: 65, align: 'right' });
      doc.text('Net Balance', 500, y + 5, { width: 55, align: 'right' });
      y += 20;

      workerRows.forEach((row, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : '#faf5ff';
        doc.fillColor(bg).rect(30, y, PW, 24).fill();

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(`${row.name}${row.nickname}`, 40, y + 6, { width: 158, lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(9);
        doc.text(`Rs.${row.wage}`, 200, y + 6, { width: 65, align: 'right', lineBreak: false });

        doc.fillColor(C_DARK).font('Helvetica').fontSize(9);
        doc.text(row.daysStr, 270, y + 6, { width: 75, align: 'center', lineBreak: false });

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(`Rs.${Math.round(row.earned)}`, 350, y + 6, { width: 75, align: 'right', lineBreak: false });

        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10);
        doc.text(`Rs.${Math.round(row.paid)}`, 430, y + 6, { width: 65, align: 'right', lineBreak: false });

        const balColor = row.bal >= 0 ? C_RED : C_GREEN;
        const balLabel = row.bal >= 0 ? `Rs.${Math.round(row.bal)} Pay` : `Rs.${Math.round(Math.abs(row.bal))} Adv`;
        doc.fillColor(balColor).font('Helvetica-Bold').fontSize(9);
        doc.text(balLabel, 500, y + 6, { width: 55, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 24).lineTo(565, y + 24).stroke();
        y += 24;
      });
    }

    y += 12;

    // ── Detailed Measurement Bills Statement Section ──────────────────
    sectionTitle('📐  Separate Measurement Bills Statement', '#0f3c7a');
    y += 4;

    if (allBills.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No measurement bills recorded.', 40, y + 4);
      y += 24;
    } else {
      let totalNetArea = 0, totalBillAmt = 0, totalReceivedAmt = 0;
      allBills.forEach(b => {
        totalNetArea += parseFloat(b.netArea || b.totalArea) || 0;
        totalBillAmt += parseFloat(b.totalAmount) || 0;
        totalReceivedAmt += parseFloat(b.receivedAmount) || 0;
      });

      doc.fillColor('#f0f9ff').rect(30, y, PW, 22).fill();
      doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(10);
      doc.text(`Total Bills: ${allBills.length} | Net Area: ${Math.round(totalNetArea)} Sq Ft | Amount: Rs. ${Math.round(totalBillAmt)} | Received: Rs. ${Math.round(totalReceivedAmt)}`, 36, y + 5, { width: PW - 12 });
      y += 22;

      doc.fillColor('#0f3c7a').rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('Site / Bill Name', 40, y + 5, { width: 140 });
      doc.text('Contractor & Owner', 180, y + 5, { width: 130 });
      doc.text('Net Area', 310, y + 5, { width: 75, align: 'right' });
      doc.text('Total Amount', 385, y + 5, { width: 80, align: 'right' });
      doc.text('Received Payments', 465, y + 5, { width: 90, align: 'right' });
      y += 20;

      allBills.forEach((b, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
        doc.fillColor(bg).rect(30, y, PW, 24).fill();

        const sName  = b.siteName || 'Bill';
        const cName  = b.contractorName || 'Contractor';
        const oName  = b.ownerName ? ` (${b.ownerName})` : '';
        const netA   = parseFloat(b.netArea || b.totalArea) || 0;
        const totA   = parseFloat(b.totalAmount) || 0;
        const recA   = parseFloat(b.receivedAmount) || 0;

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(sName, 40, y + 6, { width: 138, lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(9);
        doc.text(`${cName}${oName}`, 180, y + 6, { width: 128, lineBreak: false });

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(`${Math.round(netA)} Sq Ft`, 310, y + 6, { width: 75, align: 'right', lineBreak: false });

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(totA > 0 ? `Rs.${Math.round(totA)}` : '-', 385, y + 6, { width: 80, align: 'right', lineBreak: false });

        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10);
        doc.text(recA > 0 ? `Rs.${Math.round(recA)}` : '-', 465, y + 6, { width: 90, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 24).lineTo(565, y + 24).stroke();
        y += 24;
      });
    }

    y += 12;

    // ── Detailed Site Financial Expenses & Payments Section ─────────────
    sectionTitle('💰  Site Expenses & Financial Statement', '#15803d');
    y += 4;

    if (sites.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No active sites recorded.', 40, y + 4);
      y += 24;
    } else {
      let grandExp = 0, grandPay = 0;
      sites.forEach(s => {
        const sId = String(s._id || s.id);
        allExpenses.filter(e => String(e.siteId) === sId).forEach(e => { grandExp += parseFloat(e.amount) || 0; });
        allPayments.filter(p => String(p.siteId) === sId).forEach(p => { grandPay += parseFloat(p.amount) || 0; });
      });

      doc.fillColor('#f0fdf4').rect(30, y, PW, 22).fill();
      doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(10);
      doc.text(`Active Sites: ${sites.length} | Total Expenses: Rs. ${Math.round(grandExp)} | Total Payments Received: Rs. ${Math.round(grandPay)}`, 36, y + 5, { width: PW - 12 });
      y += 22;

      doc.fillColor('#15803d').rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('Site Name', 40, y + 5, { width: 180 });
      doc.text('Customer', 220, y + 5, { width: 140 });
      doc.text('Total Expenses', 360, y + 5, { width: 95, align: 'right' });
      doc.text('Payments Recd.', 460, y + 5, { width: 95, align: 'right' });
      y += 20;

      sites.forEach((s, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
        doc.fillColor(bg).rect(30, y, PW, 24).fill();

        const sId = String(s._id || s.id);
        const sExp = allExpenses.filter(e => String(e.siteId) === sId).reduce((tot, e) => tot + (parseFloat(e.amount) || 0), 0);
        const sPay = allPayments.filter(p => String(p.siteId) === sId).reduce((tot, p) => tot + (parseFloat(p.amount) || 0), 0);

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(s.name, 40, y + 6, { width: 178, lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(9);
        doc.text(s.customerName || '-', 220, y + 6, { width: 138, lineBreak: false });

        doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(10);
        doc.text(sExp > 0 ? `Rs.${Math.round(sExp)}` : '-', 360, y + 6, { width: 95, align: 'right', lineBreak: false });

        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10);
        doc.text(sPay > 0 ? `Rs.${Math.round(sPay)}` : '-', 460, y + 6, { width: 95, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 24).lineTo(565, y + 24).stroke();
        y += 24;
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // LANDSCAPE PAGES FOR EVERY ACTIVE SITE (3 PAGES PER SITE)
    // ═══════════════════════════════════════════════════════════════════

    function drawSiteHeader(site, sectionTitleText) {
      doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(16);
      doc.text('KSS — Material Delivery Challan', 20, 20, { width: 801.89, align: 'center' });

      doc.fontSize(10).font('Helvetica');
      doc.text(`No. `, 20, 42, { continued: true });
      doc.font('Helvetica-Bold').text(site.tokenNumber || '-', { continued: true });
      doc.font('Helvetica').text(`                              Dated `, { continued: true });
      doc.font('Helvetica-Bold').text(todayStr);

      doc.font('Helvetica').text(`To Owner / Contractor: `, 20, 58, { continued: true });
      doc.font('Helvetica-Bold').text(site.customerName || '-');

      doc.font('Helvetica').text(`Site: `, 20, 74, { continued: true });
      doc.font('Helvetica-Bold').text(`${site.name}${site.address ? ', ' + site.address : ''}`, { continued: true });
      doc.font('Helvetica').text(`               Lintel Date: `, { continued: true });
      doc.font('Helvetica-Bold').text(site.lintelDate ? fmtDate(site.lintelDate) : '-');

      doc.strokeColor(C_BORDER).lineWidth(1).moveTo(20, 92).lineTo(821.89, 92).stroke();

      doc.fillColor(C_BLUE).rect(20, 98, 801.89, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(11);
      doc.text(sectionTitleText, 26, 103);
    }

    function drawChallanTable(matList, rowKeys, dataMap) {
      let tableY = 124;
      const colDateW = 90;
      const colSignW = 50;
      const remainingW = 801.89 - colDateW - colSignW;
      const colMatW = matList.length > 0 ? Math.max(45, Math.min(75, remainingW / matList.length)) : 100;

      doc.fillColor('#e8edf2').rect(20, tableY, 801.89, 24).fill();
      doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 24).stroke();

      doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(9);
      doc.text('Date / Ref', 24, tableY + 7, { width: colDateW - 8 });

      matList.forEach((m, idx) => {
        const xPos = 20 + colDateW + idx * colMatW;
        doc.text(`${m.name}\n(${m.unit || 'Nos'})`, xPos + 2, tableY + 3, { width: colMatW - 4, align: 'center', fontSize: 8 });
      });

      doc.text('Sign.', 20 + colDateW + matList.length * colMatW + 4, tableY + 7, { width: colSignW - 8, align: 'center' });

      tableY += 24;

      if (rowKeys.length === 0) {
        for (let r = 0; r < 5; r++) {
          const bg = r % 2 === 0 ? C_WHITE : C_LIGHT;
          doc.fillColor(bg).rect(20, tableY, 801.89, 22).fill();
          doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 22).stroke();
          tableY += 22;
        }
      } else {
        rowKeys.forEach((key, rIdx) => {
          const rowData = dataMap[key] || {};
          const bg = rIdx % 2 === 0 ? C_WHITE : C_LIGHT;
          doc.fillColor(bg).rect(20, tableY, 801.89, 22).fill();
          doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 22).stroke();

          doc.fillColor(C_DARK).font('Helvetica').fontSize(9);
          doc.text(`${fmtDate(rowData.date)}${rowData.ref ? ' (' + rowData.ref + ')' : ''}`, 24, tableY + 5, { width: colDateW - 8, lineBreak: false });

          matList.forEach((m, mIdx) => {
            const xPos = 20 + colDateW + mIdx * colMatW;
            const qty = rowData[m.id || m._id] || 0;
            if (qty > 0) {
              doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
              doc.text(String(qty), xPos + 2, tableY + 5, { width: colMatW - 4, align: 'center', lineBreak: false });
            }
          });

          tableY += 22;
        });
      }
    }

    function drawSiteInventorySummaryTable(summaryMats, site) {
      let tableY = 124;
      const col1W = 250;
      const col2W = 170;
      const col3W = 170;
      const col4W = 211.89;

      doc.fillColor('#e8edf2').rect(20, tableY, 801.89, 24).fill();
      doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 24).stroke();

      doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
      doc.text('Material Name', 26, tableY + 7, { width: col1W });
      doc.text('Total Received (In)', 20 + col1W + 10, tableY + 7, { width: col2W - 20, align: 'right' });
      doc.text('Total Returned (Out)', 20 + col1W + col2W + 10, tableY + 7, { width: col3W - 20, align: 'right' });
      doc.fillColor(C_GREEN);
      doc.text('Net Balance at Site', 20 + col1W + col2W + col3W + 10, tableY + 7, { width: col4W - 20, align: 'right' });

      tableY += 24;

      const sId = String(site._id || site.id);
      const siteOutgoing = allOutgoing.filter(r => String(r.siteId) === sId);
      const siteIncomingDirect = allIncoming.filter(r => r.destinationType === 'site' && String(r.destinationSiteId) === sId);
      const siteReturns = allReturns.filter(r => String(r.siteId) === sId);

      if (summaryMats.length === 0) {
        doc.fillColor(C_WHITE).rect(20, tableY, 801.89, 24).fill();
        doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 24).stroke();
        doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(10);
        doc.text('No material transaction records found for this site.', 26, tableY + 7);
        tableY += 24;
      } else {
        summaryMats.forEach((m, idx) => {
          const mId = String(m._id || m.id);
          let sent = 0, ret = 0;
          siteOutgoing.forEach(r => (r.items || []).forEach(i => { if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0; }));
          siteIncomingDirect.forEach(r => (r.items || []).forEach(i => { if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0; }));
          siteReturns.forEach(r => { if (String(r.materialId) === mId) ret += parseFloat(r.quantity) || 0; });
          const net = sent - ret;

          const bg = idx % 2 === 0 ? C_WHITE : C_LIGHT;
          doc.fillColor(bg).rect(20, tableY, 801.89, 22).fill();
          doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 22).stroke();

          doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
          doc.text(m.name, 26, tableY + 5, { width: col1W });

          doc.fillColor(C_DARK).font('Helvetica').fontSize(10);
          doc.text(`${sent.toLocaleString('en-IN')} ${m.unit || 'Nos'}`, 20 + col1W + 10, tableY + 5, { width: col2W - 20, align: 'right' });

          doc.fillColor(ret > 0 ? C_RED : C_GRAY).font('Helvetica').fontSize(10);
          doc.text(ret > 0 ? `-${ret.toLocaleString('en-IN')} ${m.unit || 'Nos'}` : `0 ${m.unit || 'Nos'}`, 20 + col1W + col2W + 10, tableY + 5, { width: col3W - 20, align: 'right' });

          doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10);
          doc.text(`${net.toLocaleString('en-IN')} ${m.unit || 'Nos'}`, 20 + col1W + col2W + col3W + 10, tableY + 5, { width: col4W - 20, align: 'right' });

          tableY += 22;
        });
      }

      // Labour Summary
      const sLogs = allLabourLogs.filter(l => String(l.siteId) === sId);
      if (sLogs.length > 0) {
        let pres = 0, half = 0, abs = 0, otH = 0, otP = 0, mg = 0;
        sLogs.forEach(l => {
          if (l.attendance === 'Present') pres++;
          else if (l.attendance === 'Half Day') half++;
          else if (l.attendance === 'Absent') abs++;
          const oH = parseFloat(l.overtimeHours) || 0;
          const dw = parseFloat(l.dailyWage) || 0;
          otH += oH;
          otP += oH > 0 ? (dw / 8) * oH : (parseFloat(l.overtime) || 0);
          mg += parseFloat(l.moneyGiven) || 0;
        });

        tableY += 10;
        doc.fillColor('#f8fafc').rect(20, tableY, 801.89, 24).fill();
        doc.strokeColor(C_BORDER).lineWidth(0.5).rect(20, tableY, 801.89, 24).stroke();
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(9);
        doc.text(`👷 Site Labour Log Summary: ${pres} Present, ${half} Half Day, ${abs} Absent  |  Overtime: ${otH} hrs (Rs. ${Math.round(otP)})  |  Total Disbursed: Rs. ${Math.round(mg)}`, 26, tableY + 7);
      }
    }

    // Loop over every site and render landscape reports ONLY for sites with actual data
    sites.forEach(site => {
      const sId = String(site._id || site.id);
      const siteOutgoing = allOutgoing.filter(r => String(r.siteId) === sId);
      const siteIncomingDirect = allIncoming.filter(r => r.destinationType === 'site' && String(r.destinationSiteId) === sId);
      const siteReturns = allReturns.filter(r => String(r.siteId) === sId);

      const dispatchMap = {};
      const returnMap = {};
      const dispatchedMatIds = new Set();
      const returnedMatIds = new Set();

      siteOutgoing.forEach((record, index) => {
        (record.items || []).forEach(item => {
          const matId = String(item.materialId);
          if (!matId || !materialsMap[matId]) return;
          dispatchedMatIds.add(matId);
          const rowKey = String(record._id || record.id || (record.date + '-out-' + index));
          dispatchMap[rowKey] = dispatchMap[rowKey] || { date: record.date, ref: record.referenceNo || record.ticketNo || '-' };
          dispatchMap[rowKey][matId] = (dispatchMap[rowKey][matId] || 0) + (parseFloat(item.quantity) || 0);
        });
      });

      siteIncomingDirect.forEach((record, index) => {
        (record.items || []).forEach(item => {
          const matId = String(item.materialId);
          if (!matId || !materialsMap[matId]) return;
          dispatchedMatIds.add(matId);
          const rowKey = String(record._id || record.id || (record.date + '-inc-' + index));
          dispatchMap[rowKey] = dispatchMap[rowKey] || { date: record.date, ref: record.referenceNo || record.invoiceNo || 'Direct' };
          dispatchMap[rowKey][matId] = (dispatchMap[rowKey][matId] || 0) + (parseFloat(item.quantity) || 0);
        });
      });

      siteReturns.forEach((record, index) => {
        const matId = String(record.materialId);
        if (!matId || !materialsMap[matId]) return;
        returnedMatIds.add(matId);
        const rowKey = String(record._id || record.id || (record.date + '-ret-' + index));
        returnMap[rowKey] = returnMap[rowKey] || { date: record.date, ref: 'SITE-RETURN' };
        returnMap[rowKey][matId] = (returnMap[rowKey][matId] || 0) + (parseFloat(record.quantity) || 0);
      });

      const dispatchMats = [...dispatchedMatIds].map(id => materialsMap[id]).filter(Boolean);
      const returnMats   = [...returnedMatIds].map(id => materialsMap[id]).filter(Boolean);

      const dispatchRowKeys = Object.keys(dispatchMap).sort((a, b) => new Date(dispatchMap[a].date) - new Date(dispatchMap[b].date));
      const returnRowKeys   = Object.keys(returnMap).sort((a, b) => new Date(returnMap[a].date) - new Date(returnMap[b].date));

      const summaryMats = materials.filter(m => {
        const mId = String(m._id || m.id);
        let sent = 0, ret = 0;
        siteOutgoing.forEach(r => (r.items || []).forEach(i => { if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0; }));
        siteIncomingDirect.forEach(r => (r.items || []).forEach(i => { if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0; }));
        siteReturns.forEach(r => { if (String(r.materialId) === mId) ret += parseFloat(r.quantity) || 0; });
        return sent > 0 || ret > 0;
      });

      // SKIP completely empty sites without any transactions or active materials
      const sLogs = allLabourLogs.filter(l => String(l.siteId) === sId);
      if (dispatchRowKeys.length === 0 && returnRowKeys.length === 0 && summaryMats.length === 0 && sLogs.length === 0) {
        return;
      }

      // PAGE 1: RECEIVED (CHALLAN IN) — only render if there are received dispatches
      if (dispatchRowKeys.length > 0 || dispatchMats.length > 0) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        drawSiteHeader(site, 'Material Received at Site');
        drawChallanTable(dispatchMats, dispatchRowKeys, dispatchMap);
        doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(11).text('CHALLAN (IN)', 700, 545, { width: 121, align: 'right' });
      }

      // PAGE 2: RETURNED (CHALLAN RETURN) — only render if site actually has returned items!
      if (returnRowKeys.length > 0 || returnMats.length > 0) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        drawSiteHeader(site, 'Material Returned from Site');
        drawChallanTable(returnMats, returnRowKeys, returnMap);
        doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(11).text('CHALLAN (RETURN)', 700, 545, { width: 121, align: 'right' });
      }

      // PAGE 3: INVENTORY SUMMARY (NET BALANCE) — render if site has summary materials or site labour logs
      if (summaryMats.length > 0 || sLogs.length > 0) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        drawSiteHeader(site, 'Material Inventory Summary (Net Balance at Site)');
        drawSiteInventorySummaryTable(summaryMats, site);
        doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(11).text('INVENTORY SUMMARY', 700, 545, { width: 121, align: 'right' });
      }
    });

    // ── DYNAMIC PAGE FOOTERS ──────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      const isLandscape = doc.page.layout === 'landscape';
      const footerY = isLandscape ? 565 : 815;
      const footerW = isLandscape ? 801.89 : 535;
      const marginX = isLandscape ? 20 : 30;

      doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(marginX, footerY).lineTo(marginX + footerW, footerY).stroke();
      doc.fillColor(C_GRAY).font('Helvetica').fontSize(9);
      doc.text('KSS Inventory & Operations Backup Statement', marginX, footerY + 5, { width: 350 });
      doc.text(`Page ${i + 1} of ${range.count}`, marginX + footerW - 185, footerY + 5, { width: 185, align: 'right' });
    }

    doc.end();
  });
}

module.exports = { generateDailyWarehouseSummary };
