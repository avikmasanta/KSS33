const PDFDocument = require('pdfkit');

/**
 * Generates a Daily Warehouse Summary PDF buffer.
 * @param {Object} params
 * @param {string} params.date - The date of the report (YYYY-MM-DD)
 * @param {Object} params.models - The DB models dictionary
 */
async function generateDailyWarehouseSummary({ date, models }) {
  const Material = models.Material;
  const Incoming = models.Incoming;
  const Outgoing = models.Outgoing;
  const SiteReturns = models.SiteReturns;
  const RentalSite = models.RentalSite;
  const Site = models.Site;
  const SiteUsage = models.SiteUsage;
  const SiteDamaged = models.SiteDamaged;

  // 1. Fetch data
  const materials = await Material.find({ status: { $ne: 'Archived' } });
  const sites = await Site.find({});
  const allIncoming = await Incoming.find({});
  const allOutgoing = await Outgoing.find({});
  const allReturns = await SiteReturns.find({});
  const allRentals = await RentalSite.find({});
  const allUsage = await SiteUsage.find({});
  const allDamaged = await SiteDamaged.find({});

  // Map for easy ID lookups
  const materialsMap = {};
  materials.forEach(m => {
    materialsMap[String(m._id || m.id)] = m;
  });
  const sitesMap = {};
  sites.forEach(s => {
    sitesMap[String(s._id || s.id)] = s;
  });

  // Calculate current warehouse stock levels (identical to frontend Store.Inventory.getOverview)
  const currentStockMap = {};
  materials.forEach(m => {
    const mId = String(m._id || m.id);
    let totalPurchased = 0;
    let totalReturned = 0;

    allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          const qty = parseFloat(i.quantity) || 0;
          if (r.supplier && r.supplier.toLowerCase().includes('return')) {
            totalReturned += qty;
          } else {
            totalPurchased += qty;
          }
        }
      });
    });

    allReturns.forEach(r => {
      if (String(r.materialId) === mId) {
        totalReturned += parseFloat(r.quantity) || 0;
      }
    });

    let totalSent = 0;
    allOutgoing.forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          totalSent += parseFloat(i.quantity) || 0;
        }
      });
    });

    let totalRented = 0;
    allRentals.filter(r => r.status === 'Active').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          totalRented += parseFloat(i.quantity) || 0;
        }
      });
    });

    currentStockMap[mId] = (totalPurchased + totalReturned) - totalSent - totalRented;
  });

  // 2. Filter movements for the specified date (report Date YYYY-MM-DD)
  const incomingMovements = [];
  const outgoingMovements = [];

  // INCOMING TYPE A: Supplier purchases/receipts
  allIncoming.filter(r => r.destinationType === 'warehouse' && r.date === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      incomingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        sku: mat ? mat.sku || '-' : '-',
        quantity: parseFloat(i.quantity) || 0,
        source: 'Purchase',
        siteName: 'N/A',
        time: r.date
      });
    });
  });

  // INCOMING TYPE B: Site Returns
  allReturns.filter(r => r.date === date).forEach(r => {
    const mat = materialsMap[String(r.materialId)];
    const site = sitesMap[String(r.siteId)];
    incomingMovements.push({
      materialName: mat ? mat.name : 'Unknown',
      sku: mat ? mat.sku || '-' : '-',
      quantity: parseFloat(r.quantity) || 0,
      source: 'Site Return',
      siteName: site ? site.name : 'Unknown Site',
      time: r.date
    });
  });

  // INCOMING TYPE C: Rental Returns
  allRentals.filter(r => r.status === 'Returned' && r.comingDate === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      incomingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        sku: mat ? mat.sku || '-' : '-',
        quantity: parseFloat(i.quantity) || 0,
        source: 'Rental Return',
        siteName: `${r.customerName} - ${r.siteName || ''}`.trim(),
        time: r.comingDate
      });
    });
  });

  // OUTGOING TYPE A: Standard Dispatches to Sites
  allOutgoing.filter(r => r.date === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      const site = sitesMap[String(r.siteId)];
      outgoingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        sku: mat ? mat.sku || '-' : '-',
        quantity: parseFloat(i.quantity) || 0,
        destinationSite: site ? site.name : 'Unknown Site',
        challanNumber: r.ticketNo || r.referenceNo || 'N/A',
        time: r.date
      });
    });
  });

  // OUTGOING TYPE B: Rental Dispatches
  allRentals.filter(r => r.goingDate === date).forEach(r => {
    (r.items || []).forEach(i => {
      const mat = materialsMap[String(i.materialId)];
      outgoingMovements.push({
        materialName: mat ? mat.name : 'Unknown',
        sku: mat ? mat.sku || '-' : '-',
        quantity: parseFloat(i.quantity) || 0,
        destinationSite: `${r.customerName} - ${r.siteName || ''}`.trim(),
        challanNumber: r.id || 'N/A',
        time: r.goingDate
      });
    });
  });

  // 3. Compute Summary Statistics
  const totalIncomingQty = incomingMovements.reduce((sum, m) => sum + m.quantity, 0);
  const totalOutgoingQty = outgoingMovements.reduce((sum, m) => sum + m.quantity, 0);
  const netStockChange = totalIncomingQty - totalOutgoingQty;

  const currentWarehouseTotalStock = Object.values(currentStockMap).reduce((sum, val) => sum + val, 0);

  // Group to count unique dispatches/returns transactions
  const uniqueDispatches = new Set([
    ...allOutgoing.filter(r => r.date === date).map(r => r._id || r.id),
    ...allRentals.filter(r => r.goingDate === date).map(r => r._id || r.id)
  ]).size;

  const uniqueReturns = new Set([
    ...allReturns.filter(r => r.date === date).map(r => r._id || r.id),
    ...allRentals.filter(r => r.status === 'Returned' && r.comingDate === date).map(r => r._id || r.id)
  ]).size;

  // 4. Generate PDF Document
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Design Colors
    const primaryColor = '#1e3a8a';
    const secondaryColor = '#0f172a';
    const accentColor = '#3b82f6';
    const textColor = '#334155';
    const lightBorder = '#e2e8f0';

    // Header Logo Icon (Vector)
    doc.save();
    doc.translate(40, 40);
    doc.fillColor(accentColor).rect(0, 0, 36, 36).fill();
    doc.fillColor(primaryColor).rect(6, 6, 24, 24).fill();
    doc.fillColor('#ffffff').rect(12, 12, 12, 12).fill();
    doc.restore();

    // Company Header
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16);
    doc.text('KSS CONSTRUCTION MATERIALS', 90, 40);
    doc.fillColor(textColor).font('Helvetica').fontSize(9);
    doc.text('Professional Scaffold & Plate Hire Management System', 90, 58);

    // Title / Date Header
    doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(13);
    const dateFormatted = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Daily Warehouse Movement Summary - ${dateFormatted}`, 40, 95);
    doc.strokeColor(lightBorder).lineWidth(1).moveTo(40, 112).lineTo(555, 112).stroke();

    // 📊 Daily Summary Panel (3 Column grid)
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Daily Summary Statistics', 40, 128);

    const startY = 145;
    // Row 1 Cards
    drawSummaryCard(doc, 40, startY, 160, 45, 'Total Incoming', `${totalIncomingQty.toLocaleString('en-IN')} units`, '#f0fdf4', '#15803d');
    drawSummaryCard(doc, 218, startY, 160, 45, 'Total Outgoing', `${totalOutgoingQty.toLocaleString('en-IN')} units`, '#fef2f2', '#b91c1c');
    drawSummaryCard(doc, 395, startY, 160, 45, 'Net Stock Change', `${netStockChange >= 0 ? '+' : ''}${netStockChange.toLocaleString('en-IN')} units`, netStockChange >= 0 ? '#f0fdf4' : '#fef2f2', netStockChange >= 0 ? '#15803d' : '#b91c1c');

    // Row 2 Cards
    drawSummaryCard(doc, 40, startY + 55, 160, 45, 'Warehouse Stock', `${currentWarehouseTotalStock.toLocaleString('en-IN')} units`, '#f8fafc', primaryColor);
    drawSummaryCard(doc, 218, startY + 55, 160, 45, 'Dispatches logged', `${uniqueDispatches} Challans`, '#f0f9ff', '#0369a1');
    drawSummaryCard(doc, 395, startY + 55, 160, 45, 'Returns logged', `${uniqueReturns} Collections`, '#faf5ff', '#6b21a8');

    let currentY = startY + 115;

    // 📥 Incoming Table Header
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Incoming Materials (Receipts)', 40, currentY);
    currentY += 15;

    if (incomingMovements.length === 0) {
      doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(9);
      doc.text('No warehouse transactions recorded for this period.', 50, currentY + 10);
      currentY += 35;
    } else {
      const incomingHeaders = [
        { label: 'Material Name', x: 45, width: 140 },
        { label: 'SKU', x: 195, width: 70 },
        { label: 'Qty', x: 275, width: 50, align: 'right' },
        { label: 'Source', x: 340, width: 90 },
        { label: 'Site Name', x: 440, width: 110 }
      ];
      const incomingColumns = [
        { key: 'materialName', x: 45, width: 140 },
        { key: 'sku', x: 195, width: 70 },
        { key: 'quantity', x: 275, width: 50, align: 'right' },
        { key: 'source', x: 340, width: 90 },
        { key: 'siteName', x: 440, width: 110 }
      ];
      currentY = drawTable(doc, currentY, incomingHeaders, incomingColumns, incomingMovements);
      currentY += 20;
    }

    // 📤 Outgoing Table Header
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Outgoing Materials (Dispatches)', 40, currentY);
    currentY += 15;

    if (outgoingMovements.length === 0) {
      doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(9);
      doc.text('No warehouse transactions recorded for this period.', 50, currentY + 10);
      currentY += 35;
    } else {
      const outgoingHeaders = [
        { label: 'Material Name', x: 45, width: 140 },
        { label: 'SKU', x: 195, width: 70 },
        { label: 'Qty', x: 275, width: 50, align: 'right' },
        { label: 'Destination Site', x: 340, width: 115 },
        { label: 'Challan No', x: 465, width: 85 }
      ];
      const outgoingColumns = [
        { key: 'materialName', x: 45, width: 140 },
        { key: 'sku', x: 195, width: 70 },
        { key: 'quantity', x: 275, width: 50, align: 'right' },
        { key: 'destinationSite', x: 340, width: 115 },
        { key: 'challanNumber', x: 465, width: 85 }
      ];
      currentY = drawTable(doc, currentY, outgoingHeaders, outgoingColumns, outgoingMovements);
    }

    // 📍 Site Inventory Balances
    const activeSites = sites.filter(s => s.status !== 'Archived');
    
    if (activeSites.length > 0) {
      doc.addPage();
      currentY = 40;

      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13);
      doc.text('📍 Current Stock at Customer Sites', 40, currentY);
      doc.strokeColor(lightBorder).lineWidth(1).moveTo(40, currentY + 16).lineTo(555, currentY + 16).stroke();
      currentY += 28;

      let renderedAnySite = false;

      for (const site of activeSites) {
        const siteBalances = [];

        materials.forEach(m => {
          const mId = String(m._id || m.id);
          let totalSent = 0;

          // 1. Outgoing dispatches to this site
          allOutgoing.forEach(r => {
            if (String(r.siteId) === String(site._id || site.id)) {
              (r.items || []).forEach(i => {
                const matIdStr = String(i.materialId || '');
                if (matIdStr === mId) {
                  totalSent += parseFloat(i.quantity) || 0;
                }
              });
            }
          });

          // 2. Incoming dispatches direct to this site
          allIncoming.forEach(r => {
            if (r.destinationType === 'site' && String(r.destinationSiteId) === String(site._id || site.id)) {
              (r.items || []).forEach(i => {
                const matIdStr = String(i.materialId || '');
                if (matIdStr === mId) {
                  totalSent += parseFloat(i.quantity) || 0;
                }
              });
            }
          });

          // 3. Site returns
          let totalReturned = 0;
          allReturns.forEach(r => {
            if (String(r.siteId) === String(site._id || site.id)) {
              const matIdStr = String(r.materialId || '');
              if (matIdStr === mId) {
                totalReturned += parseFloat(r.quantity) || 0;
              }
            }
          });

          // 4. Site usage
          let totalUsed = 0;
          allUsage.forEach(r => {
            if (String(r.siteId) === String(site._id || site.id)) {
              const matIdStr = String(r.materialId || '');
              if (matIdStr === mId) {
                totalUsed += parseFloat(r.quantity) || 0;
              }
            }
          });

          // 5. Site damaged
          let totalDamaged = 0;
          allDamaged.forEach(r => {
            if (String(r.siteId) === String(site._id || site.id)) {
              const matIdStr = String(r.materialId || '');
              if (matIdStr === mId) {
                totalDamaged += parseFloat(r.quantity) || 0;
              }
            }
          });

          const netRemaining = totalSent - totalReturned - totalUsed - totalDamaged;

          if (netRemaining > 0 || totalSent > 0 || totalReturned > 0) {
            siteBalances.push({
              materialName: m.name,
              sku: m.sku || '-',
              unit: m.unit || '',
              sent: totalSent,
              returned: totalReturned,
              used: totalUsed,
              damaged: totalDamaged,
              remaining: netRemaining
            });
          }
        });

        // Only display site block if it has records with remaining balance > 0
        const itemsToRender = siteBalances.filter(b => b.remaining > 0);
        if (itemsToRender.length > 0) {
          renderedAnySite = true;

          // Check page break before rendering site header + first few rows
          if (currentY > 680) {
            doc.addPage();
            currentY = 40;
          }

          // Site Header Box
          doc.save();
          doc.fillColor('#f8fafc').rect(40, currentY, 515, 36).fill();
          doc.strokeColor(lightBorder).lineWidth(0.5).rect(40, currentY, 515, 36).stroke();
          
          doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10);
          doc.text(`Site: ${site.name}`, 50, currentY + 6);
          doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
          
          const detailsString = [
            site.customerName ? `Customer: ${site.customerName}` : null,
            site.contactNumber ? `Ph: ${site.contactNumber}` : null,
            site.address ? `Address: ${site.address}` : null
          ].filter(Boolean).join('  |  ');
          
          doc.text(detailsString || 'No customer or address details provided.', 50, currentY + 20);
          doc.restore();
          currentY += 42;

          // Draw Table
          const siteHeaders = [
            { label: 'Material Name', x: 45, width: 180 },
            { label: 'SKU', x: 235, width: 70 },
            { label: 'Sent', x: 315, width: 50, align: 'right' },
            { label: 'Returned', x: 375, width: 60, align: 'right' },
            { label: 'Net at Site', x: 445, width: 105, align: 'right' }
          ];
          const siteColumns = [
            { key: 'materialName', x: 45, width: 180 },
            { key: 'sku', x: 235, width: 70 },
            { key: 'sent', x: 315, width: 50, align: 'right' },
            { key: 'returned', x: 375, width: 60, align: 'right' },
            { key: 'remaining', x: 445, width: 105, align: 'right' }
          ];

          currentY = drawTable(doc, currentY, siteHeaders, siteColumns, itemsToRender);
          currentY += 20;
        }
      }

      if (!renderedAnySite) {
        doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(9);
        doc.text('No active materials or inventory deployed at customer sites currently.', 50, currentY + 10);
      }
    }

    // Page Numbering Footer (Second Pass)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor(lightBorder).lineWidth(0.5).moveTo(40, 785).lineTo(555, 785).stroke();
      doc.fillColor('#64748b').font('Helvetica').fontSize(8);
      doc.text('Confidential - KSS Inventory Management System', 40, 792);
      
      const pageText = `Page ${i + 1} of ${range.count}`;
      doc.text(pageText, 450, 792, { width: 105, align: 'right' });
    }

    doc.end();
  });
}

function drawSummaryCard(doc, x, y, width, height, title, value, bgColor, valueColor) {
  doc.save();
  // Draw rounded card background
  doc.fillColor(bgColor).rect(x, y, width, height).fill();
  doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(x, y, width, height).stroke();

  // Label text
  doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5);
  doc.text(title.toUpperCase(), x + 10, y + 8, { width: width - 20 });

  // Value text
  doc.fillColor(valueColor).font('Helvetica-Bold').fontSize(12);
  doc.text(value, x + 10, y + 22, { width: width - 20 });
  doc.restore();
}

function drawTable(doc, startY, headers, columns, data) {
  let y = startY;

  // Header backgrounds
  doc.fillColor('#1e3a8a').rect(40, y, 515, 18).fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  headers.forEach(h => {
    doc.text(h.label, h.x, y + 4, { width: h.width, align: h.align || 'left' });
  });
  y += 18;

  doc.font('Helvetica').fontSize(8);
  data.forEach((row, rowIdx) => {
    if (y > 730) {
      doc.addPage();
      y = 40;

      // Draw header again on new page
      doc.fillColor('#1e3a8a').rect(40, y, 515, 18).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
      headers.forEach(h => {
        doc.text(h.label, h.x, y + 4, { width: h.width, align: h.align || 'left' });
      });
      y += 18;
      doc.font('Helvetica').fontSize(8);
    }

    // Zebra striping
    if (rowIdx % 2 === 0) {
      doc.fillColor('#f8fafc').rect(40, y, 515, 16).fill();
    }
    doc.fillColor('#334155');

    columns.forEach(col => {
      let val = row[col.key];
      if (col.key === 'quantity' && typeof val === 'number') {
        val = val.toLocaleString('en-IN');
      }
      doc.text(String(val !== undefined ? val : '-'), col.x, y + 4, { width: col.width, align: col.align || 'left' });
    });

    // Border line under row
    doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(40, y + 16).lineTo(555, y + 16).stroke();
    y += 16;
  });

  return y;
}

module.exports = { generateDailyWarehouseSummary };
