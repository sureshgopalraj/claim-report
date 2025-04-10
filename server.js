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
  const headers = rows[0].map(h => h.trim().replace(/\r/g, ""));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const data = Object.fromEntries(headers.map((h, j) => [h, (row[j] || "").trim()]));
    if (data["Claim"] === claimNumber.trim()) {
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
      claim_no: row["Claim"] || "NA",
      patient_name: row["Patient Name"] || "NA",
      Policyno: row["Policy"] || "NA",
      doa: row["DOA"] || "NA",
      dod: row["DOD"] || "NA",
      insured_name: row["Insured"] || "NA",
      hospital_name: row["HospName"] || "NA",
      city: row["City"] || "NA",
      state: row["State"] || "NA",
      tpa_name: row["TPA Name"] || "NA",
      insurance: row["Insurance"] || "NA",
      claim_type: row["ClmType"] || "NA",
      hospital_address: row["Hospital Address"] || "NA"
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
