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
  const SiteUsage  = models.SiteUsage;
  const SiteDamaged = models.SiteDamaged;

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

  // ── Warehouse rows (only items with stock > 0, sorted by name) ─────
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

  // ═══════════════════════════════════════════════════════════════════
  // PDF Generation — Mobile-first large-font layout
  // Page size: A4 portrait
  // ═══════════════════════════════════════════════════════════════════
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── COLORS ──────────────────────────────────────────────────────
    const C_DARK    = '#0f172a';
    const C_BLUE    = '#1e3a8a';
    const C_ACCENT  = '#2563eb';
    const C_GREEN   = '#15803d';
    const C_RED     = '#b91c1c';
    const C_GRAY    = '#64748b';
    const C_LIGHT   = '#f1f5f9';
    const C_WHITE   = '#ffffff';
    const C_BORDER  = '#cbd5e1';

    const PW = 535; // usable page width (595 - 2*30)

    // ── HELPERS ─────────────────────────────────────────────────────
    function sectionTitle(text, y, color = C_BLUE) {
      doc.fillColor(color).rect(30, y, PW, 32).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(14);
      doc.text(text, 42, y + 9, { width: PW - 24 });
      return y + 32;
    }

    function bigCard(x, y, w, h, label, value, bg, valColor) {
      doc.fillColor(bg).rect(x, y, w, h).fill();
      doc.strokeColor(C_BORDER).lineWidth(1).rect(x, y, w, h).stroke();
      doc.fillColor(C_GRAY).font('Helvetica-Bold').fontSize(9);
      doc.text(label.toUpperCase(), x + 8, y + 8, { width: w - 16 });
      doc.fillColor(valColor).font('Helvetica-Bold').fontSize(18);
      doc.text(value, x + 8, y + 22, { width: w - 16 });
    }

    // ── PAGE 1: HEADER + WAREHOUSE STOCK ────────────────────────────
    let y = 30;

    // ── Brand strip
    doc.fillColor(C_BLUE).rect(30, y, PW, 52).fill();
    doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(20);
    doc.text('KSS Construction Materials', 44, y + 8, { width: PW - 20 });
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(11);
    doc.text('Daily Warehouse & Operations Summary', 44, y + 32, { width: PW - 20 });
    y += 58;

    // ── Date banner
    doc.fillColor(C_LIGHT).rect(30, y, PW, 28).fill();
    doc.strokeColor(C_BORDER).lineWidth(1).rect(30, y, PW, 28).stroke();
    doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(13);
    doc.text(dateFormatted, 42, y + 8, { width: PW - 20 });
    y += 36;

    // ── Summary cards (2 rows x 3 cols)
    const cardW = Math.floor(PW / 3) - 4;
    const cardH = 50;
    const cardGap = 6;

    bigCard(30,                  y, cardW, cardH, 'Today Received', `+${totalIn}`,  '#f0fdf4', C_GREEN);
    bigCard(30 + cardW + cardGap, y, cardW, cardH, 'Today Dispatched', `-${totalOut}`, '#fef2f2', C_RED);
    bigCard(30 + (cardW + cardGap) * 2, y, cardW, cardH, 'Net Change', `${totalIn - totalOut >= 0 ? '+' : ''}${totalIn - totalOut}`, '#f0f9ff', C_ACCENT);
    y += cardH + 10;

    // ── Warehouse Stock Section ──────────────────────────────────────
    y = sectionTitle('🏢  Current Warehouse Stock', y);
    y += 6;

    if (warehouseRows.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(13);
      doc.text('No stock currently in warehouse.', 42, y + 12);
      y += 40;
    } else {
      // Table header
      doc.fillColor(C_DARK).rect(30, y, PW, 26).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(12);
      doc.text('Material Name', 42, y + 7, { width: 280 });
      doc.text('Unit', 322, y + 7, { width: 70, align: 'center' });
      doc.text('Qty', 392, y + 7, { width: 140, align: 'right' });
      y += 26;

      warehouseRows.forEach((row, idx) => {
        // Page break
        if (y > 740) {
          doc.addPage();
          y = 30;
          // Repeat header
          doc.fillColor(C_DARK).rect(30, y, PW, 26).fill();
          doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(12);
          doc.text('Material Name', 42, y + 7, { width: 280 });
          doc.text('Unit', 322, y + 7, { width: 70, align: 'center' });
          doc.text('Qty', 392, y + 7, { width: 140, align: 'right' });
          y += 26;
        }

        const rowH = 30;
        const bg   = idx % 2 === 0 ? C_WHITE : C_LIGHT;
        doc.fillColor(bg).rect(30, y, PW, rowH).fill();

        // Material name — large & bold
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(12);
        doc.text(row.name, 42, y + 9, { width: 278, lineBreak: false });

        // Unit — medium gray
        doc.fillColor(C_GRAY).font('Helvetica').fontSize(11);
        doc.text(row.unit, 322, y + 10, { width: 68, align: 'center', lineBreak: false });

        // Quantity — large bold coloured number
        const qtyColor = row.qty <= 0 ? C_RED : (row.qty < 10 ? '#d97706' : C_GREEN);
        doc.fillColor(qtyColor).font('Helvetica-Bold').fontSize(14);
        doc.text(row.qty.toLocaleString('en-IN'), 392, y + 8, { width: 138, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + rowH).lineTo(565, y + rowH).stroke();
        y += rowH;
      });
    }

    // ── PAGE 2: ACTIVE SITES STOCK ───────────────────────────────────
    doc.addPage();
    y = 30;
    y = sectionTitle('📍  Active Sites Inventory', y, C_ACCENT);
    y += 6;

    if (activeSitesData.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(13);
      doc.text('No materials currently deployed at active sites.', 42, y + 12);
      y += 40;
    } else {
      activeSitesData.forEach(site => {
        if (y > 700) {
          doc.addPage();
          y = 30;
        }

        const custStr = site.customer ? ` (${site.customer})` : '';
        doc.fillColor(C_LIGHT).rect(30, y, PW, 24).fill();
        doc.strokeColor(C_BORDER).lineWidth(0.5).rect(30, y, PW, 24).stroke();
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(11);
        doc.text(`${site.name}${custStr}`, 38, y + 6, { width: PW - 16 });
        y += 24;

        site.items.forEach((item, idx) => {
          if (y > 750) {
            doc.addPage();
            y = 30;
            // Redraw site header on new page
            doc.fillColor(C_LIGHT).rect(30, y, PW, 24).fill();
            doc.strokeColor(C_BORDER).lineWidth(0.5).rect(30, y, PW, 24).stroke();
            doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(11);
            doc.text(`${site.name}${custStr} (Cont.)`, 38, y + 6, { width: PW - 16 });
            y += 24;
          }

          const rowH = 26;
          const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
          doc.fillColor(bg).rect(30, y, PW, rowH).fill();

          doc.fillColor(C_DARK).font('Helvetica').fontSize(11);
          doc.text(item.name, 42, y + 7, { width: 300 });

          doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(12);
          doc.text(`${item.qty.toLocaleString('en-IN')} ${item.unit}`, 392, y + 7, { width: 138, align: 'right' });

          doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + rowH).lineTo(565, y + rowH).stroke();
          y += rowH;
        });
        y += 10; // spacing between sites
      });
    }

    // ── PAGE 3: ACTIVE RENTALS ───────────────────────────────────────
    doc.addPage();
    y = 30;
    y = sectionTitle('🔑  Active Rental Materials', y, C_BLUE);
    y += 6;

    if (activeRentalsData.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(13);
      doc.text('No active rentals currently deployed.', 42, y + 12);
      y += 40;
    } else {
      activeRentalsData.forEach(rental => {
        if (y > 700) {
          doc.addPage();
          y = 30;
        }

        const custStr = rental.customer ? ` (${rental.customer})` : '';
        doc.fillColor(C_LIGHT).rect(30, y, PW, 24).fill();
        doc.strokeColor(C_BORDER).lineWidth(0.5).rect(30, y, PW, 24).stroke();
        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(11);
        doc.text(`${rental.name}${custStr}`, 38, y + 6, { width: PW - 16 });
        y += 24;

        rental.items.forEach((item, idx) => {
          if (y > 750) {
            doc.addPage();
            y = 30;
            // Redraw header
            doc.fillColor(C_LIGHT).rect(30, y, PW, 24).fill();
            doc.strokeColor(C_BORDER).lineWidth(0.5).rect(30, y, PW, 24).stroke();
            doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(11);
            doc.text(`${rental.name}${custStr} (Cont.)`, 38, y + 6, { width: PW - 16 });
            y += 24;
          }

          const rowH = 26;
          const bg = idx % 2 === 0 ? C_WHITE : '#f8fafc';
          doc.fillColor(bg).rect(30, y, PW, rowH).fill();

          doc.fillColor(C_DARK).font('Helvetica').fontSize(11);
          doc.text(item.name, 42, y + 7, { width: 300 });

          doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(12);
          doc.text(`${item.qty.toLocaleString('en-IN')} ${item.unit}`, 392, y + 7, { width: 138, align: 'right' });

          doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + rowH).lineTo(565, y + rowH).stroke();
          y += rowH;
        });
        y += 10;
      });
    }

    // ── PAGE 4: TODAY'S MOVEMENTS ────────────────────────────────────
    doc.addPage();
    y = 30;

    // ── Incoming movements
    y = sectionTitle('📥  Today\'s Received Materials', y, C_GREEN);
    y += 6;

    if (incomingMovements.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(13);
      doc.text('Nothing received today.', 42, y + 10);
      y += 36;
    } else {
      // header row
      doc.fillColor(C_GREEN).rect(30, y, PW, 24).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(11);
      doc.text('Material', 42, y + 6, { width: 240 });
      doc.text('Qty', 282, y + 6, { width: 80, align: 'right' });
      doc.text('Source', 372, y + 6, { width: 163 });
      y += 24;

      incomingMovements.forEach((row, idx) => {
        if (y > 750) { doc.addPage(); y = 30; }
        const rowH = 30;
        const bg = idx % 2 === 0 ? C_WHITE : '#f0fdf4';
        doc.fillColor(bg).rect(30, y, PW, rowH).fill();

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(12);
        doc.text(row.materialName, 42, y + 9, { width: 238, lineBreak: false });

        doc.fillColor(C_GREEN).font('Helvetica-Bold').fontSize(14);
        doc.text(`+${row.quantity}`, 282, y + 7, { width: 80, align: 'right', lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(11);
        doc.text(row.source, 372, y + 9, { width: 163, lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + rowH).lineTo(565, y + rowH).stroke();
        y += rowH;
      });
    }

    y += 14;

    // ── Outgoing movements
    if (y > 680) { doc.addPage(); y = 30; }
    y = sectionTitle('📤  Today\'s Dispatched Materials', y, C_RED);
    y += 6;

    if (outgoingMovements.length === 0) {
      doc.fillColor(C_GRAY).font('Helvetica-Oblique').fontSize(13);
      doc.text('Nothing dispatched today.', 42, y + 10);
      y += 36;
    } else {
      // header
      doc.fillColor(C_RED).rect(30, y, PW, 24).fill();
      doc.fillColor(C_WHITE).font('Helvetica-Bold').fontSize(11);
      doc.text('Material', 42, y + 6, { width: 200 });
      doc.text('Qty', 242, y + 6, { width: 70, align: 'right' });
      doc.text('Site', 322, y + 6, { width: 163 });
      doc.text('Challan', 485, y + 6, { width: 80, align: 'right' });
      y += 24;

      outgoingMovements.forEach((row, idx) => {
        if (y > 750) { doc.addPage(); y = 30; }
        const rowH = 30;
        const bg = idx % 2 === 0 ? C_WHITE : '#fef2f2';
        doc.fillColor(bg).rect(30, y, PW, rowH).fill();

        doc.fillColor(C_DARK).font('Helvetica-Bold').fontSize(12);
        doc.text(row.materialName, 42, y + 9, { width: 198, lineBreak: false });

        doc.fillColor(C_RED).font('Helvetica-Bold').fontSize(14);
        doc.text(`-${row.quantity}`, 242, y + 7, { width: 70, align: 'right', lineBreak: false });

        doc.fillColor(C_GRAY).font('Helvetica').fontSize(11);
        doc.text(row.destination, 322, y + 9, { width: 161, lineBreak: false });
        doc.text(row.challan, 485, y + 9, { width: 80, align: 'right', lineBreak: false });

        doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, y + rowH).lineTo(565, y + rowH).stroke();
        y += rowH;
      });
    }

    // ── PAGE FOOTER ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(30, 815).lineTo(565, 815).stroke();
      doc.fillColor(C_GRAY).font('Helvetica').fontSize(9);
      doc.text('KSS Inventory Management System — Operations Report', 30, 820, { width: 350 });
      doc.text(`Page ${i + 1} of ${range.count}`, 380, 820, { width: 185, align: 'right' });
    }

    doc.end();
  });
}

module.exports = { generateDailyWarehouseSummary };
