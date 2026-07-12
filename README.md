# KSS33
Construction Materials Inventory & Site Management System

---

## 📊 Daily Summary Notification Setup

You can configure daily warehouse summary reports to be delivered automatically via **Telegram**, **SMS**, and **WhatsApp**.

### 🟢 WhatsApp Delivery Options
1. **FREE Option (Web Link)**: Click the **Web Link** button next to any contact on the Reports panel. It generates a pre-filled chat link to send the report instantly from your personal WhatsApp Web/App for free! No setup required.
2. **Twilio WhatsApp API**: Automatically sends morning reports if Twilio configuration is set in the `server/.env` file.
3. **Standard phone format**: Should include country code without spaces/dashes (e.g. `+919876543210`).

### 💬 SMS Notification Setup
1. SMS reports are sent using Twilio or Fast2SMS based on credentials set in the `server/.env` file.
2. If no API keys are configured, SMS sending defaults to **Mock Mode** (printed to backend server terminal console log for testing).
3. Standard phone format should include country code (e.g. `+91` for India) or be a 10-digit mobile number.

