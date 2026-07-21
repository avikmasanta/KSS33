const PDFDocument = require('pdfkit');

/**
 * Generates a Daily Warehouse Summary PDF buffer.
 * Mobile-friendly: large fonts, clean layout, easy for elderly readers.
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
  const sites       = await Site.find({ status: 'Active' });
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

  // ── Filter today's movements ────────────────────────────────────────
  const incomingMovements = [];
  const outgoingMovements = [];

  allIncoming.filter(r => r.destinationType === 'warehouse' && r.date === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      incomingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        quantity: parseFloat(i.quantity) || 0,
        unit: mat ? mat.unit || 'Nos' : 'Nos',
        source: 'Purchase'
      });
    });
  });
  allReturns.filter(r => r.date === date).forEach(r => {
    const mat  = materialsMap[String(r.materialId)];
    const site = sitesMap[String(r.siteId)];
    incomingMovements.push({
      materialName: mat ? mat.name : 'Unknown',
      quantity: parseFloat(r.quantity) || 0,
      unit: mat ? mat.unit || 'Nos' : 'Nos',
      source: site ? `Return - ${site.name}` : 'Site Return'
    });
  });
  allRentals.filter(r => r.status === 'Returned' && r.comingDate === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      incomingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        quantity: parseFloat(i.quantity) || 0,
        unit: mat ? mat.unit || 'Nos' : 'Nos',
        source: `Rental Return - ${r.customerName}`
      });
    });
  });

  allOutgoing.filter(r => r.date === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat  = materialsMap[String(i.materialId)];
      const site = sitesMap[String(r.siteId)];
      outgoingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        quantity: parseFloat(i.quantity) || 0,
        unit: mat ? mat.unit || 'Nos' : 'Nos',
        destination: site ? site.name : 'Unknown Site',
        challan: r.ticketNo || r.referenceNo || '-'
      });
    });
  });
  allRentals.filter(r => r.goingDate === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      outgoingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        quantity: parseFloat(i.quantity) || 0,
        unit: mat ? mat.unit || 'Nos' : 'Nos',
        destination: `${r.customerName} (Rental)`,
        challan: '-'
      });
    });
  });

  // ── Calculate Active Site Materials ────────────────────────────────
  const activeSitesData = [];
  for (const s of sites) {
    const siteItems = [];
    materials.forEach(m => {
      const mId = String(m._id || m.id);
      let sent = 0;
      let returned = 0;

      allOutgoing.filter(r => String(r.siteId) === String(s._id || s.id)).forEach(r => {
        (r.items || []).forEach(i => {
          if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0;
        });
      });

      allReturns.filter(r => String(r.siteId) === String(s._id || s.id)).forEach(r => {
        if (String(r.materialId) === mId) returned += parseFloat(r.quantity) || 0;
      });

      const balance = sent - returned;
      if (balance > 0) {
        siteItems.push({ name: m.name, qty: balance, unit: m.unit || 'Nos' });
      }
    });

    if (siteItems.length > 0) {
      activeSitesData.push({ name: s.name, customer: s.customerName, items: siteItems });
    }
  }

  // ── Calculate Active Rentals ───────────────────────────────────────
  const activeRentalsData = [];
  allRentals.filter(r => r.status === 'Active').forEach(r => {
    const rentalItems = [];
    (r.items || []).forEach(i => {
      const qty = parseFloat(i.quantity) || 0;
      if (qty > 0) {
        const mat = materials.find(m => String(m._id || m.id) === String(i.materialId));
        if (mat) {
          rentalItems.push({ name: mat.name, qty, unit: mat.unit || 'Nos' });
        }
      }
    });

    if (rentalItems.length > 0) {
      activeRentalsData.push({ name: r.siteName, customer: r.customerName, items: rentalItems });
    }
  });

  // ── Summary numbers ────────────────────────────────────────────────
  const totalIn  = incomingMovements.reduce((s, m) => s + m.quantity, 0);
  const totalOut = outgoingMovements.reduce((s, m) => s + m.quantity, 0);

  // ── Warehouse rows ─────────────────────────────────────────────────
  const warehouseRows = materials.map(m => {
    const mId = String(m._id || m.id);
    return { name: m.name, unit: m.unit || 'Nos', qty: currentStockMap[mId] || 0 };
  })
  .filter(r => r.qty > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

  // ── Format date ────────────────────────────────────────────────────
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateFormatted = new Date(yr, mo - 1, dy).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // ── Pre-fetch Labour & SeparateBilling ─────────────────────────────
  let dayLogs = [];
  const laboursMap = {};
  if (LabourLog) {
    try {
      dayLogs = await LabourLog.find({ date });
      if (Labour) {
        const labours = await Labour.find({});
        labours.forEach(l => { laboursMap[String(l._id || l.id)] = l; });
      }
    } catch (e) {}
  }

  let allBills = [];
  if (SeparateBilling) {
    try {
      allBills = await SeparateBilling.find({});
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════
  // PDF Generation — Dynamic Flow (No Forced Blank Pages)
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

    const PW = 535; // usable page width (595 - 2*30)

    // ── HELPERS ─────────────────────────────────────────────────────
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

    // ── PAGE 1: HEADER & OVERVIEW ────────────────────────────────────
    let y = 30;

    // Brand strip
    doc.fillColor(C_BLUE).rect(30, y, PW, 46).fill();
    doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(18);
    doc.text('KSS Construction Materials', 42, y + 6, { width: PW - 20 });
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(10);
    doc.text('Daily Operations & Inventory Backup Statement', 42, y + 27, { width: PW - 20 });
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

    // ── Warehouse Stock Section ──────────────────────────────────────
    sectionTitle('🏢  Current Warehouse Stock', C_BLUE);
    y += 4;

    if (warehouseRows.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No stock currently in warehouse.', 40, y + 4);
      y += 24;
    } else {
      // Header
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

    y += 12;

    // ── Active Sites Stock Section ───────────────────────────────────
    sectionTitle('📍  Active Sites Inventory', C_ACCENT);
    y += 4;

    if (activeSitesData.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No materials currently deployed at active sites.', 40, y + 4);
      y += 24;
    } else {
      activeSitesData.forEach(site => {
        checkSpace(40);
        const custStr = site.customer ? ` (${site.customer})` : '';
        doc.fillColor('#eff6ff').rect(30, y, PW, 20).fill();
        doc.strokeColor('#bfdbfe').lineWidth(0.5).rect(30, y, PW, 20).stroke();
        doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(10);
        doc.text(`${site.name}${custStr}`, 36, y + 5, { width: PW - 12 });
        y += 20;

        site.items.forEach((item, idx) => {
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

    // ── Active Rentals Section ───────────────────────────────────────
    sectionTitle('🔑  Active Rental Materials', C_BLUE);
    y += 4;

    if (activeRentalsData.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('No active rentals currently deployed.', 40, y + 4);
      y += 24;
    } else {
      activeRentalsData.forEach(rental => {
        checkSpace(40);
        const custStr = rental.customer ? ` (${rental.customer})` : '';
        doc.fillColor('#f5f3ff').rect(30, y, PW, 20).fill();
        doc.strokeColor('#ddd6fe').lineWidth(0.5).rect(30, y, PW, 20).stroke();
        doc.fillColor('#6d28d9').font('Helvetica-Bold').fontSize(10);
        doc.text(`${rental.name}${custStr}`, 36, y + 5, { width: PW - 12 });
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

    // ── Today's Material Movements ───────────────────────────────────
    sectionTitle('📥  Today\'s Received Materials', C_GREEN);
    y += 4;

    if (incomingMovements.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('Nothing received today.', 40, y + 4);
      y += 24;
    } else {
      doc.fillColor(C_GREEN).rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(10);
      doc.text('Material Name', 40, y + 5, { width: 240 });
      doc.text('Qty', 280, y + 5, { width: 80, align: 'right' });
      doc.text('Source', 370, y + 5, { width: 185 });
      y += 20;

      incomingMovements.forEach((row, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : '#f0fdf4';
        doc.fillColor(bg).rect(30, y, PW, 24).fill();

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(row.materialName, 40, y + 6, { width: 238, lineBreak: false });

        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(11);
        doc.text(`+${row.quantity}`, 280, y + 5, { width: 80, align: 'right', lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(10);
        doc.text(row.source, 370, y + 6, { width: 185, lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 24).lineTo(565, y + 24).stroke();
        y += 24;
      });
    }

    y += 12;

    sectionTitle('📤  Today\'s Dispatched Materials', C_RED);
    y += 4;

    if (outgoingMovements.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(11);
      doc.text('Nothing dispatched today.', 40, y + 4);
      y += 24;
    } else {
      doc.fillColor(C_RED).rect(30, y, PW, 20).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(10);
      doc.text('Material Name', 40, y + 5, { width: 200 });
      doc.text('Qty', 240, y + 5, { width: 70, align: 'right' });
      doc.text('Destination Site', 320, y + 5, { width: 160 });
      doc.text('Challan', 485, y + 5, { width: 70, align: 'right' });
      y += 20;

      outgoingMovements.forEach((row, idx) => {
        checkSpace(24);
        const bg = idx % 2 === 0 ? C_WHITE : '#fef2f2';
        doc.fillColor(bg).rect(30, y, PW, 24).fill();

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(row.materialName, 40, y + 6, { width: 198, lineBreak: false });

        doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(11);
        doc.text(`-${row.quantity}`, 240, y + 5, { width: 70, align: 'right', lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(10);
        doc.text(row.destination, 320, y + 6, { width: 158, lineBreak: false });
        doc.text(row.challan, 485, y + 6, { width: 70, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + 24).lineTo(565, y + 24).stroke();
        y += 24;
      });
    }

    y += 12;

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

        // Name
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text(`${wName}${nick}`, 40, y + 6, { width: 138, lineBreak: false });

        // Status
        const statusColor = l.attendance === 'Present' ? C_GREEN : (l.attendance === 'Half Day' ? '#d97706' : C_RED);
        doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(9);
        doc.text(l.attendance || 'Present', 180, y + 6, { width: 65, align: 'center', lineBreak: false });

        // Wage
        doc.fillColor(C_DARK).font('Helvetica').fontSize(10);
        doc.text(`Rs.${Math.round(dw)}`, 245, y + 6, { width: 55, align: 'right', lineBreak: false });

        // Overtime
        doc.fillColor(C_PURPLE).font('Helvetica').fontSize(9);
        doc.text(otStr, 305, y + 6, { width: 113, lineBreak: false });

        // OT Pay
        doc.fillColor(C_PURPLE).font('Helvetica-Bold').fontSize(10);
        doc.text(otPay > 0 ? `Rs.${Math.round(otPay)}` : '-', 420, y + 6, { width: 55, align: 'right', lineBreak: false });

        // Money Paid
        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(10);
        doc.text(mg > 0 ? `Rs.${Math.round(mg)}${mgNote}` : '-', 480, y + 6, { width: 75, align: 'right', lineBreak: false });

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

      // Overview banner
      doc.fillColor('#f0f9ff').rect(30, y, PW, 22).fill();
      doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(10);
      doc.text(`Total Bills: ${allBills.length} | Net Area: ${Math.round(totalNetArea)} Sq Ft | Amount: Rs. ${Math.round(totalBillAmt)} | Received: Rs. ${Math.round(totalReceivedAmt)}`, 36, y + 5, { width: PW - 12 });
      y += 22;

      // Table Header
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

      // Overview banner
      doc.fillColor('#f0fdf4').rect(30, y, PW, 22).fill();
      doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(10);
      doc.text(`Active Sites: ${sites.length} | Total Expenses: Rs. ${Math.round(grandExp)} | Total Payments Received: Rs. ${Math.round(grandPay)}`, 36, y + 5, { width: PW - 12 });
      y += 22;

      // Table Header
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

    // ── DYNAMIC PAGE FOOTERS ──────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, 815).lineTo(565, 815).stroke();
      doc.fillColor(C_GRAY).font('Helvetica').fontSize(9);
      doc.text('KSS Inventory & Operations Backup Statement', 30, 820, { width: 350 });
      doc.text(`Page ${i + 1} of ${range.count}`, 380, 820, { width: 185, align: 'right' });
    }

    doc.end();
  });
}

module.exports = { generateDailyWarehouseSummary };
