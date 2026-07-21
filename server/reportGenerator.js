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
  const laboursMap = {};
  if (LabourLog) {
    try {
      allLabourLogs = await LabourLog.find({});
      dayLogs = allLabourLogs.filter(l => l.date === date);
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
  let totalIn = 0, totalOut = 0;
  allIncoming.filter(r => r.destinationType === 'warehouse' && r.date === date).forEach(r => {
    (r.items || []).forEach(i => totalIn += parseFloat(i.quantity) || 0);
  });
  allReturns.filter(r => r.date === date).forEach(r => totalIn += parseFloat(r.quantity) || 0);
  allOutgoing.filter(r => r.date === date).forEach(r => {
    (r.items || []).forEach(i => totalOut += parseFloat(i.quantity) || 0);
  });

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

    // Loop over every site and render complete 3-page landscape report
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

      // PAGE 1: RECEIVED (CHALLAN IN)
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
      drawSiteHeader(site, 'Material Received at Site');
      drawChallanTable(dispatchMats, dispatchRowKeys, dispatchMap);
      doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(11).text('CHALLAN (IN)', 700, 545, { width: 121, align: 'right' });

      // PAGE 2: RETURNED (CHALLAN RETURN)
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
      drawSiteHeader(site, 'Material Returned from Site');
      drawChallanTable(returnMats, returnRowKeys, returnMap);
      doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(11).text('CHALLAN (RETURN)', 700, 545, { width: 121, align: 'right' });

      // PAGE 3: INVENTORY SUMMARY (NET BALANCE)
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
      drawSiteHeader(site, 'Material Inventory Summary (Net Balance at Site)');
      drawSiteInventorySummaryTable(summaryMats, site);
      doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(11).text('INVENTORY SUMMARY', 700, 545, { width: 121, align: 'right' });
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
