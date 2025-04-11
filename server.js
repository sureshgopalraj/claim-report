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
  const rows = response.data.split("\n").map(row =>
    row.replace(/\r/g, "").split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, "").trim())
  );

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row[1] === claimNumber.trim()) {
      return {
        tpa_name: row[0] || "NA",
        claim_no: row[1] || "NA",
        insurance: row[2] || "NA",
        claim_type: row[3] || "NA",
        patient_name: row[12] || "NA",
        doa: row[16] || "NA",
        hospital_name: row[18] || "NA",
        state: row[19] || "NA",
        city: row[20] || "NA",
        Policyno: row[23] || "NA",
        hospital_address: row[26] || "NA",
        dod: row[27] || "NA",
        insured_name: row[28] || "NA"
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

    doc.setData(row);

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