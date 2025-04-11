// === claim_report_generator ===
// Backend: Node.js + Express + docxtemplater
// Frontend: HTML + TailwindCSS

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

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTw1R0AYFOUYzqpE5b51VmS9HHpH4Osv42RqbmauyYGOlZJiCoMgWOAN5JKgDBDfPFITQtZk3LZYDuK/pub?output=csv";

async function getClaimData(claimNumber) {
  const response = await axios.get(CSV_URL);
  const rows = response.data.split("\n").map(row => row.split(","));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[1]?.trim() === claimNumber.trim()) {
      return {
        tpa_name: row[0]?.trim(),             // A - TPA Name
        claim_no: row[1]?.trim(),             // B - Claim
        insurance: row[2]?.trim(),            // C - Insurance
        claim_type: row[3]?.trim(),           // D - ClmType
        patient_name: row[12]?.trim(),        // M - Patient Name
        doa: row[16]?.trim(),                 // Q - DOA
        hospital_name: row[18]?.trim(),       // S - HospName
        state: row[19]?.trim(),               // T - State
        city: row[20]?.trim(),                // U - City
        Policyno: row[23]?.trim(),            // X - Policy
        hospital_address: row[26]?.trim(),    // AA - Hospital Address
        dod: row[27]?.trim(),                 // AB - DOD
        insured_name: row[28]?.trim()         // AC - Insured
      };
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
      claim_no: row.claim_no || "NA",
      patient_name: row.patient_name || "NA",
      Policyno: row.Policyno || "NA",
      doa: row.doa || "NA",
      dod: row.dod || "NA",
      insured_name: row.insured_name || "NA",
      hospital_name: row.hospital_name || "NA",
      hospital_address: row.hospital_address || "NA",
      city: row.city || "NA",
      state: row.state || "NA",
      tpa_name: row.tpa_name || "NA",
      insurance: row.insurance || "NA",
      claim_type: row.claim_type || "NA"
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
