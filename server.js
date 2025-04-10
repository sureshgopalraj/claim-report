// === claim_report_generator ===
// Backend: Node.js + Express + docxtemplater
// Frontend: HTML + TailwindCSS

// Step 1: Package.json (Initialize Node.js project)
// Run: npm init -y
// Install required packages
// Run: npm install express cors body-parser docxtemplater pizzip fs path axios

// Step 2: Directory structure (example):
// - public/
//   - index.html
// - templates/
//   - OIC.docx
//   - NIC.docx
//   - UIIC.docx
//   - NIA.docx
//   - Others.docx
// - server.js

// === server.js ===
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { XmlTemplater } = require("docxtemplater/js/xml-templater");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// === Public CSV Setup ===
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTw1R0AYFOUYzqpE5b51VmS9HHpH4Osv42RqbmauyYGOlZJiCoMgWOAN5JKgDBDfPFITQtZk3LZYDuK/pub?output=csv";

async function getClaimData(claimNumber) {
  const response = await axios.get(CSV_URL);
  const rows = response.data.split("\n").map(row => row.split(","));
  const headers = rows[0].map(h => h.trim().replace(/\r/g, ""));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const data = Object.fromEntries(headers.map((h, j) => [h, (row[j] || "").trim()]));
    if (data["ClmID"] === claimNumber.trim()) {
      return data;
    }
  }
  return null;
}

app.post("/check", async (req, res) => {
  const { claimNumber } = req.body;

  try {
    const row = await getClaimData(claimNumber);

    if (!row) {
      return res.status(404).json({ error: "Claim not found" });
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("Error fetching claim data:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/generate", async (req, res) => {
  const { claimNumber, templateType } = req.body;

  try {
    const row = await getClaimData(claimNumber);

    if (!row) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const templatePath = path.join(__dirname, "templates", `${templateType}.docx`);
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      xmlFileTransformer: XmlTemplater
    });

    doc.setData({
      claim_no: row["ClmID"],
      patient_name: row["Patient Name"],
      Policyno: row["PolicyNo"],
      doa: row["Date of Admission"],
      dod: row["Clmdod"],
      insured_name: row["PriBeneficiaryName"],
      hospital_name: row["HospName"],
      city: row["CityName"],
      state: row["HOSPITAL STATE"]
    });

    doc.render();

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const outputName = `Claim_${claimNumber}.docx`;
    const outputPath = path.join(__dirname, outputName);

    fs.writeFileSync(outputPath, buffer);

    res.download(outputPath, outputName, () => {
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("Error generating document:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
