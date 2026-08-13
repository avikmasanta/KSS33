const nodemailer = require('nodemailer');

/**
 * Generates full database backup JSON object and emails it as an attachment.
 * @param {Object} options - { models, recipientEmail }
 */
async function sendDatabaseBackupEmail({ models, recipientEmail }) {
  const targetEmail = recipientEmail || process.env.BACKUP_EMAIL || process.env.EMAIL_USER;
  
  if (!targetEmail) {
    return { success: false, error: 'No recipient email configured. Set BACKUP_EMAIL or EMAIL_USER environment variable.' };
  }

  // Fetch full database data across all collections
  const backupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    appName: 'KSS Construction & Warehouse Management',
    data: {
      Customer: await models.Customer.find(),
      Site: await models.Site.find(),
      Material: await models.Material.find(),
      Incoming: await models.Incoming.find(),
      Outgoing: await models.Outgoing.find(),
      SiteReturns: await models.SiteReturns.find(),
      SiteUsage: await models.SiteUsage.find(),
      SiteDamaged: await models.SiteDamaged.find(),
      SiteExpenses: await models.SiteExpenses.find(),
      SitePayments: await models.SitePayments.find(),
      Transaction: await models.Transaction.find(),
      RentalSite: await models.RentalSite.find(),
      Category: await models.Category.find(),
      Labour: await models.Labour.find(),
      LabourLog: await models.LabourLog.find(),
      LabourContract: models.LabourContract ? await models.LabourContract.find() : [],
      SeparateBilling: await models.SeparateBilling.find()
    }
  };

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `KSS_Full_Database_Backup_${dateStr}.json`;
  const jsonContent = JSON.stringify(backupData, null, 2);

  // Configure transporter
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return { 
      success: false, 
      error: 'SMTP credentials missing. Please add EMAIL_USER and EMAIL_PASS (App Password) to your environment settings.',
      filename,
      dataCount: Object.keys(backupData.data).reduce((acc, k) => acc + (backupData.data[k]?.length || 0), 0)
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const mailOptions = {
    from: `"KSS Construction System" <${user}>`,
    to: targetEmail,
    subject: `📦 KSS Full Database Automated Backup - ${dateStr}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">📦 KSS Automated Database Backup</h2>
        <p>Attached to this email is your <strong>Full System Database Backup</strong> for <strong>${dateStr}</strong>.</p>
        <div style="background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
          <h4 style="margin-top:0; color: #0f172a;">Backup Summary:</h4>
          <ul>
            <li><strong>Customers:</strong> ${backupData.data.Customer?.length || 0}</li>
            <li><strong>Sites:</strong> ${backupData.data.Site?.length || 0}</li>
            <li><strong>Rental Sites:</strong> ${backupData.data.RentalSite?.length || 0}</li>
            <li><strong>Materials:</strong> ${backupData.data.Material?.length || 0}</li>
            <li><strong>Labour Records:</strong> ${backupData.data.Labour?.length || 0}</li>
            <li><strong>Labour Logs:</strong> ${backupData.data.LabourLog?.length || 0}</li>
            <li><strong>Invoices / Separate Billings:</strong> ${backupData.data.SeparateBilling?.length || 0}</li>
          </ul>
        </div>
        <p style="font-size: 0.85rem; color: #64748b;">This backup file can be restored anytime directly in the web app under <strong>Settings &rarr; Import Database Backup</strong>.</p>
      </div>
    `,
    attachments: [
      {
        filename,
        content: jsonContent,
        contentType: 'application/json'
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId, recipient: targetEmail, filename };
}

module.exports = { sendDatabaseBackupEmail };
